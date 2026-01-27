/**
 * RADIANT v5.52.29 - Multi-Language Search Service (PROMPT-41D)
 * 
 * Handles full-text search across all supported languages including CJK.
 * Uses pg_bigm for Chinese, Japanese, Korean and PostgreSQL FTS for Western languages.
 */

import { Pool } from 'pg';

// ============================================================================
// TYPES
// ============================================================================

export interface SearchOptions {
  tenantId: string;
  userId?: string;
  query: string;
  contentTypes?: ContentType[];
  limit?: number;
  offset?: number;
  language?: string;
}

export type ContentType = 'conversation' | 'upload' | 'knowledge' | 'entity';

export interface SearchResult {
  id: string;
  contentType: ContentType;
  title: string;
  summary?: string;
  relevance: number;
  detectedLanguage: string;
  createdAt: Date;
  highlights?: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  queryLanguage: string;
  searchMethod: 'bigm' | 'fts';
}

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

/**
 * Detect the language of a text string
 * Returns language code: en, zh, ja, ko, ar, ru, etc.
 */
export function detectLanguage(text: string): string {
  if (!text || text.trim().length === 0) {
    return 'en';
  }
  
  // Count CJK characters
  const cjkRegex = /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/g;
  const cjkMatches = text.match(cjkRegex) || [];
  const totalChars = text.replace(/\s/g, '').length;
  
  if (totalChars === 0) {
    return 'en';
  }
  
  const cjkRatio = cjkMatches.length / totalChars;
  
  // If more than 10% CJK characters, determine specific language
  if (cjkRatio > 0.1) {
    // Check for Japanese-specific characters (Hiragana, Katakana)
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
      return 'ja';
    }
    // Check for Korean-specific characters (Hangul)
    if (/[\uAC00-\uD7AF]/.test(text)) {
      return 'ko';
    }
    // Default to Chinese
    return 'zh';
  }
  
  // Check for Arabic
  if (/[\u0600-\u06FF]/.test(text)) {
    return 'ar';
  }
  
  // Check for Cyrillic (Russian)
  if (/[\u0400-\u04FF]/.test(text)) {
    return 'ru';
  }
  
  // Check for Devanagari (Hindi)
  if (/[\u0900-\u097F]/.test(text)) {
    return 'hi';
  }
  
  // Check for Thai
  if (/[\u0E00-\u0E7F]/.test(text)) {
    return 'th';
  }
  
  // Default to English for Latin script
  return 'en';
}

/**
 * Check if a language is CJK (requires bigm search)
 */
export function isCJKLanguage(lang: string): boolean {
  return ['zh', 'zh-CN', 'zh-TW', 'ja', 'ko'].includes(lang);
}

/**
 * Get PostgreSQL FTS config for a language
 */
export function getFTSConfig(lang: string): string {
  const configMap: Record<string, string> = {
    'en': 'english',
    'es': 'spanish',
    'fr': 'french',
    'de': 'german',
    'pt': 'portuguese',
    'it': 'italian',
    'nl': 'dutch',
    'ru': 'russian',
    'tr': 'turkish',
  };
  
  return configMap[lang] || 'simple';
}

// ============================================================================
// SEARCH SERVICE
// ============================================================================

