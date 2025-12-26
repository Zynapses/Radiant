/**
 * RADIANT v4.18.0 - AWS SDK Field Type Guards
 * Type-safe guards for AWS RDS Data API Field types
 */

import { Field } from '@aws-sdk/client-rds-data';

/**
 * Check if field is a string value
 */
export function isStringField(field: Field): field is { stringValue: string } {
  return 'stringValue' in field && field.stringValue !== undefined;
}

/**
 * Check if field is a long (bigint) value
 */
export function isLongField(field: Field): field is { longValue: number } {
  return 'longValue' in field && field.longValue !== undefined;
}

/**
 * Check if field is a double value
 */
export function isDoubleField(field: Field): field is { doubleValue: number } {
  return 'doubleValue' in field && field.doubleValue !== undefined;
}

/**
 * Check if field is a boolean value
 */
export function isBooleanField(field: Field): field is { booleanValue: boolean } {
  return 'booleanValue' in field && field.booleanValue !== undefined;
}

/**
 * Check if field is a blob value
 */
export function isBlobField(field: Field): field is { blobValue: Uint8Array } {
  return 'blobValue' in field && field.blobValue !== undefined;
}

/**
 * Check if field is null
 */
export function isNullField(field: Field): field is { isNull: true } {
  return 'isNull' in field && field.isNull === true;
}

/**
 * Check if field is an array value
 */
export function isArrayField(field: Field): field is { arrayValue: { stringValues?: string[]; longValues?: number[]; doubleValues?: number[]; booleanValues?: boolean[] } } {
  return 'arrayValue' in field && field.arrayValue !== undefined;
}

/**
 * Extract value from a Field with proper type checking
 */
export function extractFieldValue(field: Field): unknown {
  if (isNullField(field)) {
    return null;
  }
  
  if (isStringField(field)) {
    return field.stringValue;
  }
  
  if (isLongField(field)) {
    return field.longValue;
  }
  
  if (isDoubleField(field)) {
    return field.doubleValue;
  }
  
  if (isBooleanField(field)) {
    return field.booleanValue;
  }
  
  if (isBlobField(field)) {
    return field.blobValue;
  }
  
  if (isArrayField(field)) {
    const arr = field.arrayValue;
    return arr.stringValues ?? arr.longValues ?? arr.doubleValues ?? arr.booleanValues ?? [];
  }
  
  // Fallback for unknown field types
  return null;
}

/**
 * Extract string value or return default
 */
export function extractString(field: Field, defaultValue = ''): string {
  if (isStringField(field)) {
    return field.stringValue;
  }
  return defaultValue;
}

/**
 * Extract number value or return default
 */
export function extractNumber(field: Field, defaultValue = 0): number {
  if (isLongField(field)) {
    return field.longValue;
  }
  if (isDoubleField(field)) {
    return field.doubleValue;
  }
  if (isStringField(field)) {
    const parsed = parseFloat(field.stringValue);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

/**
 * Extract boolean value or return default
 */
export function extractBoolean(field: Field, defaultValue = false): boolean {
  if (isBooleanField(field)) {
    return field.booleanValue;
  }
  if (isStringField(field)) {
    return field.stringValue.toLowerCase() === 'true';
  }
  if (isLongField(field)) {
    return field.longValue !== 0;
  }
  return defaultValue;
}

/**
 * Extract Date value or return null
 */
export function extractDate(field: Field): Date | null {
  if (isStringField(field)) {
    const date = new Date(field.stringValue);
    return isNaN(date.getTime()) ? null : date;
  }
  if (isLongField(field)) {
    return new Date(field.longValue);
  }
  return null;
}

/**
 * Extract JSON value or return null
 */
export function extractJson<T>(field: Field): T | null {
  if (isStringField(field)) {
    try {
      return JSON.parse(field.stringValue) as T;
    } catch (parseError) {
      console.debug('JSON parse failed in extractJson:', parseError instanceof Error ? parseError.message : 'unknown');
      return null;
    }
  }
  return null;
}

/**
 * Extract string array value
 */
export function extractStringArray(field: Field): string[] {
  if (isArrayField(field) && field.arrayValue.stringValues) {
    return field.arrayValue.stringValues;
  }
  if (isStringField(field)) {
    // Try parsing as JSON array
    try {
      const parsed = JSON.parse(field.stringValue);
      if (Array.isArray(parsed)) {
        return parsed.map(String);
      }
    } catch (parseError) {
      // Not a JSON array - this is expected for non-JSON string values
      console.debug('String field is not a JSON array:', parseError instanceof Error ? parseError.message : 'unknown');
    }
  }
  return [];
}
