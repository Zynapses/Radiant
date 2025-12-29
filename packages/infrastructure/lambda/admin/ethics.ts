// RADIANT v4.18.0 - Ethics Admin API
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ethicalGuardrailsService, JESUS_TEACHINGS } from '../shared/services/ethical-guardrails.service';
import { executeStatement } from '../shared/db/client';
import { extractAuthContext } from '../shared/auth';
import { success, handleError } from '../shared/response';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = extractAuthContext(event);
    const path = event.path;
    const method = event.httpMethod;

    // GET /admin/ethics/principles
    if (method === 'GET' && path.endsWith('/principles')) {
      const principles = await ethicalGuardrailsService.getPrinciples(user.tenantId);
      return success({ principles, teachings: JESUS_TEACHINGS });
    }

    // GET /admin/ethics/evaluations - Get recent ethical evaluations
    if (method === 'GET' && path.endsWith('/evaluations')) {
      const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
      const result = await executeStatement(
        `SELECT * FROM ethical_evaluations WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [{ name: 't', value: { stringValue: user.tenantId } }, { name: 'l', value: { longValue: limit } }]
      );
      const evaluations = result.rows.map((r: Record<string, unknown>) => ({
        evaluationId: String(r.evaluation_id),
        action: String(r.action),
        principlesApplied: r.principles_applied,
        ethicalScore: Number(r.ethical_score),
        concerns: r.concerns,
        recommendations: r.recommendations,
        approved: Boolean(r.approved),
        reasoning: String(r.reasoning || ''),
        createdAt: String(r.created_at),
      }));
      return success({ evaluations });
    }

    // GET /admin/ethics/violations - Get violations only
    if (method === 'GET' && path.endsWith('/violations')) {
      const result = await executeStatement(
        `SELECT * FROM ethical_evaluations WHERE tenant_id = $1 AND approved = false ORDER BY created_at DESC LIMIT 100`,
        [{ name: 't', value: { stringValue: user.tenantId } }]
      );
      const violations = result.rows.map((r: Record<string, unknown>) => ({
        evaluationId: String(r.evaluation_id),
        action: String(r.action),
        ethicalScore: Number(r.ethical_score),
        concerns: r.concerns,
        recommendations: r.recommendations,
        reasoning: String(r.reasoning || ''),
        createdAt: String(r.created_at),
      }));
      return success({ violations });
    }

    // GET /admin/ethics/standards - Get AI ethics standards
    if (method === 'GET' && path.endsWith('/standards')) {
      const result = await executeStatement(
        `SELECT * FROM ai_ethics_standards WHERE is_active = true ORDER BY display_order`,
        []
      );
      const standards = result.rows.map((r: Record<string, unknown>) => ({
        code: String(r.code),
        name: String(r.name),
        fullName: String(r.full_name),
        version: r.version ? String(r.version) : null,
        organization: String(r.organization),
        organizationType: String(r.organization_type),
        description: r.description ? String(r.description) : null,
        url: r.url ? String(r.url) : null,
        publicationDate: r.publication_date ? String(r.publication_date) : null,
        isMandatory: Boolean(r.is_mandatory),
        icon: r.icon ? String(r.icon) : 'Shield',
      }));
      return success({ standards });
    }

    // GET /admin/ethics/stats - Get ethical statistics
    if (method === 'GET' && path.endsWith('/stats')) {
      const result = await executeStatement(
        `SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE approved = true) as approved,
          COUNT(*) FILTER (WHERE approved = false) as rejected,
          AVG(ethical_score) as avg_score,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today
         FROM ethical_evaluations WHERE tenant_id = $1`,
        [{ name: 't', value: { stringValue: user.tenantId } }]
      );
      const row = result.rows[0] as Record<string, unknown>;
      return success({
        totalEvaluations: Number(row.total || 0),
        approved: Number(row.approved || 0),
        rejected: Number(row.rejected || 0),
        averageScore: Number(row.avg_score || 1.0),
        evaluationsToday: Number(row.today || 0),
      });
    }

    // POST /admin/ethics/check - Check an action
    if (method === 'POST' && path.endsWith('/check')) {
      const { action, context } = JSON.parse(event.body || '{}');
      const evaluation = await ethicalGuardrailsService.evaluateAction(user.tenantId, action, context);
      // Save evaluation
      await executeStatement(
        `INSERT INTO ethical_evaluations (tenant_id, action, principles_applied, ethical_score, concerns, recommendations, approved, reasoning)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          { name: 't', value: { stringValue: user.tenantId } },
          { name: 'a', value: { stringValue: action } },
          { name: 'p', value: { stringValue: JSON.stringify(evaluation.principlesApplied) } },
          { name: 's', value: { doubleValue: evaluation.ethicalScore } },
          { name: 'c', value: { stringValue: JSON.stringify(evaluation.concerns) } },
          { name: 'r', value: { stringValue: JSON.stringify(evaluation.recommendations) } },
          { name: 'v', value: { booleanValue: evaluation.approved } },
          { name: 'e', value: { stringValue: evaluation.reasoning } },
        ]
      );
      return success(evaluation);
    }

    return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
  } catch (error) {
    return handleError(error);
  }
}
