/**
 * RADIANT v4.18.0 - Delight System API Handler
 * API endpoints for Think Tank personality and delight features
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult, APIGatewayProxyEvent } from 'aws-lambda';
import { delightService } from '../shared/services/delight.service';
import { successResponse, errorResponse, noContentResponse, createdResponse, DEFAULT_CORS_HEADERS } from '../shared/middleware/api-response';
import { toRadiantError } from '../shared/errors/radiant-error';
import { enhancedLogger } from '../shared/logging/enhanced-logger';

// Helper to extract auth context from event headers
function extractAuthContext(event: APIGatewayProxyEvent): { userId?: string; tenantId?: string; isAdmin?: boolean } {
  const tenantId = event.headers['X-Tenant-ID'] || event.headers['x-tenant-id'] || '';
  const userId = event.headers['X-User-ID'] || event.headers['x-user-id'] || '';
  const isAdmin = event.headers['X-Admin'] === 'true' || event.requestContext?.authorizer?.isAdmin === true;
  return { userId: userId || undefined, tenantId: tenantId || undefined, isAdmin };
}

// Simple response helper
function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: DEFAULT_CORS_HEADERS,
    body: body === null ? '' : JSON.stringify(body),
  };
}

// Error handler
function handleError(error: unknown): APIGatewayProxyResult {
  const radiantError = toRadiantError(error);
  return errorResponse(radiantError);
}

const logger = enhancedLogger;

// ============================================================================
// User-Facing Endpoints
// ============================================================================

/**
 * GET /api/delight/message
 * Get a delight message for a specific injection point
 */
export const getMessage: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    if (!auth.userId || !auth.tenantId) {
      return response(401, { error: 'Unauthorized' });
    }

    const { injectionPoint, triggerType, domainFamily, timeContext } = event.queryStringParameters || {};
    
    if (!injectionPoint || !triggerType) {
      return response(400, { error: 'Missing required parameters: injectionPoint, triggerType' });
    }

    const options = domainFamily || timeContext ? { domainFamily, timeContext: timeContext as 'morning' | 'afternoon' | 'evening' | 'night' | 'weekend' | 'holiday' | 'long_session' | 'very_late' | 'returning' | undefined } : undefined;
    const result = await delightService.getDelightMessage(
      injectionPoint as 'pre_execution' | 'during_execution' | 'post_execution',
      triggerType as 'domain_loading' | 'domain_transition' | 'time_aware' | 'model_dynamics' | 'complexity_signals' | 'synthesis_quality' | 'achievement' | 'wellbeing' | 'easter_egg',
      auth.userId,
      auth.tenantId,
      options
    );

    return response(200, result);
  } catch (error) {
    logger.error('Failed to get delight message', { error });
    return handleError(error);
  }
};

/**
 * POST /api/delight/orchestration-messages
 * Get delight messages for an orchestration context
 */
export const getOrchestrationMessages: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    if (!auth.userId || !auth.tenantId) {
      return response(401, { error: 'Unauthorized' });
    }

    const context = JSON.parse(event.body || '{}');
    
    const result = await delightService.getMessagesForOrchestration(
      context,
      auth.userId,
      auth.tenantId
    );

    return response(200, { messages: result });
  } catch (error) {
    logger.error('Failed to get orchestration messages', { error });
    return handleError(error);
  }
};

/**
 * GET /api/delight/preferences
 * Get user's delight preferences
 */
export const getPreferences: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    if (!auth.userId || !auth.tenantId) {
      return response(401, { error: 'Unauthorized' });
    }

    const preferences = await delightService.getUserPreferences(auth.userId, auth.tenantId);
    return response(200, preferences);
  } catch (error) {
    logger.error('Failed to get delight preferences', { error });
    return handleError(error);
  }
};

/**
 * PUT /api/delight/preferences
 * Update user's delight preferences
 */
export const updatePreferences: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    if (!auth.userId || !auth.tenantId) {
      return response(401, { error: 'Unauthorized' });
    }

    const updates = JSON.parse(event.body || '{}');
    const preferences = await delightService.updateUserPreferences(auth.userId, auth.tenantId, updates);
    return response(200, preferences);
  } catch (error) {
    logger.error('Failed to update delight preferences', { error });
    return handleError(error);
  }
};

