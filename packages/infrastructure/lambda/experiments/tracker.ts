// RADIANT v4.18.0 - Experiment Tracker Lambda Handler
// A/B testing framework with hash-based assignment and statistical analysis

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { logger } from '../shared/logger';
import { createHash } from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

export interface Experiment {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  hypothesis: string;
  variants: ExperimentVariant[];
  targetAudience: {
    percentage: number;
    filters?: Record<string, unknown>;
  };
  metrics: string[];
  status: 'draft' | 'running' | 'paused' | 'completed';
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

export interface ExperimentVariant {
  id: string;
  name: string;
  weight: number;
  config: Record<string, unknown>;
}

export interface ExperimentAssignment {
  experimentId: string;
  userId: string;
  variantId: string;
  assignedAt: string;
}

export interface ExperimentMetric {
  experimentId: string;
  variantId: string;
  metricName: string;
  value: number;
  sampleSize: number;
  timestamp: string;
}

export interface StatisticalResult {
  isSignificant: boolean;
  pValue: number;
  confidenceLevel: number;
  uplift: number;
  controlMean: number;
  treatmentMean: number;
  recommendation: string;
}

// Hash-based variant assignment for consistent bucketing
function assignVariant(userId: string, experimentId: string, variants: ExperimentVariant[]): ExperimentVariant {
  const hash = createHash('md5')
    .update(`${userId}:${experimentId}`)
    .digest('hex');
  
  const hashValue = parseInt(hash.substring(0, 8), 16) / 0xffffffff;
  
  let cumulativeWeight = 0;
  for (const variant of variants) {
    cumulativeWeight += variant.weight;
    if (hashValue <= cumulativeWeight) {
      return variant;
    }
  }
  
  return variants[variants.length - 1];
}

// T-test for statistical significance
function tTest(control: number[], treatment: number[]): { tStat: number; pValue: number } {
  const n1 = control.length;
  const n2 = treatment.length;
  
  if (n1 < 2 || n2 < 2) {
    return { tStat: 0, pValue: 1 };
  }
  
  const mean1 = control.reduce((a, b) => a + b, 0) / n1;
  const mean2 = treatment.reduce((a, b) => a + b, 0) / n2;
  
  const var1 = control.reduce((sum, x) => sum + (x - mean1) ** 2, 0) / (n1 - 1);
  const var2 = treatment.reduce((sum, x) => sum + (x - mean2) ** 2, 0) / (n2 - 1);
  
  const pooledSE = Math.sqrt(var1 / n1 + var2 / n2);
  const tStat = pooledSE > 0 ? (mean2 - mean1) / pooledSE : 0;
  
  // Approximation of p-value (two-tailed)
  const df = n1 + n2 - 2;
  const pValue = 2 * (1 - tDistributionCDF(Math.abs(tStat), df));
  
  return { tStat, pValue };
}

// Approximation of t-distribution CDF
function tDistributionCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  // Using incomplete beta function approximation
  return 1 - 0.5 * incompleteBeta(df / 2, 0.5, x);
}

function incompleteBeta(a: number, b: number, x: number): number {
  // Simple approximation for incomplete beta function
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  
  // Use continued fraction expansion approximation
  const bt = Math.exp(
    a * Math.log(x) + b * Math.log(1 - x) - 
    Math.log(a) - logBeta(a, b)
  );
  
  return bt / a;
}

function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

function logGamma(x: number): number {
  // Stirling's approximation
  return (x - 0.5) * Math.log(x) - x + 0.5 * Math.log(2 * Math.PI);
}

// GET /api/experiments - List experiments
export async function listExperiments(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = event.queryStringParameters?.tenantId;
    const status = event.queryStringParameters?.status;
    const client = await pool.connect();

    try {
      let query = `SELECT * FROM experiments WHERE 1=1`;
      const params: string[] = [];
      let paramIndex = 1;

      if (tenantId) {
        query += ` AND tenant_id = $${paramIndex++}`;
        params.push(tenantId);
      }

      if (status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(status);
      }

      query += ` ORDER BY created_at DESC`;

      const result = await client.query(query, params);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(
          result.rows.map((row) => ({
            id: row.id,
            tenantId: row.tenant_id,
            name: row.name,
            description: row.description,
            hypothesis: row.hypothesis,
            variants: row.variants,
            targetAudience: row.target_audience,
            metrics: row.metrics,
            status: row.status,
            startedAt: row.started_at,
            endedAt: row.ended_at,
            createdAt: row.created_at,
          }))
        ),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to list experiments', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to list experiments' }),
    };
  }
}

// POST /api/experiments - Create experiment
export async function createExperiment(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const experiment: Partial<Experiment> = JSON.parse(event.body || '{}');
    const client = await pool.connect();

    try {
      const result = await client.query(
        `INSERT INTO experiments (
          tenant_id, name, description, hypothesis, variants, 
          target_audience, metrics, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
        RETURNING *`,
        [
          experiment.tenantId,
          experiment.name,
          experiment.description,
          experiment.hypothesis,
          JSON.stringify(experiment.variants),
          JSON.stringify(experiment.targetAudience),
          JSON.stringify(experiment.metrics),
        ]
      );

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          id: result.rows[0].id,
          ...experiment,
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to create experiment', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to create experiment' }),
    };
  }
}

