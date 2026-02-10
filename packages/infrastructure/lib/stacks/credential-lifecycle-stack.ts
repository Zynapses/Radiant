/**
 * RADIANT Credential Lifecycle Stack
 *
 * Implements the unified credential security framework:
 * - AWS Config rules for dormant IAM key detection
 * - IAM Access Analyzer for least-privilege enforcement
 * - Secrets Manager auto-rotation for DB credentials
 * - Scheduled Lambdas for tenant API key hygiene
 * - SNS notifications for security events
 *
 * @version 1.0.0
 * @since RADIANT v4.18.0
 */

import * as cdk from 'aws-cdk-lib';
import * as config from 'aws-cdk-lib/aws-config';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as accessanalyzer from 'aws-cdk-lib/aws-accessanalyzer';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as path from 'path';
import { Construct } from 'constructs';
import type { Environment } from '@radiant/shared';

export interface CredentialLifecycleStackProps extends cdk.StackProps {
  appId: string;
  environment: Environment;
  alertEmail?: string;
  alertTopic?: sns.ITopic;
  secretsKey?: kms.IKey;
  dbSecretArn?: string;
  auroraClusterArn?: string;
}

export class CredentialLifecycleStack extends cdk.Stack {
  public readonly securityAlertTopic: sns.Topic;
  public readonly accessAnalyzer: accessanalyzer.CfnAnalyzer;

  constructor(scope: Construct, id: string, props: CredentialLifecycleStackProps) {
    super(scope, id, props);

    const { appId, environment, alertEmail, secretsKey } = props;
    const isProd = environment === 'prod';

    // ========================================================================
    // 1. SECURITY ALERT TOPIC
    // ========================================================================

    this.securityAlertTopic = new sns.Topic(this, 'SecurityAlertTopic', {
      topicName: `${appId}-${environment}-security-alerts`,
      displayName: `RADIANT ${environment} Security Alerts`,
    });

    if (alertEmail) {
      this.securityAlertTopic.addSubscription(
        new subscriptions.EmailSubscription(alertEmail)
      );
    }

    // Forward to existing alert topic if provided (SNS-to-SNS subscription)
    if (props.alertTopic) {
      new sns.CfnSubscription(this, 'ForwardToAlertTopic', {
        protocol: 'sns',
        topicArn: this.securityAlertTopic.topicArn,
        endpoint: props.alertTopic.topicArn,
      });
    }

    // ========================================================================
    // 2. AWS CONFIG RULES — Dormant IAM Key Detection
    // ========================================================================

    // Rule: Flag IAM access keys unused for 30 days
    new config.ManagedRule(this, 'UnusedCredentialsRule', {
      identifier: 'IAM_USER_UNUSED_CREDENTIALS_CHECK',
      configRuleName: `${appId}-${environment}-unused-credentials`,
      description: 'Flags IAM user credentials (access keys, passwords) not used within 30 days',
      inputParameters: {
        maxCredentialUsageAge: '30',
      },
      maximumExecutionFrequency: config.MaximumExecutionFrequency.TWELVE_HOURS,
    });

    // Rule: Ensure access keys are rotated within 90 days
    new config.ManagedRule(this, 'AccessKeyRotationRule', {
      identifier: 'ACCESS_KEYS_ROTATED',
      configRuleName: `${appId}-${environment}-access-key-rotation`,
      description: 'Ensures IAM access keys are rotated within 90 days',
      inputParameters: {
        maxAccessKeyAge: '90',
      },
      maximumExecutionFrequency: config.MaximumExecutionFrequency.TWELVE_HOURS,
    });

    // Rule: Root account should not have access keys
    new config.ManagedRule(this, 'RootAccountNoAccessKey', {
      identifier: 'IAM_ROOT_ACCESS_KEY_CHECK',
      configRuleName: `${appId}-${environment}-root-no-access-key`,
      description: 'Ensures root account has no access keys',
      maximumExecutionFrequency: config.MaximumExecutionFrequency.TWENTY_FOUR_HOURS,
    });

    // Rule: MFA enabled for root account
    new config.ManagedRule(this, 'RootMfaEnabled', {
      identifier: 'ROOT_ACCOUNT_MFA_ENABLED',
      configRuleName: `${appId}-${environment}-root-mfa`,
      description: 'Ensures MFA is enabled on root account',
      maximumExecutionFrequency: config.MaximumExecutionFrequency.TWENTY_FOUR_HOURS,
    });

    // ========================================================================
    // 3. IAM ACCESS ANALYZER — Least Privilege Enforcement
    // ========================================================================

    this.accessAnalyzer = new accessanalyzer.CfnAnalyzer(this, 'AccessAnalyzer', {
      analyzerName: `${appId}-${environment}-access-analyzer`,
      type: 'ACCOUNT',
      tags: [
        { key: 'Application', value: appId },
        { key: 'Environment', value: environment },
      ],
    });

    // EventBridge rule to alert on Access Analyzer findings
    new events.Rule(this, 'AccessAnalyzerFindingsRule', {
      ruleName: `${appId}-${environment}-access-analyzer-findings`,
      description: 'Alerts on new IAM Access Analyzer findings',
      eventPattern: {
        source: ['aws.access-analyzer'],
        detailType: ['Access Analyzer Finding'],
        detail: {
          status: ['ACTIVE'],
        },
      },
      targets: [new targets.SnsTopic(this.securityAlertTopic)],
    });

    // ========================================================================
    // 4. DB CREDENTIAL ROTATION (Secrets Manager)
    // ========================================================================

    if (props.dbSecretArn) {
      const dbSecret = secretsmanager.Secret.fromSecretCompleteArn(
        this, 'DbSecret', props.dbSecretArn
      );

      // Rotation schedule: 30 days for prod, 90 for dev
      const rotationDays = isProd ? 30 : 90;

      // The rotation Lambda for Aurora PostgreSQL
      const rotationLambda = new lambda.Function(this, 'DbCredRotationFn', {
        functionName: `${appId}-${environment}-db-cred-rotation`,
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/scheduled'), {
          bundling: {
            image: lambda.Runtime.NODEJS_20_X.bundlingImage,
            command: [
              'bash', '-c',
              'cp credential-rotation.handler.ts index.ts && npx esbuild index.ts --bundle --platform=node --target=node20 --outfile=/asset-output/index.js',
            ],
          },
        }),
        timeout: cdk.Duration.minutes(5),
        environment: {
          SECRETS_MANAGER_ENDPOINT: `https://secretsmanager.${this.region}.amazonaws.com`,
        },
      });

