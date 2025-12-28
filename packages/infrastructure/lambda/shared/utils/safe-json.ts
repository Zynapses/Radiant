/**
 * RADIANT v4.18.0 - Safe JSON Utilities
 * 
 * Provides safe JSON parsing with error handling, schema validation,
 * and fallback values to prevent Lambda crashes from malformed JSON.
 */

import { z } from 'zod';
import { logger } from '../logger';

/**
 * Result type for safe JSON parsing
 */
export interface SafeParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Safely parse JSON with error handling
 * Returns undefined on parse failure instead of throwing
 */
export function safeJsonParse<T = unknown>(
  json: string | null | undefined,
  fallback?: T
): T | undefined {
  if (!json) {
    return fallback;
  }

  try {
    return JSON.parse(json) as T;
  } catch (error) {
    logger.warn('JSON parse failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      jsonPreview: json.substring(0, 100),
    });
    return fallback;
  }
}

/**
 * Safely parse JSON with detailed result
 */
export function safeJsonParseResult<T = unknown>(
  json: string | null | undefined
): SafeParseResult<T> {
  if (!json) {
    return { success: false, error: 'Input is null or undefined' };
  }

  try {
    const data = JSON.parse(json) as T;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parse error',
    };
  }
}

/**
 * Parse JSON with Zod schema validation
 * Returns typed, validated data or undefined
 */
export function parseJsonWithSchema<T>(
  json: string | null | undefined,
  schema: z.ZodType<T>,
  options?: { logErrors?: boolean; fallback?: T }
): T | undefined {
  if (!json) {
    return options?.fallback;
  }

  try {
    const parsed = JSON.parse(json);
    const result = schema.safeParse(parsed);

    if (result.success) {
      return result.data;
    }

    if (options?.logErrors !== false) {
      logger.warn('JSON schema validation failed', {
        errors: result.error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    return options?.fallback;
  } catch (error) {
    if (options?.logErrors !== false) {
      logger.warn('JSON parse failed before schema validation', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    return options?.fallback;
  }
}

/**
 * Parse JSON with Zod schema and throw on failure
 * Use when you need guaranteed valid data
 */
export function parseJsonWithSchemaOrThrow<T>(
  json: string | null | undefined,
  schema: z.ZodType<T>,
  errorContext?: string
): T {
  if (!json) {
    throw new Error(`${errorContext || 'JSON parse'}: Input is null or undefined`);
  }

  try {
    const parsed = JSON.parse(json);
    return schema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const details = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      throw new Error(`${errorContext || 'JSON validation'} failed: ${details}`);
    }
    throw new Error(`${errorContext || 'JSON parse'} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse API Gateway event body safely
 */
export function parseEventBody<T = Record<string, unknown>>(
  body: string | null | undefined,
  schema?: z.ZodType<T>
): T | undefined {
  if (!body) {
    return undefined;
  }

  if (schema) {
    return parseJsonWithSchema(body, schema);
  }

  return safeJsonParse<T>(body);
}

/**
 * Parse nested JSON field safely (for JSONB columns from DB)
 */
export function parseJsonField<T>(
  value: unknown,
  fallback?: T
): T | undefined {
  if (value === null || value === undefined) {
    return fallback;
  }

  // Already an object (parsed by DB driver)
  if (typeof value === 'object') {
    return value as T;
  }

  // String that needs parsing
  if (typeof value === 'string') {
    return safeJsonParse<T>(value, fallback);
  }

  return fallback;
}

/**
 * Stringify JSON safely with circular reference handling
 */
export function safeJsonStringify(
  value: unknown,
  space?: number
): string {
  const seen = new WeakSet();

  return JSON.stringify(value, (key, val) => {
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) {
        return '[Circular]';
      }
      seen.add(val);
    }
    return val;
  }, space);
}
