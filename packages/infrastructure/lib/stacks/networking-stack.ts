import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import type { TierConfig, Environment } from '@radiant/shared';

export interface NetworkingStackProps extends cdk.StackProps {
  appId: string;
  environment: Environment;
  tier: number;
  tierConfig: TierConfig;
}

export class NetworkingStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  
  constructor(scope: Construct, id: string, props: NetworkingStackProps) {
    super(scope, id, props);
    
    const { appId, environment, tierConfig } = props;
    
    // VPC with configuration based on tier
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `${appId}-${environment}-vpc`,
      ipAddresses: ec2.IpAddresses.cidr(tierConfig.vpcCidr),
      maxAzs: tierConfig.azCount,
      natGateways: tierConfig.natGateways,
      
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 22,
        },
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
      
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });
    
    // VPC Flow Logs for security compliance
    this.vpc.addFlowLog('FlowLog', {
      destination: ec2.FlowLogDestination.toCloudWatchLogs(),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });
    
    // Gateway Endpoints for AWS services (no NAT charges)
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });
    
    this.vpc.addGatewayEndpoint('DynamoDBEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });
    
    // Interface Endpoints for other AWS services (Tier 3+)
    if (tierConfig.level >= 3) {
      this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      });
      
      this.vpc.addInterfaceEndpoint('SSMEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.SSM,
      });
      
      this.vpc.addInterfaceEndpoint('ECREndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.ECR,
      });
      
      this.vpc.addInterfaceEndpoint('ECRDockerEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      });
    }
    
    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${appId}-${environment}-vpc-id`,
    });
    
    new cdk.CfnOutput(this, 'VpcCidr', {
      value: this.vpc.vpcCidrBlock,
      description: 'VPC CIDR block',
      exportName: `${appId}-${environment}-vpc-cidr`,
    });
  }
}
