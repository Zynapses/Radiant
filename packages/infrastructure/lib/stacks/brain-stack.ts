/**
 * RADIANT v6.0.4 - Brain Stack
 * CDK Stack for AGI Brain infrastructure
 * 
 * Provisions:
 * - Brain inference Lambda
 * - Reconciliation Lambda (scheduled)
 * - API Gateway routes
 * - ElastiCache (Redis) for flash facts and ghost cache
 * - SQS queues for async processing
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export interface BrainStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  dbSecurityGroup: ec2.ISecurityGroup;
  dbClusterArn: string;
  dbSecretArn: string;
  environment: string;
  litellmUrl?: string;
}

export class BrainStack extends cdk.Stack {
  public readonly brainApi: apigateway.RestApi;
  public readonly brainInferenceLambda: lambda.Function;
  public readonly reconciliationLambda: lambda.Function;
  public readonly redisCluster: elasticache.CfnCacheCluster;

  constructor(scope: Construct, id: string, props: BrainStackProps) {
    super(scope, id, props);

    const { vpc, dbSecurityGroup, dbClusterArn, dbSecretArn, environment } = props;

    // ===========================================================================
    // Security Groups
    // ===========================================================================
    const brainSecurityGroup = new ec2.SecurityGroup(this, 'BrainSecurityGroup', {
      vpc,
      description: 'Security group for Brain Lambda functions',
      allowAllOutbound: true,
    });

    const redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc,
      description: 'Security group for Redis cluster',
      allowAllOutbound: false,
    });

    // Allow Brain Lambda to access Redis
    redisSecurityGroup.addIngressRule(
      brainSecurityGroup,
      ec2.Port.tcp(6379),
      'Allow Brain Lambda to access Redis'
    );

    // Allow Brain Lambda to access database
    dbSecurityGroup.addIngressRule(
      brainSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Brain Lambda to access database'
    );

    // ===========================================================================
    // ElastiCache Redis
    // ===========================================================================
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Brain Redis cluster',
      subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
      cacheSubnetGroupName: `radiant-brain-redis-${environment}`,
    });

    this.redisCluster = new elasticache.CfnCacheCluster(this, 'BrainRedisCluster', {
      cacheNodeType: environment === 'prod' ? 'cache.r6g.large' : 'cache.t3.micro',
      engine: 'redis',
      numCacheNodes: 1,
      clusterName: `radiant-brain-${environment}`,
      vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId],
      cacheSubnetGroupName: redisSubnetGroup.cacheSubnetGroupName,
      port: 6379,
    });

    this.redisCluster.addDependency(redisSubnetGroup);

    // ===========================================================================
    // SQS Queues
    // ===========================================================================
    const dreamQueue = new sqs.Queue(this, 'DreamQueue', {
      queueName: `radiant-dream-queue-${environment}`,
      visibilityTimeout: cdk.Duration.minutes(15),
      retentionPeriod: cdk.Duration.days(7),
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'DreamDLQ', {
          queueName: `radiant-dream-dlq-${environment}`,
          retentionPeriod: cdk.Duration.days(14),
        }),
        maxReceiveCount: 3,
      },
    });

    const reanchorQueue = new sqs.Queue(this, 'ReanchorQueue', {
      queueName: `radiant-reanchor-queue-${environment}`,
      visibilityTimeout: cdk.Duration.minutes(5),
      retentionPeriod: cdk.Duration.days(1),
    });

    // ===========================================================================
    // Lambda Environment Variables
    // ===========================================================================
    const lambdaEnvironment: Record<string, string> = {
      ENVIRONMENT: environment,
      DB_CLUSTER_ARN: dbClusterArn,
      DB_SECRET_ARN: dbSecretArn,
      REDIS_ENDPOINT: this.redisCluster.attrRedisEndpointAddress,
      REDIS_PORT: this.redisCluster.attrRedisEndpointPort,
      REDIS_URL: `redis://${this.redisCluster.attrRedisEndpointAddress}:${this.redisCluster.attrRedisEndpointPort}`,
      DREAM_QUEUE_URL: dreamQueue.queueUrl,
      REANCHOR_QUEUE_URL: reanchorQueue.queueUrl,
      LOG_LEVEL: environment === 'prod' ? 'info' : 'debug',
      LITELLM_ENDPOINT: props.litellmUrl || 'http://localhost:4000',
      SYSTEM1_MODEL: 'llama3-8b-instruct',
      SYSTEM15_MODEL: 'llama3-8b-instruct',
      SYSTEM2_MODEL: 'llama3-70b-instruct',
    };

    // ===========================================================================
    // Brain Inference Lambda
    // ===========================================================================
    this.brainInferenceLambda = new lambda.Function(this, 'BrainInferenceLambda', {
      functionName: `radiant-brain-inference-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'brain/inference.handler',
      code: lambda.Code.fromAsset('lambda/dist'),
      memorySize: environment === 'prod' ? 2048 : 1024,
      timeout: cdk.Duration.seconds(30),
      vpc,
      securityGroups: [brainSecurityGroup],
      environment: lambdaEnvironment,
      tracing: lambda.Tracing.ACTIVE,
    });

    // Grant permissions
    this.brainInferenceLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'rds-data:ExecuteStatement',
        'rds-data:BatchExecuteStatement',
      ],
      resources: [dbClusterArn],
    }));

    this.brainInferenceLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [dbSecretArn],
    }));

    dreamQueue.grantSendMessages(this.brainInferenceLambda);
    reanchorQueue.grantSendMessages(this.brainInferenceLambda);

    // ===========================================================================
    // Reconciliation Lambda
    // ===========================================================================
    this.reconciliationLambda = new lambda.Function(this, 'ReconciliationLambda', {
      functionName: `radiant-brain-reconciliation-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'brain/reconciliation.handler',
      code: lambda.Code.fromAsset('lambda/dist'),
      memorySize: 1024,
      timeout: cdk.Duration.minutes(5),
      vpc,
      securityGroups: [brainSecurityGroup],
      environment: lambdaEnvironment,
      tracing: lambda.Tracing.ACTIVE,
    });

    // Grant permissions
    this.reconciliationLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'rds-data:ExecuteStatement',
        'rds-data:BatchExecuteStatement',
      ],
      resources: [dbClusterArn],
    }));

    this.reconciliationLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [dbSecretArn],
    }));

    dreamQueue.grantConsumeMessages(this.reconciliationLambda);

    // ===========================================================================
    // Scheduled Events
    // ===========================================================================
    // Run reconciliation every 15 minutes
    const reconciliationRule = new events.Rule(this, 'ReconciliationSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
      description: 'Trigger Brain reconciliation job every 15 minutes',
    });
    reconciliationRule.addTarget(new targets.LambdaFunction(this.reconciliationLambda));

    // ===========================================================================
    // API Gateway
    // ===========================================================================
    this.brainApi = new apigateway.RestApi(this, 'BrainApi', {
      restApiName: `radiant-brain-api-${environment}`,
      description: 'RADIANT AGI Brain API',
      deployOptions: {
        stageName: environment,
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'X-Tenant-Id'],
      },
    });

    // /brain resource
    const brainResource = this.brainApi.root.addResource('brain');

    // POST /brain/inference
    const inferenceResource = brainResource.addResource('inference');
    inferenceResource.addMethod('POST', new apigateway.LambdaIntegration(this.brainInferenceLambda, {
      timeout: cdk.Duration.seconds(29),
    }), {
      apiKeyRequired: true,
    });

    // POST /brain/reconciliation/trigger (manual trigger)
    const reconciliationResource = brainResource.addResource('reconciliation');
    reconciliationResource.addResource('trigger').addMethod('POST', 
      new apigateway.LambdaIntegration(this.reconciliationLambda), {
      apiKeyRequired: true,
    });

    // ===========================================================================
    // Outputs
    // ===========================================================================
    new cdk.CfnOutput(this, 'BrainApiUrl', {
      value: this.brainApi.url,
      description: 'Brain API URL',
      exportName: `radiant-brain-api-url-${environment}`,
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.redisCluster.attrRedisEndpointAddress,
      description: 'Redis cluster endpoint',
      exportName: `radiant-brain-redis-endpoint-${environment}`,
    });

    new cdk.CfnOutput(this, 'DreamQueueUrl', {
      value: dreamQueue.queueUrl,
      description: 'Dream queue URL',
      exportName: `radiant-dream-queue-url-${environment}`,
    });
  }
}
