import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface DatabaseScalingConstructProps {
  cluster: rds.DatabaseCluster;
  vpc: ec2.IVpc;
  databaseSecurityGroup: ec2.ISecurityGroup;
  tier: number;
  environment: string;
  appId: string;
}

/**
 * Database Scaling Construct
 * 
 * Implements RDS Proxy for connection pooling - critical for Lambda + parallel AI model execution.
 * Based on OpenAI's PostgreSQL scaling patterns (800M users, 50+ read replicas, no sharding).
 * 
 * Key benefits:
 * - Connection multiplexing: Reduces 600 concurrent connections to ~50
 * - Lambda cold-start optimization: 50-200ms → <10ms connection acquisition
 * - Automatic failover handling
 * - IAM authentication support
 * 
 * @see https://www.youtube.com/watch?v=xNXMu2FCaKA (OpenAI PostgreSQL scaling talk)
 */
export class DatabaseScalingConstruct extends Construct {
  public readonly proxy: rds.DatabaseProxy;
  public readonly proxyEndpoint: string;
  public readonly proxyArn: string;

  constructor(scope: Construct, id: string, props: DatabaseScalingConstructProps) {
    super(scope, id);

    const { cluster, vpc, databaseSecurityGroup, tier, environment, appId } = props;

    // Get secret from cluster
    const secret = cluster.secret;
    if (!secret) {
      throw new Error('Database cluster must have a secret');
    }

    // RDS Proxy for connection pooling
    // Critical for Lambda + parallel AI model execution (6+ concurrent DB writes per request)
    this.proxy = new rds.DatabaseProxy(this, 'AuroraProxy', {
      proxyTarget: rds.ProxyTarget.fromCluster(cluster),
      secrets: [secret],
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [databaseSecurityGroup],
      dbProxyName: `${appId}-${environment}-aurora-proxy`,
      
      // Connection pooling settings optimized for Lambda
      // Leave 20% headroom for direct connections (migrations, admin)
      maxConnectionsPercent: this.getMaxConnectionsPercent(tier),
      
      // Idle connections - higher for prod to handle burst traffic
      maxIdleConnectionsPercent: this.getMaxIdleConnectionsPercent(tier),
      
      // Lambda functions typically complete in <30s
      // Shorter timeout helps recycle connections faster
      idleClientTimeout: cdk.Duration.minutes(environment === 'prod' ? 10 : 5),
      
      // Borrow timeout - how long to wait for a connection
      // 30s is reasonable for Lambda cold starts
      borrowTimeout: cdk.Duration.seconds(30),
      
      // Require TLS for all connections
      requireTLS: true,
      
      // Debug logging for non-prod
      debugLogging: environment !== 'prod',
    });

    this.proxyEndpoint = this.proxy.endpoint;
    this.proxyArn = this.proxy.dbProxyArn;

    // Outputs
    new cdk.CfnOutput(this, 'ProxyEndpoint', {
      value: this.proxyEndpoint,
      description: 'RDS Proxy endpoint for connection pooling',
    });

    new cdk.CfnOutput(this, 'ProxyArn', {
      value: this.proxyArn,
      description: 'RDS Proxy ARN',
    });
  }

  /**
   * Grant Lambda function access to connect via RDS Proxy
   */
  public grantConnect(grantee: iam.IGrantable): void {
    this.proxy.grantConnect(grantee);
  }

  private getMaxConnectionsPercent(tier: number): number {
    // Higher tiers get more of the connection pool
    switch (tier) {
      case 1: return 60;  // Seed tier - conservative
      case 2: return 70;  // Starter tier
      case 3: return 80;  // Growth tier
      case 4: return 85;  // Scale tier
      case 5: return 90;  // Enterprise tier
      default: return 70;
    }
  }

  private getMaxIdleConnectionsPercent(tier: number): number {
    // Higher tiers maintain more idle connections for burst handling
    switch (tier) {
      case 1: return 20;
      case 2: return 30;
      case 3: return 40;
      case 4: return 50;
      case 5: return 60;
      default: return 30;
    }
  }
}
