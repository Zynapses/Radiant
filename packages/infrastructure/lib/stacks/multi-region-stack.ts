import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as globalaccelerator from 'aws-cdk-lib/aws-globalaccelerator';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';

interface MultiRegionStackProps extends cdk.StackProps {
  appId: string;
  environment: string;
  primaryRegion: string;
  secondaryRegions: string[];
  domainName: string;
  hostedZoneId: string;
}

/**
 * Multi-Region Infrastructure Stack
 * 
 * Deploys RADIANT across multiple AWS regions for:
 * - High availability
 * - Disaster recovery
 * - Low latency for global users
 * 
 * Architecture:
 * - Aurora Global Database (primary + read replicas)
 * - S3 Cross-Region Replication
 * - Global Accelerator for traffic routing
 * - CloudFront for edge caching
 * - Route 53 health checks and failover
 */
export class MultiRegionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MultiRegionStackProps) {
    super(scope, id, props);

    const { appId, environment, primaryRegion, secondaryRegions, domainName, hostedZoneId } = props;

    // =========================================================================
    // Global Database
    // =========================================================================
    
    // Note: Global cluster must be created in primary region first,
    // then secondary clusters added in other regions
    
    const globalClusterIdentifier = `${appId}-${environment}-global`;
    
    // This would be created in the primary region stack
    // Secondary regions would reference this and add read replicas
    
    // =========================================================================
    // S3 Cross-Region Replication
    // =========================================================================
    
    // Primary bucket (created in primary region)
    const primaryBucket = new s3.Bucket(this, 'PrimaryBucket', {
      bucketName: `${appId}-storage-${environment}-${primaryRegion}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Replication to secondary regions would be configured via:
    // - S3 Replication Rules
    // - Or S3 Batch Replication for initial sync

    // =========================================================================
    // Global Accelerator
    // =========================================================================
    
    const accelerator = new globalaccelerator.Accelerator(this, 'Accelerator', {
      acceleratorName: `${appId}-${environment}-accelerator`,
      enabled: true,
    });

    const listener = new globalaccelerator.Listener(this, 'Listener', {
      accelerator,
      portRanges: [{ fromPort: 443, toPort: 443 }],
      protocol: globalaccelerator.ConnectionProtocol.TCP,
      clientAffinity: globalaccelerator.ClientAffinity.SOURCE_IP,
    });

    // Endpoint groups would be added for each region's ALB/API Gateway
    // with appropriate weights and health checks

    // =========================================================================
    // Route 53 Health Checks
    // =========================================================================
    
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId,
      zoneName: domainName,
    });

    // Health check for primary region
    const primaryHealthCheck = new route53.CfnHealthCheck(this, 'PrimaryHealthCheck', {
      healthCheckConfig: {
        type: 'HTTPS',
        fullyQualifiedDomainName: `api-${primaryRegion}.${domainName}`,
        port: 443,
        resourcePath: '/v2/health',
        requestInterval: 10,
        failureThreshold: 3,
        enableSni: true,
      },
      healthCheckTags: [
        { key: 'Name', value: `${appId}-${environment}-primary-health` },
      ],
    });

    // Failover routing policy
    new route53.CfnRecordSet(this, 'PrimaryRecord', {
      hostedZoneId,
      name: `api.${domainName}`,
      type: 'A',
      setIdentifier: 'primary',
      failover: 'PRIMARY',
      healthCheckId: primaryHealthCheck.attrHealthCheckId,
      aliasTarget: {
        dnsName: accelerator.dnsName,
        hostedZoneId: 'Z2BJ6XQ5FK7U4H', // Global Accelerator hosted zone ID
        evaluateTargetHealth: true,
      },
    });

    // Secondary (failover) record would point to secondary region

    // =========================================================================
    // CloudFront Distribution
    // =========================================================================
    
    // CloudFront provides edge caching and additional redundancy
    // It can route to multiple origins based on health

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new cdk.aws_cloudfront_origins.HttpOrigin(`api-${primaryRegion}.${domainName}`, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
      domainNames: [`api.${domainName}`],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      enableLogging: true,
    });

    // =========================================================================
    // Outputs
    // =========================================================================
    
    new cdk.CfnOutput(this, 'GlobalAcceleratorDns', {
      value: accelerator.dnsName,
      description: 'Global Accelerator DNS name',
    });

    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution domain',
    });
  }
}

/**
 * Regional Stack - Deploy in each region
 * 
 * Each region gets:
 * - Aurora cluster (global database secondary)
 * - Lambda functions
 * - API Gateway
 * - ElastiCache Redis
 */
export class RegionalStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps & {
    appId: string;
    environment: string;
    isPrimary: boolean;
    globalClusterIdentifier?: string;
  }) {
    super(scope, id, props);

    const { appId, environment, isPrimary, globalClusterIdentifier } = props;

    // Database - Primary or Secondary
    if (isPrimary) {
      // Primary creates the global cluster
      const cluster = new rds.DatabaseCluster(this, 'Database', {
        engine: rds.DatabaseClusterEngine.auroraPostgres({
          version: rds.AuroraPostgresEngineVersion.VER_15_4,
        }),
        serverlessV2MinCapacity: 0.5,
        serverlessV2MaxCapacity: 16,
        writer: rds.ClusterInstance.serverlessV2('writer'),
        readers: [
          rds.ClusterInstance.serverlessV2('reader', {
            scaleWithWriter: true,
          }),
        ],
        backup: {
          retention: cdk.Duration.days(35),
        },
        deletionProtection: true,
      });
    } else {
      // Secondary regions add to global cluster
      // Note: This requires manual setup or custom resource
      // as CDK doesn't fully support Global Database secondary clusters
    }

    // Lambda, API Gateway, etc. would be deployed in each region
    // with region-specific database endpoints
  }
}

/**
 * Multi-Region Deployment Strategy
 * 
 * 1. Deploy primary region first:
 *    cdk deploy RadiantPrimaryRegion --region us-east-1
 * 
 * 2. Create Global Database:
 *    aws rds create-global-cluster --global-cluster-identifier radiant-global \
 *      --source-db-cluster-identifier radiant-production
 * 
 * 3. Deploy secondary regions:
 *    cdk deploy RadiantSecondaryRegion --region eu-west-1
 *    cdk deploy RadiantSecondaryRegion --region ap-northeast-1
 * 
 * 4. Add secondary clusters to global database:
 *    aws rds create-db-cluster --db-cluster-identifier radiant-eu-west-1 \
 *      --global-cluster-identifier radiant-global \
 *      --region eu-west-1
 * 
 * 5. Deploy Global Accelerator and Route 53:
 *    cdk deploy RadiantMultiRegion
 * 
 * Failover Process:
 * 1. Detach failed primary from global cluster
 * 2. Promote secondary to standalone
 * 3. Update Route 53 / Global Accelerator weights
 * 4. Verify traffic routing
 * 5. Once primary is recovered, add it as secondary
 */
