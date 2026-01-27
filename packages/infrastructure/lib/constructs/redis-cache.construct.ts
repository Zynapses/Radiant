import * as cdk from 'aws-cdk-lib';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface RedisCacheConstructProps {
  vpc: ec2.IVpc;
  tier: number;
  environment: string;
  appId: string;
  allowedSecurityGroups: ec2.ISecurityGroup[];
}

/**
 * Redis Cache Construct
 * 
 * Provides ElastiCache Redis for hot-path operations that shouldn't hit PostgreSQL:
 * - Rate limiting (per-tenant, per-user)
 * - Session data
 * - Real-time counters
 * - AI model result caching for read-after-write consistency
 * 
 * Pattern:
 * 1. AI models execute in parallel
 * 2. Results immediately cached in Redis (TTL 1 hour)
 * 3. Results queued to SQS for async PostgreSQL write
 * 4. Client reads from Redis first, falls back to PostgreSQL
 * 
 * This ensures read-after-write consistency without blocking on DB writes.
 */
export class RedisCacheConstruct extends Construct {
  public readonly cluster: elasticache.CfnReplicationGroup;
  public readonly endpoint: string;
  public readonly port: number;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: RedisCacheConstructProps) {
    super(scope, id);

    const { vpc, tier, environment, appId, allowedSecurityGroups } = props;

    // Security group for Redis
    this.securityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc,
      description: 'Security group for Redis cluster',
      allowAllOutbound: false,
    });

    // Allow access from provided security groups
    for (const sg of allowedSecurityGroups) {
      this.securityGroup.addIngressRule(
        sg,
        ec2.Port.tcp(6379),
        'Allow Redis access'
      );
    }

    // Subnet group for Redis
    const subnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnets for RADIANT Redis cluster',
      subnetIds: vpc.privateSubnets.map(s => s.subnetId),
      cacheSubnetGroupName: `${appId}-${environment}-redis-subnets`,
    });

    // Parameter group for Redis 7.x
    const parameterGroup = new elasticache.CfnParameterGroup(this, 'RedisParameterGroup', {
      cacheParameterGroupFamily: 'redis7',
      description: 'RADIANT Redis parameter group',
      properties: {
        // Enable cluster mode for horizontal scaling (tier 3+)
        'cluster-enabled': tier >= 3 ? 'yes' : 'no',
        // Optimize for mixed read/write workloads
        'maxmemory-policy': 'allkeys-lru',
        // Enable keyspace notifications for cache invalidation
        'notify-keyspace-events': 'Ex',
      },
    });

    // Get configuration based on tier
    const config = this.getRedisConfig(tier, environment);

    // Redis Replication Group (cluster)
    this.cluster = new elasticache.CfnReplicationGroup(this, 'RedisCluster', {
      replicationGroupDescription: `RADIANT ${environment} model result cache`,
      replicationGroupId: `${appId}-${environment}-redis`,
      engine: 'redis',
      engineVersion: '7.1',
      cacheNodeType: config.nodeType,
      
      // Cluster mode configuration
      numNodeGroups: config.numShards,
      replicasPerNodeGroup: config.replicasPerShard,
      
      // High availability
      automaticFailoverEnabled: tier >= 2,
      multiAzEnabled: tier >= 2,
      
      // Security
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true,
      authToken: undefined, // Use IAM auth via Redis AUTH
      
      // Networking
      cacheSubnetGroupName: subnetGroup.ref,
      securityGroupIds: [this.securityGroup.securityGroupId],
      
      // Parameter group
      cacheParameterGroupName: parameterGroup.ref,
      
      // Maintenance
      preferredMaintenanceWindow: 'sun:05:00-sun:06:00',
      snapshotRetentionLimit: tier >= 3 ? 7 : 1,
      snapshotWindow: '03:00-04:00',
      
      // Auto minor version upgrade
      autoMinorVersionUpgrade: true,
    });

    this.cluster.addDependency(subnetGroup);
    this.cluster.addDependency(parameterGroup);

    // Set endpoint based on cluster mode
    if (tier >= 3) {
      // Cluster mode - use configuration endpoint
      this.endpoint = this.cluster.attrConfigurationEndPointAddress;
      this.port = parseInt(this.cluster.attrConfigurationEndPointPort, 10);
    } else {
      // Non-cluster mode - use primary endpoint
      this.endpoint = this.cluster.attrPrimaryEndPointAddress;
      this.port = parseInt(this.cluster.attrPrimaryEndPointPort, 10);
    }

    // Outputs
    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.endpoint,
      description: 'Redis cluster endpoint',
    });

    new cdk.CfnOutput(this, 'RedisPort', {
      value: this.port.toString(),
      description: 'Redis cluster port',
    });
  }

  private getRedisConfig(tier: number, environment: string): {
    nodeType: string;
    numShards: number;
    replicasPerShard: number;
  } {
    // Production environments get more resources
    const isProd = environment === 'prod';

    switch (tier) {
      case 1:
        return {
          nodeType: 'cache.t4g.micro',
          numShards: 1,
          replicasPerShard: 0,
        };
      case 2:
        return {
          nodeType: isProd ? 'cache.t4g.small' : 'cache.t4g.micro',
          numShards: 1,
          replicasPerShard: isProd ? 1 : 0,
        };
      case 3:
        return {
          nodeType: isProd ? 'cache.r6g.large' : 'cache.t4g.medium',
          numShards: 2,
          replicasPerShard: 1,
        };
      case 4:
        return {
          nodeType: 'cache.r6g.xlarge',
          numShards: 3,
          replicasPerShard: 1,
        };
      case 5:
        return {
          nodeType: 'cache.r6g.2xlarge',
          numShards: 4,
          replicasPerShard: 2,
        };
      default:
        return {
          nodeType: 'cache.t4g.small',
          numShards: 1,
          replicasPerShard: 0,
        };
    }
  }
}
