// RADIANT v4.18.0 - Enhanced Learning Integration Service
// Bridges enhanced learning system with LoRA evolution pipeline
// ============================================================================

import { executeStatement, stringParam, longParam, doubleParam } from '../db/client';
import { enhancedLearningService } from './enhanced-learning.service';
import { learningCandidateService, type CandidateType } from './learning-candidate.service';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface EnhancedTrainingDataset {
  positiveCandidates: TrainingCandidate[];
  negativeCandidates: TrainingCandidate[];
  totalCandidates: number;
  totalTokens: number;
  typeDistribution: Record<string, number>;
  sourceDistribution: {
    explicitRatings: number;
    implicitSignals: number;
    conversationLevel: number;
    corrections: number;
  };
}

export interface TrainingCandidate {
  candidateId: string;
  candidateType: string;
  source: 'explicit_rating' | 'implicit_signal' | 'conversation_learning' | 'correction' | 'negative_feedback';
  promptText: string;
  responseText: string;
  correctionText?: string;
  qualityScore: number;
  isNegative: boolean;
  domain?: string;
  tokenCount: number;
}

// ============================================================================
// Enhanced Learning Integration Service
// ============================================================================

class EnhancedLearningIntegrationService {
  
  /**
   * Check if tenant has enough candidates for training based on enhanced config
   */
  async shouldTriggerTraining(tenantId: string): Promise<{
    shouldTrain: boolean;
    reason: string;
    stats: {
      positiveCandidates: number;
      negativeCandidates: number;
      minRequired: number;
      minPositiveRequired: number;
      minNegativeRequired: number;
    };
  }> {
    const config = await enhancedLearningService.getConfig(tenantId);
    if (!config) {
      return {
        shouldTrain: false,
        reason: 'No learning config found',
        stats: { positiveCandidates: 0, negativeCandidates: 0, minRequired: 0, minPositiveRequired: 0, minNegativeRequired: 0 },
      };
    }
    
    // Count positive candidates from learning_candidates table
    const positiveResult = await executeStatement(
      `SELECT COUNT(*) as count FROM learning_candidates 
       WHERE tenant_id = $1::uuid AND training_status = 'pending' AND expires_at > NOW()`,
      [stringParam('tenantId', tenantId)]
    );
    const positiveCandidates = Number(positiveResult.rows?.[0]?.count || 0);
    
    // Count negative candidates from negative_learning_candidates table
    const negativeResult = await executeStatement(
      `SELECT COUNT(*) as count FROM negative_learning_candidates 
       WHERE tenant_id = $1::uuid AND status = 'pending'`,
      [stringParam('tenantId', tenantId)]
    );
    const negativeCandidates = Number(negativeResult.rows?.[0]?.count || 0);
    
    const totalCandidates = positiveCandidates + negativeCandidates;
    
    const stats = {
      positiveCandidates,
      negativeCandidates,
      minRequired: config.minCandidatesForTraining,
      minPositiveRequired: config.minPositiveCandidates,
      minNegativeRequired: config.minNegativeCandidates,
    };
    
    // Check thresholds
    if (totalCandidates < config.minCandidatesForTraining) {
      return {
        shouldTrain: false,
        reason: `Insufficient total candidates: ${totalCandidates} < ${config.minCandidatesForTraining}`,
        stats,
      };
    }
    
    if (positiveCandidates < config.minPositiveCandidates) {
      return {
        shouldTrain: false,
        reason: `Insufficient positive candidates: ${positiveCandidates} < ${config.minPositiveCandidates}`,
        stats,
      };
    }
    
    // Negative candidates are optional but recommended
    const hasEnoughNegative = !config.negativeLearningEnabled || negativeCandidates >= config.minNegativeCandidates;
    
    return {
      shouldTrain: true,
      reason: hasEnoughNegative 
        ? 'Ready for training with positive and negative examples'
        : 'Ready for training (negative examples below threshold but proceeding)',
      stats,
    };
  }
  
