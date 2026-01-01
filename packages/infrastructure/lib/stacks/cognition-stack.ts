/**
 * RADIANT v6.1.0 - Cognition Stack
 * Infrastructure for advanced cognitive services.
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import * as path from 'path';

interface CognitionStackProps extends cdk.StackProps {
  stage: 'dev' | 'staging' | 'prod';
  vpc: ec2.IVpc;
  lambdaSecurityGroup: ec2.ISecurityGroup;
  databaseEndpoint: string;
  databaseSecretArn: string;
  litellmEndpoint: string;
}

export class CognitionStack extends cdk.Stack {
  public readonly trainingBucket: s3.IBucket;
  public readonly distillationLambda: lambda.IFunction;
  
  constructor(scope: Construct, id: string, props: CognitionStackProps) {
    super(scope, id, props);
    
    // S3 bucket for training data and model artifacts
    this.trainingBucket = new s3.Bucket(this, 'CognitionTrainingBucket', {
      bucketName: `radiant-${props.stage}-cognition-training-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: props.stage === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.stage !== 'prod',
      lifecycleRules: [{
        id: 'ExpireOldTrainingData',
        expiration: cdk.Duration.days(90),
        prefix: 'distillation/',
      }, {
        id: 'ExpireOldCacheBackups',
        expiration: cdk.Duration.days(30),
        prefix: 'cache-backups/',
      }],
    });
    
    // SageMaker execution role for student model training
    const sagemakerRole = new iam.Role(this, 'SageMakerExecutionRole', {
      assumedBy: new iam.ServicePrincipal('sagemaker.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'),
      ],
    });
    
    this.trainingBucket.grantReadWrite(sagemakerRole);
    
    // Common Lambda environment
    const lambdaEnvironment = {
      STAGE: props.stage,
      DATABASE_ENDPOINT: props.databaseEndpoint,
      DATABASE_SECRET_ARN: props.databaseSecretArn,
      LITELLM_ENDPOINT: props.litellmEndpoint,
      TRAINING_DATA_BUCKET: this.trainingBucket.bucketName,
      SAGEMAKER_ROLE_ARN: sagemakerRole.roleArn,
    };
    
    // Distillation pipeline Lambda
    this.distillationLambda = new lambda.Function(this, 'DistillationPipelineLambda', {
      functionName: `radiant-${props.stage}-distillation-pipeline`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'cognition/distillation.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/dist')),
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      vpc: props.vpc,
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        ...lambdaEnvironment,
        DISTILLATION_TRAINING_IMAGE: `763104351884.dkr.ecr.${this.region}.amazonaws.com/huggingface-pytorch-training:2.0.0-transformers4.28.1-gpu-py310-cu118-ubuntu20.04`,
      },
    });
    
    this.trainingBucket.grantReadWrite(this.distillationLambda);
    
    this.distillationLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'sagemaker:CreateTrainingJob',
        'sagemaker:DescribeTrainingJob',
        'sagemaker:CreateModel',
        'sagemaker:CreateEndpointConfig',
        'sagemaker:CreateEndpoint',
        'sagemaker:DescribeEndpoint',
        'sagemaker:InvokeEndpoint',
        'sagemaker:DeleteEndpoint',
        'sagemaker:UpdateEndpoint',
      ],
      resources: ['*'],
    }));
    
    // Semantic cache cleanup Lambda (runs hourly)
    const cacheCleanupLambda = new lambda.Function(this, 'CacheCleanupLambda', {
      functionName: `radiant-${props.stage}-cache-cleanup`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'cognition/cache-cleanup.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/dist')),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      vpc: props.vpc,
      securityGroups: [props.lambdaSecurityGroup],
      environment: lambdaEnvironment,
    });
    
    new events.Rule(this, 'CacheCleanupSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      targets: [new targets.LambdaFunction(cacheCleanupLambda)],
    });
    
    // Curiosity exploration Lambda (runs during off-peak hours)
    const curiosityLambda = new lambda.Function(this, 'CuriosityExplorationLambda', {
      functionName: `radiant-${props.stage}-curiosity-exploration`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'cognition/curiosity.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/dist')),
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      vpc: props.vpc,
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        ...lambdaEnvironment,
        MAX_TOKENS_PER_RUN: '50000',
        MAX_COST_PER_RUN: '2.50',
      },
    });
    
    // Run curiosity exploration at 3 AM UTC (off-peak)
    new events.Rule(this, 'CuriosityExplorationSchedule', {
      schedule: events.Schedule.cron({ hour: '3', minute: '0' }),
      targets: [new targets.LambdaFunction(curiosityLambda)],
    });
    
    // Counterfactual analysis Lambda
    const counterfactualLambda = new lambda.Function(this, 'CounterfactualLambda', {
      functionName: `radiant-${props.stage}-counterfactual-analysis`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'cognition/counterfactual.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/dist')),
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
      vpc: props.vpc,
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        ...lambdaEnvironment,
        MAX_DAILY_SIMULATIONS: '1000',
      },
    });
    
    // Metrics aggregation Lambda (runs every 15 minutes)
    const metricsLambda = new lambda.Function(this, 'CognitionMetricsLambda', {
      functionName: `radiant-${props.stage}-cognition-metrics`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'cognition/metrics.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/dist')),
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      vpc: props.vpc,
      securityGroups: [props.lambdaSecurityGroup],
      environment: lambdaEnvironment,
    });
    
    new events.Rule(this, 'MetricsAggregationSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
      targets: [new targets.LambdaFunction(metricsLambda)],
    });
    
    // Outputs
    new cdk.CfnOutput(this, 'TrainingBucketName', {
      value: this.trainingBucket.bucketName,
      description: 'S3 bucket for distillation training data',
    });
    
    new cdk.CfnOutput(this, 'SageMakerRoleArn', {
      value: sagemakerRole.roleArn,
      description: 'SageMaker execution role ARN',
    });
    
    new cdk.CfnOutput(this, 'DistillationLambdaArn', {
      value: this.distillationLambda.functionArn,
      description: 'Distillation pipeline Lambda ARN',
    });
  }
}
