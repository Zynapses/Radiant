// RADIANT v4.18.0 - Log Retention Infrastructure Stack
// S3 buckets for log archives/reports/exports, EventBridge hourly indexer,
// admin API Lambda, and KMS encryption

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface LogRetentionStackProps extends cdk.StackProps {
  environment: string;
  databaseSecretArn: string;
  databaseClusterArn: string;
}

export class LogRetentionStack extends cdk.Stack {
  public readonly archiveBucket: s3.Bucket;
  public readonly reportBucket: s3.Bucket;
  public readonly exportBucket: s3.Bucket;
  public readonly indexerLambda: lambda.Function;
  public readonly adminLambda: lambda.Function;
  public readonly encryptionKey: kms.Key;

  constructor(scope: Construct, id: string, props: LogRetentionStackProps) {
    super(scope, id, props);

    const env = props.environment;

    // =========================================================================
    // KMS Key for log encryption
    // =========================================================================

    this.encryptionKey = new kms.Key(this, 'LogEncryptionKey', {
      alias: `radiant-log-encryption-${env}`,
      description: 'KMS key for encrypting log archives, reports, and exports',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // =========================================================================
    // S3 Bucket: Log Archives (hot → warm → cold → deep archive)
    // =========================================================================

    this.archiveBucket = new s3.Bucket(this, 'LogArchiveBucket', {
      bucketName: `radiant-log-archives-${env}-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.encryptionKey,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'warm-to-glacier',
          prefix: 'logs/',
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
            {
              storageClass: s3.StorageClass.DEEP_ARCHIVE,
              transitionAfter: cdk.Duration.days(365 * 7),
            },
          ],
        },
        {
          id: 'restored-expiry',
          prefix: 'restored/',
          expiration: cdk.Duration.days(14),
        },
      ],
    });

    // =========================================================================
    // S3 Bucket: Reports
    // =========================================================================

    this.reportBucket = new s3.Bucket(this, 'LogReportBucket', {
      bucketName: `radiant-log-reports-${env}-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'archive-old-reports',
          transitions: [
            { storageClass: s3.StorageClass.INFREQUENT_ACCESS, transitionAfter: cdk.Duration.days(90) },
            { storageClass: s3.StorageClass.GLACIER, transitionAfter: cdk.Duration.days(365) },
          ],
        },
      ],
    });

    // =========================================================================
    // S3 Bucket: Exports (temporary download files)
    // =========================================================================

    this.exportBucket = new s3.Bucket(this, 'LogExportBucket', {
      bucketName: `radiant-log-exports-${env}-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          id: 'expire-exports',
          expiration: cdk.Duration.days(7),
        },
      ],
    });

    // =========================================================================
    // Lambda: Hourly Log Indexer
    // =========================================================================

    this.indexerLambda = new lambda.Function(this, 'LogIndexerLambda', {
      functionName: `radiant-log-indexer-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'scheduled/log-indexer.handler',
      code: lambda.Code.fromAsset('lambda'),
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: {
        ENVIRONMENT: env,
        DATABASE_SECRET_ARN: props.databaseSecretArn,
        DATABASE_CLUSTER_ARN: props.databaseClusterArn,
        LOG_ARCHIVE_BUCKET: this.archiveBucket.bucketName,
        LOG_REPORT_BUCKET: this.reportBucket.bucketName,
        LOG_EXPORT_BUCKET: this.exportBucket.bucketName,
      },
      description: 'Hourly log indexer — scans sources, archives to S3/Glacier, writes index pointers, transitions tiers',
    });

    // Grant S3 access
    this.archiveBucket.grantReadWrite(this.indexerLambda);
    this.reportBucket.grantReadWrite(this.indexerLambda);
    this.encryptionKey.grantEncryptDecrypt(this.indexerLambda);

    // Grant database access
    this.indexerLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [props.databaseSecretArn],
    }));
    this.indexerLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['rds-data:ExecuteStatement', 'rds-data:BatchExecuteStatement'],
      resources: [props.databaseClusterArn],
    }));

    // Grant CloudWatch Logs read access (for log source discovery)
    this.indexerLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:DescribeLogGroups',
        'logs:DescribeLogStreams',
        'logs:GetLogEvents',
        'logs:FilterLogEvents',
      ],
      resources: ['*'],
    }));

    // Grant Glacier access for tier transitions
    this.indexerLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:RestoreObject',
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
      ],
      resources: [
        this.archiveBucket.arnForObjects('*'),
      ],
    }));

    // =========================================================================
    // Lambda: Admin API
    // =========================================================================

    this.adminLambda = new lambda.Function(this, 'LogRetentionAdminLambda', {
      functionName: `radiant-log-retention-admin-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'admin/log-retention.handler',
      code: lambda.Code.fromAsset('lambda'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        ENVIRONMENT: env,
        DATABASE_SECRET_ARN: props.databaseSecretArn,
        DATABASE_CLUSTER_ARN: props.databaseClusterArn,
        LOG_ARCHIVE_BUCKET: this.archiveBucket.bucketName,
        LOG_REPORT_BUCKET: this.reportBucket.bucketName,
        LOG_EXPORT_BUCKET: this.exportBucket.bucketName,
      },
      description: 'Log retention admin API — dashboard, reports, restore, export, verification, erasure',
    });

    // Grant all bucket access to admin Lambda
    this.archiveBucket.grantReadWrite(this.adminLambda);
    this.reportBucket.grantReadWrite(this.adminLambda);
    this.exportBucket.grantReadWrite(this.adminLambda);
    this.encryptionKey.grantEncryptDecrypt(this.adminLambda);

    // Grant database access
    this.adminLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [props.databaseSecretArn],
    }));
    this.adminLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['rds-data:ExecuteStatement', 'rds-data:BatchExecuteStatement'],
      resources: [props.databaseClusterArn],
    }));

    // Grant Glacier restore access
    this.adminLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:RestoreObject', 's3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:HeadObject'],
      resources: [this.archiveBucket.arnForObjects('*')],
    }));

    // =========================================================================
    // EventBridge: Hourly Indexer Schedule
    // =========================================================================

    const hourlyIndexerRule = new events.Rule(this, 'HourlyIndexerRule', {
      ruleName: `radiant-log-indexer-hourly-${env}`,
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      description: 'Hourly log indexer — scans sources, archives, transitions tiers',
      enabled: true,
    });
    hourlyIndexerRule.addTarget(new targets.LambdaFunction(this.indexerLambda, {
      retryAttempts: 2,
    }));

    // =========================================================================
    // Outputs
    // =========================================================================

    new cdk.CfnOutput(this, 'ArchiveBucketName', {
      value: this.archiveBucket.bucketName,
      description: 'Log archive S3 bucket',
      exportName: `radiant-log-archive-bucket-${env}`,
    });

    new cdk.CfnOutput(this, 'ReportBucketName', {
      value: this.reportBucket.bucketName,
      description: 'Log report S3 bucket',
      exportName: `radiant-log-report-bucket-${env}`,
    });

    new cdk.CfnOutput(this, 'ExportBucketName', {
      value: this.exportBucket.bucketName,
      description: 'Log export S3 bucket',
      exportName: `radiant-log-export-bucket-${env}`,
    });

    new cdk.CfnOutput(this, 'IndexerLambdaArn', {
      value: this.indexerLambda.functionArn,
      description: 'Hourly log indexer Lambda ARN',
      exportName: `radiant-log-indexer-lambda-${env}`,
    });

    new cdk.CfnOutput(this, 'AdminLambdaArn', {
      value: this.adminLambda.functionArn,
      description: 'Log retention admin API Lambda ARN',
      exportName: `radiant-log-retention-admin-lambda-${env}`,
    });

    new cdk.CfnOutput(this, 'EncryptionKeyArn', {
      value: this.encryptionKey.keyArn,
      description: 'Log encryption KMS key ARN',
      exportName: `radiant-log-encryption-key-${env}`,
    });
  }
}
