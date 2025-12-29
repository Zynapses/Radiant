-- Migration: 080_user_memory_rules
-- Description: User memory rules system - persistent user preferences that apply to AI responses
-- Similar to Windsurf policies but for end users in Think Tank
-- Author: RADIANT System
-- Date: 2024-12-28

-- ============================================================================
-- User Memory Rules - Personal rules users set for their AI interactions
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_memory_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Rule content
    rule_text TEXT NOT NULL,
    rule_summary VARCHAR(255),  -- Short summary for display
    
    -- Categorization
    rule_type VARCHAR(50) NOT NULL DEFAULT 'preference',
    -- Types: restriction, preference, format, source, tone, topic, privacy, accessibility
    
    -- Priority for conflict resolution (higher = more important)
    priority INTEGER NOT NULL DEFAULT 50,
    
    -- Source tracking
    source VARCHAR(50) NOT NULL DEFAULT 'user_created',
    -- Sources: user_created, preset_added, ai_suggested, imported
    preset_id UUID,  -- If added from preset
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Application scope
    apply_to_preprompts BOOLEAN NOT NULL DEFAULT true,
    apply_to_synthesis BOOLEAN NOT NULL DEFAULT true,
    apply_to_responses BOOLEAN NOT NULL DEFAULT true,
    
    -- Optional: limit to specific domains/modes
    applicable_domains TEXT[] DEFAULT '{}',  -- Empty = all domains
    applicable_modes TEXT[] DEFAULT '{}',    -- Empty = all modes
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_applied_at TIMESTAMPTZ,
    times_applied INTEGER NOT NULL DEFAULT 0,
    
    CONSTRAINT valid_rule_type CHECK (rule_type IN (
        'restriction', 'preference', 'format', 'source', 
        'tone', 'topic', 'privacy', 'accessibility', 'other'
    )),
    CONSTRAINT valid_source CHECK (source IN (
        'user_created', 'preset_added', 'ai_suggested', 'imported'
    )),
    CONSTRAINT valid_priority CHECK (priority >= 0 AND priority <= 100)
);

-- ============================================================================
-- Preset Rules - Pre-seeded rules users can add from
-- ============================================================================

