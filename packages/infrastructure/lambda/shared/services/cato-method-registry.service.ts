/**
 * Cato Method Registry Service
 * 
 * Manages method definitions - the 70+ composable methods that form the pipeline.
 * Each method has capabilities, context strategies, prompt templates, and output schemas.
 */

import { Pool } from 'pg';
import {
  CatoMethodDefinition,
  CreateMethodDefinitionInput,
  CatoMethodType,
  CatoOutputType,
  CatoRiskLevel,
  CatoContextStrategyConfig,
  CatoModelConfig,
  CatoPromptVariable,
} from '@radiant/shared';

export class CatoMethodRegistryService {
  private pool: Pool;
  private methodCache: Map<string, CatoMethodDefinition> = new Map();

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getMethod(methodId: string): Promise<CatoMethodDefinition | null> {
    const cached = this.methodCache.get(methodId);
    if (cached) {
      return cached;
    }

    const result = await this.pool.query(
      `SELECT * FROM cato_method_definitions WHERE method_id = $1`,
      [methodId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const method = this.mapRowToMethod(result.rows[0]);
    this.methodCache.set(methodId, method);
    return method;
  }

  async listMethods(options?: {
    scope?: 'SYSTEM' | 'TENANT';
    methodType?: CatoMethodType;
    tenantId?: string;
    enabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<CatoMethodDefinition[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options?.scope) {
      conditions.push(`scope = $${paramIndex++}`);
      params.push(options.scope);
    }

    if (options?.methodType) {
      conditions.push(`method_type = $${paramIndex++}`);
      params.push(options.methodType);
    }

    if (options?.tenantId) {
      conditions.push(`(scope = 'SYSTEM' OR tenant_id = $${paramIndex++})`);
      params.push(options.tenantId);
    }

    if (options?.enabled !== undefined) {
      conditions.push(`enabled = $${paramIndex++}`);
      params.push(options.enabled);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const result = await this.pool.query(
      `SELECT * FROM cato_method_definitions
      ${whereClause}
      ORDER BY method_type, name ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return result.rows.map(row => this.mapRowToMethod(row));
  }

  async createMethod(
    input: CreateMethodDefinitionInput,
    tenantId?: string
  ): Promise<CatoMethodDefinition> {
    const scope = tenantId ? 'TENANT' : 'SYSTEM';

    const result = await this.pool.query(
      `INSERT INTO cato_method_definitions (
        method_id,
        name,
        description,
        method_type,
        version,
        capabilities,
        output_types,
        use_cases,
        requires_in_context,
        accepts_output_types,
        typical_predecessors,
        typical_successors,
        context_strategy,
        supported_models,
        default_model,
        system_prompt_template,
        user_prompt_template,
        prompt_variables,
        output_schema_ref,
        estimated_cost_cents,
        estimated_duration_ms,
        risk_category,
        parallelizable,
        idempotent,
        scope,
        tenant_id,
        enabled,
        min_tier
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
      RETURNING *`,
      [
        input.methodId,
        input.name,
        input.description,
        input.methodType,
        input.version,
        input.capabilities || [],
        input.outputTypes,
        input.useCases || [],
        input.requiresInContext || [],
        input.acceptsOutputTypes || [],
        input.typicalPredecessors || [],
        input.typicalSuccessors || [],
        JSON.stringify(input.contextStrategy),
        JSON.stringify(input.supportedModels),
        input.defaultModel,
        input.systemPromptTemplate,
        input.userPromptTemplate || null,
        JSON.stringify(input.promptVariables || []),
        input.outputSchemaRef || null,
        input.estimatedCostCents || 0,
        input.estimatedDurationMs || 1000,
        input.riskCategory || CatoRiskLevel.LOW,
        input.parallelizable || false,
        input.idempotent || false,
        scope,
        tenantId || null,
        true,
        'FREE',
      ]
    );

    const method = this.mapRowToMethod(result.rows[0]);
    this.methodCache.set(input.methodId, method);
    return method;
  }

  async updateMethod(
    methodId: string,
    updates: Partial<CreateMethodDefinitionInput>
  ): Promise<CatoMethodDefinition> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIndex = 1;

    const fieldMappings: Record<string, { column: string; serialize?: boolean }> = {
      name: { column: 'name' },
      description: { column: 'description' },
      methodType: { column: 'method_type' },
      version: { column: 'version' },
      capabilities: { column: 'capabilities' },
      outputTypes: { column: 'output_types' },
      useCases: { column: 'use_cases' },
      requiresInContext: { column: 'requires_in_context' },
      acceptsOutputTypes: { column: 'accepts_output_types' },
      typicalPredecessors: { column: 'typical_predecessors' },
      typicalSuccessors: { column: 'typical_successors' },
      contextStrategy: { column: 'context_strategy', serialize: true },
      supportedModels: { column: 'supported_models', serialize: true },
      defaultModel: { column: 'default_model' },
      systemPromptTemplate: { column: 'system_prompt_template' },
      userPromptTemplate: { column: 'user_prompt_template' },
      promptVariables: { column: 'prompt_variables', serialize: true },
      outputSchemaRef: { column: 'output_schema_ref' },
      estimatedCostCents: { column: 'estimated_cost_cents' },
      estimatedDurationMs: { column: 'estimated_duration_ms' },
      riskCategory: { column: 'risk_category' },
      parallelizable: { column: 'parallelizable' },
      idempotent: { column: 'idempotent' },
    };

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && fieldMappings[key]) {
        const mapping = fieldMappings[key];
        setClauses.push(`${mapping.column} = $${paramIndex++}`);
        params.push(mapping.serialize ? JSON.stringify(value) : value);
      }
    }

    params.push(methodId);

    const result = await this.pool.query(
      `UPDATE cato_method_definitions
      SET ${setClauses.join(', ')}
      WHERE method_id = $${paramIndex}
      RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error(`Method not found: ${methodId}`);
    }

    const method = this.mapRowToMethod(result.rows[0]);
    this.methodCache.set(methodId, method);
    return method;
  }

  async deleteMethod(methodId: string): Promise<void> {
    // Check if method is system-scoped
    const method = await this.getMethod(methodId);
    if (method?.scope === 'SYSTEM') {
      throw new Error(`Cannot delete system method: ${methodId}`);
    }

    const result = await this.pool.query(
      `DELETE FROM cato_method_definitions WHERE method_id = $1`,
      [methodId]
    );

    if (result.rowCount === 0) {
      throw new Error(`Method not found: ${methodId}`);
    }

    this.methodCache.delete(methodId);
  }

  async getMethodChain(startMethodId: string): Promise<CatoMethodDefinition[]> {
    const chain: CatoMethodDefinition[] = [];
    const visited = new Set<string>();

    const buildChain = async (methodId: string): Promise<void> => {
      if (visited.has(methodId)) return;
      visited.add(methodId);

      const method = await this.getMethod(methodId);
      if (!method) return;

      chain.push(method);

      for (const successorId of method.typicalSuccessors) {
        await buildChain(successorId);
      }
    };

    await buildChain(startMethodId);
    return chain;
  }

  async findCompatibleMethods(outputType: CatoOutputType): Promise<CatoMethodDefinition[]> {
    const result = await this.pool.query(
      `SELECT * FROM cato_method_definitions
      WHERE $1 = ANY(accepts_output_types)
      AND enabled = true
      ORDER BY method_type, name ASC`,
      [outputType]
    );

    return result.rows.map(row => this.mapRowToMethod(row));
  }

  async findMethodsByCapability(capability: string): Promise<CatoMethodDefinition[]> {
    const result = await this.pool.query(
      `SELECT * FROM cato_method_definitions
      WHERE $1 = ANY(capabilities)
      AND enabled = true
      ORDER BY method_type, name ASC`,
      [capability]
    );

    return result.rows.map(row => this.mapRowToMethod(row));
  }

  async getMethodsByType(methodType: CatoMethodType): Promise<CatoMethodDefinition[]> {
    return this.listMethods({ methodType, enabled: true });
  }

  async setMethodEnabled(methodId: string, enabled: boolean): Promise<void> {
    await this.pool.query(
      `UPDATE cato_method_definitions SET enabled = $1, updated_at = NOW() WHERE method_id = $2`,
      [enabled, methodId]
    );

    const cached = this.methodCache.get(methodId);
    if (cached) {
      cached.enabled = enabled;
    }
  }

  async renderPrompt(
    methodId: string,
    variables: Record<string, unknown>
  ): Promise<{ systemPrompt: string; userPrompt?: string }> {
    const method = await this.getMethod(methodId);
    if (!method) {
      throw new Error(`Method not found: ${methodId}`);
    }

    const renderTemplate = (template: string, vars: Record<string, unknown>): string => {
      let rendered = template;
      for (const [key, value] of Object.entries(vars)) {
        const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
        rendered = rendered.replace(placeholder, String(value));
      }
      return rendered;
    };

    const systemPrompt = renderTemplate(method.systemPromptTemplate, variables);
    const userPrompt = method.userPromptTemplate
      ? renderTemplate(method.userPromptTemplate, variables)
      : undefined;

    return { systemPrompt, userPrompt };
  }

  clearCache(): void {
    this.methodCache.clear();
  }

  private mapRowToMethod(row: Record<string, unknown>): CatoMethodDefinition {
    return {
      methodId: row.method_id as string,
      name: row.name as string,
      description: row.description as string,
      methodType: row.method_type as CatoMethodType,
      version: row.version as string,
      capabilities: row.capabilities as string[],
      outputTypes: row.output_types as CatoOutputType[],
      useCases: row.use_cases as string[],
      requiresInContext: row.requires_in_context as CatoOutputType[],
      acceptsOutputTypes: row.accepts_output_types as CatoOutputType[],
      typicalPredecessors: row.typical_predecessors as string[],
      typicalSuccessors: row.typical_successors as string[],
      contextStrategy: row.context_strategy as CatoContextStrategyConfig,
      supportedModels: row.supported_models as CatoModelConfig[],
      defaultModel: row.default_model as string,
      systemPromptTemplate: row.system_prompt_template as string,
      userPromptTemplate: row.user_prompt_template as string | undefined,
      promptVariables: row.prompt_variables as CatoPromptVariable[],
      outputSchemaRef: row.output_schema_ref as string | undefined,
      estimatedCostCents: row.estimated_cost_cents as number,
      estimatedDurationMs: row.estimated_duration_ms as number,
      riskCategory: row.risk_category as CatoRiskLevel,
      parallelizable: row.parallelizable as boolean,
      idempotent: row.idempotent as boolean,
      scope: row.scope as 'SYSTEM' | 'TENANT',
      tenantId: row.tenant_id as string | undefined,
      enabled: row.enabled as boolean,
      minTier: row.min_tier as string,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

export const createCatoMethodRegistryService = (pool: Pool): CatoMethodRegistryService => {
  return new CatoMethodRegistryService(pool);
};
