import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
// s3deploy reserved for static asset deployment
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
// dynamodb reserved for admin state tables
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import type { TierConfig, Environment } from '@radiant/shared';
import { RADIANT_VERSION } from '@radiant/shared';

export interface AdminStackProps extends cdk.StackProps {
  appId: string;
  environment: Environment;
  tier: number;
  tierConfig: TierConfig;
  vpc: ec2.Vpc;
  adminUserPool: cognito.UserPool;
  adminUserPoolClient: cognito.UserPoolClient;
  auroraCluster: rds.DatabaseCluster;
  apiSecurityGroup: ec2.SecurityGroup;
}

export class AdminStack extends cdk.Stack {
  public readonly adminBucket: s3.Bucket;
  public readonly adminDistribution: cloudfront.Distribution;
  public readonly adminApi: apigateway.RestApi;
  public readonly adminFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: AdminStackProps) {
    super(scope, id, props);

    const {
      appId,
      environment,
      tier,
      vpc,
      adminUserPool,
      adminUserPoolClient,
      auroraCluster,
      apiSecurityGroup,
    } = props;
    const isProd = environment === 'prod';

    // S3 bucket for admin dashboard static files
    this.adminBucket = new s3.Bucket(this, 'AdminBucket', {
      bucketName: `${appId}-${environment}-admin-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: tier >= 2,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    // Origin Access Identity for CloudFront
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'AdminOAI', {
      comment: `OAI for ${appId}-${environment} admin dashboard`,
    });

    this.adminBucket.grantRead(originAccessIdentity);

    // S3 bucket for AI reports exports
    const reportsBucket = new s3.Bucket(this, 'ReportsBucket', {
      bucketName: `${appId}-${environment}-reports-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: tier >= 2,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(90), // Auto-delete exports after 90 days
          prefix: 'reports/',
        },
      ],
    });

    // CloudFront distribution for admin dashboard
    this.adminDistribution = new cloudfront.Distribution(this, 'AdminDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(this.adminBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      priceClass: tier >= 4
        ? cloudfront.PriceClass.PRICE_CLASS_ALL
        : cloudfront.PriceClass.PRICE_CLASS_100,
      enabled: true,
      comment: `${appId}-${environment} admin dashboard`,
    });

    // Lambda execution role for admin functions
    const adminLambdaRole = new iam.Role(this, 'AdminLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });

    // Grant RDS Data API access
    adminLambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
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

    // Grant Secrets Manager access
    if (auroraCluster.secret) {
      auroraCluster.secret.grantRead(adminLambdaRole);
    }

    // Grant Cognito admin operations
    adminLambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminDeleteUser',
        'cognito-idp:AdminGetUser',
        'cognito-idp:AdminListGroupsForUser',
        'cognito-idp:AdminAddUserToGroup',
        'cognito-idp:AdminRemoveUserFromGroup',
        'cognito-idp:AdminSetUserPassword',
        'cognito-idp:AdminEnableUser',
        'cognito-idp:AdminDisableUser',
        'cognito-idp:ListUsers',
        'cognito-idp:ListGroups',
      ],
      resources: [adminUserPool.userPoolArn],
    }));

    // Grant AWS Monitoring permissions (CloudWatch, Cost Explorer, X-Ray, SNS, SES)
    adminLambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudwatch:GetMetricData',
        'cloudwatch:GetMetricStatistics',
        'cloudwatch:ListMetrics',
        'cloudwatch:DescribeAlarms',
      ],
      resources: ['*'],
    }));

    adminLambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ce:GetCostAndUsage',
        'ce:GetCostForecast',
        'ce:GetAnomalies',
        'ce:GetDimensionValues',
      ],
      resources: ['*'],
    }));

    adminLambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'xray:GetTraceSummaries',
        'xray:GetServiceGraph',
        'xray:BatchGetTraces',
      ],
      resources: ['*'],
    }));

    adminLambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'sns:Publish',
      ],
      resources: ['*'],
    }));

    adminLambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ses:SendEmail',
        'ses:SendRawEmail',
      ],
      resources: ['*'],
    }));

    // Grant S3 access for AI reports exports
    reportsBucket.grantReadWrite(adminLambdaRole);

    // Admin Lambda function
    this.adminFunction = new lambda.Function(this, 'AdminFunction', {
      functionName: `${appId}-${environment}-admin`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'admin/handler.handler',
      code: lambda.Code.fromAsset('lambda/dist'),
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        APP_ID: appId,
        ENVIRONMENT: environment,
        TIER: tier.toString(),
        AURORA_SECRET_ARN: auroraCluster.secret?.secretArn || '',
        AURORA_CLUSTER_ARN: auroraCluster.clusterArn,
        ADMIN_USER_POOL_ID: adminUserPool.userPoolId,
        ADMIN_CLIENT_ID: adminUserPoolClient.userPoolClientId,
        LOG_LEVEL: isProd ? 'info' : 'debug',
        RADIANT_VERSION,
        REPORTS_BUCKET: reportsBucket.bucketName,
      },
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [apiSecurityGroup],
      role: adminLambdaRole,
      tracing: tier >= 2 ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Admin API Gateway
    this.adminApi = new apigateway.RestApi(this, 'AdminApi', {
      restApiName: `${appId}-${environment}-admin-api`,
      description: `RADIANT Admin API for ${appId} ${environment}`,
      deployOptions: {
        stageName: 'v1',
        throttlingRateLimit: 1000,
        throttlingBurstLimit: 500,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        metricsEnabled: true,
        tracingEnabled: tier >= 2,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
      },
    });

    // Cognito Authorizer for admin API
    const adminAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'AdminAuthorizer', {
      cognitoUserPools: [adminUserPool],
      authorizerName: `${appId}-${environment}-admin-authorizer`,
      identitySource: 'method.request.header.Authorization',
    });

    // Lambda integration
    const adminIntegration = new apigateway.LambdaIntegration(this.adminFunction, {
      proxy: true,
    });

    // API Resources
    const admin = this.adminApi.root.addResource('admin');

    // Health check (no auth)
    admin.addResource('health').addMethod('GET', adminIntegration);

    // Dashboard stats
    const dashboard = admin.addResource('dashboard');
    dashboard.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Tenants management
    const tenants = admin.addResource('tenants');
    tenants.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    tenants.addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const tenantById = tenants.addResource('{tenantId}');
    tenantById.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    tenantById.addMethod('PUT', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    tenantById.addMethod('DELETE', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Users management
    const users = admin.addResource('users');
    users.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const userById = users.addResource('{userId}');
    userById.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    userById.addMethod('PUT', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Administrators management
    const administrators = admin.addResource('administrators');
    administrators.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    administrators.addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Invitations
    const invitations = admin.addResource('invitations');
    invitations.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    invitations.addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Approval requests
    const approvals = admin.addResource('approvals');
    approvals.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    approvals.addResource('{requestId}').addResource('approve').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Billing & usage
    const billing = admin.addResource('billing');
    billing.addResource('usage').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    billing.addResource('invoices').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Audit logs
    admin.addResource('audit-logs').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Models management
    const models = admin.addResource('models');
    models.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    models.addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const modelById = models.addResource('{modelId}');
    modelById.addMethod('PUT', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    modelById.addMethod('DELETE', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Providers management
    const providers = admin.addResource('providers');
    providers.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    providers.addResource('{providerId}').addMethod('PUT', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // =========================================================================
    // Brain v6.0.4 - AGI Brain Admin Routes
    // =========================================================================
    const brain = admin.addResource('brain');
    
    // Dashboard
    brain.addResource('dashboard').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Configuration
    const brainConfig = brain.addResource('config');
    brainConfig.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    brainConfig.addMethod('PUT', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const brainConfigByKey = brainConfig.addResource('{key}');
    brainConfigByKey.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    brainConfigByKey.addMethod('PUT', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    brainConfigByKey.addResource('reset').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    brainConfig.addResource('history').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Ghost Vectors
    const ghost = brain.addResource('ghost');
    ghost.addResource('stats').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    ghost.addResource('{userId}').addResource('health').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Dreams
    const dreams = brain.addResource('dreams');
    dreams.addResource('queue').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    dreams.addResource('schedules').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    dreams.addResource('trigger').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Oversight
    const oversight = brain.addResource('oversight');
    oversight.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    oversight.addResource('stats').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const oversightById = oversight.addResource('{insightId}');
    oversightById.addResource('approve').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    oversightById.addResource('reject').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // SOFAI Stats
    brain.addResource('sofai').addResource('stats').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // ECD (Entity-Context Divergence) - Truth Engine™
    const ecd = brain.addResource('ecd');
    ecd.addResource('stats').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    ecd.addResource('trend').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    ecd.addResource('entities').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    ecd.addResource('divergences').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Reconciliation
    brain.addResource('reconciliation').addResource('trigger').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // =========================================================================
    // AWS Free Tier Monitoring Routes
    // =========================================================================
    const awsMonitoring = admin.addResource('aws-monitoring');
    
    // Dashboard
    awsMonitoring.addResource('dashboard').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Configuration
    const monitoringConfig = awsMonitoring.addResource('config');
    monitoringConfig.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    monitoringConfig.addMethod('PUT', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Lambda metrics
    awsMonitoring.addResource('lambda').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Aurora metrics
    awsMonitoring.addResource('aurora').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // X-Ray traces
    const xray = awsMonitoring.addResource('xray');
    xray.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    xray.addResource('service-graph').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Cost Explorer
    const costs = awsMonitoring.addResource('costs');
    costs.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    costs.addResource('anomalies').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Free tier usage
    awsMonitoring.addResource('free-tier').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Health status
    awsMonitoring.addResource('health').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Charts
    const charts = awsMonitoring.addResource('charts');
    charts.addResource('lambda-invocations').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    charts.addResource('cost-trend').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    charts.addResource('latency-distribution').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Notifications management
    const notifications = awsMonitoring.addResource('notifications');
    const notifTargets = notifications.addResource('targets');
    notifTargets.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    notifTargets.addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const notifTargetById = notifTargets.addResource('{targetId}');
    notifTargetById.addMethod('PUT', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    notifTargetById.addMethod('DELETE', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Spend thresholds
    const spendThresholds = notifications.addResource('spend-thresholds');
    spendThresholds.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    spendThresholds.addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const spendThresholdById = spendThresholds.addResource('{thresholdId}');
    spendThresholdById.addMethod('PUT', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    spendThresholdById.addMethod('DELETE', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Metric thresholds
    const metricThresholds = notifications.addResource('metric-thresholds');
    metricThresholds.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    metricThresholds.addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Spend summary
    notifications.addResource('spend-summary').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Notification log
    notifications.addResource('log').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Notification check trigger
    notifications.addResource('check').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Chargeable tier status
    awsMonitoring.addResource('chargeable-status').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Tier settings (free/paid toggle sliders)
    const tierSettings = awsMonitoring.addResource('tier-settings');
    tierSettings.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    tierSettings.addResource('toggle-paid').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    tierSettings.addResource('auto-scale').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    tierSettings.addResource('budget-cap').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // =========================================================================
    // AI Reports v5.42.0 - AI Report Writer Routes
    // =========================================================================
    const aiReports = admin.addResource('ai-reports');
    
    // List reports
    aiReports.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    // Generate report
    aiReports.addResource('generate').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    // Report by ID
    const reportById = aiReports.addResource('{reportId}');
    reportById.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    reportById.addMethod('PUT', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    reportById.addMethod('DELETE', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    // Export report
    reportById.addResource('export').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    // Templates
    const reportTemplates = aiReports.addResource('templates');
    reportTemplates.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    reportTemplates.addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    // Brand kits
    const brandKits = aiReports.addResource('brand-kits');
    brandKits.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    brandKits.addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const brandKitById = brandKits.addResource('{brandKitId}');
    brandKitById.addMethod('PUT', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    brandKitById.addMethod('DELETE', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    // Chat for report modifications
    aiReports.addResource('chat').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    // Insights dashboard
    aiReports.addResource('insights').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // =========================================================================
    // v5.1.1 - System Health, API Keys, SSO Connections Routes
    // =========================================================================
    
    // System Health endpoints
    const system = admin.addResource('system');
    const systemHealth = system.addResource('health');
    systemHealth.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    systemHealth.addResource('components').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const healthAlerts = systemHealth.addResource('alerts');
    healthAlerts.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    healthAlerts.addResource('{alertId}').addResource('acknowledge').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    // Gateway endpoints
    const gateway = system.addResource('gateway');
    gateway.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const gatewayConfig = gateway.addResource('config');
    gatewayConfig.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    gatewayConfig.addMethod('PUT', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    // Service API Keys endpoints
    const serviceApiKeys = admin.addResource('service-api-keys');
    serviceApiKeys.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    serviceApiKeys.addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    serviceApiKeys.addResource('scopes').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const apiKeyById = serviceApiKeys.addResource('{keyId}');
    apiKeyById.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    apiKeyById.addMethod('PUT', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    apiKeyById.addMethod('DELETE', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    apiKeyById.addResource('rotate').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    apiKeyById.addResource('audit').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    // SSO Connections endpoints
    const ssoConnections = admin.addResource('sso-connections');
    ssoConnections.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    ssoConnections.addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const ssoById = ssoConnections.addResource('{connectionId}');
    ssoById.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    ssoById.addMethod('PUT', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    ssoById.addMethod('DELETE', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    ssoById.addResource('test').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    ssoById.addResource('enable').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    ssoById.addResource('disable').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // =========================================================================
    // Model Registry v5.52.57 - Model Version Discovery & Lifecycle Routes
    // =========================================================================
    const modelRegistry = admin.addResource('model-registry');
    
    // Dashboard
    modelRegistry.addResource('dashboard').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Model Versions
    const versions = modelRegistry.addResource('versions');
    versions.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    versions.addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const versionById = versions.addResource('{versionId}');
    versionById.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    versionById.addMethod('PUT', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    versionById.addMethod('DELETE', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    versionById.addResource('thermal').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    versionById.addResource('storage').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Bulk thermal operations
    versions.addResource('bulk-thermal').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Family Watchlist
    const watchlist = modelRegistry.addResource('watchlist');
    watchlist.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    watchlist.addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const watchlistFamily = watchlist.addResource('{family}');
    watchlistFamily.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    watchlistFamily.addMethod('PUT', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    watchlistFamily.addMethod('DELETE', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Discovery Jobs
    const discovery = modelRegistry.addResource('discovery');
    discovery.addResource('run').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const discoveryJobs = discovery.addResource('jobs');
    discoveryJobs.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    discoveryJobs.addResource('{jobId}').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Deletion Queue
    const deletionQueue = modelRegistry.addResource('deletion-queue');
    deletionQueue.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    deletionQueue.addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    deletionQueue.addResource('process').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    deletionQueue.addResource('dashboard').addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const queueItem = deletionQueue.addResource('{itemId}');
    queueItem.addMethod('GET', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    queueItem.addResource('cancel').addMethod('POST', adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Outputs
    new cdk.CfnOutput(this, 'AdminDashboardUrl', {
      value: `https://${this.adminDistribution.distributionDomainName}`,
      description: 'Admin dashboard URL',
      exportName: `${appId}-${environment}-admin-url`,
    });

    new cdk.CfnOutput(this, 'AdminApiUrl', {
      value: this.adminApi.url,
      description: 'Admin API URL',
      exportName: `${appId}-${environment}-admin-api-url`,
    });

    new cdk.CfnOutput(this, 'AdminBucketName', {
      value: this.adminBucket.bucketName,
      description: 'Admin bucket name',
      exportName: `${appId}-${environment}-admin-bucket`,
    });
  }
}
