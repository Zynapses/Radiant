// RADIANT v4.18.0 - Library Registry Scheduler Stack
// EventBridge scheduled Lambda for library registry updates and initial seeding
// Libraries are loaded on first deployment and updated daily by default

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

export interface LibraryRegistryStackProps extends cdk.StackProps {
  environment: string;
  vpcId?: string;
  securityGroupId?: string;
  databaseSecretArn: string;
  databaseClusterArn: string;
}

export class LibraryRegistryStack extends cdk.Stack {
  public readonly updateLambda: lambda.Function;
  public readonly seedLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: LibraryRegistryStackProps) {
    super(scope, id, props);

    // =========================================================================
    // Lambda for scheduled library updates
    // =========================================================================
    this.updateLambda = new lambda.Function(this, 'LibraryUpdateLambda', {
      functionName: `radiant-library-update-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'library-registry/update.handler',
      code: lambda.Code.fromAsset('lambda'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        ENVIRONMENT: props.environment,
        DATABASE_SECRET_ARN: props.databaseSecretArn,
        DATABASE_CLUSTER_ARN: props.databaseClusterArn,
      },
      description: 'Scheduled library registry update - syncs open-source tool metadata and proficiencies',
    });

    // Grant database access
    this.updateLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [props.databaseSecretArn],
    }));

    this.updateLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'rds-data:ExecuteStatement',
        'rds-data:BatchExecuteStatement',
      ],
      resources: [props.databaseClusterArn],
    }));

    // =========================================================================
    // Lambda for initial seeding (runs once on deployment if no libraries exist)
    // =========================================================================
    this.seedLambda = new lambda.Function(this, 'LibrarySeedLambda', {
      functionName: `radiant-library-seed-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'library-registry/update.seedOnInstall',
      code: lambda.Code.fromAsset('lambda'),
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
      environment: {
        ENVIRONMENT: props.environment,
        DATABASE_SECRET_ARN: props.databaseSecretArn,
        DATABASE_CLUSTER_ARN: props.databaseClusterArn,
      },
      description: 'Initial library seed - loads 93+ open-source tools on first deployment',
    });

    // Grant database access to seed lambda
    this.seedLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [props.databaseSecretArn],
    }));

    this.seedLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'rds-data:ExecuteStatement',
        'rds-data:BatchExecuteStatement',
      ],
      resources: [props.databaseClusterArn],
    }));

    // =========================================================================
    // Custom Resource to trigger initial seed on deployment
    // =========================================================================
    const seedProvider = new cr.Provider(this, 'LibrarySeedProvider', {
      onEventHandler: this.seedLambda,
    });

    new cdk.CustomResource(this, 'LibrarySeedTrigger', {
      serviceToken: seedProvider.serviceToken,
      properties: {
        // Changing this will re-trigger the seed
        Version: '1.0.0',
        Timestamp: Date.now().toString(),
      },
    });

    // =========================================================================
    // EventBridge rules for scheduled updates
    // =========================================================================

    // Daily update at 3 AM UTC (default, enabled)
    const dailyRule = new events.Rule(this, 'DailyUpdateRule', {
      ruleName: `radiant-library-update-daily-${props.environment}`,
      schedule: events.Schedule.cron({ minute: '0', hour: '3' }),
      description: 'Daily library registry update (default)',
      enabled: true,
    });
    dailyRule.addTarget(new targets.LambdaFunction(this.updateLambda, {
      retryAttempts: 2,
    }));

    // Hourly update (disabled by default)
    const hourlyRule = new events.Rule(this, 'HourlyUpdateRule', {
      ruleName: `radiant-library-update-hourly-${props.environment}`,
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      description: 'Hourly library registry update',
      enabled: false,
    });
    hourlyRule.addTarget(new targets.LambdaFunction(this.updateLambda));

    // Weekly update (disabled by default)
    const weeklyRule = new events.Rule(this, 'WeeklyUpdateRule', {
      ruleName: `radiant-library-update-weekly-${props.environment}`,
      schedule: events.Schedule.cron({ minute: '0', hour: '3', weekDay: 'SUN' }),
      description: 'Weekly library registry update',
      enabled: false,
    });
    weeklyRule.addTarget(new targets.LambdaFunction(this.updateLambda));

    // =========================================================================
    // Outputs
    // =========================================================================
    new cdk.CfnOutput(this, 'UpdateLambdaArn', {
      value: this.updateLambda.functionArn,
      description: 'Library update Lambda ARN',
      exportName: `radiant-library-update-lambda-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'SeedLambdaArn', {
      value: this.seedLambda.functionArn,
      description: 'Library seed Lambda ARN',
      exportName: `radiant-library-seed-lambda-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'DailyRuleArn', {
      value: dailyRule.ruleArn,
      description: 'Daily update rule ARN (default enabled)',
    });
  }
}
