/**
 * Think Tank Authentication Stack
 * 
 * Provides API-based authentication for Think Tank apps.
 * Think Tank apps MUST NOT access Cognito directly - all auth flows
 * go through this Lambda which proxies to Cognito.
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
// NodejsFunction removed - using pre-built Lambda instead
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
// path import removed - using pre-built Lambda

export interface ThinkTankAuthStackProps extends cdk.StackProps {
  environment: string;
  domainPrefix: string;
  allowedOrigins: string[];
}

export class ThinkTankAuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly authApi: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ThinkTankAuthStackProps) {
    super(scope, id, props);

    const { environment, domainPrefix, allowedOrigins } = props;

    // =========================================================================
    // Cognito User Pool for Think Tank Users
    // =========================================================================
    this.userPool = new cognito.UserPool(this, 'ThinkTankUserPool', {
      userPoolName: `thinktank-users-${environment}`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        fullname: {
          required: false,
          mutable: true,
        },
      },
      customAttributes: {
        tenant_id: new cognito.StringAttribute({ mutable: false }),
        role: new cognito.StringAttribute({ mutable: true }),
        permissions: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(3),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
    });

    // User Pool Domain
    this.userPool.addDomain('ThinkTankDomain', {
      cognitoDomain: {
        domainPrefix: `${domainPrefix}-thinktank-${environment}`,
      },
    });

    // User Pool Client (with secret for server-side auth)
    this.userPoolClient = this.userPool.addClient('ThinkTankAppClient', {
      userPoolClientName: `thinktank-client-${environment}`,
      generateSecret: true,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls: allowedOrigins.map(origin => `${origin}/auth/callback`),
        logoutUrls: allowedOrigins,
      },
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
    });

    // =========================================================================
    // Auth Lambda Function (using pre-built code)
    // =========================================================================
    const authFunction = new lambda.Function(this, 'ThinkTankAuthFunction', {
      functionName: `thinktank-auth-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'auth/thinktank-auth.handler',
      code: lambda.Code.fromAsset('lambda/dist'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        THINKTANK_USER_POOL_ID: this.userPool.userPoolId,
        THINKTANK_CLIENT_ID: this.userPoolClient.userPoolClientId,
        THINKTANK_CLIENT_SECRET: this.userPoolClient.userPoolClientSecret.unsafeUnwrap(),
        ALLOWED_ORIGINS: allowedOrigins.join(','),
        NODE_ENV: environment,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Grant Cognito permissions to the Lambda
    authFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:InitiateAuth',
        'cognito-idp:RespondToAuthChallenge',
        'cognito-idp:SignUp',
        'cognito-idp:ConfirmSignUp',
        'cognito-idp:ForgotPassword',
        'cognito-idp:ConfirmForgotPassword',
        'cognito-idp:ChangePassword',
        'cognito-idp:GetUser',
        'cognito-idp:GlobalSignOut',
      ],
      resources: [this.userPool.userPoolArn],
    }));

    // =========================================================================
    // API Gateway for Auth Endpoints
    // =========================================================================
    this.authApi = new apigateway.RestApi(this, 'ThinkTankAuthApi', {
      restApiName: `thinktank-auth-api-${environment}`,
      description: 'API-based authentication for Think Tank applications',
      deployOptions: {
        stageName: environment,
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: allowedOrigins,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
        allowCredentials: true,
      },
    });

    // Auth resource
    const authResource = this.authApi.root.addResource('api').addResource('auth');

    // Lambda integration
    const authIntegration = new apigateway.LambdaIntegration(authFunction, {
      proxy: true,
    });

    // Auth endpoints
    const endpoints = [
      'login',
      'logout',
      'refresh',
      'register',
      'verify-email',
      'forgot-password',
      'reset-password',
      'change-password',
      'session',
    ];

    endpoints.forEach(endpoint => {
      const resource = authResource.addResource(endpoint);
      if (endpoint === 'session') {
        resource.addMethod('GET', authIntegration);
      } else {
        resource.addMethod('POST', authIntegration);
      }
    });

    // =========================================================================
    // Outputs
    // =========================================================================
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Think Tank Cognito User Pool ID',
      exportName: `ThinkTankUserPoolId-${environment}`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Think Tank Cognito User Pool Client ID',
      exportName: `ThinkTankClientId-${environment}`,
    });

    new cdk.CfnOutput(this, 'AuthApiUrl', {
      value: this.authApi.url,
      description: 'Think Tank Auth API URL',
      exportName: `ThinkTankAuthApiUrl-${environment}`,
    });
  }
}
