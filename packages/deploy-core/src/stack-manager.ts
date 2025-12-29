// @radiant/deploy-core - Stack Manager
// Manages CloudFormation stack operations

import type { StackInfo, StackStatus, AWSCredentials } from './types';

export class StackManager {
  private credentials: AWSCredentials;

  constructor(credentials: AWSCredentials) {
    this.credentials = credentials;
  }

  /**
   * List all RADIANT stacks for an app
   */
  async listStacks(appId: string, environment?: string): Promise<StackInfo[]> {
    // Implementation would use CloudFormation ListStacks
    return [];
  }

  /**
   * Get detailed stack information
   */
  async getStack(stackName: string): Promise<StackInfo | null> {
    // Implementation would use CloudFormation DescribeStacks
    return null;
  }

  /**
   * Delete a stack
   */
  async deleteStack(stackName: string): Promise<void> {
    // Implementation would use CloudFormation DeleteStack
  }

  /**
   * Get stack events
   */
  async getStackEvents(stackName: string, limit?: number): Promise<StackEvent[]> {
    // Implementation would use CloudFormation DescribeStackEvents
    return [];
  }

  /**
   * Get stack resources
   */
  async getStackResources(stackName: string): Promise<StackResource[]> {
    // Implementation would use CloudFormation ListStackResources
    return [];
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
}

export interface StackEvent {
  eventId: string;
  stackName: string;
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
