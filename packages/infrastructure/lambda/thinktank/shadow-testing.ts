// RADIANT v4.18.0 - Think Tank Shadow Testing Lambda Handler
// API endpoints for pre-prompt A/B testing

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPoolClient } from '../shared/db/centralized-pool';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { corsHeaders } from '../shared/middleware/api-response';
import { requireAdmin } from '../shared/auth/admin-auth';
import { v4 as uuidv4 } from 'uuid';

interface ShadowTest {
  id: string;
  testName: string;
  baselineTemplateName: string;
  candidateTemplateName: string;
  testMode: string;
  trafficPercentage: number;
  minSamples: number;
  samplesCollected: number;
  baselineAvgScore: number | null;
  candidateAvgScore: number | null;
  winner: string | null;
  confidenceLevel: number | null;
  status: 'pending' | 'running' | 'completed' | 'promoted' | 'rejected';
  startedAt: string | null;
  completedAt: string | null;
}

interface ShadowSettings {
  defaultTestMode: string;
  autoPromoteThreshold: number;
  autoPromoteConfidence: number;
  maxConcurrentTests: number;
  notifyOnCompletion: boolean;
  notifyOnAutoPromote: boolean;
}

const DEFAULT_SETTINGS: ShadowSettings = {
  defaultTestMode: 'auto',
  autoPromoteThreshold: 0.05,
  autoPromoteConfidence: 0.95,
  maxConcurrentTests: 3,
  notifyOnCompletion: true,
  notifyOnAutoPromote: true,
};

// GET /api/admin/shadow-tests
export async function listTests(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const client = await getPoolClient();

    try {
      const result = await client.query(
        `
        SELECT 
          id,
          test_name,
          baseline_template_name,
          candidate_template_name,
          test_mode,
          traffic_percentage,
          min_samples,
          samples_collected,
          baseline_avg_score,
          candidate_avg_score,
          winner,
          confidence_level,
          status,
          started_at,
          completed_at
        FROM shadow_tests
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        `,
        [admin.tenantId]
      );

      const tests: ShadowTest[] = result.rows.map((row) => ({
        id: row.id,
        testName: row.test_name,
        baselineTemplateName: row.baseline_template_name,
        candidateTemplateName: row.candidate_template_name,
        testMode: row.test_mode || 'auto',
        trafficPercentage: parseFloat(row.traffic_percentage) || 10,
        minSamples: parseInt(row.min_samples, 10) || 100,
        samplesCollected: parseInt(row.samples_collected, 10) || 0,
        baselineAvgScore: row.baseline_avg_score ? parseFloat(row.baseline_avg_score) : null,
        candidateAvgScore: row.candidate_avg_score ? parseFloat(row.candidate_avg_score) : null,
        winner: row.winner,
        confidenceLevel: row.confidence_level ? parseFloat(row.confidence_level) : null,
        status: row.status || 'pending',
        startedAt: row.started_at,
        completedAt: row.completed_at,
      }));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ tests }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to list shadow tests', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load tests' }),
    };
  }
}

// POST /api/admin/shadow-tests
export async function createTest(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const body = JSON.parse(event.body || '{}');

    if (!body.testName || !body.baselineTemplateName || !body.candidateTemplateName) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'testName, baselineTemplateName, and candidateTemplateName are required' }),
      };
    }

    const client = await getPoolClient();

    try {
      const id = uuidv4();
      const result = await client.query(
        `
        INSERT INTO shadow_tests (
          id, tenant_id, test_name, baseline_template_name, candidate_template_name,
          test_mode, traffic_percentage, min_samples, status, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
        RETURNING *
        `,
        [
          id,
          admin.tenantId,
          body.testName,
          body.baselineTemplateName,
          body.candidateTemplateName,
          body.testMode || 'auto',
          body.trafficPercentage || 10,
          body.minSamples || 100,
          admin.id,
        ]
      );

      const row = result.rows[0];
      const test: ShadowTest = {
        id: row.id,
        testName: row.test_name,
        baselineTemplateName: row.baseline_template_name,
        candidateTemplateName: row.candidate_template_name,
        testMode: row.test_mode,
        trafficPercentage: parseFloat(row.traffic_percentage),
        minSamples: parseInt(row.min_samples, 10),
        samplesCollected: 0,
        baselineAvgScore: null,
        candidateAvgScore: null,
        winner: null,
        confidenceLevel: null,
        status: 'pending',
        startedAt: null,
        completedAt: null,
      };

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify(test),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to create shadow test', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to create test' }),
    };
  }
}

