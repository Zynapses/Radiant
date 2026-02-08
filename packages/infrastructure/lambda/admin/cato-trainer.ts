/**
 * RADIANT v7.43.1 — Cato Trainer Lambda Handler
 * Safety training document management, search, chat, digest, and configuration.
 *
 * Routes: /admin/cato-trainer/*
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDbClient } from '../shared/db';
import { getAuthTenantId, getAuthUserId } from '../shared/utils';
import { createResponse, createErrorResponse } from '../shared/utils/response';
import { randomUUID } from 'crypto';

const db = getDbClient();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const path = event.path.replace(/^\/api\/admin\/cato-trainer/, '').replace(/^\/admin\/cato-trainer/, '');
  const method = event.httpMethod;

  try {
    const tenantId = getAuthTenantId(event);
    const userId = getAuthUserId(event);

    if (!tenantId) {
      return createErrorResponse('Tenant ID required', 401);
    }

    // Set tenant context for RLS
    await db.query(`SET app.current_tenant_id = '${tenantId}'`);

    // ─────────────────────────────────────────────────────────────────────
    // Libraries
    // ─────────────────────────────────────────────────────────────────────
    if (path.match(/^\/libraries\/[\w-]+$/) && method === 'GET') {
      const reqTenantId = path.split('/')[2];
      return getLibraries(reqTenantId);
    }

    if (path.match(/^\/libraries\/detail\/[\w-]+$/) && method === 'GET') {
      const libraryId = path.split('/')[3];
      return getLibraryDetail(libraryId);
    }

    if (path.match(/^\/libraries\/[\w-]+$/) && method === 'POST') {
      const reqTenantId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return createLibrary(reqTenantId, body);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Documents
    // ─────────────────────────────────────────────────────────────────────
    if (path.match(/^\/documents\/[\w-]+$/) && method === 'GET') {
      const libraryId = path.split('/')[2];
      return getDocuments(libraryId);
    }

    if (path.match(/^\/documents\/detail\/[\w-]+$/) && method === 'GET') {
      const documentId = path.split('/')[3];
      return getDocumentDetail(documentId);
    }

    if (path.match(/^\/documents\/[\w-]+\/upload$/) && method === 'POST') {
      const libraryId = path.split('/')[2];
      return uploadDocument(libraryId, tenantId, userId);
    }

    if (path.match(/^\/documents\/[\w-]+$/) && method === 'DELETE') {
      const documentId = path.split('/')[2];
      return deleteDocument(documentId);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Spaces
    // ─────────────────────────────────────────────────────────────────────
    if (path.match(/^\/spaces\/[\w-]+$/) && method === 'GET') {
      const reqTenantId = path.split('/')[2];
      return getSpaces(reqTenantId);
    }

    if (path.match(/^\/spaces\/[\w-]+$/) && method === 'POST') {
      const reqTenantId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return createSpace(reqTenantId, body);
    }

    if (path.match(/^\/spaces\/[\w-]+$/) && method === 'PUT') {
      const spaceId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return updateSpace(spaceId, body);
    }

    if (path.match(/^\/spaces\/[\w-]+$/) && method === 'DELETE') {
      const spaceId = path.split('/')[2];
      return deleteSpace(spaceId);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Search
    // ─────────────────────────────────────────────────────────────────────
    if (path.match(/^\/search\/[\w-]+$/) && method === 'POST') {
      const reqTenantId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return searchDocuments(reqTenantId, body);
    }

    if (path.match(/^\/links\/[\w-]+$/) && method === 'GET') {
      const documentId = path.split('/')[2];
      return getSmartLinks(documentId);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Chat (Grounded Q&A)
    // ─────────────────────────────────────────────────────────────────────
    if (path.match(/^\/chat\/[\w-]+\/session$/) && method === 'POST') {
      const reqTenantId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return createChatSession(reqTenantId, userId, body);
    }

    if (path.match(/^\/chat\/[\w-]+\/sessions$/) && method === 'GET') {
      const reqTenantId = path.split('/')[2];
      return getChatSessions(reqTenantId);
    }

    if (path.match(/^\/chat\/session\/[\w-]+$/) && method === 'GET') {
      const sessionId = path.split('/')[3];
      return getChatSession(sessionId);
    }

    if (path.match(/^\/chat\/[\w-]+\/message$/) && method === 'POST') {
      const sessionId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return sendChatMessage(sessionId, userId, body);
    }

    if (path.match(/^\/chat\/session\/[\w-]+$/) && method === 'DELETE') {
      const sessionId = path.split('/')[3];
      return deleteChatSession(sessionId);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Digest
    // ─────────────────────────────────────────────────────────────────────
    if (path.match(/^\/digest\/[\w-]+$/) && method === 'POST') {
      const reqTenantId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return generateDigest(reqTenantId, userId, body);
    }

    if (path.match(/^\/digest\/[\w-]+\/history$/) && method === 'GET') {
      const reqTenantId = path.split('/')[2];
      return getDigestHistory(reqTenantId);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Configuration
    // ─────────────────────────────────────────────────────────────────────
    if (path.match(/^\/config\/[\w-]+$/) && method === 'GET') {
      const reqTenantId = path.split('/')[2];
      return getConfig(reqTenantId);
    }

    if (path.match(/^\/config\/[\w-]+$/) && method === 'PUT') {
      const reqTenantId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      return updateConfig(reqTenantId, body);
    }

    return createErrorResponse(`Route not found: ${method} ${path}`, 404);
  } catch (error) {
    console.error('Cato Trainer handler error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
};

// =============================================================================
// Libraries
// =============================================================================

async function getLibraries(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `SELECT id, tenant_id, name, description,
            (SELECT count(*) FROM cato_trainer_documents d WHERE d.library_id = l.id) as document_count,
            (SELECT coalesce(sum(chunk_count), 0) FROM cato_trainer_documents d WHERE d.library_id = l.id) as chunk_count,
            (SELECT coalesce(sum(size_bytes), 0) FROM cato_trainer_documents d WHERE d.library_id = l.id) as total_size_bytes,
            embedding_model, status, created_at, updated_at
     FROM cato_trainer_libraries l
     WHERE tenant_id = $1
     ORDER BY created_at DESC`,
    [tenantId]
  );
  return createResponse({ success: true, libraries: result.rows });
}

async function getLibraryDetail(libraryId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `SELECT id, tenant_id, name, description, embedding_model, status, created_at, updated_at
     FROM cato_trainer_libraries WHERE id = $1`,
    [libraryId]
  );
  if (result.rows.length === 0) {
    return createErrorResponse('Library not found', 404);
  }
  return createResponse({ success: true, library: result.rows[0] });
}

async function createLibrary(tenantId: string, body: { name: string; description: string }): Promise<APIGatewayProxyResult> {
  const id = randomUUID();
  const result = await db.query(
    `INSERT INTO cato_trainer_libraries (id, tenant_id, name, description, embedding_model, status)
     VALUES ($1, $2, $3, $4, 'text-embedding-3-small', 'pending')
     RETURNING *`,
    [id, tenantId, body.name, body.description || '']
  );
  return createResponse({ success: true, library: result.rows[0] }, 201);
}

// =============================================================================
// Documents
// =============================================================================

async function getDocuments(libraryId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `SELECT id, library_id, filename, title, mime_type, size_bytes, chunk_count,
            page_count, summary, auto_tags, status, uploaded_at, processed_at
     FROM cato_trainer_documents
     WHERE library_id = $1
     ORDER BY uploaded_at DESC`,
    [libraryId]
  );
  return createResponse({ success: true, documents: result.rows });
}

async function getDocumentDetail(documentId: string): Promise<APIGatewayProxyResult> {
  const docResult = await db.query(
    `SELECT * FROM cato_trainer_documents WHERE id = $1`,
    [documentId]
  );
  if (docResult.rows.length === 0) {
    return createErrorResponse('Document not found', 404);
  }
  const chunkResult = await db.query(
    `SELECT id, document_id, chunk_index, content, page_number, section_title,
            embedding_vector_id, token_count
     FROM cato_trainer_chunks
     WHERE document_id = $1
     ORDER BY chunk_index`,
    [documentId]
  );
  return createResponse({
    success: true,
    document: docResult.rows[0],
    chunks: chunkResult.rows,
  });
}

async function uploadDocument(libraryId: string, tenantId: string, userId: string | undefined): Promise<APIGatewayProxyResult> {
  const id = randomUUID();
  const result = await db.query(
    `INSERT INTO cato_trainer_documents (id, library_id, filename, title, mime_type, size_bytes, chunk_count, status, uploaded_by)
     VALUES ($1, $2, 'upload-pending', 'Processing...', 'application/octet-stream', 0, 0, 'pending', $3)
     RETURNING *`,
    [id, libraryId, userId || null]
  );
  return createResponse({ success: true, document: result.rows[0] }, 201);
}

async function deleteDocument(documentId: string): Promise<APIGatewayProxyResult> {
  await db.query(`DELETE FROM cato_trainer_chunks WHERE document_id = $1`, [documentId]);
  await db.query(`DELETE FROM cato_trainer_documents WHERE id = $1`, [documentId]);
  return createResponse({ success: true });
}

// =============================================================================
// Spaces
// =============================================================================

async function getSpaces(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `SELECT * FROM cato_trainer_spaces WHERE tenant_id = $1 ORDER BY created_at`,
    [tenantId]
  );
  return createResponse({ success: true, spaces: result.rows });
}

async function createSpace(tenantId: string, body: Record<string, unknown>): Promise<APIGatewayProxyResult> {
  const id = randomUUID();
  const result = await db.query(
    `INSERT INTO cato_trainer_spaces (id, tenant_id, name, description, icon, color, document_ids, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, false)
     RETURNING *`,
    [id, tenantId, body.name, body.description || '', body.icon || '📁', body.color || '#6366f1', JSON.stringify(body.document_ids || [])]
  );
  return createResponse({ success: true, space: result.rows[0] }, 201);
}

async function updateSpace(spaceId: string, body: Record<string, unknown>): Promise<APIGatewayProxyResult> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const key of ['name', 'description', 'icon', 'color', 'document_ids']) {
    if (body[key] !== undefined) {
      setClauses.push(`${key} = $${idx}`);
      values.push(key === 'document_ids' ? JSON.stringify(body[key]) : body[key]);
      idx++;
    }
  }

  if (setClauses.length === 0) {
    return createErrorResponse('No fields to update', 400);
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(spaceId);

  const result = await db.query(
    `UPDATE cato_trainer_spaces SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  if (result.rows.length === 0) {
    return createErrorResponse('Space not found', 404);
  }
  return createResponse({ success: true, space: result.rows[0] });
}

async function deleteSpace(spaceId: string): Promise<APIGatewayProxyResult> {
  await db.query(`DELETE FROM cato_trainer_spaces WHERE id = $1`, [spaceId]);
  return createResponse({ success: true });
}

// =============================================================================
// Search
// =============================================================================

async function searchDocuments(tenantId: string, body: Record<string, unknown>): Promise<APIGatewayProxyResult> {
  const query = body.query as string;
  const limit = (body.limit as number) || 20;
  const mode = (body.mode as string) || 'fulltext';

  // Full-text search with ts_rank scoring
  const result = await db.query(
    `SELECT d.id, d.filename, d.title, d.mime_type, d.size_bytes, d.auto_tags,
            c.id as chunk_id, c.chunk_index, c.content, c.page_number, c.section_title, c.token_count,
            ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', $1)) as relevance_score
     FROM cato_trainer_chunks c
     JOIN cato_trainer_documents d ON d.id = c.document_id
     JOIN cato_trainer_libraries l ON l.id = d.library_id
     WHERE l.tenant_id = $2
       AND to_tsvector('english', c.content) @@ plainto_tsquery('english', $1)
     ORDER BY relevance_score DESC
     LIMIT $3`,
    [query, tenantId, limit]
  );

  const results = result.rows.map((row: Record<string, unknown>) => ({
    id: row.chunk_id,
    document: {
      id: row.id,
      filename: row.filename,
      title: row.title,
      mime_type: row.mime_type,
      size_bytes: row.size_bytes,
      auto_tags: row.auto_tags,
    },
    chunk: {
      id: row.chunk_id,
      chunk_index: row.chunk_index,
      content: row.content,
      page_number: row.page_number,
      section_title: row.section_title,
      token_count: row.token_count,
    },
    relevance_score: row.relevance_score,
    highlight: (row.content as string).substring(0, 200),
    matched_terms: [],
  }));

  return createResponse({
    success: true,
    response: {
      results,
      total_count: results.length,
      query_time_ms: 0,
      mode_used: mode,
    },
  });
}

async function getSmartLinks(documentId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `SELECT * FROM cato_trainer_smart_links
     WHERE source_document_id = $1 OR target_document_id = $1
     ORDER BY confidence DESC`,
    [documentId]
  );
  return createResponse({ success: true, links: result.rows });
}

// =============================================================================
// Chat
// =============================================================================

async function createChatSession(tenantId: string, userId: string | undefined, body: Record<string, unknown>): Promise<APIGatewayProxyResult> {
  const id = randomUUID();
  const result = await db.query(
    `INSERT INTO cato_trainer_chat_sessions (id, tenant_id, user_id, title, library_id, space_id, scope_document_ids)
     VALUES ($1, $2, $3, 'New Chat', $4, $5, $6)
     RETURNING *`,
    [id, tenantId, userId || null, body.library_id || null, body.space_id || null, JSON.stringify(body.scope_document_ids || [])]
  );
  return createResponse({ success: true, session: { ...result.rows[0], messages: [] } }, 201);
}

async function getChatSessions(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `SELECT * FROM cato_trainer_chat_sessions WHERE tenant_id = $1 ORDER BY updated_at DESC`,
    [tenantId]
  );
  return createResponse({ success: true, sessions: result.rows });
}

async function getChatSession(sessionId: string): Promise<APIGatewayProxyResult> {
  const sessionResult = await db.query(
    `SELECT * FROM cato_trainer_chat_sessions WHERE id = $1`,
    [sessionId]
  );
  if (sessionResult.rows.length === 0) {
    return createErrorResponse('Session not found', 404);
  }
  const msgResult = await db.query(
    `SELECT * FROM cato_trainer_chat_messages WHERE session_id = $1 ORDER BY created_at`,
    [sessionId]
  );
  return createResponse({
    success: true,
    session: { ...sessionResult.rows[0], messages: msgResult.rows },
  });
}

async function sendChatMessage(sessionId: string, userId: string | undefined, body: { content: string }): Promise<APIGatewayProxyResult> {
  // Store user message
  const userMsgId = randomUUID();
  await db.query(
    `INSERT INTO cato_trainer_chat_messages (id, session_id, role, content, citations, grounded, thinking_steps)
     VALUES ($1, $2, 'user', $3, '[]'::jsonb, false, '[]'::jsonb)`,
    [userMsgId, sessionId, body.content]
  );

  // Generate grounded response using document context
  // In production this would call the model router with RAG context
  const assistantMsgId = randomUUID();
  const assistantResult = await db.query(
    `INSERT INTO cato_trainer_chat_messages (id, session_id, role, content, citations, grounded, confidence_score, thinking_steps)
     VALUES ($1, $2, 'assistant', $3, '[]'::jsonb, true, 0.85, '["Retrieved relevant chunks", "Synthesized answer from documents"]'::jsonb)
     RETURNING *`,
    [assistantMsgId, sessionId, `Based on the training documents, here is a grounded response to: "${body.content}". This endpoint will use RAG-based inference in production.`]
  );

  // Update session timestamp
  await db.query(`UPDATE cato_trainer_chat_sessions SET updated_at = NOW() WHERE id = $1`, [sessionId]);

  return createResponse({ success: true, message: assistantResult.rows[0] });
}

async function deleteChatSession(sessionId: string): Promise<APIGatewayProxyResult> {
  await db.query(`DELETE FROM cato_trainer_chat_messages WHERE session_id = $1`, [sessionId]);
  await db.query(`DELETE FROM cato_trainer_chat_sessions WHERE id = $1`, [sessionId]);
  return createResponse({ success: true });
}

// =============================================================================
// Digest
// =============================================================================

async function generateDigest(tenantId: string, userId: string | undefined, body: Record<string, unknown>): Promise<APIGatewayProxyResult> {
  const id = randomUUID();
  const digestType = body.digest_type as string || 'summary';
  const documentIds = body.document_ids as string[] || [];

  // In production, this would invoke the model router for multi-document synthesis
  const result = await db.query(
    `INSERT INTO cato_trainer_digests (id, tenant_id, user_id, digest_type, title, content, citations, document_count)
     VALUES ($1, $2, $3, $4, $5, $6, '[]'::jsonb, $7)
     RETURNING *`,
    [
      id, tenantId, userId || null, digestType,
      `${digestType.charAt(0).toUpperCase() + digestType.slice(1)} of ${documentIds.length} documents`,
      `This is a ${digestType} digest of ${documentIds.length} document(s). In production, this will use RAG-based multi-document synthesis.`,
      documentIds.length,
    ]
  );

  return createResponse({ success: true, digest: result.rows[0] }, 201);
}

async function getDigestHistory(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `SELECT * FROM cato_trainer_digests WHERE tenant_id = $1 ORDER BY generated_at DESC LIMIT 50`,
    [tenantId]
  );
  return createResponse({ success: true, digests: result.rows });
}

// =============================================================================
// Configuration
// =============================================================================

async function getConfig(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `SELECT * FROM cato_trainer_config WHERE tenant_id = $1`,
    [tenantId]
  );

  if (result.rows.length === 0) {
    // Return defaults
    return createResponse({
      success: true,
      config: {
        tenant_id: tenantId,
        enabled: true,
        ai_model: 'anthropic/claude-sonnet-4-20250514',
        embedding_model: 'text-embedding-3-small',
        max_documents_per_library: 500,
        max_file_size_mb: 50,
        auto_tagging_enabled: true,
        smart_linking_enabled: true,
        digest_enabled: true,
        default_search_mode: 'hybrid',
        citation_threshold: 0.7,
      },
    });
  }

  return createResponse({ success: true, config: result.rows[0] });
}

async function updateConfig(tenantId: string, body: Record<string, unknown>): Promise<APIGatewayProxyResult> {
  const result = await db.query(
    `INSERT INTO cato_trainer_config (tenant_id, enabled, ai_model, embedding_model,
       max_documents_per_library, max_file_size_mb, auto_tagging_enabled,
       smart_linking_enabled, digest_enabled, default_search_mode, citation_threshold)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (tenant_id)
     DO UPDATE SET
       enabled = COALESCE($2, cato_trainer_config.enabled),
       ai_model = COALESCE($3, cato_trainer_config.ai_model),
       embedding_model = COALESCE($4, cato_trainer_config.embedding_model),
       max_documents_per_library = COALESCE($5, cato_trainer_config.max_documents_per_library),
       max_file_size_mb = COALESCE($6, cato_trainer_config.max_file_size_mb),
       auto_tagging_enabled = COALESCE($7, cato_trainer_config.auto_tagging_enabled),
       smart_linking_enabled = COALESCE($8, cato_trainer_config.smart_linking_enabled),
       digest_enabled = COALESCE($9, cato_trainer_config.digest_enabled),
       default_search_mode = COALESCE($10, cato_trainer_config.default_search_mode),
       citation_threshold = COALESCE($11, cato_trainer_config.citation_threshold),
       updated_at = NOW()
     RETURNING *`,
    [
      tenantId,
      body.enabled ?? true,
      body.ai_model ?? 'anthropic/claude-sonnet-4-20250514',
      body.embedding_model ?? 'text-embedding-3-small',
      body.max_documents_per_library ?? 500,
      body.max_file_size_mb ?? 50,
      body.auto_tagging_enabled ?? true,
      body.smart_linking_enabled ?? true,
      body.digest_enabled ?? true,
      body.default_search_mode ?? 'hybrid',
      body.citation_threshold ?? 0.7,
    ]
  );

  return createResponse({ success: true, config: result.rows[0] });
}
