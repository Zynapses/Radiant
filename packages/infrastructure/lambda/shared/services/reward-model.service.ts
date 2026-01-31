/**
 * Reward Model Service
 * Scores response quality for best-of-N selection.
 * RADIANT v6.1.0
 */

import type { RewardContext, RewardScore, RewardTrainingData } from '@radiant/shared';
import { REWARD_MODEL_CONFIG, REWARD_DIMENSION_WEIGHTS } from '@radiant/shared/constants';
import { getDbPool } from './database';
import { callLiteLLM } from './litellm.service';
import { s3ContentOffloadService } from './s3-content-offload.service';

export class RewardModelService {
  
  async scoreResponse(response: string, context: RewardContext): Promise<RewardScore> {
    const prompt = this.buildScoringPrompt(response, context);
    
    const result = await callLiteLLM({
      model: 'claude-sonnet-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
    });
    
    return this.parseScoreResponse(result.content);
  }
  
  async scoreMultiple(responses: string[], context: RewardContext): Promise<RewardScore[]> {
    const scores = await Promise.all(
      responses.map(response => this.scoreResponse(response, context))
    );
    return scores;
  }
  
  async selectBest(
    responses: string[],
    context: RewardContext
  ): Promise<{ selected: string; selectedIndex: number; scores: RewardScore[] }> {
    const scores = await this.scoreMultiple(responses, context);
    
    let bestIndex = 0;
    let bestScore = scores[0].overall;
    
    for (let i = 1; i < scores.length; i++) {
      if (scores[i].overall > bestScore) {
        bestScore = scores[i].overall;
        bestIndex = i;
      }
    }
    
    return {
      selected: responses[bestIndex],
      selectedIndex: bestIndex,
      scores,
    };
  }
  
  async recordPreference(
    tenantId: string,
    userId: string,
    prompt: string,
    context: Record<string, unknown>,
    winningResponse: string,
    losingResponse: string,
    signalType: RewardTrainingData['signalType'],
    signalStrength: number,
    domainIds: string[],
    winningModelId?: string,
    losingModelId?: string
  ): Promise<void> {
    const pool = await getDbPool();
    const recordId = crypto.randomUUID();
    
    // Offload large responses to S3 instead of storing in database
    // This prevents database bloat from storing full AI responses
    let winningS3Key: string | null = null;
    let losingS3Key: string | null = null;
    let storedWinning = winningResponse;
    let storedLosing = losingResponse;
    
    // Offload winning response if large
    if (winningResponse.length > 10000) {
      const result = await s3ContentOffloadService.offloadContent(
        tenantId, 'reward_training_data', `${recordId}_winning`, winningResponse, 'text/plain'
      );
      if (result) {
        winningS3Key = result.s3_key;
        storedWinning = `[S3:${result.s3_key}]`; // Placeholder in DB
      }
    }
    
    // Offload losing response if large
    if (losingResponse.length > 10000) {
      const result = await s3ContentOffloadService.offloadContent(
        tenantId, 'reward_training_data', `${recordId}_losing`, losingResponse, 'text/plain'
      );
      if (result) {
        losingS3Key = result.s3_key;
        storedLosing = `[S3:${result.s3_key}]`; // Placeholder in DB
      }
    }
    
    await pool.query(`
      INSERT INTO reward_training_data (
        id, tenant_id, user_id, prompt, context,
        winning_response, winning_model_id, winning_s3_key,
        losing_response, losing_model_id, losing_s3_key,
        signal_type, signal_strength, domain_ids, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
    `, [
      recordId, tenantId, userId, prompt, JSON.stringify(context),
      storedWinning, winningModelId, winningS3Key,
      storedLosing, losingModelId, losingS3Key,
      signalType, signalStrength, domainIds,
    ]);
  }
  
  async recordFromRegeneration(
    tenantId: string,
    userId: string,
    prompt: string,
    context: Record<string, unknown>,
    originalResponse: string,
    regeneratedResponse: string,
    domainIds: string[]
  ): Promise<void> {
    await this.recordPreference(
      tenantId, userId, prompt, context,
      regeneratedResponse, originalResponse,
      'regeneration', 0.8, domainIds
    );
  }
  
  async recordFromExplicitFeedback(
    tenantId: string,
    userId: string,
    prompt: string,
    context: Record<string, unknown>,
    response: string,
    isPositive: boolean,
    domainIds: string[]
  ): Promise<void> {
    if (isPositive) {
      await this.recordPreference(
        tenantId, userId, prompt, context,
        response, '',
        'explicit_feedback', 1.0, domainIds
      );
    } else {
      await this.recordPreference(
        tenantId, userId, prompt, context,
        '', response,
        'explicit_feedback', 0.9, domainIds
      );
    }
  }
  
