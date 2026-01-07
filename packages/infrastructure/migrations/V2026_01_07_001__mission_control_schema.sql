-- ============================================================================
-- RADIANT Mission Control Schema
-- Migration: V2026_01_07_001__mission_control_schema.sql
-- Version: 4.19.0
-- Date: January 7, 2026
-- ============================================================================

-- ============================================================================
-- PART 1: PENDING DECISIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pending_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  
  -- Question details
  question TEXT NOT NULL,
  context JSONB NOT NULL,
  options JSONB DEFAULT '[]'::jsonb,
  topic_tag VARCHAR(100),
  
  -- Domain classification (determines timeout and escalation)
  domain VARCHAR(50) NOT NULL CHECK (domain IN ('medical', 'financial', 'legal', 'general')),
  urgency VARCHAR(20) DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'critical')),
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'expired', 'escalated')),
  
  -- Timeout configuration (domain-specific defaults applied by application)
  timeout_seconds INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Flyte workflow tracking
  flyte_execution_id VARCHAR(256) NOT NULL,
  flyte_node_id VARCHAR(256) NOT NULL,
  
  -- Cato integration
  cato_escalation_id UUID REFERENCES cato_human_escalations(id),
  cato_session_id UUID,
  epistemic_recovery_attempt INTEGER,
  
  -- Resolution details (populated when resolved)
  resolution VARCHAR(50),  -- 'approved', 'rejected', 'modified', 'timed_out', 'escalated'
  guidance TEXT,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure tenant isolation
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- ============================================================================
-- PART 2: DECISION AUDIT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS decision_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES pending_decisions(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Action details
  action VARCHAR(50) NOT NULL,  -- 'created', 'viewed', 'resolved', 'expired', 'escalated'
  actor_id UUID REFERENCES users(id),
  actor_type VARCHAR(50) NOT NULL,  -- 'user', 'system', 'timeout_lambda', 'cato'
  
  -- Details
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 3: DOMAIN CONFIGURATION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS decision_domain_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = global default
  
  -- Domain
  domain VARCHAR(50) NOT NULL CHECK (domain IN ('medical', 'financial', 'legal', 'general')),
  
  -- Timeout settings
  default_timeout_seconds INTEGER NOT NULL,
  escalation_timeout_seconds INTEGER NOT NULL,
  
  -- Escalation settings
  auto_escalate BOOLEAN DEFAULT TRUE,
  escalation_channel VARCHAR(100),  -- 'pagerduty', 'slack', 'email', 'sms'
  escalation_target VARCHAR(256),   -- channel ID, email, phone
  
  -- Access control
  required_roles TEXT[] DEFAULT '{}',  -- e.g., ['MD', 'RN'] for medical
  
  -- Feature flags
  allow_auto_resolve BOOLEAN DEFAULT FALSE,
  require_guidance BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (tenant_id, domain)
);

