// RADIANT v4.18.0 - Economic Governor API Handler
// Model Arbitrage & Cost Optimization Dashboard
// Novel UI: "Fuel Gauge" - visual meter with budget dial, savings tracker, tier selector

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { economicGovernorService, GovernorMode, ModelTier } from '../shared/services/economic-governor.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

// ============================================================================
// Helpers
// ============================================================================

const getTenantId = (event: APIGatewayProxyEvent): string | null => {
  return (event.requestContext.authorizer as Record<string, string> | null)?.tenantId || null;
};

const jsonResponse = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(body),
});

// ============================================================================
// Handlers
// ============================================================================

/**
 * GET /api/thinktank/governor
 * Get governor dashboard with fuel gauge visualization
 * Novel UI: "Fuel Gauge" - circular dial showing budget remaining, color-coded
 */
export async function getDashboard(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const config = await economicGovernorService.getConfig(tenantId);
    const metrics = await economicGovernorService.getCostMetrics(tenantId, 'day');
    const budget = await economicGovernorService.checkBudget(tenantId, 0);

    // Fuel gauge visualization data
    const fuelGauge = {
      level: budget.fuelLevel,
      color: getFuelColor(budget.fuelLevel),
      status: getFuelStatus(budget.fuelLevel),
      remaining: `$${budget.remaining.toFixed(2)}`,
      total: `$${config.budgetLimit.toFixed(2)}`,
      resetIn: getTimeUntilReset(config.budgetResetAt),
    };

    // Mode indicator
    const modeIndicator = {
      mode: config.mode,
      icon: getModeIcon(config.mode),
      description: getModeDescription(config.mode),
      color: getModeColor(config.mode),
    };

    // Savings sparkline
    const savingsSparkline = {
      total: `$${metrics.savings.totalSavings.toFixed(2)}`,
      percent: `${metrics.savings.savingsPercent.toFixed(1)}%`,
      breakdown: {
        selfHosted: `$${metrics.savings.selfHostedSavings.toFixed(2)}`,
        arbitrage: `$${metrics.savings.arbitrageSavings.toFixed(2)}`,
        cache: `$${metrics.savings.cacheHitSavings.toFixed(2)}`,
      },
    };

    return jsonResponse(200, {
      success: true,
      data: {
        config,
        metrics,
        fuelGauge,
        modeIndicator,
        savingsSparkline,
        alertTriggered: budget.alertTriggered,
      },
    });
  } catch (error) {
    logger.error('Failed to get governor dashboard', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/governor/config
 * Get configuration
 */
export async function getConfig(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const config = await economicGovernorService.getConfig(tenantId);
    return jsonResponse(200, { success: true, data: config });
  } catch (error) {
    logger.error('Failed to get config', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * PUT /api/thinktank/governor/config
 * Update configuration
 */
export async function updateConfig(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const body = JSON.parse(event.body || '{}');
    const config = await economicGovernorService.updateConfig(tenantId, body);

    return jsonResponse(200, { success: true, data: config });
  } catch (error) {
    logger.error('Failed to update config', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * PUT /api/thinktank/governor/mode
 * Quick mode switch
 * Novel UI: "Mode Dial" - rotary selector with 5 positions
 */
export async function setMode(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const body = JSON.parse(event.body || '{}');
    const { mode } = body;

    if (!mode) return jsonResponse(400, { error: 'Mode required' });

    const config = await economicGovernorService.updateConfig(tenantId, { mode });

    return jsonResponse(200, {
      success: true,
      data: {
        mode: config.mode,
        icon: getModeIcon(config.mode),
        description: getModeDescription(config.mode),
        message: `Switched to ${getModeLabel(config.mode)} mode`,
      },
    });
  } catch (error) {
    logger.error('Failed to set mode', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/governor/recommend
 * Get model recommendation for a task
 * Novel UI: "Model Oracle" - card showing recommended model with alternatives
 */
export async function recommendModel(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const body = JSON.parse(event.body || '{}');
    const { taskType, complexity } = body;

    if (!taskType) return jsonResponse(400, { error: 'taskType required' });

    const recommendation = await economicGovernorService.recommendModel(
      tenantId,
      taskType,
      complexity || 5
    );

    return jsonResponse(200, {
      success: true,
      data: {
        ...recommendation,
        tierIcon: getTierIcon(recommendation.tier as any),
        tierColor: getTierColor(recommendation.tier as any),
        costLabel: `~$${recommendation.estimatedCost.toFixed(4)}`,
        qualityLabel: `${(recommendation.qualityScore * 100).toFixed(0)}%`,
        latencyLabel: `${recommendation.estimatedLatency}ms`,
      },
    });
  } catch (error) {
    logger.error('Failed to recommend model', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/governor/metrics
 * Get cost metrics
 * Novel UI: "Spend Dashboard" - charts showing usage by model/tier
 */
export async function getMetrics(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const params = event.queryStringParameters || {};
    const period = (params.period || 'day') as 'day' | 'week' | 'month';

    const metrics = await economicGovernorService.getCostMetrics(tenantId, period);

    // Add visualization helpers
    const tierChart = Object.entries(metrics.costByTier || {}).map(([tier, cost]) => ({
      name: tier,
      value: cost as number,
      percent: metrics.totalCost > 0 ? ((cost as number) / metrics.totalCost * 100) : 0,
      color: getTierColor(tier as any),
    }));

    const modelChart = Object.entries(metrics.costByModel || {})
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 10)
      .map(([model, cost]) => ({
        model,
        cost: cost as number,
        requests: (metrics.tokensByModel[model] || 0),
        avgLatency: 0,
      }));

    return jsonResponse(200, {
      success: true,
      data: {
        ...metrics,
        charts: {
          tierDistribution: tierChart,
          topModels: modelChart,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get metrics', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/governor/budget
 * Get budget status
 * Novel UI: "Budget Dial" - progress ring with remaining amount
 */
export async function getBudget(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const params = event.queryStringParameters || {};
    const estimatedCost = parseFloat(params.estimate || '0');

    const budget = await economicGovernorService.checkBudget(tenantId, estimatedCost);
    const config = await economicGovernorService.getConfig(tenantId);

    return jsonResponse(200, {
      success: true,
      data: {
        ...budget,
        limit: config.budgetLimit,
        used: config.budgetUsed,
        usedPercent: (config.budgetUsed / config.budgetLimit) * 100,
        resetAt: config.budgetResetAt,
        fuelColor: getFuelColor(budget.fuelLevel),
        fuelStatus: getFuelStatus(budget.fuelLevel),
      },
    });
  } catch (error) {
    logger.error('Failed to get budget', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * PUT /api/thinktank/governor/budget
 * Update budget limit
 */
export async function updateBudget(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const body = JSON.parse(event.body || '{}');
    const { budgetLimit, costAlertThreshold } = body;

    const updates: Record<string, unknown> = {};
    if (budgetLimit !== undefined) updates.budgetLimit = budgetLimit;
    if (costAlertThreshold !== undefined) updates.costAlertThreshold = costAlertThreshold;

    const config = await economicGovernorService.updateConfig(tenantId, updates);

    return jsonResponse(200, { success: true, data: config });
  } catch (error) {
    logger.error('Failed to update budget', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/governor/tiers
 * Get model tiers
 * Novel UI: "Tier Ladder" - visual stack of tiers with pricing
 */
export async function getTiers(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const config = await economicGovernorService.getConfig(tenantId);

    const tiers = config.modelTiers.map(tier => ({
      ...tier,
      label: getTierLabel(tier.name as any),
      icon: getTierIcon(tier.name as any),
      color: getTierColor(tier.name as any),
      costLabel: `$${(tier.costPerToken * 1000).toFixed(4)}/1K tokens`,
      qualityLabel: `${(tier.qualityScore * 100).toFixed(0)}% quality`,
      latencyLabel: `~${tier.avgLatencyMs}ms`,
    }));

    return jsonResponse(200, { success: true, data: tiers });
  } catch (error) {
    logger.error('Failed to get tiers', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * PUT /api/thinktank/governor/tiers/:tier
 * Update tier configuration
 */
export async function updateTier(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const tierName = event.pathParameters?.tier as string;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!tierName) return jsonResponse(400, { error: 'Tier required' });

    const body = JSON.parse(event.body || '{}');
    const config = await economicGovernorService.getConfig(tenantId);

    const tiers = config.modelTiers.map(t =>
      t.name === tierName ? { ...t, ...body } : t
    );

    await economicGovernorService.updateConfig(tenantId, { modelTiers: tiers });

    return jsonResponse(200, { success: true });
  } catch (error) {
    logger.error('Failed to update tier', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/governor/rules
 * Get arbitrage rules
 */
export async function getRules(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const config = await economicGovernorService.getConfig(tenantId);

    return jsonResponse(200, {
      success: true,
      data: config.arbitrageRules.map(rule => ({
        ...rule,
        conditionLabel: formatCondition(rule.condition as any),
        actionLabel: formatAction(rule.action),
      })),
    });
  } catch (error) {
    logger.error('Failed to get rules', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/governor/rules
 * Add arbitrage rule
 */
export async function addRule(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const body = JSON.parse(event.body || '{}');
    const { name, condition, action, priority, enabled } = body;

    if (!name || !condition || !action) {
      return jsonResponse(400, { error: 'name, condition, and action are required' });
    }

    const rule = await (economicGovernorService as any).addArbitrageRule(tenantId, {
      name,
      condition,
      action,
      priority: priority || 10,
      enabled: enabled !== false,
    });

    return jsonResponse(201, { success: true, data: rule });
  } catch (error) {
    logger.error('Failed to add rule', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * PUT /api/thinktank/governor/rules/:id
 * Update arbitrage rule
 */
export async function updateRule(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const ruleId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!ruleId) return jsonResponse(400, { error: 'Rule ID required' });

    const body = JSON.parse(event.body || '{}');
    await (economicGovernorService as any).updateArbitrageRule(tenantId, ruleId, body);

    return jsonResponse(200, { success: true });
  } catch (error) {
    logger.error('Failed to update rule', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * DELETE /api/thinktank/governor/rules/:id
 * Delete arbitrage rule
 */
export async function deleteRule(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const ruleId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!ruleId) return jsonResponse(400, { error: 'Rule ID required' });

    await (economicGovernorService as any).deleteArbitrageRule(tenantId, ruleId);

    return jsonResponse(200, { success: true });
  } catch (error) {
    logger.error('Failed to delete rule', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

// ============================================================================
// UI Helpers - "Fuel Gauge" Visualization
// ============================================================================

function getFuelColor(level: number): string {
  if (level > 60) return '#10B981'; // Green - plenty of fuel
  if (level > 30) return '#F59E0B'; // Amber - getting low
  if (level > 10) return '#F97316'; // Orange - low
  return '#EF4444'; // Red - critical
}

function getFuelStatus(level: number): string {
  if (level > 60) return 'Healthy';
  if (level > 30) return 'Moderate';
  if (level > 10) return 'Low';
  return 'Critical';
}

function getTimeUntilReset(resetAt: string): string {
  const reset = new Date(resetAt);
  const now = new Date();
  const diff = reset.getTime() - now.getTime();

  if (diff <= 0) return 'Resetting...';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getModeIcon(mode: GovernorMode): string {
  const icons: Record<GovernorMode, string> = {
    cost_minimizer: '💰',
    quality_maximizer: '⭐',
    balanced: '⚖️',
    latency_focused: '⚡',
    custom: '🔧',
  };
  return icons[mode] || '⚖️';
}

function getModeLabel(mode: GovernorMode): string {
  const labels: Record<GovernorMode, string> = {
    cost_minimizer: 'Cost Minimizer',
    quality_maximizer: 'Quality Maximizer',
    balanced: 'Balanced',
    latency_focused: 'Speed Focused',
    custom: 'Custom Rules',
  };
  return labels[mode] || mode;
}

function getModeDescription(mode: GovernorMode): string {
  const descriptions: Record<GovernorMode, string> = {
    cost_minimizer: 'Always use the cheapest model that meets quality requirements',
    quality_maximizer: 'Use the best available model within budget constraints',
    balanced: 'Optimize for cost-quality balance based on task complexity',
    latency_focused: 'Prioritize response speed over cost and quality',
    custom: 'Use custom arbitrage rules to determine model selection',
  };
  return descriptions[mode] || '';
}

function getModeColor(mode: GovernorMode): string {
  const colors: Record<GovernorMode, string> = {
    cost_minimizer: '#10B981',
    quality_maximizer: '#8B5CF6',
    balanced: '#3B82F6',
    latency_focused: '#F59E0B',
    custom: '#6B7280',
  };
  return colors[mode] || '#6B7280';
}

function getTierIcon(tier: string): string {
  const icons: Record<string, string> = {
    economy: '🌱',
    selfhosted: '🏠',
    standard: '📊',
    premium: '💎',
    flagship: '🚀',
  };
  return icons[tier] || '📊';
}

function getTierLabel(tier: string): string {
  const labels: Record<string, string> = {
    economy: 'Economy',
    selfhosted: 'Self-Hosted',
    standard: 'Standard',
    premium: 'Premium',
    flagship: 'Flagship',
  };
  return labels[tier] || tier;
}

function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    economy: '#10B981',
    selfhosted: '#06B6D4',
    standard: '#3B82F6',
    premium: '#8B5CF6',
    flagship: '#EC4899',
  };
  return colors[tier] || '#6B7280';
}

function formatCondition(condition: { type: string; operator: string; value: number | string }): string {
  const typeLabels: Record<string, string> = {
    budget_percent: 'Budget usage',
    task_complexity: 'Task complexity',
    time_of_day: 'Time of day',
    error_rate: 'Error rate',
  };

  const opLabels: Record<string, string> = {
    gt: '>',
    lt: '<',
    eq: '=',
    gte: '≥',
    lte: '≤',
  };

  return `${typeLabels[condition.type] || condition.type} ${opLabels[condition.operator] || condition.operator} ${condition.value}`;
}

function formatAction(action: { type: string; target?: string }): string {
  const actionLabels: Record<string, string> = {
    downgrade_tier: 'Downgrade tier',
    upgrade_tier: 'Upgrade tier',
    switch_model: `Switch to ${action.target || 'alternative'}`,
    throttle: 'Throttle requests',
    alert: 'Send alert',
  };

  return actionLabels[action.type] || action.type;
}

// ============================================================================
// Router
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  // Dashboard
  if (method === 'GET' && path.endsWith('/governor') && !path.includes('/config') && !path.includes('/tiers') && !path.includes('/rules') && !path.includes('/metrics') && !path.includes('/budget')) {
    return getDashboard(event);
  }

  // Config
  if (method === 'GET' && path.endsWith('/governor/config')) {
    return getConfig(event);
  }
  if (method === 'PUT' && path.endsWith('/governor/config')) {
    return updateConfig(event);
  }

  // Mode
  if (method === 'PUT' && path.endsWith('/governor/mode')) {
    return setMode(event);
  }

  // Recommend
  if (method === 'POST' && path.endsWith('/governor/recommend')) {
    return recommendModel(event);
  }

  // Metrics
  if (method === 'GET' && path.endsWith('/governor/metrics')) {
    return getMetrics(event);
  }

  // Budget
  if (method === 'GET' && path.endsWith('/governor/budget')) {
    return getBudget(event);
  }
  if (method === 'PUT' && path.endsWith('/governor/budget')) {
    return updateBudget(event);
  }

  // Tiers
  if (method === 'GET' && path.endsWith('/governor/tiers')) {
    return getTiers(event);
  }
  if (method === 'PUT' && path.match(/\/governor\/tiers\/[^/]+$/)) {
    return updateTier(event);
  }

  // Rules
  if (method === 'GET' && path.endsWith('/governor/rules')) {
    return getRules(event);
  }
  if (method === 'POST' && path.endsWith('/governor/rules')) {
    return addRule(event);
  }
  if (method === 'PUT' && path.match(/\/governor\/rules\/[^/]+$/)) {
    return updateRule(event);
  }
  if (method === 'DELETE' && path.match(/\/governor\/rules\/[^/]+$/)) {
    return deleteRule(event);
  }

  return jsonResponse(404, { error: 'Not found' });
}
