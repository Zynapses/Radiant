// RADIANT v4.18.0 - Inference Components Admin API Handler
// Routes requests to inference components service functions

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as handlers from './inference-components';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const path = event.path.replace(/^\/api\/admin\/inference-components\/?/, '');
  const method = event.httpMethod;

  logger.info('Inference components request', { path, method });

  try {
    // Route based on path and method
    // Config endpoints
    if (path === 'config' || path === '') {
      if (method === 'GET') return handlers.getConfig(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
      if (method === 'PUT') return handlers.updateConfig(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
    }

    // Dashboard
    if (path === 'dashboard') {
      return handlers.getDashboard(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
    }

    // Endpoints
    if (path === 'endpoints') {
      if (method === 'GET') return handlers.listEndpoints(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
      if (method === 'POST') return handlers.createEndpoint(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
    }

    const endpointMatch = path.match(/^endpoints\/([^\/]+)$/);
    if (endpointMatch) {
      event.pathParameters = { ...event.pathParameters, endpointName: endpointMatch[1] };
      if (method === 'GET') return handlers.getEndpoint(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
      if (method === 'DELETE') return handlers.deleteEndpoint(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
    }

    // Components
    if (path === 'components') {
      if (method === 'GET') return handlers.listComponents(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
      if (method === 'POST') return handlers.createComponent(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
    }

    const componentMatch = path.match(/^components\/([^\/]+)$/);
    if (componentMatch) {
      event.pathParameters = { ...event.pathParameters, componentName: componentMatch[1] };
      if (method === 'GET') return handlers.getComponent(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
      if (method === 'DELETE') return handlers.deleteComponent(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
    }

    const componentLoadMatch = path.match(/^components\/([^\/]+)\/load$/);
    if (componentLoadMatch && method === 'POST') {
      event.pathParameters = { ...event.pathParameters, componentId: componentLoadMatch[1] };
      return handlers.loadComponent(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
    }

    const componentUnloadMatch = path.match(/^components\/([^\/]+)\/unload$/);
    if (componentUnloadMatch && method === 'POST') {
      event.pathParameters = { ...event.pathParameters, componentId: componentUnloadMatch[1] };
      return handlers.unloadComponent(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
    }

    // Tiers
    if (path === 'tiers') {
      return handlers.listTierAssignments(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
    }

    const tierMatch = path.match(/^tiers\/([^\/]+)$/);
    if (tierMatch) {
      event.pathParameters = { ...event.pathParameters, modelId: tierMatch[1] };
      return handlers.getTierAssignment(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
    }

    const tierEvaluateMatch = path.match(/^tiers\/([^\/]+)\/evaluate$/);
    if (tierEvaluateMatch && method === 'POST') {
      event.pathParameters = { ...event.pathParameters, modelId: tierEvaluateMatch[1] };
      return handlers.evaluateTier(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
    }

    const tierTransitionMatch = path.match(/^tiers\/([^\/]+)\/transition$/);
    if (tierTransitionMatch && method === 'POST') {
      event.pathParameters = { ...event.pathParameters, modelId: tierTransitionMatch[1] };
      return handlers.transitionTier(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
    }

    const tierOverrideMatch = path.match(/^tiers\/([^\/]+)\/override$/);
    if (tierOverrideMatch) {
      event.pathParameters = { ...event.pathParameters, modelId: tierOverrideMatch[1] };
      if (method === 'POST') return handlers.overrideTier(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
      if (method === 'DELETE') return handlers.clearTierOverride(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
    }

    // Auto-tier
    if (path === 'auto-tier' && method === 'POST') {
      return handlers.runAutoTiering(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
    }

    // Routing
    const routingMatch = path.match(/^routing\/([^\/]+)$/);
    if (routingMatch) {
      event.pathParameters = { ...event.pathParameters, modelId: routingMatch[1] };
      return handlers.getRoutingDecision(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
    }

    // 404 Not Found
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: `Unknown path: ${path}` }),
    };
  } catch (error) {
    logger.error('Inference components handler error', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: 'Internal server error' }),
    };
  }
};
