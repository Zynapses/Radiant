/**
 * Cato Schema Registry Service
 * 
 * Manages JSON Schema definitions for self-describing method outputs.
 * Methods reference schemas via schema_ref_id instead of embedding full schemas.
 */

import { Pool } from 'pg';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  CatoSchemaDefinition,
  CreateSchemaDefinitionInput,
  CatoOutputType,
} from '@radiant/shared';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export class CatoSchemaRegistryService {
  private pool: Pool;
  private schemaCache: Map<string, { schema: CatoSchemaDefinition; compiledValidator: ReturnType<typeof ajv.compile> }> = new Map();

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getSchema(schemaRefId: string): Promise<CatoSchemaDefinition | null> {
    const cached = this.schemaCache.get(schemaRefId);
    if (cached) {
      return cached.schema;
    }

    const result = await this.pool.query(
      `SELECT 
        schema_ref_id,
        schema_name,
        version,
        json_schema,
        field_descriptions,
        used_by_output_types,
        produced_by_methods,
        example_payload,
        scope,
        tenant_id,
        created_at,
        updated_at
      FROM cato_schema_definitions
      WHERE schema_ref_id = $1`,
      [schemaRefId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const schema = this.mapRowToSchema(result.rows[0]);
    
    // Cache the schema
    const compiledValidator = ajv.compile(schema.jsonSchema);
    this.schemaCache.set(schemaRefId, { schema, compiledValidator });

    return schema;
  }

  async listSchemas(options?: {
    scope?: 'SYSTEM' | 'TENANT';
    outputType?: CatoOutputType;
    tenantId?: string;
    limit?: number;
    offset?: number;
  }): Promise<CatoSchemaDefinition[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options?.scope) {
      conditions.push(`scope = $${paramIndex++}`);
      params.push(options.scope);
    }

    if (options?.outputType) {
      conditions.push(`$${paramIndex++} = ANY(used_by_output_types)`);
      params.push(options.outputType);
    }

    if (options?.tenantId) {
      conditions.push(`(scope = 'SYSTEM' OR tenant_id = $${paramIndex++})`);
      params.push(options.tenantId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const result = await this.pool.query(
      `SELECT 
        schema_ref_id,
        schema_name,
        version,
        json_schema,
        field_descriptions,
        used_by_output_types,
        produced_by_methods,
        example_payload,
        scope,
        tenant_id,
        created_at,
        updated_at
      FROM cato_schema_definitions
      ${whereClause}
      ORDER BY schema_name ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return result.rows.map(row => this.mapRowToSchema(row));
  }

  async createSchema(
    input: CreateSchemaDefinitionInput,
    tenantId?: string
  ): Promise<CatoSchemaDefinition> {
    // Validate the JSON schema is valid
    try {
      ajv.compile(input.jsonSchema);
    } catch (error) {
      throw new Error(`Invalid JSON Schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const scope = tenantId ? 'TENANT' : 'SYSTEM';

    const result = await this.pool.query(
      `INSERT INTO cato_schema_definitions (
        schema_ref_id,
        schema_name,
        version,
        json_schema,
        field_descriptions,
        used_by_output_types,
        produced_by_methods,
        example_payload,
        scope,
        tenant_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        input.schemaRefId,
        input.schemaName,
        input.version,
        JSON.stringify(input.jsonSchema),
        JSON.stringify(input.fieldDescriptions || {}),
        input.usedByOutputTypes || [],
        input.producedByMethods || [],
        input.examplePayload ? JSON.stringify(input.examplePayload) : null,
        scope,
        tenantId || null,
      ]
    );

    const schema = this.mapRowToSchema(result.rows[0]);

    // Cache the new schema
    const compiledValidator = ajv.compile(schema.jsonSchema);
    this.schemaCache.set(input.schemaRefId, { schema, compiledValidator });

    return schema;
  }

  async updateSchema(
    schemaRefId: string,
    updates: Partial<CreateSchemaDefinitionInput>
  ): Promise<CatoSchemaDefinition> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (updates.schemaName !== undefined) {
      setClauses.push(`schema_name = $${paramIndex++}`);
      params.push(updates.schemaName);
    }

    if (updates.version !== undefined) {
      setClauses.push(`version = $${paramIndex++}`);
      params.push(updates.version);
    }

    if (updates.jsonSchema !== undefined) {
      // Validate the JSON schema
      try {
        ajv.compile(updates.jsonSchema);
      } catch (error) {
        throw new Error(`Invalid JSON Schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      setClauses.push(`json_schema = $${paramIndex++}`);
      params.push(JSON.stringify(updates.jsonSchema));
    }

    if (updates.fieldDescriptions !== undefined) {
      setClauses.push(`field_descriptions = $${paramIndex++}`);
      params.push(JSON.stringify(updates.fieldDescriptions));
    }

    if (updates.usedByOutputTypes !== undefined) {
      setClauses.push(`used_by_output_types = $${paramIndex++}`);
      params.push(updates.usedByOutputTypes);
    }

    if (updates.producedByMethods !== undefined) {
      setClauses.push(`produced_by_methods = $${paramIndex++}`);
      params.push(updates.producedByMethods);
    }

    if (updates.examplePayload !== undefined) {
      setClauses.push(`example_payload = $${paramIndex++}`);
      params.push(updates.examplePayload ? JSON.stringify(updates.examplePayload) : null);
    }

    params.push(schemaRefId);

    const result = await this.pool.query(
      `UPDATE cato_schema_definitions
      SET ${setClauses.join(', ')}
      WHERE schema_ref_id = $${paramIndex}
      RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error(`Schema not found: ${schemaRefId}`);
    }

    const schema = this.mapRowToSchema(result.rows[0]);

    // Update cache
    const compiledValidator = ajv.compile(schema.jsonSchema);
    this.schemaCache.set(schemaRefId, { schema, compiledValidator });

    return schema;
  }

  async deleteSchema(schemaRefId: string): Promise<void> {
    // Check if schema is in use by any methods
    const usageCheck = await this.pool.query(
      `SELECT COUNT(*) as count FROM cato_method_definitions WHERE output_schema_ref = $1`,
      [schemaRefId]
    );

    if (parseInt(usageCheck.rows[0].count) > 0) {
      throw new Error(`Cannot delete schema ${schemaRefId}: it is referenced by one or more methods`);
    }

    const result = await this.pool.query(
      `DELETE FROM cato_schema_definitions WHERE schema_ref_id = $1`,
      [schemaRefId]
    );

    if (result.rowCount === 0) {
      throw new Error(`Schema not found: ${schemaRefId}`);
    }

    // Remove from cache
    this.schemaCache.delete(schemaRefId);
  }

  async validatePayload(
    schemaRefId: string,
    payload: unknown
  ): Promise<{ valid: boolean; errors?: string[] }> {
    let cached = this.schemaCache.get(schemaRefId);

    if (!cached) {
      const schema = await this.getSchema(schemaRefId);
      if (!schema) {
        return { valid: false, errors: [`Schema not found: ${schemaRefId}`] };
      }
      cached = this.schemaCache.get(schemaRefId)!;
    }

    const valid = cached.compiledValidator(payload);

    if (valid) {
      return { valid: true };
    }

    const errors = cached.compiledValidator.errors?.map(
      err => `${err.instancePath || '/'}: ${err.message}`
    ) || ['Unknown validation error'];

    return { valid: false, errors };
  }

  async getSchemasByOutputType(outputType: CatoOutputType): Promise<CatoSchemaDefinition[]> {
    return this.listSchemas({ outputType });
  }

  async getSchemasByMethod(methodId: string): Promise<CatoSchemaDefinition[]> {
    const result = await this.pool.query(
      `SELECT 
        schema_ref_id,
        schema_name,
        version,
        json_schema,
        field_descriptions,
        used_by_output_types,
        produced_by_methods,
        example_payload,
        scope,
        tenant_id,
        created_at,
        updated_at
      FROM cato_schema_definitions
      WHERE $1 = ANY(produced_by_methods)
      ORDER BY schema_name ASC`,
      [methodId]
    );

    return result.rows.map(row => this.mapRowToSchema(row));
  }

  clearCache(): void {
    this.schemaCache.clear();
  }

  private mapRowToSchema(row: Record<string, unknown>): CatoSchemaDefinition {
    return {
      schemaRefId: row.schema_ref_id as string,
      schemaName: row.schema_name as string,
      version: row.version as string,
      jsonSchema: row.json_schema as Record<string, unknown>,
      fieldDescriptions: row.field_descriptions as Record<string, string>,
      usedByOutputTypes: row.used_by_output_types as CatoOutputType[],
      producedByMethods: row.produced_by_methods as string[],
      examplePayload: row.example_payload as Record<string, unknown> | undefined,
      scope: row.scope as 'SYSTEM' | 'TENANT',
      tenantId: row.tenant_id as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

export const createCatoSchemaRegistryService = (pool: Pool): CatoSchemaRegistryService => {
  return new CatoSchemaRegistryService(pool);
};
