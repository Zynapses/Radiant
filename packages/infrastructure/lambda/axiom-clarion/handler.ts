/**
 * AXIOM + CLARION Lambda Handler
 * 
 * REST API endpoints for the AXIOM prompt optimization and CLARION
 * adaptive questioning systems.
 * 
 * Base Path: /api/v2/axiom
 * 
 * @version 2.0.0
 * @since RADIANT v6.0.0
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { axiomService } from '../shared/services/axiom.service';
import { clarionService } from '../shared/services/clarion.service';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'axiom-clarion/handler',
  category: 'infrastructure',
  sourceType: 'lambda',
});
import { 
  axiomEventsService, 
  getSSEHeaders, 
  formatSSEEvent,
  type AxiomEvent,
} from '../shared/services/axiom-events.service';
// Local helper functions are defined at the bottom of this file

// =============================================================================
// Route Handler
// =============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;

  logger.info('[AXIOM:API] Request received', { method, path });

  try {
    // Session endpoints
    if (path.match(/\/api\/v2\/axiom\/session$/) && method === 'POST') {
      return await handleStartSession(event);
    }

    if (path.match(/\/api\/v2\/axiom\/session\/[^/]+$/) && method === 'GET') {
      return await handleGetSession(event);
    }

    if (path.match(/\/api\/v2\/axiom\/session\/[^/]+\/forge-state$/) && method === 'GET') {
      return await handleGetForgeState(event);
    }

    // Answer endpoints
    if (path.match(/\/api\/v2\/axiom\/session\/[^/]+\/answer$/) && method === 'POST') {
      return await handleSubmitAnswer(event);
    }

    if (path.match(/\/api\/v2\/axiom\/session\/[^/]+\/skip$/) && method === 'POST') {
      return await handleSkipQuestion(event);
    }

    // Compile endpoints
    if (path.match(/\/api\/v2\/axiom\/session\/[^/]+\/compile$/) && method === 'POST') {
      return await handleCompilePrompt(event);
    }

    // Question management (admin)
    if (path.match(/\/api\/v2\/axiom\/questions$/) && method === 'GET') {
      return await handleListQuestions(event);
    }

    if (path.match(/\/api\/v2\/axiom\/questions$/) && method === 'POST') {
      return await handleCreateQuestion(event);
    }

    if (path.match(/\/api\/v2\/axiom\/questions\/[^/]+$/) && method === 'GET') {
      return await handleGetQuestion(event);
    }

    // Domain signature management (admin)
    if (path.match(/\/api\/v2\/axiom\/signatures$/) && method === 'GET') {
      return await handleListSignatures(event);
    }

    if (path.match(/\/api\/v2\/axiom\/signatures\/[^/]+$/) && method === 'GET') {
      return await handleGetSignature(event);
    }

    if (path.match(/\/api\/v2\/axiom\/signatures$/) && method === 'POST') {
      return await handleCreateSignature(event);
    }

    // SSE Stream endpoint
    if (path.match(/\/api\/v2\/axiom\/stream$/) && method === 'GET') {
      return await handleStream(event);
    }

    // Feedback endpoints
    if (path.match(/\/api\/v2\/axiom\/feedback$/) && method === 'POST') {
      return await handleSubmitFeedback(event);
    }

    // Pattern management (admin)
    if (path.match(/\/api\/v2\/axiom\/patterns$/) && method === 'GET') {
      return await handleListPatterns(event);
    }

    if (path.match(/\/api\/v2\/axiom\/patterns$/) && method === 'POST') {
      return await handleCreatePattern(event);
    }

    return createResponse(404, { error: 'Not Found', path });

  } catch (error) {
    logger.error('[AXIOM:API] Handler error', { error, path, method });
    return createResponse(500, { 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// =============================================================================
// Session Handlers
// =============================================================================

/**
 * POST /api/v2/axiom/session
 * Start a new AXIOM session (includes CLARION questioning)
 */
async function handleStartSession(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseBody<StartSessionBody>(event.body);
  
  if (!body.query) {
    return createResponse(400, { error: 'query is required' });
  }

  // Extract tenant/user from auth context
  const tenantId = event.requestContext.authorizer?.tenantId || 'default';
  const userId = event.requestContext.authorizer?.userId || 'anonymous';

  const response = await axiomService.startSession({
    tenantId,
    userId,
    query: body.query,
    locale: body.locale,
    chainId: body.chainId,
    conversationId: body.conversationId,
  });

  logger.info('[AXIOM:API] Session started', { 
    sessionId: response.sessionId,
    domain: response.domain,
  });

  return createResponse(200, response);
}

