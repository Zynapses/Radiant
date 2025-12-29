// RADIANT v4.18.0 - Admin API for Enhanced Learning System
// 8 Learning Improvements for Better User Experience
// ============================================================================

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { enhancedLearningService } from '../shared/services/enhanced-learning.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

const response = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers,
  body: JSON.stringify(body),
});

// ============================================================================
// Configuration Endpoints
// ============================================================================

/**
 * GET /admin/learning/config
 * Get enhanced learning configuration for tenant
 */
export const getConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const config = await enhancedLearningService.getConfig(tenantId);
    
    return response(200, { 
      success: true, 
      data: config,
      features: {
        implicitFeedback: config?.implicitFeedbackEnabled,
        negativeLearning: config?.negativeLearningEnabled,
        activeLearning: config?.activeLearningEnabled,
        domainAdapters: config?.domainAdaptersEnabled,
        patternCaching: config?.patternCachingEnabled,
        conversationLearning: config?.conversationLearningEnabled,
      }
    });
  } catch (error) {
    logger.error('Error fetching learning config', error);
    return response(500, { success: false, error: 'Failed to fetch learning config' });
  }
};

/**
 * PUT /admin/learning/config
 * Update enhanced learning configuration
 */
export const updateConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const updates = JSON.parse(event.body || '{}');
    
    const config = await enhancedLearningService.updateConfig(tenantId, updates);
    
    logger.info('Updated learning config', { tenantId, updates: Object.keys(updates) });
    
    return response(200, { success: true, data: config });
  } catch (error) {
    logger.error('Error updating learning config', error);
    return response(500, { success: false, error: 'Failed to update learning config' });
  }
};

// ============================================================================
// Implicit Feedback Endpoints
// ============================================================================

/**
 * POST /admin/learning/implicit-signals
 * Record an implicit feedback signal
 */
export const recordImplicitSignal: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const body = JSON.parse(event.body || '{}');
    
    const { userId, messageId, signalType, conversationId, signalValue, metadata } = body;
    
    if (!userId || !messageId || !signalType) {
      return response(400, { success: false, error: 'userId, messageId, and signalType are required' });
    }
    
    const signal = await enhancedLearningService.recordImplicitSignal(
      tenantId,
      userId,
      messageId,
      signalType,
      { conversationId, signalValue, metadata }
    );
    
    return response(200, { success: true, data: signal });
  } catch (error) {
    logger.error('Error recording implicit signal', error);
    return response(500, { success: false, error: 'Failed to record implicit signal' });
  }
};

/**
 * GET /admin/learning/implicit-signals
 * Get implicit feedback signals
 */
export const getImplicitSignals: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const messageId = event.queryStringParameters?.messageId;
    const userId = event.queryStringParameters?.userId;
    const limit = parseInt(event.queryStringParameters?.limit || '100', 10);
    
    const signals = await enhancedLearningService.getImplicitSignals(tenantId, { messageId, userId, limit });
    
    return response(200, { success: true, data: signals, count: signals.length });
  } catch (error) {
    logger.error('Error fetching implicit signals', error);
    return response(500, { success: false, error: 'Failed to fetch implicit signals' });
  }
};

// ============================================================================
// Negative Learning Endpoints
// ============================================================================

/**
 * POST /admin/learning/negative-candidates
 * Create a negative learning candidate
 */
export const createNegativeCandidate: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const body = JSON.parse(event.body || '{}');
    
    const { userId, prompt, response: resp, domain, rating, negativeSignals, userFeedback, correctedResponse, errorCategory } = body;
    
    if (!userId || !prompt || !resp) {
      return response(400, { success: false, error: 'userId, prompt, and response are required' });
    }
    
    const candidate = await enhancedLearningService.createNegativeCandidate(tenantId, userId, {
      prompt,
      response: resp,
      domain,
      rating,
      negativeSignals,
      userFeedback,
      correctedResponse,
      errorCategory,
    });
    
    return response(200, { success: true, data: candidate });
  } catch (error) {
    logger.error('Error creating negative candidate', error);
    return response(500, { success: false, error: 'Failed to create negative candidate' });
  }
};

/**
 * GET /admin/learning/negative-candidates
 * Get negative learning candidates
 */
export const getNegativeCandidates: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const status = event.queryStringParameters?.status;
    const domain = event.queryStringParameters?.domain;
    const limit = parseInt(event.queryStringParameters?.limit || '100', 10);
    
    const candidates = await enhancedLearningService.getNegativeCandidates(tenantId, { status, domain, limit });
    
    return response(200, { success: true, data: candidates, count: candidates.length });
  } catch (error) {
    logger.error('Error fetching negative candidates', error);
    return response(500, { success: false, error: 'Failed to fetch negative candidates' });
  }
};

