/**
 * RADIANT v5.52.28 - MFA Lambda Handler (PROMPT-41B)
 * 
 * Handles MFA enrollment, verification, backup codes, and device trust.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TOTPService, BackupCodesService, DeviceTrustService } from '../shared/services/mfa/totp.service';
import { Pool } from 'pg';

// ============================================================================
// TYPES
// ============================================================================

interface MFAContext {
  userId: string;
  userType: 'tenant_user' | 'platform_admin';
  tenantId?: string;
  email: string;
  role: string;
}

// ============================================================================
// SERVICES INITIALIZATION
// ============================================================================

const encryptionKey = process.env.MFA_ENCRYPTION_KEY || 'radiant-mfa-default-key';
const totpService = new TOTPService({ issuer: 'RADIANT' }, encryptionKey);
const backupCodesService = new BackupCodesService(8, 10);
const deviceTrustService = new DeviceTrustService(30, 5);

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path.replace(/^\/api\/v2\/mfa/, '');
  const method = event.httpMethod;

  try {
    const context = extractMFAContext(event);

    // Route handling
    if (method === 'GET' && path === '/status') {
      return await getStatus(context, event);
    }
    if (method === 'POST' && path === '/enroll/start') {
      return await startEnrollment(context, event);
    }
    if (method === 'POST' && path === '/enroll/verify') {
      return await verifyEnrollment(context, event);
    }
    if (method === 'POST' && path === '/verify') {
      return await verifyCode(context, event);
    }
    if (method === 'POST' && path === '/backup-codes/regenerate') {
      return await regenerateBackupCodes(context, event);
    }
    if (method === 'GET' && path === '/devices') {
      return await listDevices(context, event);
    }
    if (method === 'DELETE' && path.startsWith('/devices/')) {
      const deviceId = path.replace('/devices/', '');
      return await revokeDevice(context, deviceId, event);
    }
    if (method === 'GET' && path === '/check') {
      return await checkMFARequired(context, event);
    }

    return response(404, { error: 'Not Found' });
  } catch (error) {
    console.error('MFA Handler Error:', error);
    return response(500, { error: 'Internal Server Error' });
  }
}

// ============================================================================
// ENDPOINT HANDLERS
// ============================================================================

async function getStatus(ctx: MFAContext, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const db = getPool();
  const table = ctx.userType === 'platform_admin' ? 'platform_admins' : 'tenant_users';

  const userResult = await db.query(
    `SELECT mfa_enabled, mfa_enrolled_at, mfa_method FROM ${table} WHERE id = $1`,
    [ctx.userId]
  );

  if (userResult.rows.length === 0) {
    return response(404, { error: 'User not found' });
  }

  const user = userResult.rows[0];

  // Get backup codes count
  const backupResult = await db.query(
    `SELECT COUNT(*) as remaining FROM mfa_backup_codes 
     WHERE user_type = $1 AND user_id = $2 AND is_used = false`,
    [ctx.userType, ctx.userId]
  );

  // Get trusted devices
  const devicesResult = await db.query(
    `SELECT id, device_name, trusted_at, last_used_at, expires_at, device_fingerprint 
     FROM mfa_trusted_devices 
     WHERE user_type = $1 AND user_id = $2 AND is_revoked = false AND expires_at > NOW()
     ORDER BY trusted_at DESC`,
    [ctx.userType, ctx.userId]
  );

  const currentFingerprint = event.headers['x-device-fingerprint'] || '';
  const trustedDevices = devicesResult.rows.map(d => ({
    id: d.id,
    deviceName: d.device_name,
    trustedAt: d.trusted_at,
    lastUsedAt: d.last_used_at,
    expiresAt: d.expires_at,
    current: d.device_fingerprint === currentFingerprint,
  }));

  const isRequired = isMFARequiredForRole(ctx.role);
  const canDisable = !isRequired;

  await logMFAEvent(ctx, 'status_checked', { ip: getClientIP(event) });

  return response(200, {
    enabled: user.mfa_enabled,
    enrolledAt: user.mfa_enrolled_at,
    method: user.mfa_method,
    backupCodesRemaining: parseInt(backupResult.rows[0].remaining),
    trustedDevices,
    isRequired,
    canDisable,
  });
}

async function startEnrollment(ctx: MFAContext, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const db = getPool();
  const table = ctx.userType === 'platform_admin' ? 'platform_admins' : 'tenant_users';

  // Check if already enrolled
  const userResult = await db.query(
    `SELECT mfa_enabled FROM ${table} WHERE id = $1`,
    [ctx.userId]
  );

  if (userResult.rows[0]?.mfa_enabled) {
    return response(400, { error: 'MFA already enrolled' });
  }

  // Generate new TOTP secret
  const { secret, uri } = totpService.generateSecret(ctx.email);
  const encryptedSecret = totpService.encryptSecret(secret);

  // Store encrypted secret temporarily (not enabled yet)
  await db.query(
    `UPDATE ${table} SET mfa_totp_secret_encrypted = $1 WHERE id = $2`,
    [encryptedSecret, ctx.userId]
  );

  await logMFAEvent(ctx, 'enrollment_started', { ip: getClientIP(event) });

  return response(200, {
    secret,
    uri,
  });
}

async function verifyEnrollment(ctx: MFAContext, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { code } = body;

  if (!code) {
    return response(400, { error: 'Code required' });
  }

  const db = getPool();
  const table = ctx.userType === 'platform_admin' ? 'platform_admins' : 'tenant_users';

  // Get stored secret
  const userResult = await db.query(
    `SELECT mfa_totp_secret_encrypted, mfa_enabled FROM ${table} WHERE id = $1`,
    [ctx.userId]
  );

  if (!userResult.rows[0]?.mfa_totp_secret_encrypted) {
    return response(400, { error: 'Enrollment not started' });
  }

  if (userResult.rows[0].mfa_enabled) {
    return response(400, { error: 'MFA already enrolled' });
  }

  // Decrypt and verify
  const secret = totpService.decryptSecret(userResult.rows[0].mfa_totp_secret_encrypted);
  const result = totpService.verifyCode(secret, code);

  if (!result.valid) {
    await logMFAEvent(ctx, 'enrollment_failed', { reason: 'invalid_code', ip: getClientIP(event) });
    return response(400, { error: 'Invalid verification code' });
  }

  // Generate backup codes
  const { codes, hashes } = backupCodesService.generateCodes();

  // Store backup codes
  const insertPromises = hashes.map(hash =>
    db.query(
      `INSERT INTO mfa_backup_codes (user_type, user_id, code_hash) VALUES ($1, $2, $3)`,
      [ctx.userType, ctx.userId, hash]
    )
  );
  await Promise.all(insertPromises);

  // Enable MFA
  await db.query(
    `UPDATE ${table} SET mfa_enabled = true, mfa_enrolled_at = NOW(), mfa_method = 'totp' WHERE id = $1`,
    [ctx.userId]
  );

  await logMFAEvent(ctx, 'enrollment_completed', { ip: getClientIP(event) });

  // Format backup codes for display
  const formattedCodes = codes.map(c => backupCodesService.formatCode(c));

  return response(200, {
    success: true,
    backupCodes: formattedCodes,
  });
}

async function verifyCode(ctx: MFAContext, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { code, type = 'totp', rememberDevice = false, deviceFingerprint } = body;

  if (!code) {
    return response(400, { error: 'Code required' });
  }

  const db = getPool();
  const table = ctx.userType === 'platform_admin' ? 'platform_admins' : 'tenant_users';

  // Check lockout
  const userResult = await db.query(
    `SELECT mfa_totp_secret_encrypted, mfa_failed_attempts, mfa_locked_until FROM ${table} WHERE id = $1`,
    [ctx.userId]
  );

  const user = userResult.rows[0];
  if (!user) {
    return response(404, { error: 'User not found' });
  }

  // Check if locked out
  if (user.mfa_locked_until && new Date(user.mfa_locked_until) > new Date()) {
    return response(429, {
      error: 'Account locked',
      lockoutUntil: user.mfa_locked_until,
    });
  }

  let isValid = false;

  if (type === 'backup') {
    // Verify backup code
    const backupResult = await db.query(
      `SELECT id, code_hash FROM mfa_backup_codes 
       WHERE user_type = $1 AND user_id = $2 AND is_used = false`,
      [ctx.userType, ctx.userId]
    );

    const normalizedCode = code.replace(/[-\s]/g, '').toUpperCase();
    for (const row of backupResult.rows) {
      if (backupCodesService.verifyCode(normalizedCode, row.code_hash)) {
        isValid = true;
        // Mark code as used
        await db.query(
          `UPDATE mfa_backup_codes SET is_used = true, used_at = NOW(), used_ip = $1 WHERE id = $2`,
          [getClientIP(event), row.id]
        );
        await logMFAEvent(ctx, 'backup_code_used', { ip: getClientIP(event) });
        break;
      }
    }
  } else {
    // Verify TOTP
    const secret = totpService.decryptSecret(user.mfa_totp_secret_encrypted);
    const result = totpService.verifyCode(secret, code);
    isValid = result.valid;
  }

  if (!isValid) {
    // Increment failed attempts
    const newAttempts = (user.mfa_failed_attempts || 0) + 1;
    const maxAttempts = 3;

    if (newAttempts >= maxAttempts) {
      const lockoutMinutes = 5;
      const lockoutUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
      await db.query(
        `UPDATE ${table} SET mfa_failed_attempts = $1, mfa_locked_until = $2 WHERE id = $3`,
        [newAttempts, lockoutUntil, ctx.userId]
      );
      await logMFAEvent(ctx, 'lockout_triggered', { attempts: newAttempts, ip: getClientIP(event) });
      return response(429, {
        error: 'Too many failed attempts',
        lockoutUntil: lockoutUntil.toISOString(),
      });
    }

    await db.query(
      `UPDATE ${table} SET mfa_failed_attempts = $1 WHERE id = $2`,
      [newAttempts, ctx.userId]
    );
    await logMFAEvent(ctx, 'verification_failed', { attempts: newAttempts, ip: getClientIP(event) });

    return response(401, {
      error: 'Invalid code',
      remainingAttempts: maxAttempts - newAttempts,
    });
  }

  // Reset failed attempts on success
  await db.query(
    `UPDATE ${table} SET mfa_failed_attempts = 0, mfa_locked_until = NULL WHERE id = $1`,
    [ctx.userId]
  );

  await logMFAEvent(ctx, 'verification_success', { type, ip: getClientIP(event) });

  let deviceToken: string | undefined;

  // Handle device trust
  if (rememberDevice) {
    // Check device limit
    const deviceCount = await db.query(
      `SELECT COUNT(*) FROM mfa_trusted_devices 
       WHERE user_type = $1 AND user_id = $2 AND is_revoked = false AND expires_at > NOW()`,
      [ctx.userType, ctx.userId]
    );

    if (parseInt(deviceCount.rows[0].count) < deviceTrustService.maxDevicesPerUser) {
      deviceToken = deviceTrustService.generateDeviceToken();
      const tokenHash = deviceTrustService.hashToken(deviceToken);
      const expiresAt = deviceTrustService.calculateExpiration();
      const deviceName = deviceTrustService.parseUserAgent(event.headers['user-agent'] || '');

      await db.query(
        `INSERT INTO mfa_trusted_devices 
         (user_type, user_id, device_token_hash, device_name, device_fingerprint, expires_at, last_used_ip)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [ctx.userType, ctx.userId, tokenHash, deviceName, deviceFingerprint, expiresAt, getClientIP(event)]
      );

      await logMFAEvent(ctx, 'device_trusted', { deviceName, ip: getClientIP(event) });
    }
  }

  return response(200, {
    success: true,
    deviceToken,
  });
}

async function regenerateBackupCodes(ctx: MFAContext, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const db = getPool();

  // Delete old codes
  await db.query(
    `DELETE FROM mfa_backup_codes WHERE user_type = $1 AND user_id = $2`,
    [ctx.userType, ctx.userId]
  );

  // Generate new codes
  const { codes, hashes } = backupCodesService.generateCodes();

  // Store new codes
  const insertPromises = hashes.map(hash =>
    db.query(
      `INSERT INTO mfa_backup_codes (user_type, user_id, code_hash) VALUES ($1, $2, $3)`,
      [ctx.userType, ctx.userId, hash]
    )
  );
  await Promise.all(insertPromises);

  await logMFAEvent(ctx, 'backup_codes_regenerated', { ip: getClientIP(event) });

  const formattedCodes = codes.map(c => backupCodesService.formatCode(c));

  return response(200, { codes: formattedCodes });
}

async function listDevices(ctx: MFAContext, _event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const db = getPool();

  const result = await db.query(
    `SELECT id, device_name, trusted_at, last_used_at, expires_at
     FROM mfa_trusted_devices 
     WHERE user_type = $1 AND user_id = $2 AND is_revoked = false AND expires_at > NOW()
     ORDER BY trusted_at DESC`,
    [ctx.userType, ctx.userId]
  );

  return response(200, {
    devices: result.rows.map(d => ({
      id: d.id,
      deviceName: d.device_name,
      trustedAt: d.trusted_at,
      lastUsedAt: d.last_used_at,
      expiresAt: d.expires_at,
    })),
  });
}

async function revokeDevice(ctx: MFAContext, deviceId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const db = getPool();

  const result = await db.query(
    `UPDATE mfa_trusted_devices 
     SET is_revoked = true, revoked_at = NOW(), revoked_reason = 'user_revoked'
     WHERE id = $1 AND user_type = $2 AND user_id = $3
     RETURNING id`,
    [deviceId, ctx.userType, ctx.userId]
  );

  if (result.rows.length === 0) {
    return response(404, { error: 'Device not found' });
  }

  await logMFAEvent(ctx, 'device_revoked', { deviceId, ip: getClientIP(event) });

  return response(200, { success: true });
}

async function checkMFARequired(ctx: MFAContext, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const db = getPool();
  const table = ctx.userType === 'platform_admin' ? 'platform_admins' : 'tenant_users';

  const userResult = await db.query(
    `SELECT mfa_enabled FROM ${table} WHERE id = $1`,
    [ctx.userId]
  );

  const mfaEnabled = userResult.rows[0]?.mfa_enabled || false;
  const mfaRequired = isMFARequiredForRole(ctx.role);

  // Check for trusted device
  const deviceToken = event.headers['x-device-token'];
  let deviceTrusted = false;

  if (deviceToken) {
    const tokenHash = deviceTrustService.hashToken(deviceToken);
    const deviceResult = await db.query(
      `SELECT id FROM mfa_trusted_devices 
       WHERE user_type = $1 AND user_id = $2 AND device_token_hash = $3 
       AND is_revoked = false AND expires_at > NOW()`,
      [ctx.userType, ctx.userId, tokenHash]
    );

    if (deviceResult.rows.length > 0) {
      deviceTrusted = true;
      // Update last used
      await db.query(
        `UPDATE mfa_trusted_devices SET last_used_at = NOW(), last_used_ip = $1 WHERE id = $2`,
        [getClientIP(event), deviceResult.rows[0].id]
      );
    }
  }

  return response(200, {
    mfaRequired,
    mfaEnrolled: mfaEnabled,
    deviceTrusted,
    role: ctx.role,
  });
}

// ============================================================================
// HELPERS
// ============================================================================

function extractMFAContext(event: APIGatewayProxyEvent): MFAContext {
  const claims = event.requestContext.authorizer?.claims || {};
  
  return {
    userId: claims['sub'] || claims['custom:user_id'] || '',
    userType: claims['custom:user_type'] || 'tenant_user',
    tenantId: claims['custom:tenant_id'],
    email: claims['email'] || '',
    role: claims['custom:role'] || 'user',
  };
}

function isMFARequiredForRole(role: string): boolean {
  const requiredRoles = [
    'tenant_admin',
    'tenant_owner', 
    'super_admin',
    'admin',
    'operator',
    'auditor',
  ];
  return requiredRoles.includes(role);
}

async function logMFAEvent(
  ctx: MFAContext,
  eventType: string,
  details: Record<string, unknown>
): Promise<void> {
  const db = getPool();
  await db.query(
    `INSERT INTO mfa_audit_log (user_type, user_id, tenant_id, event_type, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [ctx.userType, ctx.userId, ctx.tenantId, eventType, JSON.stringify(details), details.ip]
  );
}

function getClientIP(event: APIGatewayProxyEvent): string {
  return event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         event.requestContext.identity?.sourceIp || 
         'unknown';
}

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    },
    body: JSON.stringify(body),
  };
}
