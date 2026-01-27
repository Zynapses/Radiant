import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import type { Environment } from '@radiant/shared';

/**
 * LiteLLM Gateway Stack
 * 
 * Deploys LiteLLM as an ECS Fargate service with:
 * - Auto-scaling based on CPU, memory, and request count
 * - Application Load Balancer for traffic distribution
 * - CloudWatch alarms for monitoring
 * - Redis integration for distributed rate limiting
 * - All parameters configurable via Admin Dashboard
 */

export interface LiteLLMGatewayStackProps extends cdk.StackProps {
  appId: string;
  environment: Environment;
  vpc: ec2.IVpc;
  
  // Optional existing cluster to use
  cluster?: ecs.ICluster;
  
  // Scaling (Admin Configurable)
  minTasks?: number;
  maxTasks?: number;
  desiredTasks?: number;
  taskCpu?: number;
  taskMemory?: number;
  
  // Auto-scaling thresholds
  targetCpuUtilization?: number;
  targetMemoryUtilization?: number;
  targetRequestsPerTarget?: number;
  scaleOutCooldown?: number;
  scaleInCooldown?: number;
  
  // Redis for rate limiting (optional)
  redisEndpoint?: string;
  redisPort?: number;
  
  // Database for usage tracking (optional)
  databaseSecretArn?: string;
  
  // Alarms
  enableAlarms?: boolean;
  alarmEmail?: string;
}