  /**
   * Get enhanced training dataset including all learning sources
   */
  async getEnhancedTrainingDataset(
    tenantId: string,
    maxCandidates: number = 1000,
    maxTokens: number = 500000
  ): Promise<EnhancedTrainingDataset> {
    const config = await enhancedLearningService.getConfig(tenantId);
    
    const positiveCandidates: TrainingCandidate[] = [];
    const negativeCandidates: TrainingCandidate[] = [];
    let totalTokens = 0;
    const typeDistribution: Record<string, number> = {};
    const sourceDistribution = {
      explicitRatings: 0,
      implicitSignals: 0,
      conversationLevel: 0,
      corrections: 0,
    };
    
    // 1. Get standard learning candidates (positive)
    const standardDataset = await learningCandidateService.getTrainingDataset(
      tenantId,
      Math.floor(maxCandidates * 0.6), // 60% from standard candidates
      Math.floor(maxTokens * 0.6)
    );
    
    for (const candidate of standardDataset.candidates) {
      const tokenCount = Math.ceil((candidate.promptText.length + candidate.responseText.length) / 4);
      positiveCandidates.push({
        candidateId: candidate.candidateId,
        candidateType: candidate.candidateType,
        source: candidate.correctionText ? 'correction' : 'explicit_rating',
        promptText: candidate.promptText,
        responseText: candidate.correctionText || candidate.responseText,
        correctionText: candidate.correctionText,
        qualityScore: candidate.qualityScore || 0.8,
        isNegative: false,
        tokenCount,
      });
      totalTokens += tokenCount;
      typeDistribution[candidate.candidateType] = (typeDistribution[candidate.candidateType] || 0) + 1;
      
      if (candidate.correctionText) {
        sourceDistribution.corrections++;
      } else {
        sourceDistribution.explicitRatings++;
      }
    }
    
    // 2. Get candidates from high-value conversations (if enabled)
    if (config?.conversationLearningEnabled) {
      const conversationCandidates = await this.getCandidatesFromConversations(
        tenantId,
        Math.floor(maxCandidates * 0.2), // 20% from conversations
        maxTokens - totalTokens
      );
      
      for (const candidate of conversationCandidates) {
        if (totalTokens + candidate.tokenCount > maxTokens) break;
        positiveCandidates.push(candidate);
        totalTokens += candidate.tokenCount;
        typeDistribution['conversation_learning'] = (typeDistribution['conversation_learning'] || 0) + 1;
        sourceDistribution.conversationLevel++;
      }
    }
    
    // 3. Get negative candidates for contrastive learning (if enabled)
    if (config?.negativeLearningEnabled) {
      const negatives = await this.getNegativeCandidates(
        tenantId,
        Math.floor(maxCandidates * 0.2), // 20% negative examples
        Math.floor(maxTokens * 0.2)
      );
      
      for (const candidate of negatives) {
        negativeCandidates.push(candidate);
        totalTokens += candidate.tokenCount;
        typeDistribution['negative_' + (candidate.candidateType || 'unknown')] = 
          (typeDistribution['negative_' + (candidate.candidateType || 'unknown')] || 0) + 1;
      }
    }
    
    return {
      positiveCandidates,
      negativeCandidates,
      totalCandidates: positiveCandidates.length + negativeCandidates.length,
      totalTokens,
      typeDistribution,
      sourceDistribution,
    };
  }
  
