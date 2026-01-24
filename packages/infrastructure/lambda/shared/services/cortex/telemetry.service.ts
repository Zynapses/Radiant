/**
 * Cortex Live Telemetry Service
 * Real-time sensor data injection (MQTT/OPC UA/Kafka)
 */

import type {
  TelemetryFeedConfig,
  TelemetryFeedCreateRequest,
  TelemetryDataPoint,
  TelemetrySnapshot,
  TelemetryProtocol,
} from '@radiant/shared';

interface DbClient {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
}

interface RedisClient {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options?: { EX?: number }) => Promise<void>;
  hSet: (key: string, field: string, value: string) => Promise<void>;
  hGetAll: (key: string) => Promise<Record<string, string>>;
}

export class TelemetryService {
  constructor(
    private db: DbClient,
    private redis: RedisClient
  ) {}

  /**
   * Create a new telemetry feed configuration
   */
  async createFeed(request: TelemetryFeedCreateRequest): Promise<TelemetryFeedConfig> {
    const result = await this.db.query(
      `INSERT INTO cortex_telemetry_feeds (
        tenant_id, name, protocol, endpoint, node_ids, topics,
        poll_interval_ms, context_injection, transform_script, auth_config
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        request.tenantId,
        request.name,
        request.protocol,
        request.endpoint,
        request.nodeIds || null,
        request.topics || null,
        request.pollIntervalMs || 1000,
        request.contextInjection ?? true,
        request.transformScript || null,
        request.authConfig ? JSON.stringify(request.authConfig) : null,
      ]
    );

    return this.mapRowToFeed(result.rows[0]);
  }

  /**
   * Start polling a telemetry feed
   */
  async startFeed(feedId: string, tenantId: string): Promise<void> {
    const feed = await this.getFeed(feedId, tenantId);
    if (!feed) {
      throw new Error(`Feed not found: ${feedId}`);
    }

    await this.db.query(
      `UPDATE cortex_telemetry_feeds SET is_active = true, error_count = 0, last_error = NULL WHERE id = $1`,
      [feedId]
    );

    // In production, this would trigger an EventBridge rule or Lambda to start polling
    // For now, we mark the feed as active
  }

  /**
   * Stop a telemetry feed
   */
  async stopFeed(feedId: string, tenantId: string): Promise<void> {
    await this.db.query(
      `UPDATE cortex_telemetry_feeds SET is_active = false WHERE id = $1 AND tenant_id = $2`,
      [feedId, tenantId]
    );
  }

  /**
   * Record telemetry data point
   */
  async recordDataPoint(dataPoint: TelemetryDataPoint): Promise<void> {
    // Store in database for historical queries
    await this.db.query(
      `INSERT INTO cortex_telemetry_data (
        feed_id, tenant_id, node_id, value_numeric, value_text, value_boolean,
        quality, timestamp, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        dataPoint.feedId,
        dataPoint.tenantId,
        dataPoint.nodeId,
        typeof dataPoint.value === 'number' ? dataPoint.value : null,
        typeof dataPoint.value === 'string' ? dataPoint.value : null,
        typeof dataPoint.value === 'boolean' ? dataPoint.value : null,
        dataPoint.quality,
        dataPoint.timestamp,
        dataPoint.metadata ? JSON.stringify(dataPoint.metadata) : null,
      ]
    );

    // Store latest value in Redis for hot tier access
    const redisKey = `${dataPoint.tenantId}:telemetry:${dataPoint.feedId}`;
    await this.redis.hSet(
      redisKey,
      dataPoint.nodeId,
      JSON.stringify({
        value: dataPoint.value,
        quality: dataPoint.quality,
        timestamp: dataPoint.timestamp.toISOString(),
      })
    );

    // Update feed's last_data_at
    await this.db.query(
      `UPDATE cortex_telemetry_feeds SET last_data_at = NOW() WHERE id = $1`,
      [dataPoint.feedId]
    );
  }

