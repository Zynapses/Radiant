// RADIANT v4.18.0 - Open Source Library Registry Service
// AI capability extensions through open-source tools with proficiency matching
// Libraries are NOT AI models - they extend AI capabilities for problem-solving
// Now with Vector RAG for semantic library selection

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// Proficiency scores for library matching (8 dimensions, 1-10 scale)
export interface ProficiencyScores {
  reasoning_depth: number;
  mathematical_quantitative: number;
  code_generation: number;
  creative_generative: number;
  research_synthesis: number;
  factual_recall_precision: number;
  multi_step_problem_solving: number;
  domain_terminology_handling: number;
}

// ============================================================================
// Types
// ============================================================================

export interface LibraryConfig {
  configId: string;
  tenantId: string;
  libraryAssistEnabled: boolean;
  autoSuggestLibraries: boolean;
  maxLibrariesPerRequest: number;
  autoUpdateEnabled: boolean;
  updateFrequency: 'hourly' | 'daily' | 'weekly' | 'manual';
  updateTimeUtc: string;
  lastUpdateAt: string | null;
  nextUpdateAt: string | null;
  minProficiencyMatch: number;
  proficiencyWeights: Partial<ProficiencyScores>;
  enabledCategories: string[];
  disabledLibraries: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Library {
  libraryId: string;
  name: string;
  category: string;
  license: string;
  licenseNote?: string;
  repo: string;
  description: string;
  beats: string[];
  stars: number;
  languages: string[];
  domains: string[];
  proficiencies: ProficiencyScores;
  version?: string;
  lastCheckedAt?: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  // Uncensored model support
  uncensored?: boolean;
  useCases?: string[];
}

export interface LibraryMatchResult {
  library: Library;
  matchScore: number;
  proficiencyMatch: number;
  domainMatch: number;
  matchedDimensions: {
    dimension: string;
    libraryScore: number;
    requiredScore: number;
    contribution: number;
  }[];
  reason: string;
}

export interface LibraryUsageStats {
  libraryId: string;
  totalInvocations: number;
  successfulInvocations: number;
  failedInvocations: number;
  avgExecutionTimeMs: number;
  successRate: number;
  invocationsByType: Record<string, number>;
  lastUsedAt: string | null;
}

export interface LibraryDashboard {
  config: LibraryConfig;
  stats: {
    totalLibraries: number;
    enabledLibraries: number;
    totalInvocations: number;
    successRate: number;
    lastUpdateAt: string | null;
  };
  topLibraries: LibraryUsageStats[];
  recentUsage: Array<{
    eventId: string;
    libraryId: string;
    libraryName: string;
    invocationType: string;
    success: boolean;
    executionTimeMs: number;
    createdAt: string;
  }>;
  categoryBreakdown: Array<{
    category: string;
    count: number;
    enabled: number;
  }>;
}

// ============================================================================
// Library Registry Service
// ============================================================================

class LibraryRegistryService {
  private configCache: Map<string, { config: LibraryConfig; cachedAt: number }> = new Map();
  private readonly CACHE_TTL_MS = 60000; // 1 minute
  private bedrock: BedrockRuntimeClient;
  private embeddingCache: Map<string, { embedding: number[]; cachedAt: number }> = new Map();
  private readonly EMBEDDING_CACHE_TTL_MS = 3600000; // 1 hour

  constructor() {
    this.bedrock = new BedrockRuntimeClient({});
  }

  // --------------------------------------------------------------------------
  // Vector Embedding for Semantic Search
  // --------------------------------------------------------------------------

