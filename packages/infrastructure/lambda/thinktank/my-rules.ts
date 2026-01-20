// RADIANT v4.18.0 - Think Tank My Rules Lambda Handler
// API endpoints for user-defined rules (personalized AI behavior)

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPoolClient } from '../shared/db/centralized-pool';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { corsHeaders } from '../shared/middleware/api-response';
import { requireAdmin } from '../shared/auth/admin-auth';
import { v4 as uuidv4 } from 'uuid';

interface UserRule {
  id: string;
  content: string;
  category: string;
  isActive: boolean;
  timesApplied: number;
  createdAt: string;
  updatedAt: string;
}

interface RulePreset {
  id: string;
  name: string;
  description: string;
  content: string;
  category: string;
}

const RULE_PRESETS: RulePreset[] = [
  {
    id: 'concise',
    name: 'Be Concise',
    description: 'Prefer shorter, to-the-point responses',
    content: 'Keep responses concise and focused. Avoid unnecessary elaboration.',
    category: 'style',
  },
  {
    id: 'detailed',
    name: 'Be Detailed',
    description: 'Provide comprehensive explanations',
    content: 'Provide detailed, thorough explanations with examples when helpful.',
    category: 'style',
  },
  {
    id: 'casual',
    name: 'Casual Tone',
    description: 'Use a friendly, conversational tone',
    content: 'Use a casual, friendly tone. Feel free to use contractions and informal language.',
    category: 'tone',
  },
  {
    id: 'formal',
    name: 'Formal Tone',
    description: 'Use professional, formal language',
    content: 'Use formal, professional language. Avoid slang and contractions.',
    category: 'tone',
  },
  {
    id: 'code-comments',
    name: 'Comment Code',
    description: 'Add helpful comments to code',
    content: 'When writing code, include helpful comments explaining what each section does.',
    category: 'coding',
  },
  {
    id: 'no-emojis',
    name: 'No Emojis',
    description: 'Never use emojis in responses',
    content: 'Do not use emojis in any responses.',
    category: 'style',
  },
  {
    id: 'step-by-step',
    name: 'Step by Step',
    description: 'Break down complex topics into steps',
    content: 'When explaining complex topics, break them down into numbered steps.',
    category: 'format',
  },
  {
    id: 'ask-clarify',
    name: 'Ask for Clarification',
    description: 'Ask questions when requests are ambiguous',
    content: 'If a request is ambiguous, ask clarifying questions before proceeding.',
    category: 'behavior',
  },
];

// GET /api/admin/my-rules
export async function listRules(
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
          content,
          category,
          is_active,
          times_applied,
          created_at,
          updated_at
        FROM user_rules
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        `,
        [admin.tenantId]
      );

      const rules: UserRule[] = result.rows.map((row) => ({
        id: row.id,
        content: row.content,
        category: row.category || 'general',
        isActive: row.is_active !== false,
        timesApplied: parseInt(row.times_applied, 10) || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      // Get stats
      const activeCount = rules.filter((r) => r.isActive).length;
      const totalApplied = rules.reduce((sum, r) => sum + r.timesApplied, 0);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          rules,
          stats: {
            total: rules.length,
            active: activeCount,
            totalApplied,
          },
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to list rules', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load rules' }),
    };
  }
}

// POST /api/admin/my-rules
export async function createRule(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const body = JSON.parse(event.body || '{}');

    if (!body.content || body.content.trim().length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'content is required' }),
      };
    }

    const client = await getPoolClient();

    try {
      const id = uuidv4();
      const result = await client.query(
        `
        INSERT INTO user_rules (id, tenant_id, content, category, is_active, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, content, category, is_active, times_applied, created_at, updated_at
        `,
        [
          id,
          admin.tenantId,
          body.content.trim(),
          body.category || 'general',
          body.isActive !== false,
          admin.id,
        ]
      );

      const row = result.rows[0];
      const rule: UserRule = {
        id: row.id,
        content: row.content,
        category: row.category,
        isActive: row.is_active,
        timesApplied: 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify(rule),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to create rule', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to create rule' }),
    };
  }
}

// PUT /api/admin/my-rules/:id
export async function updateRule(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const ruleId = event.pathParameters?.id;

    if (!ruleId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'ruleId is required' }),
      };
    }

    const body = JSON.parse(event.body || '{}');
    const client = await getPoolClient();

    try {
      const updates: string[] = ['updated_at = NOW()'];
      const values: (string | boolean)[] = [ruleId, admin.tenantId];
      let paramIndex = 3;

      if (body.content !== undefined) {
        updates.push(`content = $${paramIndex++}`);
        values.push(body.content.trim());
      }

      if (body.category !== undefined) {
        updates.push(`category = $${paramIndex++}`);
        values.push(body.category);
      }

      if (body.isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(body.isActive);
      }

      const result = await client.query(
        `
        UPDATE user_rules 
        SET ${updates.join(', ')}
        WHERE id = $1 AND tenant_id = $2
        RETURNING id, content, category, is_active, times_applied, created_at, updated_at
        `,
        values
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Rule not found' }),
        };
      }

      const row = result.rows[0];
      const rule: UserRule = {
        id: row.id,
        content: row.content,
        category: row.category,
        isActive: row.is_active,
        timesApplied: parseInt(row.times_applied, 10) || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(rule),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to update rule', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to update rule' }),
    };
  }
}

// DELETE /api/admin/my-rules/:id
export async function deleteRule(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const ruleId = event.pathParameters?.id;

    if (!ruleId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'ruleId is required' }),
      };
    }

    const client = await getPoolClient();

    try {
      const result = await client.query(
        `DELETE FROM user_rules WHERE id = $1 AND tenant_id = $2 RETURNING id`,
        [ruleId, admin.tenantId]
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Rule not found' }),
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
    logger.error('Failed to delete rule', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to delete rule' }),
    };
  }
}

// GET /api/admin/my-rules/presets
export async function getPresets(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    await requireAdmin(event);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ presets: RULE_PRESETS }),
    };
  } catch (error) {
    logger.error('Failed to get presets', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load presets' }),
    };
  }
}

// Lambda handler router
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  if (path === '/api/admin/my-rules' && method === 'GET') {
    return listRules(event);
  }

  if (path === '/api/admin/my-rules' && method === 'POST') {
    return createRule(event);
  }

  if (path === '/api/admin/my-rules/presets' && method === 'GET') {
    return getPresets(event);
  }

  if (path.match(/\/api\/admin\/my-rules\/[^/]+$/) && method === 'PUT') {
    return updateRule(event);
  }

  if (path.match(/\/api\/admin\/my-rules\/[^/]+$/) && method === 'DELETE') {
    return deleteRule(event);
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' }),
  };
}
