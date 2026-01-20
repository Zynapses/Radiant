/**
 * RADIANT v5.33.0 - Question Deduplication Service
 * 
 * Prevents redundant questions by caching recent answers.
 * Uses SHA-256 hashing of normalized questions for fast lookup.
 * 
 * Before asking a question:
 * 1. Check if it's in conversation history
 * 2. Check if it's in available documents
 * 3. Check if it can be reasonably inferred
 * 4. Check if the answer materially affects the outcome
 */

import { executeStatement, stringParam, longParam } from '../../db/client';
import { logger } from '../../utils/logger';
import { createHash } from 'crypto';

// Using enhanced logger from utils

// ============================================================================
// TYPES
// ============================================================================

export interface CachedQuestion {
  id: string;
  tenantId: string;
  questionHash: string;
  questionText: string;
  contextHash?: string;
  cachedResponse: unknown;
  cachedBy?: string;
  createdAt: Date;
  expiresAt: Date;
  hitCount: number;
  lastHitAt?: Date;
  isValid: boolean;
}

export interface DeduplicationConfig {
  enabled: boolean;
  defaultTTLMinutes: number;
  maxCacheSize: number;
  normalizeQuestions: boolean;
  includeContextInHash: boolean;
  contextFields: string[];
}

export interface DeduplicationResult {
  isDuplicate: boolean;
  cachedResponse?: unknown;
  cacheId?: string;
  hitCount?: number;
  originalQuestion?: string;
  reason?: string;
}

const DEFAULT_CONFIG: DeduplicationConfig = {
  enabled: true,
  defaultTTLMinutes: 60,
  maxCacheSize: 10000,
  normalizeQuestions: true,
  includeContextInHash: true,
  contextFields: ['workflow_type', 'entity_type', 'user_id'],
};

// ============================================================================
// NORMALIZATION
// ============================================================================

function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s?]/g, '')
    .replace(/\b(please|kindly|could you|would you|can you)\b/g, '')
    .trim();
}

