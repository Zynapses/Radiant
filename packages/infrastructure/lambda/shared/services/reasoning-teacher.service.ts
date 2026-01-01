/**
 * Reasoning Teacher Service
 * Generates high-quality reasoning traces for distillation training.
 * RADIANT v6.1.0
 */

import type { ReasoningTrace, TeacherModelId, TeacherConfig, AlternativePath } from '@radiant/shared';
import { DEFAULT_TEACHER_CONFIG, TEACHER_MODEL_COSTS } from '@radiant/shared/constants';
import { getDbPool } from './database';
import { callLiteLLM } from './litellm.service';

export class ReasoningTeacherService {
  private config: TeacherConfig;
  
  constructor(config?: Partial<TeacherConfig>) {
    this.config = { ...DEFAULT_TEACHER_CONFIG, ...config };
  }
  
  selectTeacher(taskType: string): TeacherModelId {
    return this.config.taskTypeMapping[taskType] || this.config.defaultTeacher;
  }
  
  async generateReasoningTrace(
    inputPrompt: string,
    inputContext: Record<string, unknown>,
    taskType: string,
    domainIds: string[],
    tenantId: string
  ): Promise<ReasoningTrace> {
    const teacherModelId = this.selectTeacher(taskType);
    const startTime = Date.now();
    
    const systemPrompt = this.buildTeacherSystemPrompt(taskType);
    const userPrompt = this.buildTeacherUserPrompt(inputPrompt, inputContext);
    
    const response = await callLiteLLM({
      model: teacherModelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: this.config.maxTokensPerTrace,
    });
    
    const latencyMs = Date.now() - startTime;
    const parsed = this.parseTeacherResponse(response.content);
    
    const inputTokens = this.estimateTokens(systemPrompt + userPrompt);
    const outputTokens = this.estimateTokens(response.content);
    const costs = TEACHER_MODEL_COSTS[teacherModelId];
    const costUsd = (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
    
    const trace: ReasoningTrace = {
      id: crypto.randomUUID(),
      tenantId,
      inputPrompt,
      inputContext,
      taskType,
      domainIds,
      teacherModelId,
      teacherResponse: parsed.response,
      reasoningTrace: parsed.reasoning,
      confidenceScore: parsed.confidence,
      alternativePaths: parsed.alternatives,
      generationLatencyMs: latencyMs,
      tokenCountInput: inputTokens,
      tokenCountOutput: outputTokens,
      costUsd,
      status: 'pending',
      qualityScore: null,
      validatedBy: null,
      usedInTrainingJob: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await this.saveTrace(trace);
    return trace;
  }
  
  private buildTeacherSystemPrompt(taskType: string): string {
    return `You are an expert reasoning teacher generating high-quality training data.

REQUIREMENTS:
1. Think through the problem step by step
2. Consider multiple approaches before selecting the best one
3. Explain WHY each step follows from the previous
4. Note any assumptions you're making
5. Identify potential alternative solutions
6. Rate your confidence in the final answer

OUTPUT FORMAT:
<reasoning>
[Your complete chain-of-thought reasoning here]
</reasoning>

<alternatives>
[List 2-3 alternative approaches with brief explanations]
</alternatives>

<confidence>
[0.0-1.0 score with justification]
</confidence>

<response>
[Your final response to the user]
</response>

Task type: ${taskType}`;
  }
  
  private buildTeacherUserPrompt(
    inputPrompt: string, 
    inputContext: Record<string, unknown>
  ): string {
    let prompt = `User Query: ${inputPrompt}`;
    if (Object.keys(inputContext).length > 0) {
      prompt += `\n\nContext:\n${JSON.stringify(inputContext, null, 2)}`;
    }
    return prompt;
  }
  
  private parseTeacherResponse(content: string): {
    response: string;
    reasoning: string;
    confidence: number;
    alternatives: AlternativePath[];
  } {
    const reasoningMatch = content.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
    const alternativesMatch = content.match(/<alternatives>([\s\S]*?)<\/alternatives>/);
    const confidenceMatch = content.match(/<confidence>([\s\S]*?)<\/confidence>/);
    const responseMatch = content.match(/<response>([\s\S]*?)<\/response>/);
    
    const reasoning = reasoningMatch?.[1]?.trim() || content;
    const response = responseMatch?.[1]?.trim() || content;
    
    let confidence = 0.5;
    if (confidenceMatch) {
      const confNum = parseFloat(confidenceMatch[1].trim());
      if (!isNaN(confNum)) {
        confidence = Math.min(1, Math.max(0, confNum));
      }
    }
    
    const alternatives: AlternativePath[] = [];
    if (alternativesMatch) {
      const lines = alternativesMatch[1].trim().split('\n').filter(l => l.trim());
      for (const line of lines) {
        alternatives.push({
          path: line.trim(),
          confidence: 0.5,
          reason: 'Alternative approach',
        });
      }
    }
    
    return { response, reasoning, confidence, alternatives };
  }
  
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
  
  private async saveTrace(trace: ReasoningTrace): Promise<void> {
    const pool = await getDbPool();
    
    await pool.query(`
      INSERT INTO distillation_training_data (
        id, tenant_id, input_prompt, input_context, task_type, domain_ids,
        teacher_model_id, teacher_response, reasoning_trace, confidence_score,
        alternative_paths, generation_latency_ms, token_count_input,
        token_count_output, cost_usd, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    `, [
      trace.id, trace.tenantId, trace.inputPrompt, JSON.stringify(trace.inputContext),
      trace.taskType, trace.domainIds, trace.teacherModelId, trace.teacherResponse,
      trace.reasoningTrace, trace.confidenceScore, JSON.stringify(trace.alternativePaths),
      trace.generationLatencyMs, trace.tokenCountInput, trace.tokenCountOutput,
      trace.costUsd, trace.status, trace.createdAt, trace.updatedAt,
    ]);
  }
  
  async validateTrace(traceId: string, qualityScore: number, validatedBy: string): Promise<void> {
    const pool = await getDbPool();
    const status = qualityScore >= this.config.traceQualityThreshold ? 'validated' : 'rejected';
    
    await pool.query(`
      UPDATE distillation_training_data
      SET status = $1, quality_score = $2, validated_by = $3, updated_at = NOW()
      WHERE id = $4
    `, [status, qualityScore, validatedBy, traceId]);
  }
  
  async getPendingTraces(tenantId: string, limit: number = 50): Promise<ReasoningTrace[]> {
    const pool = await getDbPool();
    const result = await pool.query(`
      SELECT * FROM distillation_training_data
      WHERE tenant_id = $1 AND status = 'pending'
      ORDER BY created_at ASC LIMIT $2
    `, [tenantId, limit]);
    
    return result.rows.map(this.rowToTrace);
  }
  
  async getValidatedTraces(tenantId: string, limit: number = 10000): Promise<ReasoningTrace[]> {
    const pool = await getDbPool();
    const result = await pool.query(`
      SELECT * FROM distillation_training_data
      WHERE tenant_id = $1 AND status = 'validated' AND used_in_training_job IS NULL
      ORDER BY quality_score DESC, created_at ASC LIMIT $2
    `, [tenantId, limit]);
    
    return result.rows.map(this.rowToTrace);
  }
  
  async getTraceStats(tenantId: string): Promise<{
    total: number;
    pending: number;
    validated: number;
    rejected: number;
    used: number;
    avgQualityScore: number;
    totalCostUsd: number;
  }> {
    const pool = await getDbPool();
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'validated') as validated,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE status = 'used') as used,
        AVG(quality_score) FILTER (WHERE quality_score IS NOT NULL) as avg_quality_score,
        SUM(cost_usd) as total_cost_usd
      FROM distillation_training_data
      WHERE tenant_id = $1
    `, [tenantId]);
    
    const row = result.rows[0];
    return {
      total: parseInt(row.total),
      pending: parseInt(row.pending),
      validated: parseInt(row.validated),
      rejected: parseInt(row.rejected),
      used: parseInt(row.used),
      avgQualityScore: parseFloat(row.avg_quality_score) || 0,
      totalCostUsd: parseFloat(row.total_cost_usd) || 0,
    };
  }
  
  private rowToTrace(row: any): ReasoningTrace {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      inputPrompt: row.input_prompt,
      inputContext: row.input_context,
      taskType: row.task_type,
      domainIds: row.domain_ids,
      teacherModelId: row.teacher_model_id,
      teacherResponse: row.teacher_response,
      reasoningTrace: row.reasoning_trace,
      confidenceScore: parseFloat(row.confidence_score),
      alternativePaths: row.alternative_paths || [],
      generationLatencyMs: row.generation_latency_ms,
      tokenCountInput: row.token_count_input,
      tokenCountOutput: row.token_count_output,
      costUsd: parseFloat(row.cost_usd),
      status: row.status,
      qualityScore: row.quality_score ? parseFloat(row.quality_score) : null,
      validatedBy: row.validated_by,
      usedInTrainingJob: row.used_in_training_job,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

export const reasoningTeacher = new ReasoningTeacherService();
