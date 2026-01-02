/**
 * RADIANT Genesis Cato Redis Stack
 * Provides ElastiCache Redis for Epistemic Recovery state persistence
 *
 * Redis is required because Epistemic Recovery must track rejection history
 * across Lambda invocations and ECS containers.
 */

import * as cdk from 'aws-cdk-lib';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface CatoRedisStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  fargateSecurityGroup?: ec2.ISecurityGroup;
  lambdaSecurityGroup?: ec2.ISecurityGroup;
  environment: string;
  tier: 'SEED' | 'SPROUT' | 'GROWTH' | 'SCALE' | 'ENTERPRISE';
}

export class CatoRedisStack extends cdk.Stack {
  public readonly redisEndpoint: string;
  public readonly redisPort: number;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: CatoRedisStackProps) {
    super(scope, id, props);

    // Security Group for Redis
    this.securityGroup = new ec2.SecurityGroup(this, 'CatoRedisSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for Cato Epistemic Recovery Redis',
      allowAllOutbound: false,
    });

    // Allow inbound from Fargate tasks if provided
    if (props.fargateSecurityGroup) {
      this.securityGroup.addIngressRule(
        props.fargateSecurityGroup,
        ec2.Port.tcp(6379),
        'Allow Redis access from Fargate tasks'
      );
    }

    // Allow inbound from Lambda if provided
    if (props.lambdaSecurityGroup) {
      this.securityGroup.addIngressRule(
        props.lambdaSecurityGroup,
        ec2.Port.tcp(6379),
        'Allow Redis access from Lambda'
      );
    }

    // Allow inbound from VPC
    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(6379),
      'Allow Redis access from VPC'
    );

    // Subnet Group
    const subnetGroup = new elasticache.CfnSubnetGroup(this, 'CatoRedisSubnetGroup', {
      description: 'Subnet group for Cato Epistemic Recovery Redis',
      subnetIds: props.vpc.privateSubnets.map((s) => s.subnetId),
      cacheSubnetGroupName: `cato-redis-${props.environment}`,
    });

    // Redis Cluster
    const redis = new elasticache.CfnCacheCluster(this, 'CatoRedis', {
      cacheNodeType: this.getNodeTypeForTier(props.tier),
      engine: 'redis',
      engineVersion: '7.0',
      numCacheNodes: 1,
      clusterName: `cato-recovery-${props.environment}`,
      vpcSecurityGroupIds: [this.securityGroup.securityGroupId],
      cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName,
      port: 6379,

      // Encryption (at-rest encryption requires replication group, transit only for cache cluster)
      transitEncryptionEnabled: true,

      // Snapshots for disaster recovery
      snapshotRetentionLimit: props.tier === 'ENTERPRISE' ? 7 : 1,
      snapshotWindow: '03:00-04:00',

      // Maintenance
      preferredMaintenanceWindow: 'sun:05:00-sun:06:00',
    });

    redis.addDependency(subnetGroup);

    this.redisEndpoint = redis.attrRedisEndpointAddress;
    this.redisPort = 6379;

    // Outputs
    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.redisEndpoint,
      exportName: `cato-redis-endpoint-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'RedisPort', {
      value: String(this.redisPort),
      exportName: `cato-redis-port-${props.environment}`,
    });
  }

  private getNodeTypeForTier(tier: string): string {
    switch (tier) {
      case 'SEED':
      case 'SPROUT':
        return 'cache.t4g.micro';
      case 'GROWTH':
        return 'cache.t4g.small';
      case 'SCALE':
        return 'cache.r7g.large';
      case 'ENTERPRISE':
        return 'cache.r7g.xlarge';
      default:
        return 'cache.t4g.micro';
    }
  }
}
