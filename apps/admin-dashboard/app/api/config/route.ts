import { NextResponse } from 'next/server';
import { withAuth, withAdminAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';

// Configuration categories with their settings
const CONFIG_CATEGORIES = [
  { id: 'timeouts', name: 'Operation Timeouts', description: 'Configure timeout durations for various operations', icon: 'Clock', displayOrder: 1 },
  { id: 'rate_limits', name: 'Rate Limiting', description: 'API rate limiting and throttling settings', icon: 'Gauge', displayOrder: 2 },
  { id: 'thermal', name: 'Thermal Management', description: 'Model warm-up and thermal state thresholds', icon: 'Thermometer', displayOrder: 3 },
  { id: 'ai', name: 'AI Settings', description: 'AI model defaults and inference parameters', icon: 'Brain', displayOrder: 4 },
  { id: 'security', name: 'Security', description: 'Security policies and authentication settings', icon: 'Shield', displayOrder: 5 },
  { id: 'billing', name: 'Billing & Limits', description: 'Credit limits, pricing multipliers, and quotas', icon: 'CreditCard', displayOrder: 6 },
  { id: 'workflows', name: 'Workflow Engine', description: 'Neural workflow thresholds and evidence weights', icon: 'GitBranch', displayOrder: 7 },
  { id: 'notifications', name: 'Notifications', description: 'Alert thresholds and notification settings', icon: 'Bell', displayOrder: 8 },
  { id: 'ui', name: 'UI Preferences', description: 'Default UI settings and display options', icon: 'Layout', displayOrder: 9 },
];

// Default configuration values (would come from database in production)
const DEFAULT_CONFIG: Record<string, ConfigItem[]> = {
  timeouts: [
    { key: 'cdk_bootstrap', value: 600, defaultValue: 600, type: 'number', name: 'CDK Bootstrap Timeout', description: 'Time allowed for CDK bootstrap operation', unit: 'seconds', min: 60, max: 1800 },
    { key: 'cdk_deploy', value: 1800, defaultValue: 1800, type: 'number', name: 'CDK Deploy Timeout', description: 'Time allowed for CDK stack deployment', unit: 'seconds', min: 300, max: 7200 },
    { key: 'cdk_destroy', value: 900, defaultValue: 900, type: 'number', name: 'CDK Destroy Timeout', description: 'Time allowed for CDK stack destruction', unit: 'seconds', min: 120, max: 3600 },
    { key: 'migration_step', value: 300, defaultValue: 300, type: 'number', name: 'Migration Step Timeout', description: 'Time allowed for single database migration', unit: 'seconds', min: 30, max: 1800 },
    { key: 'health_check', value: 30, defaultValue: 30, type: 'number', name: 'Health Check Timeout', description: 'Time for single health check request', unit: 'seconds', min: 5, max: 120 },
    { key: 'ai_inference', value: 120, defaultValue: 120, type: 'number', name: 'AI Inference Timeout', description: 'Time for AI model inference requests', unit: 'seconds', min: 10, max: 600 },
    { key: 'api_request', value: 30, defaultValue: 30, type: 'number', name: 'API Request Timeout', description: 'Default timeout for API requests', unit: 'seconds', min: 5, max: 120 },
    { key: 'websocket_idle', value: 300, defaultValue: 300, type: 'number', name: 'WebSocket Idle Timeout', description: 'Time before idle WebSocket disconnection', unit: 'seconds', min: 60, max: 900 },
  ],
  rate_limits: [
    { key: 'api_window_ms', value: 60000, defaultValue: 60000, type: 'number', name: 'Rate Limit Window', description: 'Time window for rate limiting', unit: 'ms', min: 1000, max: 300000 },
    { key: 'free_tier_requests', value: 100, defaultValue: 100, type: 'number', name: 'Free Tier Requests', description: 'Requests per window for free tier', unit: 'req', min: 10, max: 500, allowOverride: true },
    { key: 'starter_tier_requests', value: 500, defaultValue: 500, type: 'number', name: 'Starter Tier Requests', description: 'Requests per window for starter tier', unit: 'req', min: 100, max: 2000, allowOverride: true },
    { key: 'professional_tier_requests', value: 2000, defaultValue: 2000, type: 'number', name: 'Professional Tier Requests', description: 'Requests per window for professional tier', unit: 'req', min: 500, max: 10000, allowOverride: true },
    { key: 'enterprise_tier_requests', value: 20000, defaultValue: 20000, type: 'number', name: 'Enterprise Tier Requests', description: 'Requests per window for enterprise tier', unit: 'req', min: 5000, max: 100000, allowOverride: true },
    { key: 'burst_multiplier', value: 1.5, defaultValue: 1.5, type: 'number', name: 'Burst Multiplier', description: 'Temporary burst allowance multiplier', unit: 'x', min: 1, max: 5 },
  ],
  thermal: [
    { key: 'warm_duration_minutes', value: 30, defaultValue: 30, type: 'number', name: 'Warm Duration', description: 'Default model warm-up duration', unit: 'min', min: 5, max: 120 },
    { key: 'hot_threshold_rpm', value: 10, defaultValue: 10, type: 'number', name: 'Hot Threshold', description: 'Requests/minute to trigger hot state', unit: 'rpm', min: 1, max: 100 },
    { key: 'cold_threshold_idle', value: 15, defaultValue: 15, type: 'number', name: 'Cold Threshold', description: 'Idle minutes before transitioning to cold', unit: 'min', min: 5, max: 60 },
    { key: 'auto_scale_min', value: 0, defaultValue: 0, type: 'number', name: 'Auto Scale Min', description: 'Minimum instances for auto-scaling', unit: '', min: 0, max: 10 },
    { key: 'auto_scale_max', value: 5, defaultValue: 5, type: 'number', name: 'Auto Scale Max', description: 'Maximum instances for auto-scaling', unit: '', min: 1, max: 50 },
  ],
  ai: [
    { key: 'default_temperature', value: 0.7, defaultValue: 0.7, type: 'number', name: 'Default Temperature', description: 'Default temperature for AI models', unit: '', min: 0, max: 2, step: 0.1, allowOverride: true },
    { key: 'default_max_tokens', value: 4096, defaultValue: 4096, type: 'number', name: 'Default Max Tokens', description: 'Default max tokens for responses', unit: 'tokens', min: 256, max: 32768, allowOverride: true },
    { key: 'default_top_p', value: 0.9, defaultValue: 0.9, type: 'number', name: 'Default Top P', description: 'Default nucleus sampling parameter', unit: '', min: 0, max: 1, step: 0.05, allowOverride: true },
    { key: 'streaming_chunk_size', value: 100, defaultValue: 100, type: 'number', name: 'Streaming Chunk Size', description: 'Characters per streaming chunk', unit: 'chars', min: 10, max: 1000 },
    { key: 'retry_count', value: 3, defaultValue: 3, type: 'number', name: 'Retry Count', description: 'Number of retries for failed AI requests', unit: '', min: 0, max: 10 },
    { key: 'context_window_default', value: 128000, defaultValue: 128000, type: 'number', name: 'Context Window', description: 'Default context window size', unit: 'tokens', min: 4096, max: 200000 },
  ],
  security: [
    { key: 'token_refresh_threshold', value: 300, defaultValue: 300, type: 'number', name: 'Token Refresh Threshold', description: 'Seconds before expiry to refresh token', unit: 'sec', min: 60, max: 900 },
    { key: 'max_login_attempts', value: 5, defaultValue: 5, type: 'number', name: 'Max Login Attempts', description: 'Failed attempts before lockout', unit: '', min: 3, max: 20 },
    { key: 'lockout_duration', value: 900, defaultValue: 900, type: 'number', name: 'Lockout Duration', description: 'Account lockout duration', unit: 'sec', min: 60, max: 3600 },
    { key: 'password_min_length', value: 12, defaultValue: 12, type: 'number', name: 'Password Min Length', description: 'Minimum password length', unit: 'chars', min: 8, max: 32 },
    { key: 'mfa_required', value: false, defaultValue: false, type: 'boolean', name: 'MFA Required', description: 'Require MFA for all users' },
    { key: 'session_concurrent_max', value: 5, defaultValue: 5, type: 'number', name: 'Max Concurrent Sessions', description: 'Maximum concurrent sessions per user', unit: '', min: 1, max: 20 },
  ],
  billing: [
    { key: 'free_tier_credits', value: 10, defaultValue: 10, type: 'number', name: 'Free Tier Credits', description: 'Monthly credits for free tier', unit: 'credits', min: 0, max: 100 },
    { key: 'credit_low_threshold', value: 0.2, defaultValue: 0.2, type: 'number', name: 'Low Credit Alert', description: 'Credit percentage to trigger alert', unit: '%', min: 0.05, max: 0.5, step: 0.05, allowOverride: true },
    { key: 'cost_alert_threshold', value: 100, defaultValue: 100, type: 'number', name: 'Cost Alert Threshold', description: 'Daily cost to trigger alert', unit: 'USD', min: 10, max: 10000, allowOverride: true },
    { key: 'storage_limit_gb', value: 10, defaultValue: 10, type: 'number', name: 'Storage Limit', description: 'Default storage limit per tenant', unit: 'GB', min: 1, max: 1000, allowOverride: true },
    { key: 'max_models_per_tenant', value: 20, defaultValue: 20, type: 'number', name: 'Max Models', description: 'Maximum models per tenant', unit: '', min: 5, max: 100, allowOverride: true },
  ],
  workflows: [
    { key: 'evidence_threshold_count', value: 10, defaultValue: 10, type: 'number', name: 'Evidence Threshold Count', description: 'Occurrences needed for proposal', unit: '', min: 3, max: 50 },
    { key: 'evidence_threshold_users', value: 3, defaultValue: 3, type: 'number', name: 'Unique Users Threshold', description: 'Unique users needed for proposal', unit: '', min: 1, max: 20 },
    { key: 'evidence_total_score', value: 2.0, defaultValue: 2.0, type: 'number', name: 'Total Evidence Score', description: 'Minimum score to trigger proposal', unit: '', min: 0.5, max: 10, step: 0.1 },
    { key: 'neural_confidence_threshold', value: 0.7, defaultValue: 0.7, type: 'number', name: 'Neural Confidence', description: 'Minimum confidence for auto-approval', unit: '', min: 0.1, max: 1, step: 0.05 },
    { key: 'weight_workflow_failure', value: 0.40, defaultValue: 0.40, type: 'number', name: 'Workflow Failure Weight', description: 'Evidence weight for workflow failures', unit: '', min: 0, max: 1, step: 0.05 },
    { key: 'weight_negative_feedback', value: 0.35, defaultValue: 0.35, type: 'number', name: 'Negative Feedback Weight', description: 'Evidence weight for negative feedback', unit: '', min: 0, max: 1, step: 0.05 },
  ],
  notifications: [
    { key: 'email_enabled', value: true, defaultValue: true, type: 'boolean', name: 'Email Notifications', description: 'Enable email notifications', allowOverride: true },
    { key: 'slack_enabled', value: false, defaultValue: false, type: 'boolean', name: 'Slack Notifications', description: 'Enable Slack notifications', allowOverride: true },
    { key: 'digest_frequency', value: 'daily', defaultValue: 'daily', type: 'string', name: 'Digest Frequency', description: 'How often to send digest emails', options: ['hourly', 'daily', 'weekly'], allowOverride: true },
  ],
  ui: [
    { key: 'default_theme', value: 'system', defaultValue: 'system', type: 'string', name: 'Default Theme', description: 'Default UI theme', options: ['light', 'dark', 'system'], allowOverride: true },
    { key: 'items_per_page', value: 25, defaultValue: 25, type: 'number', name: 'Items Per Page', description: 'Default pagination size', unit: '', min: 10, max: 100, allowOverride: true },
    { key: 'compact_mode', value: false, defaultValue: false, type: 'boolean', name: 'Compact Mode', description: 'Enable compact UI mode', allowOverride: true },
  ],
};

interface ConfigItem {
  key: string;
  value: number | string | boolean;
  defaultValue: number | string | boolean;
  type: 'number' | 'string' | 'boolean';
  name: string;
  description: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  allowOverride?: boolean;
  isSensitive?: boolean;
}

// GET /api/config - Get all configuration
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    if (category) {
      const categoryData = CONFIG_CATEGORIES.find(c => c.id === category);
      const items = DEFAULT_CONFIG[category] || [];
      return NextResponse.json({
        category: categoryData,
        items,
      });
    }

    return NextResponse.json({
      categories: CONFIG_CATEGORIES,
      config: DEFAULT_CONFIG,
    });
  } catch (error) {
    return apiError('FETCH_FAILED', 'Failed to fetch configuration', 500);
  }
});

