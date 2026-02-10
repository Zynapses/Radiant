import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export interface OmegaStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'prod';
  vpc: ec2.IVpc;
  radiantDomain?: string;
}

/**
 * OmegaStack - Bio-Mimetic AI Organism Infrastructure
 * 
 * Implements the "Serverless Cryogenic" architecture:
 * - EFS for hot/warm brain state storage
 * - S3 for cold storage backups
 * - Graviton (arm64) Lambda functions
 * - Scheduled heartbeat for maintenance
 */
export class OmegaStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly inferenceFunction: lambda.Function;
  public readonly heartbeatFunction: lambda.Function;
  public readonly adminFunction: lambda.Function;
  public readonly fileSystem: efs.FileSystem;
  public readonly backupBucket: s3.Bucket;
  public readonly firmwareBucket: s3.Bucket;
  public readonly omegaFrontendBucket: s3.Bucket;
  public readonly omegaFrontendDistribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: OmegaStackProps) {
    super(scope, id, props);

    const { environment, vpc, radiantDomain = '{{RADIANT_DOMAIN}}' } = props;

    // ==========================================================================
    // SECURITY GROUPS
    // ==========================================================================
    const efsSecurityGroup = new ec2.SecurityGroup(this, 'EfsSecurityGroup', {
      vpc,
      description: 'Security group for OMEGA EFS',
      allowAllOutbound: false,
    });

    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc,
      description: 'Security group for OMEGA Lambda functions',
      allowAllOutbound: true,
    });

    // Allow Lambda to access EFS
    efsSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(2049),
      'Allow NFS from Lambda'
    );

    // ==========================================================================
    // EFS - HOT/WARM STORAGE
    // ==========================================================================
    this.fileSystem = new efs.FileSystem(this, 'OmegaBrainStorage', {
      vpc,
      securityGroup: efsSecurityGroup,
      encrypted: true,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.ELASTIC,
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_30_DAYS,
      outOfInfrequentAccessPolicy: efs.OutOfInfrequentAccessPolicy.AFTER_1_ACCESS,
      enableAutomaticBackups: true,
      removalPolicy: environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
    });

    const accessPoint = this.fileSystem.addAccessPoint('OmegaAccessPoint', {
      path: '/omega',
      createAcl: {
        ownerUid: '1000',
        ownerGid: '1000',
        permissions: '0755',
      },
      posixUser: {
        uid: '1000',
        gid: '1000',
      },
    });

    // ==========================================================================
    // S3 - COLD STORAGE
    // ==========================================================================
    this.backupBucket = new s3.Bucket(this, 'OmegaBackupBucket', {
      bucketName: `radiant-omega-backups-${environment}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'TransitionToGlacier',
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
        {
          id: 'DeleteOldVersions',
          noncurrentVersionExpiration: cdk.Duration.days(365),
        },
      ],
      removalPolicy: environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: environment !== 'prod',
    });

    this.firmwareBucket = new s3.Bucket(this, 'OmegaFirmwareBucket', {
      bucketName: `radiant-omega-firmware-${environment}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: environment !== 'prod',
    });

    // ==========================================================================
    // LAMBDA LAYER
    // ==========================================================================
    const omegaCoreLayer = new lambda.LayerVersion(this, 'OmegaCoreLayer', {
      layerVersionName: `omega-core-${environment}`,
      description: 'OMEGA core libraries (PyTorch CPU, numpy, omega_core)',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/omega_core')),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_11],
      compatibleArchitectures: [lambda.Architecture.ARM_64],
    });

    // ==========================================================================
    // SHARED LAMBDA ENVIRONMENT
    // ==========================================================================
    const lambdaEnvironment: Record<string, string> = {
      ENVIRONMENT: environment,
      OMEGA_EFS_MOUNT: '/mnt/omega_state',
      OMEGA_BACKUP_BUCKET: this.backupBucket.bucketName,
      OMEGA_FIRMWARE_BUCKET: this.firmwareBucket.bucketName,
      RADIANT_DOMAIN: radiantDomain,
      PYTHONPATH: '/opt/python',
    };

    // ==========================================================================
    // INFERENCE FUNCTION
    // ==========================================================================
    this.inferenceFunction = new lambda.Function(this, 'OmegaInferenceFunction', {
      functionName: `omega-inference-${environment}`,
      description: 'OMEGA brain wake cycle - handles inference requests',
      runtime: lambda.Runtime.PYTHON_3_11,
      architecture: lambda.Architecture.ARM_64,
      handler: 'handlers.omega_inference.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      layers: [omegaCoreLayer],
      timeout: cdk.Duration.minutes(5),
      memorySize: 3008,
      vpc,
      securityGroups: [lambdaSecurityGroup],
      filesystem: lambda.FileSystem.fromEfsAccessPoint(accessPoint, '/mnt/omega_state'),
      environment: lambdaEnvironment,
    });

    // Grant permissions
    this.backupBucket.grantReadWrite(this.inferenceFunction);
    this.firmwareBucket.grantRead(this.inferenceFunction);

    // ==========================================================================
    // HEARTBEAT FUNCTION (PACEMAKER)
    // ==========================================================================
    this.heartbeatFunction = new lambda.Function(this, 'OmegaHeartbeatFunction', {
      functionName: `omega-heartbeat-${environment}`,
      description: 'OMEGA pacemaker - scheduled brain maintenance',
      runtime: lambda.Runtime.PYTHON_3_11,
      architecture: lambda.Architecture.ARM_64,
      handler: 'handlers.omega_heartbeat.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      layers: [omegaCoreLayer],
      timeout: cdk.Duration.minutes(15),
      memorySize: 2048,
      vpc,
      securityGroups: [lambdaSecurityGroup],
      filesystem: lambda.FileSystem.fromEfsAccessPoint(accessPoint, '/mnt/omega_state'),
      environment: lambdaEnvironment,
    });

    // Grant permissions
    this.backupBucket.grantReadWrite(this.heartbeatFunction);
    this.firmwareBucket.grantRead(this.heartbeatFunction);

    // Schedule heartbeat every 5 minutes
    const heartbeatRule = new events.Rule(this, 'HeartbeatSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      description: 'OMEGA heartbeat pacemaker schedule',
    });
    heartbeatRule.addTarget(new targets.LambdaFunction(this.heartbeatFunction));

    // ==========================================================================
    // ADMIN FUNCTION (CORTEX EXPLORER API)
    // ==========================================================================
    this.adminFunction = new lambda.Function(this, 'OmegaAdminFunction', {
      functionName: `omega-admin-${environment}`,
      description: 'OMEGA Cortex Explorer admin API',
      runtime: lambda.Runtime.PYTHON_3_11,
      architecture: lambda.Architecture.ARM_64,
      handler: 'handlers.omega_admin.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      layers: [omegaCoreLayer],
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
      vpc,
      securityGroups: [lambdaSecurityGroup],
      filesystem: lambda.FileSystem.fromEfsAccessPoint(accessPoint, '/mnt/omega_state'),
      environment: lambdaEnvironment,
    });

    // Grant permissions
    this.backupBucket.grantReadWrite(this.adminFunction);
    this.firmwareBucket.grantReadWrite(this.adminFunction);

    // ==========================================================================
    // API GATEWAY
    // ==========================================================================
    this.api = new apigateway.RestApi(this, 'OmegaApi', {
      restApiName: `omega-api-${environment}`,
      description: 'OMEGA Bio-Mimetic AI API',
      deployOptions: {
        stageName: environment,
        tracingEnabled: true,
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // Inference endpoint
    const inferenceResource = this.api.root.addResource('inference');
    inferenceResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(this.inferenceFunction)
    );

    // Admin endpoints
    const adminResource = this.api.root.addResource('admin');
    const adminProxy = adminResource.addProxy({
      anyMethod: true,
      defaultIntegration: new apigateway.LambdaIntegration(this.adminFunction),
    });

    // ==========================================================================
    // CLOUDWATCH ALARMS
    // ==========================================================================
    new cloudwatch.Alarm(this, 'InferenceErrorAlarm', {
      alarmName: `omega-inference-errors-${environment}`,
      alarmDescription: 'OMEGA inference function error rate',
      metric: this.inferenceFunction.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 5,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    new cloudwatch.Alarm(this, 'HeartbeatErrorAlarm', {
      alarmName: `omega-heartbeat-errors-${environment}`,
      alarmDescription: 'OMEGA heartbeat function error rate',
      metric: this.heartbeatFunction.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 3,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // ==========================================================================
    // OUTPUTS
    // ==========================================================================
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
      description: 'OMEGA API Gateway endpoint URL',
      exportName: `omega-api-endpoint-${environment}`,
    });

    new cdk.CfnOutput(this, 'EfsFileSystemId', {
      value: this.fileSystem.fileSystemId,
      description: 'OMEGA EFS File System ID',
      exportName: `omega-efs-id-${environment}`,
    });

    new cdk.CfnOutput(this, 'BackupBucketName', {
      value: this.backupBucket.bucketName,
      description: 'OMEGA S3 backup bucket name',
      exportName: `omega-backup-bucket-${environment}`,
    });

    new cdk.CfnOutput(this, 'FirmwareBucketName', {
      value: this.firmwareBucket.bucketName,
      description: 'OMEGA S3 firmware bucket name',
      exportName: `omega-firmware-bucket-${environment}`,
    });

    // ==========================================================================
    // OMEGA FRONTEND HOSTING (OMEGA Lab + OMEGA Forge)
    // ==========================================================================
    this.omegaFrontendBucket = new s3.Bucket(this, 'OmegaFrontendBucket', {
      bucketName: `radiant-omega-frontend-${environment}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: environment === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: environment !== 'prod',
    });

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      'OmegaFrontendOAI',
      {
        comment: `OAI for OMEGA frontend ${environment}`,
      }
    );

    this.omegaFrontendBucket.grantRead(originAccessIdentity);

    this.omegaFrontendDistribution = new cloudfront.Distribution(
      this,
      'OmegaFrontendDistribution',
      {
        comment: `OMEGA Lab & Forge frontend - ${environment}`,
        defaultRootObject: 'index.html',
        defaultBehavior: {
          origin: new origins.S3Origin(this.omegaFrontendBucket, {
            originAccessIdentity,
          }),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
        },
        additionalBehaviors: {
          '/api/*': {
            origin: new origins.HttpOrigin(
              `${this.api.restApiId}.execute-api.${this.region}.amazonaws.com`,
              {
                originPath: `/${environment}`,
              }
            ),
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy:
              cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          },
        },
        errorResponses: [
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: cdk.Duration.minutes(5),
          },
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: cdk.Duration.minutes(5),
          },
        ],
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      }
    );

    new cdk.CfnOutput(this, 'OmegaFrontendUrl', {
      value: `https://${this.omegaFrontendDistribution.distributionDomainName}`,
      description: 'OMEGA Lab & Forge frontend URL',
      exportName: `omega-frontend-url-${environment}`,
    });

    new cdk.CfnOutput(this, 'OmegaFrontendBucketName', {
      value: this.omegaFrontendBucket.bucketName,
      description: 'OMEGA frontend S3 bucket name',
      exportName: `omega-frontend-bucket-${environment}`,
    });

    // Tags
    cdk.Tags.of(this).add('Project', 'OMEGA');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Purpose', 'Bio-Mimetic AI Organism');
  }
}
