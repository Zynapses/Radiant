'use client';

/**
 * Think Tank Context
 * Provides system-wide awareness of Think Tank installation status
 * When uninstalled, data remains in DB but becomes view-only
 */

import React, { createContext, useContext, useCallback, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// TYPES
// ============================================================================

export interface ThinkTankStatus {
  installed: boolean;
  version: string | null;
  lastActiveAt: string | null;
  installDate: string | null;
  uninstallDate: string | null;
  dataRetained: boolean;
  features: ThinkTankFeatures;
  health: ThinkTankHealth | null;
}

export interface ThinkTankFeatures {
  conversations: boolean;
  collaboration: boolean;
  domainModes: boolean;
  modelCategories: boolean;
  userManagement: boolean;
}

export interface ThinkTankHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  latencyMs: number;
  lastCheck: string;
  activeUsers: number;
  activeConversations: number;
  errorRate: number;
}

export interface ThinkTankConfig {
  maxUsersPerTenant: number;
  maxConversationsPerUser: number;
  maxTokensPerConversation: number;
  enabledModels: string[];
  enabledDomainModes: string[];
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  features: {
    collaboration: boolean;
    voiceInput: boolean;
    codeExecution: boolean;
    fileUploads: boolean;
    imageGeneration: boolean;
  };
}

interface ThinkTankContextValue {
  status: ThinkTankStatus | null;
  config: ThinkTankConfig | null;
  isLoading: boolean;
  error: Error | null;
  isInstalled: boolean;
  isViewOnly: boolean;
  refreshStatus: () => Promise<void>;
  updateConfig: (config: Partial<ThinkTankConfig>) => Promise<void>;
  reinstall: () => Promise<void>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ThinkTankContext = createContext<ThinkTankContextValue | null>(null);

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchThinkTankStatus(): Promise<ThinkTankStatus> {
  const response = await fetch('/api/admin/thinktank/status');
  if (!response.ok) {
    // If Think Tank is not installed, return default status
    if (response.status === 404) {
      return {
        installed: false,
        version: null,
        lastActiveAt: null,
        installDate: null,
        uninstallDate: null,
        dataRetained: false,
        features: {
          conversations: false,
          collaboration: false,
          domainModes: false,
          modelCategories: false,
          userManagement: false,
        },
        health: null,
      };
    }
    throw new Error('Failed to fetch Think Tank status');
  }
  return response.json();
}

async function fetchThinkTankConfig(): Promise<ThinkTankConfig | null> {
  const response = await fetch('/api/admin/thinktank/config');
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error('Failed to fetch Think Tank config');
  }
  return response.json();
}

async function updateThinkTankConfig(config: Partial<ThinkTankConfig>): Promise<ThinkTankConfig> {
  const response = await fetch('/api/admin/thinktank/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    throw new Error('Failed to update Think Tank config');
  }
  return response.json();
}

async function reinstallThinkTank(): Promise<void> {
  const response = await fetch('/api/admin/thinktank/reinstall', {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to reinstall Think Tank');
  }
}

// ============================================================================
// PROVIDER
// ============================================================================

export function ThinkTankProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { 
    data: status, 
    isLoading: statusLoading, 
    error: statusError,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['thinktank', 'status'],
    queryFn: fetchThinkTankStatus,
    refetchInterval: 60000, // Check every minute
    staleTime: 30000,
  });

  const { 
    data: config, 
    isLoading: configLoading,
  } = useQuery({
    queryKey: ['thinktank', 'config'],
    queryFn: fetchThinkTankConfig,
    enabled: status?.installed === true,
    staleTime: 60000,
  });

  const updateConfigMutation = useMutation({
    mutationFn: updateThinkTankConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinktank', 'config'] });
    },
  });

  const reinstallMutation = useMutation({
    mutationFn: reinstallThinkTank,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinktank'] });
    },
  });

  const refreshStatus = useCallback(async () => {
    await refetchStatus();
  }, [refetchStatus]);

  const updateConfig = useCallback(async (newConfig: Partial<ThinkTankConfig>) => {
    await updateConfigMutation.mutateAsync(newConfig);
  }, [updateConfigMutation]);

  const reinstall = useCallback(async () => {
    await reinstallMutation.mutateAsync();
  }, [reinstallMutation]);

  const isInstalled = status?.installed ?? false;
  const isViewOnly = !isInstalled && (status?.dataRetained ?? false);

  const value: ThinkTankContextValue = {
    status: status ?? null,
    config: config ?? null,
    isLoading: statusLoading || configLoading,
    error: statusError as Error | null,
    isInstalled,
    isViewOnly,
    refreshStatus,
    updateConfig,
    reinstall,
  };

  return (
    <ThinkTankContext.Provider value={value}>
      {children}
    </ThinkTankContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useThinkTank() {
  const context = useContext(ThinkTankContext);
  if (!context) {
    throw new Error('useThinkTank must be used within a ThinkTankProvider');
  }
  return context;
}

// ============================================================================
// VIEW-ONLY WRAPPER COMPONENT
// ============================================================================

interface ViewOnlyWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  showBanner?: boolean;
}