export class MultiLanguageSearchService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Search content across all types with automatic language detection
   */
  async search(options: SearchOptions): Promise<SearchResponse> {
    const {
      tenantId,
      userId,
      query,
      contentTypes = ['conversation'],
      limit = 20,
      offset = 0,
      language,
    } = options;

    // Detect or use provided language
    const queryLanguage = language || detectLanguage(query);
    const useBigm = isCJKLanguage(queryLanguage);

    if (useBigm) {
      return this.searchWithBigm(tenantId, userId, query, contentTypes, limit, offset, queryLanguage);
    } else {
      return this.searchWithFTS(tenantId, userId, query, contentTypes, limit, offset, queryLanguage);
    }
  }

  /**
   * Search using pg_bigm (for CJK languages)
   */
  private async searchWithBigm(
    tenantId: string,
    userId: string | undefined,
    query: string,
    contentTypes: ContentType[],
    limit: number,
    offset: number,
    queryLanguage: string
  ): Promise<SearchResponse> {
    const params: (string | number)[] = [tenantId, `%${query}%`];
    let paramIndex = 3;

    let userFilter = '';
    if (userId) {
      userFilter = `AND c.user_id = $${paramIndex++}`;
      params.push(userId);
    }

    const sql = `
      SELECT 
        c.id,
        'conversation' as content_type,
        c.title,
        c.summary,
        bigm_similarity($2, COALESCE(c.title, '') || ' ' || COALESCE(c.summary, '')) as relevance,
        c.detected_language,
        c.created_at,
        COUNT(*) OVER() as total_count
      FROM uds_conversations c
      WHERE c.tenant_id = $1
        ${userFilter}
        AND (c.title LIKE $2 OR c.summary LIKE $2)
      ORDER BY relevance DESC, c.created_at DESC
      LIMIT $${paramIndex++}
      OFFSET $${paramIndex++}
    `;
    
    params.push(limit, offset);

    const result = await this.pool.query(sql, params);

    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    const results: SearchResult[] = result.rows.map(row => ({
      id: row.id,
      contentType: row.content_type as ContentType,
      title: row.title,
      summary: row.summary,
      relevance: parseFloat(row.relevance) || 0,
      detectedLanguage: row.detected_language,
      createdAt: row.created_at,
      highlights: this.generateHighlights(row.title, row.summary, query),
    }));

    return {
      results,
      total,
      queryLanguage,
      searchMethod: 'bigm',
    };
  }

  /**
   * Search using PostgreSQL FTS (for Western languages)
   */
  private async searchWithFTS(
    tenantId: string,
    userId: string | undefined,
    query: string,
    contentTypes: ContentType[],
    limit: number,
    offset: number,
    queryLanguage: string
  ): Promise<SearchResponse> {
    const ftsConfig = getFTSConfig(queryLanguage);
    const params: (string | number)[] = [tenantId, query];
    let paramIndex = 3;

    let userFilter = '';
    if (userId) {
      userFilter = `AND c.user_id = $${paramIndex++}`;
      params.push(userId);
    }

    const sql = `
      SELECT 
        c.id,
        'conversation' as content_type,
        c.title,
        c.summary,
        CASE 
          WHEN c.search_vector_english IS NOT NULL 
          THEN ts_rank(c.search_vector_english, plainto_tsquery('${ftsConfig}', $2))
          ELSE ts_rank(c.search_vector_simple, plainto_tsquery('simple', $2))
        END as relevance,
        c.detected_language,
        c.created_at,
        COUNT(*) OVER() as total_count
      FROM uds_conversations c
      WHERE c.tenant_id = $1
        ${userFilter}
        AND (
          c.search_vector_english @@ plainto_tsquery('${ftsConfig}', $2)
          OR c.search_vector_simple @@ plainto_tsquery('simple', $2)
        )
      ORDER BY relevance DESC, c.created_at DESC
      LIMIT $${paramIndex++}
      OFFSET $${paramIndex++}
    `;
    
    params.push(limit, offset);

    const result = await this.pool.query(sql, params);

    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    const results: SearchResult[] = result.rows.map(row => ({
      id: row.id,
      contentType: row.content_type as ContentType,
      title: row.title,
      summary: row.summary,
      relevance: parseFloat(row.relevance) || 0,
      detectedLanguage: row.detected_language,
      createdAt: row.created_at,
      highlights: this.generateHighlights(row.title, row.summary, query),
    }));

    return {
      results,
      total,
      queryLanguage,
      searchMethod: 'fts',
    };
  }

  /**
   * Generate search result highlights
   */
  private generateHighlights(title: string, summary: string | null, query: string): string[] {
    const highlights: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Find query in title
    const titleLower = (title || '').toLowerCase();
    const titleIndex = titleLower.indexOf(lowerQuery);
    if (titleIndex !== -1) {
      const start = Math.max(0, titleIndex - 20);
      const end = Math.min(title.length, titleIndex + query.length + 20);
      let highlight = title.substring(start, end);
      if (start > 0) highlight = '...' + highlight;
      if (end < title.length) highlight = highlight + '...';
      highlights.push(highlight);
    }
    
    // Find query in summary
    if (summary) {
      const summaryLower = summary.toLowerCase();
      const summaryIndex = summaryLower.indexOf(lowerQuery);
      if (summaryIndex !== -1) {
        const start = Math.max(0, summaryIndex - 30);
        const end = Math.min(summary.length, summaryIndex + query.length + 30);
        let highlight = summary.substring(start, end);
        if (start > 0) highlight = '...' + highlight;
        if (end < summary.length) highlight = highlight + '...';
        highlights.push(highlight);
      }
    }
    
    return highlights;
  }
}

export default MultiLanguageSearchService;
