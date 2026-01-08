import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface MissionControlStackProps extends cdk.StackProps {
  readonly environment: 'dev' | 'staging' | 'prod';
  readonly vpc: ec2.IVpc;
  readonly cluster: ecs.ICluster;
  readonly redisHost: string;
  readonly redisPort: number;
  readonly dbSecretArn: string;
  readonly cognitoUserPoolArn: string;
  readonly sharedLambdaLayer: lambda.ILayerVersion;
}

export class MissionControlStack extends cdk.Stack {
  public readonly webSocketApi: apigatewayv2.WebSocketApi;
  public readonly restApi: apigateway.RestApi;
  public readonly redisBridgeService: ecs.FargateService;

  constructor(scope: Construct, id: string, props: MissionControlStackProps) {
    super(scope, id, props);

    const { environment, vpc, cluster, redisHost, redisPort, dbSecretArn } = props;

    // ========================================================================
    // S3 BRONZE BUCKET (v4.20.3 - Critical for Payload Offloading)
    // ========================================================================
    
    // Reference the Bronze Bucket from RADIANT core infrastructure
    // This bucket stores payload offloads for Flyte workflow inputs
    const bronzeBucket = s3.Bucket.fromBucketName(
      this, 
      'BronzeBucket', 
      `radiant-bronze-${environment}` 
    );

    // ========================================================================
    // LAMBDA FUNCTIONS
    // ========================================================================

    // Mission Control API Lambda
    const missionControlLambda = new lambda.Function(this, 'MissionControlLambda', {
      functionName: `radiant-mission-control-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/lambda/mission-control'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      layers: [props.sharedLambdaLayer],
      environment: {
        NODE_ENV: environment,
        DB_SECRET_ARN: dbSecretArn,
        REDIS_HOST: redisHost,
        REDIS_PORT: String(redisPort),
        FLYTE_ADMIN_URL: `https://flyte.${environment}.radiant.internal`,
        RADIANT_BRONZE_BUCKET: bronzeBucket.bucketName,
      },
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Grant Secrets Manager access
    const dbSecret = secretsmanager.Secret.fromSecretCompleteArn(this, 'DbSecret', dbSecretArn);
    dbSecret.grantRead(missionControlLambda);
    
    // Grant S3 permissions for payload offloading (v4.20.3)
    bronzeBucket.grantReadWrite(missionControlLambda);

    // WebSocket Connection Handler Lambda
    const wsConnectionLambda = new lambda.Function(this, 'WsConnectionLambda', {
      functionName: `radiant-ws-connection-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'connection-handler.handler',
      code: lambda.Code.fromAsset('dist/lambda/websocket'),
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      layers: [props.sharedLambdaLayer],
      environment: {
        NODE_ENV: environment,
        REDIS_HOST: redisHost,
        REDIS_PORT: String(redisPort),
      },
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Timeout Cleanup Lambda
    const timeoutCleanupLambda = new lambda.Function(this, 'TimeoutCleanupLambda', {
      functionName: `radiant-decision-timeout-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/lambda/timeout-cleanup'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      layers: [props.sharedLambdaLayer],
      environment: {
        NODE_ENV: environment,
        DB_SECRET_ARN: dbSecretArn,
        REDIS_HOST: redisHost,
        REDIS_PORT: String(redisPort),
        PAGERDUTY_ROUTING_KEY: `{{resolve:secretsmanager:radiant/pagerduty-${environment}:SecretString:routing_key}}`,
        SLACK_WEBHOOK_URL: `{{resolve:secretsmanager:radiant/slack-${environment}:SecretString:webhook_url}}`,
        FLYTE_ADMIN_URL: `https://flyte.${environment}.radiant.internal`,
      },
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });
    dbSecret.grantRead(timeoutCleanupLambda);

    // ========================================================================
    // REST API
    // ========================================================================

    this.restApi = new apigateway.RestApi(this, 'MissionControlApi', {
      restApiName: `radiant-mission-control-api-${environment}`,
      description: 'RADIANT Mission Control REST API',
      deployOptions: {
        stageName: environment,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        throttlingBurstLimit: 100,
        throttlingRateLimit: 200,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
      },
    });

    // API Gateway Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(missionControlLambda, {
      proxy: true,
    });

    // /api/mission-control resource
    const apiResource = this.restApi.root.addResource('api');
    const missionControl = apiResource.addResource('mission-control');

    // /decisions endpoints
    const decisions = missionControl.addResource('decisions');
    decisions.addMethod('GET', lambdaIntegration);  // List pending decisions
    decisions.addMethod('POST', lambdaIntegration); // Create decision (internal)