  /**
   * Get candidates from high-value conversations
   */
  private async getCandidatesFromConversations(
    tenantId: string,
    maxCandidates: number,
    maxTokens: number
  ): Promise<TrainingCandidate[]> {
    // Get messages from high-value conversations
    const result = await executeStatement(
      `SELECT 
         cl.conversation_id,
         cl.best_interaction_ids,
         cl.learning_value_score,
         cl.domains_discussed
       FROM conversation_learning cl
       WHERE cl.tenant_id = $1::uuid 
         AND cl.learning_value_score >= 0.7
         AND cl.selected_for_training = true
       ORDER BY cl.learning_value_score DESC
       LIMIT $2`,
      [stringParam('tenantId', tenantId), longParam('limit', maxCandidates)]
    );
    
    const candidates: TrainingCandidate[] = [];
    let tokenCount = 0;
    
    for (const row of result.rows || []) {
      const bestIds = row.best_interaction_ids as string[] || [];
      const domains = row.domains_discussed as string[] || [];
      
      // For each conversation, fetch actual message content
      for (const interactionId of bestIds.slice(0, 3)) { // Max 3 per conversation
        if (tokenCount >= maxTokens || candidates.length >= maxCandidates) break;
        
        // Fetch actual message content from messages table
        const messageResult = await executeStatement(
          `SELECT user_message, assistant_response, token_count 
           FROM interaction_messages 
           WHERE interaction_id = $1`,
          [{ name: 'interactionId', value: { stringValue: interactionId } }]
        );
        
        const msgRow = messageResult.rows?.[0] as Record<string, unknown> | undefined;
        const promptText = String(msgRow?.user_message || '');
        const responseText = String(msgRow?.assistant_response || '');
        const msgTokenCount = Number(msgRow?.token_count || 0);
        
        if (promptText || responseText) {
          tokenCount += msgTokenCount;
          candidates.push({
            candidateId: interactionId,
            candidateType: 'conversation_learning',
            source: 'conversation_learning',
            promptText,
            responseText,
            qualityScore: Number(row.learning_value_score || 0.7),
            isNegative: false,
            domain: domains[0],
            tokenCount: msgTokenCount,
          });
        }
      }
    }
    
    return candidates;
  }
  
  /**
   * Get negative candidates for contrastive learning
   */
  private async getNegativeCandidates(
    tenantId: string,
    maxCandidates: number,
    maxTokens: number
  ): Promise<TrainingCandidate[]> {
    const negatives = await enhancedLearningService.getNegativeCandidates(tenantId, {
      status: 'pending',
      limit: maxCandidates,
    });
    
    const candidates: TrainingCandidate[] = [];
    let totalTokens = 0;
    
    for (const neg of negatives) {
      const tokenCount = Math.ceil((neg.prompt.length + neg.response.length) / 4);
      if (totalTokens + tokenCount > maxTokens) break;
      
      candidates.push({
        candidateId: neg.id,
        candidateType: neg.errorCategory || 'negative_feedback',
        source: 'negative_feedback',
        promptText: neg.prompt,
        responseText: neg.response,
        correctionText: neg.correctedResponse,
        qualityScore: neg.qualityScore,
        isNegative: true,
        domain: neg.domain,
        tokenCount,
      });
      
      totalTokens += tokenCount;
    }
    
    return candidates;
  }
  
  /**
   * Prepare training data in the format needed for LoRA training
   * Includes both positive examples and negative examples for contrastive learning
   */
  prepareTrainingData(dataset: EnhancedTrainingDataset): string {
    const records: object[] = [];
    
    // Positive examples - learn to generate these
    for (const candidate of dataset.positiveCandidates) {
      if (!candidate.promptText || !candidate.responseText) continue;
      
      records.push({
        instruction: candidate.promptText,
        input: '',
        output: candidate.responseText,
        metadata: {
          candidateId: candidate.candidateId,
          type: candidate.candidateType,
          source: candidate.source,
          qualityScore: candidate.qualityScore,
          isPositive: true,
        },
      });
    }
    
    // Negative examples - for DPO or contrastive learning
    // Format: show the prompt, the bad response, and optionally the corrected response
    for (const candidate of dataset.negativeCandidates) {
      if (!candidate.promptText || !candidate.responseText) continue;
      
      if (candidate.correctionText) {
        // If we have a correction, create a preference pair
        records.push({
          instruction: candidate.promptText,
          input: '',
          output: candidate.correctionText, // Preferred output
          rejected: candidate.responseText,  // Rejected output
          metadata: {
            candidateId: candidate.candidateId,
            type: candidate.candidateType,
            source: candidate.source,
            qualityScore: candidate.qualityScore,
            isContrastive: true,
          },
        });
      } else {
        // No correction - just mark as negative example
        records.push({
          instruction: candidate.promptText,
          input: '',
          output: candidate.responseText,
          metadata: {
            candidateId: candidate.candidateId,
            type: candidate.candidateType,
            source: candidate.source,
            qualityScore: candidate.qualityScore,
            isNegative: true,
          },
        });
      }
    }
    
    return records.map(r => JSON.stringify(r)).join('\n');
  }
  
