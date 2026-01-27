-- ============================================================================
-- RADIANT v5.52.29 - Multi-Language Full-Text Search (PROMPT-41D)
-- Migration: 071_multilang_search.sql
-- Adds pg_bigm for CJK support and language-aware search
-- ============================================================================

-- ============================================================================
-- ENABLE pg_bigm EXTENSION (available in Aurora PostgreSQL)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_bigm;

-- ============================================================================
-- ADD LANGUAGE COLUMN TO SEARCHABLE TABLES
-- ============================================================================

-- Add detected_language column to track content language
ALTER TABLE uds_conversations 
  ADD COLUMN IF NOT EXISTS detected_language VARCHAR(10) DEFAULT 'en';

ALTER TABLE uds_uploads 
  ADD COLUMN IF NOT EXISTS detected_language VARCHAR(10) DEFAULT 'en';

ALTER TABLE cortex_entities 
  ADD COLUMN IF NOT EXISTS detected_language VARCHAR(10) DEFAULT 'en';

ALTER TABLE cortex_chunks 
  ADD COLUMN IF NOT EXISTS detected_language VARCHAR(10) DEFAULT 'en';

-- ============================================================================
-- CREATE pg_bigm INDEXES FOR CJK SUPPORT
-- ============================================================================

-- Conversations: bi-gram index on title and summary
CREATE INDEX IF NOT EXISTS idx_conversations_bigm_title 
  ON uds_conversations 
  USING gin (title gin_bigm_ops);

CREATE INDEX IF NOT EXISTS idx_conversations_bigm_summary 
  ON uds_conversations 
  USING gin (summary gin_bigm_ops) 
  WHERE summary IS NOT NULL;

-- Uploads: bi-gram index on extracted text
CREATE INDEX IF NOT EXISTS idx_uploads_bigm_text 
  ON uds_uploads 
  USING gin (extracted_text gin_bigm_ops) 
  WHERE extracted_text IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_uploads_bigm_ocr 
  ON uds_uploads 
  USING gin (ocr_text gin_bigm_ops) 
  WHERE ocr_text IS NOT NULL;

-- Cortex entities: bi-gram index on name and description
CREATE INDEX IF NOT EXISTS idx_cortex_entities_bigm_name 
  ON cortex_entities 
  USING gin (name gin_bigm_ops);

CREATE INDEX IF NOT EXISTS idx_cortex_entities_bigm_desc 
  ON cortex_entities 
  USING gin (description gin_bigm_ops) 
  WHERE description IS NOT NULL;

-- Cortex chunks: bi-gram index on content
CREATE INDEX IF NOT EXISTS idx_cortex_chunks_bigm_content 
  ON cortex_chunks 
  USING gin (content gin_bigm_ops);

-- ============================================================================
-- LANGUAGE-SPECIFIC TSVECTOR COLUMNS (for non-CJK)
-- ============================================================================

-- Add tsvector columns for different language configs
ALTER TABLE uds_conversations 
  ADD COLUMN IF NOT EXISTS search_vector_simple TSVECTOR;

ALTER TABLE uds_conversations 
  ADD COLUMN IF NOT EXISTS search_vector_english TSVECTOR;

-- Create GIN indexes on tsvector columns
CREATE INDEX IF NOT EXISTS idx_conversations_fts_simple 
  ON uds_conversations 
  USING GIN (search_vector_simple);

CREATE INDEX IF NOT EXISTS idx_conversations_fts_english 
  ON uds_conversations 
  USING GIN (search_vector_english);

-- ============================================================================
-- LANGUAGE DETECTION FUNCTION
-- ============================================================================

-- Function to detect language from text
CREATE OR REPLACE FUNCTION detect_text_language(input_text TEXT)
RETURNS VARCHAR(10) AS $$
DECLARE
  cjk_count INTEGER;
  total_count INTEGER;
  cjk_ratio FLOAT;
BEGIN
  IF input_text IS NULL OR LENGTH(input_text) = 0 THEN
    RETURN 'en';
  END IF;
  
  -- Count CJK characters (Chinese, Japanese, Korean Unicode ranges)
  -- CJK Unified Ideographs: U+4E00 to U+9FFF
  -- Hiragana: U+3040 to U+309F
  -- Katakana: U+30A0 to U+30FF
  -- Hangul: U+AC00 to U+D7AF
  cjk_count := LENGTH(
    REGEXP_REPLACE(
      input_text, 
      '[^\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]', 
      '', 
      'g'
    )
  );
  
  total_count := LENGTH(REGEXP_REPLACE(input_text, '\s', '', 'g'));
  
  IF total_count = 0 THEN
    RETURN 'en';
  END IF;
  
  cjk_ratio := cjk_count::FLOAT / total_count::FLOAT;
  
  -- If more than 10% CJK characters, consider it CJK content
  IF cjk_ratio > 0.1 THEN
    -- Presence of Hiragana/Katakana → Japanese
    IF input_text ~ '[\u3040-\u309F\u30A0-\u30FF]' THEN
      RETURN 'ja';
    -- Presence of Hangul → Korean
    ELSIF input_text ~ '[\uAC00-\uD7AF]' THEN
      RETURN 'ko';
    -- Default CJK to Chinese
    ELSE
      RETURN 'zh';
    END IF;
  END IF;
  
  -- Check for Arabic script
  IF input_text ~ '[\u0600-\u06FF]' THEN
    RETURN 'ar';
  END IF;
  
  -- Check for Cyrillic (Russian)
  IF input_text ~ '[\u0400-\u04FF]' THEN
    RETURN 'ru';
  END IF;
  
  -- Default to English for Latin script
  RETURN 'en';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- TRIGGER TO UPDATE LANGUAGE AND SEARCH VECTORS
