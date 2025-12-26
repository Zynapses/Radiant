import { executeStatement } from '../db/client';

type LayoutType = 'horizontal' | 'vertical' | 'grid';
type SyncMode = 'independent' | 'synchronized' | 'broadcast';
type PaneStatus = 'idle' | 'streaming' | 'error' | 'complete';

interface LayoutConfig {
  type: LayoutType;
  panes: PaneConfig[];
}

interface PaneConfig {
  id: string;
  size: number;
  model?: string;
  chatId?: string;
}

export class ConcurrentSessionManager {
  async createSession(
    tenantId: string,
    userId: string,
    name?: string,
    initialPanes: number = 2
  ): Promise<string> {
    const layout: LayoutConfig = {
      type: 'horizontal',
      panes: Array(initialPanes)
        .fill(null)
        .map((_, i) => ({
          id: `pane-${i}`,
          size: 100 / initialPanes,
        })),
    };

    const result = await executeStatement(
      `INSERT INTO concurrent_sessions (tenant_id, user_id, session_name, layout_config)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'sessionName', value: name ? { stringValue: name } : { isNull: true } },
        { name: 'layoutConfig', value: { stringValue: JSON.stringify(layout) } },
      ]
    );

    const sessionId = String((result.rows[0] as Record<string, unknown>)?.id || '');

    // Create pane records
    for (let i = 0; i < initialPanes; i++) {
      await executeStatement(
        `INSERT INTO concurrent_panes (session_id, pane_index) VALUES ($1, $2)`,
        [
          { name: 'sessionId', value: { stringValue: sessionId } },
          { name: 'paneIndex', value: { longValue: i } },
        ]
      );
    }

    // Create sync state
    await executeStatement(
      `INSERT INTO concurrent_sync_state (session_id) VALUES ($1)`,
      [{ name: 'sessionId', value: { stringValue: sessionId } }]
    );

    return sessionId;
  }

  async getSession(sessionId: string): Promise<unknown> {
    const result = await executeStatement(
      `SELECT * FROM concurrent_sessions WHERE id = $1`,
      [{ name: 'sessionId', value: { stringValue: sessionId } }]
    );
    return result.rows[0];
  }

  async getUserSessions(tenantId: string, userId: string): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT * FROM concurrent_sessions 
       WHERE tenant_id = $1 AND user_id = $2 AND is_active = true
       ORDER BY updated_at DESC`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );
    return result.rows;
  }

