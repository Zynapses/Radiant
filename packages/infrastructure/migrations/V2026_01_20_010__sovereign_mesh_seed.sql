-- ============================================================================
-- RADIANT v5.0 - SOVEREIGN MESH: SEED DATA
-- Migration: V2026_01_20_010
-- 
-- Built-in agents, default configurations, and sample apps.
-- ============================================================================

-- ============================================================================
-- BUILT-IN AGENTS
-- ============================================================================

INSERT INTO agents (
  name, display_name, description, category, capabilities,
  execution_mode, max_iterations, default_timeout_minutes,
  default_budget_usd, max_budget_usd, allowed_models, allowed_tools,
  safety_profile, requires_hitl, implementation_type, implementation_ref,
  ai_helper_config, scope
) VALUES 
-- Research Agent
(
  'research_agent',
  'Research Agent',
  'Conducts comprehensive web research, synthesizing information from multiple sources into coherent summaries.',
  'research',
  ARRAY['web_search', 'web_fetch', 'file_write', 'summarize'],
  'async',
  50,
  30,
  2.00,
  10.00,
  ARRAY['claude-sonnet-4', 'gpt-4o', 'gemini-1.5-pro'],
  ARRAY['web_search', 'web_fetch', 'summarize', 'extract_entities'],
  'standard',
  false,
  'builtin',
  'ResearchAgentHandler',
  '{
    "enabled": true,
    "disambiguation": {"enabled": true, "model": "claude-haiku-35", "confidenceThreshold": 0.7},
    "parameterInference": {"enabled": true, "model": "claude-haiku-35"},
    "errorRecovery": {"enabled": true, "model": "claude-haiku-35", "maxAttempts": 3},
    "validation": {"enabled": false},
    "explanation": {"enabled": true, "model": "claude-haiku-35"}
  }'::jsonb,
  'system'
),

-- Coding Agent
(
  'coding_agent',
  'Coding Agent',
  'Writes, debugs, and refactors code in a sandboxed environment with test execution.',
  'coding',
  ARRAY['code_execution', 'file_read', 'file_write', 'web_search'],
  'async',
  30,
  45,
  3.00,
  15.00,
  ARRAY['claude-sonnet-4', 'gpt-4o', 'deepseek-coder'],
  ARRAY['code_execute', 'file_read', 'file_write', 'lint', 'test_run'],
  'strict',
  false,
  'builtin',
  'CodingAgentHandler',
  '{
    "enabled": true,
    "disambiguation": {"enabled": true, "model": "claude-haiku-35", "confidenceThreshold": 0.8},
    "parameterInference": {"enabled": true, "model": "claude-haiku-35"},
    "errorRecovery": {"enabled": true, "model": "claude-sonnet-4", "maxAttempts": 5},
    "validation": {"enabled": true, "model": "claude-sonnet-4"},
    "explanation": {"enabled": true, "model": "claude-haiku-35"}
  }'::jsonb,
  'system'
),

-- Data Analysis Agent
(
  'data_agent',
  'Data Analysis Agent',
  'Analyzes datasets, generates visualizations, and produces actionable insights.',
  'data',
  ARRAY['file_read', 'file_write', 'code_execution', 'database_query'],
  'async',
  40,
  60,
  2.50,
  20.00,
  ARRAY['claude-sonnet-4', 'gpt-4o'],
  ARRAY['pandas_execute', 'plot_generate', 'stats_compute', 'csv_parse'],
  'standard',
  false,
  'builtin',
  'DataAgentHandler',
  '{
    "enabled": true,
    "disambiguation": {"enabled": true, "model": "claude-haiku-35"},
    "parameterInference": {"enabled": true, "model": "claude-haiku-35"},
    "errorRecovery": {"enabled": true, "model": "claude-haiku-35"},
    "validation": {"enabled": true, "model": "claude-sonnet-4"},
    "explanation": {"enabled": true, "model": "claude-haiku-35"}
  }'::jsonb,
  'system'
),