  /**
   * Mark enhanced learning candidates as used in training
   */
  async markCandidatesAsUsed(
    positiveCandidateIds: string[],
    negativeCandidateIds: string[],
    jobId: string
  ): Promise<void> {
    // Mark positive candidates
    if (positiveCandidateIds.length > 0) {
      await learningCandidateService.markAsQueued(positiveCandidateIds, jobId);
    }
    
    // Mark negative candidates
    if (negativeCandidateIds.length > 0) {
      await executeStatement(
        `UPDATE negative_learning_candidates 
         SET status = 'used_in_training', processed_at = NOW()
         WHERE id = ANY($1::uuid[])`,
        [stringParam('ids', `{${negativeCandidateIds.join(',')}}`)]
      );
    }
    
    logger.info('Marked candidates as used in training', {
      jobId,
      positiveCandidates: positiveCandidateIds.length,
      negativeCandidates: negativeCandidateIds.length,
    });
  }
  
  /**
   * Convert implicit signals to learning candidates
   * Run periodically to promote strong signals to training candidates
   */
  async promoteImplicitSignalsToCandidates(tenantId: string): Promise<number> {
    // Get strong positive signals that haven't been converted
    const result = await executeStatement(
      `SELECT DISTINCT ON (message_id)
         id, message_id, user_id, signal_type, inferred_quality, metadata
       FROM implicit_feedback_signals
       WHERE tenant_id = $1::uuid
         AND inferred_quality >= 0.75
         AND created_at >= NOW() - INTERVAL '7 days'
         AND message_id NOT IN (
           SELECT message_id FROM learning_candidates WHERE tenant_id = $1::uuid AND message_id IS NOT NULL
         )
       ORDER BY message_id, inferred_quality DESC
       LIMIT 100`,
      [stringParam('tenantId', tenantId)]
    );
    
    let promotedCount = 0;
    
    for (const row of result.rows || []) {
      try {
        // Fetch actual message content from messages/interactions table
        const messageContent = await this.fetchMessageContent(tenantId, row.message_id as string);
        
        if (!messageContent) {
          logger.debug('Message not found for signal', { messageId: row.message_id });
          continue;
        }
        
        // Create learning candidate from the signal
        await learningCandidateService.createCandidate({
          tenantId,
          userId: row.user_id as string,
          conversationId: row.message_id as string, // Use message_id as conversation reference
          messageId: row.message_id as string,
          candidateType: 'high_satisfaction' as CandidateType, // Map implicit signal to high_satisfaction
          promptText: messageContent.userMessage,
          responseText: messageContent.assistantResponse,
          qualityScore: row.inferred_quality as number,
        });
        
        // Mark signal as promoted
        await executeStatement(
          `UPDATE implicit_feedback_signals SET promoted_to_candidate = true WHERE id = $1::uuid`,
          [stringParam('id', row.id as string)]
        );
        
        promotedCount++;
      } catch (error) {
        logger.error('Failed to promote signal to candidate', { signalId: row.id, error });
      }
    }
    
    return promotedCount;
  }
  
