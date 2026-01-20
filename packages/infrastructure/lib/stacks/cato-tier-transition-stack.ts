/**
 * Cato Infrastructure Tier Transition Stack
 * 
 * CDK stack that defines the Step Functions workflow and Lambda functions
 * for automated tier provisioning and cleanup.
 * 
 * @see /docs/cato/adr/009-infrastructure-tiers.md
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface CatoTierTransitionStackProps extends cdk.StackProps {
  readonly environment: 'dev' | 'staging' | 'prod';
  readonly vpcId?: string;
  readonly dbClusterArn?: string;
  readonly dbSecretArn?: string;
  readonly dbName?: string;
  readonly notificationTopicArn?: string;
  readonly alertTopicArn?: string;
}

export class CatoTierTransitionStack extends cdk.Stack {
  public readonly stateMachineArn: string;

  constructor(scope: Construct, id: string, props: CatoTierTransitionStackProps) {
    super(scope, id, props);

    const { 
      environment,
      dbClusterArn,
      dbSecretArn,
      dbName,
      notificationTopicArn,
      alertTopicArn 
    } = props;

    // =========================================================================
    // IAM Role for Lambda Functions
    // =========================================================================

    const lambdaRole = new iam.Role(this, 'TierTransitionLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Add permissions for resource management
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        // SageMaker
        'sagemaker:CreateEndpoint',
        'sagemaker:CreateEndpointConfig',
        'sagemaker:DeleteEndpoint',
        'sagemaker:DeleteEndpointConfig',
        'sagemaker:DescribeEndpoint',
        'sagemaker:UpdateEndpointWeightsAndCapacities',
        'sagemaker:ListEndpoints',
        // OpenSearch
        'es:CreateDomain',
        'es:DeleteDomain',
        'es:UpdateDomainConfig',
        'es:DescribeDomain',
        'es:ListDomainNames',
        // OpenSearch Serverless
        'aoss:CreateCollection',
        'aoss:DeleteCollection',
        'aoss:GetCollection',
        'aoss:ListCollections',
        // ElastiCache
        'elasticache:CreateReplicationGroup',
        'elasticache:DeleteReplicationGroup',
        'elasticache:ModifyReplicationGroup',
        'elasticache:DescribeReplicationGroups',
        'elasticache:CreateServerlessCache',
        'elasticache:DeleteServerlessCache',
        'elasticache:DescribeServerlessCaches',
        // Neptune
        'neptune-db:*',
        'rds:CreateDBCluster',
        'rds:DeleteDBCluster',
        'rds:CreateDBInstance',
        'rds:DeleteDBInstance',
        'rds:ModifyDBCluster',
        'rds:DescribeDBClusters',
        'rds:DescribeDBInstances',
        // Kinesis
        'kinesis:CreateStream',
        'kinesis:DeleteStream',
        'kinesis:UpdateShardCount',
        'kinesis:DescribeStream',
        // DynamoDB
        'dynamodb:UpdateTable',
        'dynamodb:DescribeTable',
        'dynamodb:CreateGlobalTable',
        'dynamodb:UpdateGlobalTable',
        // RDS Data API (for Aurora)
        'rds-data:ExecuteStatement',
        'secretsmanager:GetSecretValue',
      ],
      resources: ['*'],
    }));

    // =========================================================================
    // Lambda Functions
    // =========================================================================

    const lambdaDefaults = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      role: lambdaRole,
      environment: {
        ENVIRONMENT: environment,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        ...(dbClusterArn && { DB_CLUSTER_ARN: dbClusterArn }),
        ...(dbSecretArn && { DB_SECRET_ARN: dbSecretArn }),
        ...(dbName && { DB_NAME: dbName }),
        ...(notificationTopicArn && { NOTIFICATION_TOPIC_ARN: notificationTopicArn }),
        ...(alertTopicArn && { ALERT_TOPIC_ARN: alertTopicArn }),
      },
    };

    // Validation Lambda
    const validateTransitionFn = new lambda.Function(this, 'ValidateTransition', {
      ...lambdaDefaults,
      functionName: `cato-validate-transition-${environment}`,
      handler: 'validate-transition.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/tier-transition')),
    });

    // Provision Lambdas
    const provisionSageMakerFn = new lambda.Function(this, 'ProvisionSageMaker', {
      ...lambdaDefaults,
      functionName: `cato-provision-sagemaker-${environment}`,
      handler: 'provision-sagemaker.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/tier-transition')),
      timeout: cdk.Duration.minutes(10),
    });

    const provisionOpenSearchFn = new lambda.Function(this, 'ProvisionOpenSearch', {
      ...lambdaDefaults,
      functionName: `cato-provision-opensearch-${environment}`,
      handler: 'provision-opensearch.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/tier-transition')),
      timeout: cdk.Duration.minutes(10),
    });

    const provisionElastiCacheFn = new lambda.Function(this, 'ProvisionElastiCache', {
      ...lambdaDefaults,
      functionName: `cato-provision-elasticache-${environment}`,
      handler: 'provision-elasticache.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/tier-transition')),
      timeout: cdk.Duration.minutes(10),
    });

    const provisionNeptuneFn = new lambda.Function(this, 'ProvisionNeptune', {
      ...lambdaDefaults,
      functionName: `cato-provision-neptune-${environment}`,
      handler: 'provision-neptune.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/tier-transition')),
      timeout: cdk.Duration.minutes(10),
    });

    const provisionKinesisFn = new lambda.Function(this, 'ProvisionKinesis', {
      ...lambdaDefaults,
      functionName: `cato-provision-kinesis-${environment}`,
      handler: 'provision-kinesis.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/tier-transition')),
    });

    // Verify Provisioning Lambda
    const verifyProvisioningFn = new lambda.Function(this, 'VerifyProvisioning', {
      ...lambdaDefaults,
      functionName: `cato-verify-provisioning-${environment}`,
      handler: 'verify-provisioning.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/tier-transition')),
    });

    // Drain Connections Lambda
    const drainConnectionsFn = new lambda.Function(this, 'DrainConnections', {
      ...lambdaDefaults,
      functionName: `cato-drain-connections-${environment}`,
      handler: 'drain-connections.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/tier-transition')),
    });

    // Update App Config Lambda
    const updateAppConfigFn = new lambda.Function(this, 'UpdateAppConfig', {
      ...lambdaDefaults,
      functionName: `cato-update-app-config-${environment}`,
      handler: 'update-app-config.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/tier-transition')),
    });

    // Cleanup Lambdas
    const cleanupSageMakerFn = new lambda.Function(this, 'CleanupSageMaker', {
      ...lambdaDefaults,
      functionName: `cato-cleanup-sagemaker-${environment}`,
      handler: 'cleanup-sagemaker.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/tier-transition')),
      timeout: cdk.Duration.minutes(10),
    });

    const cleanupOpenSearchFn = new lambda.Function(this, 'CleanupOpenSearch', {
      ...lambdaDefaults,
      functionName: `cato-cleanup-opensearch-${environment}`,
      handler: 'cleanup-opensearch.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/tier-transition')),
      timeout: cdk.Duration.minutes(10),
    });

    const cleanupElastiCacheFn = new lambda.Function(this, 'CleanupElastiCache', {
      ...lambdaDefaults,
      functionName: `cato-cleanup-elasticache-${environment}`,
      handler: 'cleanup-elasticache.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/tier-transition')),
      timeout: cdk.Duration.minutes(10),
    });

    const cleanupNeptuneFn = new lambda.Function(this, 'CleanupNeptune', {
      ...lambdaDefaults,
      functionName: `cato-cleanup-neptune-${environment}`,
      handler: 'cleanup-neptune.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/tier-transition')),
      timeout: cdk.Duration.minutes(10),
    });

    // Transition Complete/Failed Lambdas
    const transitionCompleteFn = new lambda.Function(this, 'TransitionComplete', {
      ...lambdaDefaults,
      functionName: `cato-transition-complete-${environment}`,
      handler: 'transition-complete.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/tier-transition')),
    });

    const transitionFailedFn = new lambda.Function(this, 'TransitionFailed', {
      ...lambdaDefaults,
      functionName: `cato-transition-failed-${environment}`,
      handler: 'transition-failed.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/tier-transition')),
    });

    const rollbackProvisioningFn = new lambda.Function(this, 'RollbackProvisioning', {
      ...lambdaDefaults,
      functionName: `cato-rollback-provisioning-${environment}`,
      handler: 'rollback-provisioning.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/tier-transition')),
      timeout: cdk.Duration.minutes(10),
    });

    const cleanupFailedAlertFn = new lambda.Function(this, 'CleanupFailedAlert', {
      ...lambdaDefaults,
      functionName: `cato-cleanup-failed-alert-${environment}`,
      handler: 'cleanup-failed-alert.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/tier-transition')),
    });

    // =========================================================================
    // Step Functions Tasks
    // =========================================================================

    const validateTransition = new tasks.LambdaInvoke(this, 'ValidateTransitionTask', {
      lambdaFunction: validateTransitionFn,
      outputPath: '$.Payload',
    });

    // Provision tasks
    const provisionSageMaker = new tasks.LambdaInvoke(this, 'ProvisionSageMakerTask', {
      lambdaFunction: provisionSageMakerFn,
      outputPath: '$.Payload',
    });

    const provisionOpenSearch = new tasks.LambdaInvoke(this, 'ProvisionOpenSearchTask', {
      lambdaFunction: provisionOpenSearchFn,
      outputPath: '$.Payload',
    });

    const provisionElastiCache = new tasks.LambdaInvoke(this, 'ProvisionElastiCacheTask', {
      lambdaFunction: provisionElastiCacheFn,
      outputPath: '$.Payload',
    });

    const provisionNeptune = new tasks.LambdaInvoke(this, 'ProvisionNeptuneTask', {
      lambdaFunction: provisionNeptuneFn,
      outputPath: '$.Payload',
    });

    const provisionKinesis = new tasks.LambdaInvoke(this, 'ProvisionKinesisTask', {
      lambdaFunction: provisionKinesisFn,
      outputPath: '$.Payload',
    });

    // Parallel provisioning
    const provisionResources = new sfn.Parallel(this, 'ProvisionResourcesParallel')
      .branch(provisionSageMaker)
      .branch(provisionOpenSearch)
      .branch(provisionElastiCache)
      .branch(provisionNeptune)
      .branch(provisionKinesis);

    const waitForProvisioning = new sfn.Wait(this, 'WaitForProvisioning', {
      time: sfn.WaitTime.duration(cdk.Duration.seconds(60)),
    });

    const verifyProvisioning = new tasks.LambdaInvoke(this, 'VerifyProvisioningTask', {
      lambdaFunction: verifyProvisioningFn,
      outputPath: '$.Payload',
    }).addRetry({
      errors: ['ResourceNotReady'],
      interval: cdk.Duration.seconds(30),
      maxAttempts: 10,
      backoffRate: 1.5,
    });

    // Drain and cleanup tasks
    const drainConnections = new tasks.LambdaInvoke(this, 'DrainConnectionsTask', {
      lambdaFunction: drainConnectionsFn,
      outputPath: '$.Payload',
    });

    const waitForDrain = new sfn.Wait(this, 'WaitForDrain', {
      time: sfn.WaitTime.duration(cdk.Duration.seconds(30)),
    });

    // Separate task instances for each path (Step Functions requires unique next states)
    const updateAppConfigScaleUp = new tasks.LambdaInvoke(this, 'UpdateAppConfigScaleUpTask', {
      lambdaFunction: updateAppConfigFn,
      outputPath: '$.Payload',
    });

    const updateAppConfigScaleDown = new tasks.LambdaInvoke(this, 'UpdateAppConfigScaleDownTask', {
      lambdaFunction: updateAppConfigFn,
      outputPath: '$.Payload',
    });

    // Cleanup tasks
    const cleanupSageMaker = new tasks.LambdaInvoke(this, 'CleanupSageMakerTask', {
      lambdaFunction: cleanupSageMakerFn,
      outputPath: '$.Payload',
    });

    const cleanupOpenSearch = new tasks.LambdaInvoke(this, 'CleanupOpenSearchTask', {
      lambdaFunction: cleanupOpenSearchFn,
      outputPath: '$.Payload',
    });

    const cleanupElastiCache = new tasks.LambdaInvoke(this, 'CleanupElastiCacheTask', {
      lambdaFunction: cleanupElastiCacheFn,
      outputPath: '$.Payload',
    });

    const cleanupNeptune = new tasks.LambdaInvoke(this, 'CleanupNeptuneTask', {
      lambdaFunction: cleanupNeptuneFn,
      outputPath: '$.Payload',
    });

    // Parallel cleanup
    const cleanupResources = new sfn.Parallel(this, 'CleanupResourcesParallel')
      .branch(cleanupSageMaker)
      .branch(cleanupOpenSearch)
      .branch(cleanupElastiCache)
      .branch(cleanupNeptune);

    // Completion tasks - separate instances per path
    const transitionCompleteScaleUp = new tasks.LambdaInvoke(this, 'TransitionCompleteScaleUpTask', {
      lambdaFunction: transitionCompleteFn,
      outputPath: '$.Payload',
    });

    const transitionCompleteScaleDown = new tasks.LambdaInvoke(this, 'TransitionCompleteScaleDownTask', {
      lambdaFunction: transitionCompleteFn,
      outputPath: '$.Payload',
    });

    const transitionCompleteCleanupFailed = new tasks.LambdaInvoke(this, 'TransitionCompleteCleanupFailedTask', {
      lambdaFunction: transitionCompleteFn,
      outputPath: '$.Payload',
    });

    const transitionFailed = new tasks.LambdaInvoke(this, 'TransitionFailedTask', {
      lambdaFunction: transitionFailedFn,
      outputPath: '$.Payload',
    });

    const rollbackProvisioning = new tasks.LambdaInvoke(this, 'RollbackProvisioningTask', {
      lambdaFunction: rollbackProvisioningFn,
      outputPath: '$.Payload',
    });

    const cleanupFailedAlert = new tasks.LambdaInvoke(this, 'CleanupFailedAlertTask', {
      lambdaFunction: cleanupFailedAlertFn,
      outputPath: '$.Payload',
    });

    // =========================================================================
    // Step Functions State Machine
    // =========================================================================

    // Scale Up Path - rollback chain defined once
    const rollbackChain = rollbackProvisioning.next(transitionFailed);
    
    const scaleUpPath = provisionResources
      .addCatch(rollbackChain, { resultPath: '$.error' })
      .next(waitForProvisioning)
      .next(
        verifyProvisioning.addCatch(rollbackChain, { resultPath: '$.error' })
      )
      .next(updateAppConfigScaleUp)
      .next(transitionCompleteScaleUp);

    // Scale Down Path
    const scaleDownPath = drainConnections
      .next(waitForDrain)
      .next(updateAppConfigScaleDown)
      .next(
        cleanupResources.addCatch(cleanupFailedAlert.next(transitionCompleteCleanupFailed), { resultPath: '$.error' })
      )
      .next(transitionCompleteScaleDown);

    // Direction choice
    const determineDirection = new sfn.Choice(this, 'DetermineDirection')
      .when(sfn.Condition.stringEquals('$.direction', 'SCALING_UP'), scaleUpPath)
      .when(sfn.Condition.stringEquals('$.direction', 'SCALING_DOWN'), scaleDownPath)
      .otherwise(transitionFailed);

    // Full workflow
    const definition = validateTransition
      .addCatch(transitionFailed, { resultPath: '$.error' })
      .next(determineDirection);

    // Create log group
    const logGroup = new logs.LogGroup(this, 'TierTransitionLogs', {
      logGroupName: `/aws/stepfunctions/cato-tier-transition-${environment}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create state machine
    const stateMachine = new sfn.StateMachine(this, 'TierTransitionStateMachine', {
      stateMachineName: `cato-tier-transition-${environment}`,
      definition,
      stateMachineType: sfn.StateMachineType.STANDARD,
      timeout: cdk.Duration.minutes(30),
      logs: {
        destination: logGroup,
        level: sfn.LogLevel.ALL,
      },
    });

    this.stateMachineArn = stateMachine.stateMachineArn;

    // =========================================================================
    // Outputs
    // =========================================================================

    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: stateMachine.stateMachineArn,
      description: 'Cato Tier Transition State Machine ARN',
      exportName: `cato-tier-transition-arn-${environment}`,
    });
  }
}