  async getTrainingData(
    tenantId: string,
    limit: number = 10000
  ): Promise<RewardTrainingData[]> {
    const pool = await getDbPool();
    const result = await pool.query(`
      SELECT * FROM reward_training_data
      WHERE tenant_id = $1 AND used_in_training = false
      ORDER BY signal_strength DESC, created_at DESC
      LIMIT $2
    `, [tenantId, limit]);
    
    return result.rows.map(this.rowToTrainingData);
  }
  
  async markAsUsedInTraining(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    
    const pool = await getDbPool();
    await pool.query(`
      UPDATE reward_training_data SET used_in_training = true
      WHERE id = ANY($1)
    `, [ids]);
  }
  
  async getTrainingStats(tenantId: string): Promise<{
    totalExamples: number;
    unusedExamples: number;
    bySignalType: Record<string, number>;
    avgSignalStrength: number;
  }> {
    const pool = await getDbPool();
    
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE used_in_training = false) as unused,
        AVG(signal_strength) as avg_strength
      FROM reward_training_data
      WHERE tenant_id = $1
    `, [tenantId]);
    
    const byTypeResult = await pool.query(`
      SELECT signal_type, COUNT(*) as count
      FROM reward_training_data
      WHERE tenant_id = $1
      GROUP BY signal_type
    `, [tenantId]);
    
    const bySignalType: Record<string, number> = {};
    for (const row of byTypeResult.rows) {
      bySignalType[row.signal_type] = parseInt(row.count);
    }
    
    return {
      totalExamples: parseInt(result.rows[0].total),
      unusedExamples: parseInt(result.rows[0].unused),
      bySignalType,
      avgSignalStrength: parseFloat(result.rows[0].avg_strength) || 0,
    };
  }
  
  private buildScoringPrompt(response: string, context: RewardContext): string {
    const historyText = context.conversationHistory
      .slice(-5)
      .map(m => `${m.role}: ${m.content.slice(0, 200)}`)
      .join('\n');
    
    return `Score this AI response on multiple dimensions.

USER PREFERENCES:
- Response length: ${context.userPreferences.responseLength}
- Formality: ${context.userPreferences.formalityLevel}

ORIGINAL PROMPT:
${context.originalPrompt}

${historyText ? `CONVERSATION CONTEXT:\n${historyText}\n` : ''}

RESPONSE TO SCORE:
${response}

Score each dimension from 0.0 to 1.0:
- relevance: How well does it address the prompt?
- accuracy: Is the information correct?
- helpfulness: How useful is this response?
- safety: Is it safe and appropriate?
- style: Does it match user preferences?

Return JSON only:
{
  "relevance": 0.0-1.0,
  "accuracy": 0.0-1.0,
  "helpfulness": 0.0-1.0,
  "safety": 0.0-1.0,
  "style": 0.0-1.0,
  "confidence": 0.0-1.0
}`;
  }
  
  private parseScoreResponse(content: string): RewardScore {
    const defaults: RewardScore = {
      overall: 0.5,
      dimensions: {
        relevance: 0.5,
        accuracy: 0.5,
        helpfulness: 0.5,
        safety: 0.5,
        style: 0.5,
      },
      confidence: 0.5,
    };
    
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return defaults;
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      const dimensions = {
        relevance: Math.min(1, Math.max(0, parsed.relevance || 0.5)),
        accuracy: Math.min(1, Math.max(0, parsed.accuracy || 0.5)),
        helpfulness: Math.min(1, Math.max(0, parsed.helpfulness || 0.5)),
        safety: Math.min(1, Math.max(0, parsed.safety || 0.5)),
        style: Math.min(1, Math.max(0, parsed.style || 0.5)),
      };
      
      const overall = 
        dimensions.relevance * REWARD_DIMENSION_WEIGHTS.relevance +
        dimensions.accuracy * REWARD_DIMENSION_WEIGHTS.accuracy +
        dimensions.helpfulness * REWARD_DIMENSION_WEIGHTS.helpfulness +
        dimensions.safety * REWARD_DIMENSION_WEIGHTS.safety +
        dimensions.style * REWARD_DIMENSION_WEIGHTS.style;
      
      return {
        overall,
        dimensions,
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      };
    } catch {
      return defaults;
    }
  }
  
  private rowToTrainingData(row: any): RewardTrainingData {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      prompt: row.prompt,
      context: row.context,
      winningResponse: row.winning_response,
      winningModelId: row.winning_model_id,
      losingResponse: row.losing_response,
      losingModelId: row.losing_model_id,
      signalType: row.signal_type,
      signalStrength: parseFloat(row.signal_strength),
      domainIds: row.domain_ids,
      createdAt: new Date(row.created_at),
      usedInTraining: row.used_in_training,
    };
  }
}

export const rewardModel = new RewardModelService();