  /**
   * Record multiple data points (batch)
   */
  async recordBatch(dataPoints: TelemetryDataPoint[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const dp of dataPoints) {
      try {
        await this.recordDataPoint(dp);
        success++;
      } catch {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Get latest telemetry snapshot for a feed (from Hot tier)
   */
  async getSnapshot(feedId: string, tenantId: string): Promise<TelemetrySnapshot | null> {
    const feed = await this.getFeed(feedId, tenantId);
    if (!feed) {
      return null;
    }

    const redisKey = `${tenantId}:telemetry:${feedId}`;
    const data = await this.redis.hGetAll(redisKey);

    const dataPoints: TelemetryDataPoint[] = Object.entries(data).map(([nodeId, json]) => {
      const parsed = JSON.parse(json);
      return {
        feedId,
        tenantId,
        nodeId,
        value: parsed.value,
        quality: parsed.quality,
        timestamp: new Date(parsed.timestamp),
      };
    });

    return {
      feedId,
      feedName: feed.name,
      dataPoints,
      lastUpdated: feed.updatedAt,
    };
  }

  /**
   * Get telemetry snapshots for context injection
   */
  async getContextInjectionData(tenantId: string): Promise<TelemetrySnapshot[]> {
    const feeds = await this.listFeeds(tenantId, { activeOnly: true, contextInjectionOnly: true });
    const snapshots: TelemetrySnapshot[] = [];

    for (const feed of feeds) {
      const snapshot = await this.getSnapshot(feed.id, tenantId);
      if (snapshot && snapshot.dataPoints.length > 0) {
        snapshots.push(snapshot);
      }
    }

    return snapshots;
  }

  /**
   * Get historical telemetry data
   */
  async getHistory(
    feedId: string,
    tenantId: string,
    options: { nodeId?: string; startTime?: Date; endTime?: Date; limit?: number } = {}
  ): Promise<TelemetryDataPoint[]> {
    let sql = `SELECT * FROM cortex_telemetry_data WHERE feed_id = $1 AND tenant_id = $2`;
    const params: unknown[] = [feedId, tenantId];

    if (options.nodeId) {
      params.push(options.nodeId);
      sql += ` AND node_id = $${params.length}`;
    }
    if (options.startTime) {
      params.push(options.startTime);
      sql += ` AND timestamp >= $${params.length}`;
    }
    if (options.endTime) {
      params.push(options.endTime);
      sql += ` AND timestamp <= $${params.length}`;
    }

    sql += ` ORDER BY timestamp DESC`;

    if (options.limit) {
      params.push(options.limit);
      sql += ` LIMIT $${params.length}`;
    }

    const result = await this.db.query(sql, params);
    return result.rows.map((row) => this.mapRowToDataPoint(row));
  }

  /**
   * Get feed by ID
   */
  async getFeed(feedId: string, tenantId: string): Promise<TelemetryFeedConfig | null> {
    const result = await this.db.query(
      `SELECT * FROM cortex_telemetry_feeds WHERE id = $1 AND tenant_id = $2`,
      [feedId, tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToFeed(result.rows[0]);
  }

  /**
   * List telemetry feeds
   */
  async listFeeds(
    tenantId: string,
    options: { activeOnly?: boolean; contextInjectionOnly?: boolean; protocol?: TelemetryProtocol } = {}
  ): Promise<TelemetryFeedConfig[]> {
    let sql = `SELECT * FROM cortex_telemetry_feeds WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];

    if (options.activeOnly) {
      sql += ` AND is_active = true`;
    }
    if (options.contextInjectionOnly) {
      sql += ` AND context_injection = true`;
    }
    if (options.protocol) {
      params.push(options.protocol);
      sql += ` AND protocol = $${params.length}`;
    }

    sql += ` ORDER BY name ASC`;

    const result = await this.db.query(sql, params);
    return result.rows.map((row) => this.mapRowToFeed(row));
  }

  /**
   * Update feed configuration
   */
  async updateFeed(
    feedId: string,
    tenantId: string,
    updates: Partial<TelemetryFeedCreateRequest>
  ): Promise<TelemetryFeedConfig> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];

    if (updates.name !== undefined) {
      params.push(updates.name);
      setClauses.push(`name = $${params.length}`);
    }
    if (updates.endpoint !== undefined) {
      params.push(updates.endpoint);
      setClauses.push(`endpoint = $${params.length}`);
    }
    if (updates.nodeIds !== undefined) {
      params.push(updates.nodeIds);
      setClauses.push(`node_ids = $${params.length}`);
    }
    if (updates.topics !== undefined) {
      params.push(updates.topics);
      setClauses.push(`topics = $${params.length}`);
    }
    if (updates.pollIntervalMs !== undefined) {
      params.push(updates.pollIntervalMs);
      setClauses.push(`poll_interval_ms = $${params.length}`);
    }
    if (updates.contextInjection !== undefined) {
      params.push(updates.contextInjection);
      setClauses.push(`context_injection = $${params.length}`);
    }
    if (updates.transformScript !== undefined) {
      params.push(updates.transformScript);
      setClauses.push(`transform_script = $${params.length}`);
    }

    params.push(feedId, tenantId);
    const sql = `UPDATE cortex_telemetry_feeds SET ${setClauses.join(', ')} 
                 WHERE id = $${params.length - 1} AND tenant_id = $${params.length}
                 RETURNING *`;

    const result = await this.db.query(sql, params);
    return this.mapRowToFeed(result.rows[0]);
  }

  /**
   * Delete a feed and its data
   */
  async deleteFeed(feedId: string, tenantId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM cortex_telemetry_feeds WHERE id = $1 AND tenant_id = $2`,
      [feedId, tenantId]
    );
  }

  /**
   * Record feed error
   */
  async recordError(feedId: string, error: string): Promise<void> {
    await this.db.query(
      `UPDATE cortex_telemetry_feeds 
       SET error_count = error_count + 1, last_error = $1, updated_at = NOW()
       WHERE id = $2`,
      [error, feedId]
    );
  }

  private mapRowToFeed(row: unknown): TelemetryFeedConfig {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      tenantId: r.tenant_id as string,
      name: r.name as string,
      protocol: r.protocol as TelemetryProtocol,
      endpoint: r.endpoint as string,
      nodeIds: r.node_ids as string[] | undefined,
      topics: r.topics as string[] | undefined,
      pollIntervalMs: r.poll_interval_ms as number | undefined,
      contextInjection: r.context_injection as boolean,
      transformScript: r.transform_script as string | undefined,
      isActive: r.is_active as boolean,
      authConfig: r.auth_config as TelemetryFeedConfig['authConfig'],
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
    };
  }

  private mapRowToDataPoint(row: unknown): TelemetryDataPoint {
    const r = row as Record<string, unknown>;
    let value: number | string | boolean;
    if (r.value_numeric !== null) value = r.value_numeric as number;
    else if (r.value_text !== null) value = r.value_text as string;
    else value = r.value_boolean as boolean;

    return {
      feedId: r.feed_id as string,
      tenantId: r.tenant_id as string,
      nodeId: r.node_id as string,
      value,
      quality: r.quality as TelemetryDataPoint['quality'],
      timestamp: new Date(r.timestamp as string),
      metadata: r.metadata as Record<string, unknown> | undefined,
    };
  }
}
