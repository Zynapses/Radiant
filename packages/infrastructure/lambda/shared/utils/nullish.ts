/**
 * RADIANT v4.18.0 - Nullish Value Utilities
 * 
 * Standardize handling of null/undefined values across the codebase.
 * Convention: Use `undefined` for optional/missing values, `null` for explicit absence.
 * 
 * Guidelines:
 * - Function returns: Use `T | undefined` for optional returns
 * - Explicit null: Use `null` only when explicitly clearing a value
 * - Database: `null` from DB should be converted to `undefined` for API responses
 * - API responses: Omit undefined fields rather than including them
 */

/**
 * Type guard for null or undefined
 */
export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Type guard for not null or undefined
 */
export function isNotNullish<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Convert null to undefined (for API response standardization)
 */
export function nullToUndefined<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

/**
 * Convert undefined to null (for database writes)
 */
export function undefinedToNull<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

/**
 * Return default value if input is nullish
 */
export function withDefault<T>(value: T | null | undefined, defaultValue: T): T {
  return isNullish(value) ? defaultValue : value;
}

/**
 * Return default value if input is nullish (lazy evaluation)
 */
export function withDefaultLazy<T>(
  value: T | null | undefined,
  getDefault: () => T
): T {
  return isNullish(value) ? getDefault() : value;
}

/**
 * Map over a potentially nullish value
 */
export function mapNullish<T, U>(
  value: T | null | undefined,
  fn: (v: T) => U
): U | undefined {
  return isNullish(value) ? undefined : fn(value);
}

/**
 * Filter nullish values from an array
 */
export function filterNullish<T>(arr: (T | null | undefined)[]): T[] {
  return arr.filter(isNotNullish);
}

/**
 * Convert database row nulls to undefined for API response
 */
export function sanitizeDbRow<T extends Record<string, unknown>>(
  row: T
): { [K in keyof T]: T[K] extends null ? undefined : T[K] } {
  const result = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(row)) {
    result[key] = value === null ? undefined : value;
  }
  return result as { [K in keyof T]: T[K] extends null ? undefined : T[K] };
}

/**
 * Omit undefined values from an object (for clean JSON output)
 */
export function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result = {} as Partial<T>;
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

/**
 * Deep omit undefined values from nested objects
 */
export function omitUndefinedDeep<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(omitUndefinedDeep) as T;
  }

  if (typeof obj === 'object') {
    const result = {} as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        result[key] = omitUndefinedDeep(value);
      }
    }
    return result as T;
  }

  return obj;
}

/**
 * Assertion that value is not nullish (throws if nullish)
 */
export function assertNotNullish<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  if (isNullish(value)) {
    throw new Error(message || 'Expected value to be defined');
  }
}

/**
 * Coalesce - return first non-nullish value
 */
export function coalesce<T>(...values: (T | null | undefined)[]): T | undefined {
  for (const value of values) {
    if (!isNullish(value)) {
      return value;
    }
  }
  return undefined;
}
