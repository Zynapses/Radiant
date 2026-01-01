/**
 * RADIANT v4.18.0 - Environment & Tier Types
 * SINGLE SOURCE OF TRUTH
 */

export type Environment = 'dev' | 'staging' | 'prod';

export interface EnvironmentInfo {
  name: Environment;
  displayName: string;
  color: string;
  requiresApproval: boolean;
  minTier: TierLevel;
  defaultTier: TierLevel;
}

export type TierLevel = 1 | 2 | 3 | 4 | 5;

export type TierName = 'SEED' | 'STARTUP' | 'GROWTH' | 'SCALE' | 'ENTERPRISE';

export interface TierConfig {
  level: TierLevel;
  name: TierName;
  description: string;
  
  // Compute
  vpcCidr: string;
  azCount: number;
  natGateways: number;
  
  // Database
  auroraMinCapacity: number;
  auroraMaxCapacity: number;
  enableGlobalDatabase: boolean;
  
  // Cache
  elasticacheNodes: number;
  elasticacheNodeType: string;
  
  // AI
  enableSelfHostedModels: boolean;
  maxSagemakerEndpoints: number;
  litellmTaskCount: number;
  litellmCpu: number;
  litellmMemory: number;
  
  // Brain (AGI Brain v6.0.4)
  enableBrain: boolean;
  
  // Security
  enableWaf: boolean;
  enableGuardDuty: boolean;
  enableSecurityHub: boolean;
  
  // Compliance
  enableHipaa: boolean;
  
  // Costs
  estimatedMonthlyCost: CostEstimate;
}

export interface CostEstimate {
  min: number;
  max: number;
  typical: number;
}

export interface RegionConfig {
  code: string;
  name: string;
  available: boolean;
  isGlobal: boolean;
}
