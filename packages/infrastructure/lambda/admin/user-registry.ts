/**
 * RADIANT v4.18.0 - User Registry Admin API Handler
 * 
 * Admin endpoints for user-application assignments, consent management,
 * DSAR processing, break glass access, and legal hold operations.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withSecureDBContext, extractAuthContext, isRadiantAdmin, isTenantAdmin } from '../shared/services/db-context.service';
import { userRegistryService } from '../shared/services/user-registry.service';
import { logger } from '../shared/logging/enhanced-logger';
import {
  AssignAppRequest,
  RevokeAppRequest,
  RecordConsentRequest,
  WithdrawConsentRequest,
  ApplyLegalHoldRequest,
  ReleaseLegalHoldRequest,
  InitiateBreakGlassRequest,
  EndBreakGlassRequest,
  ProcessDSARRequest,
} from '@radiant/shared';

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
    body: JSON.stringify(body),
  };
}

function parseBody<T>(event: APIGatewayProxyEvent): T {
  try {
    return JSON.parse(event.body || '{}') as T;
  } catch {
    throw new Error('Invalid JSON body');
  }
}

function getPathParam(event: APIGatewayProxyEvent, name: string): string | undefined {
  return event.pathParameters?.[name];
}

function getQueryParam(event: APIGatewayProxyEvent, name: string): string | undefined {
  return event.queryStringParameters?.[name];
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path.replace(/^\/api\/admin\/user-registry/, '');
  
  try {
    const authContext = extractAuthContext(event);
    
    // Dashboard
    if (path === '/dashboard' && method === 'GET') {
      return withSecureDBContext(authContext, async (client) => {
        const dashboard = await userRegistryService.getUserRegistryDashboard(client, authContext.tenantId);
        return jsonResponse(200, dashboard);
      });
    }
    
    // ========================================================================
    // USER APPLICATION ASSIGNMENTS
    // ========================================================================
    
    if (path === '/assignments' && method === 'GET') {
      const userId = getQueryParam(event, 'userId');
      const appId = getQueryParam(event, 'appId');
      
      return withSecureDBContext(authContext, async (client) => {
        if (userId) {
          const assignments = await userRegistryService.getUserAssignments(client, userId);
          return jsonResponse(200, { assignments });
        }
        if (appId) {
          const users = await userRegistryService.getAppUsers(client, appId);
          return jsonResponse(200, { users });
        }
        return jsonResponse(400, { error: 'userId or appId query parameter required' });
      });
    }
    
    if (path === '/assignments' && method === 'POST') {
      if (!isTenantAdmin(authContext)) {
        return jsonResponse(403, { error: 'Tenant admin privileges required' });
      }
      
      const body = parseBody<AssignAppRequest>(event);
      if (!body.userId || !body.appId) {
        return jsonResponse(400, { error: 'userId and appId are required' });
      }
      
      return withSecureDBContext(authContext, async (client) => {
        const assignment = await userRegistryService.assignUserToApp(client, authContext, body);
        return jsonResponse(201, assignment);
      });
    }
    
    if (path === '/assignments/revoke' && method === 'POST') {
      if (!isTenantAdmin(authContext)) {
        return jsonResponse(403, { error: 'Tenant admin privileges required' });
      }
      
      const body = parseBody<RevokeAppRequest>(event);
      if (!body.userId || !body.appId) {
        return jsonResponse(400, { error: 'userId and appId are required' });
      }
      
      return withSecureDBContext(authContext, async (client) => {
        const assignment = await userRegistryService.revokeUserFromApp(client, authContext, body);
        if (!assignment) {
          return jsonResponse(404, { error: 'Assignment not found or already revoked' });
        }
        return jsonResponse(200, assignment);
      });
    }
    
    // ========================================================================
    // CONSENT MANAGEMENT
    // ========================================================================
    
    if (path === '/consent' && method === 'GET') {
      const userId = getQueryParam(event, 'userId');
      const activeOnly = getQueryParam(event, 'activeOnly') !== 'false';
      
      if (!userId) {
        return jsonResponse(400, { error: 'userId query parameter required' });
      }
      
      return withSecureDBContext(authContext, async (client) => {
        const consents = await userRegistryService.getUserConsents(client, userId, activeOnly);
        return jsonResponse(200, { consents });
      });
    }
    
    if (path === '/consent' && method === 'POST') {
      const body = parseBody<RecordConsentRequest>(event);
      if (!body.userId || !body.purposeCode || !body.jurisdiction) {
        return jsonResponse(400, { error: 'userId, purposeCode, and jurisdiction are required' });
      }
      
      return withSecureDBContext(authContext, async (client) => {
        const consent = await userRegistryService.recordConsent(client, authContext, body);
        return jsonResponse(201, consent);
      });
    }
    
    if (path === '/consent/withdraw' && method === 'POST') {
      const body = parseBody<WithdrawConsentRequest>(event);
      if (!body.userId || !body.purposeCode) {
        return jsonResponse(400, { error: 'userId and purposeCode are required' });
      }
      
      return withSecureDBContext(authContext, async (client) => {
        const result = await userRegistryService.withdrawConsent(client, body);
        return jsonResponse(result.success ? 200 : 404, result);
      });
    }
    
    if (path === '/consent/check' && method === 'GET') {
      const userId = getQueryParam(event, 'userId');
      const purposeCode = getQueryParam(event, 'purposeCode');
      
      if (!userId || !purposeCode) {
        return jsonResponse(400, { error: 'userId and purposeCode query parameters required' });
      }
      
      return withSecureDBContext(authContext, async (client) => {
        const status = await userRegistryService.checkConsentStatus(client, userId, purposeCode);
        return jsonResponse(200, status);
      });
    }
    
    // ========================================================================
    // LEGAL HOLD
    // ========================================================================
    
    if (path === '/legal-hold' && method === 'GET') {
      const userId = getQueryParam(event, 'userId');
      
      return withSecureDBContext(authContext, async (client) => {
        if (userId) {
          const obligations = await userRegistryService.getUserRetentionObligations(client, userId);
          return jsonResponse(200, { obligations });
        }
        
        // Get all active legal holds (radiant admin only for cross-tenant)
        const tenantId = isRadiantAdmin(authContext) ? undefined : authContext.tenantId;
        const holds = await userRegistryService.getActiveLegalHolds(client, tenantId);
        return jsonResponse(200, { holds });
      });
    }
    
    if (path === '/legal-hold/apply' && method === 'POST') {
      if (!isRadiantAdmin(authContext)) {
        return jsonResponse(403, { error: 'Radiant admin privileges required for legal hold' });
      }
      
      const body = parseBody<ApplyLegalHoldRequest>(event);
      if (!body.userId || !body.reason) {
        return jsonResponse(400, { error: 'userId and reason are required' });
      }
      
      return withSecureDBContext(authContext, async (client) => {
        const result = await userRegistryService.applyLegalHold(client, authContext, body);
        return jsonResponse(200, result);
      });
    }
    
    if (path === '/legal-hold/release' && method === 'POST') {
      if (!isRadiantAdmin(authContext)) {
        return jsonResponse(403, { error: 'Radiant admin privileges required for legal hold' });
      }
      
      const body = parseBody<ReleaseLegalHoldRequest>(event);
      if (!body.userId || !body.releaseReason) {
        return jsonResponse(400, { error: 'userId and releaseReason are required' });
      }
      
      return withSecureDBContext(authContext, async (client) => {
        const result = await userRegistryService.releaseLegalHold(client, authContext, body);
        return jsonResponse(200, result);
      });
    }
    
    // ========================================================================
    // BREAK GLASS ACCESS
    // ========================================================================
    
    if (path === '/break-glass' && method === 'GET') {
      if (!isRadiantAdmin(authContext)) {
        return jsonResponse(403, { error: 'Radiant admin privileges required' });
      }
      
      const tenantId = getQueryParam(event, 'tenantId');
      const limit = parseInt(getQueryParam(event, 'limit') || '100', 10);
      
      return withSecureDBContext(authContext, async (client) => {
        const logs = await userRegistryService.getBreakGlassLogs(client, tenantId, limit);
        return jsonResponse(200, { logs });
      });
    }
    
    if (path === '/break-glass/active' && method === 'GET') {
      if (!isRadiantAdmin(authContext)) {
        return jsonResponse(403, { error: 'Radiant admin privileges required' });
      }
      
      return withSecureDBContext(authContext, async (client) => {
        const sessions = await userRegistryService.getActiveBreakGlassSessions(client);
        return jsonResponse(200, { sessions });
      });
    }
    
    if (path === '/break-glass/initiate' && method === 'POST') {
      if (!isRadiantAdmin(authContext)) {
        return jsonResponse(403, { error: 'Radiant admin privileges required for Break Glass' });
      }
      
      const body = parseBody<InitiateBreakGlassRequest>(event);
      if (!body.tenantId || !body.accessReason) {
        return jsonResponse(400, { error: 'tenantId and accessReason are required' });
      }
      
      return withSecureDBContext(authContext, async (client) => {
        const result = await userRegistryService.initiateBreakGlass(client, authContext, body);
        return jsonResponse(result.success ? 200 : 403, result);
      });
    }
    
    if (path === '/break-glass/end' && method === 'POST') {
      if (!isRadiantAdmin(authContext)) {
        return jsonResponse(403, { error: 'Radiant admin privileges required' });
      }
      
      const body = parseBody<EndBreakGlassRequest>(event);
      if (!body.accessId) {
        return jsonResponse(400, { error: 'accessId is required' });
      }
      
      return withSecureDBContext(authContext, async (client) => {
        const result = await userRegistryService.endBreakGlass(client, authContext, body);
        return jsonResponse(result.success ? 200 : 400, result);
      });
    }
    
    // ========================================================================
    // DSAR (DATA SUBJECT ACCESS REQUEST)
    // ========================================================================
    
    if (path === '/dsar' && method === 'GET') {
      const userId = getQueryParam(event, 'userId');
      const status = getQueryParam(event, 'status');
      
      return withSecureDBContext(authContext, async (client) => {
        if (userId) {
          const requests = await userRegistryService.getUserDSARRequests(client, userId);
          return jsonResponse(200, { requests });
        }
        
        const requests = await userRegistryService.getDSARRequests(client, authContext.tenantId, status);
        return jsonResponse(200, { requests });
      });
    }
    
    if (path === '/dsar/process' && method === 'POST') {
      if (!isTenantAdmin(authContext)) {
        return jsonResponse(403, { error: 'Tenant admin privileges required' });
      }
      
      const body = parseBody<ProcessDSARRequest>(event);
      if (!body.userId || !body.requestType) {
        return jsonResponse(400, { error: 'userId and requestType are required' });
      }
      
      return withSecureDBContext(authContext, async (client) => {
        const result = await userRegistryService.processDSAR(client, authContext, body);
        return jsonResponse(200, result);
      });
    }
    
    const dsarIdMatch = path.match(/^\/dsar\/([^/]+)$/);
    if (dsarIdMatch && method === 'PATCH') {
      if (!isTenantAdmin(authContext)) {
        return jsonResponse(403, { error: 'Tenant admin privileges required' });
      }
      
      const requestId = dsarIdMatch[1];
      const body = parseBody<{ status: string; processingNotes?: string }>(event);
      
      if (!body.status) {
        return jsonResponse(400, { error: 'status is required' });
      }
      
      return withSecureDBContext(authContext, async (client) => {
        const request = await userRegistryService.updateDSARStatus(client, requestId, body.status, body.processingNotes);
        if (!request) {
          return jsonResponse(404, { error: 'DSAR request not found' });
        }
        return jsonResponse(200, request);
      });
    }
    
    // ========================================================================
    // CROSS-BORDER TRANSFER
    // ========================================================================
    
    if (path === '/cross-border/check' && method === 'GET') {
      const userId = getQueryParam(event, 'userId');
      const targetRegion = getQueryParam(event, 'targetRegion');
      
      if (!userId || !targetRegion) {
        return jsonResponse(400, { error: 'userId and targetRegion query parameters required' });
      }
      
      return withSecureDBContext(authContext, async (client) => {
        const result = await userRegistryService.checkCrossBorderTransfer(client, userId, targetRegion);
        return jsonResponse(200, result);
      });
    }
    
    // ========================================================================
    // CREDENTIAL ROTATION
    // ========================================================================
    
    if (path === '/credentials/verify' && method === 'POST') {
      const body = parseBody<{ appId: string; secret: string }>(event);
      
      if (!body.appId || !body.secret) {
        return jsonResponse(400, { error: 'appId and secret are required' });
      }
      
      return withSecureDBContext(authContext, async (client) => {
        const valid = await userRegistryService.verifyAppCredentials(client, body.appId, body.secret);
        return jsonResponse(200, { valid });
      });
    }
    
    if (path === '/credentials/rotate' && method === 'POST') {
      if (!isTenantAdmin(authContext)) {
        return jsonResponse(403, { error: 'Tenant admin privileges required' });
      }
      
      const body = parseBody<{ appId: string; newSecret: string; rotationWindowHours?: number }>(event);
      
      if (!body.appId || !body.newSecret) {
        return jsonResponse(400, { error: 'appId and newSecret are required' });
      }
      
      return withSecureDBContext(authContext, async (client) => {
        const result = await userRegistryService.rotateAppSecret(
          client,
          body.appId,
          body.newSecret,
          body.rotationWindowHours
        );
        return jsonResponse(result.success ? 200 : 400, result);
      });
    }
    
    if (path === '/credentials/set' && method === 'POST') {
      if (!isTenantAdmin(authContext)) {
        return jsonResponse(403, { error: 'Tenant admin privileges required' });
      }
      
      const body = parseBody<{ appId: string; secret: string }>(event);
      
      if (!body.appId || !body.secret) {
        return jsonResponse(400, { error: 'appId and secret are required' });
      }
      
      return withSecureDBContext(authContext, async (client) => {
        const success = await userRegistryService.setAppSecret(client, body.appId, body.secret);
        return jsonResponse(success ? 200 : 404, { success });
      });
    }
    
    if (path === '/credentials/cleanup' && method === 'POST') {
      if (!isRadiantAdmin(authContext)) {
        return jsonResponse(403, { error: 'Radiant admin privileges required' });
      }
      
      return withSecureDBContext(authContext, async (client) => {
        const cleared = await userRegistryService.clearExpiredRotationWindows(client);
        return jsonResponse(200, { cleared });
      });
    }
    
    // Not found
    return jsonResponse(404, { error: `Route not found: ${method} ${path}` });
    
  } catch (error) {
    logger.error('User registry error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('privileges')) {
        return jsonResponse(403, { error: error.message });
      }
      if (error.message.includes('not found')) {
        return jsonResponse(404, { error: error.message });
      }
    }
    
    return jsonResponse(500, {
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
