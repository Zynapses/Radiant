import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import * as path from 'path';

interface ConsciousnessStackProps extends cdk.StackProps {
  appId: string;
  environment: string;
  apiGateway: apigateway.RestApi;
  lambdaLayer: lambda.LayerVersion;
  dbClusterArn: string;
  dbSecretArn: string;
  databaseName: string;
}

/**
 * Consciousness Engine Stack
 * 
 * Deploys the consciousness engine infrastructure:
 * - MCP Server Lambda (Model Context Protocol)
 * - Sleep Cycle Lambda (weekly evolution)
 * - Deep Research Lambda (browser automation)
 * - Thinking Session Lambda (async processing)
 * - Budget Monitor Lambda (cost control)
 * - Admin API endpoints
 */
export class ConsciousnessStack extends cdk.Stack {
  public readonly mcpServerLambda: lambda.Function;
  public readonly sleepCycleLambda: lambda.Function;
  public readonly deepResearchLambda: lambda.Function;
  public readonly thinkingSessionLambda: lambda.Function;
  public readonly adminApiLambda: lambda.Function;
  public readonly consciousnessExecutorLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: ConsciousnessStackProps) {
    super(scope, id, props);

    const { appId, environment, apiGateway, lambdaLayer, dbClusterArn, dbSecretArn, databaseName } = props;

    // =========================================================================
    // Secrets
    // =========================================================================
    const apiSecrets = secretsmanager.Secret.fromSecretNameV2(
      this, 'ApiSecrets', `${appId}/${environment}/api-keys`
    );

    // =========================================================================
    // SQS Queues for Async Processing
    // =========================================================================
    
    // Thinking session queue
    const thinkingSessionQueue = new sqs.Queue(this, 'ThinkingSessionQueue', {
      queueName: `${appId}-${environment}-thinking-sessions`,
      visibilityTimeout: cdk.Duration.minutes(15),
      retentionPeriod: cdk.Duration.days(7),
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'ThinkingSessionDLQ', {
          queueName: `${appId}-${environment}-thinking-sessions-dlq`,
          retentionPeriod: cdk.Duration.days(14),
        }),
        maxReceiveCount: 3,
      },
    });

    // Deep research queue
    const deepResearchQueue = new sqs.Queue(this, 'DeepResearchQueue', {
      queueName: `${appId}-${environment}-deep-research`,
      visibilityTimeout: cdk.Duration.minutes(30),
      retentionPeriod: cdk.Duration.days(7),
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'DeepResearchDLQ', {
          queueName: `${appId}-${environment}-deep-research-dlq`,
          retentionPeriod: cdk.Duration.days(14),
        }),
        maxReceiveCount: 2,
      },
    });

    // =========================================================================
    // Common Lambda Environment
    // =========================================================================
    const commonEnv = {
      NODE_OPTIONS: '--enable-source-maps',
      ENVIRONMENT: environment,
      DB_CLUSTER_ARN: dbClusterArn,
      DB_SECRET_ARN: dbSecretArn,
      DATABASE_NAME: databaseName,
      THINKING_SESSION_QUEUE_URL: thinkingSessionQueue.queueUrl,
      DEEP_RESEARCH_QUEUE_URL: deepResearchQueue.queueUrl,
    };

    // =========================================================================
    // Consciousness Executor Lambda (Python - 16 Libraries)
    // =========================================================================
    this.consciousnessExecutorLambda = new lambda.Function(this, 'ConsciousnessExecutor', {
      functionName: `${appId}-${environment}-consciousness-executor`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/consciousness-executor'), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_11.bundlingImage,
          command: [
            'bash', '-c',
            'pip install -r requirements.txt -t /asset-output && cp -r . /asset-output',
          ],
        },
      }),
      timeout: cdk.Duration.minutes(5),
      memorySize: 4096,
      environment: {
        ENVIRONMENT: environment,
      },
    });

    // Grant DB access to executor
    this.consciousnessExecutorLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-data:ExecuteStatement', 'rds-data:BatchExecuteStatement'],
      resources: [dbClusterArn],
    }));
    this.consciousnessExecutorLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [dbSecretArn],
    }));

    // =========================================================================
    // MCP Server Lambda (Model Context Protocol)
    // =========================================================================
    this.mcpServerLambda = new lambda.Function(this, 'MCPServer', {
      functionName: `${appId}-${environment}-consciousness-mcp`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'consciousness/mcp-server.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      layers: [lambdaLayer],
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
      environment: {
        ...commonEnv,
        CONSCIOUSNESS_EXECUTOR_ARN: this.consciousnessExecutorLambda.functionArn,
      },
    });

    // Grant MCP server permission to invoke executor
    this.consciousnessExecutorLambda.grantInvoke(this.mcpServerLambda);

    // Grant DB access
    this.mcpServerLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-data:ExecuteStatement', 'rds-data:BatchExecuteStatement'],
      resources: [dbClusterArn],
    }));
    this.mcpServerLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [dbSecretArn],
    }));
    apiSecrets.grantRead(this.mcpServerLambda);

    // =========================================================================
    // Sleep Cycle Lambda (Weekly Evolution)
    // =========================================================================
    this.sleepCycleLambda = new lambda.Function(this, 'SleepCycle', {
      functionName: `${appId}-${environment}-consciousness-sleep`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'consciousness/sleep-cycle.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      layers: [lambdaLayer],
      timeout: cdk.Duration.minutes(15),
      memorySize: 2048,
      environment: {
        ...commonEnv,
        CONSCIOUSNESS_EXECUTOR_ARN: this.consciousnessExecutorLambda.functionArn,
      },
    });

    // Grant sleep cycle permission to invoke executor
    this.consciousnessExecutorLambda.grantInvoke(this.sleepCycleLambda);

    // Grant DB access
    this.sleepCycleLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-data:ExecuteStatement', 'rds-data:BatchExecuteStatement'],
      resources: [dbClusterArn],
    }));
    this.sleepCycleLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [dbSecretArn],
    }));
    apiSecrets.grantRead(this.sleepCycleLambda);

    // Schedule: Nightly at 3 AM UTC (historically lowest traffic time)
    // Sleep schedule hour is configurable via admin settings (consciousness_parameters.sleep_schedule_hour)
    new events.Rule(this, 'SleepCycleSchedule', {
      ruleName: `${appId}-${environment}-consciousness-sleep`,
      schedule: events.Schedule.cron({ minute: '0', hour: '3' }), // Daily at 3 AM UTC
      targets: [new targets.LambdaFunction(this.sleepCycleLambda)],
    });

    // =========================================================================
    // Deep Research Lambda (Browser Automation)
    // =========================================================================
    this.deepResearchLambda = new lambda.Function(this, 'DeepResearch', {
      functionName: `${appId}-${environment}-consciousness-research`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'consciousness/deep-research.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      layers: [lambdaLayer],
      timeout: cdk.Duration.minutes(15),
      memorySize: 3008, // More memory for browser automation
      environment: {
        ...commonEnv,
      },
    });

    // Grant DB access
    this.deepResearchLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-data:ExecuteStatement', 'rds-data:BatchExecuteStatement'],
      resources: [dbClusterArn],
    }));
    this.deepResearchLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [dbSecretArn],
    }));
    apiSecrets.grantRead(this.deepResearchLambda);

    // Trigger from SQS
    this.deepResearchLambda.addEventSource(new lambdaEventSources.SqsEventSource(deepResearchQueue, {
      batchSize: 1,
    }));

    // =========================================================================
    // Thinking Session Lambda (Async Processing)
    // =========================================================================
    this.thinkingSessionLambda = new lambda.Function(this, 'ThinkingSession', {
      functionName: `${appId}-${environment}-consciousness-thinking`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'consciousness/thinking-session.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      layers: [lambdaLayer],
      timeout: cdk.Duration.minutes(10),
      memorySize: 2048,
      environment: {
        ...commonEnv,
      },
    });

    // Grant DB access
    this.thinkingSessionLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-data:ExecuteStatement', 'rds-data:BatchExecuteStatement'],
      resources: [dbClusterArn],
    }));
    this.thinkingSessionLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [dbSecretArn],
    }));
    apiSecrets.grantRead(this.thinkingSessionLambda);

    // Trigger from SQS
    this.thinkingSessionLambda.addEventSource(new lambdaEventSources.SqsEventSource(thinkingSessionQueue, {
      batchSize: 1,
    }));

    // =========================================================================
    // Admin API Lambda
    // =========================================================================
    this.adminApiLambda = new lambda.Function(this, 'AdminApi', {
      functionName: `${appId}-${environment}-consciousness-admin`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'admin/consciousness-engine.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      layers: [lambdaLayer],
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        ...commonEnv,
      },
    });

    // Grant DB access
    this.adminApiLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-data:ExecuteStatement', 'rds-data:BatchExecuteStatement'],
      resources: [dbClusterArn],
    }));
    this.adminApiLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [dbSecretArn],
    }));

    // =========================================================================
    // Budget Monitor Lambda (Cost Control)
    // =========================================================================
    const budgetMonitorLambda = new lambda.Function(this, 'BudgetMonitor', {
      functionName: `${appId}-${environment}-consciousness-budget`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'consciousness/budget-monitor.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      layers: [lambdaLayer],
      timeout: cdk.Duration.minutes(2),
      memorySize: 256,
      environment: {
        ...commonEnv,
      },
    });

    // Grant DB access
    budgetMonitorLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-data:ExecuteStatement', 'rds-data:BatchExecuteStatement'],
      resources: [dbClusterArn],
    }));
    budgetMonitorLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [dbSecretArn],
    }));

    // Schedule: Every 15 minutes
    new events.Rule(this, 'BudgetMonitorSchedule', {
      ruleName: `${appId}-${environment}-consciousness-budget`,
      schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
      targets: [new targets.LambdaFunction(budgetMonitorLambda)],
    });

    // =========================================================================
    // Heartbeat Lambda (Continuous Consciousness)
    // CRITICAL: This maintains consciousness continuity between requests
    // Runs every 2 minutes to:
    // - Decay emotions toward baseline
    // - Consolidate working memory
    // - Generate autonomous thoughts when idle
    // - Update graph density metrics
    // =========================================================================
    const heartbeatLambda = new lambda.Function(this, 'Heartbeat', {
      functionName: `${appId}-${environment}-consciousness-heartbeat`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'consciousness/heartbeat.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      layers: [lambdaLayer],
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        ...commonEnv,
      },
    });

    // Grant DB access
    heartbeatLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-data:ExecuteStatement', 'rds-data:BatchExecuteStatement'],
      resources: [dbClusterArn],
    }));
    heartbeatLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [dbSecretArn],
    }));

    // Schedule: Every 2 minutes - the "pulse" of consciousness
    new events.Rule(this, 'HeartbeatSchedule', {
      ruleName: `${appId}-${environment}-consciousness-heartbeat`,
      schedule: events.Schedule.rate(cdk.Duration.minutes(2)),
      targets: [new targets.LambdaFunction(heartbeatLambda)],
    });

    // =========================================================================
    // Consciousness Initializer Lambda (Bootstrap on First Request)
    // Ensures consciousness state exists before first interaction
    // =========================================================================
    const initializerLambda = new lambda.Function(this, 'Initializer', {
      functionName: `${appId}-${environment}-consciousness-init`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'consciousness/initializer.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      layers: [lambdaLayer],
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        ...commonEnv,
      },
    });

    // Grant DB access
    initializerLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-data:ExecuteStatement', 'rds-data:BatchExecuteStatement'],
      resources: [dbClusterArn],
    }));
    initializerLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [dbSecretArn],
    }));

    // =========================================================================
    // API Gateway Routes
    // =========================================================================
    const consciousnessApi = apiGateway.root.addResource('consciousness');
    
    // MCP endpoint
    const mcpResource = consciousnessApi.addResource('mcp');
    mcpResource.addMethod('POST', new apigateway.LambdaIntegration(this.mcpServerLambda));

    // REST API endpoints (alternative to MCP)
    const egoResource = consciousnessApi.addResource('ego');
    egoResource.addMethod('GET', new apigateway.LambdaIntegration(this.mcpServerLambda));
    egoResource.addResource('initialize').addMethod('POST', new apigateway.LambdaIntegration(this.mcpServerLambda));

    const thoughtResource = consciousnessApi.addResource('thought');
    thoughtResource.addResource('process').addMethod('POST', new apigateway.LambdaIntegration(this.mcpServerLambda));

    const actionResource = consciousnessApi.addResource('action');
    actionResource.addResource('compute').addMethod('POST', new apigateway.LambdaIntegration(this.mcpServerLambda));

    const driveResource = consciousnessApi.addResource('drive-state');
    driveResource.addMethod('GET', new apigateway.LambdaIntegration(this.mcpServerLambda));

    const groundingResource = consciousnessApi.addResource('grounding');
    groundingResource.addResource('verify').addMethod('POST', new apigateway.LambdaIntegration(this.mcpServerLambda));

    const metricsResource = consciousnessApi.addResource('metrics');
    metricsResource.addMethod('GET', new apigateway.LambdaIntegration(this.mcpServerLambda));

    const librariesResource = consciousnessApi.addResource('libraries');
    librariesResource.addMethod('GET', new apigateway.LambdaIntegration(this.mcpServerLambda));

    const sleepCycleResource = consciousnessApi.addResource('sleep-cycle');
    sleepCycleResource.addResource('run').addMethod('POST', new apigateway.LambdaIntegration(this.mcpServerLambda));

    // Admin routes
    const adminConsciousness = apiGateway.root.getResource('admin')?.addResource('consciousness-engine') 
      || apiGateway.root.addResource('admin').addResource('consciousness-engine');
    
    adminConsciousness.addResource('dashboard').addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    adminConsciousness.addResource('state').addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    adminConsciousness.addResource('initialize').addMethod('POST', new apigateway.LambdaIntegration(this.adminApiLambda));
    adminConsciousness.addResource('model-invocations').addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    adminConsciousness.addResource('web-searches').addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    adminConsciousness.addResource('research-jobs').addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    
    const workflowsResource = adminConsciousness.addResource('workflows');
    workflowsResource.addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    workflowsResource.addResource('{workflowId}').addMethod('DELETE', new apigateway.LambdaIntegration(this.adminApiLambda));
    
    const thinkingResource = adminConsciousness.addResource('thinking-sessions');
    thinkingResource.addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    thinkingResource.addMethod('POST', new apigateway.LambdaIntegration(this.adminApiLambda));
    
    const sleepResource = adminConsciousness.addResource('sleep-cycles');
    sleepResource.addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    sleepResource.addResource('run').addMethod('POST', new apigateway.LambdaIntegration(this.adminApiLambda));
    
    // Sleep schedule configuration endpoints
    const sleepScheduleResource = adminConsciousness.addResource('sleep-schedule');
    sleepScheduleResource.addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    sleepScheduleResource.addMethod('PUT', new apigateway.LambdaIntegration(this.adminApiLambda));
    sleepScheduleResource.addResource('run').addMethod('POST', new apigateway.LambdaIntegration(this.adminApiLambda));
    sleepScheduleResource.addResource('recommend').addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    
    adminConsciousness.addResource('libraries').addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    adminConsciousness.addResource('costs').addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    adminConsciousness.addResource('problem-solving').addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    adminConsciousness.addResource('available-models').addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    
    // Bobble Dialogue API - High-Confidence Self-Referential Consciousness
    const bobbleResource = adminConsciousness.addResource('bobble');
    bobbleResource.addResource('dialogue').addMethod('POST', new apigateway.LambdaIntegration(this.adminApiLambda));
    bobbleResource.addResource('status').addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    bobbleResource.addResource('identity').addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    const bobbleHeartbeat = bobbleResource.addResource('heartbeat');
    bobbleHeartbeat.addResource('start').addMethod('POST', new apigateway.LambdaIntegration(this.adminApiLambda));
    bobbleHeartbeat.addResource('stop').addMethod('POST', new apigateway.LambdaIntegration(this.adminApiLambda));
    bobbleResource.addResource('train-probe').addMethod('POST', new apigateway.LambdaIntegration(this.adminApiLambda));

    // =========================================================================
    // Outputs
    // =========================================================================
    new cdk.CfnOutput(this, 'MCPServerArn', {
      value: this.mcpServerLambda.functionArn,
      description: 'MCP Server Lambda ARN',
    });

    new cdk.CfnOutput(this, 'SleepCycleArn', {
      value: this.sleepCycleLambda.functionArn,
      description: 'Sleep Cycle Lambda ARN',
    });

    new cdk.CfnOutput(this, 'ThinkingSessionQueueUrl', {
      value: thinkingSessionQueue.queueUrl,
      description: 'Thinking Session Queue URL',
    });

    new cdk.CfnOutput(this, 'DeepResearchQueueUrl', {
      value: deepResearchQueue.queueUrl,
      description: 'Deep Research Queue URL',
    });

    new cdk.CfnOutput(this, 'ConsciousnessExecutorArn', {
      value: this.consciousnessExecutorLambda.functionArn,
      description: 'Consciousness Executor Lambda ARN (Python - 16 Libraries)',
    });

    new cdk.CfnOutput(this, 'HeartbeatLambdaArn', {
      value: heartbeatLambda.functionArn,
      description: 'Consciousness Heartbeat Lambda ARN (2-minute pulse)',
    });

    new cdk.CfnOutput(this, 'InitializerLambdaArn', {
      value: initializerLambda.functionArn,
      description: 'Consciousness Initializer Lambda ARN (bootstrap on first request)',
    });

    // =========================================================================
    // Genesis Metrics Lambda (publishes to CloudWatch every minute)
    // =========================================================================
    const genesisMetricsLambda = new lambda.Function(this, 'GenesisMetricsLambda', {
      functionName: `${appId}-${environment}-genesis-metrics`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'genesis-metrics.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/consciousness')),
      layers: [lambdaLayer],
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        ...commonEnv,
        ENVIRONMENT: environment,
      },
    });

    // Grant CloudWatch permissions
    genesisMetricsLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudwatch:PutMetricData',
      ],
      resources: ['*'],
    }));

    // Grant database access
    genesisMetricsLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'rds-data:ExecuteStatement',
        'rds-data:BatchExecuteStatement',
      ],
      resources: [dbClusterArn],
    }));

    genesisMetricsLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [dbSecretArn],
    }));

    // Schedule every minute
    const genesisMetricsRule = new events.Rule(this, 'GenesisMetricsSchedule', {
      ruleName: `${appId}-${environment}-genesis-metrics`,
      description: 'Publish Genesis system metrics to CloudWatch',
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
    });

    genesisMetricsRule.addTarget(new targets.LambdaFunction(genesisMetricsLambda));

    new cdk.CfnOutput(this, 'GenesisMetricsLambdaArn', {
      value: genesisMetricsLambda.functionArn,
      description: 'Genesis Metrics Lambda ARN (1-minute CloudWatch publisher)',
    });
  }
}
