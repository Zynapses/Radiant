/**
 * Retry utility with exponential backoff and timeout handling
 */

const DEFAULT_TIMEOUT_MS = 30000;

export class TimeoutError extends Error {
  constructor(message: string, public readonly timeoutMs: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  errorMessage?: string
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new TimeoutError(errorMessage || `Operation timed out after ${timeoutMs}ms`, timeoutMs));
        });
      }),
    ]);
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(`Request to ${url} timed out after ${timeout}ms`, timeout);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryCondition?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryCondition: () => true,
};

export class RetryError extends Error {
  public readonly attempts: number;
  public readonly lastError: unknown;

  constructor(message: string, attempts: number, lastError: unknown) {
    super(message);
    this.name = 'RetryError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === opts.maxAttempts || !opts.retryCondition(error)) {
        throw error;
      }

      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw new RetryError(
    `Failed after ${opts.maxAttempts} attempts`,
    opts.maxAttempts,
    lastError
  );
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Network errors
    if (message.includes('network') || 
        message.includes('timeout') ||
        message.includes('econnreset') ||
        message.includes('econnrefused')) {
      return true;
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('429')) {
      return true;
    }

    // Server errors
    if (message.includes('500') || 
        message.includes('502') || 
        message.includes('503') ||
        message.includes('504')) {
      return true;
    }
  }

  return false;
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status >= 500;
}
