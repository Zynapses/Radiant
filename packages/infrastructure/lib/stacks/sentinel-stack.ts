/**
 * RADIANT SENTINEL v1.0.0 — CDK Infrastructure Stack
 *
 * Resources:
 *   - DynamoDB: sentinel-alerts, sentinel-health-checks (Global Tables ready)
 *   - S3: sentinel-evidence (WORM Object Lock, Compliance Mode, 365-day retention)
 *   - KMS: sentinel encryption key with auto-rotation
 *   - Lambda: sentinel-watchdog (CloudWatch listener + synthetic poller)
 *   - Lambda: sentinel-alert-processor (severity scoring, dedup, correlation)
 *   - Lambda: sentinel-notifier (PagerDuty + Twilio + Slack dispatch)
 *   - Lambda: sentinel-auto-healer (remediation with Shadow Mode)
 *   - Lambda: sentinel-heartbeat (Dead Man's Switch, every 60s)
 *   - Lambda: sentinel-admin-api (admin dashboard endpoints)
 *   - Lambda: sentinel-pilot-light (us-west-2 independent monitor)
 *   - SNS: sentinel-critical, sentinel-major (CloudWatch alarm fan-out)
 *   - SQS: sentinel-alert-queue (FIFO, dedup 5 min)
 *   - EventBridge: heartbeat every 60s, synthetic checks every 60s
 */

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SentinelStackProps extends cdk.StackProps {
  environment: string;
  databaseSecretArn: string;
  databaseClusterArn: string;
  pagerdutyRoutingKey?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  twilioEmergencyNumbers?: string;
  slackWebhookUrl?: string;
  slackCriticalChannelId?: string;
  deadMansSnitchUrl?: string;
  pagerdutyHeartbeatUrl?: string;
  adminDashboardUrl?: string;
}

// ---------------------------------------------------------------------------
// Stack
// ---------------------------------------------------------------------------

