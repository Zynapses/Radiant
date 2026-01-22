// RADIANT v4.18.0 - Think Tank User Context API
// Exposes user persistent context to Think Tank UI
// Allows users to view, manage, and benefit from persistent context

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { userPersistentContextService, type UserContextType } from '../shared/services/user-persistent-context.service';
import { executeStatement } from '../shared/db/client';
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
// GET /thinktank/user-context
// Get user's persistent context entries
// ============================================================================
export const getUserContext: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId;
    const userId = event.requestContext.authorizer?.userId;
    
    if (!tenantId || !userId) {
      return response(401, { success: false, error: 'Unauthorized' });
    }
    
    const types = event.queryStringParameters?.types?.split(',') as UserContextType[] | undefined;
    const minImportance = event.queryStringParameters?.minImportance 
      ? parseFloat(event.queryStringParameters.minImportance) 
      : undefined;
    const limit = event.queryStringParameters?.limit 
      ? parseInt(event.queryStringParameters.limit, 10) 
      : 50;
    
    const entries = await userPersistentContextService.getUserContext(tenantId, userId, {
      types,
      minImportance,
      limit,
    });
    
    const summary = await userPersistentContextService.getContextSummary(tenantId, userId);
    
    return response(200, { 
      success: true, 
      data: {
        entries,
        summary,
      }
    });
  } catch (error) {
    logger.error('Error fetching user context', error);
    return response(500, { success: false, error: 'Failed to fetch user context' });
  }
};

// ============================================================================
// POST /thinktank/user-context
// Add a new context entry
// ============================================================================
export const addUserContext: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId;
    const userId = event.requestContext.authorizer?.userId;
    
    if (!tenantId || !userId) {
      return response(401, { success: false, error: 'Unauthorized' });
    }
    
    const body = JSON.parse(event.body || '{}');
    const { contextType, content, importance } = body;
    
    if (!contextType || !content) {
      return response(400, { success: false, error: 'contextType and content are required' });
    }
    
    const validTypes: UserContextType[] = [
      'fact', 'preference', 'instruction', 'relationship', 
      'project', 'skill', 'history', 'correction'
    ];
    
    if (!validTypes.includes(contextType)) {
      return response(400, { 
        success: false, 
        error: `Invalid contextType. Must be one of: ${validTypes.join(', ')}` 
      });
    }
    
    const entryId = await (userPersistentContextService as any).createContext(
      tenantId,
      userId,
      contextType,
      content,
      {
        importance: importance || 0.8,
        confidence: 1.0, // User-provided = high confidence
        source: 'explicit',
      }
    );
    
    return response(201, { 
      success: true, 
      data: { entryId },
      message: 'Context added successfully'
    });
  } catch (error) {
    logger.error('Error adding user context', error);
    return response(500, { success: false, error: 'Failed to add user context' });
  }
};

// ============================================================================
// PUT /thinktank/user-context/{entryId}
// Update a context entry
// ============================================================================
export const updateUserContext: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId;
    const userId = event.requestContext.authorizer?.userId;
    const entryId = event.pathParameters?.entryId;
    
    if (!tenantId || !userId) {
      return response(401, { success: false, error: 'Unauthorized' });
    }
    
    if (!entryId) {
      return response(400, { success: false, error: 'Entry ID required' });
    }
    
    const body = JSON.parse(event.body || '{}');
    const { content, importance } = body;
    
    const updates: { content?: string; importance?: number; confidence?: number } = {};
    if (content !== undefined) updates.content = content;
    if (importance !== undefined) updates.importance = importance;
    if (content !== undefined) updates.confidence = 1.0; // User edited = high confidence
    
    await userPersistentContextService.updateContext(entryId, updates);
    
    return response(200, { success: true, message: 'Context updated' });
  } catch (error) {
    logger.error('Error updating user context', error);
    return response(500, { success: false, error: 'Failed to update user context' });
  }
};

