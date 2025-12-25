'use client';

import { useAuth, useCurrentAdmin } from './context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export { useAuth, useCurrentAdmin };

/**
 * Hook to protect routes that require authentication
 */
export function useRequireAuth(requiredPermission?: string) {
  const { isAuthenticated, isLoading, hasPermission, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      const returnUrl = encodeURIComponent(pathname);
      router.push(`/login?returnUrl=${returnUrl}`);
      return;
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
      router.push('/unauthorized');
    }
  }, [isAuthenticated, isLoading, hasPermission, requiredPermission, pathname, router]);

  return {
    isLoading,
    isAuthenticated,
    user,
    hasPermission,
  };
}

/**
 * Hook to check if user can perform production actions
 */
export function useProductionAccess() {
  const { user, hasPermission } = useAuth();
  
  const canAccessProduction = user?.mfaEnabled && hasPermission('deployments:prod');
  
  return {
    canAccessProduction,
    mfaRequired: !user?.mfaEnabled,
    hasPermission: hasPermission('deployments:prod'),
  };
}