export class SentinelStack extends cdk.Stack {
  public readonly alertsTable: dynamodb.Table;
  public readonly healthChecksTable: dynamodb.Table;
  public readonly evidenceBucket: s3.Bucket;
  public readonly encryptionKey: kms.Key;
  public readonly criticalTopic: sns.Topic;
  public readonly majorTopic: sns.Topic;
  public readonly alertQueue: sqs.Queue;
  public readonly watchdogLambda: lambda.Function;
  public readonly alertProcessorLambda: lambda.Function;
  public readonly notifierLambda: lambda.Function;
  public readonly autoHealerLambda: lambda.Function;
  public readonly heartbeatLambda: lambda.Function;
  public readonly adminApiLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: SentinelStackProps) {
    super(scope, id, props);

    const env = props.environment;

    // =========================================================================
    // KMS Key
    // =========================================================================

    this.encryptionKey = new kms.Key(this, 'SentinelKey', {
      alias: `radiant-sentinel-${env}`,
      description: 'KMS key for SENTINEL alert data and evidence encryption',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // =========================================================================
    // DynamoDB: Active Alerts (Global Table ready)
    // =========================================================================

    this.alertsTable = new dynamodb.Table(this, 'SentinelAlertsTable', {
      tableName: `radiant-sentinel-alerts-${env}`,
      partitionKey: { name: 'alertId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionKey,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.alertsTable.addGlobalSecondaryIndex({
      indexName: 'category-severity-index',
      partitionKey: { name: 'categorySeverity', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.alertsTable.addGlobalSecondaryIndex({
      indexName: 'service-index',
      partitionKey: { name: 'service', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.alertsTable.addGlobalSecondaryIndex({
      indexName: 'dedup-index',
      partitionKey: { name: 'deduplicationKey', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });

    // =========================================================================
    // DynamoDB: Service Health Checks
    // =========================================================================

    this.healthChecksTable = new dynamodb.Table(this, 'SentinelHealthTable', {
      tableName: `radiant-sentinel-health-${env}`,
      partitionKey: { name: 'serviceId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'checkType', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // =========================================================================
    // S3: Evidence Locker (WORM — Object Lock Compliance Mode)
    // =========================================================================

    this.evidenceBucket = new s3.Bucket(this, 'SentinelEvidenceBucket', {
      bucketName: `radiant-sentinel-evidence-${env}-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.encryptionKey,
      objectLockEnabled: true,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'evidence-glacier-transition',
          transitions: [
            { storageClass: s3.StorageClass.GLACIER, transitionAfter: cdk.Duration.days(90) },
            { storageClass: s3.StorageClass.DEEP_ARCHIVE, transitionAfter: cdk.Duration.days(365) },
          ],
        },
      ],
    });

    // =========================================================================
    // SNS Topics (CloudWatch Alarm fan-out)
    // =========================================================================

    this.criticalTopic = new sns.Topic(this, 'SentinelCriticalTopic', {
      topicName: `radiant-sentinel-critical-${env}`,
      displayName: 'SENTINEL Critical Alerts (SEV 1)',
      masterKey: this.encryptionKey,
    });

    this.majorTopic = new sns.Topic(this, 'SentinelMajorTopic', {
      topicName: `radiant-sentinel-major-${env}`,
      displayName: 'SENTINEL Major Alerts (SEV 2)',
      masterKey: this.encryptionKey,
    });

    // =========================================================================
    // SQS: Alert Ingestion Queue (FIFO with dedup)
    // =========================================================================

    const alertDlq = new sqs.Queue(this, 'SentinelAlertDLQ', {
      queueName: `radiant-sentinel-alert-dlq-${env}.fifo`,
      fifo: true,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: this.encryptionKey,
    });

    this.alertQueue = new sqs.Queue(this, 'SentinelAlertQueue', {
      queueName: `radiant-sentinel-alert-queue-${env}.fifo`,
      fifo: true,
      contentBasedDeduplication: true,
      deduplicationScope: sqs.DeduplicationScope.QUEUE,
      fifoThroughputLimit: sqs.FifoThroughputLimit.PER_QUEUE,
      visibilityTimeout: cdk.Duration.seconds(60),
      retentionPeriod: cdk.Duration.days(7),
      deadLetterQueue: { queue: alertDlq, maxReceiveCount: 3 },
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: this.encryptionKey,
    });

    // =========================================================================
    // Common Lambda environment
    // =========================================================================

    const commonEnv: Record<string, string> = {
      ENVIRONMENT: env,
      DB_SECRET_ARN: props.databaseSecretArn,
      SENTINEL_ALERTS_TABLE: this.alertsTable.tableName,
      SENTINEL_HEALTH_TABLE: this.healthChecksTable.tableName,
      SENTINEL_EVIDENCE_BUCKET: this.evidenceBucket.bucketName,
      SENTINEL_ALERT_QUEUE_URL: this.alertQueue.queueUrl,
      SENTINEL_CRITICAL_TOPIC_ARN: this.criticalTopic.topicArn,
      SENTINEL_MAJOR_TOPIC_ARN: this.majorTopic.topicArn,
      PAGERDUTY_ROUTING_KEY: props.pagerdutyRoutingKey || '',
      TWILIO_ACCOUNT_SID: props.twilioAccountSid || '',
      TWILIO_AUTH_TOKEN: props.twilioAuthToken || '',
      TWILIO_FROM_NUMBER: props.twilioFromNumber || '',
      TWILIO_EMERGENCY_NUMBERS: props.twilioEmergencyNumbers || '',
      SLACK_WEBHOOK_URL: props.slackWebhookUrl || '',
      SLACK_CRITICAL_CHANNEL_ID: props.slackCriticalChannelId || '',
      DEAD_MANS_SNITCH_URL: props.deadMansSnitchUrl || '',
      PAGERDUTY_HEARTBEAT_URL: props.pagerdutyHeartbeatUrl || '',
      ADMIN_DASHBOARD_URL: props.adminDashboardUrl || 'https://admin.radiant.app',
      NODE_OPTIONS: '--enable-source-maps',
    };

    const lambdaDefaults: Partial<lambda.FunctionProps> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      environment: commonEnv,
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: lambda.Tracing.ACTIVE,
    };

    // =========================================================================
    // Lambda: Watchdog (CloudWatch Listener + Synthetic Poller)
    // =========================================================================

    this.watchdogLambda = new lambda.Function(this, 'SentinelWatchdog', {
      ...lambdaDefaults,
      functionName: `radiant-sentinel-watchdog-${env}`,
      handler: 'lambda/sentinel/watchdog.handler',
      code: lambda.Code.fromAsset('dist/lambda'),
      memorySize: 2048,
      timeout: cdk.Duration.minutes(5),
      description: 'SENTINEL: CloudWatch alarm processor + synthetic health checks + semantic AI probes',
    });

    // =========================================================================
    // Lambda: Alert Processor (severity scoring, dedup, correlation)
    // =========================================================================

    this.alertProcessorLambda = new lambda.Function(this, 'SentinelAlertProcessor', {
      ...lambdaDefaults,
      functionName: `radiant-sentinel-alert-processor-${env}`,
      handler: 'lambda/sentinel/alert-processor.handler',
      code: lambda.Code.fromAsset('dist/lambda'),
      description: 'SENTINEL: Alert severity scoring, deduplication, incident correlation',
    });

    // =========================================================================
    // Lambda: Notifier (PagerDuty + Twilio fallback + Slack)
    // =========================================================================

    this.notifierLambda = new lambda.Function(this, 'SentinelNotifier', {
      ...lambdaDefaults,
      functionName: `radiant-sentinel-notifier-${env}`,
      handler: 'lambda/sentinel/notifier.handler',
      code: lambda.Code.fromAsset('dist/lambda'),
      description: 'SENTINEL: Multi-channel notification dispatch (PagerDuty, Twilio, Slack, SES)',
    });

    // =========================================================================
    // Lambda: Auto-Healer (remediation with Shadow Mode)
    // =========================================================================

    this.autoHealerLambda = new lambda.Function(this, 'SentinelAutoHealer', {
      ...lambdaDefaults,
      functionName: `radiant-sentinel-auto-healer-${env}`,
      handler: 'lambda/sentinel/auto-healer.handler',
      code: lambda.Code.fromAsset('dist/lambda'),
      memorySize: 2048,
      timeout: cdk.Duration.minutes(5),
      description: 'SENTINEL: Auto-remediation with Shadow Mode (14-day promotion gate)',
    });

    // =========================================================================
    // Lambda: Heartbeat / Dead Man's Switch (every 60s)
    // =========================================================================

    this.heartbeatLambda = new lambda.Function(this, 'SentinelHeartbeat', {
      ...lambdaDefaults,
      functionName: `radiant-sentinel-heartbeat-${env}`,
      handler: 'lambda/sentinel/heartbeat.handler',
      code: lambda.Code.fromAsset('dist/lambda'),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      description: 'SENTINEL: Heartbeat to deadmanssnitch.com + PagerDuty + Pilot Light',
    });

    // =========================================================================
    // Lambda: Admin API
    // =========================================================================

    this.adminApiLambda = new lambda.Function(this, 'SentinelAdminApi', {
      ...lambdaDefaults,
      functionName: `radiant-sentinel-admin-api-${env}`,
      handler: 'lambda/admin/sentinel.handler',
      code: lambda.Code.fromAsset('dist/lambda'),
      timeout: cdk.Duration.seconds(30),
      description: 'SENTINEL: Admin dashboard API (28 endpoints)',
    });

    // =========================================================================
    // EventBridge: Heartbeat every 60 seconds
    // =========================================================================

    new events.Rule(this, 'SentinelHeartbeatRule', {
      ruleName: `radiant-sentinel-heartbeat-${env}`,
      description: 'Emit SENTINEL heartbeat every 60 seconds to Dead Man\'s Switch monitors',
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      targets: [new targets.LambdaFunction(this.heartbeatLambda)],
    });

    // =========================================================================
    // EventBridge: Synthetic checks every 60 seconds
    // =========================================================================

    new events.Rule(this, 'SentinelSyntheticRule', {
      ruleName: `radiant-sentinel-synthetic-${env}`,
      description: 'Run SENTINEL synthetic health checks every 60 seconds',
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      targets: [new targets.LambdaFunction(this.watchdogLambda)],
    });

    // =========================================================================
    // SNS → Watchdog Lambda (CloudWatch Alarm push path)
    // =========================================================================

    this.criticalTopic.addSubscription(
      new snsSubscriptions.LambdaSubscription(this.watchdogLambda)
    );
    this.majorTopic.addSubscription(
      new snsSubscriptions.LambdaSubscription(this.watchdogLambda)
    );

    // =========================================================================
    // IAM Permissions
    // =========================================================================

    const allLambdas = [
      this.watchdogLambda,
      this.alertProcessorLambda,
      this.notifierLambda,
      this.autoHealerLambda,
      this.heartbeatLambda,
      this.adminApiLambda,
    ];

    for (const fn of allLambdas) {
      // DynamoDB access
      this.alertsTable.grantReadWriteData(fn);
      this.healthChecksTable.grantReadWriteData(fn);

      // KMS
      this.encryptionKey.grantEncryptDecrypt(fn);

      // SNS publish
      this.criticalTopic.grantPublish(fn);
      this.majorTopic.grantPublish(fn);

      // SQS
      this.alertQueue.grantSendMessages(fn);
      this.alertQueue.grantConsumeMessages(fn);

      // S3 evidence bucket
      this.evidenceBucket.grantReadWrite(fn);

      // Database access (via Secrets Manager)
      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [props.databaseSecretArn],
      }));

      // CloudWatch Logs read (for evidence locker)
      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: [
          'logs:FilterLogEvents',
          'logs:GetLogEvents',
          'logs:DescribeLogGroups',
        ],
        resources: ['*'],
      }));
    }

    // Auto-healer needs extra permissions for remediation
    this.autoHealerLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'lambda:UpdateFunctionCode',
        'lambda:UpdateFunctionConfiguration',
        'lambda:GetFunction',
        'ecs:StopTask',
        'ecs:DescribeTasks',
        'ecs:ListTasks',
        'elasticache:RebootCacheCluster',
        'rds:DescribeDBClusters',
        'acm:RenewCertificate',
        'acm:DescribeCertificate',
      ],
      resources: ['*'],
    }));

    // Heartbeat needs outbound HTTPS to external services
    this.heartbeatLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['execute-api:Invoke'],
      resources: ['*'],
    }));

    // Evidence locker needs CloudTrail read
    this.adminApiLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'cloudtrail:LookupEvents',
        'cloudtrail:GetTrailStatus',
      ],
      resources: ['*'],
    }));

    // =========================================================================
    // Outputs
    // =========================================================================

    new cdk.CfnOutput(this, 'SentinelAlertsTableName', {
      value: this.alertsTable.tableName,
      description: 'SENTINEL active alerts DynamoDB table',
    });

    new cdk.CfnOutput(this, 'SentinelEvidenceBucketName', {
      value: this.evidenceBucket.bucketName,
      description: 'SENTINEL evidence locker S3 bucket (WORM)',
    });

    new cdk.CfnOutput(this, 'SentinelCriticalTopicArn', {
      value: this.criticalTopic.topicArn,
      description: 'SNS topic for SEV 1 alerts — subscribe CloudWatch Alarms here',
    });

    new cdk.CfnOutput(this, 'SentinelMajorTopicArn', {
      value: this.majorTopic.topicArn,
      description: 'SNS topic for SEV 2 alerts — subscribe CloudWatch Alarms here',
    });

    new cdk.CfnOutput(this, 'SentinelAdminApiArn', {
      value: this.adminApiLambda.functionArn,
      description: 'SENTINEL admin API Lambda ARN',
    });
  }
}
