/**
 * Cortex Graph-RAG Knowledge Engine Admin API
 * 
 * Endpoints for managing the knowledge graph, entities, relationships, and RAG queries.
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../shared/response';
import { Logger } from '../shared/logger';
import { ValidationError, NotFoundError } from '../shared/errors';
import { query, transaction } from '../shared/db';
import type {
  CortexConfig,
  CortexDashboard,
  CortexStats,
  KnowledgeEntity,
  KnowledgeRelationship,
  KnowledgeChunk,
  GraphQueryResult,
  CortexCreateEntityRequest as CreateEntityRequest,
  UpdateEntityRequest,
  CortexCreateRelationshipRequest as CreateRelationshipRequest,
  IngestRequest,
  IngestResult,
} from '@radiant/shared';

const logger = new Logger({ handler: 'cortex-graph-rag' });

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const pathParts = event.path.split('/').filter(Boolean);
  const subPath = pathParts.slice(2).join('/');

  logger.info('Cortex Graph-RAG request', { method, path: event.path, subPath });

  try {
    // Dashboard
    if (subPath === 'dashboard' && method === 'GET') {
      return getDashboard(event);
    }

    // Configuration
    if (subPath === 'config' && method === 'GET') {
      return getConfig(event);
    }
    if (subPath === 'config' && method === 'PUT') {
      return updateConfig(event);
    }

    // Entities
    if (subPath === 'entities' && method === 'GET') {
      return listEntities(event);
    }
    if (subPath === 'entities' && method === 'POST') {
      return createEntity(event);
    }
    if (subPath.match(/^entities\/[^/]+$/) && method === 'GET') {
      return getEntity(event, pathParts[4]);
    }
    if (subPath.match(/^entities\/[^/]+$/) && method === 'PUT') {
      return updateEntity(event, pathParts[4]);
    }
    if (subPath.match(/^entities\/[^/]+$/) && method === 'DELETE') {
      return deleteEntity(event, pathParts[4]);
    }
    if (subPath.match(/^entities\/[^/]+\/neighbors$/) && method === 'GET') {
      return getEntityNeighbors(event, pathParts[4]);
    }

    // Relationships
    if (subPath === 'relationships' && method === 'GET') {
      return listRelationships(event);
    }
    if (subPath === 'relationships' && method === 'POST') {
      return createRelationship(event);
    }
    if (subPath.match(/^relationships\/[^/]+$/) && method === 'DELETE') {
      return deleteRelationship(event, pathParts[4]);
    }

    // Chunks
    if (subPath === 'chunks' && method === 'GET') {
      return listChunks(event);
    }

    // Search & Query
    if (subPath === 'search' && method === 'POST') {
      return searchGraph(event);
    }
    if (subPath === 'query' && method === 'POST') {
      return queryGraph(event);
    }

    // Ingest
    if (subPath === 'ingest' && method === 'POST') {
      return ingestContent(event);
    }

    // Merge entities
    if (subPath === 'merge' && method === 'POST') {
      return mergeEntities(event);
    }

    // Stats
    if (subPath === 'stats' && method === 'GET') {
      return getStats(event);
    }

    return errorResponse(new NotFoundError(`Unknown endpoint: ${method} ${event.path}`));
  } catch (error) {
    logger.error('Cortex Graph-RAG error', error as Error);
    return errorResponse(error as Error);
  }
}

// ============================================================================
// DASHBOARD
// ============================================================================

async function getDashboard(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.queryStringParameters?.tenantId;
  
  if (!tenantId) {
    throw new ValidationError('tenantId is required');
  }

  const [configResult, statsResult, activityResult, topEntitiesResult] = await Promise.all([
    query(`SELECT * FROM cortex_config WHERE tenant_id = $1`, [tenantId]),
    query(`
      SELECT 
        (SELECT COUNT(*) FROM cortex_entities WHERE tenant_id = $1 AND is_active = true) as total_entities,
        (SELECT COUNT(*) FROM cortex_relationships WHERE tenant_id = $1) as total_relationships,
        (SELECT COUNT(*) FROM cortex_chunks WHERE tenant_id = $1) as total_chunks,
        (SELECT COUNT(*) FROM cortex_query_log WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '24 hours') as queries_last_24h,
        (SELECT COUNT(*) FROM cortex_activity_log WHERE tenant_id = $1 AND activity_type = 'ingest' AND created_at > NOW() - INTERVAL '24 hours') as ingests_last_24h
    `, [tenantId]),
    query(`
      SELECT id, activity_type, description, user_id, metadata, created_at
      FROM cortex_activity_log
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [tenantId]),
    query(`
      SELECT e.id, e.entity_type, e.name, e.access_count, e.last_accessed_at,
        (SELECT COUNT(*) FROM cortex_relationships WHERE source_entity_id = e.id OR target_entity_id = e.id) as relationship_count
      FROM cortex_entities e
      WHERE e.tenant_id = $1 AND e.is_active = true
      ORDER BY e.access_count DESC
      LIMIT 10
    `, [tenantId]),
  ]);

  const config = configResult.rows[0] || await createDefaultConfig(tenantId);
  const stats = statsResult.rows[0] as any;

  const dashboard: CortexDashboard = {
    tenantId,
    config: mapConfigFromDb(config),
    stats: {
      totalEntities: parseInt(stats.total_entities) || 0,
      totalRelationships: parseInt(stats.total_relationships) || 0,
      totalChunks: parseInt(stats.total_chunks) || 0,
      entitiesByType: {} as any,
      relationshipsByType: {} as any,
      averageConfidence: 0.95,
      storageUsedBytes: 0,
      queriesLast24h: parseInt(stats.queries_last_24h) || 0,
      ingestsLast24h: parseInt(stats.ingests_last_24h) || 0,
    },
    recentActivity: activityResult.rows.map((row: any) => ({
      id: row.id,
      type: row.activity_type,
      description: row.description,
      userId: row.user_id,
      metadata: row.metadata,
      timestamp: row.created_at,
    })),
    topEntities: topEntitiesResult.rows.map((row: any) => ({
      id: row.id,
      type: row.entity_type,
      name: row.name,
      relationshipCount: parseInt(row.relationship_count) || 0,
      accessCount: row.access_count,
      lastAccessedAt: row.last_accessed_at,
    })),
    graphHealth: {
      status: 'healthy',
      embeddingServiceStatus: 'up',
      vectorIndexStatus: 'synced',
      orphanedEntities: 0,
      duplicateCandidates: 0,
    },
  };

  return successResponse({ data: dashboard });
}

// ============================================================================
// CONFIGURATION
// ============================================================================

async function getConfig(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.queryStringParameters?.tenantId;
  
  if (!tenantId) {
    throw new ValidationError('tenantId is required');
  }

  const result = await query(`SELECT * FROM cortex_config WHERE tenant_id = $1`, [tenantId]);
  
  if (result.rows.length === 0) {
    const config = await createDefaultConfig(tenantId);
    return successResponse({ data: mapConfigFromDb(config) });
  }

  return successResponse({ data: mapConfigFromDb(result.rows[0]) });
}

async function updateConfig(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.queryStringParameters?.tenantId;
  const body = JSON.parse(event.body || '{}');
  
  if (!tenantId) {
    throw new ValidationError('tenantId is required');
  }

  const result = await query(`
    UPDATE cortex_config SET
      enable_graph_rag = COALESCE($2, enable_graph_rag),
      enable_entity_extraction = COALESCE($3, enable_entity_extraction),
      enable_relationship_inference = COALESCE($4, enable_relationship_inference),
      enable_temporal_tracking = COALESCE($5, enable_temporal_tracking),
      enable_auto_merge = COALESCE($6, enable_auto_merge),
      embedding_model = COALESCE($7, embedding_model),
      entity_extraction_model = COALESCE($8, entity_extraction_model),
      default_chunk_size = COALESCE($9, default_chunk_size),
      default_chunk_overlap = COALESCE($10, default_chunk_overlap),
      default_max_results = COALESCE($11, default_max_results),
      default_max_depth = COALESCE($12, default_max_depth),
      min_relevance_score = COALESCE($13, min_relevance_score),
      hybrid_search_alpha = COALESCE($14, hybrid_search_alpha),
      auto_cleanup_enabled = COALESCE($15, auto_cleanup_enabled),
      cleanup_threshold_days = COALESCE($16, cleanup_threshold_days),
      updated_at = NOW()
    WHERE tenant_id = $1
    RETURNING *
  `, [
    tenantId,
    body.enableGraphRag,
    body.enableEntityExtraction,
    body.enableRelationshipInference,
    body.enableTemporalTracking,
    body.enableAutoMerge,
    body.embeddingModel,
    body.entityExtractionModel,
    body.defaultChunkSize,
    body.defaultChunkOverlap,
    body.defaultMaxResults,
    body.defaultMaxDepth,
    body.minRelevanceScore,
    body.hybridSearchAlpha,
    body.autoCleanupEnabled,
    body.cleanupThresholdDays,
  ]);

  return successResponse({ data: mapConfigFromDb(result.rows[0]) });
}

async function createDefaultConfig(tenantId: string): Promise<any> {
  const result = await query(`
    INSERT INTO cortex_config (tenant_id)
    VALUES ($1)
    ON CONFLICT (tenant_id) DO UPDATE SET updated_at = NOW()
    RETURNING *
  `, [tenantId]);
  return result.rows[0];
}

// ============================================================================
// ENTITIES
// ============================================================================

async function listEntities(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.queryStringParameters?.tenantId;
  const entityType = event.queryStringParameters?.type;
  const search = event.queryStringParameters?.search;
  const limit = parseInt(event.queryStringParameters?.limit || '50');
  const offset = parseInt(event.queryStringParameters?.offset || '0');
  
  if (!tenantId) {
    throw new ValidationError('tenantId is required');
  }

  let sql = `
    SELECT id, entity_type, name, description, aliases, properties, confidence,
           source_type, access_count, last_accessed_at, is_active, created_at, updated_at
    FROM cortex_entities
    WHERE tenant_id = $1 AND is_active = true
  `;
  const params: any[] = [tenantId];
  let paramIndex = 2;

  if (entityType) {
    sql += ` AND entity_type = $${paramIndex}`;
    params.push(entityType);
    paramIndex++;
  }

  if (search) {
    sql += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  sql += ` ORDER BY access_count DESC, created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  const countResult = await query(
    `SELECT COUNT(*) FROM cortex_entities WHERE tenant_id = $1 AND is_active = true`,
    [tenantId]
  );

  return successResponse({
    data: result.rows.map(mapEntityFromDb),
    total: parseInt((countResult.rows[0] as any).count),
    hasMore: offset + result.rows.length < parseInt((countResult.rows[0] as any).count),
  });
}

async function getEntity(event: APIGatewayProxyEvent, entityId: string): Promise<APIGatewayProxyResult> {
  const result = await query(`
    SELECT * FROM cortex_entities WHERE id = $1
  `, [entityId]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Entity not found');
  }

  // Update access count
  await query(`
    UPDATE cortex_entities SET access_count = access_count + 1, last_accessed_at = NOW()
    WHERE id = $1
  `, [entityId]);

  return successResponse({ data: mapEntityFromDb(result.rows[0]) });
}

async function createEntity(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.queryStringParameters?.tenantId;
  const body: CreateEntityRequest = JSON.parse(event.body || '{}');
  
  if (!tenantId) {
    throw new ValidationError('tenantId is required');
  }
  if (!body.type || !body.name) {
    throw new ValidationError('type and name are required');
  }

  const result = await query(`
    INSERT INTO cortex_entities (
      tenant_id, entity_type, name, description, aliases, properties,
      source_type, source_id, source_url, source_timestamp, source_user_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `, [
    tenantId,
    body.type,
    body.name,
    body.description,
    body.aliases || [],
    JSON.stringify(body.properties || {}),
    body.source?.type || 'manual',
    body.source?.id,
    body.source?.url,
    body.source?.timestamp || new Date().toISOString(),
    body.source?.userId,
  ]);

  // Log activity
  await query(`
    INSERT INTO cortex_activity_log (tenant_id, activity_type, description, metadata)
    VALUES ($1, 'entity_created', $2, $3)
  `, [tenantId, `Created entity: ${body.name}`, JSON.stringify({ entityId: result.rows[0].id, type: body.type })]);

  return successResponse({ data: mapEntityFromDb(result.rows[0]) });
}

async function updateEntity(event: APIGatewayProxyEvent, entityId: string): Promise<APIGatewayProxyResult> {
  const body: UpdateEntityRequest = JSON.parse(event.body || '{}');

  const result = await query(`
    UPDATE cortex_entities SET
      name = COALESCE($2, name),
      description = COALESCE($3, description),
      aliases = COALESCE($4, aliases),
      properties = COALESCE($5, properties),
      is_active = COALESCE($6, is_active),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [
    entityId,
    body.name,
    body.description,
    body.aliases,
    body.properties ? JSON.stringify(body.properties) : null,
    body.isActive,
  ]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Entity not found');
  }

  return successResponse({ data: mapEntityFromDb(result.rows[0]) });
}

async function deleteEntity(event: APIGatewayProxyEvent, entityId: string): Promise<APIGatewayProxyResult> {
  // Soft delete by setting is_active to false
  const result = await query(`
    UPDATE cortex_entities SET is_active = false, updated_at = NOW()
    WHERE id = $1
    RETURNING tenant_id, name
  `, [entityId]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Entity not found');
  }

  // Log activity
  await query(`
    INSERT INTO cortex_activity_log (tenant_id, activity_type, description, metadata)
    VALUES ($1, 'entity_deleted', $2, $3)
  `, [result.rows[0].tenant_id, `Deleted entity: ${result.rows[0].name}`, JSON.stringify({ entityId })]);

  return successResponse({ message: 'Entity deleted' });
}

async function getEntityNeighbors(event: APIGatewayProxyEvent, entityId: string): Promise<APIGatewayProxyResult> {
  const depth = parseInt(event.queryStringParameters?.depth || '1');
  const relationshipTypes = event.queryStringParameters?.types?.split(',');

  const result = await query(`
    SELECT * FROM get_entity_neighbors($1, $2, $3, $4)
  `, [
    event.queryStringParameters?.tenantId,
    entityId,
    depth,
    relationshipTypes || null,
  ]);

  return successResponse({ data: result.rows });
}

// ============================================================================
// RELATIONSHIPS
// ============================================================================

async function listRelationships(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.queryStringParameters?.tenantId;
  const entityId = event.queryStringParameters?.entityId;
  const limit = parseInt(event.queryStringParameters?.limit || '50');
  
  if (!tenantId) {
    throw new ValidationError('tenantId is required');
  }

  let sql = `
    SELECT r.*, 
           s.name as source_name, s.entity_type as source_type,
           t.name as target_name, t.entity_type as target_type
    FROM cortex_relationships r
    JOIN cortex_entities s ON s.id = r.source_entity_id
    JOIN cortex_entities t ON t.id = r.target_entity_id
    WHERE r.tenant_id = $1
  `;
  const params: any[] = [tenantId];

  if (entityId) {
    sql += ` AND (r.source_entity_id = $2 OR r.target_entity_id = $2)`;
    params.push(entityId);
  }

  sql += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await query(sql, params);

  return successResponse({ data: result.rows.map(mapRelationshipFromDb) });
}

async function createRelationship(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.queryStringParameters?.tenantId;
  const body: CreateRelationshipRequest = JSON.parse(event.body || '{}');
  
  if (!tenantId) {
    throw new ValidationError('tenantId is required');
  }
  if (!body.sourceEntityId || !body.targetEntityId || !body.type) {
    throw new ValidationError('sourceEntityId, targetEntityId, and type are required');
  }

  const result = await query(`
    INSERT INTO cortex_relationships (
      tenant_id, source_entity_id, target_entity_id, relationship_type, custom_type,
      weight, properties, bidirectional, valid_from, valid_until, source_type
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'manual')
    ON CONFLICT (tenant_id, source_entity_id, target_entity_id, relationship_type)
    DO UPDATE SET weight = EXCLUDED.weight, updated_at = NOW()
    RETURNING *
  `, [
    tenantId,
    body.sourceEntityId,
    body.targetEntityId,
    body.type,
    body.customType,
    body.weight || 1.0,
    JSON.stringify(body.properties || {}),
    body.bidirectional || false,
    body.validFrom,
    body.validUntil,
  ]);

  return successResponse({ data: mapRelationshipFromDb(result.rows[0]) });
}

async function deleteRelationship(event: APIGatewayProxyEvent, relationshipId: string): Promise<APIGatewayProxyResult> {
  await query(`DELETE FROM cortex_relationships WHERE id = $1`, [relationshipId]);
  return successResponse({ message: 'Relationship deleted' });
}

// ============================================================================
// CHUNKS
// ============================================================================

async function listChunks(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.queryStringParameters?.tenantId;
  const entityId = event.queryStringParameters?.entityId;
  const limit = parseInt(event.queryStringParameters?.limit || '50');
  
  if (!tenantId) {
    throw new ValidationError('tenantId is required');
  }

  let sql = `
    SELECT id, entity_id, content, document_id, conversation_id, 
           section_title, word_count, token_count, created_at
    FROM cortex_chunks
    WHERE tenant_id = $1
  `;
  const params: any[] = [tenantId];

  if (entityId) {
    sql += ` AND entity_id = $2`;
    params.push(entityId);
  }

  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await query(sql, params);

  return successResponse({ data: result.rows });
}

// ============================================================================
// SEARCH & QUERY
// ============================================================================

async function searchGraph(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { tenantId, query: searchQuery, types, limit = 10 } = body;
  
  if (!tenantId || !searchQuery) {
    throw new ValidationError('tenantId and query are required');
  }

  // Full-text search
  const result = await query(`
    SELECT id, entity_type, name, description, confidence,
           ts_rank(to_tsvector('english', name || ' ' || COALESCE(description, '')), 
                   plainto_tsquery('english', $2)) as rank
    FROM cortex_entities
    WHERE tenant_id = $1 
      AND is_active = true
      AND to_tsvector('english', name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', $2)
      ${types ? `AND entity_type = ANY($4)` : ''}
    ORDER BY rank DESC
    LIMIT $3
  `, types ? [tenantId, searchQuery, limit, types] : [tenantId, searchQuery, limit]);

  return successResponse({
    data: {
      entities: result.rows.map(mapEntityFromDb),
      total: result.rows.length,
    },
  });
}

async function queryGraph(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const startTime = Date.now();
  
  if (!body.tenantId || !body.query) {
    throw new ValidationError('tenantId and query are required');
  }

  const limit = body.options?.limit || 20;
  const threshold = body.options?.similarityThreshold || 0.7;

  // Search entities by name/description text match
  const entityResult = await query(`
    SELECT e.*, 
           ts_rank(to_tsvector('english', COALESCE(e.name, '') || ' ' || COALESCE(e.description, '')), 
                   plainto_tsquery('english', $2)) as relevance
    FROM cortex_entities e
    WHERE e.tenant_id = $1 
      AND e.is_active = true
      AND (
        e.name ILIKE '%' || $2 || '%'
        OR e.description ILIKE '%' || $2 || '%'
        OR to_tsvector('english', COALESCE(e.name, '') || ' ' || COALESCE(e.description, '')) 
           @@ plainto_tsquery('english', $2)
      )
    ORDER BY relevance DESC
    LIMIT $3
  `, [body.tenantId, body.query, limit]);

  // Get relationships for found entities
  const entityIds = entityResult.rows.map((e: any) => e.id);
  let relationshipResult = { rows: [] as any[] };
  
  if (entityIds.length > 0) {
    relationshipResult = await query(`
      SELECT r.*
      FROM cortex_relationships r
      WHERE r.tenant_id = $1
        AND (r.source_entity_id = ANY($2) OR r.target_entity_id = ANY($2))
        AND r.is_active = true
      LIMIT $3
    `, [body.tenantId, entityIds, limit * 2]);
  }

  // Search knowledge chunks with text match
  const chunkResult = await query(`
    SELECT c.*,
           ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', $2)) as relevance
    FROM cortex_chunks c
    WHERE c.tenant_id = $1
      AND c.is_active = true
      AND to_tsvector('english', c.content) @@ plainto_tsquery('english', $2)
    ORDER BY relevance DESC
    LIMIT $3
  `, [body.tenantId, body.query, limit]);

  const entities = entityResult.rows.map((row: any) => mapEntityFromDb(row));
  const relationships = relationshipResult.rows.map((row: any) => mapRelationshipFromDb(row));
  const chunks = chunkResult.rows.map((row: any) => ({
    id: row.id,
    tenantId: row.tenant_id,
    content: row.content,
    entityId: row.entity_id,
    source: row.source,
    relevance: parseFloat(row.relevance || '0'),
    createdAt: row.created_at,
  }));

  const result = {
    entities,
    relationships,
    chunks,
    processingTimeMs: Date.now() - startTime,
    totalMatches: entities.length + chunks.length,
  };

  // Log the query
  await query(`
    INSERT INTO cortex_query_log (tenant_id, query_text, filters, options, results_count, processing_time_ms, user_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [
    body.tenantId,
    body.query,
    JSON.stringify(body.filters || {}),
    JSON.stringify(body.options || {}),
    result.totalMatches,
    result.processingTimeMs,
    body.userId,
  ]);

  return successResponse({ data: result });
}

// ============================================================================
// INGEST
// ============================================================================

async function ingestContent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body: IngestRequest = JSON.parse(event.body || '{}');
  const startTime = Date.now();
  
  if (!body.tenantId || !body.source) {
    throw new ValidationError('tenantId and source are required');
  }

  let entitiesCreated = 0;
  let entitiesMerged = 0;
  let relationshipsCreated = 0;
  let chunksCreated = 0;

  await transaction(async (client) => {
    // Process content based on source type
    const content = body.source.content || '';
    const sourceId = body.source.documentId || body.source.conversationId || `ingest_${Date.now()}`;

    // Create chunks from content (split by paragraphs)
    const paragraphs = content.split(/\n\n+/).filter((p: string) => p.trim().length > 50);
    
    for (const paragraph of paragraphs) {
      await client.query(`
        INSERT INTO cortex_chunks (tenant_id, content, source_type, source_id, source_url, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
      `, [body.tenantId, paragraph.trim(), body.source.type, sourceId, body.source.url || null]);
      chunksCreated++;
    }

    // Extract entities from content using pattern matching
    const entityPatterns = [
      { type: 'PERSON', regex: /(?:Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g },
      { type: 'ORGANIZATION', regex: /(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Inc|Corp|LLC|Ltd|Company|Foundation|Institute|University))/g },
      { type: 'TECHNOLOGY', regex: /(?:AI|ML|API|SDK|AWS|Azure|GCP|PostgreSQL|Redis|Kubernetes|Docker)/gi },
    ];

    const foundEntities = new Map<string, { type: string; name: string }>();
    
    for (const pattern of entityPatterns) {
      const matches = content.match(pattern.regex) || [];
      for (const match of matches) {
        const normalizedName = match.trim();
        if (!foundEntities.has(normalizedName.toLowerCase())) {
          foundEntities.set(normalizedName.toLowerCase(), { type: pattern.type, name: normalizedName });
        }
      }
    }

    for (const [, entity] of Array.from(foundEntities)) {
      // Check if entity already exists
      const existing = await client.query(`
        SELECT id FROM cortex_entities 
        WHERE tenant_id = $1 AND LOWER(name) = LOWER($2) AND is_active = true
        LIMIT 1
      `, [body.tenantId, entity.name]);

      if (existing.rows.length > 0) {
        // Update access count for existing entity
        await client.query(`
          UPDATE cortex_entities SET access_count = access_count + 1, last_accessed_at = NOW()
          WHERE id = $1
        `, [existing.rows[0].id]);
        entitiesMerged++;
      } else {
        // Create new entity
        await client.query(`
          INSERT INTO cortex_entities (tenant_id, entity_type, name, source_type, source_id, is_active, confidence)
          VALUES ($1, $2, $3, $4, $5, true, 0.8)
        `, [body.tenantId, entity.type, entity.name, body.source.type, sourceId]);
        entitiesCreated++;
      }
    }
  });

  const result: IngestResult = {
    success: true,
    entitiesCreated,
    entitiesMerged,
    relationshipsCreated,
    chunksCreated,
    processingTimeMs: Date.now() - startTime,
  };

  // Log activity
  await query(`
    INSERT INTO cortex_activity_log (tenant_id, activity_type, description, user_id, metadata)
    VALUES ($1, 'ingest', $2, $3, $4)
  `, [
    body.tenantId,
    `Ingested content from ${body.source.type}: ${entitiesCreated} entities created, ${chunksCreated} chunks`,
    body.userId,
    JSON.stringify(result),
  ]);

  return successResponse({ data: result });
}

// ============================================================================
// MERGE
// ============================================================================

async function mergeEntities(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { tenantId, primaryEntityId, secondaryEntityIds } = body;
  
  if (!tenantId || !primaryEntityId || !secondaryEntityIds?.length) {
    throw new ValidationError('tenantId, primaryEntityId, and secondaryEntityIds are required');
  }

  await transaction(async (client) => {
    // Update relationships to point to primary entity
    for (const secondaryId of secondaryEntityIds) {
      await client.query(`
        UPDATE cortex_relationships SET source_entity_id = $1
        WHERE source_entity_id = $2
      `, [primaryEntityId, secondaryId]);
      
      await client.query(`
        UPDATE cortex_relationships SET target_entity_id = $1
        WHERE target_entity_id = $2
      `, [primaryEntityId, secondaryId]);

      // Update chunks to point to primary entity
      await client.query(`
        UPDATE cortex_chunks SET entity_id = $1
        WHERE entity_id = $2
      `, [primaryEntityId, secondaryId]);

      // Mark secondary entity as merged
      await client.query(`
        UPDATE cortex_entities SET is_active = false, merged_into_id = $1
        WHERE id = $2
      `, [primaryEntityId, secondaryId]);
    }
  });

  // Log activity
  await query(`
    INSERT INTO cortex_activity_log (tenant_id, activity_type, description, metadata)
    VALUES ($1, 'entity_merged', $2, $3)
  `, [
    tenantId,
    `Merged ${secondaryEntityIds.length} entities into ${primaryEntityId}`,
    JSON.stringify({ primaryEntityId, secondaryEntityIds }),
  ]);

  return successResponse({ message: 'Entities merged successfully' });
}

// ============================================================================
// STATS
// ============================================================================

async function getStats(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.queryStringParameters?.tenantId;
  
  if (!tenantId) {
    throw new ValidationError('tenantId is required');
  }

  const [counts, entityTypes, relationshipTypes] = await Promise.all([
    query(`
      SELECT 
        (SELECT COUNT(*) FROM cortex_entities WHERE tenant_id = $1 AND is_active = true) as entities,
        (SELECT COUNT(*) FROM cortex_relationships WHERE tenant_id = $1) as relationships,
        (SELECT COUNT(*) FROM cortex_chunks WHERE tenant_id = $1) as chunks
    `, [tenantId]),
    query(`
      SELECT entity_type, COUNT(*) as count
      FROM cortex_entities
      WHERE tenant_id = $1 AND is_active = true
      GROUP BY entity_type
    `, [tenantId]),
    query(`
      SELECT relationship_type, COUNT(*) as count
      FROM cortex_relationships
      WHERE tenant_id = $1
      GROUP BY relationship_type
    `, [tenantId]),
  ]);

  const stats: CortexStats = {
    totalEntities: parseInt((counts.rows[0] as any).entities),
    totalRelationships: parseInt((counts.rows[0] as any).relationships),
    totalChunks: parseInt((counts.rows[0] as any).chunks),
    entitiesByType: (entityTypes.rows as any[]).reduce((acc: any, row: any) => {
      acc[row.entity_type] = parseInt(row.count);
      return acc;
    }, {} as any),
    relationshipsByType: (relationshipTypes.rows as any[]).reduce((acc: any, row: any) => {
      acc[row.relationship_type] = parseInt(row.count);
      return acc;
    }, {} as any),
    averageConfidence: 0.95,
    storageUsedBytes: 0,
    queriesLast24h: 0,
    ingestsLast24h: 0,
  };

  return successResponse({ data: stats });
}

// ============================================================================
// MAPPERS
// ============================================================================

function mapConfigFromDb(row: any): CortexConfig {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    enableGraphRag: row.enable_graph_rag,
    enableEntityExtraction: row.enable_entity_extraction,
    enableRelationshipInference: row.enable_relationship_inference,
    enableTemporalTracking: row.enable_temporal_tracking,
    enableAutoMerge: row.enable_auto_merge,
    embeddingModel: row.embedding_model,
    embeddingDimensions: row.embedding_dimensions,
    entityExtractionModel: row.entity_extraction_model,
    rerankingModel: row.reranking_model,
    defaultChunkSize: row.default_chunk_size,
    defaultChunkOverlap: row.default_chunk_overlap,
    maxChunksPerDocument: row.max_chunks_per_document,
    defaultMaxResults: row.default_max_results,
    defaultMaxDepth: row.default_max_depth,
    minRelevanceScore: parseFloat(row.min_relevance_score),
    hybridSearchAlpha: parseFloat(row.hybrid_search_alpha),
    autoCleanupEnabled: row.auto_cleanup_enabled,
    cleanupThresholdDays: row.cleanup_threshold_days,
    maxEntitiesPerTenant: row.max_entities_per_tenant,
    maxChunksPerTenant: row.max_chunks_per_tenant,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function mapEntityFromDb(row: any): any {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    type: row.entity_type,
    name: row.name,
    description: row.description,
    aliases: row.aliases,
    properties: row.properties,
    confidence: parseFloat(row.confidence),
    source: {
      type: row.source_type,
      id: row.source_id,
      url: row.source_url,
      timestamp: row.source_timestamp,
      userId: row.source_user_id,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAccessedAt: row.last_accessed_at,
    accessCount: row.access_count,
    isActive: row.is_active,
  };
}

function mapRelationshipFromDb(row: any): any {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sourceEntityId: row.source_entity_id,
    targetEntityId: row.target_entity_id,
    type: row.relationship_type,
    customType: row.custom_type,
    weight: parseFloat(row.weight),
    confidence: parseFloat(row.confidence),
    properties: row.properties,
    bidirectional: row.bidirectional,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    source: {
      type: row.source_type,
      id: row.source_id,
      timestamp: row.source_timestamp,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
