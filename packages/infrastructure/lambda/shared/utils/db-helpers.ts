/**
 * Database Helper Utilities
 * 
 * Common patterns for database operations
 */

/**
 * Safely extract an ID from a database query result row
 * Replaces the verbose pattern: String((result.rows[0] as Record<string, unknown>)?.id || '')
 */
export function extractId(row: unknown): string {
  if (!row || typeof row !== 'object') {
    return '';
  }
  const record = row as Record<string, unknown>;
  const id = record.id ?? record.ID ?? record._id;
  return id != null ? String(id) : '';
}

/**
 * Extract first row ID from query result
 */
export function extractFirstRowId(rows: unknown[]): string {
  if (!rows || rows.length === 0) {
    return '';
  }
  return extractId(rows[0]);
}

/**
 * Safely extract a string field from a row
 */
export function extractString(row: unknown, field: string, defaultValue = ''): string {
  if (!row || typeof row !== 'object') {
    return defaultValue;
  }
  const record = row as Record<string, unknown>;
  const value = record[field];
  return value != null ? String(value) : defaultValue;
}

/**
 * Safely extract a number field from a row
 */
export function extractNumber(row: unknown, field: string, defaultValue = 0): number {
  if (!row || typeof row !== 'object') {
    return defaultValue;
  }
  const record = row as Record<string, unknown>;
  const value = record[field];
  if (value == null) return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Safely extract a boolean field from a row
 */
export function extractBoolean(row: unknown, field: string, defaultValue = false): boolean {
  if (!row || typeof row !== 'object') {
    return defaultValue;
  }
  const record = row as Record<string, unknown>;
  const value = record[field];
  if (value == null) return defaultValue;
  return Boolean(value);
}

/**
 * Safely extract a date field from a row
 */
export function extractDate(row: unknown, field: string): Date | null {
  if (!row || typeof row !== 'object') {
    return null;
  }
  const record = row as Record<string, unknown>;
  const value = record[field];
  if (value == null) return null;
  if (value instanceof Date) return value;
  const date = new Date(String(value));
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Pagination options for queries
 */
export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  maxPageSize?: number;
}

/**
 * Pagination result metadata
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  offset: number;
  limit: number;
}

/**
 * Calculate pagination parameters with safe defaults
 */
export function getPaginationParams(options: PaginationOptions = {}): PaginationMeta {
  const maxPageSize = options.maxPageSize ?? 100;
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(maxPageSize, Math.max(1, options.pageSize ?? 20));
  const offset = (page - 1) * pageSize;
  
  return {
    page,
    pageSize,
    offset,
    limit: pageSize,
  };
}

/**
 * Build a paginated SQL query
 */
export function addPagination(sql: string, pagination: PaginationMeta): string {
  return `${sql} LIMIT ${pagination.limit} OFFSET ${pagination.offset}`;
}

/**
 * DynamoDB attribute value helpers
 */
export function extractDynamoString(item: Record<string, { S?: string }>, field: string, defaultValue = ''): string {
  return item[field]?.S ?? defaultValue;
}

export function extractDynamoNumber(item: Record<string, { N?: string }>, field: string, defaultValue = 0): number {
  const value = item[field]?.N;
  if (!value) return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

export function extractDynamoBool(item: Record<string, { BOOL?: boolean }>, field: string, defaultValue = false): boolean {
  return item[field]?.BOOL ?? defaultValue;
}