-- ============================================================================

-- Function to update search vectors based on language
CREATE OR REPLACE FUNCTION update_conversation_search()
RETURNS TRIGGER AS $$
DECLARE
  combined_text TEXT;
  lang VARCHAR(10);
BEGIN
  combined_text := COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.summary, '');
  lang := detect_text_language(combined_text);
  
  NEW.detected_language := lang;
  
  -- Always update simple tsvector (works for all languages as fallback)
  NEW.search_vector_simple := to_tsvector('simple', combined_text);
  
  -- Update language-specific tsvector for supported languages
  IF lang = 'en' THEN
    NEW.search_vector_english := to_tsvector('english', combined_text);
  ELSIF lang = 'es' THEN
    NEW.search_vector_english := to_tsvector('spanish', combined_text);
  ELSIF lang = 'fr' THEN
    NEW.search_vector_english := to_tsvector('french', combined_text);
  ELSIF lang = 'de' THEN
    NEW.search_vector_english := to_tsvector('german', combined_text);
  ELSIF lang = 'ru' THEN
    NEW.search_vector_english := to_tsvector('russian', combined_text);
  ELSIF lang = 'pt' THEN
    NEW.search_vector_english := to_tsvector('portuguese', combined_text);
  ELSIF lang = 'it' THEN
    NEW.search_vector_english := to_tsvector('italian', combined_text);
  ELSIF lang = 'nl' THEN
    NEW.search_vector_english := to_tsvector('dutch', combined_text);
  ELSIF lang = 'tr' THEN
    NEW.search_vector_english := to_tsvector('turkish', combined_text);
  ELSE
    -- For CJK and other languages, just use simple config
    NEW.search_vector_english := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trg_conversation_search_update ON uds_conversations;
CREATE TRIGGER trg_conversation_search_update
  BEFORE INSERT OR UPDATE OF title, summary ON uds_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_search();

-- ============================================================================
-- UNIFIED SEARCH FUNCTION
-- ============================================================================

-- Unified search function that handles all languages
CREATE OR REPLACE FUNCTION search_content(
  search_query TEXT,
  p_tenant_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  content_type VARCHAR(50),
  title TEXT,
  summary TEXT,
  relevance FLOAT,
  detected_language VARCHAR(10),
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  query_lang VARCHAR(10);
  is_cjk BOOLEAN;
BEGIN
  -- Detect query language
  query_lang := detect_text_language(search_query);
  is_cjk := query_lang IN ('zh', 'ja', 'ko');
  
  IF is_cjk THEN
    -- Use pg_bigm LIKE search for CJK
    RETURN QUERY
    SELECT 
      c.id,
      'conversation'::VARCHAR(50) as content_type,
      c.title,
      c.summary,
      -- Relevance based on bigm similarity
      bigm_similarity(search_query, COALESCE(c.title, '') || ' ' || COALESCE(c.summary, '')) as relevance,
      c.detected_language,
      c.created_at
    FROM uds_conversations c
    WHERE c.tenant_id = p_tenant_id
      AND (p_user_id IS NULL OR c.user_id = p_user_id)
      AND (
        c.title LIKE '%' || search_query || '%'
        OR c.summary LIKE '%' || search_query || '%'
      )
    ORDER BY relevance DESC, c.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
  ELSE
    -- Use tsvector search for Western languages
    RETURN QUERY
    SELECT 
      c.id,
      'conversation'::VARCHAR(50) as content_type,
      c.title,
      c.summary,
      -- Relevance based on ts_rank
      CASE 
        WHEN c.search_vector_english IS NOT NULL 
        THEN ts_rank(c.search_vector_english, plainto_tsquery('english', search_query))
        ELSE ts_rank(c.search_vector_simple, plainto_tsquery('simple', search_query))
      END as relevance,
      c.detected_language,
      c.created_at
    FROM uds_conversations c
    WHERE c.tenant_id = p_tenant_id
      AND (p_user_id IS NULL OR c.user_id = p_user_id)
      AND (
        c.search_vector_english @@ plainto_tsquery('english', search_query)
        OR c.search_vector_simple @@ plainto_tsquery('simple', search_query)
      )
    ORDER BY relevance DESC, c.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION search_content TO radiant_app;
GRANT EXECUTE ON FUNCTION detect_text_language TO radiant_app;

-- ============================================================================
-- BACKFILL EXISTING DATA
-- ============================================================================

-- Update existing conversations with language detection and search vectors
UPDATE uds_conversations 
SET 
  detected_language = detect_text_language(COALESCE(title, '') || ' ' || COALESCE(summary, '')),
  search_vector_simple = to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(summary, ''))
WHERE detected_language = 'en' OR search_vector_simple IS NULL;

-- Update English tsvector for detected English content
UPDATE uds_conversations 
SET search_vector_english = to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(summary, ''))
WHERE detected_language = 'en';

-- ============================================================================
-- VERIFY INSTALLATION
-- ============================================================================

DO $$
BEGIN
  -- Verify pg_bigm is installed
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_bigm') THEN
    RAISE EXCEPTION 'pg_bigm extension is not installed';
  END IF;
  
  RAISE NOTICE 'Migration 071: Multi-language search setup complete';
  RAISE NOTICE 'pg_bigm extension: INSTALLED';
  RAISE NOTICE 'CJK bi-gram indexes: CREATED';
  RAISE NOTICE 'Language detection function: CREATED';
  RAISE NOTICE 'Unified search function: CREATED';
END $$;
