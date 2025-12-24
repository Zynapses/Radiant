'use client';

import { useAuthContext } from './context';

export function useAuth() {
  return useAuthContext();
}

export function useCurrentAdmin() {
  const { user, isLoading } = useAuthContext();
  return { admin: user, isLoading };
}

export function useRequireAuth() {
  const { user, isLoading, isAuthenticated } = useAuthContext();
  
  return {
    user,
    isLoading,
    isAuthenticated,
    isAdmin: user?.role === 'admin' || user?.role === 'super_admin',
    isSuperAdmin: user?.role === 'super_admin',
    hasRole: (role: string) => user?.role === role || user?.groups?.includes(role),
  };
}
