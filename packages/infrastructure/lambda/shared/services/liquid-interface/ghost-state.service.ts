// RADIANT v4.18.0 - Ghost State Manager
// Two-way binding between UI state and AI context
// "The AI sees what you're doing. The UI reflects what the AI knows."

import { executeStatement, stringParam } from '../../db/client';
import { enhancedLogger as logger } from '../../logging/enhanced-logger';
import {
  GhostBinding,
  GhostEvent,
  GhostStateSnapshot,
  BindingTransform,
  AIReaction,
} from '@radiant/shared';

// ============================================================================
// Ghost State Manager
// ============================================================================

interface GhostStateStore {
  values: Record<string, unknown>;
  bindings: GhostBinding[];
  dirtyKeys: Set<string>;
  lastSync: string;
}

class GhostStateService {
  private stores: Map<string, GhostStateStore> = new Map();
  private pendingReactions: Map<string, AIReaction[]> = new Map();

  // --------------------------------------------------------------------------
  // State Management
  // --------------------------------------------------------------------------

  initializeStore(sessionId: string, bindings: GhostBinding[], initialState: Record<string, unknown> = {}): void {
    this.stores.set(sessionId, {
      values: { ...initialState },
      bindings,
      dirtyKeys: new Set(),
      lastSync: new Date().toISOString(),
    });

    logger.debug('Initialized ghost state store', { sessionId, bindingCount: bindings.length });
  }

  getStore(sessionId: string): GhostStateStore | undefined {
    return this.stores.get(sessionId);
  }

  getValue(sessionId: string, key: string): unknown {
    const store = this.stores.get(sessionId);
    return store?.values[key];
  }

  // --------------------------------------------------------------------------
  // UI → AI Sync (User interaction updates AI context)
  // --------------------------------------------------------------------------

  async syncFromUI(
    sessionId: string,
    componentId: string,
    property: string,
    value: unknown
  ): Promise<{ shouldTriggerReaction: boolean; binding?: GhostBinding }> {
    const store = this.stores.get(sessionId);
    if (!store) {
      logger.warn('No ghost state store for session', { sessionId });
      return { shouldTriggerReaction: false };
    }

    // Find binding for this component/property
    const binding = store.bindings.find(
      b => b.sourceComponent === componentId && 
           b.sourceProperty === property &&
           (b.direction === 'ui_to_ai' || b.direction === 'bidirectional')
    );

    if (!binding) {
      logger.debug('No binding for UI update', { sessionId, componentId, property });
      return { shouldTriggerReaction: false };
    }

    // Apply transform if defined
    const transformedValue = this.applyTransform(value, binding.transform);

    // Update store
    store.values[binding.contextKey] = transformedValue;
    store.dirtyKeys.add(binding.contextKey);
    store.lastSync = new Date().toISOString();

    // Persist to database
    await this.persistState(sessionId, binding.contextKey, transformedValue);

    logger.debug('Synced UI to AI', {
      sessionId,
      componentId,
      property,
      contextKey: binding.contextKey,
    });

    return {
      shouldTriggerReaction: binding.triggerReaction ?? false,
      binding,
    };
  }

  // --------------------------------------------------------------------------
  // AI → UI Sync (AI updates push to UI)
  // --------------------------------------------------------------------------

  async syncFromAI(
    sessionId: string,
    contextKey: string,
    value: unknown
  ): Promise<Array<{ componentId: string; property: string; value: unknown }>> {
    const store = this.stores.get(sessionId);
    if (!store) {
      return [];
    }

    // Find bindings that target this context key
    const bindings = store.bindings.filter(
      b => b.contextKey === contextKey &&
           (b.direction === 'ai_to_ui' || b.direction === 'bidirectional')
    );

    const updates: Array<{ componentId: string; property: string; value: unknown }> = [];

    for (const binding of bindings) {
      // Apply inverse transform if needed
      const transformedValue = this.applyInverseTransform(value, binding.transform);

      updates.push({
        componentId: binding.sourceComponent,
        property: binding.sourceProperty,
        value: transformedValue,
      });

      // Update store
      store.values[binding.contextKey] = value;
    }

    store.lastSync = new Date().toISOString();

    logger.debug('Synced AI to UI', {
      sessionId,
      contextKey,
      updateCount: updates.length,
    });

    return updates;
  }