// POST /api/experiments/:id/assign - Assign user to variant
export async function assignToExperiment(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const experimentId = event.pathParameters?.id;
    const { userId } = JSON.parse(event.body || '{}');

    if (!experimentId || !userId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'experimentId and userId are required' }),
      };
    }

    const client = await pool.connect();

    try {
      // Check for existing assignment
      const existing = await client.query(
        `SELECT variant_id FROM experiment_assignments 
         WHERE experiment_id = $1 AND user_id = $2`,
        [experimentId, userId]
      );

      if (existing.rows.length > 0) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            experimentId,
            userId,
            variantId: existing.rows[0].variant_id,
            isNew: false,
          }),
        };
      }

      // Get experiment
      const expResult = await client.query(
        `SELECT * FROM experiments WHERE id = $1 AND status = 'running'`,
        [experimentId]
      );

      if (expResult.rows.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Experiment not found or not running' }),
        };
      }

      const experiment = expResult.rows[0];
      const variants = experiment.variants as ExperimentVariant[];

      // Assign variant
      const assignedVariant = assignVariant(userId, experimentId, variants);

      // Store assignment
      await client.query(
        `INSERT INTO experiment_assignments (experiment_id, user_id, variant_id)
         VALUES ($1, $2, $3)`,
        [experimentId, userId, assignedVariant.id]
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          experimentId,
          userId,
          variantId: assignedVariant.id,
          variantName: assignedVariant.name,
          config: assignedVariant.config,
          isNew: true,
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to assign to experiment', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to assign to experiment' }),
    };
  }
}

// POST /api/experiments/:id/track - Track metric
export async function trackMetric(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const experimentId = event.pathParameters?.id;
    const { userId, metricName, value } = JSON.parse(event.body || '{}');

    if (!experimentId || !userId || !metricName || value === undefined) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    const client = await pool.connect();

    try {
      // Get user's variant
      const assignment = await client.query(
        `SELECT variant_id FROM experiment_assignments 
         WHERE experiment_id = $1 AND user_id = $2`,
        [experimentId, userId]
      );

      if (assignment.rows.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'User not assigned to experiment' }),
        };
      }

      const variantId = assignment.rows[0].variant_id;

      // Store metric
      await client.query(
        `INSERT INTO experiment_metrics (experiment_id, variant_id, user_id, metric_name, value)
         VALUES ($1, $2, $3, $4, $5)`,
        [experimentId, variantId, userId, metricName, value]
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
    logger.error('Failed to track metric', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to track metric' }),
    };
  }
}

// GET /api/experiments/:id/results - Get experiment results with statistical analysis
export async function getExperimentResults(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const experimentId = event.pathParameters?.id;
    const client = await pool.connect();

    try {
      // Get experiment
      const expResult = await client.query(
        `SELECT * FROM experiments WHERE id = $1`,
        [experimentId]
      );

      if (expResult.rows.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Experiment not found' }),
        };
      }

      const experiment = expResult.rows[0];
      const variants = experiment.variants as ExperimentVariant[];
      const controlVariant = variants.find((v) => v.name.toLowerCase() === 'control') || variants[0];

      // Get metrics by variant
      const metricsResult = await client.query(
        `SELECT variant_id, metric_name, value
         FROM experiment_metrics
         WHERE experiment_id = $1`,
        [experimentId]
      );

      // Group metrics by variant and metric name
      const metricsByVariant: Record<string, Record<string, number[]>> = {};
      for (const row of metricsResult.rows) {
        if (!metricsByVariant[row.variant_id]) {
          metricsByVariant[row.variant_id] = {};
        }
        if (!metricsByVariant[row.variant_id][row.metric_name]) {
          metricsByVariant[row.variant_id][row.metric_name] = [];
        }
        metricsByVariant[row.variant_id][row.metric_name].push(parseFloat(row.value));
      }

      // Calculate statistical results for each variant vs control
      const results: Record<string, StatisticalResult> = {};
      const controlData = metricsByVariant[controlVariant.id] || {};

      for (const variant of variants) {
        if (variant.id === controlVariant.id) continue;

        const variantData = metricsByVariant[variant.id] || {};
        const primaryMetric = experiment.metrics[0] || 'conversion';

        const controlValues = controlData[primaryMetric] || [];
        const treatmentValues = variantData[primaryMetric] || [];

        const { tStat, pValue } = tTest(controlValues, treatmentValues);
        const controlMean = controlValues.length > 0
          ? controlValues.reduce((a, b) => a + b, 0) / controlValues.length
          : 0;
        const treatmentMean = treatmentValues.length > 0
          ? treatmentValues.reduce((a, b) => a + b, 0) / treatmentValues.length
          : 0;

        const uplift = controlMean > 0 ? ((treatmentMean - controlMean) / controlMean) * 100 : 0;
        const isSignificant = pValue < 0.05;

        results[variant.id] = {
          isSignificant,
          pValue,
          confidenceLevel: 1 - pValue,
          uplift,
          controlMean,
          treatmentMean,
          recommendation: isSignificant
            ? uplift > 0
              ? `Variant "${variant.name}" shows significant improvement. Consider rolling out.`
              : `Variant "${variant.name}" underperforms. Keep control.`
            : `Results not yet significant. Need more data.`,
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          experimentId,
          status: experiment.status,
          variants: variants.map((v) => ({
            ...v,
            sampleSize: Object.values(metricsByVariant[v.id] || {}).flat().length,
          })),
          results,
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get experiment results', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get results' }),
    };
  }
}

// Lambda handler router
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  if (path === '/api/experiments' && method === 'GET') {
    return listExperiments(event);
  }

  if (path === '/api/experiments' && method === 'POST') {
    return createExperiment(event);
  }

  if (path.match(/\/api\/experiments\/[^/]+\/assign/) && method === 'POST') {
    return assignToExperiment(event);
  }

  if (path.match(/\/api\/experiments\/[^/]+\/track/) && method === 'POST') {
    return trackMetric(event);
  }

  if (path.match(/\/api\/experiments\/[^/]+\/results/) && method === 'GET') {
    return getExperimentResults(event);
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' }),
  };
}
