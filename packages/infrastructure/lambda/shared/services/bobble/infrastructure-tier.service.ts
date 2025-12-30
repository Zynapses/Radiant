/**
 * Bobble Infrastructure Tier Service
 * 
 * Manages runtime-configurable infrastructure tiers (DEV, STAGING, PRODUCTION).
 * Handles tier transitions with automatic provisioning and cleanup.
 * 
 * @see /docs/bobble/adr/009-infrastructure-tiers.md
 */

import { SFNClient, StartExecutionCommand, DescribeExecutionCommand } from '@aws-sdk/client-sfn';
import { executeStatement, stringParam, longParam, boolParam, doubleParam } from '../../db/client';
import { logger } from '../../logging/enhanced-logger';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type InfrastructureTier = 'DEV' | 'STAGING' | 'PRODUCTION' | 'CUSTOM';
export type TransitionStatus = 'STABLE' | 'SCALING_UP' | 'SCALING_DOWN' | 'FAILED' | 'ROLLING_BACK';

export interface TierState {
  currentTier: InfrastructureTier;
  targetTier: InfrastructureTier | null;
  transitionStatus: TransitionStatus;
  transitionExecutionArn: string | null;
  transitionStartedAt: Date | null;
  lastChangedAt: Date;
  lastChangedBy: string;
  cooldownHours: number;
  nextChangeAllowedAt: Date;
  estimatedMonthlyCost: number;
  actualMtdCost: number;
}

export interface TierConfig {
  tierName: string;
  displayName: string;
  description: string;
  isDefault: boolean;
  estimatedMonthlyCost: number;
  
  // SageMaker
  sagemakerShadowSelfInstanceType: string;
  sagemakerShadowSelfMinInstances: number;
  sagemakerShadowSelfMaxInstances: number;
  sagemakerShadowSelfScaleToZero: boolean;
  sagemakerShadowSelfScaleInCooldown: number;
  sagemakerNliDeployment: string;
  
  // Bedrock
  bedrockProvisionedThroughput: boolean;
  bedrockModelUnits: number;
  bedrockDefaultModel: string;
  bedrockFallbackModel: string | null;
  
  // OpenSearch
  opensearchType: 'provisioned' | 'serverless';
  opensearchInstanceType: string | null;
  opensearchInstanceCount: number | null;
  opensearchEbsVolumeSize: number | null;
  opensearchMinOcus: number | null;
  opensearchMaxOcus: number | null;
  
  // DynamoDB
  dynamodbBillingMode: string;
  dynamodbRegions: string[];
  dynamodbGlobalTables: boolean;
  
  // ElastiCache
  elasticacheType: 'serverless' | 'provisioned';
  elasticacheNodeType: string | null;
  elasticacheNumCacheNodes: number | null;
  elasticacheMinEcpu: number | null;
  elasticacheMaxEcpu: number | null;
  elasticacheClusterMode: boolean;
  
  // Neptune
  neptuneType: 'serverless' | 'provisioned';
  neptuneInstanceClass: string | null;
  neptuneInstanceCount: number | null;
  neptuneMinCapacity: number | null;
  neptuneMaxCapacity: number | null;
  
  // Kinesis
  kinesisCapacityMode: 'ON_DEMAND' | 'PROVISIONED';
  kinesisShardCount: number | null;
  
  // Step Functions
  stepFunctionsType: 'STANDARD' | 'EXPRESS';
  
  // Budget
  budgetMonthlyCuriosityLimit: number;
  budgetDailyExplorationCap: number;
  
  // Display
  features: string[];
  limitations: string[];
}

export interface TierChangeRequest {
  targetTier: InfrastructureTier;
  reason: string;
  bypassCooldown?: boolean;
  bypassConfirmation?: boolean;
}

export interface TierChangeResult {
  status: 'INITIATED' | 'REQUIRES_CONFIRMATION' | 'REJECTED';
  executionArn?: string;
  fromTier?: string;
  toTier?: string;
  estimatedCompletionMinutes?: number;
  confirmationToken?: string;
  errors?: string[];
  warnings?: string[];
}

export interface TierComparison {
  tier: string;
  displayName: string;
  description: string;
  estimatedMonthlyCost: number;
  costBreakdown: Record<string, number>;
  features: string[];
  limitations: string[];
}

// ============================================================================
// Cost Breakdown Templates
// ============================================================================