-- Lead Generation Agent
(
  'leadgen_agent',
  'Lead Generation Agent',
  'Researches companies and contacts, builds prospect lists with enriched data.',
  'outreach',
  ARRAY['web_search', 'web_fetch', 'api_call'],
  'async',
  100,
  120,
  5.00,
  50.00,
  ARRAY['claude-haiku-35', 'gpt-4o-mini'],
  ARRAY['web_search', 'linkedin_search', 'company_lookup', 'email_finder'],
  'standard',
  true,
  'builtin',
  'LeadGenAgentHandler',
  '{
    "enabled": true,
    "disambiguation": {"enabled": true, "model": "claude-haiku-35"},
    "parameterInference": {"enabled": true, "model": "claude-haiku-35"},
    "errorRecovery": {"enabled": true, "model": "claude-haiku-35"},
    "validation": {"enabled": true, "model": "claude-haiku-35"},
    "explanation": {"enabled": true, "model": "claude-haiku-35"}
  }'::jsonb,
  'system'
),

-- Editor Agent
(
  'editor_agent',
  'Editor Agent',
  'Reviews and improves written content for clarity, style, and grammar.',
  'creative',
  ARRAY['file_read', 'file_write', 'web_search'],
  'async',
  20,
  30,
  1.50,
  5.00,
  ARRAY['claude-sonnet-4', 'gpt-4o'],
  ARRAY['grammar_check', 'style_analyze', 'fact_check', 'readability_score'],
  'standard',
  false,
  'builtin',
  'EditorAgentHandler',
  '{
    "enabled": true,
    "disambiguation": {"enabled": true, "model": "claude-haiku-35"},
    "parameterInference": {"enabled": false},
    "errorRecovery": {"enabled": false},
    "validation": {"enabled": false},
    "explanation": {"enabled": true, "model": "claude-haiku-35"}
  }'::jsonb,
  'system'
),

