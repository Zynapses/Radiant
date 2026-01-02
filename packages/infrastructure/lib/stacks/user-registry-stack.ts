/**
 * RADIANT v4.18.0 - User Registry CDK Stack
 * 
 * Infrastructure for multi-application user registry including:
 * - DynamoDB tables for Cognito token enrichment
 * - S3 bucket with Object Lock for audit logs
 * - KMS key for audit log encryption
 * - Kinesis Firehose for audit log delivery
 * - CloudWatch subscription filters for pgAudit logs
 */

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as firehose from 'aws-cdk-lib/aws-kinesisfirehose';
// logs reserved for CloudWatch log groups
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface UserRegistryStackProps extends cdk.StackProps {
  environment: string;
  auditRetentionYears?: number;
  enableObjectLock?: boolean;
  alertEmail?: string;
}

export class UserRegistryStack extends cdk.Stack {
  public readonly appClientMappingTable: dynamodb.Table;
  public readonly userAssignmentsTable: dynamodb.Table;
  public readonly tenantConfigTable: dynamodb.Table;
  public readonly auditLogBucket: s3.Bucket;
  public readonly auditLogKey: kms.Key;
  public readonly securityAlertTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: UserRegistryStackProps) {
    super(scope, id, props);

    const { environment, auditRetentionYears = 7, enableObjectLock = true, alertEmail } = props;

    // ========================================================================
    // KMS KEY FOR AUDIT LOGS
    // ========================================================================

    this.auditLogKey = new kms.Key(this, 'AuditLogKey', {
      alias: `alias/radiant-audit-logs-${environment}`,
      description: 'CMK for Radiant audit log encryption',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Allow Firehose to use the key
    this.auditLogKey.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'AllowFirehoseEncrypt',
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('firehose.amazonaws.com')],
      actions: ['kms:Encrypt', 'kms:GenerateDataKey'],
      resources: ['*'],
    }));

    // ========================================================================
    // S3 BUCKET FOR AUDIT LOGS (WITH OBJECT LOCK)
    // ========================================================================

    this.auditLogBucket = new s3.Bucket(this, 'AuditLogBucket', {
      bucketName: `radiant-audit-logs-${cdk.Aws.ACCOUNT_ID}-${environment}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.auditLogKey,
      versioned: true,
      objectLockEnabled: enableObjectLock,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'TransitionToGlacier',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
          noncurrentVersionTransitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
      ],
    });

    // Object Lock default retention (if enabled)
    if (enableObjectLock) {
      const cfnBucket = this.auditLogBucket.node.defaultChild as s3.CfnBucket;
      cfnBucket.objectLockConfiguration = {
        objectLockEnabled: 'Enabled',
        rule: {
          defaultRetention: {
            mode: 'COMPLIANCE',
            years: auditRetentionYears,
          },
        },
      };
    }

    // ========================================================================
    // DYNAMODB TABLES FOR COGNITO TOKEN ENRICHMENT
    // ========================================================================

    // App-Client Mapping Table (for M2M token enrichment)
    this.appClientMappingTable = new dynamodb.Table(this, 'AppClientMappingTable', {
      tableName: `radiant-app-client-mapping-${environment}`,
      partitionKey: { name: 'client_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.appClientMappingTable.addGlobalSecondaryIndex({
      indexName: 'app-uid-index',
      partitionKey: { name: 'app_uid', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.appClientMappingTable.addGlobalSecondaryIndex({
      indexName: 'tenant-index',
      partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'app_uid', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // User Assignments Cache Table
    this.userAssignmentsTable = new dynamodb.Table(this, 'UserAssignmentsTable', {
      tableName: `radiant-user-assignments-${environment}`,
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'app_uid', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl',
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Tenant Config Table
    this.tenantConfigTable = new dynamodb.Table(this, 'TenantConfigTable', {
      tableName: `radiant-tenant-config-${environment}`,
      partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ========================================================================
    // SNS TOPIC FOR SECURITY ALERTS
    // ========================================================================

    this.securityAlertTopic = new sns.Topic(this, 'SecurityAlertTopic', {
      topicName: `radiant-security-alerts-${environment}`,
      displayName: 'Radiant Security Alerts',
    });

    if (alertEmail) {
      this.securityAlertTopic.addSubscription(
        new subscriptions.EmailSubscription(alertEmail)
      );
    }

    // ========================================================================
    // FIREHOSE DELIVERY ROLE
    // ========================================================================

    const firehoseRole = new iam.Role(this, 'FirehoseDeliveryRole', {
      roleName: `radiant-firehose-delivery-${environment}`,
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
    });

    this.auditLogBucket.grantWrite(firehoseRole);
    this.auditLogKey.grantEncrypt(firehoseRole);

    // ========================================================================
    // AUDIT LOG TRANSFORM LAMBDA
    // ========================================================================

    const transformLambda = new lambda.Function(this, 'AuditTransformLambda', {
      functionName: `radiant-audit-transform-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const crypto = require('crypto');

let previousHash = null;

exports.handler = async (event) => {
  const output = event.records.map(record => {
    const payload = Buffer.from(record.data, 'base64').toString('utf-8');
    
    try {
      const lines = payload.split('\\n').filter(l => l.trim());
      const processedLines = lines.map(line => {
        const entry = parsePgAuditLog(line);
        return JSON.stringify(addHashChain(entry));
      });
      
      return {
        recordId: record.recordId,
        result: 'Ok',
        data: Buffer.from(processedLines.join('\\n') + '\\n').toString('base64')
      };
    } catch (error) {
      console.error('Failed to parse audit log:', error);
      return {
        recordId: record.recordId,
        result: 'Ok',
        data: record.data
      };
    }
  });
  
  return { records: output };
};

function parsePgAuditLog(line) {
  const timestamp = new Date().toISOString();
  return {
    timestamp,
    raw_message: line,
    audit_type: line.includes('AUDIT:') ? 'AUDIT' : 'LOG',
    parsed_at: timestamp
  };
}

function addHashChain(entry) {
  const entryData = JSON.stringify({
    ...entry,
    previous_hash: previousHash
  });
  
  const currentHash = crypto.createHash('sha256').update(entryData).digest('hex');
  
  const result = {
    ...entry,
    previous_hash: previousHash,
    entry_hash: currentHash
  };
  
  previousHash = currentHash;
  return result;
}
      `),
      memorySize: 256,
      timeout: cdk.Duration.minutes(1),
    });

    // Grant Lambda permission to be invoked by Firehose
    transformLambda.grantInvoke(firehoseRole);

    // ========================================================================
    // KINESIS FIREHOSE DELIVERY STREAM
    // ========================================================================

    const deliveryStream = new firehose.CfnDeliveryStream(this, 'AuditDeliveryStream', {
      deliveryStreamName: `radiant-audit-delivery-${environment}`,
      deliveryStreamType: 'DirectPut',
      extendedS3DestinationConfiguration: {
        bucketArn: this.auditLogBucket.bucketArn,
        roleArn: firehoseRole.roleArn,
        prefix: 'audit-logs/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/',
        errorOutputPrefix: 'errors/!{firehose:error-output-type}/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/',
        bufferingHints: {
          intervalInSeconds: 60,
          sizeInMBs: 64,
        },
        compressionFormat: 'GZIP',
        encryptionConfiguration: {
          kmsEncryptionConfig: {
            awskmsKeyArn: this.auditLogKey.keyArn,
          },
        },
        processingConfiguration: {
          enabled: true,
          processors: [
            {
              type: 'Lambda',
              parameters: [
                {
                  parameterName: 'LambdaArn',
                  parameterValue: transformLambda.functionArn,
                },
                {
                  parameterName: 'BufferSizeInMBs',
                  parameterValue: '1',
                },
                {
                  parameterName: 'BufferIntervalInSeconds',
                  parameterValue: '60',
                },
              ],
            },
          ],
        },
      },
    });

    // ========================================================================
    // BREAK GLASS ALERT LAMBDA
    // ========================================================================

    const breakGlassAlertLambda = new lambda.Function(this, 'BreakGlassAlertLambda', {
      functionName: `radiant-break-glass-alert-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { Client } = require('pg');

const sns = new SNSClient({});
const TOPIC_ARN = process.env.TOPIC_ARN;

exports.handler = async (event) => {
  // This Lambda listens to pg_notify events via a connection
  // In production, use RDS Proxy or Lambda event source mapping
  
  const { alertType, severity, accessId, adminEmail, tenantId, reason, timestamp } = event;
  
  if (alertType === 'BREAK_GLASS_INITIATED') {
    const message = \`
🚨 P0 SECURITY ALERT - BREAK GLASS ACCESS INITIATED

Admin: \${adminEmail}
Tenant: \${tenantId}
Reason: \${reason}
Access ID: \${accessId}
Timestamp: \${timestamp}

This access has been logged and requires immediate review.
    \`;
    
    await sns.send(new PublishCommand({
      TopicArn: TOPIC_ARN,
      Subject: \`[P0 ALERT] Break Glass Access - \${tenantId}\`,
      Message: message,
      MessageAttributes: {
        severity: { DataType: 'String', StringValue: severity },
        alertType: { DataType: 'String', StringValue: alertType },
      },
    }));
    
    console.log('Break Glass alert sent:', accessId);
  }
  
  return { statusCode: 200, body: 'Alert processed' };
};
      `),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TOPIC_ARN: this.securityAlertTopic.topicArn,
      },
    });

    this.securityAlertTopic.grantPublish(breakGlassAlertLambda);

    // ========================================================================
    // OUTPUTS
    // ========================================================================

    new cdk.CfnOutput(this, 'AppClientMappingTableName', {
      value: this.appClientMappingTable.tableName,
      exportName: `${this.stackName}-AppClientMappingTable`,
    });

    new cdk.CfnOutput(this, 'UserAssignmentsTableName', {
      value: this.userAssignmentsTable.tableName,
      exportName: `${this.stackName}-UserAssignmentsTable`,
    });

    new cdk.CfnOutput(this, 'TenantConfigTableName', {
      value: this.tenantConfigTable.tableName,
      exportName: `${this.stackName}-TenantConfigTable`,
    });

    new cdk.CfnOutput(this, 'AuditLogBucketName', {
      value: this.auditLogBucket.bucketName,
      exportName: `${this.stackName}-AuditLogBucket`,
    });

    new cdk.CfnOutput(this, 'AuditLogKeyArn', {
      value: this.auditLogKey.keyArn,
      exportName: `${this.stackName}-AuditLogKeyArn`,
    });

    new cdk.CfnOutput(this, 'SecurityAlertTopicArn', {
      value: this.securityAlertTopic.topicArn,
      exportName: `${this.stackName}-SecurityAlertTopicArn`,
    });

    new cdk.CfnOutput(this, 'DeliveryStreamName', {
      value: deliveryStream.ref,
      exportName: `${this.stackName}-DeliveryStreamName`,
    });
  }
}
