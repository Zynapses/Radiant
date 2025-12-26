import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as waf from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

interface RateLimitingProps {
  appId: string;
  environment: string;
  apiGateway: apigateway.RestApi;
}

/**
 * Rate Limiting Configuration for RADIANT API
 * 
 * Implements multi-tier rate limiting:
 * 1. API Gateway usage plans (per API key)
 * 2. WAF rate-based rules (per IP)
 * 3. Lambda-level throttling (per tenant)
 */
export class RateLimiting extends Construct {
  public readonly webAcl: waf.CfnWebACL;
  public readonly usagePlans: Map<string, apigateway.UsagePlan>;

  constructor(scope: Construct, id: string, props: RateLimitingProps) {
    super(scope, id);

    const { appId, environment, apiGateway } = props;

    // Create usage plans for different tiers
    this.usagePlans = new Map();

    // Free tier - very limited
    const freeUsagePlan = new apigateway.UsagePlan(this, 'FreeUsagePlan', {
      name: `${appId}-${environment}-free`,
      description: 'Free tier rate limits',
      throttle: {
        rateLimit: 10,      // 10 requests per second
        burstLimit: 20,     // Burst up to 20
      },
      quota: {
        limit: 1000,        // 1000 requests per day
        period: apigateway.Period.DAY,
      },
    });
    this.usagePlans.set('free', freeUsagePlan);

    // Starter tier
    const starterUsagePlan = new apigateway.UsagePlan(this, 'StarterUsagePlan', {
      name: `${appId}-${environment}-starter`,
      description: 'Starter tier rate limits',
      throttle: {
        rateLimit: 50,
        burstLimit: 100,
      },
      quota: {
        limit: 10000,
        period: apigateway.Period.DAY,
      },
    });
    this.usagePlans.set('starter', starterUsagePlan);

    // Professional tier
    const professionalUsagePlan = new apigateway.UsagePlan(this, 'ProfessionalUsagePlan', {
      name: `${appId}-${environment}-professional`,
      description: 'Professional tier rate limits',
      throttle: {
        rateLimit: 100,
        burstLimit: 200,
      },
      quota: {
        limit: 50000,
        period: apigateway.Period.DAY,
      },
    });
    this.usagePlans.set('professional', professionalUsagePlan);

    // Business tier
    const businessUsagePlan = new apigateway.UsagePlan(this, 'BusinessUsagePlan', {
      name: `${appId}-${environment}-business`,
      description: 'Business tier rate limits',
      throttle: {
        rateLimit: 500,
        burstLimit: 1000,
      },
      quota: {
        limit: 250000,
        period: apigateway.Period.DAY,
      },
    });
    this.usagePlans.set('business', businessUsagePlan);

    // Enterprise tier - highest limits
    const enterpriseUsagePlan = new apigateway.UsagePlan(this, 'EnterpriseUsagePlan', {
      name: `${appId}-${environment}-enterprise`,
      description: 'Enterprise tier rate limits',
      throttle: {
        rateLimit: 2000,
        burstLimit: 5000,
      },
      // No quota for enterprise
    });
    this.usagePlans.set('enterprise', enterpriseUsagePlan);

    // WAF Web ACL for IP-based rate limiting
    this.webAcl = new waf.CfnWebACL(this, 'WebAcl', {
      name: `${appId}-${environment}-waf`,
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${appId}-${environment}-waf`,
        sampledRequestsEnabled: true,
      },
      rules: [
        // Rate limit by IP - 2000 requests per 5 minutes
        {
          name: 'RateLimitByIP',
          priority: 1,
          action: { block: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitByIP',
            sampledRequestsEnabled: true,
          },
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP',
            },
          },
        },
        
        // Block known bad IPs (AWS Managed Rules)
        {
          name: 'AWSManagedRulesAmazonIpReputationList',
          priority: 2,
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesAmazonIpReputationList',
            sampledRequestsEnabled: true,
          },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesAmazonIpReputationList',
            },
          },
        },
        
        // Common attack patterns
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 3,
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesCommonRuleSet',
            sampledRequestsEnabled: true,
          },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
        },
        
        // SQL injection protection
        {
          name: 'AWSManagedRulesSQLiRuleSet',
          priority: 4,
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesSQLiRuleSet',
            sampledRequestsEnabled: true,
          },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesSQLiRuleSet',
            },
          },
        },
        
        // Bot control (optional - can be expensive)
        // Uncomment if needed:
        // {
        //   name: 'AWSManagedRulesBotControlRuleSet',
        //   priority: 5,
        //   overrideAction: { none: {} },
        //   visibilityConfig: {
        //     cloudWatchMetricsEnabled: true,
        //     metricName: 'AWSManagedRulesBotControlRuleSet',
        //     sampledRequestsEnabled: true,
        //   },
        //   statement: {
        //     managedRuleGroupStatement: {
        //       vendorName: 'AWS',
        //       name: 'AWSManagedRulesBotControlRuleSet',
        //     },
        //   },
        // },
      ],
    });

    // Associate WAF with API Gateway
    new waf.CfnWebACLAssociation(this, 'WebAclAssociation', {
      resourceArn: apiGateway.deploymentStage.stageArn,
      webAclArn: this.webAcl.attrArn,
    });

    // Outputs
    new cdk.CfnOutput(this, 'WebAclArn', {
      value: this.webAcl.attrArn,
      description: 'WAF Web ACL ARN',
    });
  }
}

/**
 * Rate Limit Configuration by Tier
 * 
 * | Tier         | RPS  | Burst | Daily Quota |
 * |--------------|------|-------|-------------|
 * | Free         | 10   | 20    | 1,000       |
 * | Starter      | 50   | 100   | 10,000      |
 * | Professional | 100  | 200   | 50,000      |
 * | Business     | 500  | 1,000 | 250,000     |
 * | Enterprise   | 2000 | 5,000 | Unlimited   |
 * 
 * Additional WAF limits:
 * - 2,000 requests per IP per 5 minutes
 * - Blocks known malicious IPs
 * - Protects against common attacks (XSS, SQLi)
 */
