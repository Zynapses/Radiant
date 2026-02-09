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
import { modelRouterService } from '../shared/services/model-router.service';

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

async function getDojoAiModel(tenantId: string): Promise<string> {
  const result = await executeStatement(
    `SELECT ai_model FROM dojo_config WHERE tenant_id = :tenantId`,
    [stringParam('tenantId', tenantId)]
  );
  return (result as any).rows?.[0]?.ai_model || 'claude-sonnet-4-20250514';
}

async function invokeDojoLLM(
  tenantId: string,
  prompt: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const modelId = await getDojoAiModel(tenantId);
  const response = await modelRouterService.invoke({
    tenantId,
    modelId: `anthropic/${modelId}`,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: options?.maxTokens || 2000,
    temperature: options?.temperature || 0.3,
  });
  return response.content;
}

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
  return success({ libraries: result.rows || [] });
}

async function handleCreateLibrary(ctx: RequestContext, tenantId: string, body: { name: string; description: string }) {
  const result = await executeStatement(
    `INSERT INTO dojo_libraries (tenant_id, name, description)
     VALUES (:tenantId, :name, :description)
     RETURNING *`,
    [stringParam('tenantId', tenantId), stringParam('name', body.name), stringParam('description', body.description || '')]
  );
  return created({ library: result.rows?.[0] });
}

