/**
 * RADIANT v4.18.0 - Typed Database Query Helpers
 * Provides type-safe database query utilities to reduce `as unknown as T` casts
 */

import { executeStatement } from './client';
import type { SqlParameter } from '@aws-sdk/client-rds-data';

/**
 * Row parser function type
 */
export type RowParser<T> = (row: Record<string, unknown>) => T;

/**
 * Execute a typed query that returns multiple rows
 * @param sql - SQL query string
 * @param params - Query parameters
 * @param parser - Optional row parser function
 * @returns Typed array of results
 */
export async function typedQuery<T>(
  sql: string,
  params: SqlParameter[] = [],
  parser?: RowParser<T>
): Promise<T[]> {
  const result = await executeStatement(sql, params);
  
  if (!result.rows || result.rows.length === 0) {
    return [];
  }
  
  if (parser) {
    return result.rows.map(row => parser(row as Record<string, unknown>));
  }
  
  // Default: cast rows directly (maintains backward compatibility)
  return result.rows as T[];
}

/**
 * Execute a typed query that returns a single row or null
 * @param sql - SQL query string
 * @param params - Query parameters
 * @param parser - Optional row parser function
 * @returns Single typed result or null
 */
export async function typedQueryOne<T>(
  sql: string,
  params: SqlParameter[] = [],
  parser?: RowParser<T>
): Promise<T | null> {
  const results = await typedQuery<T>(sql, params, parser);
  return results.length > 0 ? results[0] : null;
}

/**
 * Execute a typed query that must return exactly one row
 * @param sql - SQL query string
 * @param params - Query parameters
 * @param parser - Optional row parser function
 * @throws Error if no row or multiple rows returned
 * @returns Single typed result
 */
export async function typedQueryExactlyOne<T>(
  sql: string,
  params: SqlParameter[] = [],
  parser?: RowParser<T>
): Promise<T> {
  const results = await typedQuery<T>(sql, params, parser);
  
  if (results.length === 0) {
    throw new Error('Expected exactly one row, got none');
  }
  
  if (results.length > 1) {
    throw new Error(`Expected exactly one row, got ${results.length}`);
  }
  
  return results[0];
}

/**
 * Execute a count query
 * @param sql - SQL query with COUNT(*)
 * @param params - Query parameters
 * @returns Count value
 */
export async function typedCount(
  sql: string,
  params: SqlParameter[] = []
): Promise<number> {
  const result = await typedQueryOne<{ count: number }>(sql, params);
  return result?.count ?? 0;
}

/**
 * Execute an exists query
 * @param sql - SQL query
 * @param params - Query parameters
 * @returns True if any rows exist
 */
export async function typedExists(
  sql: string,
  params: SqlParameter[] = []
): Promise<boolean> {
  const count = await typedCount(
    `SELECT COUNT(*) as count FROM (${sql} LIMIT 1) t`,
    params
  );
  return count > 0;
}

// MARK: - Common Row Parsers

/**
 * Parse a row with a UUID id field
 */
export function parseWithId<T extends { id: string }>(row: Record<string, unknown>): T {
  return {
    ...row,
    id: String(row.id || row.ID || ''),
  } as T;
}

/**
 * Parse a row with date fields
 */
export function parseWithDates<T>(
  dateFields: string[]
): RowParser<T> {
  return (row: Record<string, unknown>) => {
    const parsed = { ...row };
    
    for (const field of dateFields) {
      if (parsed[field]) {
        parsed[field] = new Date(parsed[field] as string);
      }
    }
    
    return parsed as T;
  };
}

/**
 * Parse a row with JSON fields
 */
export function parseWithJson<T>(
  jsonFields: string[]
): RowParser<T> {
  return (row: Record<string, unknown>) => {
    const parsed = { ...row };
    
    for (const field of jsonFields) {
      if (parsed[field] && typeof parsed[field] === 'string') {
        try {
          parsed[field] = JSON.parse(parsed[field] as string);
        } catch (parseError) {
          // Keep original value if JSON parse fails
          console.debug(`JSON parse failed for field ${field}:`, parseError instanceof Error ? parseError.message : 'unknown');
        }
      }
    }
    
    return parsed as T;
  };
}

/**
 * Combine multiple parsers
 */
export function combineParsers<T>(
  ...parsers: RowParser<T>[]
): RowParser<T> {
  return (row: Record<string, unknown>) => {
    let result = row;
    for (const parser of parsers) {
      result = parser(result) as Record<string, unknown>;
    }
    return result as T;
  };
}
