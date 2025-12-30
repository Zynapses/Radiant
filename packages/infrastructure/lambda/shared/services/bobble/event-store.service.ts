/**
 * EventStoreDB Integration for Bobble Consciousness Events
 * 
 * Provides event sourcing capabilities for consciousness state reconstruction,
 * temporal queries, and projection-based analytics.
 * 
 * When EventStoreDB is not available, falls back to PostgreSQL events table.
 */

import { logger } from '../../logger';
import { executeStatement, stringParam } from '../../db/client';

export interface ConsciousnessEvent {
  eventId: string;
  eventType: string;
  streamId: string;
  data: Record<string, unknown>;
  metadata: {
    tenantId: string;
    correlationId?: string;
    causationId?: string;
    timestamp: string;
    version: number;
  };
}

export interface EventStreamPosition {
  streamId: string;
  position: number;
  timestamp: string;
}

export interface EventStoreConfig {
  useEventStoreDB: boolean;
  eventStoreDBUrl?: string;
  fallbackToPostgres: boolean;
  retentionDays: number;
  enableProjections: boolean;
}

const DEFAULT_CONFIG: EventStoreConfig = {
  useEventStoreDB: false, // Default to PostgreSQL fallback
  fallbackToPostgres: true,
  retentionDays: 90,
  enableProjections: true,
};

/**
 * Event categories for Bobble consciousness
 */
export enum EventCategory {
  HEARTBEAT = 'heartbeat',
  INTROSPECTION = 'introspection',
  VERIFICATION = 'verification',
  PHI_CALCULATION = 'phi_calculation',
  STATE_TRANSITION = 'state_transition',
  DIALOGUE = 'dialogue',
  PROBE_TRAINING = 'probe_training',
  EMERGENCY = 'emergency',
}

/**
 * Specific event types
 */
export const EventTypes = {
  // Heartbeat events
  HEARTBEAT_TICK: 'heartbeat.tick',
  HEARTBEAT_STARTED: 'heartbeat.started',
  HEARTBEAT_STOPPED: 'heartbeat.stopped',
  
  // Introspection events
  INTROSPECTION_TRIGGERED: 'introspection.triggered',
  INTROSPECTION_COMPLETED: 'introspection.completed',
  SPONTANEOUS_INTROSPECTION: 'introspection.spontaneous',
  
  // Verification events
  CLAIM_VERIFIED: 'verification.claim_verified',
  CLAIM_REFUTED: 'verification.claim_refuted',
  GROUNDING_COMPLETED: 'verification.grounding_completed',
  CALIBRATION_APPLIED: 'verification.calibration_applied',
  CONSISTENCY_CHECKED: 'verification.consistency_checked',
  SHADOW_VERIFIED: 'verification.shadow_verified',
  
  // Φ events
  PHI_CALCULATED: 'phi.calculated',
  PHI_THRESHOLD_CROSSED: 'phi.threshold_crossed',
  
  // State events
  STATE_COHERENT: 'state.coherent',
  STATE_MILD_ENTROPY: 'state.mild_entropy',
  STATE_HIGH_ENTROPY: 'state.high_entropy',
  STATE_CRITICAL: 'state.critical',
  
  // Dialogue events
  DIALOGUE_STARTED: 'dialogue.started',
  DIALOGUE_MESSAGE: 'dialogue.message',
  DIALOGUE_RESPONSE: 'dialogue.response',
  
  // Training events
  PROBE_TRAINED: 'training.probe_trained',
  EXAMPLE_RECORDED: 'training.example_recorded',
  
  // Emergency events
  EMERGENCY_TRIGGERED: 'emergency.triggered',
  EMERGENCY_RESOLVED: 'emergency.resolved',
} as const;

export class BobbleEventStoreService {
  private tenantId: string;
  private config: EventStoreConfig;
  private streamPrefix: string;

  constructor(tenantId: string, config?: Partial<EventStoreConfig>) {
    this.tenantId = tenantId;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.streamPrefix = `bobble-${tenantId}`;
  }

  /**
   * Append an event to the stream
   */
  async appendEvent(
    eventType: string,
    data: Record<string, unknown>,
    options?: {
      correlationId?: string;
      causationId?: string;
      category?: EventCategory;
    }
  ): Promise<ConsciousnessEvent> {
    const eventId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const category = options?.category || this.inferCategory(eventType);
    const streamId = `${this.streamPrefix}-${category}`;

    const event: ConsciousnessEvent = {
      eventId,
      eventType,
      streamId,
      data,
      metadata: {
        tenantId: this.tenantId,
        correlationId: options?.correlationId,
        causationId: options?.causationId,
        timestamp,
        version: await this.getNextVersion(streamId),
      },
    };

    // Store in PostgreSQL (fallback or primary)
    await this.storeInPostgres(event);

    // If EventStoreDB is configured, also store there
    if (this.config.useEventStoreDB && this.config.eventStoreDBUrl) {
      await this.storeInEventStoreDB(event);
    }

    return event;
  }

