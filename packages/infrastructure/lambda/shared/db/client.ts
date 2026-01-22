/**
 * Aurora PostgreSQL Data API Client
 */

import {
  RDSDataClient,
  ExecuteStatementCommand,
  BatchExecuteStatementCommand,
  BeginTransactionCommand,
  CommitTransactionCommand,
  RollbackTransactionCommand,
  type ExecuteStatementCommandInput,
  type SqlParameter,
  type Field,
} from '@aws-sdk/client-rds-data';
import { getConfig } from '../config';

// MARK: - Parameter Builders

/**
 * Create a properly typed SqlParameter with string value
 * If only value is provided, uses empty name (for positional params)
 */
export function stringParam(nameOrValue: string, value?: string | null): SqlParameter {
  if (value === undefined) {
    return { name: '', value: { stringValue: nameOrValue } };
  }
  if (value === null) {
    return { name: nameOrValue, value: { isNull: true } };
  }
  return { name: nameOrValue, value: { stringValue: value } };
}

/**
 * Create a properly typed SqlParameter with long (integer) value
 */
export function longParam(name: string, value: number): SqlParameter {
  return { name, value: { longValue: value } };
}

/**
 * Create a properly typed SqlParameter with double value
 */
export function doubleParam(name: string, value: number): SqlParameter {
  return { name, value: { doubleValue: value } };
}

/**
 * Create a properly typed SqlParameter with boolean value
 */
export function boolParam(name: string, value: boolean): SqlParameter {
  return { name, value: { booleanValue: value } };
}

/**
 * Create a properly typed SqlParameter with null value
 */
export function nullParam(name: string): SqlParameter {
  return { name, value: { isNull: true } };
}

/**
 * Create a properly typed SqlParameter with UUID value (stored as string)
 */
export function uuidParam(name: string, value: string): SqlParameter {
  return { name, value: { stringValue: value } };
}

/**
 * Create a properly typed SqlParameter - auto-detect type
 */
export function param(name: string, value: unknown): SqlParameter {
  if (value === null || value === undefined) {
    return nullParam(name);
  }
  if (typeof value === 'string') {
    return stringParam(name, value);
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? longParam(name, value) : doubleParam(name, value);
  }
  if (typeof value === 'boolean') {
    return boolParam(name, value);
  }
  // For objects/arrays, serialize to JSON string
  return stringParam(name, JSON.stringify(value));
}

/**
 * Type-safe cast for inline parameter objects
 * Use this when you need to pass parameters inline without the helper functions
 */
export function asParams(params: Array<{ name: string; value: { stringValue?: string; longValue?: number; doubleValue?: number; booleanValue?: boolean; isNull?: boolean } }>): SqlParameter[] {
  return params as SqlParameter[];
}

let client: RDSDataClient | null = null;

