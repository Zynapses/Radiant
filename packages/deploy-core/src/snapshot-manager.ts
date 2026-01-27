// @radiant/deploy-core - Snapshot Manager
// Create and restore deployment snapshots for rollback

import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { SnapshotInfo, AWSCredentials, StackInfo } from './types';

export class SnapshotManager {
  private credentials: AWSCredentials;
  private bucketName: string;
  private s3Client: S3Client;

  constructor(credentials: AWSCredentials, bucketName: string) {
    this.credentials = credentials;
    this.bucketName = bucketName;
    this.s3Client = new S3Client({
      region: credentials.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    });
  }

  /**
   * Create a snapshot of current deployment
   */
  async createSnapshot(
    deploymentId: string,
    appId: string,
    environment: string,
    tier: number,
    stacks: StackInfo[],
    metadata?: Record<string, unknown>
  ): Promise<SnapshotInfo> {
    const snapshotId = `snapshot-${Date.now()}`;
    
    const outputs: Record<string, string> = {};
    for (const stack of stacks) {
      Object.assign(outputs, stack.outputs);
    }

    const snapshot: SnapshotInfo = {
      snapshotId,
      deploymentId,
      appId,
      environment: environment as SnapshotInfo['environment'],
      tier,
      createdAt: new Date(),
      stacks: stacks.map(s => s.stackName),
      outputs,
      metadata,
    };

    await this.saveSnapshot(snapshot);

    return snapshot;
  }

  /**
   * List all snapshots for an app
   */
  async listSnapshots(appId: string, environment?: string): Promise<SnapshotInfo[]> {
    const prefix = environment 
      ? `snapshots/${appId}/${environment}/`
      : `snapshots/${appId}/`;

    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: prefix,
    });

    const response = await this.s3Client.send(command);
    const snapshots: SnapshotInfo[] = [];

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key && obj.Key.endsWith('.json')) {
          const snapshot = await this.getSnapshotByKey(obj.Key);
          if (snapshot) {
            snapshots.push(snapshot);
          }
        }
      }
    }

    return snapshots;
  }

  /**
   * Get snapshot by S3 key
   */
  private async getSnapshotByKey(key: string): Promise<SnapshotInfo | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      if (response.Body) {
        const bodyStr = await response.Body.transformToString();
        const data = JSON.parse(bodyStr);
        return {
          ...data,
          createdAt: new Date(data.createdAt),
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get a specific snapshot
   */
  async getSnapshot(snapshotId: string): Promise<SnapshotInfo | null> {
    // List all snapshots and find by ID since we don't know the full path
    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: 'snapshots/',
    });

    const response = await this.s3Client.send(command);
    
    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key && obj.Key.includes(snapshotId)) {
          return this.getSnapshotByKey(obj.Key);
        }
      }
    }

    return null;
  }

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(snapshotId: string): Promise<void> {
    const snapshot = await this.getSnapshot(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }

    const key = `snapshots/${snapshot.appId}/${snapshot.environment}/${snapshot.snapshotId}.json`;
    
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  /**
   * Restore from a snapshot
   */
  async restoreSnapshot(snapshotId: string): Promise<void> {
    const snapshot = await this.getSnapshot(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }

    // Restore involves re-deploying with the snapshot's stack configuration
    // The actual CloudFormation operations are handled by the deployer
    // This method provides the snapshot data for the rollback
    console.log(`Restore initiated for snapshot ${snapshotId}`, {
      stacks: snapshot.stacks,
      outputs: snapshot.outputs,
    });
  }

  /**
   * Save snapshot to S3
   */
  private async saveSnapshot(snapshot: SnapshotInfo): Promise<void> {
    const key = `snapshots/${snapshot.appId}/${snapshot.environment}/${snapshot.snapshotId}.json`;
    
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: JSON.stringify(snapshot, null, 2),
      ContentType: 'application/json',
    });

    await this.s3Client.send(command);
  }

  /**
   * Get the latest snapshot for an app/environment
   */
  async getLatestSnapshot(appId: string, environment: string): Promise<SnapshotInfo | null> {
    const snapshots = await this.listSnapshots(appId, environment);
    if (snapshots.length === 0) return null;
    
    return snapshots.sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    )[0];
  }
}
