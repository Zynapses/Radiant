// RADIANT v4.18.0 - Neural Engine Cost Analyzer Lambda Handler
// AI-powered cost optimization recommendations (human-approved only)

import { APIGatewayProxyEvent, APIGatewayProxyResult, ScheduledEvent } from 'aws-lambda';
import { PoolClient } from 'pg';
import { getPoolClient } from '../shared/db/centralized-pool';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { corsHeaders } from '../shared/middleware/api-response';

export interface CostInsight {
  id: string;
  tenantId: string;
  insightType: 'model_switch' | 'usage_pattern' | 'budget_alert' | 'efficiency' | 'anomaly';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  estimatedSavings: number;
  confidence: number;
  affectedUsers?: string[];
  affectedModels?: string[];
  status: 'active' | 'dismissed' | 'applied';
  createdAt: string;
  expiresAt: string;
}

export interface CostPattern {
  tenantId: string;
  userId: string;
  modelId: string;
  avgTokensPerRequest: number;
  avgCostPerRequest: number;
  requestFrequency: number;
  peakHours: number[];
  totalSpend30d: number;
}

export interface ModelAlternative {
  currentModel: string;
  suggestedModel: string;
  qualityScore: number; // 0-1, how well it handles similar tasks
  costReduction: number; // percentage
  latencyChange: number; // percentage (negative = faster)
}

// Model pricing and capabilities (simplified)
const MODEL_CATALOG: Record<string, { costPer1kInput: number; costPer1kOutput: number; tier: number }> = {
  'claude-3-opus': { costPer1kInput: 0.015, costPer1kOutput: 0.075, tier: 5 },
  'claude-3-5-sonnet': { costPer1kInput: 0.003, costPer1kOutput: 0.015, tier: 4 },
  'claude-3-haiku': { costPer1kInput: 0.00025, costPer1kOutput: 0.00125, tier: 2 },
  'gpt-4-turbo': { costPer1kInput: 0.01, costPer1kOutput: 0.03, tier: 5 },
  'gpt-4o': { costPer1kInput: 0.005, costPer1kOutput: 0.015, tier: 4 },
  'gpt-4o-mini': { costPer1kInput: 0.00015, costPer1kOutput: 0.0006, tier: 2 },
};

// Analyze cost patterns for a tenant
async function analyzeCostPatterns(client: PoolClient, tenantId: string): Promise<CostPattern[]> {
  const result = await client.query(
    `
    SELECT 
      user_id,
      model_id,
      AVG(input_tokens + output_tokens) as avg_tokens,
      AVG(total_cost) as avg_cost,
      COUNT(*) as request_count,
      SUM(total_cost) as total_spend,
      array_agg(DISTINCT EXTRACT(HOUR FROM created_at)::int) as peak_hours
    FROM cost_events
    WHERE tenant_id = $1 
      AND created_at > NOW() - INTERVAL '30 days'
    GROUP BY user_id, model_id
    HAVING COUNT(*) > 10
    ORDER BY total_spend DESC
    `,
    [tenantId]
  );

  return result.rows.map((row) => ({
    tenantId,
    userId: row.user_id,
    modelId: row.model_id,
    avgTokensPerRequest: parseFloat(row.avg_tokens),
    avgCostPerRequest: parseFloat(row.avg_cost),
    requestFrequency: parseInt(row.request_count, 10),
    peakHours: row.peak_hours,
    totalSpend30d: parseFloat(row.total_spend),
  }));
}

// Find cheaper model alternatives
function findCheaperAlternative(currentModel: string, avgTokens: number): ModelAlternative | null {
  const current = MODEL_CATALOG[currentModel];
  if (!current) return null;

  // Find models with lower cost but similar tier
  const alternatives: ModelAlternative[] = [];

  for (const [modelId, info] of Object.entries(MODEL_CATALOG)) {
    if (modelId === currentModel) continue;

    // Only suggest models within 1 tier (quality trade-off)
    if (Math.abs(info.tier - current.tier) > 1) continue;

    const currentCost = (current.costPer1kInput + current.costPer1kOutput) * (avgTokens / 1000);
    const altCost = (info.costPer1kInput + info.costPer1kOutput) * (avgTokens / 1000);

    if (altCost < currentCost) {
      const costReduction = ((currentCost - altCost) / currentCost) * 100;
      const qualityScore = 1 - Math.abs(info.tier - current.tier) * 0.2;

      alternatives.push({
        currentModel,
        suggestedModel: modelId,
        qualityScore,
        costReduction,
        latencyChange: info.tier < current.tier ? -20 : 10, // Lower tier = faster
      });
    }
  }

  // Return best alternative (highest savings with acceptable quality)
  return alternatives.sort((a, b) => b.costReduction - a.costReduction)[0] || null;
}