// ============================================================================
// Active Learning Endpoints
// ============================================================================

/**
 * POST /admin/learning/active-learning/check
 * Check if feedback should be requested
 */
export const checkShouldRequestFeedback: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const body = JSON.parse(event.body || '{}');
    
    const { modelConfidence, isNewDomain, isComplexQuery, recentFeedbackCount } = body;
    
    const result = await enhancedLearningService.shouldRequestFeedback(tenantId, {
      modelConfidence,
      isNewDomain,
      isComplexQuery,
      recentFeedbackCount,
    });
    
    return response(200, { success: true, data: result });
  } catch (error) {
    logger.error('Error checking feedback request', error);
    return response(500, { success: false, error: 'Failed to check feedback request' });
  }
};

/**
 * POST /admin/learning/active-learning/request
 * Create an active learning request
 */
export const createActiveLearningRequest: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const body = JSON.parse(event.body || '{}');
    
    const { userId, messageId, reason, requestType, conversationId, modelConfidence, uncertaintyScore, customPrompt } = body;
    
    if (!userId || !messageId || !reason || !requestType) {
      return response(400, { success: false, error: 'userId, messageId, reason, and requestType are required' });
    }
    
    const request = await enhancedLearningService.createActiveLearningRequest(
      tenantId,
      userId,
      messageId,
      reason,
      requestType,
      { conversationId, modelConfidence, uncertaintyScore, customPrompt }
    );
    
    return response(200, { success: true, data: request });
  } catch (error) {
    logger.error('Error creating active learning request', error);
    return response(500, { success: false, error: 'Failed to create active learning request' });
  }
};

/**
 * POST /admin/learning/active-learning/{requestId}/respond
 * Record response to active learning request
 */
export const recordActiveLearningResponse: APIGatewayProxyHandler = async (event) => {
  try {
    const requestId = event.pathParameters?.requestId;
    const body = JSON.parse(event.body || '{}');
    
    if (!requestId) {
      return response(400, { success: false, error: 'requestId is required' });
    }
    
    const request = await enhancedLearningService.recordActiveLearningResponse(requestId, body);
    
    return response(200, { success: true, data: request });
  } catch (error) {
    logger.error('Error recording active learning response', error);
    return response(500, { success: false, error: 'Failed to record response' });
  }
};

/**
 * GET /admin/learning/active-learning/pending
 * Get pending active learning requests for user
 */
export const getPendingActiveLearning: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const userId = event.queryStringParameters?.userId;
    
    if (!userId) {
      return response(400, { success: false, error: 'userId is required' });
    }
    
    const requests = await enhancedLearningService.getPendingActiveLearningRequests(tenantId, userId);
    
    return response(200, { success: true, data: requests, count: requests.length });
  } catch (error) {
    logger.error('Error fetching pending active learning', error);
    return response(500, { success: false, error: 'Failed to fetch pending requests' });
  }
};

// ============================================================================
// Domain Adapters Endpoints
// ============================================================================

/**
 * GET /admin/learning/domain-adapters
 * List domain-specific LoRA adapters
 */
export const listDomainAdapters: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const domain = event.queryStringParameters?.domain;
    const status = event.queryStringParameters?.status;
    
    const adapters = await enhancedLearningService.listDomainAdapters(tenantId, { domain, status });
    
    return response(200, { success: true, data: adapters, count: adapters.length });
  } catch (error) {
    logger.error('Error listing domain adapters', error);
    return response(500, { success: false, error: 'Failed to list domain adapters' });
  }
};

/**
 * GET /admin/learning/domain-adapters/{domain}
 * Get active adapter for domain
 */
export const getActiveAdapter: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const domain = event.pathParameters?.domain;
    const subdomain = event.queryStringParameters?.subdomain;
    
    if (!domain) {
      return response(400, { success: false, error: 'domain is required' });
    }
    
    const adapter = await enhancedLearningService.getActiveAdapter(tenantId, domain, subdomain);
    
    return response(200, { success: true, data: adapter });
  } catch (error) {
    logger.error('Error fetching active adapter', error);
    return response(500, { success: false, error: 'Failed to fetch active adapter' });
  }
};

// ============================================================================
// Pattern Cache Endpoints
// ============================================================================

/**
 * POST /admin/learning/pattern-cache
 * Cache a successful pattern
 */
export const cachePattern: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const body = JSON.parse(event.body || '{}');
    
    const { prompt, response: resp, domain, rating, modelUsed, temperatureUsed, metadata } = body;
    
    if (!prompt || !resp || rating === undefined) {
      return response(400, { success: false, error: 'prompt, response, and rating are required' });
    }
    
    const entry = await enhancedLearningService.cacheSuccessfulPattern(tenantId, prompt, resp, {
      domain,
      rating,
      modelUsed,
      temperatureUsed,
      metadata,
    });
    
    return response(200, { success: true, data: entry });
  } catch (error) {
    logger.error('Error caching pattern', error);
    return response(500, { success: false, error: 'Failed to cache pattern' });
  }
};

