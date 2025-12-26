import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

export interface WafConstructProps {
  name: string;
  scope: 'REGIONAL' | 'CLOUDFRONT';
  tier: number;
  rateLimit?: number;
}

/**
 * Creates a WAF Web ACL with managed rules for API protection
 */
export class WafConstruct extends Construct {
  public readonly webAcl: wafv2.CfnWebACL;
  public readonly webAclArn: string;

  constructor(scope: Construct, id: string, props: WafConstructProps) {
    super(scope, id);

    const { name, tier, rateLimit = 2000 } = props;

    const rules: wafv2.CfnWebACL.RuleProperty[] = [];
    let priority = 0;

    // Rate limiting rule (all tiers)
    rules.push({
      name: 'RateLimitRule',
      priority: priority++,
      action: { block: {} },
      statement: {
        rateBasedStatement: {
          limit: rateLimit,
          aggregateKeyType: 'IP',
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: `${name}-rate-limit`,
      },
    });

    // AWS Managed Rules - Common Rule Set (all tiers)
    rules.push({
      name: 'AWSManagedRulesCommonRuleSet',
      priority: priority++,
      overrideAction: { none: {} },
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesCommonRuleSet',
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: `${name}-common-rules`,
      },
    });

    // Known Bad Inputs (tier 2+)
    if (tier >= 2) {
      rules.push({
        name: 'AWSManagedRulesKnownBadInputsRuleSet',
        priority: priority++,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesKnownBadInputsRuleSet',
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: `${name}-bad-inputs`,
        },
      });

      // SQL Injection protection
      rules.push({
        name: 'AWSManagedRulesSQLiRuleSet',
        priority: priority++,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesSQLiRuleSet',
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: `${name}-sqli`,
        },
      });
    }

    // Bot Control (tier 3+)
    if (tier >= 3) {
      rules.push({
        name: 'AWSManagedRulesBotControlRuleSet',
        priority: priority++,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesBotControlRuleSet',
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: `${name}-bot-control`,
        },
      });
    }

    // IP Reputation (tier 4+)
    if (tier >= 4) {
      rules.push({
        name: 'AWSManagedRulesAmazonIpReputationList',
        priority: priority++,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesAmazonIpReputationList',
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: `${name}-ip-reputation`,
        },
      });
    }

    // Create Web ACL
    this.webAcl = new wafv2.CfnWebACL(this, 'WebACL', {
      name,
      scope: props.scope,
      defaultAction: { allow: {} },
      rules,
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: name,
      },
    });

    this.webAclArn = this.webAcl.attrArn;

    // Outputs
    new cdk.CfnOutput(this, 'WebAclArn', {
      value: this.webAclArn,
      description: 'WAF Web ACL ARN',
    });
  }
}
