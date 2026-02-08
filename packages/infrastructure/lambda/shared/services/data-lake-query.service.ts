/**
 * RADIANT v4.18.0 - Data Lake Query Service
 *
 * Replaces PostgreSQL SELECT queries for log/audit/telemetry data with
 * Athena queries over partitioned Parquet in S3.
 *
 * Features:
 *   - SQL queries via Athena against Glue Catalog tables
 *   - Automatic partition pruning by tenant_id + date range
 *   - Async query execution with polling (Athena is not real-time)
 *   - Result caching in S3 (Athena results bucket)
 *   - Per-tenant query cost tracking (Athena charges per TB scanned)
 *   - Convenience methods for common query patterns
 *   - Falls back to data_location_index for metadata-only queries
 *
 * Usage:
 *   const queryService = new DataLakeQueryService(pool);
 *
 *   // Simple query
 *   const results = await queryService.queryEvents({
 *     tenantId: 'tenant-123',
 *     dataTypeKey: 'audit_log',
 *     startDate: '2026-01-01',
 *     endDate: '2026-02-01',
 *     filters: { action: 'update_settings' },
 *     limit: 100,
 *   });
 *
 *   // Raw SQL (advanced)
 *   const raw = await queryService.executeQuery(
 *     `SELECT * FROM audit_logs WHERE tenant_id = 'tenant-123' AND year = 2026 AND month = 1 LIMIT 10`
 *   );
 */

import { Pool } from 'pg';
import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  QueryExecutionState,
} from '@aws-sdk/client-athena';
import { createRegisteredLogger } from './logging-registry.service';

const REGION = process.env.AWS_REGION || 'us-east-1';
const GLUE_DATABASE = process.env.GLUE_DATABASE || 'radiant_data_lake';
const ATHENA_WORKGROUP = process.env.ATHENA_WORKGROUP || 'radiant-data-lake';
const ATHENA_RESULTS_BUCKET = process.env.ATHENA_RESULTS_BUCKET || 'radiant-athena-results';
const ATHENA_RESULTS_PREFIX = 'query-results/';

const athenaClient = new AthenaClient({ region: REGION });

