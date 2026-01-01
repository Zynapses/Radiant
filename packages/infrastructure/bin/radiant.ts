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
import { BobbleTierTransitionStack } from '../lib/stacks/bobble-tier-transition-stack';
import { BrainStack } from '../lib/stacks/brain-stack';
import { 
  RADIANT_VERSION, 
  getTierConfig,
  type TierLevel,
  type Environment 
} from '@radiant/shared';

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
// BRAIN STACK (Phase 3 - AGI Brain v6.0.4)
// ============================================================================

// 10. Brain Stack (Ghost Vectors, SOFAI, Dreaming, Oversight)
const brainStack = new BrainStack(app, `${stackPrefix}-brain`, {
  env,
  vpc: networkingStack.vpc,
  dbSecurityGroup: securityStack.databaseSecurityGroup,
  dbClusterArn: dataStack.cluster.clusterArn,
  dbSecretArn: dataStack.cluster.secret?.secretArn || '',
  environment,
  tags,
  description: `RADIANT AGI Brain v6.0.4 - ${appId} ${environment}`,
});
brainStack.addDependency(aiStack);
brainStack.addDependency(dataStack);

// ============================================================================
// BOBBLE INFRASTRUCTURE TIER TRANSITION (Phase 3)
// ============================================================================

// 11. Bobble Tier Transition Stack (Step Functions workflow for tier switching)
const bobbleTierTransitionStack = new BobbleTierTransitionStack(app, `${stackPrefix}-bobble-tier-transition`, {
  env,
  environment: environment as 'dev' | 'staging' | 'prod',
  dbClusterArn: dataStack.cluster.clusterArn,
  dbSecretArn: dataStack.cluster.secret?.secretArn,
  dbName: 'radiant',
  tags,
  description: `RADIANT Bobble Tier Transition - ${appId} ${environment}`,
});
bobbleTierTransitionStack.addDependency(adminStack);
bobbleTierTransitionStack.addDependency(dataStack);

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
