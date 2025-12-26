import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import type { TierConfig, Environment } from '@radiant/shared';

export interface FoundationStackProps extends cdk.StackProps {
  appId: string;
  environment: Environment;
  tier: number;
  tierConfig: TierConfig;
}

export class FoundationStack extends cdk.Stack {
  public readonly encryptionKey: kms.Key;
  
  constructor(scope: Construct, id: string, props: FoundationStackProps) {
    super(scope, id, props);
    
    const { appId, environment, tier, tierConfig } = props;
    
    // KMS Key for encryption at rest
    this.encryptionKey = new kms.Key(this, 'EncryptionKey', {
      alias: `${appId}-${environment}-key`,
      description: `RADIANT encryption key for ${appId} ${environment}`,
      enableKeyRotation: true,
      removalPolicy: environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
    });
    
    // SSM Parameters for configuration
    new ssm.StringParameter(this, 'AppIdParam', {
      parameterName: `/${appId}/${environment}/config/app-id`,
      stringValue: appId,
      description: 'Application identifier',
    });
    
    new ssm.StringParameter(this, 'EnvironmentParam', {
      parameterName: `/${appId}/${environment}/config/environment`,
      stringValue: environment,
      description: 'Deployment environment',
    });
    
    new ssm.StringParameter(this, 'TierParam', {
      parameterName: `/${appId}/${environment}/config/tier`,
      stringValue: tier.toString(),
      description: 'Infrastructure tier level',
    });
    
    new ssm.StringParameter(this, 'VersionParam', {
      parameterName: `/${appId}/${environment}/config/version`,
      stringValue: props.tags?.Version || '4.18.0',
      description: 'RADIANT version',
    });
    
    // Outputs
    new cdk.CfnOutput(this, 'EncryptionKeyArn', {
      value: this.encryptionKey.keyArn,
      description: 'KMS encryption key ARN',
      exportName: `${appId}-${environment}-encryption-key-arn`,
    });
  }
}