  /**
   * Fetch message content from the messages/interactions table
   */
  private async fetchMessageContent(
    tenantId: string,
    messageId: string
  ): Promise<{ userMessage: string; assistantResponse: string; tokenCount: number } | null> {
    // Try interaction_messages table first
    const interactionResult = await executeStatement(
      `SELECT user_message, assistant_response, token_count 
       FROM interaction_messages 
       WHERE id = $1::uuid OR interaction_id = $1::uuid`,
      [stringParam('id', messageId)]
    );
    
    if (interactionResult.rows?.length) {
      const row = interactionResult.rows[0] as Record<string, unknown>;
      return {
        userMessage: String(row.user_message || ''),
        assistantResponse: String(row.assistant_response || ''),
        tokenCount: Number(row.token_count || 0),
      };
    }
    
    // Try messages table
    const messagesResult = await executeStatement(
      `SELECT content, role, token_count 
       FROM messages 
       WHERE id = $1::uuid OR conversation_id = (
         SELECT conversation_id FROM messages WHERE id = $1::uuid LIMIT 1
       )
       ORDER BY created_at`,
      [stringParam('id', messageId)]
    );
    
    if (messagesResult.rows?.length >= 2) {
      // Find user message and assistant response pair
      const userMsg = messagesResult.rows.find((r: Record<string, unknown>) => r.role === 'user');
      const assistantMsg = messagesResult.rows.find((r: Record<string, unknown>) => r.role === 'assistant');
      
      if (userMsg && assistantMsg) {
        return {
          userMessage: String(userMsg.content || ''),
          assistantResponse: String(assistantMsg.content || ''),
          tokenCount: Number(userMsg.token_count || 0) + Number(assistantMsg.token_count || 0),
        };
      }
    }
    
    // Try thinktank_messages table
    const thinktankResult = await executeStatement(
      `SELECT prompt, response, input_tokens, output_tokens 
       FROM thinktank_messages 
       WHERE id = $1::uuid`,
      [stringParam('id', messageId)]
    );
    
    if (thinktankResult.rows?.length) {
      const row = thinktankResult.rows[0] as Record<string, unknown>;
      return {
        userMessage: String(row.prompt || ''),
        assistantResponse: String(row.response || ''),
        tokenCount: Number(row.input_tokens || 0) + Number(row.output_tokens || 0),
      };
    }
    
    return null;
  }
  
  /**
   * Get training statistics for dashboard
   */
  async getTrainingStats(tenantId: string): Promise<{
    readyForTraining: boolean;
    positiveCandidates: number;
    negativeCandidates: number;
    implicitSignalsPending: number;
    highValueConversations: number;
    lastTrainingDate?: Date;
    nextScheduledTraining?: Date;
    estimatedTrainingTime: string;
  }> {
    const [shouldTrain, implicitCount, conversationCount, evolutionState] = await Promise.all([
      this.shouldTriggerTraining(tenantId),
      executeStatement(
        `SELECT COUNT(*) as count FROM implicit_feedback_signals 
         WHERE tenant_id = $1::uuid AND inferred_quality >= 0.75 AND created_at >= NOW() - INTERVAL '7 days'`,
        [stringParam('tenantId', tenantId)]
      ),
      executeStatement(
        `SELECT COUNT(*) as count FROM conversation_learning 
         WHERE tenant_id = $1::uuid AND learning_value_score >= 0.7 AND selected_for_training = true`,
        [stringParam('tenantId', tenantId)]
      ),
      executeStatement(
        `SELECT last_evolution_at, next_scheduled_evolution FROM consciousness_evolution_state WHERE tenant_id = $1::uuid`,
        [stringParam('tenantId', tenantId)]
      ),
    ]);
    
    const totalCandidates = shouldTrain.stats.positiveCandidates + shouldTrain.stats.negativeCandidates;
    
    return {
      readyForTraining: shouldTrain.shouldTrain,
      positiveCandidates: shouldTrain.stats.positiveCandidates,
      negativeCandidates: shouldTrain.stats.negativeCandidates,
      implicitSignalsPending: Number(implicitCount.rows?.[0]?.count || 0),
      highValueConversations: Number(conversationCount.rows?.[0]?.count || 0),
      lastTrainingDate: evolutionState.rows?.[0]?.last_evolution_at 
        ? new Date(evolutionState.rows[0].last_evolution_at as string) 
        : undefined,
      nextScheduledTraining: evolutionState.rows?.[0]?.next_scheduled_evolution
        ? new Date(evolutionState.rows[0].next_scheduled_evolution as string)
        : undefined,
      estimatedTrainingTime: totalCandidates < 100 ? '~30 minutes' : 
                            totalCandidates < 500 ? '~1 hour' : '~2 hours',
    };
  }
}

export const enhancedLearningIntegrationService = new EnhancedLearningIntegrationService();
