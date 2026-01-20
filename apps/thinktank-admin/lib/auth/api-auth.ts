/**
 * API-Only Authentication for Think Tank Admin
 * 
 * CRITICAL: This app MUST NOT use Cognito SDK directly.
 * All authentication goes through the Radiant API.
 * 
 * ADMIN-ONLY: This client uses /api/auth/admin/* endpoints which
 * validate that the user has TenantAdmin or SuperAdmin role.
 * Regular users CANNOT access Think Tank Admin. No exceptions.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Admin roles that are allowed to access Think Tank Admin
const ADMIN_ROLES = ['SuperAdmin', 'TenantAdmin', 'super_admin', 'tenant_admin', 'admin'];

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AuthUser;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  role: string; // Must be one of ADMIN_ROLES
  permissions: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
  tenantId: string;
}

export interface AuthError {
  code: string;
  message: string;
}

function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.some(r => r.toLowerCase() === role.toLowerCase());
}

class ApiAuthClient {
  private session: AuthSession | null = null;
  private refreshPromise: Promise<AuthSession | null> | null = null;

  /**
   * Admin login - uses /api/auth/admin/login endpoint
   * Server validates admin role - non-admins get 403
   */
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    // Use admin login endpoint - server validates admin role
    const response = await fetch(`${API_URL}/api/auth/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      
      // Specific error for non-admin users
      if (error.code === 'ADMIN_ACCESS_DENIED') {
        throw {
          code: 'ADMIN_ACCESS_DENIED',
          message: 'This portal requires administrator privileges. Please contact your organization admin.',
        } as AuthError;
      }
      
      throw {
        code: error.code || 'LOGIN_FAILED',
        message: error.message || 'Login failed',
      } as AuthError;
    }

    const session = await response.json();
    
    // Double-check admin role on client side (defense in depth)
    if (!isAdminRole(session.user.role)) {
      throw {
        code: 'ADMIN_ACCESS_DENIED',
        message: 'Administrator privileges required.',
      } as AuthError;
    }
    
    this.session = session;
    this.persistSession(session);
    return session;
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        credentials: 'include',
      });
    } catch (error) {
      console.warn('Logout API call failed:', error);
    }
    
    this.session = null;
    this.clearPersistedSession();
  }

  async getSession(): Promise<AuthSession | null> {
    // Check memory first
    if (this.session && this.session.expiresAt > Date.now()) {
      return this.session;
    }

    // Try to restore from storage
    const stored = this.getPersistedSession();
    if (stored) {
      // Check if expired
      if (stored.expiresAt > Date.now()) {
        this.session = stored;
        return stored;
      }
      
      // Try to refresh
      return this.refreshSession();
    }

    return null;
  }

  async refreshSession(): Promise<AuthSession | null> {
    // Prevent concurrent refresh calls
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefresh();
    
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Admin refresh - uses /api/auth/admin/refresh endpoint
   * Server re-validates admin role on every refresh
   */
  private async doRefresh(): Promise<AuthSession | null> {
    const stored = this.getPersistedSession();
    if (!stored?.refreshToken) {
      return null;
    }

    try {
      // Use admin refresh endpoint - server re-validates admin role
      const response = await fetch(`${API_URL}/api/auth/admin/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: stored.refreshToken }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        
        // If admin access denied, user may have lost admin role
        if (error.code === 'ADMIN_ACCESS_DENIED') {
          console.warn('Admin access revoked during refresh');
        }
        
        this.clearPersistedSession();
        return null;
      }

      const session = await response.json();
      
      // Double-check admin role on client side (defense in depth)
      if (!isAdminRole(session.user.role)) {
        console.warn('User no longer has admin role');
        this.clearPersistedSession();
        return null;
      }
      
      this.session = session;
      this.persistSession(session);
      return session;
    } catch (error) {
      console.error('Session refresh failed:', error);
      this.clearPersistedSession();
      return null;
    }
  }

  getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.session?.accessToken) {
      headers['Authorization'] = `Bearer ${this.session.accessToken}`;
    }

    if (this.session?.user?.tenantId) {
      headers['X-Tenant-ID'] = this.session.user.tenantId;
    }

    return headers;
  }

  private persistSession(session: AuthSession): void {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('tt_admin_session', JSON.stringify(session));
    }
  }

  private getPersistedSession(): AuthSession | null {
    if (typeof window === 'undefined') {
      return null;
    }
    
    const stored = sessionStorage.getItem('tt_admin_session');
    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  private clearPersistedSession(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('tt_admin_session');
    }
  }
}

export const apiAuth = new ApiAuthClient();
