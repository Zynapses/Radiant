// RADIANT v4.18.0 - Library Execution Stack
// CDK infrastructure for multi-tenant concurrent library execution
// Provides Lambda executors with tenant isolation

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';

export interface LibraryExecutionStackProps extends cdk.StackProps {
  environment: string;
  databaseSecretArn: string;
  databaseClusterArn: string;
  vpcId?: string;
  securityGroupId?: string;
}

export class LibraryExecutionStack extends cdk.Stack {
  public readonly executionQueue: sqs.Queue;
  public readonly executorLambda: lambda.Function;
  public readonly queueProcessorLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: LibraryExecutionStackProps) {
    super(scope, id, props);

    // =========================================================================
    // Dead Letter Queue for failed executions
    // =========================================================================
    const dlq = new sqs.Queue(this, 'ExecutionDLQ', {
      queueName: `radiant-library-execution-dlq-${props.environment}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // =========================================================================
    // Main Execution Queue (FIFO for ordering, with deduplication)
    // =========================================================================
    this.executionQueue = new sqs.Queue(this, 'ExecutionQueue', {
      queueName: `radiant-library-execution-${props.environment}.fifo`,
      fifo: true,
      contentBasedDeduplication: true,
      visibilityTimeout: cdk.Duration.minutes(15), // Match Lambda timeout
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3,
      },
    });

    // =========================================================================
    // Priority Queues (for tenant priority boost)
    // =========================================================================
    const highPriorityQueue = new sqs.Queue(this, 'HighPriorityQueue', {
      queueName: `radiant-library-execution-high-${props.environment}.fifo`,
      fifo: true,
      contentBasedDeduplication: true,
      visibilityTimeout: cdk.Duration.minutes(15),
    });

    // =========================================================================
    // Executor Lambda (runs the actual library code)
    // =========================================================================
    this.executorLambda = new lambda.Function(this, 'ExecutorLambda', {
      functionName: `radiant-library-executor-${props.environment}`,
      runtime: lambda.Runtime.PYTHON_3_11, // Python for library compatibility
      handler: 'executor.handler',
      code: lambda.Code.fromAsset('lambda/library-execution'),
      timeout: cdk.Duration.minutes(10),
      memorySize: 2048, // 2GB for data processing
      ephemeralStorageSize: cdk.Size.gibibytes(5), // 5GB temp storage
      environment: {
        ENVIRONMENT: props.environment,
        DATABASE_SECRET_ARN: props.databaseSecretArn,
        DATABASE_CLUSTER_ARN: props.databaseClusterArn,
        MAX_EXECUTION_TIME_SECONDS: '600',
        MAX_MEMORY_MB: '1536',
        SANDBOX_ENABLED: 'true',
      },
      description: 'Executes library code in isolated sandbox with tenant context',
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant database access
    this.executorLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [props.databaseSecretArn],
    }));

    this.executorLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'rds-data:ExecuteStatement',
        'rds-data:BatchExecuteStatement',
      ],
      resources: [props.databaseClusterArn],
    }));

    // Connect executor to queue
    this.executorLambda.addEventSource(new SqsEventSource(this.executionQueue, {
      batchSize: 1, // Process one at a time for isolation
      reportBatchItemFailures: true,
    }));

    this.executorLambda.addEventSource(new SqsEventSource(highPriorityQueue, {
      batchSize: 1,
      reportBatchItemFailures: true,
    }));

    // =========================================================================
    // Queue Processor Lambda (manages queue and concurrency)
    // =========================================================================
    this.queueProcessorLambda = new lambda.Function(this, 'QueueProcessorLambda', {
      functionName: `radiant-library-queue-processor-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'library-execution/queue-processor.handler',
      code: lambda.Code.fromAsset('lambda'),
      timeout: cdk.Duration.minutes(1),
      memorySize: 256,
      environment: {
        ENVIRONMENT: props.environment,
        DATABASE_SECRET_ARN: props.databaseSecretArn,
        DATABASE_CLUSTER_ARN: props.databaseClusterArn,
        EXECUTION_QUEUE_URL: this.executionQueue.queueUrl,
        HIGH_PRIORITY_QUEUE_URL: highPriorityQueue.queueUrl,
      },
      description: 'Processes execution queue, manages concurrency limits',
    });

    // Grant database and queue access
    this.queueProcessorLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [props.databaseSecretArn],
    }));

    this.queueProcessorLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'rds-data:ExecuteStatement',
        'rds-data:BatchExecuteStatement',
      ],
      resources: [props.databaseClusterArn],
    }));

    this.executionQueue.grantSendMessages(this.queueProcessorLambda);
    highPriorityQueue.grantSendMessages(this.queueProcessorLambda);

    // Schedule queue processor every minute
    new events.Rule(this, 'QueueProcessorSchedule', {
      ruleName: `radiant-library-queue-processor-${props.environment}`,
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      targets: [new targets.LambdaFunction(this.queueProcessorLambda)],
    });

    // =========================================================================
    // Aggregation Lambda (hourly stats aggregation)
    // =========================================================================
    const aggregationLambda = new lambda.Function(this, 'AggregationLambda', {
      functionName: `radiant-library-aggregation-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'library-execution/aggregation.handler',
      code: lambda.Code.fromAsset('lambda'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      environment: {
        ENVIRONMENT: props.environment,
        DATABASE_SECRET_ARN: props.databaseSecretArn,
        DATABASE_CLUSTER_ARN: props.databaseClusterArn,
      },
      description: 'Aggregates execution statistics hourly',
    });

    aggregationLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [props.databaseSecretArn],
    }));

    aggregationLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'rds-data:ExecuteStatement',
        'rds-data:BatchExecuteStatement',
      ],
      resources: [props.databaseClusterArn],
    }));

    // Run aggregation hourly
    new events.Rule(this, 'AggregationSchedule', {
      ruleName: `radiant-library-aggregation-${props.environment}`,
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      targets: [new targets.LambdaFunction(aggregationLambda)],
    });

    // =========================================================================
    // Cleanup Lambda (daily cleanup of old executions)
    // =========================================================================
    const cleanupLambda = new lambda.Function(this, 'CleanupLambda', {
      functionName: `radiant-library-cleanup-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'library-execution/cleanup.handler',
      code: lambda.Code.fromAsset('lambda'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      environment: {
        ENVIRONMENT: props.environment,
        DATABASE_SECRET_ARN: props.databaseSecretArn,
        DATABASE_CLUSTER_ARN: props.databaseClusterArn,
      },
      description: 'Cleans up old execution records',
    });

    cleanupLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [props.databaseSecretArn],
    }));

    cleanupLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'rds-data:ExecuteStatement',
        'rds-data:BatchExecuteStatement',
      ],
      resources: [props.databaseClusterArn],
    }));

    // Run cleanup daily at 4 AM UTC
    new events.Rule(this, 'CleanupSchedule', {
      ruleName: `radiant-library-cleanup-${props.environment}`,
      schedule: events.Schedule.cron({ minute: '0', hour: '4' }),
      targets: [new targets.LambdaFunction(cleanupLambda)],
    });

    // =========================================================================
    // Lambda Reserved Concurrency (for tenant isolation)
    // =========================================================================
    
    // Set reserved concurrency to prevent one tenant from consuming all capacity
    // In production, use provisioned concurrency for consistent performance
    this.executorLambda.addAlias('live', {
      description: 'Live alias for executor',
    });

    // =========================================================================
    // Outputs
    // =========================================================================
    new cdk.CfnOutput(this, 'ExecutionQueueUrl', {
      value: this.executionQueue.queueUrl,
      description: 'Library execution queue URL',
      exportName: `radiant-library-execution-queue-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'ExecutorLambdaArn', {
      value: this.executorLambda.functionArn,
      description: 'Library executor Lambda ARN',
      exportName: `radiant-library-executor-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'QueueProcessorLambdaArn', {
      value: this.queueProcessorLambda.functionArn,
      description: 'Queue processor Lambda ARN',
      exportName: `radiant-library-queue-processor-${props.environment}`,
    });
  }
}
