/**
 * RADIANT Neural Operations Admin API
 * Endpoints for Neural Operations Center dashboard
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { neuralOperationsService } from '../shared/services/neural-operations.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

const respond = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

/**
 * GET /api/admin/neural-operations/dashboard
 * Returns complete dashboard data for Neural Operations Center
 */
export const getDashboard: APIGatewayProxyHandler = async (event) => {
  try {
    logger.info('Getting neural operations dashboard');

    const dashboard = await neuralOperationsService.getDashboard();

    return respond(200, dashboard);
  } catch (error) {
    logger.error('Failed to get neural operations dashboard', { error });
    return respond(500, {
      error: 'Failed to get dashboard',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * GET /api/admin/neural-operations/networks
 * Returns status for all CORTEX networks
 */
export const getNetworks: APIGatewayProxyHandler = async (event) => {
  try {
    const networks = await neuralOperationsService.getNetworkStatuses();
    return respond(200, { networks });
  } catch (error) {
    logger.error('Failed to get network statuses', { error });
    return respond(500, { error: 'Failed to get networks' });
  }
};

/**
 * GET /api/admin/neural-operations/shadows
 * Returns active shadow validations
 */
export const getShadowValidations: APIGatewayProxyHandler = async (event) => {
  try {
    const shadows = await neuralOperationsService.getActiveShadowValidations();
    return respond(200, { shadows });
  } catch (error) {
    logger.error('Failed to get shadow validations', { error });
    return respond(500, { error: 'Failed to get shadow validations' });
  }
};

/**
 * POST /api/admin/neural-operations/shadows/:id/abort
 * Abort a running shadow validation
 */
export const abortShadow: APIGatewayProxyHandler = async (event) => {
  try {
    const validationId = event.pathParameters?.id;
    if (!validationId) {
      return respond(400, { error: 'Validation ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    const reason = body.reason || 'Manual abort';
    const userId = event.requestContext.authorizer?.claims?.sub || 'system';

    await neuralOperationsService.abortShadowValidation(validationId, reason, userId);

    return respond(200, { success: true, message: 'Shadow validation aborted' });
  } catch (error) {
    logger.error('Failed to abort shadow validation', { error });
    return respond(500, { error: 'Failed to abort shadow validation' });
  }
};

/**
 * GET /api/admin/neural-operations/regions
 * Returns regional status including thermal state
 */
export const getRegions: APIGatewayProxyHandler = async (event) => {
  try {
    const regions = await neuralOperationsService.getRegionStatuses();
    return respond(200, { regions });
  } catch (error) {
    logger.error('Failed to get region statuses', { error });
    return respond(500, { error: 'Failed to get regions' });
  }
};

/**
 * POST /api/admin/neural-operations/regions/:id/thermal-override
 * Override thermal state for a region
 */
export const overrideThermalState: APIGatewayProxyHandler = async (event) => {
  try {
    const regionId = event.pathParameters?.id;
    if (!regionId) {
      return respond(400, { error: 'Region ID required' });
    }

    const body = JSON.parse(event.body || '{}');
    const { targetState, reason, durationMinutes } = body;

    if (!targetState || !['cold', 'warming', 'warm', 'hot'].includes(targetState)) {
      return respond(400, { error: 'Valid target state required (cold, warming, warm, hot)' });
    }

    if (!reason) {
      return respond(400, { error: 'Reason required for thermal override' });
    }

    const userId = event.requestContext.authorizer?.claims?.sub || 'system';

    await neuralOperationsService.overrideThermalState(
      regionId,
      targetState,
      reason,
      userId,
      durationMinutes
    );

    return respond(200, { success: true, message: 'Thermal state override applied' });
  } catch (error) {
    logger.error('Failed to override thermal state', { error });
    return respond(500, { error: 'Failed to override thermal state' });
  }
};

/**
 * GET /api/admin/neural-operations/alerts
 * Returns active alerts
 */
export const getAlerts: APIGatewayProxyHandler = async (event) => {
  try {
    const alerts = await neuralOperationsService.getActiveAlerts();
    return respond(200, { alerts });
  } catch (error) {
    logger.error('Failed to get alerts', { error });
    return respond(500, { error: 'Failed to get alerts' });
  }
};

/**
 * POST /api/admin/neural-operations/alerts/:id/acknowledge
 * Acknowledge an alert
 */
export const acknowledgeAlert: APIGatewayProxyHandler = async (event) => {
  try {
    const alertId = event.pathParameters?.id;
    if (!alertId) {
      return respond(400, { error: 'Alert ID required' });
    }

    const userId = event.requestContext.authorizer?.claims?.sub || 'system';

    await neuralOperationsService.acknowledgeAlert(alertId, userId);

    return respond(200, { success: true, message: 'Alert acknowledged' });
  } catch (error) {
    logger.error('Failed to acknowledge alert', { error });
    return respond(500, { error: 'Failed to acknowledge alert' });
  }
};

/**
 * GET /api/admin/neural-operations/deployments
 * Returns recent network deployments
 */
export const getDeployments: APIGatewayProxyHandler = async (event) => {
  try {
    const deployments = await neuralOperationsService.getRecentDeployments();
    return respond(200, { deployments });
  } catch (error) {
    logger.error('Failed to get deployments', { error });
    return respond(500, { error: 'Failed to get deployments' });
  }
};
