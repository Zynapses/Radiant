// RADIANT v4.18.0 - Model Sync Scheduler Stack
// EventBridge scheduled Lambda for periodic model registry sync

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface ModelSyncSchedulerStackProps extends cdk.StackProps {
  environment: string;
  vpcId?: string;
  securityGroupId?: string;
  databaseSecretArn: string;
  databaseClusterArn: string;
}

export class ModelSyncSchedulerStack extends cdk.Stack {
  public readonly syncLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: ModelSyncSchedulerStackProps) {
    super(scope, id, props);

    // Lambda function for scheduled sync
    this.syncLambda = new lambda.Function(this, 'ModelSyncLambda', {
      functionName: `radiant-model-sync-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'scheduled/model-sync.handler',
      code: lambda.Code.fromAsset('lambda'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        ENVIRONMENT: props.environment,
        DATABASE_SECRET_ARN: props.databaseSecretArn,
        DATABASE_CLUSTER_ARN: props.databaseClusterArn,
      },
      description: 'Scheduled model registry sync - syncs models from code registries and checks health',
    });

    // Grant database access
    this.syncLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
      ],
      resources: [props.databaseSecretArn],
    }));

    this.syncLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'rds-data:ExecuteStatement',
        'rds-data:BatchExecuteStatement',
      ],
      resources: [props.databaseClusterArn],
    }));

    // EventBridge rules for different sync intervals
    // These are all created but only one is enabled based on config
    // The actual interval is controlled by the database config

    // Default: Hourly sync (enabled by default)
    const hourlyRule = new events.Rule(this, 'HourlySyncRule', {
      ruleName: `radiant-model-sync-hourly-${props.environment}`,
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      description: 'Hourly model registry sync (default)',
      enabled: true,
    });
    hourlyRule.addTarget(new targets.LambdaFunction(this.syncLambda, {
      retryAttempts: 2,
    }));

    // 5-minute sync (for development/testing)
    const fiveMinRule = new events.Rule(this, 'FiveMinSyncRule', {
      ruleName: `radiant-model-sync-5min-${props.environment}`,
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      description: 'Every 5 minutes model sync (dev/testing)',
      enabled: false, // Disabled by default
    });
    fiveMinRule.addTarget(new targets.LambdaFunction(this.syncLambda));

    // 15-minute sync
    const fifteenMinRule = new events.Rule(this, 'FifteenMinSyncRule', {
      ruleName: `radiant-model-sync-15min-${props.environment}`,
      schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
      description: 'Every 15 minutes model sync',
      enabled: false,
    });
    fifteenMinRule.addTarget(new targets.LambdaFunction(this.syncLambda));

    // 6-hour sync
    const sixHourRule = new events.Rule(this, 'SixHourSyncRule', {
      ruleName: `radiant-model-sync-6hour-${props.environment}`,
      schedule: events.Schedule.rate(cdk.Duration.hours(6)),
      description: 'Every 6 hours model sync',
      enabled: false,
    });
    sixHourRule.addTarget(new targets.LambdaFunction(this.syncLambda));

    // Daily sync
    const dailyRule = new events.Rule(this, 'DailySyncRule', {
      ruleName: `radiant-model-sync-daily-${props.environment}`,
      schedule: events.Schedule.rate(cdk.Duration.days(1)),
      description: 'Daily model sync',
      enabled: false,
    });
    dailyRule.addTarget(new targets.LambdaFunction(this.syncLambda));

    // Outputs
    new cdk.CfnOutput(this, 'SyncLambdaArn', {
      value: this.syncLambda.functionArn,
      description: 'Model sync Lambda ARN',
      exportName: `radiant-model-sync-lambda-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'HourlyRuleArn', {
      value: hourlyRule.ruleArn,
      description: 'Hourly sync rule ARN (default enabled)',
    });
  }
}