function getClient(): RDSDataClient {
  if (!client) {
    client = new RDSDataClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return client;
}

export interface QueryOptions {
  transactionId?: string;
  continueAfterTimeout?: boolean;
}

export interface TransactionContext {
  transactionId: string;
}

/**
 * Loose parameter type for convenience - will be cast to SqlParameter[]
 * Also accepts raw values (string, number, boolean, null) for positional parameters
 */
export type LooseParam = 
  | { name: string; value: { stringValue?: string; longValue?: number; doubleValue?: number; booleanValue?: boolean; isNull?: boolean } | unknown }
  | string
  | number
  | boolean
  | null;

/**
 * Object-style input for executeStatement
 */
export interface ExecuteStatementInput {
  sql: string;
  parameters?: SqlParameter[] | LooseParam[];
  options?: QueryOptions;
}

/**
 * Execute a SQL statement using the Data API
 * Supports both positional args (sql, params, options) and object-style ({ sql, parameters })
 */
export async function executeStatement<T = Record<string, unknown>>(
  sqlOrInput: string | ExecuteStatementInput,
  parameters?: SqlParameter[] | LooseParam[],
  options?: QueryOptions
): Promise<{ rows: T[]; rowCount: number; numberOfRecordsUpdated?: number }> {
  // Handle object-style input
  let sql: string;
  let params: SqlParameter[] | LooseParam[] | undefined;
  let opts: QueryOptions | undefined;
  
  if (typeof sqlOrInput === 'object' && 'sql' in sqlOrInput) {
    sql = sqlOrInput.sql;
    params = sqlOrInput.parameters;
    opts = sqlOrInput.options;
  } else {
    sql = sqlOrInput;
    params = parameters;
    opts = options;
  }
  const config = getConfig();
  const client = getClient();

  // Convert raw values to SqlParameter format
  const convertedParams: SqlParameter[] | undefined = params?.map((p, idx) => {
    if (p === null) return { name: `p${idx}`, value: { isNull: true } };
    if (typeof p === 'string') return { name: `p${idx}`, value: { stringValue: p } };
    if (typeof p === 'number') return { name: `p${idx}`, value: Number.isInteger(p) ? { longValue: p } : { doubleValue: p } };
    if (typeof p === 'boolean') return { name: `p${idx}`, value: { booleanValue: p } };
    return p as SqlParameter;
  });

  const input: ExecuteStatementCommandInput = {
    resourceArn: config.AURORA_CLUSTER_ARN,
    secretArn: config.AURORA_SECRET_ARN,
    database: 'radiant',
    sql,
    parameters: convertedParams,
    includeResultMetadata: true,
    ...(opts?.transactionId && { transactionId: opts.transactionId }),
    ...(opts?.continueAfterTimeout && { continueAfterTimeout: true }),
  };

  const command = new ExecuteStatementCommand(input);
  const response = await client.send(command);

  const rows = parseRecords<T>(response.records, response.columnMetadata);
  
  return {
    rows,
    rowCount: response.numberOfRecordsUpdated ?? rows.length,
  };
}

/**
 * Alias for executeStatement - for backward compatibility
 */
export const executeQuery = executeStatement;

/**
 * Execute a batch of SQL statements
 */
export async function batchExecuteStatement(
  sql: string,
  parameterSets: SqlParameter[][],
  options?: QueryOptions
): Promise<{ updateCounts: number[] }> {
  const config = getConfig();
  const client = getClient();

  const command = new BatchExecuteStatementCommand({
    resourceArn: config.AURORA_CLUSTER_ARN,
    secretArn: config.AURORA_SECRET_ARN,
    database: 'radiant',
    sql,
    parameterSets,
    ...(options?.transactionId && { transactionId: options.transactionId }),
  });

  const response = await client.send(command);

  return {
    updateCounts: response.updateResults?.map((r: { generatedFields?: unknown[] }) => r.generatedFields?.length ?? 0) ?? [],
  };
}

/**
 * Begin a transaction
 */
export async function beginTransaction(): Promise<TransactionContext> {
  const config = getConfig();
  const client = getClient();

  const command = new BeginTransactionCommand({
    resourceArn: config.AURORA_CLUSTER_ARN,
    secretArn: config.AURORA_SECRET_ARN,
    database: 'radiant',
  });

  const response = await client.send(command);

  if (!response.transactionId) {
    throw new Error('Failed to begin transaction');
  }

  return { transactionId: response.transactionId };
}

/**
 * Commit a transaction
 */
export async function commitTransaction(ctx: TransactionContext): Promise<void> {
  const config = getConfig();
  const client = getClient();

  const command = new CommitTransactionCommand({
    resourceArn: config.AURORA_CLUSTER_ARN,
    secretArn: config.AURORA_SECRET_ARN,
    transactionId: ctx.transactionId,
  });

  await client.send(command);
}

/**
 * Rollback a transaction
 */
export async function rollbackTransaction(ctx: TransactionContext): Promise<void> {
  const config = getConfig();
  const client = getClient();

  const command = new RollbackTransactionCommand({
    resourceArn: config.AURORA_CLUSTER_ARN,
    secretArn: config.AURORA_SECRET_ARN,
    transactionId: ctx.transactionId,
  });

  await client.send(command);
}

/**
 * Execute within a transaction
 */
export async function withTransaction<T>(
  fn: (ctx: TransactionContext) => Promise<T>
): Promise<T> {
  const ctx = await beginTransaction();
  
  try {
    const result = await fn(ctx);
    await commitTransaction(ctx);
    return result;
  } catch (error) {
    await rollbackTransaction(ctx);
    throw error;
  }
}

/**
 * Create SQL parameters from an object
 */
export function toSqlParams(params: Record<string, unknown>): SqlParameter[] {
  return Object.entries(params).map(([name, value]) => ({
    name,
    value: toSqlValue(value),
  }));
}

/**
 * Convert a value to a SQL field value
 */
function toSqlValue(value: unknown): Field {
  if (value === null || value === undefined) {
    return { isNull: true };
  }
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { longValue: value };
    }
    return { doubleValue: value };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (value instanceof Date) {
    return { stringValue: value.toISOString() };
  }
  if (Array.isArray(value) || typeof value === 'object') {
    return { stringValue: JSON.stringify(value) };
  }
  return { stringValue: String(value) };
}

/**
 * Parse Data API records into typed objects
 */
function parseRecords<T>(
  records: Field[][] | undefined,
  columnMetadata: { name?: string; typeName?: string }[] | undefined
): T[] {
  if (!records || !columnMetadata) {
    return [];
  }

  return records.map(record => {
    const obj: Record<string, unknown> = {};
    
    record.forEach((field, index) => {
      const column = columnMetadata[index];
      if (!column?.name) return;

      obj[column.name] = parseField(field, column.typeName);
    });

    return obj as T;
  });
}

/**
 * Parse a single field value
 */
function parseField(field: Field, typeName?: string): unknown {
  // Use type assertion to handle AWS SDK union type
  const f = field as unknown as Record<string, unknown>;
  
  if (f.isNull) {
    return null;
  }
  if (f.stringValue !== undefined) {
    if (typeName === 'json' || typeName === 'jsonb') {
      try {
        return JSON.parse(f.stringValue as string);
      } catch (error) {
        // Not valid JSON, return as string
        return f.stringValue;
      }
    }
    if (typeName === 'timestamp' || typeName === 'timestamptz') {
      return new Date(f.stringValue as string).toISOString();
    }
    return f.stringValue;
  }
  if (f.longValue !== undefined) {
    return f.longValue;
  }
  if (f.doubleValue !== undefined) {
    return f.doubleValue;
  }
  if (f.booleanValue !== undefined) {
    return f.booleanValue;
  }
  if (f.blobValue !== undefined) {
    return f.blobValue;
  }
  if (f.arrayValue !== undefined) {
    return f.arrayValue;
  }
  return null;
}

/**
 * Set tenant context for RLS
 */
export async function setTenantContext(
  tenantId: string,
  options?: QueryOptions
): Promise<void> {
  await executeStatement(
    "SET app.current_tenant_id = :tenantId",
    [{ name: 'tenantId', value: { stringValue: tenantId } }],
    options
  );
}
