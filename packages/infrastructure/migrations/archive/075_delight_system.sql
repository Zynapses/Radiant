-- RADIANT v4.18.0 - Think Tank Delight System
-- Personality, humor, and delightful feedback for AI orchestration

-- ============================================================================
-- Delight Categories
-- ============================================================================

CREATE TABLE IF NOT EXISTS delight_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Delight Messages Registry
-- ============================================================================

CREATE TABLE IF NOT EXISTS delight_messages (
    id SERIAL PRIMARY KEY,
    category_id VARCHAR(50) NOT NULL REFERENCES delight_categories(id) ON DELETE CASCADE,
    
    -- Injection point: pre_execution, during_execution, post_execution
    injection_point VARCHAR(30) NOT NULL CHECK (injection_point IN ('pre_execution', 'during_execution', 'post_execution')),
    
    -- Trigger conditions (JSON for flexibility)
    trigger_type VARCHAR(50) NOT NULL, -- domain_loading, domain_transition, time_aware, model_dynamics, achievement, wellbeing, easter_egg
    trigger_conditions JSONB DEFAULT '{}',
    
    -- Message content
    message_text TEXT NOT NULL,
    message_alt_texts TEXT[] DEFAULT '{}', -- Alternative versions for variety
    
    -- Domain/context targeting
    domain_families TEXT[] DEFAULT '{}', -- Empty means all domains
    specific_domains TEXT[] DEFAULT '{}',
    
    -- Model targeting
    target_models TEXT[] DEFAULT '{}', -- Empty means all models
    
    -- Time targeting
    time_contexts TEXT[] DEFAULT '{}', -- morning, afternoon, evening, night, weekend, holiday
    
    -- Display settings
    display_duration_ms INTEGER DEFAULT 3000,
    display_style VARCHAR(30) DEFAULT 'subtle', -- subtle, moderate, expressive
    animation_type VARCHAR(30) DEFAULT 'fade', -- fade, slide, bounce, none
    sound_effect VARCHAR(50), -- Optional sound to play
    
    -- Priority and frequency
    priority INTEGER DEFAULT 50, -- Higher = more likely to be selected
    cooldown_minutes INTEGER DEFAULT 0, -- Minutes before showing same message again
    max_displays_per_session INTEGER DEFAULT 0, -- 0 = unlimited
    
    -- Flags
    is_enabled BOOLEAN DEFAULT TRUE,
    requires_opt_in BOOLEAN DEFAULT FALSE, -- For more expressive/silly content
    is_easter_egg BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Delight Achievements
-- ============================================================================

CREATE TABLE IF NOT EXISTS delight_achievements (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    badge_image_url VARCHAR(500),
    
    -- Unlock conditions
    achievement_type VARCHAR(50) NOT NULL, -- domain_explorer, streak, complexity, discovery, time_spent, queries_count
    threshold_value INTEGER DEFAULT 1,
    threshold_conditions JSONB DEFAULT '{}',
    
    -- Celebration
    celebration_message TEXT,
    celebration_sound VARCHAR(50),
    celebration_animation VARCHAR(50),
    
    -- Rarity
    rarity VARCHAR(20) DEFAULT 'common', -- common, uncommon, rare, epic, legendary
    points INTEGER DEFAULT 10,
    
    is_hidden BOOLEAN DEFAULT FALSE, -- Hidden until unlocked
    is_enabled BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- User Achievement Progress
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_achievements (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    achievement_id VARCHAR(50) NOT NULL REFERENCES delight_achievements(id) ON DELETE CASCADE,
    
    progress_value INTEGER DEFAULT 0,
    is_unlocked BOOLEAN DEFAULT FALSE,
    unlocked_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, tenant_id, achievement_id)
);

-- ============================================================================
-- User Delight Preferences
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_delight_preferences (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    
    -- Global settings
    personality_mode VARCHAR(20) DEFAULT 'expressive', -- professional, subtle, expressive, playful
    intensity_level INTEGER DEFAULT 5 CHECK (intensity_level BETWEEN 1 AND 10),
    
    -- Category toggles
    enable_domain_messages BOOLEAN DEFAULT TRUE,
    enable_model_personality BOOLEAN DEFAULT TRUE,
    enable_time_awareness BOOLEAN DEFAULT TRUE,
    enable_achievements BOOLEAN DEFAULT TRUE,
    enable_wellbeing_nudges BOOLEAN DEFAULT TRUE,
    enable_easter_eggs BOOLEAN DEFAULT TRUE,
    enable_sounds BOOLEAN DEFAULT FALSE,
    
    -- Sound settings
    sound_theme VARCHAR(50) DEFAULT 'default', -- default, mission_control, library, workshop, minimal
    sound_volume INTEGER DEFAULT 50 CHECK (sound_volume BETWEEN 0 AND 100),
    
    -- Display preferences
    message_position VARCHAR(20) DEFAULT 'status_bar', -- status_bar, toast, inline, margin
    show_model_attributions BOOLEAN DEFAULT TRUE,
    show_confidence_indicators BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, tenant_id)
);

