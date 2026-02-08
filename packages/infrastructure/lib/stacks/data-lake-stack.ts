/**
 * RADIANT v4.18.0 - Data Lake Infrastructure Stack
 *
 * Zero-DB-write pipeline: Kinesis Firehose → S3 Parquet → Glue → Athena
 *
 * Resources:
 *   - S3 Data Lake Bucket (Intelligent-Tiering + lifecycle to Glacier/Deep Archive)
 *   - S3 Athena Results Bucket
 *   - Kinesis Data Firehose delivery streams (high-volume + grouped)
 *   - AWS Glue Database + Crawler
 *   - Athena Workgroup with per-query cost limits
 *   - SQS Dead-Letter Queue for failed Firehose records
 *   - Lambda: Lifecycle Manager (hourly)
 *   - Lambda: Retention Reconciler (SQS-triggered)
 *   - Lambda: DLQ Processor (retries failed events)
 *   - KMS encryption key
 *   - IAM roles and policies
 *   - CloudWatch alarms
 */

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as athena from 'aws-cdk-lib/aws-athena';
import * as firehose from 'aws-cdk-lib/aws-kinesisfirehose';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface DataLakeStackProps extends cdk.StackProps {
  environment: string;
  databaseSecretArn: string;
  databaseClusterArn: string;
  alarmTopicArn?: string;
}

// High-volume data types get dedicated Firehose streams
const DEDICATED_STREAMS = [
  'ai_invocation',
  'drift_telemetry',
  'application_log',
  'infrastructure_metric',
];

// Grouped streams for lower-volume types
const GROUPED_STREAMS = [
  'audit',        // audit_log, license_audit, log_retention_audit, uds_audit, system_admin_audit
  'security',     // security_event, intrusion_event, lockout_event
  'compliance',   // compliance_event, guest_restriction
  'billing',      // billing_event, cost_attribution, storage_event
  'collaboration',// collaboration_event
  'error',        // error_log
  'delight',      // delight_event
  'brain',        // brain_plan
];

export class DataLakeStack extends cdk.Stack {
  public readonly dataLakeBucket: s3.Bucket;
  public readonly athenaResultsBucket: s3.Bucket;
  public readonly encryptionKey: kms.Key;
  public readonly dlq: sqs.Queue;
  public readonly reconcilerQueue: sqs.Queue;
  public readonly lifecycleManagerLambda: lambda.Function;
  public readonly reconcilerLambda: lambda.Function;
  public readonly dlqProcessorLambda: lambda.Function;
  public readonly glueDatabase: glue.CfnDatabase;

  constructor(scope: Construct, id: string, props: DataLakeStackProps) {
    super(scope, id, props);

    const env = props.environment;
    const isProd = env === 'prod';

    // =========================================================================
    // KMS Key
    // =========================================================================

    this.encryptionKey = new kms.Key(this, 'DataLakeKey', {
      alias: `radiant-data-lake-${env}`,
      description: 'KMS key for data lake encryption (S3, Firehose, SQS)',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // =========================================================================
    // S3: Data Lake Bucket (Intelligent-Tiering + Glacier lifecycle)
    // =========================================================================

    this.dataLakeBucket = new s3.Bucket(this, 'DataLakeBucket', {
      bucketName: `radiant-data-lake-${env}-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.encryptionKey,
      versioned: false, // Parquet files are immutable; versioning is unnecessary
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      // Object Lock enabled for compliance data
      objectLockEnabled: isProd,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
      intelligentTieringConfigurations: [
        {
          name: 'DataLakeTiering',
          archiveAccessTierTime: cdk.Duration.days(90),
          deepArchiveAccessTierTime: cdk.Duration.days(180),
        },
      ],
      lifecycleRules: [
        {
          id: 'transition-to-glacier',
          prefix: 'data/',
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(0), // Immediate IT
            },
          ],
        },
        {
          id: 'expire-athena-temp',
          prefix: 'temp/',
          expiration: cdk.Duration.days(1),
        },
        {
          id: 'abort-incomplete-uploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],
    });

    // =========================================================================
    // S3: Athena Results Bucket
    // =========================================================================

    this.athenaResultsBucket = new s3.Bucket(this, 'AthenaResultsBucket', {
      bucketName: `radiant-athena-results-${env}-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          id: 'expire-results',
          expiration: cdk.Duration.days(7),
        },
      ],
    });

    // =========================================================================
    // SQS: Dead-Letter Queue for failed Firehose records
    // =========================================================================

    this.dlq = new sqs.Queue(this, 'DataLakeDLQ', {
      queueName: `radiant-data-lake-dlq-${env}`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: this.encryptionKey,
      visibilityTimeout: cdk.Duration.minutes(5),
    });

    // =========================================================================
    // SQS: Retention Reconciler Queue (triggered by license changes)
    // =========================================================================

    this.reconcilerQueue = new sqs.Queue(this, 'ReconcilerQueue', {
      queueName: `radiant-retention-reconciler-${env}`,
      retentionPeriod: cdk.Duration.days(3),
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: this.encryptionKey,
      visibilityTimeout: cdk.Duration.minutes(15),
      deadLetterQueue: {
        queue: this.dlq,
        maxReceiveCount: 3,
      },
    });

    // =========================================================================
    // Glue Database
    // =========================================================================

    this.glueDatabase = new glue.CfnDatabase(this, 'GlueDatabase', {
      catalogId: this.account,
      databaseInput: {
        name: `radiant_data_lake_${env}`,
        description: 'RADIANT data lake — partitioned Parquet tables for all log/audit/telemetry data',
      },
    });

    // =========================================================================
    // Glue Crawler (daily partition discovery)
    // =========================================================================

    const crawlerRole = new iam.Role(this, 'GlueCrawlerRole', {
      assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
      ],
    });

