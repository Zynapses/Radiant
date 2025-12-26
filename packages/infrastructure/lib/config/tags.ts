import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface RadiantTags {
  project: string;
  environment: string;
  appId: string;
  tier: number;
  version?: string;
  costCenter?: string;
}

export function applyTags(scope: Construct, tags: RadiantTags): void {
  cdk.Tags.of(scope).add('Project', tags.project);
  cdk.Tags.of(scope).add('Environment', tags.environment);
  cdk.Tags.of(scope).add('AppId', tags.appId);
  cdk.Tags.of(scope).add('Tier', tags.tier.toString());
  cdk.Tags.of(scope).add('Version', tags.version || '4.18.0');
  cdk.Tags.of(scope).add('ManagedBy', 'CDK');
  
  if (tags.costCenter) {
    cdk.Tags.of(scope).add('CostCenter', tags.costCenter);
  }
}

export function getResourceName(
  appId: string,
  environment: string,
  resource: string,
  suffix?: string
): string {
  const base = `${appId}-${environment}-${resource}`;
  return suffix ? `${base}-${suffix}` : base;
}
