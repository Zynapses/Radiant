'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  signIn as cognitoSignIn,
  confirmMfa as cognitoConfirmMfa,
  signOut as cognitoSignOut,
  getTokens,
} from './cognito-client';

// ============================================================================
// TYPES
// ============================================================================

export type AdminRole = 'super_admin' | 'admin' | 'operator' | 'auditor';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role: AdminRole;
  permissions: string[];
  mfaEnabled: boolean;
  lastLoginAt?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AdminUser | null;
  accessToken: string | null;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<{ needsMfa: boolean }>;
  confirmMfa: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

// ============================================================================
// CONTEXT
// ============================================================================

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    accessToken: null,
    error: null,
  });

  const fetchAdminProfile = useCallback(async (token: string): Promise<AdminUser> => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v2/admin/profile`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch admin profile');
    }
    
    return response.json();
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const tokens = await getTokens();
      
      if (tokens?.accessToken) {
        const adminProfile = await fetchAdminProfile(tokens.accessToken);
        
        setState({
          isAuthenticated: true,
          isLoading: false,
          user: adminProfile,
          accessToken: tokens.accessToken,
          error: null,
        });
      } else {
        throw new Error('No access token');
      }
    } catch {
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        accessToken: null,
        error: null,
      });
    }
  }, [fetchAdminProfile]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const result = await cognitoSignIn(email, password);
      
      if (result.needsMfa) {
        setState(prev => ({ ...prev, isLoading: false }));
        return { needsMfa: true };
      }
      
      if (result.isSignedIn) {
        await checkSession();
      }
      
      return { needsMfa: false };
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }));
      throw error;
    }
  }, [checkSession]);

  const confirmMfa = useCallback(async (code: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const result = await cognitoConfirmMfa(code);
      
      if (result.isSignedIn) {
        await checkSession();
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'MFA verification failed',
      }));
      throw error;
    }
  }, [checkSession]);

  const logout = useCallback(async () => {
    try {
      await cognitoSignOut();
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        accessToken: null,
        error: null,
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    await checkSession();
  }, [checkSession]);

  const hasPermission = useCallback((permission: string): boolean => {
    if (!state.user) return false;
    
    if (state.user.role === 'super_admin') return true;
    
    const parts = permission.split(':');
    if (parts.length === 2) {
      const wildcardPermission = `${parts[0]}:*`;
      if (state.user.permissions.includes(wildcardPermission)) return true;
    }
    
    return state.user.permissions.includes(permission);
  }, [state.user]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        confirmMfa,
        logout,
        refreshSession,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useCurrentAdmin() {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated || !user) {
    throw new Error('Not authenticated');
  }
  
  return user;
}
