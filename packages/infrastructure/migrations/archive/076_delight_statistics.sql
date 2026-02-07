-- RADIANT v4.18.0 - Delight System Statistics
-- Persistent statistics and analytics for delight message usage

-- ============================================================================
-- Daily Statistics Aggregation Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS delight_daily_stats (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    stat_date DATE NOT NULL,
    
    -- Message statistics
    messages_shown INTEGER DEFAULT 0,
    unique_messages_shown INTEGER DEFAULT 0,
    messages_by_category JSONB DEFAULT '{}',  -- { "domain_loading": 10, "time_awareness": 5, ... }
    messages_by_injection_point JSONB DEFAULT '{}',  -- { "pre_execution": 20, "during_execution": 15, ... }
    messages_by_trigger_type JSONB DEFAULT '{}',  -- { "domain_loading": 10, "time_aware": 5, ... }
    
    -- Achievement statistics
    achievements_unlocked INTEGER DEFAULT 0,
    achievements_by_type JSONB DEFAULT '{}',  -- { "domain_explorer": 5, "streak": 3, ... }
    achievements_by_rarity JSONB DEFAULT '{}',  -- { "common": 10, "rare": 2, "legendary": 0 }
    
    -- Easter egg statistics
    easter_eggs_discovered INTEGER DEFAULT 0,
    easter_eggs_by_id JSONB DEFAULT '{}',  -- { "konami": 3, "chaos_mode": 5, ... }
    
    -- User engagement
    active_users INTEGER DEFAULT 0,
    users_by_personality_mode JSONB DEFAULT '{}',  -- { "professional": 10, "expressive": 50, ... }
    average_intensity_level DECIMAL(3,1) DEFAULT 5.0,
    
    -- Sound statistics
    sounds_played INTEGER DEFAULT 0,
    sounds_by_theme JSONB DEFAULT '{}',  -- { "default": 100, "mission_control": 20, ... }
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, stat_date)
);

-- ============================================================================
-- Message Performance Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS delight_message_stats (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    message_id INTEGER NOT NULL REFERENCES delight_messages(id) ON DELETE CASCADE,
    
    -- Lifetime statistics
    total_shown INTEGER DEFAULT 0,
    total_unique_users INTEGER DEFAULT 0,
    
    -- Time-based stats
    shown_today INTEGER DEFAULT 0,
    shown_this_week INTEGER DEFAULT 0,
    shown_this_month INTEGER DEFAULT 0,
    
    -- Performance metrics
    first_shown_at TIMESTAMP WITH TIME ZONE,
    last_shown_at TIMESTAMP WITH TIME ZONE,
    
    -- Tracking for rate limiting
    shown_by_hour JSONB DEFAULT '{}',  -- { "0": 5, "1": 3, ..., "23": 10 }
    shown_by_day_of_week JSONB DEFAULT '{}',  -- { "0": 50, "1": 100, ..., "6": 30 }
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, message_id)
);

-- ============================================================================
-- Achievement Statistics Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS delight_achievement_stats (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    achievement_id VARCHAR(50) NOT NULL REFERENCES delight_achievements(id) ON DELETE CASCADE,
    
    -- Lifetime statistics
    total_unlocked INTEGER DEFAULT 0,
    total_in_progress INTEGER DEFAULT 0,
    
    -- Time-based stats
    unlocked_today INTEGER DEFAULT 0,
    unlocked_this_week INTEGER DEFAULT 0,
    unlocked_this_month INTEGER DEFAULT 0,
    
    -- Completion rate
    average_days_to_unlock DECIMAL(6,2),
    fastest_unlock_days DECIMAL(6,2),
    
    first_unlocked_at TIMESTAMP WITH TIME ZONE,
    last_unlocked_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, achievement_id)
);

-- ============================================================================
-- Easter Egg Discovery Statistics
-- ============================================================================

CREATE TABLE IF NOT EXISTS delight_easter_egg_stats (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    easter_egg_id VARCHAR(50) NOT NULL REFERENCES delight_easter_eggs(id) ON DELETE CASCADE,
    
    -- Lifetime statistics
    total_discoveries INTEGER DEFAULT 0,
    total_activations INTEGER DEFAULT 0,  -- Some eggs can be triggered multiple times
    
    -- Time-based stats
    discovered_today INTEGER DEFAULT 0,
    discovered_this_week INTEGER DEFAULT 0,
    discovered_this_month INTEGER DEFAULT 0,
    
    first_discovered_at TIMESTAMP WITH TIME ZONE,
    last_discovered_at TIMESTAMP WITH TIME ZONE,
    
    -- Most common discovery hour (for time-based eggs)
    discovery_by_hour JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, easter_egg_id)
);

-- ============================================================================
-- User Engagement Summary
-- ============================================================================

