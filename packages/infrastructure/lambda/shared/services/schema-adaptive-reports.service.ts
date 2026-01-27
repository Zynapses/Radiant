// @ts-ignore - module may not exist in all environments
import { executeStatement } from '../utils/aurora';
// @ts-ignore - module may not exist in all environments
import { enhancedLogger as logger } from './enhanced-logger.service';

export interface SchemaColumn {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  referencedTable?: string;
  referencedColumn?: string;
}

export interface SchemaTable {
  name: string;
  schema: string;
  columns: SchemaColumn[];
  rowCount: number;
  estimatedSize: string;
  hasTimestamps: boolean;
  hasTenantId: boolean;
}

export interface SchemaCategory {
  name: string;
  tables: SchemaTable[];
  description: string;
}

export interface ReportField {
  column: string;
  table: string;
  alias: string;
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct';
  format?: 'number' | 'currency' | 'percentage' | 'date' | 'datetime' | 'text';
}

export interface ReportFilter {
  column: string;
  table: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'between' | 'is_null' | 'is_not_null';
  value?: string | number | boolean | string[] | number[];
  value2?: string | number;
}

export interface ReportJoin {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: 'inner' | 'left' | 'right';
}

export interface DynamicReportDefinition {
  id?: string;
  name: string;
  description: string;
  baseTable: string;
  fields: ReportField[];
  filters: ReportFilter[];
  joins: ReportJoin[];
  groupBy: string[];
  orderBy: { column: string; direction: 'asc' | 'desc' }[];
  limit?: number;
  schedule?: 'manual' | 'daily' | 'weekly' | 'monthly';
  format: 'json' | 'csv' | 'pdf' | 'excel';
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportExecutionResult {
  columns: { name: string; type: string; format?: string }[];
  rows: Record<string, unknown>[];
  totalRows: number;
  executionTimeMs: number;
  generatedAt: string;
  query?: string;
}

const TABLE_CATEGORIES: Record<string, { pattern: RegExp; description: string }> = {
  'Users & Auth': { pattern: /^(users|tenants|roles|permissions|api_keys|sessions|invitations)/i, description: 'User accounts, authentication, and authorization' },
  'AI Models': { pattern: /^(models|model_|providers|lora_|inference_)/i, description: 'AI model configuration and metadata' },
  'Conversations': { pattern: /^(conversations|messages|chat_|threads)/i, description: 'User conversations and messages' },
  'Billing': { pattern: /^(billing|subscriptions|invoices|credits|payments|usage)/i, description: 'Billing, subscriptions, and usage tracking' },
  'Analytics': { pattern: /^(analytics|metrics|stats|reports|audit_)/i, description: 'Analytics and reporting data' },
  'AGI Brain': { pattern: /^(agi_|brain_|orchestration|consciousness|cognition)/i, description: 'AGI brain and orchestration systems' },
  'Cato Safety': { pattern: /^(cato_|genesis_|safety_|compliance_)/i, description: 'Cato safety and compliance systems' },
  'Sovereign Mesh': { pattern: /^(sovereign_|mesh_|agent_|scaling_)/i, description: 'Sovereign Mesh agent network' },
  'Think Tank': { pattern: /^(thinktank_|delight_|domain_|magic_|ego_)/i, description: 'Think Tank consumer features' },
  'System': { pattern: /^(system_|config_|settings_|migrations|schema_)/i, description: 'System configuration and settings' },
};

class SchemaAdaptiveReportsService {
  private schemaCache: SchemaTable[] | null = null;
  private schemaCacheTime: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  async discoverSchema(tenantId: string): Promise<SchemaCategory[]> {
    const tables = await this.getTableSchema(tenantId);
    return this.categorizeSchema(tables);
  }

