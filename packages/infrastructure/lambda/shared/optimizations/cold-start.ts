/**
 * RADIANT v4.18.0 - Lambda Cold Start Optimizations
 * Utilities to minimize cold start impact
 */

/**
 * Lazy initialization wrapper
 * Delays initialization until first use, reducing cold start time
 */
export function lazy<T>(factory: () => T): () => T {
  let instance: T | undefined;
  let initialized = false;
  
  return () => {
    if (!initialized) {
      instance = factory();
      initialized = true;
    }
    return instance as T;
  };
}

/**
 * Async lazy initialization wrapper
 */
export function lazyAsync<T>(factory: () => Promise<T>): () => Promise<T> {
  let instance: T | undefined;
  let promise: Promise<T> | undefined;
  let initialized = false;
  
  return async () => {
    if (initialized) {
      return instance as T;
    }
    
    if (promise) {
      return promise;
    }
    
    promise = factory().then(result => {
      instance = result;
      initialized = true;
      return result;
    });
    
    return promise;
  };
}

/**
 * Pre-warm common AWS SDK clients during module load
 * These are typically needed by most handlers
 */
let sdkWarmedUp = false;

export async function warmupSDK(): Promise<void> {
  if (sdkWarmedUp) return;
  
  // Import SDK clients to trigger their initialization
  // This happens during module load, not during handler execution
  await Promise.all([
    import('@aws-sdk/client-rds-data').catch(() => { /* SDK import failure is non-fatal */ }),
    import('@aws-sdk/client-secrets-manager').catch(() => { /* SDK import failure is non-fatal */ }),
    import('@aws-sdk/client-s3').catch(() => { /* SDK import failure is non-fatal */ }),
  ]);
  
  sdkWarmedUp = true;
}

/**
 * Connection pool warming
 * Pre-establishes database connections
 */
export async function warmupConnections(): Promise<void> {
  try {
    // Execute a simple query to establish connection
    const { executeStatement } = await import('../db/client.js');
    await executeStatement('SELECT 1', []);
  } catch (error) {
    // Silently fail - connection will be established on first real query
    console.debug('Cold start DB warmup failed (non-critical):', error instanceof Error ? error.message : 'unknown');
  }
}

/**
 * Handler wrapper that optimizes for cold starts
 */
export function optimizedHandler<TEvent, TResult>(
  handler: (event: TEvent, context: unknown) => Promise<TResult>,
  options: {
    warmupSDK?: boolean;
    warmupConnections?: boolean;
  } = {}
): (event: TEvent, context: unknown) => Promise<TResult> {
  // Perform warmup during module initialization (outside handler)
  const warmupPromise = (async () => {
    const tasks: Promise<void>[] = [];
    
    if (options.warmupSDK !== false) {
      tasks.push(warmupSDK());
    }
    
    if (options.warmupConnections) {
      tasks.push(warmupConnections());
    }
    
    await Promise.all(tasks);
  })();
  
  return async (event: TEvent, context: unknown): Promise<TResult> => {
    // Wait for warmup to complete (usually already done)
    await warmupPromise;
    
    // Execute actual handler
    return handler(event, context);
  };
}

/**
 * Provisioned concurrency check
 * Returns true if running with provisioned concurrency
 */
export function hasProvisionedConcurrency(): boolean {
  return process.env.AWS_LAMBDA_INITIALIZATION_TYPE === 'provisioned-concurrency';
}

/**
 * Cold start detection
 * Returns true if this is a cold start invocation
 */
let invocationCount = 0;

export function isColdStart(): boolean {
  invocationCount++;
  return invocationCount === 1;
}

export function getInvocationCount(): number {
  return invocationCount;
}

/**
 * Bundle size optimization hints
 * Use dynamic imports for rarely-used heavy dependencies
 */
export const dynamicImport: {
  zod: () => Promise<typeof import('zod')>;
  sharp: () => Promise<unknown>;
  pdfLib: () => Promise<unknown>;
} = {
  // Heavy dependencies that should be dynamically imported
  async zod() {
    return import('zod');
  },
  
  async sharp() {
    // Only import sharp when image processing is needed
    // sharp is optional - may not be available in all Lambda environments
    try {
      return await import('sharp' as string);
    } catch {
      return null;
    }
  },
  
  async pdfLib() {
    // pdf-lib is optional - may not be available in all Lambda environments
    try {
      return await import('pdf-lib' as string);
    } catch {
      return null;
    }
  },
};

/**
 * Environment variable caching
 * Reads env vars once during cold start
 */
class EnvCache {
  private cache: Map<string, string | undefined> = new Map();
  
  get(key: string, defaultValue?: string): string | undefined {
    if (!this.cache.has(key)) {
      this.cache.set(key, process.env[key]);
    }
    return this.cache.get(key) ?? defaultValue;
  }
  
  getRequired(key: string): string {
    const value = this.get(key);
    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }
}

export const envCache = new EnvCache();
