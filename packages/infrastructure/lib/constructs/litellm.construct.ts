import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
// iam reserved for future task role policies
import { Construct } from 'constructs';

export interface LiteLLMConstructProps {
  vpc: ec2.IVpc;
  cluster: ecs.ICluster;
  appId: string;
  environment: string;
  tier: number;
  cpu: number;
  memory: number;
  taskCount: number;
  minTasks?: number;
  maxTasks?: number;
  enableAutoScaling?: boolean;
  providerSecrets?: secretsmanager.ISecret[];
}

/**
 * LiteLLM ECS Fargate Service for unified AI provider access
 */
export class LiteLLMConstruct extends Construct {
  public readonly service: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly serviceUrl: string;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: LiteLLMConstructProps) {
    super(scope, id);

    const {
      vpc,
      cluster,
      appId,
      environment,
      tier,
      cpu,
      memory,
      taskCount,
      minTasks = 1,
      maxTasks = 10,
      enableAutoScaling = true,
      providerSecrets = [],
    } = props;

    // Security Group
    this.securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
      description: 'LiteLLM Fargate service security group',
      allowAllOutbound: true,
    });

    // Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      memoryLimitMiB: memory,
      cpu,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    // Grant access to provider secrets
    for (const secret of providerSecrets) {
      secret.grantRead(taskDefinition.taskRole);
    }

    // Container environment
    const containerEnv: Record<string, string> = {
      LITELLM_MODE: 'production',
      LITELLM_LOG: tier >= 3 ? 'INFO' : 'DEBUG',
      APP_ID: appId,
      ENVIRONMENT: environment,
      PORT: '4000',
    };

    // LiteLLM Container
    taskDefinition.addContainer('litellm', {
      image: ecs.ContainerImage.fromRegistry('ghcr.io/berriai/litellm:main-latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'litellm',
        logRetention: tier >= 3 ? logs.RetentionDays.THREE_MONTHS : logs.RetentionDays.ONE_MONTH,
      }),
      environment: containerEnv,
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

    // Internal Application Load Balancer
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      internetFacing: false,
      loadBalancerName: `${appId}-${environment}-litellm`.slice(0, 32),
      securityGroup: this.securityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      vpc,
      port: 4000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        timeout: cdk.Duration.seconds(5),
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // Listener
    this.loadBalancer.addListener('Listener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultTargetGroups: [targetGroup],
    });

    // Fargate Service
    this.service = new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition,
      desiredCount: taskCount,
      securityGroups: [this.securityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
      circuitBreaker: { rollback: true },
      enableExecuteCommand: tier <= 2, // Enable exec for dev/staging
    });

    this.service.attachToApplicationTargetGroup(targetGroup);

    // Auto Scaling
    if (enableAutoScaling && tier >= 2) {
      const scaling = this.service.autoScaleTaskCount({
        minCapacity: minTasks,
        maxCapacity: maxTasks,
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
    }

    this.serviceUrl = `http://${this.loadBalancer.loadBalancerDnsName}`;

    // Outputs
    new cdk.CfnOutput(this, 'LiteLLMUrl', {
      value: this.serviceUrl,
      description: 'LiteLLM internal service URL',
    });
  }

  /**
   * Allow inbound access from a security group
   */
  public allowFrom(securityGroup: ec2.ISecurityGroup, port: number = 4000): void {
    this.securityGroup.addIngressRule(
      securityGroup,
      ec2.Port.tcp(port),
      'Allow LiteLLM access'
    );
  }
}
