-- Migration: 081_memory_categories
-- Description: Add memory categorization to user rules - extensible system for classifying what each memory IS
-- Author: RADIANT System
-- Date: 2024-12-28

-- ============================================================================
-- Memory Categories - What type of memory/rule is this?
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Category identification
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Hierarchy (for future expansion)
    parent_id UUID REFERENCES memory_categories(id),
    level INTEGER NOT NULL DEFAULT 1,
    path VARCHAR(500),  -- Materialized path like 'preferences.format.code'
    
    -- Display
    icon VARCHAR(50),
    color VARCHAR(20),  -- Tailwind color class
    display_order INTEGER NOT NULL DEFAULT 0,
    
    -- Behavior
    is_system BOOLEAN NOT NULL DEFAULT false,  -- System categories can't be deleted
    is_expandable BOOLEAN NOT NULL DEFAULT true,  -- Can users add sub-categories?
    applies_to TEXT[] DEFAULT ARRAY['preprompt', 'synthesis', 'response'],
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Add category to user_memory_rules
-- ============================================================================

ALTER TABLE user_memory_rules 
ADD COLUMN IF NOT EXISTS memory_category_id UUID REFERENCES memory_categories(id);

ALTER TABLE user_memory_rules
ADD COLUMN IF NOT EXISTS memory_category_code VARCHAR(50);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_memory_categories_parent ON memory_categories(parent_id);
CREATE INDEX idx_memory_categories_code ON memory_categories(code);
CREATE INDEX idx_memory_categories_path ON memory_categories(path);
CREATE INDEX idx_user_memory_rules_category ON user_memory_rules(memory_category_id);
CREATE INDEX idx_user_memory_rules_category_code ON user_memory_rules(memory_category_code);

-- ============================================================================
-- Seed System Categories
-- ============================================================================

INSERT INTO memory_categories (code, name, description, icon, color, display_order, is_system, level, path) VALUES
-- Top-level categories
('instruction', 'Instruction', 'Direct instructions for how the AI should behave', 'Wand2', 'purple', 10, true, 1, 'instruction'),
('preference', 'Preference', 'User preferences that guide but do not mandate behavior', 'Heart', 'pink', 20, true, 1, 'preference'),
('context', 'Context', 'Background information about the user or their work', 'User', 'blue', 30, true, 1, 'context'),
('knowledge', 'Knowledge', 'Facts, definitions, or information to remember', 'BookOpen', 'green', 40, true, 1, 'knowledge'),
('constraint', 'Constraint', 'Hard limits or restrictions that must be followed', 'Ban', 'red', 50, true, 1, 'constraint'),
('goal', 'Goal', 'User objectives and desired outcomes', 'Target', 'amber', 60, true, 1, 'goal')
ON CONFLICT (code) DO NOTHING;

-- Sub-categories under Instruction
INSERT INTO memory_categories (code, name, description, icon, color, display_order, is_system, level, path, parent_id) VALUES
('instruction.format', 'Format Instructions', 'How to structure and format responses', 'AlignLeft', 'purple', 11, true, 2, 'instruction.format', 
 (SELECT id FROM memory_categories WHERE code = 'instruction')),
('instruction.tone', 'Tone Instructions', 'Communication style and voice', 'MessageSquare', 'purple', 12, true, 2, 'instruction.tone',
 (SELECT id FROM memory_categories WHERE code = 'instruction')),
('instruction.source', 'Source Instructions', 'Citation and reference requirements', 'Quote', 'purple', 13, true, 2, 'instruction.source',
 (SELECT id FROM memory_categories WHERE code = 'instruction'))
ON CONFLICT (code) DO NOTHING;

-- Sub-categories under Preference
INSERT INTO memory_categories (code, name, description, icon, color, display_order, is_system, level, path, parent_id) VALUES
('preference.style', 'Style Preferences', 'Preferred writing and communication style', 'Palette', 'pink', 21, true, 2, 'preference.style',
 (SELECT id FROM memory_categories WHERE code = 'preference')),
('preference.detail', 'Detail Level', 'How much detail and elaboration to provide', 'Layers', 'pink', 22, true, 2, 'preference.detail',
 (SELECT id FROM memory_categories WHERE code = 'preference'))
ON CONFLICT (code) DO NOTHING;

-- Sub-categories under Context
INSERT INTO memory_categories (code, name, description, icon, color, display_order, is_system, level, path, parent_id) VALUES
('context.personal', 'Personal Context', 'Information about the user personally', 'User', 'blue', 31, true, 2, 'context.personal',
 (SELECT id FROM memory_categories WHERE code = 'context')),
('context.work', 'Work Context', 'Professional or work-related context', 'Briefcase', 'blue', 32, true, 2, 'context.work',
 (SELECT id FROM memory_categories WHERE code = 'context')),
('context.project', 'Project Context', 'Information about specific projects', 'Folder', 'blue', 33, true, 2, 'context.project',
 (SELECT id FROM memory_categories WHERE code = 'context'))
ON CONFLICT (code) DO NOTHING;

-- Sub-categories under Knowledge
INSERT INTO memory_categories (code, name, description, icon, color, display_order, is_system, level, path, parent_id) VALUES
('knowledge.fact', 'Facts', 'Specific facts to remember', 'Database', 'green', 41, true, 2, 'knowledge.fact',
 (SELECT id FROM memory_categories WHERE code = 'knowledge')),