const TIER_COST_BREAKDOWN: Record<string, Record<string, number>> = {
  DEV: {
    'SageMaker (scale-to-zero)': 50,
    'Bedrock (on-demand)': 200,
    'OpenSearch Provisioned': 30,
    'ElastiCache Serverless': 25,
    'Neptune Serverless': 50,
    'DynamoDB': 5,
    'Kinesis On-Demand': 10,
    'Other': 30
  },
  STAGING: {
    'SageMaker': 8000,
    'Bedrock': 15000,
    'OpenSearch': 3000,
    'ElastiCache': 2000,
    'Neptune': 1500,
    'DynamoDB': 500,
    'Kinesis': 500,
    'Other': 4500
  },
  PRODUCTION: {
    'SageMaker': 130000,
    'Bedrock': 130000,
    'OpenSearch Serverless': 90000,
    'ElastiCache': 36000,
    'Neptune': 12000,
    'DynamoDB Global Tables': 60000,
    'Kinesis': 10000,
    'Data Transfer': 35000,
    'Other': 247000
  }
};

// ============================================================================
// Service
// ============================================================================

export class InfrastructureTierService {
  private readonly sfnClient: SFNClient;
  private readonly transitionWorkflowArn: string;

  constructor() {
    this.sfnClient = new SFNClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.transitionWorkflowArn = process.env.BOBBLE_TIER_TRANSITION_WORKFLOW_ARN || '';
  }

  /**
   * Get current infrastructure tier state.
   */
  async getCurrentState(tenantId: string): Promise<TierState> {
    const result = await executeStatement({
      sql: `
        SELECT 
          current_tier,
          target_tier,
          transition_status,
          transition_execution_arn,
          transition_started_at,
          last_changed_at,
          last_changed_by,
          cooldown_hours,
          next_change_allowed_at,
          estimated_monthly_cost,
          actual_mtd_cost
        FROM bobble_infrastructure_tier
        WHERE tenant_id = :tenantId
      `,
      parameters: [stringParam('tenantId', tenantId)]
    });

    if (!result.rows || result.rows.length === 0) {
      // Create default state
      await this.initializeTierState(tenantId);
      return this.getCurrentState(tenantId);
    }

    const row = result.rows[0];
    return {
      currentTier: row.current_tier as InfrastructureTier,
      targetTier: row.target_tier as InfrastructureTier | null,
      transitionStatus: row.transition_status as TransitionStatus,
      transitionExecutionArn: row.transition_execution_arn,
      transitionStartedAt: row.transition_started_at ? new Date(row.transition_started_at) : null,
      lastChangedAt: new Date(row.last_changed_at),
      lastChangedBy: row.last_changed_by || 'system',
      cooldownHours: row.cooldown_hours,
      nextChangeAllowedAt: new Date(row.next_change_allowed_at),
      estimatedMonthlyCost: parseFloat(row.estimated_monthly_cost),
      actualMtdCost: parseFloat(row.actual_mtd_cost)
    };
  }

  /**
   * Initialize tier state for a new tenant.
   */
  private async initializeTierState(tenantId: string): Promise<void> {
    await executeStatement({
      sql: `
        INSERT INTO bobble_infrastructure_tier (tenant_id, current_tier, estimated_monthly_cost)
        VALUES (:tenantId, 'DEV', 350.00)
        ON CONFLICT (tenant_id) DO NOTHING
      `,
      parameters: [stringParam('tenantId', tenantId)]
    });

    // Create default tier configs
    await executeStatement({
      sql: `SELECT create_default_tier_configs(:tenantId::uuid)`,
      parameters: [stringParam('tenantId', tenantId)]
    });
  }

  /**
   * Get all tier configurations for a tenant.
   */
  async getTierConfigs(tenantId: string): Promise<TierConfig[]> {
    const result = await executeStatement({
      sql: `
        SELECT * FROM bobble_tier_config
        WHERE tenant_id = :tenantId
        ORDER BY 
          CASE tier_name 
            WHEN 'DEV' THEN 1 
            WHEN 'STAGING' THEN 2 
            WHEN 'PRODUCTION' THEN 3 
            ELSE 4 
          END
      `,
      parameters: [stringParam('tenantId', tenantId)]
    });

    if (!result.rows || result.rows.length === 0) {
      // Initialize default configs
      await this.initializeTierState(tenantId);
      return this.getTierConfigs(tenantId);
    }

    return result.rows.map(this.rowToTierConfig);
  }

