#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FoundationStack } from '../lib/stacks/foundation-stack';
import { NetworkingStack } from '../lib/stacks/networking-stack';
import { SecurityStack } from '../lib/stacks/security-stack';
import { DataStack } from '../lib/stacks/data-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { AuthStack } from '../lib/stacks/auth-stack';
import { AIStack } from '../lib/stacks/ai-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { AdminStack } from '../lib/stacks/admin-stack';
import { CatoTierTransitionStack } from '../lib/stacks/cato-tier-transition-stack';
import { CatoRedisStack } from '../lib/stacks/cato-redis-stack';
import { CatoGenesisStack } from '../lib/stacks/cato-genesis-stack';
import { BrainStack } from '../lib/stacks/brain-stack';
import { ThinkTankAuthStack } from '../lib/stacks/thinktank-auth-stack';
import { ThinkTankAdminApiStack } from '../lib/stacks/thinktank-admin-api-stack';
import { LiteLLMGatewayStack } from '../lib/stacks/litellm-gateway-stack';
import { 
  RADIANT_VERSION, 
  getTierConfig,
  type TierLevel,
  type Environment 
} from '@radiant/shared';

// ============================================================================
// 🛑 CRITICAL SAFETY CHECK: Block cdk watch on non-dev environments
// ============================================================================
// This check runs BEFORE any CDK synthesis to prevent dangerous hotswap
// deployments to staging or production environments.
// ============================================================================

const isCdkWatch = process.argv.includes('watch') || 
                   process.env.CDK_WATCH === 'true' ||
                   process.env.npm_lifecycle_event === 'cdk:watch';

const detectedEnv = process.env.RADIANT_ENV || 
                    process.env.CDK_CONTEXT_environment ||
                    (process.env.AWS_PROFILE?.includes('staging') ? 'staging' : 
                     process.env.AWS_PROFILE?.includes('prod') ? 'prod' : 'dev');

