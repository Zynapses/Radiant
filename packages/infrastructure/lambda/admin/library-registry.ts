// RADIANT v4.18.0 - Admin API for Open Source Library Registry
// Manages library configuration, browsing, and usage analytics

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { libraryRegistryService } from '../shared/services/library-registry.service';
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
// GET /admin/libraries/dashboard
// Get full dashboard data
// ============================================================================
export const getDashboard: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const dashboard = await libraryRegistryService.getDashboard(tenantId);
    
    return response(200, { 
      success: true, 
      data: dashboard,
    });
  } catch (error) {
    logger.error('Error fetching library dashboard', error);
    return response(500, { success: false, error: 'Failed to fetch dashboard' });
  }
};

// ============================================================================
// GET /admin/libraries/config
// Get library registry configuration
// ============================================================================
export const getConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const config = await libraryRegistryService.getConfig(tenantId);
    
    return response(200, { success: true, data: config });
  } catch (error) {
    logger.error('Error fetching library config', error);
    return response(500, { success: false, error: 'Failed to fetch config' });
  }
};

// ============================================================================
// PUT /admin/libraries/config
// Update library registry configuration
// ============================================================================
export const updateConfig: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const updates = JSON.parse(event.body || '{}');
    
    const config = await libraryRegistryService.updateConfig(tenantId, updates);
    
    return response(200, { success: true, data: config });
  } catch (error) {
    logger.error('Error updating library config', error);
    return response(500, { success: false, error: 'Failed to update config' });
  }
};

// ============================================================================
// GET /admin/libraries
// List all libraries with optional filters
// ============================================================================
export const listLibraries: APIGatewayProxyHandler = async (event) => {
  try {
    const category = event.queryStringParameters?.category;
    
    let libraries;
    if (category) {
      libraries = await libraryRegistryService.getLibrariesByCategory(category);
    } else {
      libraries = await libraryRegistryService.getAllLibraries();
    }
    
    return response(200, { 
      success: true, 
      data: libraries,
      count: libraries.length,
    });
  } catch (error) {
    logger.error('Error listing libraries', error);
    return response(500, { success: false, error: 'Failed to list libraries' });
  }
};

// ============================================================================
// GET /admin/libraries/:id
// Get single library details
// ============================================================================
export const getLibrary: APIGatewayProxyHandler = async (event) => {
  try {
    const libraryId = event.pathParameters?.id;
    if (!libraryId) {
      return response(400, { success: false, error: 'Library ID required' });
    }
    
    const library = await libraryRegistryService.getLibrary(libraryId);
    if (!library) {
      return response(404, { success: false, error: 'Library not found' });
    }
    
    return response(200, { success: true, data: library });
  } catch (error) {
    logger.error('Error fetching library', error);
    return response(500, { success: false, error: 'Failed to fetch library' });
  }
};

// ============================================================================
// GET /admin/libraries/:id/stats
// Get usage statistics for a library
// ============================================================================
export const getLibraryStats: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const libraryId = event.pathParameters?.id;
    
    if (!libraryId) {
      return response(400, { success: false, error: 'Library ID required' });
    }
    
    const stats = await libraryRegistryService.getUsageStats(tenantId, libraryId);
    
    return response(200, { 
      success: true, 
      data: stats || {
        libraryId,
        totalInvocations: 0,
        successfulInvocations: 0,
        failedInvocations: 0,
        avgExecutionTimeMs: 0,
        successRate: 0,
        invocationsByType: {},
        lastUsedAt: null,
      },
    });
  } catch (error) {
    logger.error('Error fetching library stats', error);
    return response(500, { success: false, error: 'Failed to fetch stats' });
  }
};

// ============================================================================
// POST /admin/libraries/suggest
// Find libraries matching proficiency requirements
// ============================================================================
export const suggestLibraries: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const body = JSON.parse(event.body || '{}');
    
    const { requiredProficiencies, domains, categories, maxResults } = body;
    
    if (!requiredProficiencies || Object.keys(requiredProficiencies).length === 0) {
      return response(400, { 
        success: false, 
        error: 'Required proficiencies must be specified' 
      });
    }
    
    const startTime = Date.now();
    const suggestions = await libraryRegistryService.findMatchingLibraries(
      tenantId,
      requiredProficiencies,
      { domains, categories, maxResults }
    );
    
    return response(200, { 
      success: true, 
      data: {
        suggestions,
        totalMatched: suggestions.length,
        processingTimeMs: Date.now() - startTime,
      },
    });
  } catch (error) {
    logger.error('Error suggesting libraries', error);
    return response(500, { success: false, error: 'Failed to suggest libraries' });
  }
};

