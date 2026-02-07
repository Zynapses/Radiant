/**
 * RADIANT Domain Expert Cortex Service
 * Manages 7 specialized neural networks per domain
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { executeStatement, stringParam, doubleParam, boolParam } from '../db/client';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'domain/expert',
  category: 'infrastructure',
  sourceType: 'application',
});
import type {
  DomainExpertConfig,
  DomainExpertNetwork,
  DomainExpertNetworkType,
  DomainExpertSuite,
  DomainExpertStatus,
  DomainExpertDashboard,
  DomainExpertTrainingJob,
  DomainExpertInferenceRequest,
  DomainExpertInferenceResult,
  ListDomainExpertsRequest,
  ListDomainExpertsResponse,
  CreateDomainConfigRequest,
  UpdateDomainConfigRequest,
  DeployNetworkRequest,
  StartTrainingRequest,
  DOMAIN_EXPERT_NETWORK_CONFIGS,
  PREDEFINED_DOMAINS,
} from '@radiant/shared';

// =============================================================================
// Constants
// =============================================================================

const DOMAIN_EXPERT_BUCKET = process.env.DOMAIN_EXPERT_BUCKET || 'radiant-domain-experts';
const ALL_NETWORK_TYPES: DomainExpertNetworkType[] = [
  'entity_classifier',
  'contraindication_net',
  'protocol_matcher',
  'severity_assessor',
  'personalization_net',
  'citation_network',
  'orchestration_selector',
];

// =============================================================================
// Service
// =============================================================================

class DomainExpertService {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  }

  // ===========================================================================
  // Dashboard
  // ===========================================================================

  async getDashboard(tenantId: string): Promise<DomainExpertDashboard> {
    try {
      const [suites, trainingJobs] = await Promise.all([
        this.listDomainExperts({ tenantId }),
        this.getRecentTrainingJobs(tenantId),
      ]);

      const activeNetworks = suites.suites.reduce(
        (acc, suite) => acc + Object.values(suite.networks).filter(n => n?.status === 'active').length,
        0
      );

      const totalNetworks = suites.suites.reduce(
        (acc, suite) => acc + Object.values(suite.networks).filter(n => n !== null).length,
        0
      );

      const totalParameters = suites.suites.reduce((acc, suite) => acc + suite.totalParameters, 0);

      return {
        summary: {
          totalDomains: suites.total,
          domainsWithExperts: suites.suites.filter(s => s.completeness > 0).length,
          totalNetworks,
          activeNetworks,
          trainingJobs: trainingJobs.filter(j => j.status === 'training').length,
          totalParameters,
        },
        domains: suites.suites,
        recentTrainingJobs: trainingJobs,
        alerts: [],
      };
    } catch (error) {
      logger.error('Failed to get domain expert dashboard', { error, tenantId });
      throw error;
    }
  }

  // ===========================================================================
  // Domain Configuration
  // ===========================================================================

  async getDomainConfig(tenantId: string, domainId: string): Promise<DomainExpertConfig | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM domain_expert_configs 
         WHERE tenant_id = :tenant_id AND domain_id = :domain_id`,
        [stringParam('tenant_id', tenantId), stringParam('domain_id', domainId)]
      );

      if (!result.rows?.length) return null;
      return this.mapRowToConfig(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get domain config', { error, tenantId, domainId });
      throw error;
    }
  }

  async createDomainConfig(
    tenantId: string,
    userId: string,
    request: CreateDomainConfigRequest
  ): Promise<DomainExpertConfig> {
    try {
      const now = new Date().toISOString();

      await executeStatement(
        `INSERT INTO domain_expert_configs (
          tenant_id, domain_id, display_name, is_training_domain, enabled,
          num_entities, num_actions, num_protocols, safety_threshold,
          citation_required, default_models, safety_model,
          created_at, updated_at, created_by
        ) VALUES (
          :tenant_id, :domain_id, :display_name, :is_training, true,
          :num_entities, :num_actions, :num_protocols, :safety_threshold,
          :citation_required, :default_models, :safety_model,
          :created_at, :updated_at, :created_by
        )`,
        [
          stringParam('tenant_id', tenantId),
          stringParam('domain_id', request.domainId),
          stringParam('display_name', request.displayName),
          boolParam('is_training', request.isTrainingDomain || false),
          stringParam('num_entities', String(request.numEntities)),
          stringParam('num_actions', String(request.numActions)),
          stringParam('num_protocols', String(request.numProtocols)),
          doubleParam('safety_threshold', request.safetyThreshold),
          boolParam('citation_required', request.citationRequired || false),
          stringParam('default_models', JSON.stringify(request.defaultModels || [])),
          stringParam('safety_model', request.safetyModel || ''),
          stringParam('created_at', now),
          stringParam('updated_at', now),
          stringParam('created_by', userId),
        ]
      );

      logger.info('Domain config created', { tenantId, domainId: request.domainId });
      return (await this.getDomainConfig(tenantId, request.domainId))!;
    } catch (error) {
      logger.error('Failed to create domain config', { error, tenantId });
      throw error;
    }
  }

  async updateDomainConfig(
    tenantId: string,
    domainId: string,
    request: UpdateDomainConfigRequest
  ): Promise<DomainExpertConfig> {
    try {
      const updates: string[] = [];
      const params = [
        stringParam('tenant_id', tenantId),
        stringParam('domain_id', domainId),
      ];

      if (request.displayName !== undefined) {
        updates.push('display_name = :display_name');
        params.push(stringParam('display_name', request.displayName));
      }

      if (request.isTrainingDomain !== undefined) {
        updates.push('is_training_domain = :is_training');
        params.push(boolParam('is_training', request.isTrainingDomain));
      }

      if (request.enabled !== undefined) {
        updates.push('enabled = :enabled');
        params.push(boolParam('enabled', request.enabled));
      }

      if (request.safetyThreshold !== undefined) {
        updates.push('safety_threshold = :safety_threshold');
        params.push(doubleParam('safety_threshold', request.safetyThreshold));
      }

      if (request.citationRequired !== undefined) {
        updates.push('citation_required = :citation_required');
        params.push(boolParam('citation_required', request.citationRequired));
      }

      updates.push('updated_at = NOW()');

      await executeStatement(
        `UPDATE domain_expert_configs SET ${updates.join(', ')}
         WHERE tenant_id = :tenant_id AND domain_id = :domain_id`,
        params
      );

      logger.info('Domain config updated', { tenantId, domainId });
      return (await this.getDomainConfig(tenantId, domainId))!;
    } catch (error) {
      logger.error('Failed to update domain config', { error, tenantId, domainId });
      throw error;
    }
  }

  // ===========================================================================
  // Network Management
  // ===========================================================================

  async listDomainExperts(request: ListDomainExpertsRequest): Promise<ListDomainExpertsResponse> {
    try {
      // Get all domain configs
      let configQuery = 'SELECT * FROM domain_expert_configs WHERE tenant_id = :tenant_id';
      const params = [stringParam('tenant_id', request.tenantId)];

      if (request.domainId) {
        configQuery += ' AND domain_id = :domain_id';
        params.push(stringParam('domain_id', request.domainId));
      }

      const configResult = await executeStatement(configQuery, params);
      const configs = (configResult.rows || []).map((row: Record<string, unknown>) => this.mapRowToConfig(row));

      // Get all networks for these domains
      const networkResult = await executeStatement(
        `SELECT * FROM domain_expert_networks 
         WHERE tenant_id = :tenant_id 
         ${request.domainId ? 'AND domain_id = :domain_id' : ''}
         ${request.networkType ? 'AND network_type = :network_type' : ''}
         ${request.status ? 'AND status = :status' : ''}`,
        [
          stringParam('tenant_id', request.tenantId),
          ...(request.domainId ? [stringParam('domain_id', request.domainId)] : []),
          ...(request.networkType ? [stringParam('network_type', request.networkType)] : []),
          ...(request.status ? [stringParam('status', request.status)] : []),
        ]
      );

      const networks = (networkResult.rows || []).map((row: Record<string, unknown>) => this.mapRowToNetwork(row));

      // Build suites
      const suites: DomainExpertSuite[] = configs.map(config => {
        const domainNetworks = networks.filter(n => n.domainId === config.domainId);
        const networkMap: Record<DomainExpertNetworkType, DomainExpertNetwork | null> = {
          entity_classifier: null,
          contraindication_net: null,
          protocol_matcher: null,
          severity_assessor: null,
          personalization_net: null,
          citation_network: null,
          orchestration_selector: null,
        };

        for (const network of domainNetworks) {
          networkMap[network.networkType] = network;
        }

        const deployedCount = Object.values(networkMap).filter(n => n !== null).length;
        const totalParams = Object.values(networkMap)
          .filter(n => n !== null)
          .reduce((acc, n) => acc + (n?.parameters || 0), 0);

        return {
          domainId: config.domainId,
          domainName: config.displayName,
          config,
          networks: networkMap,
          completeness: Math.round((deployedCount / 7) * 100),
          status: deployedCount === 7 ? 'complete' : deployedCount > 0 ? 'partial' : 'none',
          totalParameters: totalParams,
          lastUpdated: config.updatedAt,
        };
      });

      return {
        suites,
        total: suites.length,
      };
    } catch (error) {
      logger.error('Failed to list domain experts', { error, tenantId: request.tenantId });
      throw error;
    }
  }

  async getNetwork(
    tenantId: string,
    domainId: string,
    networkType: DomainExpertNetworkType
  ): Promise<DomainExpertNetwork | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM domain_expert_networks 
         WHERE tenant_id = :tenant_id 
           AND domain_id = :domain_id 
           AND network_type = :network_type`,
        [
          stringParam('tenant_id', tenantId),
          stringParam('domain_id', domainId),
          stringParam('network_type', networkType),
        ]
      );

      if (!result.rows?.length) return null;
      return this.mapRowToNetwork(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get network', { error, tenantId, domainId, networkType });
      throw error;
    }
  }

  async deployNetwork(request: DeployNetworkRequest, userId: string): Promise<DomainExpertNetwork> {
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const config = this.getNetworkConfig(request.networkType);

      await executeStatement(
        `INSERT INTO domain_expert_networks (
          id, tenant_id, domain_id, network_type, version, status,
          parameters, input_dim, output_dim,
          storage_key, storage_bucket,
          created_at, updated_at, deployed_at, deployed_by
        ) VALUES (
          :id, :tenant_id, :domain_id, :network_type, :version, 'active',
          :parameters, :input_dim, :output_dim,
          :storage_key, :bucket,
          :created_at, :updated_at, :deployed_at, :deployed_by
        )
        ON CONFLICT (tenant_id, domain_id, network_type) 
        DO UPDATE SET
          version = EXCLUDED.version,
          status = 'active',
          storage_key = EXCLUDED.storage_key,
          updated_at = EXCLUDED.updated_at,
          deployed_at = EXCLUDED.deployed_at,
          deployed_by = EXCLUDED.deployed_by`,
        [
          stringParam('id', id),
          stringParam('tenant_id', request.tenantId),
          stringParam('domain_id', request.domainId),
          stringParam('network_type', request.networkType),
          stringParam('version', request.version),
          stringParam('parameters', String(request.parameters || config.defaultParameters)),
          stringParam('input_dim', String(config.inputDim)),
          stringParam('output_dim', String(config.outputDim)),
          stringParam('storage_key', request.storageKey),
          stringParam('bucket', DOMAIN_EXPERT_BUCKET),
          stringParam('created_at', now),
          stringParam('updated_at', now),
          stringParam('deployed_at', now),
          stringParam('deployed_by', userId),
        ]
      );

      logger.info('Network deployed', {
        tenantId: request.tenantId,
        domainId: request.domainId,
        networkType: request.networkType,
      });

      return (await this.getNetwork(request.tenantId, request.domainId, request.networkType))!;
    } catch (error) {
      logger.error('Failed to deploy network', { error, request });
      throw error;
    }
  }

  // ===========================================================================
  // Inference
  // ===========================================================================

  async runInference(request: DomainExpertInferenceRequest): Promise<DomainExpertInferenceResult> {
    const startTime = Date.now();

    try {
      // Get the network
      const network = await this.getNetwork(
        request.tenantId,
        request.domainId,
        request.networkType
      );

      if (!network) {
        throw new Error(`Network not found: ${request.domainId}/${request.networkType}`);
      }

      if (network.status !== 'active') {
        throw new Error(`Network not active: ${network.status}`);
      }

      // In production, this would:
      // 1. Load ONNX model from S3 (with caching)
      // 2. Run inference using ONNX Runtime
      // 3. Return results

      // For now, return mock inference result
      const output = new Array(network.outputDim).fill(0).map(() => Math.random());
      const confidence = Math.random() * 0.3 + 0.7; // 0.7-1.0

      const latencyMs = Date.now() - startTime;

      // Update metrics
      await this.updateNetworkMetrics(
        request.tenantId,
        request.domainId,
        request.networkType,
        latencyMs,
        false
      );

      return {
        networkType: request.networkType,
        domainId: request.domainId,
        output,
        confidence,
        latencyMs,
        interpretation: this.interpretOutput(request.networkType, output),
      };
    } catch (error) {
      logger.error('Inference failed', { error, request });

      // Update error metrics
      await this.updateNetworkMetrics(
        request.tenantId,
        request.domainId,
        request.networkType,
        Date.now() - startTime,
        true
      );

      throw error;
    }
  }

  // ===========================================================================
  // Training
  // ===========================================================================

  async startTraining(request: StartTrainingRequest, userId: string): Promise<DomainExpertTrainingJob> {
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const defaultConfig = {
        learningRate: 0.001,
        batchSize: 32,
        epochs: 100,
        warmupSteps: 1000,
        weightDecay: 0.01,
        earlyStopping: true,
        earlyStoppingPatience: 10,
        ...request.config,
      };

      await executeStatement(
        `INSERT INTO domain_expert_training_jobs (
          id, tenant_id, domain_id, network_type, status, progress_percent,
          current_epoch, total_epochs, config, dataset_id,
          created_at, created_by
        ) VALUES (
          :id, :tenant_id, :domain_id, :network_type, 'pending', 0,
          0, :total_epochs, :config, :dataset_id,
          :created_at, :created_by
        )`,
        [
          stringParam('id', id),
          stringParam('tenant_id', request.tenantId),
          stringParam('domain_id', request.domainId),
          stringParam('network_type', request.networkType),
          stringParam('total_epochs', String(defaultConfig.epochs)),
          stringParam('config', JSON.stringify(defaultConfig)),
          stringParam('dataset_id', request.datasetId),
          stringParam('created_at', now),
          stringParam('created_by', userId),
        ]
      );

      logger.info('Training job started', { jobId: id, tenantId: request.tenantId });

      return (await this.getTrainingJob(id))!;
    } catch (error) {
      logger.error('Failed to start training', { error, request });
      throw error;
    }
  }

  async getTrainingJob(jobId: string): Promise<DomainExpertTrainingJob | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM domain_expert_training_jobs WHERE id = :id`,
        [stringParam('id', jobId)]
      );

      if (!result.rows?.length) return null;
      return this.mapRowToTrainingJob(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get training job', { error, jobId });
      throw error;
    }
  }

  async getRecentTrainingJobs(tenantId: string, limit = 10): Promise<DomainExpertTrainingJob[]> {
    try {
      const result = await executeStatement(
        `SELECT * FROM domain_expert_training_jobs 
         WHERE tenant_id = :tenant_id 
         ORDER BY created_at DESC 
         LIMIT ${limit}`,
        [stringParam('tenant_id', tenantId)]
      );

      return (result.rows || []).map((row: Record<string, unknown>) => this.mapRowToTrainingJob(row));
    } catch (error) {
      logger.error('Failed to get training jobs', { error, tenantId });
      return [];
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private getNetworkConfig(networkType: DomainExpertNetworkType) {
    const configs: Record<DomainExpertNetworkType, { defaultParameters: number; inputDim: number; outputDim: number }> = {
      entity_classifier: { defaultParameters: 4000000, inputDim: 768, outputDim: 512 },
      contraindication_net: { defaultParameters: 4000000, inputDim: 1024, outputDim: 256 },
      protocol_matcher: { defaultParameters: 4000000, inputDim: 768, outputDim: 256 },
      severity_assessor: { defaultParameters: 4000000, inputDim: 512, outputDim: 64 },
      personalization_net: { defaultParameters: 4000000, inputDim: 640, outputDim: 256 },
      citation_network: { defaultParameters: 4000000, inputDim: 768, outputDim: 128 },
      orchestration_selector: { defaultParameters: 4000000, inputDim: 512, outputDim: 128 },
    };
    return configs[networkType];
  }

  private async updateNetworkMetrics(
    tenantId: string,
    domainId: string,
    networkType: DomainExpertNetworkType,
    latencyMs: number,
    isError: boolean
  ): Promise<void> {
    try {
      // This would update running averages in production
      await executeStatement(
        `UPDATE domain_expert_networks 
         SET requests_per_second = requests_per_second + 1,
             latency_p50_ms = (latency_p50_ms + :latency) / 2,
             error_rate = CASE WHEN :is_error THEN error_rate + 0.001 ELSE error_rate * 0.999 END,
             updated_at = NOW()
         WHERE tenant_id = :tenant_id AND domain_id = :domain_id AND network_type = :network_type`,
        [
          doubleParam('latency', latencyMs),
          boolParam('is_error', isError),
          stringParam('tenant_id', tenantId),
          stringParam('domain_id', domainId),
          stringParam('network_type', networkType),
        ]
      );
    } catch (error) {
      // Non-critical, just log
      logger.warn('Failed to update network metrics', { error });
    }
  }

  private interpretOutput(
    networkType: DomainExpertNetworkType,
    output: number[]
  ): DomainExpertInferenceResult['interpretation'] {
    switch (networkType) {
      case 'severity_assessor':
        const maxIdx = output.indexOf(Math.max(...output));
        const levels = ['low', 'medium', 'high', 'critical'] as const;
        return {
          severity: {
            level: levels[Math.min(maxIdx, 3)],
            score: output[maxIdx],
            factors: ['Input analysis', 'Historical patterns'],
          },
        };

      case 'entity_classifier':
        return {
          entities: output.slice(0, 5).map((score, i) => ({
            id: `entity-${i}`,
            name: `Entity ${i + 1}`,
            score,
          })),
        };

      default:
        return undefined;
    }
  }

  private mapRowToConfig(row: Record<string, unknown>): DomainExpertConfig {
    return {
      domainId: String(row.domain_id || ''),
      displayName: String(row.display_name || ''),
      isTrainingDomain: Boolean(row.is_training_domain),
      enabled: Boolean(row.enabled),
      numEntities: Number(row.num_entities) || 0,
      numActions: Number(row.num_actions) || 0,
      numProtocols: Number(row.num_protocols) || 0,
      safetyThreshold: Number(row.safety_threshold) || 0.5,
      citationRequired: Boolean(row.citation_required),
      defaultModels: row.default_models ? JSON.parse(String(row.default_models)) : [],
      safetyModel: String(row.safety_model || ''),
      createdAt: String(row.created_at || new Date().toISOString()),
      updatedAt: String(row.updated_at || new Date().toISOString()),
      createdBy: String(row.created_by || ''),
    };
  }

  private mapRowToNetwork(row: Record<string, unknown>): DomainExpertNetwork {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      domainId: String(row.domain_id || ''),
      networkType: row.network_type as DomainExpertNetworkType,
      version: String(row.version || '1.0.0'),
      status: (row.status as DomainExpertStatus) || 'inactive',
      parameters: Number(row.parameters) || 0,
      inputDim: Number(row.input_dim) || 0,
      outputDim: Number(row.output_dim) || 0,
      storageKey: String(row.storage_key || ''),
      storageBucket: String(row.storage_bucket || DOMAIN_EXPERT_BUCKET),
      fileSizeBytes: Number(row.file_size_bytes) || 0,
      checksum: String(row.checksum || ''),
      latencyP50Ms: Number(row.latency_p50_ms) || 0,
      latencyP99Ms: Number(row.latency_p99_ms) || 0,
      errorRate: Number(row.error_rate) || 0,
      requestsPerSecond: Number(row.requests_per_second) || 0,
      createdAt: String(row.created_at || new Date().toISOString()),
      updatedAt: String(row.updated_at || new Date().toISOString()),
      deployedAt: row.deployed_at ? String(row.deployed_at) : undefined,
      deployedBy: row.deployed_by ? String(row.deployed_by) : undefined,
    };
  }

  private mapRowToTrainingJob(row: Record<string, unknown>): DomainExpertTrainingJob {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      domainId: String(row.domain_id || ''),
      networkType: row.network_type as DomainExpertNetworkType,
      status: (row.status as DomainExpertTrainingJob['status']) || 'pending',
      progressPercent: Number(row.progress_percent) || 0,
      currentEpoch: Number(row.current_epoch) || 0,
      totalEpochs: Number(row.total_epochs) || 100,
      config: row.config ? JSON.parse(String(row.config)) : {},
      datasetId: String(row.dataset_id || ''),
      datasetSize: Number(row.dataset_size) || 0,
      trainSplit: Number(row.train_split) || 0.8,
      validationSplit: Number(row.validation_split) || 0.2,
      metrics: row.metrics ? JSON.parse(String(row.metrics)) : undefined,
      outputNetworkId: row.output_network_id ? String(row.output_network_id) : undefined,
      outputVersion: row.output_version ? String(row.output_version) : undefined,
      startedAt: row.started_at ? String(row.started_at) : undefined,
      completedAt: row.completed_at ? String(row.completed_at) : undefined,
      createdAt: String(row.created_at || new Date().toISOString()),
      createdBy: String(row.created_by || ''),
      error: row.error ? String(row.error) : undefined,
    };
  }
}

export const domainExpertService = new DomainExpertService();
