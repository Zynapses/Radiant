/**
 * RADIANT v5.43.0 - DIA Engine Infrastructure Stack
 * 
 * CDK stack for Decision Intelligence Artifacts resources:
 * - S3 bucket for compliance exports
 * - SQS queue for async artifact extraction
 */

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';

interface DIAStackProps extends cdk.StackProps {
  appId: string;
  environment: string;
  tier: number;
  isProd: boolean;
}

export class DIAStack extends cdk.Stack {
  public readonly exportBucket: s3.Bucket;
  public readonly extractionQueue: sqs.Queue;
  public readonly extractionDLQ: sqs.Queue;

  constructor(scope: Construct, id: string, props: DIAStackProps) {
    super(scope, id, props);

    const { appId, environment, tier, isProd } = props;

    // =========================================================================
    // S3 Bucket for Compliance Exports
    // =========================================================================

    this.exportBucket = new s3.Bucket(this, 'DIAExportBucket', {
      bucketName: `${appId}-${environment}-dia-exports-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: tier >= 2,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
      
      // HIPAA/SOC2 compliance: server access logging
      serverAccessLogsPrefix: 'access-logs/',
      
      // Lifecycle rules for cost management
      lifecycleRules: [
        {
          id: 'expire-exports',
          enabled: true,
          expiration: cdk.Duration.days(90),
          prefix: 'exports/',
        },
        {
          id: 'expire-temp',
          enabled: true,
          expiration: cdk.Duration.days(1),
          prefix: 'temp/',
        },
        {
          id: 'transition-to-glacier',
          enabled: tier >= 3,
          transitions: tier >= 3 ? [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(30),
            },
          ] : undefined,
          prefix: 'archives/',
        },
      ],
      
      // CORS for presigned URL access
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedOrigins: ['*'], // Restrict in production
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
    });

    // =========================================================================
    // SQS Queue for Async Artifact Extraction
    // =========================================================================

    // Dead letter queue for failed extractions
    this.extractionDLQ = new sqs.Queue(this, 'DIAExtractionDLQ', {
      queueName: `${appId}-${environment}-dia-extraction-dlq`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    // Main extraction queue
    this.extractionQueue = new sqs.Queue(this, 'DIAExtractionQueue', {
      queueName: `${appId}-${environment}-dia-extraction`,
      visibilityTimeout: cdk.Duration.minutes(15), // Allow time for LLM extraction
      retentionPeriod: cdk.Duration.days(4),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: {
        queue: this.extractionDLQ,
        maxReceiveCount: 3,
      },
    });

    // =========================================================================
    // Outputs
    // =========================================================================

    new cdk.CfnOutput(this, 'DIAExportBucketName', {
      value: this.exportBucket.bucketName,
      description: 'DIA Engine export bucket name',
      exportName: `${appId}-${environment}-dia-export-bucket`,
    });

    new cdk.CfnOutput(this, 'DIAExportBucketArn', {
      value: this.exportBucket.bucketArn,
      description: 'DIA Engine export bucket ARN',
      exportName: `${appId}-${environment}-dia-export-bucket-arn`,
    });

    new cdk.CfnOutput(this, 'DIAExtractionQueueUrl', {
      value: this.extractionQueue.queueUrl,
      description: 'DIA Engine extraction queue URL',
      exportName: `${appId}-${environment}-dia-extraction-queue-url`,
    });

    new cdk.CfnOutput(this, 'DIAExtractionQueueArn', {
      value: this.extractionQueue.queueArn,
      description: 'DIA Engine extraction queue ARN',
      exportName: `${appId}-${environment}-dia-extraction-queue-arn`,
    });

    // =========================================================================
    // Tags
    // =========================================================================

    cdk.Tags.of(this).add('Component', 'DIA-Engine');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('AppId', appId);
  }

  /**
   * Grant permissions for a Lambda to use DIA resources
   */
  public grantDIAAccess(lambdaFunction: lambda.IFunction): void {
    // S3 permissions
    this.exportBucket.grantReadWrite(lambdaFunction);
    
    // SQS permissions
    this.extractionQueue.grantSendMessages(lambdaFunction);
    this.extractionQueue.grantConsumeMessages(lambdaFunction);
  }

  /**
   * Add Lambda as extraction queue consumer
   */
  public addExtractionConsumer(lambdaFunction: lambda.Function): void {
    lambdaFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(this.extractionQueue, {
        batchSize: 1, // Process one at a time for LLM calls
        maxConcurrency: 5, // Limit concurrent extractions
        reportBatchItemFailures: true,
      })
    );
  }
}
