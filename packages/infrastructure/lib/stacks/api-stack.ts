import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import type { TierConfig, Environment } from '@radiant/shared';
import { RADIANT_VERSION } from '@radiant/shared';

export interface ApiStackProps extends cdk.StackProps {
  appId: string;
  environment: Environment;
  tier: number;
  tierConfig: TierConfig;
  vpc: ec2.Vpc;
  userPool: cognito.UserPool;
  adminUserPool: cognito.UserPool;
  auroraCluster: rds.DatabaseCluster;
  usageTable: dynamodb.Table;
  sessionsTable: dynamodb.Table;
  cacheTable: dynamodb.Table;
  mediaBucket: s3.Bucket;
  litellmUrl: string;
  apiSecurityGroup: ec2.SecurityGroup;
  sagemakerRoleArn?: string;
  // Genesis Cato Safety Architecture
  catoRedisEndpoint?: string;
  catoRedisPort?: number;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly routerFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const {
      appId, environment, tier, vpc, userPool, adminUserPool,
      auroraCluster, usageTable, sessionsTable, cacheTable, mediaBucket,
      litellmUrl, apiSecurityGroup,
    } = props;

    // Lambda execution role
    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });

    // Common Lambda environment
    const commonEnv: Record<string, string> = {
      APP_ID: appId,
      ENVIRONMENT: environment,
      TIER: tier.toString(),
      LITELLM_URL: litellmUrl,
      AURORA_SECRET_ARN: auroraCluster.secret?.secretArn || '',
      AURORA_CLUSTER_ARN: auroraCluster.clusterArn,
      USAGE_TABLE: usageTable.tableName,
      SESSIONS_TABLE: sessionsTable.tableName,
      CACHE_TABLE: cacheTable.tableName,
      MEDIA_BUCKET: mediaBucket.bucketName,
      USER_POOL_ID: userPool.userPoolId,
      ADMIN_USER_POOL_ID: adminUserPool.userPoolId,
      LOG_LEVEL: environment === 'prod' ? 'info' : 'debug',
      RADIANT_VERSION: RADIANT_VERSION,
      // Genesis Cato Safety Architecture
      ...(props.catoRedisEndpoint ? {
        CATO_REDIS_ENDPOINT: props.catoRedisEndpoint,
        CATO_REDIS_PORT: String(props.catoRedisPort || 6379),
      } : {}),
    };

    // Router Lambda
    this.routerFunction = new lambda.Function(this, 'RouterFunction', {
      functionName: `${appId}-${environment}-router`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'api/router.handler',
      code: lambda.Code.fromAsset('lambda/dist'),
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: commonEnv,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [apiSecurityGroup],
      role: lambdaRole,
      tracing: tier >= 2 ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Grant permissions
    auroraCluster.secret?.grantRead(lambdaRole);
    usageTable.grantReadWriteData(lambdaRole);
    sessionsTable.grantReadWriteData(lambdaRole);
    cacheTable.grantReadWriteData(lambdaRole);
    mediaBucket.grantReadWrite(lambdaRole);

    // RDS Data API access
    lambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'rds-data:ExecuteStatement',
        'rds-data:BatchExecuteStatement',
        'rds-data:BeginTransaction',
        'rds-data:CommitTransaction',
        'rds-data:RollbackTransaction',
      ],
      resources: [auroraCluster.clusterArn],
    }));

    // REST API
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: `${appId}-${environment}-api`,
      description: `RADIANT API for ${appId} ${environment}`,
      deployOptions: {
        stageName: 'v2',
        throttlingRateLimit: tier >= 3 ? 10000 : 1000,
        throttlingBurstLimit: tier >= 3 ? 5000 : 500,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: environment !== 'prod',
        metricsEnabled: true,
        tracingEnabled: tier >= 2,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'X-Tenant-Id'],
      },
    });

    // Cognito Authorizer
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: `${appId}-${environment}-authorizer`,
      identitySource: 'method.request.header.Authorization',
    });

    // Admin Cognito Authorizer
    const adminAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'AdminAuthorizer', {
      cognitoUserPools: [adminUserPool],
      authorizerName: `${appId}-${environment}-admin-authorizer`,
      identitySource: 'method.request.header.Authorization',
    });

    // Lambda integration
    const routerIntegration = new apigateway.LambdaIntegration(this.routerFunction, {
      proxy: true,
    });

    // API Resources
    const v2 = this.api.root.addResource('api').addResource('v2');

    // Health check (no auth)
    const health = v2.addResource('health');
    health.addMethod('GET', routerIntegration);

    // Chat endpoints
    const chat = v2.addResource('chat');
    chat.addResource('completions').addMethod('POST', routerIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Models endpoints
    const models = v2.addResource('models');
    models.addMethod('GET', routerIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    models.addResource('{modelId}').addMethod('GET', routerIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Providers endpoints
    const providers = v2.addResource('providers');
    providers.addMethod('GET', routerIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Admin endpoints
    const admin = v2.addResource('admin');
    admin.addProxy({
      defaultIntegration: routerIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // Usage tracking (no auth for internal use)
    const usage = v2.addResource('usage');
    usage.addMethod('POST', routerIntegration);

    // =========================================================================
    // Phase 7-9 API Endpoints
    // =========================================================================

    // Feedback Learning API
    const feedback = v2.addResource('feedback');
    feedback.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(
        this.createLambda('Feedback', 'feedback/handler.handler', commonEnv, vpc, apiSecurityGroup, lambdaRole)
      ),
      defaultMethodOptions: {
        authorizer: cognitoAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // Neural Orchestration API
    const orchestration = v2.addResource('orchestration');
    orchestration.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(
        this.createLambda('Orchestration', 'orchestration/handler.handler', commonEnv, vpc, apiSecurityGroup, lambdaRole)
      ),
      defaultMethodOptions: {
        authorizer: cognitoAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // Workflow Proposals API
    const proposals = v2.addResource('proposals');
    proposals.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(
        this.createLambda('Proposals', 'proposals/handler.handler', commonEnv, vpc, apiSecurityGroup, lambdaRole)
      ),
      defaultMethodOptions: {
        authorizer: cognitoAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // Localization API (public endpoints + admin)
    const localization = v2.addResource('localization');
    const localizationLambda = this.createLambda('Localization', 'localization/handler.handler', commonEnv, vpc, apiSecurityGroup, lambdaRole);
    const localizationIntegration = new apigateway.LambdaIntegration(localizationLambda);
    
    // Public endpoints
    localization.addResource('languages').addMethod('GET', localizationIntegration);
    localization.addResource('bundle').addMethod('GET', localizationIntegration);
    localization.addResource('translate').addMethod('GET', localizationIntegration);
    
    // Admin endpoints
    localization.addResource('register').addMethod('POST', localizationIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    localization.addResource('translation').addMethod('POST', localizationIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    localization.addResource('approve').addMethod('POST', localizationIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    localization.addResource('stats').addMethod('GET', localizationIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Configuration API
    const configuration = v2.addResource('configuration');
    configuration.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(
        this.createLambda('Configuration', 'configuration/handler.handler', commonEnv, vpc, apiSecurityGroup, lambdaRole)
      ),
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // Billing API
    const billing = v2.addResource('billing');
    const billingLambda = this.createLambda('Billing', 'billing/handler.handler', commonEnv, vpc, apiSecurityGroup, lambdaRole);
    const billingIntegration = new apigateway.LambdaIntegration(billingLambda);
    
    // Public tier listing
    billing.addResource('tiers').addMethod('GET', billingIntegration);
    
    // Authenticated billing endpoints
    billing.addResource('subscription').addMethod('ANY', billingIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    billing.addResource('credits').addProxy({
      defaultIntegration: billingIntegration,
      defaultMethodOptions: {
        authorizer: cognitoAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });
    billing.addResource('transactions').addMethod('GET', billingIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Storage API
    const storage = v2.addResource('storage');
    storage.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(
        this.createLambda('Storage', 'storage/handler.handler', commonEnv, vpc, apiSecurityGroup, lambdaRole)
      ),
      defaultMethodOptions: {
        authorizer: cognitoAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // Migration Approval API (admin only)
    const migrationApproval = v2.addResource('migration-approval');
    migrationApproval.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(
        this.createLambda('MigrationApproval', 'migration-approval/handler.handler', commonEnv, vpc, apiSecurityGroup, lambdaRole)
      ),
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // Inference Components API (admin only)
    const inferenceComponents = admin.addResource('inference-components');
    const inferenceComponentsLambda = this.createLambda(
      'InferenceComponents',
      'admin/inference-components.handler',
      { ...commonEnv, SAGEMAKER_EXECUTION_ROLE_ARN: props.sagemakerRoleArn || '' },
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    
    // Grant SageMaker permissions
    lambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'sagemaker:CreateEndpoint',
        'sagemaker:CreateEndpointConfig',
        'sagemaker:CreateInferenceComponent',
        'sagemaker:CreateModel',
        'sagemaker:DeleteEndpoint',
        'sagemaker:DeleteEndpointConfig',
        'sagemaker:DeleteInferenceComponent',
        'sagemaker:DeleteModel',
        'sagemaker:DescribeEndpoint',
        'sagemaker:DescribeInferenceComponent',
        'sagemaker:ListInferenceComponents',
        'sagemaker:UpdateEndpoint',
        'sagemaker:UpdateEndpointWeightsAndCapacities',
        'sagemaker:UpdateInferenceComponent',
        'sagemaker:InvokeEndpoint',
      ],
      resources: ['*'],
    }));
    
    inferenceComponents.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(inferenceComponentsLambda),
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // Domain Taxonomy API
    const domainTaxonomy = v2.addResource('domain-taxonomy');
    const domainTaxonomyLambda = this.createLambda('DomainTaxonomy', 'domain-taxonomy/handler.handler', commonEnv, vpc, apiSecurityGroup, lambdaRole);
    const domainTaxonomyIntegration = new apigateway.LambdaIntegration(domainTaxonomyLambda);
    
    // Public taxonomy endpoints (authenticated users)
    domainTaxonomy.addMethod('GET', domainTaxonomyIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    // Fields endpoints
    domainTaxonomy.addResource('fields').addProxy({
      defaultIntegration: domainTaxonomyIntegration,
      defaultMethodOptions: {
        authorizer: cognitoAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });
    
    // Full taxonomy
    domainTaxonomy.addResource('full').addMethod('GET', domainTaxonomyIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    // Detection endpoints
    domainTaxonomy.addResource('detect').addMethod('POST', domainTaxonomyIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    domainTaxonomy.addResource('match-models').addMethod('POST', domainTaxonomyIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    domainTaxonomy.addResource('recommend-mode').addMethod('POST', domainTaxonomyIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    // Search endpoint
    domainTaxonomy.addResource('search').addMethod('GET', domainTaxonomyIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    // Domain detail endpoints
    const taxonomyDomains = domainTaxonomy.addResource('domains');
    taxonomyDomains.addResource('{domainId}').addProxy({
      defaultIntegration: domainTaxonomyIntegration,
      defaultMethodOptions: {
        authorizer: cognitoAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });
    
    // Proficiencies endpoint
    domainTaxonomy.addResource('proficiencies').addResource('{domainId}').addMethod('GET', domainTaxonomyIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    // User selection endpoints (Think Tank integration)
    const userSelection = domainTaxonomy.addResource('user-selection');
    userSelection.addMethod('GET', domainTaxonomyIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    userSelection.addMethod('POST', domainTaxonomyIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    userSelection.addMethod('DELETE', domainTaxonomyIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    // Feedback endpoints
    const taxonomyFeedback = domainTaxonomy.addResource('feedback');
    taxonomyFeedback.addMethod('POST', domainTaxonomyIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    taxonomyFeedback.addResource('{domainId}').addResource('summary').addMethod('GET', domainTaxonomyIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    // Admin taxonomy endpoints
    const taxonomyAdmin = domainTaxonomy.addResource('admin');
    taxonomyAdmin.addProxy({
      defaultIntegration: domainTaxonomyIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Metrics & Persistent Learning API (v4.18.56) - Using proxy for efficiency
    // =========================================================================
    const metricsLambda = this.createLambda(
      'Metrics',
      'admin/metrics.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const metricsIntegration = new apigateway.LambdaIntegration(metricsLambda);

    // Admin metrics - use proxy to reduce resource count
    const metrics = admin.addResource('metrics');
    metrics.addProxy({
      defaultIntegration: metricsIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Genesis Cato Safety Architecture API (v4.18.56) - Using proxy for efficiency
    // =========================================================================
    const catoLambda = this.createLambda(
      'Cato',
      'admin/cato.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const catoIntegration = new apigateway.LambdaIntegration(catoLambda);

    // Admin Cato - use proxy to reduce resource count
    const cato = admin.addResource('cato');
    cato.addProxy({
      defaultIntegration: catoIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Semantic Blackboard & Multi-Agent Orchestration API (v5.52.4)
    // =========================================================================
    const blackboardLambda = this.createLambda(
      'Blackboard',
      'admin/blackboard.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const blackboardIntegration = new apigateway.LambdaIntegration(blackboardLambda);

    // Admin Blackboard - multi-agent orchestration, semantic question matching, process hydration
    const blackboard = admin.addResource('blackboard');
    blackboard.addProxy({
      defaultIntegration: blackboardIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // API Keys Management (v5.52.5) - Interface-based key management
    // =========================================================================
    const apiKeysLambda = this.createLambda(
      'ApiKeys',
      'admin/api-keys.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const apiKeysIntegration = new apigateway.LambdaIntegration(apiKeysLambda);

    // Admin API Keys - manage keys with interface types (API, MCP, A2A)
    const apiKeys = admin.addResource('api-keys');
    apiKeys.addProxy({
      defaultIntegration: apiKeysIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Cortex Memory System Admin API (v5.52.5)
    // =========================================================================
    const cortexLambda = this.createLambda(
      'Cortex',
      'admin/cortex.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const cortexIntegration = new apigateway.LambdaIntegration(cortexLambda);

    const cortex = admin.addResource('cortex');
    cortex.addProxy({
      defaultIntegration: cortexIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Gateway Admin API (v5.52.5)
    // =========================================================================
    const gatewayLambda = this.createLambda(
      'Gateway',
      'admin/gateway.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const gatewayIntegration = new apigateway.LambdaIntegration(gatewayLambda);

    const gateway = admin.addResource('gateway');
    gateway.addProxy({
      defaultIntegration: gatewayIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Security Admin API (v5.52.5)
    // =========================================================================
    const securityLambda = this.createLambda(
      'Security',
      'admin/security.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const securityIntegration = new apigateway.LambdaIntegration(securityLambda);

    const security = admin.addResource('security');
    security.addProxy({
      defaultIntegration: securityIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Sovereign Mesh Admin API (v5.52.5)
    // =========================================================================
    const sovereignMeshLambda = this.createLambda(
      'SovereignMesh',
      'admin/sovereign-mesh.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const sovereignMeshIntegration = new apigateway.LambdaIntegration(sovereignMeshLambda);

    const sovereignMesh = admin.addResource('sovereign-mesh');
    sovereignMesh.addProxy({
      defaultIntegration: sovereignMeshIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Cognition Admin API (v5.52.5)
    // =========================================================================
    const cognitionLambda = this.createLambda(
      'Cognition',
      'admin/cognition.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const cognitionIntegration = new apigateway.LambdaIntegration(cognitionLambda);

    const cognition = admin.addResource('cognition');
    cognition.addProxy({
      defaultIntegration: cognitionIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Learning Admin API (v5.52.5)
    // =========================================================================
    const learningLambda = this.createLambda(
      'Learning',
      'admin/agi-learning.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const learningIntegration = new apigateway.LambdaIntegration(learningLambda);

    const learning = admin.addResource('learning');
    learning.addProxy({
      defaultIntegration: learningIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Ethics Admin API (v5.52.5)
    // =========================================================================
    const ethicsLambda = this.createLambda(
      'Ethics',
      'admin/ethics.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const ethicsIntegration = new apigateway.LambdaIntegration(ethicsLambda);

    const ethics = admin.addResource('ethics');
    ethics.addProxy({
      defaultIntegration: ethicsIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Council Admin API (v5.52.5)
    // =========================================================================
    const councilLambda = this.createLambda(
      'Council',
      'admin/council.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const councilIntegration = new apigateway.LambdaIntegration(councilLambda);

    const council = admin.addResource('council');
    council.addProxy({
      defaultIntegration: councilIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Reports Admin API (v5.52.5)
    // =========================================================================
    const reportsLambda = this.createLambda(
      'Reports',
      'admin/reports.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const reportsIntegration = new apigateway.LambdaIntegration(reportsLambda);

    const reports = admin.addResource('reports');
    reports.addProxy({
      defaultIntegration: reportsIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // HITL Orchestration Admin API (v5.52.5)
    // =========================================================================
    const hitlLambda = this.createLambda(
      'HitlOrchestration',
      'admin/hitl-orchestration.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const hitlIntegration = new apigateway.LambdaIntegration(hitlLambda);

    const hitl = admin.addResource('hitl-orchestration');
    hitl.addProxy({
      defaultIntegration: hitlIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Brain Admin API (v5.52.6)
    // =========================================================================
    const brainLambda = this.createLambda(
      'Brain',
      'admin/brain.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const brainIntegration = new apigateway.LambdaIntegration(brainLambda);

    const brain = admin.addResource('brain');
    brain.addProxy({
      defaultIntegration: brainIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Code Quality Admin API (v5.52.6)
    // =========================================================================
    const codeQualityLambda = this.createLambda(
      'CodeQuality',
      'admin/code-quality.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const codeQualityIntegration = new apigateway.LambdaIntegration(codeQualityLambda);

    const codeQuality = admin.addResource('code-quality');
    codeQuality.addProxy({
      defaultIntegration: codeQualityIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Invitations Admin API (v5.52.6)
    // =========================================================================
    const invitationsLambda = this.createLambda(
      'Invitations',
      'admin/invitations.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const invitationsIntegration = new apigateway.LambdaIntegration(invitationsLambda);

    const invitations = admin.addResource('invitations');
    invitations.addProxy({
      defaultIntegration: invitationsIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Regulatory Standards Admin API (v5.52.6)
    // =========================================================================
    const regulatoryLambda = this.createLambda(
      'RegulatoryStandards',
      'admin/regulatory-standards.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const regulatoryIntegration = new apigateway.LambdaIntegration(regulatoryLambda);

    const regulatory = admin.addResource('regulatory-standards');
    regulatory.addProxy({
      defaultIntegration: regulatoryIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Self Audit Admin API (v5.52.6)
    // =========================================================================
    const selfAuditLambda = this.createLambda(
      'SelfAudit',
      'admin/self-audit.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const selfAuditIntegration = new apigateway.LambdaIntegration(selfAuditLambda);

    const selfAudit = admin.addResource('self-audit');
    selfAudit.addProxy({
      defaultIntegration: selfAuditIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Library Registry Admin API (v5.52.6)
    // =========================================================================
    const libraryLambda = this.createLambda(
      'LibraryRegistry',
      'admin/library-registry.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const libraryIntegration = new apigateway.LambdaIntegration(libraryLambda);

    const library = admin.addResource('library-registry');
    library.addProxy({
      defaultIntegration: libraryIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // RAWS (Model Selection) Admin API (v5.52.6)
    // =========================================================================
    const rawsLambda = this.createLambda(
      'Raws',
      'admin/raws.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const rawsIntegration = new apigateway.LambdaIntegration(rawsLambda);

    const raws = admin.addResource('raws');
    raws.addProxy({
      defaultIntegration: rawsIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // AWS Costs Admin API (v5.52.6)
    // =========================================================================
    const awsCostsLambda = this.createLambda(
      'AwsCosts',
      'admin/aws-costs.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const awsCostsIntegration = new apigateway.LambdaIntegration(awsCostsLambda);

    const awsCosts = admin.addResource('aws-costs');
    awsCosts.addProxy({
      defaultIntegration: awsCostsIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Tenants Admin API (v5.52.6)
    // =========================================================================
    const tenantsLambda = this.createLambda(
      'Tenants',
      'admin/tenants.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const tenantsIntegration = new apigateway.LambdaIntegration(tenantsLambda);

    const tenants = admin.addResource('tenants');
    tenants.addProxy({
      defaultIntegration: tenantsIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Empiricism Loop Admin API (v5.52.6)
    // =========================================================================
    const empiricismLambda = this.createLambda(
      'EmpiricismLoop',
      'admin/empiricism-loop.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const empiricismIntegration = new apigateway.LambdaIntegration(empiricismLambda);

    const empiricism = admin.addResource('empiricism');
    empiricism.addProxy({
      defaultIntegration: empiricismIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // ECD (Embodied Cognition) Admin API (v5.52.6)
    // =========================================================================
    const ecdLambda = this.createLambda(
      'Ecd',
      'admin/ecd.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const ecdIntegration = new apigateway.LambdaIntegration(ecdLambda);

    const ecd = admin.addResource('ecd');
    ecd.addProxy({
      defaultIntegration: ecdIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Ego Admin API (v5.52.6)
    // =========================================================================
    const egoLambda = this.createLambda(
      'Ego',
      'admin/ego.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const egoIntegration = new apigateway.LambdaIntegration(egoLambda);

    const ego = admin.addResource('ego');
    ego.addProxy({
      defaultIntegration: egoIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // S3 Storage Admin API (v5.52.6)
    // =========================================================================
    const s3StorageLambda = this.createLambda(
      'S3Storage',
      'admin/s3-storage.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const s3StorageIntegration = new apigateway.LambdaIntegration(s3StorageLambda);

    const s3Storage = admin.addResource('s3-storage');
    s3Storage.addProxy({
      defaultIntegration: s3StorageIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // AI Reports Admin API (v5.52.6)
    // =========================================================================
    const aiReportsLambda = this.createLambda(
      'AiReports',
      'admin/ai-reports.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const aiReportsIntegration = new apigateway.LambdaIntegration(aiReportsLambda);

    const aiReports = admin.addResource('ai-reports');
    aiReports.addProxy({
      defaultIntegration: aiReportsIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // AWS Monitoring Admin API (v5.52.6)
    // =========================================================================
    const awsMonitoringLambda = this.createLambda(
      'AwsMonitoring',
      'admin/aws-monitoring.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const awsMonitoringIntegration = new apigateway.LambdaIntegration(awsMonitoringLambda);

    const awsMonitoring = admin.addResource('aws-monitoring');
    awsMonitoring.addProxy({
      defaultIntegration: awsMonitoringIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Checklist Registry Admin API (v5.52.6)
    // =========================================================================
    const checklistLambda = this.createLambda(
      'ChecklistRegistry',
      'admin/checklist-registry.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const checklistIntegration = new apigateway.LambdaIntegration(checklistLambda);

    const checklist = admin.addResource('checklist-registry');
    checklist.addProxy({
      defaultIntegration: checklistIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Dynamic Reports Admin API (v5.52.6)
    // =========================================================================
    const dynamicReportsLambda = this.createLambda(
      'DynamicReports',
      'admin/dynamic-reports.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const dynamicReportsIntegration = new apigateway.LambdaIntegration(dynamicReportsLambda);

    const dynamicReports = admin.addResource('dynamic-reports');
    dynamicReports.addProxy({
      defaultIntegration: dynamicReportsIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Approvals Admin API (v5.52.6)
    // =========================================================================
    const approvalsLambda = this.createLambda(
      'Approvals',
      'admin/approvals.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const approvalsIntegration = new apigateway.LambdaIntegration(approvalsLambda);

    const approvals = admin.addResource('approvals');
    approvals.addProxy({
      defaultIntegration: approvalsIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Cato Genesis Admin API (v5.52.6)
    // =========================================================================
    const catoGenesisLambda = this.createLambda(
      'CatoGenesis',
      'admin/cato-genesis.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const catoGenesisIntegration = new apigateway.LambdaIntegration(catoGenesisLambda);

    const catoGenesis = admin.addResource('cato-genesis');
    catoGenesis.addProxy({
      defaultIntegration: catoGenesisIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Cato Global Admin API (v5.52.6)
    // =========================================================================
    const catoGlobalLambda = this.createLambda(
      'CatoGlobal',
      'admin/cato-global.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const catoGlobalIntegration = new apigateway.LambdaIntegration(catoGlobalLambda);

    const catoGlobal = admin.addResource('cato-global');
    catoGlobal.addProxy({
      defaultIntegration: catoGlobalIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Cato Governance Admin API (v5.52.6)
    // =========================================================================
    const catoGovernanceLambda = this.createLambda(
      'CatoGovernance',
      'admin/cato-governance.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const catoGovernanceIntegration = new apigateway.LambdaIntegration(catoGovernanceLambda);

    const catoGovernance = admin.addResource('cato-governance');
    catoGovernance.addProxy({
      defaultIntegration: catoGovernanceIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Cato Pipeline Admin API (v5.52.6)
    // =========================================================================
    const catoPipelineLambda = this.createLambda(
      'CatoPipeline',
      'admin/cato-pipeline.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const catoPipelineIntegration = new apigateway.LambdaIntegration(catoPipelineLambda);

    const catoPipeline = admin.addResource('cato-pipeline');
    catoPipeline.addProxy({
      defaultIntegration: catoPipelineIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Collaboration Settings Admin API (v5.52.6)
    // =========================================================================
    const collaborationLambda = this.createLambda(
      'CollaborationSettings',
      'admin/collaboration-settings.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const collaborationIntegration = new apigateway.LambdaIntegration(collaborationLambda);

    const collaboration = admin.addResource('collaboration-settings');
    collaboration.addProxy({
      defaultIntegration: collaborationIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Cortex V2 Admin API (v5.52.6)
    // =========================================================================
    const cortexV2Lambda = this.createLambda(
      'CortexV2',
      'admin/cortex-v2.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const cortexV2Integration = new apigateway.LambdaIntegration(cortexV2Lambda);

    const cortexV2 = admin.addResource('cortex-v2');
    cortexV2.addProxy({
      defaultIntegration: cortexV2Integration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Ethics Free Reasoning Admin API (v5.52.6)
    // =========================================================================
    const ethicsFreeReasoningLambda = this.createLambda(
      'EthicsFreeReasoning',
      'admin/ethics-free-reasoning.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const ethicsFreeReasoningIntegration = new apigateway.LambdaIntegration(ethicsFreeReasoningLambda);

    const ethicsFreeReasoning = admin.addResource('ethics-free-reasoning');
    ethicsFreeReasoning.addProxy({
      defaultIntegration: ethicsFreeReasoningIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Formal Reasoning Admin API (v5.52.6)
    // =========================================================================
    const formalReasoningLambda = this.createLambda(
      'FormalReasoning',
      'admin/formal-reasoning.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const formalReasoningIntegration = new apigateway.LambdaIntegration(formalReasoningLambda);

    const formalReasoning = admin.addResource('formal-reasoning');
    formalReasoning.addProxy({
      defaultIntegration: formalReasoningIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Infrastructure Tier Admin API (v5.52.6)
    // =========================================================================
    const infrastructureTierLambda = this.createLambda(
      'InfrastructureTier',
      'admin/infrastructure-tier.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const infrastructureTierIntegration = new apigateway.LambdaIntegration(infrastructureTierLambda);

    const infrastructureTier = admin.addResource('infrastructure-tier');
    infrastructureTier.addProxy({
      defaultIntegration: infrastructureTierIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Internet Learning Admin API (v5.52.6)
    // =========================================================================
    const internetLearningLambda = this.createLambda(
      'InternetLearning',
      'admin/internet-learning.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const internetLearningIntegration = new apigateway.LambdaIntegration(internetLearningLambda);

    const internetLearning = admin.addResource('internet-learning');
    internetLearning.addProxy({
      defaultIntegration: internetLearningIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Logs Admin API (v5.52.6)
    // =========================================================================
    const logsLambda = this.createLambda(
      'Logs',
      'admin/logs.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const logsIntegration = new apigateway.LambdaIntegration(logsLambda);

    const logsAdmin = admin.addResource('logs');
    logsAdmin.addProxy({
      defaultIntegration: logsIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // LoRA Adapters Admin API (v5.52.6)
    // =========================================================================
    const loraAdaptersLambda = this.createLambda(
      'LoraAdapters',
      'admin/lora-adapters.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const loraAdaptersIntegration = new apigateway.LambdaIntegration(loraAdaptersLambda);

    const loraAdapters = admin.addResource('lora-adapters');
    loraAdapters.addProxy({
      defaultIntegration: loraAdaptersIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Models Admin API (v5.52.6)
    // =========================================================================
    const modelsLambda = this.createLambda(
      'Models',
      'admin/models.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const modelsIntegration = new apigateway.LambdaIntegration(modelsLambda);

    const modelsAdmin = admin.addResource('models');
    modelsAdmin.addProxy({
      defaultIntegration: modelsIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Orchestration Methods Admin API (v5.52.6)
    // =========================================================================
    const orchestrationMethodsLambda = this.createLambda(
      'OrchestrationMethods',
      'admin/orchestration-methods.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const orchestrationMethodsIntegration = new apigateway.LambdaIntegration(orchestrationMethodsLambda);

    const orchestrationMethods = admin.addResource('orchestration-methods');
    orchestrationMethods.addProxy({
      defaultIntegration: orchestrationMethodsIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Orchestration User Templates Admin API (v5.52.6)
    // =========================================================================
    const orchestrationTemplatesLambda = this.createLambda(
      'OrchestrationUserTemplates',
      'admin/orchestration-user-templates.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const orchestrationTemplatesIntegration = new apigateway.LambdaIntegration(orchestrationTemplatesLambda);

    const orchestrationTemplates = admin.addResource('orchestration-user-templates');
    orchestrationTemplates.addProxy({
      defaultIntegration: orchestrationTemplatesIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Pricing Admin API (v5.52.6)
    // =========================================================================
    const pricingLambda = this.createLambda(
      'Pricing',
      'admin/pricing.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const pricingIntegration = new apigateway.LambdaIntegration(pricingLambda);

    const pricing = admin.addResource('pricing');
    pricing.addProxy({
      defaultIntegration: pricingIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Security Schedules Admin API (v5.52.6)
    // =========================================================================
    const securitySchedulesLambda = this.createLambda(
      'SecuritySchedules',
      'admin/security-schedules.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const securitySchedulesIntegration = new apigateway.LambdaIntegration(securitySchedulesLambda);

    const securitySchedules = admin.addResource('security-schedules');
    securitySchedules.addProxy({
      defaultIntegration: securitySchedulesIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Sovereign Mesh Performance Admin API (v5.52.6)
    // =========================================================================
    const sovereignMeshPerfLambda = this.createLambda(
      'SovereignMeshPerformance',
      'admin/sovereign-mesh-performance.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const sovereignMeshPerfIntegration = new apigateway.LambdaIntegration(sovereignMeshPerfLambda);

    const sovereignMeshPerf = admin.addResource('sovereign-mesh-performance');
    sovereignMeshPerf.addProxy({
      defaultIntegration: sovereignMeshPerfIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Sovereign Mesh Scaling Admin API (v5.52.6)
    // =========================================================================
    const sovereignMeshScalingLambda = this.createLambda(
      'SovereignMeshScaling',
      'admin/sovereign-mesh-scaling.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const sovereignMeshScalingIntegration = new apigateway.LambdaIntegration(sovereignMeshScalingLambda);

    const sovereignMeshScaling = admin.addResource('sovereign-mesh-scaling');
    sovereignMeshScaling.addProxy({
      defaultIntegration: sovereignMeshScalingIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Specialty Rankings Admin API (v5.52.6)
    // =========================================================================
    const specialtyRankingsLambda = this.createLambda(
      'SpecialtyRankings',
      'admin/specialty-rankings.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const specialtyRankingsIntegration = new apigateway.LambdaIntegration(specialtyRankingsLambda);

    const specialtyRankings = admin.addResource('specialty-rankings');
    specialtyRankings.addProxy({
      defaultIntegration: specialtyRankingsIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Sync Providers Admin API (v5.52.6)
    // =========================================================================
    const syncProvidersLambda = this.createLambda(
      'SyncProviders',
      'admin/sync-providers.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const syncProvidersIntegration = new apigateway.LambdaIntegration(syncProvidersLambda);

    const syncProviders = admin.addResource('sync-providers');
    syncProviders.addProxy({
      defaultIntegration: syncProvidersIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // System Admin API (v5.52.6)
    // =========================================================================
    const systemLambda = this.createLambda(
      'System',
      'admin/system.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const systemIntegration = new apigateway.LambdaIntegration(systemLambda);

    const system = admin.addResource('system');
    system.addProxy({
      defaultIntegration: systemIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // System Config Admin API (v5.52.6)
    // =========================================================================
    const systemConfigLambda = this.createLambda(
      'SystemConfig',
      'admin/system-config.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const systemConfigIntegration = new apigateway.LambdaIntegration(systemConfigLambda);

    const systemConfig = admin.addResource('system-config');
    systemConfig.addProxy({
      defaultIntegration: systemConfigIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Time Machine Admin API (v5.52.6)
    // =========================================================================
    const timeMachineLambda = this.createLambda(
      'TimeMachine',
      'admin/time-machine.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const timeMachineIntegration = new apigateway.LambdaIntegration(timeMachineLambda);

    const timeMachine = admin.addResource('time-machine');
    timeMachine.addProxy({
      defaultIntegration: timeMachineIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Translation Admin API (v5.52.6)
    // =========================================================================
    const translationLambda = this.createLambda(
      'Translation',
      'admin/translation.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const translationIntegration = new apigateway.LambdaIntegration(translationLambda);

    const translation = admin.addResource('translation');
    translation.addProxy({
      defaultIntegration: translationIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // User Registry Admin API (v5.52.6)
    // =========================================================================
    const userRegistryLambda = this.createLambda(
      'UserRegistry',
      'admin/user-registry.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const userRegistryIntegration = new apigateway.LambdaIntegration(userRegistryLambda);

    const userRegistry = admin.addResource('user-registry');
    userRegistry.addProxy({
      defaultIntegration: userRegistryIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // User Violations Admin API (v5.52.6)
    // =========================================================================
    const userViolationsLambda = this.createLambda(
      'UserViolations',
      'admin/user-violations.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const userViolationsIntegration = new apigateway.LambdaIntegration(userViolationsLambda);

    const userViolations = admin.addResource('user-violations');
    userViolations.addProxy({
      defaultIntegration: userViolationsIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // White Label Admin API (v5.52.6)
    // =========================================================================
    const whiteLabelLambda = this.createLambda(
      'WhiteLabel',
      'admin/white-label.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const whiteLabelIntegration = new apigateway.LambdaIntegration(whiteLabelLambda);

    const whiteLabel = admin.addResource('white-label');
    whiteLabel.addProxy({
      defaultIntegration: whiteLabelIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Think Tank API (v4.18.0) - Consolidated router for all Think Tank endpoints
    // =========================================================================
    const thinktankLambda = this.createLambda(
      'Thinktank',
      'thinktank/handler.handler',
      commonEnv,
      vpc,
      apiSecurityGroup,
      lambdaRole
    );
    const thinktankIntegration = new apigateway.LambdaIntegration(thinktankLambda);

    // Think Tank routes - consolidated proxy handles all /thinktank/* paths
    const thinktank = v2.addResource('thinktank');
    thinktank.addProxy({
      defaultIntegration: thinktankIntegration,
      defaultMethodOptions: {
        authorizer: cognitoAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // Admin artifact-engine routes - use Think Tank handler (routes to artifact-engine internally)
    const artifactEngineAdmin = admin.addResource('artifact-engine');
    artifactEngineAdmin.addProxy({
      defaultIntegration: thinktankIntegration,
      defaultMethodOptions: {
        authorizer: adminAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // =========================================================================
    // Think Tank Admin API - Deployed in separate ThinkTankAdminApiStack
    // to avoid CloudFormation 500 resource limit
    // =========================================================================

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
      exportName: `${appId}-${environment}-api-url`,
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'API Gateway ID',
      exportName: `${appId}-${environment}-api-id`,
    });
  }

  private createLambda(
    name: string,
    handler: string,
    environment: Record<string, string>,
    vpc: ec2.Vpc,
    securityGroup: ec2.SecurityGroup,
    role: iam.Role
  ): lambda.Function {
    return new lambda.Function(this, `${name}Function`, {
      functionName: `${environment.APP_ID}-${environment.ENVIRONMENT}-${name.toLowerCase()}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler,
      code: lambda.Code.fromAsset('lambda/dist'),
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [securityGroup],
      role,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });
  }
}
