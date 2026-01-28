import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface AsyncWriteConstructProps {
  vpc: ec2.IVpc;
  tier: number;
  environment: string;
  appId: string;
  encryptionKey: cdk.aws_kms.IKey;
  databaseSecurityGroup: ec2.ISecurityGroup;
  rdsProxyEndpoint: string;
  databaseSecretArn: string;
  redisEndpoint: string;
}

/**
 * Async Write Construct
 * 
 * Eliminates the parallel-write bottleneck for AI model execution.
 * Instead of 6+ simultaneous DB writes per request, writes go to SQS
 * and are batched for efficient bulk inserts.
 * 
 * Architecture:
 * User Request → Lambda → 6 AI Models (parallel) → SQS Queue → Batch Writer → PostgreSQL
 *                    ↓
 *              Immediate Response (results cached in Redis for read-after-write)
 * 
 * Benefits:
 * - Eliminates connection exhaustion during traffic spikes
 * - Batches writes for 10-50x efficiency improvement
 * - Provides retry/DLQ for transient failures
 * - Decouples request latency from database write latency
 */
export class AsyncWriteConstruct extends Construct {
  public readonly modelResultsQueue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly batchWriterFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: AsyncWriteConstructProps) {
    super(scope, id);

    const { vpc, tier, environment, appId, encryptionKey, databaseSecurityGroup, rdsProxyEndpoint, databaseSecretArn, redisEndpoint } = props;

    // Dead letter queue for failed writes
    // Retain for 14 days to allow investigation/reprocessing
    this.deadLetterQueue = new sqs.Queue(this, 'ModelResultsDLQ', {
      queueName: `${appId}-${environment}-model-results-dlq`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: encryptionKey,
    });

    // Main queue for AI model execution results
    this.modelResultsQueue = new sqs.Queue(this, 'ModelResultsQueue', {
      queueName: `${appId}-${environment}-model-results`,
      // Visibility timeout must exceed Lambda timeout
      visibilityTimeout: cdk.Duration.seconds(90),
      // Retry up to 3 times before sending to DLQ
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3,
      },
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: encryptionKey,
      // Enable long polling for cost efficiency
      receiveMessageWaitTime: cdk.Duration.seconds(20),
    });

    // Batch writer Lambda - processes up to 100 messages per invocation
    this.batchWriterFunction = new lambda.Function(this, 'BatchWriter', {
      functionName: `${appId}-${environment}-batch-writer`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'batch-writer.handler',
      code: lambda.Code.fromAsset('lambda/scaling'),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [databaseSecurityGroup],
      timeout: cdk.Duration.seconds(60),
      memorySize: this.getBatchWriterMemory(tier),
      environment: {
        RDS_PROXY_ENDPOINT: rdsProxyEndpoint,
        DB_SECRET_ARN: databaseSecretArn,
        REDIS_ENDPOINT: redisEndpoint,
        NODE_ENV: environment,
      },
      // Limit concurrent writers to prevent connection exhaustion
      // Even with RDS Proxy, we want controlled concurrency
      reservedConcurrentExecutions: this.getBatchWriterConcurrency(tier),
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Grant permissions to read database secret
    this.batchWriterFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [databaseSecretArn],
    }));
    
    // RDS Proxy connect permission
    this.batchWriterFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['rds-db:connect'],
      resources: ['*'], // Proxy ARN pattern is complex, use * with VPC isolation
    }));

    // SQS event source - batch processing
    this.batchWriterFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(this.modelResultsQueue, {
        // Process up to 100 model results per invocation
        batchSize: this.getBatchSize(tier),
        // Wait up to 5 seconds to accumulate a batch
        maxBatchingWindow: cdk.Duration.seconds(5),
        // Report individual failures for partial retry
        reportBatchItemFailures: true,
      })
    );

    // Outputs
    new cdk.CfnOutput(this, 'ModelResultsQueueUrl', {
      value: this.modelResultsQueue.queueUrl,
      description: 'SQS queue URL for async model result writes',
    });

    new cdk.CfnOutput(this, 'ModelResultsQueueArn', {
      value: this.modelResultsQueue.queueArn,
      description: 'SQS queue ARN for async model result writes',
    });

    new cdk.CfnOutput(this, 'DeadLetterQueueUrl', {
      value: this.deadLetterQueue.queueUrl,
      description: 'DLQ URL for failed writes',
    });
  }

  /**
   * Grant a Lambda function permission to send messages to the queue
   */
  public grantSendMessages(grantee: iam.IGrantable): void {
    this.modelResultsQueue.grantSendMessages(grantee);
  }

  private getBatchWriterMemory(tier: number): number {
    switch (tier) {
      case 1: return 256;
      case 2: return 512;
      case 3: return 512;
      case 4: return 1024;
      case 5: return 1024;
      default: return 512;
    }
  }

  private getBatchWriterConcurrency(tier: number): number {
    // Limit concurrent batch writers to prevent connection exhaustion
    switch (tier) {
      case 1: return 5;
      case 2: return 10;
      case 3: return 20;
      case 4: return 50;
      case 5: return 100;
      default: return 10;
    }
  }

  private getBatchSize(tier: number): number {
    // Larger batches for higher tiers
    switch (tier) {
      case 1: return 25;
      case 2: return 50;
      case 3: return 100;
      case 4: return 100;
      case 5: return 100;
      default: return 50;
    }
  }
}
