/**
 * RADIANT v4.18.0 - Pagination Utilities
 * 
 * Standardized pagination helpers for list endpoints
 * to prevent unbounded queries.
 */

export interface PaginationParams {
  limit: number;
  offset: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextCursor?: string;
}

// Default limits to prevent unbounded queries
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_MAX_RESULTS = 1000;

/**
 * Parse and validate pagination parameters from request
 */
export function parsePaginationParams(query: Record<string, unknown>): PaginationParams {
  const rawLimit = Number(query.limit) || DEFAULT_PAGE_SIZE;
  const rawOffset = Number(query.offset) || 0;
  
  return {
    limit: Math.min(Math.max(1, rawLimit), MAX_PAGE_SIZE),
    offset: Math.max(0, rawOffset),
    cursor: typeof query.cursor === 'string' ? query.cursor : undefined,
  };
}

/**
 * Build SQL LIMIT/OFFSET clause
 */
export function buildLimitClause(params: PaginationParams): string {
  return `LIMIT ${params.limit} OFFSET ${params.offset}`;
}

/**
 * Build paginated response from query results
 */
export function buildPaginatedResponse<T>(
  items: T[],
  params: PaginationParams,
  total?: number
): PaginatedResult<T> {
  const hasMore = items.length === params.limit;
  
  return {
    items,
    total: total ?? (hasMore ? params.offset + params.limit + 1 : params.offset + items.length),
    limit: params.limit,
    offset: params.offset,
    hasMore,
    nextCursor: hasMore ? encodeCursor(params.offset + params.limit) : undefined,
  };
}

/**
 * Encode cursor for cursor-based pagination
 */
export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString('base64');
}

/**
 * Decode cursor from cursor-based pagination
 */
export function decodeCursor(cursor: string): number {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
    return typeof decoded.o === 'number' ? decoded.o : 0;
  } catch {
    return 0;
  }
}

/**
 * Apply default LIMIT to a SQL query if not present
 * Prevents unbounded SELECT * queries
 */
export function ensureQueryLimit(sql: string, defaultLimit: number = DEFAULT_MAX_RESULTS): string {
  const upperSql = sql.toUpperCase();
  
  // Already has LIMIT
  if (upperSql.includes('LIMIT')) {
    return sql;
  }
  
  // Add LIMIT before any trailing semicolon or at end
  const trimmed = sql.trim();
  if (trimmed.endsWith(';')) {
    return trimmed.slice(0, -1) + ` LIMIT ${defaultLimit};`;
  }
  return trimmed + ` LIMIT ${defaultLimit}`;
}

/**
 * SQL parameter builder for pagination
 */
export function buildPaginationParams(
  params: PaginationParams,
  paramOffset: number = 1
): Array<{ name: string; value: { longValue: number } }> {
  return [
    { name: `p${paramOffset}`, value: { longValue: params.limit } },
    { name: `p${paramOffset + 1}`, value: { longValue: params.offset } },
  ];
}
