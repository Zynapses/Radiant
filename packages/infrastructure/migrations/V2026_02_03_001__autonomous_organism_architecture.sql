-- RADIANT Autonomous Organism Architecture Migration
-- Project Metamorphosis - Database Schema
-- Version: 1.0.0
-- Date: 2026-02-03

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE mcp_transport AS ENUM (
  'stdio', 'sse', 'streamable-http', 'websocket', 'wasm-local'
);

CREATE TYPE mcp_auth_type AS ENUM (
  'none', 'api_key', 'oauth2', 'jwt', 'mtls'
);

CREATE TYPE mcp_server_status AS ENUM (
  'active', 'disabled', 'deprecated', 'pending_review'
);

CREATE TYPE mcp_health_status AS ENUM (
  'healthy', 'degraded', 'unhealthy', 'unknown'
);

CREATE TYPE tool_category AS ENUM (
  'data_retrieval', 'data_manipulation', 'communication',
  'file_operations', 'api_integration', 'computation',
  'search', 'generation', 'analysis', 'automation'
);

CREATE TYPE tool_sensitivity AS ENUM (
  'public', 'internal', 'confidential', 'restricted'
);

CREATE TYPE genesis_tool_status AS ENUM (
  'queued', 'scraping', 'generating', 'validating', 'sandbox_testing',
  'approved', 'rejected', 'deployed', 'failed'
);

CREATE TYPE compute_location AS ENUM (
  'browser', 'local', 'edge', 'cloud'
);

CREATE TYPE compute_reason AS ENUM (
  'privacy', 'latency', 'cost', 'capability', 'availability', 'user_preference'
);

CREATE TYPE ghost_simulation_type AS ENUM (
  'user_reaction', 'outcome_prediction', 'safety_check', 'cost_estimation', 'latency_estimation'
);

CREATE TYPE ghost_confidence_level AS ENUM (
  'high', 'medium', 'low', 'uncertain'
);

