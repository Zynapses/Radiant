/**
 * Resilient Provider Service
 * 
 * RADIANT v5.2.1 - Production Hardening
 * 
 * Wraps external AI provider calls with circuit breaker, retry, and timeout
 * patterns to prevent cascading failures when providers are down or slow.
 * 
 * Usage:
 *   import { callWithResilience, getProviderHealth } from './resilient-provider.service';
 *   
 *   const result = await callWithResilience(
 *     () => litellmClient.chat(request),
 *     { provider: 'openai', operation: 'chat' }
 *   );
 */

import { logger } from '../logger';

// ============================================================================
// Types
// ============================================================================

export interface ProviderCallOptions {
  /** Provider name (e.g., 'openai', 'anthropic', 'litellm') */
  provider: string;
  /** Operation type (e.g., 'chat', 'embedding', 'completion') */
  operation: string;
  /** Timeout in milliseconds (default: 60000) */
  timeoutMs?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Tenant ID for logging context */
  tenantId?: string;
  /** Correlation ID for request tracing */
  correlationId?: string;
  /** Whether to throw on circuit open or return fallback (default: throw) */
  throwOnCircuitOpen?: boolean;
}

export interface ProviderHealthStatus {
  provider: string;
  operation: string;
  circuitState: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  isHealthy: boolean;
}

// ============================================================================
// Circuit Breaker (Inline implementation to avoid import issues)
// ============================================================================

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerConfig {
  failureThreshold: number;
  failureWindowMs: number;
  resetTimeoutMs: number;
  successThreshold: number;
  onStateChange?: (name: string, from: CircuitState, to: CircuitState) => void;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  failureWindowMs: 30000,
  resetTimeoutMs: 60000,
  successThreshold: 2,
};

class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures: number = 0;
  private successes: number = 0;
  private failureTimestamps: number[] = [];
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private openedAt: number | null = null;
  private totalCalls: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;
  private readonly config: CircuitBreakerConfig;

  constructor(
    private readonly name: string,
    config?: Partial<CircuitBreakerConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('HALF_OPEN');
      } else {
        throw new CircuitOpenError(
          `Circuit breaker '${this.name}' is OPEN. Service unavailable.`,
          this.name,
          this.getRemainingOpenTime()
        );
      }
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      openedAt: this.openedAt,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  private recordSuccess(): void {
    this.totalSuccesses++;
    this.lastSuccessTime = Date.now();
    this.successes++;

    if (this.state === 'HALF_OPEN') {
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      this.failures = 0;
      this.failureTimestamps = [];
    }
  }

  private recordFailure(): void {
    const now = Date.now();
    this.totalFailures++;
    this.lastFailureTime = now;
    this.failures++;
    this.failureTimestamps.push(now);

    const windowStart = now - this.config.failureWindowMs;
    this.failureTimestamps = this.failureTimestamps.filter(ts => ts > windowStart);

    if (this.state === 'HALF_OPEN') {
      this.transitionTo('OPEN');
    } else if (this.state === 'CLOSED') {
      if (this.failureTimestamps.length >= this.config.failureThreshold) {
        this.transitionTo('OPEN');
      }
    }
  }

  private shouldAttemptReset(): boolean {
    if (this.state !== 'OPEN' || this.openedAt === null) {
      return false;
    }
    return Date.now() - this.openedAt >= this.config.resetTimeoutMs;
  }

  private getRemainingOpenTime(): number {
    if (this.state !== 'OPEN' || this.openedAt === null) {
      return 0;
    }
    const elapsed = Date.now() - this.openedAt;
    return Math.max(0, this.config.resetTimeoutMs - elapsed);
  }

  private transitionTo(newState: CircuitState): void {
    const previousState = this.state;
    this.state = newState;

    if (newState === 'OPEN') {
      this.openedAt = Date.now();
      this.successes = 0;
    } else if (newState === 'HALF_OPEN') {
      this.successes = 0;
      this.failures = 0;
    } else if (newState === 'CLOSED') {
      this.failures = 0;
      this.successes = 0;
      this.failureTimestamps = [];
      this.openedAt = null;
    }

    if (this.config.onStateChange && previousState !== newState) {
      this.config.onStateChange(this.name, previousState, newState);
    }
  }
}

class CircuitOpenError extends Error {
  readonly isCircuitOpen = true;
  
  constructor(
    message: string,
    public readonly circuitName: string,
    public readonly remainingOpenTimeMs: number
  ) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

// ============================================================================
// Global Circuit Breaker Registry
// ============================================================================

const circuitBreakers = new Map<string, CircuitBreaker>();

function getCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker(name, {
      ...config,
      onStateChange: (circuitName, from, to) => {
        logger.warn('Circuit breaker state change', { 
          circuit: circuitName, 
          from, 
          to,
          timestamp: new Date().toISOString(),
        });
        
        // Emit CloudWatch metric for alerting
        if (to === 'OPEN') {
          logger.error('ALERT: Circuit breaker opened - provider may be down', undefined, {
            circuit: circuitName,
            previousState: from,
          });
        } else if (to === 'CLOSED' && from === 'HALF_OPEN') {
          logger.info('Circuit breaker recovered - provider is healthy', {
            circuit: circuitName,
          });
        }
      },
    }));
  }
  return circuitBreakers.get(name)!;
}

// ============================================================================
// Retry Logic
// ============================================================================

interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Retryable: network errors, rate limits, server errors
    if (message.includes('timeout') ||
        message.includes('econnreset') ||
        message.includes('econnrefused') ||
        message.includes('socket hang up') ||
        message.includes('network') ||
        message.includes('rate limit') ||
        message.includes('429') ||
        message.includes('503') ||
        message.includes('502') ||
        message.includes('504')) {
      return true;
    }
    
    // Not retryable: auth errors, validation errors, not found
    if (message.includes('401') ||
        message.includes('403') ||
        message.includes('404') ||
        message.includes('invalid') ||
        message.includes('unauthorized')) {
      return false;
    }
  }
  
  // Default: retry on unknown errors
  return true;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;
  let delay = cfg.initialDelayMs;

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= cfg.maxAttempts) {
        break;
      }

      const retryable = cfg.isRetryable ? cfg.isRetryable(error) : isRetryableError(error);
      if (!retryable) {
        break;
      }

      let actualDelay = Math.min(delay, cfg.maxDelayMs);
      if (cfg.jitter) {
        actualDelay = actualDelay * (0.5 + Math.random());
      }

      if (cfg.onRetry) {
        cfg.onRetry(attempt, error, actualDelay);
      }

      await sleep(actualDelay);
      delay *= cfg.backoffMultiplier;
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Timeout Logic
// ============================================================================

class TimeoutError extends Error {
  readonly isTimeout = true;

  constructor(message: string, public readonly timeoutMs: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(
          `${operationName} timed out after ${timeoutMs}ms`,
          timeoutMs
        ));
      }, timeoutMs);
    }),
  ]);
}

// ============================================================================
// Main Resilience Wrapper
// ============================================================================

/**
 * Call an external provider with full resilience protection.
 * 
 * Applies in order:
 * 1. Timeout - Prevents hung operations
 * 2. Circuit Breaker - Fails fast when provider is down
 * 3. Retry with Exponential Backoff - Handles transient failures
 * 
 * @param fn The async function to execute
 * @param options Provider call configuration
 * @returns The result of the function
 * @throws CircuitOpenError if circuit is open and throwOnCircuitOpen is true
 * @throws TimeoutError if operation times out
 * @throws The original error if all retries fail
 */
export async function callWithResilience<T>(
  fn: () => Promise<T>,
  options: ProviderCallOptions
): Promise<T> {
  const { 
    provider, 
    operation, 
    timeoutMs = 60000, 
    maxRetries = 3,
    tenantId,
    correlationId,
    throwOnCircuitOpen = true,
  } = options;
  
  const circuitName = `${provider}-${operation}`;
  const breaker = getCircuitBreaker(circuitName);
  
  const logContext = {
    provider,
    operation,
    circuitName,
    tenantId,
    correlationId,
  };
  
  try {
    return await withTimeout(
      () => breaker.execute(
        () => withRetry(fn, {
          maxAttempts: maxRetries,
          onRetry: (attempt, error, delay) => {
            logger.warn('Retrying provider call', {
              ...logContext,
              attempt,
              delay,
              error: error instanceof Error ? error.message : String(error),
            });
          },
        })
      ),
      timeoutMs,
      `${provider}:${operation}`
    );
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      logger.error('Circuit open - provider unavailable', undefined, {
        ...logContext,
        remainingMs: error.remainingOpenTimeMs,
      });
      
      if (!throwOnCircuitOpen) {
        // Return undefined to signal caller should use fallback
        return undefined as T;
      }
    } else if (error instanceof TimeoutError) {
      logger.error('Provider call timed out', undefined, {
        ...logContext,
        timeoutMs: error.timeoutMs,
      });
    } else {
      logger.error('Provider call failed after retries', error instanceof Error ? error : undefined, {
        ...logContext,
      });
    }
    
    throw error;
  }
}

/**
 * Get health status for all registered provider circuits.
 */
export function getAllProviderHealth(): ProviderHealthStatus[] {
  const statuses: ProviderHealthStatus[] = [];
  
  for (const [name, breaker] of Array.from(circuitBreakers.entries())) {
    const [provider, operation] = name.split('-');
    const stats = breaker.getStats();
    
    statuses.push({
      provider,
      operation,
      circuitState: stats.state,
      failures: stats.failures,
      successes: stats.successes,
      lastFailureTime: stats.lastFailureTime,
      lastSuccessTime: stats.lastSuccessTime,
      isHealthy: stats.state === 'CLOSED',
    });
  }
  
  return statuses;
}

/**
 * Get health status for a specific provider operation.
 */
export function getProviderHealth(provider: string, operation: string): ProviderHealthStatus | null {
  const circuitName = `${provider}-${operation}`;
  const breaker = circuitBreakers.get(circuitName);
  
  if (!breaker) {
    return null;
  }
  
  const stats = breaker.getStats();
  return {
    provider,
    operation,
    circuitState: stats.state,
    failures: stats.failures,
    successes: stats.successes,
    lastFailureTime: stats.lastFailureTime,
    lastSuccessTime: stats.lastSuccessTime,
    isHealthy: stats.state === 'CLOSED',
  };
}

/**
 * Check if a provider is healthy (circuit closed).
 */
export function isProviderHealthy(provider: string, operation: string): boolean {
  const health = getProviderHealth(provider, operation);
  return health === null || health.isHealthy;
}

/**
 * Reset a circuit breaker (for testing or manual recovery).
 */
export function resetCircuit(provider: string, operation: string): void {
  const circuitName = `${provider}-${operation}`;
  circuitBreakers.delete(circuitName);
  logger.info('Circuit breaker reset', { provider, operation });
}

/**
 * Reset all circuit breakers (for testing).
 */
export function resetAllCircuits(): void {
  circuitBreakers.clear();
  logger.info('All circuit breakers reset');
}

// ============================================================================
// Exports
// ============================================================================

export { CircuitOpenError, TimeoutError };