    // /decisions/{id} endpoints
    const decisionById = decisions.addResource('{id}');
    decisionById.addMethod('GET', lambdaIntegration);  // Get decision details

    // /decisions/{id}/resolve endpoint
    const resolve = decisionById.addResource('resolve');
    resolve.addMethod('POST', lambdaIntegration);  // Resolve decision

    // /stats endpoint
    const stats = missionControl.addResource('stats');
    stats.addMethod('GET', lambdaIntegration);  // Get dashboard stats

    // /config endpoint
    const config = missionControl.addResource('config');
    config.addMethod('GET', lambdaIntegration);   // Get domain configs
    config.addMethod('PUT', lambdaIntegration);   // Update domain config

    // ========================================================================
    // WEBSOCKET API
    // ========================================================================

    this.webSocketApi = new apigatewayv2.WebSocketApi(this, 'MissionControlWsApi', {
      apiName: `radiant-mission-control-ws-${environment}`,
      description: 'RADIANT Mission Control WebSocket API',
      connectRouteOptions: {
        integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
          'ConnectIntegration',
          wsConnectionLambda
        ),
      },
      disconnectRouteOptions: {
        integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
          'DisconnectIntegration',
          wsConnectionLambda
        ),
      },
      defaultRouteOptions: {
        integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
          'DefaultIntegration',
          wsConnectionLambda
        ),
      },
    });

    const wsStage = new apigatewayv2.WebSocketStage(this, 'MissionControlWsStage', {
      webSocketApi: this.webSocketApi,
      stageName: environment,
      autoDeploy: true,
    });

    // Grant WebSocket management permissions to Lambda
    wsConnectionLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['execute-api:ManageConnections'],
      resources: [
        `arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.apiId}/${environment}/*`,
      ],
    }));

    // ========================================================================
    // REDIS BRIDGE SERVICE (ECS Fargate)
    // ========================================================================

    const redisBridgeTaskDefinition = new ecs.FargateTaskDefinition(this, 'RedisBridgeTask', {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    const redisBridgeContainer = redisBridgeTaskDefinition.addContainer('RedisBridge', {
      image: ecs.ContainerImage.fromAsset('./services/redis-bridge'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'redis-bridge',
        logRetention: logs.RetentionDays.ONE_WEEK,
      }),
      environment: {
        NODE_ENV: environment,
        REDIS_HOST: redisHost,
        REDIS_PORT: String(redisPort),
        WEBSOCKET_API_ENDPOINT: wsStage.url,
        AWS_REGION: this.region,
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
      },
    });

    redisBridgeContainer.addPortMappings({
      containerPort: 3000,
      protocol: ecs.Protocol.TCP,
    });

    // Grant WebSocket management permissions to Redis Bridge
    redisBridgeTaskDefinition.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['execute-api:ManageConnections'],
      resources: [
        `arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.apiId}/${environment}/*`,
      ],
    }));

    this.redisBridgeService = new ecs.FargateService(this, 'RedisBridgeService', {
      cluster,
      taskDefinition: redisBridgeTaskDefinition,
      desiredCount: environment === 'prod' ? 2 : 1,
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      circuitBreaker: { rollback: true },
      enableExecuteCommand: true,
    });

    // ========================================================================
    // SCHEDULED EVENTS
    // ========================================================================

    // Timeout cleanup runs every minute
    const timeoutRule = new events.Rule(this, 'TimeoutCleanupRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      enabled: true,
    });
    timeoutRule.addTarget(new targets.LambdaFunction(timeoutCleanupLambda));

    // Stale connection cleanup runs every 5 minutes
    const staleConnectionRule = new events.Rule(this, 'StaleConnectionRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      enabled: true,
    });
    staleConnectionRule.addTarget(new targets.LambdaFunction(wsConnectionLambda, {
      event: events.RuleTargetInput.fromObject({
        action: 'cleanup_stale',
      }),
    }));

    // ========================================================================
    // OUTPUTS
    // ========================================================================

    new cdk.CfnOutput(this, 'RestApiUrl', {
      value: this.restApi.url,
      description: 'Mission Control REST API URL',
      exportName: `${id}-RestApiUrl`,
    });

    new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: wsStage.url,
      description: 'Mission Control WebSocket URL',
      exportName: `${id}-WebSocketUrl`,
    });

    new cdk.CfnOutput(this, 'RedisBridgeServiceArn', {
      value: this.redisBridgeService.serviceArn,
      description: 'Redis Bridge Service ARN',
      exportName: `${id}-RedisBridgeServiceArn`,
    });

    // ========================================================================
    // TAGS
    // ========================================================================

    cdk.Tags.of(this).add('Project', 'RADIANT');
    cdk.Tags.of(this).add('Component', 'MissionControl');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