  /**
   * Get a specific tier configuration.
   */
  async getTierConfig(tenantId: string, tierName: string): Promise<TierConfig | null> {
    const result = await executeStatement({
      sql: `
        SELECT * FROM bobble_tier_config
        WHERE tenant_id = :tenantId AND tier_name = :tierName
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('tierName', tierName)
      ]
    });

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    return this.rowToTierConfig(result.rows[0]);
  }

  /**
   * Update a tier configuration.
   */
  async updateTierConfig(
    tenantId: string,
    tierName: string,
    updates: Partial<TierConfig>
  ): Promise<void> {
    const setClauses: string[] = [];
    const params: Array<{ name: string; value: { stringValue?: string; longValue?: number; booleanValue?: boolean } }> = [
      stringParam('tenantId', tenantId),
      stringParam('tierName', tierName)
    ];

    // Build dynamic SET clause
    const fieldMappings: Record<string, { column: string; type: 'string' | 'number' | 'boolean' }> = {
      displayName: { column: 'display_name', type: 'string' },
      description: { column: 'description', type: 'string' },
      estimatedMonthlyCost: { column: 'estimated_monthly_cost', type: 'number' },
      sagemakerShadowSelfInstanceType: { column: 'sagemaker_shadow_self_instance_type', type: 'string' },
      sagemakerShadowSelfMinInstances: { column: 'sagemaker_shadow_self_min_instances', type: 'number' },
      sagemakerShadowSelfMaxInstances: { column: 'sagemaker_shadow_self_max_instances', type: 'number' },
      sagemakerShadowSelfScaleToZero: { column: 'sagemaker_shadow_self_scale_to_zero', type: 'boolean' },
      bedrockDefaultModel: { column: 'bedrock_default_model', type: 'string' },
      opensearchInstanceType: { column: 'opensearch_instance_type', type: 'string' },
      opensearchInstanceCount: { column: 'opensearch_instance_count', type: 'number' },
      elasticacheNodeType: { column: 'elasticache_node_type', type: 'string' },
      elasticacheNumCacheNodes: { column: 'elasticache_num_cache_nodes', type: 'number' },
      budgetMonthlyCuriosityLimit: { column: 'budget_monthly_curiosity_limit', type: 'number' },
      budgetDailyExplorationCap: { column: 'budget_daily_exploration_cap', type: 'number' }
    };

    for (const [field, mapping] of Object.entries(fieldMappings)) {
      if (field in updates) {
        const value = (updates as Record<string, unknown>)[field];
        if (value !== undefined) {
          setClauses.push(`${mapping.column} = :${field}`);
          if (mapping.type === 'string') {
            params.push(stringParam(field, value as string));
          } else if (mapping.type === 'number') {
            params.push(longParam(field, value as number));
          } else {
            params.push(boolParam(field, value as boolean));
          }
        }
      }
    }

    if (setClauses.length === 0) {
      return;
    }

    setClauses.push('updated_at = NOW()');
    setClauses.push('version = version + 1');

    await executeStatement({
      sql: `
        UPDATE bobble_tier_config
        SET ${setClauses.join(', ')}
        WHERE tenant_id = :tenantId AND tier_name = :tierName
      `,
      parameters: params
    });

    logger.info('Tier config updated', { tenantId, tierName, updates });
  }

  /**
   * Request a tier change.
   */
  async requestTierChange(
    tenantId: string,
    requestedBy: string,
    request: TierChangeRequest
  ): Promise<TierChangeResult> {
    const state = await this.getCurrentState(tenantId);
    const now = new Date();
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validation
    if (state.transitionStatus !== 'STABLE') {
      errors.push(`Tier transition already in progress: ${state.transitionStatus}`);
    }

    if (!request.bypassCooldown && now < state.nextChangeAllowedAt) {
      const hoursRemaining = (state.nextChangeAllowedAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      errors.push(`Cooldown active. Next change allowed in ${hoursRemaining.toFixed(1)} hours`);
    }

    if (request.targetTier === state.currentTier) {
      errors.push(`Already on ${request.targetTier} tier`);
    }

    // Production warnings
    if (request.targetTier === 'PRODUCTION' && !request.bypassConfirmation) {
      warnings.push('PRODUCTION tier costs ~$700,000-$800,000 per month. Requires explicit confirmation.');
    }

    if (state.currentTier === 'PRODUCTION' && request.targetTier !== 'PRODUCTION' && !request.bypassConfirmation) {
      warnings.push('Scaling down from PRODUCTION will terminate resources. Ensure no active users. Requires explicit confirmation.');
    }

    if (errors.length > 0) {
      return { status: 'REJECTED', errors, warnings };
    }

    if (warnings.length > 0 && !request.bypassConfirmation) {
      return {
        status: 'REQUIRES_CONFIRMATION',
        warnings,
        confirmationToken: this.generateConfirmationToken(tenantId, request.targetTier, requestedBy)
      };
    }

    // Initiate transition
    const executionArn = await this.startTransitionWorkflow(
      tenantId,
      state.currentTier,
      request.targetTier,
      requestedBy,
      request.reason
    );

    return {
      status: 'INITIATED',
      executionArn,
      fromTier: state.currentTier,
      toTier: request.targetTier,
      estimatedCompletionMinutes: this.estimateTransitionTime(state.currentTier, request.targetTier)
    };
  }

  /**
   * Confirm a tier change that requires explicit confirmation.
   */
  async confirmTierChange(
    tenantId: string,
    confirmationToken: string,
    requestedBy: string
  ): Promise<TierChangeResult> {
    const tokenData = this.validateConfirmationToken(confirmationToken);

    if (!tokenData || tokenData.tenantId !== tenantId) {
      return { status: 'REJECTED', errors: ['Invalid or expired confirmation token'] };
    }

    return this.requestTierChange(tenantId, requestedBy, {
      targetTier: tokenData.targetTier as InfrastructureTier,
      reason: `Confirmed tier change to ${tokenData.targetTier}`,
      bypassConfirmation: true
    });
  }

  /**
   * Start the Step Functions workflow for tier transition.
   */
  private async startTransitionWorkflow(
    tenantId: string,
    fromTier: InfrastructureTier,
    toTier: InfrastructureTier,
    requestedBy: string,
    reason: string
  ): Promise<string> {
    const direction = this.tierOrdinal(toTier) > this.tierOrdinal(fromTier) ? 'SCALING_UP' : 'SCALING_DOWN';
    const now = new Date();

    // Update state to transitioning
    await executeStatement({
      sql: `
        UPDATE bobble_infrastructure_tier
        SET 
          target_tier = :targetTier,
          transition_status = :status,
          transition_started_at = :now,
          updated_at = :now
        WHERE tenant_id = :tenantId
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('targetTier', toTier),
        stringParam('status', direction),
        stringParam('now', now.toISOString())
      ]
    });

