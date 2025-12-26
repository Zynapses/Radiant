/**
 * Circuit Breaker Pattern for External API Calls
 * 
 * Prevents cascading failures by temporarily blocking requests
 * to failing services.
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening
  successThreshold: number;      // Successes needed to close from half-open
  timeout: number;               // Time in ms before attempting half-open
  volumeThreshold: number;       // Minimum requests before considering failure rate
  errorFilter?: (error: unknown) => boolean;  // Filter which errors count as failures
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  totalRequests: number;
  totalFailures: number;
  openedAt: Date | null;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,  // 30 seconds
  volumeThreshold: 10,
};

// Dynamic config loader - will be populated from DB on first use
let dynamicConfigLoaded = false;
const dynamicConfigs: Map<string, Partial<CircuitBreakerConfig>> = new Map();

/**
 * Load circuit breaker config from database (called lazily)
 */
async function loadDynamicConfig(name: string): Promise<Partial<CircuitBreakerConfig>> {
  try {
    // Lazy import to avoid circular dependency
    const { CircuitBreakerConfig: DBConfig } = await import('../services/system-config.js');
    
    const [failureThreshold, successThreshold, timeout] = await Promise.all([
      DBConfig.getFailureThreshold(name),
      DBConfig.getSuccessThreshold(name),
      DBConfig.getTimeoutMs(name),
    ]);
    
    return { failureThreshold, successThreshold, timeout };
  } catch (error) {
    // Fallback to defaults if DB not available
    console.debug('Circuit breaker config not available from DB, using defaults:', error instanceof Error ? error.message : 'unknown');
    return {};
  }
}

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailure: Date | null = null;
  private lastSuccess: Date | null = null;
  private openedAt: Date | null = null;
  private totalRequests = 0;
  private totalFailures = 0;
  private config: CircuitBreakerConfig;
  private name: string;

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new CircuitOpenError(this.name, this.getStats());
    }

    this.totalRequests++;

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      // Check if this error should count as a failure
      if (!this.config.errorFilter || this.config.errorFilter(error)) {
        this.onFailure();
      }
      throw error;
    }
  }

  /**
   * Check if requests can be made
   */
  canExecute(): boolean {
    if (this.state === 'closed') {
      return true;
    }

    if (this.state === 'open') {
      // Check if timeout has elapsed
      if (this.openedAt && Date.now() - this.openedAt.getTime() >= this.config.timeout) {
        this.transitionTo('half-open');
        return true;
      }
      return false;
    }

    // Half-open: allow limited requests
    return true;
  }

  /**
   * Record a successful request
   */
  private onSuccess(): void {
    this.lastSuccess = new Date();

    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    } else {
      // Reset failure count on success in closed state
      this.failures = 0;
    }
  }

  /**
   * Record a failed request
   */
  private onFailure(): void {
    this.failures++;
    this.totalFailures++;
    this.lastFailure = new Date();

    if (this.state === 'half-open') {
      // Any failure in half-open returns to open
      this.transitionTo('open');
    } else if (this.state === 'closed') {
      // Check if we should open
      if (
        this.totalRequests >= this.config.volumeThreshold &&
        this.failures >= this.config.failureThreshold
      ) {
        this.transitionTo('open');
      }
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    console.log(`[CircuitBreaker:${this.name}] ${oldState} -> ${newState}`, {
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
    });

    if (newState === 'open') {
      this.openedAt = new Date();
      this.successes = 0;
    } else if (newState === 'closed') {
      this.failures = 0;
      this.successes = 0;
      this.openedAt = null;
    } else if (newState === 'half-open') {
      this.successes = 0;
    }
  }

  /**
   * Get current statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      openedAt: this.openedAt,
    };
  }

  /**
   * Force the circuit to a specific state (for testing/admin)
   */
  forceState(state: CircuitState): void {
    this.transitionTo(state);
  }

  /**
   * Reset all statistics
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailure = null;
    this.lastSuccess = null;
    this.openedAt = null;
    this.totalRequests = 0;
    this.totalFailures = 0;
  }
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly stats: CircuitBreakerStats
  ) {
    super(`Circuit breaker '${circuitName}' is open - service temporarily unavailable`);
    this.name = 'CircuitOpenError';
  }
}

// Registry of circuit breakers for different services
const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker for a service
 */
export function getCircuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  let breaker = circuitBreakers.get(name);
  if (!breaker) {
    breaker = new CircuitBreaker(name, config);
    circuitBreakers.set(name, breaker);
    
    // Load dynamic config from DB asynchronously (won't block)
    loadDynamicConfig(name).then(dbConfig => {
      if (Object.keys(dbConfig).length > 0) {
        dynamicConfigs.set(name, dbConfig);
        // Update the breaker's config (it will use new values on next check)
        console.log(`[CircuitBreaker:${name}] Loaded config from DB:`, dbConfig);
      }
    }).catch(() => {
      // Silently fail - will use defaults
    });
  }
  return breaker;
}

/**
 * Get all circuit breaker stats
 */
export function getAllCircuitBreakerStats(): Record<string, CircuitBreakerStats> {
  const stats: Record<string, CircuitBreakerStats> = {};
  circuitBreakers.forEach((breaker, name) => {
    stats[name] = breaker.getStats();
  });
  return stats;
}

/**
 * Pre-configured circuit breakers for common services
 */
export const CircuitBreakers = {
  openai: () => getCircuitBreaker('openai', { failureThreshold: 5, timeout: 60000 }),
  anthropic: () => getCircuitBreaker('anthropic', { failureThreshold: 5, timeout: 60000 }),
  litellm: () => getCircuitBreaker('litellm', { failureThreshold: 3, timeout: 30000 }),
  bedrock: () => getCircuitBreaker('bedrock', { failureThreshold: 5, timeout: 45000 }),
  stripe: () => getCircuitBreaker('stripe', { failureThreshold: 3, timeout: 30000 }),
  ses: () => getCircuitBreaker('ses', { failureThreshold: 5, timeout: 60000 }),
  cognito: () => getCircuitBreaker('cognito', { failureThreshold: 3, timeout: 30000 }),
};

/**
 * Helper to wrap an async function with circuit breaker
 */
export function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  config?: Partial<CircuitBreakerConfig>
): Promise<T> {
  return getCircuitBreaker(name, config).execute(fn);
}
