import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
// secretsmanager reserved for provider API keys
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import type { TierConfig, Environment } from '@radiant/shared';

export interface AIStackProps extends cdk.StackProps {
  appId: string;
  environment: Environment;
  tier: number;
  tierConfig: TierConfig;
  vpc: ec2.Vpc;
  apiSecurityGroup: ec2.SecurityGroup;
}

export class AIStack extends cdk.Stack {
  public readonly litellmService: ecs.FargateService;
  public readonly litellmUrl: string;
  public readonly cluster: ecs.Cluster;

  constructor(scope: Construct, id: string, props: AIStackProps) {
    super(scope, id, props);

    const { appId, environment, tier, tierConfig, vpc, apiSecurityGroup } = props;

    // ECS Cluster
    this.cluster = new ecs.Cluster(this, 'AICluster', {
      clusterName: `${appId}-${environment}-ai`,
      vpc,
      containerInsights: tier >= 2,
    });

    // LiteLLM Task Definition
    const litellmTaskDef = new ecs.FargateTaskDefinition(this, 'LiteLLMTask', {
      memoryLimitMiB: tierConfig.litellmMemory,
      cpu: tierConfig.litellmCpu,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    // LiteLLM container
    litellmTaskDef.addContainer('litellm', {
      image: ecs.ContainerImage.fromRegistry('ghcr.io/berriai/litellm:main-latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'litellm',
        logRetention: logs.RetentionDays.ONE_MONTH,
      }),
      environment: {
        LITELLM_MODE: 'production',
        LITELLM_LOG: 'INFO',
        APP_ID: appId,
        ENVIRONMENT: environment,
      },
      portMappings: [
        { containerPort: 4000, protocol: ecs.Protocol.TCP },
      ],
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:4000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // Security Group for LiteLLM
    const litellmSecurityGroup = new ec2.SecurityGroup(this, 'LiteLLMSecurityGroup', {
      vpc,
      securityGroupName: `${appId}-${environment}-litellm-sg`,
      description: 'Security group for LiteLLM service',
      allowAllOutbound: true,
    });

    litellmSecurityGroup.addIngressRule(
      apiSecurityGroup,
      ec2.Port.tcp(4000),
      'Allow traffic from API'
    );

    // Internal ALB for LiteLLM
    const litellmAlb = new elbv2.ApplicationLoadBalancer(this, 'LiteLLMAlb', {
      vpc,
      internetFacing: false,
      loadBalancerName: `${appId}-${environment}-litellm`,
      securityGroup: litellmSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    const litellmTargetGroup = new elbv2.ApplicationTargetGroup(this, 'LiteLLMTargetGroup', {
      vpc,
      port: 4000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    litellmAlb.addListener('LiteLLMListener', {
      port: 80,
      defaultTargetGroups: [litellmTargetGroup],
    });

    // LiteLLM Fargate Service
    this.litellmService = new ecs.FargateService(this, 'LiteLLMService', {
      cluster: this.cluster,
      taskDefinition: litellmTaskDef,
      desiredCount: tierConfig.litellmTaskCount,
      serviceName: `${appId}-${environment}-litellm`,
      securityGroups: [litellmSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
      enableExecuteCommand: true,
      circuitBreaker: { rollback: true },
    });

    this.litellmService.attachToApplicationTargetGroup(litellmTargetGroup);

    // Auto scaling
    const scaling = this.litellmService.autoScaleTaskCount({
      minCapacity: tierConfig.litellmTaskCount,
      maxCapacity: tierConfig.litellmTaskCount * 4,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(30),
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(30),
    });

    this.litellmUrl = `http://${litellmAlb.loadBalancerDnsName}`;

    // Grant permissions to call external AI providers
    litellmTaskDef.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
        'ssm:GetParameter',
        'ssm:GetParameters',
      ],
      resources: ['*'],
    }));

    // Grant SageMaker permissions for self-hosted models (Tier 3+)
    if (tierConfig.enableSelfHostedModels) {
      litellmTaskDef.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'sagemaker:InvokeEndpoint',
          'sagemaker:DescribeEndpoint',
        ],
        resources: [`arn:aws:sagemaker:${this.region}:${this.account}:endpoint/*`],
      }));
    }

    // Outputs
    new cdk.CfnOutput(this, 'LiteLLMUrl', {
      value: this.litellmUrl,
      description: 'LiteLLM internal URL',
      exportName: `${appId}-${environment}-litellm-url`,
    });

    new cdk.CfnOutput(this, 'ClusterArn', {
      value: this.cluster.clusterArn,
      description: 'ECS Cluster ARN',
      exportName: `${appId}-${environment}-ai-cluster-arn`,
    });
  }
}