// PUT /api/config - Update configuration (admin only)
export const PUT = withAdminAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { category, key, value } = body;

    if (!category || !key) {
      return apiError('VALIDATION_ERROR', 'Category and key are required', 400);
    }

    // Validate the value against constraints
    const categoryConfig = DEFAULT_CONFIG[category];
    if (!categoryConfig) {
      return apiError('NOT_FOUND', 'Category not found', 404);
    }

    const configItem = categoryConfig.find(item => item.key === key);
    if (!configItem) {
      return apiError('NOT_FOUND', 'Configuration key not found', 404);
    }

    // Type validation
    if (configItem.type === 'number') {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        return apiError('VALIDATION_ERROR', 'Value must be a number', 400);
      }
      if (configItem.min !== undefined && numValue < configItem.min) {
        return apiError('VALIDATION_ERROR', `Value must be at least ${configItem.min}`, 400);
      }
      if (configItem.max !== undefined && numValue > configItem.max) {
        return apiError('VALIDATION_ERROR', `Value must be at most ${configItem.max}`, 400);
      }
    }

    // In production, would update database here
    return NextResponse.json({
      success: true,
      updated: {
        category,
        key,
        value,
        previousValue: configItem.value,
        updatedBy: request.user.email,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return apiError('UPDATE_FAILED', 'Failed to update configuration', 500);
  }
});

// POST /api/config/reset - Reset to defaults (admin only)
export const POST = withAdminAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { category, key } = body;

    if (!category) {
      return apiError('VALIDATION_ERROR', 'Category is required', 400);
    }

    const categoryConfig = DEFAULT_CONFIG[category];
    if (!categoryConfig) {
      return apiError('NOT_FOUND', 'Category not found', 404);
    }

    if (key) {
      const configItem = categoryConfig.find(item => item.key === key);
      if (!configItem) {
        return apiError('NOT_FOUND', 'Configuration key not found', 404);
      }

      return NextResponse.json({
        success: true,
        reset: {
          category,
          key,
          value: configItem.defaultValue,
          resetBy: request.user.email,
          resetAt: new Date().toISOString(),
        },
      });
    }

    // Reset entire category
    return NextResponse.json({
      success: true,
      reset: {
        category,
        itemsReset: categoryConfig.length,
        resetBy: request.user.email,
        resetAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return apiError('RESET_FAILED', 'Failed to reset configuration', 500);
  }
});