// ============================================================================
// POST /admin/libraries/disable/:id
// Disable a library for this tenant
// ============================================================================
export const disableLibrary: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const libraryId = event.pathParameters?.id;
    
    if (!libraryId) {
      return response(400, { success: false, error: 'Library ID required' });
    }
    
    const config = await libraryRegistryService.getConfig(tenantId);
    const disabledLibraries = [...config.disabledLibraries];
    
    if (!disabledLibraries.includes(libraryId)) {
      disabledLibraries.push(libraryId);
      await libraryRegistryService.updateConfig(tenantId, { disabledLibraries });
    }
    
    return response(200, { 
      success: true, 
      message: `Library ${libraryId} disabled`,
    });
  } catch (error) {
    logger.error('Error disabling library', error);
    return response(500, { success: false, error: 'Failed to disable library' });
  }
};

// ============================================================================
// POST /admin/libraries/enable/:id
// Enable a library for this tenant
// ============================================================================
export const enableLibrary: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const libraryId = event.pathParameters?.id;
    
    if (!libraryId) {
      return response(400, { success: false, error: 'Library ID required' });
    }
    
    const config = await libraryRegistryService.getConfig(tenantId);
    const disabledLibraries = config.disabledLibraries.filter(id => id !== libraryId);
    
    await libraryRegistryService.updateConfig(tenantId, { disabledLibraries });
    
    return response(200, { 
      success: true, 
      message: `Library ${libraryId} enabled`,
    });
  } catch (error) {
    logger.error('Error enabling library', error);
    return response(500, { success: false, error: 'Failed to enable library' });
  }
};

// ============================================================================
// GET /admin/libraries/categories
// Get all available categories with counts
// ============================================================================
export const getCategories: APIGatewayProxyHandler = async (event) => {
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    const dashboard = await libraryRegistryService.getDashboard(tenantId);
    
    return response(200, { 
      success: true, 
      data: dashboard.categoryBreakdown,
    });
  } catch (error) {
    logger.error('Error fetching categories', error);
    return response(500, { success: false, error: 'Failed to fetch categories' });
  }
};

// ============================================================================
// POST /admin/libraries/seed
// Manually trigger library seeding (admin only)
// ============================================================================
export const seedLibraries: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { libraries } = body;
    
    if (!libraries || !Array.isArray(libraries)) {
      return response(400, { 
        success: false, 
        error: 'Libraries array required' 
      });
    }
    
    const result = await libraryRegistryService.seedLibraries(libraries);
    
    return response(200, { 
      success: true, 
      data: result,
      message: `Seeded ${result.added} new libraries, updated ${result.updated} existing`,
    });
  } catch (error) {
    logger.error('Error seeding libraries', error);
    return response(500, { success: false, error: 'Failed to seed libraries' });
  }
};

// ============================================================================
// Main Handler Router
// ============================================================================
export const handler: APIGatewayProxyHandler = async (event, context) => {
  const path = event.path;
  const method = event.httpMethod;
  const callback = (): void => { /* noop */ };

  logger.info('Library registry request', { path, method });

  // Route based on path and method
  if (path === '/admin/libraries/dashboard' && method === 'GET') {
    return (await getDashboard(event, context, callback)) as APIGatewayProxyResult;
  }
  if (path === '/admin/libraries/config' && method === 'GET') {
    return (await getConfig(event, context, callback)) as APIGatewayProxyResult;
  }
  if (path === '/admin/libraries/config' && method === 'PUT') {
    return (await updateConfig(event, context, callback)) as APIGatewayProxyResult;
  }
  if (path === '/admin/libraries' && method === 'GET') {
    return (await listLibraries(event, context, callback)) as APIGatewayProxyResult;
  }
  if (path === '/admin/libraries/suggest' && method === 'POST') {
    return (await suggestLibraries(event, context, callback)) as APIGatewayProxyResult;
  }
  if (path === '/admin/libraries/categories' && method === 'GET') {
    return (await getCategories(event, context, callback)) as APIGatewayProxyResult;
  }
  if (path === '/admin/libraries/seed' && method === 'POST') {
    return (await seedLibraries(event, context, callback)) as APIGatewayProxyResult;
  }
  if (path.match(/^\/admin\/libraries\/disable\/[\w-]+$/) && method === 'POST') {
    return (await disableLibrary(event, context, callback)) as APIGatewayProxyResult;
  }
  if (path.match(/^\/admin\/libraries\/enable\/[\w-]+$/) && method === 'POST') {
    return (await enableLibrary(event, context, callback)) as APIGatewayProxyResult;
  }
  if (path.match(/^\/admin\/libraries\/[\w-]+\/stats$/) && method === 'GET') {
    return (await getLibraryStats(event, context, callback)) as APIGatewayProxyResult;
  }
  if (path.match(/^\/admin\/libraries\/[\w-]+$/) && method === 'GET') {
    return (await getLibrary(event, context, callback)) as APIGatewayProxyResult;
  }

  return response(404, { success: false, error: 'Not found' });
};
