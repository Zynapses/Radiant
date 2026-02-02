/**
 * RADIANT v6.0.0 - AXIOM Events Service
 * 
 * Real-time event emitter for AXIOM/CLARION sessions.
 * Provides SSE streaming support using UEP envelope patterns.
 * 
 * @version 1.0.0
 * @since RADIANT v6.0.0
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { enhancedLogger } from '../logging/enhanced-logger';
import type {
  UEPEnvelope,
  UEPSourceCard,
  UEPEnvelopeType,
} from '@radiant/shared';

const logger = enhancedLogger;

// =============================================================================
// Types
// =============================================================================

export type AxiomEventType = 
  | 'session_started'
  | 'domain_detected'
  | 'domain_refined'
  | 'question_selected'
  | 'answer_received'
  | 'model_scores_update'
  | 'confidence_update'
  | 'clarification_complete'
  | 'compilation_started'
  | 'compilation_complete'
  | 'session_error'
  | 'heartbeat';

export interface AxiomEvent<T = unknown> {
  type: AxiomEventType;
  sessionId: string;
  timestamp: string;
  data: T;
  envelope?: UEPEnvelope<T>;
}

export interface ModelScoreUpdate {
  modelId: string;
  modelName: string;
  provider: string;
  score: number;
  previousScore?: number;
  isLeading: boolean;
  reasons: string[];
}

export interface DomainUpdate {
  domain: string;
  confidence: number;
  previousConfidence?: number;
  path: string[];
}

export interface QuestionUpdate {
  questionId: string;
  questionNumber: number;
  totalQuestions: number;
  text: string;
  type: string;
  category: string;
  options?: string[];
}

export interface CompilationResult {
  status: 'success' | 'needs_clarification' | 'error';
  prompt?: {
    systemPrompt: string;
    userPrompt: string;
  };
  selectedModel?: {
    modelId: string;
    modelName: string;
    provider: string;
    score: number;
  };
  missingSlots?: string[];
  error?: string;
}

export interface AxiomEventSubscription {
  sessionId: string;
  userId: string;
  tenantId: string;
  callback: (event: AxiomEvent) => void;
}

// =============================================================================
// UEP Source Card for AXIOM
// =============================================================================

const AXIOM_SOURCE_CARD: UEPSourceCard = {
  sourceId: 'axiom-clarion-service',
  sourceType: 'agent',
  name: 'AXIOM/CLARION',
  version: '2.0.0',
  capabilities: ['prompt_optimization', 'adaptive_questioning', 'model_routing'],
};

// =============================================================================
// Event Service
// =============================================================================

class AxiomEventsService extends EventEmitter {
  private subscriptions = new Map<string, Set<AxiomEventSubscription>>();
  private eventHistory = new Map<string, AxiomEvent[]>();
  private heartbeatIntervals = new Map<string, NodeJS.Timeout>();
  private readonly MAX_HISTORY_SIZE = 100;
  private readonly HEARTBEAT_INTERVAL_MS = 15000;

  constructor() {
    super();
    this.setMaxListeners(200);
  }

  /**
   * Subscribe to events for a session
   */
  subscribe(subscription: AxiomEventSubscription): () => void {
    const { sessionId } = subscription;

    if (!this.subscriptions.has(sessionId)) {
      this.subscriptions.set(sessionId, new Set());
    }

    this.subscriptions.get(sessionId)!.add(subscription);

    // Send recent events to catch up
    const history = this.eventHistory.get(sessionId) || [];
    for (const event of history) {
      try {
        subscription.callback(event);
      } catch (error) {
        logger.error('[AXIOM:Events] Error sending history event', { error, sessionId });
      }
    }

    // Start heartbeat for this session if not already running
    this.startHeartbeat(sessionId);

    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(sessionId);
      if (subs) {
        subs.delete(subscription);
        if (subs.size === 0) {
          this.subscriptions.delete(sessionId);
          this.stopHeartbeat(sessionId);
        }
      }
    };
  }

  /**
   * Emit session started event
   */
  emitSessionStarted(
    sessionId: string,
    data: { domain: string; confidence: number; modelPredictions: ModelScoreUpdate[] }
  ): void {
    this.emitEvent({
      type: 'session_started',
      sessionId,
      timestamp: new Date().toISOString(),
      data,
    });
  }

  /**
   * Emit domain detected/refined event
   */
  emitDomainUpdate(sessionId: string, update: DomainUpdate, isRefinement = false): void {
    this.emitEvent({
      type: isRefinement ? 'domain_refined' : 'domain_detected',
      sessionId,
      timestamp: new Date().toISOString(),
      data: update,
    });
  }

  /**
   * Emit next question selected
   */
  emitQuestionSelected(sessionId: string, question: QuestionUpdate): void {
    this.emitEvent({
      type: 'question_selected',
      sessionId,
      timestamp: new Date().toISOString(),
      data: question,
    });
  }

  /**
   * Emit answer received
   */
  emitAnswerReceived(
    sessionId: string,
    data: { questionId: string; answer: unknown; confidence: number }
  ): void {
    this.emitEvent({
      type: 'answer_received',
      sessionId,
      timestamp: new Date().toISOString(),
      data,
    });
  }

  /**
   * Emit model scores update
   */
  emitModelScoresUpdate(sessionId: string, scores: ModelScoreUpdate[]): void {
    this.emitEvent({
      type: 'model_scores_update',
      sessionId,
      timestamp: new Date().toISOString(),
      data: { scores },
    });
  }

  /**
   * Emit confidence update
   */
  emitConfidenceUpdate(
    sessionId: string,
    data: { confidence: number; previousConfidence?: number; reason?: string }
  ): void {
    this.emitEvent({
      type: 'confidence_update',
      sessionId,
      timestamp: new Date().toISOString(),
      data,
    });
  }

  /**
   * Emit clarification complete
   */
  emitClarificationComplete(
    sessionId: string,
    data: { answeredCount: number; skippedCount: number; finalConfidence: number }
  ): void {
    this.emitEvent({
      type: 'clarification_complete',
      sessionId,
      timestamp: new Date().toISOString(),
      data,
    });
  }

  /**
   * Emit compilation started
   */
  emitCompilationStarted(sessionId: string): void {
    this.emitEvent({
      type: 'compilation_started',
      sessionId,
      timestamp: new Date().toISOString(),
      data: { status: 'compiling' },
    });
  }

  /**
   * Emit compilation complete
   */
  emitCompilationComplete(sessionId: string, result: CompilationResult): void {
    this.emitEvent({
      type: 'compilation_complete',
      sessionId,
      timestamp: new Date().toISOString(),
      data: result,
    });
  }

  /**
   * Emit session error
   */
  emitSessionError(sessionId: string, error: { code: string; message: string }): void {
    this.emitEvent({
      type: 'session_error',
      sessionId,
      timestamp: new Date().toISOString(),
      data: error,
    });
  }

  /**
   * Get event history for a session
   */
  getHistory(sessionId: string): AxiomEvent[] {
    return this.eventHistory.get(sessionId) || [];
  }

  /**
   * Clear event history for a session
   */
  clearHistory(sessionId: string): void {
    this.eventHistory.delete(sessionId);
    this.stopHeartbeat(sessionId);
  }

  /**
   * Build UEP envelope for an event
   */
  private buildUEPEnvelope<T>(event: AxiomEvent<T>): UEPEnvelope<T> {
    const uepType: UEPEnvelopeType = 'event.progress';
    const traceId = randomUUID();

    return {
      envelopeId: randomUUID(),
      specversion: '2.0',
      type: uepType,
      source: AXIOM_SOURCE_CARD,
      timestamp: event.timestamp,
      payload: {
        contentType: 'application/json',
        delivery: 'inline',
        data: event.data as T,
      },
      tracing: {
        traceId,
        spanId: randomUUID(),
      },
    };
  }

  /**
   * Internal event emission
   */
  private emitEvent(event: AxiomEvent): void {
    // Add UEP envelope
    event.envelope = this.buildUEPEnvelope(event);

    // Store in history
    if (!this.eventHistory.has(event.sessionId)) {
      this.eventHistory.set(event.sessionId, []);
    }
    const history = this.eventHistory.get(event.sessionId)!;
    history.push(event);

    // Trim history if too large
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.shift();
    }

    // Notify subscribers
    const subs = this.subscriptions.get(event.sessionId);
    if (subs) {
      Array.from(subs).forEach((sub) => {
        try {
          sub.callback(event);
        } catch (error) {
          logger.error('[AXIOM:Events] Error in event callback', {
            error,
            sessionId: event.sessionId,
            eventType: event.type,
          });
        }
      });
    }

    // Emit on EventEmitter for general listeners
    this.emit('axiom', event);
    this.emit(`axiom:${event.type}`, event);
    this.emit(`session:${event.sessionId}`, event);

    logger.debug('[AXIOM:Events] Event emitted', {
      type: event.type,
      sessionId: event.sessionId,
    });
  }

  /**
   * Start heartbeat for a session
   */
  private startHeartbeat(sessionId: string): void {
    if (this.heartbeatIntervals.has(sessionId)) return;

    const interval = setInterval(() => {
      this.emitEvent({
        type: 'heartbeat',
        sessionId,
        timestamp: new Date().toISOString(),
        data: { alive: true },
      });
    }, this.HEARTBEAT_INTERVAL_MS);

    this.heartbeatIntervals.set(sessionId, interval);
  }

  /**
   * Stop heartbeat for a session
   */
  private stopHeartbeat(sessionId: string): void {
    const interval = this.heartbeatIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(sessionId);
    }
  }
}

// Singleton instance
export const axiomEventsService = new AxiomEventsService();
export { AxiomEventsService };

// =============================================================================
// SSE Stream Helper
// =============================================================================

/**
 * Create an SSE stream for AXIOM events
 */
export function createAxiomEventStream(
  sessionId: string,
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
      // Send initial connection event
      const connectEvent = JSON.stringify({
        type: 'connected',
        sessionId,
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(encoder.encode(`data: ${connectEvent}\n\n`));

      // Subscribe to events
      unsubscribe = axiomEventsService.subscribe({
        sessionId,
        userId,
        tenantId,
        callback: (event) => {
          if (closed) return;

          try {
            const data = JSON.stringify(event);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          } catch (error) {
            logger.error('[AXIOM:Events] Error encoding SSE event', { error });
          }
        },
      });
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

/**
 * Format event for SSE response (for Lambda handlers)
 */
export function formatSSEEvent(event: AxiomEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Get SSE headers for Lambda response
 */
export function getSSEHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}