-- ============================================================================
-- PART 4: WEBSOCKET CONNECTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS websocket_connections (
  connection_id VARCHAR(256) PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  
  -- Connection state
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  
  -- Subscription filters
  subscribed_domains TEXT[] DEFAULT '{}',
  
  -- Connection metadata
  api_endpoint VARCHAR(512),
  
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- ============================================================================
-- PART 5: ROW-LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE pending_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_domain_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE websocket_connections ENABLE ROW LEVEL SECURITY;

-- Pending Decisions RLS
CREATE POLICY pending_decisions_tenant_isolation ON pending_decisions
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY pending_decisions_service_access ON pending_decisions
  FOR ALL
  TO radiant_service
  USING (TRUE);

-- Decision Audit RLS
CREATE POLICY decision_audit_tenant_isolation ON decision_audit
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY decision_audit_service_access ON decision_audit
  FOR ALL
  TO radiant_service
  USING (TRUE);

-- Domain Config RLS (tenant-specific or global)
CREATE POLICY domain_config_tenant_isolation ON decision_domain_config
  FOR ALL
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id')::UUID);

-- WebSocket Connections RLS
CREATE POLICY websocket_tenant_isolation ON websocket_connections
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY websocket_service_access ON websocket_connections
  FOR ALL
  TO radiant_service
  USING (TRUE);

-- ============================================================================
-- PART 6: INDEXES
-- ============================================================================

-- Pending Decisions indexes
CREATE INDEX IF NOT EXISTS idx_pending_decisions_tenant_status 
  ON pending_decisions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_decisions_tenant_domain 
  ON pending_decisions(tenant_id, domain);
CREATE INDEX IF NOT EXISTS idx_pending_decisions_expires_at 
  ON pending_decisions(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_pending_decisions_flyte_execution 
  ON pending_decisions(flyte_execution_id);
CREATE INDEX IF NOT EXISTS idx_pending_decisions_cato_escalation 
  ON pending_decisions(cato_escalation_id) WHERE cato_escalation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pending_decisions_session 
  ON pending_decisions(session_id);

-- Decision Audit indexes
CREATE INDEX IF NOT EXISTS idx_decision_audit_decision 
  ON decision_audit(decision_id);
CREATE INDEX IF NOT EXISTS idx_decision_audit_tenant_time 
  ON decision_audit(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_audit_actor 
  ON decision_audit(actor_id) WHERE actor_id IS NOT NULL;

-- WebSocket Connections indexes
CREATE INDEX IF NOT EXISTS idx_websocket_tenant 
  ON websocket_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_websocket_heartbeat 
  ON websocket_connections(last_heartbeat);

-- ============================================================================
-- PART 7: TRIGGERS
-- ============================================================================

-- Updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
DROP TRIGGER IF EXISTS pending_decisions_updated_at ON pending_decisions;
CREATE TRIGGER pending_decisions_updated_at
  BEFORE UPDATE ON pending_decisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS domain_config_updated_at ON decision_domain_config;
CREATE TRIGGER domain_config_updated_at
  BEFORE UPDATE ON decision_domain_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit trigger for pending_decisions changes
CREATE OR REPLACE FUNCTION audit_decision_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO decision_audit (decision_id, tenant_id, action, actor_type, details)
    VALUES (NEW.id, NEW.tenant_id, 'created', 'system', 
            jsonb_build_object('domain', NEW.domain, 'timeout_seconds', NEW.timeout_seconds));
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      INSERT INTO decision_audit (decision_id, tenant_id, action, actor_id, actor_type, details)
      VALUES (NEW.id, NEW.tenant_id, 
              CASE NEW.status 
                WHEN 'resolved' THEN 'resolved'
                WHEN 'expired' THEN 'expired'
                WHEN 'escalated' THEN 'escalated'
                ELSE 'updated'
              END,
              NEW.resolved_by,
              CASE WHEN NEW.resolved_by IS NOT NULL THEN 'user' ELSE 'system' END,
              jsonb_build_object(
                'old_status', OLD.status, 
                'new_status', NEW.status,
                'resolution', NEW.resolution,
                'guidance', NEW.guidance
              ));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS decision_audit_trigger ON pending_decisions;
CREATE TRIGGER decision_audit_trigger
  AFTER INSERT OR UPDATE ON pending_decisions
  FOR EACH ROW EXECUTE FUNCTION audit_decision_changes();

-- ============================================================================
-- PART 8: DEFAULT DOMAIN CONFIGURATIONS
-- ============================================================================

INSERT INTO decision_domain_config (
  tenant_id, domain, default_timeout_seconds, escalation_timeout_seconds,
  auto_escalate, escalation_channel, required_roles, allow_auto_resolve, require_guidance
) VALUES
  -- Global defaults (tenant_id = NULL)
  (NULL, 'medical', 300, 60, TRUE, 'pagerduty', ARRAY['MD', 'RN', 'PA'], FALSE, TRUE),
  (NULL, 'financial', 600, 120, TRUE, 'pagerduty', ARRAY['ANALYST', 'ADVISOR'], FALSE, TRUE),
  (NULL, 'legal', 900, 180, TRUE, 'email', ARRAY['LEGAL', 'COMPLIANCE'], FALSE, TRUE),
  (NULL, 'general', 1800, 300, TRUE, 'slack', ARRAY[]::TEXT[], TRUE, FALSE)
ON CONFLICT (tenant_id, domain) DO NOTHING;

-- ============================================================================
-- PART 9: MIGRATION LOG
-- ============================================================================

INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('V2026_01_07_001', 'Mission Control HITL Schema v4.19.0', NOW())
ON CONFLICT DO NOTHING;
