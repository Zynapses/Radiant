"use strict";
/**
 * RADIANT v4.17.0 - Infrastructure Tiers
 * SINGLE SOURCE OF TRUTH
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIER_CONFIGS = exports.TIER_NAMES = void 0;
exports.getTierConfig = getTierConfig;
exports.getTierName = getTierName;
exports.validateTierForEnvironment = validateTierForEnvironment;
exports.getFeatureFlagsForTier = getFeatureFlagsForTier;
exports.TIER_NAMES = {
    1: 'SEED',
    2: 'STARTUP',
    3: 'GROWTH',
    4: 'SCALE',
    5: 'ENTERPRISE',
};
exports.TIER_CONFIGS = {
    1: {
        level: 1,
        name: 'SEED',
        description: 'Development and testing, minimal costs',
        vpcCidr: '10.0.0.0/20',
        azCount: 2,
        natGateways: 1,
        auroraMinCapacity: 0.5,
        auroraMaxCapacity: 2,
        enableGlobalDatabase: false,
        elasticacheNodes: 0,
        elasticacheNodeType: 'cache.t4g.micro',
        enableSelfHostedModels: false,
        maxSagemakerEndpoints: 0,
        litellmTaskCount: 1,
        litellmCpu: 256,
        litellmMemory: 512,
        enableWaf: false,
        enableGuardDuty: false,
        enableSecurityHub: false,
        enableHipaa: false,
        estimatedMonthlyCost: { min: 50, max: 150, typical: 85 },
    },
    2: {
        level: 2,
        name: 'STARTUP',
        description: 'Small production workloads',
        vpcCidr: '10.0.0.0/18',
        azCount: 2,
        natGateways: 1,
        auroraMinCapacity: 1,
        auroraMaxCapacity: 8,
        enableGlobalDatabase: false,
        elasticacheNodes: 1,
        elasticacheNodeType: 'cache.t4g.small',
        enableSelfHostedModels: false,
        maxSagemakerEndpoints: 0,
        litellmTaskCount: 2,
        litellmCpu: 512,
        litellmMemory: 1024,
        enableWaf: true,
        enableGuardDuty: true,
        enableSecurityHub: false,
        enableHipaa: false,
        estimatedMonthlyCost: { min: 200, max: 400, typical: 255 },
    },
    3: {
        level: 3,
        name: 'GROWTH',
        description: 'Medium production with self-hosted models',
        vpcCidr: '10.0.0.0/17',
        azCount: 3,
        natGateways: 2,
        auroraMinCapacity: 2,
        auroraMaxCapacity: 16,
        enableGlobalDatabase: false,
        elasticacheNodes: 2,
        elasticacheNodeType: 'cache.r6g.large',
        enableSelfHostedModels: true,
        maxSagemakerEndpoints: 10,
        litellmTaskCount: 3,
        litellmCpu: 1024,
        litellmMemory: 2048,
        enableWaf: true,
        enableGuardDuty: true,
        enableSecurityHub: true,
        enableHipaa: true,
        estimatedMonthlyCost: { min: 1000, max: 2500, typical: 1475 },
    },
    4: {
        level: 4,
        name: 'SCALE',
        description: 'Large production with multi-region',
        vpcCidr: '10.0.0.0/16',
        azCount: 3,
        natGateways: 3,
        auroraMinCapacity: 4,
        auroraMaxCapacity: 64,
        enableGlobalDatabase: true,
        elasticacheNodes: 3,
        elasticacheNodeType: 'cache.r6g.xlarge',
        enableSelfHostedModels: true,
        maxSagemakerEndpoints: 30,
        litellmTaskCount: 5,
        litellmCpu: 2048,
        litellmMemory: 4096,
        enableWaf: true,
        enableGuardDuty: true,
        enableSecurityHub: true,
        enableHipaa: true,
        estimatedMonthlyCost: { min: 4000, max: 8000, typical: 5450 },
    },
    5: {
        level: 5,
        name: 'ENTERPRISE',
        description: 'Enterprise-grade global deployment',
        vpcCidr: '10.0.0.0/14',
        azCount: 3,
        natGateways: 3,
        auroraMinCapacity: 8,
        auroraMaxCapacity: 128,
        enableGlobalDatabase: true,
        elasticacheNodes: 6,
        elasticacheNodeType: 'cache.r6g.2xlarge',
        enableSelfHostedModels: true,
        maxSagemakerEndpoints: 100,
        litellmTaskCount: 10,
        litellmCpu: 4096,
        litellmMemory: 8192,
        enableWaf: true,
        enableGuardDuty: true,
        enableSecurityHub: true,
        enableHipaa: true,
        estimatedMonthlyCost: { min: 15000, max: 35000, typical: 21500 },
    },
};
function getTierConfig(tier) {
    return exports.TIER_CONFIGS[tier];
}
function getTierName(tier) {
    return exports.TIER_NAMES[tier];
}
function validateTierForEnvironment(tier, environment) {
    if (environment === 'prod' && tier < 3) {
        throw new Error('Production requires Tier 3 (GROWTH) or higher');
    }
    if (environment === 'staging' && tier < 2) {
        throw new Error('Staging requires Tier 2 (STARTUP) or higher');
    }
}
function getFeatureFlagsForTier(tier) {
    const config = exports.TIER_CONFIGS[tier];
    return {
        selfHostedModels: config.enableSelfHostedModels,
        multiRegion: config.enableGlobalDatabase,
        waf: config.enableWaf,
        guardDuty: config.enableGuardDuty,
        hipaaCompliance: config.enableHipaa,
        advancedAnalytics: tier >= 3,
        customBranding: tier >= 4,
        sla: tier >= 4,
    };
}
//# sourceMappingURL=tiers.js.map