-- ============================================================================
-- MCP SERVERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_servers (
  server_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Basic info
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Transport configuration
  transport mcp_transport NOT NULL DEFAULT 'streamable-http',
  url TEXT,
  command TEXT,
  args JSONB DEFAULT '[]',
  env JSONB DEFAULT '{}',
  
  -- Neural routing metadata
  domain_affinity JSONB DEFAULT '[]',
  embedding_vector TEXT, -- Base64 encoded Float32Array
  proficiency_scores JSONB DEFAULT '{}',
  neural_affinity_model VARCHAR(100) DEFAULT 'cortex-routing-v1',
  
  -- Health metrics
  health_endpoint TEXT,
  last_health_check TIMESTAMPTZ,
  health_status mcp_health_status DEFAULT 'unknown',
  error_rate DOUBLE PRECISION DEFAULT 0,
  avg_latency_ms DOUBLE PRECISION DEFAULT 0,
  p50_latency_ms DOUBLE PRECISION DEFAULT 0,
  p95_latency_ms DOUBLE PRECISION DEFAULT 0,
  p99_latency_ms DOUBLE PRECISION DEFAULT 0,
  
  -- Cost tracking
  cost_per_call DOUBLE PRECISION DEFAULT 0,
  total_calls_today INTEGER DEFAULT 0,
  total_cost_today DOUBLE PRECISION DEFAULT 0,
  budget_limit DOUBLE PRECISION,
  
  -- Authentication
  auth_type mcp_auth_type DEFAULT 'none',
  credentials_encrypted TEXT,
  credential_rotation_days INTEGER,
  
  -- Capabilities
  supported_capabilities JSONB DEFAULT '[]',
  max_concurrent_calls INTEGER DEFAULT 10,
  timeout_ms INTEGER DEFAULT 30000,
  retry_config JSONB DEFAULT '{"maxAttempts": 3, "initialDelayMs": 1000, "maxDelayMs": 30000, "backoffMultiplier": 2}',
  
  -- Lifecycle
  status mcp_server_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_mcp_servers_tenant ON mcp_servers(tenant_id);
CREATE INDEX idx_mcp_servers_status ON mcp_servers(status);
CREATE INDEX idx_mcp_servers_health ON mcp_servers(health_status);
CREATE INDEX idx_mcp_servers_domain ON mcp_servers USING GIN(domain_affinity);

-- ============================================================================
-- MCP TOOL SCHEMAS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_tool_schemas (
  tool_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES mcp_servers(server_id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Basic info
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Schema definitions
  input_schema_json JSONB DEFAULT '{}',
  output_schema_json JSONB DEFAULT '{}',
  
  -- Neural embeddings
  description_embedding TEXT,
  structure_embedding TEXT,
  neural_signature TEXT,
  
  -- Classification
  category tool_category DEFAULT 'data_retrieval',
  tags JSONB DEFAULT '[]',
  is_structured_output BOOLEAN DEFAULT false,
  
  -- Usage metrics
  success_rate DOUBLE PRECISION DEFAULT 1,
  avg_execution_ms DOUBLE PRECISION DEFAULT 0,
  last_used TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  
  -- Domain mapping
  primary_domain VARCHAR(100) DEFAULT 'general',
  secondary_domains JSONB DEFAULT '[]',
  proficiency_by_model JSONB DEFAULT '{}',
  
  -- Access control
  required_permissions JSONB DEFAULT '[]',
  sensitivity_level tool_sensitivity DEFAULT 'public',
  
  -- Cost
  estimated_cost_per_call DOUBLE PRECISION DEFAULT 0,
  actual_avg_cost DOUBLE PRECISION,
  
  -- Metadata
  version VARCHAR(20) DEFAULT '1.0.0',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mcp_tool_schemas_server ON mcp_tool_schemas(server_id);
CREATE INDEX idx_mcp_tool_schemas_tenant ON mcp_tool_schemas(tenant_id);
CREATE INDEX idx_mcp_tool_schemas_category ON mcp_tool_schemas(category);
CREATE INDEX idx_mcp_tool_schemas_domain ON mcp_tool_schemas(primary_domain);
CREATE INDEX idx_mcp_tool_schemas_active ON mcp_tool_schemas(is_active);
CREATE INDEX idx_mcp_tool_schemas_tags ON mcp_tool_schemas USING GIN(tags);

-- ============================================================================
-- MCP ROUTING DECISIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_routing_decisions (
  decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  selected_tool_id UUID REFERENCES mcp_tool_schemas(tool_id),
  selection_reason TEXT,
  fallback_tools JSONB DEFAULT '[]',
  
  -- Metrics
  routing_time_ms INTEGER,
  candidates_evaluated INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mcp_routing_decisions_tenant ON mcp_routing_decisions(tenant_id);
CREATE INDEX idx_mcp_routing_decisions_tool ON mcp_routing_decisions(selected_tool_id);
CREATE INDEX idx_mcp_routing_decisions_created ON mcp_routing_decisions(created_at);

-- ============================================================================
-- GENESIS TOOL REQUESTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS genesis_tool_requests (
  request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Request details
  target_service TEXT NOT NULL,
  target_capability TEXT NOT NULL,
  natural_language_spec TEXT NOT NULL,
  intent_embedding TEXT,
  existing_similar_tools JSONB DEFAULT '[]',
  user_context JSONB,
  
  -- Constraints
  max_generation_time_ms INTEGER DEFAULT 120000,
  require_sandbox_validation BOOLEAN DEFAULT true,
  security_level tool_sensitivity DEFAULT 'public',
  
  -- Status
  status genesis_tool_status DEFAULT 'queued',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_genesis_requests_tenant ON genesis_tool_requests(tenant_id);
CREATE INDEX idx_genesis_requests_user ON genesis_tool_requests(user_id);
CREATE INDEX idx_genesis_requests_status ON genesis_tool_requests(status);
CREATE INDEX idx_genesis_requests_created ON genesis_tool_requests(created_at);

-- ============================================================================
-- GENESIS TOOL RESULTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS genesis_tool_results (
  result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES genesis_tool_requests(request_id) ON DELETE CASCADE,
  tool_id UUID REFERENCES mcp_tool_schemas(tool_id),
  
  -- Generated artifacts
  mcp_server_code TEXT,
  zod_schemas TEXT,
  test_cases JSONB DEFAULT '[]',
  documentation TEXT,
  
  -- Validation
  sandbox_passed BOOLEAN,
  sandbox_execution_time_ms INTEGER,
  sandbox_memory_mb DOUBLE PRECISION,
  security_scan_result VARCHAR(10),
  functional_test_result VARCHAR(10),
  sandbox_errors JSONB,
  
  -- Metrics
  generation_time_ms INTEGER,
  tokens_used INTEGER,
  estimated_cost DOUBLE PRECISION,
  
  -- Deployment
  deployed_at TIMESTAMPTZ,
  hot_loaded_sessions JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_genesis_results_request ON genesis_tool_results(request_id);
CREATE INDEX idx_genesis_results_tool ON genesis_tool_results(tool_id);
CREATE INDEX idx_genesis_results_deployed ON genesis_tool_results(deployed_at);

-- ============================================================================
-- GENESIS API DISCOVERY CACHE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS genesis_api_discovery_cache (
  cache_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  service_url TEXT NOT NULL UNIQUE,
  discovery_method VARCHAR(50),
  
  -- Discovered data
  endpoints JSONB DEFAULT '[]',
  auth_requirements JSONB,
  rate_limits JSONB,
  
  -- Metadata
  confidence_score DOUBLE PRECISION DEFAULT 0,
  last_scraped_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_genesis_api_cache_url ON genesis_api_discovery_cache(service_url);
CREATE INDEX idx_genesis_api_cache_scraped ON genesis_api_discovery_cache(last_scraped_at);

-- ============================================================================
-- LIQUID COMPUTE TOPOLOGIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS liquid_compute_topologies (
  topology_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  
  -- Capabilities
  browser_capabilities JSONB DEFAULT '{"wasmSupported": true, "webGPUSupported": false, "maxMemoryMb": 2048, "estimatedComputeScore": 0.5, "supportedModels": []}',
  local_capabilities JSONB,
  edge_locations JSONB DEFAULT '[]',
  cloud_regions JSONB DEFAULT '[]',
  
  -- Configuration
  default_location compute_location DEFAULT 'cloud',
  domain_location_overrides JSONB DEFAULT '{}',
  sensitivity_location_rules JSONB DEFAULT '{"public": ["browser", "local", "edge", "cloud"], "internal": ["local", "edge", "cloud"], "confidential": ["local", "cloud"], "restricted": ["local"]}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_liquid_compute_tenant ON liquid_compute_topologies(tenant_id);

-- ============================================================================
-- LIQUID COMPUTE DECISIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS liquid_compute_decisions (
  decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  tool_id UUID,
  selected_location compute_location NOT NULL,
  reason compute_reason NOT NULL,
  alternatives JSONB DEFAULT '[]',
  
  -- Execution details
  execution_endpoint TEXT,
  estimated_latency_ms INTEGER,
  estimated_cost DOUBLE PRECISION,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_liquid_compute_decisions_tenant ON liquid_compute_decisions(tenant_id);
CREATE INDEX idx_liquid_compute_decisions_location ON liquid_compute_decisions(selected_location);
CREATE INDEX idx_liquid_compute_decisions_created ON liquid_compute_decisions(created_at);

-- ============================================================================
-- GHOST VECTORS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ghost_vectors (
  vector_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Core vectors (Base64 encoded Float32Arrays)
  vector_data TEXT, -- 4096 dimensions
  preference_vector TEXT, -- 1024 dimensions
  behavior_vector TEXT, -- 1024 dimensions
  emotional_vector TEXT, -- 1024 dimensions
  knowledge_vector TEXT, -- 1024 dimensions
  
  -- Metadata
  interaction_count INTEGER DEFAULT 0,
  confidence_score DOUBLE PRECISION DEFAULT 0,
  decay_rate DOUBLE PRECISION DEFAULT 0.01,
  
  -- Timestamps
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  last_decay_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX idx_ghost_vectors_user ON ghost_vectors(user_id);
CREATE INDEX idx_ghost_vectors_tenant ON ghost_vectors(tenant_id);
CREATE INDEX idx_ghost_vectors_confidence ON ghost_vectors(confidence_score);
CREATE INDEX idx_ghost_vectors_updated ON ghost_vectors(last_updated);

-- ============================================================================
-- GHOST SIMULATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ghost_simulations (
  simulation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Simulation details
  type ghost_simulation_type NOT NULL,
  tool_id UUID,
  proposed_action TEXT,
  context JSONB DEFAULT '{}',
  
  -- Results
  prediction JSONB DEFAULT '{}',
  confidence ghost_confidence_level DEFAULT 'uncertain',
  
  -- Metrics
  simulation_time_ms INTEGER,
  model_used VARCHAR(100),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ghost_simulations_tenant ON ghost_simulations(tenant_id);
CREATE INDEX idx_ghost_simulations_user ON ghost_simulations(user_id);
CREATE INDEX idx_ghost_simulations_type ON ghost_simulations(type);
CREATE INDEX idx_ghost_simulations_confidence ON ghost_simulations(confidence);
CREATE INDEX idx_ghost_simulations_created ON ghost_simulations(created_at);

-- ============================================================================
-- GHOST CALIBRATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ghost_calibrations (
  calibration_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Accuracy metrics
  prediction_accuracy DOUBLE PRECISION DEFAULT 0.5,
  satisfaction_correlation DOUBLE PRECISION DEFAULT 0,
  outcome_correlation DOUBLE PRECISION DEFAULT 0,
  
  -- Counts
  total_predictions INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  calibration_data_points INTEGER DEFAULT 0,
  
  last_calibrated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX idx_ghost_calibrations_user ON ghost_calibrations(user_id);
CREATE INDEX idx_ghost_calibrations_tenant ON ghost_calibrations(tenant_id);
CREATE INDEX idx_ghost_calibrations_accuracy ON ghost_calibrations(prediction_accuracy);

-- ============================================================================
-- USER INTERACTIONS TABLE (for Ghost Vector training)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ghost_user_interactions (
  interaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  tool_id UUID,
  input_text TEXT,
  output_text TEXT,
  
  -- Feedback metrics
  satisfaction DOUBLE PRECISION,
  frustration DOUBLE PRECISION,
  engagement DOUBLE PRECISION,
  outcome VARCHAR(20), -- 'success', 'partial', 'failure'
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ghost_interactions_user ON ghost_user_interactions(user_id);
CREATE INDEX idx_ghost_interactions_tenant ON ghost_user_interactions(tenant_id);
CREATE INDEX idx_ghost_interactions_tool ON ghost_user_interactions(tool_id);
CREATE INDEX idx_ghost_interactions_outcome ON ghost_user_interactions(outcome);
CREATE INDEX idx_ghost_interactions_created ON ghost_user_interactions(created_at);

-- ============================================================================
-- ORGANISM TELEMETRY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS organism_telemetry (
  telemetry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- System health
  overall_health_score DOUBLE PRECISION,
  mcp_servers_healthy INTEGER,
  mcp_servers_total INTEGER,
  genesis_queue_depth INTEGER,
  ghost_simulation_latency DOUBLE PRECISION,
  economic_budget_utilization DOUBLE PRECISION,
  
  -- Neural metrics
  routing_accuracy DOUBLE PRECISION,
  schema_match_rate DOUBLE PRECISION,
  embedding_cache_hit_rate DOUBLE PRECISION,
  average_affinity_score DOUBLE PRECISION,
  
  -- Genesis metrics
  tools_generated_today INTEGER,
  tools_deployed_today INTEGER,
  average_generation_time DOUBLE PRECISION,
  sandbox_pass_rate DOUBLE PRECISION,
  
  -- Ghost metrics
  simulations_run_today INTEGER,
  prediction_accuracy DOUBLE PRECISION,
  average_simulation_time DOUBLE PRECISION,
  user_satisfaction_correlation DOUBLE PRECISION,
  
  -- Economic metrics
  total_spend_today DOUBLE PRECISION,
  savings_from_optimization DOUBLE PRECISION,
  budget_utilization DOUBLE PRECISION,
  autonomous_decisions_made INTEGER,
  
  collected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_organism_telemetry_tenant ON organism_telemetry(tenant_id);
CREATE INDEX idx_organism_telemetry_collected ON organism_telemetry(collected_at);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_tool_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_routing_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE genesis_tool_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE genesis_tool_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquid_compute_topologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquid_compute_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghost_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghost_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghost_calibrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghost_user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organism_telemetry ENABLE ROW LEVEL SECURITY;

-- RLS Policies for MCP Servers
CREATE POLICY mcp_servers_tenant_isolation ON mcp_servers
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID OR tenant_id IS NULL);

-- RLS Policies for Tool Schemas
CREATE POLICY mcp_tool_schemas_tenant_isolation ON mcp_tool_schemas
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID OR tenant_id IS NULL);

-- RLS Policies for Routing Decisions
CREATE POLICY mcp_routing_decisions_tenant_isolation ON mcp_routing_decisions
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- RLS Policies for Genesis Requests
CREATE POLICY genesis_requests_tenant_isolation ON genesis_tool_requests
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- RLS Policies for Genesis Results
CREATE POLICY genesis_results_tenant_isolation ON genesis_tool_results
  USING (request_id IN (
    SELECT request_id FROM genesis_tool_requests 
    WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
  ));

-- RLS Policies for Liquid Compute
CREATE POLICY liquid_compute_topologies_tenant_isolation ON liquid_compute_topologies
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY liquid_compute_decisions_tenant_isolation ON liquid_compute_decisions
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- RLS Policies for Ghost
CREATE POLICY ghost_vectors_tenant_isolation ON ghost_vectors
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY ghost_simulations_tenant_isolation ON ghost_simulations
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY ghost_calibrations_tenant_isolation ON ghost_calibrations
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY ghost_interactions_tenant_isolation ON ghost_user_interactions
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- RLS Policies for Telemetry
CREATE POLICY organism_telemetry_tenant_isolation ON organism_telemetry
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE mcp_servers IS 'MCP server registry with neural affinity routing metadata';
COMMENT ON TABLE mcp_tool_schemas IS 'Tool schemas with neural embeddings for intelligent discovery';
COMMENT ON TABLE mcp_routing_decisions IS 'Audit log of neural routing decisions';
COMMENT ON TABLE genesis_tool_requests IS 'Genesis Auto-Tool pipeline requests';
COMMENT ON TABLE genesis_tool_results IS 'Genesis Auto-Tool pipeline results and generated code';
COMMENT ON TABLE genesis_api_discovery_cache IS 'Cached API discovery results for Genesis';
COMMENT ON TABLE liquid_compute_topologies IS 'Compute topology configuration per tenant';
COMMENT ON TABLE liquid_compute_decisions IS 'Audit log of compute location decisions';
COMMENT ON TABLE ghost_vectors IS 'User digital twin vectors for prediction';
COMMENT ON TABLE ghost_simulations IS 'Ghost simulation results and predictions';
COMMENT ON TABLE ghost_calibrations IS 'Ghost simulation calibration metrics';
COMMENT ON TABLE ghost_user_interactions IS 'User interactions for Ghost Vector training';
COMMENT ON TABLE organism_telemetry IS 'Autonomous Organism health telemetry';

-- ============================================================================
-- ECONOMIC CORTEX TABLES
-- ============================================================================

CREATE TYPE negotiation_strategy AS ENUM (
  'aggressive', 'balanced', 'conservative'
);

CREATE TYPE budget_scope AS ENUM (
  'tenant', 'user', 'session', 'task'
);

CREATE TYPE budget_alert_level AS ENUM (
  'info', 'warning', 'critical', 'exceeded'
);

CREATE TABLE IF NOT EXISTS economic_cortex_configs (
  config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  
  -- Budget configuration
  budgets JSONB DEFAULT '[]',
  alert_thresholds JSONB DEFAULT '[]',
  
  -- Optimization settings
  prefer_self_hosted BOOLEAN DEFAULT true,
  quality_floor DOUBLE PRECISION DEFAULT 0.7,
  latency_target INTEGER DEFAULT 2000,
  
  -- Autonomous features
  autonomous_budget_negotiation BOOLEAN DEFAULT true,
  negotiation_strategy negotiation_strategy DEFAULT 'balanced',
  auto_scale_on_demand BOOLEAN DEFAULT false,
  
  -- Crypto wallet (optional)
  crypto_wallet_enabled BOOLEAN DEFAULT false,
  crypto_wallet_address TEXT,
  micropayment_threshold DOUBLE PRECISION,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_economic_cortex_configs_tenant ON economic_cortex_configs(tenant_id);

CREATE TABLE IF NOT EXISTS economic_cortex_budgets (
  budget_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  scope budget_scope NOT NULL DEFAULT 'tenant',
  scope_id UUID NOT NULL,
  
  -- Budget limits
  total_budget DOUBLE PRECISION NOT NULL DEFAULT 1000,
  used_budget DOUBLE PRECISION DEFAULT 0,
  reserved_budget DOUBLE PRECISION DEFAULT 0,
  
  -- Period
  period_type VARCHAR(20) DEFAULT 'monthly',
  period_start TIMESTAMPTZ DEFAULT NOW(),
  period_end TIMESTAMPTZ,
  
  -- Controls
  hard_limit BOOLEAN DEFAULT false,
  auto_renew BOOLEAN DEFAULT true,
  
  -- Metrics
  avg_daily_spend DOUBLE PRECISION DEFAULT 0,
  projected_end_of_period DOUBLE PRECISION DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_economic_cortex_budgets_tenant ON economic_cortex_budgets(tenant_id);
CREATE INDEX idx_economic_cortex_budgets_scope ON economic_cortex_budgets(scope, scope_id);

CREATE TABLE IF NOT EXISTS economic_cortex_alerts (
  alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID REFERENCES economic_cortex_budgets(budget_id) ON DELETE CASCADE,
  
  threshold_percent INTEGER NOT NULL,
  level budget_alert_level NOT NULL,
  
  -- Actions
  notify_admin BOOLEAN DEFAULT false,
  notify_user BOOLEAN DEFAULT true,
  pause_execution BOOLEAN DEFAULT false,
  switch_to_lower_tier BOOLEAN DEFAULT false,
  
  -- State
  triggered BOOLEAN DEFAULT false,
  triggered_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_economic_cortex_alerts_budget ON economic_cortex_alerts(budget_id);

CREATE TABLE IF NOT EXISTS economic_cortex_negotiations (
  negotiation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Request
  requested_action TEXT,
  estimated_cost DOUBLE PRECISION,
  available_budget DOUBLE PRECISION,
  
  -- Negotiation
  strategy negotiation_strategy,
  alternatives JSONB DEFAULT '[]',
  selected_alternative JSONB,
  
  -- Result
  approved BOOLEAN DEFAULT false,
  final_cost DOUBLE PRECISION,
  savings_achieved DOUBLE PRECISION DEFAULT 0,
  
  negotiated_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

CREATE INDEX idx_economic_cortex_negotiations_tenant ON economic_cortex_negotiations(tenant_id);
CREATE INDEX idx_economic_cortex_negotiations_created ON economic_cortex_negotiations(negotiated_at);

CREATE TABLE IF NOT EXISTS economic_cortex_spending (
  spending_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  amount DOUBLE PRECISION NOT NULL,
  model VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_economic_cortex_spending_tenant ON economic_cortex_spending(tenant_id);
CREATE INDEX idx_economic_cortex_spending_model ON economic_cortex_spending(model);
CREATE INDEX idx_economic_cortex_spending_created ON economic_cortex_spending(created_at);

-- RLS for Economic Cortex
ALTER TABLE economic_cortex_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_cortex_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_cortex_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_cortex_negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_cortex_spending ENABLE ROW LEVEL SECURITY;

CREATE POLICY economic_cortex_configs_tenant_isolation ON economic_cortex_configs
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY economic_cortex_budgets_tenant_isolation ON economic_cortex_budgets
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY economic_cortex_alerts_tenant_isolation ON economic_cortex_alerts
  USING (budget_id IN (
    SELECT budget_id FROM economic_cortex_budgets 
    WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
  ));

CREATE POLICY economic_cortex_negotiations_tenant_isolation ON economic_cortex_negotiations
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY economic_cortex_spending_tenant_isolation ON economic_cortex_spending
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

COMMENT ON TABLE economic_cortex_configs IS 'Enhanced Economic Cortex configuration per tenant';
COMMENT ON TABLE economic_cortex_budgets IS 'Budget tracking with scopes and periods';
COMMENT ON TABLE economic_cortex_alerts IS 'Budget alert thresholds and actions';
COMMENT ON TABLE economic_cortex_negotiations IS 'Cost negotiation history and outcomes';
COMMENT ON TABLE economic_cortex_spending IS 'Spending history for analytics';
