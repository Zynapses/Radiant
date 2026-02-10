/**
 * RADIANT v7.34.0 — Profile & Contact Management API Lambda
 *
 * Unified profile API used by ALL apps (admin dashboard + user-facing apps).
 * Handles multi-contact CRUD, phone/email verification, SENTINEL routing.
 *
 * Base path: /api/profile
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDbPool } from '../shared/services/database';
import type { Pool } from 'pg';
import { ContactVerificationService } from '../shared/services/contact-verification.service';

let pool: Pool | null = null;
let verificationService: ContactVerificationService | null = null;

async function ensurePool(): Promise<Pool> {
  if (!pool) {
    pool = await getDbPool();
  }
  return pool;
}

function getService(): ContactVerificationService {
  if (!verificationService) {
    verificationService = new ContactVerificationService(pool!);
  }
  return verificationService;
}

function response(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

function extractAuth(event: APIGatewayProxyEvent): { userId: string; tenantId: string; userType: string } | null {
  try {
    const claims = event.requestContext?.authorizer?.claims || {};
    const userId = claims.sub || claims['cognito:username'] || event.headers['x-user-id'];
    const tenantId = claims['custom:tenant_id'] || event.headers['x-tenant-id'];
    const userType = claims['custom:user_type'] || event.headers['x-user-type'] || 'end_user';

    if (!userId || !tenantId) return null;
    return { userId, tenantId, userType };
  } catch {
    return null;
  }
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (event.httpMethod === 'OPTIONS') {
    return response(200, { ok: true });
  }

  const auth = extractAuth(event);
  if (!auth) {
    return response(401, { error: 'Unauthorized — missing user context' });
  }

  await ensurePool();
  const service = getService();
  const path = event.path.replace(/^\/api\/profile/, '') || '/';
  const method = event.httpMethod;
  const body = event.body ? JSON.parse(event.body) : {};
  const ipAddress = event.requestContext?.identity?.sourceIp;
  const userAgent = event.headers['User-Agent'] || event.headers['user-agent'];

  try {
    // =========================================================================
    // GET /  — Get current user's full profile
    // =========================================================================
    if (method === 'GET' && path === '/') {
      const profile = await service.getProfile(auth.userId, auth.userType, auth.tenantId);
      return response(200, { profile });
    }

    // =========================================================================
    // PUT /  — Update profile fields (bio, timezone, locale, etc.)
    // =========================================================================
    if (method === 'PUT' && path === '/') {
      const profile = await service.updateProfile(auth.userId, auth.userType, auth.tenantId, {
        bio: body.bio,
        timezone: body.timezone,
        locale: body.locale,
        dateFormat: body.dateFormat,
        timeFormat: body.timeFormat,
      });
      return response(200, { profile });
    }

    // =========================================================================
    // GET /contacts  — List all contacts
    // =========================================================================
    if (method === 'GET' && path === '/contacts') {
      const contacts = await service.listContacts(auth.userId, auth.userType, auth.tenantId);
      return response(200, { contacts });
    }

    // =========================================================================
    // POST /contacts  — Add a new contact
    // =========================================================================
    if (method === 'POST' && path === '/contacts') {
      const result = await service.addContact(
        auth.userId,
        auth.userType,
        auth.tenantId,
        body.contactType,
        body.value,
        body.label || 'work',
        body.customLabel,
        body.countryCode,
        body.isPrimary,
      );

      if (!result.success) {
        return response(400, { error: result.error });
      }
      return response(201, { contact: result.contact });
    }

    // =========================================================================
    // PUT /contacts/:id  — Update contact label/primary
    // =========================================================================
    const contactUpdateMatch = path.match(/^\/contacts\/([a-f0-9-]+)$/);
    if (method === 'PUT' && contactUpdateMatch) {
      const contactId = contactUpdateMatch[1];
      const result = await service.updateContact(contactId, auth.userId, auth.tenantId, {
        label: body.label,
        customLabel: body.customLabel,
        isPrimary: body.isPrimary,
      });
      if (!result.success) {
        return response(404, { error: 'Contact not found' });
      }
      return response(200, { contact: result.contact });
    }

    // =========================================================================
    // DELETE /contacts/:id  — Remove a contact
    // =========================================================================
    const contactDeleteMatch = path.match(/^\/contacts\/([a-f0-9-]+)$/);
    if (method === 'DELETE' && contactDeleteMatch) {
      const contactId = contactDeleteMatch[1];
      const result = await service.removeContact(contactId, auth.userId, auth.tenantId);
      if (!result.success) {
        return response(400, { error: result.error });
      }
      return response(200, { success: true });
    }

    // =========================================================================
    // POST /contacts/:id/send-code  — Send verification code
    // =========================================================================
    const sendCodeMatch = path.match(/^\/contacts\/([a-f0-9-]+)\/send-code$/);
    if (method === 'POST' && sendCodeMatch) {
      const contactId = sendCodeMatch[1];
      const result = await service.sendVerificationCode(
        contactId, auth.userId, auth.tenantId, ipAddress, userAgent,
      );
      if (!result.success) {
        return response(400, result as any);
      }
      return response(200, result as any);
    }

    // =========================================================================
    // POST /contacts/:id/verify  — Verify code
    // =========================================================================
    const verifyMatch = path.match(/^\/contacts\/([a-f0-9-]+)\/verify$/);
    if (method === 'POST' && verifyMatch) {
      const contactId = verifyMatch[1];
      if (!body.code || body.code.length !== 6) {
        return response(400, { error: 'Invalid code — must be 6 digits' });
      }
      const result = await service.verifyCode(
        contactId, body.code, auth.userId, auth.tenantId, ipAddress, userAgent,
      );
      if (!result.success) {
        return response(400, result as any);
      }
      return response(200, result as any);
    }

    // =========================================================================
    // POST /contacts/:id/resend  — Resend verification code (alias for send-code)
    // =========================================================================
    const resendMatch = path.match(/^\/contacts\/([a-f0-9-]+)\/resend$/);
    if (method === 'POST' && resendMatch) {
      const contactId = resendMatch[1];
      const result = await service.sendVerificationCode(
        contactId, auth.userId, auth.tenantId, ipAddress, userAgent,
      );
      if (!result.success) {
        return response(400, result as any);
      }
      return response(200, result as any);
    }

    // =========================================================================
    // GET /sentinel/routes  — List admin's contact routing rules (admin-only)
    // =========================================================================
    if (method === 'GET' && path === '/sentinel/routes') {
      if (auth.userType === 'end_user') {
        return response(403, { error: 'SENTINEL alert routing is only available to platform administrators' });
      }
      const routes = await service.getContactRoutes(auth.userId, auth.tenantId);
      return response(200, { routes });
    }

    // =========================================================================
    // POST /sentinel/routes  — Create a routing rule (admin-only)
    // =========================================================================
    if (method === 'POST' && path === '/sentinel/routes') {
      if (auth.userType === 'end_user') {
        return response(403, { error: 'SENTINEL alert routing is only available to platform administrators' });
      }
      if (!body.alertCategory || !body.minSeverity || !body.contactId) {
        return response(400, { error: 'Missing required fields: alertCategory, minSeverity, contactId' });
      }
      const result = await service.createContactRoute(
        auth.userId, auth.tenantId, body.alertCategory, body.minSeverity, body.contactId,
      );
      if (!result.success) {
        return response(400, { error: result.error });
      }
      return response(201, { route: result.route });
    }

    // =========================================================================
    // PUT /sentinel/routes/:id  — Update a routing rule
    // =========================================================================
    const routeUpdateMatch = path.match(/^\/sentinel\/routes\/([a-f0-9-]+)$/);
    if (method === 'PUT' && routeUpdateMatch) {
      if (auth.userType === 'end_user') {
        return response(403, { error: 'SENTINEL alert routing is only available to platform administrators' });
      }
      const routeId = routeUpdateMatch[1];
      const updated = await service.updateContactRoute(routeId, auth.userId, auth.tenantId, {
        minSeverity: body.minSeverity,
        enabled: body.enabled,
      });
      if (!updated) {
        return response(404, { error: 'Route not found' });
      }
      return response(200, { success: true });
    }

    // =========================================================================
    // DELETE /sentinel/routes/:id  — Delete a routing rule
    // =========================================================================
    const routeDeleteMatch = path.match(/^\/sentinel\/routes\/([a-f0-9-]+)$/);
    if (method === 'DELETE' && routeDeleteMatch) {
      if (auth.userType === 'end_user') {
        return response(403, { error: 'SENTINEL alert routing is only available to platform administrators' });
      }
      const routeId = routeDeleteMatch[1];
      const deleted = await service.deleteContactRoute(routeId, auth.userId, auth.tenantId);
      if (!deleted) {
        return response(404, { error: 'Route not found' });
      }
      return response(200, { success: true });
    }

    // =========================================================================
    // GET /sentinel/coverage  — Coverage summary
    // =========================================================================
    if (method === 'GET' && path === '/sentinel/coverage') {
      if (auth.userType === 'end_user') {
        return response(403, { error: 'SENTINEL alert routing is only available to platform administrators' });
      }
      const routes = await service.getContactRoutes(auth.userId, auth.tenantId);
      const contacts = await service.listContacts(auth.userId, auth.userType, auth.tenantId);
      const verifiedContacts = contacts.filter(c => c.verificationStatus === 'verified');

      const allCategories = [
        'infrastructure', 'security', 'compliance', 'application',
        'ai_model', 'data', 'billing', 'performance', 'availability', 'tenant',
      ];
      const coveredCategories = new Set(
        routes.filter(r => r.enabled).map((r: any) => r.alertCategory),
      );
      const hasWildcard = coveredCategories.has('*');
      const uncoveredCategories = hasWildcard
        ? []
        : allCategories.filter(c => !coveredCategories.has(c));

      const hasSev1Coverage = routes.some((r: any) => r.enabled && r.minSeverity >= 1);

      return response(200, {
        adminId: auth.userId,
        routes,
        contacts: verifiedContacts,
        uncoveredCategories,
        hasSev1Coverage,
        totalRoutes: routes.length,
        activeRoutes: routes.filter((r: any) => r.enabled).length,
      });
    }

    return response(404, { error: `Unknown route: ${method} ${path}` });

  } catch (error) {
    console.error('[Profile API] Error:', error);
    return response(500, {
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
