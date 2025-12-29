// RADIANT v4.18.0 - Model Proficiency Admin API Handler
// Admin endpoints for viewing and managing model proficiency rankings

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { modelProficiencyService } from '../shared/services/model-proficiency.service';

// ============================================================================
// Helper Functions
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

const success = (body: unknown): APIGatewayProxyResult => ({
  statusCode: 200,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

const error = (statusCode: number, message: string): APIGatewayProxyResult => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify({ error: message }),
});

// ============================================================================
// Rankings Endpoints
// ============================================================================

/**
 * GET /api/admin/model-proficiency/rankings
 * Get all proficiency rankings from the database
 */
export const getAllRankings: APIGatewayProxyHandler = async () => {
  try {
    const rankings = await modelProficiencyService.getAllRankingsFromDB();
    
    // Group by domain
    const byDomain: Record<string, typeof rankings> = {};
    const byMode: Record<string, typeof rankings> = {};
    
    for (const ranking of rankings) {
      if (ranking.domain !== '__mode__') {
        if (!byDomain[ranking.domain]) {
          byDomain[ranking.domain] = [];
        }
        byDomain[ranking.domain].push(ranking);
      }
      if (ranking.mode) {
        if (!byMode[ranking.mode]) {
          byMode[ranking.mode] = [];
        }
        byMode[ranking.mode].push(ranking);
      }
    }
    
    return success({
      rankings,
      byDomain,
      byMode,
      totalEntries: rankings.length,
      domains: Object.keys(byDomain),
      modes: Object.keys(byMode),
    });
  } catch (err) {
    console.error('Error getting rankings:', err);
    return error(500, 'Failed to get rankings');
  }
};

/**
 * GET /api/admin/model-proficiency/rankings/domain/:domain
 * Get rankings for a specific domain
 */
export const getDomainRankings: APIGatewayProxyHandler = async (event) => {
  try {
    const domain = event.pathParameters?.domain;
    if (!domain) {
      return error(400, 'Domain required');
    }
    
    const subspecialty = event.queryStringParameters?.subspecialty;
    const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
    
    const ranking = await modelProficiencyService.getDomainRanking(domain, subspecialty);
    
    return success({
      domain,
      subspecialty,
      models: ranking.models.slice(0, limit),
      totalModels: ranking.models.length,
    });
  } catch (err) {
    console.error('Error getting domain rankings:', err);
    return error(500, 'Failed to get domain rankings');
  }
};

/**
 * GET /api/admin/model-proficiency/rankings/mode/:mode
 * Get rankings for a specific orchestration mode
 */
export const getModeRankings: APIGatewayProxyHandler = async (event) => {
  try {
    const mode = event.pathParameters?.mode;
    if (!mode) {
      return error(400, 'Mode required');
    }
    
    const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
    
    const ranking = await modelProficiencyService.getModeRanking(mode);
    
    return success({
      mode,
      models: ranking.models.slice(0, limit),
      totalModels: ranking.models.length,
    });
  } catch (err) {
    console.error('Error getting mode rankings:', err);
    return error(500, 'Failed to get mode rankings');
  }
};

/**
 * GET /api/admin/model-proficiency/rankings/model/:modelId
 * Get proficiency profile for a specific model
 */
export const getModelProfile: APIGatewayProxyHandler = async (event) => {
  try {
    const modelId = event.pathParameters?.modelId;
    if (!modelId) {
      return error(400, 'Model ID required');
    }
    
    // Get rankings from DB and filter for this model
    const allRankings = await modelProficiencyService.getAllRankingsFromDB();
    const modelRankings = allRankings.filter(r => r.modelId === modelId);
    
    if (modelRankings.length === 0) {
      return error(404, 'Model not found in rankings');
    }
    
    // Build profile from rankings
    const domainRankings = modelRankings
      .filter(r => r.domain !== '__mode__')
      .map(r => ({ domain: r.domain, score: r.score, rank: r.rank, strength: r.strength }))
      .sort((a, b) => b.score - a.score);
    
    const modeRankings = modelRankings
      .filter(r => r.mode)
      .map(r => ({ mode: r.mode!, score: r.modeScore || 0, rank: r.modeRank || 0 }))
      .sort((a, b) => b.score - a.score);
    
    return success({
      modelId,
      domainRankings,
      modeRankings,
      topDomains: domainRankings.slice(0, 5),
      topModes: modeRankings.slice(0, 3),
    });
  } catch (err) {
    console.error('Error getting model profile:', err);
    return error(500, 'Failed to get model profile');
  }
};

/**
 * POST /api/admin/model-proficiency/rankings/recompute
 * Recompute all rankings and update the database
 */
export const recomputeRankings: APIGatewayProxyHandler = async () => {
  try {
    const startTime = Date.now();
    
    const result = await modelProficiencyService.recomputeAllRankings();
    
    const durationMs = Date.now() - startTime;
    
    return success({
      message: 'Rankings recomputed successfully',
      domainsUpdated: result.domainsUpdated,
      modesUpdated: result.modesUpdated,
      durationMs,
    });
  } catch (err) {
    console.error('Error recomputing rankings:', err);
    return error(500, 'Failed to recompute rankings');
  }
};

/**
 * POST /api/admin/model-proficiency/compare
 * Compare multiple models
 */
export const compareModels: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { modelIds } = body;
    
    if (!modelIds || !Array.isArray(modelIds) || modelIds.length < 2) {
      return error(400, 'At least 2 model IDs required');
    }
    
    if (modelIds.length > 5) {
      return error(400, 'Maximum 5 models can be compared at once');
    }
    
    const comparison = await modelProficiencyService.compareModels(modelIds);
    
    return success({ comparison });
  } catch (err) {
    console.error('Error comparing models:', err);
    return error(500, 'Failed to compare models');
  }
};

