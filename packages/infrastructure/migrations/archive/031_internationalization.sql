-- RADIANT v4.17.0 - Migration 031: Complete Internationalization System
-- Database-driven localization with 18 languages

CREATE TABLE localization_languages (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    native_name VARCHAR(100) NOT NULL,
    is_rtl BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE localization_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(200) NOT NULL UNIQUE,
    default_text TEXT NOT NULL,
    context TEXT,
    category VARCHAR(100) NOT NULL,
    max_length INTEGER,
    placeholders TEXT[],
    is_plural BOOLEAN DEFAULT false,
    plural_forms JSONB,
    app_id VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE translation_status AS ENUM ('pending', 'ai_translated', 'needs_review', 'approved', 'rejected');

CREATE TABLE localization_translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registry_id UUID NOT NULL REFERENCES localization_registry(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL REFERENCES localization_languages(code),
    translated_text TEXT NOT NULL,
    status translation_status NOT NULL DEFAULT 'pending',
    translator_type VARCHAR(20) CHECK (translator_type IN ('human', 'ai', 'imported')),
    translator_id UUID,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    quality_score DECIMAL(3, 2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(registry_id, language_code)
);

CREATE TABLE localization_translation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    translation_id UUID NOT NULL REFERENCES localization_translations(id) ON DELETE CASCADE,
    previous_text TEXT NOT NULL,
    new_text TEXT NOT NULL,
    previous_status translation_status,
    new_status translation_status,
    changed_by UUID,
    change_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE localization_bundles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    language_code VARCHAR(10) NOT NULL REFERENCES localization_languages(code),
    app_id VARCHAR(50),
    category VARCHAR(100),
    bundle_data JSONB NOT NULL,
    bundle_hash VARCHAR(64) NOT NULL,
    entry_count INTEGER NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE(language_code, app_id, category)
);

CREATE INDEX idx_localization_registry_key ON localization_registry(key);
CREATE INDEX idx_localization_registry_category ON localization_registry(category);
CREATE INDEX idx_localization_registry_app ON localization_registry(app_id);
CREATE INDEX idx_localization_translations_registry ON localization_translations(registry_id);
CREATE INDEX idx_localization_translations_language ON localization_translations(language_code);
CREATE INDEX idx_localization_translations_status ON localization_translations(status);
CREATE INDEX idx_localization_bundles_language ON localization_bundles(language_code);

ALTER TABLE localization_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE localization_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE localization_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE localization_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY localization_languages_read ON localization_languages FOR SELECT USING (true);
CREATE POLICY localization_registry_read ON localization_registry FOR SELECT USING (true);
CREATE POLICY localization_translations_read ON localization_translations FOR SELECT USING (true);
CREATE POLICY localization_bundles_read ON localization_bundles FOR SELECT USING (true);

-- Insert supported languages (18)
INSERT INTO localization_languages (code, name, native_name, is_rtl, display_order) VALUES
    ('en', 'English', 'English', false, 1),
    ('es', 'Spanish', 'Español', false, 2),
    ('fr', 'French', 'Français', false, 3),
    ('de', 'German', 'Deutsch', false, 4),
    ('pt', 'Portuguese', 'Português', false, 5),
    ('it', 'Italian', 'Italiano', false, 6),
    ('nl', 'Dutch', 'Nederlands', false, 7),
    ('pl', 'Polish', 'Polski', false, 8),
    ('ru', 'Russian', 'Русский', false, 9),
    ('tr', 'Turkish', 'Türkçe', false, 10),
    ('ja', 'Japanese', '日本語', false, 11),
    ('ko', 'Korean', '한국어', false, 12),
    ('zh-CN', 'Chinese (Simplified)', '简体中文', false, 13),
    ('zh-TW', 'Chinese (Traditional)', '繁體中文', false, 14),
    ('ar', 'Arabic', 'العربية', true, 15),
    ('hi', 'Hindi', 'हिन्दी', false, 16),
    ('th', 'Thai', 'ไทย', false, 17),
    ('vi', 'Vietnamese', 'Tiếng Việt', false, 18);

-- Function to get translation with fallback
CREATE OR REPLACE FUNCTION get_translation(
    p_key VARCHAR(200),
    p_language VARCHAR(10),
    p_placeholders JSONB DEFAULT '{}'
) RETURNS TEXT AS $$
DECLARE
    v_text TEXT;
BEGIN
    -- Try exact language match
    SELECT lt.translated_text INTO v_text
    FROM localization_registry lr
    JOIN localization_translations lt ON lr.id = lt.registry_id
    WHERE lr.key = p_key 
    AND lt.language_code = p_language 
    AND lt.status = 'approved';
    
    -- Fall back to English
    IF v_text IS NULL THEN
        SELECT lr.default_text INTO v_text
        FROM localization_registry lr
        WHERE lr.key = p_key;
    END IF;
    
    RETURN COALESCE(v_text, p_key);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE TRIGGER update_localization_languages_updated_at 
    BEFORE UPDATE ON localization_languages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_localization_registry_updated_at 
    BEFORE UPDATE ON localization_registry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_localization_translations_updated_at 
    BEFORE UPDATE ON localization_translations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