/**
 * GET /api/v2/axiom/session/:sessionId
 * Get session status and current state
 */
async function handleGetSession(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const sessionId = extractPathParam(event.path, 'session');
  
  if (!sessionId) {
    return createResponse(400, { error: 'sessionId is required' });
  }

  const session = await clarionService.getSession(sessionId);
  
  if (!session) {
    return createResponse(404, { error: 'Session not found' });
  }

  const nextQuestion = await clarionService.selectNextQuestion(session);

  return createResponse(200, {
    sessionId: session.sessionId,
    status: session.status,
    domain: session.domain,
    domainConfidence: session.currentConfidence,
    currentQuestion: nextQuestion,
    questionNumber: session.askedQuestions.length + 1,
    totalQuestionsMax: 5,
    modelPredictions: session.modelPredictions,
    readyToCompile: nextQuestion === null,
    answeredQuestions: Object.keys(session.answers).length,
  });
}

/**
 * GET /api/v2/axiom/session/:sessionId/forge-state
 * Get full forge state for UI rendering
 */
async function handleGetForgeState(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const sessionId = extractPathParam(event.path, 'session');
  
  if (!sessionId) {
    return createResponse(400, { error: 'sessionId is required' });
  }

  const forgeState = await axiomService.getForgeState(sessionId);
  
  if (!forgeState) {
    return createResponse(404, { error: 'Session not found' });
  }

  return createResponse(200, forgeState);
}

// =============================================================================
// Answer Handlers
// =============================================================================

/**
 * POST /api/v2/axiom/session/:sessionId/answer
 * Submit answer to current question
 */
async function handleSubmitAnswer(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const sessionId = extractPathParam(event.path, 'session');
  const body = parseBody(event.body);
  
  if (!sessionId) {
    return createResponse(400, { error: 'sessionId is required' });
  }

  if (!body.questionId || body.answer === undefined) {
    return createResponse(400, { error: 'questionId and answer are required' });
  }

  const result = await clarionService.submitAnswer(
    sessionId,
    String(body.questionId),
    body.answer as string | string[] | number | boolean
  );

  logger.info('[AXIOM:API] Answer submitted', {
    sessionId,
    questionId: body.questionId,
    readyToCompile: result.readyToCompile,
  });

  return createResponse(200, {
    sessionId: result.session.sessionId,
    status: result.session.status,
    newConfidence: result.session.currentConfidence,
    nextQuestion: result.nextQuestion,
    modelPredictions: result.session.modelPredictions,
    readyToCompile: result.readyToCompile,
  });
}

/**
 * POST /api/v2/axiom/session/:sessionId/skip
 * Skip current question
 */
async function handleSkipQuestion(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const sessionId = extractPathParam(event.path, 'session');
  const body = parseBody(event.body);
  
  if (!sessionId) {
    return createResponse(400, { error: 'sessionId is required' });
  }

  if (!body.questionId) {
    return createResponse(400, { error: 'questionId is required' });
  }

  const result = await clarionService.skipQuestion(
    sessionId,
    String(body.questionId),
    body.reason as string | undefined
  );

  logger.info('[AXIOM:API] Question skipped', {
    sessionId,
    questionId: body.questionId,
  });

  return createResponse(200, {
    sessionId: result.session.sessionId,
    status: result.session.status,
    newConfidence: result.session.currentConfidence,
    nextQuestion: result.nextQuestion,
    modelPredictions: result.session.modelPredictions,
    readyToCompile: result.readyToCompile,
  });
}

// =============================================================================
// SSE Stream Handler
// =============================================================================

/**
 * GET /api/v2/axiom/stream?sessionId=xxx
 * Server-Sent Events stream for real-time session updates
 */