-- ============================================================================
-- Easter Eggs Registry
-- ============================================================================

CREATE TABLE IF NOT EXISTS delight_easter_eggs (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Trigger
    trigger_type VARCHAR(30) NOT NULL, -- key_sequence, text_input, time_based, random, usage_pattern
    trigger_value TEXT NOT NULL, -- The actual trigger (e.g., "up,up,down,down,left,right,left,right,b,a")
    
    -- Effect
    effect_type VARCHAR(30) NOT NULL, -- mode_change, visual_transform, sound_play, message_show, interface_mod
    effect_config JSONB DEFAULT '{}',
    effect_duration_seconds INTEGER DEFAULT 30, -- 0 = permanent until toggled off
    
    -- Content
    activation_message TEXT,
    deactivation_message TEXT,
    
    is_enabled BOOLEAN DEFAULT TRUE,
    discovery_count INTEGER DEFAULT 0, -- Track how many users have found it
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Sound Effects Registry
-- ============================================================================

CREATE TABLE IF NOT EXISTS delight_sounds (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Sound file
    sound_url VARCHAR(500),
    sound_data_base64 TEXT, -- For small sounds, store inline
    
    -- Categorization
    sound_category VARCHAR(30) NOT NULL, -- confirmation, transition, achievement, ambient, notification
    sound_theme VARCHAR(50) DEFAULT 'default',
    
    -- Playback
    volume_default INTEGER DEFAULT 70 CHECK (volume_default BETWEEN 0 AND 100),
    duration_ms INTEGER,
    
    is_enabled BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Delight Event Log (for analytics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS delight_event_log (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    
    event_type VARCHAR(30) NOT NULL, -- message_shown, achievement_unlocked, easter_egg_found, sound_played
    event_data JSONB DEFAULT '{}',
    
    message_id INTEGER REFERENCES delight_messages(id) ON DELETE SET NULL,
    achievement_id VARCHAR(50) REFERENCES delight_achievements(id) ON DELETE SET NULL,
    easter_egg_id VARCHAR(50) REFERENCES delight_easter_eggs(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_delight_messages_category ON delight_messages(category_id);
CREATE INDEX IF NOT EXISTS idx_delight_messages_injection ON delight_messages(injection_point);
CREATE INDEX IF NOT EXISTS idx_delight_messages_trigger ON delight_messages(trigger_type);
CREATE INDEX IF NOT EXISTS idx_delight_messages_enabled ON delight_messages(is_enabled);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked ON user_achievements(is_unlocked);
CREATE INDEX IF NOT EXISTS idx_user_delight_prefs_user ON user_delight_preferences(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_delight_event_log_user ON delight_event_log(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_delight_event_log_time ON delight_event_log(created_at);

-- ============================================================================
-- Seed Categories
-- ============================================================================

INSERT INTO delight_categories (id, name, description, icon, sort_order) VALUES
('domain_loading', 'Domain Loading Messages', 'Messages shown while loading domain-specific content', 'Loader', 1),
('domain_transition', 'Domain Transitions', 'Messages when switching between different domains', 'ArrowRightLeft', 2),
('time_awareness', 'Time Awareness', 'Context-aware messages based on time of day/session', 'Clock', 3),
('model_dynamics', 'Model Dynamics', 'Messages about AI model collaboration and consensus', 'Users', 4),
('complexity_signals', 'Complexity Signals', 'Messages indicating query complexity and progress', 'Brain', 5),
('synthesis_quality', 'Synthesis Quality', 'Post-execution quality indicators', 'Sparkles', 6),
('achievements', 'Achievements', 'Milestone and progress celebrations', 'Trophy', 7),
('wellbeing', 'Wellbeing Nudges', 'Gentle reminders for breaks and self-care', 'Heart', 8),
('easter_eggs', 'Easter Eggs', 'Hidden surprises for explorers', 'Egg', 9),
('sounds', 'Sound Effects', 'Audio feedback for various events', 'Volume2', 10)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Seed Achievements
-- ============================================================================

INSERT INTO delight_achievements (id, name, description, achievement_type, threshold_value, celebration_message, rarity, points, icon) VALUES
-- Domain exploration
('domain_explorer_10', 'Domain Explorer', 'Explored 10 different knowledge domains', 'domain_explorer', 10, 'Curiosity knows no bounds. 10 domains explored!', 'common', 10, 'Compass'),
('domain_explorer_50', 'Renaissance Mind', 'Explored 50 different knowledge domains', 'domain_explorer', 50, 'True polymath territory. 50 domains conquered!', 'rare', 50, 'Crown'),
('domain_explorer_100', 'Universal Scholar', 'Explored 100 different knowledge domains', 'domain_explorer', 100, 'The universe of knowledge bows to you.', 'legendary', 100, 'Star'),

-- Usage streaks
('streak_7', 'Week Warrior', 'Used Think Tank 7 days in a row', 'streak', 7, 'A week of thinking. Consistency wins.', 'common', 15, 'Flame'),
('streak_30', 'Monthly Mind', 'Used Think Tank 30 days in a row', 'streak', 30, 'A month of brilliance. Truly dedicated.', 'epic', 75, 'Zap'),

-- Query complexity
('complex_query_1', 'Deep Thinker', 'Submitted your first complex multi-part query', 'complexity', 1, 'Now we''re getting somewhere interesting.', 'common', 10, 'Layers'),
('complex_query_10', 'Problem Solver', 'Tackled 10 complex problems', 'complexity', 10, 'Complex problems are your specialty.', 'uncommon', 25, 'Puzzle'),

-- Discovery
('easter_egg_1', 'Curious One', 'Found your first easter egg', 'discovery', 1, 'You found a secret! There are more...', 'uncommon', 20, 'Egg'),
('easter_egg_5', 'Easter Hunter', 'Found 5 easter eggs', 'discovery', 5, 'Five secrets uncovered. You''re thorough.', 'rare', 50, 'Search'),

-- Time spent
('hours_10', 'Dedicated Thinker', 'Spent 10 hours with Think Tank', 'time_spent', 10, '10 hours of thinking together. A partnership.', 'common', 15, 'Clock'),
('hours_100', 'Thinking Champion', 'Spent 100 hours with Think Tank', 'time_spent', 100, '100 hours. We''ve been through a lot together.', 'epic', 100, 'Award'),

-- Query counts
('queries_100', 'Century Club', 'Submitted 100 queries', 'queries_count', 100, 'The 100 club. Welcome.', 'common', 20, 'MessageSquare'),
('queries_1000', 'Thousand Thoughts', 'Submitted 1000 queries', 'queries_count', 1000, 'A thousand questions. Endless curiosity.', 'rare', 75, 'Inbox')

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Seed Easter Eggs
-- ============================================================================

INSERT INTO delight_easter_eggs (id, name, description, trigger_type, trigger_value, effect_type, effect_config, activation_message, effect_duration_seconds) VALUES
('konami', 'Konami Code', 'Classic gaming easter egg', 'key_sequence', 'ArrowUp,ArrowUp,ArrowDown,ArrowDown,ArrowLeft,ArrowRight,ArrowLeft,ArrowRight,b,a', 'mode_change', '{"mode": "retro", "theme": "arcade"}', '🎮 Cheat codes activated. +30 lives.', 60),
('chaos_mode', 'Chaos Mode', 'Let the models argue', 'text_input', '/chaos', 'mode_change', '{"mode": "chaos", "showDisagreements": true}', '🌪️ Chaos Mode engaged. May the best model win.', 0),
('socratic', 'Socratic Mode', 'Answer questions with questions', 'text_input', '/socratic', 'mode_change', '{"mode": "socratic", "responseStyle": "questions"}', '🏛️ Socratic Mode. I''ll ask the questions now.', 0),
('victorian', 'Victorian Gentleman', 'Explain things formally', 'text_input', '/victorian', 'mode_change', '{"mode": "victorian", "responseStyle": "formal"}', '🎩 Indeed, good sir/madam. How may I assist?', 0),
('pirate', 'Pirate Mode', 'Arrr, talk like a pirate', 'text_input', '/pirate', 'mode_change', '{"mode": "pirate", "responseStyle": "pirate"}', '🏴‍☠️ Ahoy! Ready to sail the seven seas of knowledge!', 0),
('haiku', 'Haiku Mode', 'Responses in haiku form', 'text_input', '/haiku', 'mode_change', '{"mode": "haiku", "responseStyle": "haiku"}', '🌸 Five, seven, then five / Syllables mark the rhythm / Nature finds its voice', 0),
('matrix', 'Matrix Mode', 'See the code behind reality', 'text_input', '/matrix', 'visual_transform', '{"effect": "matrix_rain", "theme": "green_code"}', '💊 You took the red pill. Let''s see how deep this goes.', 30),
('disco', 'Disco Mode', 'Party time!', 'text_input', '/disco', 'visual_transform', '{"effect": "disco_lights", "playMusic": true}', '🪩 Let''s groove while we think!', 30),
('dad_jokes', 'Dad Joke Mode', 'Every response includes a dad joke', 'text_input', '/dadjokes', 'mode_change', '{"mode": "dad_jokes", "includeJokes": true}', '👨 Warning: Side effects include groaning and eye-rolling.', 0),
('tesla_fart', 'Emission Mode', 'Sound effects for synthesis events', 'text_input', '/emissions', 'sound_play', '{"soundPack": "emissions", "events": ["synthesis_complete", "model_agree"]}', '💨 Emissions enabled. This is going to be fun.', 0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Seed Domain Loading Messages
-- ============================================================================

INSERT INTO delight_messages (category_id, injection_point, trigger_type, message_text, message_alt_texts, domain_families, display_style) VALUES
-- Sciences
('domain_loading', 'pre_execution', 'domain_loading', 'Consulting the fundamental forces...', ARRAY['Collapsing the wave function...', 'Checking with the laws of physics...'], ARRAY['physics', 'quantum'], 'subtle'),
('domain_loading', 'pre_execution', 'domain_loading', 'Analyzing the molecular structure...', ARRAY['Balancing the equations...', 'Consulting the periodic table...'], ARRAY['chemistry'], 'subtle'),
('domain_loading', 'pre_execution', 'domain_loading', 'Sequencing the knowledge base...', ARRAY['Reviewing the literature...', 'Consulting the genetic library...'], ARRAY['biology', 'genetics'], 'subtle'),
('domain_loading', 'pre_execution', 'domain_loading', 'Calculating the trajectories...', ARRAY['Scanning the cosmos...', 'Aligning the telescope...'], ARRAY['astronomy', 'astrophysics'], 'subtle'),

-- Engineering
('domain_loading', 'pre_execution', 'domain_loading', 'Running the calculations...', ARRAY['Checking the specs...', 'Consulting the blueprints...'], ARRAY['engineering'], 'subtle'),
('domain_loading', 'pre_execution', 'domain_loading', 'Compiling the solution...', ARRAY['Debugging the approach...', 'Optimizing the algorithm...'], ARRAY['programming', 'software', 'coding'], 'subtle'),
('domain_loading', 'pre_execution', 'domain_loading', 'Stress-testing the approach...', ARRAY['Checking the load limits...', 'Running simulations...'], ARRAY['mechanical', 'structural'], 'subtle'),

-- Medicine
('domain_loading', 'pre_execution', 'domain_loading', 'Reviewing the differential...', ARRAY['Consulting the evidence...', 'Cross-referencing symptoms...'], ARRAY['medicine', 'clinical'], 'subtle'),
('domain_loading', 'pre_execution', 'domain_loading', 'Checking the pathways...', ARRAY['Reviewing the mechanism...', 'Analyzing interactions...'], ARRAY['pharmacology', 'pharmacy'], 'subtle'),

-- Humanities
('domain_loading', 'pre_execution', 'domain_loading', 'Contemplating the question...', ARRAY['Examining the premises...', 'Exploring the implications...'], ARRAY['philosophy'], 'subtle'),
('domain_loading', 'pre_execution', 'domain_loading', 'Consulting the archives...', ARRAY['Reviewing the sources...', 'Cross-referencing the timeline...'], ARRAY['history'], 'subtle'),
('domain_loading', 'pre_execution', 'domain_loading', 'Analyzing the text...', ARRAY['Deconstructing the narrative...', 'Examining the subtext...'], ARRAY['literature', 'english'], 'subtle'),

-- Creative
('domain_loading', 'pre_execution', 'domain_loading', 'Gathering the ingredients...', ARRAY['Preheating the knowledge base...', 'Consulting the recipes...'], ARRAY['cooking', 'culinary', 'food'], 'subtle'),
('domain_loading', 'pre_execution', 'domain_loading', 'Composing the palette...', ARRAY['Sketching the concept...', 'Mixing the colors...'], ARRAY['art', 'design', 'creative'], 'subtle'),
('domain_loading', 'pre_execution', 'domain_loading', 'Tuning the harmonics...', ARRAY['Reading the score...', 'Setting the tempo...'], ARRAY['music'], 'subtle'),

-- Business
('domain_loading', 'pre_execution', 'domain_loading', 'Crunching the numbers...', ARRAY['Analyzing the trends...', 'Running the projections...'], ARRAY['finance', 'accounting', 'business'], 'subtle'),
('domain_loading', 'pre_execution', 'domain_loading', 'Reviewing the case law...', ARRAY['Consulting precedent...', 'Analyzing the statutes...'], ARRAY['law', 'legal'], 'subtle'),

-- General fallback
('domain_loading', 'pre_execution', 'domain_loading', 'Thinking...', ARRAY['Processing...', 'Working on it...', 'Consulting the models...'], ARRAY[]::TEXT[], 'subtle');

-- ============================================================================
-- Seed Time Awareness Messages
-- ============================================================================

INSERT INTO delight_messages (category_id, injection_point, trigger_type, message_text, time_contexts, display_style) VALUES
('time_awareness', 'pre_execution', 'time_aware', 'Burning the midnight tokens.', ARRAY['night'], 'subtle'),
('time_awareness', 'pre_execution', 'time_aware', 'Late night thinking. The best ideas come now.', ARRAY['night'], 'subtle'),
('time_awareness', 'pre_execution', 'time_aware', 'Early bird gets the insights.', ARRAY['morning'], 'subtle'),
('time_awareness', 'pre_execution', 'time_aware', 'Good morning! Let''s think.', ARRAY['morning'], 'subtle'),
('time_awareness', 'pre_execution', 'time_aware', 'Afternoon productivity at its finest.', ARRAY['afternoon'], 'subtle'),
('time_awareness', 'pre_execution', 'time_aware', 'Evening contemplation mode engaged.', ARRAY['evening'], 'subtle'),
('time_awareness', 'pre_execution', 'time_aware', 'Weekend thinking. No rush.', ARRAY['weekend'], 'subtle'),
('time_awareness', 'post_execution', 'time_aware', 'You''ve been at this a while. Stretch break?', ARRAY['long_session'], 'moderate'),
('time_awareness', 'post_execution', 'time_aware', 'Hour two. Stay hydrated.', ARRAY['long_session'], 'subtle'),
('time_awareness', 'post_execution', 'time_aware', 'The best ideas will still be there tomorrow.', ARRAY['very_late'], 'moderate'),
('time_awareness', 'pre_execution', 'time_aware', 'Welcome back.', ARRAY['returning'], 'subtle');

-- ============================================================================
-- Seed Model Dynamics Messages
-- ============================================================================

INSERT INTO delight_messages (category_id, injection_point, trigger_type, message_text, message_alt_texts, display_style) VALUES
('model_dynamics', 'during_execution', 'model_dynamics', 'Consensus forming...', ARRAY['The models agree on this one.', 'Strong agreement across the board.'], 'subtle'),
('model_dynamics', 'during_execution', 'model_dynamics', 'The models are debating this one.', ARRAY['Interesting disagreement emerging.', 'Multiple perspectives at play.'], 'moderate'),
('model_dynamics', 'during_execution', 'model_dynamics', 'Cross-checking the reasoning...', ARRAY['Validating the approach...', 'Models verifying each other...'], 'subtle'),
('model_dynamics', 'during_execution', 'model_dynamics', 'One model has strong opinions here.', ARRAY['Clear leader emerging.', 'Domain specialist engaged.'], 'subtle'),
('model_dynamics', 'post_execution', 'model_dynamics', 'High confidence on this one.', ARRAY['Strong synthesis achieved.', 'The ensemble is certain.'], 'subtle'),
('model_dynamics', 'post_execution', 'model_dynamics', 'Some nuance worth noting.', ARRAY['Respectful disagreement surfaced.', 'Multiple valid perspectives.'], 'moderate');

-- ============================================================================
-- Seed Complexity Signal Messages
-- ============================================================================

INSERT INTO delight_messages (category_id, injection_point, trigger_type, message_text, message_alt_texts, display_style) VALUES
('complexity_signals', 'during_execution', 'complexity_signals', 'This requires some thinking...', ARRAY['Multi-step reasoning engaged.', 'Complex problem detected.'], 'subtle'),
('complexity_signals', 'during_execution', 'complexity_signals', 'New territory. Exploring carefully.', ARRAY['Novel query. Proceeding thoughtfully.', 'Uncharted waters ahead.'], 'moderate'),
('complexity_signals', 'during_execution', 'complexity_signals', 'Clear path forward.', ARRAY['Straightforward approach identified.', 'Confidence is high.'], 'subtle'),
('complexity_signals', 'post_execution', 'complexity_signals', 'This came together nicely.', ARRAY['Breakthrough achieved.', 'Elegant solution found.'], 'moderate'),
('complexity_signals', 'post_execution', 'complexity_signals', 'That was a challenging one. Well asked.', ARRAY['Impressive query complexity.', 'You ask the hard questions.'], 'moderate');

-- ============================================================================
-- Seed Domain Transition Messages
-- ============================================================================

INSERT INTO delight_messages (category_id, injection_point, trigger_type, message_text, message_alt_texts, display_style) VALUES
('domain_transition', 'pre_execution', 'domain_transition', 'Quite the pivot.', ARRAY['From one world to another.', 'Switching gears.'], 'subtle'),
('domain_transition', 'pre_execution', 'domain_transition', 'From black holes to baking. Let''s do it.', ARRAY['Different domain, same enthusiasm.', 'Versatility is key.'], 'moderate'),
('domain_transition', 'pre_execution', 'domain_transition', 'Going deeper on this one.', ARRAY['Same domain, more depth.', 'Diving further.'], 'subtle'),
('domain_transition', 'pre_execution', 'domain_transition', 'Back to familiar territory.', ARRAY['Returning to a favorite topic.', 'Home turf.'], 'subtle');

-- ============================================================================
-- Seed Wellbeing Messages
-- ============================================================================

INSERT INTO delight_messages (category_id, injection_point, trigger_type, message_text, message_alt_texts, display_style, requires_opt_in) VALUES
('wellbeing', 'post_execution', 'wellbeing', 'You''ve been thinking hard. Time for a break?', ARRAY['Mental health break time?', 'Remember to stretch.'], 'moderate', FALSE),
('wellbeing', 'post_execution', 'wellbeing', 'Stay hydrated! 💧', ARRAY['Water break?', 'Hydration check.'], 'subtle', FALSE),
('wellbeing', 'post_execution', 'wellbeing', 'Great session. Maybe take 5?', ARRAY['Good progress. Rest a bit.', 'Solid work. Rest your eyes.'], 'moderate', FALSE),
('wellbeing', 'post_execution', 'wellbeing', 'It''s quite late. The ideas will still be here tomorrow.', ARRAY['Sleep on it?', 'Tomorrow you is also smart.'], 'expressive', FALSE);

-- ============================================================================
-- Seed Sound Effects
-- ============================================================================

INSERT INTO delight_sounds (id, name, description, sound_category, sound_theme) VALUES
('confirm_subtle', 'Subtle Confirmation', 'Soft click for confirmations', 'confirmation', 'default'),
('confirm_chime', 'Chime Confirmation', 'Pleasant chime for success', 'confirmation', 'default'),
('transition_whoosh', 'Whoosh Transition', 'Smooth transition sound', 'transition', 'default'),
('achievement_fanfare', 'Achievement Fanfare', 'Celebratory achievement unlock', 'achievement', 'default'),
('achievement_subtle', 'Subtle Achievement', 'Understated achievement sound', 'achievement', 'minimal'),
('consensus_ping', 'Consensus Ping', 'Models reaching agreement', 'notification', 'default'),
('thinking_ambient', 'Thinking Ambient', 'Subtle ambient during processing', 'ambient', 'default'),

-- Mission Control theme
('mc_confirm', 'Mission Control Confirm', 'Spacecraft confirmation beep', 'confirmation', 'mission_control'),
('mc_launch', 'Mission Control Launch', 'Liftoff sound', 'transition', 'mission_control'),
('mc_success', 'Mission Control Success', 'Mission success fanfare', 'achievement', 'mission_control'),

-- Library theme
('lib_page_turn', 'Page Turn', 'Gentle page turn', 'confirmation', 'library'),
('lib_book_close', 'Book Close', 'Satisfying book close', 'transition', 'library'),

-- Workshop theme
('ws_tool_click', 'Tool Click', 'Satisfying tool click', 'confirmation', 'workshop'),
('ws_power_up', 'Power Up', 'Machine power up', 'transition', 'workshop'),

-- Emissions theme (Tesla fart style)
('emission_toot', 'Toot', 'Classic emission sound', 'confirmation', 'emissions'),
('emission_whoopee', 'Whoopee', 'Celebratory emission', 'achievement', 'emissions'),
('emission_pffft', 'Pffft', 'Subtle emission', 'notification', 'emissions')

ON CONFLICT (id) DO NOTHING;
