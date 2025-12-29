/**
 * RADIANT v4.18.0 - Provider Rejection Service
 * Handles AI provider rejections and intelligent fallback to alternative models
 */

import { v4 as uuidv4 } from 'uuid';
import { executeStatement, stringParam, boolParam } from '../db/client';
import { enhancedLogger } from './enhanced-logger.service';
import type {
  ProviderRejection,
  RejectionType,
  RejectionFinalStatus,
  FallbackAttempt,
  FallbackRecommendation,
  FallbackSelectionResult,
  RejectionHandlingResult,
  RejectionNotification,
  SuggestedAction,
  RejectionDisplayData,
  RejectionSummary,
  ModelRejectionStats,
  MIN_MODELS_FOR_TASK,
  MAX_FALLBACK_ATTEMPTS,
} from '@radiant/shared';

const logger = enhancedLogger;

// ============================================================================
// Provider Rejection Service
// ============================================================================

class ProviderRejectionService {
  private readonly minModelsForTask = 2;
  private readonly maxFallbackAttempts = 3;

  // ============================================================================
  // Record Rejection
  // ============================================================================

  async recordRejection(
    tenantId: string,
    userId: string,
    modelId: string,
    providerId: string,
    rejectionType: RejectionType,
    rejectionMessage?: string,
    planId?: string,
    promptHash?: string
  ): Promise<FallbackRecommendation> {
    logger.info('Recording provider rejection', {
      tenantId,
      userId,
      modelId,
      providerId,
      rejectionType,
    });

    const result = await executeStatement<Record<string, unknown>>(`
      SELECT * FROM record_provider_rejection(
        :tenant_id::UUID,
        :user_id::UUID,
        :model_id,
        :provider_id,
        :rejection_type,
        :rejection_message,
        :plan_id::UUID,
        :prompt_hash
      )
    `, [
      stringParam('tenant_id', tenantId),
      stringParam('user_id', userId),
      stringParam('model_id', modelId),
      stringParam('provider_id', providerId),
      stringParam('rejection_type', rejectionType),
      stringParam('rejection_message', rejectionMessage || ''),
      stringParam('plan_id', planId || ''),
      stringParam('prompt_hash', promptHash || ''),
    ]);

    const row = result.rows[0];
    return {
      rejectionId: String(row?.rejection_id || ''),
      recommendedFallbacks: (row?.recommended_fallbacks as string[]) || [],
      modelsToAvoid: (row?.models_to_avoid as string[]) || [],
      similarPatternId: row?.similar_pattern_id ? String(row.similar_pattern_id) : undefined,
    };
  }

  // ============================================================================
  // Select Fallback Model
  // ============================================================================

