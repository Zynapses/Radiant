import { executeStatement } from '../db/client';
import { brainRouter, type TaskType } from './cognitive-router.service';
import type { SqlParameter } from '@aws-sdk/client-rds-data';

export interface AutoResolveRequest {
  tenantId: string;
  userId: string;
  prompt: string;
  preferences?: {
    maxCost?: number;
    maxLatencyMs?: number;
    preferredProvider?: string;
    qualityLevel?: 'economy' | 'balanced' | 'premium';
  };
}

export interface AutoResolveResult {
  model: string;
  provider: string;
  reason: string;
  estimatedCost: number;
  taskType: TaskType;
  tokenEstimate: number;
  // Domain detection results
  domainDetection?: {
    fieldId?: string;
    fieldName?: string;
    domainId?: string;
    domainName?: string;
    detectionConfidence: number;
  };
  proficiencyMatch?: number;
}

interface PromptAnalysis {
  taskType: TaskType;
  tokenEstimate: number;
  requiresVision: boolean;
  requiresAudio: boolean;
  complexity: 'simple' | 'moderate' | 'complex';
}

export class AutoResolveService {
  async resolve(request: AutoResolveRequest): Promise<AutoResolveResult> {
    const analysis = this.analyzePrompt(request.prompt);

    const qualityToCost: Record<string, number> = {
      economy: 0.001,
      balanced: 0.01,
      premium: 0.1,
    };

    const maxCost =
      request.preferences?.maxCost ??
      qualityToCost[request.preferences?.qualityLevel || 'balanced'];

    const routing = await brainRouter.route({
      tenantId: request.tenantId,
      userId: request.userId,
      taskType: analysis.taskType,
      inputTokenEstimate: analysis.tokenEstimate,
      maxLatencyMs: request.preferences?.maxLatencyMs,
      maxCost,
      preferredProvider: request.preferences?.preferredProvider,
      requiresVision: analysis.requiresVision,
      requiresAudio: analysis.requiresAudio,
      // Enable domain-aware routing
      prompt: request.prompt,
      useDomainProficiencies: true,
    });

    await executeStatement(
      `INSERT INTO auto_resolve_requests 
       (tenant_id, user_id, request_type, selected_model, selection_reason, user_preferences, input_tokens, detected_domain_id, domain_match_score, domain_detection_confidence)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)`,
      [
        { name: 'tenantId', value: { stringValue: request.tenantId } },
        { name: 'userId', value: { stringValue: request.userId } },
        { name: 'requestType', value: { stringValue: analysis.taskType } },
        { name: 'selectedModel', value: { stringValue: routing.model } },
        { name: 'reason', value: { stringValue: routing.reason } },
        { name: 'preferences', value: { stringValue: JSON.stringify(request.preferences || {}) } },
        { name: 'inputTokens', value: { longValue: analysis.tokenEstimate } },
        { name: 'domainId', value: routing.domainDetection?.domainId ? { stringValue: routing.domainDetection.domainId } : { isNull: true } },
        { name: 'domainMatchScore', value: routing.proficiencyMatch !== undefined ? { doubleValue: routing.proficiencyMatch } : { isNull: true } },
        { name: 'domainConfidence', value: routing.domainDetection?.detectionConfidence !== undefined ? { doubleValue: routing.domainDetection.detectionConfidence } : { isNull: true } },
      ]
    );

    return {
      model: routing.model,
      provider: routing.provider,
      reason: routing.reason,
      estimatedCost: routing.estimatedCost,
      taskType: analysis.taskType,
      tokenEstimate: analysis.tokenEstimate,
      domainDetection: routing.domainDetection,
      proficiencyMatch: routing.proficiencyMatch,
    };
  }

