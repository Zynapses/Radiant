import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface VpcEndpointsProps {
  vpc: ec2.IVpc;
  tier: number;
}

/**
 * Creates VPC endpoints for AWS services to reduce NAT costs and improve security
 */
export class VpcEndpoints extends Construct {
  public readonly s3Endpoint: ec2.GatewayVpcEndpoint;
  public readonly dynamoDbEndpoint: ec2.GatewayVpcEndpoint;
  public readonly secretsManagerEndpoint?: ec2.InterfaceVpcEndpoint;
  public readonly ssmEndpoint?: ec2.InterfaceVpcEndpoint;
  public readonly kmsEndpoint?: ec2.InterfaceVpcEndpoint;
  public readonly lambdaEndpoint?: ec2.InterfaceVpcEndpoint;

  constructor(scope: Construct, id: string, props: VpcEndpointsProps) {
    super(scope, id);

    const { vpc, tier } = props;

    // Gateway endpoints (free, always create)
    this.s3Endpoint = vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    this.dynamoDbEndpoint = vpc.addGatewayEndpoint('DynamoDbEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });

    // Interface endpoints (cost money, only for tier 2+)
    if (tier >= 2) {
      const endpointSecurityGroup = new ec2.SecurityGroup(this, 'EndpointSG', {
        vpc,
        description: 'Security group for VPC endpoints',
        allowAllOutbound: false,
      });

      endpointSecurityGroup.addIngressRule(
        ec2.Peer.ipv4(vpc.vpcCidrBlock),
        ec2.Port.tcp(443),
        'Allow HTTPS from VPC'
      );

      this.secretsManagerEndpoint = vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
        securityGroups: [endpointSecurityGroup],
        privateDnsEnabled: true,
      });

      this.ssmEndpoint = vpc.addInterfaceEndpoint('SsmEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.SSM,
        securityGroups: [endpointSecurityGroup],
        privateDnsEnabled: true,
      });

      // Tier 3+ gets KMS and Lambda endpoints
      if (tier >= 3) {
        this.kmsEndpoint = vpc.addInterfaceEndpoint('KmsEndpoint', {
          service: ec2.InterfaceVpcEndpointAwsService.KMS,
          securityGroups: [endpointSecurityGroup],
          privateDnsEnabled: true,
        });

        this.lambdaEndpoint = vpc.addInterfaceEndpoint('LambdaEndpoint', {
          service: ec2.InterfaceVpcEndpointAwsService.LAMBDA,
          securityGroups: [endpointSecurityGroup],
          privateDnsEnabled: true,
        });
      }
    }

    // Outputs
    new cdk.CfnOutput(this, 'S3EndpointId', {
      value: this.s3Endpoint.vpcEndpointId,
      description: 'S3 Gateway Endpoint ID',
    });

    new cdk.CfnOutput(this, 'DynamoDbEndpointId', {
      value: this.dynamoDbEndpoint.vpcEndpointId,
      description: 'DynamoDB Gateway Endpoint ID',
    });
  }
}
