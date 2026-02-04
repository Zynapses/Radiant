import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import type { TierConfig, Environment } from '@radiant/shared';

export interface SecurityStackProps extends cdk.StackProps {
  appId: string;
  environment: Environment;
  tier: number;
  tierConfig: TierConfig;
  vpc: ec2.Vpc;
}

export class SecurityStack extends cdk.Stack {
  public readonly apiSecurityGroup: ec2.SecurityGroup;
  public readonly databaseSecurityGroup: ec2.SecurityGroup;
  public readonly webAcl?: wafv2.CfnWebACL;
  public readonly encryptionKey: kms.Key;
  public readonly secretsKey: kms.Key;
  public readonly cartridgeSigningKey: kms.Key;
  
  constructor(scope: Construct, id: string, props: SecurityStackProps) {
    super(scope, id, props);
    
    const { appId, environment, tierConfig, vpc } = props;
    const isProd = environment === 'prod';

    // KMS Key for data encryption (Aurora, DynamoDB, S3)
    this.encryptionKey = new kms.Key(this, 'EncryptionKey', {
      alias: `${appId}-${environment}-data-key`,
      description: `Data encryption key for ${appId} ${environment}`,
      enableKeyRotation: true,
      pendingWindow: cdk.Duration.days(isProd ? 30 : 7),
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // KMS Key for secrets (API keys, credentials)
    this.secretsKey = new kms.Key(this, 'SecretsKey', {
      alias: `${appId}-${environment}-secrets-key`,
      description: `Secrets encryption key for ${appId} ${environment}`,
      enableKeyRotation: true,
      pendingWindow: cdk.Duration.days(isProd ? 30 : 7),
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ==========================================================================
    // ASYMMETRIC SIGNING KEY (CARTRIDGE PKI)
    // ==========================================================================
    
    // Platform-level asymmetric signing key for Cartridge PKI
    // This key serves as the "Root CA" for the RADIANT platform:
    // - Signs Tenant CA certificates
    // - Used for platform-wide cartridge verification
    // - ECDSA P-256 for industry-standard digital signatures
    this.cartridgeSigningKey = new kms.Key(this, 'CartridgeSigningKey', {
      alias: `${appId}-${environment}-cartridge-signing`,
      description: `RADIANT platform signing key for .RADz cartridge verification - ${appId} ${environment}`,
      keySpec: kms.KeySpec.ECC_NIST_P256,
      keyUsage: kms.KeyUsage.SIGN_VERIFY,
      enableKeyRotation: false, // Asymmetric keys do NOT support automatic rotation
      pendingWindow: cdk.Duration.days(isProd ? 30 : 7),
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Tag for compliance and cost tracking
    cdk.Tags.of(this.cartridgeSigningKey).add('Purpose', 'CartridgePKI');
    cdk.Tags.of(this.cartridgeSigningKey).add('KeyType', 'Asymmetric');
    cdk.Tags.of(this.cartridgeSigningKey).add('Compliance', 'SOC2');

    // Grant Lambda service access to KMS keys
    const lambdaServicePrincipal = new iam.ServicePrincipal('lambda.amazonaws.com');
    this.encryptionKey.grantEncryptDecrypt(lambdaServicePrincipal);
    this.secretsKey.grantDecrypt(lambdaServicePrincipal);
    
    // Grant Lambda access to cartridge signing key
    this.cartridgeSigningKey.grant(lambdaServicePrincipal,
      'kms:Sign',
      'kms:Verify',
      'kms:GetPublicKey',
      'kms:DescribeKey',
    );

    // API Security Group
    this.apiSecurityGroup = new ec2.SecurityGroup(this, 'ApiSecurityGroup', {
      vpc,
      securityGroupName: `${appId}-${environment}-api-sg`,
      description: 'Security group for API services',
      allowAllOutbound: true,
    });
    
    this.apiSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic'
    );
    
    // Database Security Group
    this.databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc,
      securityGroupName: `${appId}-${environment}-db-sg`,
      description: 'Security group for database',
      allowAllOutbound: false,
    });
    
    this.databaseSecurityGroup.addIngressRule(
      this.apiSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from API'
    );
    
    // WAF (Tier 2+)
    if (tierConfig.enableWaf) {
      this.webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
        name: `${appId}-${environment}-waf`,
        description: `WAF for ${appId} ${environment}`,
        scope: 'REGIONAL',
        defaultAction: { allow: {} },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: `${appId}-${environment}-waf-metrics`,
          sampledRequestsEnabled: true,
        },
        rules: [
          {
            name: 'AWSManagedRulesCommonRuleSet',
            priority: 1,
            overrideAction: { none: {} },
            statement: {
              managedRuleGroupStatement: {
                vendorName: 'AWS',
                name: 'AWSManagedRulesCommonRuleSet',
              },
            },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: 'AWSManagedRulesCommonRuleSet',
              sampledRequestsEnabled: true,
            },
          },
          {
            name: 'AWSManagedRulesKnownBadInputsRuleSet',
            priority: 2,
            overrideAction: { none: {} },
            statement: {
              managedRuleGroupStatement: {
                vendorName: 'AWS',
                name: 'AWSManagedRulesKnownBadInputsRuleSet',
              },
            },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: 'AWSManagedRulesKnownBadInputsRuleSet',
              sampledRequestsEnabled: true,
            },
          },
          {
            name: 'RateLimitRule',
            priority: 3,
            action: { block: {} },
            statement: {
              rateBasedStatement: {
                limit: 2000,
                aggregateKeyType: 'IP',
              },
            },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: 'RateLimitRule',
              sampledRequestsEnabled: true,
            },
          },
        ],
      });
    }
    
    // Outputs
    new cdk.CfnOutput(this, 'ApiSecurityGroupId', {
      value: this.apiSecurityGroup.securityGroupId,
      description: 'API Security Group ID',
      exportName: `${appId}-${environment}-api-sg-id`,
    });
    
    new cdk.CfnOutput(this, 'DatabaseSecurityGroupId', {
      value: this.databaseSecurityGroup.securityGroupId,
      description: 'Database Security Group ID',
      exportName: `${appId}-${environment}-db-sg-id`,
    });
    
    if (this.webAcl) {
      new cdk.CfnOutput(this, 'WebAclArn', {
        value: this.webAcl.attrArn,
        description: 'WAF WebACL ARN',
        exportName: `${appId}-${environment}-waf-arn`,
      });
    }

    new cdk.CfnOutput(this, 'EncryptionKeyArn', {
      value: this.encryptionKey.keyArn,
      description: 'Data encryption key ARN',
      exportName: `${appId}-${environment}-encryption-key-arn`,
    });

    new cdk.CfnOutput(this, 'SecretsKeyArn', {
      value: this.secretsKey.keyArn,
      description: 'Secrets encryption key ARN',
      exportName: `${appId}-${environment}-secrets-key-arn`,
    });

    new cdk.CfnOutput(this, 'CartridgeSigningKeyId', {
      value: this.cartridgeSigningKey.keyId,
      description: 'Cartridge PKI signing key ID',
      exportName: `${appId}-${environment}-cartridge-signing-key-id`,
    });

    new cdk.CfnOutput(this, 'CartridgeSigningKeyArn', {
      value: this.cartridgeSigningKey.keyArn,
      description: 'Cartridge PKI signing key ARN',
      exportName: `${appId}-${environment}-cartridge-signing-key-arn`,
    });
  }
}
