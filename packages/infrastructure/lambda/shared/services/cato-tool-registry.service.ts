/**
 * Cato Tool Registry Service
 * 
 * Manages tool definitions for MCP and Lambda-based execution.
 * Tools can be invoked by executor methods to perform actions.
 */

import { Pool } from 'pg';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  CatoToolDefinition,
  CreateToolDefinitionInput,
  CatoRiskLevel,
  CatoCompensationType,
  CatoRateLimit,
} from '@radiant/shared';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export class CatoToolRegistryService {
  private pool: Pool;
  private toolCache: Map<string, CatoToolDefinition> = new Map();
  private inputValidators: Map<string, ReturnType<typeof ajv.compile>> = new Map();

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getTool(toolId: string): Promise<CatoToolDefinition | null> {
    const cached = this.toolCache.get(toolId);
    if (cached) {
      return cached;
    }

    const result = await this.pool.query(
      `SELECT * FROM cato_tool_definitions WHERE tool_id = $1`,
      [toolId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const tool = this.mapRowToTool(result.rows[0]);
    this.toolCache.set(toolId, tool);
    
    // Cache the input validator
    try {
      const validator = ajv.compile(tool.inputSchema);
      this.inputValidators.set(toolId, validator);
    } catch {
      // Schema may not be valid JSON Schema, that's okay
    }

    return tool;
  }

  async listTools(options?: {
    scope?: 'SYSTEM' | 'TENANT';
    category?: string;
    riskCategory?: CatoRiskLevel;
    tenantId?: string;
    enabled?: boolean;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<CatoToolDefinition[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options?.scope) {
      conditions.push(`scope = $${paramIndex++}`);
      params.push(options.scope);
    }

    if (options?.category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(options.category);
    }

    if (options?.riskCategory) {
      conditions.push(`risk_category = $${paramIndex++}`);
      params.push(options.riskCategory);
    }

    if (options?.tenantId) {
      conditions.push(`(scope = 'SYSTEM' OR tenant_id = $${paramIndex++})`);
      params.push(options.tenantId);
    }

    if (options?.enabled !== undefined) {
      conditions.push(`enabled = $${paramIndex++}`);
      params.push(options.enabled);
    }

    if (options?.tags && options.tags.length > 0) {
      conditions.push(`tags && $${paramIndex++}`);
      params.push(options.tags);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const result = await this.pool.query(
      `SELECT * FROM cato_tool_definitions
      ${whereClause}
      ORDER BY category NULLS LAST, tool_name ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return result.rows.map(row => this.mapRowToTool(row));
  }

  async createTool(
    input: CreateToolDefinitionInput,
    tenantId?: string
  ): Promise<CatoToolDefinition> {
    const scope = tenantId ? 'TENANT' : 'SYSTEM';

    const result = await this.pool.query(
      `INSERT INTO cato_tool_definitions (
        tool_id,
        tool_name,
        description,
        mcp_server,
        input_schema,
        output_schema,
        risk_category,
        supports_dry_run,
        is_reversible,
        compensation_type,
        compensation_tool,
        estimated_cost_cents,
        rate_limit,
        required_permissions,
        category,
        tags,
        scope,
        tenant_id,
        enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        input.toolId,
        input.toolName,
        input.description,
        input.mcpServer,
        JSON.stringify(input.inputSchema),
        JSON.stringify(input.outputSchema),
        input.riskCategory || CatoRiskLevel.MEDIUM,
        input.supportsDryRun || false,
        input.isReversible || false,
        input.compensationType || CatoCompensationType.NONE,
        input.compensationTool || null,
        input.estimatedCostCents || 0,
        input.rateLimit ? JSON.stringify(input.rateLimit) : null,
        input.requiredPermissions || [],
        input.category || null,
        input.tags || [],
        scope,
        tenantId || null,
        true,
      ]
    );

    const tool = this.mapRowToTool(result.rows[0]);
    this.toolCache.set(input.toolId, tool);

    // Cache the input validator
    try {
      const validator = ajv.compile(tool.inputSchema);
      this.inputValidators.set(input.toolId, validator);
    } catch {
      // Schema may not be valid JSON Schema
    }

    return tool;
  }

  async updateTool(
    toolId: string,
    updates: Partial<CreateToolDefinitionInput>
  ): Promise<CatoToolDefinition> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIndex = 1;

    const fieldMappings: Record<string, { column: string; serialize?: boolean }> = {
      toolName: { column: 'tool_name' },
      description: { column: 'description' },
      mcpServer: { column: 'mcp_server' },
      inputSchema: { column: 'input_schema', serialize: true },
      outputSchema: { column: 'output_schema', serialize: true },
      riskCategory: { column: 'risk_category' },
      supportsDryRun: { column: 'supports_dry_run' },
      isReversible: { column: 'is_reversible' },
      compensationType: { column: 'compensation_type' },
      compensationTool: { column: 'compensation_tool' },
      estimatedCostCents: { column: 'estimated_cost_cents' },
      rateLimit: { column: 'rate_limit', serialize: true },
      requiredPermissions: { column: 'required_permissions' },
      category: { column: 'category' },
      tags: { column: 'tags' },
    };

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && fieldMappings[key]) {
        const mapping = fieldMappings[key];
        setClauses.push(`${mapping.column} = $${paramIndex++}`);
        params.push(mapping.serialize ? JSON.stringify(value) : value);
      }
    }

    params.push(toolId);

    const result = await this.pool.query(
      `UPDATE cato_tool_definitions
      SET ${setClauses.join(', ')}
      WHERE tool_id = $${paramIndex}
      RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error(`Tool not found: ${toolId}`);
    }

    const tool = this.mapRowToTool(result.rows[0]);
    this.toolCache.set(toolId, tool);

    // Update input validator if schema changed
    if (updates.inputSchema) {
      try {
        const validator = ajv.compile(tool.inputSchema);
        this.inputValidators.set(toolId, validator);
      } catch {
        this.inputValidators.delete(toolId);
      }
    }

    return tool;
  }

  async deleteTool(toolId: string): Promise<void> {
    // Check if tool is system-scoped
    const tool = await this.getTool(toolId);
    if (tool?.scope === 'SYSTEM') {
      throw new Error(`Cannot delete system tool: ${toolId}`);
    }

    const result = await this.pool.query(
      `DELETE FROM cato_tool_definitions WHERE tool_id = $1`,
      [toolId]
    );

    if (result.rowCount === 0) {
      throw new Error(`Tool not found: ${toolId}`);
    }

    this.toolCache.delete(toolId);
    this.inputValidators.delete(toolId);
  }

  async getToolsByCapability(capability: string): Promise<CatoToolDefinition[]> {
    // Search in tags and description for capability
    const result = await this.pool.query(
      `SELECT * FROM cato_tool_definitions
      WHERE enabled = true
      AND ($1 = ANY(tags) OR description ILIKE $2)
      ORDER BY category NULLS LAST, tool_name ASC`,
      [capability, `%${capability}%`]
    );

    return result.rows.map(row => this.mapRowToTool(row));
  }

  async validateToolInput(
    toolId: string,
    input: unknown
  ): Promise<{ valid: boolean; errors?: string[] }> {
    let validator = this.inputValidators.get(toolId);

    if (!validator) {
      const tool = await this.getTool(toolId);
      if (!tool) {
        return { valid: false, errors: [`Tool not found: ${toolId}`] };
      }

      try {
        validator = ajv.compile(tool.inputSchema);
        this.inputValidators.set(toolId, validator);
      } catch (error) {
        return { valid: false, errors: [`Invalid input schema for tool: ${toolId}`] };
      }
    }

    const valid = validator(input);

    if (valid) {
      return { valid: true };
    }

    const errors = validator.errors?.map(
      (err: { instancePath?: string; message?: string }) => `${err.instancePath || '/'}: ${err.message}`
    ) || ['Unknown validation error'];

    return { valid: false, errors };
  }

  async getToolsByRiskLevel(maxRiskLevel: CatoRiskLevel): Promise<CatoToolDefinition[]> {
    const riskOrder: CatoRiskLevel[] = [
      CatoRiskLevel.NONE,
      CatoRiskLevel.LOW,
      CatoRiskLevel.MEDIUM,
      CatoRiskLevel.HIGH,
      CatoRiskLevel.CRITICAL,
    ];

    const maxIndex = riskOrder.indexOf(maxRiskLevel);
    const allowedLevels = riskOrder.slice(0, maxIndex + 1);

    const result = await this.pool.query(
      `SELECT * FROM cato_tool_definitions
      WHERE enabled = true
      AND risk_category = ANY($1::cato_risk_level[])
      ORDER BY risk_category, tool_name ASC`,
      [allowedLevels]
    );

    return result.rows.map(row => this.mapRowToTool(row));
  }

  async getReversibleTools(): Promise<CatoToolDefinition[]> {
    const result = await this.pool.query(
      `SELECT * FROM cato_tool_definitions
      WHERE enabled = true AND is_reversible = true
      ORDER BY category NULLS LAST, tool_name ASC`
    );

    return result.rows.map(row => this.mapRowToTool(row));
  }

  async getToolCategories(): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT category FROM cato_tool_definitions
      WHERE category IS NOT NULL AND enabled = true
      ORDER BY category ASC`
    );

    return result.rows.map(row => row.category);
  }

  async setToolEnabled(toolId: string, enabled: boolean): Promise<void> {
    await this.pool.query(
      `UPDATE cato_tool_definitions SET enabled = $1, updated_at = NOW() WHERE tool_id = $2`,
      [enabled, toolId]
    );

    const cached = this.toolCache.get(toolId);
    if (cached) {
      cached.enabled = enabled;
    }
  }

  isMcpTool(tool: CatoToolDefinition): boolean {
    return !tool.mcpServer.startsWith('lambda://');
  }

  isLambdaTool(tool: CatoToolDefinition): boolean {
    return tool.mcpServer.startsWith('lambda://');
  }

  getLambdaFunctionName(tool: CatoToolDefinition): string | null {
    if (!this.isLambdaTool(tool)) return null;
    return tool.mcpServer.replace('lambda://', '');
  }

  clearCache(): void {
    this.toolCache.clear();
    this.inputValidators.clear();
  }

  private mapRowToTool(row: Record<string, unknown>): CatoToolDefinition {
    return {
      toolId: row.tool_id as string,
      toolName: row.tool_name as string,
      description: row.description as string,
      mcpServer: row.mcp_server as string,
      inputSchema: row.input_schema as Record<string, unknown>,
      outputSchema: row.output_schema as Record<string, unknown>,
      riskCategory: row.risk_category as CatoRiskLevel,
      supportsDryRun: row.supports_dry_run as boolean,
      isReversible: row.is_reversible as boolean,
      compensationType: row.compensation_type as CatoCompensationType,
      compensationTool: row.compensation_tool as string | undefined,
      estimatedCostCents: row.estimated_cost_cents as number,
      rateLimit: row.rate_limit as CatoRateLimit | undefined,
      requiredPermissions: row.required_permissions as string[],
      category: row.category as string | undefined,
      tags: row.tags as string[],
      scope: row.scope as 'SYSTEM' | 'TENANT',
      tenantId: row.tenant_id as string | undefined,
      enabled: row.enabled as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

export const createCatoToolRegistryService = (pool: Pool): CatoToolRegistryService => {
  return new CatoToolRegistryService(pool);
};