  async getPanes(sessionId: string): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT * FROM concurrent_panes WHERE session_id = $1 ORDER BY pane_index`,
      [{ name: 'sessionId', value: { stringValue: sessionId } }]
    );
    return result.rows;
  }

  async addPane(sessionId: string, model?: string): Promise<number> {
    const session = (await this.getSession(sessionId)) as Record<string, unknown>;
    const layoutConfig = (
      typeof session.layout_config === 'string'
        ? JSON.parse(session.layout_config)
        : session.layout_config
    ) as LayoutConfig;
    const maxPanes = (session.max_panes as number) || 4;

    if (layoutConfig.panes.length >= maxPanes) {
      throw new Error('Maximum panes reached');
    }

    const newIndex = layoutConfig.panes.length;

    await executeStatement(
      `INSERT INTO concurrent_panes (session_id, pane_index, model) VALUES ($1, $2, $3)`,
      [
        { name: 'sessionId', value: { stringValue: sessionId } },
        { name: 'paneIndex', value: { longValue: newIndex } },
        { name: 'model', value: model ? { stringValue: model } : { isNull: true } },
      ]
    );

    // Update layout with rebalanced sizes
    const newLayout: LayoutConfig = {
      ...layoutConfig,
      panes: [...layoutConfig.panes, { id: `pane-${newIndex}`, size: 0 }].map((p) => ({
        ...p,
        size: 100 / (layoutConfig.panes.length + 1),
      })),
    };

    await executeStatement(
      `UPDATE concurrent_sessions SET layout_config = $2, updated_at = NOW() WHERE id = $1`,
      [
        { name: 'sessionId', value: { stringValue: sessionId } },
        { name: 'layoutConfig', value: { stringValue: JSON.stringify(newLayout) } },
      ]
    );

    return newIndex;
  }

  async removePane(sessionId: string, paneIndex: number): Promise<void> {
    await executeStatement(
      `DELETE FROM concurrent_panes WHERE session_id = $1 AND pane_index = $2`,
      [
        { name: 'sessionId', value: { stringValue: sessionId } },
        { name: 'paneIndex', value: { longValue: paneIndex } },
      ]
    );

    // Reindex remaining panes
    await executeStatement(
      `UPDATE concurrent_panes SET pane_index = pane_index - 1 
       WHERE session_id = $1 AND pane_index > $2`,
      [
        { name: 'sessionId', value: { stringValue: sessionId } },
        { name: 'paneIndex', value: { longValue: paneIndex } },
      ]
    );

    // Update layout
    const session = (await this.getSession(sessionId)) as Record<string, unknown>;
    const layoutConfig = (
      typeof session.layout_config === 'string'
        ? JSON.parse(session.layout_config)
        : session.layout_config
    ) as LayoutConfig;

    const newPanes = layoutConfig.panes.filter((_, i) => i !== paneIndex);
    const equalSize = 100 / Math.max(newPanes.length, 1);

    await executeStatement(
      `UPDATE concurrent_sessions SET layout_config = $2, updated_at = NOW() WHERE id = $1`,
      [
        { name: 'sessionId', value: { stringValue: sessionId } },
        {
          name: 'layoutConfig',
          value: {
            stringValue: JSON.stringify({
              ...layoutConfig,
              panes: newPanes.map((p) => ({ ...p, size: equalSize })),
            }),
          },
        },
      ]
    );
  }

  async updatePaneModel(sessionId: string, paneIndex: number, model: string): Promise<void> {
    await executeStatement(
      `UPDATE concurrent_panes SET model = $3 WHERE session_id = $1 AND pane_index = $2`,
      [
        { name: 'sessionId', value: { stringValue: sessionId } },
        { name: 'paneIndex', value: { longValue: paneIndex } },
        { name: 'model', value: { stringValue: model } },
      ]
    );
  }

  async updatePaneStatus(sessionId: string, paneIndex: number, status: PaneStatus): Promise<void> {
    await executeStatement(
      `UPDATE concurrent_panes SET status = $3, last_activity = NOW() 
       WHERE session_id = $1 AND pane_index = $2`,
      [
        { name: 'sessionId', value: { stringValue: sessionId } },
        { name: 'paneIndex', value: { longValue: paneIndex } },
        { name: 'status', value: { stringValue: status } },
      ]
    );
  }

  async setSyncMode(sessionId: string, mode: SyncMode): Promise<void> {
    await executeStatement(
      `UPDATE concurrent_sync_state SET sync_mode = $2, updated_at = NOW() WHERE session_id = $1`,
      [
        { name: 'sessionId', value: { stringValue: sessionId } },
        { name: 'mode', value: { stringValue: mode } },
      ]
    );
  }

  async updateLayout(sessionId: string, layoutType: LayoutType): Promise<void> {
    const session = (await this.getSession(sessionId)) as Record<string, unknown>;
    const layoutConfig = (
      typeof session.layout_config === 'string'
        ? JSON.parse(session.layout_config)
        : session.layout_config
    ) as LayoutConfig;

    await executeStatement(
      `UPDATE concurrent_sessions SET layout_config = $2, updated_at = NOW() WHERE id = $1`,
      [
        { name: 'sessionId', value: { stringValue: sessionId } },
        { name: 'layoutConfig', value: { stringValue: JSON.stringify({ ...layoutConfig, type: layoutType }) } },
      ]
    );
  }

  async deleteSession(sessionId: string): Promise<void> {
    await executeStatement(
      `UPDATE concurrent_sessions SET is_active = false WHERE id = $1`,
      [{ name: 'sessionId', value: { stringValue: sessionId } }]
    );
  }
}

export const concurrentSessionManager = new ConcurrentSessionManager();