  // --------------------------------------------------------------------------
  // Bulk Operations
  // --------------------------------------------------------------------------

  async syncMultiple(
    sessionId: string,
    updates: Array<{ componentId: string; property: string; value: unknown }>
  ): Promise<GhostBinding[]> {
    const triggeredBindings: GhostBinding[] = [];

    for (const update of updates) {
      const result = await this.syncFromUI(
        sessionId,
        update.componentId,
        update.property,
        update.value
      );

      if (result.shouldTriggerReaction && result.binding) {
        triggeredBindings.push(result.binding);
      }
    }

    return triggeredBindings;
  }

  // --------------------------------------------------------------------------
  // Snapshot & Context Building
  // --------------------------------------------------------------------------

  getSnapshot(sessionId: string): GhostStateSnapshot | null {
    const store = this.stores.get(sessionId);
    if (!store) return null;

    return {
      sessionId,
      timestamp: new Date().toISOString(),
      values: { ...store.values },
      dirtyKeys: Array.from(store.dirtyKeys),
      bindingCount: store.bindings.length,
    };
  }

  buildAIContext(sessionId: string): string {
    const store = this.stores.get(sessionId);
    if (!store) return '';

    const contextParts: string[] = ['<ghost_state>'];

    for (const [key, value] of Object.entries(store.values)) {
      const valueStr = typeof value === 'object' 
        ? JSON.stringify(value, null, 2) 
        : String(value);
      contextParts.push(`  <${key}>${valueStr}</${key}>`);
    }

    // Mark dirty keys (recently changed by user)
    if (store.dirtyKeys.size > 0) {
      contextParts.push(`  <recently_changed>${Array.from(store.dirtyKeys).join(', ')}</recently_changed>`);
    }

    contextParts.push('</ghost_state>');

    return contextParts.join('\n');
  }

  clearDirtyKeys(sessionId: string): void {
    const store = this.stores.get(sessionId);
    if (store) {
      store.dirtyKeys.clear();
    }
  }

  // --------------------------------------------------------------------------
  // Event Recording
  // --------------------------------------------------------------------------

  async recordEvent(sessionId: string, event: GhostEvent): Promise<void> {
    await executeStatement(
      `INSERT INTO liquid_ghost_events 
        (id, session_id, component_id, component_type, action, payload, current_state, created_at)
        VALUES (:id, :sessionId, :componentId, :componentType, :action, :payload, :currentState, NOW())`,
      [
        stringParam('id', event.id),
        stringParam('sessionId', sessionId),
        stringParam('componentId', event.componentId),
        stringParam('componentType', event.componentType),
        stringParam('action', event.action),
        stringParam('payload', JSON.stringify(event.payload)),
        stringParam('currentState', JSON.stringify(event.currentState)),
      ]
    );
  }

