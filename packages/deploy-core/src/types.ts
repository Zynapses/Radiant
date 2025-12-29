// @radiant/deploy-core - Deployment Types
// Platform-agnostic types for deployment operations

export type Environment = 'development' | 'staging' | 'production';
export type DeploymentStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
export type StackStatus = 'CREATE_IN_PROGRESS' | 'CREATE_COMPLETE' | 'CREATE_FAILED' | 
  'UPDATE_IN_PROGRESS' | 'UPDATE_COMPLETE' | 'UPDATE_FAILED' |
  'DELETE_IN_PROGRESS' | 'DELETE_COMPLETE' | 'DELETE_FAILED' |
  'ROLLBACK_IN_PROGRESS' | 'ROLLBACK_COMPLETE' | 'ROLLBACK_FAILED';

export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
  accountId?: string;
}

export interface DeploymentConfig {
  appId: string;
  environment: Environment;
  tier: number;
  region: string;
  credentials: AWSCredentials;
  vpcCidrOverride?: string;
  storageTypeOverride?: 'aurora' | 'fargate_postgres' | 'dynamodb';
  tags?: Record<string, string>;
}

export interface StackInfo {
  stackName: string;
  stackId: string;
  status: StackStatus;
  statusReason?: string;
  outputs: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeploymentResult {
  deploymentId: string;
  status: DeploymentStatus;
  stacks: StackInfo[];
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  outputs: Record<string, string>;
}

export interface HealthCheckResult {
  service: string;
  healthy: boolean;
  latencyMs: number;
  message?: string;
  checkedAt: Date;
}

export interface SnapshotInfo {
  snapshotId: string;
  deploymentId: string;
  appId: string;
  environment: Environment;
  tier: number;
  createdAt: Date;
  stacks: string[];
  outputs: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface DeploymentProgress {
  phase: 'preparing' | 'deploying' | 'configuring' | 'verifying' | 'completed' | 'failed';
  currentStack?: string;
  totalStacks: number;
  completedStacks: number;
  message: string;
  percentage: number;
}

export type ProgressCallback = (progress: DeploymentProgress) => void;

export interface DeployerOptions {
  dryRun?: boolean;
  skipHealthChecks?: boolean;
  parallelStacks?: boolean;
  maxRetries?: number;
  timeoutMinutes?: number;
  onProgress?: ProgressCallback;
}

export interface StackDependency {
  stackName: string;
  dependsOn: string[];
  priority: number;
}

export const STACK_DEPLOYMENT_ORDER: StackDependency[] = [
  { stackName: 'NetworkingStack', dependsOn: [], priority: 1 },
  { stackName: 'SecurityStack', dependsOn: ['NetworkingStack'], priority: 2 },
  { stackName: 'DataStack', dependsOn: ['NetworkingStack', 'SecurityStack'], priority: 3 },
  { stackName: 'ComputeStack', dependsOn: ['NetworkingStack', 'SecurityStack'], priority: 4 },
  { stackName: 'AIStack', dependsOn: ['DataStack', 'ComputeStack'], priority: 5 },
  { stackName: 'APIStack', dependsOn: ['DataStack', 'ComputeStack', 'AIStack'], priority: 6 },
  { stackName: 'MonitoringStack', dependsOn: ['APIStack'], priority: 7 },
];
