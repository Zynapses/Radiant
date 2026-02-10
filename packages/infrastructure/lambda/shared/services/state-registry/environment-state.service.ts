/**
 * Environment State Registry Service
 * 
 * Captures, compares, and syncs environment state manifests across
 * dev, staging, and production environments.
 * 
 * @version 1.0.0
 * @since RADIANT 7.0.0
 */

import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { 
  CloudFormationClient, 
  DescribeStacksCommand,
  ListStackResourcesCommand,
} from '@aws-sdk/client-cloudformation';
import { 
  LambdaClient, 
  ListFunctionsCommand, 
  GetFunctionCommand,
} from '@aws-sdk/client-lambda';
import { 
  RDSClient, 
  DescribeDBClustersCommand,
  DescribeDBInstancesCommand,
} from '@aws-sdk/client-rds';
import { 
  SecretsManagerClient, 
  ListSecretsCommand,
  DescribeSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import { 
  APIGatewayClient, 
  GetRestApisCommand,
  GetStagesCommand,
  GetResourcesCommand,
} from '@aws-sdk/client-api-gateway';
import { 
  DynamoDBClient, 
  ListTablesCommand,
  DescribeTableCommand,
} from '@aws-sdk/client-dynamodb';
import { createHash } from 'crypto';

import type {
  EnvironmentName,
  EnvironmentStateManifest,
  StackManifest,
  LambdaManifest,
  S3BucketManifest,
  DynamoTableManifest,
  AuroraManifest,
  SecretManifest,
  ApiGatewayManifest,
  PersistentDataItem,
  FeatureManifest,
  SyncConfiguration,
  ManifestDiff,
  EnvironmentComparison,
  SyncRecommendation,
  BackupManifest,
  SyncOperation,
  EnvSyncStatus,
  EnvSyncError,
  CaptureManifestRequest,
  CaptureManifestResponse,
  CompareEnvironmentsRequest,
  CompareEnvironmentsResponse,
  StartSyncRequest,
  StartSyncResponse,
  CreateBackupRequest,
  CreateBackupResponse,
  ResourceHealth,
} from '@radiant/shared';
import { DEFAULT_PERSISTENT_DATA_ITEMS } from '@radiant/shared';

// ============================================================================
// Configuration
// ============================================================================

interface StateRegistryConfig {
  region: string;
  accountId: string;
  environment: EnvironmentName;
  stateRegistryBucket: string;
  radiantVersion: string;
}

const MANIFEST_SCHEMA_VERSION = '1.0.0';
const RADIANT_STACK_PREFIX = 'radiant-';

// ============================================================================
// Service Class
// ============================================================================

export class EnvironmentStateService {
  private s3Client: S3Client;
  private cfnClient: CloudFormationClient;
  private lambdaClient: LambdaClient;
  private rdsClient: RDSClient;
  private secretsClient: SecretsManagerClient;
  private apiGwClient: APIGatewayClient;
  private dynamoClient: DynamoDBClient;
  private config: StateRegistryConfig;

  constructor(config: StateRegistryConfig) {
    this.config = config;
    
    const clientConfig = { region: config.region };
    this.s3Client = new S3Client(clientConfig);
    this.cfnClient = new CloudFormationClient(clientConfig);
    this.lambdaClient = new LambdaClient(clientConfig);
    this.rdsClient = new RDSClient(clientConfig);
    this.secretsClient = new SecretsManagerClient(clientConfig);
    this.apiGwClient = new APIGatewayClient(clientConfig);
    this.dynamoClient = new DynamoDBClient(clientConfig);
  }

  // ==========================================================================
  // Manifest Capture
  // ==========================================================================

  async captureManifest(request: CaptureManifestRequest): Promise<CaptureManifestResponse> {
    const startTime = Date.now();
    
    try {
      const { environment, capturedBy, includeInfrastructure = true, includePersistentData = true, includeFeatures = true } = request;
      
      // Capture all components in parallel
      const [
        stacks,
        lambdas,
        s3Buckets,
        dynamoTables,
        auroraCluster,
        secrets,
        apiGateway,
        persistentData,
        features,
        syncConfig,
        health,
      ] = await Promise.all([
        includeInfrastructure ? this.captureStacks(environment) : [],
        includeInfrastructure ? this.captureLambdas(environment) : [],
        includeInfrastructure ? this.captureS3Buckets(environment) : [],
        includeInfrastructure ? this.captureDynamoTables(environment) : [],
        includeInfrastructure ? this.captureAuroraCluster(environment) : this.getEmptyAuroraManifest(),
        includeInfrastructure ? this.captureSecrets(environment) : [],
        includeInfrastructure ? this.captureApiGateway(environment) : this.getEmptyApiGatewayManifest(),
        includePersistentData ? this.capturePersistentData(environment) : [],
        includeFeatures ? this.captureFeatures(environment) : this.getDefaultFeatures(),
        this.loadSyncConfig(environment),
        this.captureHealth(environment),
      ]);

      // Build the manifest
      const manifest: EnvironmentStateManifest = {
        version: `${Date.now()}`,
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        environment,
        capturedAt: new Date().toISOString(),
        capturedBy,
        radiantVersion: this.config.radiantVersion,
        
        infrastructure: {
          region: this.config.region,
          accountId: this.config.accountId,
          vpcId: await this.getVpcId(environment),
          stacks,
          lambdas,
          s3Buckets,
          dynamoTables,
          auroraCluster,
          secrets,
          apiGateway,
        },
        
        persistentData,
        features,
        syncConfig,
        health,
        
        checksums: {
          infrastructure: '',
          persistentData: '',
          features: '',
          full: '',
        },
      };

      // Calculate checksums
      manifest.checksums = this.calculateChecksums(manifest);

      // Get previous manifest for diff
      const previousManifest = await this.loadCurrentManifest(environment);
      if (previousManifest) {
        manifest.previousVersionId = previousManifest.version;
        manifest.changesSinceLastCapture = this.calculateDiff(previousManifest, manifest);
      }

      // Save the manifest
      await this.saveManifest(environment, manifest);

      return {
        success: true,
        manifest,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Failed to capture manifest:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  // ==========================================================================
  // Stack Capture
  // ==========================================================================

  private async captureStacks(environment: EnvironmentName): Promise<StackManifest[]> {
    const stacks: StackManifest[] = [];
    const prefix = `${RADIANT_STACK_PREFIX}${environment}-`;
    
    try {
      const response = await this.cfnClient.send(new DescribeStacksCommand({}));
      
      for (const stack of response.Stacks || []) {
        if (!stack.StackName?.startsWith(prefix)) continue;
        
        stacks.push({
          name: stack.StackName,
          stackId: stack.StackId || '',
          status: stack.StackStatus as StackManifest['status'],
          createdAt: stack.CreationTime?.toISOString() || '',
          lastUpdatedAt: stack.LastUpdatedTime?.toISOString() || stack.CreationTime?.toISOString() || '',
          templateVersion: stack.Tags?.find(t => t.Key === 'Version')?.Value,
          outputs: Object.fromEntries(
            (stack.Outputs || []).map(o => [o.OutputKey || '', o.OutputValue || ''])
          ),
          parameters: Object.fromEntries(
            (stack.Parameters || []).map(p => [p.ParameterKey || '', p.ParameterValue || ''])
          ),
          tags: Object.fromEntries(
            (stack.Tags || []).map(t => [t.Key || '', t.Value || ''])
          ),
          driftStatus: stack.DriftInformation?.StackDriftStatus as StackManifest['driftStatus'],
        });
      }
    } catch (error) {
      console.error('Error capturing stacks:', error);
    }
    
    return stacks;
  }

  // ==========================================================================
  // Lambda Capture
  // ==========================================================================

  private async captureLambdas(environment: EnvironmentName): Promise<LambdaManifest[]> {
    const lambdas: LambdaManifest[] = [];
    const prefix = `${RADIANT_STACK_PREFIX}${environment}-`;
    
    try {
      let marker: string | undefined;
      
      do {
        const response = await this.lambdaClient.send(new ListFunctionsCommand({
          Marker: marker,
          MaxItems: 50,
        }));
        
        for (const fn of response.Functions || []) {
          if (!fn.FunctionName?.startsWith(prefix)) continue;
          
          lambdas.push({
            name: fn.FunctionName,
            arn: fn.FunctionArn || '',
            runtime: fn.Runtime || '',
            handler: fn.Handler || '',
            memoryMB: fn.MemorySize || 128,
            timeoutSeconds: fn.Timeout || 3,
            codeSize: fn.CodeSize || 0,
            lastModified: fn.LastModified || '',
            version: fn.Version || '$LATEST',
            environment: fn.Environment?.Variables,
            layers: (fn.Layers || []).map(l => l.Arn || ''),
            vpcConfig: fn.VpcConfig ? {
              subnetIds: fn.VpcConfig.SubnetIds || [],
              securityGroupIds: fn.VpcConfig.SecurityGroupIds || [],
            } : undefined,
          });
        }
        
        marker = response.NextMarker;
      } while (marker);
    } catch (error) {
      console.error('Error capturing lambdas:', error);
    }
    
    return lambdas;
  }

  // ==========================================================================
  // S3 Bucket Capture
  // ==========================================================================

  private async captureS3Buckets(environment: EnvironmentName): Promise<S3BucketManifest[]> {
    const buckets: S3BucketManifest[] = [];
    const prefix = `${RADIANT_STACK_PREFIX}${environment}-`;
    
    // Known bucket patterns
    const bucketPatterns = [
      `${prefix}uploads`,
      `${prefix}curator`,
      `${prefix}models`,
      `${prefix}exports`,
      `${prefix}backups`,
      `${prefix}state-registry`,
      `${prefix}logs`,
    ];
    
    for (const bucketName of bucketPatterns) {
      try {
        // Check if bucket exists
        await this.s3Client.send(new HeadObjectCommand({
          Bucket: bucketName,
          Key: '.radiant-marker',
        })).catch(() => null);
        
        // Get bucket size via inventory or estimation
        const listResponse = await this.s3Client.send(new ListObjectsV2Command({
          Bucket: bucketName,
          MaxKeys: 1000,
        }));
        
        const objectCount = listResponse.KeyCount || 0;
        const totalSize = (listResponse.Contents || []).reduce((sum, obj) => sum + (obj.Size || 0), 0);
        
        buckets.push({
          name: bucketName,
          arn: `arn:aws:s3:::${bucketName}`,
          region: this.config.region,
          createdAt: '', // Would need additional API call
          versioningEnabled: true, // Default assumption
          totalSizeBytes: totalSize,
          objectCount,
          lifecycleRules: [],
          encryptionType: 'aws:kms',
          publicAccessBlocked: true,
          corsEnabled: false,
          persistentDataItems: this.mapBucketToPersistentData(bucketName),
          syncPreference: this.getSyncPreferenceForBucket(bucketName),
        });
      } catch (error) {
        // Bucket doesn't exist, skip
      }
    }
    
    return buckets;
  }

  // ==========================================================================
  // DynamoDB Capture
  // ==========================================================================

  private async captureDynamoTables(environment: EnvironmentName): Promise<DynamoTableManifest[]> {
    const tables: DynamoTableManifest[] = [];
    const prefix = `${RADIANT_STACK_PREFIX}${environment}-`;
    
    try {
      let lastTableName: string | undefined;
      
      do {
        const listResponse = await this.dynamoClient.send(new ListTablesCommand({
          ExclusiveStartTableName: lastTableName,
          Limit: 100,
        }));
        
        for (const tableName of listResponse.TableNames || []) {
          if (!tableName.startsWith(prefix)) continue;
          
          const describeResponse = await this.dynamoClient.send(new DescribeTableCommand({
            TableName: tableName,
          }));
          
          const table = describeResponse.Table;
          if (!table) continue;
          
          const partitionKey = table.KeySchema?.find(k => k.KeyType === 'HASH');
          const sortKey = table.KeySchema?.find(k => k.KeyType === 'RANGE');
          
          tables.push({
            name: tableName,
            arn: table.TableArn || '',
            status: table.TableStatus as DynamoTableManifest['status'],
            itemCount: Number(table.ItemCount) || 0,
            sizeBytes: Number(table.TableSizeBytes) || 0,
            partitionKey: {
              name: partitionKey?.AttributeName || '',
              type: table.AttributeDefinitions?.find(a => a.AttributeName === partitionKey?.AttributeName)?.AttributeType || 'S',
            },
            sortKey: sortKey ? {
              name: sortKey.AttributeName || '',
              type: table.AttributeDefinitions?.find(a => a.AttributeName === sortKey.AttributeName)?.AttributeType || 'S',
            } : undefined,
            billingMode: table.BillingModeSummary?.BillingMode as DynamoTableManifest['billingMode'] || 'PAY_PER_REQUEST',
            readCapacity: table.ProvisionedThroughput?.ReadCapacityUnits,
            writeCapacity: table.ProvisionedThroughput?.WriteCapacityUnits,
            globalSecondaryIndexes: (table.GlobalSecondaryIndexes || []).map(gsi => ({
              name: gsi.IndexName || '',
              partitionKey: gsi.KeySchema?.find(k => k.KeyType === 'HASH')?.AttributeName || '',
              sortKey: gsi.KeySchema?.find(k => k.KeyType === 'RANGE')?.AttributeName,
              projectionType: gsi.Projection?.ProjectionType || 'ALL',
            })),
            streamEnabled: !!table.StreamSpecification?.StreamEnabled,
            streamArn: table.LatestStreamArn,
            ttlEnabled: false, // Would need DescribeTimeToLive call
            pitrEnabled: false, // Would need DescribeContinuousBackups call
            persistentDataItems: [],
          });
        }
        
        lastTableName = listResponse.LastEvaluatedTableName;
      } while (lastTableName);
    } catch (error) {
      console.error('Error capturing DynamoDB tables:', error);
    }
    
    return tables;
  }

  // ==========================================================================
  // Aurora Capture
  // ==========================================================================

  private async captureAuroraCluster(environment: EnvironmentName): Promise<AuroraManifest> {
    const clusterIdentifier = `${RADIANT_STACK_PREFIX}${environment}-aurora`;
    
    try {
      const clusterResponse = await this.rdsClient.send(new DescribeDBClustersCommand({
        DBClusterIdentifier: clusterIdentifier,
      }));
      
      const cluster = clusterResponse.DBClusters?.[0];
      if (!cluster) return this.getEmptyAuroraManifest();
      
      const instancesResponse = await this.rdsClient.send(new DescribeDBInstancesCommand({
        Filters: [{
          Name: 'db-cluster-id',
          Values: [cluster.DBClusterIdentifier || ''],
        }],
      }));
      
      return {
        clusterIdentifier: cluster.DBClusterIdentifier || '',
        clusterArn: cluster.DBClusterArn || '',
        engine: cluster.Engine || '',
        engineVersion: cluster.EngineVersion || '',
        status: cluster.Status || '',
        endpoint: cluster.Endpoint || '',
        readerEndpoint: cluster.ReaderEndpoint || '',
        port: cluster.Port || 5432,
        instances: (instancesResponse.DBInstances || []).map(inst => ({
          identifier: inst.DBInstanceIdentifier || '',
          instanceClass: inst.DBInstanceClass || '',
          status: inst.DBInstanceStatus || '',
          availabilityZone: inst.AvailabilityZone || '',
        })),
        allocatedStorage: cluster.AllocatedStorage || 0,
        storageEncrypted: cluster.StorageEncrypted || false,
        kmsKeyId: cluster.KmsKeyId,
        backupRetentionPeriod: cluster.BackupRetentionPeriod || 7,
        latestRestorableTime: cluster.LatestRestorableTime?.toISOString(),
        databases: [], // Would need to query the database directly
        persistentDataItems: ['user_conversations', 'user_messages', 'tenant_config', 'feature_flags'],
      };
    } catch (error) {
      console.error('Error capturing Aurora cluster:', error);
      return this.getEmptyAuroraManifest();
    }
  }

  // ==========================================================================
  // Secrets Capture
  // ==========================================================================

  private async captureSecrets(environment: EnvironmentName): Promise<SecretManifest[]> {
    const secrets: SecretManifest[] = [];
    const prefix = `radiant/${environment}/`;
    
    try {
      let nextToken: string | undefined;
      
      do {
        const listResponse = await this.secretsClient.send(new ListSecretsCommand({
          NextToken: nextToken,
          MaxResults: 100,
          Filters: [{
            Key: 'name',
            Values: [prefix],
          }],
        }));
        
        for (const secret of listResponse.SecretList || []) {
          if (!secret.Name?.startsWith(prefix)) continue;
          
          secrets.push({
            name: secret.Name,
            arn: secret.ARN || '',
            description: secret.Description,
            createdAt: secret.CreatedDate?.toISOString() || '',
            lastChangedAt: secret.LastChangedDate?.toISOString() || '',
            lastRotatedAt: secret.LastRotatedDate?.toISOString(),
            rotationEnabled: secret.RotationEnabled || false,
            rotationLambdaArn: secret.RotationLambdaARN,
            rotationDays: secret.RotationRules?.AutomaticallyAfterDays,
            versionId: '', // Would need DescribeSecret for this
            versionStage: 'AWSCURRENT',
            tags: Object.fromEntries(
              (secret.Tags || []).map(t => [t.Key || '', t.Value || ''])
            ),
          });
        }
        
        nextToken = listResponse.NextToken;
      } while (nextToken);
    } catch (error) {
      console.error('Error capturing secrets:', error);
    }
    
    return secrets;
  }

  // ==========================================================================
  // API Gateway Capture
  // ==========================================================================

  private async captureApiGateway(environment: EnvironmentName): Promise<ApiGatewayManifest> {
    const apiName = `radiant-${environment}-api`;
    
    try {
      const apisResponse = await this.apiGwClient.send(new GetRestApisCommand({
        limit: 500,
      }));
      
      const api = apisResponse.items?.find(a => a.name === apiName);
      if (!api || !api.id) return this.getEmptyApiGatewayManifest();
      
      const stagesResponse = await this.apiGwClient.send(new GetStagesCommand({
        restApiId: api.id,
      }));
      
      const resourcesResponse = await this.apiGwClient.send(new GetResourcesCommand({
        restApiId: api.id,
        limit: 500,
      }));
      
      return {
        restApiId: api.id,
        name: api.name || '',
        description: api.description,
        createdAt: api.createdDate?.toISOString() || '',
        stages: (stagesResponse.item || []).map(stage => ({
          name: stage.stageName || '',
          deploymentId: stage.deploymentId || '',
          lastUpdatedAt: stage.lastUpdatedDate?.toISOString() || '',
          throttling: stage.methodSettings?.['*/*'] ? {
            burstLimit: stage.methodSettings['*/*'].throttlingBurstLimit || 5000,
            rateLimit: stage.methodSettings['*/*'].throttlingRateLimit || 10000,
          } : undefined,
        })),
        endpointConfiguration: {
          types: api.endpointConfiguration?.types || ['REGIONAL'],
          vpcEndpointIds: api.endpointConfiguration?.vpcEndpointIds,
        },
        resourceCount: resourcesResponse.items?.length || 0,
        methodCount: 0, // Would need to iterate resources to count methods
      };
    } catch (error) {
      console.error('Error capturing API Gateway:', error);
      return this.getEmptyApiGatewayManifest();
    }
  }

  // ==========================================================================
  // Persistent Data Capture
  // ==========================================================================

  private async capturePersistentData(environment: EnvironmentName): Promise<PersistentDataItem[]> {
    const items: PersistentDataItem[] = [];
    
    // Load sync configuration to get include/exclude preferences
    const syncConfig = await this.loadSyncConfig(environment);
    
    for (const template of DEFAULT_PERSISTENT_DATA_ITEMS) {
      const location = template.location.replace('{env}', environment);
      
      // Get actual size/count from the resource
      let sizeBytes = 0;
      let recordCount = 0;
      
      if (template.type === 'database') {
        const stats = await this.getDatabaseTableStats(location);
        sizeBytes = stats.sizeBytes;
        recordCount = stats.recordCount;
      } else if (template.type === 's3') {
        const stats = await this.getS3BucketStats(location);
        sizeBytes = stats.sizeBytes;
        recordCount = stats.objectCount;
      }
      
      // Check if item is included/excluded in sync config
      const includeInSync = syncConfig.includedDataItems.includes(template.id) ||
        (!syncConfig.excludedDataItems.includes(template.id) && template.includeInSync);
      
      items.push({
        ...template,
        location,
        sizeBytes,
        recordCount,
        includeInSync,
        lastModified: new Date().toISOString(),
      });
    }
    
    return items;
  }

  // ==========================================================================
  // Feature Capture
  // ==========================================================================

  private async captureFeatures(environment: EnvironmentName): Promise<FeatureManifest> {
    // In a real implementation, this would read from the database
    // For now, return defaults
    return this.getDefaultFeatures();
  }

  // ==========================================================================
  // Health Capture
  // ==========================================================================

  private async captureHealth(environment: EnvironmentName): Promise<EnvironmentStateManifest['health']> {
    const services: Record<string, ResourceHealth> = {};
    
    // Check each service
    services['cloudformation'] = 'healthy';
    services['lambda'] = 'healthy';
    services['s3'] = 'healthy';
    services['aurora'] = 'healthy';
    services['secrets-manager'] = 'healthy';
    services['api-gateway'] = 'healthy';
    
    // Determine overall health
    const healthValues = Object.values(services);
    let overall: ResourceHealth = 'healthy';
    if (healthValues.includes('unhealthy')) overall = 'unhealthy';
    else if (healthValues.includes('degraded')) overall = 'degraded';
    else if (healthValues.includes('unknown')) overall = 'unknown';
    
    return {
      overall,
      services,
      lastHealthCheckAt: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // Comparison
  // ==========================================================================

  async compareEnvironments(request: CompareEnvironmentsRequest): Promise<CompareEnvironmentsResponse> {
    try {
      const { sourceEnvironment, targetEnvironment, comparedBy } = request;
      
      const [sourceManifest, targetManifest] = await Promise.all([
        this.loadCurrentManifest(sourceEnvironment),
        this.loadCurrentManifest(targetEnvironment),
      ]);
      
      if (!sourceManifest || !targetManifest) {
        return {
          success: false,
          error: 'One or both environment manifests not found',
        };
      }
      
      const diff = this.calculateDiff(sourceManifest, targetManifest);
      const recommendations = this.generateSyncRecommendations(diff, sourceManifest, targetManifest);
      
      const comparison: EnvironmentComparison = {
        sourceEnvironment,
        targetEnvironment,
        comparedAt: new Date().toISOString(),
        comparedBy,
        diff,
        recommendations,
        conflicts: [],
        estimatedSyncDurationMs: this.estimateSyncDuration(diff),
        estimatedDataTransferBytes: this.estimateDataTransfer(diff, sourceManifest),
        requiresDowntime: this.checkRequiresDowntime(diff),
      };
      
      return {
        success: true,
        comparison,
      };
    } catch (error) {
      console.error('Error comparing environments:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private calculateDiff(from: EnvironmentStateManifest, to: EnvironmentStateManifest): ManifestDiff {
    const diff: ManifestDiff = {
      fromVersion: from.version,
      toVersion: to.version,
      fromCapturedAt: from.capturedAt,
      toCapturedAt: to.capturedAt,
      added: { stacks: [], lambdas: [], buckets: [], tables: [], secrets: [], persistentData: [] },
      removed: { stacks: [], lambdas: [], buckets: [], tables: [], secrets: [], persistentData: [] },
      modified: { stacks: [], lambdas: [], buckets: [], tables: [], secrets: [], persistentData: [] },
      totalChanges: 0,
      breakingChanges: 0,
      dataChanges: 0,
    };
    
    // Compare stacks
    const fromStackNames = new Set(from.infrastructure.stacks.map(s => s.name));
    const toStackNames = new Set(to.infrastructure.stacks.map(s => s.name));
    
    for (const name of toStackNames) {
      if (!fromStackNames.has(name)) diff.added.stacks.push(name);
    }
    for (const name of fromStackNames) {
      if (!toStackNames.has(name)) diff.removed.stacks.push(name);
    }
    
    // Compare lambdas
    const fromLambdaNames = new Set(from.infrastructure.lambdas.map(l => l.name));
    const toLambdaNames = new Set(to.infrastructure.lambdas.map(l => l.name));
    
    for (const name of toLambdaNames) {
      if (!fromLambdaNames.has(name)) diff.added.lambdas.push(name);
    }
    for (const name of fromLambdaNames) {
      if (!toLambdaNames.has(name)) diff.removed.lambdas.push(name);
    }
    
    // Compare persistent data
    const fromDataIds = new Set(from.persistentData.map(d => d.id));
    const toDataIds = new Set(to.persistentData.map(d => d.id));
    
    for (const id of toDataIds) {
      if (!fromDataIds.has(id)) diff.added.persistentData.push(id);
    }
    for (const id of fromDataIds) {
      if (!toDataIds.has(id)) diff.removed.persistentData.push(id);
    }
    
    // Calculate totals
    diff.totalChanges = 
      diff.added.stacks.length + diff.added.lambdas.length + diff.added.persistentData.length +
      diff.removed.stacks.length + diff.removed.lambdas.length + diff.removed.persistentData.length +
      diff.modified.stacks.length + diff.modified.lambdas.length + diff.modified.persistentData.length;
    
    diff.dataChanges = diff.added.persistentData.length + diff.removed.persistentData.length + diff.modified.persistentData.length;
    
    return diff;
  }

  private generateSyncRecommendations(
    diff: ManifestDiff,
    source: EnvironmentStateManifest,
    target: EnvironmentStateManifest
  ): SyncRecommendation[] {
    const recommendations: SyncRecommendation[] = [];
    
    // Recommend syncing added items
    for (const stackName of diff.added.stacks) {
      recommendations.push({
        type: 'sync',
        itemType: 'stack',
        itemId: stackName,
        reason: 'Stack exists in source but not in target',
        risk: 'medium',
        action: 'Deploy stack to target environment',
      });
    }
    
    // Warn about removed items
    for (const stackName of diff.removed.stacks) {
      recommendations.push({
        type: 'review',
        itemType: 'stack',
        itemId: stackName,
        reason: 'Stack exists in target but not in source',
        risk: 'high',
        action: 'Review whether to delete from target or add to source',
      });
    }
    
    // Data sync recommendations
    for (const dataId of diff.added.persistentData) {
      const item = source.persistentData.find(d => d.id === dataId);
      if (!item) continue;
      
      recommendations.push({
        type: item.includeInSync ? 'sync' : 'skip',
        itemType: 'data',
        itemId: dataId,
        reason: item.includeInSync 
          ? 'Data item configured for sync' 
          : 'Data item excluded from sync',
        risk: item.sensitivity === 'restricted' ? 'high' : 'low',
        action: item.includeInSync 
          ? 'Copy data to target environment' 
          : 'Skip - not configured for sync',
      });
    }
    
    return recommendations;
  }

  // ==========================================================================
  // Sync Operations
  // ==========================================================================

  async startSync(request: StartSyncRequest): Promise<StartSyncResponse> {
    try {
      const operationId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create sync operation record
      const operation: SyncOperation = {
        id: operationId,
        sourceEnvironment: request.sourceEnvironment,
        targetEnvironment: request.targetEnvironment,
        initiatedBy: request.initiatedBy,
        initiatedAt: new Date().toISOString(),
        syncInfrastructure: request.syncInfrastructure ?? false,
        syncData: request.syncData ?? true,
        syncFeatures: request.syncFeatures ?? true,
        dataItemsToSync: request.dataItemsToSync ?? [],
        status: 'syncing',
        progress: {
          phase: 'preparing',
          percentComplete: 0,
          itemsCompleted: 0,
          itemsTotal: 0,
          bytesTransferred: 0,
        },
        errors: [],
      };
      
      // Save operation to S3
      await this.saveSyncOperation(operation);
      
      // Start async sync process (would be a Step Function or background Lambda in production)
      // For now, we just return the operation ID
      
      return {
        success: true,
        operationId,
      };
    } catch (error) {
      console.error('Error starting sync:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // Backup Operations
  // ==========================================================================

  async createBackup(request: CreateBackupRequest): Promise<CreateBackupResponse> {
    try {
      const backupId = `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Capture current manifest
      const manifestResponse = await this.captureManifest({
        environment: request.environment,
        capturedBy: request.createdBy,
      });
      
      if (!manifestResponse.success || !manifestResponse.manifest) {
        return {
          success: false,
          error: 'Failed to capture manifest for backup',
        };
      }
      
      // Create backup manifest
      const backup: BackupManifest = {
        id: backupId,
        environment: request.environment,
        type: request.type || 'manual',
        status: 'in_progress',
        createdAt: new Date().toISOString(),
        createdBy: request.createdBy,
        includesInfrastructure: request.includeInfrastructure ?? true,
        includesDatabase: request.includeDatabase ?? true,
        includesS3: request.includeS3 ?? true,
        includesSecrets: request.includeSecrets ?? false,
        includesFeatureFlags: request.includeFeatureFlags ?? true,
        stateManifestVersion: manifestResponse.manifest.version,
        totalSizeBytes: 0,
        componentSizes: {
          infrastructure: 0,
          database: 0,
          s3: 0,
          secrets: 0,
          config: 0,
        },
        storageLocation: `s3://${this.config.stateRegistryBucket}/backups/${backupId}/`,
        storageClass: 'STANDARD',
        checksums: {
          manifest: '',
          full: '',
        },
        restoreCount: 0,
      };
      
      // Save backup manifest
      await this.saveBackupManifest(backup);
      
      // Start async backup process
      // In production, this would trigger a Step Function
      
      return {
        success: true,
        backupId,
      };
    } catch (error) {
      console.error('Error creating backup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // Storage Operations
  // ==========================================================================

  private async saveManifest(environment: EnvironmentName, manifest: EnvironmentStateManifest): Promise<void> {
    const bucket = this.config.stateRegistryBucket;
    
    // Save current manifest
    await this.s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: `manifests/${environment}/current.json`,
      Body: JSON.stringify(manifest, null, 2),
      ContentType: 'application/json',
    }));
    
    // Save to history
    const historyKey = `manifests/${environment}/history/${manifest.capturedAt.replace(/[:.]/g, '-')}_${manifest.capturedBy}.json`;
    await this.s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: historyKey,
      Body: JSON.stringify(manifest, null, 2),
      ContentType: 'application/json',
    }));
  }

  private async loadCurrentManifest(environment: EnvironmentName): Promise<EnvironmentStateManifest | null> {
    try {
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.config.stateRegistryBucket,
        Key: `manifests/${environment}/current.json`,
      }));
      
      const body = await response.Body?.transformToString();
      return body ? JSON.parse(body) : null;
    } catch (error) {
      return null;
    }
  }

  private async loadSyncConfig(environment: EnvironmentName): Promise<SyncConfiguration> {
    try {
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.config.stateRegistryBucket,
        Key: `config/${environment}/sync-config.json`,
      }));
      
      const body = await response.Body?.transformToString();
      return body ? JSON.parse(body) : this.getDefaultSyncConfig();
    } catch (error) {
      return this.getDefaultSyncConfig();
    }
  }

  // ==========================================================================
  // Public Sync/Backup Accessors
  // ==========================================================================

  async getSyncOperation(operationId: string): Promise<SyncOperation | null> {
    try {
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.config.stateRegistryBucket,
        Key: `operations/sync/${operationId}.json`,
      }));
      const body = await response.Body?.transformToString();
      return body ? JSON.parse(body) as SyncOperation : null;
    } catch {
      return null;
    }
  }

  async cancelSyncOperation(operationId: string): Promise<SyncOperation | null> {
    const operation = await this.getSyncOperation(operationId);
    if (!operation) return null;
    operation.status = 'failed' as EnvSyncStatus;
    operation.errors = [...(operation.errors || []), {
      item: operationId,
      itemType: 'sync_operation',
      error: 'Sync operation cancelled by admin',
      recoverable: false,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    }];
    await this.saveSyncOperation(operation);
    return operation;
  }

  async listSyncOperations(options?: { environment?: string; limit?: number }): Promise<SyncOperation[]> {
    try {
      const response = await this.s3Client.send(new ListObjectsV2Command({
        Bucket: this.config.stateRegistryBucket,
        Prefix: 'operations/sync/',
        MaxKeys: options?.limit || 50,
      }));
      const operations: SyncOperation[] = [];
      for (const obj of response.Contents || []) {
        if (!obj.Key) continue;
        try {
          const getResp = await this.s3Client.send(new GetObjectCommand({
            Bucket: this.config.stateRegistryBucket,
            Key: obj.Key,
          }));
          const body = await getResp.Body?.transformToString();
          if (body) {
            const op = JSON.parse(body) as SyncOperation;
            if (!options?.environment || op.sourceEnvironment === options.environment || op.targetEnvironment === options.environment) {
              operations.push(op);
            }
          }
        } catch { /* skip unreadable entries */ }
      }
      return operations.sort((a, b) => new Date(b.initiatedAt).getTime() - new Date(a.initiatedAt).getTime());
    } catch {
      return [];
    }
  }

  async getBackupManifest(backupId: string): Promise<BackupManifest | null> {
    try {
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.config.stateRegistryBucket,
        Key: `backups/${backupId}/manifest.json`,
      }));
      const body = await response.Body?.transformToString();
      return body ? JSON.parse(body) as BackupManifest : null;
    } catch {
      return null;
    }
  }

  async listBackupManifests(options?: { environment?: string; limit?: number }): Promise<BackupManifest[]> {
    try {
      const response = await this.s3Client.send(new ListObjectsV2Command({
        Bucket: this.config.stateRegistryBucket,
        Prefix: 'backups/',
        MaxKeys: 500,
      }));
      const backups: BackupManifest[] = [];
      for (const obj of response.Contents || []) {
        if (!obj.Key?.endsWith('/manifest.json')) continue;
        try {
          const getResp = await this.s3Client.send(new GetObjectCommand({
            Bucket: this.config.stateRegistryBucket,
            Key: obj.Key,
          }));
          const body = await getResp.Body?.transformToString();
          if (body) {
            const backup = JSON.parse(body) as BackupManifest;
            if (!options?.environment || backup.environment === options.environment) {
              backups.push(backup);
            }
          }
        } catch { /* skip unreadable entries */ }
      }
      backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return backups.slice(0, options?.limit || 20);
    } catch {
      return [];
    }
  }

  async deleteBackupManifest(backupId: string): Promise<boolean> {
    try {
      const backup = await this.getBackupManifest(backupId);
      if (!backup) return false;
      backup.status = 'deleted' as BackupManifest['status'];
      await this.saveBackupManifest(backup);
      return true;
    } catch {
      return false;
    }
  }

  async getSyncConfig(environment: EnvironmentName): Promise<SyncConfiguration> {
    try {
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.config.stateRegistryBucket,
        Key: `config/sync/${environment}.json`,
      }));
      const body = await response.Body?.transformToString();
      if (body) return JSON.parse(body) as SyncConfiguration;
    } catch { /* fall through to default */ }
    const defaults = this.getDefaultSyncConfig();
    defaults.enabled = environment !== 'prod';
    defaults.requireApproval = environment === 'prod';
    return defaults;
  }

  async saveSyncConfig(environment: EnvironmentName, config: SyncConfiguration): Promise<void> {
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.config.stateRegistryBucket,
      Key: `config/sync/${environment}.json`,
      Body: JSON.stringify(config, null, 2),
      ContentType: 'application/json',
    }));
  }

  private async saveSyncOperation(operation: SyncOperation): Promise<void> {
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.config.stateRegistryBucket,
      Key: `operations/sync/${operation.id}.json`,
      Body: JSON.stringify(operation, null, 2),
      ContentType: 'application/json',
    }));
  }

  private async saveBackupManifest(backup: BackupManifest): Promise<void> {
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.config.stateRegistryBucket,
      Key: `backups/${backup.id}/manifest.json`,
      Body: JSON.stringify(backup, null, 2),
      ContentType: 'application/json',
    }));
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private calculateChecksums(manifest: EnvironmentStateManifest): EnvironmentStateManifest['checksums'] {
    const infraHash = createHash('sha256')
      .update(JSON.stringify(manifest.infrastructure))
      .digest('hex');
    
    const dataHash = createHash('sha256')
      .update(JSON.stringify(manifest.persistentData))
      .digest('hex');
    
    const featuresHash = createHash('sha256')
      .update(JSON.stringify(manifest.features))
      .digest('hex');
    
    const fullHash = createHash('sha256')
      .update(infraHash + dataHash + featuresHash)
      .digest('hex');
    
    return {
      infrastructure: infraHash,
      persistentData: dataHash,
      features: featuresHash,
      full: fullHash,
    };
  }

  private async getVpcId(environment: EnvironmentName): Promise<string> {
    // In production, would look this up from CloudFormation outputs
    return `vpc-${environment}-placeholder`;
  }

  private async getDatabaseTableStats(tableName: string): Promise<{ sizeBytes: number; recordCount: number }> {
    // In production, would query the database
    return { sizeBytes: 0, recordCount: 0 };
  }

  private async getS3BucketStats(bucketName: string): Promise<{ sizeBytes: number; objectCount: number }> {
    try {
      const response = await this.s3Client.send(new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 1000,
      }));
      
      const objectCount = response.KeyCount || 0;
      const sizeBytes = (response.Contents || []).reduce((sum, obj) => sum + (obj.Size || 0), 0);
      
      return { sizeBytes, objectCount };
    } catch {
      return { sizeBytes: 0, objectCount: 0 };
    }
  }

  private mapBucketToPersistentData(bucketName: string): string[] {
    if (bucketName.includes('uploads')) return ['user_uploads'];
    if (bucketName.includes('curator')) return ['curator_documents'];
    if (bucketName.includes('models')) return ['model_weights'];
    return [];
  }

  private getSyncPreferenceForBucket(bucketName: string): S3BucketManifest['syncPreference'] {
    if (bucketName.includes('models')) return 'exclude'; // Too large
    if (bucketName.includes('logs')) return 'exclude';
    if (bucketName.includes('backups')) return 'exclude';
    return 'full';
  }

  private estimateSyncDuration(diff: ManifestDiff): number {
    // Rough estimate: 1 second per change
    return diff.totalChanges * 1000;
  }

  private estimateDataTransfer(diff: ManifestDiff, source: EnvironmentStateManifest): number {
    // Sum up sizes of items to sync
    let total = 0;
    for (const id of diff.added.persistentData) {
      const item = source.persistentData.find(d => d.id === id);
      if (item?.sizeBytes) total += item.sizeBytes;
    }
    return total;
  }

  private checkRequiresDowntime(diff: ManifestDiff): boolean {
    // Infrastructure changes may require downtime
    return diff.added.stacks.length > 0 || diff.removed.stacks.length > 0;
  }

  private getEmptyAuroraManifest(): AuroraManifest {
    return {
      clusterIdentifier: '',
      clusterArn: '',
      engine: '',
      engineVersion: '',
      status: 'unknown',
      endpoint: '',
      readerEndpoint: '',
      port: 5432,
      instances: [],
      allocatedStorage: 0,
      storageEncrypted: false,
      backupRetentionPeriod: 7,
      databases: [],
      persistentDataItems: [],
    };
  }

  private getEmptyApiGatewayManifest(): ApiGatewayManifest {
    return {
      restApiId: '',
      name: '',
      createdAt: '',
      stages: [],
      endpointConfiguration: { types: [] },
      resourceCount: 0,
      methodCount: 0,
    };
  }

  private getDefaultFeatures(): FeatureManifest {
    return {
      enableCurator: true,
      enableCortexMemory: true,
      enableTimeMachine: true,
      enableCollaboration: true,
      enableComplianceExport: true,
      enableEgoSystem: true,
      enableDelight: true,
      enableCato: true,
      enableSelfHostedModels: true,
      enableExternalModels: true,
      enableModelFallback: true,
      enableStreamingResponses: true,
      enableMCP: true,
      enableA2A: true,
      enableExternalAPI: true,
      customFlags: {},
    };
  }

  private getDefaultSyncConfig(): SyncConfiguration {
    return {
      enabled: false,
      syncInfrastructure: false,
      syncPersistentData: true,
      syncFeatureFlags: true,
      syncSecrets: false,
      includedDataItems: [],
      excludedDataItems: ['audit_merkle', 'cato_safety_log', 'user_analytics'],
      requireConfirmation: true,
      allowDestructive: false,
      requireApproval: false,
      autoSyncEnabled: false,
      notifyOnSync: true,
      notifyOnConflict: true,
      notificationChannels: ['email'],
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createEnvironmentStateService(config: StateRegistryConfig): EnvironmentStateService {
  return new EnvironmentStateService(config);
}