  async getHistory(
    tenantId: string,
    userId: string,
    limit: number = 50
  ): Promise<Array<Record<string, unknown>>> {
    const result = await executeStatement(
      `SELECT id, request_type, selected_model, selection_reason, 
              input_tokens, output_tokens, cost, latency_ms, success, created_at
       FROM auto_resolve_requests
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows as Array<Record<string, unknown>>;
  }

  async getStats(tenantId: string): Promise<Record<string, unknown>> {
    const result = await executeStatement(
      `SELECT 
         selected_model,
         request_type,
         COUNT(*) as total_requests,
         AVG(latency_ms) as avg_latency_ms,
         SUM(cost) as total_cost,
         COUNT(*) FILTER (WHERE success = true) as success_count
       FROM auto_resolve_requests
       WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days'
       GROUP BY selected_model, request_type
       ORDER BY total_requests DESC`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return { stats: result.rows };
  }

  async updateRequestMetrics(
    requestId: string,
    metrics: {
      outputTokens?: number;
      cost?: number;
      latencyMs?: number;
      success?: boolean;
    }
  ): Promise<void> {
    const updates: string[] = [];
    const params: SqlParameter[] = [
      { name: 'requestId', value: { stringValue: requestId } },
    ];

    if (metrics.outputTokens !== undefined) {
      updates.push(`output_tokens = $${params.length + 1}`);
      params.push({ name: 'outputTokens', value: { longValue: metrics.outputTokens } });
    }

    if (metrics.cost !== undefined) {
      updates.push(`cost = $${params.length + 1}`);
      params.push({ name: 'cost', value: { doubleValue: metrics.cost } });
    }

    if (metrics.latencyMs !== undefined) {
      updates.push(`latency_ms = $${params.length + 1}`);
      params.push({ name: 'latencyMs', value: { longValue: metrics.latencyMs } });
    }

    if (metrics.success !== undefined) {
      updates.push(`success = $${params.length + 1}`);
      params.push({ name: 'success', value: { booleanValue: metrics.success } });
    }

    if (updates.length === 0) return;

    await executeStatement(
      `UPDATE auto_resolve_requests SET ${updates.join(', ')} WHERE id = $1`,
      params
    );
  }

  private analyzePrompt(prompt: string): PromptAnalysis {
    const lowerPrompt = prompt.toLowerCase();
    const words = prompt.split(/\s+/).length;

    let taskType: TaskType = 'chat';

    const codeIndicators = [
      'code',
      'function',
      'debug',
      'programming',
      'script',
      'algorithm',
      'compile',
      'syntax',
      'bug',
      'error',
      'typescript',
      'javascript',
      'python',
      'java',
      'sql',
    ];
    const analysisIndicators = [
      'analyze',
      'data',
      'statistics',
      'compare',
      'evaluate',
      'assess',
      'research',
      'study',
      'examine',
    ];
    const creativeIndicators = [
      'write',
      'story',
      'creative',
      'poem',
      'essay',
      'novel',
      'fiction',
      'imagine',
      'compose',
    ];
    const visionIndicators = ['image', 'picture', 'photo', 'screenshot', 'diagram', 'chart', 'visual'];
    const audioIndicators = ['audio', 'speech', 'voice', 'sound', 'listen', 'transcribe'];

    if (codeIndicators.some((ind) => lowerPrompt.includes(ind))) {
      taskType = 'code';
    } else if (analysisIndicators.some((ind) => lowerPrompt.includes(ind))) {
      taskType = 'analysis';
    } else if (creativeIndicators.some((ind) => lowerPrompt.includes(ind))) {
      taskType = 'creative';
    }

    const requiresVision = visionIndicators.some((ind) => lowerPrompt.includes(ind));
    const requiresAudio = audioIndicators.some((ind) => lowerPrompt.includes(ind));

    if (requiresVision) taskType = 'vision';
    if (requiresAudio) taskType = 'audio';

    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    if (words > 100 || prompt.includes('```')) {
      complexity = 'complex';
    } else if (words > 30) {
      complexity = 'moderate';
    }

    return {
      taskType,
      tokenEstimate: Math.ceil(prompt.length / 4),
      requiresVision,
      requiresAudio,
      complexity,
    };
  }
}

export const autoResolveService = new AutoResolveService();
