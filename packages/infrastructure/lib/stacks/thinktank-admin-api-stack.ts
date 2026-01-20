/**
 * Think Tank Admin API Stack
 * 
 * Separate stack for Think Tank Admin APIs to avoid CloudFormation resource limits
 * in the main API stack.
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface ThinkTankAdminApiStackProps extends cdk.StackProps {
  environment: string;
  appId: string;
  vpc: ec2.IVpc;
  securityGroup: ec2.ISecurityGroup;
  userPool: cognito.IUserPool;
  databaseSecretArn: string;
  databaseEndpoint: string;
}

export class ThinkTankAdminApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ThinkTankAdminApiStackProps) {
    super(scope, id, props);

    const { environment, appId, vpc, securityGroup, userPool, databaseSecretArn, databaseEndpoint } = props;

    // Lambda execution role
    const lambdaRole = new iam.Role(this, 'ThinktankAdminLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });

    // Grant Secrets Manager access
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [databaseSecretArn],
    }));

    // Common environment variables
    const commonEnv: Record<string, string> = {
      APP_ID: appId,
      ENVIRONMENT: environment,
      DATABASE_SECRET_ARN: databaseSecretArn,
      DATABASE_ENDPOINT: databaseEndpoint,
      NODE_OPTIONS: '--enable-source-maps',
    };

    // Think Tank Admin Lambda
    const thinktankAdminLambda = new lambda.Function(this, 'ThinktankAdminFunction', {
      functionName: `${appId}-${environment}-thinktank-admin`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'thinktank-admin/handler.handler',
      code: lambda.Code.fromAsset('lambda/dist'),
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: commonEnv,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [securityGroup],
      role: lambdaRole,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // API Gateway
    this.api = new apigateway.RestApi(this, 'ThinkTankAdminApi', {
      restApiName: `${appId}-${environment}-thinktank-admin-api`,
      description: 'Think Tank Admin API',
      deployOptions: {
        stageName: environment,
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
      },
    });

    // Cognito Authorizer
    const adminAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'AdminAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'thinktank-admin-authorizer',
    });

    const thinktankAdminIntegration = new apigateway.LambdaIntegration(thinktankAdminLambda);

    // API structure: /api/v2/...
    const api = this.api.root.addResource('api');
    const v2 = api.addResource('v2');
    const admin = v2.addResource('admin');

    // Dashboard routes: /api/v2/thinktank-admin/dashboard/stats
    const thinktankAdminResource = v2.addResource('thinktank-admin');
    const dashboard = thinktankAdminResource.addResource('dashboard');
    dashboard.addResource('stats').addMethod('GET', thinktankAdminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Thinktank routes: /api/v2/admin/thinktank/...
    const adminThinktank = admin.addResource('thinktank');
    adminThinktank.addResource('analytics').addMethod('GET', thinktankAdminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminThinktank.addResource('status').addMethod('GET', thinktankAdminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const config = adminThinktank.addResource('config');
    config.addMethod('GET', thinktankAdminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    config.addMethod('PATCH', thinktankAdminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // My Rules routes: /api/v2/admin/my-rules/...
    const myRules = admin.addResource('my-rules');
    myRules.addMethod('GET', thinktankAdminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    myRules.addMethod('POST', thinktankAdminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    myRules.addResource('presets').addMethod('GET', thinktankAdminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const myRuleId = myRules.addResource('{ruleId}');
    myRuleId.addMethod('PUT', thinktankAdminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    myRuleId.addMethod('DELETE', thinktankAdminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Shadow Tests routes: /api/v2/admin/shadow-tests/...
    const shadowTests = admin.addResource('shadow-tests');
    shadowTests.addMethod('GET', thinktankAdminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    shadowTests.addMethod('POST', thinktankAdminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const shadowTestSettings = shadowTests.addResource('settings');
    shadowTestSettings.addMethod('GET', thinktankAdminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    shadowTestSettings.addMethod('PUT', thinktankAdminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const shadowTestId = shadowTests.addResource('{testId}');
    shadowTestId.addResource('start').addMethod('POST', thinktankAdminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    shadowTestId.addResource('stop').addMethod('POST', thinktankAdminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    shadowTestId.addResource('promote').addMethod('POST', thinktankAdminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'Think Tank Admin API URL',
      exportName: `${appId}-${environment}-thinktank-admin-api-url`,
    });
  }
}
