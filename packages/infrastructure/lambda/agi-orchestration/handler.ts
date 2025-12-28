// RADIANT v4.18.0 - AGI Orchestration Admin API Handler
// Endpoints for managing AGI service weights, settings, and monitoring

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { agiOrchestrationSettingsService } from '../shared/services/agi-orchestration-settings.service';
import { extractAuthContext } from '../shared/auth';
import { success, handleError } from '../shared/response';
import { ValidationError, ForbiddenError } from '../shared/errors';
import type { AGIServiceId, ConsciousnessIndicator } from '@radiant/shared';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = extractAuthContext(event);
    const path = event.path;
    const method = event.httpMethod;

    // ========================================================================
    // GET /agi-orchestration/settings - Get all AGI settings
    // ========================================================================
    if (method === 'GET' && path.endsWith('/settings')) {
      const settings = await agiOrchestrationSettingsService.getAllSettings(user.tenantId);
      return success(settings);
    }

    // ========================================================================
    // Service Weights
    // ========================================================================

    // GET /agi-orchestration/service-weights - Get all service weights
    if (method === 'GET' && path.endsWith('/service-weights')) {
      const weights = await agiOrchestrationSettingsService.getServiceWeights(user.tenantId);
      return success({ weights });
    }

    // PUT /agi-orchestration/service-weights - Bulk update service weights
    if (method === 'PUT' && path.endsWith('/service-weights')) {
      if (!user.isAdmin) throw new ForbiddenError('Admin access required');
      
      const body = JSON.parse(event.body || '{}');
      if (!body.weights || !Array.isArray(body.weights)) {
        throw new ValidationError('weights array is required');
      }

      await agiOrchestrationSettingsService.bulkUpdateServiceWeights(
        user.tenantId,
        body.weights,
        user.userId
      );

      return success({ updated: true });
    }

    // PATCH /agi-orchestration/service-weights/:serviceId - Update single service weight
    if (method === 'PATCH' && path.includes('/service-weights/')) {
      if (!user.isAdmin) throw new ForbiddenError('Admin access required');
      
      const serviceId = path.split('/service-weights/')[1];
      const body = JSON.parse(event.body || '{}');

      await agiOrchestrationSettingsService.updateServiceWeight(
        user.tenantId,
        serviceId as AGIServiceId,
        body,
        user.userId
      );

      return success({ updated: true, serviceId });
    }

    // ========================================================================
    // Consciousness Weights
    // ========================================================================

    // GET /agi-orchestration/consciousness-weights - Get consciousness indicator weights
    if (method === 'GET' && path.endsWith('/consciousness-weights')) {
      const weights = await agiOrchestrationSettingsService.getConsciousnessWeights(user.tenantId);
      return success({ weights });
    }

    // PATCH /agi-orchestration/consciousness-weights/:indicatorId - Update consciousness weight
    if (method === 'PATCH' && path.includes('/consciousness-weights/')) {
      if (!user.isAdmin) throw new ForbiddenError('Admin access required');
      
      const indicatorId = path.split('/consciousness-weights/')[1];
      const body = JSON.parse(event.body || '{}');

      await agiOrchestrationSettingsService.updateConsciousnessWeight(
        user.tenantId,
        indicatorId as ConsciousnessIndicator,
        body
      );

      return success({ updated: true, indicatorId });
    }

    // ========================================================================
    // Decision Weights
    // ========================================================================

    // GET /agi-orchestration/decision-weights - Get decision weights
    if (method === 'GET' && path.endsWith('/decision-weights')) {
      const weights = await agiOrchestrationSettingsService.getDecisionWeights(user.tenantId);
      return success({ weights });
    }

    // PUT /agi-orchestration/decision-weights - Update decision weights
    if (method === 'PUT' && path.endsWith('/decision-weights')) {
      if (!user.isAdmin) throw new ForbiddenError('Admin access required');
      
      const body = JSON.parse(event.body || '{}');
      await agiOrchestrationSettingsService.updateDecisionWeights(user.tenantId, body, user.userId);
      return success({ updated: true });
    }

    // ========================================================================
    // Decision Thresholds
    // ========================================================================

    // GET /agi-orchestration/decision-thresholds - Get decision thresholds
    if (method === 'GET' && path.endsWith('/decision-thresholds')) {
      const thresholds = await agiOrchestrationSettingsService.getDecisionThresholds(user.tenantId);
      return success({ thresholds });
    }

    // PUT /agi-orchestration/decision-thresholds - Update decision thresholds
    if (method === 'PUT' && path.endsWith('/decision-thresholds')) {
      if (!user.isAdmin) throw new ForbiddenError('Admin access required');
      
      const body = JSON.parse(event.body || '{}');
      await agiOrchestrationSettingsService.updateDecisionThresholds(user.tenantId, body);
      return success({ updated: true });
    }

    // ========================================================================
    // Pipelines
    // ========================================================================

    // GET /agi-orchestration/pipelines - Get orchestration pipelines
    if (method === 'GET' && path.endsWith('/pipelines')) {
      const pipelines = await agiOrchestrationSettingsService.getPipelines(user.tenantId);
      return success({ pipelines });
    }

    // GET /agi-orchestration/pipelines/default - Get default pipeline
    if (method === 'GET' && path.endsWith('/pipelines/default')) {
      const pipeline = await agiOrchestrationSettingsService.getDefaultPipeline(user.tenantId);
      return success({ pipeline });
    }

    // ========================================================================
    // Bedrock Configuration
    // ========================================================================

    // GET /agi-orchestration/bedrock-config - Get Bedrock configuration
    if (method === 'GET' && path.endsWith('/bedrock-config')) {
      const config = await agiOrchestrationSettingsService.getBedrockConfig(user.tenantId);
      return success({ config });
    }

    // PUT /agi-orchestration/bedrock-config - Update Bedrock configuration
    if (method === 'PUT' && path.endsWith('/bedrock-config')) {
      if (!user.isAdmin) throw new ForbiddenError('Admin access required');
      
      const body = JSON.parse(event.body || '{}');
      await agiOrchestrationSettingsService.updateBedrockConfig(user.tenantId, body);
      return success({ updated: true });
    }

    // ========================================================================
    // Performance Tuning
    // ========================================================================

    // GET /agi-orchestration/performance-tuning - Get performance tuning config
    if (method === 'GET' && path.endsWith('/performance-tuning')) {
      const config = await agiOrchestrationSettingsService.getPerformanceTuning(user.tenantId);
      return success({ config });
    }

    // ========================================================================
    // Self-Improvement Configuration
    // ========================================================================

    // GET /agi-orchestration/self-improvement - Get self-improvement config
    if (method === 'GET' && path.endsWith('/self-improvement')) {
      const config = await agiOrchestrationSettingsService.getSelfImprovementConfig(user.tenantId);
      return success({ config });
    }

    // PUT /agi-orchestration/self-improvement - Update self-improvement config
    if (method === 'PUT' && path.endsWith('/self-improvement')) {
      if (!user.isAdmin) throw new ForbiddenError('Admin access required');
      
      const body = JSON.parse(event.body || '{}');
      await agiOrchestrationSettingsService.updateSelfImprovementConfig(user.tenantId, body);
      return success({ updated: true });
    }

    // ========================================================================
    // Monitoring & Dashboard
    // ========================================================================

    // GET /agi-orchestration/service-health - Get service health status
    if (method === 'GET' && path.endsWith('/service-health')) {
      const health = await agiOrchestrationSettingsService.getServiceHealth(user.tenantId);
      return success({ services: health });
    }

    // GET /agi-orchestration/recent-requests - Get recent orchestration requests
    if (method === 'GET' && path.endsWith('/recent-requests')) {
      const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
      const requests = await agiOrchestrationSettingsService.getRecentRequests(user.tenantId, limit);
      return success({ requests });
    }

    // ========================================================================
    // Parameter Defaults
    // ========================================================================

    // GET /agi-orchestration/parameters - Get all parameter defaults
    if (method === 'GET' && path.endsWith('/parameters')) {
      const params = await agiOrchestrationSettingsService.getParameterDefaults(user.tenantId);
      return success({ parameters: params });
    }

    // GET /agi-orchestration/parameters/:category - Get parameters by category
    if (method === 'GET' && path.match(/\/parameters\/[^/]+$/)) {
      const category = path.split('/parameters/')[1];
      const params = await agiOrchestrationSettingsService.getParametersByCategory(user.tenantId, category);
      return success({ parameters: params, category });
    }

    // PUT /agi-orchestration/parameters/:category/:name - Update a parameter
    if (method === 'PUT' && path.match(/\/parameters\/[^/]+\/[^/]+$/)) {
      if (!user.isAdmin) throw new ForbiddenError('Admin access required');
      
      const parts = path.split('/parameters/')[1].split('/');
      const category = parts[0];
      const name = parts[1];
      const body = JSON.parse(event.body || '{}');

      await agiOrchestrationSettingsService.updateParameter(
        user.tenantId,
        category,
        name,
        body.value,
        body.autoMode ?? true,
        body.userOverride ?? false
      );

      return success({ updated: true, category, name });
    }

    // POST /agi-orchestration/parameters/reset - Reset all parameters to defaults
    if (method === 'POST' && path.endsWith('/parameters/reset')) {
      if (!user.isAdmin) throw new ForbiddenError('Admin access required');
      
      await agiOrchestrationSettingsService.resetParametersToDefaults(user.tenantId);
      return success({ reset: true });
    }

    // PUT /agi-orchestration/performance-tuning - Update performance tuning
    if (method === 'PUT' && path.endsWith('/performance-tuning')) {
      if (!user.isAdmin) throw new ForbiddenError('Admin access required');
      
      const body = JSON.parse(event.body || '{}');
      await agiOrchestrationSettingsService.updatePerformanceTuning(user.tenantId, body);
      return success({ updated: true });
    }

    // ========================================================================
    // Dashboard
    // ========================================================================

    // GET /agi-orchestration/dashboard - Get full dashboard data
    if (method === 'GET' && path.endsWith('/dashboard')) {
      const [settings, health, recentRequests] = await Promise.all([
        agiOrchestrationSettingsService.getAllSettings(user.tenantId),
        agiOrchestrationSettingsService.getServiceHealth(user.tenantId),
        agiOrchestrationSettingsService.getRecentRequests(user.tenantId, 10),
      ]);

      // Calculate aggregate metrics
      const enabledServices = settings.serviceWeights.filter(s => s.enabled).length;
      const totalServices = settings.serviceWeights.length;
      const healthyServices = health.filter(h => h.status === 'healthy').length;
      const avgWeight = settings.serviceWeights.reduce((acc, s) => acc + s.weight, 0) / totalServices;

      return success({
        settings,
        serviceHealth: health,
        recentRequests,
        summary: {
          enabledServices,
          totalServices,
          healthyServices,
          avgServiceWeight: avgWeight,
          pipelineStages: settings.defaultPipeline?.stages.length || 0,
          bedrockEnabled: settings.bedrockConfig.enabled,
          selfImprovementEnabled: settings.selfImprovementConfig.enabled,
        },
      });
    }

    throw new ValidationError(`Unknown route: ${method} ${path}`);
  } catch (error) {
    return handleError(error);
  }
}
