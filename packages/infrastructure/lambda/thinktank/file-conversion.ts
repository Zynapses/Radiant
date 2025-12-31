// RADIANT v4.18.55 - File Conversion API Handler
// Think Tank drops files here, Radiant decides if/how to convert them

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { fileConversionService, ConversionDecision, FileInfo } from '../shared/services/file-conversion.service';
import { executeStatement, stringParam, uuidParam } from '../shared/db/client';

// ============================================================================
// Types
// ============================================================================

interface ProcessFileRequest {
  filename: string;
  mimeType: string;
  content: string;  // Base64 encoded
  targetProvider: string;
  targetModel?: string;
  conversationId?: string;
}

interface CheckCompatibilityRequest {
  filename: string;
  mimeType: string;
  fileSize: number;
  targetProvider: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getCorsHeaders(origin?: string): Record<string, string> {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json',
  };
}

function extractContext(event: { requestContext?: { authorizer?: { claims?: Record<string, string> } }; headers?: Record<string, string> }) {
  const claims = event.requestContext?.authorizer?.claims || {};
  return {
    tenantId: claims['custom:tenant_id'] || event.headers?.['x-tenant-id'],
    userId: claims['sub'],
    isSuperAdmin: claims['custom:role'] === 'super_admin',
  };
}

function errorResponse(statusCode: number, message: string, headers: Record<string, string>): APIGatewayProxyResult {
  return {
    statusCode,
    headers,
    body: JSON.stringify({ success: false, error: message }),
  };
}

function successResponse(data: unknown, headers: Record<string, string>): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, data }),
  };
}

// ============================================================================
// Process File Handler
// POST /api/thinktank/files/process
// Think Tank calls this to submit a file - Radiant decides what to do
// ============================================================================

export const processFileHandler: APIGatewayProxyHandler = async (event) => {
  const headers = getCorsHeaders(event.headers?.origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const context = extractContext(event);
    if (!context.tenantId) {
      return errorResponse(401, 'Unauthorized - tenant context required', headers);
    }

    if (!event.body) {
      return errorResponse(400, 'Request body required', headers);
    }

    const request: ProcessFileRequest = JSON.parse(event.body);

    // Validate required fields
    if (!request.filename || !request.content || !request.targetProvider) {
      return errorResponse(400, 'filename, content, and targetProvider are required', headers);
    }

    // Process the file - Radiant decides if conversion is needed
    const result = await fileConversionService.processFile({
      tenantId: context.tenantId,
      userId: context.userId || 'anonymous',
      conversationId: request.conversationId,
      targetProviderId: request.targetProvider,
      targetModelId: request.targetModel || '',
      file: {
        content: request.content,  // Base64 string
        filename: request.filename,
        mimeType: request.mimeType || 'application/octet-stream',
      },
    });

    return successResponse(result, headers);

  } catch (error) {
    console.error('File processing error:', error);
    return errorResponse(500, 'Internal server error', headers);
  }
};

// ============================================================================
// Check Compatibility Handler
// POST /api/thinktank/files/check-compatibility
// Pre-flight check - does this file need conversion for this provider?
// ============================================================================

export const checkCompatibilityHandler: APIGatewayProxyHandler = async (event) => {
  const headers = getCorsHeaders(event.headers?.origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const context = extractContext(event);
    if (!context.tenantId) {
      return errorResponse(401, 'Unauthorized - tenant context required', headers);
    }

    if (!event.body) {
      return errorResponse(400, 'Request body required', headers);
    }

    const request: CheckCompatibilityRequest = JSON.parse(event.body);

    if (!request.filename || !request.targetProvider) {
      return errorResponse(400, 'filename and targetProvider are required', headers);
    }

    // Get file info without actual content
    const format = fileConversionService.detectFormat(request.filename, request.mimeType);
    const fileInfo: FileInfo = {
      filename: request.filename,
      mimeType: request.mimeType || 'application/octet-stream',
      format,
      size: request.fileSize || 0,
      checksum: '',
    };

    // Let Radiant decide
    const decision = fileConversionService.decideConversion(fileInfo, request.targetProvider);
    const capabilities = fileConversionService.getProviderCapabilities(request.targetProvider);

    return successResponse({
      fileInfo: {
        filename: request.filename,
        format,
        size: request.fileSize,
      },
      provider: {
        id: request.targetProvider,
        supportsFormat: capabilities.supportedFormats.includes(format),
        supportsVision: capabilities.supportsVision,
        supportsAudio: capabilities.supportsAudio,
        maxFileSize: capabilities.maxFileSize,
      },
      decision: {
        needsConversion: decision.needsConversion,
        strategy: decision.strategy,
        reason: decision.reason,
        targetFormat: decision.targetFormat,
        warnings: decision.warnings,
      },
    }, headers);

  } catch (error) {
    console.error('Compatibility check error:', error);
    return errorResponse(500, 'Internal server error', headers);
  }
};

// ============================================================================
// Get Provider Capabilities Handler
// GET /api/thinktank/files/capabilities
// Returns what each provider supports
// ============================================================================

