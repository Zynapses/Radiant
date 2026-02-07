/**
 * AWS Snapshot Service
 * 
 * Provides automated and manual AWS infrastructure snapshots for disaster recovery.
 * Supports RDS cluster snapshots, S3 versioning, Secrets Manager, and DynamoDB backups.
 * 
 * @version 7.1.0
 * @since 2026-02-04
 */

import {
  RDSClient,
  CreateDBClusterSnapshotCommand,
  DescribeDBClusterSnapshotsCommand,
  DeleteDBClusterSnapshotCommand,
  RestoreDBClusterFromSnapshotCommand,
  DescribeDBClustersCommand,
  DBClusterSnapshot,
} from '@aws-sdk/client-rds';
import {
  S3Client,
  PutBucketVersioningCommand,
  ListObjectVersionsCommand,
  GetBucketVersioningCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';
import {
  SecretsManagerClient,
  ListSecretsCommand,
  GetSecretValueCommand,
  DescribeSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import {
  DynamoDBClient,
  ListTablesCommand,
  DescribeTableCommand,
  CreateBackupCommand,
  ListBackupsCommand,
  DeleteBackupCommand,
  RestoreTableFromBackupCommand,
} from '@aws-sdk/client-dynamodb';
import {
  EventBridgeClient,
  PutRuleCommand,
  PutTargetsCommand,
  DeleteRuleCommand,
  RemoveTargetsCommand,
} from '@aws-sdk/client-eventbridge';
import {
  SNSClient,
  PublishCommand,
} from '@aws-sdk/client-sns';
import { randomUUID } from 'crypto';
import {
  AWSSnapshotConfig,
  AWSSnapshot,
  AWSSnapshotComponent,
  AWSSnapshotError,
  CreateAWSSnapshotRequest,
  CreateAWSSnapshotResponse,
  RestoreAWSSnapshotRequest,
  RestoreAWSSnapshotResponse,
  ListAWSSnapshotsRequest,
  ListAWSSnapshotsResponse,
  AWSSnapshotValidation,
  DEFAULT_AWS_SNAPSHOT_CONFIG,
  EnvironmentName,
} from '@radiant/shared';

interface AWSSnapshotServiceConfig {
  region: string;
  environment: EnvironmentName;
  tenantId: string;
  stateRegistryBucket: string;
  snapshotConfig?: Partial<AWSSnapshotConfig>;
  snsTopicArn?: string;
}

export class AWSSnapshotService {
  private readonly rdsClient: RDSClient;
  private readonly s3Client: S3Client;
  private readonly secretsClient: SecretsManagerClient;
  private readonly dynamoClient: DynamoDBClient;
  private readonly eventBridgeClient: EventBridgeClient;
  private readonly snsClient: SNSClient;
  private readonly config: AWSSnapshotServiceConfig;
  private readonly snapshotConfig: AWSSnapshotConfig;

  constructor(config: AWSSnapshotServiceConfig) {
    this.config = config;
    this.snapshotConfig = {
      ...DEFAULT_AWS_SNAPSHOT_CONFIG,
      ...config.snapshotConfig,
    };

    const clientConfig = { region: config.region };
    this.rdsClient = new RDSClient(clientConfig);
    this.s3Client = new S3Client(clientConfig);
    this.secretsClient = new SecretsManagerClient(clientConfig);
    this.dynamoClient = new DynamoDBClient(clientConfig);
    this.eventBridgeClient = new EventBridgeClient(clientConfig);
    this.snsClient = new SNSClient(clientConfig);
  }

  // ===========================================================================
  // Snapshot Creation
  // ===========================================================================

  async createSnapshot(request: CreateAWSSnapshotRequest): Promise<CreateAWSSnapshotResponse> {
    const snapshotId = `snap-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const startTime = Date.now();

    console.log(`[AWSSnapshot] Creating snapshot ${snapshotId} for ${request.environment}`);

    try {
      const snapshot: AWSSnapshot = {
        id: snapshotId,
        environment: request.environment,
        tenantId: this.config.tenantId,
        createdAt: new Date().toISOString(),
        expiresAt: this.calculateExpiryDate(request.retentionDays || this.snapshotConfig.retentionDays),
        type: 'manual',
        trigger: 'user',
        triggeredBy: request.createdBy,
        status: 'in_progress',
        progress: {
          phase: 'rds',
          percentComplete: 0,
        },
        components: [],
        description: request.description,
        tags: request.tags || {},
        totalSizeBytes: 0,
        estimatedMonthlyCostUSD: 0,
        checksums: {
          manifest: '',
          components: {},
        },
        restoreCount: 0,
        errors: [],
      };

      // Save initial snapshot record
      await this.saveSnapshotRecord(snapshot);

      // Snapshot RDS clusters
      if (request.includeRDS !== false && this.snapshotConfig.snapshotRDS) {
        await this.snapshotRDSClusters(snapshot);
        snapshot.progress.phase = 's3';
        snapshot.progress.percentComplete = 25;
        await this.saveSnapshotRecord(snapshot);
      }

      // Snapshot S3 (ensure versioning is enabled)
      if (request.includeS3 !== false && this.snapshotConfig.snapshotS3) {
        await this.snapshotS3Buckets(snapshot);
        snapshot.progress.phase = 'secrets';
        snapshot.progress.percentComplete = 50;
        await this.saveSnapshotRecord(snapshot);
      }

      // Snapshot Secrets Manager
      if (request.includeSecrets !== false && this.snapshotConfig.snapshotSecrets) {
        await this.snapshotSecrets(snapshot);
        snapshot.progress.phase = 'dynamodb';
        snapshot.progress.percentComplete = 75;
        await this.saveSnapshotRecord(snapshot);
      }

      // Snapshot DynamoDB tables
      if (request.includeDynamoDB !== false && this.snapshotConfig.snapshotDynamoDB) {
        await this.snapshotDynamoDBTables(snapshot);
        snapshot.progress.phase = 'verification';
        snapshot.progress.percentComplete = 90;
        await this.saveSnapshotRecord(snapshot);
      }

      // Verify and finalize
      await this.verifySnapshot(snapshot);
      snapshot.status = 'completed';
      snapshot.completedAt = new Date().toISOString();
      snapshot.progress.phase = 'complete';
      snapshot.progress.percentComplete = 100;

      // Calculate checksum of manifest
      snapshot.checksums.manifest = await this.calculateManifestChecksum(snapshot);

      await this.saveSnapshotRecord(snapshot);

      const durationMinutes = Math.ceil((Date.now() - startTime) / 60000);
      console.log(`[AWSSnapshot] Snapshot ${snapshotId} completed in ${durationMinutes} minutes`);

      // Send success notification if configured
      if (this.snapshotConfig.notifyOnSuccess) {
        await this.sendNotification('success', snapshot);
      }

      return {
        success: true,
        snapshotId,
        estimatedDurationMinutes: durationMinutes,
      };
    } catch (error) {
      console.error(`[AWSSnapshot] Snapshot ${snapshotId} failed:`, error);

      // Update snapshot status
      const failedSnapshot = await this.getSnapshotRecord(snapshotId);
      if (failedSnapshot) {
        failedSnapshot.status = 'failed';
        failedSnapshot.errors.push({
          timestamp: new Date().toISOString(),
          code: 'SNAPSHOT_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: true,
          suggestedAction: 'Retry the snapshot or check AWS permissions',
        });
        await this.saveSnapshotRecord(failedSnapshot);
      }

      // Send failure notification
      if (this.snapshotConfig.notifyOnFailure) {
        await this.sendNotification('failure', failedSnapshot || { id: snapshotId } as AWSSnapshot, error);
      }

      return {
        success: false,
        snapshotId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createScheduledSnapshot(): Promise<CreateAWSSnapshotResponse> {
    return this.createSnapshot({
      environment: this.config.environment,
      description: `Scheduled snapshot - ${new Date().toISOString()}`,
      createdBy: 'system:scheduled',
      tags: {
        type: 'scheduled',
        schedule: this.snapshotConfig.cronExpression || `every ${this.snapshotConfig.intervalHours} hours`,
      },
    });
  }

  // ===========================================================================
  // RDS Snapshots
  // ===========================================================================

  private async snapshotRDSClusters(snapshot: AWSSnapshot): Promise<void> {
    console.log(`[AWSSnapshot] Snapshotting RDS clusters for ${snapshot.environment}`);

    try {
      // List RDS clusters for this environment
      const describeClusters = await this.rdsClient.send(new DescribeDBClustersCommand({}));
      const clusters = (describeClusters.DBClusters || []).filter(
        cluster => cluster.DBClusterIdentifier?.includes(`radiant-${this.config.environment}`)
      );

      for (const cluster of clusters) {
        if (!cluster.DBClusterIdentifier || !cluster.DBClusterArn) continue;

        const snapshotIdentifier = `${snapshot.id}-${cluster.DBClusterIdentifier}`;
        
        try {
          const createSnapshot = await this.rdsClient.send(new CreateDBClusterSnapshotCommand({
            DBClusterSnapshotIdentifier: snapshotIdentifier,
            DBClusterIdentifier: cluster.DBClusterIdentifier,
            Tags: [
              { Key: 'RadiantSnapshotId', Value: snapshot.id },
              { Key: 'Environment', Value: this.config.environment },
              { Key: 'TenantId', Value: this.config.tenantId },
              { Key: 'CreatedAt', Value: snapshot.createdAt },
            ],
          }));

          const component: AWSSnapshotComponent = {
            type: 'rds_cluster',
            name: cluster.DBClusterIdentifier,
            arn: cluster.DBClusterArn,
            awsSnapshotId: snapshotIdentifier,
            awsSnapshotArn: createSnapshot.DBClusterSnapshot?.DBClusterSnapshotArn,
            status: 'completed',
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            sizeBytes: (cluster.AllocatedStorage || 0) * 1024 * 1024 * 1024,
          };

          snapshot.components.push(component);
          snapshot.totalSizeBytes += component.sizeBytes;

          console.log(`[AWSSnapshot] Created RDS snapshot: ${snapshotIdentifier}`);
        } catch (clusterError) {
          const error: AWSSnapshotError = {
            timestamp: new Date().toISOString(),
            component: cluster.DBClusterIdentifier,
            code: 'RDS_SNAPSHOT_FAILED',
            message: clusterError instanceof Error ? clusterError.message : 'Unknown error',
            recoverable: true,
            suggestedAction: 'Check RDS permissions and cluster status',
          };
          snapshot.errors.push(error);
          console.error(`[AWSSnapshot] Failed to snapshot cluster ${cluster.DBClusterIdentifier}:`, clusterError);
        }
      }
    } catch (error) {
      console.error('[AWSSnapshot] Error listing RDS clusters:', error);
      throw error;
    }
  }

  // ===========================================================================
  // S3 Snapshots (Versioning)
  // ===========================================================================

  private async snapshotS3Buckets(snapshot: AWSSnapshot): Promise<void> {
    console.log(`[AWSSnapshot] Ensuring S3 versioning for ${snapshot.environment}`);

    try {
      const listBuckets = await this.s3Client.send(new ListBucketsCommand({}));
      const buckets = (listBuckets.Buckets || []).filter(
        bucket => bucket.Name?.includes(`radiant-${this.config.environment}`)
      );

      for (const bucket of buckets) {
        if (!bucket.Name) continue;

        try {
          // Check versioning status
          const versioningStatus = await this.s3Client.send(new GetBucketVersioningCommand({
            Bucket: bucket.Name,
          }));

          // Enable versioning if not already enabled
          if (versioningStatus.Status !== 'Enabled') {
            await this.s3Client.send(new PutBucketVersioningCommand({
              Bucket: bucket.Name,
              VersioningConfiguration: { Status: 'Enabled' },
            }));
            console.log(`[AWSSnapshot] Enabled versioning for bucket: ${bucket.Name}`);
          }

          // Record the version marker
          const versions = await this.s3Client.send(new ListObjectVersionsCommand({
            Bucket: bucket.Name,
            MaxKeys: 1,
          }));

          const component: AWSSnapshotComponent = {
            type: 's3_bucket',
            name: bucket.Name,
            arn: `arn:aws:s3:::${bucket.Name}`,
            versionId: versions.Versions?.[0]?.VersionId || 'initial',
            status: 'completed',
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            sizeBytes: 0, // S3 doesn't provide bucket size easily
          };

          snapshot.components.push(component);
          console.log(`[AWSSnapshot] Recorded S3 bucket state: ${bucket.Name}`);
        } catch (bucketError) {
          const error: AWSSnapshotError = {
            timestamp: new Date().toISOString(),
            component: bucket.Name,
            code: 'S3_VERSIONING_FAILED',
            message: bucketError instanceof Error ? bucketError.message : 'Unknown error',
            recoverable: true,
            suggestedAction: 'Check S3 permissions',
          };
          snapshot.errors.push(error);
          console.error(`[AWSSnapshot] Failed to process bucket ${bucket.Name}:`, bucketError);
        }
      }
    } catch (error) {
      console.error('[AWSSnapshot] Error listing S3 buckets:', error);
      throw error;
    }
  }

  // ===========================================================================
  // Secrets Manager Snapshots
  // ===========================================================================

  private async snapshotSecrets(snapshot: AWSSnapshot): Promise<void> {
    console.log(`[AWSSnapshot] Recording secrets state for ${snapshot.environment}`);

    try {
      const listSecrets = await this.secretsClient.send(new ListSecretsCommand({
        Filters: [{ Key: 'name', Values: [`radiant-${this.config.environment}`] }],
      }));

      for (const secret of listSecrets.SecretList || []) {
        if (!secret.Name || !secret.ARN) continue;

        try {
          const describeSecret = await this.secretsClient.send(new DescribeSecretCommand({
            SecretId: secret.ARN,
          }));

          const component: AWSSnapshotComponent = {
            type: 'secret',
            name: secret.Name,
            arn: secret.ARN,
            versionId: describeSecret.VersionIdsToStages
              ? Object.keys(describeSecret.VersionIdsToStages)[0]
              : undefined,
            status: 'completed',
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            sizeBytes: 0,
          };

          snapshot.components.push(component);
          console.log(`[AWSSnapshot] Recorded secret state: ${secret.Name}`);
        } catch (secretError) {
          const error: AWSSnapshotError = {
            timestamp: new Date().toISOString(),
            component: secret.Name,
            code: 'SECRET_SNAPSHOT_FAILED',
            message: secretError instanceof Error ? secretError.message : 'Unknown error',
            recoverable: true,
            suggestedAction: 'Check Secrets Manager permissions',
          };
          snapshot.errors.push(error);
        }
      }
    } catch (error) {
      console.error('[AWSSnapshot] Error listing secrets:', error);
      throw error;
    }
  }

  // ===========================================================================
  // DynamoDB Snapshots
  // ===========================================================================

  private async snapshotDynamoDBTables(snapshot: AWSSnapshot): Promise<void> {
    console.log(`[AWSSnapshot] Backing up DynamoDB tables for ${snapshot.environment}`);

    try {
      const listTables = await this.dynamoClient.send(new ListTablesCommand({}));
      const tables = (listTables.TableNames || []).filter(
        name => name.includes(`radiant-${this.config.environment}`)
      );

      for (const tableName of tables) {
        try {
          const describeTable = await this.dynamoClient.send(new DescribeTableCommand({
            TableName: tableName,
          }));

          const backupName = `${snapshot.id}-${tableName}`;
          const createBackup = await this.dynamoClient.send(new CreateBackupCommand({
            TableName: tableName,
            BackupName: backupName,
          }));

          const component: AWSSnapshotComponent = {
            type: 'dynamodb_table',
            name: tableName,
            arn: describeTable.Table?.TableArn || '',
            awsSnapshotId: createBackup.BackupDetails?.BackupName,
            awsSnapshotArn: createBackup.BackupDetails?.BackupArn,
            status: 'completed',
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            sizeBytes: describeTable.Table?.TableSizeBytes || 0,
          };

          snapshot.components.push(component);
          snapshot.totalSizeBytes += component.sizeBytes;
          console.log(`[AWSSnapshot] Created DynamoDB backup: ${backupName}`);
        } catch (tableError) {
          const error: AWSSnapshotError = {
            timestamp: new Date().toISOString(),
            component: tableName,
            code: 'DYNAMODB_BACKUP_FAILED',
            message: tableError instanceof Error ? tableError.message : 'Unknown error',
            recoverable: true,
            suggestedAction: 'Check DynamoDB permissions',
          };
          snapshot.errors.push(error);
          console.error(`[AWSSnapshot] Failed to backup table ${tableName}:`, tableError);
        }
      }
    } catch (error) {
      console.error('[AWSSnapshot] Error listing DynamoDB tables:', error);
      throw error;
    }
  }

  // ===========================================================================
  // Snapshot Restoration
  // ===========================================================================

  async restoreSnapshot(request: RestoreAWSSnapshotRequest): Promise<RestoreAWSSnapshotResponse> {
    const operationId = `restore-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const startTime = Date.now();
    const warnings: string[] = [];

    console.log(`[AWSSnapshot] Starting restore ${operationId} from snapshot ${request.snapshotId}`);

    try {
      const snapshot = await this.getSnapshotRecord(request.snapshotId);
      if (!snapshot) {
        return { success: false, error: 'Snapshot not found' };
      }

      if (snapshot.status !== 'completed') {
        return { success: false, error: `Cannot restore from snapshot with status: ${snapshot.status}` };
      }

      // Validate before restore if requested
      if (request.validateBeforeRestore !== false) {
        const validation = await this.validateSnapshot(request.snapshotId);
        if (!validation.canRestore) {
          return {
            success: false,
            error: `Snapshot validation failed: ${validation.blockers.join(', ')}`,
          };
        }
        warnings.push(...validation.warnings);
      }

      let newClusterEndpoint: string | undefined;

      // Restore RDS
      if (request.restoreRDS !== false) {
        const rdsComponents = snapshot.components.filter(c => c.type === 'rds_cluster');
        for (const component of rdsComponents) {
          if (!component.awsSnapshotId) continue;

          const newClusterId = request.createNewCluster
            ? `${component.name}${request.newClusterSuffix || '-restored'}`
            : component.name;

          try {
            const restore = await this.rdsClient.send(new RestoreDBClusterFromSnapshotCommand({
              DBClusterIdentifier: newClusterId,
              SnapshotIdentifier: component.awsSnapshotId,
              Engine: 'aurora-postgresql',
              Tags: [
                { Key: 'RestoredFrom', Value: request.snapshotId },
                { Key: 'RestoredAt', Value: new Date().toISOString() },
                { Key: 'RestoredBy', Value: request.restoredBy },
              ],
            }));

            newClusterEndpoint = restore.DBCluster?.Endpoint;
            console.log(`[AWSSnapshot] Restored RDS cluster: ${newClusterId}`);
          } catch (rdsError) {
            console.error(`[AWSSnapshot] Failed to restore RDS cluster:`, rdsError);
            return {
              success: false,
              error: `RDS restore failed: ${rdsError instanceof Error ? rdsError.message : 'Unknown error'}`,
            };
          }
        }
      }

      // Restore DynamoDB
      if (request.restoreDynamoDB !== false) {
        const dynamoComponents = snapshot.components.filter(c => c.type === 'dynamodb_table');
        for (const component of dynamoComponents) {
          if (!component.awsSnapshotArn) continue;

          const newTableName = `${component.name}-restored-${Date.now()}`;

          try {
            await this.dynamoClient.send(new RestoreTableFromBackupCommand({
              TargetTableName: newTableName,
              BackupArn: component.awsSnapshotArn,
            }));
            console.log(`[AWSSnapshot] Restored DynamoDB table: ${newTableName}`);
            warnings.push(`DynamoDB table restored as ${newTableName} - manual rename may be needed`);
          } catch (dynamoError) {
            console.error(`[AWSSnapshot] Failed to restore DynamoDB table:`, dynamoError);
            warnings.push(`Failed to restore DynamoDB table ${component.name}`);
          }
        }
      }

      // Update snapshot restore count
      snapshot.restoreCount++;
      snapshot.lastRestoredAt = new Date().toISOString();
      snapshot.lastRestoredBy = request.restoredBy;
      await this.saveSnapshotRecord(snapshot);

      const durationMinutes = Math.ceil((Date.now() - startTime) / 60000);
      console.log(`[AWSSnapshot] Restore ${operationId} completed in ${durationMinutes} minutes`);

      return {
        success: true,
        restoreOperationId: operationId,
        estimatedDurationMinutes: durationMinutes,
        newClusterEndpoint,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      console.error(`[AWSSnapshot] Restore ${operationId} failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ===========================================================================
  // Snapshot Management
  // ===========================================================================

  async listSnapshots(request: ListAWSSnapshotsRequest): Promise<ListAWSSnapshotsResponse> {
    try {
      // In production, this would query from S3 or a database
      // For now, we'll list from S3 bucket
      const snapshots = await this.listSnapshotRecordsFromS3(request);
      
      return {
        success: true,
        snapshots: snapshots.items,
        total: snapshots.total,
        hasMore: snapshots.hasMore,
      };
    } catch (error) {
      console.error('[AWSSnapshot] Error listing snapshots:', error);
      return {
        success: false,
        snapshots: [],
        total: 0,
        hasMore: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async deleteSnapshot(snapshotId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[AWSSnapshot] Deleting snapshot ${snapshotId}`);

    try {
      const snapshot = await this.getSnapshotRecord(snapshotId);
      if (!snapshot) {
        return { success: false, error: 'Snapshot not found' };
      }

      // Delete RDS snapshots
      for (const component of snapshot.components) {
        if (component.type === 'rds_cluster' && component.awsSnapshotId) {
          try {
            await this.rdsClient.send(new DeleteDBClusterSnapshotCommand({
              DBClusterSnapshotIdentifier: component.awsSnapshotId,
            }));
            console.log(`[AWSSnapshot] Deleted RDS snapshot: ${component.awsSnapshotId}`);
          } catch (error) {
            console.error(`[AWSSnapshot] Failed to delete RDS snapshot:`, error);
          }
        }

        if (component.type === 'dynamodb_table' && component.awsSnapshotArn) {
          try {
            await this.dynamoClient.send(new DeleteBackupCommand({
              BackupArn: component.awsSnapshotArn,
            }));
            console.log(`[AWSSnapshot] Deleted DynamoDB backup: ${component.awsSnapshotArn}`);
          } catch (error) {
            console.error(`[AWSSnapshot] Failed to delete DynamoDB backup:`, error);
          }
        }
      }

      // Mark snapshot as deleted
      snapshot.status = 'deleted';
      await this.saveSnapshotRecord(snapshot);

      return { success: true };
    } catch (error) {
      console.error(`[AWSSnapshot] Error deleting snapshot:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async validateSnapshot(snapshotId: string): Promise<AWSSnapshotValidation> {
    console.log(`[AWSSnapshot] Validating snapshot ${snapshotId}`);

    const validation: AWSSnapshotValidation = {
      snapshotId,
      validatedAt: new Date().toISOString(),
      isValid: true,
      canRestore: true,
      components: [],
      estimatedRestoreTime: { rds: 0, s3: 0, secrets: 0, dynamodb: 0, total: 0 },
      blockers: [],
      warnings: [],
    };

    try {
      const snapshot = await this.getSnapshotRecord(snapshotId);
      if (!snapshot) {
        validation.isValid = false;
        validation.canRestore = false;
        validation.blockers.push('Snapshot record not found');
        return validation;
      }

      if (snapshot.status === 'expired' || snapshot.status === 'deleted') {
        validation.isValid = false;
        validation.canRestore = false;
        validation.blockers.push(`Snapshot is ${snapshot.status}`);
        return validation;
      }

      // Validate each component
      for (const component of snapshot.components) {
        const componentValidation = {
          name: component.name,
          type: component.type,
          valid: true,
          exists: true,
          error: undefined as string | undefined,
        };

        if (component.type === 'rds_cluster' && component.awsSnapshotId) {
          try {
            const describe = await this.rdsClient.send(new DescribeDBClusterSnapshotsCommand({
              DBClusterSnapshotIdentifier: component.awsSnapshotId,
            }));
            if (!describe.DBClusterSnapshots?.length) {
              componentValidation.exists = false;
              componentValidation.valid = false;
              componentValidation.error = 'RDS snapshot not found in AWS';
            } else {
              const awsSnapshot = describe.DBClusterSnapshots[0];
              if (awsSnapshot.Status !== 'available') {
                componentValidation.valid = false;
                componentValidation.error = `RDS snapshot status: ${awsSnapshot.Status}`;
              }
              validation.estimatedRestoreTime.rds += 10; // ~10 min per cluster
            }
          } catch (error) {
            componentValidation.valid = false;
            componentValidation.error = error instanceof Error ? error.message : 'Unknown error';
          }
        }

        if (component.type === 'dynamodb_table' && component.awsSnapshotArn) {
          try {
            const list = await this.dynamoClient.send(new ListBackupsCommand({
              BackupArn: component.awsSnapshotArn,
            }));
            if (!list.BackupSummaries?.length) {
              componentValidation.exists = false;
              componentValidation.valid = false;
              componentValidation.error = 'DynamoDB backup not found';
            } else {
              validation.estimatedRestoreTime.dynamodb += 5; // ~5 min per table
            }
          } catch (error) {
            componentValidation.valid = false;
            componentValidation.error = error instanceof Error ? error.message : 'Unknown error';
          }
        }

        validation.components.push(componentValidation);

        if (!componentValidation.valid) {
          validation.warnings.push(`Component ${component.name} validation failed: ${componentValidation.error}`);
        }
      }

      // Calculate total restore time
      validation.estimatedRestoreTime.total =
        validation.estimatedRestoreTime.rds +
        validation.estimatedRestoreTime.s3 +
        validation.estimatedRestoreTime.secrets +
        validation.estimatedRestoreTime.dynamodb;

      // Check for blockers
      const criticalFailures = validation.components.filter(c => !c.exists && c.type === 'rds_cluster');
      if (criticalFailures.length > 0) {
        validation.canRestore = false;
        validation.blockers.push(`Critical components missing: ${criticalFailures.map(c => c.name).join(', ')}`);
      }

      return validation;
    } catch (error) {
      console.error(`[AWSSnapshot] Validation error:`, error);
      validation.isValid = false;
      validation.canRestore = false;
      validation.blockers.push(error instanceof Error ? error.message : 'Unknown error');
      return validation;
    }
  }

  // ===========================================================================
  // Scheduled Snapshot Management
  // ===========================================================================

  async setupScheduledSnapshots(lambdaArn: string): Promise<{ success: boolean; ruleArn?: string; error?: string }> {
    if (!this.snapshotConfig.enabled) {
      return { success: true }; // Nothing to set up
    }

    const ruleName = `radiant-${this.config.environment}-scheduled-snapshot`;

    try {
      // Create or update EventBridge rule
      const schedule = this.snapshotConfig.scheduleType === 'cron'
        ? `cron(${this.snapshotConfig.cronExpression})`
        : `rate(${this.snapshotConfig.intervalHours} hours)`;

      const putRule = await this.eventBridgeClient.send(new PutRuleCommand({
        Name: ruleName,
        ScheduleExpression: schedule,
        State: 'ENABLED',
        Description: `Automated RADIANT snapshot for ${this.config.environment}`,
      }));

      // Add Lambda target
      await this.eventBridgeClient.send(new PutTargetsCommand({
        Rule: ruleName,
        Targets: [{
          Id: 'snapshot-lambda',
          Arn: lambdaArn,
          Input: JSON.stringify({
            action: 'scheduled-snapshot',
            environment: this.config.environment,
          }),
        }],
      }));

      console.log(`[AWSSnapshot] Scheduled snapshots configured: ${schedule}`);

      return { success: true, ruleArn: putRule.RuleArn };
    } catch (error) {
      console.error('[AWSSnapshot] Failed to setup scheduled snapshots:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async disableScheduledSnapshots(): Promise<{ success: boolean; error?: string }> {
    const ruleName = `radiant-${this.config.environment}-scheduled-snapshot`;

    try {
      await this.eventBridgeClient.send(new RemoveTargetsCommand({
        Rule: ruleName,
        Ids: ['snapshot-lambda'],
      }));

      await this.eventBridgeClient.send(new DeleteRuleCommand({
        Name: ruleName,
      }));

      console.log(`[AWSSnapshot] Scheduled snapshots disabled`);
      return { success: true };
    } catch (error) {
      console.error('[AWSSnapshot] Failed to disable scheduled snapshots:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ===========================================================================
  // Cleanup Expired Snapshots
  // ===========================================================================

  async cleanupExpiredSnapshots(): Promise<{ deleted: number; errors: number }> {
    console.log(`[AWSSnapshot] Cleaning up expired snapshots`);
    let deleted = 0;
    let errors = 0;

    try {
      const listResult = await this.listSnapshots({
        environment: this.config.environment,
      });

      const now = new Date();
      for (const snapshot of listResult.snapshots) {
        const expiresAt = new Date(snapshot.expiresAt);
        if (expiresAt < now && snapshot.status !== 'deleted') {
          const deleteResult = await this.deleteSnapshot(snapshot.id);
          if (deleteResult.success) {
            deleted++;
          } else {
            errors++;
          }
        }
      }

      console.log(`[AWSSnapshot] Cleanup complete: ${deleted} deleted, ${errors} errors`);
      return { deleted, errors };
    } catch (error) {
      console.error('[AWSSnapshot] Cleanup error:', error);
      return { deleted, errors: errors + 1 };
    }
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private calculateExpiryDate(retentionDays: number): string {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + retentionDays);
    return expiry.toISOString();
  }

  private async calculateManifestChecksum(snapshot: AWSSnapshot): Promise<string> {
    const crypto = await import('crypto');
    const content = JSON.stringify(snapshot.components);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async verifySnapshot(snapshot: AWSSnapshot): Promise<void> {
    // Verify all components were processed
    const failed = snapshot.components.filter(c => c.status === 'failed');
    if (failed.length > 0) {
      console.warn(`[AWSSnapshot] ${failed.length} components failed during snapshot`);
    }

    // Calculate component checksums
    for (const component of snapshot.components) {
      if (component.status === 'completed') {
        snapshot.checksums.components[component.name] = component.checksum || 'verified';
      }
    }
  }

  private async saveSnapshotRecord(snapshot: AWSSnapshot): Promise<void> {
    // Save to S3 state registry bucket
    const { S3Client: S3, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3({ region: this.config.region });

    await s3.send(new PutObjectCommand({
      Bucket: this.config.stateRegistryBucket,
      Key: `snapshots/${this.config.environment}/${snapshot.id}.json`,
      Body: JSON.stringify(snapshot, null, 2),
      ContentType: 'application/json',
      Metadata: {
        'snapshot-id': snapshot.id,
        'environment': snapshot.environment,
        'status': snapshot.status,
      },
    }));
  }

  private async getSnapshotRecord(snapshotId: string): Promise<AWSSnapshot | null> {
    const { S3Client: S3, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3({ region: this.config.region });

    try {
      const response = await s3.send(new GetObjectCommand({
        Bucket: this.config.stateRegistryBucket,
        Key: `snapshots/${this.config.environment}/${snapshotId}.json`,
      }));

      const body = await response.Body?.transformToString();
      return body ? JSON.parse(body) : null;
    } catch (error) {
      console.error(`[AWSSnapshot] Failed to get snapshot record:`, error);
      return null;
    }
  }

  private async listSnapshotRecordsFromS3(
    request: ListAWSSnapshotsRequest
  ): Promise<{ items: AWSSnapshot[]; total: number; hasMore: boolean }> {
    const { S3Client: S3, ListObjectsV2Command, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3({ region: this.config.region });

    const prefix = `snapshots/${request.environment || this.config.environment}/`;
    const listResponse = await s3.send(new ListObjectsV2Command({
      Bucket: this.config.stateRegistryBucket,
      Prefix: prefix,
      MaxKeys: 1000,
    }));

    const snapshots: AWSSnapshot[] = [];
    for (const obj of listResponse.Contents || []) {
      if (!obj.Key?.endsWith('.json')) continue;

      try {
        const getResponse = await s3.send(new GetObjectCommand({
          Bucket: this.config.stateRegistryBucket,
          Key: obj.Key,
        }));
        const body = await getResponse.Body?.transformToString();
        if (body) {
          const snapshot = JSON.parse(body) as AWSSnapshot;

          // Apply filters
          if (request.status && snapshot.status !== request.status) continue;
          if (request.type && snapshot.type !== request.type) continue;
          if (request.createdAfter && snapshot.createdAt < request.createdAfter) continue;
          if (request.createdBefore && snapshot.createdAt > request.createdBefore) continue;

          snapshots.push(snapshot);
        }
      } catch (error) {
        console.error(`[AWSSnapshot] Failed to read snapshot ${obj.Key}:`, error);
      }
    }

    // Sort
    const sortBy = request.sortBy || 'createdAt';
    const sortOrder = request.sortOrder || 'desc';
    snapshots.sort((a, b) => {
      const aVal = a[sortBy as keyof AWSSnapshot];
      const bVal = b[sortBy as keyof AWSSnapshot];
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Paginate
    const offset = request.offset || 0;
    const limit = request.limit || 50;
    const paginated = snapshots.slice(offset, offset + limit);

    return {
      items: paginated,
      total: snapshots.length,
      hasMore: offset + limit < snapshots.length,
    };
  }

  private async sendNotification(
    type: 'success' | 'failure',
    snapshot: AWSSnapshot,
    error?: unknown
  ): Promise<void> {
    if (!this.config.snsTopicArn) return;

    const subject = type === 'success'
      ? `[RADIANT] Snapshot Completed: ${snapshot.id}`
      : `[RADIANT] Snapshot Failed: ${snapshot.id}`;

    const message = type === 'success'
      ? `Snapshot ${snapshot.id} completed successfully.\n\nEnvironment: ${snapshot.environment}\nComponents: ${snapshot.components.length}\nSize: ${Math.round(snapshot.totalSizeBytes / 1024 / 1024)} MB`
      : `Snapshot ${snapshot.id} failed.\n\nEnvironment: ${snapshot.environment}\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n\nErrors:\n${snapshot.errors.map(e => `- ${e.code}: ${e.message}`).join('\n')}`;

    try {
      await this.snsClient.send(new PublishCommand({
        TopicArn: this.config.snsTopicArn,
        Subject: subject,
        Message: message,
      }));
    } catch (notifyError) {
      console.error('[AWSSnapshot] Failed to send notification:', notifyError);
    }
  }

  // ===========================================================================
  // Configuration Management
  // ===========================================================================

  getConfig(): AWSSnapshotConfig {
    return { ...this.snapshotConfig };
  }

  async updateConfig(newConfig: Partial<AWSSnapshotConfig>): Promise<void> {
    Object.assign(this.snapshotConfig, newConfig);
    console.log('[AWSSnapshot] Configuration updated');
  }
}
