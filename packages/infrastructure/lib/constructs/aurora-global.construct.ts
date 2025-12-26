import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface AuroraGlobalClusterProps {
  vpc: ec2.IVpc;
  databaseName: string;
  encryptionKey: kms.IKey;
  tier: number;
  environment: string;
  enableGlobal?: boolean;
  secondaryRegions?: string[];
}

/**
 * Creates Aurora PostgreSQL cluster with optional global database support
 */
export class AuroraGlobalCluster extends Construct {
  public readonly cluster: rds.DatabaseCluster;
  public readonly secret: secretsmanager.ISecret;
  public readonly clusterEndpoint: string;
  public readonly readerEndpoint: string;
  public readonly port: number;

  constructor(scope: Construct, id: string, props: AuroraGlobalClusterProps) {
    super(scope, id);

    const {
      vpc,
      databaseName,
      encryptionKey,
      tier,
      environment,
      enableGlobal = false,
    } = props;

    // Database credentials
    const secret = new secretsmanager.Secret(this, 'Secret', {
      secretName: `radiant/${environment}/aurora-credentials`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'radiant_admin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 32,
      },
    });
    this.secret = secret;

    // Security group
    const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
      description: 'Aurora PostgreSQL security group',
      allowAllOutbound: false,
    });

    securityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from VPC'
    );

    // Determine configuration based on tier
    const instanceType = this.getInstanceType(tier);
    const minCapacity = this.getMinCapacity(tier);
    const maxCapacity = this.getMaxCapacity(tier);
    const readerCount = this.getReaderCount(tier);

    // Parameter group with pgvector extension
    const parameterGroup = new rds.ParameterGroup(this, 'ParameterGroup', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      parameters: {
        'shared_preload_libraries': 'pg_stat_statements,pgvector',
        'log_statement': 'ddl',
        'log_min_duration_statement': '1000',
      },
    });

    // Create cluster
    this.cluster = new rds.DatabaseCluster(this, 'Cluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      credentials: rds.Credentials.fromSecret(secret),
      defaultDatabaseName: databaseName,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [securityGroup],
      storageEncrypted: true,
      storageEncryptionKey: encryptionKey,
      parameterGroup,
      deletionProtection: environment === 'prod',
      backup: {
        retention: cdk.Duration.days(tier >= 3 ? 35 : 14),
        preferredWindow: '03:00-04:00',
      },
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
      serverlessV2MinCapacity: minCapacity,
      serverlessV2MaxCapacity: maxCapacity,
      writer: rds.ClusterInstance.serverlessV2('writer', {
        publiclyAccessible: false,
        enablePerformanceInsights: tier >= 2,
        performanceInsightRetention: tier >= 3 
          ? rds.PerformanceInsightRetention.MONTHS_3 
          : rds.PerformanceInsightRetention.DEFAULT,
      }),
      readers: Array.from({ length: readerCount }, (_, i) =>
        rds.ClusterInstance.serverlessV2(`reader${i + 1}`, {
          publiclyAccessible: false,
          enablePerformanceInsights: tier >= 2,
        })
      ),
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention: tier >= 3 
        ? cdk.aws_logs.RetentionDays.THREE_MONTHS 
        : cdk.aws_logs.RetentionDays.ONE_MONTH,
    });

    this.clusterEndpoint = this.cluster.clusterEndpoint.hostname;
    this.readerEndpoint = this.cluster.clusterReadEndpoint.hostname;
    this.port = this.cluster.clusterEndpoint.port;

    // Outputs
    new cdk.CfnOutput(this, 'ClusterEndpoint', {
      value: this.clusterEndpoint,
      description: 'Aurora cluster endpoint',
    });

    new cdk.CfnOutput(this, 'ReaderEndpoint', {
      value: this.readerEndpoint,
      description: 'Aurora reader endpoint',
    });

    new cdk.CfnOutput(this, 'SecretArn', {
      value: secret.secretArn,
      description: 'Database credentials secret ARN',
    });
  }

  private getInstanceType(tier: number): ec2.InstanceType {
    switch (tier) {
      case 1: return ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MEDIUM);
      case 2: return ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.LARGE);
      case 3: return ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.XLARGE);
      case 4: return ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.XLARGE2);
      case 5: return ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.XLARGE4);
      default: return ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MEDIUM);
    }
  }

  private getMinCapacity(tier: number): number {
    switch (tier) {
      case 1: return 0.5;
      case 2: return 1;
      case 3: return 2;
      case 4: return 4;
      case 5: return 8;
      default: return 0.5;
    }
  }

  private getMaxCapacity(tier: number): number {
    switch (tier) {
      case 1: return 2;
      case 2: return 8;
      case 3: return 16;
      case 4: return 64;
      case 5: return 128;
      default: return 2;
    }
  }

  private getReaderCount(tier: number): number {
    switch (tier) {
      case 1: return 0;
      case 2: return 1;
      case 3: return 2;
      case 4: return 3;
      case 5: return 5;
      default: return 0;
    }
  }
}