    this.dataLakeBucket.grantRead(crawlerRole);
    this.encryptionKey.grantDecrypt(crawlerRole);

    new glue.CfnCrawler(this, 'DataLakeCrawler', {
      name: `radiant-data-lake-crawler-${env}`,
      role: crawlerRole.roleArn,
      databaseName: `radiant_data_lake_${env}`,
      targets: {
        s3Targets: [
          { path: `s3://${this.dataLakeBucket.bucketName}/data/` },
        ],
      },
      schedule: { scheduleExpression: 'cron(0 2 * * ? *)' }, // Daily at 2 AM UTC
      schemaChangePolicy: {
        updateBehavior: 'UPDATE_IN_DATABASE',
        deleteBehavior: 'LOG',
      },
      recrawlPolicy: { recrawlBehavior: 'CRAWL_NEW_FOLDERS_ONLY' },
      configuration: JSON.stringify({
        Version: 1.0,
        Grouping: { TableGroupingPolicy: 'CombineCompatibleSchemas' },
        CrawlerOutput: {
          Partitions: { AddOrUpdateBehavior: 'InheritFromTable' },
        },
      }),
    });

    // =========================================================================
    // Athena Workgroup
    // =========================================================================

    new athena.CfnWorkGroup(this, 'AthenaWorkgroup', {
      name: `radiant-data-lake-${env}`,
      state: 'ENABLED',
      workGroupConfiguration: {
        resultConfiguration: {
          outputLocation: `s3://${this.athenaResultsBucket.bucketName}/query-results/`,
          encryptionConfiguration: {
            encryptionOption: 'SSE_KMS',
            kmsKey: this.encryptionKey.keyArn,
          },
        },
        enforceWorkGroupConfiguration: true,
        publishCloudWatchMetricsEnabled: true,
        bytesScannedCutoffPerQuery: isProd ? 10737418240 : 1073741824, // 10GB prod, 1GB dev
        engineVersion: { selectedEngineVersion: 'Athena engine version 3' },
      },
    });

    // =========================================================================
    // IAM Role for Firehose
    // =========================================================================