// POST /api/admin/shadow-tests/:id/start
export async function startTest(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const testId = event.pathParameters?.id;

    if (!testId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'testId is required' }),
      };
    }

    const client = await getPoolClient();

    try {
      const result = await client.query(
        `
        UPDATE shadow_tests 
        SET status = 'running', started_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
        RETURNING id
        `,
        [testId, admin.tenantId]
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Test not found or not in pending state' }),
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to start shadow test', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to start test' }),
    };
  }
}

// POST /api/admin/shadow-tests/:id/stop
export async function stopTest(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const testId = event.pathParameters?.id;

    if (!testId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'testId is required' }),
      };
    }

    const client = await getPoolClient();

    try {
      const result = await client.query(
        `
        UPDATE shadow_tests 
        SET status = 'completed', completed_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2 AND status = 'running'
        RETURNING id
        `,
        [testId, admin.tenantId]
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Test not found or not running' }),
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to stop shadow test', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to stop test' }),
    };
  }
}

// POST /api/admin/shadow-tests/:id/promote
export async function promoteTest(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const testId = event.pathParameters?.id;

    if (!testId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'testId is required' }),
      };
    }

    const client = await getPoolClient();

    try {
      const result = await client.query(
        `
        UPDATE shadow_tests 
        SET status = 'promoted', completed_at = COALESCE(completed_at, NOW()), updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2 AND status IN ('completed', 'running')
        RETURNING id, candidate_template_name
        `,
        [testId, admin.tenantId]
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Test not found or cannot be promoted' }),
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: true, 
          promotedTemplate: result.rows[0].candidate_template_name 
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to promote shadow test', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to promote test' }),
    };
  }
}

// GET /api/admin/shadow-tests/settings
export async function getSettings(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const client = await getPoolClient();

    try {
      const result = await client.query(
        `
        SELECT config_value 
        FROM dynamic_config 
        WHERE tenant_id = $1 AND config_key = 'shadow_test_settings'
        `,
        [admin.tenantId]
      );

      const settings = result.rows.length > 0 
        ? { ...DEFAULT_SETTINGS, ...result.rows[0].config_value }
        : DEFAULT_SETTINGS;

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ settings }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get shadow test settings', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load settings' }),
    };
  }
}

// PUT /api/admin/shadow-tests/settings
export async function updateSettings(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const updates = JSON.parse(event.body || '{}');
    const client = await getPoolClient();

    try {
      const existingResult = await client.query(
        `
        SELECT config_value 
        FROM dynamic_config 
        WHERE tenant_id = $1 AND config_key = 'shadow_test_settings'
        `,
        [admin.tenantId]
      );

      const existingSettings = existingResult.rows[0]?.config_value || DEFAULT_SETTINGS;
      const newSettings = { ...existingSettings, ...updates };

      await client.query(
        `
        INSERT INTO dynamic_config (tenant_id, config_key, config_value, updated_by)
        VALUES ($1, 'shadow_test_settings', $2, $3)
        ON CONFLICT (tenant_id, config_key) DO UPDATE SET
          config_value = $2,
          updated_by = $3,
          updated_at = NOW()
        `,
        [admin.tenantId, JSON.stringify(newSettings), admin.id]
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ settings: newSettings }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to update shadow test settings', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to save settings' }),
    };
  }
}

// Lambda handler router
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  if (path === '/api/admin/shadow-tests' && method === 'GET') {
    return listTests(event);
  }

  if (path === '/api/admin/shadow-tests' && method === 'POST') {
    return createTest(event);
  }

  if (path === '/api/admin/shadow-tests/settings') {
    if (method === 'GET') return getSettings(event);
    if (method === 'PUT') return updateSettings(event);
  }

  if (path.match(/\/api\/admin\/shadow-tests\/[^/]+\/start/) && method === 'POST') {
    return startTest(event);
  }

  if (path.match(/\/api\/admin\/shadow-tests\/[^/]+\/stop/) && method === 'POST') {
    return stopTest(event);
  }

  if (path.match(/\/api\/admin\/shadow-tests\/[^/]+\/promote/) && method === 'POST') {
    return promoteTest(event);
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' }),
  };
}
