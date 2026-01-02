import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface CollaborationStackProps extends cdk.StackProps {
  environment: string;
  databaseSecurityGroupId: string;
  vpcId: string;
  privateSubnetIds: string[];
  databaseSecretArn: string;
}

export class CollaborationStack extends cdk.Stack {
  public readonly websocketApiEndpoint: string;
  public readonly websocketApiId: string;
  public readonly connectionsTableArn: string;

  constructor(scope: Construct, id: string, props: CollaborationStackProps) {
    super(scope, id, props);

    const { environment } = props;

    // DynamoDB table for WebSocket connections (fast lookup required)
    const connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      tableName: `radiant-${environment}-ws-connections`,
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
    });

    // GSI for looking up connections by session
    connectionsTable.addGlobalSecondaryIndex({
      indexName: 'sessionId-index',
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for looking up connections by participant
    connectionsTable.addGlobalSecondaryIndex({
      indexName: 'participantId-index',
      partitionKey: { name: 'participantId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Lambda execution role
    const lambdaRole = new iam.Role(this, 'CollaborationLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });

    // Grant DynamoDB access
    connectionsTable.grantReadWriteData(lambdaRole);

    // Grant Secrets Manager access
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [props.databaseSecretArn],
    }));

    // Common Lambda environment
    const lambdaEnv = {
      ENVIRONMENT: environment,
      CONNECTIONS_TABLE: connectionsTable.tableName,
      DATABASE_SECRET_ARN: props.databaseSecretArn,
      NODE_OPTIONS: '--enable-source-maps',
    };

    // Connect handler
    const connectHandler = new lambda.Function(this, 'ConnectHandler', {
      functionName: `radiant-${environment}-ws-connect`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/collaboration/connect'),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: lambdaEnv,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Disconnect handler
    const disconnectHandler = new lambda.Function(this, 'DisconnectHandler', {
      functionName: `radiant-${environment}-ws-disconnect`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/collaboration/disconnect'),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: lambdaEnv,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Default message handler (routes messages)
    const messageHandler = new lambda.Function(this, 'MessageHandler', {
      functionName: `radiant-${environment}-ws-message`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/collaboration/message'),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: lambdaEnv,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Broadcast handler (sends messages to session participants)
    const broadcastHandler = new lambda.Function(this, 'BroadcastHandler', {
      functionName: `radiant-${environment}-ws-broadcast`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/collaboration/broadcast'),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: lambdaEnv,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // WebSocket API
    const websocketApi = new apigatewayv2.WebSocketApi(this, 'CollaborationWebSocket', {
      apiName: `radiant-${environment}-collaboration-ws`,
      description: 'Real-time collaboration WebSocket API for Think Tank',
      connectRouteOptions: {
        integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
          'ConnectIntegration',
          connectHandler
        ),
      },
      disconnectRouteOptions: {
        integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
          'DisconnectIntegration',
          disconnectHandler
        ),
      },
      defaultRouteOptions: {
        integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
          'DefaultIntegration',
          messageHandler
        ),
      },
    });

    // WebSocket stage
    new apigatewayv2.WebSocketStage(this, 'CollaborationStage', {
      webSocketApi: websocketApi,
      stageName: environment,
      autoDeploy: true,
    });

    // Grant API Gateway management permissions to broadcast handler
    const apiGatewayPolicy = new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [
        `arn:aws:execute-api:${this.region}:${this.account}:${websocketApi.apiId}/${environment}/*`,
      ],
    });
    broadcastHandler.addToRolePolicy(apiGatewayPolicy);
    messageHandler.addToRolePolicy(apiGatewayPolicy);

    // Add WebSocket URL to Lambda environment
    const websocketUrl = `wss://${websocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${environment}`;
    
    connectHandler.addEnvironment('WEBSOCKET_URL', websocketUrl);
    disconnectHandler.addEnvironment('WEBSOCKET_URL', websocketUrl);
    messageHandler.addEnvironment('WEBSOCKET_URL', websocketUrl);
    broadcastHandler.addEnvironment('WEBSOCKET_URL', websocketUrl);
    messageHandler.addEnvironment('BROADCAST_FUNCTION_NAME', broadcastHandler.functionName);

    // Allow message handler to invoke broadcast handler
    broadcastHandler.grantInvoke(messageHandler);

    // Outputs
    this.websocketApiEndpoint = websocketUrl;
    this.websocketApiId = websocketApi.apiId;
    this.connectionsTableArn = connectionsTable.tableArn;

    new cdk.CfnOutput(this, 'WebSocketEndpoint', {
      value: websocketUrl,
      description: 'WebSocket API endpoint for real-time collaboration',
      exportName: `radiant-${environment}-ws-endpoint`,
    });

    new cdk.CfnOutput(this, 'ConnectionsTableName', {
      value: connectionsTable.tableName,
      description: 'DynamoDB table for WebSocket connections',
      exportName: `radiant-${environment}-ws-connections-table`,
    });
  }
}