function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function extractContextHash(
  context: Record<string, unknown>,
  fields: string[]
): string | undefined {
  const relevantContext: Record<string, unknown> = {};
  
  for (const field of fields) {
    if (context[field] !== undefined) {
      relevantContext[field] = context[field];
    }
  }

  if (Object.keys(relevantContext).length === 0) {
    return undefined;
  }

  return hashString(JSON.stringify(relevantContext));
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

async function checkCache(
  tenantId: string,
  question: string,
  context: Record<string, unknown> = {},
  config: DeduplicationConfig = DEFAULT_CONFIG
): Promise<DeduplicationResult> {
  if (!config.enabled) {
    return { isDuplicate: false };
  }

  const normalizedQuestion = config.normalizeQuestions 
    ? normalizeQuestion(question)
    : question;
  const questionHash = hashString(normalizedQuestion);
  const contextHash = config.includeContextInHash
    ? extractContextHash(context, config.contextFields)
    : undefined;

  const result = await executeStatement({
    sql: `
      SELECT * FROM hitl_question_cache
      WHERE tenant_id = :tenantId
        AND question_hash = :questionHash
        AND (context_hash = :contextHash OR (context_hash IS NULL AND :contextHash IS NULL))
        AND is_valid = true
        AND expires_at > NOW()
      LIMIT 1
    `,
    parameters: [
      stringParam('tenantId', tenantId),
      stringParam('questionHash', questionHash),
      stringParam('contextHash', contextHash || ''),
    ],
  });

  if (result.rows && result.rows.length > 0) {
    const row = result.rows[0];
    
    // Update hit count
    await executeStatement({
      sql: `
        UPDATE hitl_question_cache
        SET hit_count = hit_count + 1,
            last_hit_at = NOW()
        WHERE id = :id
      `,
      parameters: [stringParam('id', row.id as string)],
    });

    logger.info('Cache hit for question', {
      tenantId,
      questionHash,
      hitCount: (row.hit_count as number) + 1,
    });

    return {
      isDuplicate: true,
      cachedResponse: row.cached_response,
      cacheId: row.id as string,
      hitCount: (row.hit_count as number) + 1,
      originalQuestion: row.question_text as string,
      reason: 'Exact match found in cache',
    };
  }

  // Check for similar questions (fuzzy matching)
  const similarResult = await findSimilarQuestion(tenantId, normalizedQuestion, questionHash);
  if (similarResult) {
    return similarResult;
  }

  return { isDuplicate: false };
}

async function findSimilarQuestion(
  tenantId: string,
  normalizedQuestion: string,
  _excludeHash: string
): Promise<DeduplicationResult | null> {
  // Get recent questions for similarity check
  const result = await executeStatement({
    sql: `
      SELECT id, question_text, cached_response, hit_count
      FROM hitl_question_cache
      WHERE tenant_id = :tenantId
        AND is_valid = true
        AND expires_at > NOW()
        AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY hit_count DESC
      LIMIT 50
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  for (const row of result.rows || []) {
    const cachedNormalized = normalizeQuestion(row.question_text as string);
    const similarity = calculateSimilarity(normalizedQuestion, cachedNormalized);
    
    if (similarity >= 0.85) {
      // Update hit count
      await executeStatement({
        sql: `
          UPDATE hitl_question_cache
          SET hit_count = hit_count + 1,
              last_hit_at = NOW()
          WHERE id = :id
        `,
        parameters: [stringParam('id', row.id as string)],
      });

      return {
        isDuplicate: true,
        cachedResponse: row.cached_response,
        cacheId: row.id as string,
        hitCount: (row.hit_count as number) + 1,
        originalQuestion: row.question_text as string,
        reason: `Similar question found (${(similarity * 100).toFixed(0)}% match)`,
      };
    }
  }

  return null;
}

function calculateSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(' '));
  const wordsB = new Set(b.split(' '));
  
  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

async function cacheResponse(
  tenantId: string,
  question: string,
  response: unknown,
  context: Record<string, unknown> = {},
  cachedBy?: string,
  ttlMinutes?: number,
  config: DeduplicationConfig = DEFAULT_CONFIG
): Promise<string> {
  const normalizedQuestion = config.normalizeQuestions 
    ? normalizeQuestion(question)
    : question;
  const questionHash = hashString(normalizedQuestion);
  const contextHash = config.includeContextInHash
    ? extractContextHash(context, config.contextFields)
    : undefined;
  const ttl = ttlMinutes ?? config.defaultTTLMinutes;

  const result = await executeStatement({
    sql: `
      INSERT INTO hitl_question_cache (
        tenant_id, question_hash, question_text, context_hash,
        cached_response, cached_by, expires_at
      ) VALUES (
        :tenantId, :questionHash, :questionText, :contextHash,
        :cachedResponse::jsonb, :cachedBy, NOW() + INTERVAL '1 minute' * :ttl
      )
      ON CONFLICT (tenant_id, question_hash, context_hash) DO UPDATE SET
        cached_response = EXCLUDED.cached_response,
        cached_by = EXCLUDED.cached_by,
        expires_at = EXCLUDED.expires_at,
        hit_count = hitl_question_cache.hit_count + 1,
        last_hit_at = NOW(),
        is_valid = true
      RETURNING id
    `,
    parameters: [
      stringParam('tenantId', tenantId),
      stringParam('questionHash', questionHash),
      stringParam('questionText', question),
      stringParam('contextHash', contextHash || ''),
      stringParam('cachedResponse', JSON.stringify(response)),
      stringParam('cachedBy', cachedBy || ''),
      longParam('ttl', ttl),
    ],
  });

  const cacheId = result.rows![0].id as string;
  logger.info('Cached question response', {
    tenantId,
    cacheId,
    questionHash,
    ttlMinutes: ttl,
  });

  return cacheId;
}

async function invalidateCache(
  tenantId: string,
  cacheId?: string,
  questionHash?: string,
  reason?: string
): Promise<number> {
  let sql: string;
  const parameters = [
    stringParam('tenantId', tenantId),
    stringParam('reason', reason || 'Manual invalidation'),
  ];

  if (cacheId) {
    sql = `
      UPDATE hitl_question_cache
      SET is_valid = false,
          invalidated_at = NOW(),
          invalidation_reason = :reason
      WHERE tenant_id = :tenantId AND id = :cacheId
    `;
    parameters.push(stringParam('cacheId', cacheId));
  } else if (questionHash) {
    sql = `
      UPDATE hitl_question_cache
      SET is_valid = false,
          invalidated_at = NOW(),
          invalidation_reason = :reason
      WHERE tenant_id = :tenantId AND question_hash = :questionHash
    `;
    parameters.push(stringParam('questionHash', questionHash));
  } else {
    // Invalidate all
    sql = `
      UPDATE hitl_question_cache
      SET is_valid = false,
          invalidated_at = NOW(),
          invalidation_reason = :reason
      WHERE tenant_id = :tenantId AND is_valid = true
    `;
  }

  const result = await executeStatement({ sql, parameters });
  const count = result.numberOfRecordsUpdated || 0;

  logger.info('Invalidated cache entries', {
    tenantId,
    cacheId,
    questionHash,
    count,
    reason,
  });

  return count;
}

// ============================================================================
// CLEANUP
// ============================================================================

async function cleanupExpiredCache(): Promise<number> {
  const result = await executeStatement({
    sql: `
      DELETE FROM hitl_question_cache
      WHERE expires_at < NOW()
        OR (is_valid = false AND invalidated_at < NOW() - INTERVAL '7 days')
      RETURNING id
    `,
    parameters: [],
  });

  const count = result.rows?.length || 0;
  if (count > 0) {
    logger.info('Cleaned up expired cache entries', { count });
  }

  return count;
}

async function enforceCacheSize(
  tenantId: string,
  maxSize: number = DEFAULT_CONFIG.maxCacheSize
): Promise<number> {
  // Count current entries
  const countResult = await executeStatement({
    sql: `
      SELECT COUNT(*) as count FROM hitl_question_cache
      WHERE tenant_id = :tenantId AND is_valid = true
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  const currentCount = Number(countResult.rows?.[0]?.count) || 0;
  
  if (currentCount <= maxSize) {
    return 0;
  }

  const toDelete = currentCount - maxSize;
  
  // Delete oldest, least-used entries
  const result = await executeStatement({
    sql: `
      DELETE FROM hitl_question_cache
      WHERE id IN (
        SELECT id FROM hitl_question_cache
        WHERE tenant_id = :tenantId AND is_valid = true
        ORDER BY hit_count ASC, last_hit_at ASC NULLS FIRST, created_at ASC
        LIMIT :toDelete
      )
      RETURNING id
    `,
    parameters: [
      stringParam('tenantId', tenantId),
      longParam('toDelete', toDelete),
    ],
  });

  const deletedCount = result.rows?.length || 0;
  logger.info('Enforced cache size limit', {
    tenantId,
    maxSize,
    previousCount: currentCount,
    deleted: deletedCount,
  });

  return deletedCount;
}

// ============================================================================
// STATISTICS
// ============================================================================

async function getCacheStatistics(tenantId: string): Promise<{
  totalEntries: number;
  validEntries: number;
  totalHits: number;
  avgHitsPerEntry: number;
  hitRate: number;
  oldestEntry: Date | null;
  topCachedQuestions: Array<{ question: string; hits: number }>;
}> {
  const statsResult = await executeStatement({
    sql: `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_valid THEN 1 END) as valid,
        SUM(hit_count) as total_hits,
        AVG(hit_count) as avg_hits,
        MIN(created_at) as oldest
      FROM hitl_question_cache
      WHERE tenant_id = :tenantId
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  const topResult = await executeStatement({
    sql: `
      SELECT question_text, hit_count
      FROM hitl_question_cache
      WHERE tenant_id = :tenantId AND is_valid = true
      ORDER BY hit_count DESC
      LIMIT 10
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  const stats = statsResult.rows?.[0] || {};
  const totalEntries = Number(stats.total) || 0;
  const totalHits = Number(stats.total_hits) || 0;

  return {
    totalEntries,
    validEntries: Number(stats.valid) || 0,
    totalHits,
    avgHitsPerEntry: Number(stats.avg_hits) || 0,
    hitRate: totalEntries > 0 ? totalHits / totalEntries : 0,
    oldestEntry: stats.oldest ? new Date(stats.oldest as string) : null,
    topCachedQuestions: (topResult.rows || []).map(row => ({
      question: row.question_text as string,
      hits: Number(row.hit_count),
    })),
  };
}

export const deduplicationService = {
  checkCache,
  cacheResponse,
  invalidateCache,
  cleanupExpiredCache,
  enforceCacheSize,
  getCacheStatistics,
  normalizeQuestion,
  hashString,
  DEFAULT_CONFIG,
};
