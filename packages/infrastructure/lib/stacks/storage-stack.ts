import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';
import type { TierConfig, Environment } from '@radiant/shared';

export interface StorageStackProps extends cdk.StackProps {
  appId: string;
  environment: Environment;
  tier: number;
  tierConfig: TierConfig;
  encryptionKey: kms.Key;
}

export class StorageStack extends cdk.Stack {
  public readonly mediaBucket: s3.Bucket;
  public readonly artifactsBucket: s3.Bucket;
  public readonly logsBucket: s3.Bucket;
  public readonly mediaDistribution?: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { appId, environment, tier, encryptionKey } = props;
    const isProd = environment === 'prod';

    // Logs bucket (for access logs)
    this.logsBucket = new s3.Bucket(this, 'LogsBucket', {
      bucketName: `${appId}-${environment}-logs-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'ExpireOldLogs',
          expiration: cdk.Duration.days(isProd ? 365 : 30),
        },
      ],
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    // Media bucket for user uploads
    this.mediaBucket = new s3.Bucket(this, 'MediaBucket', {
      bucketName: `${appId}-${environment}-media-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: tier >= 2,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          id: 'TransitionToIA',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
        {
          id: 'ExpireIncomplete',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
      serverAccessLogsBucket: this.logsBucket,
      serverAccessLogsPrefix: 'media-access-logs/',
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    // Artifacts bucket for generated content
    this.artifactsBucket = new s3.Bucket(this, 'ArtifactsBucket', {
      bucketName: `${appId}-${environment}-artifacts-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      lifecycleRules: [
        {
          id: 'ExpireArtifacts',
          expiration: cdk.Duration.days(isProd ? 90 : 30),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // CloudFront distribution for media (Tier 2+)
    if (tier >= 2) {
      const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'MediaOAI', {
        comment: `OAI for ${appId}-${environment} media`,
      });

      this.mediaBucket.grantRead(originAccessIdentity);

      this.mediaDistribution = new cloudfront.Distribution(this, 'MediaDistribution', {
        defaultBehavior: {
          origin: new origins.S3Origin(this.mediaBucket, {
            originAccessIdentity,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        },
        priceClass: tier >= 4 
          ? cloudfront.PriceClass.PRICE_CLASS_ALL 
          : cloudfront.PriceClass.PRICE_CLASS_100,
        enabled: true,
        comment: `${appId}-${environment} media CDN`,
      });

      new cdk.CfnOutput(this, 'MediaDistributionDomain', {
        value: this.mediaDistribution.distributionDomainName,
        description: 'Media CDN domain',
        exportName: `${appId}-${environment}-media-cdn`,
      });
    }

    // Outputs
    new cdk.CfnOutput(this, 'MediaBucketName', {
      value: this.mediaBucket.bucketName,
      description: 'Media bucket name',
      exportName: `${appId}-${environment}-media-bucket`,
    });

    new cdk.CfnOutput(this, 'ArtifactsBucketName', {
      value: this.artifactsBucket.bucketName,
      description: 'Artifacts bucket name',
      exportName: `${appId}-${environment}-artifacts-bucket`,
    });
  }
}
