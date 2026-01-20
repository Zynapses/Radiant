/**
 * API Nested Stacks
 * 
 * Splits API routes into nested stacks to stay under CloudFormation's 500 resource limit.
 * Each nested stack contains a logical grouping of API routes.
 */

import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface ApiNestedStackProps extends cdk.NestedStackProps {
  api: apigateway.RestApi;
  authorizer: apigateway.IAuthorizer;
  adminAuthorizer: apigateway.IAuthorizer;
  lambdaIntegration: apigateway.LambdaIntegration;
  adminResource: apigateway.IResource;
  v2Resource: apigateway.IResource;
}

/**
 * Metrics API Nested Stack
 * Contains all /api/v2/admin/metrics/* routes
 */
export class MetricsApiNestedStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: ApiNestedStackProps) {
    super(scope, id, props);

    const { adminAuthorizer, lambdaIntegration, adminResource } = props;

    const authType = apigateway.AuthorizationType.COGNITO;

    // Create metrics resource if it doesn't exist
    const metrics = adminResource.addResource('metrics-nested');

    // Dashboard
    metrics.addResource('dashboard').addMethod('GET', lambdaIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: authType,
    });

    // Trends
    metrics.addResource('trends').addMethod('GET', lambdaIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: authType,
    });

    // Alerts
    const alerts = metrics.addResource('alerts');
    alerts.addMethod('GET', lambdaIntegration, { authorizer: adminAuthorizer, authorizationType: authType });
    alerts.addMethod('POST', lambdaIntegration, { authorizer: adminAuthorizer, authorizationType: authType });
    alerts.addResource('{alertId}').addMethod('DELETE', lambdaIntegration, { authorizer: adminAuthorizer, authorizationType: authType });

    // Logs
    const logs = metrics.addResource('logs');
    logs.addMethod('GET', lambdaIntegration, { authorizer: adminAuthorizer, authorizationType: authType });
    logs.addMethod('POST', lambdaIntegration, { authorizer: adminAuthorizer, authorizationType: authType });
  }
}

/**
 * Learning API Nested Stack  
 * Contains all /api/v2/admin/metrics/learning/* routes
 */
export class LearningApiNestedStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: ApiNestedStackProps) {
    super(scope, id, props);

    const { adminAuthorizer, lambdaIntegration, adminResource } = props;
    const authType = apigateway.AuthorizationType.COGNITO;

    const metricsLearning = adminResource.addResource('learning-nested');
    
    metricsLearning.addResource('influence').addMethod('GET', lambdaIntegration, { authorizer: adminAuthorizer, authorizationType: authType });
    
    const config = metricsLearning.addResource('config');
    config.addMethod('GET', lambdaIntegration, { authorizer: adminAuthorizer, authorizationType: authType });
    config.addMethod('PUT', lambdaIntegration, { authorizer: adminAuthorizer, authorizationType: authType });
    
    metricsLearning.addResource('tenant').addMethod('GET', lambdaIntegration, { authorizer: adminAuthorizer, authorizationType: authType });
    metricsLearning.addResource('global').addMethod('GET', lambdaIntegration, { authorizer: adminAuthorizer, authorizationType: authType });
    metricsLearning.addResource('model-performance').addMethod('GET', lambdaIntegration, { authorizer: adminAuthorizer, authorizationType: authType });
    metricsLearning.addResource('event').addMethod('POST', lambdaIntegration, { authorizer: adminAuthorizer, authorizationType: authType });
    
    const userPrefs = metricsLearning.addResource('user-preferences');
    userPrefs.addMethod('GET', lambdaIntegration, { authorizer: adminAuthorizer, authorizationType: authType });
    userPrefs.addMethod('POST', lambdaIntegration, { authorizer: adminAuthorizer, authorizationType: authType });

    // Snapshots
    const snapshots = metricsLearning.addResource('snapshots');
    snapshots.addMethod('GET', lambdaIntegration, { authorizer: adminAuthorizer, authorizationType: authType });
    snapshots.addMethod('POST', lambdaIntegration, { authorizer: adminAuthorizer, authorizationType: authType });
    snapshots.addResource('{snapshotId}').addResource('recover').addMethod('POST', lambdaIntegration, { authorizer: adminAuthorizer, authorizationType: authType });
    
    metricsLearning.addResource('recovery-logs').addMethod('GET', lambdaIntegration, { authorizer: adminAuthorizer, authorizationType: authType });
  }
}