// Check for SLA/business rule exclusions
async function isUserExcluded(client: PoolClient, tenantId: string, userId: string): Promise<boolean> {
  const result = await client.query(
    `
    SELECT 1 FROM user_settings
    WHERE tenant_id = $1 
      AND user_id = $2
      AND (
        settings->>'model_locked' = 'true'
        OR settings->>'enterprise_sla' = 'true'
        OR settings->>'exclude_from_recommendations' = 'true'
      )
    LIMIT 1
    `,
    [tenantId, userId]
  );

  return result.rows.length > 0;
}

// Generate cost insights
async function generateInsights(tenantId?: string): Promise<CostInsight[]> {
  const client = await getPoolClient();
  const insights: CostInsight[] = [];

  try {
    // Get all tenants if not specified
    const tenants = tenantId
      ? [{ id: tenantId }]
      : (await client.query('SELECT id FROM tenants WHERE is_active = true')).rows;

    for (const tenant of tenants) {
      const patterns = await analyzeCostPatterns(client, tenant.id);

      for (const pattern of patterns) {
        // Skip excluded users (SLA, enterprise customers)
        if (await isUserExcluded(client, tenant.id, pattern.userId)) {
          continue;
        }

        // Check for model switch opportunity
        const alternative = findCheaperAlternative(pattern.modelId, pattern.avgTokensPerRequest);

        if (alternative && alternative.costReduction > 20) {
          const estimatedSavings = (pattern.totalSpend30d * alternative.costReduction) / 100;

          insights.push({
            id: crypto.randomUUID(),
            tenantId: tenant.id,
            insightType: 'model_switch',
            severity: estimatedSavings > 100 ? 'warning' : 'info',
            title: `Consider switching from ${alternative.currentModel} to ${alternative.suggestedModel}`,
            description: `User ${pattern.userId} could save approximately $${estimatedSavings.toFixed(2)}/month by switching models.`,
            recommendation: `Switch to ${alternative.suggestedModel} for ${alternative.costReduction.toFixed(0)}% cost reduction with ${(alternative.qualityScore * 100).toFixed(0)}% quality match.`,
            estimatedSavings,
            confidence: alternative.qualityScore,
            affectedUsers: [pattern.userId],
            affectedModels: [pattern.modelId],
            status: 'active', // NOT auto-applied - requires human approval
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });
        }

        // Check for usage anomaly (spike detection)
        const avgSpend = await getAverageSpend(client, tenant.id, pattern.userId);
        if (pattern.totalSpend30d > avgSpend * 3) {
          insights.push({
            id: crypto.randomUUID(),
            tenantId: tenant.id,
            insightType: 'anomaly',
            severity: 'warning',
            title: `Unusual spending spike detected`,
            description: `User ${pattern.userId} spending is ${((pattern.totalSpend30d / avgSpend) * 100 - 100).toFixed(0)}% higher than average.`,
            recommendation: 'Review usage patterns and consider implementing rate limits.',
            estimatedSavings: pattern.totalSpend30d - avgSpend,
            confidence: 0.8,
            affectedUsers: [pattern.userId],
            status: 'active',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          });
        }
      }

      // Store insights (NOT auto-applied)
      for (const insight of insights.filter((i) => i.tenantId === tenant.id)) {
        await client.query(
          `INSERT INTO cost_insights (
            id, tenant_id, insight_type, severity, title, description, recommendation,
            estimated_savings, confidence, affected_users, affected_models, status, created_at, expires_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (id) DO NOTHING`,
          [
            insight.id,
            insight.tenantId,
            insight.insightType,
            insight.severity,
            insight.title,
            insight.description,
            insight.recommendation,
            insight.estimatedSavings,
            insight.confidence,
            JSON.stringify(insight.affectedUsers || []),
            JSON.stringify(insight.affectedModels || []),
            insight.status,
            insight.createdAt,
            insight.expiresAt,
          ]
        );
      }
    }

    return insights;
  } finally {
    client.release();
  }
}