// ============================================================================
// DELETE /thinktank/user-context/{entryId}
// Delete a context entry
// ============================================================================
export const deleteUserContext: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId;
    const userId = event.requestContext.authorizer?.userId;
    const entryId = event.pathParameters?.entryId;
    
    if (!tenantId || !userId) {
      return response(401, { success: false, error: 'Unauthorized' });
    }
    
    if (!entryId) {
      return response(400, { success: false, error: 'Entry ID required' });
    }
    
    await userPersistentContextService.deleteContext(entryId, userId);
    
    return response(200, { success: true, message: 'Context deleted' });
  } catch (error) {
    logger.error('Error deleting user context', error);
    return response(500, { success: false, error: 'Failed to delete user context' });
  }
};

// ============================================================================
// GET /thinktank/user-context/summary
// Get context summary for user
// ============================================================================
export const getContextSummary: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId;
    const userId = event.requestContext.authorizer?.userId;
    
    if (!tenantId || !userId) {
      return response(401, { success: false, error: 'Unauthorized' });
    }
    
    const summary = await userPersistentContextService.getContextSummary(tenantId, userId);
    
    return response(200, { success: true, data: summary });
  } catch (error) {
    logger.error('Error fetching context summary', error);
    return response(500, { success: false, error: 'Failed to fetch context summary' });
  }
};

// ============================================================================
// POST /thinktank/user-context/retrieve
// Retrieve relevant context for a prompt (for debugging/preview)
// ============================================================================
export const retrieveContext: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId;
    const userId = event.requestContext.authorizer?.userId;
    
    if (!tenantId || !userId) {
      return response(401, { success: false, error: 'Unauthorized' });
    }
    
    const body = JSON.parse(event.body || '{}');
    const { prompt, conversationHistory, maxEntries, minRelevance } = body;
    
    if (!prompt) {
      return response(400, { success: false, error: 'prompt is required' });
    }
    
    const context = await userPersistentContextService.retrieveContextForPrompt(
      tenantId,
      userId,
      prompt,
      conversationHistory,
      { maxEntries, minRelevance }
    );
    
    return response(200, { success: true, data: context });
  } catch (error) {
    logger.error('Error retrieving context', error);
    return response(500, { success: false, error: 'Failed to retrieve context' });
  }
};

