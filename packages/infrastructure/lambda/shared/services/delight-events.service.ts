/**
 * RADIANT v4.18.0 - Delight Events Service
 * Real-time event emitter for workflow delight messages
 */

import { EventEmitter } from 'events';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'delight/events',
  category: 'infrastructure',
  sourceType: 'application',
});

// ============================================================================
// Types
// ============================================================================

export interface DelightEvent {
  type: 'message' | 'achievement' | 'easter_egg' | 'sound' | 'step_update' | 'plan_update';
  planId: string;
  stepId?: string;
  timestamp: string;
  data: DelightEventData;
}

export type DelightEventData = 
  | { type: 'message'; message: DelightMessageResponse }
  | { type: 'achievement'; achievementId: string; name: string; celebrationMessage: string }
  | { type: 'easter_egg'; easterEggId: string; name: string; activationMessage: string }
  | { type: 'sound'; soundId: string }
  | { type: 'step_update'; stepId: string; stepType: string; status: string; message: string }
  | { type: 'plan_update'; status: string; message: string };

export interface DelightEventSubscription {
  planId: string;
  userId: string;
  tenantId: string;
  callback: (event: DelightEvent) => void;
}

// ============================================================================
// Event Emitter Service
// ============================================================================

class DelightEventsService extends EventEmitter {
  private subscriptions = new Map<string, Set<DelightEventSubscription>>();
  private eventHistory = new Map<string, DelightEvent[]>();
  private readonly MAX_HISTORY_SIZE = 50;

  constructor() {
    super();
    this.setMaxListeners(100); // Allow many concurrent workflow subscriptions
  }

  /**
   * Load event history from DB for a plan (cold-start resilience).
   * Called when subscribing to a plan that has no in-memory history.
   */
  private async loadHistoryFromDB(planId: string, tenantId: string): Promise<DelightEvent[]> {
    try {
      const { executeStatement, stringParam } = await import('../db/client');
      const result = await executeStatement(
        `SELECT event_type, event_data, created_at
         FROM delight_event_history
         WHERE plan_id = $1 AND tenant_id = $2
         ORDER BY created_at ASC
         LIMIT $3`,
        [
          stringParam('planId', planId),
          stringParam('tenantId', tenantId),
          stringParam('limit', String(this.MAX_HISTORY_SIZE)),
        ]
      );
      return (result.rows || []).map((row: Record<string, unknown>) => ({
        type: row.event_type as DelightEvent['type'],
        planId,
        timestamp: String(row.created_at),
        data: row.event_data as DelightEventData,
      }));
    } catch {
      // Table may not exist yet — return empty
      return [];
    }
  }

  /**
   * Persist an event to DB (fire-and-forget)
   */
  private persistEventToDB(event: DelightEvent, tenantId?: string): void {
    if (!tenantId) return;
    (async () => {
      try {
        const { executeStatement, stringParam } = await import('../db/client');
        await executeStatement(
          `INSERT INTO delight_event_history (tenant_id, plan_id, event_type, event_data)
           VALUES ($1, $2, $3, $4::jsonb)`,
          [
            stringParam('tenantId', tenantId),
            stringParam('planId', event.planId),
            stringParam('eventType', event.type),
            stringParam('eventData', JSON.stringify(event.data)),
          ]
        );
      } catch {
        // Non-critical — best-effort persistence
      }
    })();
  }

