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
    vpcCidr: string;
    azCount: number;
    natGateways: number;
    auroraMinCapacity: number;
    auroraMaxCapacity: number;
    enableGlobalDatabase: boolean;
    elasticacheNodes: number;
    elasticacheNodeType: string;
    enableSelfHostedModels: boolean;
    maxSagemakerEndpoints: number;
    litellmTaskCount: number;
    litellmCpu: number;
    litellmMemory: number;
    enableWaf: boolean;
    enableGuardDuty: boolean;
    enableSecurityHub: boolean;
    enableHipaa: boolean;
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
//# sourceMappingURL=environment.types.d.ts.map