/**
 * The Grimoire & Economic Governor CDK Stack
 * RADIANT v5.0.2 - System Evolution
 * 
 * Infrastructure for:
 * - Grimoire cleanup Lambda (scheduled daily)
 * - Governor API Lambda
 * - EventBridge schedules
 */

import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface GrimoireStackProps extends cdk.StackProps {
  appId: string;
  environment: string;
  vpc: ec2.IVpc;
  dbSecurityGroup: ec2.ISecurityGroup;
  dbSecret: secretsmanager.ISecret;
  litellmProxyUrl: string;
  litellmApiKeySecretArn: string;
  catoServiceUrl: string;
}

export class GrimoireStack extends cdk.Stack {
  public readonly cleanupLambda: lambda.Function;
  public readonly governorApiLambda: lambda.Function;
  public readonly grimoireApiLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: GrimoireStackProps) {
    super(scope, id, props);

    const { 
      appId, 
      environment, 
      vpc, 
      dbSecurityGroup, 
      dbSecret,
      litellmProxyUrl,
      litellmApiKeySecretArn,
      catoServiceUrl
    } = props;

    // Common Lambda environment variables
    const commonEnv = {
      ENVIRONMENT: environment,
      APP_ID: appId,
      DB_SECRET_ARN: dbSecret.secretArn,
      LITELLM_PROXY_URL: litellmProxyUrl,
      CATO_API_URL: catoServiceUrl,
    };

    // Lambda security group
    const lambdaSg = new ec2.SecurityGroup(this, 'GrimoireLambdaSg', {
      vpc,
      description: 'Security group for Grimoire Lambda functions',
      allowAllOutbound: true,
    });

    // Allow Lambda to connect to database
    dbSecurityGroup.addIngressRule(
      lambdaSg,
      ec2.Port.tcp(5432),
      'Allow Grimoire Lambda to connect to database'
    );

    // Shared Lambda layer for Python dependencies
    const pythonLayer = new lambda.LayerVersion(this, 'GrimoirePythonLayer', {
      layerVersionName: `${appId}-${environment}-grimoire-python-deps`,
      code: lambda.Code.fromAsset('lambda-layers/grimoire-python'),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_11],
      description: 'Python dependencies for Grimoire (psycopg2, pgvector, httpx, numpy)',
    });

    // =========================================================================
    // GRIMOIRE CLEANUP LAMBDA
    // =========================================================================
    this.cleanupLambda = new lambda.Function(this, 'GrimoireCleanupLambda', {
      functionName: `${appId}-${environment}-grimoire-cleanup`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'cleanup.handler',
      code: lambda.Code.fromAsset('lambda/grimoire'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSg],
      environment: {
        ...commonEnv,
        CLEANUP_BATCH_SIZE: '1000',
      },
      layers: [pythonLayer],
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Grant DB access
    dbSecret.grantRead(this.cleanupLambda);

    // Schedule daily cleanup at 3 AM UTC
    new events.Rule(this, 'GrimoireCleanupSchedule', {
      ruleName: `${appId}-${environment}-grimoire-cleanup-schedule`,
      schedule: events.Schedule.cron({ minute: '0', hour: '3' }),
      targets: [new targets.LambdaFunction(this.cleanupLambda)],
      description: 'Daily cleanup of expired Grimoire heuristics',
    });

    // =========================================================================
    // GRIMOIRE API LAMBDA
    // =========================================================================
    this.grimoireApiLambda = new lambda.Function(this, 'GrimoireApiLambda', {
      functionName: `${appId}-${environment}-grimoire-api`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/grimoire-api'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSg],
      environment: {
        ...commonEnv,
        NODE_ENV: environment,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    dbSecret.grantRead(this.grimoireApiLambda);

    // Grant access to LiteLLM API key secret
    const litellmSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this, 
      'LiteLLMSecret', 
      litellmApiKeySecretArn
    );
    litellmSecret.grantRead(this.grimoireApiLambda);

    // =========================================================================
    // ECONOMIC GOVERNOR API LAMBDA
    // =========================================================================
    this.governorApiLambda = new lambda.Function(this, 'GovernorApiLambda', {
      functionName: `${appId}-${environment}-governor-api`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/governor-api'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSg],
      environment: {
        ...commonEnv,
        NODE_ENV: environment,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    dbSecret.grantRead(this.governorApiLambda);
    litellmSecret.grantRead(this.governorApiLambda);

    // =========================================================================
    // OUTPUTS
    // =========================================================================
    new cdk.CfnOutput(this, 'CleanupLambdaArn', {
      value: this.cleanupLambda.functionArn,
      description: 'Grimoire Cleanup Lambda ARN',
      exportName: `${appId}-${environment}-grimoire-cleanup-arn`,
    });

    new cdk.CfnOutput(this, 'GrimoireApiLambdaArn', {
      value: this.grimoireApiLambda.functionArn,
      description: 'Grimoire API Lambda ARN',
      exportName: `${appId}-${environment}-grimoire-api-arn`,
    });

    new cdk.CfnOutput(this, 'GovernorApiLambdaArn', {
      value: this.governorApiLambda.functionArn,
      description: 'Governor API Lambda ARN',
      exportName: `${appId}-${environment}-governor-api-arn`,
    });

    // Tags
    cdk.Tags.of(this).add('Application', appId);
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Component', 'grimoire');
    cdk.Tags.of(this).add('Version', '5.0.2');
  }
}
