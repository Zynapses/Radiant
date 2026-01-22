/**
 * RADIANT v5.0 - Sovereign Mesh CDK Stack
 * 
 * Infrastructure for the Sovereign Mesh architecture including:
 * - Agent Execution Worker (SQS-triggered)
 * - Transparency Compiler (SQS-triggered)
 * - App Health Check (Scheduled)
 * - App Registry Sync (Scheduled)
 * - HITL SLA Monitor (Scheduled)
 * - Admin API Lambda
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import * as path from 'path';

export interface SovereignMeshStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'prod';
  vpcId?: string;
  databaseSecretArn: string;
  databaseClusterArn: string;
  sesFromEmail?: string;
  adminDashboardUrl?: string;
}

export class SovereignMeshStack extends cdk.Stack {
  public readonly agentExecutionQueue: sqs.Queue;
  public readonly transparencyQueue: sqs.Queue;
  public readonly adminApi: lambda.Function;

  constructor(scope: Construct, id: string, props: SovereignMeshStackProps) {
    super(scope, id, props);

    const { environment, databaseSecretArn, databaseClusterArn, sesFromEmail, adminDashboardUrl } = props;

    // Common environment variables for all lambdas
    const commonEnv = {
      NODE_ENV: environment,
      DATABASE_SECRET_ARN: databaseSecretArn,
      DATABASE_CLUSTER_ARN: databaseClusterArn,
      SES_ENABLED: environment === 'prod' ? 'true' : 'false',
      SES_FROM_EMAIL: sesFromEmail || 'noreply@radiant.ai',
      ADMIN_DASHBOARD_URL: adminDashboardUrl || 'https://admin.radiant.ai',
    };

    // =========================================================================
    // SQS Queues
    // =========================================================================

    // Agent Execution Queue
    const agentExecutionDLQ = new sqs.Queue(this, 'AgentExecutionDLQ', {
      queueName: `radiant-agent-execution-dlq-${environment}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    this.agentExecutionQueue = new sqs.Queue(this, 'AgentExecutionQueue', {
      queueName: `radiant-agent-execution-${environment}`,
      visibilityTimeout: cdk.Duration.minutes(15),
      retentionPeriod: cdk.Duration.days(7),
      deadLetterQueue: {
        queue: agentExecutionDLQ,
        maxReceiveCount: 3,
      },
    });

    // Transparency Compiler Queue
    const transparencyDLQ = new sqs.Queue(this, 'TransparencyDLQ', {
      queueName: `radiant-transparency-dlq-${environment}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    this.transparencyQueue = new sqs.Queue(this, 'TransparencyQueue', {
      queueName: `radiant-transparency-${environment}`,
      visibilityTimeout: cdk.Duration.minutes(5),
      retentionPeriod: cdk.Duration.days(7),
      deadLetterQueue: {
        queue: transparencyDLQ,
        maxReceiveCount: 3,
      },
    });

    // =========================================================================
    // Lambda Functions
    // =========================================================================

    // Shared Lambda configuration
    const lambdaDefaults = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        ...commonEnv,
        AGENT_EXECUTION_QUEUE_URL: this.agentExecutionQueue.queueUrl,
        TRANSPARENCY_QUEUE_URL: this.transparencyQueue.queueUrl,
      },
    };

    // Agent Execution Worker - Optimized for scale
    const agentExecutionWorker = new lambda.Function(this, 'AgentExecutionWorker', {
      ...lambdaDefaults,
      functionName: `radiant-agent-execution-worker-${environment}`,
      handler: 'agent-execution-worker.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/workers')),
      timeout: cdk.Duration.minutes(15),
      memorySize: 2048, // Increased for complex OODA loops
      reservedConcurrentExecutions: environment === 'prod' ? 100 : undefined,
    });

    // Add provisioned concurrency for production
    if (environment === 'prod') {
      const version = agentExecutionWorker.currentVersion;
      new lambda.Alias(this, 'AgentExecutionWorkerAlias', {
        aliasName: 'live',
        version,
        provisionedConcurrentExecutions: 5,
      });
    }

    agentExecutionWorker.addEventSource(
      new SqsEventSource(this.agentExecutionQueue, {
        batchSize: 1, // Keep at 1 for OODA atomicity
        maxConcurrency: 50, // Increased from 10 for better throughput
      })
    );

    // Transparency Compiler
    const transparencyCompiler = new lambda.Function(this, 'TransparencyCompiler', {
      ...lambdaDefaults,
      functionName: `radiant-transparency-compiler-${environment}`,
      handler: 'transparency-compiler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/workers')),
    });

    transparencyCompiler.addEventSource(
      new SqsEventSource(this.transparencyQueue, {
        batchSize: 5,
        maxConcurrency: 5,
      })
    );

    // App Health Check (Hourly)
    const appHealthCheck = new lambda.Function(this, 'AppHealthCheck', {
      ...lambdaDefaults,
      functionName: `radiant-app-health-check-${environment}`,
      handler: 'app-health-check.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/scheduled')),
      timeout: cdk.Duration.minutes(10),
    });

    new events.Rule(this, 'AppHealthCheckSchedule', {
      ruleName: `radiant-app-health-check-${environment}`,
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      targets: [new targets.LambdaFunction(appHealthCheck)],
    });

    // App Registry Sync (Daily at 2 AM UTC)
    const appRegistrySync = new lambda.Function(this, 'AppRegistrySync', {
      ...lambdaDefaults,
      functionName: `radiant-app-registry-sync-${environment}`,
      handler: 'app-registry-sync.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/scheduled')),
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
    });

    new events.Rule(this, 'AppRegistrySyncSchedule', {
      ruleName: `radiant-app-registry-sync-${environment}`,
      schedule: events.Schedule.cron({ hour: '2', minute: '0' }),
      targets: [new targets.LambdaFunction(appRegistrySync)],
    });

    // HITL SLA Monitor (Every minute)
    const hitlSlaMonitor = new lambda.Function(this, 'HITLSLAMonitor', {
      ...lambdaDefaults,
      functionName: `radiant-hitl-sla-monitor-${environment}`,
      handler: 'hitl-sla-monitor.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/scheduled')),
      timeout: cdk.Duration.minutes(2),
    });

    new events.Rule(this, 'HITLSLAMonitorSchedule', {
      ruleName: `radiant-hitl-sla-monitor-${environment}`,
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      targets: [new targets.LambdaFunction(hitlSlaMonitor)],
    });

    // Sovereign Mesh Admin API
    this.adminApi = new lambda.Function(this, 'SovereignMeshAdmin', {
      ...lambdaDefaults,
      functionName: `radiant-sovereign-mesh-admin-${environment}`,
      handler: 'sovereign-mesh.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/admin')),
      timeout: cdk.Duration.seconds(30),
    });

    // =========================================================================
    // IAM Permissions
    // =========================================================================

    // Database access for all lambdas
    const dbPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'rds-data:ExecuteStatement',
        'rds-data:BatchExecuteStatement',
        'rds-data:BeginTransaction',
        'rds-data:CommitTransaction',
        'rds-data:RollbackTransaction',
      ],
      resources: [databaseClusterArn],
    });

    const secretsPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [databaseSecretArn],
    });

    // SES access for notification service
    const sesPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    });

    // Apply policies to all lambdas
    const allLambdas = [
      agentExecutionWorker,
      transparencyCompiler,
      appHealthCheck,
      appRegistrySync,
      hitlSlaMonitor,
      this.adminApi,
    ];

    allLambdas.forEach(fn => {
      fn.addToRolePolicy(dbPolicy);
      fn.addToRolePolicy(secretsPolicy);
    });

    // SES access only for lambdas that send notifications
    hitlSlaMonitor.addToRolePolicy(sesPolicy);
    this.adminApi.addToRolePolicy(sesPolicy);

    // Queue permissions
    this.agentExecutionQueue.grantSendMessages(this.adminApi);
    this.transparencyQueue.grantSendMessages(this.adminApi);
    this.agentExecutionQueue.grantSendMessages(agentExecutionWorker);

    // =========================================================================
    // Outputs
    // =========================================================================

    new cdk.CfnOutput(this, 'AgentExecutionQueueUrl', {
      value: this.agentExecutionQueue.queueUrl,
      description: 'Agent Execution SQS Queue URL',
      exportName: `radiant-agent-execution-queue-${environment}`,
    });

    new cdk.CfnOutput(this, 'TransparencyQueueUrl', {
      value: this.transparencyQueue.queueUrl,
      description: 'Transparency Compiler SQS Queue URL',
      exportName: `radiant-transparency-queue-${environment}`,
    });

    new cdk.CfnOutput(this, 'AdminApiFunctionArn', {
      value: this.adminApi.functionArn,
      description: 'Sovereign Mesh Admin API Lambda ARN',
      exportName: `radiant-sovereign-mesh-admin-${environment}`,
    });
  }
}