if (isCdkWatch && detectedEnv !== 'dev') {
  console.error(`
╔═══════════════════════════════════════════════════════════════════════════╗
║ 🛑 BLOCKED: cdk watch is FORBIDDEN for ${detectedEnv.toUpperCase().padEnd(8)} environment           ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  cdk watch --hotswap bypasses CloudFormation safety checks and can:       ║
║    • Leave infrastructure in inconsistent states                          ║
║    • Skip rollback capabilities                                           ║
║    • Cause production outages                                             ║
║                                                                           ║
║  FOR STAGING/PROD, use one of these SAFE methods:                         ║
║                                                                           ║
║    1. Swift Deployer (recommended)                                        ║
║       Open the Swift Deployer app and use the deployment wizard           ║
║                                                                           ║
║    2. Manual CLI with approval gates:                                     ║
║       AWS_PROFILE=radiant-${detectedEnv} npx cdk deploy --all \\                   ║
║         --require-approval broadening                                     ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

const app = new cdk.App();

// ============================================================================
// CONFIGURATION
// ============================================================================

const appId = app.node.tryGetContext('appId') || 'radiant';
const environment = (app.node.tryGetContext('environment') || 'dev') as Environment;
const tier = (parseInt(app.node.tryGetContext('tier') || '1', 10)) as TierLevel;
const region = app.node.tryGetContext('region') || process.env.CDK_DEFAULT_REGION || 'us-east-1';
const account = app.node.tryGetContext('account') || process.env.CDK_DEFAULT_ACCOUNT;

const tierConfig = getTierConfig(tier);

const stackPrefix = `${appId}-${environment}`;

const env: cdk.Environment = {
  account,
  region,
};

const tags = {
  Project: 'RADIANT',
  AppId: appId,
  Environment: environment,
  Tier: tier.toString(),
  Version: RADIANT_VERSION,
  ManagedBy: 'CDK',
};

// ============================================================================
// LOGGING
// ============================================================================

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║                    RADIANT DEPLOYMENT                         ║');
console.log('╠═══════════════════════════════════════════════════════════════╣');
console.log(`║ App ID:       ${appId.padEnd(48)}║`);
console.log(`║ Environment:  ${environment.padEnd(48)}║`);
console.log(`║ Tier:         ${tier} - ${tierConfig.name.padEnd(42)}║`);
console.log(`║ Region:       ${region.padEnd(48)}║`);
console.log(`║ Version:      ${RADIANT_VERSION.padEnd(48)}║`);
console.log('╚═══════════════════════════════════════════════════════════════╝');

// ============================================================================
// FOUNDATION STACKS (Phase 1)
// ============================================================================

// 1. Foundation Stack
const foundationStack = new FoundationStack(app, `${stackPrefix}-foundation`, {
  env,
  appId,
  environment,
  tier,
  tierConfig,
  tags,
  description: `RADIANT Foundation - ${appId} ${environment}`,
});

// 2. Networking Stack
const networkingStack = new NetworkingStack(app, `${stackPrefix}-networking`, {
  env,
  appId,
  environment,
  tier,
  tierConfig,
  tags,
  description: `RADIANT Networking - ${appId} ${environment}`,
});
networkingStack.addDependency(foundationStack);

// 3. Security Stack
const securityStack = new SecurityStack(app, `${stackPrefix}-security`, {
  env,
  appId,
  environment,
  tier,
  tierConfig,
  vpc: networkingStack.vpc,
  tags,
  description: `RADIANT Security - ${appId} ${environment}`,
});
securityStack.addDependency(networkingStack);

// ============================================================================
// DATA & STORAGE STACKS (Phase 1/2)
// ============================================================================

// 4. Data Stack (Aurora, DynamoDB)
const dataStack = new DataStack(app, `${stackPrefix}-data`, {
  env,
  appId,
  environment,
  tier,
  tierConfig,
  vpc: networkingStack.vpc,
  databaseSecurityGroup: securityStack.databaseSecurityGroup,
  encryptionKey: securityStack.encryptionKey,
  tags,
  description: `RADIANT Data Layer - ${appId} ${environment}`,
});
dataStack.addDependency(securityStack);

// 5. Storage Stack (S3, CloudFront)
const storageStack = new StorageStack(app, `${stackPrefix}-storage`, {
  env,
  appId,
  environment,
  tier,
  tierConfig,
  encryptionKey: securityStack.encryptionKey,
  tags,
  description: `RADIANT Storage - ${appId} ${environment}`,
});
storageStack.addDependency(securityStack);

// ============================================================================
// AUTH & AI STACKS (Phase 2)
// ============================================================================

// 6. Auth Stack (Cognito)
const authStack = new AuthStack(app, `${stackPrefix}-auth`, {
  env,
  appId,
  environment,
  tier,
  tierConfig,
  tags,
  description: `RADIANT Auth - ${appId} ${environment}`,
});
authStack.addDependency(securityStack);

// 7. AI Stack (LiteLLM, ECS)
const aiStack = new AIStack(app, `${stackPrefix}-ai`, {
  env,
  appId,
  environment,
  tier,
  tierConfig,
  vpc: networkingStack.vpc,
  apiSecurityGroup: securityStack.apiSecurityGroup,
  tags,
  description: `RADIANT AI Services - ${appId} ${environment}`,
});
aiStack.addDependency(securityStack);
aiStack.addDependency(networkingStack);

// ============================================================================
// API STACKS (Phase 2)
// ============================================================================

// 8. API Stack (REST API, Lambda)
const apiStack = new ApiStack(app, `${stackPrefix}-api`, {
  env,
  appId,
  environment,
  tier,
  tierConfig,
  vpc: networkingStack.vpc,
  userPool: authStack.userPool,
  adminUserPool: authStack.adminUserPool,
  auroraCluster: dataStack.cluster,
  usageTable: dataStack.usageTable,
  sessionsTable: dataStack.sessionsTable,
  cacheTable: dataStack.cacheTable,
  mediaBucket: storageStack.mediaBucket,
  litellmUrl: aiStack.litellmUrl,
  apiSecurityGroup: securityStack.apiSecurityGroup,
  // Genesis Cato Safety - Redis endpoint will be added after CatoRedisStack is created
  tags,
  description: `RADIANT API Layer - ${appId} ${environment}`,
});
apiStack.addDependency(authStack);
apiStack.addDependency(aiStack);
apiStack.addDependency(dataStack);
apiStack.addDependency(storageStack);

// 9. Admin Stack (Admin Dashboard, Admin API)
const adminStack = new AdminStack(app, `${stackPrefix}-admin`, {
  env,
  appId,
  environment,
  tier,
  tierConfig,
  vpc: networkingStack.vpc,
  adminUserPool: authStack.adminUserPool,
  adminUserPoolClient: authStack.adminUserPoolClient,
  auroraCluster: dataStack.cluster,
  apiSecurityGroup: securityStack.apiSecurityGroup,
  tags,
  description: `RADIANT Admin Dashboard - ${appId} ${environment}`,
});
adminStack.addDependency(apiStack);

// ============================================================================
// THINK TANK AUTH STACK (Phase 2 - Isolated Auth for Think Tank Apps)
// ============================================================================

// 10. Think Tank Auth Stack (API-based auth for Think Tank apps)
// Think Tank apps MUST NOT access Cognito directly - all auth goes through this API
const allowedOrigins = environment === 'prod'
  ? ['https://app.thinktank.ai', 'https://manage.thinktank.ai']
  : environment === 'staging'
  ? ['https://app.staging.thinktank.ai', 'https://manage.staging.thinktank.ai']
  : ['http://localhost:3001', 'http://localhost:3002'];

const thinkTankAuthStack = new ThinkTankAuthStack(app, `${stackPrefix}-thinktank-auth`, {
  env,
  environment,
  domainPrefix: appId,
  allowedOrigins,
  tags,
  description: `RADIANT Think Tank Auth - ${appId} ${environment}`,
});
thinkTankAuthStack.addDependency(securityStack);

// 10b. Think Tank Admin API Stack (separate from main API due to resource limits)
const thinkTankAdminApiStack = new ThinkTankAdminApiStack(app, `${stackPrefix}-thinktank-admin-api`, {
  env,
  environment,
  appId,
  vpc: networkingStack.vpc,
  securityGroup: securityStack.apiSecurityGroup,
  userPool: authStack.userPool,
  databaseSecretArn: dataStack.cluster.secret?.secretArn || '',
  databaseEndpoint: dataStack.cluster.clusterEndpoint.hostname,
  tags,
  description: `RADIANT Think Tank Admin API - ${appId} ${environment}`,
});
thinkTankAdminApiStack.addDependency(authStack);
thinkTankAdminApiStack.addDependency(dataStack);
thinkTankAdminApiStack.addDependency(networkingStack);

// ============================================================================
// BRAIN STACK (Phase 3 - AGI Brain v6.0.4)
// ============================================================================

// 11. Brain Stack (Ghost Vectors, SOFAI, Dreaming, Oversight)
// Only create BrainStack if enabled for this tier (Tier 3+)
let brainStack: BrainStack | undefined;
if (tierConfig.enableBrain) {
  brainStack = new BrainStack(app, `${stackPrefix}-brain`, {
    env,
    vpc: networkingStack.vpc,
    dbSecurityGroup: securityStack.databaseSecurityGroup,
    dbClusterArn: dataStack.cluster.clusterArn,
    dbSecretArn: dataStack.cluster.secret?.secretArn || '',
    environment,
    litellmUrl: aiStack.litellmUrl,
    tags,
    description: `RADIANT AGI Brain v6.0.4 - ${appId} ${environment}`,
  });
  brainStack.addDependency(aiStack);
  brainStack.addDependency(dataStack);
} else {
  console.log(`║ Brain Stack:  SKIPPED (requires Tier 3+)                      ║`);
}

// ============================================================================
// GENESIS CATO SAFETY ARCHITECTURE (Phase 3)
// ============================================================================

// 11. Cato Redis Stack (Epistemic Recovery state persistence)
// Only create for Tier 2+ as safety features require Redis
let catoRedisStack: CatoRedisStack | undefined;
if (tier >= 2) {
  const tierMapping: Record<number, 'SEED' | 'SPROUT' | 'GROWTH' | 'SCALE' | 'ENTERPRISE'> = {
    1: 'SEED',
    2: 'SPROUT',
    3: 'GROWTH',
    4: 'SCALE',
    5: 'ENTERPRISE',
  };
  
  catoRedisStack = new CatoRedisStack(app, `${stackPrefix}-cato-redis`, {
    env,
    vpc: networkingStack.vpc,
    lambdaSecurityGroup: securityStack.apiSecurityGroup,
    environment,
    tier: tierMapping[tier] || 'SPROUT',
    tags,
    description: `RADIANT Genesis Cato Safety - ${appId} ${environment}`,
  });
  catoRedisStack.addDependency(networkingStack);
  catoRedisStack.addDependency(securityStack);
} else {
  console.log(`║ Cato Redis:   SKIPPED (requires Tier 2+)                      ║`);
}

// ============================================================================
// LITELLM GATEWAY STACK (Phase 3.5 - Enhanced Auto-Scaling Gateway)
// ============================================================================

// 11b. LiteLLM Gateway Stack (Enhanced ECS with auto-scaling, alarms, configurable params)
// Only create for Tier 3+ which need production-grade scaling
let litellmGatewayStack: LiteLLMGatewayStack | undefined;
if (tier >= 3) {
  litellmGatewayStack = new LiteLLMGatewayStack(app, `${stackPrefix}-litellm-gateway`, {
    env,
    appId,
    environment,
    vpc: networkingStack.vpc,
    cluster: aiStack.cluster,
    redisEndpoint: catoRedisStack?.redisEndpoint,
    redisPort: catoRedisStack?.redisPort,
    minTasks: tier >= 4 ? 4 : 2,
    maxTasks: tier >= 5 ? 100 : tier >= 4 ? 50 : 20,
    desiredTasks: tier >= 4 ? 4 : 2,
    taskCpu: tier >= 4 ? 2048 : 1024,
    taskMemory: tier >= 4 ? 4096 : 2048,
    targetCpuUtilization: 70,
    targetMemoryUtilization: 80,
    enableAlarms: true,
    alarmEmail: app.node.tryGetContext('alertEmail'),
    tags,
    description: `RADIANT LiteLLM Gateway - ${appId} ${environment}`,
  });
  litellmGatewayStack.addDependency(aiStack);
  litellmGatewayStack.addDependency(networkingStack);
  if (catoRedisStack) {
    litellmGatewayStack.addDependency(catoRedisStack);
  }
  console.log(`║ LiteLLM Gateway: ENABLED (Tier 3+ auto-scaling)               ║`);
} else {
  console.log(`║ LiteLLM Gateway: SKIPPED (requires Tier 3+)                   ║`);
}

// 12. Cato Genesis Stack (Monitoring and alerting for Cato safety)
const catoGenesisStack = new CatoGenesisStack(app, `${stackPrefix}-cato-genesis`, {
  env,
  appId,
  environment,
  alertEmail: app.node.tryGetContext('alertEmail'),
  monthlyBudgetUsd: tier >= 3 ? 1000 : 500,
  tags,
  description: `RADIANT Cato Genesis Monitoring - ${appId} ${environment}`,
});
catoGenesisStack.addDependency(foundationStack);

// ============================================================================
// CATO INFRASTRUCTURE TIER TRANSITION (Phase 3)
// ============================================================================

// 13. Cato Tier Transition Stack (Step Functions workflow for tier switching)
const catoTierTransitionStack = new CatoTierTransitionStack(app, `${stackPrefix}-cato-tier-transition`, {
  env,
  environment: environment as 'dev' | 'staging' | 'prod',
  dbClusterArn: dataStack.cluster.clusterArn,
  dbSecretArn: dataStack.cluster.secret?.secretArn,
  dbName: 'radiant',
  tags,
  description: `RADIANT Cato Tier Transition - ${appId} ${environment}`,
});
catoTierTransitionStack.addDependency(adminStack);
catoTierTransitionStack.addDependency(dataStack);

// ============================================================================
// TAGGING
// ============================================================================

cdk.Tags.of(app).add('Project', 'RADIANT');
cdk.Tags.of(app).add('AppId', appId);
cdk.Tags.of(app).add('Environment', environment);
cdk.Tags.of(app).add('Tier', String(tier));
cdk.Tags.of(app).add('ManagedBy', 'CDK');
cdk.Tags.of(app).add('Version', RADIANT_VERSION);

app.synth();