/**
 * GET /api/delight/achievements
 * Get user's achievements
 */
export const getAchievements: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    if (!auth.userId || !auth.tenantId) {
      return response(401, { error: 'Unauthorized' });
    }

    const achievements = await delightService.getUserAchievements(auth.userId, auth.tenantId);
    return response(200, { achievements });
  } catch (error) {
    logger.error('Failed to get achievements', { error });
    return handleError(error);
  }
};

/**
 * POST /api/delight/achievements/progress
 * Record achievement progress
 */
export const recordProgress: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    if (!auth.userId || !auth.tenantId) {
      return response(401, { error: 'Unauthorized' });
    }

    const { achievementType, incrementValue } = JSON.parse(event.body || '{}');
    
    if (!achievementType) {
      return response(400, { error: 'Missing required parameter: achievementType' });
    }

    const result = await delightService.recordAchievementProgress(
      auth.userId,
      auth.tenantId,
      achievementType,
      incrementValue || 1
    );

    return response(200, result);
  } catch (error) {
    logger.error('Failed to record achievement progress', { error });
    return handleError(error);
  }
};

/**
 * POST /api/delight/easter-egg
 * Trigger an easter egg
 */
export const triggerEasterEgg: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    if (!auth.userId || !auth.tenantId) {
      return response(401, { error: 'Unauthorized' });
    }

    const { triggerType, triggerValue } = JSON.parse(event.body || '{}');
    
    if (!triggerType || !triggerValue) {
      return response(400, { error: 'Missing required parameters: triggerType, triggerValue' });
    }

    const result = await delightService.triggerEasterEgg(
      auth.userId,
      auth.tenantId,
      triggerType,
      triggerValue
    );

    return response(200, result);
  } catch (error) {
    logger.error('Failed to trigger easter egg', { error });
    return handleError(error);
  }
};

// ============================================================================
// Admin Endpoints
// ============================================================================

/**
 * GET /api/admin/delight/categories
 * Get all delight categories
 */
export const getCategories: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    if (!auth.isAdmin) {
      return response(403, { error: 'Admin access required' });
    }

    const categories = await delightService.getAllCategories();
    return response(200, { categories });
  } catch (error) {
    logger.error('Failed to get categories', { error });
    return handleError(error);
  }
};

/**
 * GET /api/admin/delight/messages
 * Get all delight messages
 */
export const getMessages: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    if (!auth.isAdmin) {
      return response(403, { error: 'Admin access required' });
    }

    const { categoryId, injectionPoint } = event.queryStringParameters || {};
    const messages = await delightService.getAllMessages({
      categoryId,
      injectionPoint: injectionPoint as 'pre_execution' | 'during_execution' | 'post_execution' | undefined,
    });
    return response(200, { messages });
  } catch (error) {
    logger.error('Failed to get messages', { error });
    return handleError(error);
  }
};

/**
 * POST /api/admin/delight/messages
 * Create a new delight message
 */
export const createMessage: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    if (!auth.isAdmin) {
      return response(403, { error: 'Admin access required' });
    }

    const message = JSON.parse(event.body || '{}');
    const created = await delightService.createMessage(message);
    return response(201, created);
  } catch (error) {
    logger.error('Failed to create message', { error });
    return handleError(error);
  }
};

/**
 * PUT /api/admin/delight/messages/:id
 * Update a delight message
 */
export const updateMessage: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    if (!auth.isAdmin) {
      return response(403, { error: 'Admin access required' });
    }

    const id = parseInt(event.pathParameters?.id || '0');
    const updates = JSON.parse(event.body || '{}');
    
    await delightService.updateMessage(id, updates);
    return response(200, { success: true });
  } catch (error) {
    logger.error('Failed to update message', { error });
    return handleError(error);
  }
};

/**
 * DELETE /api/admin/delight/messages/:id
 * Delete a delight message
 */
export const deleteMessage: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    if (!auth.isAdmin) {
      return response(403, { error: 'Admin access required' });
    }

    const id = parseInt(event.pathParameters?.id || '0');
    await delightService.deleteMessage(id);
    return response(204, null);
  } catch (error) {
    logger.error('Failed to delete message', { error });
    return handleError(error);
  }
};