export function ThinkTankViewOnly({ 
  children, 
  fallback,
  showBanner = true,
}: ViewOnlyWrapperProps) {
  const { isInstalled, isViewOnly, status } = useThinkTank();

  if (!isInstalled && !isViewOnly) {
    return fallback || (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">Think Tank Not Installed</h3>
        <p className="text-muted-foreground max-w-md">
          Think Tank is not currently installed. Install Think Tank to enable AI-powered conversations and collaboration features.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {isViewOnly && showBanner && (
        <div className="sticky top-0 z-50 bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 px-4 py-2">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="text-sm font-medium">
              View Only Mode - Think Tank was uninstalled on {status?.uninstallDate ? new Date(status.uninstallDate).toLocaleDateString() : 'unknown date'}. 
              Data is preserved and will be available if reinstalled.
            </span>
          </div>
        </div>
      )}
      <div className={isViewOnly ? 'pointer-events-none opacity-75' : ''}>
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// STATUS INDICATOR COMPONENT
// ============================================================================

interface StatusIndicatorProps {
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ThinkTankStatusIndicator({ showLabel = true, size = 'md' }: StatusIndicatorProps) {
  const { status, isInstalled, isViewOnly, isLoading } = useThinkTank();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className={`animate-pulse rounded-full bg-gray-300 ${
          size === 'sm' ? 'h-2 w-2' : size === 'md' ? 'h-3 w-3' : 'h-4 w-4'
        }`} />
        {showLabel && <span className="text-sm text-muted-foreground">Loading...</span>}
      </div>
    );
  }

  const getStatusConfig = () => {
    if (!isInstalled && !isViewOnly) {
      return { color: 'bg-gray-400', label: 'Not Installed', textColor: 'text-gray-600' };
    }
    if (isViewOnly) {
      return { color: 'bg-amber-400', label: 'View Only', textColor: 'text-amber-600' };
    }
    if (!status?.health) {
      return { color: 'bg-gray-400', label: 'Unknown', textColor: 'text-gray-600' };
    }
    switch (status.health.status) {
      case 'healthy':
        return { color: 'bg-green-500', label: 'Healthy', textColor: 'text-green-600' };
      case 'degraded':
        return { color: 'bg-amber-500', label: 'Degraded', textColor: 'text-amber-600' };
      case 'unhealthy':
        return { color: 'bg-red-500', label: 'Unhealthy', textColor: 'text-red-600' };
      case 'offline':
        return { color: 'bg-gray-500', label: 'Offline', textColor: 'text-gray-600' };
      default:
        return { color: 'bg-gray-400', label: 'Unknown', textColor: 'text-gray-600' };
    }
  };

  const config = getStatusConfig();
  const dotSize = size === 'sm' ? 'h-2 w-2' : size === 'md' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <div className="flex items-center gap-2">
      <div className={`rounded-full ${config.color} ${dotSize}`} />
      {showLabel && (
        <span className={`text-sm font-medium ${config.textColor}`}>
          Think Tank: {config.label}
        </span>
      )}
    </div>
  );
}