  async getEventHistory(
    sessionId: string,
    limit: number = 50
  ): Promise<GhostEvent[]> {
    const result = await executeStatement(
      `SELECT * FROM liquid_ghost_events 
        WHERE session_id = :sessionId 
        ORDER BY created_at DESC 
        LIMIT :limit`,
      [stringParam('sessionId', sessionId), stringParam('limit', String(limit))]
    );

    return (result.rows || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      componentId: String(row.component_id),
      componentType: String(row.component_type),
      action: String(row.action) as GhostEvent['action'],
      payload: this.parseJson(row.payload) || {},
      currentState: this.parseJson(row.current_state) || {},
      timestamp: String(row.created_at),
    }));
  }

  // --------------------------------------------------------------------------
  // Reaction Queue
  // --------------------------------------------------------------------------

  queueReaction(sessionId: string, reaction: AIReaction): void {
    const queue = this.pendingReactions.get(sessionId) || [];
    queue.push(reaction);
    this.pendingReactions.set(sessionId, queue);
  }

  getPendingReactions(sessionId: string): AIReaction[] {
    const reactions = this.pendingReactions.get(sessionId) || [];
    this.pendingReactions.set(sessionId, []);
    return reactions;
  }

  // --------------------------------------------------------------------------
  // Persistence
  // --------------------------------------------------------------------------

  private async persistState(sessionId: string, key: string, value: unknown): Promise<void> {
    await executeStatement(
      `INSERT INTO liquid_ghost_state (session_id, context_key, value, updated_at)
        VALUES (:sessionId, :key, :value, NOW())
        ON CONFLICT (session_id, context_key) 
        DO UPDATE SET value = :value, updated_at = NOW()`,
      [
        stringParam('sessionId', sessionId),
        stringParam('key', key),
        stringParam('value', JSON.stringify(value)),
      ]
    );
  }

  async loadState(sessionId: string): Promise<Record<string, unknown>> {
    const result = await executeStatement(
      `SELECT context_key, value FROM liquid_ghost_state WHERE session_id = :sessionId`,
      [stringParam('sessionId', sessionId)]
    );

    const state: Record<string, unknown> = {};
    for (const row of (result.rows || []) as Array<Record<string, unknown>>) {
      const key = String(row.context_key);
      state[key] = this.parseJson(row.value);
    }

    return state;
  }

  // --------------------------------------------------------------------------
  // Transform Helpers
  // --------------------------------------------------------------------------

  private applyTransform(value: unknown, transform?: BindingTransform): unknown {
    if (!transform || transform.type === 'identity') {
      return value;
    }

    switch (transform.type) {
      case 'format':
        return this.formatValue(value, transform.config);
      case 'aggregate':
        return this.aggregateValue(value, transform.config);
      case 'filter':
        return this.filterValue(value, transform.config);
      default:
        return value;
    }
  }

  private applyInverseTransform(value: unknown, transform?: BindingTransform): unknown {
    // Most transforms are one-way; inverse just returns the value
    return value;
  }

  private formatValue(value: unknown, config?: Record<string, unknown>): unknown {
    if (!config?.format) return value;
    
    const format = String(config.format);
    if (format === 'json' && typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    if (format === 'csv' && Array.isArray(value)) {
      return value.map(row => Object.values(row as Record<string, unknown>).join(',')).join('\n');
    }
    return value;
  }

  private aggregateValue(value: unknown, config?: Record<string, unknown>): unknown {
    if (!Array.isArray(value)) return value;
    
    const op = String(config?.operation || 'count');
    const field = config?.field as string;

    switch (op) {
      case 'count':
        return value.length;
      case 'sum':
        return value.reduce((acc, item) => acc + (Number((item as Record<string, unknown>)[field]) || 0), 0);
      case 'avg':
        const sum = value.reduce((acc, item) => acc + (Number((item as Record<string, unknown>)[field]) || 0), 0);
        return value.length > 0 ? sum / value.length : 0;
      default:
        return value;
    }
  }

  private filterValue(value: unknown, config?: Record<string, unknown>): unknown {
    if (!Array.isArray(value) || !config?.predicate) return value;
    
    const field = String(config.field);
    const op = String(config.predicate);
    const compareValue = config.value;

    return value.filter(item => {
      const itemValue = (item as Record<string, unknown>)[field];
      switch (op) {
        case 'eq': return itemValue === compareValue;
        case 'neq': return itemValue !== compareValue;
        case 'gt': return Number(itemValue) > Number(compareValue);
        case 'lt': return Number(itemValue) < Number(compareValue);
        case 'contains': return String(itemValue).includes(String(compareValue));
        default: return true;
      }
    });
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  destroyStore(sessionId: string): void {
    this.stores.delete(sessionId);
    this.pendingReactions.delete(sessionId);
    logger.debug('Destroyed ghost state store', { sessionId });
  }

  private parseJson<T>(value: unknown): T | null {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return null; }
    }
    return value as T;
  }
}

export const ghostStateService = new GhostStateService();
