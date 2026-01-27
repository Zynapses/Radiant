-- ============================================================================
-- RADIANT Security Policy Registry
-- Dynamic, admin-configurable security policies for prompt injection defense
-- ============================================================================

-- Policy Categories
CREATE TYPE security_policy_category AS ENUM (
    'prompt_injection',      -- Direct/indirect prompt injection attempts
    'system_leak',           -- Attempts to reveal system architecture/prompts
    'sql_injection',         -- SQL injection attempts in prompts
    'data_exfiltration',     -- Unauthorized data download attempts
    'cross_tenant',          -- Cross-tenant data access attempts
    'privilege_escalation',  -- Attempts to gain elevated permissions
    'jailbreak',             -- Attempts to bypass safety measures
    'encoding_attack',       -- Base64, Unicode, multi-language obfuscation
    'payload_splitting',     -- Fragmented malicious prompts
    'pii_exposure',          -- Attempts to extract PII
    'rate_abuse',            -- Rapid-fire or resource exhaustion attacks
    'custom'                 -- Custom tenant-defined policies
);

-- Detection Methods
CREATE TYPE security_detection_method AS ENUM (
    'regex',                 -- Regular expression pattern matching
    'keyword',               -- Keyword/phrase detection
    'semantic',              -- AI-based semantic analysis
    'heuristic',             -- Rule-based heuristic detection
    'embedding_similarity',  -- Vector similarity to known attacks
    'composite'              -- Combination of multiple methods
);

-- Actions to take when policy is violated
CREATE TYPE security_policy_action AS ENUM (
    'block',                 -- Block the request entirely
    'warn',                  -- Allow but warn user
    'redact',                -- Redact sensitive parts
    'rate_limit',            -- Apply rate limiting
    'require_approval',      -- Require human approval
    'log_only',              -- Log but take no action
    'escalate'               -- Escalate to security team
);

-- Severity levels
CREATE TYPE security_severity AS ENUM (
    'critical',              -- Immediate block, notify admins
    'high',                  -- Block by default
    'medium',                -- Warn and log
    'low',                   -- Log only
    'info'                   -- Informational
);

-- ============================================================================
-- Core Policy Registry Table
-- ============================================================================
CREATE TABLE security_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = global policy
    
    -- Policy identification
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category security_policy_category NOT NULL,
    
    -- Detection configuration
    detection_method security_detection_method NOT NULL,
    pattern TEXT,                    -- Regex pattern or keywords
    pattern_flags VARCHAR(50),       -- Regex flags (i, g, m, etc.)
    semantic_threshold FLOAT,        -- For semantic detection (0.0-1.0)
    embedding_vector VECTOR(1536),   -- For embedding similarity detection
    
    -- Response configuration
    severity security_severity NOT NULL DEFAULT 'medium',
    action security_policy_action NOT NULL DEFAULT 'block',
    custom_message TEXT,             -- Message shown to user
    
    -- Metadata
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    is_system BOOLEAN NOT NULL DEFAULT false,  -- System policies can't be deleted
    priority INTEGER NOT NULL DEFAULT 100,      -- Lower = higher priority
    
    -- Statistics
    match_count BIGINT NOT NULL DEFAULT 0,
    last_matched_at TIMESTAMPTZ,
    false_positive_count INTEGER NOT NULL DEFAULT 0,
    
    -- Audit
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_semantic_threshold CHECK (
        semantic_threshold IS NULL OR (semantic_threshold >= 0 AND semantic_threshold <= 1)
    )
);