  /**
   * Generate embedding for a prompt using Amazon Titan
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    const cacheKey = text.substring(0, 100); // Use first 100 chars as cache key
    const cached = this.embeddingCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.EMBEDDING_CACHE_TTL_MS) {
      return cached.embedding;
    }

    try {
      const response = await this.bedrock.send(new InvokeModelCommand({
        modelId: 'amazon.titan-embed-text-v1',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          inputText: text.substring(0, 8000), // Titan limit
        }),
      }));

      const result = JSON.parse(new TextDecoder().decode(response.body));
      const embedding = result.embedding as number[];
      
      this.embeddingCache.set(cacheKey, { embedding, cachedAt: Date.now() });
      return embedding;
    } catch (error) {
      logger.error('Failed to generate embedding', { error });
      return []; // Return empty on failure, fall back to proficiency matching
    }
  }

  /**
   * Find libraries using vector similarity search (Vector RAG)
   * This provides semantic matching beyond keyword/proficiency matching
   */
  async findLibrariesBySemanticSearch(
    tenantId: string,
    prompt: string,
    options: {
      maxResults?: number;
      minSimilarity?: number;
    } = {}
  ): Promise<LibraryMatchResult[]> {
    const config = await this.getConfig(tenantId);
    if (!config.libraryAssistEnabled) {
      return [];
    }

    const { maxResults = 5, minSimilarity = 0.5 } = options;

    try {
      // Generate embedding for the user's prompt
      const promptEmbedding = await this.generateEmbedding(prompt);
      if (promptEmbedding.length === 0) {
        logger.warn('Embedding generation failed, falling back to proficiency matching');
        return [];
      }

      // Query libraries with vector similarity
      const result = await executeStatement(
        `SELECT 
          l.*,
          1 - (l.description_embedding <=> $2::vector) as similarity
         FROM open_source_libraries l
         WHERE l.description_embedding IS NOT NULL
           AND l.library_id NOT IN (SELECT unnest($3::text[]))
         ORDER BY l.description_embedding <=> $2::vector
         LIMIT $4`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'embedding', value: { stringValue: `[${promptEmbedding.join(',')}]` } },
          { name: 'disabled', value: { stringValue: JSON.stringify(config.disabledLibraries) } },
          { name: 'limit', value: { longValue: maxResults * 2 } }, // Get extra for filtering
        ]
      );

      const libraries: LibraryMatchResult[] = [];
      for (const row of result.rows) {
        const rowData = row as Record<string, unknown>;
        const similarity = Number(rowData.similarity) || 0;
        
        if (similarity < minSimilarity) continue;

        const library = this.mapLibrary(rowData);
        libraries.push({
          library,
          matchScore: similarity,
          proficiencyMatch: similarity,
          domainMatch: similarity,
          matchedDimensions: [],
          reason: `Semantic match (${(similarity * 100).toFixed(0)}% similar to your request)`,
        });
      }

      logger.debug('Vector RAG library search completed', {
        promptLength: prompt.length,
        resultsFound: libraries.length,
      });

