/**
 * State Registry Stack
 * 
 * CDK stack for Environment State Registry infrastructure including
 * S3 buckets, Lambda functions, and API Gateway endpoints.
 * 
 * @version 1.0.0
 * @since RADIANT 7.0.0
 */

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface StateRegistryStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'prod';
  radiantVersion: string;
  vpcId?: string;
  subnetIds?: string[];
  securityGroupIds?: string[];
  kmsKeyArn?: string;
  enableAutoCapture?: boolean;
  autoCaptureSchedule?: string; // cron expression
  retentionDays?: number;
  enableCrossAccountAccess?: boolean;
  crossAccountPrincipals?: string[];
}

export class StateRegistryStack extends cdk.Stack {
  public readonly stateRegistryBucket: s3.Bucket;
  public readonly stateRegistryApi: apigateway.RestApi;
  public readonly captureFunction: lambda.Function;
  public readonly syncFunction: lambda.Function;
  public readonly backupFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: StateRegistryStackProps) {
    super(scope, id, props);

    const {
      environment,
      radiantVersion,
      kmsKeyArn,
      enableAutoCapture = false,
      autoCaptureSchedule = 'cron(0 */6 * * ? *)', // Every 6 hours
      retentionDays = 90,
      enableCrossAccountAccess = false,
      crossAccountPrincipals = [],
    } = props;

    // ========================================================================
    // S3 Bucket for State Registry
    // ========================================================================

    this.stateRegistryBucket = new s3.Bucket(this, 'StateRegistryBucket', {
      bucketName: `radiant-${environment}-state-registry-${this.account}`,
      encryption: kmsKeyArn 
        ? s3.BucketEncryption.KMS 
        : s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'archive-old-manifests',
          prefix: 'manifests/',
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
          expiration: cdk.Duration.days(365),
        },
        {
          id: 'archive-backups',
          prefix: 'backups/',
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(7),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
          expiration: cdk.Duration.days(365 * 2), // 2 years
        },
        {
          id: 'cleanup-operations',
          prefix: 'operations/',
          expiration: cdk.Duration.days(retentionDays),
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'], // Should be restricted in production
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // ========================================================================
    // IAM Role for Lambda Functions
    // ========================================================================

    const lambdaRole = new iam.Role(this, 'StateRegistryLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for State Registry Lambda functions',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // S3 permissions
    this.stateRegistryBucket.grantReadWrite(lambdaRole);

    // CloudFormation permissions (read-only for capturing state)
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudformation:DescribeStacks',
        'cloudformation:DescribeStackResources',
        'cloudformation:ListStacks',
        'cloudformation:GetTemplate',
        'cloudformation:GetStackPolicy',
        'cloudformation:DescribeStackDriftDetectionStatus',
      ],
      resources: ['*'],
    }));

    // Lambda permissions (read-only)
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:ListFunctions',
        'lambda:GetFunction',
        'lambda:ListVersionsByFunction',
        'lambda:ListAliases',
        'lambda:GetFunctionConfiguration',
      ],
      resources: ['*'],
    }));

    // S3 bucket listing permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:ListAllMyBuckets',
        's3:GetBucketLocation',
        's3:GetBucketVersioning',
        's3:GetBucketTagging',
        's3:GetBucketPolicy',
        's3:GetBucketCORS',
        's3:GetEncryptionConfiguration',
        's3:GetBucketPublicAccessBlock',
        's3:ListBucket',
        's3:GetObject',
        's3:GetObjectVersion',
      ],
      resources: ['*'],
    }));

    // DynamoDB permissions (read-only)
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:ListTables',
        'dynamodb:DescribeTable',
        'dynamodb:ListGlobalTables',
      ],
      resources: ['*'],
    }));

    // RDS/Aurora permissions (read-only)
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'rds:DescribeDBClusters',
        'rds:DescribeDBInstances',
        'rds:DescribeDBSnapshots',
        'rds:DescribeDBClusterSnapshots',
      ],
      resources: ['*'],
    }));

    // Secrets Manager permissions (metadata only, not values)
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:ListSecrets',
        'secretsmanager:DescribeSecret',
      ],
      resources: ['*'],
    }));

    // API Gateway permissions (read-only)
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'apigateway:GET',
      ],
      resources: ['*'],
    }));

    // EC2/VPC permissions (for VPC info)
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ec2:DescribeVpcs',
        'ec2:DescribeSubnets',
        'ec2:DescribeSecurityGroups',
      ],
      resources: ['*'],
    }));

    // ========================================================================
    // Lambda Functions
    // ========================================================================

    const commonLambdaProps: Partial<lambda.FunctionProps> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      role: lambdaRole,
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        AWS_REGION: this.region,
        AWS_ACCOUNT_ID: this.account,
        RADIANT_ENVIRONMENT: environment,
        RADIANT_VERSION: radiantVersion,
        STATE_REGISTRY_BUCKET: this.stateRegistryBucket.bucketName,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    };

    // Capture Function - captures environment state
    this.captureFunction = new lambda.Function(this, 'CaptureFunction', {
      ...commonLambdaProps,
      functionName: `radiant-${environment}-state-capture`,
      description: 'Captures environment state manifests',
      handler: 'lambda/admin/state-registry.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../')),
      timeout: cdk.Duration.minutes(10), // Longer timeout for full capture
      memorySize: 2048,
    } as lambda.FunctionProps);

    // Sync Function - handles data sync between environments
    this.syncFunction = new lambda.Function(this, 'SyncFunction', {
      ...commonLambdaProps,
      functionName: `radiant-${environment}-state-sync`,
      description: 'Syncs state between environments',
      handler: 'lambda/admin/state-registry.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../')),
      timeout: cdk.Duration.minutes(15), // Long timeout for sync
      memorySize: 2048,
    } as lambda.FunctionProps);

    // Backup Function - creates and manages backups
    this.backupFunction = new lambda.Function(this, 'BackupFunction', {
      ...commonLambdaProps,
      functionName: `radiant-${environment}-state-backup`,
      description: 'Creates and manages state backups',
      handler: 'lambda/admin/state-registry.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../')),
      timeout: cdk.Duration.minutes(15),
      memorySize: 2048,
    } as lambda.FunctionProps);

    // ========================================================================
    // Scheduled Auto-Capture (optional)
    // ========================================================================

    if (enableAutoCapture) {
      const autoCaptureRule = new events.Rule(this, 'AutoCaptureRule', {
        ruleName: `radiant-${environment}-state-auto-capture`,
        description: 'Automatically captures environment state on schedule',
        schedule: events.Schedule.expression(autoCaptureSchedule),
      });

      autoCaptureRule.addTarget(new targets.LambdaFunction(this.captureFunction, {
        event: events.RuleTargetInput.fromObject({
          action: 'auto-capture',
          environment,
        }),
      }));
    }

    // ========================================================================
    // API Gateway
    // ========================================================================

    this.stateRegistryApi = new apigateway.RestApi(this, 'StateRegistryApi', {
      restApiName: `radiant-${environment}-state-registry-api`,
      description: 'API for Environment State Registry',
      deployOptions: {
        stageName: environment,
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: environment !== 'prod',
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
      },
    });

    // Create the Lambda integration
    const apiIntegration = new apigateway.LambdaIntegration(this.captureFunction, {
      proxy: true,
    });

    // API Resources
    const api = this.stateRegistryApi.root.addResource('api');
    const admin = api.addResource('admin');
    const stateRegistry = admin.addResource('state-registry');

    // Dashboard
    stateRegistry.addMethod('GET', apiIntegration);

    // Manifests
    const manifests = stateRegistry.addResource('manifests');
    manifests.addMethod('GET', apiIntegration);
    
    const manifestEnv = manifests.addResource('{environment}');
    manifestEnv.addMethod('GET', apiIntegration);
    
    const manifestCapture = manifestEnv.addResource('capture');
    manifestCapture.addMethod('POST', apiIntegration);
    
    const manifestHistory = manifestEnv.addResource('history');
    manifestHistory.addMethod('GET', apiIntegration);

    // Compare
    const compare = stateRegistry.addResource('compare');
    compare.addMethod('POST', apiIntegration);

    // Sync
    const sync = stateRegistry.addResource('sync');
    sync.addMethod('POST', apiIntegration);
    sync.addMethod('GET', apiIntegration);
    
    const syncOperation = sync.addResource('{operationId}');
    syncOperation.addMethod('GET', apiIntegration);
    
    const syncCancel = syncOperation.addResource('cancel');
    syncCancel.addMethod('POST', apiIntegration);
    
    const syncHistory = sync.addResource('history');
    syncHistory.addMethod('GET', apiIntegration);

    // Config
    const config = stateRegistry.addResource('config');
    const configEnv = config.addResource('{environment}');
    configEnv.addMethod('GET', apiIntegration);
    configEnv.addMethod('PUT', apiIntegration);

    // Backups
    const backups = stateRegistry.addResource('backups');
    backups.addMethod('GET', apiIntegration);
    backups.addMethod('POST', apiIntegration);
    
    const backupId = backups.addResource('{backupId}');
    backupId.addMethod('GET', apiIntegration);
    backupId.addMethod('DELETE', apiIntegration);
    
    const backupRestore = backupId.addResource('restore');
    backupRestore.addMethod('POST', apiIntegration);

    // Persistent Data
    const persistentData = stateRegistry.addResource('persistent-data');
    const persistentDataEnv = persistentData.addResource('{environment}');
    persistentDataEnv.addMethod('GET', apiIntegration);
    persistentDataEnv.addMethod('PUT', apiIntegration);

    // ========================================================================
    // Cross-Account Access (optional)
    // ========================================================================

    if (enableCrossAccountAccess && crossAccountPrincipals.length > 0) {
      // Allow cross-account access to the S3 bucket
      this.stateRegistryBucket.addToResourcePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: crossAccountPrincipals.map(p => new iam.ArnPrincipal(p)),
        actions: [
          's3:GetObject',
          's3:PutObject',
          's3:ListBucket',
        ],
        resources: [
          this.stateRegistryBucket.bucketArn,
          `${this.stateRegistryBucket.bucketArn}/*`,
        ],
      }));
    }

    // ========================================================================
    // Outputs
    // ========================================================================

    new cdk.CfnOutput(this, 'StateRegistryBucketName', {
      value: this.stateRegistryBucket.bucketName,
      description: 'State Registry S3 Bucket Name',
      exportName: `radiant-${environment}-state-registry-bucket`,
    });

    new cdk.CfnOutput(this, 'StateRegistryBucketArn', {
      value: this.stateRegistryBucket.bucketArn,
      description: 'State Registry S3 Bucket ARN',
      exportName: `radiant-${environment}-state-registry-bucket-arn`,
    });

    new cdk.CfnOutput(this, 'StateRegistryApiUrl', {
      value: this.stateRegistryApi.url,
      description: 'State Registry API URL',
      exportName: `radiant-${environment}-state-registry-api-url`,
    });

    new cdk.CfnOutput(this, 'CaptureFunctionArn', {
      value: this.captureFunction.functionArn,
      description: 'State Capture Lambda Function ARN',
      exportName: `radiant-${environment}-state-capture-function-arn`,
    });

    new cdk.CfnOutput(this, 'SyncFunctionArn', {
      value: this.syncFunction.functionArn,
      description: 'State Sync Lambda Function ARN',
      exportName: `radiant-${environment}-state-sync-function-arn`,
    });

    new cdk.CfnOutput(this, 'BackupFunctionArn', {
      value: this.backupFunction.functionArn,
      description: 'State Backup Lambda Function ARN',
      exportName: `radiant-${environment}-state-backup-function-arn`,
    });

    // Tags
    cdk.Tags.of(this).add('radiant:component', 'state-registry');
    cdk.Tags.of(this).add('radiant:environment', environment);
    cdk.Tags.of(this).add('radiant:version', radiantVersion);
  }
}
