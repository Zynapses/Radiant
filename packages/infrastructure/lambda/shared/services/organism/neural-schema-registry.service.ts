// RADIANT Autonomous Organism - Neural Schema Registry
// Tool schema management with neural embeddings for intelligent tool discovery
// Version: 1.0.0

import { randomUUID } from 'crypto';
import { executeStatement, stringParam, longParam, doubleParam } from '../../db/client';
import { enhancedLogger as logger } from '../../logging/enhanced-logger';
import { embeddingService } from '../embedding.service';
// Types defined locally to avoid import issues
type ToolCategory = 
  | 'data_retrieval' 
  | 'data_manipulation' 
  | 'communication'
  | 'file_operations' 
  | 'api_integration' 
  | 'computation'
  | 'search' 
  | 'generation' 
  | 'analysis' 
  | 'automation';

type ToolSensitivity = 'public' | 'internal' | 'confidential' | 'restricted';

export interface ToolSchema {
  toolId: string;
  serverId: string;
  name: string;
  description: string;
  inputSchemaJSON: Record<string, unknown>;
  outputSchemaJSON: Record<string, unknown>;
  descriptionEmbedding?: Float32Array;
  structureEmbedding?: Float32Array;
  parameterEmbeddings?: Map<string, Float32Array>;
  exampleEmbeddings?: Float32Array[];
  neuralSignature?: Float32Array;
  category: ToolCategory;
  tags: string[];
  isStructuredOutput: boolean;
  successRate: number;
  avgExecutionMs: number;
  lastUsed?: Date;
  usageCount: number;
  primaryDomain: string;
  secondaryDomains: string[];
  proficiencyByModel: Record<string, number>;
  requiredPermissions: string[];
  sensitivityLevel: ToolSensitivity;
  estimatedCostPerCall: number;
  actualAvgCost?: number;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ToolFilters {
  categories?: ToolCategory[];
  domains?: string[];
  maxCost?: number;
  minSuccessRate?: number;
  tags?: string[];
}

interface ToolExecution {
  toolId: string;
  success: boolean;
  latencyMs: number;
  cost?: number;
  error?: string;
}

// ============================================================================
// Vector Index for Fast Similarity Search
// ============================================================================

class VectorIndex {
  private vectors: Map<string, Float32Array> = new Map();
  private dimension: number;

  constructor(dimension: number = 1536) {
    this.dimension = dimension;
  }

  add(id: string, vector: Float32Array): void {
    if (vector.length !== this.dimension) {
      logger.warn(`Vector dimension mismatch: expected ${this.dimension}, got ${vector.length}`);
    }
    this.vectors.set(id, vector);
  }

  remove(id: string): void {
    this.vectors.delete(id);
  }