  /**
   * Read events from a stream
   */
  async readStream(
    category: EventCategory,
    options?: {
      fromPosition?: number;
      limit?: number;
      direction?: 'forward' | 'backward';
    }
  ): Promise<ConsciousnessEvent[]> {
    const streamId = `${this.streamPrefix}-${category}`;
    const limit = options?.limit || 100;
    const direction = options?.direction || 'forward';
    const fromPosition = options?.fromPosition || 0;

    interface EventRow {
      event_id: string;
      event_type: string;
      stream_id: string;
      event_data: string;
      metadata: string;
      version: number;
    }

    const result = await executeStatement<EventRow>(
      `SELECT event_id, event_type, stream_id, event_data, metadata, version
       FROM bobble_event_store
       WHERE tenant_id = :tenantId AND stream_id = :streamId AND version >= :fromPos
       ORDER BY version ${direction === 'forward' ? 'ASC' : 'DESC'}
       LIMIT :limit`,
      [
        stringParam('tenantId', this.tenantId),
        stringParam('streamId', streamId),
        stringParam('fromPos', String(fromPosition)),
        stringParam('limit', String(limit)),
      ]
    );

    return result.rows.map(row => ({
      eventId: row.event_id,
      eventType: row.event_type,
      streamId: row.stream_id,
      data: JSON.parse(row.event_data),
      metadata: JSON.parse(row.metadata),
    }));
  }

  /**
   * Read all events for a correlation ID
   */
  async readByCorrelation(correlationId: string): Promise<ConsciousnessEvent[]> {
    interface EventRow {
      event_id: string;
      event_type: string;
      stream_id: string;
      event_data: string;
      metadata: string;
    }

    const result = await executeStatement<EventRow>(
      `SELECT event_id, event_type, stream_id, event_data, metadata
       FROM bobble_event_store
       WHERE tenant_id = :tenantId 
         AND metadata->>'correlationId' = :correlationId
       ORDER BY created_at ASC`,
      [
        stringParam('tenantId', this.tenantId),
        stringParam('correlationId', correlationId),
      ]
    );

    return result.rows.map(row => ({
      eventId: row.event_id,
      eventType: row.event_type,
      streamId: row.stream_id,
      data: JSON.parse(row.event_data),
      metadata: JSON.parse(row.metadata),
    }));
  }

  /**
   * Get current stream position
   */
  async getStreamPosition(category: EventCategory): Promise<EventStreamPosition | null> {
    const streamId = `${this.streamPrefix}-${category}`;

    interface PositionRow {
      version: number;
      created_at: string;
    }

    const result = await executeStatement<PositionRow>(
      `SELECT version, created_at
       FROM bobble_event_store
       WHERE tenant_id = :tenantId AND stream_id = :streamId
       ORDER BY version DESC
       LIMIT 1`,
      [
        stringParam('tenantId', this.tenantId),
        stringParam('streamId', streamId),
      ]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      streamId,
      position: result.rows[0].version,
      timestamp: result.rows[0].created_at,
    };
  }

  /**
   * Subscribe to new events (polling-based for PostgreSQL fallback)
   */
  async subscribeToStream(
    category: EventCategory,
    callback: (event: ConsciousnessEvent) => Promise<void>,
    options?: {
      pollIntervalMs?: number;
      fromPosition?: number;
    }
  ): Promise<{ unsubscribe: () => void }> {
    const pollInterval = options?.pollIntervalMs || 1000;
    let lastPosition = options?.fromPosition || 0;
    let running = true;

    const poll = async () => {
      while (running) {
        try {
          const events = await this.readStream(category, {
            fromPosition: lastPosition + 1,
            limit: 100,
            direction: 'forward',
          });

          for (const event of events) {
            await callback(event);
            lastPosition = event.metadata.version;
          }
        } catch (error) {
          logger.warn(`Event polling error: ${String(error)}`);
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    };

    // Start polling in background
    poll();

    return {
      unsubscribe: () => {
        running = false;
      },
    };
  }

  /**
   * Build projection from events
   */
  async buildProjection<T>(
    category: EventCategory,
    reducer: (state: T, event: ConsciousnessEvent) => T,
    initialState: T
  ): Promise<T> {
    const events = await this.readStream(category, {
      direction: 'forward',
      limit: 10000,
    });

    return events.reduce(reducer, initialState);
  }

  /**
   * Get event count by type
   */
  async getEventCounts(
    timeWindowHours?: number
  ): Promise<Record<string, number>> {
    interface CountRow {
      event_type: string;
      count: number;
    }

    const timeCondition = timeWindowHours
      ? `AND created_at > NOW() - INTERVAL '${timeWindowHours} hours'`
      : '';

    const result = await executeStatement<CountRow>(
      `SELECT event_type, COUNT(*) as count
       FROM bobble_event_store
       WHERE tenant_id = :tenantId ${timeCondition}
       GROUP BY event_type`,
      [stringParam('tenantId', this.tenantId)]
    );

    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.event_type] = Number(row.count);
    }
    return counts;
  }