('knowledge.definition', 'Definitions', 'Terms and their meanings', 'Book', 'green', 42, true, 2, 'knowledge.definition',
 (SELECT id FROM memory_categories WHERE code = 'knowledge')),
('knowledge.procedure', 'Procedures', 'How to do specific things', 'ListOrdered', 'green', 43, true, 2, 'knowledge.procedure',
 (SELECT id FROM memory_categories WHERE code = 'knowledge'))
ON CONFLICT (code) DO NOTHING;

-- Sub-categories under Constraint
INSERT INTO memory_categories (code, name, description, icon, color, display_order, is_system, level, path, parent_id) VALUES
('constraint.topic', 'Topic Restrictions', 'Topics to avoid or handle carefully', 'Ban', 'red', 51, true, 2, 'constraint.topic',
 (SELECT id FROM memory_categories WHERE code = 'constraint')),
('constraint.privacy', 'Privacy Constraints', 'Personal data and privacy rules', 'Shield', 'red', 52, true, 2, 'constraint.privacy',
 (SELECT id FROM memory_categories WHERE code = 'constraint')),
('constraint.safety', 'Safety Constraints', 'Safety-related limitations', 'AlertTriangle', 'red', 53, true, 2, 'constraint.safety',
 (SELECT id FROM memory_categories WHERE code = 'constraint'))
ON CONFLICT (code) DO NOTHING;

-- Sub-categories under Goal
INSERT INTO memory_categories (code, name, description, icon, color, display_order, is_system, level, path, parent_id) VALUES
('goal.learning', 'Learning Goals', 'What the user wants to learn', 'GraduationCap', 'amber', 61, true, 2, 'goal.learning',
 (SELECT id FROM memory_categories WHERE code = 'goal')),
('goal.productivity', 'Productivity Goals', 'Efficiency and output goals', 'Zap', 'amber', 62, true, 2, 'goal.productivity',
 (SELECT id FROM memory_categories WHERE code = 'goal'))
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- Functions
-- ============================================================================

-- Get category hierarchy
CREATE OR REPLACE FUNCTION get_memory_category_tree()
RETURNS TABLE (
    id UUID,
    code VARCHAR,
    name VARCHAR,
    description TEXT,
    icon VARCHAR,
    color VARCHAR,
    level INTEGER,
    path VARCHAR,
    parent_code VARCHAR,
    is_system BOOLEAN,
    child_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mc.id,
        mc.code,
        mc.name,
        mc.description,
        mc.icon,
        mc.color,
        mc.level,
        mc.path,
        parent.code AS parent_code,
        mc.is_system,
        (SELECT COUNT(*) FROM memory_categories child WHERE child.parent_id = mc.id) AS child_count
    FROM memory_categories mc
    LEFT JOIN memory_categories parent ON mc.parent_id = parent.id
    ORDER BY mc.display_order, mc.name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get memories by category
CREATE OR REPLACE FUNCTION get_user_memories_by_category(
    p_user_id UUID,
    p_category_code VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    memory_id UUID,
    rule_text TEXT,
    rule_summary VARCHAR,
    category_code VARCHAR,
    category_name VARCHAR,
    category_icon VARCHAR,
    category_color VARCHAR,
    is_active BOOLEAN,
    times_applied INTEGER,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id AS memory_id,
        r.rule_text,
        r.rule_summary,
        mc.code AS category_code,
        mc.name AS category_name,
        mc.icon AS category_icon,
        mc.color AS category_color,
        r.is_active,
        r.times_applied,
        r.created_at
    FROM user_memory_rules r
    LEFT JOIN memory_categories mc ON r.memory_category_id = mc.id OR r.memory_category_code = mc.code
    WHERE r.user_id = p_user_id
      AND (p_category_code IS NULL OR mc.code = p_category_code OR mc.path LIKE p_category_code || '.%')
    ORDER BY mc.display_order, r.priority DESC, r.created_at;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Update preset rules with categories
-- ============================================================================

UPDATE preset_user_rules SET 
    -- Will need to add memory_category_code column first
    -- This is a placeholder for category assignment
    updated_at = NOW()
WHERE id IS NOT NULL;

-- Add category_code to preset_user_rules
ALTER TABLE preset_user_rules
ADD COLUMN IF NOT EXISTS memory_category_code VARCHAR(50);

-- Assign categories to existing presets based on rule_type
UPDATE preset_user_rules SET memory_category_code = 
    CASE rule_type
        WHEN 'restriction' THEN 'constraint.topic'
        WHEN 'privacy' THEN 'constraint.privacy'
        WHEN 'format' THEN 'instruction.format'
        WHEN 'source' THEN 'instruction.source'
        WHEN 'tone' THEN 'instruction.tone'
        WHEN 'preference' THEN 'preference.style'
        WHEN 'accessibility' THEN 'preference.style'
        WHEN 'topic' THEN 'constraint.topic'
        ELSE 'preference'
    END
WHERE memory_category_code IS NULL;

-- ============================================================================
-- Grants
-- ============================================================================

GRANT SELECT ON memory_categories TO authenticated;
GRANT EXECUTE ON FUNCTION get_memory_category_tree TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_memories_by_category TO authenticated;