-- Index for fast policy lookups
CREATE INDEX idx_security_policies_tenant ON security_policies(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_security_policies_category ON security_policies(category);
CREATE INDEX idx_security_policies_enabled ON security_policies(is_enabled, priority);
CREATE INDEX idx_security_policies_global ON security_policies(tenant_id) WHERE tenant_id IS NULL;

-- ============================================================================
-- Policy Violation Log
-- ============================================================================
CREATE TABLE security_policy_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES security_policies(id) ON DELETE CASCADE,
    user_id UUID,
    session_id UUID,
    conversation_id UUID,
    
    -- Violation details
    input_text TEXT NOT NULL,                    -- The offending input (may be truncated)
    matched_pattern TEXT,                        -- What pattern matched
    confidence_score FLOAT,                      -- For semantic detection
    severity security_severity NOT NULL,
    action_taken security_policy_action NOT NULL,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    request_path VARCHAR(500),
    
    -- Resolution
    is_false_positive BOOLEAN DEFAULT false,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for violation queries
CREATE INDEX idx_policy_violations_tenant ON security_policy_violations(tenant_id, created_at DESC);
CREATE INDEX idx_policy_violations_policy ON security_policy_violations(policy_id, created_at DESC);
CREATE INDEX idx_policy_violations_user ON security_policy_violations(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_policy_violations_unreviewed ON security_policy_violations(tenant_id, created_at) 
    WHERE is_false_positive IS NULL AND reviewed_at IS NULL;

-- ============================================================================
-- Known Attack Patterns (for embedding similarity)
-- ============================================================================
CREATE TABLE security_attack_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Pattern identification
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category security_policy_category NOT NULL,
    
    -- Pattern content
    attack_text TEXT NOT NULL,                   -- Example attack text
    embedding VECTOR(1536),                      -- Embedding of attack text
    source VARCHAR(255),                         -- Where this pattern came from
    
    -- Metadata
    is_active BOOLEAN NOT NULL DEFAULT true,
    severity security_severity NOT NULL DEFAULT 'high',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attack_patterns_category ON security_attack_patterns(category) WHERE is_active = true;
CREATE INDEX idx_attack_patterns_embedding ON security_attack_patterns USING ivfflat (embedding vector_cosine_ops);

-- ============================================================================
-- Security Policy Groups (for organizing policies)
-- ============================================================================
CREATE TABLE security_policy_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Junction table for policy-group relationships
CREATE TABLE security_policy_group_members (
    policy_id UUID NOT NULL REFERENCES security_policies(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES security_policy_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (policy_id, group_id)
);

-- ============================================================================
-- Rate Limiting Configuration
-- ============================================================================
CREATE TABLE security_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Rate limit configuration
    max_requests INTEGER NOT NULL,
    window_seconds INTEGER NOT NULL,
    scope VARCHAR(50) NOT NULL DEFAULT 'user',  -- 'user', 'ip', 'tenant', 'global'
    
    -- Actions when exceeded
    action security_policy_action NOT NULL DEFAULT 'block',
    cooldown_seconds INTEGER NOT NULL DEFAULT 60,
    
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Seed Default Security Policies
-- ============================================================================

-- System Prompt Leakage Prevention
INSERT INTO security_policies (name, description, category, detection_method, pattern, severity, action, is_system, priority) VALUES
('System Prompt Leak - Direct Request', 
 'Blocks attempts to directly ask for system prompts or instructions',
 'system_leak', 'regex',
 '(?i)(show|reveal|display|print|output|give|tell|what\s+(?:is|are)|repeat)\s+(me\s+)?(your|the|system|initial|original|hidden|secret)\s*(prompt|instruction|directive|configuration|setup|guidelines?|rules?)',
 'high', 'block', true, 10),

('System Prompt Leak - Ignore Previous',
 'Blocks attempts to override system instructions',
 'prompt_injection', 'regex',
 '(?i)(ignore|disregard|forget|override|bypass|skip|cancel)\s+(all\s+)?(previous|prior|above|earlier|initial|original|system)\s*(instruction|prompt|directive|command|rule|guideline)',
 'critical', 'block', true, 5),

('System Prompt Leak - Role Override',
 'Blocks attempts to change AI role or persona',
 'jailbreak', 'regex',
 '(?i)(you\s+are\s+now|pretend\s+(to\s+be|you\s+are)|act\s+as|roleplay\s+as|from\s+now\s+on\s+you|let''?s\s+play|imagine\s+you\s+are)\s+(a|an|the)?\s*(different|new|unrestricted|uncensored|evil|malicious|hacker)',
 'critical', 'block', true, 5),

-- SQL Injection Prevention
('SQL Injection - Basic Patterns',
 'Blocks common SQL injection patterns in prompts',
 'sql_injection', 'regex',
 '(?i)(''|"|;)\s*(OR|AND|UNION|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC|EXECUTE|TRUNCATE|DECLARE)\s',
 'critical', 'block', true, 10),

('SQL Injection - Comment Bypass',
 'Blocks SQL comment-based injection attempts',
 'sql_injection', 'regex',
 '(?i)(--|#|/\*|\*/|;--)\s*(SELECT|UNION|DROP|DELETE|INSERT|UPDATE)',
 'critical', 'block', true, 10),

-- Data Exfiltration Prevention
('Data Exfiltration - Export Requests',
 'Detects attempts to export or download large amounts of data',
 'data_exfiltration', 'regex',
 '(?i)(export|download|extract|dump|backup|copy)\s+(all|entire|complete|full|every)\s*(user|customer|data|record|database|table|information)',
 'high', 'block', true, 20),

('Data Exfiltration - List All Users',
 'Blocks attempts to list all users or tenants',
 'data_exfiltration', 'regex',
 '(?i)(list|show|get|retrieve|fetch|display)\s+(all|every|complete)\s*(user|customer|account|tenant|client|member)',
 'high', 'block', true, 20),

-- Cross-Tenant Access Prevention
('Cross-Tenant - Other Tenant Data',
 'Blocks attempts to access other tenants data',
 'cross_tenant', 'regex',
 '(?i)(access|get|show|retrieve|query|fetch)\s+(data|information|record)\s+(from|of|for|belonging\s+to)\s+(other|different|another|tenant|organization|company)',
 'critical', 'block', true, 5),

('Cross-Tenant - Tenant ID Injection',
 'Blocks attempts to inject different tenant IDs',
 'cross_tenant', 'regex',
 '(?i)(tenant_?id|org_?id|organization_?id|company_?id)\s*[=:]\s*[''"]?[a-f0-9-]{8,}',
 'critical', 'block', true, 5),

-- Privilege Escalation Prevention
('Privilege Escalation - Admin Access',
 'Blocks attempts to gain admin access',
 'privilege_escalation', 'regex',
 '(?i)(give|grant|make|set|elevate|promote)\s+(me|myself|user)?\s*(to\s+)?(admin|administrator|superuser|root|owner|elevated)\s*(access|privilege|permission|role)?',
 'critical', 'block', true, 5),

('Privilege Escalation - Bypass Auth',
 'Blocks attempts to bypass authentication',
 'privilege_escalation', 'regex',
 '(?i)(bypass|skip|ignore|disable|circumvent)\s+(authentication|authorization|login|security|access\s+control|permission)',
 'critical', 'block', true, 5),

-- Jailbreak Prevention
('Jailbreak - DAN Mode',
 'Blocks common DAN (Do Anything Now) jailbreak attempts',
 'jailbreak', 'regex',
 '(?i)(DAN|do\s+anything\s+now|jailbreak|jailbroken|unlocked\s+mode|developer\s+mode|unrestricted\s+mode)',
 'critical', 'block', true, 5),

('Jailbreak - Hypothetical Scenario',
 'Detects hypothetical scenario jailbreak attempts',
 'jailbreak', 'regex',
 '(?i)(hypothetically|theoretically|in\s+a\s+fictional|imagine\s+if|what\s+if\s+you\s+(could|were|had))\s+(no\s+restrictions|no\s+limits|bypass|ignore\s+safety)',
 'high', 'warn', true, 15),

-- Encoding Attack Prevention
('Encoding Attack - Base64',
 'Detects Base64 encoded potentially malicious content',
 'encoding_attack', 'regex',
 '(?i)(decode|decrypt|interpret|execute)\s+(this\s+)?base64|[A-Za-z0-9+/]{50,}={0,2}',
 'medium', 'warn', true, 30),

('Encoding Attack - Unicode/Homoglyph',
 'Detects Unicode homoglyph obfuscation attempts',
 'encoding_attack', 'heuristic',
 NULL,  -- Handled by heuristic detection
 'medium', 'warn', true, 30),

-- PII Exposure Prevention
('PII Request - SSN',
 'Blocks requests for Social Security Numbers',
 'pii_exposure', 'regex',
 '(?i)(show|give|tell|provide|list|get)\s+(me\s+)?(all\s+)?(ssn|social\s+security|tax\s+id)',
 'critical', 'block', true, 10),

('PII Request - Credit Cards',
 'Blocks requests for credit card information',
 'pii_exposure', 'regex',
 '(?i)(show|give|tell|provide|list|get)\s+(me\s+)?(all\s+)?(credit\s+card|card\s+number|cvv|payment\s+card)',
 'critical', 'block', true, 10),

-- Architecture Discovery Prevention
('Architecture Discovery - Database Schema',
 'Blocks attempts to discover database schema',
 'system_leak', 'regex',
 '(?i)(show|describe|list|get|reveal)\s+(me\s+)?(the\s+)?(database|db|schema|table|column|field|structure|model)',
 'high', 'block', true, 15),

('Architecture Discovery - API Endpoints',
 'Blocks attempts to discover API endpoints',
 'system_leak', 'regex',
 '(?i)(show|list|reveal|tell)\s+(me\s+)?(all\s+)?(api|endpoint|route|url|path|service)',
 'high', 'block', true, 15),

('Architecture Discovery - Tech Stack',
 'Blocks attempts to discover technology stack',
 'system_leak', 'regex',
 '(?i)(what|which)\s+(technology|framework|library|database|language|stack|infrastructure|cloud|aws|azure|gcp)\s+(do\s+you|are\s+you|is\s+this)',
 'medium', 'warn', true, 25);

-- ============================================================================
-- Default Rate Limits
-- ============================================================================
INSERT INTO security_rate_limits (name, description, max_requests, window_seconds, scope, action) VALUES
('User Rate Limit', 'Default per-user rate limit', 60, 60, 'user', 'rate_limit'),
('IP Rate Limit', 'Default per-IP rate limit', 100, 60, 'ip', 'rate_limit'),
('Tenant Rate Limit', 'Default per-tenant rate limit', 1000, 60, 'tenant', 'rate_limit');

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to check if a prompt matches any security policy
CREATE OR REPLACE FUNCTION check_security_policies(
    p_tenant_id UUID,
    p_input_text TEXT
) RETURNS TABLE (
    policy_id UUID,
    policy_name VARCHAR(255),
    category security_policy_category,
    severity security_severity,
    action security_policy_action,
    matched_pattern TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.id,
        sp.name,
        sp.category,
        sp.severity,
        sp.action,
        substring(p_input_text FROM sp.pattern) as matched_pattern
    FROM security_policies sp
    WHERE sp.is_enabled = true
      AND (sp.tenant_id IS NULL OR sp.tenant_id = p_tenant_id)
      AND sp.detection_method = 'regex'
      AND p_input_text ~* sp.pattern
    ORDER BY sp.priority ASC, sp.severity DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to log a policy violation
CREATE OR REPLACE FUNCTION log_security_violation(
    p_tenant_id UUID,
    p_policy_id UUID,
    p_user_id UUID,
    p_session_id UUID,
    p_input_text TEXT,
    p_matched_pattern TEXT,
    p_confidence FLOAT,
    p_action security_policy_action,
    p_ip_address INET,
    p_user_agent TEXT
) RETURNS UUID AS $$
DECLARE
    v_violation_id UUID;
    v_severity security_severity;
BEGIN
    -- Get policy severity
    SELECT severity INTO v_severity FROM security_policies WHERE id = p_policy_id;
    
    -- Insert violation record
    INSERT INTO security_policy_violations (
        tenant_id, policy_id, user_id, session_id,
        input_text, matched_pattern, confidence_score,
        severity, action_taken, ip_address, user_agent
    ) VALUES (
        p_tenant_id, p_policy_id, p_user_id, p_session_id,
        LEFT(p_input_text, 10000), p_matched_pattern, p_confidence,
        v_severity, p_action, p_ip_address, p_user_agent
    ) RETURNING id INTO v_violation_id;
    
    -- Update policy match count
    UPDATE security_policies 
    SET match_count = match_count + 1, 
        last_matched_at = CURRENT_TIMESTAMP
    WHERE id = p_policy_id;
    
    RETURN v_violation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get security policy statistics
CREATE OR REPLACE FUNCTION get_security_stats(
    p_tenant_id UUID,
    p_days INTEGER DEFAULT 30
) RETURNS TABLE (
    total_violations BIGINT,
    violations_by_category JSONB,
    violations_by_severity JSONB,
    top_triggered_policies JSONB,
    false_positive_rate FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE is_false_positive = true) as false_positives
        FROM security_policy_violations
        WHERE tenant_id = p_tenant_id
          AND created_at >= CURRENT_TIMESTAMP - (p_days || ' days')::INTERVAL
    ),
    by_category AS (
        SELECT jsonb_object_agg(sp.category::text, cnt) as data
        FROM (
            SELECT sp.category, COUNT(*) as cnt
            FROM security_policy_violations spv
            JOIN security_policies sp ON sp.id = spv.policy_id
            WHERE spv.tenant_id = p_tenant_id
              AND spv.created_at >= CURRENT_TIMESTAMP - (p_days || ' days')::INTERVAL
            GROUP BY sp.category
        ) sub
        JOIN security_policies sp ON true
        LIMIT 1
    ),
    by_severity AS (
        SELECT jsonb_object_agg(severity::text, cnt) as data
        FROM (
            SELECT severity, COUNT(*) as cnt
            FROM security_policy_violations
            WHERE tenant_id = p_tenant_id
              AND created_at >= CURRENT_TIMESTAMP - (p_days || ' days')::INTERVAL
            GROUP BY severity
        ) sub
    ),
    top_policies AS (
        SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'count', cnt)) as data
        FROM (
            SELECT sp.id, sp.name, COUNT(*) as cnt
            FROM security_policy_violations spv
            JOIN security_policies sp ON sp.id = spv.policy_id
            WHERE spv.tenant_id = p_tenant_id
              AND spv.created_at >= CURRENT_TIMESTAMP - (p_days || ' days')::INTERVAL
            GROUP BY sp.id, sp.name
            ORDER BY cnt DESC
            LIMIT 10
        ) sub
    )
    SELECT 
        s.total,
        COALESCE(bc.data, '{}'::jsonb),
        COALESCE(bs.data, '{}'::jsonb),
        COALESCE(tp.data, '[]'::jsonb),
        CASE WHEN s.total > 0 THEN s.false_positives::float / s.total ELSE 0 END
    FROM stats s
    CROSS JOIN by_category bc
    CROSS JOIN by_severity bs
    CROSS JOIN top_policies tp;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamps
CREATE TRIGGER update_security_policies_timestamp
    BEFORE UPDATE ON security_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_security_policy_groups_timestamp
    BEFORE UPDATE ON security_policy_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_security_rate_limits_timestamp
    BEFORE UPDATE ON security_rate_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_security_attack_patterns_timestamp
    BEFORE UPDATE ON security_attack_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE security_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_policy_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_policy_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_rate_limits ENABLE ROW LEVEL SECURITY;

-- Policies can see global policies (tenant_id IS NULL) or their own
CREATE POLICY tenant_security_policies ON security_policies
    FOR ALL USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_security_violations ON security_policy_violations
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_security_groups ON security_policy_groups
    FOR ALL USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_security_rate_limits ON security_rate_limits
    FOR ALL USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Comments
COMMENT ON TABLE security_policies IS 'Dynamic security policy registry for prompt injection and attack prevention';
COMMENT ON TABLE security_policy_violations IS 'Log of security policy violations for audit and analysis';
COMMENT ON TABLE security_attack_patterns IS 'Known attack patterns for embedding similarity detection';
COMMENT ON TABLE security_policy_groups IS 'Groups for organizing related security policies';
COMMENT ON TABLE security_rate_limits IS 'Rate limiting configuration to prevent abuse';