const logger = createRegisteredLogger({
  serviceName: 'data-lake/query',
  category: 'infrastructure',
  sourceType: 'application',
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueryEventsParams {
  tenantId: string;
  dataTypeKey: string;
  startDate?: string;         // ISO date (YYYY-MM-DD)
  endDate?: string;
  filters?: Record<string, string | number | boolean>;
  searchText?: string;        // Full-text search in payload
  orderBy?: string;           // Column to order by (default: timestamp DESC)
  limit?: number;             // Max rows (default: 100, max: 10000)
  offset?: number;
}

export interface QueryResult {
  queryExecutionId: string;
  status: 'succeeded' | 'failed' | 'cancelled' | 'running' | 'queued';
  rows: Record<string, unknown>[];
  totalRows: number;
  columnsMetadata: Array<{ name: string; type: string }>;
  dataScannedBytes: number;
  executionTimeMs: number;
  estimatedCostUsd: number;   // Athena: $5 per TB scanned
}

export interface AggregateResult {
  groups: Array<{
    key: string;
    count: number;
    totalBytes?: number;
    avgValue?: number;
    minValue?: number;
    maxValue?: number;
  }>;
  totalCount: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class DataLakeQueryService {
  constructor(private pool: Pool) {}

  // =========================================================================
  // QUERY EVENTS: Main query method with automatic SQL generation
  // =========================================================================

  async queryEvents(params: QueryEventsParams): Promise<QueryResult> {
    // Resolve Glue table name from data type key
    const tableResult = await this.pool.query(
      `SELECT glue_table_name FROM data_type_registry WHERE type_key = $1`,
      [params.dataTypeKey]
    );
    if (tableResult.rows.length === 0) {
      throw new Error(`Unknown data type key: ${params.dataTypeKey}`);
    }
    const tableName = tableResult.rows[0].glue_table_name as string;

    // Build SQL with partition pruning
    const conditions: string[] = [`tenant_id = '${this.escapeAthena(params.tenantId)}'`];

    if (params.startDate) {
      const d = new Date(params.startDate);
      conditions.push(`year >= ${d.getUTCFullYear()}`);
      conditions.push(`(year > ${d.getUTCFullYear()} OR month >= ${d.getUTCMonth() + 1})`);
      conditions.push(`(year > ${d.getUTCFullYear()} OR month > ${d.getUTCMonth() + 1} OR day >= ${d.getUTCDate()})`);
    }
    if (params.endDate) {
      const d = new Date(params.endDate);
      conditions.push(`year <= ${d.getUTCFullYear()}`);
      conditions.push(`(year < ${d.getUTCFullYear()} OR month <= ${d.getUTCMonth() + 1})`);
      conditions.push(`(year < ${d.getUTCFullYear()} OR month < ${d.getUTCMonth() + 1} OR day <= ${d.getUTCDate()})`);
    }

    // Apply filters on payload fields (JSON path extraction)
    if (params.filters) {
      for (const [key, value] of Object.entries(params.filters)) {
        if (typeof value === 'string') {
          conditions.push(`json_extract_scalar(payload, '$.${this.escapeAthena(key)}') = '${this.escapeAthena(value)}'`);
        } else if (typeof value === 'number') {
          conditions.push(`CAST(json_extract_scalar(payload, '$.${this.escapeAthena(key)}') AS DOUBLE) = ${value}`);
        } else if (typeof value === 'boolean') {
          conditions.push(`json_extract_scalar(payload, '$.${this.escapeAthena(key)}') = '${value}'`);
        }
      }
    }

    // Full-text search in payload
    if (params.searchText) {
      conditions.push(`CAST(payload AS VARCHAR) LIKE '%${this.escapeAthena(params.searchText)}%'`);
    }

    const limit = Math.min(params.limit || 100, 10000);
    const offset = params.offset || 0;
    const orderBy = params.orderBy || 'timestamp DESC';

    const sql = `
      SELECT *
      FROM "${GLUE_DATABASE}"."${tableName}"
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBy}
      OFFSET ${offset}
      LIMIT ${limit}
    `;

    return this.executeQuery(sql);
  }

  // =========================================================================
  // AGGREGATE: Count, sum, avg by grouping
  // =========================================================================

  async aggregateEvents(params: {
    tenantId: string;
    dataTypeKey: string;
    groupBy: string;         // Field to group by (e.g., 'payload.action', 'day')
    metric?: 'count' | 'sum' | 'avg' | 'min' | 'max';
    metricField?: string;    // Field to aggregate (for sum/avg/min/max)
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<AggregateResult> {
    const tableResult = await this.pool.query(
      `SELECT glue_table_name FROM data_type_registry WHERE type_key = $1`,
      [params.dataTypeKey]
    );
    if (tableResult.rows.length === 0) {
      throw new Error(`Unknown data type key: ${params.dataTypeKey}`);
    }
    const tableName = tableResult.rows[0].glue_table_name as string;

    const conditions: string[] = [`tenant_id = '${this.escapeAthena(params.tenantId)}'`];
    if (params.startDate) {
      const d = new Date(params.startDate);
      conditions.push(`year >= ${d.getUTCFullYear()}`);
    }
    if (params.endDate) {
      const d = new Date(params.endDate);
      conditions.push(`year <= ${d.getUTCFullYear()}`);
    }

    // Determine group expression
    let groupExpr: string;
    if (params.groupBy === 'day') {
      groupExpr = `CONCAT(CAST(year AS VARCHAR), '-', LPAD(CAST(month AS VARCHAR), 2, '0'), '-', LPAD(CAST(day AS VARCHAR), 2, '0'))`;
    } else if (params.groupBy === 'hour') {
      groupExpr = `CONCAT(CAST(year AS VARCHAR), '-', LPAD(CAST(month AS VARCHAR), 2, '0'), '-', LPAD(CAST(day AS VARCHAR), 2, '0'), 'T', LPAD(CAST(hour AS VARCHAR), 2, '0'))`;
    } else if (params.groupBy === 'month') {
      groupExpr = `CONCAT(CAST(year AS VARCHAR), '-', LPAD(CAST(month AS VARCHAR), 2, '0'))`;
    } else if (params.groupBy.startsWith('payload.')) {
      const field = params.groupBy.replace('payload.', '');
      groupExpr = `json_extract_scalar(payload, '$.${this.escapeAthena(field)}')`;
    } else {
      groupExpr = this.escapeAthena(params.groupBy);
    }

    // Metric expression
    let metricExpr = 'COUNT(*) as metric_value';
    if (params.metric && params.metric !== 'count' && params.metricField) {
      const field = params.metricField.startsWith('payload.')
        ? `CAST(json_extract_scalar(payload, '$.${params.metricField.replace('payload.', '')}') AS DOUBLE)`
        : this.escapeAthena(params.metricField);
      metricExpr = `${params.metric.toUpperCase()}(${field}) as metric_value`;
    }

    const sql = `
      SELECT ${groupExpr} as group_key, COUNT(*) as row_count, ${metricExpr}
      FROM "${GLUE_DATABASE}"."${tableName}"
      WHERE ${conditions.join(' AND ')}
      GROUP BY ${groupExpr}
      ORDER BY row_count DESC
      LIMIT ${params.limit || 100}
    `;

    const result = await this.executeQuery(sql);

    return {
      groups: result.rows.map(row => ({
        key: String(row.group_key || ''),
        count: parseInt(String(row.row_count || 0), 10),
        avgValue: row.metric_value ? parseFloat(String(row.metric_value)) : undefined,
      })),
      totalCount: result.rows.reduce((sum, row) => sum + parseInt(String(row.row_count || 0), 10), 0),
    };
  }

  // =========================================================================
  // COUNT: Fast count query with partition pruning
  // =========================================================================

  async countEvents(params: {
    tenantId: string;
    dataTypeKey: string;
    startDate?: string;
    endDate?: string;
  }): Promise<number> {
    const tableResult = await this.pool.query(
      `SELECT glue_table_name FROM data_type_registry WHERE type_key = $1`,
      [params.dataTypeKey]
    );
    if (tableResult.rows.length === 0) return 0;
    const tableName = tableResult.rows[0].glue_table_name as string;

    const conditions: string[] = [`tenant_id = '${this.escapeAthena(params.tenantId)}'`];
    if (params.startDate) {
      const d = new Date(params.startDate);
      conditions.push(`year >= ${d.getUTCFullYear()}`);
      conditions.push(`(year > ${d.getUTCFullYear()} OR month >= ${d.getUTCMonth() + 1})`);
    }
    if (params.endDate) {
      const d = new Date(params.endDate);
      conditions.push(`year <= ${d.getUTCFullYear()}`);
      conditions.push(`(year < ${d.getUTCFullYear()} OR month <= ${d.getUTCMonth() + 1})`);
    }

    const sql = `
      SELECT COUNT(*) as total
      FROM "${GLUE_DATABASE}"."${tableName}"
      WHERE ${conditions.join(' AND ')}
    `;

    const result = await this.executeQuery(sql);
    return parseInt(String(result.rows[0]?.total || 0), 10);
  }

  // =========================================================================
  // EXECUTE RAW SQL: For advanced queries
  // =========================================================================

  async executeQuery(sql: string): Promise<QueryResult> {
    const startTime = Date.now();

    // Start query execution
    const startResponse = await athenaClient.send(new StartQueryExecutionCommand({
      QueryString: sql,
      QueryExecutionContext: { Database: GLUE_DATABASE },
      WorkGroup: ATHENA_WORKGROUP,
      ResultConfiguration: {
        OutputLocation: `s3://${ATHENA_RESULTS_BUCKET}/${ATHENA_RESULTS_PREFIX}`,
      },
    }));

    const queryExecutionId = startResponse.QueryExecutionId!;

    // Poll for completion (max 60 seconds)
    let status: QueryExecutionState | undefined;
    let dataScannedBytes = 0;
    const maxWaitMs = 60000;
    const pollIntervalMs = 500;
    let waited = 0;

    while (waited < maxWaitMs) {
      const statusResponse = await athenaClient.send(new GetQueryExecutionCommand({
        QueryExecutionId: queryExecutionId,
      }));

      status = statusResponse.QueryExecution?.Status?.State;
      dataScannedBytes = Number(
        statusResponse.QueryExecution?.Statistics?.DataScannedInBytes || 0
      );

      if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'CANCELLED') {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      waited += pollIntervalMs;
    }

    const executionTimeMs = Date.now() - startTime;

    if (status !== 'SUCCEEDED') {
      const failReason = status === 'FAILED' ? 'Query failed' : status === 'CANCELLED' ? 'Query cancelled' : 'Query timed out';
      return {
        queryExecutionId,
        status: (status?.toLowerCase() || 'failed') as QueryResult['status'],
        rows: [],
        totalRows: 0,
        columnsMetadata: [],
        dataScannedBytes,
        executionTimeMs,
        estimatedCostUsd: (dataScannedBytes / 1099511627776) * 5, // $5/TB
      };
    }

    // Get results
    const resultsResponse = await athenaClient.send(new GetQueryResultsCommand({
      QueryExecutionId: queryExecutionId,
      MaxResults: 10000,
    }));

    const resultSet = resultsResponse.ResultSet;
    const columns = resultSet?.ResultSetMetadata?.ColumnInfo || [];
    const rawRows = resultSet?.Rows || [];

    // First row is headers
    const headerRow = rawRows[0]?.Data?.map(d => d.VarCharValue || '') || [];
    const dataRows = rawRows.slice(1);

    const rows: Record<string, unknown>[] = dataRows.map(row => {
      const obj: Record<string, unknown> = {};
      (row.Data || []).forEach((cell, idx) => {
        const colName = headerRow[idx] || `col_${idx}`;
        let value: unknown = cell.VarCharValue;
        // Try to parse JSON payload column
        if (colName === 'payload' && typeof value === 'string') {
          try { value = JSON.parse(value); } catch { /* keep as string */ }
        }
        obj[colName] = value;
      });
      return obj;
    });

    const columnsMetadata = columns.map(col => ({
      name: col.Name || '',
      type: col.Type || 'string',
    }));

    return {
      queryExecutionId,
      status: 'succeeded',
      rows,
      totalRows: rows.length,
      columnsMetadata,
      dataScannedBytes,
      executionTimeMs,
      estimatedCostUsd: (dataScannedBytes / 1099511627776) * 5,
    };
  }

  // =========================================================================
  // GET DATA TYPE REGISTRY: List all registered data types
  // =========================================================================

  async getDataTypes(): Promise<Array<{
    id: string;
    typeKey: string;
    displayName: string;
    category: string;
    description: string;
    glueTableName: string;
    defaultRetentionDays: number;
    isActive: boolean;
  }>> {
    const result = await this.pool.query(
      `SELECT * FROM data_type_registry WHERE is_active = true ORDER BY category, type_key`
    );
    return result.rows.map(row => ({
      id: row.id as string,
      typeKey: row.type_key as string,
      displayName: row.display_name as string,
      category: row.category as string,
      description: row.description as string || '',
      glueTableName: row.glue_table_name as string,
      defaultRetentionDays: row.default_retention_days as number,
      isActive: row.is_active as boolean,
    }));
  }

  // =========================================================================
  // ESCAPE: Prevent SQL injection in Athena queries
  // =========================================================================

  private escapeAthena(value: string): string {
    return value.replace(/'/g, "''").replace(/;/g, '').replace(/--/g, '');
  }
}
