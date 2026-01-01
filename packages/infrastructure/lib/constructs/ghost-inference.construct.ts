/**
 * RADIANT v6.0.4 - Ghost Inference Construct
 * SageMaker endpoint for ghost vector capture using vLLM
 * 
 * Captures hidden states from LLaMA 3 70B for ghost vectors
 */

import * as cdk from 'aws-cdk-lib';
import * as sagemaker from 'aws-cdk-lib/aws-sagemaker';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface GhostInferenceConstructProps {
  vpc: ec2.IVpc;
  environment: string;
  modelBucket: s3.IBucket;
  modelPrefix?: string;
  instanceType?: string;
  initialInstanceCount?: number;
}

export class GhostInferenceConstruct extends Construct {
  public readonly endpoint: sagemaker.CfnEndpoint;
  public readonly endpointConfig: sagemaker.CfnEndpointConfig;
  public readonly model: sagemaker.CfnModel;
  public readonly executionRole: iam.Role;

  constructor(scope: Construct, id: string, props: GhostInferenceConstructProps) {
    super(scope, id);

    const {
      vpc,
      environment,
      modelBucket,
      modelPrefix = 'models/llama3-70b-ghost',
      instanceType = 'ml.g5.12xlarge',
      initialInstanceCount = 1,
    } = props;

    // ===========================================================================
    // IAM Role
    // ===========================================================================
    this.executionRole = new iam.Role(this, 'GhostInferenceRole', {
      assumedBy: new iam.ServicePrincipal('sagemaker.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'),
      ],
    });

    // Grant access to model bucket
    modelBucket.grantRead(this.executionRole);

    // Grant ECR access for vLLM container
    this.executionRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'ecr:GetAuthorizationToken',
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
      ],
      resources: ['*'],
    }));

    // ===========================================================================
    // SageMaker Model
    // ===========================================================================
    const vllmImageUri = this.getVllmImageUri(cdk.Stack.of(this).region);

    this.model = new sagemaker.CfnModel(this, 'GhostModel', {
      modelName: `radiant-ghost-inference-${environment}`,
      executionRoleArn: this.executionRole.roleArn,
      primaryContainer: {
        image: vllmImageUri,
        modelDataUrl: `s3://${modelBucket.bucketName}/${modelPrefix}/model.tar.gz`,
        environment: {
          // vLLM configuration for hidden state extraction
          'VLLM_MODEL_NAME': 'meta-llama/Llama-3-70B-Instruct',
          'VLLM_TENSOR_PARALLEL_SIZE': '4',
          'VLLM_MAX_MODEL_LEN': '8192',
          'VLLM_DTYPE': 'float16',
          'VLLM_RETURN_HIDDEN_STATES': 'true',
          'VLLM_HIDDEN_STATE_LAYER': '-1',
          'HF_TOKEN': '{{resolve:secretsmanager:radiant/huggingface:SecretString:token}}',
        },
      },
      vpcConfig: {
        subnets: vpc.privateSubnets.map(s => s.subnetId),
        securityGroupIds: [], // Will be populated by stack
      },
    });

    // ===========================================================================
    // Endpoint Configuration
    // ===========================================================================
    this.endpointConfig = new sagemaker.CfnEndpointConfig(this, 'GhostEndpointConfig', {
      endpointConfigName: `radiant-ghost-config-${environment}`,
      productionVariants: [
        {
          variantName: 'AllTraffic',
          modelName: this.model.modelName!,
          initialInstanceCount,
          instanceType,
          initialVariantWeight: 1,
          containerStartupHealthCheckTimeoutInSeconds: 600,
        },
      ],
      asyncInferenceConfig: {
        outputConfig: {
          s3OutputPath: `s3://${modelBucket.bucketName}/ghost-inference-output/`,
        },
        clientConfig: {
          maxConcurrentInvocationsPerInstance: 4,
        },
      },
    });

    this.endpointConfig.addDependency(this.model);

    // ===========================================================================
    // Endpoint
    // ===========================================================================
    this.endpoint = new sagemaker.CfnEndpoint(this, 'GhostEndpoint', {
      endpointName: `radiant-ghost-${environment}`,
      endpointConfigName: this.endpointConfig.endpointConfigName!,
    });

    this.endpoint.addDependency(this.endpointConfig);

    // ===========================================================================
    // Outputs
    // ===========================================================================
    new cdk.CfnOutput(this, 'GhostEndpointName', {
      value: this.endpoint.endpointName!,
      description: 'Ghost inference endpoint name',
      exportName: `radiant-ghost-endpoint-${environment}`,
    });
  }

  /**
   * Get vLLM container image URI for the region
   */
  private getVllmImageUri(region: string): string {
    // AWS Deep Learning Container for vLLM
    const accountId = this.getDeepLearningAccountId(region);
    return `${accountId}.dkr.ecr.${region}.amazonaws.com/pytorch-inference:2.1.0-gpu-py310-cu118-ubuntu20.04-sagemaker`;
  }

  /**
   * Get AWS Deep Learning Container account ID for region
   */
  private getDeepLearningAccountId(region: string): string {
    const regionAccountMap: Record<string, string> = {
      'us-east-1': '763104351884',
      'us-east-2': '763104351884',
      'us-west-1': '763104351884',
      'us-west-2': '763104351884',
      'eu-west-1': '763104351884',
      'eu-west-2': '763104351884',
      'eu-central-1': '763104351884',
      'ap-northeast-1': '763104351884',
      'ap-southeast-1': '763104351884',
      'ap-southeast-2': '763104351884',
    };
    return regionAccountMap[region] || '763104351884';
  }
}