export class LiteLLMGatewayStack extends cdk.Stack {
  public readonly service: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly targetGroup: elbv2.ApplicationTargetGroup;
  public readonly cluster: ecs.Cluster;
  public readonly serviceSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: LiteLLMGatewayStackProps) {
    super(scope, id, props);

    const {
      appId,
      environment,
      vpc,
      minTasks = 2,
      maxTasks = 50,
      taskCpu = 2048,
      taskMemory = 4096,
      targetCpuUtilization = 70,
      targetMemoryUtilization = 80,
      targetRequestsPerTarget = 1000,
      scaleOutCooldown = 60,
      scaleInCooldown = 300,
      redisEndpoint,
      redisPort,
      databaseSecretArn,
    } = props;

    const resourcePrefix = `${appId}-${environment}`;
    const isProd = environment === 'prod';

    // ========================================================================
    // ECS CLUSTER
    // ========================================================================

    this.cluster = new ecs.Cluster(this, 'LiteLLMCluster', {
      clusterName: `${resourcePrefix}-litellm`,
      vpc,
      containerInsights: true,
    });

    // ========================================================================
    // SECRETS
    // ========================================================================

    const masterKeySecret = new secretsmanager.Secret(this, 'LiteLLMMasterKey', {
      secretName: `${resourcePrefix}/litellm/master-key`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({}),
        generateStringKey: 'key',
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    // ========================================================================
    // IAM ROLE FOR TASKS
    // ========================================================================

    const taskRole = new iam.Role(this, 'LiteLLMTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Role for LiteLLM ECS tasks',
    });

    // Allow reading secrets
    const secretResources = [
      masterKeySecret.secretArn,
      `arn:aws:secretsmanager:${this.region}:${this.account}:secret:${resourcePrefix}/*`,
    ];
    if (databaseSecretArn) {
      secretResources.push(databaseSecretArn);
    }
    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: secretResources,
    }));

    // Allow CloudWatch metrics
    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'cloudwatch:PutMetricData',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: ['*'],
    }));

    // ========================================================================
    // TASK DEFINITION
    // ========================================================================

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'LiteLLMTaskDef', {
      family: `${resourcePrefix}-litellm`,
      cpu: taskCpu,
      memoryLimitMiB: taskMemory,
      taskRole,
    });

    // Log Group
    const logGroup = new logs.LogGroup(this, 'LiteLLMLogGroup', {
      logGroupName: `/ecs/${resourcePrefix}-litellm`,
      retention: isProd ? logs.RetentionDays.ONE_YEAR : logs.RetentionDays.ONE_WEEK,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Build environment variables
    const containerEnv: Record<string, string> = {
      LITELLM_TELEMETRY: 'False',
      LITELLM_REQUEST_TIMEOUT: '600',
      LITELLM_SET_VERBOSE: isProd ? 'False' : 'True',
      LITELLM_DROP_PARAMS: 'True',
      STORE_MODEL_IN_DB: 'True',
      AWS_REGION: this.region,
    };
    
    // Add Redis config if available
    if (redisEndpoint && redisPort) {
      containerEnv.REDIS_HOST = redisEndpoint;
      containerEnv.REDIS_PORT = redisPort.toString();
    }

    // Build secrets
    const containerSecrets: Record<string, ecs.Secret> = {
      LITELLM_MASTER_KEY: ecs.Secret.fromSecretsManager(masterKeySecret, 'key'),
    };
    
    // Add database secret if available
    if (databaseSecretArn) {
      containerSecrets.DATABASE_URL = ecs.Secret.fromSecretsManager(
        secretsmanager.Secret.fromSecretCompleteArn(this, 'DbSecret', databaseSecretArn),
        'connectionString'
      );
    }

    // LiteLLM Container
    taskDefinition.addContainer('litellm', {
      image: ecs.ContainerImage.fromRegistry('ghcr.io/berriai/litellm:main-latest'),
      
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'litellm',
        logGroup,
      }),
      
      environment: containerEnv,
      
      secrets: containerSecrets,
      
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:4000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
      
      portMappings: [
        {
          containerPort: 4000,
          protocol: ecs.Protocol.TCP,
        },
      ],
    });

    // ========================================================================
    // SECURITY GROUP
    // ========================================================================

    this.serviceSecurityGroup = new ec2.SecurityGroup(this, 'LiteLLMSecurityGroup', {
      vpc,
      description: 'Security group for LiteLLM gateway',
      allowAllOutbound: true,
    });

    // ========================================================================
    // APPLICATION LOAD BALANCER
    // ========================================================================

    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'LiteLLMALB', {
      loadBalancerName: `${resourcePrefix}-litellm`,
      vpc,
      internetFacing: false,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    // Allow ALB to communicate with ECS tasks
    this.serviceSecurityGroup.addIngressRule(
      ec2.Peer.securityGroupId(this.loadBalancer.connections.securityGroups[0].securityGroupId),
      ec2.Port.tcp(4000),
      'Allow traffic from ALB'
    );

    // Target Group
    this.targetGroup = new elbv2.ApplicationTargetGroup(this, 'LiteLLMTargetGroup', {
      targetGroupName: `${resourcePrefix}-litellm`,
      vpc,
      port: 4000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      
      healthCheck: {
        enabled: true,
        path: '/health',
        protocol: elbv2.Protocol.HTTP,
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
      },
      
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // Listener
    this.loadBalancer.addListener('HttpListener', {
      port: 80,
      defaultTargetGroups: [this.targetGroup],
    });

    // ========================================================================
    // ECS SERVICE
    // ========================================================================

    this.service = new ecs.FargateService(this, 'LiteLLMService', {
      serviceName: `${resourcePrefix}-litellm`,
      cluster: this.cluster,
      taskDefinition,
      
      desiredCount: minTasks,
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
      
      securityGroups: [this.serviceSecurityGroup],
      
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      
      circuitBreaker: {
        rollback: true,
      },
      
      enableExecuteCommand: !isProd,
    });

    // Attach to target group
    this.service.attachToApplicationTargetGroup(this.targetGroup);

    // ========================================================================
    // AUTO-SCALING
    // ========================================================================

    const scaling = this.service.autoScaleTaskCount({
      minCapacity: minTasks,
      maxCapacity: maxTasks,
    });

    // Scale based on CPU utilization
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: targetCpuUtilization,
      scaleOutCooldown: cdk.Duration.seconds(scaleOutCooldown),
      scaleInCooldown: cdk.Duration.seconds(scaleInCooldown),
    });

    // Scale based on memory utilization
    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: targetMemoryUtilization,
      scaleOutCooldown: cdk.Duration.seconds(scaleOutCooldown),
      scaleInCooldown: cdk.Duration.seconds(scaleInCooldown),
    });

    // Scale based on request count
    scaling.scaleOnRequestCount('RequestCountScaling', {
      requestsPerTarget: targetRequestsPerTarget,
      targetGroup: this.targetGroup,
      scaleOutCooldown: cdk.Duration.seconds(scaleOutCooldown),
      scaleInCooldown: cdk.Duration.seconds(scaleInCooldown),
    });

    // ========================================================================
    // CLOUDWATCH ALARMS
    // ========================================================================

    // High CPU alarm
    new cloudwatch.Alarm(this, 'HighCpuAlarm', {
      alarmName: `${resourcePrefix}-litellm-high-cpu`,
      metric: this.service.metricCpuUtilization(),
      threshold: 90,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // High memory alarm
    new cloudwatch.Alarm(this, 'HighMemoryAlarm', {
      alarmName: `${resourcePrefix}-litellm-high-memory`,
      metric: this.service.metricMemoryUtilization(),
      threshold: 90,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Unhealthy targets alarm
    new cloudwatch.Alarm(this, 'UnhealthyTargetsAlarm', {
      alarmName: `${resourcePrefix}-litellm-unhealthy-targets`,
      metric: this.targetGroup.metrics.unhealthyHostCount(),
      threshold: 1,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // ========================================================================
    // OUTPUTS
    // ========================================================================

    new cdk.CfnOutput(this, 'ClusterArn', {
      value: this.cluster.clusterArn,
      exportName: `${resourcePrefix}-litellm-cluster-arn`,
    });

    new cdk.CfnOutput(this, 'ServiceArn', {
      value: this.service.serviceArn,
      exportName: `${resourcePrefix}-litellm-service-arn`,
    });

    new cdk.CfnOutput(this, 'LoadBalancerDns', {
      value: this.loadBalancer.loadBalancerDnsName,
      exportName: `${resourcePrefix}-litellm-lb-dns`,
    });

    new cdk.CfnOutput(this, 'LoadBalancerArn', {
      value: this.loadBalancer.loadBalancerArn,
      exportName: `${resourcePrefix}-litellm-lb-arn`,
    });

    new cdk.CfnOutput(this, 'TargetGroupArn', {
      value: this.targetGroup.targetGroupArn,
      exportName: `${resourcePrefix}-litellm-tg-arn`,
    });

    new cdk.CfnOutput(this, 'MasterKeySecretArn', {
      value: masterKeySecret.secretArn,
      exportName: `${resourcePrefix}-litellm-master-key-arn`,
    });
  }
}