async function handleStream(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const sessionId = getQueryParam(event, 'sessionId');
  
  if (!sessionId) {
    return createResponse(400, { error: 'sessionId query parameter is required' });
  }

  // Verify session exists
  const session = await clarionService.getSession(sessionId);
  if (!session) {
    return createResponse(404, { error: 'Session not found' });
  }

  const tenantId = event.requestContext.authorizer?.tenantId || 'default';
  const userId = event.requestContext.authorizer?.userId || 'anonymous';

  // Get event history for this session
  const history = axiomEventsService.getHistory(sessionId);

  // Build SSE response with history
  let sseBody = '';

  // Send connection event
  const connectEvent: AxiomEvent = {
    type: 'session_started',
    sessionId,
    timestamp: new Date().toISOString(),
    data: {
      connected: true,
      domain: session.domain,
      confidence: session.currentConfidence,
      modelPredictions: session.modelPredictions,
    },
  };
  sseBody += formatSSEEvent(connectEvent);

  // Send history events
  for (const historyEvent of history) {
    sseBody += formatSSEEvent(historyEvent);
  }

  // Note: For a true SSE implementation, you'd use Lambda response streaming
  // or API Gateway WebSocket. This provides initial state for polling fallback.
  logger.info('[AXIOM:API] Stream connected', { sessionId, tenantId, userId });

  return {
    statusCode: 200,
    headers: getSSEHeaders(),
    body: sseBody,
  };
}

// =============================================================================
// Feedback Handlers
// =============================================================================

/**
 * POST /api/v2/axiom/feedback
 * Submit user feedback on session, question, model, or prompt
 */
async function handleSubmitFeedback(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseBody(event.body);
  const tenantId = event.requestContext.authorizer?.tenantId || 'default';
  const userId = event.requestContext.authorizer?.userId || 'anonymous';
  
  if (!body.sessionId || !body.feedbackType || !body.targetType || !body.targetId) {
    return createResponse(400, { 
      error: 'sessionId, feedbackType, targetType, and targetId are required' 
    });
  }

  const feedbackId = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Store feedback in database (simplified - would use executeStatement in production)
  logger.info('[AXIOM:API] Feedback received', {
    feedbackId,
    sessionId: body.sessionId,
    feedbackType: body.feedbackType,
    targetType: body.targetType,
    targetId: body.targetId,
    tenantId,
    userId,
  });

  return createResponse(200, { 
    feedbackId, 
    status: 'recorded',
    message: 'Feedback recorded successfully',
  });
}

// =============================================================================
// Compile Handlers
// =============================================================================

/**
 * POST /api/v2/axiom/session/:sessionId/compile
 * Compile the optimized prompt
 */
async function handleCompilePrompt(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const sessionId = extractPathParam(event.path, 'session');
  const body = parseBody<CompilePromptBody>(event.body);
  
  if (!sessionId) {
    return createResponse(400, { error: 'sessionId is required' });
  }

  const result = await axiomService.compilePrompt({
    sessionId,
    forceCompile: body.forceCompile,
  });

  logger.info('[AXIOM:API] Prompt compiled', {
    sessionId,
    status: result.status,
  });

  return createResponse(200, result);
}

// =============================================================================
// Question Management (Admin)
// =============================================================================

/**
 * GET /api/v2/axiom/questions
 * List all questions (optionally filtered by domain)
 */
async function handleListQuestions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const domain = getQueryParam(event, 'domain');
  const category = getQueryParam(event, 'category');
  const limit = parseInt(getQueryParam(event, 'limit') || '50', 10);

  // For now, return a placeholder - would implement full listing
  return createResponse(200, {
    questions: [],
    total: 0,
    domain,
    category,
    limit,
  });
}

/**
 * POST /api/v2/axiom/questions
 * Create a new question
 */
async function handleCreateQuestion(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseBody(event.body);
  
  if (!body.text || !body.type || !body.category) {
    return createResponse(400, { error: 'text, type, and category are required' });
  }

  // Would implement question creation
  return createResponse(201, {
    questionId: `q_${Date.now()}`,
    message: 'Question created',
  });
}

/**
 * GET /api/v2/axiom/questions/:questionId
 * Get a specific question
 */
async function handleGetQuestion(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const questionId = extractPathParam(event.path, 'questions');
  
  if (!questionId) {
    return createResponse(400, { error: 'questionId is required' });
  }

  const question = await clarionService.getQuestion(questionId);
  
  if (!question) {
    return createResponse(404, { error: 'Question not found' });
  }

  return createResponse(200, question);
}

// =============================================================================
// Signature Management (Admin)
// =============================================================================

