/**
 * RADIANT v7.0.0 - Deployer Key Rotation Stack
 * 
 * CDK stack for AWS Secrets Manager automatic key rotation infrastructure.
 * Creates:
 * - Secrets for each environment (dev, staging, prod)
 * - Rotation Lambda function
 * - EventBridge rules for scheduled rotation
 * - IAM roles and policies
 */

import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import type { Environment } from '@radiant/shared';
import * as path from 'path';

export interface DeployerKeyRotationStackProps extends cdk.StackProps {
  appId: string;
  environment: Environment;
  secretsKey: kms.IKey;
  rotationIntervalDays?: number;
  keyOverlapMs?: number;
}

export class DeployerKeyRotationStack extends cdk.Stack {
  public readonly rotationLambda: lambda.Function;
  public readonly deployerSecrets: Map<string, secretsmanager.Secret> = new Map();
  
  constructor(scope: Construct, id: string, props: DeployerKeyRotationStackProps) {
    super(scope, id, props);
    
    const { 
      appId, 
      environment, 
      secretsKey,
      rotationIntervalDays = 90,
      keyOverlapMs = 60000,
    } = props;
    
    const isProd = environment === 'prod';
    const environments = ['dev', 'staging', 'prod'];

    // ==========================================================================
    // IAM ROLE FOR ROTATION LAMBDA
    // ==========================================================================
    
    const rotationRole = new iam.Role(this, 'RotationLambdaRole', {
      roleName: `${appId}-${environment}-key-rotation-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for deployer key rotation Lambda',
    });

    // CloudWatch Logs
    rotationRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: ['*'],
    }));

    // Secrets Manager permissions
    rotationRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:DescribeSecret',
        'secretsmanager:GetSecretValue',
        'secretsmanager:PutSecretValue',
        'secretsmanager:UpdateSecretVersionStage',
      ],
      resources: [
        `arn:aws:secretsmanager:${this.region}:${this.account}:secret:radiant/*`,
      ],
    }));

    // IAM permissions for key management
    rotationRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'iam:CreateAccessKey',
        'iam:DeleteAccessKey',
        'iam:ListAccessKeys',
        'iam:GetUser',
        'iam:UpdateAccessKey',
      ],
      resources: [
        `arn:aws:iam::${this.account}:user/radiant-*-deployer`,
      ],
    }));

    // KMS permissions
    secretsKey.grantEncryptDecrypt(rotationRole);

    // CloudWatch Metrics
    rotationRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
      conditions: {
        StringEquals: {
          'cloudwatch:namespace': 'RADIANT/KeyRotation',
        },
      },
    }));

    // ==========================================================================
    // ROTATION LAMBDA FUNCTION
    // ==========================================================================
    
    const rotationLogGroup = new logs.LogGroup(this, 'RotationLogGroup', {
      logGroupName: `/aws/lambda/${appId}-${environment}-key-rotation`,
      retention: isProd ? logs.RetentionDays.ONE_YEAR : logs.RetentionDays.ONE_MONTH,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.rotationLambda = new lambda.Function(this, 'RotationLambda', {
      functionName: `${appId}-${environment}-key-rotation`,
      description: 'Rotates IAM access keys for RADIANT deployer users',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'credential-rotation.handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/dist/scheduled')),
      role: rotationRole,
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      environment: {
        NODE_ENV: environment,
        KEY_OVERLAP_MS: keyOverlapMs.toString(),
        ROTATION_INTERVAL_DAYS: rotationIntervalDays.toString(),
      },
      logGroup: rotationLogGroup,
    });

    // Grant Secrets Manager permission to invoke Lambda
    this.rotationLambda.addPermission('SecretsManagerInvoke', {
      principal: new iam.ServicePrincipal('secretsmanager.amazonaws.com'),
      action: 'lambda:InvokeFunction',
    });

    // ==========================================================================
    // SECRETS FOR EACH ENVIRONMENT
    // ==========================================================================
    
    for (const env of environments) {
      const secretName = `radiant/${env}/deployer-keys`;
      
      // Create the secret (initially empty - will be populated by Deployer app)
      const secret = new secretsmanager.Secret(this, `DeployerSecret${env}`, {
        secretName,
        description: `RADIANT deployer access keys for ${env} environment`,
        encryptionKey: secretsKey,
        removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      });

      // Configure rotation
      secret.addRotationSchedule(`Rotation${env}`, {
        rotationLambda: this.rotationLambda,
        automaticallyAfter: cdk.Duration.days(rotationIntervalDays),
        rotateImmediatelyOnUpdate: false,
      });

      this.deployerSecrets.set(env, secret);

      // Output secret ARN
      new cdk.CfnOutput(this, `DeployerSecretArn${env}`, {
        value: secret.secretArn,
        description: `Secret ARN for ${env} deployer keys`,
        exportName: `${appId}-${environment}-deployer-secret-${env}`,
      });
    }

    // ==========================================================================
    // IAM USERS FOR EACH ENVIRONMENT (if they don't exist)
    // ==========================================================================
    
    for (const env of environments) {
      const userName = `radiant-${env}-deployer`;
      
      // Create IAM user
      const user = new iam.User(this, `DeployerUser${env}`, {
        userName,
        path: '/radiant/',
      });

      // Create managed policy with required permissions
      const policy = new iam.ManagedPolicy(this, `DeployerPolicy${env}`, {
        managedPolicyName: `${appId}-${env}-deployer-policy`,
        description: `Policy for RADIANT ${env} deployer`,
        statements: [
          // CloudFormation - full access for deployments
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['cloudformation:*'],
            resources: [`arn:aws:cloudformation:*:${this.account}:stack/radiant-${env}*/*`],
          }),
          // Lambda - for deploying functions
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'lambda:CreateFunction',
              'lambda:UpdateFunctionCode',
              'lambda:UpdateFunctionConfiguration',
              'lambda:DeleteFunction',
              'lambda:GetFunction',
              'lambda:ListFunctions',
              'lambda:InvokeFunction',
              'lambda:AddPermission',
              'lambda:RemovePermission',
              'lambda:TagResource',
            ],
            resources: [`arn:aws:lambda:*:${this.account}:function:radiant-${env}*`],
          }),
          // S3 - for artifacts and assets
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['s3:*'],
            resources: [
              `arn:aws:s3:::radiant-${env}*`,
              `arn:aws:s3:::radiant-${env}*/*`,
            ],
          }),
          // DynamoDB - for tables
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['dynamodb:*'],
            resources: [`arn:aws:dynamodb:*:${this.account}:table/radiant-${env}*`],
          }),
          // API Gateway
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['apigateway:*'],
            resources: ['*'],
            conditions: {
              StringLike: {
                'apigateway:Request/tags/Environment': env,
              },
            },
          }),
          // Secrets Manager - read only for runtime
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'secretsmanager:GetSecretValue',
              'secretsmanager:DescribeSecret',
            ],
            resources: [`arn:aws:secretsmanager:*:${this.account}:secret:radiant/${env}/*`],
          }),
          // CloudWatch - for logs and metrics
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'logs:CreateLogGroup',
              'logs:CreateLogStream',
              'logs:PutLogEvents',
              'logs:DescribeLogGroups',
              'logs:DescribeLogStreams',
              'cloudwatch:PutMetricData',
              'cloudwatch:GetMetricData',
            ],
            resources: ['*'],
          }),
          // IAM PassRole - for Lambda execution roles
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['iam:PassRole'],
            resources: [`arn:aws:iam::${this.account}:role/radiant-${env}*`],
          }),
          // STS - for caller identity
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['sts:GetCallerIdentity'],
            resources: ['*'],
          }),
        ],
      });

      // Attach policy to user
      user.addManagedPolicy(policy);

      // Tag user for tracking
      cdk.Tags.of(user).add('Environment', env);
      cdk.Tags.of(user).add('ManagedBy', 'RADIANT-Deployer');
      cdk.Tags.of(user).add('Purpose', 'Deployment');
    }

    // ==========================================================================
    // EVENTBRIDGE RULE FOR SCHEDULED CHECK
    // ==========================================================================
    
    // Daily check for rotation needs (backup for Secrets Manager rotation)
    const dailyCheckRule = new events.Rule(this, 'DailyRotationCheck', {
      ruleName: `${appId}-${environment}-rotation-check`,
      description: 'Daily check for key rotation needs',
      schedule: events.Schedule.cron({ minute: '0', hour: '6' }), // 6 AM UTC daily
      enabled: true,
    });

    // Create a separate Lambda for scheduled checks
    const scheduledCheckLambda = new lambda.Function(this, 'ScheduledCheckLambda', {
      functionName: `${appId}-${environment}-rotation-check`,
      description: 'Scheduled check for key rotation needs',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'credential-rotation.handler.scheduledRotationHandler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/dist/scheduled')),
      role: rotationRole,
      timeout: cdk.Duration.minutes(2),
      memorySize: 256,
      environment: {
        NODE_ENV: environment,
        ENVIRONMENTS: environments.join(','),
      },
    });

    dailyCheckRule.addTarget(new targets.LambdaFunction(scheduledCheckLambda));

    // ==========================================================================
    // CLOUDWATCH ALARMS
    // ==========================================================================
    
    // Alarm for rotation failures
    const rotationFailureMetric = this.rotationLambda.metricErrors({
      period: cdk.Duration.hours(1),
      statistic: 'Sum',
    });

    new cdk.aws_cloudwatch.Alarm(this, 'RotationFailureAlarm', {
      alarmName: `${appId}-${environment}-key-rotation-failures`,
      alarmDescription: 'Key rotation Lambda failures',
      metric: rotationFailureMetric,
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // ==========================================================================
    // OUTPUTS
    // ==========================================================================
    
    new cdk.CfnOutput(this, 'RotationLambdaArn', {
      value: this.rotationLambda.functionArn,
      description: 'Rotation Lambda ARN',
      exportName: `${appId}-${environment}-rotation-lambda-arn`,
    });

    new cdk.CfnOutput(this, 'RotationLambdaName', {
      value: this.rotationLambda.functionName,
      description: 'Rotation Lambda name',
      exportName: `${appId}-${environment}-rotation-lambda-name`,
    });
  }
}