      return libraries.slice(0, maxResults);
    } catch (error) {
      logger.error('Vector RAG search failed', { error });
      return []; // Fall back to proficiency matching in caller
    }
  }

  /**
   * Update library embeddings (called during library sync)
   */
  async updateLibraryEmbedding(libraryId: string): Promise<void> {
    const library = await this.getLibrary(libraryId);
    if (!library) return;

    // Create rich text for embedding: name + description + category + domains
    const embeddingText = [
      library.name,
      library.description,
      `Category: ${library.category}`,
      `Domains: ${library.domains.join(', ')}`,
      library.beats.length > 0 ? `Beats: ${library.beats.join(', ')}` : '',
    ].filter(Boolean).join('. ');

    const embedding = await this.generateEmbedding(embeddingText);
    if (embedding.length === 0) return;

    await executeStatement(
      `UPDATE open_source_libraries 
       SET description_embedding = $2::vector
       WHERE library_id = $1`,
      [
        { name: 'libraryId', value: { stringValue: libraryId } },
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
      ]
    );

    logger.debug('Updated library embedding', { libraryId });
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  async getConfig(tenantId: string): Promise<LibraryConfig> {
    const cached = this.configCache.get(tenantId);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.config;
    }

    const result = await executeStatement(
      `SELECT * FROM library_registry_config WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    if (result.rows.length === 0) {
      return this.createDefaultConfig(tenantId);
    }

    const config = this.mapConfig(result.rows[0] as Record<string, unknown>);
    this.configCache.set(tenantId, { config, cachedAt: Date.now() });
    return config;
  }

  async updateConfig(tenantId: string, updates: Partial<LibraryConfig>): Promise<LibraryConfig> {
    const setClauses: string[] = [];
    const params: Array<{ name: string; value: { stringValue?: string; booleanValue?: boolean; longValue?: number } }> = [
      { name: 'tenantId', value: { stringValue: tenantId } }
    ];
    let paramIndex = 2;

    const fieldMap: Record<string, string> = {
      libraryAssistEnabled: 'library_assist_enabled',
      autoSuggestLibraries: 'auto_suggest_libraries',
      maxLibrariesPerRequest: 'max_libraries_per_request',
      autoUpdateEnabled: 'auto_update_enabled',
      updateFrequency: 'update_frequency',
      updateTimeUtc: 'update_time_utc',
      minProficiencyMatch: 'min_proficiency_match',
      proficiencyWeights: 'proficiency_weights',
      enabledCategories: 'enabled_categories',
      disabledLibraries: 'disabled_libraries',
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (key in updates) {
        const value = (updates as Record<string, unknown>)[key];
        setClauses.push(`${dbField} = $${paramIndex}`);
        
        if (typeof value === 'boolean') {
          params.push({ name: `p${paramIndex}`, value: { booleanValue: value } });
        } else if (typeof value === 'number') {
          params.push({ name: `p${paramIndex}`, value: { stringValue: value.toString() } });
        } else if (typeof value === 'object') {
          params.push({ name: `p${paramIndex}`, value: { stringValue: JSON.stringify(value) } });
        } else {
          params.push({ name: `p${paramIndex}`, value: { stringValue: String(value) } });
        }
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return this.getConfig(tenantId);
    }

    await executeStatement(
      `UPDATE library_registry_config SET ${setClauses.join(', ')}, updated_at = NOW() WHERE tenant_id = $1`,
      params
    );

    this.configCache.delete(tenantId);
    return this.getConfig(tenantId);
  }

  private async createDefaultConfig(tenantId: string): Promise<LibraryConfig> {
    const result = await executeStatement(
      `INSERT INTO library_registry_config (
        tenant_id, library_assist_enabled, auto_suggest_libraries,
        max_libraries_per_request, auto_update_enabled, update_frequency,
        update_time_utc, min_proficiency_match, proficiency_weights,
        enabled_categories, disabled_libraries
      ) VALUES ($1, true, true, 5, true, 'daily', '03:00', 0.50, '{}', '[]', '[]')
      RETURNING *`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return this.mapConfig(result.rows[0] as Record<string, unknown>);
  }

  private mapConfig(row: Record<string, unknown>): LibraryConfig {
    return {
      configId: String(row.config_id || ''),
      tenantId: String(row.tenant_id || ''),
      libraryAssistEnabled: Boolean(row.library_assist_enabled),
      autoSuggestLibraries: Boolean(row.auto_suggest_libraries),
      maxLibrariesPerRequest: Number(row.max_libraries_per_request) || 5,
      autoUpdateEnabled: Boolean(row.auto_update_enabled),
      updateFrequency: (row.update_frequency as 'hourly' | 'daily' | 'weekly' | 'manual') || 'daily',
      updateTimeUtc: String(row.update_time_utc || '03:00'),
      lastUpdateAt: row.last_update_at ? String(row.last_update_at) : null,
      nextUpdateAt: row.next_update_at ? String(row.next_update_at) : null,
      minProficiencyMatch: Number(row.min_proficiency_match) || 0.5,
      proficiencyWeights: typeof row.proficiency_weights === 'string' 
        ? JSON.parse(row.proficiency_weights) 
        : (row.proficiency_weights as Partial<ProficiencyScores>) || {},
      enabledCategories: typeof row.enabled_categories === 'string'
        ? JSON.parse(row.enabled_categories)
        : (row.enabled_categories as string[]) || [],
      disabledLibraries: typeof row.disabled_libraries === 'string'
        ? JSON.parse(row.disabled_libraries)
        : (row.disabled_libraries as string[]) || [],
      createdAt: String(row.created_at || ''),
      updatedAt: String(row.updated_at || ''),
    };
  }

  // --------------------------------------------------------------------------
  // Library Management
  // --------------------------------------------------------------------------

  async getAllLibraries(): Promise<Library[]> {
    const result = await executeStatement(
      `SELECT * FROM open_source_libraries ORDER BY stars DESC`,
      []
    );
    return result.rows.map(row => this.mapLibrary(row as Record<string, unknown>));
  }

  async getLibrary(libraryId: string): Promise<Library | null> {
    const result = await executeStatement(
      `SELECT * FROM open_source_libraries WHERE library_id = $1`,
      [{ name: 'libraryId', value: { stringValue: libraryId } }]
    );
    return result.rows.length > 0 ? this.mapLibrary(result.rows[0] as Record<string, unknown>) : null;
  }

  async getLibrariesByCategory(category: string): Promise<Library[]> {
    const result = await executeStatement(
      `SELECT * FROM open_source_libraries WHERE category = $1 ORDER BY stars DESC`,
      [{ name: 'category', value: { stringValue: category } }]
    );
    return result.rows.map(row => this.mapLibrary(row as Record<string, unknown>));
  }

  async upsertLibrary(library: Omit<Library, 'createdAt' | 'updatedAt'>): Promise<Library> {
    const result = await executeStatement(
      `INSERT INTO open_source_libraries (
        library_id, name, category, license, license_note, repo, description,
        beats, stars, languages, domains,
        reasoning_depth, mathematical_quantitative, code_generation,
        creative_generative, research_synthesis, factual_recall_precision,
        multi_step_problem_solving, domain_terminology_handling,
        version, last_checked_at, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), $21)
      ON CONFLICT (library_id) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        license = EXCLUDED.license,
        license_note = EXCLUDED.license_note,
        repo = EXCLUDED.repo,
        description = EXCLUDED.description,
        beats = EXCLUDED.beats,
        stars = EXCLUDED.stars,
        languages = EXCLUDED.languages,
        domains = EXCLUDED.domains,
        reasoning_depth = EXCLUDED.reasoning_depth,
        mathematical_quantitative = EXCLUDED.mathematical_quantitative,
        code_generation = EXCLUDED.code_generation,
        creative_generative = EXCLUDED.creative_generative,
        research_synthesis = EXCLUDED.research_synthesis,
        factual_recall_precision = EXCLUDED.factual_recall_precision,
        multi_step_problem_solving = EXCLUDED.multi_step_problem_solving,
        domain_terminology_handling = EXCLUDED.domain_terminology_handling,
        version = EXCLUDED.version,
        last_checked_at = NOW(),
        source = EXCLUDED.source
      RETURNING *`,
      [
        { name: 'libraryId', value: { stringValue: library.libraryId } },
        { name: 'name', value: { stringValue: library.name } },
        { name: 'category', value: { stringValue: library.category } },
        { name: 'license', value: { stringValue: library.license } },
        { name: 'licenseNote', value: { stringValue: library.licenseNote || '' } },
        { name: 'repo', value: { stringValue: library.repo } },
        { name: 'description', value: { stringValue: library.description } },
        { name: 'beats', value: { stringValue: JSON.stringify(library.beats) } },
        { name: 'stars', value: { longValue: library.stars } },
        { name: 'languages', value: { stringValue: JSON.stringify(library.languages) } },
        { name: 'domains', value: { stringValue: JSON.stringify(library.domains) } },
        { name: 'reasoningDepth', value: { longValue: library.proficiencies.reasoning_depth } },
        { name: 'mathematicalQuantitative', value: { longValue: library.proficiencies.mathematical_quantitative } },
        { name: 'codeGeneration', value: { longValue: library.proficiencies.code_generation } },
        { name: 'creativeGenerative', value: { longValue: library.proficiencies.creative_generative } },
        { name: 'researchSynthesis', value: { longValue: library.proficiencies.research_synthesis } },
        { name: 'factualRecallPrecision', value: { longValue: library.proficiencies.factual_recall_precision } },
        { name: 'multiStepProblemSolving', value: { longValue: library.proficiencies.multi_step_problem_solving } },
        { name: 'domainTerminologyHandling', value: { longValue: library.proficiencies.domain_terminology_handling } },
        { name: 'version', value: { stringValue: library.version || '' } },
        { name: 'source', value: { stringValue: library.source } },
      ]
    );

    return this.mapLibrary(result.rows[0] as Record<string, unknown>);
  }

  private mapLibrary(row: Record<string, unknown>): Library {
    return {
      libraryId: String(row.library_id || ''),
      name: String(row.name || ''),
      category: String(row.category || ''),
      license: String(row.license || ''),
      licenseNote: row.license_note ? String(row.license_note) : undefined,
      repo: String(row.repo || ''),
      description: String(row.description || ''),
      beats: typeof row.beats === 'string' ? JSON.parse(row.beats) : (row.beats as string[]) || [],
      stars: Number(row.stars) || 0,
      languages: typeof row.languages === 'string' ? JSON.parse(row.languages) : (row.languages as string[]) || [],
      domains: typeof row.domains === 'string' ? JSON.parse(row.domains) : (row.domains as string[]) || [],
      proficiencies: {
        reasoning_depth: Number(row.reasoning_depth) || 5,
        mathematical_quantitative: Number(row.mathematical_quantitative) || 5,
        code_generation: Number(row.code_generation) || 5,
        creative_generative: Number(row.creative_generative) || 5,
        research_synthesis: Number(row.research_synthesis) || 5,
        factual_recall_precision: Number(row.factual_recall_precision) || 5,
        multi_step_problem_solving: Number(row.multi_step_problem_solving) || 5,
        domain_terminology_handling: Number(row.domain_terminology_handling) || 5,
      },
      version: row.version ? String(row.version) : undefined,
      lastCheckedAt: row.last_checked_at ? String(row.last_checked_at) : undefined,
      source: String(row.source || 'unknown'),
      createdAt: String(row.created_at || ''),
      updatedAt: String(row.updated_at || ''),
    };
  }

  // --------------------------------------------------------------------------
  // Proficiency Matching
  // --------------------------------------------------------------------------

  async findMatchingLibraries(
    tenantId: string,
    requiredProficiencies: Partial<ProficiencyScores>,
    options: {
      domains?: string[];
      categories?: string[];
      maxResults?: number;
    } = {}
  ): Promise<LibraryMatchResult[]> {
    const config = await this.getConfig(tenantId);
    
    if (!config.libraryAssistEnabled) {
      return [];
    }

    const { domains, categories, maxResults = config.maxLibrariesPerRequest } = options;

    // Get all libraries and filter/score in memory for flexibility
    const allLibraries = await this.getAllLibraries();
    const results: LibraryMatchResult[] = [];

    for (const library of allLibraries) {
      // Check if disabled
      if (config.disabledLibraries.includes(library.libraryId)) {
        continue;
      }

      // Check category filter
      if (categories && categories.length > 0 && !categories.includes(library.category)) {
        continue;
      }

      // Calculate proficiency match
      const proficiencyResult = this.calculateProficiencyMatch(
        library.proficiencies,
        requiredProficiencies,
        config.proficiencyWeights
      );

      // Calculate domain match
      const domainMatch = this.calculateDomainMatch(library.domains, domains);

      // Combined score (70% proficiency, 30% domain)
      const matchScore = proficiencyResult.score * 0.7 + domainMatch * 0.3;

      if (matchScore >= config.minProficiencyMatch) {
        results.push({
          library,
          matchScore,
          proficiencyMatch: proficiencyResult.score,
          domainMatch,
          matchedDimensions: proficiencyResult.dimensions,
          reason: this.generateMatchReason(library, proficiencyResult.dimensions, domainMatch),
        });
      }
    }

    // Sort by match score and limit
    results.sort((a, b) => b.matchScore - a.matchScore);
    return results.slice(0, maxResults);
  }

  private calculateProficiencyMatch(
    libraryProfs: ProficiencyScores,
    requiredProfs: Partial<ProficiencyScores>,
    weights: Partial<ProficiencyScores>
  ): { score: number; dimensions: LibraryMatchResult['matchedDimensions'] } {
    const dimensions: LibraryMatchResult['matchedDimensions'] = [];
    let totalWeight = 0;
    let weightedSum = 0;

    const profKeys: (keyof ProficiencyScores)[] = [
      'reasoning_depth', 'mathematical_quantitative', 'code_generation',
      'creative_generative', 'research_synthesis', 'factual_recall_precision',
      'multi_step_problem_solving', 'domain_terminology_handling',
    ];

    for (const key of profKeys) {
      const required = requiredProfs[key];
      if (required !== undefined && required > 0) {
        const libScore = libraryProfs[key];
        const weight = weights[key] ?? 1;
        const contribution = Math.min(libScore / Math.max(required, 1), 1) * weight;

        dimensions.push({
          dimension: key,
          libraryScore: libScore,
          requiredScore: required,
          contribution,
        });

        weightedSum += contribution;
        totalWeight += weight;
      }
    }

    const score = totalWeight > 0 ? weightedSum / totalWeight : 1;
    return { score, dimensions };
  }

  private calculateDomainMatch(libraryDomains: string[], requiredDomains?: string[]): number {
    if (!requiredDomains || requiredDomains.length === 0) {
      return 1;
    }

    if (libraryDomains.includes('all')) {
      return 0.8;
    }

    const overlap = libraryDomains.filter(d => requiredDomains.includes(d));
    if (overlap.length > 0) {
      return 1;
    }

    return 0.3;
  }

  private generateMatchReason(
    library: Library,
    dimensions: LibraryMatchResult['matchedDimensions'],
    domainMatch: number
  ): string {
    const topDimensions = dimensions
      .filter(d => d.contribution > 0.7)
      .slice(0, 2)
      .map(d => d.dimension.replace(/_/g, ' '));

    const parts: string[] = [];

    if (topDimensions.length > 0) {
      parts.push(`Strong in ${topDimensions.join(' and ')}`);
    }

    if (library.beats.length > 0) {
      parts.push(`Beats: ${library.beats[0]}`);
    }

    if (domainMatch === 1) {
      parts.push('Domain match');
    }

    return parts.join('. ') || `${library.name} may help with this task`;
  }

  // --------------------------------------------------------------------------
  // Usage Tracking
  // --------------------------------------------------------------------------

  async recordUsage(
    tenantId: string,
    userId: string,
    libraryId: string,
    invocationType: string,
    success: boolean,
    executionTimeMs: number,
    context?: {
      errorMessage?: string;
      conversationId?: string;
      requestId?: string;
      promptDomain?: string;
      matchScore?: number;
    }
  ): Promise<string> {
    const result = await executeStatement(
      `SELECT record_library_usage($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) as event_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'libraryId', value: { stringValue: libraryId } },
        { name: 'invocationType', value: { stringValue: invocationType } },
        { name: 'success', value: { booleanValue: success } },
        { name: 'executionTimeMs', value: { longValue: executionTimeMs } },
        { name: 'errorMessage', value: { stringValue: context?.errorMessage || '' } },
        { name: 'conversationId', value: { stringValue: context?.conversationId || '' } },
        { name: 'requestId', value: { stringValue: context?.requestId || '' } },
        { name: 'promptDomain', value: { stringValue: context?.promptDomain || '' } },
        { name: 'matchScore', value: { stringValue: context?.matchScore?.toString() || '' } },
      ]
    );

    return String(result.rows[0]?.event_id || '');
  }

  async getUsageStats(tenantId: string, libraryId: string): Promise<LibraryUsageStats | null> {
    const result = await executeStatement(
      `SELECT * FROM library_usage_aggregates WHERE tenant_id = $1 AND library_id = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'libraryId', value: { stringValue: libraryId } },
      ]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      libraryId: String(row.library_id),
      totalInvocations: Number(row.total_invocations) || 0,
      successfulInvocations: Number(row.successful_invocations) || 0,
      failedInvocations: Number(row.failed_invocations) || 0,
      avgExecutionTimeMs: Number(row.avg_execution_time_ms) || 0,
      successRate: Number(row.success_rate) || 0,
      invocationsByType: typeof row.invocations_by_type === 'string'
        ? JSON.parse(row.invocations_by_type)
        : (row.invocations_by_type as Record<string, number>) || {},
      lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    };
  }

  // --------------------------------------------------------------------------
  // Dashboard
  // --------------------------------------------------------------------------

  async getDashboard(tenantId: string): Promise<LibraryDashboard> {
    const config = await this.getConfig(tenantId);

    // Get library stats
    const libraryStatsResult = await executeStatement(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE library_id NOT IN (
          SELECT jsonb_array_elements_text(disabled_libraries)
          FROM library_registry_config WHERE tenant_id = $1
        )) as enabled
      FROM open_source_libraries`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    // Get usage stats
    const usageStatsResult = await executeStatement(
      `SELECT 
        COUNT(*) as total_invocations,
        AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) as success_rate
      FROM library_usage_events WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    // Get top libraries
    const topLibrariesResult = await executeStatement(
      `SELECT a.*, l.name as library_name
      FROM library_usage_aggregates a
      JOIN open_source_libraries l ON a.library_id = l.library_id
      WHERE a.tenant_id = $1
      ORDER BY a.total_invocations DESC
      LIMIT 10`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    // Get recent usage
    const recentUsageResult = await executeStatement(
      `SELECT e.*, l.name as library_name
      FROM library_usage_events e
      JOIN open_source_libraries l ON e.library_id = l.library_id
      WHERE e.tenant_id = $1
      ORDER BY e.created_at DESC
      LIMIT 20`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    // Get category breakdown
    const categoryResult = await executeStatement(
      `SELECT 
        category,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE library_id NOT IN (
          SELECT jsonb_array_elements_text(disabled_libraries)
          FROM library_registry_config WHERE tenant_id = $1
        )) as enabled
      FROM open_source_libraries
      GROUP BY category
      ORDER BY count DESC`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const libStats = libraryStatsResult.rows[0] as Record<string, unknown>;
    const usageStats = usageStatsResult.rows[0] as Record<string, unknown>;

    return {
      config,
      stats: {
        totalLibraries: Number(libStats?.total) || 0,
        enabledLibraries: Number(libStats?.enabled) || 0,
        totalInvocations: Number(usageStats?.total_invocations) || 0,
        successRate: Number(usageStats?.success_rate) || 0,
        lastUpdateAt: config.lastUpdateAt,
      },
      topLibraries: topLibrariesResult.rows.map(row => {
        const r = row as Record<string, unknown>;
        return {
          libraryId: String(r.library_id),
          totalInvocations: Number(r.total_invocations) || 0,
          successfulInvocations: Number(r.successful_invocations) || 0,
          failedInvocations: Number(r.failed_invocations) || 0,
          avgExecutionTimeMs: Number(r.avg_execution_time_ms) || 0,
          successRate: Number(r.success_rate) || 0,
          invocationsByType: typeof r.invocations_by_type === 'string'
            ? JSON.parse(r.invocations_by_type)
            : (r.invocations_by_type as Record<string, number>) || {},
          lastUsedAt: r.last_used_at ? String(r.last_used_at) : null,
        };
      }),
      recentUsage: recentUsageResult.rows.map(row => {
        const r = row as Record<string, unknown>;
        return {
          eventId: String(r.event_id),
          libraryId: String(r.library_id),
          libraryName: String(r.library_name),
          invocationType: String(r.invocation_type),
          success: Boolean(r.success),
          executionTimeMs: Number(r.execution_time_ms) || 0,
          createdAt: String(r.created_at),
        };
      }),
      categoryBreakdown: categoryResult.rows.map(row => {
        const r = row as Record<string, unknown>;
        return {
          category: String(r.category),
          count: Number(r.count) || 0,
          enabled: Number(r.enabled) || 0,
        };
      }),
    };
  }

  // --------------------------------------------------------------------------
  // Seed Data Loading
  // --------------------------------------------------------------------------

  async seedLibraries(libraries: Array<{
    id: string;
    name: string;
    category: string;
    license: string;
    license_note?: string;
    repo: string;
    description: string;
    beats: string[];
    stars: number;
    languages: string[];
    domains: string[];
    proficiencies: ProficiencyScores;
  }>): Promise<{ added: number; updated: number }> {
    let added = 0;
    let updated = 0;

    for (const lib of libraries) {
      const existing = await this.getLibrary(lib.id);
      
      await this.upsertLibrary({
        libraryId: lib.id,
        name: lib.name,
        category: lib.category,
        license: lib.license,
        licenseNote: lib.license_note,
        repo: lib.repo,
        description: lib.description,
        beats: lib.beats,
        stars: lib.stars,
        languages: lib.languages,
        domains: lib.domains,
        proficiencies: lib.proficiencies,
        source: 'seed',
      });

      if (existing) {
        updated++;
      } else {
        added++;
      }
    }

    logger.info('Seeded libraries', { added, updated, total: libraries.length });
    return { added, updated };
  }

  // --------------------------------------------------------------------------
  // Uncensored Model Support (Sovereign Routing)
  // --------------------------------------------------------------------------

  /**
   * Get uncensored libraries/models for sovereign routing
   * Used when external providers refuse requests
   */
  async getUncensoredLibraries(domain?: string): Promise<Library[]> {
    const result = await executeStatement(
      `SELECT * FROM open_source_libraries 
       WHERE category = 'Uncensored LLMs'
       ${domain ? `AND $1 = ANY(domains)` : ''}
       ORDER BY stars DESC`,
      domain ? [{ name: 'domain', value: { stringValue: domain } }] : []
    );

    return result.rows.map(row => this.mapLibrary(row as Record<string, unknown>));
  }

  /**
   * Get best uncensored model for a specific use case
   */
  async getUncensoredModelForUseCase(useCase: string): Promise<Library | null> {
    const result = await executeStatement(
      `SELECT * FROM open_source_libraries 
       WHERE category = 'Uncensored LLMs'
         AND $1 = ANY(use_cases)
       ORDER BY stars DESC
       LIMIT 1`,
      [{ name: 'useCase', value: { stringValue: useCase } }]
    );

    if (result.rows.length === 0) {
      // Fall back to highest-rated uncensored model
      const fallback = await executeStatement(
        `SELECT * FROM open_source_libraries 
         WHERE category = 'Uncensored LLMs'
         ORDER BY stars DESC
         LIMIT 1`,
        []
      );
      return fallback.rows.length > 0 
        ? this.mapLibrary(fallback.rows[0] as Record<string, unknown>)
        : null;
    }

    return this.mapLibrary(result.rows[0] as Record<string, unknown>);
  }

  /**
   * Check if a library is uncensored
   */
  async isUncensored(libraryId: string): Promise<boolean> {
    const library = await this.getLibrary(libraryId);
    return library?.uncensored === true;
  }
}

export const libraryRegistryService = new LibraryRegistryService();