/**
 * GET /admin/learning/pattern-cache/lookup
 * Look up cached pattern
 */
export const lookupPattern: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const prompt = event.queryStringParameters?.prompt;
    
    if (!prompt) {
      return response(400, { success: false, error: 'prompt is required' });
    }
    
    const entry = await enhancedLearningService.findCachedPattern(tenantId, prompt);
    
    return response(200, { 
      success: true, 
      data: entry,
      cacheHit: entry !== null,
    });
  } catch (error) {
    logger.error('Error looking up pattern', error);
    return response(500, { success: false, error: 'Failed to lookup pattern' });
  }
};

// ============================================================================
// Conversation Learning Endpoints
// ============================================================================

/**
 * POST /admin/learning/conversations
 * Start tracking conversation learning
 */
export const startConversationLearning: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const body = JSON.parse(event.body || '{}');
    
    const { userId, conversationId } = body;
    
    if (!userId || !conversationId) {
      return response(400, { success: false, error: 'userId and conversationId are required' });
    }
    
    const learning = await enhancedLearningService.startConversationLearning(tenantId, userId, conversationId);
    
    return response(200, { success: true, data: learning });
  } catch (error) {
    logger.error('Error starting conversation learning', error);
    return response(500, { success: false, error: 'Failed to start conversation learning' });
  }
};

/**
 * PUT /admin/learning/conversations/{conversationId}
 * Update conversation learning
 */
export const updateConversationLearning: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const conversationId = event.pathParameters?.conversationId;
    const body = JSON.parse(event.body || '{}');
    
    if (!conversationId) {
      return response(400, { success: false, error: 'conversationId is required' });
    }
    
    const learning = await enhancedLearningService.updateConversationLearning(tenantId, conversationId, body);
    
    return response(200, { success: true, data: learning });
  } catch (error) {
    logger.error('Error updating conversation learning', error);
    return response(500, { success: false, error: 'Failed to update conversation learning' });
  }
};

/**
 * POST /admin/learning/conversations/{conversationId}/end
 * End conversation and calculate learning value
 */
export const endConversation: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const conversationId = event.pathParameters?.conversationId;
    
    if (!conversationId) {
      return response(400, { success: false, error: 'conversationId is required' });
    }
    
    const learning = await enhancedLearningService.endConversation(tenantId, conversationId);
    
    return response(200, { 
      success: true, 
      data: learning,
      selectedForTraining: learning?.selectedForTraining || false,
    });
  } catch (error) {
    logger.error('Error ending conversation', error);
    return response(500, { success: false, error: 'Failed to end conversation' });
  }
};

/**
 * GET /admin/learning/conversations/{conversationId}
 * Get conversation learning data
 */
export const getConversationLearning: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const conversationId = event.pathParameters?.conversationId;
    
    if (!conversationId) {
      return response(400, { success: false, error: 'conversationId is required' });
    }
    
    const learning = await enhancedLearningService.getConversationLearning(tenantId, conversationId);
    
    return response(200, { success: true, data: learning });
  } catch (error) {
    logger.error('Error fetching conversation learning', error);
    return response(500, { success: false, error: 'Failed to fetch conversation learning' });
  }
};

/**
 * GET /admin/learning/conversations/high-value
 * Get high-value conversations for training
 */
export const getHighValueConversations: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
    
    const conversations = await enhancedLearningService.getHighValueConversations(tenantId, limit);
    
    return response(200, { success: true, data: conversations, count: conversations.length });
  } catch (error) {
    logger.error('Error fetching high-value conversations', error);
    return response(500, { success: false, error: 'Failed to fetch high-value conversations' });
  }
};

// ============================================================================
// Analytics Endpoints
// ============================================================================

/**
 * GET /admin/learning/analytics
 * Get learning analytics
 */
export const getAnalytics: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const periodDays = parseInt(event.queryStringParameters?.days || '7', 10);
    
    const analytics = await enhancedLearningService.getLearningAnalytics(tenantId, periodDays);
    
    return response(200, { success: true, data: analytics });
  } catch (error) {
    logger.error('Error fetching learning analytics', error);
    return response(500, { success: false, error: 'Failed to fetch analytics' });
  }
};

// ============================================================================
// Optimal Training Time Endpoints
// ============================================================================

/**
 * GET /admin/learning/optimal-time
 * Get predicted optimal training time based on historical activity
 */
