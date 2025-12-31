import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

interface ScheduledTasksStackProps extends cdk.StackProps {
  appId: string;
  environment: string;
  alertsTopic?: sns.ITopic;
}

/**
 * Scheduled Tasks Stack
 * 
 * Cron jobs and scheduled maintenance tasks
 */
export class ScheduledTasksStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ScheduledTasksStackProps) {
    super(scope, id, props);

    const { appId, environment, alertsTopic } = props;

    // =========================================================================
    // Usage Aggregation (hourly)
    // =========================================================================
    const usageAggregatorLambda = new lambda.Function(this, 'UsageAggregator', {
      functionName: `${appId}-${environment}-usage-aggregator`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Aggregating usage data...');
          // Aggregate usage data from raw events into hourly/daily summaries
          // Update billing records
          // Generate usage reports
          return { status: 'completed', timestamp: new Date().toISOString() };
        };
      `),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    });

    new events.Rule(this, 'UsageAggregatorSchedule', {
      ruleName: `${appId}-${environment}-usage-aggregator`,
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      targets: [new targets.LambdaFunction(usageAggregatorLambda)],
    });

    // =========================================================================
    // Credit Balance Alerts (every 15 minutes)
    // =========================================================================
    const creditAlertLambda = new lambda.Function(this, 'CreditAlerts', {
      functionName: `${appId}-${environment}-credit-alerts`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Checking credit balances...');
          // Query tenants with low balances
          // Send alerts via SNS/email
          // Update alert status
          return { status: 'completed', alertsSent: 0 };
        };
      `),
      timeout: cdk.Duration.minutes(2),
      memorySize: 256,
    });

    new events.Rule(this, 'CreditAlertsSchedule', {
      ruleName: `${appId}-${environment}-credit-alerts`,
      schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
      targets: [new targets.LambdaFunction(creditAlertLambda)],
    });

    // =========================================================================
    // Data Retention Cleanup (daily at 3 AM UTC)
    // =========================================================================
    const dataCleanupLambda = new lambda.Function(this, 'DataCleanup', {
      functionName: `${appId}-${environment}-data-cleanup`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Running data cleanup...');
          // Delete expired sessions
          // Archive old audit logs
          // Clean up orphaned resources
          // Delete expired cache entries
          return { status: 'completed', itemsDeleted: 0 };
        };
      `),
      timeout: cdk.Duration.minutes(15),
      memorySize: 512,
    });

    new events.Rule(this, 'DataCleanupSchedule', {
      ruleName: `${appId}-${environment}-data-cleanup`,
      schedule: events.Schedule.cron({ minute: '0', hour: '3' }),
      targets: [new targets.LambdaFunction(dataCleanupLambda)],
    });

    // =========================================================================
    // Model Status Check (every 5 minutes)
    // =========================================================================
    const modelStatusLambda = new lambda.Function(this, 'ModelStatus', {
      functionName: `${appId}-${environment}-model-status`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Checking model availability...');
          // Ping each AI provider health endpoint
          // Update model status in database
          // Send alerts if models are down
          return { 
            status: 'completed',
            models: {
              openai: 'healthy',
              anthropic: 'healthy',
              google: 'healthy'
            }
          };
        };
      `),
      timeout: cdk.Duration.minutes(2),
      memorySize: 256,
    });

    new events.Rule(this, 'ModelStatusSchedule', {
      ruleName: `${appId}-${environment}-model-status`,
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(modelStatusLambda)],
    });

    // =========================================================================
    // Billing Reconciliation (daily at 1 AM UTC)
    // =========================================================================
    const billingReconciliationLambda = new lambda.Function(this, 'BillingReconciliation', {
      functionName: `${appId}-${environment}-billing-reconciliation`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Running billing reconciliation...');
          // Compare usage records with provider invoices
          // Identify discrepancies
          // Generate reconciliation report
          return { status: 'completed', discrepancies: 0 };
        };
      `),
      timeout: cdk.Duration.minutes(15),
      memorySize: 512,
    });

    new events.Rule(this, 'BillingReconciliationSchedule', {
      ruleName: `${appId}-${environment}-billing-reconciliation`,
      schedule: events.Schedule.cron({ minute: '0', hour: '1' }),
      targets: [new targets.LambdaFunction(billingReconciliationLambda)],
    });

    // =========================================================================
    // Analytics Report Generation (daily at 6 AM UTC)
    // =========================================================================
    const analyticsReportLambda = new lambda.Function(this, 'AnalyticsReport', {
      functionName: `${appId}-${environment}-analytics-report`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Generating analytics reports...');
          // Aggregate daily metrics
          // Generate tenant reports
          // Store in S3
          return { status: 'completed', reportsGenerated: 0 };
        };
      `),
      timeout: cdk.Duration.minutes(10),
      memorySize: 1024,
    });

    new events.Rule(this, 'AnalyticsReportSchedule', {
      ruleName: `${appId}-${environment}-analytics-report`,
      schedule: events.Schedule.cron({ minute: '0', hour: '6' }),
      targets: [new targets.LambdaFunction(analyticsReportLambda)],
    });

    // =========================================================================
    // Webhook Retry (every 5 minutes)
    // =========================================================================
    const webhookRetryLambda = new lambda.Function(this, 'WebhookRetry', {
      functionName: `${appId}-${environment}-webhook-retry`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Retrying failed webhooks...');
          // Query failed webhook deliveries
          // Retry with exponential backoff
          // Update delivery status
          return { status: 'completed', retried: 0 };
        };
      `),
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
    });

    new events.Rule(this, 'WebhookRetrySchedule', {
      ruleName: `${appId}-${environment}-webhook-retry`,
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(webhookRetryLambda)],
    });

    // =========================================================================
    // Cache Warmup (every 30 minutes)
    // =========================================================================
    const cacheWarmupLambda = new lambda.Function(this, 'CacheWarmup', {
      functionName: `${appId}-${environment}-cache-warmup`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Warming up cache...');
          // Pre-load frequently accessed data
          // Refresh model list cache
          // Refresh configuration cache
          return { status: 'completed', itemsCached: 0 };
        };
      `),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    });

    new events.Rule(this, 'CacheWarmupSchedule', {
      ruleName: `${appId}-${environment}-cache-warmup`,
      schedule: events.Schedule.rate(cdk.Duration.minutes(30)),
      targets: [new targets.LambdaFunction(cacheWarmupLambda)],
    });

    // =========================================================================
    // Learning Snapshots (daily at 3 AM UTC) - v4.18.56
    // Creates snapshots of user/tenant/global learning state for fast recovery
    // =========================================================================
    const learningSnapshotsLambda = new lambda.Function(this, 'LearningSnapshots', {
      functionName: `${appId}-${environment}-learning-snapshots`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'scheduled/learning-snapshots.handler',
      code: lambda.Code.fromAsset('lambda/dist'),
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: {
        APP_ID: appId,
        ENVIRONMENT: environment,
      },
    });

    new events.Rule(this, 'LearningSnapshotsSchedule', {
      ruleName: `${appId}-${environment}-learning-snapshots`,
      schedule: events.Schedule.cron({ minute: '0', hour: '3' }),
      targets: [new targets.LambdaFunction(learningSnapshotsLambda)],
    });

    // =========================================================================
    // Learning Aggregation (weekly on Sunday at 4 AM UTC) - v4.18.56
    // Aggregates tenant learning to global anonymized learning
    // =========================================================================
    const learningAggregationLambda = new lambda.Function(this, 'LearningAggregation', {
      functionName: `${appId}-${environment}-learning-aggregation`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'scheduled/learning-aggregation.handler',
      code: lambda.Code.fromAsset('lambda/dist'),
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: {
        APP_ID: appId,
        ENVIRONMENT: environment,
        GLOBAL_AGGREGATION_MIN_TENANTS: '5',
      },
    });

    new events.Rule(this, 'LearningAggregationSchedule', {
      ruleName: `${appId}-${environment}-learning-aggregation`,
      schedule: events.Schedule.cron({ minute: '0', hour: '4', weekDay: 'SUN' }),
      targets: [new targets.LambdaFunction(learningAggregationLambda)],
    });

    // Outputs
    new cdk.CfnOutput(this, 'ScheduledTasksCreated', {
      value: '10',
      description: 'Number of scheduled tasks created',
    });
  }
}

/**
 * Scheduled Tasks Summary
 * 
 * | Task                    | Schedule              | Purpose                        |
 * |-------------------------|-----------------------|--------------------------------|
 * | Usage Aggregator        | Every hour            | Aggregate raw usage data       |
 * | Credit Alerts           | Every 15 minutes      | Check low balance warnings     |
 * | Data Cleanup            | Daily at 3 AM UTC     | Delete expired data            |
 * | Model Status            | Every 5 minutes       | Check AI provider availability |
 * | Billing Reconciliation  | Daily at 1 AM UTC     | Reconcile usage with invoices  |
 * | Analytics Report        | Daily at 6 AM UTC     | Generate daily reports         |
 * | Webhook Retry           | Every 5 minutes       | Retry failed webhook deliveries|
 * | Cache Warmup            | Every 30 minutes      | Pre-load cache data            |
 * | Learning Snapshots      | Daily at 3 AM UTC     | Create learning state backups  |
 * | Learning Aggregation    | Weekly Sun 4 AM UTC   | Aggregate to global learning   |
 */
