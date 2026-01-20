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
