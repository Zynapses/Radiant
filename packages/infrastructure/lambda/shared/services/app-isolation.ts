import { executeStatement } from '../db/client';

type AppId = 'thinktank' | 'launchboard' | 'alwaysme' | 'mechanicalmaker';
type UserStatus = 'active' | 'inactive' | 'suspended';

interface AppUser {
  id: string;
  tenantId: string;
  appId: AppId;
  email: string;
  displayName?: string;
  preferences: Record<string, unknown>;
  locale: string;
  timezone: string;
  status: UserStatus;
}

interface CreateAppUserInput {
  tenantId: string;
  appId: AppId;
  cognitoSub: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
}

export class AppIsolationService {
  async getOrCreateAppUser(input: CreateAppUserInput): Promise<AppUser> {
    // Try to find existing user
    const existingResult = await executeStatement(
      `SELECT * FROM app_users 
       WHERE tenant_id = $1 AND app_id = $2 AND email = $3 AND deleted_at IS NULL`,
      [
        { name: 'tenantId', value: { stringValue: input.tenantId } },
        { name: 'appId', value: { stringValue: input.appId } },
        { name: 'email', value: { stringValue: input.email } },
      ]
    );

    if (existingResult.rows.length > 0) {
      const row = existingResult.rows[0] as Record<string, unknown>;
      return this.mapRowToAppUser(row);
    }

    // Create new app user
    const result = await executeStatement(
      `INSERT INTO app_users 
       (tenant_id, app_id, cognito_sub, email, first_name, last_name, display_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        { name: 'tenantId', value: { stringValue: input.tenantId } },
        { name: 'appId', value: { stringValue: input.appId } },
        { name: 'cognitoSub', value: { stringValue: input.cognitoSub } },
        { name: 'email', value: { stringValue: input.email } },
        { name: 'firstName', value: input.firstName ? { stringValue: input.firstName } : { isNull: true } },
        { name: 'lastName', value: input.lastName ? { stringValue: input.lastName } : { isNull: true } },
        { name: 'displayName', value: input.displayName ? { stringValue: input.displayName } : { isNull: true } },
      ]
    );

    return this.mapRowToAppUser(result.rows[0] as Record<string, unknown>);
  }

  async getAppUser(appUserId: string): Promise<AppUser | null> {
    const result = await executeStatement(
      `SELECT * FROM app_users WHERE id = $1 AND deleted_at IS NULL`,
      [{ name: 'appUserId', value: { stringValue: appUserId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToAppUser(result.rows[0] as Record<string, unknown>);
  }

  async getAppUserByCognitoSub(appId: AppId, cognitoSub: string): Promise<AppUser | null> {
    const result = await executeStatement(
      `SELECT * FROM app_users WHERE app_id = $1 AND cognito_sub = $2 AND deleted_at IS NULL`,
      [
        { name: 'appId', value: { stringValue: appId } },
        { name: 'cognitoSub', value: { stringValue: cognitoSub } },
      ]
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToAppUser(result.rows[0] as Record<string, unknown>);
  }

  async updateAppUserPreferences(appUserId: string, preferences: Record<string, unknown>): Promise<void> {
    await executeStatement(
      `UPDATE app_users SET preferences = preferences || $2, updated_at = NOW() WHERE id = $1`,
      [
        { name: 'appUserId', value: { stringValue: appUserId } },
        { name: 'preferences', value: { stringValue: JSON.stringify(preferences) } },
      ]
    );
  }

  async updateAppUserLocale(appUserId: string, locale: string, timezone?: string): Promise<void> {
    await executeStatement(
      `UPDATE app_users 
       SET locale = $2, timezone = COALESCE($3, timezone), updated_at = NOW() 
       WHERE id = $1`,
      [
        { name: 'appUserId', value: { stringValue: appUserId } },
        { name: 'locale', value: { stringValue: locale } },
        { name: 'timezone', value: timezone ? { stringValue: timezone } : { isNull: true } },
      ]
    );
  }

  async recordLogin(appUserId: string): Promise<void> {
    await executeStatement(
      `UPDATE app_users 
       SET last_login_at = NOW(), login_count = login_count + 1, updated_at = NOW() 
       WHERE id = $1`,
      [{ name: 'appUserId', value: { stringValue: appUserId } }]
    );
  }

  async suspendAppUser(appUserId: string, reason?: string): Promise<void> {
    await executeStatement(
      `UPDATE app_users SET status = 'suspended', updated_at = NOW() WHERE id = $1`,
      [{ name: 'appUserId', value: { stringValue: appUserId } }]
    );
  }

  async reactivateAppUser(appUserId: string): Promise<void> {
    await executeStatement(
      `UPDATE app_users SET status = 'active', updated_at = NOW() WHERE id = $1`,
      [{ name: 'appUserId', value: { stringValue: appUserId } }]
    );
  }

  async createSession(
    appUserId: string,
    sessionToken: string,
    expiresAt: Date,
    metadata?: { ipAddress?: string; userAgent?: string; deviceFingerprint?: string }
  ): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO app_user_sessions 
       (app_user_id, session_token, ip_address, user_agent, device_fingerprint, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        { name: 'appUserId', value: { stringValue: appUserId } },
        { name: 'sessionToken', value: { stringValue: sessionToken } },
        { name: 'ipAddress', value: metadata?.ipAddress ? { stringValue: metadata.ipAddress } : { isNull: true } },
        { name: 'userAgent', value: metadata?.userAgent ? { stringValue: metadata.userAgent } : { isNull: true } },
        { name: 'deviceFingerprint', value: metadata?.deviceFingerprint ? { stringValue: metadata.deviceFingerprint } : { isNull: true } },
        { name: 'expiresAt', value: { stringValue: expiresAt.toISOString() } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>).id);
  }

  async validateSession(sessionToken: string): Promise<AppUser | null> {
    const result = await executeStatement(
      `SELECT au.* FROM app_users au
       JOIN app_user_sessions aus ON au.id = aus.app_user_id
       WHERE aus.session_token = $1 
       AND aus.is_active = true 
       AND aus.expires_at > NOW()
       AND au.status = 'active'
       AND au.deleted_at IS NULL`,
      [{ name: 'sessionToken', value: { stringValue: sessionToken } }]
    );

    if (result.rows.length === 0) return null;

    // Update last activity
    await executeStatement(
      `UPDATE app_user_sessions SET last_activity_at = NOW() WHERE session_token = $1`,
      [{ name: 'sessionToken', value: { stringValue: sessionToken } }]
    );

    return this.mapRowToAppUser(result.rows[0] as Record<string, unknown>);
  }

  async invalidateSession(sessionToken: string): Promise<void> {
    await executeStatement(
      `UPDATE app_user_sessions SET is_active = false WHERE session_token = $1`,
      [{ name: 'sessionToken', value: { stringValue: sessionToken } }]
    );
  }

  async invalidateAllSessions(appUserId: string): Promise<void> {
    await executeStatement(
      `UPDATE app_user_sessions SET is_active = false WHERE app_user_id = $1`,
      [{ name: 'appUserId', value: { stringValue: appUserId } }]
    );
  }

  async getRegisteredApps(): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT * FROM registered_apps WHERE is_active = true ORDER BY display_name`,
      []
    );
    return result.rows;
  }

  private mapRowToAppUser(row: Record<string, unknown>): AppUser {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      appId: row.app_id as AppId,
      email: String(row.email),
      displayName: row.display_name ? String(row.display_name) : undefined,
      preferences: typeof row.preferences === 'string' 
        ? JSON.parse(row.preferences) 
        : (row.preferences as Record<string, unknown>) || {},
      locale: String(row.locale || 'en-US'),
      timezone: String(row.timezone || 'UTC'),
      status: row.status as UserStatus,
    };
  }
}

export const appIsolationService = new AppIsolationService();