CREATE TABLE IF NOT EXISTS preset_user_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Rule content
    rule_text TEXT NOT NULL,
    rule_summary VARCHAR(255) NOT NULL,
    description TEXT,  -- Longer explanation for users
    
    -- Categorization
    rule_type VARCHAR(50) NOT NULL,
    category VARCHAR(100) NOT NULL,  -- For grouping in UI: "Privacy", "Format", "Sources", etc.
    
    -- Display
    display_order INTEGER NOT NULL DEFAULT 0,
    icon VARCHAR(50),  -- Lucide icon name
    is_popular BOOLEAN NOT NULL DEFAULT false,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Targeting
    min_tier INTEGER DEFAULT 1,  -- Minimum subscription tier to see this preset
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- User Rule Application Log - Track when rules are applied
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_rule_application_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES user_memory_rules(id) ON DELETE CASCADE,
    plan_id UUID,  -- AGI Brain plan where rule was applied
    preprompt_instance_id UUID,  -- Pre-prompt instance if applicable
    
    -- Application details
    application_context VARCHAR(100) NOT NULL,  -- 'preprompt', 'synthesis', 'response'
    was_effective BOOLEAN,  -- Feedback: did the rule achieve its goal?
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_user_memory_rules_user ON user_memory_rules(user_id);
CREATE INDEX idx_user_memory_rules_tenant ON user_memory_rules(tenant_id);
CREATE INDEX idx_user_memory_rules_active ON user_memory_rules(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_user_memory_rules_type ON user_memory_rules(rule_type);
CREATE INDEX idx_preset_user_rules_category ON preset_user_rules(category, display_order);
CREATE INDEX idx_preset_user_rules_active ON preset_user_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_user_rule_application_log_rule ON user_rule_application_log(rule_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE user_memory_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rule_application_log ENABLE ROW LEVEL SECURITY;

-- Users can only see their own rules
CREATE POLICY user_memory_rules_tenant_isolation ON user_memory_rules
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY user_memory_rules_user_isolation ON user_memory_rules
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY user_rule_application_log_isolation ON user_rule_application_log
    FOR ALL USING (
        rule_id IN (
            SELECT id FROM user_memory_rules 
            WHERE user_id = current_setting('app.current_user_id')::UUID
        )
    );

-- Preset rules are readable by all authenticated users (no tenant restriction)
-- No RLS needed for preset_user_rules as they're global

-- ============================================================================
-- Functions
-- ============================================================================

-- Get active rules for a user, formatted for preprompt injection
CREATE OR REPLACE FUNCTION get_user_rules_for_preprompt(
    p_user_id UUID,
    p_domain_id TEXT DEFAULT NULL,
    p_mode TEXT DEFAULT NULL
)
RETURNS TABLE (
    rule_id UUID,
    rule_text TEXT,
    rule_type VARCHAR(50),
    priority INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.rule_text,
        r.rule_type,
        r.priority
    FROM user_memory_rules r
    WHERE r.user_id = p_user_id
      AND r.is_active = true
      AND r.apply_to_preprompts = true
      AND (
          array_length(r.applicable_domains, 1) IS NULL 
          OR p_domain_id = ANY(r.applicable_domains)
      )
      AND (
          array_length(r.applicable_modes, 1) IS NULL 
          OR p_mode = ANY(r.applicable_modes)
      )
    ORDER BY r.priority DESC, r.created_at ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Format rules as a system prompt section
CREATE OR REPLACE FUNCTION format_user_rules_for_prompt(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    rules_text TEXT := '';
    rule_record RECORD;
BEGIN
    FOR rule_record IN 
        SELECT rule_text, rule_type 
        FROM get_user_rules_for_preprompt(p_user_id)
    LOOP
        rules_text := rules_text || '- ' || rule_record.rule_text || E'\n';
    END LOOP;
    
    IF rules_text = '' THEN
        RETURN NULL;
    END IF;
    
    RETURN E'\n## User Preferences\nThe user has set the following rules for how you should respond:\n' || rules_text;
END;
$$ LANGUAGE plpgsql STABLE;

-- Update rule application stats
CREATE OR REPLACE FUNCTION update_rule_application_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE user_memory_rules
    SET times_applied = times_applied + 1,
        last_applied_at = NOW()
    WHERE id = NEW.rule_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_rule_application_stats
    AFTER INSERT ON user_rule_application_log
    FOR EACH ROW
    EXECUTE FUNCTION update_rule_application_stats();

-- ============================================================================
-- Seed Preset Rules
-- ============================================================================

INSERT INTO preset_user_rules (rule_text, rule_summary, description, rule_type, category, display_order, icon, is_popular) VALUES
-- Privacy & Safety
('Do not discuss or reference my personal information, previous conversations, or make assumptions about my identity.', 
 'Protect my privacy', 
 'Prevents the AI from making personal references or assumptions about you.',
 'privacy', 'Privacy & Safety', 10, 'Shield', true),

('Do not discuss religious topics or make references to any specific religion or religious beliefs.',
 'No religious content',
 'Filters out religious discussions and references from responses.',
 'restriction', 'Privacy & Safety', 20, 'Ban', true),

('Do not discuss political topics, political parties, or express political opinions.',
 'No political content',
 'Keeps responses neutral and free from political discussions.',
 'restriction', 'Privacy & Safety', 30, 'Ban', false),

-- Sources & Citations
('Always provide sources and citations for factual claims. Include URLs or references where possible.',
 'Always cite sources',
 'Ensures responses include verifiable sources for facts and claims.',
 'source', 'Sources & Citations', 10, 'BookOpen', true),

('When discussing scientific topics, prioritize peer-reviewed sources and academic research.',
 'Prefer academic sources',
 'Prioritizes scholarly and peer-reviewed content over general sources.',
 'source', 'Sources & Citations', 20, 'GraduationCap', false),

('Include publication dates for sources when available so I can assess recency.',
 'Include source dates',
 'Helps you evaluate how current the information is.',
 'source', 'Sources & Citations', 30, 'Calendar', false),

-- Response Format
('Keep responses concise and to the point. Avoid unnecessary elaboration unless I ask for more detail.',
 'Be concise',
 'Produces shorter, more focused responses.',
 'format', 'Response Format', 10, 'AlignLeft', true),

('Use bullet points and numbered lists to organize information when appropriate.',
 'Use lists for clarity',
 'Makes complex information easier to scan and understand.',
 'format', 'Response Format', 20, 'List', true),

('Structure longer responses with clear headings and sections.',
 'Use headings',
 'Organizes longer content with clear section headers.',
 'format', 'Response Format', 30, 'Heading', false),

('When providing code, always include comments explaining what each section does.',
 'Comment code',
 'Ensures code examples are well-documented and easy to understand.',
 'format', 'Response Format', 40, 'Code', false),

-- Tone & Style
('Use a professional and formal tone in all responses.',
 'Professional tone',
 'Maintains a business-appropriate communication style.',
 'tone', 'Tone & Style', 10, 'Briefcase', false),

('Use a friendly and conversational tone. Feel free to be casual.',
 'Casual tone',
 'Creates a more relaxed, conversational interaction style.',
 'tone', 'Tone & Style', 20, 'Smile', false),

('Explain technical concepts in simple terms, avoiding jargon unless necessary.',
 'Simple explanations',
 'Makes complex topics accessible without oversimplifying.',
 'tone', 'Tone & Style', 30, 'Lightbulb', true),

-- Accessibility
('Use clear, simple language. I prefer responses that are easy to read and understand.',
 'Clear language',
 'Optimizes responses for readability and comprehension.',
 'accessibility', 'Accessibility', 10, 'Eye', false),

('Avoid using idioms, metaphors, or figures of speech that might be confusing.',
 'Literal language',
 'Uses direct, literal language for clearer communication.',
 'accessibility', 'Accessibility', 20, 'MessageSquare', false),

-- Topic Preferences
('When discussing health topics, always recommend consulting a healthcare professional.',
 'Health disclaimer',
 'Ensures medical discussions include appropriate professional consultation advice.',
 'topic', 'Topic Preferences', 10, 'Heart', false),

('For financial topics, remind me that this is not financial advice and I should consult a professional.',
 'Financial disclaimer',
 'Includes appropriate disclaimers for financial discussions.',
 'topic', 'Topic Preferences', 20, 'DollarSign', false),

-- Advanced
('If you are uncertain about something, clearly state your uncertainty rather than guessing.',
 'Acknowledge uncertainty',
 'Promotes honesty about knowledge limitations.',
 'preference', 'Advanced', 10, 'HelpCircle', true),

('When I ask a question, first make sure you understand it correctly before answering.',
 'Clarify before answering',
 'Reduces misunderstandings by confirming question interpretation.',
 'preference', 'Advanced', 20, 'MessageCircle', false),

('Present multiple perspectives on controversial or debatable topics.',
 'Show multiple viewpoints',
 'Provides balanced coverage of complex issues.',
 'preference', 'Advanced', 30, 'Scale', false)

ON CONFLICT DO NOTHING;

-- ============================================================================
-- Grants
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON user_memory_rules TO authenticated;
GRANT SELECT ON preset_user_rules TO authenticated;
GRANT SELECT, INSERT ON user_rule_application_log TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_rules_for_preprompt TO authenticated;
GRANT EXECUTE ON FUNCTION format_user_rules_for_prompt TO authenticated;
