'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiAuth, AuthSession, AuthUser, LoginCredentials, AuthError } from './api-auth';

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const currentSession = await apiAuth.getSession();
      setSession(currentSession);
    } catch (error) {
      console.error('Session check failed:', error);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const newSession = await apiAuth.login(credentials);
      setSession(newSession);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await apiAuth.logout();
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSession = async () => {
    const refreshed = await apiAuth.refreshSession();
    setSession(refreshed);
  };

  const value: AuthContextType = {
    user: session?.user ?? null,
    session,
    isLoading,
    isAuthenticated: !!session && session.expiresAt > Date.now(),
    login,
    logout,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useRequireAuth() {
  const auth = useAuth();
  
  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      window.location.href = '/login';
    }
  }, [auth.isLoading, auth.isAuthenticated]);

  return auth;
}