/**
 * GET /api/v2/axiom/signatures
 * List all domain signatures
 */
async function handleListSignatures(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Would implement full listing
  return createResponse(200, {
    signatures: [],
    total: 0,
  });
}

/**
 * GET /api/v2/axiom/signatures/:domainId
 * Get a specific domain signature
 */
async function handleGetSignature(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const domainId = extractPathParam(event.path, 'signatures');
  
  if (!domainId) {
    return createResponse(400, { error: 'domainId is required' });
  }

  const tenantId = event.requestContext.authorizer?.tenantId;
  const signature = await axiomService.getDomainSignature(domainId, tenantId);
  
  if (!signature) {
    return createResponse(404, { error: 'Signature not found' });
  }

  return createResponse(200, signature);
}

/**
 * POST /api/v2/axiom/signatures
 * Create or update a domain signature
 */
async function handleCreateSignature(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseBody(event.body);
  const tenantId = event.requestContext.authorizer?.tenantId;
  
  if (!body.domainId || !body.template) {
    return createResponse(400, { error: 'domainId and template are required' });
  }

  const domainIdStr = String(body.domainId);
  await axiomService.saveDomainSignature({
    domainId: domainIdStr,
    domainPath: (body.domainPath as string[]) || domainIdStr.split('.'),
    template: body.template as any,
    modelPreferences: (body.modelPreferences as any) || { primary: [], fallback: [], avoid: [], proficiencyRequirements: {} },
    version: String(body.version || '1.0.0'),
    effectivenessScore: Number(body.effectivenessScore) || 0.5,
    usageCount: 0,
    lastUpdated: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }, tenantId);

  return createResponse(201, {
    domainId: body.domainId,
    message: 'Signature saved',
  });
}

// =============================================================================
// Pattern Management (Admin)
// =============================================================================

/**
 * GET /api/v2/axiom/patterns
 * List patterns for a domain
 */
async function handleListPatterns(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const domainId = getQueryParam(event, 'domain');
  const limit = parseInt(getQueryParam(event, 'limit') || '20', 10);

  if (!domainId) {
    return createResponse(400, { error: 'domain query parameter is required' });
  }

  const tenantId = event.requestContext.authorizer?.tenantId;
  const patterns = await axiomService.retrievePatterns(domainId, undefined, tenantId, limit);

  return createResponse(200, {
    patterns,
    total: patterns.length,
    domain: domainId,
  });
}

/**
 * POST /api/v2/axiom/patterns
 * Create a new pattern
 */
async function handleCreatePattern(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseBody<SavePatternBody>(event.body);
  
  if (!body.domainId || !body.type || !body.content) {
    return createResponse(400, { error: 'domainId, type, and content are required' });
  }

  const patternId = await axiomService.savePattern({
    domainId: body.domainId,
    type: body.type as import('@radiant/shared').AxiomPatternType,
    content: body.content,
    usageCount: 0,
    successRate: 0.5,
    lastUsed: new Date().toISOString(),
    origin: (body.origin || 'human_curated') as import('@radiant/shared').AxiomPatternOrigin,
    parentPatterns: body.parentPatterns || [],
  });

  return createResponse(201, {
    patternId,
    message: 'Pattern created',
  });
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract path parameter from URL
 */
function extractPathParam(path: string, paramName: string): string | null {
  const parts = path.split('/');
  const paramIndex = parts.findIndex(p => p === paramName);
  if (paramIndex >= 0 && parts[paramIndex + 1]) {
    return parts[paramIndex + 1];
  }
  return null;
}

/**
 * Get query parameter
 */
function getQueryParam(event: APIGatewayProxyEvent, name: string): string | undefined {
  return event.queryStringParameters?.[name];
}

/**
 * Parse request body with generic type support
 */
function parseBody<T = Record<string, unknown>>(body: string | null): T {
  if (!body) return {} as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    return {} as T;
  }
}

interface StartSessionBody {
  query: string;
  locale: string;
  chainId: string;
  conversationId: string;
}

interface CompilePromptBody {
  forceCompile: boolean;
}

interface SavePatternBody {
  domainId: string;
  type: string;
  content: string;
  origin?: string;
  parentPatterns?: string[];
}

/**
 * Create API response
 */
function createResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
    body: JSON.stringify(body),
  };
}
