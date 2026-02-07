// @radiant/deploy-core - Stack Manager
// Manages CloudFormation stack operations via AWS CLI

import { exec } from 'child_process';
import { promisify } from 'util';
import type { StackInfo, StackStatus, AWSCredentials } from './types';

const execAsync = promisify(exec);

interface CloudFormationStack {
  StackName: string;
  StackId: string;
  StackStatus: string;
  StackStatusReason?: string;
  CreationTime: string;
  LastUpdatedTime?: string;
  Outputs?: Array<{ OutputKey: string; OutputValue: string }>;
}

interface CloudFormationEvent {
  EventId: string;
  StackName: string;
  LogicalResourceId: string;
  PhysicalResourceId?: string;
  ResourceType: string;
  ResourceStatus: string;
  ResourceStatusReason?: string;
  Timestamp: string;
}

interface CloudFormationResource {
  LogicalResourceId: string;
  PhysicalResourceId: string;
  ResourceType: string;
  ResourceStatus: string;
  LastUpdatedTimestamp: string;
}

export class StackManager {
  private credentials: AWSCredentials;

  constructor(credentials: AWSCredentials) {
    this.credentials = credentials;
  }

  /**
   * Execute AWS CLI command with credentials
   */
  private async awsCommand<T>(command: string): Promise<T> {
    const env = {
      ...process.env,
      AWS_ACCESS_KEY_ID: this.credentials.accessKeyId,
      AWS_SECRET_ACCESS_KEY: this.credentials.secretAccessKey,
      AWS_DEFAULT_REGION: this.credentials.region,
      ...(this.credentials.sessionToken && { AWS_SESSION_TOKEN: this.credentials.sessionToken }),
    };

    try {
      const { stdout } = await execAsync(command, { env, maxBuffer: 10 * 1024 * 1024 });
      return JSON.parse(stdout) as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AWS CLI command failed';
      throw new Error(`CloudFormation error: ${message}`);
    }
  }

  /**
   * List all RADIANT stacks for an app
   */
  async listStacks(appId: string, environment?: string): Promise<StackInfo[]> {
    const stackPrefix = environment 
      ? `radiant-${appId}-${environment}`
      : `radiant-${appId}`;

    const result = await this.awsCommand<{ StackSummaries: CloudFormationStack[] }>(
      `aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE UPDATE_ROLLBACK_COMPLETE CREATE_IN_PROGRESS UPDATE_IN_PROGRESS --output json`
    );

    const radiantStacks = result.StackSummaries
      .filter(stack => stack.StackName.startsWith(stackPrefix))
      .map(stack => this.mapToStackInfo(stack));

    // Get full details for each stack
    const detailedStacks = await Promise.all(
      radiantStacks.map(stack => this.getStack(stack.stackName))
    );

    return detailedStacks.filter((stack): stack is StackInfo => stack !== null);
  }

  /**
   * Get detailed stack information
   */
  async getStack(stackName: string): Promise<StackInfo | null> {
    try {
      const result = await this.awsCommand<{ Stacks: CloudFormationStack[] }>(
        `aws cloudformation describe-stacks --stack-name "${stackName}" --output json`
      );

      if (!result.Stacks || result.Stacks.length === 0) {
        return null;
      }

      return this.mapToStackInfo(result.Stacks[0]);
    } catch (error) {
      // Stack doesn't exist or access denied
      const message = error instanceof Error ? error.message : '';
      if (message.includes('does not exist')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete a stack
   */
  async deleteStack(stackName: string): Promise<void> {
    await this.awsCommand<void>(
      `aws cloudformation delete-stack --stack-name "${stackName}" --output json`
    );
  }

  /**
   * Get stack events
   */
  async getStackEvents(stackName: string, limit = 50): Promise<StackEvent[]> {
    const result = await this.awsCommand<{ StackEvents: CloudFormationEvent[] }>(
      `aws cloudformation describe-stack-events --stack-name "${stackName}" --max-items ${limit} --output json`
    );

    return (result.StackEvents || []).map(event => ({
      eventId: event.EventId,
      stackName: event.StackName,
      logicalResourceId: event.LogicalResourceId,
      physicalResourceId: event.PhysicalResourceId,
      resourceType: event.ResourceType,
      resourceStatus: event.ResourceStatus,
      resourceStatusReason: event.ResourceStatusReason,
      timestamp: new Date(event.Timestamp),
    }));
  }

  /**
   * Get stack resources
   */
  async getStackResources(stackName: string): Promise<StackResource[]> {
    const result = await this.awsCommand<{ StackResourceSummaries: CloudFormationResource[] }>(
      `aws cloudformation list-stack-resources --stack-name "${stackName}" --output json`
    );

    return (result.StackResourceSummaries || []).map(resource => ({
      logicalId: resource.LogicalResourceId,
      physicalId: resource.PhysicalResourceId,
      resourceType: resource.ResourceType,
      status: resource.ResourceStatus,
      lastUpdated: new Date(resource.LastUpdatedTimestamp),
    }));
  }

  /**
   * Wait for stack operation to complete
   */
  async waitForStack(stackName: string, timeoutMs = 300000): Promise<StackInfo> {
    const startTime = Date.now();
    const pollInterval = 5000;

    while (Date.now() - startTime < timeoutMs) {
      const stack = await this.getStack(stackName);
      
      if (!stack) {
        throw new Error(`Stack ${stackName} not found`);
      }

      if (!this.isOperationInProgress(stack.status)) {
        if (this.isStackFailed(stack.status)) {
          throw new Error(`Stack ${stackName} failed: ${stack.statusReason || stack.status}`);
        }
        return stack;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Timeout waiting for stack ${stackName}`);
  }

  /**
   * Check if stack operation is in progress
   */
  isOperationInProgress(status: StackStatus): boolean {
    return status.includes('IN_PROGRESS');
  }

  /**
   * Check if stack is in a failed state
   */
  isStackFailed(status: StackStatus): boolean {
    return status.includes('FAILED') || status.includes('ROLLBACK');
  }

  /**
   * Map CloudFormation response to StackInfo
   */
  private mapToStackInfo(stack: CloudFormationStack): StackInfo {
    const outputs: Record<string, string> = {};
    if (stack.Outputs) {
      for (const output of stack.Outputs) {
        outputs[output.OutputKey] = output.OutputValue;
      }
    }

    return {
      stackName: stack.StackName,
      stackId: stack.StackId,
      status: stack.StackStatus as StackStatus,
      statusReason: stack.StackStatusReason,
      outputs,
      createdAt: new Date(stack.CreationTime),
      updatedAt: new Date(stack.LastUpdatedTime || stack.CreationTime),
    };
  }
}

export interface StackEvent {
  eventId: string;
  stackName: string;
  logicalResourceId: string;
  physicalResourceId?: string;
  resourceType: string;
  resourceStatus: string;
  resourceStatusReason?: string;
  timestamp: Date;
}

export interface StackResource {
  logicalId: string;
  physicalId: string;
  resourceType: string;
  status: string;
  lastUpdated: Date;
}