export const getOptimalTrainingTime: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    
    const [prediction, effectiveTime, activityStats] = await Promise.all([
      enhancedLearningService.predictOptimalTrainingTime(tenantId),
      enhancedLearningService.getEffectiveTrainingTime(tenantId),
      enhancedLearningService.getHourlyActivityStats(tenantId),
    ]);
    
    // Find low activity windows
    const lowActivityWindows = activityStats
      .filter(s => s.isLowActivityWindow)
      .map(s => ({ hourUtc: s.hourUtc, dayOfWeek: s.dayOfWeek, activityScore: s.activityScore }));
    
    return response(200, {
      success: true,
      data: {
        prediction,
        effectiveTime,
        lowActivityWindows,
        activityHeatmap: activityStats,
      },
    });
  } catch (error) {
    logger.error('Error fetching optimal training time', error);
    return response(500, { success: false, error: 'Failed to fetch optimal training time' });
  }
};

/**
 * POST /admin/learning/optimal-time/override
 * Admin override for training time (disables auto-optimal)
 */
export const overrideTrainingTime: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const body = JSON.parse(event.body || '{}');
    
    const { hourUtc, dayOfWeek, useAutoOptimal } = body;
    
    if (useAutoOptimal === true) {
      // Enable auto-optimal
      await enhancedLearningService.updateConfig(tenantId, {
        autoOptimalTime: true,
        trainingHourUtc: null,
      });
    } else if (hourUtc !== undefined) {
      // Set manual time
      await enhancedLearningService.updateConfig(tenantId, {
        autoOptimalTime: false,
        trainingHourUtc: hourUtc,
        trainingDayOfWeek: dayOfWeek ?? 0,
      });
    } else {
      return response(400, { success: false, error: 'Either useAutoOptimal or hourUtc is required' });
    }
    
    const effectiveTime = await enhancedLearningService.getEffectiveTrainingTime(tenantId);
    
    logger.info('Training time override', { tenantId, useAutoOptimal, hourUtc, dayOfWeek });
    
    return response(200, { success: true, data: effectiveTime });
  } catch (error) {
    logger.error('Error overriding training time', error);
    return response(500, { success: false, error: 'Failed to override training time' });
  }
};

/**
 * GET /admin/learning/activity-stats
 * Get hourly activity statistics for training time optimization
 */
export const getActivityStats: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    
    const stats = await enhancedLearningService.getHourlyActivityStats(tenantId);
    
    // Group by hour for heatmap visualization
    const byHour: Record<number, { avgActivity: number; lowestDay: number }> = {};
    for (let h = 0; h < 24; h++) {
      const hourStats = stats.filter(s => s.hourUtc === h);
      if (hourStats.length > 0) {
        const avgActivity = hourStats.reduce((sum, s) => sum + s.activityScore, 0) / hourStats.length;
        const lowestDay = hourStats.reduce((min, s) => s.activityScore < min.activityScore ? s : min, hourStats[0]);
        byHour[h] = { avgActivity, lowestDay: lowestDay.dayOfWeek };
      }
    }
    
    return response(200, {
      success: true,
      data: {
        raw: stats,
        byHour,
        totalSamples: stats.reduce((sum, s) => sum + 1, 0),
      },
    });
  } catch (error) {
    logger.error('Error fetching activity stats', error);
    return response(500, { success: false, error: 'Failed to fetch activity stats' });
  }
};

/**
 * GET /admin/learning/dashboard
 * Get complete learning dashboard data
 */
export const getDashboard: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    
    const [config, analytics, highValueConversations, domainAdapters] = await Promise.all([
      enhancedLearningService.getConfig(tenantId),
      enhancedLearningService.getLearningAnalytics(tenantId, 7),
      enhancedLearningService.getHighValueConversations(tenantId, 10),
      enhancedLearningService.listDomainAdapters(tenantId, { status: 'active' }),
    ]);
    
    return response(200, {
      success: true,
      data: {
        config,
        analytics,
        highValueConversations,
        domainAdapters,
        features: {
          implicitFeedback: { enabled: config?.implicitFeedbackEnabled, description: 'Captures copy, share, abandon signals' },
          negativeLearning: { enabled: config?.negativeLearningEnabled, description: 'Learns from negative feedback' },
          activeLearning: { enabled: config?.activeLearningEnabled, description: 'Proactively requests feedback' },
          domainAdapters: { enabled: config?.domainAdaptersEnabled, description: 'Domain-specific LoRA training' },
          patternCaching: { enabled: config?.patternCachingEnabled, description: 'Caches successful responses' },
          conversationLearning: { enabled: config?.conversationLearningEnabled, description: 'Learns from full conversations' },
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching learning dashboard', error);
    return response(500, { success: false, error: 'Failed to fetch dashboard' });
  }
};
