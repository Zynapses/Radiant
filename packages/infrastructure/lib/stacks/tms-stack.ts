/**
 * RADIANT TMS - CDK Stack
 * Tenant Management Service Infrastructure
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as signer from 'aws-cdk-lib/aws-signer';
import { Construct } from 'constructs';

export interface TmsStackProps extends cdk.StackProps {
  environment: string;
  auroraClusterArn: string;
  auroraSecretArn: string;
  databaseName: string;
  dataBucket: string;
  allowedOrigins: string[];
  adminEmail?: string;
  enableCodeSigning?: boolean;
}

export class TmsStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly securityAlertsTopic: sns.Topic;
  public readonly auditBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: TmsStackProps) {
    super(scope, id, props);

    const { environment, auroraClusterArn, auroraSecretArn, databaseName, dataBucket, allowedOrigins } = props;

    // =========================================================================
    // SECURITY ALERTS TOPIC
    // =========================================================================

    this.securityAlertsTopic = new sns.Topic(this, 'SecurityAlertsTopic', {
      topicName: `radiant-tms-security-alerts-${environment}`,
      displayName: 'RADIANT TMS Security Alerts',
    });

    if (props.adminEmail) {
      this.securityAlertsTopic.addSubscription(
        new snsSubscriptions.EmailSubscription(props.adminEmail)
      );
    }

    // =========================================================================
    // AUDIT BUCKET (with Object Lock)
    // =========================================================================

    this.auditBucket = new s3.Bucket(this, 'AuditBucket', {
      bucketName: `radiant-tms-audit-${this.account}-${this.region}-${environment}`,
      objectLockEnabled: true,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      lifecycleRules: [
        {
          id: 'TransitionToIA',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(365),
            },
          ],
        },
      ],
    });

    // Deny delete even for admins
    this.auditBucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      principals: [new iam.AnyPrincipal()],
      actions: ['s3:DeleteObject', 's3:DeleteObjectVersion'],
      resources: [`${this.auditBucket.bucketArn}/*`],
    }));

    // =========================================================================
    // CODE SIGNING (Optional)
    // =========================================================================

    let codeSigningConfig: lambda.CodeSigningConfig | undefined;
    if (props.enableCodeSigning) {
      const signingProfile = new signer.SigningProfile(this, 'SigningProfile', {
        platform: signer.Platform.AWS_LAMBDA_SHA384_ECDSA,
        signatureValidityPeriod: cdk.Duration.days(365),
      });

      codeSigningConfig = new lambda.CodeSigningConfig(this, 'CodeSigningConfig', {
        signingProfiles: [signingProfile],
        untrustedArtifactOnDeployment: lambda.UntrustedArtifactOnDeployment.ENFORCE,
      });
    }

    // =========================================================================
    // LAMBDA EXECUTION ROLE
    // =========================================================================

    const lambdaRole = new iam.Role(this, 'TmsLambdaRole', {
      roleName: `radiant-tms-lambda-role-${environment}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
    });

    // Aurora Data API permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'rds-data:ExecuteStatement',
        'rds-data:BeginTransaction',
        'rds-data:CommitTransaction',
        'rds-data:RollbackTransaction',
        'rds-data:BatchExecuteStatement',
      ],
      resources: [auroraClusterArn],
    }));

    // Secrets Manager
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [auroraSecretArn],
    }));

    // KMS for tenant keys
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'kms:CreateKey',
        'kms:ScheduleKeyDeletion',
        'kms:DescribeKey',
        'kms:TagResource',
      ],
      resources: ['*'],
    }));

    // S3 for data bucket
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:ListBucket', 's3:DeleteObject', 's3:DeleteObjects'],
      resources: [
        `arn:aws:s3:::${dataBucket}`,
        `arn:aws:s3:::${dataBucket}/tenants/*`,
      ],
    }));

    // SES for notifications
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));

    // SNS for security alerts
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['sns:Publish'],
      resources: [this.securityAlertsTopic.topicArn],
    }));

    // =========================================================================
    // COMMON LAMBDA CONFIGURATION
    // =========================================================================

    const commonLambdaProps: Partial<lambda.FunctionProps> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      tracing: lambda.Tracing.ACTIVE,
      role: lambdaRole,
      ...(codeSigningConfig ? { codeSigningConfig } : {}),
      environment: {
        AURORA_CLUSTER_ARN: auroraClusterArn,
        AURORA_SECRET_ARN: auroraSecretArn,
        DATABASE_NAME: databaseName,
        DATA_BUCKET: dataBucket,
        ENVIRONMENT: environment,
        ALLOWED_ORIGINS: allowedOrigins.join(','),
        SECURITY_ALERTS_TOPIC_ARN: this.securityAlertsTopic.topicArn,
        NODE_OPTIONS: '--enable-source-maps',
        LOG_LEVEL: environment === 'prod' ? 'info' : 'debug',
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    };

    // =========================================================================
    // API HANDLERS
    // =========================================================================

    const createTenantFn = new lambda.Function(this, 'CreateTenantFn', {
      ...commonLambdaProps,
      functionName: `radiant-tms-create-tenant-${environment}`,
      handler: 'index.createTenantHandler',
      code: lambda.Code.fromAsset('../../tms/dist'),
    });

    const getTenantFn = new lambda.Function(this, 'GetTenantFn', {
      ...commonLambdaProps,
      functionName: `radiant-tms-get-tenant-${environment}`,
      handler: 'index.getTenantHandler',
      code: lambda.Code.fromAsset('../../tms/dist'),
    });

    const updateTenantFn = new lambda.Function(this, 'UpdateTenantFn', {
      ...commonLambdaProps,
      functionName: `radiant-tms-update-tenant-${environment}`,
      handler: 'index.updateTenantHandler',
      code: lambda.Code.fromAsset('../../tms/dist'),
    });

    const deleteTenantFn = new lambda.Function(this, 'DeleteTenantFn', {
      ...commonLambdaProps,
      functionName: `radiant-tms-delete-tenant-${environment}`,
      handler: 'index.deleteTenantHandler',
      code: lambda.Code.fromAsset('../../tms/dist'),
    });

    const restoreTenantFn = new lambda.Function(this, 'RestoreTenantFn', {
      ...commonLambdaProps,
      functionName: `radiant-tms-restore-tenant-${environment}`,
      handler: 'index.restoreTenantHandler',
      code: lambda.Code.fromAsset('../../tms/dist'),
    });

    const requestRestoreCodeFn = new lambda.Function(this, 'RequestRestoreCodeFn', {
      ...commonLambdaProps,
      functionName: `radiant-tms-request-restore-code-${environment}`,
      handler: 'index.requestRestoreCodeHandler',
      code: lambda.Code.fromAsset('../../tms/dist'),
    });

    const phantomTenantFn = new lambda.Function(this, 'PhantomTenantFn', {
      ...commonLambdaProps,
      functionName: `radiant-tms-phantom-tenant-${environment}`,
      handler: 'index.phantomTenantHandler',
      code: lambda.Code.fromAsset('../../tms/dist'),
    });

    const listTenantsFn = new lambda.Function(this, 'ListTenantsFn', {
      ...commonLambdaProps,
      functionName: `radiant-tms-list-tenants-${environment}`,
      handler: 'index.listTenantsHandler',
      code: lambda.Code.fromAsset('../../tms/dist'),
    });

    const listMembershipsFn = new lambda.Function(this, 'ListMembershipsFn', {
      ...commonLambdaProps,
      functionName: `radiant-tms-list-memberships-${environment}`,
      handler: 'index.listMembershipsHandler',
      code: lambda.Code.fromAsset('../../tms/dist'),
    });

    const addMembershipFn = new lambda.Function(this, 'AddMembershipFn', {
      ...commonLambdaProps,
      functionName: `radiant-tms-add-membership-${environment}`,
      handler: 'index.addMembershipHandler',
      code: lambda.Code.fromAsset('../../tms/dist'),
    });

    const updateMembershipFn = new lambda.Function(this, 'UpdateMembershipFn', {
      ...commonLambdaProps,
      functionName: `radiant-tms-update-membership-${environment}`,
      handler: 'index.updateMembershipHandler',
      code: lambda.Code.fromAsset('../../tms/dist'),
    });

    const removeMembershipFn = new lambda.Function(this, 'RemoveMembershipFn', {
      ...commonLambdaProps,
      functionName: `radiant-tms-remove-membership-${environment}`,
      handler: 'index.removeMembershipHandler',
      code: lambda.Code.fromAsset('../../tms/dist'),
    });

    // =========================================================================
    // SCHEDULED JOB HANDLERS
    // =========================================================================

    const hardDeleteJobFn = new lambda.Function(this, 'HardDeleteJobFn', {
      ...commonLambdaProps,
      functionName: `radiant-tms-hard-delete-job-${environment}`,
      handler: 'index.hardDeleteJobHandler',
      code: lambda.Code.fromAsset('../../tms/dist'),
      timeout: cdk.Duration.minutes(5),
      reservedConcurrentExecutions: 1,
    });

    const deletionNotificationJobFn = new lambda.Function(this, 'DeletionNotificationJobFn', {
      ...commonLambdaProps,
      functionName: `radiant-tms-deletion-notification-job-${environment}`,
      handler: 'index.deletionNotificationJobHandler',
      code: lambda.Code.fromAsset('../../tms/dist'),
      timeout: cdk.Duration.minutes(5),
    });

    const orphanCheckJobFn = new lambda.Function(this, 'OrphanCheckJobFn', {
      ...commonLambdaProps,
      functionName: `radiant-tms-orphan-check-job-${environment}`,
      handler: 'index.orphanCheckJobHandler',
      code: lambda.Code.fromAsset('../../tms/dist'),
      timeout: cdk.Duration.minutes(5),
    });

    const complianceReportJobFn = new lambda.Function(this, 'ComplianceReportJobFn', {
      ...commonLambdaProps,
      functionName: `radiant-tms-compliance-report-job-${environment}`,
      handler: 'index.complianceReportJobHandler',
      code: lambda.Code.fromAsset('../../tms/dist'),
      timeout: cdk.Duration.minutes(5),
    });

    // =========================================================================
    // EVENTBRIDGE SCHEDULES
    // =========================================================================

    // Hard Delete Job - Daily 3:00 AM UTC
    new events.Rule(this, 'HardDeleteSchedule', {
      ruleName: `radiant-tms-hard-delete-${environment}`,
      schedule: events.Schedule.cron({ hour: '3', minute: '0' }),
      targets: [new targets.LambdaFunction(hardDeleteJobFn)],
    });

    // Deletion Notification Job - Daily 9:00 AM UTC
    new events.Rule(this, 'DeletionNotificationSchedule', {
      ruleName: `radiant-tms-deletion-notification-${environment}`,
      schedule: events.Schedule.cron({ hour: '9', minute: '0' }),
      targets: [new targets.LambdaFunction(deletionNotificationJobFn)],
    });

    // Orphan Check Job - Weekly Sunday 2:00 AM UTC
    new events.Rule(this, 'OrphanCheckSchedule', {
      ruleName: `radiant-tms-orphan-check-${environment}`,
      schedule: events.Schedule.cron({ weekDay: 'SUN', hour: '2', minute: '0' }),
      targets: [new targets.LambdaFunction(orphanCheckJobFn)],
    });

    // Compliance Report Job - Monthly 1st 4:00 AM UTC
    new events.Rule(this, 'ComplianceReportSchedule', {
      ruleName: `radiant-tms-compliance-report-${environment}`,
      schedule: events.Schedule.cron({ day: '1', hour: '4', minute: '0' }),
      targets: [new targets.LambdaFunction(complianceReportJobFn)],
    });

    // =========================================================================
    // API GATEWAY
    // =========================================================================

    this.api = new apigateway.RestApi(this, 'TmsApi', {
      restApiName: `radiant-tms-api-${environment}`,
      description: 'RADIANT Tenant Management Service API',
      deployOptions: {
        stageName: 'v1',
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: allowedOrigins,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Trace-Id', 'X-Tenant-Id', 'X-User-Id', 'X-Admin-Id'],
        allowCredentials: true,
      },
    });

    // API Resources
    const tenantsResource = this.api.root.addResource('tenants');
    const tenantResource = tenantsResource.addResource('{tenantId}');
    const restoreResource = tenantResource.addResource('restore');
    const requestCodeResource = restoreResource.addResource('request-code');
    const usersResource = tenantResource.addResource('users');
    const userResource = usersResource.addResource('{userId}');
    const phantomResource = this.api.root.addResource('phantom-tenant');

    // Tenant CRUD
    tenantsResource.addMethod('GET', new apigateway.LambdaIntegration(listTenantsFn));
    tenantsResource.addMethod('POST', new apigateway.LambdaIntegration(createTenantFn));
    tenantResource.addMethod('GET', new apigateway.LambdaIntegration(getTenantFn));
    tenantResource.addMethod('PUT', new apigateway.LambdaIntegration(updateTenantFn));
    tenantResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteTenantFn));

    // Restore
    restoreResource.addMethod('POST', new apigateway.LambdaIntegration(restoreTenantFn));
    requestCodeResource.addMethod('POST', new apigateway.LambdaIntegration(requestRestoreCodeFn));

    // Phantom tenant
    phantomResource.addMethod('POST', new apigateway.LambdaIntegration(phantomTenantFn));

    // Memberships
    usersResource.addMethod('GET', new apigateway.LambdaIntegration(listMembershipsFn));
    usersResource.addMethod('POST', new apigateway.LambdaIntegration(addMembershipFn));
    userResource.addMethod('PUT', new apigateway.LambdaIntegration(updateMembershipFn));
    userResource.addMethod('DELETE', new apigateway.LambdaIntegration(removeMembershipFn));

    // =========================================================================
    // OUTPUTS
    // =========================================================================

    new cdk.CfnOutput(this, 'TmsApiUrl', {
      value: this.api.url,
      description: 'TMS API URL',
      exportName: `radiant-tms-api-url-${environment}`,
    });

    new cdk.CfnOutput(this, 'TmsApiId', {
      value: this.api.restApiId,
      description: 'TMS API ID',
      exportName: `radiant-tms-api-id-${environment}`,
    });

    new cdk.CfnOutput(this, 'SecurityAlertsTopicArn', {
      value: this.securityAlertsTopic.topicArn,
      description: 'Security Alerts SNS Topic ARN',
      exportName: `radiant-tms-security-alerts-arn-${environment}`,
    });

    new cdk.CfnOutput(this, 'AuditBucketName', {
      value: this.auditBucket.bucketName,
      description: 'Audit Bucket Name',
      exportName: `radiant-tms-audit-bucket-${environment}`,
    });
  }
}
