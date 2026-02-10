/**
 * OMEGA Forge CDK Stack
 *
 * Deploys the OMEGA Forge system admin app as an ECS Fargate service
 * in a private subnet. Accessible only via VPN or SSM Session Manager.
 *
 * Direct access to: Aurora PostgreSQL (via RDS Proxy), S3 buckets, KMS signing keys.
 * NO public-facing ALB. This is an internal tool.
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface ForgeStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  cluster: ecs.ICluster;
  auroraProxyEndpoint: string;
  auroraPort: number;
  auroraDatabase: string;
  auroraForgeSecretArn: string;
  cartridgeBucketArn: string;
  omegaStateBucketArn: string;
  cortexModelBucketArn: string;
  globalBrainBucketArn: string;
  signingKeyArn: string;
}

export class ForgeStack extends cdk.Stack {
  public readonly service: ecs.FargateService;

  constructor(scope: Construct, id: string, props: ForgeStackProps) {
    super(scope, id, props);

    // ----------------------------------------------------------------
    // Task Definition
    // ----------------------------------------------------------------
    const taskDef = new ecs.FargateTaskDefinition(this, 'ForgeTaskDef', {
      cpu: 1024,
      memoryLimitMiB: 2048,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    // S3 access
    const bucketArns = [
      props.cartridgeBucketArn,
      props.omegaStateBucketArn,
      props.cortexModelBucketArn,
      props.globalBrainBucketArn,
    ];

    taskDef.addToTaskRolePolicy(new iam.PolicyStatement({
      actions: [
        's3:GetObject', 's3:PutObject', 's3:DeleteObject',
        's3:ListBucket', 's3:HeadObject',
      ],
      resources: [
        ...bucketArns,
        ...bucketArns.map(arn => `${arn}/*`),
      ],
    }));

    // KMS signing access
    taskDef.addToTaskRolePolicy(new iam.PolicyStatement({
      actions: [
        'kms:Sign', 'kms:GetPublicKey', 'kms:DescribeKey',
      ],
      resources: [props.signingKeyArn],
    }));

    // Secrets Manager access for Aurora credentials
    taskDef.addToTaskRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [props.auroraForgeSecretArn],
    }));

    // ----------------------------------------------------------------
    // Container
    // ----------------------------------------------------------------
    const forgeSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this, 'ForgeDbSecret', props.auroraForgeSecretArn
    );

    const logGroup = new logs.LogGroup(this, 'ForgeLogGroup', {
      logGroupName: '/radiant/omega-forge',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const container = taskDef.addContainer('forge', {
      image: ecs.ContainerImage.fromAsset('../../apps/omega-forge', {
        platform: ecr_assets.Platform.LINUX_ARM64,
      }),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'forge',
        logGroup,
      }),
      environment: {
        NODE_ENV: 'production',
        AURORA_PROXY_ENDPOINT: props.auroraProxyEndpoint,
        AURORA_PORT: String(props.auroraPort),
        AURORA_DATABASE: props.auroraDatabase,
      },
      secrets: {
        AURORA_FORGE_USER: ecs.Secret.fromSecretsManager(forgeSecret, 'username'),
        AURORA_FORGE_PASSWORD: ecs.Secret.fromSecretsManager(forgeSecret, 'password'),
      },
      portMappings: [{ containerPort: 3000 }],
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3000/ || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // ----------------------------------------------------------------
    // Security Group — private only
    // ----------------------------------------------------------------
    const forgeSg = new ec2.SecurityGroup(this, 'ForgeSg', {
      vpc: props.vpc,
      description: 'OMEGA Forge — private only, no public access',
      allowAllOutbound: true,
    });

    // Allow inbound from VPC CIDR only (VPN / bastion / SSM)
    forgeSg.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(3000),
      'Allow Forge access from VPC'
    );

    // ----------------------------------------------------------------
    // Fargate Service — private subnets, NO public IP
    // ----------------------------------------------------------------
    this.service = new ecs.FargateService(this, 'ForgeService', {
      cluster: props.cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      assignPublicIp: false,
      securityGroups: [forgeSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      circuitBreaker: { rollback: true },
      enableExecuteCommand: true,
    });

    // ----------------------------------------------------------------
    // Internal ALB (optional — for VPN access)
    // ----------------------------------------------------------------
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ForgeAlb', {
      vpc: props.vpc,
      internetFacing: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroup: forgeSg,
    });

    const listener = alb.addListener('ForgeListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    listener.addTargets('ForgeTarget', {
      port: 3000,
      targets: [this.service],
      healthCheck: {
        path: '/',
        interval: cdk.Duration.seconds(30),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    // ----------------------------------------------------------------
    // Outputs
    // ----------------------------------------------------------------
    new cdk.CfnOutput(this, 'ForgeAlbDns', {
      value: alb.loadBalancerDnsName,
      description: 'OMEGA Forge internal ALB DNS',
    });

    new cdk.CfnOutput(this, 'ForgeLogGroupName', {
      value: logGroup.logGroupName,
      description: 'OMEGA Forge CloudWatch log group',
    });
  }
}
