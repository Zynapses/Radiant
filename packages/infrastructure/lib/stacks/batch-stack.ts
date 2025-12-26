import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

interface BatchStackProps extends cdk.StackProps {
  appId: string;
  environment: string;
}

/**
 * Batch Processing Stack
 * 
 * Enables batch processing of AI requests for:
 * - Bulk data processing
 * - Embedding generation
 * - Content moderation
 * - Translation jobs
 */
export class BatchStack extends cdk.Stack {
  public readonly jobsTable: dynamodb.Table;
  public readonly inputBucket: s3.Bucket;
  public readonly outputBucket: s3.Bucket;
  public readonly processingQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: BatchStackProps) {
    super(scope, id, props);

    const { appId, environment } = props;

    // Jobs tracking table
    this.jobsTable = new dynamodb.Table(this, 'JobsTable', {
      tableName: `${appId}-${environment}-batch-jobs`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      timeToLiveAttribute: 'ttl',
    });

    // GSI for tenant queries
    this.jobsTable.addGlobalSecondaryIndex({
      indexName: 'by-tenant-status',
      partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
    });

    // Input bucket for batch files
    this.inputBucket = new s3.Bucket(this, 'InputBucket', {
      bucketName: `${appId}-${environment}-batch-input`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        { expiration: cdk.Duration.days(7) }, // Auto-delete after 7 days
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    // Output bucket for results
    this.outputBucket = new s3.Bucket(this, 'OutputBucket', {
      bucketName: `${appId}-${environment}-batch-output`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        { expiration: cdk.Duration.days(30) }, // Keep results for 30 days
      ],
    });

    // Dead letter queue
    const dlq = new sqs.Queue(this, 'DeadLetterQueue', {
      queueName: `${appId}-${environment}-batch-dlq`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // Processing queue
    this.processingQueue = new sqs.Queue(this, 'ProcessingQueue', {
      queueName: `${appId}-${environment}-batch-processing`,
      visibilityTimeout: cdk.Duration.minutes(15),
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3,
      },
    });

    // Batch processor Lambda
    const processorLambda = new lambda.Function(this, 'ProcessorLambda', {
      functionName: `${appId}-${environment}-batch-processor`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/batch'),
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: {
        JOBS_TABLE: this.jobsTable.tableName,
        INPUT_BUCKET: this.inputBucket.bucketName,
        OUTPUT_BUCKET: this.outputBucket.bucketName,
      },
    });

    // Grant permissions
    this.jobsTable.grantReadWriteData(processorLambda);
    this.inputBucket.grantRead(processorLambda);
    this.outputBucket.grantWrite(processorLambda);
    this.processingQueue.grantConsumeMessages(processorLambda);

    // SQS trigger
    processorLambda.addEventSourceMapping('SQSTrigger', {
      eventSourceArn: this.processingQueue.queueArn,
      batchSize: 1,
    });

    // Job orchestrator Lambda
    const orchestratorLambda = new lambda.Function(this, 'OrchestratorLambda', {
      functionName: `${appId}-${environment}-batch-orchestrator`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/batch-orchestrator'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        JOBS_TABLE: this.jobsTable.tableName,
        PROCESSING_QUEUE_URL: this.processingQueue.queueUrl,
        INPUT_BUCKET: this.inputBucket.bucketName,
      },
    });

    this.jobsTable.grantReadWriteData(orchestratorLambda);
    this.inputBucket.grantRead(orchestratorLambda);
    this.processingQueue.grantSendMessages(orchestratorLambda);

    // Step Functions state machine for complex batch workflows
    const startState = new stepfunctions.Pass(this, 'StartBatch', {
      result: stepfunctions.Result.fromObject({ status: 'started' }),
    });

    const validateInput = new tasks.LambdaInvoke(this, 'ValidateInput', {
      lambdaFunction: orchestratorLambda,
      payload: stepfunctions.TaskInput.fromObject({
        action: 'validate',
        'jobId.$': '$.jobId',
      }),
    });

    const splitJob = new tasks.LambdaInvoke(this, 'SplitJob', {
      lambdaFunction: orchestratorLambda,
      payload: stepfunctions.TaskInput.fromObject({
        action: 'split',
        'jobId.$': '$.jobId',
      }),
    });

    const processChunks = new stepfunctions.Map(this, 'ProcessChunks', {
      maxConcurrency: 10,
      itemsPath: '$.Payload.chunks',
    });

    const processChunk = new tasks.SqsSendMessage(this, 'QueueChunk', {
      queue: this.processingQueue,
      messageBody: stepfunctions.TaskInput.fromJsonPathAt('$'),
    });

    processChunks.iterator(processChunk);

    const waitForCompletion = new stepfunctions.Wait(this, 'WaitForCompletion', {
      time: stepfunctions.WaitTime.duration(cdk.Duration.seconds(30)),
    });

    const checkCompletion = new tasks.LambdaInvoke(this, 'CheckCompletion', {
      lambdaFunction: orchestratorLambda,
      payload: stepfunctions.TaskInput.fromObject({
        action: 'check',
        'jobId.$': '$.jobId',
      }),
    });

    const isComplete = new stepfunctions.Choice(this, 'IsComplete');

    const aggregateResults = new tasks.LambdaInvoke(this, 'AggregateResults', {
      lambdaFunction: orchestratorLambda,
      payload: stepfunctions.TaskInput.fromObject({
        action: 'aggregate',
        'jobId.$': '$.jobId',
      }),
    });

    const endState = new stepfunctions.Succeed(this, 'BatchComplete');

    const failState = new stepfunctions.Fail(this, 'BatchFailed', {
      error: 'BatchProcessingFailed',
      cause: 'Batch processing encountered an error',
    });

    // Define state machine flow
    const definition = startState
      .next(validateInput)
      .next(splitJob)
      .next(processChunks)
      .next(waitForCompletion)
      .next(checkCompletion)
      .next(
        isComplete
          .when(
            stepfunctions.Condition.stringEquals('$.Payload.status', 'complete'),
            aggregateResults.next(endState)
          )
          .when(
            stepfunctions.Condition.stringEquals('$.Payload.status', 'failed'),
            failState
          )
          .otherwise(waitForCompletion)
      );

    new stepfunctions.StateMachine(this, 'BatchStateMachine', {
      stateMachineName: `${appId}-${environment}-batch-workflow`,
      definition,
      timeout: cdk.Duration.hours(24),
    });

    // Outputs
    new cdk.CfnOutput(this, 'InputBucketName', {
      value: this.inputBucket.bucketName,
      description: 'Batch input S3 bucket',
    });

    new cdk.CfnOutput(this, 'OutputBucketName', {
      value: this.outputBucket.bucketName,
      description: 'Batch output S3 bucket',
    });

    new cdk.CfnOutput(this, 'JobsTableName', {
      value: this.jobsTable.tableName,
      description: 'Batch jobs DynamoDB table',
    });
  }
}

/**
 * Batch Job Types
 * 
 * embeddings - Generate embeddings for documents
 * completions - Batch chat completions
 * moderation - Content moderation at scale
 * translation - Batch translation
 * extraction - Data extraction from documents
 * classification - Batch text classification
 */
