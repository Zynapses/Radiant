/**
 * RADIANT TMS - Database Utilities
 * Aurora Data API helpers with proper type mapping
 */

import { RDSDataClient, ExecuteStatementCommand, BeginTransactionCommand, CommitTransactionCommand, RollbackTransactionCommand, Field, SqlParameter } from '@aws-sdk/client-rds-data';
import * as AWSXRay from 'aws-xray-sdk';

const rawRdsClient = new RDSDataClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

export const rdsClient = process.env.AWS_XRAY_DAEMON_ADDRESS
  ? AWSXRay.captureAWSv3Client(rawRdsClient)
  : rawRdsClient;

export const CLUSTER_ARN = process.env.AURORA_CLUSTER_ARN!;
export const SECRET_ARN = process.env.AURORA_SECRET_ARN!;
export const DATABASE = process.env.DATABASE_NAME || 'radiant';

export interface TransactionContext {
  transactionId: string;
}

export async function beginTransaction(): Promise<TransactionContext> {
  const response = await rdsClient.send(new BeginTransactionCommand({
    resourceArn: CLUSTER_ARN,
    secretArn: SECRET_ARN,
    database: DATABASE,
  }));
  
  if (!response.transactionId) {
    throw new Error('Failed to begin transaction: no transaction ID returned');
  }
  
  return { transactionId: response.transactionId };
}

export async function commitTransaction(ctx: TransactionContext): Promise<void> {
  await rdsClient.send(new CommitTransactionCommand({
    resourceArn: CLUSTER_ARN,
    secretArn: SECRET_ARN,
    transactionId: ctx.transactionId,
  }));
}

export async function rollbackTransaction(ctx: TransactionContext): Promise<void> {
  await rdsClient.send(new RollbackTransactionCommand({
    resourceArn: CLUSTER_ARN,
    secretArn: SECRET_ARN,
    transactionId: ctx.transactionId,
  }));
}

export async function executeStatement<T = Record<string, unknown>>(
  sql: string,
  parameters: SqlParameter[] = [],
  transactionId?: string
): Promise<T[]> {
  const response = await rdsClient.send(new ExecuteStatementCommand({
    resourceArn: CLUSTER_ARN,
    secretArn: SECRET_ARN,
    database: DATABASE,
    sql,
    parameters,
    includeResultMetadata: true,
    ...(transactionId ? { transactionId } : {}),
  }));
  
  if (!response.records || !response.columnMetadata) {
    return [];
  }
  
  return response.records.map((row) => {
    const obj: Record<string, unknown> = {};
    response.columnMetadata!.forEach((col, index) => {
      const field = row[index];
      obj[toCamelCase(col.name!)] = extractFieldValue(field);
    });
    return obj as T;
  });
}

export async function executeStatementSingle<T = Record<string, unknown>>(
  sql: string,
  parameters: SqlParameter[] = [],
  transactionId?: string
): Promise<T | null> {
  const results = await executeStatement<T>(sql, parameters, transactionId);
  return results.length > 0 ? results[0] : null;
}

export async function withTransaction<T>(
  operation: (transactionId: string) => Promise<T>
): Promise<T> {
  const ctx = await beginTransaction();
  
  try {
    const result = await operation(ctx.transactionId);
    await commitTransaction(ctx);
    return result;
  } catch (error) {
    await rollbackTransaction(ctx);
    throw error;
  }
}

function extractFieldValue(field: Field): unknown {
  if (field.isNull) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.longValue !== undefined) return Number(field.longValue);
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.blobValue !== undefined) return field.blobValue;
  if (field.arrayValue !== undefined) {
    if (field.arrayValue.stringValues) return field.arrayValue.stringValues;
    if (field.arrayValue.longValues) return field.arrayValue.longValues?.map(Number);
    if (field.arrayValue.doubleValues) return field.arrayValue.doubleValues;
    if (field.arrayValue.booleanValues) return field.arrayValue.booleanValues;
    return [];
  }
  return null;
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function param(name: string, value: string | number | boolean | null | undefined): SqlParameter {
  if (value === null || value === undefined) {
    return { name, value: { isNull: true } };
  }
  if (typeof value === 'string') {
    return { name, value: { stringValue: value } };
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { name, value: { longValue: value } };
    }
    return { name, value: { doubleValue: value } };
  }
  if (typeof value === 'boolean') {
    return { name, value: { booleanValue: value } };
  }
  return { name, value: { stringValue: String(value) } };
}

export function jsonParam(name: string, value: unknown): SqlParameter {
  return { name, value: { stringValue: JSON.stringify(value) } };
}

export function uuidParam(name: string, value: string): SqlParameter {
  return { name, value: { stringValue: value }, typeHint: 'UUID' };
}

export function timestampParam(name: string, value: Date | string): SqlParameter {
  const isoString = value instanceof Date ? value.toISOString() : value;
  return { name, value: { stringValue: isoString }, typeHint: 'TIMESTAMP' };
}

export async function setTenantContext(
  tenantId: string,
  isSuperAdmin: boolean = false,
  transactionId?: string
): Promise<void> {
  await executeStatement(
    `SELECT set_config('app.current_tenant_id', $1, true), set_config('app.is_super_admin', $2, true)`,
    [
      param('1', tenantId),
      param('2', isSuperAdmin.toString()),
    ],
    transactionId
  );
}

export async function clearTenantContext(transactionId?: string): Promise<void> {
  await executeStatement(
    `SELECT set_config('app.current_tenant_id', '', true), set_config('app.is_super_admin', 'false', true)`,
    [],
    transactionId
  );
}