  private async getTableSchema(tenantId: string): Promise<SchemaTable[]> {
    if (this.schemaCache && Date.now() - this.schemaCacheTime < this.CACHE_TTL_MS) {
      return this.schemaCache;
    }

    try {
      const tablesResult = await executeStatement(`
        SELECT 
          t.table_schema,
          t.table_name,
          pg_size_pretty(pg_total_relation_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))) as size,
          (SELECT reltuples::bigint FROM pg_class WHERE oid = (quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::regclass) as row_estimate
        FROM information_schema.tables t
        WHERE t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name
      `);

      const tables: SchemaTable[] = [];

      for (const tableRow of tablesResult.records || []) {
        const tableName = tableRow[1]?.stringValue || '';
        const tableSchema = tableRow[0]?.stringValue || 'public';
        
        const columnsResult = await executeStatement(`
          SELECT 
            c.column_name,
            c.data_type,
            c.is_nullable,
            CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_pk,
            CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_fk,
            ccu.table_name as ref_table,
            ccu.column_name as ref_column
          FROM information_schema.columns c
          LEFT JOIN (
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
          ) pk ON c.column_name = pk.column_name
          LEFT JOIN (
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'
          ) fk ON c.column_name = fk.column_name
          LEFT JOIN information_schema.constraint_column_usage ccu ON fk.column_name IS NOT NULL
          WHERE c.table_name = $1
          ORDER BY c.ordinal_position
        `, [{ name: 'tableName', value: { stringValue: tableName } }]);

        const columns: SchemaColumn[] = (columnsResult.records || []).map(row => ({
          name: row[0]?.stringValue || '',
          dataType: row[1]?.stringValue || '',
          isNullable: row[2]?.stringValue === 'YES',
          isPrimaryKey: row[3]?.booleanValue || false,
          isForeignKey: row[4]?.booleanValue || false,
          referencedTable: row[5]?.stringValue,
          referencedColumn: row[6]?.stringValue,
        }));

        const hasTimestamps = columns.some(c => 
          ['created_at', 'updated_at', 'timestamp'].includes(c.name.toLowerCase())
        );
        const hasTenantId = columns.some(c => c.name.toLowerCase() === 'tenant_id');

        tables.push({
          name: tableName,
          schema: tableSchema,
          columns,
          rowCount: parseInt(tableRow[3]?.stringValue || '0', 10),
          estimatedSize: tableRow[2]?.stringValue || '0 bytes',
          hasTimestamps,
          hasTenantId,
        });
      }

      this.schemaCache = tables;
      this.schemaCacheTime = Date.now();
      return tables;
    } catch (error) {
      logger.error('Failed to discover schema', { error, tenantId });
      throw error;
    }
  }

