/**
 * RADIANT v7.35.0 — Tenant Sign-Up API (Public)
 *
 * Public-facing Lambda for tenant provisioning flow.
 * No authentication required — this is the entry point for new customers
 * signing up from marketing/sales websites.
 *
 * Flow:
 *   POST /signup              → Initiate sign-up (sends email code)
 *   POST /verify-email        → Verify email code (sends phone code)
 *   POST /verify-phone        → Verify phone code (provisions tenant + sends invitation)
 *   POST /resend-email-code   → Resend email verification code
 *   POST /resend-phone-code   → Resend phone verification code
 *   GET  /status/:id          → Get provisioning status
 *   POST /accept-invitation   → Accept invitation (activates tenant + user)
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { Pool } from 'pg';
import { getDbPool } from '../shared/services/database';
import { TenantProvisioningService } from '../shared/services/tenant-provisioning.service';

let pool: Pool | null = null;

async function ensurePool(): Promise<Pool> {
  if (!pool) {
    pool = await getDbPool();
  }
  return pool;
}

function response(statusCode: number, body: Record<string, any>): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  const service = new TenantProvisioningService(await ensurePool());
  const method = event.httpMethod;
  const path = event.path.replace(/^\/api\/tenant-signup/, '') || '/';
  const body = event.body ? JSON.parse(event.body) : {};
  const ipAddress = event.requestContext?.identity?.sourceIp;
  const userAgent = event.headers?.['User-Agent'] || event.headers?.['user-agent'];

  try {
    // =========================================================================
    // POST /signup — Initiate sign-up
    // =========================================================================
    if (method === 'POST' && path === '/signup') {
      const required = ['email', 'phone', 'phoneCountryCode', 'firstName', 'lastName', 'organizationName'];
      const missing = required.filter(f => !body[f]);
      if (missing.length > 0) {
        return response(400, { error: `Missing required fields: ${missing.join(', ')}` });
      }

      const result = await service.initiateSignUp(body, ipAddress, userAgent);
      if (!result.success) {
        return response(result.error === 'SIGNUP_ALREADY_IN_PROGRESS' ? 409 : 400, result);
      }
      return response(201, result);
    }

    // =========================================================================
    // POST /verify-email — Verify email code
    // =========================================================================
    if (method === 'POST' && path === '/verify-email') {
      if (!body.provisioningId || !body.code) {
        return response(400, { error: 'Missing provisioningId or code' });
      }
      if (!/^\d{6}$/.test(body.code)) {
        return response(400, { error: 'Code must be 6 digits' });
      }
      const result = await service.verifyEmail(body.provisioningId, body.code, ipAddress);
      if (!result.success) {
        return response(400, result);
      }
      return response(200, result);
    }

    // =========================================================================
    // POST /verify-phone — Verify phone code (auto-provisions on success)
    // =========================================================================
    if (method === 'POST' && path === '/verify-phone') {
      if (!body.provisioningId || !body.code) {
        return response(400, { error: 'Missing provisioningId or code' });
      }
      if (!/^\d{6}$/.test(body.code)) {
        return response(400, { error: 'Code must be 6 digits' });
      }
      const result = await service.verifyPhone(body.provisioningId, body.code, ipAddress);
      if (!result.success) {
        return response(400, result);
      }
      return response(200, result);
    }

    // =========================================================================
    // POST /resend-email-code — Resend email verification
    // =========================================================================
    if (method === 'POST' && path === '/resend-email-code') {
      if (!body.provisioningId) {
        return response(400, { error: 'Missing provisioningId' });
      }
      const result = await service.resendEmailCode(body.provisioningId);
      if (!result.success) {
        return response(400, result);
      }
      return response(200, { success: true });
    }

    // =========================================================================
    // POST /resend-phone-code — Resend phone verification
    // =========================================================================
    if (method === 'POST' && path === '/resend-phone-code') {
      if (!body.provisioningId) {
        return response(400, { error: 'Missing provisioningId' });
      }
      const result = await service.resendPhoneCode(body.provisioningId);
      if (!result.success) {
        return response(400, result);
      }
      return response(200, { success: true });
    }

    // =========================================================================
    // GET /status/:id — Get provisioning status
    // =========================================================================
    const statusMatch = path.match(/^\/status\/([a-f0-9-]+)$/);
    if (method === 'GET' && statusMatch) {
      const record = await service.getProvisioningStatus(statusMatch[1]);
      if (!record) {
        return response(404, { error: 'Sign-up not found' });
      }
      return response(200, { provisioning: record });
    }

    // =========================================================================
    // POST /accept-invitation — Accept invitation
    // =========================================================================
    if (method === 'POST' && path === '/accept-invitation') {
      if (!body.token) {
        return response(400, { error: 'Missing invitation token' });
      }
      const result = await service.acceptInvitation(body.token, ipAddress);
      if (!result.success) {
        return response(400, result);
      }
      return response(200, result);
    }

    return response(404, { error: `Unknown route: ${method} ${path}` });

  } catch (error) {
    console.error('[TenantSignUp API] Error:', error);
    return response(500, {
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