    // Log the change
    await executeStatement({
      sql: `
        INSERT INTO bobble_tier_change_log (
          tenant_id, from_tier, to_tier, direction, status, changed_by, reason
        ) VALUES (
          :tenantId, :fromTier, :toTier, :direction, 'INITIATED', :changedBy, :reason
        )
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('fromTier', fromTier),
        stringParam('toTier', toTier),
        stringParam('direction', direction),
        stringParam('changedBy', requestedBy),
        stringParam('reason', reason)
      ]
    });

    // Start Step Functions execution
    if (this.transitionWorkflowArn) {
      const command = new StartExecutionCommand({
        stateMachineArn: this.transitionWorkflowArn,
        input: JSON.stringify({
          tenantId,
          fromTier,
          toTier,
          direction,
          requestedBy,
          reason,
          timestamp: now.toISOString()
        })
      });

      const response = await this.sfnClient.send(command);
      
      // Update with execution ARN
      await executeStatement({
        sql: `
          UPDATE bobble_infrastructure_tier
          SET transition_execution_arn = :arn
          WHERE tenant_id = :tenantId
        `,
        parameters: [
          stringParam('tenantId', tenantId),
          stringParam('arn', response.executionArn || '')
        ]
      });

      return response.executionArn || '';
    }

    // No Step Functions - simulate immediate completion for dev
    await this.completeTransition(tenantId, toTier, requestedBy);
    return 'simulated-execution';
  }

  /**
   * Complete a tier transition (called by Step Functions or directly for dev).
   */
  async completeTransition(
    tenantId: string,
    newTier: InfrastructureTier,
    completedBy: string
  ): Promise<void> {
    const config = await this.getTierConfig(tenantId, newTier);
    const now = new Date();
    const cooldownHours = 24;
    const nextChangeAllowed = new Date(now.getTime() + cooldownHours * 60 * 60 * 1000);

    await executeStatement({
      sql: `
        UPDATE bobble_infrastructure_tier
        SET 
          current_tier = :tier,
          target_tier = NULL,
          transition_status = 'STABLE',
          transition_execution_arn = NULL,
          transition_started_at = NULL,
          transition_completed_at = :now,
          estimated_monthly_cost = :cost,
          last_changed_by = :changedBy,
          last_changed_at = :now,
          next_change_allowed_at = :nextChange,
          updated_at = :now
        WHERE tenant_id = :tenantId
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('tier', newTier),
        stringParam('now', now.toISOString()),
        longParam('cost', config?.estimatedMonthlyCost || 350),
        stringParam('changedBy', completedBy),
        stringParam('nextChange', nextChangeAllowed.toISOString())
      ]
    });

    // Update audit log
    await executeStatement({
      sql: `
        UPDATE bobble_tier_change_log
        SET 
          status = 'COMPLETED',
          completed_at = :now,
          duration_seconds = EXTRACT(EPOCH FROM (:now::timestamptz - started_at))::integer
        WHERE tenant_id = :tenantId
          AND status = 'IN_PROGRESS'
        ORDER BY started_at DESC
        LIMIT 1
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('now', now.toISOString())
      ]
    });

    logger.info('Tier transition completed', { tenantId, newTier });
  }

  /**
   * Get tier comparison for UI display.
   */
  async getTierComparison(tenantId: string): Promise<TierComparison[]> {
    const configs = await this.getTierConfigs(tenantId);

    return configs.map(config => ({
      tier: config.tierName,
      displayName: config.displayName,
      description: config.description,
      estimatedMonthlyCost: config.estimatedMonthlyCost,
      costBreakdown: TIER_COST_BREAKDOWN[config.tierName] || {},
      features: config.features,
      limitations: config.limitations
    }));
  }

  /**
   * Get transition status.
   */
  async getTransitionStatus(tenantId: string): Promise<{
    status: TransitionStatus;
    executionArn: string | null;
    startedAt: Date | null;
    currentStep: string | null;
  }> {
    const state = await this.getCurrentState(tenantId);

    if (state.transitionStatus === 'STABLE') {
      return {
        status: 'STABLE',
        executionArn: null,
        startedAt: null,
        currentStep: null
      };
    }

    // Get Step Functions execution status if available
    let currentStep: string | null = null;
    if (state.transitionExecutionArn && this.sfnClient) {
      try {
        const command = new DescribeExecutionCommand({
          executionArn: state.transitionExecutionArn
        });
        const response = await this.sfnClient.send(command);
        currentStep = response.status || null;
      } catch {
        // Execution might not exist
      }
    }

    return {
      status: state.transitionStatus,
      executionArn: state.transitionExecutionArn,
      startedAt: state.transitionStartedAt,
      currentStep
    };
  }

  /**
   * Update cooldown hours.
   */
  async updateCooldownHours(tenantId: string, hours: number): Promise<void> {
    await executeStatement({
      sql: `
        UPDATE bobble_infrastructure_tier
        SET cooldown_hours = :hours, updated_at = NOW()
        WHERE tenant_id = :tenantId
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        longParam('hours', hours)
      ]
    });
  }

  /**
   * Get change history (audit log).
   */
  async getChangeHistory(tenantId: string, limit: number = 20): Promise<{
    id: string;
    fromTier: string;
    toTier: string;
    direction: string;
    status: string;
    changedBy: string;
    reason: string;
    startedAt: Date;
    completedAt: Date | null;
    durationSeconds: number | null;
    errors: string[];
  }[]> {
    const result = await executeStatement({
      sql: `
        SELECT 
          id,
          from_tier,
          to_tier,
          direction,
          status,
          changed_by,
          reason,
          started_at,
          completed_at,
          duration_seconds,
          errors
        FROM bobble_tier_change_log
        WHERE tenant_id = :tenantId
        ORDER BY started_at DESC
        LIMIT :limit
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        longParam('limit', limit)
      ]
    });

    if (!result.rows) {
      return [];
    }

    return result.rows.map(row => ({
      id: row.id as string,
      fromTier: row.from_tier as string,
      toTier: row.to_tier as string,
      direction: row.direction as string,
      status: row.status as string,
      changedBy: row.changed_by as string,
      reason: row.reason as string,
      startedAt: new Date(row.started_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
      durationSeconds: row.duration_seconds as number | null,
      errors: (row.errors as string[]) || []
    }));
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private tierOrdinal(tier: InfrastructureTier): number {
    return { DEV: 1, STAGING: 2, PRODUCTION: 3, CUSTOM: 4 }[tier] || 0;
  }

  private estimateTransitionTime(fromTier: InfrastructureTier, toTier: InfrastructureTier): number {
    // Scaling up takes longer (provisioning), scaling down is faster (termination)
    return this.tierOrdinal(toTier) > this.tierOrdinal(fromTier) ? 15 : 5;
  }

  private generateConfirmationToken(tenantId: string, targetTier: string, requestedBy: string): string {
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const data = JSON.stringify({ tenantId, targetTier, requestedBy, expires: expires.toISOString() });
    return Buffer.from(data).toString('base64url');
  }

  private validateConfirmationToken(token: string): { tenantId: string; targetTier: string } | null {
    try {
      const data = JSON.parse(Buffer.from(token, 'base64url').toString());
      const expires = new Date(data.expires);
      if (new Date() > expires) {
        return null;
      }
      return { tenantId: data.tenantId, targetTier: data.targetTier };
    } catch {
      return null;
    }
  }

  private rowToTierConfig(row: Record<string, unknown>): TierConfig {
    return {
      tierName: row.tier_name as string,
      displayName: row.display_name as string,
      description: row.description as string,
      isDefault: row.is_default as boolean,
      estimatedMonthlyCost: parseFloat(row.estimated_monthly_cost as string),
      sagemakerShadowSelfInstanceType: row.sagemaker_shadow_self_instance_type as string,
      sagemakerShadowSelfMinInstances: row.sagemaker_shadow_self_min_instances as number,
      sagemakerShadowSelfMaxInstances: row.sagemaker_shadow_self_max_instances as number,
      sagemakerShadowSelfScaleToZero: row.sagemaker_shadow_self_scale_to_zero as boolean,
      sagemakerShadowSelfScaleInCooldown: row.sagemaker_shadow_self_scale_in_cooldown as number,
      sagemakerNliDeployment: row.sagemaker_nli_deployment as string,
      bedrockProvisionedThroughput: row.bedrock_provisioned_throughput as boolean,
      bedrockModelUnits: row.bedrock_model_units as number,
      bedrockDefaultModel: row.bedrock_default_model as string,
      bedrockFallbackModel: row.bedrock_fallback_model as string | null,
      opensearchType: row.opensearch_type as 'provisioned' | 'serverless',
      opensearchInstanceType: row.opensearch_instance_type as string | null,
      opensearchInstanceCount: row.opensearch_instance_count as number | null,
      opensearchEbsVolumeSize: row.opensearch_ebs_volume_size as number | null,
      opensearchMinOcus: row.opensearch_min_ocus as number | null,
      opensearchMaxOcus: row.opensearch_max_ocus as number | null,
      dynamodbBillingMode: row.dynamodb_billing_mode as string,
      dynamodbRegions: row.dynamodb_regions as string[],
      dynamodbGlobalTables: row.dynamodb_global_tables as boolean,
      elasticacheType: row.elasticache_type as 'serverless' | 'provisioned',
      elasticacheNodeType: row.elasticache_node_type as string | null,
      elasticacheNumCacheNodes: row.elasticache_num_cache_nodes as number | null,
      elasticacheMinEcpu: row.elasticache_min_ecpu as number | null,
      elasticacheMaxEcpu: row.elasticache_max_ecpu as number | null,
      elasticacheClusterMode: row.elasticache_cluster_mode as boolean,
      neptuneType: row.neptune_type as 'serverless' | 'provisioned',
      neptuneInstanceClass: row.neptune_instance_class as string | null,
      neptuneInstanceCount: row.neptune_instance_count as number | null,
      neptuneMinCapacity: row.neptune_min_capacity ? parseFloat(row.neptune_min_capacity as string) : null,
      neptuneMaxCapacity: row.neptune_max_capacity ? parseFloat(row.neptune_max_capacity as string) : null,
      kinesisCapacityMode: row.kinesis_capacity_mode as 'ON_DEMAND' | 'PROVISIONED',
      kinesisShardCount: row.kinesis_shard_count as number | null,
      stepFunctionsType: row.step_functions_type as 'STANDARD' | 'EXPRESS',
      budgetMonthlyCuriosityLimit: parseFloat(row.budget_monthly_curiosity_limit as string),
      budgetDailyExplorationCap: parseFloat(row.budget_daily_exploration_cap as string),
      features: (row.features as string[]) || [],
      limitations: (row.limitations as string[]) || []
    };
  }
}

// Export singleton
export const infrastructureTierService = new InfrastructureTierService();
