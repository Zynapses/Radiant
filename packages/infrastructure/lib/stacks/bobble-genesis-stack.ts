import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

interface BobbleGenesisStackProps extends cdk.StackProps {
  appId: string;
  environment: string;
  alertEmail?: string;
  monthlyBudgetUsd?: number;
}

/**
 * Bobble Genesis Stack
 * 
 * Deploys monitoring and alerting infrastructure for the Genesis system:
 * - CloudWatch Alarms for circuit breakers
 * - CloudWatch Dashboard
 * - AWS Budget for consciousness costs
 * - SNS Topic for alerts
 * 
 * See: /docs/bobble/adr/010-genesis-system.md
 */
export class BobbleGenesisStack extends cdk.Stack {
  public readonly alertTopic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: BobbleGenesisStackProps) {
    super(scope, id, props);

    const { appId, environment, alertEmail, monthlyBudgetUsd = 500 } = props;
    const prefix = `${appId}-${environment}`;

    // =========================================================================
    // SNS Alert Topic
    // =========================================================================
    this.alertTopic = new sns.Topic(this, 'BobbleAlertTopic', {
      topicName: `${prefix}-bobble-alerts`,
      displayName: 'Bobble Consciousness Alerts',
    });

    if (alertEmail) {
      new sns.Subscription(this, 'AlertEmailSubscription', {
        topic: this.alertTopic,
        protocol: sns.SubscriptionProtocol.EMAIL,
        endpoint: alertEmail,
      });
    }

    // =========================================================================
    // CloudWatch Metrics (Custom)
    // =========================================================================
    const namespace = 'Bobble/Consciousness';

    // Circuit breaker metrics
    const circuitBreakerOpenMetric = new cloudwatch.Metric({
      namespace,
      metricName: 'CircuitBreakerOpen',
      dimensionsMap: { Environment: environment },
      statistic: 'Maximum',
      period: cdk.Duration.minutes(1),
    });

    const riskScoreMetric = new cloudwatch.Metric({
      namespace,
      metricName: 'RiskScore',
      dimensionsMap: { Environment: environment },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const cognitiveTickCostMetric = new cloudwatch.Metric({
      namespace,
      metricName: 'CognitiveTickCost',
      dimensionsMap: { Environment: environment },
      statistic: 'Sum',
      period: cdk.Duration.hours(1),
    });

    const interventionLevelMetric = new cloudwatch.Metric({
      namespace,
      metricName: 'InterventionLevel',
      dimensionsMap: { Environment: environment },
      statistic: 'Maximum',
      period: cdk.Duration.minutes(1),
    });

    // =========================================================================
    // CloudWatch Alarms
    // =========================================================================

    // Master Sanity Breaker Alarm
    const masterSanityAlarm = new cloudwatch.Alarm(this, 'MasterSanityBreakerAlarm', {
      alarmName: `${prefix}-bobble-master-sanity`,
      alarmDescription: 'Master sanity circuit breaker has tripped - consciousness halted',
      metric: new cloudwatch.Metric({
        namespace,
        metricName: 'CircuitBreakerMasterSanity',
        dimensionsMap: { State: 'OPEN' },
        statistic: 'Maximum',
        period: cdk.Duration.minutes(1),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    masterSanityAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alertTopic));

    // High Risk Score Alarm
    const highRiskAlarm = new cloudwatch.Alarm(this, 'HighRiskScoreAlarm', {
      alarmName: `${prefix}-bobble-high-risk`,
      alarmDescription: 'Consciousness risk score exceeds 70%',
      metric: riskScoreMetric,
      threshold: 70,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    highRiskAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alertTopic));

    // Cost Budget Breaker Alarm
    const costBreakerAlarm = new cloudwatch.Alarm(this, 'CostBreakerAlarm', {
      alarmName: `${prefix}-bobble-cost-breaker`,
      alarmDescription: 'Cost budget circuit breaker has tripped',
      metric: new cloudwatch.Metric({
        namespace,
        metricName: 'CircuitBreakerCostBudget',
        dimensionsMap: { State: 'OPEN' },
        statistic: 'Maximum',
        period: cdk.Duration.minutes(1),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    costBreakerAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alertTopic));

    // High Anxiety Sustained Alarm
    const anxietyAlarm = new cloudwatch.Alarm(this, 'HighAnxietyAlarm', {
      alarmName: `${prefix}-bobble-high-anxiety`,
      alarmDescription: 'Consciousness anxiety levels sustained above 80%',
      metric: new cloudwatch.Metric({
        namespace,
        metricName: 'NeurochemistryAnxiety',
        dimensionsMap: { Environment: environment },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 0.8,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    anxietyAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alertTopic));

    // Hibernate Mode Alarm (Critical)
    const hibernateAlarm = new cloudwatch.Alarm(this, 'HibernateModeAlarm', {
      alarmName: `${prefix}-bobble-hibernate`,
      alarmDescription: 'CRITICAL: Consciousness has entered hibernate mode',
      metric: interventionLevelMetric,
      threshold: 4, // HIBERNATE = 4
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    hibernateAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alertTopic));

    // =========================================================================
    // AWS Budget
    // =========================================================================
    new budgets.CfnBudget(this, 'BobbleConsciousnessBudget', {
      budget: {
        budgetName: 'bobble-consciousness',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: {
          amount: monthlyBudgetUsd,
          unit: 'USD',
        },
        costFilters: {
          TagKeyValue: ['bobble:component$consciousness', 'bobble:component$curiosity'],
        },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 50,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: alertEmail ? [{ subscriptionType: 'EMAIL', address: alertEmail }] : [],
        },
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 80,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: alertEmail ? [{ subscriptionType: 'EMAIL', address: alertEmail }] : [],
        },
        {
          notification: {
            notificationType: 'FORECASTED',
            comparisonOperator: 'GREATER_THAN',
            threshold: 100,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: alertEmail ? [{ subscriptionType: 'EMAIL', address: alertEmail }] : [],
        },
      ],
    });

    // =========================================================================
    // CloudWatch Dashboard
    // =========================================================================
    this.dashboard = new cloudwatch.Dashboard(this, 'BobbleGenesisDashboard', {
      dashboardName: `${prefix}-bobble-genesis`,
    });

    // Row 1: Health Overview
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# Bobble Genesis Monitoring\nReal-time consciousness health and safety metrics',
        width: 24,
        height: 1,
      })
    );

    // Row 2: Key Metrics
    this.dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'Risk Score',
        metrics: [riskScoreMetric],
        width: 6,
        height: 4,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Intervention Level',
        metrics: [interventionLevelMetric],
        width: 6,
        height: 4,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Open Circuit Breakers',
        metrics: [circuitBreakerOpenMetric],
        width: 6,
        height: 4,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Hourly Cost ($)',
        metrics: [cognitiveTickCostMetric],
        width: 6,
        height: 4,
      })
    );

    // Row 3: Circuit Breaker Status
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Circuit Breaker States',
        left: [
          new cloudwatch.Metric({
            namespace,
            metricName: 'CircuitBreakerMasterSanity',
            dimensionsMap: { State: 'OPEN' },
            label: 'Master Sanity',
          }),
          new cloudwatch.Metric({
            namespace,
            metricName: 'CircuitBreakerCostBudget',
            dimensionsMap: { State: 'OPEN' },
            label: 'Cost Budget',
          }),
          new cloudwatch.Metric({
            namespace,
            metricName: 'CircuitBreakerHighAnxiety',
            dimensionsMap: { State: 'OPEN' },
            label: 'High Anxiety',
          }),
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Neurochemistry',
        left: [
          new cloudwatch.Metric({
            namespace,
            metricName: 'NeurochemistryAnxiety',
            dimensionsMap: { Environment: environment },
            label: 'Anxiety',
          }),
          new cloudwatch.Metric({
            namespace,
            metricName: 'NeurochemistryFatigue',
            dimensionsMap: { Environment: environment },
            label: 'Fatigue',
          }),
          new cloudwatch.Metric({
            namespace,
            metricName: 'NeurochemistryCuriosity',
            dimensionsMap: { Environment: environment },
            label: 'Curiosity',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // Row 4: Costs and Ticks
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Cognitive Tick Costs',
        left: [cognitiveTickCostMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Risk Score History',
        left: [riskScoreMetric],
        width: 12,
        height: 6,
      })
    );

    // Row 5: Alarm Status
    this.dashboard.addWidgets(
      new cloudwatch.AlarmStatusWidget({
        title: 'Alarm Status',
        alarms: [
          masterSanityAlarm,
          highRiskAlarm,
          costBreakerAlarm,
          anxietyAlarm,
          hibernateAlarm,
        ],
        width: 24,
        height: 3,
      })
    );

    // =========================================================================
    // Outputs
    // =========================================================================
    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: this.alertTopic.topicArn,
      description: 'SNS topic ARN for Bobble alerts',
      exportName: `${prefix}-bobble-alert-topic-arn`,
    });

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${prefix}-bobble-genesis`,
      description: 'CloudWatch Dashboard URL',
    });
  }
}