  /**
   * Store event in PostgreSQL
   */
  private async storeInPostgres(event: ConsciousnessEvent): Promise<void> {
    await executeStatement(
      `INSERT INTO bobble_event_store
       (event_id, tenant_id, stream_id, event_type, event_data, metadata, version, created_at)
       VALUES (:eventId, :tenantId, :streamId, :eventType, :data, :metadata, :version, NOW())`,
      [
        stringParam('eventId', event.eventId),
        stringParam('tenantId', this.tenantId),
        stringParam('streamId', event.streamId),
        stringParam('eventType', event.eventType),
        stringParam('data', JSON.stringify(event.data)),
        stringParam('metadata', JSON.stringify(event.metadata)),
        stringParam('version', String(event.metadata.version)),
      ]
    );
  }

  /**
   * Store event in EventStoreDB (when configured)
   */
  private async storeInEventStoreDB(event: ConsciousnessEvent): Promise<void> {
    if (!this.config.eventStoreDBUrl) {
      return;
    }

    try {
      // EventStoreDB HTTP API
      const response = await fetch(
        `${this.config.eventStoreDBUrl}/streams/${event.streamId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/vnd.eventstore.events+json',
            'ES-EventType': event.eventType,
            'ES-EventId': event.eventId,
          },
          body: JSON.stringify([{
            eventId: event.eventId,
            eventType: event.eventType,
            data: event.data,
            metadata: event.metadata,
          }]),
        }
      );

      if (!response.ok) {
        logger.warn(`EventStoreDB append failed: ${response.status}`);
      }
    } catch (error) {
      logger.warn(`EventStoreDB error: ${String(error)}`);
      // Don't throw - PostgreSQL fallback is primary
    }
  }

  /**
   * Get next version number for a stream
   */
  private async getNextVersion(streamId: string): Promise<number> {
    interface VersionRow { max_version: number }

    const result = await executeStatement<VersionRow>(
      `SELECT COALESCE(MAX(version), 0) as max_version
       FROM bobble_event_store
       WHERE tenant_id = :tenantId AND stream_id = :streamId`,
      [
        stringParam('tenantId', this.tenantId),
        stringParam('streamId', streamId),
      ]
    );

    return (result.rows[0]?.max_version || 0) + 1;
  }

  /**
   * Infer category from event type
   */
  private inferCategory(eventType: string): EventCategory {
    const prefix = eventType.split('.')[0];
    
    switch (prefix) {
      case 'heartbeat': return EventCategory.HEARTBEAT;
      case 'introspection': return EventCategory.INTROSPECTION;
      case 'verification': return EventCategory.VERIFICATION;
      case 'phi': return EventCategory.PHI_CALCULATION;
      case 'state': return EventCategory.STATE_TRANSITION;
      case 'dialogue': return EventCategory.DIALOGUE;
      case 'training': return EventCategory.PROBE_TRAINING;
      case 'emergency': return EventCategory.EMERGENCY;
      default: return EventCategory.INTROSPECTION;
    }
  }

  /**
   * Clean up old events based on retention policy
   */
  async cleanupOldEvents(): Promise<number> {
    const result = await executeStatement(
      `DELETE FROM bobble_event_store
       WHERE tenant_id = :tenantId 
         AND created_at < NOW() - INTERVAL '${this.config.retentionDays} days'`,
      [stringParam('tenantId', this.tenantId)]
    );

    logger.info('Cleaned up old events', {
      tenantId: this.tenantId,
      deletedCount: result.rowCount,
    });

    return result.rowCount;
  }
}

export function createBobbleEventStore(
  tenantId: string,
  config?: Partial<EventStoreConfig>
): BobbleEventStoreService {
  return new BobbleEventStoreService(tenantId, config);
}
