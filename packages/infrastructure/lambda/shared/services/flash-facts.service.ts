// RADIANT v4.18.0 - Flash Facts Service
// Fast-access factual memory for Consciousness Operating System (COS)
// Provides instant retrieval of verified facts with semantic similarity matching

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface FlashFact {
  id: string;
  tenantId: string;
  userId?: string;
  category: FlashFactCategory;
  factKey: string;
  factValue: string;
  confidence: number;
  source: FactSource;
  sourceUrl?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  expiresAt?: string;
  usageCount: number;
  lastUsedAt?: string;
  embedding?: number[];
  tags: string[];
  metadata: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FlashFactCategory =
  | 'definition'
  | 'statistic'
  | 'date'
  | 'person'
  | 'place'
  | 'event'
  | 'formula'
  | 'procedure'
  | 'reference'
  | 'custom';

export type FactSource =
  | 'user_provided'
  | 'conversation_extracted'
  | 'admin_curated'
  | 'external_verified'
  | 'ai_generated';

export interface FlashFactQuery {
  query: string;
  category?: FlashFactCategory;
  userId?: string;
  includeExpired?: boolean;
  minConfidence?: number;
  limit?: number;
}

export interface FlashFactMatch {
  fact: FlashFact;
  similarity: number;
  relevanceScore: number;
}

export interface FlashFactStats {
  totalFacts: number;
  byCategory: Record<FlashFactCategory, number>;
  bySource: Record<FactSource, number>;
  avgConfidence: number;
  totalUsage: number;
  expiringSoon: number;
  recentlyAdded: number;
}

export interface FlashFactConfig {
  tenantId: string;
  enabled: boolean;
  maxFactsPerUser: number;
  maxFactsPerTenant: number;
  defaultExpirationDays: number;
  autoExtractFromConversations: boolean;
  requireVerification: boolean;
  minConfidenceThreshold: number;
  semanticMatchThreshold: number;
  categories: FlashFactCategory[];
}

// ============================================================================
// Flash Facts Service
// ============================================================================

class FlashFactsService {
  private readonly DEFAULT_CONFIG: Partial<FlashFactConfig> = {
    enabled: true,
    maxFactsPerUser: 1000,
    maxFactsPerTenant: 50000,
    defaultExpirationDays: 365,
    autoExtractFromConversations: true,
    requireVerification: false,
    minConfidenceThreshold: 0.7,
    semanticMatchThreshold: 0.75,
    categories: ['definition', 'statistic', 'date', 'person', 'place', 'event', 'formula', 'procedure', 'reference', 'custom'],
  };

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  async getConfig(tenantId: string): Promise<FlashFactConfig> {
    try {
      const result = await executeStatement(
        `SELECT * FROM flash_facts_config WHERE tenant_id = :tenantId`,
        [stringParam('tenantId', tenantId)]
      );

      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0] as Record<string, unknown>;
        return this.parseConfig(row);
      }

      // Return defaults
      return {
        tenantId,
        ...this.DEFAULT_CONFIG,
      } as FlashFactConfig;
    } catch (error) {
      logger.error('Failed to get flash facts config', { tenantId, error });
      throw error;
    }
  }

  async updateConfig(tenantId: string, updates: Partial<FlashFactConfig>): Promise<FlashFactConfig> {
    try {
      const current = await this.getConfig(tenantId);
      const merged = { ...current, ...updates };

      await executeStatement(
        `INSERT INTO flash_facts_config (
            tenant_id, enabled, max_facts_per_user, max_facts_per_tenant,
            default_expiration_days, auto_extract_from_conversations,
            require_verification, min_confidence_threshold,
            semantic_match_threshold, categories, updated_at
          ) VALUES (
            :tenantId, :enabled, :maxFactsPerUser, :maxFactsPerTenant,
            :defaultExpirationDays, :autoExtract, :requireVerification,
            :minConfidence, :semanticThreshold, :categories, NOW()
          )
          ON CONFLICT (tenant_id) DO UPDATE SET
            enabled = :enabled,
            max_facts_per_user = :maxFactsPerUser,
            max_facts_per_tenant = :maxFactsPerTenant,
            default_expiration_days = :defaultExpirationDays,
            auto_extract_from_conversations = :autoExtract,
            require_verification = :requireVerification,
            min_confidence_threshold = :minConfidence,
            semantic_match_threshold = :semanticThreshold,
            categories = :categories,
            updated_at = NOW()`,
        [
          stringParam('tenantId', tenantId),
          boolParam('enabled', merged.enabled),
          longParam('maxFactsPerUser', merged.maxFactsPerUser),
          longParam('maxFactsPerTenant', merged.maxFactsPerTenant),
          longParam('defaultExpirationDays', merged.defaultExpirationDays),
          boolParam('autoExtract', merged.autoExtractFromConversations),
          boolParam('requireVerification', merged.requireVerification),
          doubleParam('minConfidence', merged.minConfidenceThreshold),
          doubleParam('semanticThreshold', merged.semanticMatchThreshold),
          stringParam('categories', JSON.stringify(merged.categories)),
        ]
      );

      logger.info('Updated flash facts config', { tenantId });
      return merged;
    } catch (error) {
      logger.error('Failed to update flash facts config', { tenantId, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // CRUD Operations
  // --------------------------------------------------------------------------

  async createFact(
    tenantId: string,
    fact: Omit<FlashFact, 'id' | 'tenantId' | 'usageCount' | 'createdAt' | 'updatedAt'>
  ): Promise<FlashFact> {
    try {
      const id = `ff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const config = await this.getConfig(tenantId);

      // Check limits
      const stats = await this.getStats(tenantId);
      if (stats.totalFacts >= config.maxFactsPerTenant) {
        throw new Error('Tenant fact limit reached');
      }

      if (fact.userId) {
        const userCount = await this.getUserFactCount(tenantId, fact.userId);
        if (userCount >= config.maxFactsPerUser) {
          throw new Error('User fact limit reached');
        }
      }

      // Calculate expiration
      const expiresAt = fact.expiresAt || this.calculateExpiration(config.defaultExpirationDays);

      await executeStatement(
        `INSERT INTO flash_facts (
            id, tenant_id, user_id, category, fact_key, fact_value,
            confidence, source, source_url, verified_at, verified_by,
            expires_at, usage_count, tags, metadata, is_active,
            created_at, updated_at
          ) VALUES (
            :id, :tenantId, :userId, :category, :factKey, :factValue,
            :confidence, :source, :sourceUrl, :verifiedAt, :verifiedBy,
            :expiresAt, 0, :tags, :metadata, :isActive,
            NOW(), NOW()
          )`,
        [
          stringParam('id', id),
          stringParam('tenantId', tenantId),
          stringParam('userId', fact.userId || ''),
          stringParam('category', fact.category),
          stringParam('factKey', fact.factKey),
          stringParam('factValue', fact.factValue),
          doubleParam('confidence', fact.confidence),
          stringParam('source', fact.source),
          stringParam('sourceUrl', fact.sourceUrl || ''),
          stringParam('verifiedAt', fact.verifiedAt || ''),
          stringParam('verifiedBy', fact.verifiedBy || ''),
          stringParam('expiresAt', expiresAt),
          stringParam('tags', JSON.stringify(fact.tags || [])),
          stringParam('metadata', JSON.stringify(fact.metadata || {})),
          boolParam('isActive', fact.isActive !== false),
        ]
      );

      logger.info('Created flash fact', { tenantId, id, category: fact.category });

      return {
        id,
        tenantId,
        ...fact,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as FlashFact;
    } catch (error) {
      logger.error('Failed to create flash fact', { tenantId, error });
      throw error;
    }
  }

  async getFact(tenantId: string, factId: string): Promise<FlashFact | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM flash_facts WHERE tenant_id = :tenantId AND id = :factId`,
        [stringParam('tenantId', tenantId), stringParam('factId', factId)]
      );

      if (result.rows && result.rows.length > 0) {
        return this.parseFact(result.rows[0] as Record<string, unknown>);
      }

      return null;
    } catch (error) {
      logger.error('Failed to get flash fact', { tenantId, factId, error });
      throw error;
    }
  }

  async updateFact(
    tenantId: string,
    factId: string,
    updates: Partial<FlashFact>
  ): Promise<FlashFact | null> {
    try {
      const existing = await this.getFact(tenantId, factId);
      if (!existing) {
        return null;
      }

      const merged = { ...existing, ...updates };

      await executeStatement(
        `UPDATE flash_facts SET
            category = :category,
            fact_key = :factKey,
            fact_value = :factValue,
            confidence = :confidence,
            source = :source,
            source_url = :sourceUrl,
            verified_at = :verifiedAt,
            verified_by = :verifiedBy,
            expires_at = :expiresAt,
            tags = :tags,
            metadata = :metadata,
            is_active = :isActive,
            updated_at = NOW()
          WHERE tenant_id = :tenantId AND id = :factId`,
        [
          stringParam('category', merged.category),
          stringParam('factKey', merged.factKey),
          stringParam('factValue', merged.factValue),
          doubleParam('confidence', merged.confidence),
          stringParam('source', merged.source),
          stringParam('sourceUrl', merged.sourceUrl || ''),
          stringParam('verifiedAt', merged.verifiedAt || ''),
          stringParam('verifiedBy', merged.verifiedBy || ''),
          stringParam('expiresAt', merged.expiresAt || ''),
          stringParam('tags', JSON.stringify(merged.tags)),
          stringParam('metadata', JSON.stringify(merged.metadata)),
          boolParam('isActive', merged.isActive),
          stringParam('tenantId', tenantId),
          stringParam('factId', factId),
        ]
      );

      logger.info('Updated flash fact', { tenantId, factId });
      return { ...merged, updatedAt: new Date().toISOString() };
    } catch (error) {
      logger.error('Failed to update flash fact', { tenantId, factId, error });
      throw error;
    }
  }

  async deleteFact(tenantId: string, factId: string): Promise<boolean> {
    try {
      const result = await executeStatement(
        `DELETE FROM flash_facts WHERE tenant_id = :tenantId AND id = :factId`,
        [stringParam('tenantId', tenantId), stringParam('factId', factId)]
      );

      const deleted = (result.rowCount || 0) > 0;
      if (deleted) {
        logger.info('Deleted flash fact', { tenantId, factId });
      }
      return deleted;
    } catch (error) {
      logger.error('Failed to delete flash fact', { tenantId, factId, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Query & Search
  // --------------------------------------------------------------------------

  async queryFacts(tenantId: string, query: FlashFactQuery): Promise<FlashFactMatch[]> {
    try {
      const config = await this.getConfig(tenantId);
      const limit = query.limit || 10;
      const minConfidence = query.minConfidence || config.minConfidenceThreshold;

      // Build query conditions
      let sql = `
        SELECT *, 
          similarity(fact_key || ' ' || fact_value, :query) as text_similarity
        FROM flash_facts
        WHERE tenant_id = :tenantId
          AND is_active = true
          AND confidence >= :minConfidence
      `;

      const params = [
        stringParam('tenantId', tenantId),
        stringParam('query', query.query),
        doubleParam('minConfidence', minConfidence),
      ];

      if (query.category) {
        sql += ` AND category = :category`;
        params.push(stringParam('category', query.category));
      }

      if (query.userId) {
        sql += ` AND (user_id = :userId OR user_id IS NULL OR user_id = '')`;
        params.push(stringParam('userId', query.userId));
      }

      if (!query.includeExpired) {
        sql += ` AND (expires_at IS NULL OR expires_at > NOW())`;
      }

      sql += ` ORDER BY text_similarity DESC, usage_count DESC LIMIT :limit`;
      params.push(longParam('limit', limit));

      const result = await executeStatement(sql, params);

      const matches: FlashFactMatch[] = [];
      if (result.rows) {
        for (const row of result.rows as Record<string, unknown>[]) {
          const fact = this.parseFact(row);
          const similarity = this.extractDouble(row, 'text_similarity') || 0;
          
          if (similarity >= config.semanticMatchThreshold) {
            matches.push({
              fact,
              similarity,
              relevanceScore: this.calculateRelevance(fact, similarity),
            });
          }
        }
      }

      // Record usage for matched facts
      if (matches.length > 0) {
        await this.recordUsage(tenantId, matches.map(m => m.fact.id));
      }

      return matches;
    } catch (error) {
      logger.error('Failed to query flash facts', { tenantId, query, error });
      throw error;
    }
  }

  async instantLookup(
    tenantId: string,
    query: string,
    userId?: string
  ): Promise<FlashFactMatch | null> {
    try {
      const matches = await this.queryFacts(tenantId, {
        query,
        userId,
        limit: 1,
        minConfidence: 0.8,
      });

      return matches.length > 0 ? matches[0] : null;
    } catch (error) {
      logger.error('Failed instant lookup', { tenantId, query, error });
      return null;
    }
  }

  async listFacts(
    tenantId: string,
    options: {
      category?: FlashFactCategory;
      userId?: string;
      source?: FactSource;
      isActive?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ facts: FlashFact[]; total: number }> {
    try {
      let sql = `SELECT * FROM flash_facts WHERE tenant_id = :tenantId`;
      let countSql = `SELECT COUNT(*) as total FROM flash_facts WHERE tenant_id = :tenantId`;
      const params = [stringParam('tenantId', tenantId)];

      if (options.category) {
        sql += ` AND category = :category`;
        countSql += ` AND category = :category`;
        params.push(stringParam('category', options.category));
      }

      if (options.userId) {
        sql += ` AND user_id = :userId`;
        countSql += ` AND user_id = :userId`;
        params.push(stringParam('userId', options.userId));
      }

      if (options.source) {
        sql += ` AND source = :source`;
        countSql += ` AND source = :source`;
        params.push(stringParam('source', options.source));
      }

      if (options.isActive !== undefined) {
        sql += ` AND is_active = :isActive`;
        countSql += ` AND is_active = :isActive`;
        params.push(boolParam('isActive', options.isActive));
      }

      sql += ` ORDER BY updated_at DESC`;

      if (options.limit) {
        sql += ` LIMIT :limit`;
        params.push(longParam('limit', options.limit));
      }

      if (options.offset) {
        sql += ` OFFSET :offset`;
        params.push(longParam('offset', options.offset));
      }

      const [result, countResult] = await Promise.all([
        executeStatement(sql, params),
        executeStatement(countSql, params.slice(0, -2)), // Remove limit/offset
      ]);

      const facts = (result.rows || []).map(row => this.parseFact(row as Record<string, unknown>));
      const total = this.extractLong(countResult.rows?.[0] as Record<string, unknown> | undefined, 'total') || 0;

      return { facts, total };
    } catch (error) {
      logger.error('Failed to list flash facts', { tenantId, options, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Extraction & Verification
  // --------------------------------------------------------------------------

  async extractFromConversation(
    tenantId: string,
    userId: string,
    conversationText: string,
    messageId: string
  ): Promise<FlashFact[]> {
    try {
      const config = await this.getConfig(tenantId);
      if (!config.autoExtractFromConversations) {
        return [];
      }

      // Extract potential facts using patterns
      const extractedFacts: Array<Omit<FlashFact, 'id' | 'tenantId' | 'usageCount' | 'createdAt' | 'updatedAt'>> = [];

      // Pattern: "X is Y" or "X are Y"
      const definitionPattern = /(?:^|\. )([A-Z][^.]+?) (?:is|are) ([^.]+)/g;
      let match;
      while ((match = definitionPattern.exec(conversationText)) !== null) {
        extractedFacts.push({
          userId,
          category: 'definition',
          factKey: match[1].trim(),
          factValue: match[2].trim(),
          confidence: 0.7,
          source: 'conversation_extracted',
          tags: ['auto-extracted'],
          metadata: { messageId, extractedAt: new Date().toISOString() },
          isActive: !config.requireVerification,
        });
      }

      // Pattern: dates like "on January 1, 2024" or "in 2024"
      const datePattern = /([A-Z][^.]+?) (?:on|in|at) ((?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2},? \d{4}|\d{4})/g;
      while ((match = datePattern.exec(conversationText)) !== null) {
        extractedFacts.push({
          userId,
          category: 'date',
          factKey: match[1].trim(),
          factValue: match[2].trim(),
          confidence: 0.75,
          source: 'conversation_extracted',
          tags: ['auto-extracted', 'date'],
          metadata: { messageId, extractedAt: new Date().toISOString() },
          isActive: !config.requireVerification,
        });
      }

      // Pattern: statistics like "X% of Y" or "X million/billion"
      const statPattern = /(\d+(?:\.\d+)?%?) (?:of |)([^.]+)/g;
      while ((match = statPattern.exec(conversationText)) !== null) {
        if (match[2].length > 10) { // Filter out noise
          extractedFacts.push({
            userId,
            category: 'statistic',
            factKey: match[2].trim(),
            factValue: match[1].trim(),
            confidence: 0.65,
            source: 'conversation_extracted',
            tags: ['auto-extracted', 'statistic'],
            metadata: { messageId, extractedAt: new Date().toISOString() },
            isActive: !config.requireVerification,
          });
        }
      }

      // Create facts (deduplicated)
      const createdFacts: FlashFact[] = [];
      for (const fact of extractedFacts) {
        // Check for duplicates
        const existing = await this.queryFacts(tenantId, {
          query: fact.factKey,
          userId,
          limit: 1,
        });

        if (existing.length === 0 || existing[0].similarity < 0.9) {
          const created = await this.createFact(tenantId, fact);
          createdFacts.push(created);
        }
      }

      if (createdFacts.length > 0) {
        logger.info('Extracted facts from conversation', {
          tenantId,
          userId,
          messageId,
          count: createdFacts.length,
        });
      }

      return createdFacts;
    } catch (error) {
      logger.error('Failed to extract facts from conversation', { tenantId, userId, error });
      return [];
    }
  }

  async verifyFact(
    tenantId: string,
    factId: string,
    verifiedBy: string,
    confidence?: number
  ): Promise<FlashFact | null> {
    try {
      return await this.updateFact(tenantId, factId, {
        verifiedAt: new Date().toISOString(),
        verifiedBy,
        confidence: confidence || 1.0,
        isActive: true,
      });
    } catch (error) {
      logger.error('Failed to verify fact', { tenantId, factId, error });
      throw error;
    }
  }

  async bulkVerify(
    tenantId: string,
    factIds: string[],
    verifiedBy: string
  ): Promise<number> {
    try {
      let verified = 0;
      for (const factId of factIds) {
        const result = await this.verifyFact(tenantId, factId, verifiedBy);
        if (result) verified++;
      }
      return verified;
    } catch (error) {
      logger.error('Failed bulk verify', { tenantId, factIds, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  async getStats(tenantId: string, userId?: string): Promise<FlashFactStats> {
    try {
      let whereClause = `WHERE tenant_id = :tenantId`;
      const params = [stringParam('tenantId', tenantId)];

      if (userId) {
        whereClause += ` AND user_id = :userId`;
        params.push(stringParam('userId', userId));
      }

      const result = await executeStatement(
        `SELECT 
            COUNT(*) as total,
            AVG(confidence) as avg_confidence,
            SUM(usage_count) as total_usage,
            COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at < NOW() + INTERVAL '7 days') as expiring_soon,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as recently_added,
            jsonb_object_agg(COALESCE(category, 'unknown'), category_count) as by_category,
            jsonb_object_agg(COALESCE(source, 'unknown'), source_count) as by_source
          FROM (
            SELECT *,
              COUNT(*) OVER (PARTITION BY category) as category_count,
              COUNT(*) OVER (PARTITION BY source) as source_count
            FROM flash_facts
            ${whereClause}
          ) subq`,
        params
      );

      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0] as Record<string, unknown>;
        return {
          totalFacts: this.extractLong(row, 'total') || 0,
          byCategory: (this.extractJson(row, 'by_category') || {}) as Record<FlashFactCategory, number>,
          bySource: (this.extractJson(row, 'by_source') || {}) as Record<FactSource, number>,
          avgConfidence: this.extractDouble(row, 'avg_confidence') || 0,
          totalUsage: this.extractLong(row, 'total_usage') || 0,
          expiringSoon: this.extractLong(row, 'expiring_soon') || 0,
          recentlyAdded: this.extractLong(row, 'recently_added') || 0,
        };
      }

      return {
        totalFacts: 0,
        byCategory: {} as Record<FlashFactCategory, number>,
        bySource: {} as Record<FactSource, number>,
        avgConfidence: 0,
        totalUsage: 0,
        expiringSoon: 0,
        recentlyAdded: 0,
      };
    } catch (error) {
      logger.error('Failed to get flash facts stats', { tenantId, userId, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private async getUserFactCount(tenantId: string, userId: string): Promise<number> {
    const result = await executeStatement(
      `SELECT COUNT(*) as count FROM flash_facts WHERE tenant_id = :tenantId AND user_id = :userId`,
      [stringParam('tenantId', tenantId), stringParam('userId', userId)]
    );
    return this.extractLong(result.rows?.[0] as Record<string, unknown> | undefined, 'count') || 0;
  }

  private async recordUsage(tenantId: string, factIds: string[]): Promise<void> {
    if (factIds.length === 0) return;

    await executeStatement(
      `UPDATE flash_facts SET
          usage_count = usage_count + 1,
          last_used_at = NOW()
        WHERE tenant_id = :tenantId AND id = ANY(:factIds)`,
      [stringParam('tenantId', tenantId), stringParam('factIds', `{${factIds.join(',')}}`)]  
    );
  }

  private calculateExpiration(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }

  private calculateRelevance(fact: FlashFact, similarity: number): number {
    // Combine similarity, confidence, and recency
    const recencyBoost = fact.lastUsedAt
      ? Math.max(0, 1 - (Date.now() - new Date(fact.lastUsedAt).getTime()) / (30 * 24 * 60 * 60 * 1000))
      : 0;
    const usageBoost = Math.min(1, fact.usageCount / 100);

    return (similarity * 0.5) + (fact.confidence * 0.3) + (recencyBoost * 0.1) + (usageBoost * 0.1);
  }

  private parseConfig(row: Record<string, unknown>): FlashFactConfig {
    return {
      tenantId: this.extractString(row, 'tenant_id'),
      enabled: this.extractBool(row, 'enabled'),
      maxFactsPerUser: this.extractLong(row, 'max_facts_per_user') || 1000,
      maxFactsPerTenant: this.extractLong(row, 'max_facts_per_tenant') || 50000,
      defaultExpirationDays: this.extractLong(row, 'default_expiration_days') || 365,
      autoExtractFromConversations: this.extractBool(row, 'auto_extract_from_conversations'),
      requireVerification: this.extractBool(row, 'require_verification'),
      minConfidenceThreshold: this.extractDouble(row, 'min_confidence_threshold') || 0.7,
      semanticMatchThreshold: this.extractDouble(row, 'semantic_match_threshold') || 0.75,
      categories: this.extractJson(row, 'categories') || [],
    };
  }

  private parseFact(row: Record<string, unknown>): FlashFact {
    return {
      id: this.extractString(row, 'id'),
      tenantId: this.extractString(row, 'tenant_id'),
      userId: this.extractString(row, 'user_id') || undefined,
      category: this.extractString(row, 'category') as FlashFactCategory,
      factKey: this.extractString(row, 'fact_key'),
      factValue: this.extractString(row, 'fact_value'),
      confidence: this.extractDouble(row, 'confidence') || 0,
      source: this.extractString(row, 'source') as FactSource,
      sourceUrl: this.extractString(row, 'source_url') || undefined,
      verifiedAt: this.extractString(row, 'verified_at') || undefined,
      verifiedBy: this.extractString(row, 'verified_by') || undefined,
      expiresAt: this.extractString(row, 'expires_at') || undefined,
      usageCount: this.extractLong(row, 'usage_count') || 0,
      lastUsedAt: this.extractString(row, 'last_used_at') || undefined,
      tags: this.extractJson(row, 'tags') || [],
      metadata: this.extractJson(row, 'metadata') || {},
      isActive: this.extractBool(row, 'is_active'),
      createdAt: this.extractString(row, 'created_at'),
      updatedAt: this.extractString(row, 'updated_at'),
    };
  }

  private extractString(row: Record<string, unknown>, key: string): string {
    const value = row[key];
    if (typeof value === 'object' && value !== null && 'stringValue' in value) {
      return (value as { stringValue: string }).stringValue || '';
    }
    return String(value || '');
  }

  private extractLong(row: Record<string, unknown> | undefined, key: string): number {
    if (!row) return 0;
    const value = row[key];
    if (typeof value === 'object' && value !== null && 'longValue' in value) {
      return (value as { longValue: number }).longValue || 0;
    }
    return Number(value) || 0;
  }

  private extractDouble(row: Record<string, unknown> | undefined, key: string): number {
    if (!row) return 0;
    const value = row[key];
    if (typeof value === 'object' && value !== null && 'doubleValue' in value) {
      return (value as { doubleValue: number }).doubleValue || 0;
    }
    return Number(value) || 0;
  }

  private extractBool(row: Record<string, unknown>, key: string): boolean {
    const value = row[key];
    if (typeof value === 'object' && value !== null && 'booleanValue' in value) {
      return (value as { booleanValue: boolean }).booleanValue || false;
    }
    return Boolean(value);
  }

  private extractJson<T>(row: Record<string, unknown> | undefined, key: string): T | null {
    if (!row) return null;
    const value = row[key];
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    if (typeof value === 'object' && value !== null && 'stringValue' in value) {
      try {
        return JSON.parse((value as { stringValue: string }).stringValue);
      } catch {
        return null;
      }
    }
    return value as T;
  }
}

export const flashFactsService = new FlashFactsService();
