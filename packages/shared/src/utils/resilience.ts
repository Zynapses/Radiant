/**
 * Resilience Utilities for RADIANT
 * 
 * RADIANT v5.2.0 - Production Hardening
 * 
 * Implements Circuit Breaker and Retry patterns to prevent cascading failures
 * when external AI providers (OpenAI, Anthropic, etc.) are down or slow.
 * 
 * Usage:
 *   const breaker = new CircuitBreaker('openai-api', { failureThreshold: 5 });
 *   const result = await breaker.execute(() => callOpenAI(prompt));
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold: number;
  /** Window in ms to count failures (default: 30000 = 30s) */
  failureWindowMs: number;
  /** Time in ms to wait before trying again (default: 60000 = 60s) */
  resetTimeoutMs: number;
  /** Number of successes in half-open to close circuit (default: 2) */
  successThreshold: number;
  /** Optional callback when state changes */
  onStateChange?: (name: string, from: CircuitState, to: CircuitState) => void;
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  openedAt: number | null;
  totalCalls: number;
  totalFailures: number;
  totalSuccesses: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  failureWindowMs: 30000,
  resetTimeoutMs: 60000,
  successThreshold: 2,
};

/**
 * Circuit Breaker implementation for external API calls.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests fail fast without calling the external service
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 * 
 * Pattern: If 5 failures occur in 30 seconds, open circuit for 60 seconds.
 */
export class CircuitBreaker {
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

  /**
   * Execute a function with circuit breaker protection.
   * 
   * @param fn The async function to execute
   * @returns The result of the function
   * @throws CircuitOpenError if circuit is open
   * @throws The original error if the function fails and circuit remains closed
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    // Check if circuit should transition from OPEN to HALF_OPEN
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

  /**
   * Execute with a fallback value if circuit is open.
   * 
   * @param fn The async function to execute
   * @param fallback The fallback value or function to return if circuit is open
   */
  async executeWithFallback<T>(
    fn: () => Promise<T>,
    fallback: T | (() => T)
  ): Promise<T> {
    try {
      return await this.execute(fn);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        return typeof fallback === 'function' ? (fallback as () => T)() : fallback;
      }
      throw error;
    }
  }

  /**
   * Check if a call would be allowed (without actually making it).
   */
  isCallAllowed(): boolean {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'HALF_OPEN') return true;
    if (this.state === 'OPEN' && this.shouldAttemptReset()) return true;
    return false;
  }

  /**
   * Get current circuit breaker statistics.
   */
  getStats(): CircuitBreakerStats {
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

  /**
   * Get the current state of the circuit.
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Force the circuit to a specific state (for testing/admin purposes).
   */
  forceState(state: CircuitState): void {
    const previousState = this.state;
    this.state = state;
    
    if (state === 'CLOSED') {
      this.failures = 0;
      this.successes = 0;
      this.failureTimestamps = [];
      this.openedAt = null;
    } else if (state === 'OPEN') {
      this.openedAt = Date.now();
    }

    if (this.config.onStateChange && previousState !== state) {
      this.config.onStateChange(this.name, previousState, state);
    }
  }

  /**
   * Reset the circuit breaker to initial state.
   */
  reset(): void {
    this.forceState('CLOSED');
    this.totalCalls = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
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
      // Reset failure count on success in closed state
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

    // Clean up old timestamps outside the failure window
    const windowStart = now - this.config.failureWindowMs;
    this.failureTimestamps = this.failureTimestamps.filter(ts => ts > windowStart);

    if (this.state === 'HALF_OPEN') {
      // Any failure in half-open state opens the circuit
      this.transitionTo('OPEN');
    } else if (this.state === 'CLOSED') {
      // Check if we've exceeded the failure threshold in the window
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

/**
 * Error thrown when circuit breaker is open.
 */
export class CircuitOpenError extends Error {
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

/**
 * Registry for managing multiple circuit breakers.
 * Use this to get circuit breakers by name (singleton pattern).
 */
class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker by name.
   */
  get(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Get all circuit breakers' stats.
   */
  getAllStats(): CircuitBreakerStats[] {
    return Array.from(this.breakers.values()).map(b => b.getStats());
  }

  /**
   * Reset all circuit breakers.
   */
  resetAll(): void {
    this.breakers.forEach(b => b.reset());
  }

  /**
   * Remove a circuit breaker from the registry.
   */
  remove(name: string): boolean {
    return this.breakers.delete(name);
  }

  /**
   * Clear all circuit breakers.
   */
  clear(): void {
    this.breakers.clear();
  }
}

// Singleton registry instance
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

/**
 * Retry configuration for exponential backoff.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: number;
  /** Initial delay in ms (default: 1000) */
  initialDelayMs: number;
  /** Maximum delay in ms (default: 30000) */
  maxDelayMs: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier: number;
  /** Add random jitter to delays (default: true) */
  jitter: boolean;
  /** Function to determine if error is retryable (default: all errors) */
  isRetryable?: (error: unknown) => boolean;
  /** Callback on each retry attempt */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Execute a function with exponential backoff retry.
 * 
 * @param fn The async function to execute
 * @param config Retry configuration
 * @returns The result of the function
 * @throws The last error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;
  let delay = cfg.initialDelayMs;

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt >= cfg.maxAttempts) {
        break;
      }

      if (cfg.isRetryable && !cfg.isRetryable(error)) {
        break;
      }

      // Calculate delay with optional jitter
      let actualDelay = Math.min(delay, cfg.maxDelayMs);
      if (cfg.jitter) {
        actualDelay = actualDelay * (0.5 + Math.random());
      }

      // Call retry callback if provided
      if (cfg.onRetry) {
        cfg.onRetry(attempt, error, actualDelay);
      }

      // Wait before retrying
      await sleep(actualDelay);

      // Increase delay for next attempt
      delay *= cfg.backoffMultiplier;
    }
  }

  throw lastError;
}