  async selectFallbackModel(
    tenantId: string,
    originalModelId: string,
    rejectionType: RejectionType,
    requiredCapabilities?: string[],
    excludeModels: string[] = [],
    preferLowRejectionRate = true
  ): Promise<FallbackSelectionResult> {
    logger.info('Selecting fallback model', {
      originalModelId,
      rejectionType,
      excludeCount: excludeModels.length,
    });

    // Get models with low rejection rates that aren't excluded
    const excludeList = [...excludeModels, originalModelId];
    
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT 
        m.model_id,
        m.provider_id,
        m.capabilities,
        COALESCE(s.rejection_rate, 0) as rejection_rate,
        COALESCE(s.total_requests, 0) as total_requests
      FROM unified_model_registry m
      LEFT JOIN model_rejection_stats s ON m.model_id = s.model_id
      WHERE m.enabled = true
        AND m.model_id != ALL(:exclude_models)
        ${requiredCapabilities?.length ? `AND m.capabilities && :required_caps` : ''}
      ORDER BY 
        COALESCE(s.rejection_rate, 0) ASC,
        COALESCE(s.total_requests, 0) DESC
      LIMIT 10
    `, [
      { name: 'exclude_models', value: { stringValue: JSON.stringify(excludeList) } },
      ...(requiredCapabilities?.length 
        ? [{ name: 'required_caps', value: { stringValue: JSON.stringify(requiredCapabilities) } }] 
        : []
      ),
    ]);

    if (result.rows.length === 0) {
      return {
        success: false,
        reason: 'No alternative models available',
        alternativesConsidered: 0,
        alternativesExcluded: excludeList.length,
        noModelsReason: 'All capable models have been tried or excluded',
      };
    }

    // Select the model with lowest rejection rate
    const selected = result.rows[0];
    
    return {
      success: true,
      selectedModelId: String(selected.model_id),
      selectedProviderId: String(selected.provider_id),
      reason: `Selected based on ${Number(selected.rejection_rate) * 100}% rejection rate`,
      alternativesConsidered: result.rows.length,
      alternativesExcluded: excludeList.length,
    };
  }

  // ============================================================================
  // Handle Rejection with Fallback
  // ============================================================================

  async handleRejectionWithFallback(
    tenantId: string,
    userId: string,
    originalModelId: string,
    providerId: string,
    rejectionType: RejectionType,
    rejectionMessage: string,
    executeWithModel: (modelId: string, providerId: string) => Promise<{ success: boolean; error?: string }>,
    planId?: string,
    requiredCapabilities?: string[]
  ): Promise<RejectionHandlingResult> {
    const fallbackChain: FallbackAttempt[] = [];
    const triedModels = new Set<string>([originalModelId]);
    
    // Record the initial rejection
    const recommendation = await this.recordRejection(
      tenantId,
      userId,
      originalModelId,
      providerId,
      rejectionType,
      rejectionMessage,
      planId
    );

    // Check if we passed our own ethics (if not, don't fallback)
    const ethicsCheck = await this.checkRadiantEthics(tenantId, rejectionMessage);
    if (!ethicsCheck.passed) {
      // Our ethics blocked it - reject to user
      await this.finalizeRejection(
        recommendation.rejectionId,
        'rejected',
        'This request was blocked by our ethical guidelines.',
        fallbackChain
      );
      
      const notificationId = await this.createUserNotification(
        recommendation.rejectionId,
        'Request Blocked',
        'This request could not be processed due to ethical guidelines.',
        ethicsCheck.reason,
        [{ action: 'rephrase', description: 'Try rephrasing your request' }]
      );

      return {
        success: false,
        usedFallback: false,
        fallbackChain,
        rejected: true,
        rejectionId: recommendation.rejectionId,
        rejectionReason: 'Blocked by RADIANT ethics',
        userFacingMessage: 'This request could not be processed due to ethical guidelines.',
        notificationId,
        modelsAttempted: 1,
        modelsRejected: 1,
        totalAvailableModels: 0,
      };
    }

    // Try fallback models
    let attempt = 0;
    while (attempt < this.maxFallbackAttempts) {
      attempt++;
      
      const fallback = await this.selectFallbackModel(
        tenantId,
        originalModelId,
        rejectionType,
        requiredCapabilities,
        Array.from(triedModels)
      );

      if (!fallback.success || !fallback.selectedModelId) {
        // No more models available
        break;
      }

      triedModels.add(fallback.selectedModelId);
      
      logger.info('Attempting fallback model', {
        attempt,
        modelId: fallback.selectedModelId,
        reason: fallback.reason,
      });

      // Try the fallback model
      const result = await executeWithModel(
        fallback.selectedModelId,
        fallback.selectedProviderId!
      );

      fallbackChain.push({
        modelId: fallback.selectedModelId,
        providerId: fallback.selectedProviderId!,
        attemptedAt: new Date().toISOString(),
        succeeded: result.success,
        failureReason: result.error,
      });

      if (result.success) {
        // Fallback succeeded!
        await this.recordFallbackResult(
          recommendation.rejectionId,
          fallback.selectedModelId,
          true,
          fallbackChain
        );

        return {
          success: true,
          handlingModelId: fallback.selectedModelId,
          handlingProviderId: fallback.selectedProviderId,
          usedFallback: true,
          fallbackChain,
          rejected: false,
          modelsAttempted: triedModels.size,
          modelsRejected: triedModels.size - 1,
          totalAvailableModels: fallback.alternativesConsidered,
        };
      }

      // This fallback also failed, record and continue
      await this.recordRejection(
        tenantId,
        userId,
        fallback.selectedModelId,
        fallback.selectedProviderId!,
        rejectionType,
        result.error || 'Fallback failed',
        planId
      );
    }

    // All fallbacks exhausted - reject to user
    const totalModels = await this.getTotalAvailableModels(tenantId, requiredCapabilities);
    const rejectedModels = triedModels.size;
    
    const userMessage = this.generateRejectionMessage(
      rejectionType,
      rejectedModels,
      totalModels
    );

    await this.finalizeRejection(
      recommendation.rejectionId,
      'rejected',
      userMessage,
      fallbackChain
    );

    const notificationId = await this.createUserNotification(
      recommendation.rejectionId,
      'Request Could Not Be Completed',
      userMessage,
      `We tried ${rejectedModels} AI models but none could process this request.`,
      this.getSuggestedActions(rejectionType)
    );

    return {
      success: false,
      usedFallback: true,
      fallbackChain,
      rejected: true,
      rejectionId: recommendation.rejectionId,
      rejectionReason: `All ${rejectedModels} capable models rejected this request`,
      userFacingMessage: userMessage,
      notificationId,
      modelsAttempted: rejectedModels,
      modelsRejected: rejectedModels,
      totalAvailableModels: totalModels,
    };
  }

  // ============================================================================
  // User Notifications
  // ============================================================================

  async getUserNotifications(
    userId: string,
    includeRead = false,
    limit = 20
  ): Promise<RejectionNotification[]> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT * FROM get_user_rejection_notifications(:user_id, :include_read, :limit)
    `, [
      stringParam('user_id', userId),
      boolParam('include_read', includeRead),
      { name: 'limit', value: { longValue: limit } },
    ]);