// Helper: Get average spend for comparison
async function getAverageSpend(client: PoolClient, tenantId: string, userId: string): Promise<number> {
  const result = await client.query(
    `
    SELECT AVG(monthly_spend) as avg_spend FROM (
      SELECT SUM(total_cost) as monthly_spend
      FROM cost_events
      WHERE tenant_id = $1 AND user_id = $2
        AND created_at > NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at)
    ) monthly
    `,
    [tenantId, userId]
  );

  return parseFloat(result.rows[0]?.avg_spend || '0');
}

// API Handlers

// GET /api/neural-engine/insights - Get active insights
export async function getInsights(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = event.queryStringParameters?.tenantId;
    const status = event.queryStringParameters?.status || 'active';

    const client = await getPoolClient();
    try {
      const result = await client.query(
        `SELECT * FROM cost_insights 
         WHERE ($1::text IS NULL OR tenant_id = $1)
           AND status = $2
           AND expires_at > NOW()
         ORDER BY estimated_savings DESC
         LIMIT 50`,
        [tenantId, status]
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.rows),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get insights' }),
    };
  }
}

// POST /api/neural-engine/insights/:id/apply - Apply insight (REQUIRES HUMAN APPROVAL)
export async function applyInsight(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const insightId = event.pathParameters?.id;
    const { approvedBy } = JSON.parse(event.body || '{}');

    if (!approvedBy) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Human approval required. Provide approvedBy field.' }),
      };
    }

    const client = await getPoolClient();
    try {
      // Get insight
      const insightResult = await client.query(
        'SELECT * FROM cost_insights WHERE id = $1',
        [insightId]
      );

      if (insightResult.rows.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Insight not found' }),
        };
      }

      const insight = insightResult.rows[0];

      // Mark as applied (actual implementation would depend on insight type)
      await client.query(
        `UPDATE cost_insights 
         SET status = 'applied', 
             applied_at = NOW(),
             applied_by = $2
         WHERE id = $1`,
        [insightId, approvedBy]
      );

      // Log the approval for audit
      await client.query(
        `INSERT INTO audit_logs (
          tenant_id, action, resource_type, resource_id, performed_by, details
        ) VALUES ($1, 'apply_cost_insight', 'cost_insight', $2, $3, $4)`,
        [
          insight.tenant_id,
          insightId,
          approvedBy,
          JSON.stringify({
            insightType: insight.insight_type,
            estimatedSavings: insight.estimated_savings,
          }),
        ]
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, message: 'Insight applied with human approval' }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to apply insight' }),
    };
  }
}

// POST /api/neural-engine/insights/:id/dismiss - Dismiss insight
export async function dismissInsight(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const insightId = event.pathParameters?.id;
    const { reason, dismissedBy } = JSON.parse(event.body || '{}');

    const client = await getPoolClient();
    try {
      await client.query(
        `UPDATE cost_insights 
         SET status = 'dismissed',
             dismissed_at = NOW(),
             dismissed_by = $2,
             dismiss_reason = $3
         WHERE id = $1`,
        [insightId, dismissedBy, reason]
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to dismiss insight' }),
    };
  }
}

// Scheduled handler - Run daily analysis
export async function scheduledAnalysis(event: ScheduledEvent): Promise<void> {
  logger.info('Running scheduled cost analysis...');
  const insights = await generateInsights();
  logger.info(`Generated ${insights.length} new insights`);
}

// Main handler
export async function handler(
  event: APIGatewayProxyEvent | ScheduledEvent
): Promise<APIGatewayProxyResult | void> {
  // Handle scheduled events
  if ('source' in event && event.source === 'aws.events') {
    return scheduledAnalysis(event as ScheduledEvent);
  }

  const apiEvent = event as APIGatewayProxyEvent;
  const path = apiEvent.path;
  const method = apiEvent.httpMethod;

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (path === '/api/neural-engine/insights' && method === 'GET') {
    return getInsights(apiEvent);
  }

  if (path.match(/\/api\/neural-engine\/insights\/[\w-]+\/apply/) && method === 'POST') {
    return applyInsight(apiEvent);
  }

  if (path.match(/\/api\/neural-engine\/insights\/[\w-]+\/dismiss/) && method === 'POST') {
    return dismissInsight(apiEvent);
  }

  // Trigger manual analysis
  if (path === '/api/neural-engine/analyze' && method === 'POST') {
    const tenantId = JSON.parse(apiEvent.body || '{}').tenantId;
    const insights = await generateInsights(tenantId);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ insights, count: insights.length }),
    };
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' }),
  };
}
