import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import type { TierConfig, Environment } from '@radiant/shared';

export interface DataStackProps extends cdk.StackProps {
  appId: string;
  environment: Environment;
  tier: number;
  tierConfig: TierConfig;
  vpc: ec2.Vpc;
  databaseSecurityGroup: ec2.SecurityGroup;
  encryptionKey: kms.Key;
}

export class DataStack extends cdk.Stack {
  public readonly cluster: rds.DatabaseCluster;
  public readonly usageTable: dynamodb.Table;
  public readonly sessionsTable: dynamodb.Table;
  public readonly cacheTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const { appId, environment, tier, tierConfig, vpc, databaseSecurityGroup, encryptionKey } = props;

    // Aurora PostgreSQL Serverless v2 Cluster
    this.cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      clusterIdentifier: `${appId}-${environment}-aurora`,
      defaultDatabaseName: 'radiant',
      serverlessV2MinCapacity: tierConfig.auroraMinCapacity,
      serverlessV2MaxCapacity: tierConfig.auroraMaxCapacity,
      writer: rds.ClusterInstance.serverlessV2('writer', {
        publiclyAccessible: false,
      }),
      readers: tier >= 3 ? [
        rds.ClusterInstance.serverlessV2('reader1', {
          scaleWithWriter: true,
        }),
      ] : undefined,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [databaseSecurityGroup],
      storageEncrypted: true,
      storageEncryptionKey: encryptionKey,
      backup: {
        retention: environment === 'prod' ? cdk.Duration.days(35) : cdk.Duration.days(7),
      },
      deletionProtection: environment === 'prod',
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      enableDataApi: true,
    });

    // DynamoDB Tables
    this.usageTable = new dynamodb.Table(this, 'UsageTable', {
      tableName: `${appId}-${environment}-usage`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: tier >= 3 ? dynamodb.BillingMode.PROVISIONED : dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      pointInTimeRecovery: tier >= 2,
      timeToLiveAttribute: 'ttl',
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      tableName: `${appId}-${environment}-sessions`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.sessionsTable.addGlobalSecondaryIndex({
      indexName: 'gsi1',
      partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi1sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.cacheTable = new dynamodb.Table(this, 'CacheTable', {
      tableName: `${appId}-${environment}-cache`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ClusterEndpoint', {
      value: this.cluster.clusterEndpoint.hostname,
      description: 'Aurora cluster endpoint',
      exportName: `${appId}-${environment}-cluster-endpoint`,
    });

    new cdk.CfnOutput(this, 'ClusterArn', {
      value: this.cluster.clusterArn,
      description: 'Aurora cluster ARN',
      exportName: `${appId}-${environment}-cluster-arn`,
    });

    new cdk.CfnOutput(this, 'SecretArn', {
      value: this.cluster.secret?.secretArn || '',
      description: 'Aurora secret ARN',
      exportName: `${appId}-${environment}-secret-arn`,
    });
  }
}