async function handleGetDocuments(ctx: RequestContext, libraryId: string) {
  const result = await executeStatement(
    `SELECT * FROM dojo_documents WHERE library_id = :libraryId ORDER BY uploaded_at DESC`,
    [stringParam('libraryId', libraryId)]
  );
  return success({ documents: result.rows || [] });
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

  return created({ document: result.rows?.[0] });
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

  if (existing.rows && existing.rows.length > 0) {
    return success({
      library_id: libraryId,
      themes: existing.rows,
      discovery_model: 'claude-sonnet-4-20250514',
      analyzed_chunks: 0,
    });
  }

  // Mark library as analyzing
  await executeStatement(
    `UPDATE dojo_libraries SET status = 'analyzing', updated_at = NOW() WHERE id = :libraryId`,
    [stringParam('libraryId', libraryId)]
  );

  // Fetch all document chunks for this library
  const chunksResult = await executeStatement(
    `SELECT dc.id, dc.content, dc.chunk_index, dd.title as doc_title
     FROM dojo_document_chunks dc
     JOIN dojo_documents dd ON dd.id = dc.document_id
     WHERE dd.library_id = :libraryId
     ORDER BY dd.title, dc.chunk_index
     LIMIT 200`,
    [stringParam('libraryId', libraryId)]
  );

  const chunks = (chunksResult as any).rows || [];
  if (chunks.length === 0) {
    await executeStatement(
      `UPDATE dojo_libraries SET status = 'ready', updated_at = NOW() WHERE id = :libraryId`,
      [stringParam('libraryId', libraryId)]
    );
    return success({ library_id: libraryId, themes: [], discovery_model: 'none', analyzed_chunks: 0, message: 'No document chunks found to analyze' });
  }

  // Build content summary for LLM (cap at ~50k chars)
  const contentSummary = chunks.map((c: any, i: number) =>
    `[Chunk ${i + 1} from "${c.doc_title}"]: ${(c.content || '').substring(0, 500)}`
  ).join('\n\n').substring(0, 50000);

  const prompt = `You are an expert curriculum designer. Analyze the following document chunks from a training library and identify 10-15 Central Themes (core topics that the material covers).

DOCUMENT CHUNKS:
${contentSummary}

For each theme, provide:
1. A clear, concise name (2-5 words)
2. A description (1-2 sentences explaining what this theme covers)
3. A difficulty tier: "beginner", "intermediate", or "advanced"
4. Estimated number of lessons needed (1-10)

Return ONLY a JSON array:
[
  {
    "name": "Theme Name",
    "description": "What this theme covers",
    "difficulty_tier": "beginner|intermediate|advanced",
    "estimated_lessons": 3
  }
]`;

  try {
    const llmResponse = await invokeDojoLLM(ctx.tenantId, prompt, { maxTokens: 3000 });
    const jsonMatch = llmResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('LLM did not return valid JSON array');
    }

    const themes = JSON.parse(jsonMatch[0]);
    const storedThemes: any[] = [];

    for (const theme of themes.slice(0, 15)) {
      const insertResult = await executeStatement(
        `INSERT INTO dojo_themes (library_id, name, description, difficulty_tier, estimated_lessons, source_chunk_ids)
         VALUES (:libraryId, :name, :description, :tier::dojo_difficulty_tier, :lessons, '{}')
         RETURNING *`,
        [
          stringParam('libraryId', libraryId),
          stringParam('name', theme.name || 'Unnamed Theme'),
          stringParam('description', theme.description || ''),
          stringParam('tier', theme.difficulty_tier || 'intermediate'),
          longParam('lessons', theme.estimated_lessons || 3),
        ]
      );
      if ((insertResult as any).rows?.[0]) {
        storedThemes.push((insertResult as any).rows[0]);
      }
    }

    // Mark library as ready
    await executeStatement(
      `UPDATE dojo_libraries SET status = 'ready', updated_at = NOW() WHERE id = :libraryId`,
      [stringParam('libraryId', libraryId)]
    );

    return success({
      library_id: libraryId,
      themes: storedThemes,
      discovery_model: await getDojoAiModel(ctx.tenantId),
      analyzed_chunks: chunks.length,
    });
  } catch (error) {
    // Revert library status on failure
    await executeStatement(
      `UPDATE dojo_libraries SET status = 'error', updated_at = NOW() WHERE id = :libraryId`,
      [stringParam('libraryId', libraryId)]
    );
    logger.error('Theme discovery failed', { libraryId, error: String(error) });
    return serverError(`Theme discovery failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleGetThemes(ctx: RequestContext, libraryId: string) {
  const result = await executeStatement(
    `SELECT * FROM dojo_themes WHERE library_id = :libraryId ORDER BY difficulty_tier, name`,
    [stringParam('libraryId', libraryId)]
  );
  return success({ themes: result.rows || [] });
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
  return created({ session: result.rows?.[0] });
}

async function handleGetSession(ctx: RequestContext, sessionId: string) {
  const result = await executeStatement(
    `SELECT * FROM dojo_sessions WHERE id = :sessionId`,
    [stringParam('sessionId', sessionId)]
  );
  if (!result.rows?.length) return notFound('Session not found');
  return success({ session: result.rows[0] });
}

async function handleGetLessonBlocks(ctx: RequestContext, sessionId: string) {
  const result = await executeStatement(
    `SELECT * FROM dojo_lesson_blocks WHERE session_id = :sessionId ORDER BY sequence`,
    [stringParam('sessionId', sessionId)]
  );
  return success({ blocks: result.rows || [] });
}

async function handleNextLesson(ctx: RequestContext, sessionId: string) {
  // In production, this invokes LLM to generate the next lesson block based on
  // the session's themes and the user's progress.
  // For now, returns existing blocks or throws.
  const existing = await executeStatement(
    `SELECT COUNT(*) as count FROM dojo_lesson_blocks WHERE session_id = :sessionId`,
    [stringParam('sessionId', sessionId)]
  );
  const seq = parseInt(String(existing.rows?.[0]?.count || '0'), 10);

  // Get session details including themes
  const sessionResult = await executeStatement(
    `SELECT s.*, array_to_json(s.theme_ids) as theme_id_list
     FROM dojo_sessions s WHERE s.id = :sessionId`,
    [stringParam('sessionId', sessionId)]
  );
  const session = (sessionResult as any).rows?.[0];
  if (!session) return notFound('Session not found');

  // Get theme details
  const themeIds = JSON.parse(session.theme_id_list || '[]');
  const themeResult = await executeStatement(
    `SELECT * FROM dojo_themes WHERE id = ANY(:themeIds::UUID[])`,
    [stringParam('themeIds', `{${themeIds.join(',')}}`)]
  );
  const themes = (themeResult as any).rows || [];

  // Get relevant chunks for these themes
  const chunkResult = await executeStatement(
    `SELECT dc.content, dc.chunk_index, dd.title as doc_title
     FROM dojo_document_chunks dc
     JOIN dojo_documents dd ON dd.id = dc.document_id
     WHERE dd.library_id = :libraryId
     ORDER BY dc.chunk_index
     LIMIT 30`,
    [stringParam('libraryId', session.library_id)]
  );
  const chunks = (chunkResult as any).rows || [];

  const themeNames = themes.map((t: any) => t.name).join(', ');
  const chunkContent = chunks.map((c: any) => `[${c.doc_title}]: ${(c.content || '').substring(0, 400)}`).join('\n').substring(0, 20000);

  const prompt = `You are a Sensei AI tutor. Generate lesson #${seq + 1} for a training session on these themes: ${themeNames}.

SOURCE MATERIAL:
${chunkContent}

Create a structured lesson block with:
1. A title for this lesson
2. The main content (educational, clear, engaging, 300-500 words)
3. Key takeaways (3-5 bullet points)
4. Source citations referencing the documents used

Return JSON:
{
  "title": "Lesson title",
  "content": "Main lesson content in markdown",
  "key_takeaways": ["takeaway 1", "takeaway 2"],
  "source_citations": ["Document Title, section X"],
  "difficulty": "beginner|intermediate|advanced"
}`;

  try {
    const llmResponse = await invokeDojoLLM(ctx.tenantId, prompt, { maxTokens: 2500 });
    const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid lesson response format');

    const lesson = JSON.parse(jsonMatch[0]);
    const blockResult = await executeStatement(
      `INSERT INTO dojo_lesson_blocks (session_id, sequence, block_type, title, content, source_citations)
       VALUES (:sessionId, :seq, 'lesson', :title, :content, :citations::JSONB)
       RETURNING *`,
      [
        stringParam('sessionId', sessionId),
        longParam('seq', seq + 1),
        stringParam('title', lesson.title || `Lesson ${seq + 1}`),
        stringParam('content', lesson.content || ''),
        stringParam('citations', JSON.stringify(lesson.source_citations || [])),
      ]
    );

    return success({ block: (blockResult as any).rows?.[0], key_takeaways: lesson.key_takeaways || [] });
  } catch (error) {
    logger.error('Lesson generation failed', { sessionId, error: String(error) });
    return serverError(`Lesson generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleGetSparringQuestion(ctx: RequestContext, sessionId: string) {
  // In production, this invokes the Adversarial agent to generate a contextual question.
  const result = await executeStatement(
    `SELECT * FROM dojo_sparring_questions WHERE session_id = :sessionId ORDER BY created_at DESC LIMIT 1`,
    [stringParam('sessionId', sessionId)]
  );
  if (result.rows?.length) {
    return success({ question: result.rows[0] });
  }
  // Get session and theme context
  const sessionResult = await executeStatement(
    `SELECT s.*, array_to_json(s.theme_ids) as theme_id_list FROM dojo_sessions s WHERE s.id = :sessionId`,
    [stringParam('sessionId', sessionId)]
  );
  const session = (sessionResult as any).rows?.[0];
  if (!session) return notFound('Session not found');

  const themeIds = JSON.parse(session.theme_id_list || '[]');
  const themeResult = await executeStatement(
    `SELECT * FROM dojo_themes WHERE id = ANY(:themeIds::UUID[])`,
    [stringParam('themeIds', `{${themeIds.join(',')}}`)]
  );
  const themes = (themeResult as any).rows || [];

  // Get source chunks for grounding
  const chunkResult = await executeStatement(
    `SELECT dc.content, dd.title as doc_title FROM dojo_document_chunks dc
     JOIN dojo_documents dd ON dd.id = dc.document_id
     WHERE dd.library_id = :libraryId ORDER BY RANDOM() LIMIT 10`,
    [stringParam('libraryId', session.library_id)]
  );
  const chunks = (chunkResult as any).rows || [];

  const questionsAsked = parseInt(session.questions_asked || '0', 10);
  const accuracy = parseInt(session.questions_asked || '0', 10) > 0
    ? parseInt(session.questions_correct || '0', 10) / parseInt(session.questions_asked || '1', 10)
    : 0.5;
  const difficultyHint = accuracy > 0.8 ? 'harder' : accuracy < 0.4 ? 'easier' : 'moderate';

  const themeNames = themes.map((t: any) => t.name).join(', ');
  const chunkContent = chunks.map((c: any) => `[${c.doc_title}]: ${(c.content || '').substring(0, 300)}`).join('\n').substring(0, 15000);

  const prompt = `You are an Adversarial training agent. Generate a ${difficultyHint} difficulty question (#${questionsAsked + 1}) testing knowledge of: ${themeNames}.

SOURCE MATERIAL:
${chunkContent}

The question must be grounded in the source material. Include the correct answer and a brief explanation.

Return JSON:
{
  "question": "The question text",
  "question_type": "multiple_choice|open_ended|true_false",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "correct_answer": "The correct answer text",
  "explanation": "Why this is correct, citing the source",
  "difficulty": 1-5,
  "source_citations": ["Document, relevant section"]
}`;

  try {
    const llmResponse = await invokeDojoLLM(ctx.tenantId, prompt, { maxTokens: 1500 });
    const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid question format');

    const q = JSON.parse(jsonMatch[0]);
    const qResult = await executeStatement(
      `INSERT INTO dojo_sparring_questions (session_id, tenant_id, question, question_type, options, correct_answer, explanation, difficulty, source_citations)
       VALUES (:sessionId, :tenantId, :question, :qType, :options::JSONB, :answer, :explanation, :difficulty, :citations::JSONB)
       RETURNING *`,
      [
        stringParam('sessionId', sessionId),
        stringParam('tenantId', ctx.tenantId),
        stringParam('question', q.question || ''),
        stringParam('qType', q.question_type || 'open_ended'),
        stringParam('options', JSON.stringify(q.options || [])),
        stringParam('answer', q.correct_answer || ''),
        stringParam('explanation', q.explanation || ''),
        longParam('difficulty', q.difficulty || 3),
        stringParam('citations', JSON.stringify(q.source_citations || [])),
      ]
    );

    return success({ question: (qResult as any).rows?.[0] });
  } catch (error) {
    logger.error('Sparring question generation failed', { sessionId, error: String(error) });
    return serverError(`Question generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleSubmitSparringAnswer(ctx: RequestContext, sessionId: string, body: { question_id: string; answer: string; time_taken_seconds: number }) {
  // Look up the question
  const qResult = await executeStatement(
    `SELECT * FROM dojo_sparring_questions WHERE id = :questionId`,
    [stringParam('questionId', body.question_id)]
  );
  if (!qResult.rows?.length) return notFound('Question not found');
  const question = qResult.rows[0];

  // In production, LLM evaluates open-ended answers. For multiple choice, direct comparison.
  const correct = (body.answer.toLowerCase().trim() === String(question.correct_answer || '').toLowerCase().trim());
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
  if (!result.rows?.length) return notFound('Session not found');

  const session = result.rows[0];

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
      longParam('xp', parseInt(String(session.xp_earned || '0'), 10)),
    ]
  );

  return success({
    session,
    xp_summary: {
      total: parseInt(String(session.xp_earned || '0'), 10),
      breakdown: { sparring: parseInt(String(session.xp_earned || '0'), 10) },
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

  const base = progressResult.rows?.[0] || {
    user_id: userId, overall_rank: 'novice', overall_xp: 0, total_sessions: 0,
    total_time_minutes: 0, streak_days: 0,
  };

  return success({
    progress: {
      ...base,
      theme_progress: themeResult.rows || [],
      recent_sessions: sessionsResult.rows || [],
      certifications: certResult.rows || [],
      xp_to_next_rank: calculateXpToNextRank(String(base.overall_rank), parseInt(String(base.overall_xp || '0'), 10)),
    },
  });
}

async function handleGetThemeProgress(ctx: RequestContext, tenantId: string, userId: string, themeId: string) {
  const result = await executeStatement(
    `SELECT * FROM dojo_theme_progress WHERE tenant_id = :tenantId AND user_id = :userId AND theme_id = :themeId`,
    [stringParam('tenantId', tenantId), stringParam('userId', userId), stringParam('themeId', themeId)]
  );
  if (!result.rows?.length) {
    return success({ progress: { theme_id: themeId, rank: 'novice', xp: 0, mastery_percentage: 0, questions_attempted: 0, questions_correct: 0, accuracy: 0, last_session_at: null, weaknesses: [], strengths: [] } });
  }
  return success({ progress: result.rows[0] });
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
  if (!sessionResult.rows?.length) return notFound('Theme not found');
  return success({
    session_id: sessionResult.rows[0].id,
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
  return success({ certifications: result.rows || [] });
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

  // Get session to find library
  const sessionResult = await executeStatement(
    `SELECT library_id FROM dojo_sessions WHERE id = :sessionId`,
    [stringParam('sessionId', sessionId)]
  );
  const session = (sessionResult as any).rows?.[0];
  if (!session) return notFound('Session not found');

  // Get relevant chunks for the question
  const chunkResult = await executeStatement(
    `SELECT dc.content, dd.title as doc_title FROM dojo_document_chunks dc
     JOIN dojo_documents dd ON dd.id = dc.document_id
     WHERE dd.library_id = :libraryId
     ORDER BY RANDOM() LIMIT 15`,
    [stringParam('libraryId', session.library_id)]
  );
  const chunks = (chunkResult as any).rows || [];

  // Get conversation history
  const historyResult = await executeStatement(
    `SELECT role, content FROM dojo_mobot_messages WHERE session_id = :sessionId ORDER BY created_at DESC LIMIT 10`,
    [stringParam('sessionId', sessionId)]
  );
  const history = ((historyResult as any).rows || []).reverse();
  const historyText = history.map((h: any) => `${h.role}: ${h.content}`).join('\n');

  const chunkContent = chunks.map((c: any) => `[${c.doc_title}]: ${(c.content || '').substring(0, 400)}`).join('\n').substring(0, 20000);

  const prompt = `You are the Mobot Knowledge Agent, an AI tutor assistant. Answer the user's question using ONLY the source material provided. Always cite your sources.

CONVERSATION HISTORY:
${historyText || 'No prior messages.'}

SOURCE MATERIAL:
${chunkContent}

USER QUESTION: ${body.message}

Rules:
1. Ground your answer in the source material
2. Cite sources in [brackets]
3. If the source material doesn't cover the question, say so honestly
4. Be educational and encouraging`;

  try {
    const llmResponse = await invokeDojoLLM(ctx.tenantId, prompt, { maxTokens: 1500 });

    // Store assistant response
    await executeStatement(
      `INSERT INTO dojo_mobot_messages (session_id, tenant_id, role, content)
       VALUES (:sessionId, :tenantId, 'assistant', :content)`,
      [stringParam('sessionId', sessionId), stringParam('tenantId', ctx.tenantId), stringParam('content', llmResponse)]
    );

    return success({ response: { role: 'assistant', content: llmResponse } });
  } catch (error) {
    logger.error('Mobot response failed', { sessionId, error: String(error) });
    return serverError(`Mobot response failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleGetMobotHistory(ctx: RequestContext, sessionId: string) {
  const result = await executeStatement(
    `SELECT * FROM dojo_mobot_messages WHERE session_id = :sessionId ORDER BY created_at ASC`,
    [stringParam('sessionId', sessionId)]
  );
  return success({ messages: result.rows || [] });
}

// =============================================================================
// Config Handlers
// =============================================================================

async function handleGetConfig(ctx: RequestContext, tenantId: string) {
  const result = await executeStatement(
    `SELECT * FROM dojo_config WHERE tenant_id = :tenantId`,
    [stringParam('tenantId', tenantId)]
  );
  if (!result.rows?.length) {
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
  return success({ config: result.rows[0] });
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
  return success({ config: result.rows?.[0] });
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

  const records = curves.rows || [];
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
      total_atoms: parseInt(String(atomCount.rows?.[0]?.total || '0'), 10),
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
  const records = result.rows || [];

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
      atoms: (result.rows || []).map((r: any) => ({
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
  if (!curveResult.rows?.length) return notFound('Decay curve not found for this atom');

  const curveId = String(curveResult.rows[0].id);
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
    updated_curve: updated.rows?.[0],
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

  return created({ scenario: { ...result.rows?.[0], persona, branches: [] } });
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

  const scenario = (scenarioResult as any).rows?.[0];
  if (!scenario) return notFound('Scenario not found');

  const persona = typeof scenario.persona === 'string' ? JSON.parse(scenario.persona) : scenario.persona;
  const branchHistory = await executeStatement(
    `SELECT learner_response, persona_message, turn_number FROM dojo_scenario_branches
     WHERE scenario_id = :scenarioId ORDER BY turn_number ASC`,
    [stringParam('scenarioId', scenarioId)]
  );
  const branches = (branchHistory as any).rows || [];
  const historyText = branches.map((b: any) =>
    `Turn ${b.turn_number}:\nLearner: ${b.learner_response}\nPersona: ${b.persona_message}`
  ).join('\n\n');

  const prompt = `You are playing the role of "${persona.name}", a ${persona.archetype.replace(/_/g, ' ')}.
Backstory: ${persona.backstory}
Current emotional state: ${persona.emotional_state}
Communication style: ${persona.communication_style}
Hidden objectives: ${(persona.hidden_objectives || []).join(', ')}

SCENARIO: ${scenario.situation}
OBJECTIVE FOR LEARNER: ${scenario.objective}

CONVERSATION SO FAR:
${historyText || 'No prior turns.'}

LEARNER'S LATEST RESPONSE: "${responseText}"

Stay in character. React naturally based on your persona. Show emotional shifts if warranted.
Rate the learner's response quality.

Return JSON:
{
  "persona_response": "Your in-character response",
  "emotional_shift": "neutral|positive|negative|frustrated|satisfied",
  "consequence": "What happens as a result of the learner's action",
  "learner_score": 1-10,
  "feedback_hint": "Brief coaching hint (hidden from the persona interaction)"
}`;

  try {
    const llmResponse = await invokeDojoLLM(ctx.tenantId, prompt, { maxTokens: 1500, temperature: 0.7 });
    const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid scenario response format');

    const result = JSON.parse(jsonMatch[0]);

    // Update the branch with the persona's response
    const branch = (branchResult as any).rows?.[0];
    if (branch) {
      await executeStatement(
        `UPDATE dojo_scenario_branches SET persona_message = :message, consequence = :consequence,
         learner_score = :score WHERE id = :branchId`,
        [
          stringParam('message', result.persona_response || ''),
          stringParam('consequence', result.consequence || ''),
          longParam('score', result.learner_score || 5),
          stringParam('branchId', branch.id),
        ]
      );
    }

    return success({
      branch: {
        ...(branch || {}),
        persona_message: result.persona_response,
        consequence: result.consequence,
        learner_score: result.learner_score,
      },
      emotional_shift: result.emotional_shift,
      feedback_hint: result.feedback_hint,
    });
  } catch (error) {
    logger.error('Scenario response failed', { scenarioId, error: String(error) });
    return serverError(`Scenario response failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleConcludeScenario(ctx: RequestContext, scenarioId: string) {
  const result = await executeStatement(
    `UPDATE dojo_scenario_sessions SET status = 'completed', completed_at = NOW() WHERE id = :scenarioId RETURNING *`,
    [stringParam('scenarioId', scenarioId)]
  );
  if (!result.rows?.length) return notFound('Scenario not found');
  return success({ scenario: result.rows[0] });
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
  if (existing.rows?.length) {
    return success({ competencies: existing.rows });
  }
  // Get library themes for analysis
  const themeResult = await executeStatement(
    `SELECT name, description, difficulty_tier FROM dojo_themes WHERE library_id = :libraryId`,
    [stringParam('libraryId', libraryId)]
  );
  const themes = (themeResult as any).rows || [];
  if (themes.length === 0) return badRequest('No themes found. Run theme discovery first.');

  const themeList = themes.map((t: any) => `- ${t.name} (${t.difficulty_tier}): ${t.description}`).join('\n');

  const prompt = `You are a competency framework designer. Analyze these training themes and extract a competency graph.

THEMES:
${themeList}

For each competency, define:
1. Name (concise skill/knowledge area)
2. Category (technical, interpersonal, analytical, procedural)
3. Description
4. Max proficiency level (1-5)
5. Related theme names
6. Prerequisites (other competency names, if any)

Return JSON array:
[
  {
    "name": "Competency Name",
    "category": "technical|interpersonal|analytical|procedural",
    "description": "What this competency covers",
    "max_level": 5,
    "related_themes": ["Theme Name"],
    "prerequisites": []
  }
]`;

  try {
    const llmResponse = await invokeDojoLLM(ctx.tenantId, prompt, { maxTokens: 3000 });
    const jsonMatch = llmResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Invalid competency response format');

    const competencies = JSON.parse(jsonMatch[0]);
    const stored: any[] = [];

    for (const comp of competencies.slice(0, 30)) {
      const insertResult = await executeStatement(
        `INSERT INTO dojo_competencies (library_id, name, category, description, max_level, related_themes, prerequisites)
         VALUES (:libraryId, :name, :category, :description, :maxLevel, :themes::JSONB, :prereqs::JSONB)
         ON CONFLICT (library_id, name) DO UPDATE SET description = :description, category = :category, max_level = :maxLevel
         RETURNING *`,
        [
          stringParam('libraryId', libraryId),
          stringParam('name', comp.name || ''),
          stringParam('category', comp.category || 'technical'),
          stringParam('description', comp.description || ''),
          longParam('maxLevel', comp.max_level || 5),
          stringParam('themes', JSON.stringify(comp.related_themes || [])),
          stringParam('prereqs', JSON.stringify(comp.prerequisites || [])),
        ]
      );
      if ((insertResult as any).rows?.[0]) {
        stored.push((insertResult as any).rows[0]);
      }
    }

    return success({ competencies: stored });
  } catch (error) {
    logger.error('Competency extraction failed', { libraryId, error: String(error) });
    return serverError(`Competency extraction failed: ${error instanceof Error ? error.message : String(error)}`);
  }
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
      competencies: scoresResult.rows || [],
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
      team_gaps: result.rows || [],
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
  return created({ dialectic: { ...result.rows?.[0], turns: [] } });
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

  // Get dialectic context
  const dialecticResult = await executeStatement(
    `SELECT ds.*, dt.name as theme_name, dt.description as theme_description
     FROM dojo_dialectic_sessions ds
     LEFT JOIN dojo_themes dt ON dt.id = ds.theme_id
     WHERE ds.id = :dialecticId`,
    [stringParam('dialecticId', dialecticId)]
  );
  const dialectic = (dialecticResult as any).rows?.[0];
  if (!dialectic) return notFound('Dialectic session not found');

  // Get conversation history
  const turnsResult = await executeStatement(
    `SELECT role, content, reasoning_type FROM dojo_dialectic_turns
     WHERE dialectic_id = :dialecticId ORDER BY created_at ASC`,
    [stringParam('dialecticId', dialecticId)]
  );
  const turns = (turnsResult as any).rows || [];
  const turnHistory = turns.map((t: any) => `[${t.role} - ${t.reasoning_type}]: ${t.content}`).join('\n\n');

  const prompt = `You are a Socratic dialectic system conducting a philosophical inquiry.

PROPOSITION: "${dialectic.proposition}"
THEME: ${dialectic.theme_name || 'General'} - ${dialectic.theme_description || ''}

DIALOGUE SO FAR:
${turnHistory || 'No prior turns.'}

LEARNER'S LATEST ARGUMENT (${body.reasoning_type}): "${body.content}"

Respond with THREE perspectives:
1. THESIS AGENT: Strengthen the proposition, building on valid points
2. ANTITHESIS AGENT: Challenge the argument, find weaknesses
3. MODERATOR: Synthesize, identify logical fallacies, and guide deeper thinking

Also detect any logical fallacies in the learner's argument.

Return JSON:
{
  "thesis": {"content": "...", "reasoning_type": "support"},
  "antithesis": {"content": "...", "reasoning_type": "challenge"},
  "moderator": {"content": "...", "reasoning_type": "synthesis"},
  "fallacies_detected": ["fallacy name: explanation"],
  "dialectic_quality_score": 1-10,
  "suggested_next_inquiry": "A question to deepen the discussion"
}`;

  try {
    const llmResponse = await invokeDojoLLM(ctx.tenantId, prompt, { maxTokens: 2500, temperature: 0.5 });
    const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid dialectic response format');

    const result = JSON.parse(jsonMatch[0]);

    // Store the three agent responses
    const agentTurns = [
      { role: 'thesis_agent', ...result.thesis },
      { role: 'antithesis_agent', ...result.antithesis },
      { role: 'moderator', ...result.moderator },
    ];

    for (const turn of agentTurns) {
      await executeStatement(
        `INSERT INTO dojo_dialectic_turns (dialectic_id, tenant_id, role, content, reasoning_type)
         VALUES (:dialecticId, :tenantId, :role, :content, :reasoningType)`,
        [
          stringParam('dialecticId', dialecticId),
          stringParam('tenantId', ctx.tenantId),
          stringParam('role', turn.role),
          stringParam('content', turn.content || ''),
          stringParam('reasoningType', turn.reasoning_type || 'response'),
        ]
      );
    }

    return success({
      responses: agentTurns,
      fallacies_detected: result.fallacies_detected || [],
      dialectic_quality_score: result.dialectic_quality_score || 5,
      suggested_next_inquiry: result.suggested_next_inquiry || '',
    });
  } catch (error) {
    logger.error('Dialectic response failed', { dialecticId, error: String(error) });
    return serverError(`Dialectic response failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleConcludeDialectic(ctx: RequestContext, dialecticId: string) {
  const result = await executeStatement(
    `UPDATE dojo_dialectic_sessions SET status = 'concluded', completed_at = NOW() WHERE id = :dialecticId RETURNING *`,
    [stringParam('dialecticId', dialecticId)]
  );
  if (!result.rows?.length) return notFound('Dialectic session not found');

  const turns = await executeStatement(
    `SELECT * FROM dojo_dialectic_turns WHERE dialectic_id = :dialecticId ORDER BY created_at`,
    [stringParam('dialecticId', dialecticId)]
  );

  return success({ dialectic: { ...result.rows[0], turns: turns.rows || [] } });
}

// =============================================================================
// Multimodal Handlers
// =============================================================================

async function handleGetMultimodalContent(ctx: RequestContext, lessonId: string) {
  const result = await executeStatement(
    `SELECT * FROM dojo_multimodal_content WHERE lesson_id = :lessonId`,
    [stringParam('lessonId', lessonId)]
  );
  if (!result.rows?.length) {
    return success({ content: { lesson_id: lessonId, audio_url: null, audio_duration_seconds: null, diagrams: [], glossary: [], key_takeaways: [], learning_style_adaptations: {} } });
  }
  return success({ content: result.rows[0] });
}

async function handleGenerateMultimodal(ctx: RequestContext, lessonId: string, types: string[]) {
  // Get lesson content
  const lessonResult = await executeStatement(
    `SELECT * FROM dojo_lesson_blocks WHERE id = :lessonId`,
    [stringParam('lessonId', lessonId)]
  );
  const lesson = (lessonResult as any).rows?.[0];
  if (!lesson) return notFound('Lesson not found');

  const requestedTypes = types.length > 0 ? types : ['diagrams', 'glossary', 'key_takeaways'];

  const prompt = `Analyze this lesson content and generate multimodal learning aids.

LESSON TITLE: ${lesson.title || 'Untitled'}
LESSON CONTENT:
${(lesson.content || '').substring(0, 5000)}

Generate the following (only include requested types: ${requestedTypes.join(', ')}):

1. DIAGRAMS: Create 1-3 Mermaid diagram definitions that visualize key concepts
2. GLOSSARY: Extract 5-10 key terms with definitions
3. KEY_TAKEAWAYS: List 3-5 essential points to remember
4. LEARNING_STYLE_ADAPTATIONS: Suggest how to present this content for visual, auditory, and kinesthetic learners

Return JSON:
{
  "diagrams": [{"title": "...", "mermaid_code": "graph TD\\n  A-->B", "description": "..."}],
  "glossary": [{"term": "...", "definition": "..."}],
  "key_takeaways": ["..."],
  "learning_style_adaptations": {
    "visual": "How to present visually",
    "auditory": "How to present for listeners",
    "kinesthetic": "Hands-on activities"
  }
}`;

  try {
    const llmResponse = await invokeDojoLLM(ctx.tenantId, prompt, { maxTokens: 3000 });
    const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid multimodal response format');

    const content = JSON.parse(jsonMatch[0]);

    // Store multimodal content
    await executeStatement(
      `INSERT INTO dojo_multimodal_content (lesson_id, diagrams, glossary, key_takeaways, learning_style_adaptations)
       VALUES (:lessonId, :diagrams::JSONB, :glossary::JSONB, :takeaways::JSONB, :adaptations::JSONB)
       ON CONFLICT (lesson_id) DO UPDATE SET
         diagrams = :diagrams::JSONB, glossary = :glossary::JSONB,
         key_takeaways = :takeaways::JSONB, learning_style_adaptations = :adaptations::JSONB`,
      [
        stringParam('lessonId', lessonId),
        stringParam('diagrams', JSON.stringify(content.diagrams || [])),
        stringParam('glossary', JSON.stringify(content.glossary || [])),
        stringParam('takeaways', JSON.stringify(content.key_takeaways || [])),
        stringParam('adaptations', JSON.stringify(content.learning_style_adaptations || {})),
      ]
    );

    return success({ content: { lesson_id: lessonId, ...content } });
  } catch (error) {
    logger.error('Multimodal generation failed', { lessonId, error: String(error) });
    return serverError(`Multimodal generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// =============================================================================
// Knowledge Pulse Handlers
// =============================================================================

async function handleGetKnowledgePulse(ctx: RequestContext, tenantId: string) {
  const result = await executeStatement(
    `SELECT * FROM dojo_knowledge_pulse WHERE tenant_id = :tenantId ORDER BY snapshot_at DESC LIMIT 1`,
    [stringParam('tenantId', tenantId)]
  );
  if (!result.rows?.length) {
    // Generate a fresh pulse from current data
    const userCount = await executeStatement(
      `SELECT COUNT(DISTINCT user_id) as total FROM dojo_user_progress WHERE tenant_id = :tenantId`,
      [stringParam('tenantId', tenantId)]
    );
    return success({
      pulse: {
        tenant_id: tenantId, snapshot_at: new Date().toISOString(),
        overall_health: 0, 
        total_users: parseInt(String(userCount.rows?.[0]?.total || '0'), 10),
        active_users_30d: 0, department_health: [], theme_coverage: [], decay_alerts: [],
        trends: { knowledge_health_7d: [], knowledge_health_30d: [], training_hours_7d: [], new_certifications_7d: 0, avg_session_score_trend: 'flat' },
        roi_metrics: { estimated_cost_savings_monthly: 0, avg_time_to_competency_days: 0, certification_pass_rate: 0, knowledge_retention_rate: 0, training_hours_saved_vs_traditional: 0 },
      },
    });
  }
  return success({ pulse: result.rows[0] });
}

async function handleGetPulseHistory(ctx: RequestContext, tenantId: string, days: number) {
  const result = await executeStatement(
    `SELECT * FROM dojo_knowledge_pulse WHERE tenant_id = :tenantId AND snapshot_at >= NOW() - (:days || ' days')::INTERVAL ORDER BY snapshot_at DESC`,
    [stringParam('tenantId', tenantId), longParam('days', days)]
  );
  return success({ snapshots: result.rows || [] });
}

// =============================================================================
// Archytas Handlers
// =============================================================================

async function handleGetArchytasConfig(ctx: RequestContext, tenantId: string) {
  const result = await executeStatement(
    `SELECT archytas_config FROM dojo_config WHERE tenant_id = :tenantId`,
    [stringParam('tenantId', tenantId)]
  );
  const config = result.rows?.[0]?.archytas_config;
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
  return created({ tool_call: result.rows?.[0] });
}

async function handleGetArchytasSuggestions(ctx: RequestContext, sessionId: string, context: string) {
  // Get session's tool call history
  const historyResult = await executeStatement(
    `SELECT tool_type, input, status FROM dojo_archytas_tool_calls
     WHERE session_id = :sessionId ORDER BY created_at DESC LIMIT 5`,
    [stringParam('sessionId', sessionId)]
  );
  const recentCalls = (historyResult as any).rows || [];
  const historyText = recentCalls.map((c: any) => `[${c.tool_type}] ${c.input} → ${c.status}`).join('\n');

  // Get Archytas config for allowed tools
  const configResult = await executeStatement(
    `SELECT archytas_config FROM dojo_config WHERE tenant_id = :tenantId`,
    [stringParam('tenantId', ctx.tenantId)]
  );
  const config = (configResult as any).rows?.[0]?.archytas_config;
  const allowedTools = (typeof config === 'string' ? JSON.parse(config) : config)?.allowed_tools || ['code_execution', 'web_research', 'data_analysis', 'visualization'];

  const prompt = `You are the Archytas AI assistant. Based on the learning context, suggest relevant tools the learner could use.

AVAILABLE TOOLS: ${allowedTools.join(', ')}
RECENT TOOL USAGE:
${historyText || 'No tools used yet.'}

CURRENT CONTEXT: ${context || 'General learning session'}

Suggest 2-4 tool actions that would help the learner. Each suggestion should be actionable.

Return JSON array:
[
  {
    "tool_type": "code_execution|web_research|data_analysis|visualization",
    "suggested_input": "What to do with the tool",
    "rationale": "Why this would help",
    "priority": "high|medium|low"
  }
]`;

  try {
    const llmResponse = await invokeDojoLLM(ctx.tenantId, prompt, { maxTokens: 1000 });
    const jsonMatch = llmResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return success({ suggestions: [] });

    const suggestions = JSON.parse(jsonMatch[0]);
    return success({ suggestions: suggestions.slice(0, 4) });
  } catch (error) {
    logger.error('Archytas suggestions failed', { sessionId, error: String(error) });
    return success({ suggestions: [] });
  }
}

async function handleGetArchytasSessionSummary(ctx: RequestContext, sessionId: string) {
  const result = await executeStatement(
    `SELECT * FROM dojo_archytas_tool_calls WHERE session_id = :sessionId ORDER BY created_at`,
    [stringParam('sessionId', sessionId)]
  );

  const calls = result.rows || [];
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