  /**
   * Subscribe to delight events for a plan
   */
  subscribe(subscription: DelightEventSubscription): () => void {
    const { planId, tenantId } = subscription;
    
    if (!this.subscriptions.has(planId)) {
      this.subscriptions.set(planId, new Set());
    }
    
    this.subscriptions.get(planId)!.add(subscription);

    // Send any recent events for this plan
    const history = this.eventHistory.get(planId) || [];
    if (history.length > 0) {
      for (const event of history) {
        subscription.callback(event);
      }
    } else {
      // Cold start: load from DB and replay
      this.loadHistoryFromDB(planId, tenantId).then(dbHistory => {
        if (dbHistory.length > 0) {
          this.eventHistory.set(planId, dbHistory);
          for (const event of dbHistory) {
            subscription.callback(event);
          }
        }
      }).catch(() => { /* best-effort */ });
    }

    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(planId);
      if (subs) {
        subs.delete(subscription);
        if (subs.size === 0) {
          this.subscriptions.delete(planId);
        }
      }
    };
  }

  /**
   * Emit a delight message event
   */
  emitMessage(planId: string, message: DelightMessageResponse): void {
    if (!message.message && !message.selectedText) return;

    const event: DelightEvent = {
      type: 'message',
      planId,
      timestamp: new Date().toISOString(),
      data: { type: 'message', message },
    };

    this.emitEvent(event);
  }

  /**
   * Emit an achievement event
   */
  emitAchievement(planId: string, achievement: { id: string; name: string; celebrationMessage: string }): void {
    const event: DelightEvent = {
      type: 'achievement',
      planId,
      timestamp: new Date().toISOString(),
      data: {
        type: 'achievement',
        achievementId: achievement.id,
        name: achievement.name,
        celebrationMessage: achievement.celebrationMessage,
      },
    };

    this.emitEvent(event);
  }

  /**
   * Emit an easter egg event
   */
  emitEasterEgg(planId: string, easterEgg: { id: string; name: string; activationMessage: string }): void {
    const event: DelightEvent = {
      type: 'easter_egg',
      planId,
      timestamp: new Date().toISOString(),
      data: {
        type: 'easter_egg',
        easterEggId: easterEgg.id,
        name: easterEgg.name,
        activationMessage: easterEgg.activationMessage,
      },
    };

    this.emitEvent(event);
  }

  /**
   * Emit a sound event
   */
  emitSound(planId: string, soundId: string): void {
    const event: DelightEvent = {
      type: 'sound',
      planId,
      timestamp: new Date().toISOString(),
      data: { type: 'sound', soundId },
    };

    this.emitEvent(event);
  }

  /**
   * Emit a step update with delight message
   */
  emitStepUpdate(
    planId: string,
    stepId: string,
    stepType: string,
    status: string,
    message: string
  ): void {
    const event: DelightEvent = {
      type: 'step_update',
      planId,
      stepId,
      timestamp: new Date().toISOString(),
      data: { type: 'step_update', stepId, stepType, status, message },
    };

    this.emitEvent(event);
  }

  /**
   * Emit a plan status update with delight message
   */
  emitPlanUpdate(planId: string, status: string, message: string): void {
    const event: DelightEvent = {
      type: 'plan_update',
      planId,
      timestamp: new Date().toISOString(),
      data: { type: 'plan_update', status, message },
    };

    this.emitEvent(event);
  }

  /**
   * Emit workflow delight response (messages + achievements + sounds)
   */
  emitWorkflowDelight(planId: string, delight: WorkflowDelightResponse): void {
    // Emit each message
    for (const message of delight.messages) {
      this.emitMessage(planId, message);
    }

    // Emit achievements
    if (delight.achievements) {
      for (const achievement of delight.achievements) {
        this.emitAchievement(planId, achievement);
      }
    }

    // Emit sound
    if (delight.soundEffect) {
      this.emitSound(planId, delight.soundEffect);
    }
  }

  /**
   * Get event history for a plan
   */
  getHistory(planId: string): DelightEvent[] {
    return this.eventHistory.get(planId) || [];
  }

  /**
   * Clear event history for a plan
   */
  clearHistory(planId: string): void {
    this.eventHistory.delete(planId);
  }

  /**
   * Internal event emission
   */
  private emitEvent(event: DelightEvent): void {
    // Store in history
    if (!this.eventHistory.has(event.planId)) {
      this.eventHistory.set(event.planId, []);
    }
    const history = this.eventHistory.get(event.planId)!;
    history.push(event);
    
    // Trim history if too large
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.shift();
    }

    // Persist to DB (fire-and-forget) for cold-start resilience
    const tenantId = this.getActiveTenantForPlan(event.planId);
    this.persistEventToDB(event, tenantId);

    // Notify subscribers
    const subs = this.subscriptions.get(event.planId);
    if (subs) {
      for (const sub of subs) {
        try {
          sub.callback(event);
        } catch (error) {
          logger.error('Error in delight event callback', { error, planId: event.planId });
        }
      }
    }

    // Also emit on the EventEmitter for general listeners
    this.emit('delight', event);
    this.emit(`delight:${event.type}`, event);
    this.emit(`plan:${event.planId}`, event);
  }

  /**
   * Get the tenant ID from the first subscriber for a plan.
   * Used to persist events with the correct tenant context.
   */
  private getActiveTenantForPlan(planId: string): string | undefined {
    const subs = this.subscriptions.get(planId);
    if (subs && subs.size > 0) {
      return Array.from(subs)[0].tenantId;
    }
    return undefined;
  }
}

// Singleton instance
export const delightEventsService = new DelightEventsService();
export { DelightEventsService };

// ============================================================================
// SSE Stream Helper
// ============================================================================

/**
 * Create an SSE stream for delight events
 */
export function createDelightEventStream(
  planId: string,
  userId: string,
  tenantId: string
): {
  stream: ReadableStream<Uint8Array>;
  close: () => void;
} {
  const encoder = new TextEncoder();
  let closed = false;
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Subscribe to events
      unsubscribe = delightEventsService.subscribe({
        planId,
        userId,
        tenantId,
        callback: (event) => {
          if (closed) return;
          
          try {
            const data = JSON.stringify(event);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          } catch (error) {
            logger.error('Error encoding delight event', { error });
          }
        },
      });

      // Send initial ping
      controller.enqueue(encoder.encode(': ping\n\n'));
    },
    cancel() {
      closed = true;
      if (unsubscribe) {
        unsubscribe();
      }
    },
  });

  return {
    stream,
    close: () => {
      closed = true;
      if (unsubscribe) {
        unsubscribe();
      }
    },
  };
}

// ============================================================================
// Integration with AGI Brain Planner
// ============================================================================

/**
 * Wrapper to emit delight events during plan execution
 */
export async function emitDelightForPlanExecution(
  planId: string,
  eventType: 'start' | 'step_start' | 'step_complete' | 'complete',
  context: {
    stepId?: string;
    stepType?: string;
    status?: string;
    message?: string;
    delight?: WorkflowDelightResponse;
  }
): Promise<void> {
  try {
    // Emit status message
    if (context.message) {
      if (context.stepId && context.stepType) {
        delightEventsService.emitStepUpdate(
          planId,
          context.stepId,
          context.stepType,
          context.status || eventType,
          context.message
        );
      } else {
        delightEventsService.emitPlanUpdate(
          planId,
          context.status || eventType,
          context.message
        );
      }
    }

    // Emit delight response if provided
    if (context.delight) {
      delightEventsService.emitWorkflowDelight(planId, context.delight);
    }
  } catch (error) {
    logger.error('Failed to emit delight event', { error, planId, eventType });
  }
}