  search(query: Float32Array, k: number): Array<{ id: string; score: number }> {
    const results: Array<{ id: string; score: number }> = [];

    for (const [id, vector] of Array.from(this.vectors)) {
      const score = this.cosineSimilarity(query, vector);
      results.push({ id, score });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  size(): number {
    return this.vectors.size;
  }
}

// ============================================================================
// Neural Schema Registry Service
// ============================================================================

class NeuralSchemaRegistryService {
  private schemas: Map<string, ToolSchema> = new Map();
  private vectorIndex: VectorIndex;
  private readonly EMBEDDING_DIMENSION = 1536;

  constructor() {
    this.vectorIndex = new VectorIndex(this.EMBEDDING_DIMENSION);
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  async initialize(): Promise<void> {
    logger.info('Initializing Neural Schema Registry');
    await this.loadSchemasFromDatabase();
    logger.info(`Neural Schema Registry initialized with ${this.schemas.size} schemas`);
  }

  // ==========================================================================
  // REGISTRATION
  // ==========================================================================

  async registerTool(schema: Omit<ToolSchema, 'toolId' | 'neuralSignature' | 'createdAt' | 'updatedAt'>): Promise<ToolSchema> {
    const toolId = randomUUID();
    const now = new Date();

    // Generate neural embeddings
    const enriched = await this.enrichWithNeuralEmbeddings({
      ...schema,
      toolId,
      createdAt: now,
      updatedAt: now,
    });

    // Store in memory
    this.schemas.set(toolId, enriched);

    // Add to vector index
    if (enriched.neuralSignature) {
      this.vectorIndex.add(toolId, enriched.neuralSignature);
    }

    // Persist to database
    await this.saveSchemaToDatabase(enriched);

    logger.info(`Registered tool schema: ${enriched.name} (${toolId})`);
    return enriched;
  }

  async registerToolsFromMCPServer(serverId: string, tools: Array<{
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  }>): Promise<ToolSchema[]> {
    const registered: ToolSchema[] = [];

    for (const tool of tools) {
      const schema: Omit<ToolSchema, 'toolId' | 'neuralSignature' | 'createdAt' | 'updatedAt'> = {
        serverId,
        name: tool.name,
        description: tool.description || '',
        inputSchemaJSON: tool.inputSchema || {},
        outputSchemaJSON: {},
        category: this.inferCategory(tool.name, tool.description),
        tags: this.inferTags(tool.name, tool.description),
        isStructuredOutput: false,
        successRate: 1,
        avgExecutionMs: 0,
        usageCount: 0,
        primaryDomain: this.inferPrimaryDomain(tool.name, tool.description),
        secondaryDomains: [],
        proficiencyByModel: {},
        requiredPermissions: [],
        sensitivityLevel: 'public',
        estimatedCostPerCall: 0,
        version: '1.0.0',
      };

      const enriched = await this.registerTool(schema);
      registered.push(enriched);
    }

    return registered;
  }

  // ==========================================================================
  // NEURAL ENRICHMENT
  // ==========================================================================

  private async enrichWithNeuralEmbeddings(
    schema: Omit<ToolSchema, 'neuralSignature'> & { toolId: string; createdAt: Date; updatedAt: Date }
  ): Promise<ToolSchema> {
    try {
      // 1. Description embedding
      const descriptionEmbedding = await this.generateEmbedding(schema.description);

      // 2. Structure embedding (from JSON schema structure)
      const structureText = this.schemaToStructureText(schema.inputSchemaJSON);
      const structureEmbedding = await this.generateEmbedding(structureText);

      // 3. Parameter embeddings
      const parameterEmbeddings = new Map<string, Float32Array>();
      const properties = (schema.inputSchemaJSON as any).properties || {};

      for (const [paramName, paramSchema] of Object.entries(properties)) {
        const paramText = `${paramName}: ${(paramSchema as any).description || ''} (${(paramSchema as any).type || 'unknown'})`;
        const embedding = await this.generateEmbedding(paramText);
        parameterEmbeddings.set(paramName, embedding);
      }

      // 4. Combined neural signature
      const neuralSignature = this.generateNeuralSignature(
        descriptionEmbedding,
        structureEmbedding
      );

      return {
        ...schema,
        descriptionEmbedding,
        structureEmbedding,
        parameterEmbeddings,
        exampleEmbeddings: [],
        neuralSignature,
      };
    } catch (error) {
      logger.warn(`Failed to enrich schema ${schema.name} with neural embeddings:`, error);
      return {
        ...schema,
        neuralSignature: new Float32Array(this.EMBEDDING_DIMENSION),
      };
    }
  }

  private async generateEmbedding(text: string): Promise<Float32Array> {
    if (!text || text.trim().length === 0) {
      return new Float32Array(this.EMBEDDING_DIMENSION);
    }

    try {
      const result = await embeddingService.generateEmbedding(text);
      return new Float32Array(result.embedding);
    } catch (error) {
      logger.warn('Failed to generate embedding:', error);
      return new Float32Array(this.EMBEDDING_DIMENSION);
    }
  }

  private schemaToStructureText(jsonSchema: Record<string, unknown>): string {
    const parts: string[] = [];
    const properties = (jsonSchema as any).properties || {};
    const required = (jsonSchema as any).required || [];

    for (const [name, schema] of Object.entries(properties)) {
      const s = schema as any;
      const isRequired = required.includes(name);
      parts.push(`${name}${isRequired ? '*' : ''}: ${s.type || 'unknown'}`);
    }

    return `Input structure: { ${parts.join(', ')} }`;
  }

  private generateNeuralSignature(
    descriptionEmbedding: Float32Array,
    structureEmbedding: Float32Array
  ): Float32Array {
    // Weighted average of description and structure embeddings
    const signature = new Float32Array(this.EMBEDDING_DIMENSION);
    const descWeight = 0.7;
    const structWeight = 0.3;

    for (let i = 0; i < this.EMBEDDING_DIMENSION; i++) {
      signature[i] = descWeight * (descriptionEmbedding[i] || 0) + 
                     structWeight * (structureEmbedding[i] || 0);
    }

    // Normalize
    let norm = 0;
    for (let i = 0; i < signature.length; i++) {
      norm += signature[i] * signature[i];
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < signature.length; i++) {
        signature[i] /= norm;
      }
    }

    return signature;
  }

  // ==========================================================================
  // NEURAL RETRIEVAL
  // ==========================================================================

  async findToolsByIntent(
    intentEmbedding: Float32Array,
    maxResults: number = 10,
    filters?: ToolFilters
  ): Promise<ToolSchema[]> {
    // Use vector index for fast similarity search
    const candidates = this.vectorIndex.search(intentEmbedding, maxResults * 2);

    // Apply filters and get full schemas
    const results: ToolSchema[] = [];

    for (const { id } of candidates) {
      const schema = this.schemas.get(id);
      if (!schema) continue;

      if (filters && !this.matchesFilters(schema, filters)) continue;

      results.push(schema);

      if (results.length >= maxResults) break;
    }

    return results;
  }

  async findToolsByQuery(
    query: string,
    maxResults: number = 10,
    filters?: ToolFilters
  ): Promise<ToolSchema[]> {
    // Generate embedding for the query
    const queryEmbedding = await this.generateEmbedding(query);

    // Get neural matches
    const neuralMatches = await this.findToolsByIntent(queryEmbedding, maxResults * 2, filters);

    // Also do text search
    const textMatches = this.textSearch(query, filters);

    // Combine and deduplicate
    const combined = new Map<string, ToolSchema>();

    for (const schema of neuralMatches) {
      combined.set(schema.toolId, schema);
    }

    for (const schema of textMatches) {
      if (!combined.has(schema.toolId)) {
        combined.set(schema.toolId, schema);
      }
    }

    return Array.from(combined.values()).slice(0, maxResults);
  }

  private textSearch(query: string, filters?: ToolFilters): ToolSchema[] {
    const queryLower = query.toLowerCase();
    const matches: Array<{ schema: ToolSchema; score: number }> = [];

    for (const schema of Array.from(this.schemas.values())) {
      if (filters && !this.matchesFilters(schema, filters)) continue;

      let score = 0;

      if (schema.name.toLowerCase().includes(queryLower)) score += 2;
      if (schema.description.toLowerCase().includes(queryLower)) score += 1;
      for (const tag of schema.tags) {
        if (tag.toLowerCase().includes(queryLower)) score += 0.5;
      }

      if (score > 0) {
        matches.push({ schema, score });
      }
    }

    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(m => m.schema);
  }

  private matchesFilters(schema: ToolSchema, filters: ToolFilters): boolean {
    if (filters.categories && !filters.categories.includes(schema.category)) {
      return false;
    }
    if (filters.domains && !filters.domains.includes(schema.primaryDomain)) {
      return false;
    }
    if (filters.maxCost !== undefined && schema.estimatedCostPerCall > filters.maxCost) {
      return false;
    }
    if (filters.minSuccessRate !== undefined && schema.successRate < filters.minSuccessRate) {
      return false;
    }
    if (filters.tags) {
      const hasTag = filters.tags.some(tag => schema.tags.includes(tag));
      if (!hasTag) return false;
    }
    return true;
  }

  // ==========================================================================
  // METRICS UPDATE
  // ==========================================================================

  async updateToolMetrics(toolId: string, execution: ToolExecution): Promise<void> {
    const schema = this.schemas.get(toolId);
    if (!schema) return;

    // Update usage count
    schema.usageCount++;
    schema.lastUsed = new Date();

    // Update success rate (exponential moving average)
    const alpha = 0.1;
    const successValue = execution.success ? 1 : 0;
    schema.successRate = alpha * successValue + (1 - alpha) * schema.successRate;

    // Update latency
    schema.avgExecutionMs = alpha * execution.latencyMs + (1 - alpha) * schema.avgExecutionMs;

    // Update actual cost
    if (execution.cost) {
      schema.actualAvgCost = schema.actualAvgCost
        ? alpha * execution.cost + (1 - alpha) * schema.actualAvgCost
        : execution.cost;
    }

    schema.updatedAt = new Date();
    this.schemas.set(toolId, schema);
  }

  // ==========================================================================
  // TYPE GENERATION
  // ==========================================================================

  generateTypeScript(toolId: string): string {
    const schema = this.schemas.get(toolId);
    if (!schema) {
      throw new Error(`Tool ${toolId} not found`);
    }

    const inputType = this.jsonSchemaToTypeScript(schema.inputSchemaJSON, `${this.pascalCase(schema.name)}Input`);
    const outputType = this.jsonSchemaToTypeScript(schema.outputSchemaJSON, `${this.pascalCase(schema.name)}Output`);

    return `
// Generated types for tool: ${schema.name}
// Tool ID: ${schema.toolId}
// Description: ${schema.description}

${inputType}

${outputType}

export interface ${this.pascalCase(schema.name)}Tool {
  call(input: ${this.pascalCase(schema.name)}Input): Promise<${this.pascalCase(schema.name)}Output>;
}
`.trim();
  }

  private jsonSchemaToTypeScript(jsonSchema: Record<string, unknown>, name: string): string {
    const properties = (jsonSchema as any).properties || {};
    const required = new Set((jsonSchema as any).required || []);

    const fields = Object.entries(properties).map(([key, value]) => {
      const v = value as any;
      const type = this.jsonTypeToTypeScript(v.type, v);
      const optional = required.has(key) ? '' : '?';
      return `  ${key}${optional}: ${type};`;
    });

    if (fields.length === 0) {
      return `export type ${name} = Record<string, unknown>;`;
    }

    return `export interface ${name} {\n${fields.join('\n')}\n}`;
  }

  private jsonTypeToTypeScript(type: string, schema: any): string {
    switch (type) {
      case 'string': return 'string';
      case 'number': return 'number';
      case 'integer': return 'number';
      case 'boolean': return 'boolean';
      case 'array': return `Array<${this.jsonTypeToTypeScript(schema.items?.type || 'unknown', schema.items || {})}>`;
      case 'object': return 'Record<string, unknown>';
      default: return 'unknown';
    }
  }

  private pascalCase(str: string): string {
    return str
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  // ==========================================================================
  // INFERENCE HELPERS
  // ==========================================================================

  private inferCategory(name: string, description?: string): ToolCategory {
    const text = `${name} ${description || ''}`.toLowerCase();

    if (text.includes('search') || text.includes('find') || text.includes('query')) return 'search';
    if (text.includes('file') || text.includes('read') || text.includes('write')) return 'file_operations';
    if (text.includes('email') || text.includes('message') || text.includes('send')) return 'communication';
    if (text.includes('api') || text.includes('fetch') || text.includes('request')) return 'api_integration';
    if (text.includes('calculate') || text.includes('compute') || text.includes('math')) return 'computation';
    if (text.includes('generate') || text.includes('create') || text.includes('produce')) return 'generation';
    if (text.includes('analyze') || text.includes('extract') || text.includes('parse')) return 'analysis';
    if (text.includes('automate') || text.includes('schedule') || text.includes('trigger')) return 'automation';

    return 'data_retrieval';
  }

  private inferTags(name: string, description?: string): string[] {
    const text = `${name} ${description || ''}`.toLowerCase();
    const tags: string[] = [];

    const keywords = ['github', 'slack', 'google', 'aws', 'azure', 'database', 'api', 'file', 'email', 'calendar', 'jira', 'notion'];
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        tags.push(keyword);
      }
    }

    return tags;
  }

  private inferPrimaryDomain(name: string, description?: string): string {
    const text = `${name} ${description || ''}`.toLowerCase();

    if (text.includes('github') || text.includes('git') || text.includes('code')) return 'software_development';
    if (text.includes('slack') || text.includes('teams') || text.includes('discord')) return 'communication';
    if (text.includes('google') || text.includes('docs') || text.includes('sheets')) return 'productivity';
    if (text.includes('database') || text.includes('sql') || text.includes('query')) return 'data_management';
    if (text.includes('file') || text.includes('directory') || text.includes('folder')) return 'file_management';
    if (text.includes('email') || text.includes('mail')) return 'email';
    if (text.includes('calendar') || text.includes('schedule')) return 'calendar';

    return 'general';
  }

  // ==========================================================================
  // DATABASE OPERATIONS
  // ==========================================================================

  private async loadSchemasFromDatabase(): Promise<void> {
    try {
      const result = await executeStatement({
        sql: `
          SELECT * FROM mcp_tool_schemas 
          WHERE is_active = true
          ORDER BY created_at DESC
        `,
        parameters: [],
      });

      for (const row of result.rows || []) {
        const schema = this.rowToSchema(row);
        this.schemas.set(schema.toolId, schema);

        if (schema.neuralSignature) {
          this.vectorIndex.add(schema.toolId, schema.neuralSignature);
        }
      }
    } catch (error) {
      logger.error('Failed to load tool schemas from database:', error);
    }
  }

  private async saveSchemaToDatabase(schema: ToolSchema): Promise<void> {
    try {
      await executeStatement({
        sql: `
          INSERT INTO mcp_tool_schemas (
            tool_id, server_id, name, description,
            input_schema_json, output_schema_json,
            description_embedding, structure_embedding, neural_signature,
            category, tags, is_structured_output,
            success_rate, avg_execution_ms, usage_count,
            primary_domain, secondary_domains, proficiency_by_model,
            required_permissions, sensitivity_level,
            estimated_cost_per_call, actual_avg_cost,
            version, is_active, created_at, updated_at
          ) VALUES (
            :toolId, :serverId, :name, :description,
            :inputSchemaJson, :outputSchemaJson,
            :descriptionEmbedding, :structureEmbedding, :neuralSignature,
            :category, :tags, :isStructuredOutput,
            :successRate, :avgExecutionMs, :usageCount,
            :primaryDomain, :secondaryDomains, :proficiencyByModel,
            :requiredPermissions, :sensitivityLevel,
            :estimatedCostPerCall, :actualAvgCost,
            :version, true, :createdAt, :updatedAt
          )
          ON CONFLICT (tool_id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            input_schema_json = EXCLUDED.input_schema_json,
            neural_signature = EXCLUDED.neural_signature,
            success_rate = EXCLUDED.success_rate,
            avg_execution_ms = EXCLUDED.avg_execution_ms,
            usage_count = EXCLUDED.usage_count,
            updated_at = EXCLUDED.updated_at
        `,
        parameters: [
          stringParam('toolId', schema.toolId),
          stringParam('serverId', schema.serverId),
          stringParam('name', schema.name),
          stringParam('description', schema.description),
          stringParam('inputSchemaJson', JSON.stringify(schema.inputSchemaJSON)),
          stringParam('outputSchemaJson', JSON.stringify(schema.outputSchemaJSON)),
          stringParam('descriptionEmbedding', schema.descriptionEmbedding ? this.float32ArrayToBase64(schema.descriptionEmbedding) : ''),
          stringParam('structureEmbedding', schema.structureEmbedding ? this.float32ArrayToBase64(schema.structureEmbedding) : ''),
          stringParam('neuralSignature', schema.neuralSignature ? this.float32ArrayToBase64(schema.neuralSignature) : ''),
          stringParam('category', schema.category),
          stringParam('tags', JSON.stringify(schema.tags)),
          stringParam('isStructuredOutput', schema.isStructuredOutput ? 'true' : 'false'),
          doubleParam('successRate', schema.successRate),
          doubleParam('avgExecutionMs', schema.avgExecutionMs),
          longParam('usageCount', schema.usageCount),
          stringParam('primaryDomain', schema.primaryDomain),
          stringParam('secondaryDomains', JSON.stringify(schema.secondaryDomains)),
          stringParam('proficiencyByModel', JSON.stringify(schema.proficiencyByModel)),
          stringParam('requiredPermissions', JSON.stringify(schema.requiredPermissions)),
          stringParam('sensitivityLevel', schema.sensitivityLevel),
          doubleParam('estimatedCostPerCall', schema.estimatedCostPerCall),
          doubleParam('actualAvgCost', schema.actualAvgCost || 0),
          stringParam('version', schema.version),
          stringParam('createdAt', schema.createdAt.toISOString()),
          stringParam('updatedAt', schema.updatedAt.toISOString()),
        ],
      });
    } catch (error) {
      logger.error(`Failed to save tool schema ${schema.toolId}:`, error);
      throw error;
    }
  }

  private rowToSchema(row: Record<string, unknown>): ToolSchema {
    const getString = (key: string): string => String(row[key] || '');
    const getNumber = (key: string): number => Number(row[key]) || 0;
    const getDate = (key: string): Date | undefined => row[key] ? new Date(String(row[key])) : undefined;
    const parseJSON = (key: string, fallback: unknown = {}): unknown => {
      try {
        const val = row[key];
        return typeof val === 'string' ? JSON.parse(val) : (val || fallback);
      } catch {
        return fallback;
      }
    };

    return {
      toolId: getString('tool_id'),
      serverId: getString('server_id'),
      name: getString('name'),
      description: getString('description'),
      inputSchemaJSON: parseJSON('input_schema_json', {}) as Record<string, unknown>,
      outputSchemaJSON: parseJSON('output_schema_json', {}) as Record<string, unknown>,
      descriptionEmbedding: getString('description_embedding') ? this.base64ToFloat32Array(getString('description_embedding')) : undefined,
      structureEmbedding: getString('structure_embedding') ? this.base64ToFloat32Array(getString('structure_embedding')) : undefined,
      neuralSignature: getString('neural_signature') ? this.base64ToFloat32Array(getString('neural_signature')) : undefined,
      category: (getString('category') || 'data_retrieval') as ToolCategory,
      tags: parseJSON('tags', []) as string[],
      isStructuredOutput: row['is_structured_output'] === true || getString('is_structured_output') === 'true',
      successRate: getNumber('success_rate') || 1,
      avgExecutionMs: getNumber('avg_execution_ms'),
      lastUsed: getDate('last_used'),
      usageCount: getNumber('usage_count'),
      primaryDomain: getString('primary_domain') || 'general',
      secondaryDomains: parseJSON('secondary_domains', []) as string[],
      proficiencyByModel: parseJSON('proficiency_by_model', {}) as Record<string, number>,
      requiredPermissions: parseJSON('required_permissions', []) as string[],
      sensitivityLevel: (getString('sensitivity_level') || 'public') as ToolSensitivity,
      estimatedCostPerCall: getNumber('estimated_cost_per_call'),
      actualAvgCost: getNumber('actual_avg_cost') || undefined,
      version: getString('version') || '1.0.0',
      createdAt: getDate('created_at') || new Date(),
      updatedAt: getDate('updated_at') || new Date(),
    };
  }

  private float32ArrayToBase64(arr: Float32Array): string {
    const buffer = Buffer.from(arr.buffer);
    return buffer.toString('base64');
  }

  private base64ToFloat32Array(base64: string): Float32Array {
    const buffer = Buffer.from(base64, 'base64');
    return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  }

  // ==========================================================================
  // GETTERS
  // ==========================================================================

  getSchema(toolId: string): ToolSchema | undefined {
    return this.schemas.get(toolId);
  }

  getSchemaByName(name: string): ToolSchema | undefined {
    for (const schema of Array.from(this.schemas.values())) {
      if (schema.name === name) {
        return schema;
      }
    }
    return undefined;
  }

  getAllSchemas(): ToolSchema[] {
    return Array.from(this.schemas.values());
  }

  getSchemasByServer(serverId: string): ToolSchema[] {
    return Array.from(this.schemas.values()).filter(s => s.serverId === serverId);
  }

  getSchemasByCategory(category: ToolCategory): ToolSchema[] {
    return Array.from(this.schemas.values()).filter(s => s.category === category);
  }

  getSchemasByDomain(domain: string): ToolSchema[] {
    return Array.from(this.schemas.values()).filter(
      s => s.primaryDomain === domain || s.secondaryDomains.includes(domain)
    );
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const neuralSchemaRegistry = new NeuralSchemaRegistryService();
export { NeuralSchemaRegistryService };
