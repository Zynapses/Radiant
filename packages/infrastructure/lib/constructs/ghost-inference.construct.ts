/**
 * RADIANT v5.52.40 - Ghost Inference Construct
 * SageMaker endpoint for ghost vector capture using vLLM
 * 
 * Captures hidden states from LLaMA 3 70B for ghost vectors.
 * Configuration can be loaded dynamically from database via GhostInferenceConfigService.
 */

import * as cdk from 'aws-cdk-lib';
import * as sagemaker from 'aws-cdk-lib/aws-sagemaker';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

/**
 * vLLM configuration settings for ghost inference.
 * These can be loaded from the ghost_inference_config table.
 */
export interface VllmConfig {
  modelName: string;
  modelVersion?: string;
  tensorParallelSize: number;
  maxModelLen: number;
  dtype: 'float16' | 'bfloat16' | 'float32';
  gpuMemoryUtilization: number;
  returnHiddenStates: boolean;
  hiddenStateLayer: number;
  ghostVectorDimension: number;
  maxNumSeqs: number;
  maxNumBatchedTokens?: number;
  swapSpaceGb: number;
  enforceEager: boolean;
  quantization?: string;
}

/**
 * Infrastructure configuration for the SageMaker endpoint.
 */
export interface InfrastructureConfig {
  instanceType: string;
  minInstances: number;
  maxInstances: number;
  scaleToZero: boolean;
  warmupInstances: number;
  maxConcurrentInvocations: number;
  startupHealthCheckTimeoutSeconds: number;
  endpointNamePrefix: string;
}

export interface GhostInferenceConstructProps {
  vpc: ec2.IVpc;
  environment: string;
  modelBucket: s3.IBucket;
  modelPrefix?: string;
  /** @deprecated Use vllmConfig.instanceType instead */
  instanceType?: string;
  /** @deprecated Use infrastructureConfig.minInstances instead */
  initialInstanceCount?: number;
  /** Dynamic vLLM configuration from database */
  vllmConfig?: Partial<VllmConfig>;
  /** Dynamic infrastructure configuration from database */
  infrastructureConfig?: Partial<InfrastructureConfig>;
}

export class GhostInferenceConstruct extends Construct {
  public readonly endpoint: sagemaker.CfnEndpoint;
  public readonly endpointConfig: sagemaker.CfnEndpointConfig;
  public readonly model: sagemaker.CfnModel;
  public readonly executionRole: iam.Role;

  // Default vLLM configuration
  private static readonly DEFAULT_VLLM_CONFIG: VllmConfig = {
    modelName: 'meta-llama/Llama-3-70B-Instruct',
    tensorParallelSize: 4,
    maxModelLen: 8192,
    dtype: 'float16',
    gpuMemoryUtilization: 0.90,
    returnHiddenStates: true,
    hiddenStateLayer: -1,
    ghostVectorDimension: 8192,
    maxNumSeqs: 256,
    swapSpaceGb: 4,
    enforceEager: false,
  };

  // Default infrastructure configuration
  private static readonly DEFAULT_INFRA_CONFIG: InfrastructureConfig = {
    instanceType: 'ml.g5.12xlarge',
    minInstances: 1,
    maxInstances: 4,
    scaleToZero: false,
    warmupInstances: 1,
    maxConcurrentInvocations: 4,
    startupHealthCheckTimeoutSeconds: 600,
    endpointNamePrefix: 'radiant-ghost',
  };