-- Automation Agent
(
  'automation_agent',
  'Automation Agent',
  'Creates and executes multi-step workflows connecting various apps and services.',
  'operations',
  ARRAY['api_call', 'webhook', 'schedule', 'file_transform'],
  'async',
  50,
  60,
  2.00,
  15.00,
  ARRAY['claude-sonnet-4', 'gpt-4o'],
  ARRAY['http_request', 'json_transform', 'email_send', 'slack_post'],
  'standard',
  false,
  'builtin',
  'AutomationAgentHandler',
  '{
    "enabled": true,
    "disambiguation": {"enabled": true, "model": "claude-haiku-35"},
    "parameterInference": {"enabled": true, "model": "claude-haiku-35"},
    "errorRecovery": {"enabled": true, "model": "claude-haiku-35", "maxAttempts": 3},
    "validation": {"enabled": true, "model": "claude-haiku-35"},
    "explanation": {"enabled": true, "model": "claude-haiku-35"}
  }'::jsonb,
  'system'
)
ON CONFLICT (name, scope, tenant_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  capabilities = EXCLUDED.capabilities,
  allowed_models = EXCLUDED.allowed_models,
  allowed_tools = EXCLUDED.allowed_tools,
  ai_helper_config = EXCLUDED.ai_helper_config,
  updated_at = NOW();

-- ============================================================================
-- SAMPLE APPS (Native integrations)
-- ============================================================================

INSERT INTO apps (
  name, display_name, description, source, auth_type, 
  triggers, actions, ai_enhancements, health_status, is_active
) VALUES 
(
  'slack',
  'Slack',
  'Team communication and collaboration platform',
  'native',
  'oauth2',
  '[
    {"id": "new_message", "name": "New Message", "description": "Triggers when a new message is posted"}
  ]'::jsonb,
  '[
    {"id": "send_message", "name": "Send Message", "description": "Send a message to a channel"},
    {"id": "create_channel", "name": "Create Channel", "description": "Create a new channel"}
  ]'::jsonb,
  '{"enabled": true, "parameterInference": {"enabled": true, "model": "claude-haiku-35"}}'::jsonb,
  'healthy',
  true
),
(
  'gmail',
  'Gmail',
  'Email service by Google',
  'native',
  'oauth2',
  '[
    {"id": "new_email", "name": "New Email", "description": "Triggers when a new email is received"}
  ]'::jsonb,
  '[
    {"id": "send_email", "name": "Send Email", "description": "Send an email"},
    {"id": "create_draft", "name": "Create Draft", "description": "Create an email draft"}
  ]'::jsonb,
  '{"enabled": true, "parameterInference": {"enabled": true, "model": "claude-haiku-35"}}'::jsonb,
  'healthy',
  true
),
(
  'github',
  'GitHub',
  'Code hosting and version control',
  'native',
  'oauth2',
  '[
    {"id": "new_issue", "name": "New Issue", "description": "Triggers when a new issue is created"},
    {"id": "new_pr", "name": "New Pull Request", "description": "Triggers when a new PR is opened"}
  ]'::jsonb,
  '[
    {"id": "create_issue", "name": "Create Issue", "description": "Create a new issue"},
    {"id": "create_pr", "name": "Create Pull Request", "description": "Create a new pull request"}
  ]'::jsonb,
  '{"enabled": true, "parameterInference": {"enabled": true, "model": "claude-haiku-35"}}'::jsonb,
  'healthy',
  true
),
(
  'notion',
  'Notion',
  'All-in-one workspace for notes, docs, and databases',
  'native',
  'oauth2',
  '[
    {"id": "page_updated", "name": "Page Updated", "description": "Triggers when a page is updated"}
  ]'::jsonb,
  '[
    {"id": "create_page", "name": "Create Page", "description": "Create a new page"},
    {"id": "update_page", "name": "Update Page", "description": "Update an existing page"}
  ]'::jsonb,
  '{"enabled": true, "parameterInference": {"enabled": true, "model": "claude-haiku-35"}}'::jsonb,
  'healthy',
  true
),
(
  'google_sheets',
  'Google Sheets',
  'Spreadsheet application by Google',
  'native',
  'oauth2',
  '[
    {"id": "row_added", "name": "Row Added", "description": "Triggers when a new row is added"}
  ]'::jsonb,
  '[
    {"id": "add_row", "name": "Add Row", "description": "Add a new row to a sheet"},
    {"id": "update_row", "name": "Update Row", "description": "Update an existing row"}
  ]'::jsonb,
  '{"enabled": true, "parameterInference": {"enabled": true, "model": "claude-haiku-35"}}'::jsonb,
  'healthy',
  true
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  triggers = EXCLUDED.triggers,
  actions = EXCLUDED.actions,
  ai_enhancements = EXCLUDED.ai_enhancements,
  updated_at = NOW();

-- ============================================================================
-- DEFAULT HITL QUEUE CONFIGURATIONS
-- ============================================================================

-- Note: These are templates - actual queues are created per-tenant
-- This creates a function to initialize default queues for new tenants

CREATE OR REPLACE FUNCTION create_default_hitl_queues(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
  -- Agent Plan Approval Queue
  INSERT INTO hitl_queue_configs (tenant_id, name, description, trigger_type, trigger_config, default_timeout_minutes)
  VALUES (
    p_tenant_id,
    'Agent Plan Approval',
    'Review and approve agent execution plans before they run',
    'agent_plan',
    '{"min_budget_usd": 5.0}'::jsonb,
    60
  )
  ON CONFLICT (tenant_id, name) DO NOTHING;

  -- High Cost Approval Queue
  INSERT INTO hitl_queue_configs (tenant_id, name, description, trigger_type, trigger_config, default_timeout_minutes)
  VALUES (
    p_tenant_id,
    'High Cost Approval',
    'Review operations that exceed cost thresholds',
    'cost_threshold',
    '{"threshold_usd": 10.0}'::jsonb,
    30
  )
  ON CONFLICT (tenant_id, name) DO NOTHING;

  -- Safety Review Queue
  INSERT INTO hitl_queue_configs (tenant_id, name, description, trigger_type, trigger_config, default_timeout_minutes)
  VALUES (
    p_tenant_id,
    'Safety Review',
    'Review operations flagged by safety evaluation',
    'safety_flag',
    '{"min_severity": "medium"}'::jsonb,
    15
  )
  ON CONFLICT (tenant_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION create_default_hitl_queues IS 'Creates default HITL queues for a new tenant';
