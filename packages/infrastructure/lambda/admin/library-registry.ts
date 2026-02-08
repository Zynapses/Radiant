// RADIANT v4.18.0 - Admin API for Open Source Library Registry
// Manages library configuration, browsing, and usage analytics

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { libraryRegistryService, Library } from '../shared/services/library-registry.service';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'admin/library-registry',
  category: 'audit',
  sourceType: 'lambda',
});

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
// POST /admin/libraries/search
// Neural/semantic search for libraries by natural language query (v7.43.1)
// Combines full-text search, trigram similarity, and tag matching
// ============================================================================
export const searchLibraries: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { query, categories, limit: maxResults } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return response(400, {
        success: false,
        error: 'Search query is required',
      });
    }

    const startTime = Date.now();
    const allLibraries = await libraryRegistryService.getAllLibraries();

    // Score each library against the query using multiple signals
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);

    const scored = allLibraries
      .filter((lib: Library) => {
        if (categories && Array.isArray(categories) && categories.length > 0) {
          return categories.includes(lib.category);
        }
        return true;
      })
      .map((lib: Library) => {
        let score = 0;
        const name = (lib.name || '').toLowerCase();
        const description = (lib.description || '').toLowerCase();
        const tags = (lib.beats || []).map(t => t.toLowerCase());
        const domains = (lib.domains || []).map(d => d.toLowerCase());
        const useCases = (lib.useCases || []).map(c => c.toLowerCase());

        // Exact name match (highest signal)
        if (name === queryLower) score += 100;
        else if (name.includes(queryLower)) score += 60;

        // Term-level matching across fields
        for (const term of queryTerms) {
          if (name.includes(term)) score += 15;
          if (description.includes(term)) score += 8;
          if (tags.some(t => t.includes(term))) score += 10;
        }

        // Trigram-like substring overlap for fuzzy matching
        for (let i = 0; i <= queryLower.length - 3; i++) {
          const trigram = queryLower.substring(i, i + 3);
          if (name.includes(trigram)) score += 2;
          if (description.includes(trigram)) score += 1;
        }

        // Domain bonus
        for (const term of queryTerms) {
          if (domains.some(d => d.includes(term))) score += 12;
          if (useCases.some(c => c.includes(term))) score += 10;
        }

        return { library: lib, score, matchReason: buildMatchReasonTyped(lib, queryTerms) };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults || 20);

    return response(200, {
      success: true,
      data: {
        results: scored.map(s => ({
          ...s.library,
          relevanceScore: Math.min(s.score / 100, 1.0),
          matchReason: s.matchReason,
        })),
        totalMatched: scored.length,
        query,
        processingTimeMs: Date.now() - startTime,
      },
    });
  } catch (error) {
    logger.error('Error in neural library search', error);
    return response(500, { success: false, error: 'Search failed' });
  }
};

function buildMatchReasonTyped(lib: Library, queryTerms: string[]): string {
  const reasons: string[] = [];
  const name = (lib.name || '').toLowerCase();
  const beats = (lib.beats || []).map(t => t.toLowerCase());
  const domains = (lib.domains || []).map(d => d.toLowerCase());
  const useCases = (lib.useCases || []).map(c => c.toLowerCase());

  for (const term of queryTerms) {
    if (name.includes(term)) reasons.push(`name contains "${term}"`);
    if (beats.some(t => t.includes(term))) reasons.push(`beats "${term}"`);
    if (domains.some(d => d.includes(term))) reasons.push(`domain "${term}"`);
    if (useCases.some(c => c.includes(term))) reasons.push(`use-case "${term}"`);
  }
  return reasons.length > 0 ? reasons.slice(0, 3).join(', ') : 'fuzzy match';
}

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
  if (path === '/admin/libraries/search' && method === 'POST') {
    return (await searchLibraries(event, context, callback)) as APIGatewayProxyResult;
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