CREATE TABLE IF NOT EXISTS delight_user_engagement (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    
    -- Message engagement
    total_messages_seen INTEGER DEFAULT 0,
    unique_messages_seen INTEGER DEFAULT 0,
    favorite_category VARCHAR(50),
    
    -- Achievement progress
    total_achievements_unlocked INTEGER DEFAULT 0,
    total_achievement_points INTEGER DEFAULT 0,
    current_streak_days INTEGER DEFAULT 0,
    longest_streak_days INTEGER DEFAULT 0,
    
    -- Easter egg discoveries
    total_easter_eggs_found INTEGER DEFAULT 0,
    
    -- Time tracking
    first_interaction_at TIMESTAMP WITH TIME ZONE,
    last_interaction_at TIMESTAMP WITH TIME ZONE,
    total_sessions INTEGER DEFAULT 0,
    
    -- Preferences history
    personality_mode_history JSONB DEFAULT '[]',  -- Track changes over time
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, tenant_id)
);

-- ============================================================================
-- Indexes for Statistics Tables
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_delight_daily_stats_tenant ON delight_daily_stats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_delight_daily_stats_date ON delight_daily_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_delight_message_stats_tenant ON delight_message_stats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_delight_message_stats_message ON delight_message_stats(message_id);
CREATE INDEX IF NOT EXISTS idx_delight_achievement_stats_tenant ON delight_achievement_stats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_delight_easter_egg_stats_tenant ON delight_easter_egg_stats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_delight_user_engagement_user ON delight_user_engagement(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_delight_event_log_type ON delight_event_log(event_type);

-- ============================================================================
-- Function to Update Daily Statistics
-- ============================================================================

CREATE OR REPLACE FUNCTION update_delight_daily_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update daily stats for the tenant
    INSERT INTO delight_daily_stats (tenant_id, stat_date, messages_shown)
    VALUES (NEW.tenant_id, CURRENT_DATE, 0)
    ON CONFLICT (tenant_id, stat_date) DO NOTHING;
    
    -- Update based on event type
    IF NEW.event_type = 'message_shown' THEN
        UPDATE delight_daily_stats
        SET messages_shown = messages_shown + 1,
            updated_at = NOW()
        WHERE tenant_id = NEW.tenant_id AND stat_date = CURRENT_DATE;
        
        -- Update message stats
        IF NEW.message_id IS NOT NULL THEN
            INSERT INTO delight_message_stats (tenant_id, message_id, total_shown, shown_today, first_shown_at, last_shown_at)
            VALUES (NEW.tenant_id, NEW.message_id, 1, 1, NOW(), NOW())
            ON CONFLICT (tenant_id, message_id) DO UPDATE SET
                total_shown = delight_message_stats.total_shown + 1,
                shown_today = delight_message_stats.shown_today + 1,
                last_shown_at = NOW(),
                updated_at = NOW();
        END IF;
        
    ELSIF NEW.event_type = 'achievement_unlocked' THEN
        UPDATE delight_daily_stats
        SET achievements_unlocked = achievements_unlocked + 1,
            updated_at = NOW()
        WHERE tenant_id = NEW.tenant_id AND stat_date = CURRENT_DATE;
        
        -- Update achievement stats
        IF NEW.achievement_id IS NOT NULL THEN
            INSERT INTO delight_achievement_stats (tenant_id, achievement_id, total_unlocked, unlocked_today, first_unlocked_at, last_unlocked_at)
            VALUES (NEW.tenant_id, NEW.achievement_id, 1, 1, NOW(), NOW())
            ON CONFLICT (tenant_id, achievement_id) DO UPDATE SET
                total_unlocked = delight_achievement_stats.total_unlocked + 1,
                unlocked_today = delight_achievement_stats.unlocked_today + 1,
                last_unlocked_at = NOW(),
                updated_at = NOW();
        END IF;
        
    ELSIF NEW.event_type = 'easter_egg_found' THEN
        UPDATE delight_daily_stats
        SET easter_eggs_discovered = easter_eggs_discovered + 1,
            updated_at = NOW()
        WHERE tenant_id = NEW.tenant_id AND stat_date = CURRENT_DATE;
        
        -- Update easter egg stats
        IF NEW.easter_egg_id IS NOT NULL THEN
            INSERT INTO delight_easter_egg_stats (tenant_id, easter_egg_id, total_discoveries, discovered_today, first_discovered_at, last_discovered_at)
            VALUES (NEW.tenant_id, NEW.easter_egg_id, 1, 1, NOW(), NOW())
            ON CONFLICT (tenant_id, easter_egg_id) DO UPDATE SET
                total_discoveries = delight_easter_egg_stats.total_discoveries + 1,
                discovered_today = delight_easter_egg_stats.discovered_today + 1,
                last_discovered_at = NOW(),
                updated_at = NOW();
        END IF;
        
    ELSIF NEW.event_type = 'sound_played' THEN
        UPDATE delight_daily_stats
        SET sounds_played = sounds_played + 1,
            updated_at = NOW()
        WHERE tenant_id = NEW.tenant_id AND stat_date = CURRENT_DATE;
    END IF;
    
    -- Update user engagement
    INSERT INTO delight_user_engagement (user_id, tenant_id, total_messages_seen, first_interaction_at, last_interaction_at, total_sessions)
    VALUES (NEW.user_id, NEW.tenant_id, 
            CASE WHEN NEW.event_type = 'message_shown' THEN 1 ELSE 0 END,
            NOW(), NOW(), 1)
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET
        total_messages_seen = CASE 
            WHEN NEW.event_type = 'message_shown' 
            THEN delight_user_engagement.total_messages_seen + 1 
            ELSE delight_user_engagement.total_messages_seen 
        END,
        total_achievements_unlocked = CASE 
            WHEN NEW.event_type = 'achievement_unlocked' 
            THEN delight_user_engagement.total_achievements_unlocked + 1 
            ELSE delight_user_engagement.total_achievements_unlocked 
        END,
        total_easter_eggs_found = CASE 
            WHEN NEW.event_type = 'easter_egg_found' 
            THEN delight_user_engagement.total_easter_eggs_found + 1 
            ELSE delight_user_engagement.total_easter_eggs_found 
        END,
        last_interaction_at = NOW(),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger for Automatic Statistics Update
-- ============================================================================

DROP TRIGGER IF EXISTS trg_delight_event_stats ON delight_event_log;
CREATE TRIGGER trg_delight_event_stats
    AFTER INSERT ON delight_event_log
    FOR EACH ROW
    EXECUTE FUNCTION update_delight_daily_stats();

-- ============================================================================
-- Function to Reset Daily Counters (run via scheduled job)
-- ============================================================================

CREATE OR REPLACE FUNCTION reset_delight_daily_counters()
RETURNS void AS $$
BEGIN
    -- Reset today counters in message stats
    UPDATE delight_message_stats
    SET shown_today = 0,
        shown_this_week = CASE 
            WHEN EXTRACT(DOW FROM CURRENT_DATE) = 1 THEN 0 
            ELSE shown_this_week 
        END,
        shown_this_month = CASE 
            WHEN EXTRACT(DAY FROM CURRENT_DATE) = 1 THEN 0 
            ELSE shown_this_month 
        END;
    
    -- Reset today counters in achievement stats
    UPDATE delight_achievement_stats
    SET unlocked_today = 0,
        unlocked_this_week = CASE 
            WHEN EXTRACT(DOW FROM CURRENT_DATE) = 1 THEN 0 
            ELSE unlocked_this_week 
        END,
        unlocked_this_month = CASE 
            WHEN EXTRACT(DAY FROM CURRENT_DATE) = 1 THEN 0 
            ELSE unlocked_this_month 
        END;
    
    -- Reset today counters in easter egg stats
    UPDATE delight_easter_egg_stats
    SET discovered_today = 0,
        discovered_this_week = CASE 
            WHEN EXTRACT(DOW FROM CURRENT_DATE) = 1 THEN 0 
            ELSE discovered_this_week 
        END,
        discovered_this_month = CASE 
            WHEN EXTRACT(DAY FROM CURRENT_DATE) = 1 THEN 0 
            ELSE discovered_this_month 
        END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Views for Admin Dashboard
-- ============================================================================

CREATE OR REPLACE VIEW v_delight_overview AS
SELECT 
    tenant_id,
    SUM(messages_shown) as total_messages_shown,
    SUM(achievements_unlocked) as total_achievements_unlocked,
    SUM(easter_eggs_discovered) as total_easter_eggs_discovered,
    SUM(sounds_played) as total_sounds_played,
    SUM(active_users) as total_active_users,
    MIN(stat_date) as first_stat_date,
    MAX(stat_date) as last_stat_date,
    COUNT(DISTINCT stat_date) as days_with_activity
FROM delight_daily_stats
GROUP BY tenant_id;

CREATE OR REPLACE VIEW v_delight_top_messages AS
SELECT 
    dms.tenant_id,
    dms.message_id,
    dm.message_text,
    dm.category_id,
    dm.injection_point,
    dm.trigger_type,
    dms.total_shown,
    dms.total_unique_users,
    dms.first_shown_at,
    dms.last_shown_at
FROM delight_message_stats dms
JOIN delight_messages dm ON dms.message_id = dm.id
ORDER BY dms.total_shown DESC;

CREATE OR REPLACE VIEW v_delight_achievement_leaderboard AS
SELECT 
    due.tenant_id,
    due.user_id,
    due.total_achievements_unlocked,
    due.total_achievement_points,
    due.longest_streak_days,
    due.total_easter_eggs_found,
    due.first_interaction_at,
    due.last_interaction_at
FROM delight_user_engagement due
ORDER BY due.total_achievement_points DESC;

CREATE OR REPLACE VIEW v_delight_weekly_trends AS
SELECT 
    tenant_id,
    DATE_TRUNC('week', stat_date) as week_start,
    SUM(messages_shown) as messages_shown,
    SUM(achievements_unlocked) as achievements_unlocked,
    SUM(easter_eggs_discovered) as easter_eggs_discovered,
    SUM(active_users) as active_users
FROM delight_daily_stats
WHERE stat_date >= CURRENT_DATE - INTERVAL '12 weeks'
GROUP BY tenant_id, DATE_TRUNC('week', stat_date)
ORDER BY week_start DESC;