  private categorizeSchema(tables: SchemaTable[]): SchemaCategory[] {
    const categories: Map<string, SchemaTable[]> = new Map();
    const uncategorized: SchemaTable[] = [];

    for (const table of tables) {
      let matched = false;
      for (const [category, config] of Object.entries(TABLE_CATEGORIES)) {
        if (config.pattern.test(table.name)) {
          if (!categories.has(category)) {
            categories.set(category, []);
          }
          categories.get(category)!.push(table);
          matched = true;
          break;
        }
      }
      if (!matched) {
        uncategorized.push(table);
      }
    }

    const result: SchemaCategory[] = [];
    for (const [name, tablelist] of categories.entries()) {
      result.push({
        name,
        tables: tablelist,
        description: TABLE_CATEGORIES[name]?.description || '',
      });
    }

    if (uncategorized.length > 0) {
      result.push({
        name: 'Other',
        tables: uncategorized,
        description: 'Uncategorized tables',
      });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getSuggestedReports(tenantId: string): Promise<DynamicReportDefinition[]> {
    const schema = await this.discoverSchema(tenantId);
    const suggestions: DynamicReportDefinition[] = [];

    for (const category of schema) {
      for (const table of category.tables) {
        if (table.hasTimestamps && table.rowCount > 0) {
          const timestampCol = table.columns.find(c => 
            ['created_at', 'timestamp'].includes(c.name.toLowerCase())
          );

          if (timestampCol) {
            suggestions.push({
              name: `${this.formatTableName(table.name)} Daily Summary`,
              description: `Daily count of records in ${table.name}`,
              baseTable: table.name,
              fields: [
                { column: timestampCol.name, table: table.name, alias: 'Date', format: 'date' },
                { column: '*', table: table.name, alias: 'Count', aggregation: 'count', format: 'number' },
              ],
              filters: [],
              joins: [],
              groupBy: [`DATE(${table.name}.${timestampCol.name})`],
              orderBy: [{ column: `DATE(${table.name}.${timestampCol.name})`, direction: 'desc' }],
              limit: 30,
              format: 'json',
            });
          }
        }

        if (table.hasTenantId) {
          suggestions.push({
            name: `${this.formatTableName(table.name)} by Tenant`,
            description: `Record count per tenant in ${table.name}`,
            baseTable: table.name,
            fields: [
              { column: 'tenant_id', table: table.name, alias: 'Tenant', format: 'text' },
              { column: '*', table: table.name, alias: 'Count', aggregation: 'count', format: 'number' },
            ],
            filters: [],
            joins: [],
            groupBy: [`${table.name}.tenant_id`],
            orderBy: [{ column: 'count', direction: 'desc' }],
            limit: 100,
            format: 'json',
          });
        }
      }
    }

    return suggestions.slice(0, 20);
  }

  private formatTableName(name: string): string {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  async executeReport(
    tenantId: string,
    definition: DynamicReportDefinition
  ): Promise<ReportExecutionResult> {
    const startTime = Date.now();

    try {
      const query = this.buildQuery(definition, tenantId);
      logger.info('Executing dynamic report', { reportName: definition.name, query });

      const result = await executeStatement(query);
      const executionTimeMs = Date.now() - startTime;

      const columns = definition.fields.map(f => ({
        name: f.alias || f.column,
        type: this.inferColumnType(f),
        format: f.format,
      }));

      const rows = (result.records || []).map(record => {
        const row: Record<string, unknown> = {};
        definition.fields.forEach((field, index) => {
          const value = record[index];
          row[field.alias || field.column] = this.extractValue(value, field.format);
        });
        return row;
      });

      return {
        columns,
        rows,
        totalRows: rows.length,
        executionTimeMs,
        generatedAt: new Date().toISOString(),
        query,
      };
    } catch (error) {
      logger.error('Report execution failed', { error, definition });
      throw error;
    }
  }

  private buildQuery(definition: DynamicReportDefinition, tenantId: string): string {
    const selectClauses: string[] = definition.fields.map(field => {
      const col = `${field.table}.${field.column}`;
      if (field.aggregation) {
        switch (field.aggregation) {
          case 'count': return `COUNT(${field.column === '*' ? '*' : col}) AS "${field.alias}"`;
          case 'sum': return `SUM(${col}) AS "${field.alias}"`;
          case 'avg': return `AVG(${col}) AS "${field.alias}"`;
          case 'min': return `MIN(${col}) AS "${field.alias}"`;
          case 'max': return `MAX(${col}) AS "${field.alias}"`;
          case 'distinct': return `COUNT(DISTINCT ${col}) AS "${field.alias}"`;
        }
      }
      if (field.format === 'date') {
        return `DATE(${col}) AS "${field.alias}"`;
      }
      return `${col} AS "${field.alias}"`;
    });

    let query = `SELECT ${selectClauses.join(', ')} FROM ${definition.baseTable}`;

    for (const join of definition.joins) {
      query += ` ${join.type.toUpperCase()} JOIN ${join.toTable} ON ${join.fromTable}.${join.fromColumn} = ${join.toTable}.${join.toColumn}`;
    }

    const whereConditions: string[] = [];
    
    const baseTableHasTenantId = this.schemaCache?.find(t => t.name === definition.baseTable)?.hasTenantId;
    if (baseTableHasTenantId) {
      whereConditions.push(`${definition.baseTable}.tenant_id = '${tenantId}'`);
    }

    for (const filter of definition.filters) {
      const col = `${filter.table}.${filter.column}`;
      switch (filter.operator) {
        case 'eq': whereConditions.push(`${col} = ${this.formatValue(filter.value)}`); break;
        case 'neq': whereConditions.push(`${col} != ${this.formatValue(filter.value)}`); break;
        case 'gt': whereConditions.push(`${col} > ${this.formatValue(filter.value)}`); break;
        case 'gte': whereConditions.push(`${col} >= ${this.formatValue(filter.value)}`); break;
        case 'lt': whereConditions.push(`${col} < ${this.formatValue(filter.value)}`); break;
        case 'lte': whereConditions.push(`${col} <= ${this.formatValue(filter.value)}`); break;
        case 'like': whereConditions.push(`${col} LIKE ${this.formatValue(filter.value)}`); break;
        case 'in': whereConditions.push(`${col} IN (${(filter.value as unknown[]).map(v => this.formatValue(v)).join(', ')})`); break;
        case 'between': whereConditions.push(`${col} BETWEEN ${this.formatValue(filter.value)} AND ${this.formatValue(filter.value2)}`); break;
        case 'is_null': whereConditions.push(`${col} IS NULL`); break;
        case 'is_not_null': whereConditions.push(`${col} IS NOT NULL`); break;
      }
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    if (definition.groupBy.length > 0) {
      query += ` GROUP BY ${definition.groupBy.join(', ')}`;
    }

    if (definition.orderBy.length > 0) {
      query += ` ORDER BY ${definition.orderBy.map(o => `${o.column} ${o.direction.toUpperCase()}`).join(', ')}`;
    }

    if (definition.limit) {
      query += ` LIMIT ${definition.limit}`;
    }

    return query;
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    return String(value);
  }

  private inferColumnType(field: ReportField): string {
    if (field.aggregation === 'count') return 'integer';
    if (field.aggregation) return 'number';
    if (field.format === 'date' || field.format === 'datetime') return 'timestamp';
    if (field.format === 'number' || field.format === 'currency' || field.format === 'percentage') return 'number';
    return 'text';
  }

  private extractValue(value: Record<string, unknown> | undefined, format?: string): unknown {
    if (!value) return null;
    if ('stringValue' in value) return value.stringValue;
    if ('longValue' in value) return value.longValue;
    if ('doubleValue' in value) return value.doubleValue;
    if ('booleanValue' in value) return value.booleanValue;
    if ('isNull' in value && value.isNull) return null;
    return null;
  }

  async saveReportDefinition(
    tenantId: string,
    definition: DynamicReportDefinition
  ): Promise<{ id: string }> {
    const id = `rpt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    await executeStatement(`
      INSERT INTO dynamic_reports (id, tenant_id, name, description, definition, schedule, format, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    `, [
      { name: 'id', value: { stringValue: id } },
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'name', value: { stringValue: definition.name } },
      { name: 'description', value: { stringValue: definition.description } },
      { name: 'definition', value: { stringValue: JSON.stringify(definition) } },
      { name: 'schedule', value: { stringValue: definition.schedule || 'manual' } },
      { name: 'format', value: { stringValue: definition.format } },
    ]);

    return { id };
  }

  async listSavedReports(tenantId: string): Promise<DynamicReportDefinition[]> {
    const result = await executeStatement(`
      SELECT id, name, description, definition, schedule, format, created_at, updated_at
      FROM dynamic_reports
      WHERE tenant_id = $1
      ORDER BY updated_at DESC
    `, [{ name: 'tenantId', value: { stringValue: tenantId } }]);

    return (result.records || []).map(record => {
      const definition = JSON.parse(record[3]?.stringValue || '{}') as DynamicReportDefinition;
      return {
        ...definition,
        id: record[0]?.stringValue,
        createdAt: record[6]?.stringValue,
        updatedAt: record[7]?.stringValue,
      };
    });
  }

  async deleteReport(tenantId: string, reportId: string): Promise<void> {
    await executeStatement(`
      DELETE FROM dynamic_reports
      WHERE id = $1 AND tenant_id = $2
    `, [
      { name: 'id', value: { stringValue: reportId } },
      { name: 'tenantId', value: { stringValue: tenantId } },
    ]);
  }
}

export const schemaAdaptiveReportsService = new SchemaAdaptiveReportsService();
