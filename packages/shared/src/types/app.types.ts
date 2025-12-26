/**
 * RADIANT v4.18.0 - Application Types
 * SINGLE SOURCE OF TRUTH
 */

import type { Environment, TierLevel } from './environment.types';

export interface ManagedApp {
  id: string;
  name: string;
  domain: string;
  description?: string;
  icon?: string;
  version?: string;
  status: AppStatus;
  environments: EnvironmentStatus[];
  createdAt: Date;
  updatedAt: Date;
}

export type AppStatus = 'active' | 'inactive' | 'maintenance' | 'deprecated';

export interface EnvironmentStatus {
  environment: Environment;
  status: DeploymentStatus;
  lastDeployed?: Date;
  version?: string;
  tier: TierLevel;
  region: string;
  endpoints?: EnvironmentEndpoints;
}

export type DeploymentStatus = 
  | 'not_deployed' 
  | 'deploying' 
  | 'deployed' 
  | 'failed' 
  | 'updating' 
  | 'destroying';

export interface EnvironmentEndpoints {
  api?: string;
  graphql?: string;
  admin?: string;
  dashboard?: string;
}

export interface AppConfig {
  appId: string;
  appName: string;
  domain: string;
  environments: Record<Environment, EnvironmentConfig>;
}

export interface EnvironmentConfig {
  tier: TierLevel;
  region: string;
  enabledFeatures: FeatureFlags;
  customConfig?: Record<string, unknown>;
}

export interface FeatureFlags {
  selfHostedModels: boolean;
  multiRegion: boolean;
  waf: boolean;
  guardDuty: boolean;
  hipaaCompliance: boolean;
  advancedAnalytics: boolean;
  customBranding: boolean;
  sla: boolean;
}

export type DeploymentPhase =
  | 'idle'
  | 'initializing'
  | 'validating'
  | 'bootstrap'
  | 'foundation'
  | 'networking'
  | 'security'
  | 'data'
  | 'storage'
  | 'auth'
  | 'ai'
  | 'api'
  | 'admin'
  | 'migrations'
  | 'verification'
  | 'complete'
  | 'failed';

export interface DeploymentProgress {
  phase: DeploymentPhase;
  progress: number;
  message: string;
  startedAt: Date;
  estimatedCompletion?: Date;
  logs: LogEntry[];
}

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, unknown>;
}