    return result.rows.map(row => ({
      id: String(row.notification_id),
      tenantId: '',
      userId,
      rejectionId: '',
      title: String(row.title),
      message: String(row.message),
      detailedReason: row.detailed_reason ? String(row.detailed_reason) : undefined,
      suggestedActions: (row.suggested_actions as SuggestedAction[]) || [],
      isRead: Boolean(row.is_read),
      isDismissed: false,
      rejectionType: row.rejection_type as RejectionType,
      modelId: row.model_id ? String(row.model_id) : undefined,
      finalStatus: row.final_status as RejectionFinalStatus,
      createdAt: new Date(row.created_at as string),
    }));
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    await executeStatement(`
      UPDATE user_rejection_notifications 
      SET is_read = true, read_at = NOW() 
      WHERE id = :id
    `, [stringParam('id', notificationId)]);
  }

  async dismissNotification(notificationId: string): Promise<void> {
    await executeStatement(`
      UPDATE user_rejection_notifications 
      SET is_dismissed = true, dismissed_at = NOW() 
      WHERE id = :id
    `, [stringParam('id', notificationId)]);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT COUNT(*) as count FROM user_rejection_notifications 
      WHERE user_id = :user_id AND is_read = false AND is_dismissed = false
    `, [stringParam('user_id', userId)]);
    
    return Number(result.rows[0]?.count || 0);
  }

  // ============================================================================
  // Think Tank Display Data
  // ============================================================================

  async getRejectionDisplayData(userId: string): Promise<RejectionDisplayData> {
    const notifications = await this.getUserNotifications(userId, false, 10);
    const unreadCount = await this.getUnreadCount(userId);

    return {
      hasRejections: notifications.length > 0,
      rejections: notifications.map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        rejectionType: n.rejectionType!,
        modelName: n.modelId || 'Unknown',
        providerName: '',
        finalStatus: n.finalStatus!,
        wasResolved: n.finalStatus === 'fallback_success' || n.finalStatus === 'user_modified',
        suggestedActions: n.suggestedActions,
        createdAt: n.createdAt,
      })),
      unreadCount,
    };
  }

  // ============================================================================
  // Model Rejection Stats
  // ============================================================================

  async getModelRejectionStats(): Promise<ModelRejectionStats[]> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT * FROM model_rejection_stats ORDER BY rejection_rate DESC LIMIT 50
    `, []);

    return result.rows.map(row => ({
      modelId: String(row.model_id),
      providerId: String(row.provider_id),
      totalRequests: Number(row.total_requests),
      totalRejections: Number(row.total_rejections),
      rejectionRate: Number(row.rejection_rate),
      contentPolicyCount: Number(row.content_policy_count),
      safetyFilterCount: Number(row.safety_filter_count),
      providerEthicsCount: Number(row.provider_ethics_count),
      otherCount: Number(row.other_count),
      fallbackAttempts: Number(row.fallback_attempts),
      fallbackSuccesses: Number(row.fallback_successes),
      lastRejectionAt: row.last_rejection_at ? new Date(row.last_rejection_at as string) : undefined,
    }));
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async checkRadiantEthics(
    tenantId: string,
    prompt: string
  ): Promise<{ passed: boolean; reason?: string }> {
    // Check against our ethical guardrails
    // This is a simplified check - integrate with ethicalGuardrailsService for full check
    const harmfulPatterns = [
      /how to (harm|kill|hurt|attack)/i,
      /create (weapon|bomb|virus)/i,
      /illegal (drug|activity)/i,
    ];

    for (const pattern of harmfulPatterns) {
      if (pattern.test(prompt)) {
        return { passed: false, reason: 'Content violates ethical guidelines' };
      }
    }

    return { passed: true };
  }

  private async recordFallbackResult(
    rejectionId: string,
    fallbackModelId: string,
    succeeded: boolean,
    fallbackChain: FallbackAttempt[]
  ): Promise<void> {
    await executeStatement(`
      SELECT record_fallback_result(:rejection_id::UUID, :fallback_model_id, :succeeded, :fallback_chain::JSONB)
    `, [
      stringParam('rejection_id', rejectionId),
      stringParam('fallback_model_id', fallbackModelId),
      boolParam('succeeded', succeeded),
      stringParam('fallback_chain', JSON.stringify(fallbackChain)),
    ]);
  }

  private async finalizeRejection(
    rejectionId: string,
    status: RejectionFinalStatus,
    userMessage: string,
    fallbackChain: FallbackAttempt[]
  ): Promise<void> {
    await executeStatement(`
      UPDATE provider_rejections SET
        final_status = :status,
        final_response_to_user = :message,
        fallback_chain = :chain::JSONB,
        resolved_at = NOW()
      WHERE id = :id
    `, [
      stringParam('id', rejectionId),
      stringParam('status', status),
      stringParam('message', userMessage),
      stringParam('chain', JSON.stringify(fallbackChain)),
    ]);
  }

  private async createUserNotification(
    rejectionId: string,
    title: string,
    message: string,
    detailedReason?: string,
    suggestedActions: SuggestedAction[] = []
  ): Promise<string> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT create_rejection_notification(
        :rejection_id::UUID,
        :title,
        :message,
        :detailed_reason,
        :suggested_actions::JSONB
      ) as notification_id
    `, [
      stringParam('rejection_id', rejectionId),
      stringParam('title', title),
      stringParam('message', message),
      stringParam('detailed_reason', detailedReason || ''),
      stringParam('suggested_actions', JSON.stringify(suggestedActions)),
    ]);

    return String(result.rows[0]?.notification_id || '');
  }

  private async getTotalAvailableModels(
    tenantId: string,
    requiredCapabilities?: string[]
  ): Promise<number> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT COUNT(*) as count FROM unified_model_registry 
      WHERE enabled = true
      ${requiredCapabilities?.length ? `AND capabilities && :caps` : ''}
    `, requiredCapabilities?.length 
      ? [{ name: 'caps', value: { stringValue: JSON.stringify(requiredCapabilities) } }]
      : []
    );

    return Number(result.rows[0]?.count || 0);
  }

  private generateRejectionMessage(
    rejectionType: RejectionType,
    modelsRejected: number,
    totalModels: number
  ): string {
    const baseMessages: Record<RejectionType, string> = {
      content_policy: 'This request was declined due to content policies across multiple AI providers.',
      safety_filter: 'Safety filters prevented this request from being processed.',
      provider_ethics: 'The ethical guidelines of available AI providers prevented this response.',
      capability_mismatch: 'No available models have the required capabilities for this request.',
      context_length: 'The request was too long for available models to process.',
      moderation: 'Content moderation blocked this request across providers.',
      rate_limit: 'Rate limits prevented this request - please try again shortly.',
      unknown: 'An unexpected error prevented this request from being processed.',
    };

    let message = baseMessages[rejectionType];
    
    if (modelsRejected > 1) {
      message += ` We attempted ${modelsRejected} different AI models.`;
    }

    return message;
  }

  private getSuggestedActions(rejectionType: RejectionType): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    if (['content_policy', 'safety_filter', 'moderation'].includes(rejectionType)) {
      actions.push({
        action: 'rephrase',
        description: 'Try rephrasing your request in a different way',
      });
      actions.push({
        action: 'remove_content',
        description: 'Remove potentially sensitive content from your request',
      });
    }

    if (rejectionType === 'context_length') {
      actions.push({
        action: 'simplify',
        description: 'Try shortening your request or breaking it into smaller parts',
      });
    }

    if (rejectionType === 'capability_mismatch') {
      actions.push({
        action: 'try_different_mode',
        description: 'Try a different orchestration mode that better matches your needs',
      });
    }

    actions.push({
      action: 'contact_admin',
      description: 'Contact your administrator if you believe this was blocked in error',
    });

    return actions;
  }
}

export const providerRejectionService = new ProviderRejectionService();
