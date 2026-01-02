// RADIANT v4.18.0 - Security Monitoring CDK Stack
// EventBridge scheduled monitoring with alerts
// Now supports runtime-adjustable schedules via admin API
// ============================================================================

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
// ses reserved for email notifications
import { Construct } from 'constructs';

export interface SecurityMonitoringStackProps extends cdk.StackProps {
  environment: string;
  vpcId?: string;
  databaseSecretArn: string;
  databaseClusterArn: string;
  alertEmailRecipients?: string[];
  slackWebhookUrl?: string;
  // Schedule configuration - can be overridden at runtime via admin API
  scheduleConfig?: {
    driftDetection?: { enabled?: boolean; cron?: string };
    anomalyDetection?: { enabled?: boolean; cron?: string };
    classificationReview?: { enabled?: boolean; cron?: string };
    weeklySecurityScan?: { enabled?: boolean; cron?: string };
    weeklyBenchmark?: { enabled?: boolean; cron?: string };
  };
}

export class SecurityMonitoringStack extends cdk.Stack {
  public readonly monitoringLambda: lambda.Function;
  public readonly benchmarkLambda: lambda.Function;
  public readonly scheduleManagerLambda: lambda.Function;
  public readonly alertTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: SecurityMonitoringStackProps) {
    super(scope, id, props);

    // ==========================================================================
    // SNS Topic for Alerts
    // ==========================================================================

    this.alertTopic = new sns.Topic(this, 'SecurityAlertTopic', {
      topicName: `radiant-security-alerts-${props.environment}`,
      displayName: 'RADIANT Security Alerts',
    });

    // Add email subscriptions
    if (props.alertEmailRecipients) {
      for (const email of props.alertEmailRecipients) {
        this.alertTopic.addSubscription(
          new snsSubscriptions.EmailSubscription(email)
        );
      }
    }

    // ==========================================================================
    // Security Monitoring Lambda
    // ==========================================================================

    this.monitoringLambda = new lambda.Function(this, 'SecurityMonitoringLambda', {
      functionName: `radiant-security-monitoring-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'monitoring.handler',
      code: lambda.Code.fromAsset('lambda/security'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        ENVIRONMENT: props.environment,
        DATABASE_SECRET_ARN: props.databaseSecretArn,
        DATABASE_CLUSTER_ARN: props.databaseClusterArn,
        ALERT_TOPIC_ARN: this.alertTopic.topicArn,
        SLACK_WEBHOOK_URL: props.slackWebhookUrl || '',
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Grant permissions
    this.monitoringLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'secretsmanager:GetSecretValue',
      ],
      resources: [props.databaseSecretArn],
    }));

    this.monitoringLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'rds-data:ExecuteStatement',
        'rds-data:BatchExecuteStatement',
      ],
      resources: [props.databaseClusterArn],
    }));

    this.monitoringLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sns:Publish'],
      resources: [this.alertTopic.topicArn],
    }));

    this.monitoringLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));

    // Grant EventBridge permissions for runtime schedule management
    this.monitoringLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'events:PutRule',
        'events:DeleteRule',
        'events:EnableRule',
        'events:DisableRule',
        'events:DescribeRule',
        'events:ListRules',
        'events:PutTargets',
        'events:RemoveTargets',
      ],
      resources: [`arn:aws:events:${this.region}:${this.account}:rule/radiant-*`],
    }));

    // ==========================================================================
    // EventBridge Rules - Scheduled Monitoring
    // These are default schedules that can be overridden at runtime via admin API
    // The securityScheduleService can update these rules dynamically
    // ==========================================================================

    const scheduleConfig = props.scheduleConfig || {};

    // Drift Detection - Daily at midnight UTC (default)
    if (scheduleConfig.driftDetection?.enabled !== false) {
      new events.Rule(this, 'DriftDetectionRule', {
        ruleName: `radiant-drift-detection-${props.environment}`,
        description: 'Daily drift detection for all models (runtime-adjustable)',
        schedule: events.Schedule.cron({ minute: '0', hour: '0' }),
      targets: [
          new targets.LambdaFunction(this.monitoringLambda, {
            event: events.RuleTargetInput.fromObject({
              type: 'drift_detection',
              source: 'scheduled',
            }),
          }),
        ],
      });
    }

    // Anomaly Detection - Hourly (default)
    if (scheduleConfig.anomalyDetection?.enabled !== false) {
      new events.Rule(this, 'AnomalyDetectionRule', {
      ruleName: `radiant-anomaly-detection-${props.environment}`,
        description: 'Hourly behavioral anomaly detection (runtime-adjustable)',
        schedule: events.Schedule.cron({ minute: '0' }),
        targets: [
          new targets.LambdaFunction(this.monitoringLambda, {
            event: events.RuleTargetInput.fromObject({
              type: 'anomaly_detection',
              source: 'scheduled',
            }),
          }),
        ],
      });
    }

    // Classification Review - Every 6 hours (default)
    if (scheduleConfig.classificationReview?.enabled !== false) {
      new events.Rule(this, 'ClassificationReviewRule', {
      ruleName: `radiant-classification-review-${props.environment}`,
        description: 'Classification statistics review (runtime-adjustable)',
        schedule: events.Schedule.cron({ minute: '0', hour: '0,6,12,18' }),
        targets: [
          new targets.LambdaFunction(this.monitoringLambda, {
            event: events.RuleTargetInput.fromObject({
              type: 'classification_review',
              source: 'scheduled',
            }),
          }),
        ],
      });
    }

    // Full Security Scan - Weekly on Sunday at 2 AM (default)
    if (scheduleConfig.weeklySecurityScan?.enabled !== false) {
      new events.Rule(this, 'WeeklySecurityScanRule', {
      ruleName: `radiant-weekly-security-scan-${props.environment}`,
        description: 'Weekly comprehensive security scan (runtime-adjustable)',
        schedule: events.Schedule.cron({ minute: '0', hour: '2', weekDay: 'SUN' }),
        targets: [
          new targets.LambdaFunction(this.monitoringLambda, {
            event: events.RuleTargetInput.fromObject({
              type: 'weekly_security_scan',
              source: 'scheduled',
            }),
          }),
        ],
      });
    }

    // ==========================================================================
    // Benchmark Runner Lambda
    // ==========================================================================

    this.benchmarkLambda = new lambda.Function(this, 'BenchmarkRunnerLambda', {
      functionName: `radiant-benchmark-runner-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'benchmark.handler',
      code: lambda.Code.fromAsset('lambda/security'),
      timeout: cdk.Duration.minutes(15),
      memorySize: 2048,
      environment: {
        ENVIRONMENT: props.environment,
        DATABASE_SECRET_ARN: props.databaseSecretArn,
        DATABASE_CLUSTER_ARN: props.databaseClusterArn,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Grant permissions
    this.benchmarkLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [props.databaseSecretArn],
    }));

    this.benchmarkLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-data:ExecuteStatement', 'rds-data:BatchExecuteStatement'],
      resources: [props.databaseClusterArn],
    }));

    // Benchmark Run - Weekly on Saturday at 3 AM (default)
    if (scheduleConfig.weeklyBenchmark?.enabled !== false) {
      new events.Rule(this, 'WeeklyBenchmarkRule', {
        ruleName: `radiant-weekly-benchmark-${props.environment}`,
        description: 'Weekly quality benchmark run (runtime-adjustable)',
        schedule: events.Schedule.cron({ minute: '0', hour: '3', weekDay: 'SAT' }),
        targets: [
          new targets.LambdaFunction(this.benchmarkLambda, {
            event: events.RuleTargetInput.fromObject({
              type: 'weekly_benchmark',
              benchmarks: ['truthfulqa', 'selfcheck'],
            }),
          }),
        ],
      });
    }

    // ==========================================================================
    // Schedule Manager Lambda (for admin API)
    // ==========================================================================

    this.scheduleManagerLambda = new lambda.Function(this, 'ScheduleManagerLambda', {
      functionName: `radiant-security-schedule-manager-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'security-schedules.handler',
      code: lambda.Code.fromAsset('lambda/admin'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        ENVIRONMENT: props.environment,
        DATABASE_SECRET_ARN: props.databaseSecretArn,
        DATABASE_CLUSTER_ARN: props.databaseClusterArn,
        SECURITY_MONITORING_LAMBDA_ARN: this.monitoringLambda.functionArn,
        BENCHMARK_LAMBDA_ARN: this.benchmarkLambda.functionArn,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Grant permissions for schedule management
    this.scheduleManagerLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [props.databaseSecretArn],
    }));

    this.scheduleManagerLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-data:ExecuteStatement', 'rds-data:BatchExecuteStatement'],
      resources: [props.databaseClusterArn],
    }));

    // EventBridge permissions for dynamic schedule updates
    this.scheduleManagerLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'events:PutRule',
        'events:DeleteRule',
        'events:EnableRule',
        'events:DisableRule',
        'events:DescribeRule',
        'events:ListRules',
        'events:PutTargets',
        'events:RemoveTargets',
      ],
      resources: [`arn:aws:events:${this.region}:${this.account}:rule/radiant-*`],
    }));

    // Permission to invoke monitoring lambdas for manual runs
    this.scheduleManagerLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [
        this.monitoringLambda.functionArn,
        this.benchmarkLambda.functionArn,
      ],
    }));

    // ==========================================================================
    // CloudWatch Alarms
    // ==========================================================================

    // Alarm on Lambda errors
    const errorMetric = this.monitoringLambda.metricErrors({
      period: cdk.Duration.minutes(5),
    });

    new cdk.aws_cloudwatch.Alarm(this, 'MonitoringLambdaErrorAlarm', {
      alarmName: `radiant-security-monitoring-errors-${props.environment}`,
      alarmDescription: 'Security monitoring Lambda is failing',
      metric: errorMetric,
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // ==========================================================================
    // Outputs
    // ==========================================================================

    new cdk.CfnOutput(this, 'MonitoringLambdaArn', {
      value: this.monitoringLambda.functionArn,
      description: 'Security Monitoring Lambda ARN',
    });

    new cdk.CfnOutput(this, 'BenchmarkLambdaArn', {
      value: this.benchmarkLambda.functionArn,
      description: 'Benchmark Runner Lambda ARN',
    });

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: this.alertTopic.topicArn,
      description: 'Security Alert SNS Topic ARN',
    });

    new cdk.CfnOutput(this, 'ScheduleManagerLambdaArn', {
      value: this.scheduleManagerLambda.functionArn,
      description: 'Schedule Manager Lambda ARN',
    });
  }
}
