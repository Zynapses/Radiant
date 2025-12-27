// RADIANT v4.18.0 - Cognitive Brain Lambda Handler
// API endpoints for brain regions, patterns, blueprints, and cognitive processing

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { cognitiveBrainService } from '../shared/services/cognitive-brain.service';
import { extractAuthContext } from '../shared/auth';
import { success, handleError } from '../shared/response';
import { ValidationError } from '../shared/errors';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = extractAuthContext(event);
    const path = event.path;
    const method = event.httpMethod;

    // ========================================================================
    // Session Management
    // ========================================================================

    // POST /cognitive-brain/sessions - Create a new cognitive session
    if (method === 'POST' && path.endsWith('/sessions')) {
      const body = JSON.parse(event.body || '{}');
      const session = await cognitiveBrainService.createSession(
        user.tenantId,
        user.userId,
        body.conversationId
      );
      return success({ session });
    }

    // GET /cognitive-brain/sessions/:sessionId - Get session details
    if (method === 'GET' && path.includes('/sessions/')) {
      const sessionId = path.split('/sessions/')[1];
      const session = await cognitiveBrainService.getSession(sessionId);
      if (!session) {
        throw new ValidationError('Session not found');
      }
      return success({ session });
    }

    // ========================================================================
    // Brain Regions
    // ========================================================================

    // GET /cognitive-brain/regions - List all brain regions
    if (method === 'GET' && path.endsWith('/regions')) {
      const regions = await cognitiveBrainService.getBrainRegions(user.tenantId);
      return success({ regions });
    }

    // POST /cognitive-brain/regions - Create a new brain region
    if (method === 'POST' && path.endsWith('/regions')) {
      const body = JSON.parse(event.body || '{}');
      if (!body.name || !body.slug) {
        throw new ValidationError('name and slug are required');
      }
      const region = await cognitiveBrainService.createBrainRegion(user.tenantId, body);
      return success({ region });
    }

    // PUT /cognitive-brain/regions/:regionId - Update a brain region
    if (method === 'PUT' && path.includes('/regions/')) {
      const regionId = path.split('/regions/')[1];
      const body = JSON.parse(event.body || '{}');
      await cognitiveBrainService.updateBrainRegion(user.tenantId, regionId, body);
      return success({ updated: true });
    }

    // POST /cognitive-brain/regions/initialize - Initialize default regions for tenant
    if (method === 'POST' && path.endsWith('/regions/initialize')) {
      await cognitiveBrainService.initializeTenantRegions(user.tenantId);
      const regions = await cognitiveBrainService.getBrainRegions(user.tenantId);
      return success({ regions, message: 'Brain regions initialized' });
    }

    // ========================================================================
    // Settings
    // ========================================================================

    // GET /cognitive-brain/settings - Get cognitive brain settings
    if (method === 'GET' && path.endsWith('/settings')) {
      const settings = await cognitiveBrainService.getSettings(user.tenantId);
      return success({ settings });
    }

    // PUT /cognitive-brain/settings - Update cognitive brain settings
    if (method === 'PUT' && path.endsWith('/settings')) {
      const body = JSON.parse(event.body || '{}');
      await cognitiveBrainService.updateSettings(user.tenantId, body);
      const settings = await cognitiveBrainService.getSettings(user.tenantId);
      return success({ settings });
    }

    // ========================================================================
    // Processing
    // ========================================================================

    // POST /cognitive-brain/process - Process input through cognitive brain
    if (method === 'POST' && path.endsWith('/process')) {
      const body = JSON.parse(event.body || '{}');
      if (!body.sessionId || !body.input) {
        throw new ValidationError('sessionId and input are required');
      }
      const response = await cognitiveBrainService.process(
        user.tenantId,
        body.sessionId,
        body.input
      );
      return success(response);
    }

    // ========================================================================
    // Analytics
    // ========================================================================

    // GET /cognitive-brain/analytics - Get cognitive brain analytics
    if (method === 'GET' && path.endsWith('/analytics')) {
      const regions = await cognitiveBrainService.getBrainRegions(user.tenantId);
      const totalActivations = regions.reduce((sum, r) => sum + r.metrics.totalActivations, 0);
      const successRate = regions.reduce((sum, r) => {
        if (r.metrics.totalActivations === 0) return sum;
        return sum + (r.metrics.successfulActivations / r.metrics.totalActivations);
      }, 0) / Math.max(regions.filter(r => r.metrics.totalActivations > 0).length, 1);
      const avgLatency = regions.reduce((sum, r) => sum + r.metrics.avgLatencyMs, 0) / Math.max(regions.length, 1);

      return success({
        analytics: {
          totalRegions: regions.length,
          activeRegions: regions.filter(r => r.isActive).length,
          totalActivations,
          successRate: Math.round(successRate * 100),
          avgLatencyMs: Math.round(avgLatency),
          topRegions: regions
            .sort((a, b) => b.metrics.totalActivations - a.metrics.totalActivations)
            .slice(0, 5)
            .map(r => ({
              name: r.name,
              slug: r.slug,
              activations: r.metrics.totalActivations,
              successRate: r.metrics.totalActivations > 0 
                ? Math.round((r.metrics.successfulActivations / r.metrics.totalActivations) * 100) 
                : 0,
            })),
        },
      });
    }

    throw new ValidationError(`Unknown route: ${method} ${path}`);
  } catch (error) {
    return handleError(error);
  }
}
