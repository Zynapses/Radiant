/**
 * RADIANT Multi-Protocol Gateway Stack
 * 
 * Deploys the WebSocket/SSE gateway infrastructure:
 * - Go Gateway on Fargate (WebSocket termination)
 * - Egress Proxy on Fargate (HTTP/2 connection pools)
 * - NATS JetStream on ECS (message broker)
 * - Network Load Balancer (TCP passthrough for WebSocket)
 * 
 * Architecture Corrections Applied:
 * 1. HTTP/2 pools run on Fargate (NOT Lambda)
 * 2. Defensive context management prevents zombie goroutines
 * 3. JetStream HISTORY stream replaces DynamoDB for replay
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';

export interface GatewayStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  cluster: ecs.ICluster;
  aiProviderSecrets?: {
    openai?: secretsmanager.ISecret;
    anthropic?: secretsmanager.ISecret;
    azure?: secretsmanager.ISecret;
  };
}

export class GatewayStack extends cdk.Stack {
  public readonly gatewayEndpoint: string;
  public readonly egressProxyEndpoint: string;

  constructor(scope: Construct, id: string, props: GatewayStackProps) {
    super(scope, id, props);

    const { vpc, cluster, aiProviderSecrets } = props;

    // Cloud Map namespace for service discovery
    const namespace = new servicediscovery.PrivateDnsNamespace(this, 'Namespace', {
      name: 'gateway.radiant.internal',
      vpc,
    });

    // Security Groups
    const gatewaySecurityGroup = new ec2.SecurityGroup(this, 'GatewaySG', {
      vpc,
      description: 'Security group for RADIANT Gateway',
      allowAllOutbound: true,
    });

    const natsSecurityGroup = new ec2.SecurityGroup(this, 'NatsSG', {
      vpc,
      description: 'Security group for NATS',
      allowAllOutbound: true,
    });

    const egressProxySecurityGroup = new ec2.SecurityGroup(this, 'EgressProxySG', {
      vpc,
      description: 'Security group for Egress Proxy',
      allowAllOutbound: true,
    });

    // Allow gateway to connect to NATS
    natsSecurityGroup.addIngressRule(
      gatewaySecurityGroup,
      ec2.Port.tcp(4222),
      'Allow Gateway to connect to NATS'
    );

    // Allow gateway to connect to Egress Proxy
    egressProxySecurityGroup.addIngressRule(
      gatewaySecurityGroup,
      ec2.Port.tcp(9000),
      'Allow Gateway to connect to Egress Proxy'
    );

    // ================================================================
    // NATS JetStream Service
    // ================================================================
    const natsTaskDefinition = new ecs.FargateTaskDefinition(this, 'NatsTask', {
      memoryLimitMiB: 4096,
      cpu: 2048,
    });

    const natsLogGroup = new logs.LogGroup(this, 'NatsLogs', {
      logGroupName: '/radiant/gateway/nats',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    natsTaskDefinition.addContainer('nats', {
      image: ecs.ContainerImage.fromRegistry('nats:2.10-alpine'),
      command: ['--jetstream', '--store_dir=/data', '--http_port=8222', '-DV'],
      portMappings: [
        { containerPort: 4222 },
        { containerPort: 8222 },
      ],
      logging: ecs.LogDrivers.awsLogs({
        logGroup: natsLogGroup,
        streamPrefix: 'nats',
      }),
      healthCheck: {
        command: ['CMD', 'wget', '-q', '--spider', 'http://localhost:8222/healthz'],
        interval: cdk.Duration.seconds(10),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
      },
    });

    const natsService = new ecs.FargateService(this, 'NatsService', {
      cluster,
      taskDefinition: natsTaskDefinition,
      desiredCount: 1, // Single node for dev; use NATS cluster for prod
      securityGroups: [natsSecurityGroup],
      cloudMapOptions: {
        name: 'nats',
        cloudMapNamespace: namespace,
      },
    });

    // ================================================================
    // Egress Proxy Service (CORRECTION #1: HTTP/2 pools here)
    // ================================================================
    const egressTaskDefinition = new ecs.FargateTaskDefinition(this, 'EgressTask', {
      memoryLimitMiB: 4096,
      cpu: 2048,
    });

    const egressLogGroup = new logs.LogGroup(this, 'EgressLogs', {
      logGroupName: '/radiant/gateway/egress-proxy',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const egressContainer = egressTaskDefinition.addContainer('egress-proxy', {
      image: ecs.ContainerImage.fromAsset('../../services/egress-proxy'),
      portMappings: [{ containerPort: 9000 }],
      environment: {
        PORT: '9000',
        LOG_LEVEL: 'info',
      },
      logging: ecs.LogDrivers.awsLogs({
        logGroup: egressLogGroup,
        streamPrefix: 'egress',
      }),
      healthCheck: {
        command: ['CMD', 'wget', '-q', '--spider', 'http://localhost:9000/health'],
        interval: cdk.Duration.seconds(10),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
      },
    });

    // Add AI provider secrets if available
    if (aiProviderSecrets?.openai) {
      egressContainer.addSecret('OPENAI_API_KEY', ecs.Secret.fromSecretsManager(aiProviderSecrets.openai));
    }
    if (aiProviderSecrets?.anthropic) {
      egressContainer.addSecret('ANTHROPIC_API_KEY', ecs.Secret.fromSecretsManager(aiProviderSecrets.anthropic));
    }
    if (aiProviderSecrets?.azure) {
      egressContainer.addSecret('AZURE_OPENAI_API_KEY', ecs.Secret.fromSecretsManager(aiProviderSecrets.azure));
    }

    const egressService = new ecs.FargateService(this, 'EgressService', {
      cluster,
      taskDefinition: egressTaskDefinition,
      desiredCount: 3, // Multiple instances for pool capacity
      securityGroups: [egressProxySecurityGroup],
      cloudMapOptions: {
        name: 'egress-proxy',
        cloudMapNamespace: namespace,
      },
    });

    // Internal ALB for Egress Proxy (Lambda workers call this)
    const egressAlb = new elbv2.ApplicationLoadBalancer(this, 'EgressALB', {
      vpc,
      internetFacing: false,
    });

    const egressListener = egressAlb.addListener('EgressListener', {
      port: 80,
    });

    egressListener.addTargets('EgressTargets', {
      port: 9000,
      targets: [egressService],
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
      },
    });

    // ================================================================
    // Go Gateway Service
    // ================================================================
    const gatewayTaskDefinition = new ecs.FargateTaskDefinition(this, 'GatewayTask', {
      memoryLimitMiB: 8192,
      cpu: 4096,
    });

    const gatewayLogGroup = new logs.LogGroup(this, 'GatewayLogs', {
      logGroupName: '/radiant/gateway/gateway',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    gatewayTaskDefinition.addContainer('gateway', {
      image: ecs.ContainerImage.fromAsset('../../apps/gateway'),
      portMappings: [
        { containerPort: 8443 },
        { containerPort: 8080 },
      ],
      environment: {
        GATEWAY_LISTEN_ADDR: ':8443',
        GATEWAY_HEALTH_ADDR: ':8080',
        NATS_URL: `nats://nats.${namespace.namespaceName}:4222`,
        EGRESS_PROXY_URL: `http://${egressAlb.loadBalancerDnsName}`,
      },
      logging: ecs.LogDrivers.awsLogs({
        logGroup: gatewayLogGroup,
        streamPrefix: 'gateway',
      }),
      healthCheck: {
        command: ['CMD', 'wget', '-q', '--spider', 'http://localhost:8080/health'],
        interval: cdk.Duration.seconds(10),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
      },
    });

    const gatewayService = new ecs.FargateService(this, 'GatewayService', {
      cluster,
      taskDefinition: gatewayTaskDefinition,
      desiredCount: 3,
      securityGroups: [gatewaySecurityGroup],
      cloudMapOptions: {
        name: 'gateway',
        cloudMapNamespace: namespace,
      },
    });

    // Network Load Balancer for Gateway (TCP passthrough for WebSocket)
    const gatewayNlb = new elbv2.NetworkLoadBalancer(this, 'GatewayNLB', {
      vpc,
      internetFacing: true,
    });

    const gatewayListener = gatewayNlb.addListener('GatewayListener', {
      port: 443,
    });

    gatewayListener.addTargets('GatewayTargets', {
      port: 8443,
      targets: [gatewayService],
      healthCheck: {
        port: '8080',
        path: '/health',
      },
    });

    // Auto-scaling
    const gatewayScaling = gatewayService.autoScaleTaskCount({
      minCapacity: 3,
      maxCapacity: 100,
    });

    gatewayScaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
    });

    gatewayScaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
    });

    const egressScaling = egressService.autoScaleTaskCount({
      minCapacity: 3,
      maxCapacity: 50,
    });

    egressScaling.scaleOnCpuUtilization('EgressCpuScaling', {
      targetUtilizationPercent: 70,
    });

    // ================================================================
    // A2A Worker Lambda (Agent-to-Agent Protocol Processing)
    // ================================================================
    // Note: A2A worker is deployed as part of the API stack's Lambda
    // infrastructure. The Gateway routes A2A messages to NATS subject
    // 'a2a.>' which are consumed by the A2A worker Lambda.
    // See: lambda/gateway/a2a-worker.ts

    // Outputs
    this.gatewayEndpoint = gatewayNlb.loadBalancerDnsName;
    this.egressProxyEndpoint = egressAlb.loadBalancerDnsName;

    new cdk.CfnOutput(this, 'GatewayEndpoint', {
      value: `wss://${gatewayNlb.loadBalancerDnsName}`,
      description: 'WebSocket endpoint for the gateway',
    });

    new cdk.CfnOutput(this, 'EgressProxyEndpoint', {
      value: `http://${egressAlb.loadBalancerDnsName}`,
      description: 'Internal endpoint for the egress proxy',
    });

    new cdk.CfnOutput(this, 'SupportedProtocols', {
      value: 'MCP (Model Context Protocol), A2A (Agent-to-Agent), OpenAI, Anthropic, Google',
      description: 'Protocols supported by this gateway',
    });
  }
}