  constructor(scope: Construct, id: string, props: GhostInferenceConstructProps) {
    super(scope, id);

    const {
      vpc,
      environment,
      modelBucket,
      modelPrefix = 'models/llama3-70b-ghost',
    } = props;

    // Merge configurations with defaults
    const vllmConfig: VllmConfig = {
      ...GhostInferenceConstruct.DEFAULT_VLLM_CONFIG,
      ...props.vllmConfig,
    };

    const infraConfig: InfrastructureConfig = {
      ...GhostInferenceConstruct.DEFAULT_INFRA_CONFIG,
      ...props.infrastructureConfig,
      // Support deprecated props for backward compatibility
      instanceType: props.infrastructureConfig?.instanceType ?? props.instanceType ?? GhostInferenceConstruct.DEFAULT_INFRA_CONFIG.instanceType,
      minInstances: props.infrastructureConfig?.minInstances ?? props.initialInstanceCount ?? GhostInferenceConstruct.DEFAULT_INFRA_CONFIG.minInstances,
    };

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
    // SageMaker Model with Dynamic vLLM Configuration
    // ===========================================================================
    const vllmImageUri = this.getVllmImageUri(cdk.Stack.of(this).region);
    const vllmEnvironment = this.buildVllmEnvironment(vllmConfig);

    this.model = new sagemaker.CfnModel(this, 'GhostModel', {
      modelName: `${infraConfig.endpointNamePrefix}-inference-${environment}`,
      executionRoleArn: this.executionRole.roleArn,
      primaryContainer: {
        image: vllmImageUri,
        modelDataUrl: `s3://${modelBucket.bucketName}/${modelPrefix}/model.tar.gz`,
        environment: vllmEnvironment,
      },
      vpcConfig: {
        subnets: vpc.privateSubnets.map(s => s.subnetId),
        securityGroupIds: [], // Will be populated by stack
      },
    });

    // ===========================================================================
    // Endpoint Configuration with Dynamic Infrastructure Settings
    // ===========================================================================
    this.endpointConfig = new sagemaker.CfnEndpointConfig(this, 'GhostEndpointConfig', {
      endpointConfigName: `${infraConfig.endpointNamePrefix}-config-${environment}`,
      productionVariants: [
        {
          variantName: 'AllTraffic',
          modelName: this.model.modelName!,
          initialInstanceCount: infraConfig.minInstances,
          instanceType: infraConfig.instanceType,
          initialVariantWeight: 1,
          containerStartupHealthCheckTimeoutInSeconds: infraConfig.startupHealthCheckTimeoutSeconds,
        },
      ],
      asyncInferenceConfig: {
        outputConfig: {
          s3OutputPath: `s3://${modelBucket.bucketName}/ghost-inference-output/`,
        },
        clientConfig: {
          maxConcurrentInvocationsPerInstance: infraConfig.maxConcurrentInvocations,
        },
      },
    });

    this.endpointConfig.addDependency(this.model);

    // ===========================================================================
    // Endpoint
    // ===========================================================================
    this.endpoint = new sagemaker.CfnEndpoint(this, 'GhostEndpoint', {
      endpointName: `${infraConfig.endpointNamePrefix}-${environment}`,
      endpointConfigName: this.endpointConfig.endpointConfigName!,
    });

    this.endpoint.addDependency(this.endpointConfig);

    // ===========================================================================
    // Outputs
    // ===========================================================================
    new cdk.CfnOutput(this, 'GhostEndpointName', {
      value: this.endpoint.endpointName!,
      description: 'Ghost inference endpoint name',
      exportName: `${infraConfig.endpointNamePrefix}-endpoint-${environment}`,
    });

    new cdk.CfnOutput(this, 'GhostModelName', {
      value: vllmConfig.modelName,
      description: 'vLLM model name for ghost inference',
    });

    new cdk.CfnOutput(this, 'GhostInstanceType', {
      value: infraConfig.instanceType,
      description: 'SageMaker instance type for ghost inference',
    });
  }

  /**
   * Build vLLM environment variables from configuration.
   * This matches the format produced by GhostInferenceConfigService.buildVllmEnvironment()
   */
  private buildVllmEnvironment(config: VllmConfig): Record<string, string> {
    const env: Record<string, string> = {
      'VLLM_MODEL_NAME': config.modelName,
      'VLLM_TENSOR_PARALLEL_SIZE': config.tensorParallelSize.toString(),
      'VLLM_MAX_MODEL_LEN': config.maxModelLen.toString(),
      'VLLM_DTYPE': config.dtype,
      'VLLM_GPU_MEMORY_UTILIZATION': config.gpuMemoryUtilization.toString(),
      'VLLM_RETURN_HIDDEN_STATES': config.returnHiddenStates.toString(),
      'VLLM_HIDDEN_STATE_LAYER': config.hiddenStateLayer.toString(),
      'VLLM_GHOST_VECTOR_DIM': config.ghostVectorDimension.toString(),
      'VLLM_MAX_NUM_SEQS': config.maxNumSeqs.toString(),
      'VLLM_SWAP_SPACE': config.swapSpaceGb.toString(),
      'VLLM_ENFORCE_EAGER': config.enforceEager.toString(),
      'HF_TOKEN': '{{resolve:secretsmanager:radiant/huggingface:SecretString:token}}',
    };

    if (config.modelVersion) {
      env['VLLM_MODEL_REVISION'] = config.modelVersion;
    }

    if (config.maxNumBatchedTokens) {
      env['VLLM_MAX_NUM_BATCHED_TOKENS'] = config.maxNumBatchedTokens.toString();
    }

    if (config.quantization) {
      env['VLLM_QUANTIZATION'] = config.quantization;
    }

    return env;
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
