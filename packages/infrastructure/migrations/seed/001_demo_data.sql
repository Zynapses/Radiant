-- RADIANT Demo Seed Data
-- Run this after all migrations to populate demo data for development

-- Demo Tenant
INSERT INTO tenants (id, name, slug, status, tier, settings, created_at)
VALUES (
  'demo-tenant-001',
  'Demo Organization',
  'demo',
  'active',
  3,
  '{"features": {"maxModels": 50, "maxUsers": 100}}',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Demo Administrators
INSERT INTO administrators (id, tenant_id, email, display_name, role, status, mfa_enabled, created_at)
VALUES 
  ('admin-001', 'demo-tenant-001', 'admin@demo.radiant.ai', 'System Administrator', 'super_admin', 'active', true, NOW()),
  ('admin-002', 'demo-tenant-001', 'operator@demo.radiant.ai', 'Operations Manager', 'operator', 'active', false, NOW()),
  ('admin-003', 'demo-tenant-001', 'auditor@demo.radiant.ai', 'Security Auditor', 'auditor', 'active', true, NOW())
ON CONFLICT (id) DO NOTHING;

-- Demo External Providers
INSERT INTO external_providers (id, provider_key, display_name, provider_type, base_url, status, is_enabled, created_at)
VALUES
  ('provider-openai', 'openai', 'OpenAI', 'external', 'https://api.openai.com/v1', 'active', true, NOW()),
  ('provider-anthropic', 'anthropic', 'Anthropic', 'external', 'https://api.anthropic.com', 'active', true, NOW()),
  ('provider-google', 'google', 'Google AI', 'external', 'https://generativelanguage.googleapis.com', 'active', true, NOW()),
  ('provider-mistral', 'mistral', 'Mistral AI', 'external', 'https://api.mistral.ai', 'active', true, NOW()),
  ('provider-cohere', 'cohere', 'Cohere', 'external', 'https://api.cohere.ai', 'active', false, NOW())
ON CONFLICT (id) DO NOTHING;

-- Demo AI Models
INSERT INTO ai_models (id, provider_id, model_key, display_name, category, status, input_cost_per_1k, output_cost_per_1k, max_tokens, context_window, is_enabled, created_at)
VALUES
  ('model-gpt4o', 'provider-openai', 'gpt-4o', 'GPT-4o', 'chat', 'active', 0.005, 0.015, 4096, 128000, true, NOW()),
  ('model-gpt4turbo', 'provider-openai', 'gpt-4-turbo', 'GPT-4 Turbo', 'chat', 'active', 0.01, 0.03, 4096, 128000, true, NOW()),
  ('model-gpt35', 'provider-openai', 'gpt-3.5-turbo', 'GPT-3.5 Turbo', 'chat', 'active', 0.0005, 0.0015, 4096, 16385, true, NOW()),
  ('model-claude3opus', 'provider-anthropic', 'claude-3-opus', 'Claude 3 Opus', 'chat', 'active', 0.015, 0.075, 4096, 200000, true, NOW()),
  ('model-claude3sonnet', 'provider-anthropic', 'claude-3-sonnet', 'Claude 3 Sonnet', 'chat', 'active', 0.003, 0.015, 4096, 200000, true, NOW()),
  ('model-claude3haiku', 'provider-anthropic', 'claude-3-haiku', 'Claude 3 Haiku', 'chat', 'active', 0.00025, 0.00125, 4096, 200000, true, NOW()),
  ('model-gemini15pro', 'provider-google', 'gemini-1.5-pro', 'Gemini 1.5 Pro', 'chat', 'active', 0.0035, 0.014, 8192, 1000000, true, NOW()),
  ('model-gemini15flash', 'provider-google', 'gemini-1.5-flash', 'Gemini 1.5 Flash', 'chat', 'active', 0.00035, 0.00105, 8192, 1000000, true, NOW()),
  ('model-mistral-large', 'provider-mistral', 'mistral-large', 'Mistral Large', 'chat', 'active', 0.004, 0.012, 4096, 32000, true, NOW()),
  ('model-mistral-medium', 'provider-mistral', 'mistral-medium', 'Mistral Medium', 'chat', 'cold', 0.0027, 0.0081, 4096, 32000, false, NOW())
ON CONFLICT (id) DO NOTHING;

-- Demo Subscription Tiers
INSERT INTO subscription_tiers (id, tier_name, display_name, price_monthly_cents, price_annual_cents, included_credits_per_user, max_seats, features, is_active, created_at)
VALUES
  ('tier-free', 'free', 'Free', 0, 0, 100, 1, '{"models": 3, "support": "community"}', true, NOW()),
  ('tier-starter', 'starter', 'Starter', 2900, 29000, 1000, 5, '{"models": 10, "support": "email"}', true, NOW()),
  ('tier-professional', 'professional', 'Professional', 9900, 99000, 5000, 25, '{"models": 50, "support": "priority"}', true, NOW()),
  ('tier-business', 'business', 'Business', 29900, 299000, 25000, 100, '{"models": -1, "support": "dedicated"}', true, NOW()),
  ('tier-enterprise', 'enterprise', 'Enterprise', NULL, NULL, 100000, -1, '{"models": -1, "support": "enterprise", "sla": true}', true, NOW())
ON CONFLICT (id) DO NOTHING;

-- Demo Subscription for tenant
INSERT INTO subscriptions (id, tenant_id, tier_id, status, billing_cycle, seats_purchased, seats_used, current_period_start, current_period_end, created_at)
VALUES (
  'sub-demo-001',
  'demo-tenant-001',
  'tier-professional',
  'active',
  'monthly',
  10,
  3,
  NOW(),
  NOW() + INTERVAL '30 days',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Demo Credit Balance
INSERT INTO credit_balances (id, tenant_id, balance, lifetime_purchased, lifetime_used, lifetime_bonus, updated_at)
VALUES (
  'credits-demo-001',
  'demo-tenant-001',
  4250.00,
  5000.00,
  750.00,
  100.00,
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Demo Credit Transactions
INSERT INTO credit_transactions (id, tenant_id, transaction_type, amount, balance_after, description, created_at)
VALUES
  (gen_random_uuid(), 'demo-tenant-001', 'purchase', 5000.00, 5000.00, 'Initial credit purchase', NOW() - INTERVAL '30 days'),
  (gen_random_uuid(), 'demo-tenant-001', 'bonus', 100.00, 5100.00, 'Volume purchase bonus', NOW() - INTERVAL '30 days'),
  (gen_random_uuid(), 'demo-tenant-001', 'usage', -250.00, 4850.00, 'API usage - Week 1', NOW() - INTERVAL '21 days'),
  (gen_random_uuid(), 'demo-tenant-001', 'usage', -300.00, 4550.00, 'API usage - Week 2', NOW() - INTERVAL '14 days'),
  (gen_random_uuid(), 'demo-tenant-001', 'usage', -200.00, 4350.00, 'API usage - Week 3', NOW() - INTERVAL '7 days'),
  (gen_random_uuid(), 'demo-tenant-001', 'refund', 100.00, 4450.00, 'Service credit', NOW() - INTERVAL '5 days'),
  (gen_random_uuid(), 'demo-tenant-001', 'usage', -200.00, 4250.00, 'API usage - Current week', NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

-- Demo Configuration Categories
INSERT INTO configuration_categories (id, name, description, icon, display_order, created_at)
VALUES
  ('cat-general', 'General', 'General platform settings', 'settings', 1, NOW()),
  ('cat-ai', 'AI & Models', 'AI model and routing configuration', 'brain', 2, NOW()),
  ('cat-security', 'Security', 'Security and authentication settings', 'shield', 3, NOW()),
  ('cat-billing', 'Billing', 'Billing and payment settings', 'credit-card', 4, NOW()),
  ('cat-notifications', 'Notifications', 'Notification preferences', 'bell', 5, NOW())
ON CONFLICT (id) DO NOTHING;

-- Demo System Configuration
INSERT INTO system_configuration (id, category_id, config_key, display_name, value, value_type, description, unit, is_sensitive, created_at)
VALUES
  (gen_random_uuid(), 'cat-general', 'platform.maintenance_mode', 'Maintenance Mode', 'false', 'boolean', 'Enable maintenance mode', NULL, false, NOW()),
  (gen_random_uuid(), 'cat-general', 'platform.max_file_size_mb', 'Max File Size', '100', 'integer', 'Maximum upload file size', 'MB', false, NOW()),
  (gen_random_uuid(), 'cat-ai', 'ai.default_model', 'Default Model', '"gpt-4o"', 'string', 'Default AI model for new users', NULL, false, NOW()),
  (gen_random_uuid(), 'cat-ai', 'ai.max_tokens_per_request', 'Max Tokens', '4096', 'integer', 'Maximum tokens per request', 'tokens', false, NOW()),
  (gen_random_uuid(), 'cat-ai', 'ai.temperature_default', 'Default Temperature', '0.7', 'decimal', 'Default temperature for completions', NULL, false, NOW()),
  (gen_random_uuid(), 'cat-security', 'security.session_timeout_minutes', 'Session Timeout', '60', 'integer', 'Session timeout duration', 'minutes', false, NOW()),
  (gen_random_uuid(), 'cat-security', 'security.mfa_required', 'Require MFA', 'false', 'boolean', 'Require MFA for all admins', NULL, false, NOW()),
  (gen_random_uuid(), 'cat-billing', 'billing.low_balance_threshold', 'Low Balance Alert', '100', 'integer', 'Credit balance alert threshold', 'credits', false, NOW()),
  (gen_random_uuid(), 'cat-billing', 'billing.auto_purchase_enabled', 'Auto Purchase', 'false', 'boolean', 'Enable automatic credit purchase', NULL, false, NOW())
ON CONFLICT DO NOTHING;

-- Demo Localization Languages
INSERT INTO localization_languages (code, name, native_name, is_rtl, is_active, created_at)
VALUES
  ('en', 'English', 'English', false, true, NOW()),
  ('es', 'Spanish', 'Español', false, true, NOW()),
  ('fr', 'French', 'Français', false, true, NOW()),
  ('de', 'German', 'Deutsch', false, true, NOW()),
  ('ja', 'Japanese', '日本語', false, true, NOW()),
  ('zh', 'Chinese', '中文', false, true, NOW()),
  ('ar', 'Arabic', 'العربية', true, true, NOW()),
  ('pt', 'Portuguese', 'Português', false, true, NOW())
ON CONFLICT (code) DO NOTHING;

-- Demo Localization Strings
INSERT INTO localization_registry (id, string_key, default_text, context, category, created_at)
VALUES
  (gen_random_uuid(), 'common.save', 'Save', 'Button text', 'ui.buttons', NOW()),
  (gen_random_uuid(), 'common.cancel', 'Cancel', 'Button text', 'ui.buttons', NOW()),
  (gen_random_uuid(), 'common.delete', 'Delete', 'Button text', 'ui.buttons', NOW()),
  (gen_random_uuid(), 'common.edit', 'Edit', 'Button text', 'ui.buttons', NOW()),
  (gen_random_uuid(), 'common.loading', 'Loading...', 'Loading indicator', 'ui.status', NOW()),
  (gen_random_uuid(), 'nav.dashboard', 'Dashboard', 'Navigation item', 'ui.navigation', NOW()),
  (gen_random_uuid(), 'nav.settings', 'Settings', 'Navigation item', 'ui.navigation', NOW()),
  (gen_random_uuid(), 'auth.login', 'Sign In', 'Login button', 'auth', NOW()),
  (gen_random_uuid(), 'auth.logout', 'Sign Out', 'Logout button', 'auth', NOW()),
  (gen_random_uuid(), 'error.generic', 'Something went wrong', 'Generic error message', 'errors', NOW())
ON CONFLICT DO NOTHING;

-- Demo Storage Usage
INSERT INTO storage_usage (id, tenant_id, storage_type, bytes_used, bytes_quota, price_per_gb_cents, included_gb, updated_at)
VALUES
  (gen_random_uuid(), 'demo-tenant-001', 's3', 5368709120, 107374182400, 2, 10, NOW()),
  (gen_random_uuid(), 'demo-tenant-001', 'database', 1073741824, 10737418240, 10, 1, NOW())
ON CONFLICT DO NOTHING;

-- Demo Orchestration Pattern Categories
INSERT INTO orchestration_pattern_categories (id, name, description, created_at)
VALUES
  ('cat-reasoning', 'Reasoning', 'Multi-step reasoning patterns', NOW()),
  ('cat-creative', 'Creative', 'Creative content generation', NOW()),
  ('cat-analysis', 'Analysis', 'Data and text analysis patterns', NOW()),
  ('cat-code', 'Code', 'Code generation and review', NOW())
ON CONFLICT (id) DO NOTHING;

-- Demo Orchestration Patterns
INSERT INTO orchestration_patterns (id, category_id, name, description, execution_type, model_requirements, usage_count, avg_satisfaction, created_at)
VALUES
  (gen_random_uuid(), 'cat-reasoning', 'Chain of Thought', 'Step-by-step reasoning for complex problems', 'sequential', '{"min_context": 32000}', 1250, 0.92, NOW()),
  (gen_random_uuid(), 'cat-reasoning', 'Tree of Thought', 'Branching exploration of solution space', 'parallel', '{"min_context": 64000}', 450, 0.88, NOW()),
  (gen_random_uuid(), 'cat-creative', 'Brainstorm + Refine', 'Generate ideas then refine best ones', 'sequential', '{}', 890, 0.85, NOW()),
  (gen_random_uuid(), 'cat-analysis', 'Multi-Perspective Analysis', 'Analyze from multiple viewpoints', 'parallel', '{}', 670, 0.90, NOW()),
  (gen_random_uuid(), 'cat-code', 'Code Review Pipeline', 'Multi-stage code review process', 'sequential', '{"category": "code"}', 2100, 0.94, NOW())
ON CONFLICT DO NOTHING;

-- Demo Workflow Categories
INSERT INTO production_workflow_categories (id, name, description, created_at)
VALUES
  ('wf-cat-content', 'Content', 'Content creation workflows', NOW()),
  ('wf-cat-support', 'Support', 'Customer support workflows', NOW()),
  ('wf-cat-dev', 'Development', 'Software development workflows', NOW())
ON CONFLICT (id) DO NOTHING;

-- Demo Production Workflows
INSERT INTO production_workflows (id, category_id, name, description, execution_count, avg_quality_score, created_at)
VALUES
  (gen_random_uuid(), 'wf-cat-content', 'Blog Post Generator', 'Generate SEO-optimized blog posts', 3500, 0.87, NOW()),
  (gen_random_uuid(), 'wf-cat-content', 'Social Media Suite', 'Create multi-platform social content', 5200, 0.82, NOW()),
  (gen_random_uuid(), 'wf-cat-support', 'Ticket Classifier', 'Auto-classify support tickets', 12000, 0.95, NOW()),
  (gen_random_uuid(), 'wf-cat-support', 'Response Drafter', 'Draft support responses', 8900, 0.88, NOW()),
  (gen_random_uuid(), 'wf-cat-dev', 'Code Explainer', 'Explain code functionality', 4100, 0.91, NOW()),
  (gen_random_uuid(), 'wf-cat-dev', 'Test Generator', 'Generate unit tests', 2800, 0.86, NOW())
ON CONFLICT DO NOTHING;

-- Demo Audit Logs
INSERT INTO audit_logs (id, tenant_id, actor_id, actor_email, action, resource_type, resource_id, details, ip_address, created_at)
VALUES
  (gen_random_uuid(), 'demo-tenant-001', 'admin-001', 'admin@demo.radiant.ai', 'login', 'session', 'sess-001', '{"method": "password"}', '192.168.1.100', NOW() - INTERVAL '2 hours'),
  (gen_random_uuid(), 'demo-tenant-001', 'admin-001', 'admin@demo.radiant.ai', 'update_config', 'config', 'ai.default_model', '{"old": "gpt-4-turbo", "new": "gpt-4o"}', '192.168.1.100', NOW() - INTERVAL '1 hour'),
  (gen_random_uuid(), 'demo-tenant-001', 'admin-002', 'operator@demo.radiant.ai', 'login', 'session', 'sess-002', '{"method": "sso"}', '192.168.1.101', NOW() - INTERVAL '30 minutes'),
  (gen_random_uuid(), 'demo-tenant-001', 'admin-002', 'operator@demo.radiant.ai', 'enable_model', 'model', 'model-gemini15pro', '{}', '192.168.1.101', NOW() - INTERVAL '20 minutes'),
  (gen_random_uuid(), 'demo-tenant-001', 'admin-001', 'admin@demo.radiant.ai', 'create_invitation', 'admin', 'invite-001', '{"email": "new@demo.radiant.ai", "role": "operator"}', '192.168.1.100', NOW() - INTERVAL '10 minutes')
ON CONFLICT DO NOTHING;

-- Demo Notifications
INSERT INTO notifications (id, tenant_id, type, title, message, severity, is_read, created_at)
VALUES
  (gen_random_uuid(), 'demo-tenant-001', 'system', 'Welcome to RADIANT', 'Your platform is ready to use.', 'success', true, NOW() - INTERVAL '7 days'),
  (gen_random_uuid(), 'demo-tenant-001', 'billing', 'Credits Running Low', 'Your credit balance is below 1000 credits.', 'warning', false, NOW() - INTERVAL '2 days'),
  (gen_random_uuid(), 'demo-tenant-001', 'model', 'New Model Available', 'GPT-4o is now available in your account.', 'info', false, NOW() - INTERVAL '1 day'),
  (gen_random_uuid(), 'demo-tenant-001', 'security', 'New Login Detected', 'A new login was detected from 192.168.1.101.', 'info', true, NOW() - INTERVAL '30 minutes')
ON CONFLICT DO NOTHING;

COMMIT;