      // Grant the rotation Lambda access to secrets
      dbSecret.grantRead(rotationLambda);
      dbSecret.grantWrite(rotationLambda);

      if (secretsKey) {
        secretsKey.grantEncryptDecrypt(rotationLambda);
      }

      // Add rotation schedule
      dbSecret.addRotationSchedule('DbRotationSchedule', {
        rotationLambda,
        automaticallyAfter: cdk.Duration.days(rotationDays),
      });
    }

    // ========================================================================
    // 5. TENANT API KEY LIFECYCLE LAMBDAS
    // ========================================================================

    // 5a. Dormant Key Audit Lambda (runs daily)
    const dormantKeyAuditFn = new lambda.Function(this, 'DormantKeyAuditFn', {
      functionName: `${appId}-${environment}-dormant-key-audit`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dormant-key-audit.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/scheduled')),
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      environment: {
        ENVIRONMENT: environment,
        WARNING_DAYS_30: '30',
        WARNING_DAYS_45: '45',
        DISABLE_DAYS_60: '60',
        ALERT_TOPIC_ARN: this.securityAlertTopic.topicArn,
      },
    });

    this.securityAlertTopic.grantPublish(dormantKeyAuditFn);

    new events.Rule(this, 'DormantKeyAuditSchedule', {
      ruleName: `${appId}-${environment}-dormant-key-audit`,
      description: 'Daily audit of dormant tenant API keys',
      schedule: events.Schedule.cron({ hour: '6', minute: '0' }),
      targets: [new targets.LambdaFunction(dormantKeyAuditFn)],
    });

    // 5b. Key Expiry & Auto-Rotation Lambda (runs daily)
    const keyRotationFn = new lambda.Function(this, 'KeyRotationFn', {
      functionName: `${appId}-${environment}-api-key-rotation`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'api-key-rotation.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/scheduled')),
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      environment: {
        ENVIRONMENT: environment,
        GRACE_PERIOD_DAYS: '14',
        DEFAULT_EXPIRY_DAYS: '90',
        ALERT_TOPIC_ARN: this.securityAlertTopic.topicArn,
      },
    });

    this.securityAlertTopic.grantPublish(keyRotationFn);

    new events.Rule(this, 'KeyRotationSchedule', {
      ruleName: `${appId}-${environment}-api-key-rotation`,
      description: 'Daily check for expiring tenant API keys + auto-rotation',
      schedule: events.Schedule.cron({ hour: '7', minute: '0' }),
      targets: [new targets.LambdaFunction(keyRotationFn)],
    });

    // 5c. JWT Secret Rotation Lambda (runs on schedule via Secrets Manager)
    const jwtRotationFn = new lambda.Function(this, 'JwtRotationFn', {
      functionName: `${appId}-${environment}-jwt-secret-rotation`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'jwt-secret-rotation.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/scheduled')),
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      environment: {
        ENVIRONMENT: environment,
        ALERT_TOPIC_ARN: this.securityAlertTopic.topicArn,
      },
    });

    this.securityAlertTopic.grantPublish(jwtRotationFn);

    // 5d. Monthly IAM Access Report Lambda
    const iamReportFn = new lambda.Function(this, 'IamReportFn', {
      functionName: `${appId}-${environment}-iam-access-report`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'iam-access-report.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/scheduled')),
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
      environment: {
        ENVIRONMENT: environment,
        ANALYZER_ARN: this.accessAnalyzer.attrArn,
        ALERT_TOPIC_ARN: this.securityAlertTopic.topicArn,
      },
    });

    // Grant IAM read permissions for the report
    iamReportFn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'iam:GenerateCredentialReport',
        'iam:GetCredentialReport',
        'iam:ListUsers',
        'iam:ListAccessKeys',
        'iam:GetAccessKeyLastUsed',
        'access-analyzer:ListFindings',
        'access-analyzer:GetFinding',
      ],
      resources: ['*'],
    }));

    this.securityAlertTopic.grantPublish(iamReportFn);

    new events.Rule(this, 'IamReportSchedule', {
      ruleName: `${appId}-${environment}-monthly-iam-report`,
      description: 'Monthly IAM access & credential report',
      schedule: events.Schedule.cron({ day: '1', hour: '8', minute: '0' }),
      targets: [new targets.LambdaFunction(iamReportFn)],
    });

    // ========================================================================
    // OUTPUTS
    // ========================================================================

    new cdk.CfnOutput(this, 'SecurityAlertTopicArn', {
      value: this.securityAlertTopic.topicArn,
      description: 'Security alert SNS topic ARN',
      exportName: `${appId}-${environment}-security-alert-topic`,
    });

    new cdk.CfnOutput(this, 'AccessAnalyzerArn', {
      value: this.accessAnalyzer.attrArn,
      description: 'IAM Access Analyzer ARN',
      exportName: `${appId}-${environment}-access-analyzer-arn`,
    });
  }
}
