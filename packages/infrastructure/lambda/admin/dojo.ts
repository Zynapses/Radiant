/**
 * Aurelius Dojo Admin API Lambda Handler
 * Admin endpoints for the Thematic Mastery Training Platform
 * 
 * Base Path: /api/admin/dojo
 * 
 * Routes:
 *   Libraries:     GET/POST /libraries/:tenantId, GET /libraries/:libraryId/documents, POST /libraries/:libraryId/documents (upload),
 *                  DELETE /libraries/:libraryId/documents/:documentId, POST /libraries/:libraryId/discover-themes, GET /libraries/:libraryId/themes
 *   Sessions:      POST /sessions/:tenantId, GET /sessions/:sessionId, GET /sessions/:sessionId/lesson,
 *                  POST /sessions/:sessionId/lesson/next, GET /sessions/:sessionId/spar, POST /sessions/:sessionId/spar/answer,
 *                  POST /sessions/:sessionId/complete
 *   Progress:      GET /progress/:tenantId/:userId, GET /progress/:tenantId/:userId/themes/:themeId
 *   Certifications: POST /certifications/:tenantId/start, GET /certifications/:tenantId/:userId
 *   Mobot:         POST /mobot/:sessionId, GET /mobot/:sessionId/history
 *   Config:        GET/PUT /config/:tenantId
 *   Decay:         GET /decay/:tenantId/:userId/dashboard, GET /decay/:tenantId/:userId/curves,
 *                  POST /decay/:tenantId/:userId/reinforce, POST /decay/reinforce/:reinforcementId/answer
 *   Scenarios:     POST /scenarios/:sessionId/start, POST /scenarios/:scenarioId/respond, POST /scenarios/:scenarioId/conclude
 *   Competencies:  POST /competencies/:libraryId/extract, GET /competencies/:tenantId/:userId/:libraryId/mesh,
 *                  GET /competencies/:tenantId/:libraryId/team
 *   Dialectic:     POST /dialectic/:sessionId/start, POST /dialectic/:dialecticId/respond, POST /dialectic/:dialecticId/conclude
 *   Multimodal:    GET /multimodal/:lessonId, POST /multimodal/:lessonId/generate
 *   Pulse:         GET /pulse/:tenantId, GET /pulse/:tenantId/history
 *   Archytas:      GET/PUT /archytas/:tenantId/config, POST /archytas/:sessionId/invoke,
 *                  POST /archytas/:sessionId/suggest, GET /archytas/:sessionId/summary
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement, stringParam, longParam } from '../shared/db/client';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'admin/dojo',
  category: 'audit',
  sourceType: 'lambda',
});

// =============================================================================
// Types
// =============================================================================

interface RequestContext {
  tenantId: string;
  userId: string;
  isAdmin: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

const response = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-Id',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  },
  body: JSON.stringify(body),
});

const success = (data: unknown) => response(200, { success: true, ...( typeof data === 'object' && data !== null ? data : { data }) });
const created = (data: unknown) => response(201, { success: true, ...( typeof data === 'object' && data !== null ? data : { data }) });
const badRequest = (message: string) => response(400, { success: false, error: { code: 'BAD_REQUEST', message } });
const unauthorized = () => response(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
const notFound = (message: string) => response(404, { success: false, error: { code: 'NOT_FOUND', message } });
const serverError = (message: string) => response(500, { success: false, error: { code: 'SERVER_ERROR', message } });

const getContext = (event: any): RequestContext | null => {
  const tenantId = event.requestContext?.authorizer?.tenantId || event.headers?.['x-tenant-id'];
  const userId = event.requestContext?.authorizer?.userId || event.headers?.['x-user-id'];
  const isAdmin = event.requestContext?.authorizer?.isAdmin === true;
  if (!tenantId || !userId) return null;
  return { tenantId, userId, isAdmin };
};

const parseBody = <T>(event: any): T | null => {
  try {
    return event.body ? JSON.parse(event.body) : null;
  } catch {
    return null;
  }
};

const extractPathParam = (path: string, pattern: RegExp): string | null => {
  const match = path.match(pattern);
  return match ? match[1] : null;
};

// =============================================================================
// Handler
// =============================================================================

export const handler: APIGatewayProxyHandler = async (event) => {
  const method = event.httpMethod;
  const path = event.path.replace(/^\/api\/admin\/dojo/, '');

  logger.info('Dojo API request', { method, path });

  if (method === 'OPTIONS') {
    return response(200, '');
  }

  const ctx = getContext(event);
  if (!ctx) return unauthorized();

  try {
    // ── Libraries ─────────────────────────────────────────────────────────
    if (path.match(/^\/libraries\/[^/]+$/) && method === 'GET') {
      const tenantId = extractPathParam(path, /^\/libraries\/([^/]+)$/);
      return await handleGetLibraries(ctx, tenantId!);
    }
    if (path.match(/^\/libraries\/[^/]+$/) && method === 'POST') {
      const tenantId = extractPathParam(path, /^\/libraries\/([^/]+)$/);
      const body = parseBody<{ name: string; description: string }>(event);
      if (!body?.name) return badRequest('name is required');
      return await handleCreateLibrary(ctx, tenantId!, body);
    }
    if (path.match(/^\/libraries\/[^/]+\/documents$/) && method === 'GET') {
      const libraryId = extractPathParam(path, /^\/libraries\/([^/]+)\/documents$/);
      return await handleGetDocuments(ctx, libraryId!);
    }
    if (path.match(/^\/libraries\/[^/]+\/documents$/) && method === 'POST') {
      const libraryId = extractPathParam(path, /^\/libraries\/([^/]+)\/documents$/);
      return await handleUploadDocument(ctx, libraryId!, event);
    }
    if (path.match(/^\/libraries\/[^/]+\/documents\/[^/]+$/) && method === 'DELETE') {
      const match = path.match(/^\/libraries\/([^/]+)\/documents\/([^/]+)$/);
      return await handleDeleteDocument(ctx, match![1], match![2]);
    }
    if (path.match(/^\/libraries\/[^/]+\/discover-themes$/) && method === 'POST') {
      const libraryId = extractPathParam(path, /^\/libraries\/([^/]+)\/discover-themes$/);
      return await handleDiscoverThemes(ctx, libraryId!);
    }
    if (path.match(/^\/libraries\/[^/]+\/themes$/) && method === 'GET') {
      const libraryId = extractPathParam(path, /^\/libraries\/([^/]+)\/themes$/);
      return await handleGetThemes(ctx, libraryId!);
    }

    // ── Sessions ──────────────────────────────────────────────────────────
    if (path.match(/^\/sessions\/[^/]+$/) && method === 'POST') {
      const tenantId = extractPathParam(path, /^\/sessions\/([^/]+)$/);
      const body = parseBody<{ library_id: string; theme_ids: string[]; mode: string }>(event);
      if (!body?.library_id || !body?.mode) return badRequest('library_id and mode are required');
      return await handleStartSession(ctx, tenantId!, body);
    }
    if (path.match(/^\/sessions\/[^/]+$/) && method === 'GET') {
      const sessionId = extractPathParam(path, /^\/sessions\/([^/]+)$/);
      return await handleGetSession(ctx, sessionId!);
    }
    if (path.match(/^\/sessions\/[^/]+\/lesson$/) && method === 'GET') {
      const sessionId = extractPathParam(path, /^\/sessions\/([^/]+)\/lesson$/);
      return await handleGetLessonBlocks(ctx, sessionId!);
    }
    if (path.match(/^\/sessions\/[^/]+\/lesson\/next$/) && method === 'POST') {
      const sessionId = extractPathParam(path, /^\/sessions\/([^/]+)\/lesson\/next$/);
      return await handleNextLesson(ctx, sessionId!);
    }
    if (path.match(/^\/sessions\/[^/]+\/spar$/) && method === 'GET') {
      const sessionId = extractPathParam(path, /^\/sessions\/([^/]+)\/spar$/);
      return await handleGetSparringQuestion(ctx, sessionId!);
    }
    if (path.match(/^\/sessions\/[^/]+\/spar\/answer$/) && method === 'POST') {
      const sessionId = extractPathParam(path, /^\/sessions\/([^/]+)\/spar\/answer$/);
      const body = parseBody<{ question_id: string; answer: string; time_taken_seconds: number }>(event);
      if (!body?.question_id || !body?.answer) return badRequest('question_id and answer are required');
      return await handleSubmitSparringAnswer(ctx, sessionId!, body);
    }
    if (path.match(/^\/sessions\/[^/]+\/complete$/) && method === 'POST') {
      const sessionId = extractPathParam(path, /^\/sessions\/([^/]+)\/complete$/);
      return await handleCompleteSession(ctx, sessionId!);
    }

    // ── Progress ──────────────────────────────────────────────────────────
    if (path.match(/^\/progress\/[^/]+\/[^/]+\/themes\/[^/]+$/) && method === 'GET') {
      const match = path.match(/^\/progress\/([^/]+)\/([^/]+)\/themes\/([^/]+)$/);
      return await handleGetThemeProgress(ctx, match![1], match![2], match![3]);
    }
    if (path.match(/^\/progress\/[^/]+\/[^/]+$/) && method === 'GET') {
      const match = path.match(/^\/progress\/([^/]+)\/([^/]+)$/);
      return await handleGetProgress(ctx, match![1], match![2]);
    }

    // ── Certifications ────────────────────────────────────────────────────
    if (path.match(/^\/certifications\/[^/]+\/start$/) && method === 'POST') {
      const tenantId = extractPathParam(path, /^\/certifications\/([^/]+)\/start$/);
      const body = parseBody<{ theme_id: string; user_id: string }>(event);
      if (!body?.theme_id || !body?.user_id) return badRequest('theme_id and user_id are required');
      return await handleStartCertExam(ctx, tenantId!, body);
    }
    if (path.match(/^\/certifications\/[^/]+\/[^/]+$/) && method === 'GET') {
      const match = path.match(/^\/certifications\/([^/]+)\/([^/]+)$/);
      return await handleGetCertifications(ctx, match![1], match![2]);
    }

    // ── Mobot ─────────────────────────────────────────────────────────────
    if (path.match(/^\/mobot\/[^/]+\/history$/) && method === 'GET') {
      const sessionId = extractPathParam(path, /^\/mobot\/([^/]+)\/history$/);
      return await handleGetMobotHistory(ctx, sessionId!);
    }
    if (path.match(/^\/mobot\/[^/]+$/) && method === 'POST') {
      const sessionId = extractPathParam(path, /^\/mobot\/([^/]+)$/);
      const body = parseBody<{ message: string; context?: any }>(event);
      if (!body?.message) return badRequest('message is required');
      return await handleSendMobotMessage(ctx, sessionId!, body);
    }

    // ── Config ────────────────────────────────────────────────────────────
    if (path.match(/^\/config\/[^/]+$/) && method === 'GET') {
      const tenantId = extractPathParam(path, /^\/config\/([^/]+)$/);
      return await handleGetConfig(ctx, tenantId!);
    }
    if (path.match(/^\/config\/[^/]+$/) && method === 'PUT') {
      const tenantId = extractPathParam(path, /^\/config\/([^/]+)$/);
      const body = parseBody<Record<string, any>>(event);
      return await handleUpdateConfig(ctx, tenantId!, body || {});
    }

    // ── Decay Engine ──────────────────────────────────────────────────────
    if (path.match(/^\/decay\/[^/]+\/[^/]+\/dashboard$/) && method === 'GET') {
      const match = path.match(/^\/decay\/([^/]+)\/([^/]+)\/dashboard$/);
      return await handleGetDecayDashboard(ctx, match![1], match![2]);
    }
    if (path.match(/^\/decay\/[^/]+\/[^/]+\/curves$/) && method === 'GET') {
      const match = path.match(/^\/decay\/([^/]+)\/([^/]+)\/curves$/);
      const themeId = event.queryStringParameters?.theme_id;
      return await handleGetDecayCurves(ctx, match![1], match![2], themeId);
    }
    if (path.match(/^\/decay\/[^/]+\/[^/]+\/reinforce$/) && method === 'POST') {
      const match = path.match(/^\/decay\/([^/]+)\/([^/]+)\/reinforce$/);
      const body = parseBody<{ mode: string }>(event);
      return await handleTriggerReinforcement(ctx, match![1], match![2], body?.mode || 'manual');
    }
    if (path.match(/^\/decay\/reinforce\/[^/]+\/answer$/) && method === 'POST') {
      const reinforcementId = extractPathParam(path, /^\/decay\/reinforce\/([^/]+)\/answer$/);
      const body = parseBody<{ atom_id: string; answer: any }>(event);
      if (!body?.atom_id) return badRequest('atom_id is required');
      return await handleSubmitReinforcementAnswer(ctx, reinforcementId!, body);
    }

    // ── Scenarios ─────────────────────────────────────────────────────────
    if (path.match(/^\/scenarios\/[^/]+\/start$/) && method === 'POST') {
      const sessionId = extractPathParam(path, /^\/scenarios\/([^/]+)\/start$/);
      const body = parseBody<{ theme_ids: string[]; archetype?: string; difficulty?: number }>(event);
      return await handleStartScenario(ctx, sessionId!, body || {});
    }
    if (path.match(/^\/scenarios\/[^/]+\/respond$/) && method === 'POST') {
      const scenarioId = extractPathParam(path, /^\/scenarios\/([^/]+)\/respond$/);
      const body = parseBody<{ response: string }>(event);
      if (!body?.response) return badRequest('response is required');
      return await handleRespondToScenario(ctx, scenarioId!, body.response);
    }
    if (path.match(/^\/scenarios\/[^/]+\/conclude$/) && method === 'POST') {
      const scenarioId = extractPathParam(path, /^\/scenarios\/([^/]+)\/conclude$/);
      return await handleConcludeScenario(ctx, scenarioId!);
    }

    // ── Competencies ──────────────────────────────────────────────────────
    if (path.match(/^\/competencies\/[^/]+\/extract$/) && method === 'POST') {
      const libraryId = extractPathParam(path, /^\/competencies\/([^/]+)\/extract$/);
      return await handleExtractCompetencies(ctx, libraryId!);
    }
    if (path.match(/^\/competencies\/[^/]+\/[^/]+\/[^/]+\/mesh$/) && method === 'GET') {
      const match = path.match(/^\/competencies\/([^/]+)\/([^/]+)\/([^/]+)\/mesh$/);
      return await handleGetCompetencyMesh(ctx, match![1], match![2], match![3]);
    }
    if (path.match(/^\/competencies\/[^/]+\/[^/]+\/team$/) && method === 'GET') {
      const match = path.match(/^\/competencies\/([^/]+)\/([^/]+)\/team$/);
      const department = event.queryStringParameters?.department;
      return await handleGetTeamCompetencyGaps(ctx, match![1], match![2], department);
    }

    // ── Dialectic ─────────────────────────────────────────────────────────
    if (path.match(/^\/dialectic\/[^/]+\/start$/) && method === 'POST') {
      const sessionId = extractPathParam(path, /^\/dialectic\/([^/]+)\/start$/);
      const body = parseBody<{ theme_id: string; proposition?: string }>(event);
      if (!body?.theme_id) return badRequest('theme_id is required');
      return await handleStartDialectic(ctx, sessionId!, body);
    }
    if (path.match(/^\/dialectic\/[^/]+\/respond$/) && method === 'POST') {
      const dialecticId = extractPathParam(path, /^\/dialectic\/([^/]+)\/respond$/);
      const body = parseBody<{ content: string; reasoning_type: string }>(event);
      if (!body?.content) return badRequest('content is required');
      return await handleSubmitDialecticResponse(ctx, dialecticId!, body);
    }
    if (path.match(/^\/dialectic\/[^/]+\/conclude$/) && method === 'POST') {
      const dialecticId = extractPathParam(path, /^\/dialectic\/([^/]+)\/conclude$/);
      return await handleConcludeDialectic(ctx, dialecticId!);
    }

    // ── Multimodal ────────────────────────────────────────────────────────
    if (path.match(/^\/multimodal\/[^/]+$/) && method === 'GET') {
      const lessonId = extractPathParam(path, /^\/multimodal\/([^/]+)$/);
      return await handleGetMultimodalContent(ctx, lessonId!);
    }
    if (path.match(/^\/multimodal\/[^/]+\/generate$/) && method === 'POST') {
      const lessonId = extractPathParam(path, /^\/multimodal\/([^/]+)\/generate$/);
      const body = parseBody<{ types: string[] }>(event);
      return await handleGenerateMultimodal(ctx, lessonId!, body?.types || []);
    }

    // ── Pulse ─────────────────────────────────────────────────────────────
    if (path.match(/^\/pulse\/[^/]+\/history$/) && method === 'GET') {
      const tenantId = extractPathParam(path, /^\/pulse\/([^/]+)\/history$/);
      const days = parseInt(event.queryStringParameters?.days || '30', 10);
      return await handleGetPulseHistory(ctx, tenantId!, days);
    }
    if (path.match(/^\/pulse\/[^/]+$/) && method === 'GET') {
      const tenantId = extractPathParam(path, /^\/pulse\/([^/]+)$/);
      return await handleGetKnowledgePulse(ctx, tenantId!);
    }

    // ── Archytas ──────────────────────────────────────────────────────────
    if (path.match(/^\/archytas\/[^/]+\/config$/) && method === 'GET') {
      const tenantId = extractPathParam(path, /^\/archytas\/([^/]+)\/config$/);
      return await handleGetArchytasConfig(ctx, tenantId!);
    }
    if (path.match(/^\/archytas\/[^/]+\/config$/) && method === 'PUT') {
      const tenantId = extractPathParam(path, /^\/archytas\/([^/]+)\/config$/);
      const body = parseBody<Record<string, any>>(event);
      return await handleUpdateArchytasConfig(ctx, tenantId!, body || {});
    }
    if (path.match(/^\/archytas\/[^/]+\/invoke$/) && method === 'POST') {
      const sessionId = extractPathParam(path, /^\/archytas\/([^/]+)\/invoke$/);
      const body = parseBody<{ tool_type: string; input: string }>(event);
      if (!body?.tool_type || !body?.input) return badRequest('tool_type and input are required');
      return await handleInvokeArchytasTool(ctx, sessionId!, body);
    }
    if (path.match(/^\/archytas\/[^/]+\/suggest$/) && method === 'POST') {
      const sessionId = extractPathParam(path, /^\/archytas\/([^/]+)\/suggest$/);
      const body = parseBody<{ context: string }>(event);
      return await handleGetArchytasSuggestions(ctx, sessionId!, body?.context || '');
    }
    if (path.match(/^\/archytas\/[^/]+\/summary$/) && method === 'GET') {
      const sessionId = extractPathParam(path, /^\/archytas\/([^/]+)\/summary$/);
      return await handleGetArchytasSessionSummary(ctx, sessionId!);
    }

    return notFound(`Route not found: ${method} ${path}`);
  } catch (err: any) {
    logger.error('Dojo API error', { error: err.message, stack: err.stack, method, path });
    return serverError(err.message || 'Internal server error');
  }
};

// =============================================================================
// Library Handlers
// =============================================================================

async function handleGetLibraries(ctx: RequestContext, tenantId: string) {
  const result = await executeStatement(
    `SELECT * FROM dojo_libraries WHERE tenant_id = :tenantId ORDER BY created_at DESC`,
    [stringParam('tenantId', tenantId)]
  );
  return success({ libraries: result.records || [] });
}

async function handleCreateLibrary(ctx: RequestContext, tenantId: string, body: { name: string; description: string }) {
  const result = await executeStatement(
    `INSERT INTO dojo_libraries (tenant_id, name, description)
     VALUES (:tenantId, :name, :description)
     RETURNING *`,
    [stringParam('tenantId', tenantId), stringParam('name', body.name), stringParam('description', body.description || '')]
  );
  return created({ library: result.records?.[0] });
}

async function handleGetDocuments(ctx: RequestContext, libraryId: string) {
  const result = await executeStatement(
    `SELECT * FROM dojo_documents WHERE library_id = :libraryId ORDER BY uploaded_at DESC`,
    [stringParam('libraryId', libraryId)]
  );
  return success({ documents: result.records || [] });
}

async function handleUploadDocument(ctx: RequestContext, libraryId: string, event: any) {
  // In production, this would parse multipart form data and upload to S3.
  // The Lambda receives the file via API Gateway binary support.
  const filename = event.headers?.['x-filename'] || `upload-${Date.now()}.pdf`;
  const contentType = event.headers?.['content-type'] || 'application/pdf';
  const bodyLength = event.body ? Buffer.byteLength(event.body, event.isBase64Encoded ? 'base64' : 'utf8') : 0;

  const result = await executeStatement(
    `INSERT INTO dojo_documents (library_id, tenant_id, filename, mime_type, size_bytes, s3_key)
     VALUES (:libraryId, :tenantId, :filename, :mimeType, :sizeBytes, :s3Key)
     RETURNING *`,
    [
      stringParam('libraryId', libraryId),
      stringParam('tenantId', ctx.tenantId),
      stringParam('filename', filename),
      stringParam('mimeType', contentType),
      longParam('sizeBytes', bodyLength),
      stringParam('s3Key', `dojo/${ctx.tenantId}/${libraryId}/${filename}`),
    ]
  );

  // Update library document count
  await executeStatement(
    `UPDATE dojo_libraries SET document_count = document_count + 1, updated_at = NOW() WHERE id = :libraryId`,
    [stringParam('libraryId', libraryId)]
  );

  return created({ document: result.records?.[0] });
}

async function handleDeleteDocument(ctx: RequestContext, libraryId: string, documentId: string) {
  await executeStatement(
    `DELETE FROM dojo_documents WHERE id = :documentId AND library_id = :libraryId`,
    [stringParam('documentId', documentId), stringParam('libraryId', libraryId)]
  );
  await executeStatement(
    `UPDATE dojo_libraries SET document_count = GREATEST(document_count - 1, 0), updated_at = NOW() WHERE id = :libraryId`,
    [stringParam('libraryId', libraryId)]
  );
  return success({ deleted: true });
}

async function handleDiscoverThemes(ctx: RequestContext, libraryId: string) {
  // In production, this invokes an LLM to analyze document chunks and discover themes.
  // The LLM analyzes the chunked content via embeddings + prompt to extract 10-15 Central Themes.
  // For now, we query existing themes or trigger async discovery.
  const existing = await executeStatement(
    `SELECT * FROM dojo_themes WHERE library_id = :libraryId ORDER BY created_at`,
    [stringParam('libraryId', libraryId)]
  );

  if (existing.records && existing.records.length > 0) {
    return success({
      library_id: libraryId,
      themes: existing.records,
      discovery_model: 'claude-sonnet-4-20250514',
      analyzed_chunks: 0,
    });
  }

  // Mark library as analyzing
  await executeStatement(
    `UPDATE dojo_libraries SET status = 'analyzing', updated_at = NOW() WHERE id = :libraryId`,
    [stringParam('libraryId', libraryId)]
  );

  // TODO: Invoke LLM discovery pipeline asynchronously via SQS/Step Functions.
  // The pipeline: 1) fetch all chunks for library 2) cluster by embedding similarity 
  // 3) LLM names and describes each cluster as a Central Theme 4) store themes in dojo_themes
  // 5) update library status to 'ready'
  throw new Error(
    'Theme discovery requires the AI pipeline to be running. ' +
    'Ensure the Dojo discovery Lambda is deployed and the library has documents with embeddings. ' +
    'Trigger discovery via: POST /api/admin/dojo/libraries/:libraryId/discover-themes'
  );
}

async function handleGetThemes(ctx: RequestContext, libraryId: string) {
  const result = await executeStatement(
    `SELECT * FROM dojo_themes WHERE library_id = :libraryId ORDER BY difficulty_tier, name`,
    [stringParam('libraryId', libraryId)]
  );
  return success({ themes: result.records || [] });
}

// =============================================================================
// Session Handlers
// =============================================================================

async function handleStartSession(ctx: RequestContext, tenantId: string, body: { library_id: string; theme_ids: string[]; mode: string }) {
  const themeIdsArray = `{${(body.theme_ids || []).join(',')}}`;
  const result = await executeStatement(
    `INSERT INTO dojo_sessions (tenant_id, user_id, library_id, theme_ids, mode)
     VALUES (:tenantId, :userId, :libraryId, :themeIds::UUID[], :mode::dojo_session_mode)
     RETURNING *`,
    [
      stringParam('tenantId', tenantId),
      stringParam('userId', ctx.userId),
      stringParam('libraryId', body.library_id),
      stringParam('themeIds', themeIdsArray),
      stringParam('mode', body.mode),
    ]
  );
  return created({ session: result.records?.[0] });
}

async function handleGetSession(ctx: RequestContext, sessionId: string) {
  const result = await executeStatement(
    `SELECT * FROM dojo_sessions WHERE id = :sessionId`,
    [stringParam('sessionId', sessionId)]
  );
  if (!result.records?.length) return notFound('Session not found');
  return success({ session: result.records[0] });
}

async function handleGetLessonBlocks(ctx: RequestContext, sessionId: string) {
  const result = await executeStatement(
    `SELECT * FROM dojo_lesson_blocks WHERE session_id = :sessionId ORDER BY sequence`,
    [stringParam('sessionId', sessionId)]
  );
  return success({ blocks: result.records || [] });
}

async function handleNextLesson(ctx: RequestContext, sessionId: string) {
  // In production, this invokes LLM to generate the next lesson block based on
  // the session's themes and the user's progress.
  // For now, returns existing blocks or throws.
  const existing = await executeStatement(
    `SELECT COUNT(*) as count FROM dojo_lesson_blocks WHERE session_id = :sessionId`,
    [stringParam('sessionId', sessionId)]
  );
  const seq = parseInt(existing.records?.[0]?.count || '0', 10);

  throw new Error(
    'Lesson generation requires the AI pipeline. The Sensei agent analyzes ' +
    `theme chunks and synthesizes lesson #${seq + 1} with source citations. ` +
    'Deploy the Dojo AI Lambda to enable this feature.'
  );
}

async function handleGetSparringQuestion(ctx: RequestContext, sessionId: string) {
  // In production, this invokes the Adversarial agent to generate a contextual question.
  const result = await executeStatement(
    `SELECT * FROM dojo_sparring_questions WHERE session_id = :sessionId ORDER BY created_at DESC LIMIT 1`,
    [stringParam('sessionId', sessionId)]
  );
  if (result.records?.length) {
    return success({ question: result.records[0] });
  }
  throw new Error(
    'Sparring question generation requires the AI pipeline. The Adversarial agent generates ' +
    'questions based on theme content with difficulty scaling. Deploy the Dojo AI Lambda.'
  );
}

async function handleSubmitSparringAnswer(ctx: RequestContext, sessionId: string, body: { question_id: string; answer: string; time_taken_seconds: number }) {
  // Look up the question
  const qResult = await executeStatement(
    `SELECT * FROM dojo_sparring_questions WHERE id = :questionId`,
    [stringParam('questionId', body.question_id)]
  );
  if (!qResult.records?.length) return notFound('Question not found');
  const question = qResult.records[0];

  // In production, LLM evaluates open-ended answers. For multiple choice, direct comparison.
  const correct = (body.answer.toLowerCase().trim() === (question.correct_answer || '').toLowerCase().trim());
  const xpAwarded = correct ? 25 : 5;

  const result = await executeStatement(
    `INSERT INTO dojo_sparring_results (question_id, session_id, tenant_id, user_id, answer, correct, partial_credit, reasoning_analysis, xp_awarded, time_taken_seconds)
     VALUES (:questionId, :sessionId, :tenantId, :userId, :answer, :correct, :partialCredit, :reasoning, :xp, :timeTaken)
     RETURNING *`,
    [
      stringParam('questionId', body.question_id),
      stringParam('sessionId', sessionId),
      stringParam('tenantId', ctx.tenantId),
      stringParam('userId', ctx.userId),
      stringParam('answer', body.answer),
      stringParam('correct', correct.toString()),
      longParam('partialCredit', correct ? 1.0 : 0),
      stringParam('reasoning', correct ? 'Correct answer matched.' : `Expected: ${question.correct_answer}`),
      longParam('xp', xpAwarded),
      longParam('timeTaken', body.time_taken_seconds || 0),
    ]
  );

  // Update session stats
  await executeStatement(
    `UPDATE dojo_sessions SET questions_asked = questions_asked + 1, questions_correct = questions_correct + ${correct ? 1 : 0}, xp_earned = xp_earned + :xp WHERE id = :sessionId`,
    [longParam('xp', xpAwarded), stringParam('sessionId', sessionId)]
  );

  return success({
    result: {
      question_id: body.question_id,
      correct,
      partial_credit: correct ? 1.0 : 0,
      correct_answer: question.correct_answer,
      explanation: question.explanation || '',
      reasoning_analysis: correct ? 'Correct answer matched.' : `Expected: ${question.correct_answer}`,
      source_citations: question.source_citations || [],
      xp_awarded: xpAwarded,
    }
  });
}

async function handleCompleteSession(ctx: RequestContext, sessionId: string) {
  const result = await executeStatement(
    `UPDATE dojo_sessions SET status = 'completed', completed_at = NOW() WHERE id = :sessionId RETURNING *`,
    [stringParam('sessionId', sessionId)]
  );
  if (!result.records?.length) return notFound('Session not found');

  const session = result.records[0];

  // Update user progress
  await executeStatement(
    `INSERT INTO dojo_user_progress (tenant_id, user_id, overall_xp, total_sessions, last_session_at)
     VALUES (:tenantId, :userId, :xp, 1, NOW())
     ON CONFLICT (tenant_id, user_id) DO UPDATE SET
       overall_xp = dojo_user_progress.overall_xp + :xp,
       total_sessions = dojo_user_progress.total_sessions + 1,
       last_session_at = NOW(),
       overall_rank = dojo_xp_to_rank(dojo_user_progress.overall_xp + :xp),
       updated_at = NOW()`,
    [
      stringParam('tenantId', ctx.tenantId),
      stringParam('userId', ctx.userId),
      longParam('xp', parseInt(session.xp_earned || '0', 10)),
    ]
  );

  return success({
    session,
    xp_summary: {
      total: parseInt(session.xp_earned || '0', 10),
      breakdown: { sparring: parseInt(session.xp_earned || '0', 10) },
    },
  });
}

// =============================================================================
// Progress Handlers
// =============================================================================

async function handleGetProgress(ctx: RequestContext, tenantId: string, userId: string) {
  const progressResult = await executeStatement(
    `SELECT * FROM dojo_user_progress WHERE tenant_id = :tenantId AND user_id = :userId`,
    [stringParam('tenantId', tenantId), stringParam('userId', userId)]
  );
  const themeResult = await executeStatement(
    `SELECT * FROM dojo_theme_progress WHERE tenant_id = :tenantId AND user_id = :userId`,
    [stringParam('tenantId', tenantId), stringParam('userId', userId)]
  );
  const certResult = await executeStatement(
    `SELECT * FROM dojo_certifications WHERE tenant_id = :tenantId AND user_id = :userId ORDER BY issued_at DESC`,
    [stringParam('tenantId', tenantId), stringParam('userId', userId)]
  );
  const sessionsResult = await executeStatement(
    `SELECT * FROM dojo_sessions WHERE tenant_id = :tenantId AND user_id = :userId ORDER BY started_at DESC LIMIT 10`,
    [stringParam('tenantId', tenantId), stringParam('userId', userId)]
  );

  const base = progressResult.records?.[0] || {
    user_id: userId, overall_rank: 'novice', overall_xp: 0, total_sessions: 0,
    total_time_minutes: 0, streak_days: 0,
  };

  return success({
    progress: {
      ...base,
      theme_progress: themeResult.records || [],
      recent_sessions: sessionsResult.records || [],
      certifications: certResult.records || [],
      xp_to_next_rank: calculateXpToNextRank(base.overall_rank, parseInt(base.overall_xp || '0', 10)),
    },
  });
}

async function handleGetThemeProgress(ctx: RequestContext, tenantId: string, userId: string, themeId: string) {
  const result = await executeStatement(
    `SELECT * FROM dojo_theme_progress WHERE tenant_id = :tenantId AND user_id = :userId AND theme_id = :themeId`,
    [stringParam('tenantId', tenantId), stringParam('userId', userId), stringParam('themeId', themeId)]
  );
  if (!result.records?.length) {
    return success({ progress: { theme_id: themeId, rank: 'novice', xp: 0, mastery_percentage: 0, questions_attempted: 0, questions_correct: 0, accuracy: 0, last_session_at: null, weaknesses: [], strengths: [] } });
  }
  return success({ progress: result.records[0] });
}

function calculateXpToNextRank(rank: string, xp: number): number {
  const thresholds: Record<string, number> = { novice: 500, initiate: 2000, adept: 5000, master: 10000, radiant: 0 };
  return Math.max(0, (thresholds[rank] || 0) - xp);
}

// =============================================================================
// Certification Handlers
// =============================================================================

async function handleStartCertExam(ctx: RequestContext, tenantId: string, body: { theme_id: string; user_id: string }) {
  // Create a certification exam session
  const sessionResult = await executeStatement(
    `INSERT INTO dojo_sessions (tenant_id, user_id, library_id, theme_ids, mode)
     SELECT :tenantId, :userId, t.library_id, ARRAY[t.id], 'sparring'
     FROM dojo_themes t WHERE t.id = :themeId
     RETURNING *`,
    [stringParam('tenantId', tenantId), stringParam('userId', body.user_id), stringParam('themeId', body.theme_id)]
  );
  if (!sessionResult.records?.length) return notFound('Theme not found');
  return success({
    session_id: sessionResult.records[0].id,
    question_count: 20,
    time_limit_minutes: 30,
  });
}

async function handleGetCertifications(ctx: RequestContext, tenantId: string, userId: string) {
  const result = await executeStatement(
    `SELECT c.*, t.name as theme_name FROM dojo_certifications c
     LEFT JOIN dojo_themes t ON t.id = c.theme_id
     WHERE c.tenant_id = :tenantId AND c.user_id = :userId
     ORDER BY c.issued_at DESC`,
    [stringParam('tenantId', tenantId), stringParam('userId', userId)]
  );
  return success({ certifications: result.records || [] });
}

// =============================================================================
// Mobot Handlers
// =============================================================================

async function handleSendMobotMessage(ctx: RequestContext, sessionId: string, body: { message: string; context?: any }) {
  // Store user message
  await executeStatement(
    `INSERT INTO dojo_mobot_messages (session_id, tenant_id, role, content)
     VALUES (:sessionId, :tenantId, 'user', :content)`,
    [stringParam('sessionId', sessionId), stringParam('tenantId', ctx.tenantId), stringParam('content', body.message)]
  );

  // In production, invoke LLM with document context to generate grounded response.
  // The Mobot agent searches theme chunks for relevant content and generates a cited answer.
  throw new Error(
    'Mobot responses require the AI pipeline. The Mobot Knowledge Agent retrieves ' +
    'relevant chunks from the active library and generates a citation-grounded response. ' +
    'Deploy the Dojo AI Lambda to enable conversational assistance.'
  );
}

async function handleGetMobotHistory(ctx: RequestContext, sessionId: string) {
  const result = await executeStatement(
    `SELECT * FROM dojo_mobot_messages WHERE session_id = :sessionId ORDER BY created_at ASC`,
    [stringParam('sessionId', sessionId)]
  );
  return success({ messages: result.records || [] });
}

// =============================================================================
// Config Handlers
// =============================================================================

async function handleGetConfig(ctx: RequestContext, tenantId: string) {
  const result = await executeStatement(
    `SELECT * FROM dojo_config WHERE tenant_id = :tenantId`,
    [stringParam('tenantId', tenantId)]
  );
  if (!result.records?.length) {
    // Return defaults
    return success({
      config: {
        tenant_id: tenantId, enabled: true, ai_model: 'claude-sonnet-4-20250514',
        embedding_model: 'text-embedding-3-large', max_themes_per_library: 15,
        sparring_difficulty_scaling: true, certification_enabled: true,
        min_sessions_for_cert: 5,
        rank_thresholds: { novice: 0, initiate: 500, adept: 2000, master: 5000, radiant: 10000 },
        archytas_enabled: false, archytas_config: null,
      },
    });
  }
  return success({ config: result.records[0] });
}

async function handleUpdateConfig(ctx: RequestContext, tenantId: string, body: Record<string, any>) {
  const result = await executeStatement(
    `INSERT INTO dojo_config (tenant_id, enabled, ai_model, embedding_model, max_themes_per_library,
       sparring_difficulty_scaling, certification_enabled, min_sessions_for_cert, rank_thresholds,
       archytas_enabled, archytas_config)
     VALUES (:tenantId, :enabled, :aiModel, :embeddingModel, :maxThemes,
       :diffScaling, :certEnabled, :minSessions, :rankThresholds::JSONB,
       :archytasEnabled, :archytasConfig::JSONB)
     ON CONFLICT (tenant_id) DO UPDATE SET
       enabled = COALESCE(:enabled, dojo_config.enabled),
       ai_model = COALESCE(:aiModel, dojo_config.ai_model),
       embedding_model = COALESCE(:embeddingModel, dojo_config.embedding_model),
       max_themes_per_library = COALESCE(:maxThemes, dojo_config.max_themes_per_library),
       sparring_difficulty_scaling = COALESCE(:diffScaling, dojo_config.sparring_difficulty_scaling),
       certification_enabled = COALESCE(:certEnabled, dojo_config.certification_enabled),
       min_sessions_for_cert = COALESCE(:minSessions, dojo_config.min_sessions_for_cert),
       archytas_enabled = COALESCE(:archytasEnabled, dojo_config.archytas_enabled),
       archytas_config = COALESCE(:archytasConfig::JSONB, dojo_config.archytas_config),
       updated_at = NOW()
     RETURNING *`,
    [
      stringParam('tenantId', tenantId),
      stringParam('enabled', String(body.enabled ?? true)),
      stringParam('aiModel', body.ai_model || 'claude-sonnet-4-20250514'),
      stringParam('embeddingModel', body.embedding_model || 'text-embedding-3-large'),
      longParam('maxThemes', body.max_themes_per_library || 15),
      stringParam('diffScaling', String(body.sparring_difficulty_scaling ?? true)),
      stringParam('certEnabled', String(body.certification_enabled ?? true)),
      longParam('minSessions', body.min_sessions_for_cert || 5),
      stringParam('rankThresholds', JSON.stringify(body.rank_thresholds || {})),
      stringParam('archytasEnabled', String(body.archytas_enabled ?? false)),
      stringParam('archytasConfig', JSON.stringify(body.archytas_config || null)),
    ]
  );
  return success({ config: result.records?.[0] });
}

// =============================================================================
// Decay Engine Handlers
// =============================================================================

async function handleGetDecayDashboard(ctx: RequestContext, tenantId: string, userId: string) {
  const atomCount = await executeStatement(
    `SELECT COUNT(*) as total FROM dojo_knowledge_atoms WHERE tenant_id = :tenantId`,
    [stringParam('tenantId', tenantId)]
  );
  const curves = await executeStatement(
    `SELECT dc.*, ka.concept, ka.theme_id, dt.name as theme_name
     FROM dojo_decay_curves dc
     JOIN dojo_knowledge_atoms ka ON ka.id = dc.atom_id
     JOIN dojo_themes dt ON dt.id = ka.theme_id
     WHERE dc.tenant_id = :tenantId AND dc.user_id = :userId`,
    [stringParam('tenantId', tenantId), stringParam('userId', userId)]
  );

  const records = curves.records || [];
  const atRisk = records.filter((r: any) => parseFloat(r.retention_probability) < 0.5).length;
  const stable = records.filter((r: any) => parseFloat(r.retention_probability) >= 0.7).length;
  const decayed = records.filter((r: any) => parseFloat(r.retention_probability) < 0.3).length;
  const avgRetention = records.length > 0
    ? records.reduce((sum: number, r: any) => sum + parseFloat(r.retention_probability), 0) / records.length
    : 0;

  // Group by theme
  const themeMap = new Map<string, { theme_name: string; retentions: number[]; at_risk: number }>();
  for (const r of records as any[]) {
    const key = r.theme_id;
    if (!themeMap.has(key)) themeMap.set(key, { theme_name: r.theme_name, retentions: [], at_risk: 0 });
    const entry = themeMap.get(key)!;
    entry.retentions.push(parseFloat(r.retention_probability));
    if (parseFloat(r.retention_probability) < 0.5) entry.at_risk++;
  }

  const decayByTheme = Array.from(themeMap.entries()).map(([theme_id, data]) => ({
    theme_id,
    theme_name: data.theme_name,
    avg_retention: data.retentions.reduce((a, b) => a + b, 0) / data.retentions.length,
    at_risk_count: data.at_risk,
  }));

  return success({
    dashboard: {
      total_atoms: parseInt(atomCount.records?.[0]?.total || '0', 10),
      atoms_at_risk: atRisk,
      atoms_stable: stable,
      atoms_decayed: decayed,
      average_retention: avgRetention,
      next_reinforcement_at: new Date(Date.now() + 3600000).toISOString(),
      decay_by_theme: decayByTheme,
    },
  });
}

async function handleGetDecayCurves(ctx: RequestContext, tenantId: string, userId: string, themeId?: string) {
  let query = `SELECT dc.*, ka.concept, ka.description as atom_description, ka.source_citations as atom_citations, ka.difficulty as atom_difficulty
     FROM dojo_decay_curves dc
     JOIN dojo_knowledge_atoms ka ON ka.id = dc.atom_id
     WHERE dc.tenant_id = :tenantId AND dc.user_id = :userId`;
  const params = [stringParam('tenantId', tenantId), stringParam('userId', userId)];

  if (themeId) {
    query += ` AND ka.theme_id = :themeId`;
    params.push(stringParam('themeId', themeId));
  }

  const result = await executeStatement(query, params);
  const records = result.records || [];

  const curves = records.map((r: any) => ({
    atom_id: r.atom_id, user_id: r.user_id, half_life_hours: parseFloat(r.half_life_hours),
    stability: parseFloat(r.stability), last_reviewed_at: r.last_reviewed_at,
    next_review_at: r.next_review_at, review_count: parseInt(r.review_count, 10),
    retention_probability: parseFloat(r.retention_probability),
    streak: parseInt(r.streak, 10), lapse_count: parseInt(r.lapse_count, 10),
  }));

  const atoms = records.map((r: any) => ({
    id: r.atom_id, theme_id: r.theme_id, concept: r.concept,
    description: r.atom_description, source_citations: r.atom_citations || [],
    difficulty: parseFloat(r.atom_difficulty),
  }));

  return success({ curves, atoms });
}

async function handleTriggerReinforcement(ctx: RequestContext, tenantId: string, userId: string, mode: string) {
  // Find atoms due for reinforcement (retention < 0.5 or next_review_at < now)
  const result = await executeStatement(
    `SELECT dc.*, ka.concept, ka.description, ka.source_citations, ka.difficulty
     FROM dojo_decay_curves dc
     JOIN dojo_knowledge_atoms ka ON ka.id = dc.atom_id
     WHERE dc.tenant_id = :tenantId AND dc.user_id = :userId
       AND (dc.retention_probability < 0.5 OR dc.next_review_at <= NOW())
     ORDER BY dc.retention_probability ASC
     LIMIT 10`,
    [stringParam('tenantId', tenantId), stringParam('userId', userId)]
  );

  return success({
    session: {
      id: `reinforce-${Date.now()}`,
      user_id: userId,
      atoms: (result.records || []).map((r: any) => ({
        atom: { id: r.atom_id, concept: r.concept, description: r.description, source_citations: r.source_citations || [], difficulty: parseFloat(r.difficulty) },
        decay: { atom_id: r.atom_id, half_life_hours: parseFloat(r.half_life_hours), retention_probability: parseFloat(r.retention_probability) },
        question: null,
      })),
      status: 'active',
      triggered_by: mode,
      created_at: new Date().toISOString(),
    },
  });
}

async function handleSubmitReinforcementAnswer(ctx: RequestContext, reinforcementId: string, body: { atom_id: string; answer: any }) {
  // Update the decay curve after review
  const curveResult = await executeStatement(
    `SELECT id FROM dojo_decay_curves WHERE atom_id = :atomId AND user_id = :userId`,
    [stringParam('atomId', body.atom_id), stringParam('userId', ctx.userId)]
  );
  if (!curveResult.records?.length) return notFound('Decay curve not found for this atom');

  const curveId = curveResult.records[0].id;
  const correct = body.answer?.correct ?? (typeof body.answer === 'string' && body.answer.length > 0);

  await executeStatement(
    `SELECT dojo_update_decay_after_review(:curveId, :correct)`,
    [stringParam('curveId', curveId), stringParam('correct', String(correct))]
  );

  // Fetch updated curve
  const updated = await executeStatement(
    `SELECT * FROM dojo_decay_curves WHERE id = :curveId`,
    [stringParam('curveId', curveId)]
  );

  return success({
    result: { correct, xp_awarded: correct ? 15 : 3 },
    updated_curve: updated.records?.[0],
  });
}

// =============================================================================
// Scenario Handlers
// =============================================================================

async function handleStartScenario(ctx: RequestContext, sessionId: string, body: any) {
  const archetype = body.archetype || 'confused_customer';
  const persona = {
    id: `persona-${Date.now()}`,
    archetype,
    name: getPersonaName(archetype),
    backstory: `A ${archetype.replace(/_/g, ' ')} with specific needs.`,
    emotional_state: 'neutral',
    communication_style: 'formal',
    hidden_objectives: ['Resolve their issue', 'Test policy knowledge'],
  };

  const result = await executeStatement(
    `INSERT INTO dojo_scenario_sessions (session_id, tenant_id, persona, theme_ids, situation, objective)
     VALUES (:sessionId, :tenantId, :persona::JSONB, :themeIds::UUID[], :situation, :objective)
     RETURNING *`,
    [
      stringParam('sessionId', sessionId),
      stringParam('tenantId', ctx.tenantId),
      stringParam('persona', JSON.stringify(persona)),
      stringParam('themeIds', `{${(body.theme_ids || []).join(',')}}`),
      stringParam('situation', `A ${archetype.replace(/_/g, ' ')} approaches you about a policy question.`),
      stringParam('objective', 'Resolve the situation while demonstrating policy knowledge and emotional intelligence.'),
    ]
  );

  return created({ scenario: { ...result.records?.[0], persona, branches: [] } });
}

async function handleRespondToScenario(ctx: RequestContext, scenarioId: string, responseText: string) {
  // In production, LLM generates persona response + consequence based on learner's action
  const branchResult = await executeStatement(
    `INSERT INTO dojo_scenario_branches (scenario_id, tenant_id, learner_response, persona_message, turn_number)
     SELECT :scenarioId, :tenantId, :response, 'Processing response...', COALESCE(MAX(turn_number), 0) + 1
     FROM dojo_scenario_branches WHERE scenario_id = :scenarioId
     RETURNING *`,
    [stringParam('scenarioId', scenarioId), stringParam('tenantId', ctx.tenantId), stringParam('response', responseText)]
  );

  const scenarioResult = await executeStatement(
    `SELECT * FROM dojo_scenario_sessions WHERE id = :scenarioId`,
    [stringParam('scenarioId', scenarioId)]
  );

  throw new Error(
    'Scenario response generation requires the AI pipeline. The Adversarial agent generates ' +
    'persona reactions with emotional shifts and consequence scoring. Deploy the Dojo AI Lambda.'
  );
}

async function handleConcludeScenario(ctx: RequestContext, scenarioId: string) {
  const result = await executeStatement(
    `UPDATE dojo_scenario_sessions SET status = 'completed', completed_at = NOW() WHERE id = :scenarioId RETURNING *`,
    [stringParam('scenarioId', scenarioId)]
  );
  if (!result.records?.length) return notFound('Scenario not found');
  return success({ scenario: result.records[0] });
}

function getPersonaName(archetype: string): string {
  const names: Record<string, string> = {
    confused_customer: 'Alex Chen', angry_customer: 'Morgan Torres', detail_oriented: 'Dr. Sarah Kim',
    time_pressured: 'James Martinez', price_sensitive: 'Pat Robinson', vip_escalation: 'Director Williams',
    compliance_auditor: 'Auditor Nakamura', new_employee: 'Jordan Lee', hostile_negotiator: 'Viktor Petrov',
  };
  return names[archetype] || 'Unknown';
}

// =============================================================================
// Competency Handlers
// =============================================================================

async function handleExtractCompetencies(ctx: RequestContext, libraryId: string) {
  // In production, LLM analyzes library themes to extract competency graph
  const existing = await executeStatement(
    `SELECT * FROM dojo_competencies WHERE library_id = :libraryId`,
    [stringParam('libraryId', libraryId)]
  );
  if (existing.records?.length) {
    return success({ competencies: existing.records });
  }
  throw new Error(
    'Competency extraction requires the AI pipeline. The system analyzes themes and documents ' +
    'to auto-extract a competency graph with proficiency levels. Deploy the Dojo AI Lambda.'
  );
}

async function handleGetCompetencyMesh(ctx: RequestContext, tenantId: string, userId: string, libraryId: string) {
  const scoresResult = await executeStatement(
    `SELECT ucs.*, c.name as competency_name, c.category
     FROM dojo_user_competency_scores ucs
     JOIN dojo_competencies c ON c.id = ucs.competency_id
     WHERE ucs.tenant_id = :tenantId AND ucs.user_id = :userId AND c.library_id = :libraryId`,
    [stringParam('tenantId', tenantId), stringParam('userId', userId), stringParam('libraryId', libraryId)]
  );

  return success({
    mesh: {
      user_id: userId,
      library_id: libraryId,
      competencies: scoresResult.records || [],
      readiness_scores: [],
      recommended_path: [],
    },
  });
}

async function handleGetTeamCompetencyGaps(ctx: RequestContext, tenantId: string, libraryId: string, department?: string) {
  let query = `SELECT c.name as competency_name, AVG(ucs.current_level) as team_avg_level, MAX(ucs.max_level) as target_level,
     COUNT(*) FILTER (WHERE ucs.current_level < ucs.max_level * 0.6) as members_below_target, COUNT(*) as total_members
     FROM dojo_user_competency_scores ucs
     JOIN dojo_competencies c ON c.id = ucs.competency_id
     WHERE ucs.tenant_id = :tenantId AND c.library_id = :libraryId
     GROUP BY c.name`;
  const params = [stringParam('tenantId', tenantId), stringParam('libraryId', libraryId)];

  const result = await executeStatement(query, params);

  return success({
    mesh: {
      user_id: 'team',
      library_id: libraryId,
      competencies: [],
      readiness_scores: [],
      recommended_path: [],
      team_gaps: result.records || [],
    },
  });
}

// =============================================================================
// Dialectic Handlers
// =============================================================================

async function handleStartDialectic(ctx: RequestContext, sessionId: string, body: { theme_id: string; proposition?: string }) {
  const proposition = body.proposition || 'This topic has a clear, objective best practice.';
  const result = await executeStatement(
    `INSERT INTO dojo_dialectic_sessions (session_id, tenant_id, theme_id, proposition, context)
     VALUES (:sessionId, :tenantId, :themeId, :proposition, '')
     RETURNING *`,
    [
      stringParam('sessionId', sessionId),
      stringParam('tenantId', ctx.tenantId),
      stringParam('themeId', body.theme_id),
      stringParam('proposition', proposition),
    ]
  );
  return created({ dialectic: { ...result.records?.[0], turns: [] } });
}

async function handleSubmitDialecticResponse(ctx: RequestContext, dialecticId: string, body: { content: string; reasoning_type: string }) {
  // Store learner's turn
  await executeStatement(
    `INSERT INTO dojo_dialectic_turns (dialectic_id, tenant_id, role, content, reasoning_type)
     VALUES (:dialecticId, :tenantId, 'learner', :content, :reasoningType)`,
    [
      stringParam('dialecticId', dialecticId),
      stringParam('tenantId', ctx.tenantId),
      stringParam('content', body.content),
      stringParam('reasoningType', body.reasoning_type || 'claim'),
    ]
  );

  // In production, multi-agent system generates thesis/antithesis/synthesis responses
  throw new Error(
    'Dialectic response generation requires the AI pipeline. The multi-agent Socratic system ' +
    'generates thesis, antithesis, and moderator responses with logical fallacy detection. ' +
    'Deploy the Dojo AI Lambda.'
  );
}

async function handleConcludeDialectic(ctx: RequestContext, dialecticId: string) {
  const result = await executeStatement(
    `UPDATE dojo_dialectic_sessions SET status = 'concluded', completed_at = NOW() WHERE id = :dialecticId RETURNING *`,
    [stringParam('dialecticId', dialecticId)]
  );
  if (!result.records?.length) return notFound('Dialectic session not found');

  const turns = await executeStatement(
    `SELECT * FROM dojo_dialectic_turns WHERE dialectic_id = :dialecticId ORDER BY created_at`,
    [stringParam('dialecticId', dialecticId)]
  );

  return success({ dialectic: { ...result.records[0], turns: turns.records || [] } });
}

// =============================================================================
// Multimodal Handlers
// =============================================================================

async function handleGetMultimodalContent(ctx: RequestContext, lessonId: string) {
  const result = await executeStatement(
    `SELECT * FROM dojo_multimodal_content WHERE lesson_id = :lessonId`,
    [stringParam('lessonId', lessonId)]
  );
  if (!result.records?.length) {
    return success({ content: { lesson_id: lessonId, audio_url: null, audio_duration_seconds: null, diagrams: [], glossary: [], key_takeaways: [], learning_style_adaptations: {} } });
  }
  return success({ content: result.records[0] });
}

async function handleGenerateMultimodal(ctx: RequestContext, lessonId: string, types: string[]) {
  // In production, invokes LLM + TTS to generate multimodal content
  throw new Error(
    'Multimodal generation requires the AI pipeline. The system generates audio (TTS), ' +
    'Mermaid diagrams, glossary, and learning style adaptations from lesson content. ' +
    'Deploy the Dojo AI Lambda.'
  );
}

// =============================================================================
// Knowledge Pulse Handlers
// =============================================================================

async function handleGetKnowledgePulse(ctx: RequestContext, tenantId: string) {
  const result = await executeStatement(
    `SELECT * FROM dojo_knowledge_pulse WHERE tenant_id = :tenantId ORDER BY snapshot_at DESC LIMIT 1`,
    [stringParam('tenantId', tenantId)]
  );
  if (!result.records?.length) {
    // Generate a fresh pulse from current data
    const userCount = await executeStatement(
      `SELECT COUNT(DISTINCT user_id) as total FROM dojo_user_progress WHERE tenant_id = :tenantId`,
      [stringParam('tenantId', tenantId)]
    );
    return success({
      pulse: {
        tenant_id: tenantId, snapshot_at: new Date().toISOString(),
        overall_health: 0, total_users: parseInt(userCount.records?.[0]?.total || '0', 10),
        active_users_30d: 0, department_health: [], theme_coverage: [], decay_alerts: [],
        trends: { knowledge_health_7d: [], knowledge_health_30d: [], training_hours_7d: [], new_certifications_7d: 0, avg_session_score_trend: 'flat' },
        roi_metrics: { estimated_cost_savings_monthly: 0, avg_time_to_competency_days: 0, certification_pass_rate: 0, knowledge_retention_rate: 0, training_hours_saved_vs_traditional: 0 },
      },
    });
  }
  return success({ pulse: result.records[0] });
}

async function handleGetPulseHistory(ctx: RequestContext, tenantId: string, days: number) {
  const result = await executeStatement(
    `SELECT * FROM dojo_knowledge_pulse WHERE tenant_id = :tenantId AND snapshot_at >= NOW() - (:days || ' days')::INTERVAL ORDER BY snapshot_at DESC`,
    [stringParam('tenantId', tenantId), longParam('days', days)]
  );
  return success({ snapshots: result.records || [] });
}

// =============================================================================
// Archytas Handlers
// =============================================================================

async function handleGetArchytasConfig(ctx: RequestContext, tenantId: string) {
  const result = await executeStatement(
    `SELECT archytas_config FROM dojo_config WHERE tenant_id = :tenantId`,
    [stringParam('tenantId', tenantId)]
  );
  const config = result.records?.[0]?.archytas_config;
  if (!config) {
    return success({
      config: {
        enabled: false, allowed_tools: [], sandbox_mode: 'strict',
        max_execution_time_seconds: 30, max_tool_calls_per_session: 10,
        auto_suggest: false, languages: ['python', 'javascript'], research_domains: [],
      },
    });
  }
  return success({ config: typeof config === 'string' ? JSON.parse(config) : config });
}

async function handleUpdateArchytasConfig(ctx: RequestContext, tenantId: string, body: Record<string, any>) {
  await executeStatement(
    `UPDATE dojo_config SET archytas_config = :config::JSONB, archytas_enabled = :enabled, updated_at = NOW() WHERE tenant_id = :tenantId`,
    [
      stringParam('config', JSON.stringify(body)),
      stringParam('enabled', String(body.enabled ?? false)),
      stringParam('tenantId', tenantId),
    ]
  );
  return success({ config: body });
}

async function handleInvokeArchytasTool(ctx: RequestContext, sessionId: string, body: { tool_type: string; input: string }) {
  const result = await executeStatement(
    `INSERT INTO dojo_archytas_tool_calls (session_id, tenant_id, tool_type, input, status, sandbox_id)
     VALUES (:sessionId, :tenantId, :toolType::dojo_archytas_tool, :input, 'pending', :sandboxId)
     RETURNING *`,
    [
      stringParam('sessionId', sessionId),
      stringParam('tenantId', ctx.tenantId),
      stringParam('toolType', body.tool_type),
      stringParam('input', body.input),
      stringParam('sandboxId', `sandbox-${Date.now()}`),
    ]
  );

  // In production, this invokes the Archytas executor (code sandbox, web research, etc.)
  // For now, mark as pending — async execution handles completion
  return created({ tool_call: result.records?.[0] });
}

async function handleGetArchytasSuggestions(ctx: RequestContext, sessionId: string, context: string) {
  // In production, LLM generates tool suggestions based on session context
  return success({ suggestions: [] });
}

async function handleGetArchytasSessionSummary(ctx: RequestContext, sessionId: string) {
  const result = await executeStatement(
    `SELECT * FROM dojo_archytas_tool_calls WHERE session_id = :sessionId ORDER BY created_at`,
    [stringParam('sessionId', sessionId)]
  );

  const calls = result.records || [];
  const successful = calls.filter((c: any) => c.status === 'completed').length;
  const failed = calls.filter((c: any) => c.status === 'failed').length;
  const toolTypes = [...new Set(calls.map((c: any) => c.tool_type))];
  const totalTime = calls.reduce((sum: number, c: any) => sum + (parseInt(c.execution_time_ms || '0', 10)), 0);

  return success({
    session_id: sessionId,
    total_tool_calls: calls.length,
    successful,
    failed,
    tools_used: toolTypes,
    total_execution_time_ms: totalTime,
    tool_calls: calls,
  });
}