export const getCapabilitiesHandler: APIGatewayProxyHandler = async (event) => {
  const headers = getCorsHeaders(event.headers?.origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const context = extractContext(event);
    if (!context.tenantId) {
      return errorResponse(401, 'Unauthorized - tenant context required', headers);
    }

    const providerId = event.queryStringParameters?.provider;

    // Fetch from database
    let query = `
      SELECT 
        provider_id,
        supported_formats,
        native_document_formats,
        max_file_size,
        supports_vision,
        supports_audio,
        supports_video,
        supports_documents,
        model_overrides,
        last_verified_at
      FROM provider_file_capabilities
    `;

    if (providerId) {
      query += ` WHERE provider_id = $1`;
    }

    const result = await executeStatement(
      query,
      providerId ? [stringParam(providerId)] : []
    );

    const capabilities = result.records?.map((record: any) => ({
      providerId: record[0]?.stringValue,
      supportedFormats: JSON.parse(record[1]?.stringValue || '[]'),
      nativeDocumentFormats: JSON.parse(record[2]?.stringValue || '[]'),
      maxFileSize: record[3]?.longValue,
      supportsVision: record[4]?.booleanValue,
      supportsAudio: record[5]?.booleanValue,
      supportsVideo: record[6]?.booleanValue,
      supportsDocuments: record[7]?.booleanValue,
      modelOverrides: JSON.parse(record[8]?.stringValue || '{}'),
      lastVerifiedAt: record[9]?.stringValue,
    })) || [];

    return successResponse(
      providerId ? capabilities[0] : capabilities,
      headers
    );

  } catch (error) {
    console.error('Get capabilities error:', error);
    return errorResponse(500, 'Internal server error', headers);
  }
};

// ============================================================================
// Get Conversion History Handler
// GET /api/thinktank/files/history
// Returns conversion history for the tenant
// ============================================================================

export const getHistoryHandler: APIGatewayProxyHandler = async (event) => {
  const headers = getCorsHeaders(event.headers?.origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const context = extractContext(event);
    if (!context.tenantId) {
      return errorResponse(401, 'Unauthorized - tenant context required', headers);
    }

    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);
    const conversationId = event.queryStringParameters?.conversationId;

    let query = `
      SELECT 
        id,
        filename,
        original_format,
        original_size,
        target_provider,
        target_model,
        needs_conversion,
        strategy,
        decision_reason,
        conversion_status,
        converted_token_estimate,
        processing_time_ms,
        created_at,
        completed_at
      FROM file_conversions
      WHERE tenant_id = $1
    `;

    const params: any[] = [uuidParam(context.tenantId)];

    if (conversationId) {
      query += ` AND conversation_id = $2`;
      params.push(uuidParam(conversationId));
    }

    query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const result = await executeStatement(query, params);

    const conversions = result.records?.map((record: any) => ({
      id: record[0]?.stringValue,
      filename: record[1]?.stringValue,
      originalFormat: record[2]?.stringValue,
      originalSize: record[3]?.longValue,
      targetProvider: record[4]?.stringValue,
      targetModel: record[5]?.stringValue,
      needsConversion: record[6]?.booleanValue,
      strategy: record[7]?.stringValue,
      decisionReason: record[8]?.stringValue,
      status: record[9]?.stringValue,
      tokenEstimate: record[10]?.longValue,
      processingTimeMs: record[11]?.longValue,
      createdAt: record[12]?.stringValue,
      completedAt: record[13]?.stringValue,
    })) || [];

    return successResponse({
      conversions,
      pagination: { limit, offset },
    }, headers);

  } catch (error) {
    console.error('Get history error:', error);
    return errorResponse(500, 'Internal server error', headers);
  }
};

// ============================================================================
// Get Conversion Stats Handler
// GET /api/thinktank/files/stats
// Returns conversion statistics for the tenant
// ============================================================================

export const getStatsHandler: APIGatewayProxyHandler = async (event) => {
  const headers = getCorsHeaders(event.headers?.origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const context = extractContext(event);
    if (!context.tenantId) {
      return errorResponse(401, 'Unauthorized - tenant context required', headers);
    }

    const days = parseInt(event.queryStringParameters?.days || '30', 10);

    const result = await executeStatement(
      `SELECT * FROM get_conversion_stats($1, $2)`,
      [uuidParam(context.tenantId), { name: 'days', value: { longValue: days } }]
    );

    if (result.records && result.records[0]) {
      const record = result.records[0];
      return successResponse({
        totalFiles: record[0]?.longValue || 0,
        convertedCount: record[1]?.longValue || 0,
        nativeCount: record[2]?.longValue || 0,
        failedCount: record[3]?.longValue || 0,
        totalBytesProcessed: record[4]?.longValue || 0,
        avgProcessingMs: record[5]?.longValue || 0,
        mostCommonFormat: record[6]?.stringValue || 'none',
        mostCommonStrategy: record[7]?.stringValue || 'none',
        periodDays: days,
      }, headers);
    }

    return successResponse({
      totalFiles: 0,
      convertedCount: 0,
      nativeCount: 0,
      failedCount: 0,
      totalBytesProcessed: 0,
      avgProcessingMs: 0,
      mostCommonFormat: 'none',
      mostCommonStrategy: 'none',
      periodDays: days,
    }, headers);

  } catch (error) {
    console.error('Get stats error:', error);
    return errorResponse(500, 'Internal server error', headers);
  }
};
