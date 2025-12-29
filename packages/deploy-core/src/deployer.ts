// @radiant/deploy-core - Core Deployer
// Platform-agnostic deployment orchestration

import { CloudFormationClient, DescribeStacksCommand, CreateStackCommand, UpdateStackCommand } from '@aws-sdk/client-cloudformation';
import type { 
  DeploymentConfig, 
  DeploymentResult, 
  DeployerOptions, 
  DeploymentProgress,
  StackInfo,
  STACK_DEPLOYMENT_ORDER 
} from './types';

export class RadiantDeployer {
  private cfnClient: CloudFormationClient;
  private config: DeploymentConfig;
  private options: DeployerOptions;

  constructor(config: DeploymentConfig, options: DeployerOptions = {}) {
    this.config = config;
    this.options = {
      dryRun: false,
      skipHealthChecks: false,
      parallelStacks: false,
      maxRetries: 3,
      timeoutMinutes: 30,
      ...options,
    };

    this.cfnClient = new CloudFormationClient({
      region: config.region,
      credentials: {
        accessKeyId: config.credentials.accessKeyId,
        secretAccessKey: config.credentials.secretAccessKey,
        sessionToken: config.credentials.sessionToken,
      },
    });
  }

  /**
   * Deploy all RADIANT infrastructure stacks
   */
  async deploy(): Promise<DeploymentResult> {
    const deploymentId = `deploy-${Date.now()}`;
    const startedAt = new Date();
    const stacks: StackInfo[] = [];

    this.reportProgress({
      phase: 'preparing',
      totalStacks: 7,
      completedStacks: 0,
      message: 'Preparing deployment...',
      percentage: 0,
    });

    try {
      // Validate credentials
      await this.validateCredentials();

      // Deploy stacks in order
      const stackOrder = [
        'NetworkingStack',
        'SecurityStack', 
        'DataStack',
        'ComputeStack',
        'AIStack',
        'APIStack',
        'MonitoringStack',
      ];

      for (let i = 0; i < stackOrder.length; i++) {
        const stackName = stackOrder[i];
        
        this.reportProgress({
          phase: 'deploying',
          currentStack: stackName,
          totalStacks: stackOrder.length,
          completedStacks: i,
          message: `Deploying ${stackName}...`,
          percentage: Math.round((i / stackOrder.length) * 80),
        });

        if (!this.options.dryRun) {
          const stackInfo = await this.deployStack(stackName);
          stacks.push(stackInfo);
        }
      }

      // Health checks
      if (!this.options.skipHealthChecks) {
        this.reportProgress({
          phase: 'verifying',
          totalStacks: stackOrder.length,
          completedStacks: stackOrder.length,
          message: 'Running health checks...',
          percentage: 90,
        });
        
        // Health check implementation would go here
      }

      this.reportProgress({
        phase: 'completed',
        totalStacks: stackOrder.length,
        completedStacks: stackOrder.length,
        message: 'Deployment completed successfully',
        percentage: 100,
      });

      return {
        deploymentId,
        status: 'completed',
        stacks,
        startedAt,
        completedAt: new Date(),
        outputs: this.collectOutputs(stacks),
      };

    } catch (error) {
      this.reportProgress({
        phase: 'failed',
        totalStacks: 7,
        completedStacks: stacks.length,
        message: `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        percentage: 0,
      });

      return {
        deploymentId,
        status: 'failed',
        stacks,
        startedAt,
        completedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
        outputs: {},
      };
    }
  }

  /**
   * Deploy a single stack
   */
  private async deployStack(stackName: string): Promise<StackInfo> {
    const fullStackName = `${this.config.appId}-${this.config.environment}-${stackName}`;
    
    // Check if stack exists
    const existingStack = await this.getStackInfo(fullStackName);
    
    if (existingStack) {
      // Update existing stack
      await this.updateStack(fullStackName);
    } else {
      // Create new stack
      await this.createStack(fullStackName, stackName);
    }

    // Wait for completion
    return await this.waitForStack(fullStackName);
  }

  /**
   * Get stack information
   */
  private async getStackInfo(stackName: string): Promise<StackInfo | null> {
    try {
      const command = new DescribeStacksCommand({ StackName: stackName });
      const response = await this.cfnClient.send(command);
      
      if (response.Stacks && response.Stacks.length > 0) {
        const stack = response.Stacks[0];
        return {
          stackName: stack.StackName || stackName,
          stackId: stack.StackId || '',
          status: stack.StackStatus as StackInfo['status'],
          statusReason: stack.StackStatusReason,
          outputs: this.parseOutputs(stack.Outputs),
          createdAt: stack.CreationTime || new Date(),
          updatedAt: stack.LastUpdatedTime || new Date(),
        };
      }
    } catch {
      // Stack doesn't exist
    }
    return null;
  }

  /**
   * Create a new stack
   */
  private async createStack(stackName: string, templateName: string): Promise<void> {
    const command = new CreateStackCommand({
      StackName: stackName,
      TemplateBody: await this.getTemplate(templateName),
      Parameters: this.getStackParameters(templateName),
      Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM', 'CAPABILITY_AUTO_EXPAND'],
      Tags: Object.entries(this.config.tags || {}).map(([Key, Value]) => ({ Key, Value })),
    });

    await this.cfnClient.send(command);
  }

  /**
   * Update an existing stack
   */
  private async updateStack(stackName: string): Promise<void> {
    const command = new UpdateStackCommand({
      StackName: stackName,
      UsePreviousTemplate: true,
      Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM', 'CAPABILITY_AUTO_EXPAND'],
    });

    try {
      await this.cfnClient.send(command);
    } catch (error) {
      // No updates needed is not an error
      if (error instanceof Error && error.message.includes('No updates')) {
        return;
      }
      throw error;
    }
  }

  /**
   * Wait for stack operation to complete
   */
  private async waitForStack(stackName: string): Promise<StackInfo> {
    const timeout = this.options.timeoutMinutes! * 60 * 1000;
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds

    while (Date.now() - startTime < timeout) {
      const stackInfo = await this.getStackInfo(stackName);
      
      if (!stackInfo) {
        throw new Error(`Stack ${stackName} not found`);
      }

      if (stackInfo.status.endsWith('_COMPLETE')) {
        return stackInfo;
      }

      if (stackInfo.status.endsWith('_FAILED') || stackInfo.status.includes('ROLLBACK')) {
        throw new Error(`Stack ${stackName} failed: ${stackInfo.statusReason}`);
      }

      await this.sleep(pollInterval);
    }

    throw new Error(`Stack ${stackName} timed out`);
  }

  /**
   * Validate AWS credentials
   */
  private async validateCredentials(): Promise<void> {
    // STS GetCallerIdentity would be called here
    // For now, just validate structure
    if (!this.config.credentials.accessKeyId || !this.config.credentials.secretAccessKey) {
      throw new Error('Invalid AWS credentials');
    }
  }

  /**
   * Get CloudFormation template for a stack
   */
  private async getTemplate(stackName: string): Promise<string> {
    // In production, this would fetch from S3 or local CDK synthesis
    // For now, return placeholder
    return JSON.stringify({
      AWSTemplateFormatVersion: '2010-09-09',
      Description: `RADIANT ${stackName}`,
      Resources: {},
    });
  }

  /**
   * Get parameters for a stack
   */
  private getStackParameters(stackName: string): Array<{ ParameterKey: string; ParameterValue: string }> {
    const params: Array<{ ParameterKey: string; ParameterValue: string }> = [
      { ParameterKey: 'AppId', ParameterValue: this.config.appId },
      { ParameterKey: 'Environment', ParameterValue: this.config.environment },
      { ParameterKey: 'Tier', ParameterValue: String(this.config.tier) },
    ];

    if (this.config.vpcCidrOverride && stackName === 'NetworkingStack') {
      params.push({ ParameterKey: 'VpcCidr', ParameterValue: this.config.vpcCidrOverride });
    }

    if (this.config.storageTypeOverride && stackName === 'DataStack') {
      params.push({ ParameterKey: 'StorageType', ParameterValue: this.config.storageTypeOverride });
    }

    return params;
  }

  /**
   * Parse stack outputs
   */
  private parseOutputs(outputs?: Array<{ OutputKey?: string; OutputValue?: string }>): Record<string, string> {
    const result: Record<string, string> = {};
    if (outputs) {
      for (const output of outputs) {
        if (output.OutputKey && output.OutputValue) {
          result[output.OutputKey] = output.OutputValue;
        }
      }
    }
    return result;
  }

  /**
   * Collect outputs from all stacks
   */
  private collectOutputs(stacks: StackInfo[]): Record<string, string> {
    const outputs: Record<string, string> = {};
    for (const stack of stacks) {
      Object.assign(outputs, stack.outputs);
    }
    return outputs;
  }

  /**
   * Report progress to callback
   */
  private reportProgress(progress: DeploymentProgress): void {
    if (this.options.onProgress) {
      this.options.onProgress(progress);
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Quick deploy function for simple use cases
 */
export async function deployRadiant(
  config: DeploymentConfig,
  options?: DeployerOptions
): Promise<DeploymentResult> {
  const deployer = new RadiantDeployer(config, options);
  return deployer.deploy();
}