/**
 * PATCH /api/admin/delight/categories/:id
 * Toggle category enabled status
 */
export const toggleCategory: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    if (!auth.isAdmin) {
      return response(403, { error: 'Admin access required' });
    }

    const id = event.pathParameters?.id || '';
    const { isEnabled } = JSON.parse(event.body || '{}');
    
    await delightService.toggleCategory(id, isEnabled);
    return response(200, { success: true });
  } catch (error) {
    logger.error('Failed to toggle category', { error });
    return handleError(error);
  }
};

/**
 * GET /api/admin/delight/achievements
 * Get all achievements
 */
export const getAllAchievements: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    if (!auth.isAdmin) {
      return response(403, { error: 'Admin access required' });
    }

    const achievements = await delightService.getAllAchievements();
    return response(200, { achievements });
  } catch (error) {
    logger.error('Failed to get achievements', { error });
    return handleError(error);
  }
};

/**
 * GET /api/admin/delight/easter-eggs
 * Get all easter eggs
 */
export const getEasterEggs: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    if (!auth.isAdmin) {
      return response(403, { error: 'Admin access required' });
    }

    const easterEggs = await delightService.getAllEasterEggs();
    return response(200, { easterEggs });
  } catch (error) {
    logger.error('Failed to get easter eggs', { error });
    return handleError(error);
  }
};

/**
 * GET /api/admin/delight/sounds
 * Get all sounds
 */
export const getSounds: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    if (!auth.isAdmin) {
      return response(403, { error: 'Admin access required' });
    }

    const sounds = await delightService.getAllSounds();
    return response(200, { sounds });
  } catch (error) {
    logger.error('Failed to get sounds', { error });
    return handleError(error);
  }
};

/**
 * GET /api/admin/delight/analytics
 * Get delight system analytics
 */
export const getAnalytics: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    if (!auth.isAdmin || !auth.tenantId) {
      return response(403, { error: 'Admin access required' });
    }

    const analytics = await delightService.getDelightAnalytics(auth.tenantId);
    return response(200, analytics);
  } catch (error) {
    logger.error('Failed to get analytics', { error });
    return handleError(error);
  }
};

/**
 * GET /api/admin/delight/dashboard
 * Get complete dashboard data
 */
export const getDashboard: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    if (!auth.isAdmin || !auth.tenantId) {
      return response(403, { error: 'Admin access required' });
    }

    const [categories, messages, achievements, easterEggs, sounds, analytics] = await Promise.all([
      delightService.getAllCategories(),
      delightService.getAllMessages(),
      delightService.getAllAchievements(),
      delightService.getAllEasterEggs(),
      delightService.getAllSounds(),
      delightService.getDelightAnalytics(auth.tenantId),
    ]);

    return response(200, {
      categories,
      messages,
      achievements,
      easterEggs,
      sounds,
      analytics,
      summary: {
        totalMessages: messages.length,
        enabledMessages: messages.filter(m => m.isEnabled).length,
        totalAchievements: achievements.length,
        totalEasterEggs: easterEggs.length,
        totalSounds: sounds.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get dashboard', { error });
    return handleError(error);
  }
};

/**
 * GET /api/admin/delight/statistics
 * Get detailed usage statistics
 */
export const getStatistics: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    if (!auth.isAdmin || !auth.tenantId) {
      return response(403, { error: 'Admin access required' });
    }

    const statistics = await delightService.getDetailedStatistics(auth.tenantId);
    return response(200, statistics);
  } catch (error) {
    logger.error('Failed to get statistics', { error });
    return handleError(error);
  }
};

/**
 * GET /api/admin/delight/user-engagement
 * Get user engagement leaderboard
 */
export const getUserEngagement: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = extractAuthContext(event);
    if (!auth.isAdmin || !auth.tenantId) {
      return response(403, { error: 'Admin access required' });
    }

    const limit = parseInt(event.queryStringParameters?.limit || '50');
    const engagement = await delightService.getUserEngagement(auth.tenantId, limit);
    return response(200, { engagement });
  } catch (error) {
    logger.error('Failed to get user engagement', { error });
    return handleError(error);
  }
};