/**
 * Execute a function with both circuit breaker and retry protection.
 * 
 * @param circuitName Name of the circuit breaker to use
 * @param fn The async function to execute
 * @param retryConfig Optional retry configuration
 * @param circuitConfig Optional circuit breaker configuration
 */
export async function withResilience<T>(
  circuitName: string,
  fn: () => Promise<T>,
  retryConfig?: Partial<RetryConfig>,
  circuitConfig?: Partial<CircuitBreakerConfig>
): Promise<T> {
  const breaker = circuitBreakerRegistry.get(circuitName, circuitConfig);
  
  return breaker.execute(() => withRetry(fn, retryConfig));
}

/**
 * Timeout wrapper for async operations.
 * 
 * @param fn The async function to execute
 * @param timeoutMs Timeout in milliseconds
 * @param message Optional timeout error message
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  message?: string
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(message || `Operation timed out after ${timeoutMs}ms`, timeoutMs));
      }, timeoutMs);
    }),
  ]);
}

/**
 * Error thrown when an operation times out.
 */
export class TimeoutError extends Error {
  readonly isTimeout = true;

  constructor(message: string, public readonly timeoutMs: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Sleep utility function.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Bulkhead pattern implementation for limiting concurrent requests.
 * Prevents resource exhaustion by limiting parallel executions.
 */
export class Bulkhead {
  private running: number = 0;
  private queue: Array<{
    resolve: (value: void) => void;
    reject: (reason: unknown) => void;
  }> = [];

  constructor(
    private readonly name: string,
    private readonly maxConcurrent: number,
    private readonly maxQueue: number = 100
  ) {}

  /**
   * Execute a function within the bulkhead limits.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Get current bulkhead statistics.
   */
  getStats(): { name: string; running: number; queued: number; maxConcurrent: number; maxQueue: number } {
    return {
      name: this.name,
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      maxQueue: this.maxQueue,
    };
  }

  private async acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }

    if (this.queue.length >= this.maxQueue) {
      throw new BulkheadFullError(
        `Bulkhead '${this.name}' is full. Max concurrent: ${this.maxConcurrent}, Queue: ${this.queue.length}/${this.maxQueue}`,
        this.name
      );
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next.resolve();
    } else {
      this.running--;
    }
  }
}

/**
 * Error thrown when bulkhead is full.
 */
export class BulkheadFullError extends Error {
  readonly isBulkheadFull = true;

  constructor(message: string, public readonly bulkheadName: string) {
    super(message);
    this.name = 'BulkheadFullError';
  }
}
