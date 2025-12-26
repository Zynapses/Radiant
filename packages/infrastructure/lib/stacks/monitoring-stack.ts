import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';

interface MonitoringStackProps extends cdk.StackProps {
  appId: string;
  environment: string;
  alertEmail?: string;
}

export class MonitoringStack extends cdk.Stack {
  public readonly alertTopic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { appId, environment, alertEmail } = props;

    // SNS Topic for alerts
    this.alertTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: `${appId}-${environment}-alerts`,
      displayName: `RADIANT ${environment} Alerts`,
    });

    if (alertEmail) {
      this.alertTopic.addSubscription(
        new subscriptions.EmailSubscription(alertEmail)
      );
    }

    // Main Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `${appId}-${environment}-dashboard`,
    });

    // API Gateway Metrics
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# API Gateway',
        width: 24,
        height: 1,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Requests',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Count',
            dimensionsMap: { ApiName: `${appId}-${environment}-api` },
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          }),
        ],
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Latency',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Latency',
            dimensionsMap: { ApiName: `${appId}-${environment}-api` },
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Latency',
            dimensionsMap: { ApiName: `${appId}-${environment}-api` },
            statistic: 'p99',
            period: cdk.Duration.minutes(1),
          }),
        ],
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Errors',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '4XXError',
            dimensionsMap: { ApiName: `${appId}-${environment}-api` },
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '5XXError',
            dimensionsMap: { ApiName: `${appId}-${environment}-api` },
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          }),
        ],
        width: 8,
      })
    );

    // Lambda Metrics
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# Lambda Functions',
        width: 24,
        height: 1,
      })
    );

    const lambdaFunctions = [
      'router',
      'admin',
      'billing',
      'localization',
      'configuration',
    ];

    lambdaFunctions.forEach((fn) => {
      const functionName = `${appId}-${environment}-${fn}`;

      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: `${fn} - Invocations & Errors`,
          left: [
            new cloudwatch.Metric({
              namespace: 'AWS/Lambda',
              metricName: 'Invocations',
              dimensionsMap: { FunctionName: functionName },
              statistic: 'Sum',
              period: cdk.Duration.minutes(1),
            }),
          ],
          right: [
            new cloudwatch.Metric({
              namespace: 'AWS/Lambda',
              metricName: 'Errors',
              dimensionsMap: { FunctionName: functionName },
              statistic: 'Sum',
              period: cdk.Duration.minutes(1),
            }),
          ],
          width: 8,
        }),
        new cloudwatch.GraphWidget({
          title: `${fn} - Duration`,
          left: [
            new cloudwatch.Metric({
              namespace: 'AWS/Lambda',
              metricName: 'Duration',
              dimensionsMap: { FunctionName: functionName },
              statistic: 'Average',
              period: cdk.Duration.minutes(1),
            }),
            new cloudwatch.Metric({
              namespace: 'AWS/Lambda',
              metricName: 'Duration',
              dimensionsMap: { FunctionName: functionName },
              statistic: 'p99',
              period: cdk.Duration.minutes(1),
            }),
          ],
          width: 8,
        }),
        new cloudwatch.GraphWidget({
          title: `${fn} - Concurrent Executions`,
          left: [
            new cloudwatch.Metric({
              namespace: 'AWS/Lambda',
              metricName: 'ConcurrentExecutions',
              dimensionsMap: { FunctionName: functionName },
              statistic: 'Maximum',
              period: cdk.Duration.minutes(1),
            }),
          ],
          width: 8,
        })
      );
    });

    // Database Metrics
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# Aurora Database',
        width: 24,
        height: 1,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Database Connections',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'DatabaseConnections',
            dimensionsMap: { DBClusterIdentifier: `${appId}-${environment}` },
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
          }),
        ],
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        title: 'CPU Utilization',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'CPUUtilization',
            dimensionsMap: { DBClusterIdentifier: `${appId}-${environment}` },
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
          }),
        ],
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        title: 'Freeable Memory',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'FreeableMemory',
            dimensionsMap: { DBClusterIdentifier: `${appId}-${environment}` },
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
          }),
        ],
        width: 8,
      })
    );

    // Cognito Metrics
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# Authentication',
        width: 24,
        height: 1,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Sign-in Attempts',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/Cognito',
            metricName: 'SignInSuccesses',
            dimensionsMap: { UserPool: `${appId}-${environment}-users` },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/Cognito',
            metricName: 'SignInSuccesses',
            dimensionsMap: { UserPool: `${appId}-${environment}-admins` },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Token Refresh',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/Cognito',
            metricName: 'TokenRefreshSuccesses',
            dimensionsMap: { UserPool: `${appId}-${environment}-users` },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 12,
      })
    );

    // Create Alarms
    this.createAlarms(appId, environment);

    // Outputs
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${appId}-${environment}-dashboard`,
      description: 'CloudWatch Dashboard URL',
    });

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: this.alertTopic.topicArn,
      description: 'SNS Alert Topic ARN',
    });
  }

  private createAlarms(appId: string, environment: string): void {
    // API 5XX Error Rate Alarm
    const api5xxAlarm = new cloudwatch.Alarm(this, 'Api5xxAlarm', {
      alarmName: `${appId}-${environment}-api-5xx-errors`,
      alarmDescription: 'API Gateway 5XX error rate is high',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
        dimensionsMap: { ApiName: `${appId}-${environment}-api` },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    api5xxAlarm.addAlarmAction(new actions.SnsAction(this.alertTopic));

    // API Latency Alarm
    const apiLatencyAlarm = new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
      alarmName: `${appId}-${environment}-api-latency`,
      alarmDescription: 'API Gateway p99 latency is high',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Latency',
        dimensionsMap: { ApiName: `${appId}-${environment}-api` },
        statistic: 'p99',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5000, // 5 seconds
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    apiLatencyAlarm.addAlarmAction(new actions.SnsAction(this.alertTopic));

    // Database CPU Alarm
    const dbCpuAlarm = new cloudwatch.Alarm(this, 'DbCpuAlarm', {
      alarmName: `${appId}-${environment}-db-cpu`,
      alarmDescription: 'Database CPU utilization is high',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'CPUUtilization',
        dimensionsMap: { DBClusterIdentifier: `${appId}-${environment}` },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    dbCpuAlarm.addAlarmAction(new actions.SnsAction(this.alertTopic));

    // Database Connections Alarm
    const dbConnectionsAlarm = new cloudwatch.Alarm(this, 'DbConnectionsAlarm', {
      alarmName: `${appId}-${environment}-db-connections`,
      alarmDescription: 'Database connections are high',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'DatabaseConnections',
        dimensionsMap: { DBClusterIdentifier: `${appId}-${environment}` },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    dbConnectionsAlarm.addAlarmAction(new actions.SnsAction(this.alertTopic));

    // Lambda Error Rate Alarm (for router function)
    const lambdaErrorAlarm = new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
      alarmName: `${appId}-${environment}-lambda-errors`,
      alarmDescription: 'Lambda router function error rate is high',
      metric: new cloudwatch.MathExpression({
        expression: 'errors / invocations * 100',
        usingMetrics: {
          errors: new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Errors',
            dimensionsMap: { FunctionName: `${appId}-${environment}-router` },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
          invocations: new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Invocations',
            dimensionsMap: { FunctionName: `${appId}-${environment}-router` },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
        },
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5, // 5% error rate
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    lambdaErrorAlarm.addAlarmAction(new actions.SnsAction(this.alertTopic));
  }
}