// ============================================================================
// GET /thinktank/user-context/preferences
// Get user's context preferences
// ============================================================================
export const getPreferences: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId;
    const userId = event.requestContext.authorizer?.userId;
    
    if (!tenantId || !userId) {
      return response(401, { success: false, error: 'Unauthorized' });
    }
    
    const result = await executeStatement(
      `SELECT * FROM user_context_preferences WHERE tenant_id = $1 AND user_id = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );
    
    if (result.rows.length === 0) {
      // Return defaults
      return response(200, { 
        success: true, 
        data: {
          autoLearnEnabled: true,
          minConfidenceThreshold: 0.7,
          maxContextEntries: 100,
          contextInjectionEnabled: true,
          allowedContextTypes: ['fact', 'preference', 'instruction', 'relationship', 'project', 'skill', 'history', 'correction'],
        }
      });
    }
    
    const row = result.rows[0] as Record<string, unknown>;
    return response(200, { 
      success: true, 
      data: {
        autoLearnEnabled: row.auto_learn_enabled,
        minConfidenceThreshold: Number(row.min_confidence_threshold),
        maxContextEntries: Number(row.max_context_entries),
        contextInjectionEnabled: row.context_injection_enabled,
        allowedContextTypes: row.allowed_context_types,
      }
    });
  } catch (error) {
    logger.error('Error fetching preferences', error);
    return response(500, { success: false, error: 'Failed to fetch preferences' });
  }
};

// ============================================================================
// PUT /thinktank/user-context/preferences
// Update user's context preferences
// ============================================================================
export const updatePreferences: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId;
    const userId = event.requestContext.authorizer?.userId;
    
    if (!tenantId || !userId) {
      return response(401, { success: false, error: 'Unauthorized' });
    }
    
    const body = JSON.parse(event.body || '{}');
    const { 
      autoLearnEnabled, 
      minConfidenceThreshold, 
      maxContextEntries,
      contextInjectionEnabled,
      allowedContextTypes 
    } = body;
    
    await executeStatement(
      `INSERT INTO user_context_preferences (
        tenant_id, user_id, auto_learn_enabled, min_confidence_threshold,
        max_context_entries, context_injection_enabled, allowed_context_types
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (tenant_id, user_id) DO UPDATE SET
        auto_learn_enabled = COALESCE($3, user_context_preferences.auto_learn_enabled),
        min_confidence_threshold = COALESCE($4, user_context_preferences.min_confidence_threshold),
        max_context_entries = COALESCE($5, user_context_preferences.max_context_entries),
        context_injection_enabled = COALESCE($6, user_context_preferences.context_injection_enabled),
        allowed_context_types = COALESCE($7, user_context_preferences.allowed_context_types),
        updated_at = NOW()`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'autoLearn', value: autoLearnEnabled !== undefined ? { booleanValue: autoLearnEnabled } : { isNull: true } },
        { name: 'minConfidence', value: minConfidenceThreshold !== undefined ? { doubleValue: minConfidenceThreshold } : { isNull: true } },
        { name: 'maxEntries', value: maxContextEntries !== undefined ? { longValue: maxContextEntries } : { isNull: true } },
        { name: 'injection', value: contextInjectionEnabled !== undefined ? { booleanValue: contextInjectionEnabled } : { isNull: true } },
        { name: 'allowedTypes', value: allowedContextTypes !== undefined ? { stringValue: `{${allowedContextTypes.join(',')}}` } : { isNull: true } },
      ]
    );
    
    return response(200, { success: true, message: 'Preferences updated' });
  } catch (error) {
    logger.error('Error updating preferences', error);
    return response(500, { success: false, error: 'Failed to update preferences' });
  }
};

// ============================================================================
// POST /thinktank/user-context/extract
// Manually trigger context extraction from a conversation
// ============================================================================
export const extractFromConversation: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId;
    const userId = event.requestContext.authorizer?.userId;
    
    if (!tenantId || !userId) {
      return response(401, { success: false, error: 'Unauthorized' });
    }
    
    const body = JSON.parse(event.body || '{}');
    const { conversationId, messages } = body;
    
    if (!conversationId || !messages || !Array.isArray(messages)) {
      return response(400, { success: false, error: 'conversationId and messages array required' });
    }
    
    const result = await userPersistentContextService.extractContextFromConversation(
      tenantId,
      userId,
      conversationId,
      messages
    );
    
    // Log extraction
    await executeStatement(
      `INSERT INTO user_context_extraction_log (tenant_id, user_id, conversation_id, extracted_count, corrections_count, extraction_result)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'conversationId', value: { stringValue: conversationId } },
        { name: 'extractedCount', value: { longValue: result.extracted.length } },
        { name: 'correctionsCount', value: { longValue: result.corrections.length } },
        { name: 'result', value: { stringValue: JSON.stringify(result) } },
      ]
    );
    
    return response(200, { 
      success: true, 
      data: result,
      message: `Extracted ${result.extracted.length} context entries, ${result.corrections.length} corrections`
    });
  } catch (error) {
    logger.error('Error extracting context', error);
    return response(500, { success: false, error: 'Failed to extract context' });
  }
};

// ============================================================================
// Main Handler - Routes requests to appropriate function
// ============================================================================
export const handler = async (event: Parameters<APIGatewayProxyHandler>[0]): Promise<APIGatewayProxyResult> => {
  const path = event.path;
  const method = event.httpMethod;

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (path.includes('/extract') && method === 'POST') {
    return extractFromConversation(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (path.includes('/preferences') && method === 'PUT') {
    return updatePreferences(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (path.includes('/preferences') && method === 'GET') {
    return getPreferences(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (path.match(/\/[^/]+$/) && method === 'DELETE') {
    return deleteUserContext(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (path.match(/\/[^/]+$/) && method === 'PUT') {
    return updateUserContext(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (method === 'POST') {
    return (userPersistentContextService as any).createContext(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
  }
  if (method === 'GET') {
    return getUserContext(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
  }

  return response(404, { error: 'Not found' });
};