    const firehoseRole = new iam.Role(this, 'FirehoseRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
      description: 'Role for Kinesis Data Firehose to write to S3 data lake',
    });

    this.dataLakeBucket.grantReadWrite(firehoseRole);
    this.encryptionKey.grantEncryptDecrypt(firehoseRole);

    // Glue permissions for format conversion
    firehoseRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'glue:GetTable',
        'glue:GetTableVersion',
        'glue:GetTableVersions',
        'glue:GetDatabase',
      ],
      resources: [
        `arn:aws:glue:${this.region}:${this.account}:catalog`,
        `arn:aws:glue:${this.region}:${this.account}:database/radiant_data_lake_${env}`,
        `arn:aws:glue:${this.region}:${this.account}:table/radiant_data_lake_${env}/*`,
      ],
    }));

    // CloudWatch Logs for Firehose error logging
    firehoseRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['logs:PutLogEvents', 'logs:CreateLogGroup', 'logs:CreateLogStream'],
      resources: [`arn:aws:logs:${this.region}:${this.account}:*`],
    }));

    // =========================================================================
    // Kinesis Data Firehose: Dedicated streams for high-volume types
    // =========================================================================

    const firehoseStreams: Map<string, firehose.CfnDeliveryStream> = new Map();

    for (const streamKey of [...DEDICATED_STREAMS, ...GROUPED_STREAMS]) {
      const streamName = `radiant-data-lake-${streamKey}-${env}`;
      const stream = new firehose.CfnDeliveryStream(this, `Firehose-${streamKey}`, {
        deliveryStreamName: streamName,
        deliveryStreamType: 'DirectPut',
        extendedS3DestinationConfiguration: {
          bucketArn: this.dataLakeBucket.bucketArn,
          roleArn: firehoseRole.roleArn,
          prefix: `data/!{partitionKeyFromQuery:tenant_id}/!{partitionKeyFromQuery:data_type_key}/!{timestamp:yyyy}/!{timestamp:MM}/!{timestamp:dd}/!{timestamp:HH}/`,
          errorOutputPrefix: `errors/${streamKey}/!{firehose:error-output-type}/!{timestamp:yyyy}/!{timestamp:MM}/!{timestamp:dd}/`,
          bufferingHints: {
            intervalInSeconds: 60,
            sizeInMBs: DEDICATED_STREAMS.includes(streamKey) ? 128 : 64,
          },
          compressionFormat: 'UNCOMPRESSED', // Parquet handles its own compression
          encryptionConfiguration: {
            kmsEncryptionConfig: {
              awskmsKeyArn: this.encryptionKey.keyArn,
            },
          },
          cloudWatchLoggingOptions: {
            enabled: true,
            logGroupName: `/aws/kinesisfirehose/radiant-data-lake-${streamKey}-${env}`,
            logStreamName: 'S3Delivery',
          },
          dynamicPartitioningConfiguration: {
            enabled: true,
            retryOptions: { durationInSeconds: 300 },
          },
          processingConfiguration: {
            enabled: true,
            processors: [
              {
                type: 'MetadataExtraction',
                parameters: [
                  {
                    parameterName: 'MetadataExtractionQuery',
                    parameterValue: '{tenant_id:.tenant_id, data_type_key:.data_type_key}',
                  },
                  {
                    parameterName: 'JsonParsingEngine',
                    parameterValue: 'JQ-1.6',
                  },
                ],
              },
              {
                type: 'AppendDelimiterToRecord',
                parameters: [
                  { parameterName: 'Delimiter', parameterValue: '\\n' },
                ],
              },
            ],
          },
          dataFormatConversionConfiguration: {
            enabled: true,
            inputFormatConfiguration: {
              deserializer: {
                openXJsonSerDe: {},
              },
            },
            outputFormatConfiguration: {
              serializer: {
                parquetSerDe: {
                  compression: 'SNAPPY',
                  enableDictionaryCompression: true,
                  writerVersion: 'V2',
                },
              },
            },
            schemaConfiguration: {
              databaseName: `radiant_data_lake_${env}`,
              tableName: streamKey === 'audit' ? 'audit_logs' : `${streamKey.replace(/-/g, '_')}s`,
              roleArn: firehoseRole.roleArn,
              catalogId: this.account,
              region: this.region,
              versionId: 'LATEST',
            },
          },
          s3BackupMode: isProd ? 'Enabled' : 'Disabled',
          ...(isProd ? {
            s3BackupConfiguration: {
              bucketArn: this.dataLakeBucket.bucketArn,
              roleArn: firehoseRole.roleArn,
              prefix: `backup/${streamKey}/`,
              bufferingHints: { intervalInSeconds: 300, sizeInMBs: 128 },
              compressionFormat: 'GZIP',
              encryptionConfiguration: {
                kmsEncryptionConfig: { awskmsKeyArn: this.encryptionKey.keyArn },
              },
            },
          } : {}),
        },
      });

      firehoseStreams.set(streamKey, stream);
    }

    // =========================================================================
    // Lambda: Lifecycle Manager (hourly)
    // =========================================================================

    const lambdaEnvironment = {
      ENVIRONMENT: env,
      DATABASE_SECRET_ARN: props.databaseSecretArn,
      DATABASE_CLUSTER_ARN: props.databaseClusterArn,
      DATA_LAKE_BUCKET: this.dataLakeBucket.bucketName,
      GLUE_DATABASE: `radiant_data_lake_${env}`,
      ATHENA_WORKGROUP: `radiant-data-lake-${env}`,
      ATHENA_RESULTS_BUCKET: this.athenaResultsBucket.bucketName,
      DATA_LAKE_DLQ_URL: this.dlq.queueUrl,
    };

    this.lifecycleManagerLambda = new lambda.Function(this, 'LifecycleManagerLambda', {
      functionName: `radiant-data-lake-lifecycle-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'scheduled/data-lake-lifecycle.handler',
      code: lambda.Code.fromAsset('lambda'),
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: lambdaEnvironment,
      description: 'Hourly data lake lifecycle: partition discovery, tier transitions, expiry, Glacier deletions',
    });

    // Grant permissions
    this.dataLakeBucket.grantReadWrite(this.lifecycleManagerLambda);
    this.athenaResultsBucket.grantReadWrite(this.lifecycleManagerLambda);
    this.encryptionKey.grantEncryptDecrypt(this.lifecycleManagerLambda);
    this.dlq.grantSendMessages(this.lifecycleManagerLambda);

    this.lifecycleManagerLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [props.databaseSecretArn],
    }));
    this.lifecycleManagerLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['rds-data:ExecuteStatement', 'rds-data:BatchExecuteStatement'],
      resources: [props.databaseClusterArn],
    }));
    this.lifecycleManagerLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'glue:GetTable', 'glue:GetDatabase', 'glue:CreatePartition',
        'glue:BatchCreatePartition', 'glue:GetPartitions',
      ],
      resources: ['*'],
    }));
    this.lifecycleManagerLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:PutObjectRetention', 's3:PutObjectLegalHold',
        's3:GetObjectRetention', 's3:GetObjectLegalHold',
        'glacier:DeleteArchive',
      ],
      resources: ['*'],
    }));
    this.lifecycleManagerLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
    }));

    // Schedule: hourly
    const lifecycleRule = new events.Rule(this, 'LifecycleHourlyRule', {
      ruleName: `radiant-data-lake-lifecycle-hourly-${env}`,
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      description: 'Hourly data lake lifecycle manager',
    });
    lifecycleRule.addTarget(new targets.LambdaFunction(this.lifecycleManagerLambda, {
      retryAttempts: 2,
    }));

    // =========================================================================
    // Lambda: Retention Reconciler (SQS-triggered)
    // =========================================================================

    this.reconcilerLambda = new lambda.Function(this, 'ReconcilerLambda', {
      functionName: `radiant-retention-reconciler-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'scheduled/retention-reconciler.handler',
      code: lambda.Code.fromAsset('lambda'),
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
      environment: lambdaEnvironment,
      description: 'Retention reconciler — triggered by compliance license changes or admin overrides',
    });

    this.dataLakeBucket.grantReadWrite(this.reconcilerLambda);
    this.encryptionKey.grantEncryptDecrypt(this.reconcilerLambda);

    this.reconcilerLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [props.databaseSecretArn],
    }));
    this.reconcilerLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['rds-data:ExecuteStatement', 'rds-data:BatchExecuteStatement'],
      resources: [props.databaseClusterArn],
    }));
    this.reconcilerLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:PutObjectRetention', 's3:PutObjectLegalHold', 'glacier:DeleteArchive'],
      resources: ['*'],
    }));

    // SQS trigger
    this.reconcilerLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(this.reconcilerQueue, {
        batchSize: 1,
        maxConcurrency: 5,
      })
    );

    // =========================================================================
    // Lambda: DLQ Processor (retries failed events)
    // =========================================================================

    this.dlqProcessorLambda = new lambda.Function(this, 'DLQProcessorLambda', {
      functionName: `radiant-data-lake-dlq-processor-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'scheduled/data-lake-dlq-processor.handler',
      code: lambda.Code.fromAsset('lambda'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      environment: {
        ...lambdaEnvironment,
        DATA_LAKE_FIREHOSE_PREFIX: `radiant-data-lake`,
      },
      description: 'Processes failed events from the data lake DLQ, retries to Firehose',
    });

    // Grant Firehose write permissions
    this.dlqProcessorLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['firehose:PutRecord', 'firehose:PutRecordBatch'],
      resources: [`arn:aws:firehose:${this.region}:${this.account}:deliverystream/radiant-data-lake-*`],
    }));
    this.encryptionKey.grantEncryptDecrypt(this.dlqProcessorLambda);

    // SQS trigger
    this.dlqProcessorLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(this.dlq, {
        batchSize: 10,
        maxConcurrency: 2,
      })
    );

    // =========================================================================
    // Grant Firehose access to all Lambdas that emit events
    // (This is a broad policy — in production, scope to specific functions)
    // =========================================================================

    const firehoseWritePolicy = new iam.ManagedPolicy(this, 'FirehoseWritePolicy', {
      managedPolicyName: `radiant-data-lake-firehose-write-${env}`,
      description: 'Allows Lambda functions to write to data lake Firehose streams',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['firehose:PutRecord', 'firehose:PutRecordBatch'],
          resources: [`arn:aws:firehose:${this.region}:${this.account}:deliverystream/radiant-data-lake-*`],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['sqs:SendMessage'],
          resources: [this.dlq.queueArn],
        }),
      ],
    });

    // =========================================================================
    // CloudWatch Alarms
    // =========================================================================

    if (isProd) {
      const alarmTopic = props.alarmTopicArn
        ? sns.Topic.fromTopicArn(this, 'AlarmTopic', props.alarmTopicArn)
        : undefined;

      // Lifecycle errors alarm
      const lifecycleErrorAlarm = new cloudwatch.Alarm(this, 'LifecycleErrorAlarm', {
        alarmName: `radiant-data-lake-lifecycle-errors-${env}`,
        metric: new cloudwatch.Metric({
          namespace: `RADIANT/DataLake/${env}`,
          metricName: 'LifecycleErrors',
          statistic: 'Sum',
          period: cdk.Duration.hours(1),
        }),
        threshold: 5,
        evaluationPeriods: 1,
        alarmDescription: 'Data lake lifecycle manager had errors in the last hour',
      });
      if (alarmTopic) {
        lifecycleErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));
      }

      // DLQ messages alarm
      const dlqAlarm = new cloudwatch.Alarm(this, 'DLQAlarm', {
        alarmName: `radiant-data-lake-dlq-${env}`,
        metric: this.dlq.metricApproximateNumberOfMessagesVisible({
          period: cdk.Duration.minutes(5),
        }),
        threshold: 100,
        evaluationPeriods: 3,
        alarmDescription: 'Data lake DLQ has accumulated messages — events may be failing',
      });
      if (alarmTopic) {
        dlqAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));
      }
    }

    // =========================================================================
    // Outputs
    // =========================================================================

    new cdk.CfnOutput(this, 'DataLakeBucketName', {
      value: this.dataLakeBucket.bucketName,
      exportName: `radiant-data-lake-bucket-${env}`,
    });
    new cdk.CfnOutput(this, 'AthenaResultsBucketName', {
      value: this.athenaResultsBucket.bucketName,
      exportName: `radiant-athena-results-bucket-${env}`,
    });
    new cdk.CfnOutput(this, 'GlueDatabaseName', {
      value: `radiant_data_lake_${env}`,
      exportName: `radiant-glue-database-${env}`,
    });
    new cdk.CfnOutput(this, 'DLQUrl', {
      value: this.dlq.queueUrl,
      exportName: `radiant-data-lake-dlq-url-${env}`,
    });
    new cdk.CfnOutput(this, 'ReconcilerQueueUrl', {
      value: this.reconcilerQueue.queueUrl,
      exportName: `radiant-reconciler-queue-url-${env}`,
    });
    new cdk.CfnOutput(this, 'FirehoseWritePolicyArn', {
      value: firehoseWritePolicy.managedPolicyArn,
      exportName: `radiant-firehose-write-policy-arn-${env}`,
    });
    new cdk.CfnOutput(this, 'EncryptionKeyArn', {
      value: this.encryptionKey.keyArn,
      exportName: `radiant-data-lake-kms-key-${env}`,
    });

    // Stream ARN outputs
    for (const [key, stream] of firehoseStreams) {
      new cdk.CfnOutput(this, `FirehoseArn-${key}`, {
        value: stream.attrArn,
        exportName: `radiant-firehose-${key.replace(/_/g, '-')}-arn-${env}`,
      });
    }
  }
}