/**
 * POST /api/admin/model-proficiency/best-for-task
 * Find best models for a specific task
 */
export const getBestForTask: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { task, domain, mode, requireCommercial, limit } = body;
    
    if (!task) {
      return error(400, 'Task description required');
    }
    
    const models = await modelProficiencyService.getBestModelsForTask(task, {
      domain,
      mode,
      requireCommercial,
      limit: limit || 5,
    });
    
    return success({
      task,
      filters: { domain, mode, requireCommercial },
      models,
    });
  } catch (err) {
    console.error('Error finding best models:', err);
    return error(500, 'Failed to find best models');
  }
};

// ============================================================================
// Discovery Log Endpoints
// ============================================================================

/**
 * GET /api/admin/model-proficiency/discovery-log
 * Get model discovery log entries
 */
export const getDiscoveryLog: APIGatewayProxyHandler = async (event) => {
  try {
    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
    
    const logs = await modelProficiencyService.getDiscoveryLog(limit);
    
    // Calculate statistics
    const stats = {
      total: logs.length,
      pending: logs.filter(l => l.status === 'pending').length,
      completed: logs.filter(l => l.status === 'completed').length,
      failed: logs.filter(l => l.status === 'failed').length,
      bySource: {} as Record<string, number>,
    };
    
    for (const log of logs) {
      stats.bySource[log.source] = (stats.bySource[log.source] || 0) + 1;
    }
    
    return success({
      logs,
      stats,
    });
  } catch (err) {
    console.error('Error getting discovery log:', err);
    return error(500, 'Failed to get discovery log');
  }
};

/**
 * POST /api/admin/model-proficiency/discover
 * Manually trigger model discovery and proficiency generation
 */
export const discoverModel: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { modelId, source = 'admin' } = body;
    
    if (!modelId) {
      return error(400, 'Model ID required');
    }
    
    const startTime = Date.now();
    
    // Log the discovery
    const logId = await modelProficiencyService.logModelDiscovery(
      modelId,
      source as 'admin' | 'registry_sync' | 'huggingface' | 'auto'
    );
    
    try {
      // Generate proficiencies
      await modelProficiencyService.generateProficienciesForModel(modelId);
      
      const durationMs = Date.now() - startTime;
      
      // Mark as complete
      await modelProficiencyService.completeModelDiscovery(logId, durationMs);
      
      return success({
        message: 'Model discovered and proficiencies generated',
        modelId,
        logId,
        durationMs,
      });
    } catch (genError) {
      // Mark as failed
      await modelProficiencyService.failModelDiscovery(
        logId,
        genError instanceof Error ? genError.message : 'Unknown error'
      );
      throw genError;
    }
  } catch (err) {
    console.error('Error discovering model:', err);
    return error(500, 'Failed to discover model');
  }
};

/**
 * POST /api/admin/model-proficiency/sync-registry
 * Sync all models from the registry to the database
 */
export const syncRegistry: APIGatewayProxyHandler = async () => {
  try {
    const startTime = Date.now();
    
    // Log the sync operation
    const logId = await modelProficiencyService.logModelDiscovery(
      '__registry_sync__',
      'registry_sync'
    );
    
    try {
      // Sync to database
      const result = await modelProficiencyService.syncToDatabase();
      
      const durationMs = Date.now() - startTime;
      
      // Mark as complete
      await modelProficiencyService.completeModelDiscovery(logId, durationMs);
      
      return success({
        message: 'Registry synced successfully',
        modelsAdded: result.added,
        modelsUpdated: result.updated,
        durationMs,
        logId,
      });
    } catch (syncError) {
      await modelProficiencyService.failModelDiscovery(
        logId,
        syncError instanceof Error ? syncError.message : 'Unknown error'
      );
      throw syncError;
    }
  } catch (err) {
    console.error('Error syncing registry:', err);
    return error(500, 'Failed to sync registry');
  }
};

// ============================================================================
// Overview Endpoints
// ============================================================================

/**
 * GET /api/admin/model-proficiency/overview
 * Get overview of all models and their proficiencies
 */
export const getOverview: APIGatewayProxyHandler = async () => {
  try {
    const rankings = await modelProficiencyService.getAllRankingsFromDB();
    const logs = await modelProficiencyService.getDiscoveryLog(10);
    
    // Get unique models
    const modelIds = [...new Set(rankings.map(r => r.modelId))];
    
    // Get domain coverage
    const domains = [...new Set(rankings.filter(r => r.domain !== '__mode__').map(r => r.domain))];
    const modes = [...new Set(rankings.filter(r => r.mode).map(r => r.mode!))];
    
    // Calculate averages
    const avgDomainScore = rankings
      .filter(r => r.domain !== '__mode__' && r.score > 0)
      .reduce((sum, r) => sum + r.score, 0) / (rankings.filter(r => r.domain !== '__mode__' && r.score > 0).length || 1);
    
    const avgModeScore = rankings
      .filter(r => r.modeScore && r.modeScore > 0)
      .reduce((sum, r) => sum + (r.modeScore || 0), 0) / (rankings.filter(r => r.modeScore && r.modeScore > 0).length || 1);
    
    return success({
      overview: {
        totalModels: modelIds.length,
        totalDomains: domains.length,
        totalModes: modes.length,
        totalRankingEntries: rankings.length,
        avgDomainScore: Math.round(avgDomainScore * 10) / 10,
        avgModeScore: Math.round(avgModeScore * 10) / 10,
      },
      domains,
      modes,
      recentDiscoveries: logs,
    });
  } catch (err) {
    console.error('Error getting overview:', err);
    return error(500, 'Failed to get overview');
  }
};
