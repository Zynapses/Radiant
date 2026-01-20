/**
 * API-Only Authentication for Think Tank Consumer
 * 
 * CRITICAL: This app MUST NOT use Cognito SDK directly.
 * All authentication goes through the Radiant API.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

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
  role: string;
  permissions: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
  tenantId: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
  tenantId: string;
}

export interface AuthError {
  code: string;
  message: string;
}

class ApiAuthClient {
  private session: AuthSession | null = null;
  private refreshPromise: Promise<AuthSession | null> | null = null;

  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw {
        code: error.code || 'LOGIN_FAILED',
        message: error.message || 'Login failed',
      } as AuthError;
    }

    const session = await response.json();
    this.session = session;
    this.persistSession(session);
    return session;
  }

  async register(data: RegisterData): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw {
        code: error.code || 'REGISTER_FAILED',
        message: error.message || 'Registration failed',
      } as AuthError;
    }

    return response.json();
  }

  async verifyEmail(email: string, code: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, code }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw {
        code: error.code || 'VERIFY_FAILED',
        message: error.message || 'Verification failed',
      } as AuthError;
    }

    return response.json();
  }

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    return response.json();
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, code, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw {
        code: error.code || 'RESET_FAILED',
        message: error.message || 'Password reset failed',
      } as AuthError;
    }

    return response.json();
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
    if (this.session && this.session.expiresAt > Date.now()) {
      return this.session;
    }

    const stored = this.getPersistedSession();
    if (stored) {
      if (stored.expiresAt > Date.now()) {
        this.session = stored;
        return stored;
      }
      
      return this.refreshSession();
    }

    return null;
  }

  async refreshSession(): Promise<AuthSession | null> {
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

  private async doRefresh(): Promise<AuthSession | null> {
    const stored = this.getPersistedSession();
    if (!stored?.refreshToken) {
      return null;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: stored.refreshToken }),
        credentials: 'include',
      });

      if (!response.ok) {
        this.clearPersistedSession();
        return null;
      }

      const session = await response.json();
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
      localStorage.setItem('tt_session', JSON.stringify(session));
    }
  }

  private getPersistedSession(): AuthSession | null {
    if (typeof window === 'undefined') {
      return null;
    }
    
    const stored = localStorage.getItem('tt_session');
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
      localStorage.removeItem('tt_session');
    }
  }
}

export const apiAuth = new ApiAuthClient();
