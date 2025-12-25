# SECTION 10: VISUAL AI PIPELINE (v2.3.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

## 10.1 Pipeline Overview

The Visual AI Pipeline extends RADIANT with 13 new self-hosted AI models for product photography and video post-production workflows.

### New Models Added

| Model | Category | Purpose |
|-------|----------|---------|
| SAM 2 Large | Segmentation | Precise object/subject isolation |
| SAM 2 Base Plus | Segmentation | Balanced speed/quality |
| SAM 2 Small | Segmentation | Fast lightweight segmentation |
| SAM 2 Tiny | Segmentation | Edge deployment |
| XMem | Video | Temporal mask propagation |
| LaMa | Inpainting | Context-aware fill |
| RIFE | Interpolation | Frame rate upscaling |
| Real-ESRGAN 4x | Upscaling | Photo-realistic enhancement |
| Real-ESRGAN Anime | Upscaling | Animation optimization |
| GFPGAN | Face | Face restoration |
| CodeFormer | Face | Face enhancement |
| Background Matting V2 | Matting | Alpha matte extraction |
| MODNet | Matting | Real-time portraits |

## 10.2 Database Schema Extensions

```sql
-- migrations/020_visual_ai_pipeline.sql

-- Model thermal state tracking
ALTER TABLE self_hosted_models ADD COLUMN IF NOT EXISTS thermal_state VARCHAR(20) DEFAULT 'COLD';
ALTER TABLE self_hosted_models ADD COLUMN IF NOT EXISTS warm_until TIMESTAMPTZ;
ALTER TABLE self_hosted_models ADD COLUMN IF NOT EXISTS auto_thermal_enabled BOOLEAN DEFAULT true;

-- Visual pipeline job tracking
CREATE TABLE visual_pipeline_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    pipeline_type VARCHAR(50) NOT NULL,
    source_asset_key VARCHAR(500) NOT NULL,
    output_asset_key VARCHAR(500),
    models_used TEXT[] NOT NULL,
    parameters JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    cost DECIMAL(10, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_visual_jobs_tenant ON visual_pipeline_jobs(tenant_id);
CREATE INDEX idx_visual_jobs_status ON visual_pipeline_jobs(status);

ALTER TABLE visual_pipeline_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY visual_jobs_isolation ON visual_pipeline_jobs USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

## 10.3 Thermal State Service

```typescript
// packages/core/src/services/thermal-state-service.ts

import { Pool } from 'pg';
import { SageMakerClient, DescribeEndpointCommand, UpdateEndpointCommand } from '@aws-sdk/client-sagemaker';

export type ThermalState = 'OFF' | 'COLD' | 'WARM' | 'HOT' | 'AUTOMATIC';
export type ServiceState = 'RUNNING' | 'DEGRADED' | 'DISABLED' | 'OFFLINE';

interface ThermalConfig {
    warmDurationMinutes: number;
    hotThresholdRequestsPerMinute: number;
    coldThresholdIdleMinutes: number;
}

export class ThermalStateService {
    private pool: Pool;
    private sagemaker: SageMakerClient;
    
    constructor(pool: Pool) {
        this.pool = pool;
        this.sagemaker = new SageMakerClient({});
    }
    
    async getThermalState(modelId: string): Promise<ThermalState> {
        const result = await this.pool.query(
            `SELECT thermal_state, warm_until, auto_thermal_enabled FROM self_hosted_models WHERE id = $1`,
            [modelId]
        );
        
        if (result.rows.length === 0) throw new Error('Model not found');
        
        const { thermal_state, warm_until, auto_thermal_enabled } = result.rows[0];
        
        if (auto_thermal_enabled && warm_until && new Date(warm_until) < new Date()) {
            await this.transitionToCold(modelId);
            return 'COLD';
        }
        
        return thermal_state;
    }
    
    async warmUp(modelId: string, durationMinutes: number = 30): Promise<void> {
        const warmUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
        
        await this.pool.query(
            `UPDATE self_hosted_models SET thermal_state = 'WARM', warm_until = $2 WHERE id = $1`,
            [modelId, warmUntil]
        );
        
        // Trigger SageMaker endpoint if needed
        const model = await this.getModel(modelId);
        if (model.endpoint_name) {
            await this.ensureEndpointRunning(model.endpoint_name);
        }
    }
    
    async transitionToCold(modelId: string): Promise<void> {
        await this.pool.query(
            `UPDATE self_hosted_models SET thermal_state = 'COLD', warm_until = NULL WHERE id = $1`,
            [modelId]
        );
    }
    
    private async getModel(modelId: string) {
        const result = await this.pool.query(`SELECT * FROM self_hosted_models WHERE id = $1`, [modelId]);
        return result.rows[0];
    }
    
    private async ensureEndpointRunning(endpointName: string): Promise<void> {
        const command = new DescribeEndpointCommand({ EndpointName: endpointName });
        const response = await this.sagemaker.send(command);
        
        if (response.EndpointStatus !== 'InService') {
            console.log(`Endpoint ${endpointName} status: ${response.EndpointStatus}`);
        }
    }
}
```

## 10.4 Visual Pipeline Handler

```typescript
// packages/lambdas/visual-pipeline/handler.ts

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime';

interface PipelineRequest {
    tenantId: string;
    userId: string;
    pipelineType: 'segment' | 'inpaint' | 'upscale' | 'interpolate' | 'face_restore';
    sourceAssetKey: string;
    parameters: Record<string, any>;
}

export async function handler(event: PipelineRequest) {
    const s3 = new S3Client({});
    const sagemaker = new SageMakerRuntimeClient({});
    
    const pipelineHandlers: Record<string, (input: Buffer, params: any) => Promise<Buffer>> = {
        segment: async (input, params) => {
            const endpoint = params.quality === 'high' ? 'sam2-large' : 'sam2-base';
            return invokeSageMaker(sagemaker, endpoint, input);
        },
        inpaint: async (input, params) => {
            return invokeSageMaker(sagemaker, 'lama-inpaint', input, { mask: params.maskData });
        },
        upscale: async (input, params) => {
            const endpoint = params.style === 'anime' ? 'realesrgan-anime' : 'realesrgan-4x';
            return invokeSageMaker(sagemaker, endpoint, input);
        },
        interpolate: async (input, params) => {
            return invokeSageMaker(sagemaker, 'rife-interpolation', input, { targetFps: params.targetFps });
        },
        face_restore: async (input, params) => {
            const endpoint = params.method === 'codeformer' ? 'codeformer' : 'gfpgan';
            return invokeSageMaker(sagemaker, endpoint, input);
        }
    };
    
    // Get source asset
    const sourceObj = await s3.send(new GetObjectCommand({
        Bucket: process.env.ASSETS_BUCKET!,
        Key: event.sourceAssetKey
    }));
    const inputBuffer = Buffer.from(await sourceObj.Body!.transformToByteArray());
    
    // Process through pipeline
    const handler = pipelineHandlers[event.pipelineType];
    const outputBuffer = await handler(inputBuffer, event.parameters);
    
    // Save result
    const outputKey = `processed/${event.tenantId}/${Date.now()}_${event.pipelineType}.png`;
    await s3.send(new PutObjectCommand({
        Bucket: process.env.ASSETS_BUCKET!,
        Key: outputKey,
        Body: outputBuffer,
        ContentType: 'image/png'
    }));
    
    return { outputAssetKey: outputKey };
}

async function invokeSageMaker(
    client: SageMakerRuntimeClient,
    endpoint: string,
    input: Buffer,
    extraParams?: Record<string, any>
): Promise<Buffer> {
    const payload = {
        image: input.toString('base64'),
        ...extraParams
    };
    
    const response = await client.send(new InvokeEndpointCommand({
        EndpointName: endpoint,
        Body: JSON.stringify(payload),
        ContentType: 'application/json'
    }));
    
    const result = JSON.parse(new TextDecoder().decode(response.Body));
    return Buffer.from(result.output, 'base64');
}
```

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 11: RADIANT BRAIN - SMART ROUTER (v2.4.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

## 11.1 Brain Overview

RADIANT Brain is an intelligent request routing system that selects optimal models based on task analysis, cost constraints, latency requirements, and historical performance.

## 11.2 Brain Database Schema

```sql
-- migrations/021_radiant_brain.sql

CREATE TABLE brain_routing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 100,
    conditions JSONB NOT NULL,
    target_model VARCHAR(100) NOT NULL,
    fallback_models TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE brain_routing_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    task_type VARCHAR(50),
    selected_model VARCHAR(100) NOT NULL,
    selection_reason TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms INTEGER,
    cost DECIMAL(10, 6),
    success BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_brain_history_tenant ON brain_routing_history(tenant_id);
CREATE INDEX idx_brain_history_model ON brain_routing_history(selected_model);

ALTER TABLE brain_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_routing_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY brain_rules_isolation ON brain_routing_rules 
    USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY brain_history_isolation ON brain_routing_history 
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

## 11.3 Brain Router Service

```typescript
// packages/core/src/services/brain-router.ts

import { Pool } from 'pg';

interface RoutingContext {
    tenantId: string;
    userId: string;
    taskType: 'chat' | 'code' | 'analysis' | 'creative' | 'vision' | 'audio';
    inputTokenEstimate: number;
    maxLatencyMs?: number;
    maxCost?: number;
    preferredProvider?: string;
    requiresVision?: boolean;
    requiresAudio?: boolean;
}

interface RoutingResult {
    model: string;
    provider: string;
    reason: string;
    estimatedCost: number;
    estimatedLatencyMs: number;
    confidence: number;
}

export class BrainRouter {
    private pool: Pool;
    private modelPerformanceCache: Map<string, ModelPerformance> = new Map();
    
    constructor(pool: Pool) {
        this.pool = pool;
    }
    
    async route(context: RoutingContext): Promise<RoutingResult> {
        // 1. Check tenant-specific rules first
        const customRule = await this.checkCustomRules(context);
        if (customRule) return customRule;
        
        // 2. Get available models for task type
        const candidates = await this.getCandidateModels(context);
        
        // 3. Score each candidate
        const scored = await Promise.all(
            candidates.map(async (model) => ({
                model,
                score: await this.scoreModel(model, context)
            }))
        );
        
        // 4. Sort by score and return best match
        scored.sort((a, b) => b.score.total - a.score.total);
        const best = scored[0];
        
        return {
            model: best.model.model_id,
            provider: best.model.provider,
            reason: this.formatReason(best.score),
            estimatedCost: best.score.estimatedCost,
            estimatedLatencyMs: best.score.estimatedLatency,
            confidence: best.score.total
        };
    }
    
    private async checkCustomRules(context: RoutingContext): Promise<RoutingResult | null> {
        const result = await this.pool.query(`
            SELECT * FROM brain_routing_rules
            WHERE (tenant_id IS NULL OR tenant_id = $1)
            AND is_active = true
            ORDER BY priority ASC
        `, [context.tenantId]);
        
        for (const rule of result.rows) {
            if (this.matchesConditions(rule.conditions, context)) {
                return {
                    model: rule.target_model,
                    provider: this.getProviderForModel(rule.target_model),
                    reason: `Matched rule: ${rule.name}`,
                    estimatedCost: 0,
                    estimatedLatencyMs: 0,
                    confidence: 1.0
                };
            }
        }
        
        return null;
    }
    
    private async getCandidateModels(context: RoutingContext) {
        const capabilities: string[] = [];
        if (context.requiresVision) capabilities.push('vision');
        if (context.requiresAudio) capabilities.push('audio');
        
        const capabilityFilter = capabilities.length > 0 
            ? `AND capabilities @> $2::jsonb` 
            : '';
        
        const result = await this.pool.query(`
            SELECT * FROM external_models 
            WHERE is_active = true 
            ${capabilityFilter}
            UNION ALL
            SELECT * FROM self_hosted_models 
            WHERE is_active = true
            ${capabilityFilter}
        `, capabilities.length > 0 ? [context.tenantId, JSON.stringify(capabilities)] : [context.tenantId]);
        
        return result.rows;
    }
    
    private async scoreModel(model: any, context: RoutingContext): Promise<ModelScore> {
        const perf = await this.getModelPerformance(model.model_id);
        
        const costScore = this.scoreCost(model, context);
        const latencyScore = this.scoreLatency(perf, context);
        const qualityScore = this.scoreQuality(model, context);
        const reliabilityScore = perf.successRate;
        
        const estimatedCost = this.estimateCost(model, context.inputTokenEstimate);
        const estimatedLatency = perf.avgLatencyMs;
        
        return {
            costScore,
            latencyScore,
            qualityScore,
            reliabilityScore,
            estimatedCost,
            estimatedLatency,
            total: (costScore * 0.25) + (latencyScore * 0.25) + (qualityScore * 0.35) + (reliabilityScore * 0.15)
        };
    }
    
    private scoreCost(model: any, context: RoutingContext): number {
        if (!context.maxCost) return 0.5;
        const estimated = this.estimateCost(model, context.inputTokenEstimate);
        if (estimated > context.maxCost) return 0;
        return 1 - (estimated / context.maxCost);
    }
    
    private scoreLatency(perf: ModelPerformance, context: RoutingContext): number {
        if (!context.maxLatencyMs) return 0.5;
        if (perf.avgLatencyMs > context.maxLatencyMs) return 0;
        return 1 - (perf.avgLatencyMs / context.maxLatencyMs);
    }
    
    private scoreQuality(model: any, context: RoutingContext): number {
        const taskQuality: Record<string, Record<string, number>> = {
            'code': { 'claude-sonnet-4': 0.95, 'gpt-4o': 0.9, 'grok-4': 0.85 },
            'creative': { 'claude-opus-4': 0.95, 'gpt-4o': 0.85, 'gemini-2': 0.8 },
            'analysis': { 'claude-opus-4': 0.95, 'o1': 0.95, 'gemini-2': 0.85 }
        };
        return taskQuality[context.taskType]?.[model.model_id] ?? 0.7;
    }
    
    private estimateCost(model: any, inputTokens: number): number {
        const outputEstimate = inputTokens * 1.5;
        return (inputTokens * model.input_cost_per_1k / 1000) + 
               (outputEstimate * model.output_cost_per_1k / 1000);
    }
    
    private async getModelPerformance(modelId: string): Promise<ModelPerformance> {
        if (this.modelPerformanceCache.has(modelId)) {
            return this.modelPerformanceCache.get(modelId)!;
        }
        
        const result = await this.pool.query(`
            SELECT 
                AVG(latency_ms) as avg_latency,
                COUNT(CASE WHEN success THEN 1 END)::float / COUNT(*)::float as success_rate
            FROM brain_routing_history
            WHERE selected_model = $1
            AND created_at > NOW() - INTERVAL '7 days'
        `, [modelId]);
        
        const perf = {
            avgLatencyMs: result.rows[0]?.avg_latency ?? 1000,
            successRate: result.rows[0]?.success_rate ?? 0.9
        };
        
        this.modelPerformanceCache.set(modelId, perf);
        return perf;
    }
    
    private formatReason(score: ModelScore): string {
        const factors: string[] = [];
        if (score.costScore > 0.8) factors.push('cost-effective');
        if (score.latencyScore > 0.8) factors.push('fast');
        if (score.qualityScore > 0.8) factors.push('high-quality');
        if (score.reliabilityScore > 0.95) factors.push('reliable');
        return factors.join(', ') || 'balanced choice';
    }
    
    private matchesConditions(conditions: any, context: RoutingContext): boolean {
        if (conditions.taskType && conditions.taskType !== context.taskType) return false;
        if (conditions.minTokens && context.inputTokenEstimate < conditions.minTokens) return false;
        if (conditions.maxTokens && context.inputTokenEstimate > conditions.maxTokens) return false;
        return true;
    }
    
    private getProviderForModel(modelId: string): string {
        const providerMap: Record<string, string> = {
            'claude-opus-4': 'anthropic',
            'claude-sonnet-4': 'anthropic',
            'gpt-4o': 'openai',
            'o1': 'openai',
            'gemini-2': 'google',
            'grok-4': 'xai'
        };
        return providerMap[modelId] ?? 'unknown';
    }
}

interface ModelPerformance {
    avgLatencyMs: number;
    successRate: number;
}

interface ModelScore {
    costScore: number;
    latencyScore: number;
    qualityScore: number;
    reliabilityScore: number;
    estimatedCost: number;
    estimatedLatency: number;
    total: number;
}
```

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 12: METRICS & ANALYTICS (v2.5.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

## 12.1 Analytics Database Schema

```sql
-- migrations/022_metrics_analytics.sql

CREATE TABLE usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID REFERENCES users(id),
    metric_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(20, 6) NOT NULL,
    dimensions JSONB DEFAULT '{}',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE aggregated_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    period_type VARCHAR(20) NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    total_requests BIGINT DEFAULT 0,
    total_tokens BIGINT DEFAULT 0,
    total_cost DECIMAL(20, 6) DEFAULT 0,
    avg_latency_ms DECIMAL(10, 2),
    p95_latency_ms DECIMAL(10, 2),
    p99_latency_ms DECIMAL(10, 2),
    error_count INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usage_metrics_tenant_time ON usage_metrics(tenant_id, recorded_at);
CREATE INDEX idx_usage_metrics_type ON usage_metrics(metric_type);
CREATE INDEX idx_aggregated_period ON aggregated_metrics(tenant_id, period_start, period_type);

ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggregated_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_metrics_isolation ON usage_metrics USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY aggregated_metrics_isolation ON aggregated_metrics USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

## 12.2 Metrics Collector Service

```typescript
// packages/core/src/services/metrics-collector.ts

import { Pool } from 'pg';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

interface MetricEvent {
    tenantId: string;
    userId?: string;
    metricType: 'api_request' | 'token_usage' | 'model_inference' | 'billing';
    metricName: string;
    value: number;
    dimensions?: Record<string, string>;
}

export class MetricsCollector {
    private pool: Pool;
    private cloudwatch: CloudWatchClient;
    private buffer: MetricEvent[] = [];
    private flushInterval: NodeJS.Timeout;
    
    constructor(pool: Pool) {
        this.pool = pool;
        this.cloudwatch = new CloudWatchClient({});
        this.flushInterval = setInterval(() => this.flush(), 10000);
    }
    
    record(event: MetricEvent): void {
        this.buffer.push(event);
        
        if (this.buffer.length >= 100) {
            this.flush();
        }
    }
    
    async flush(): Promise<void> {
        if (this.buffer.length === 0) return;
        
        const events = [...this.buffer];
        this.buffer = [];
        
        // Batch insert to PostgreSQL
        const values = events.map((e, i) => 
            `($${i*6+1}, $${i*6+2}, $${i*6+3}, $${i*6+4}, $${i*6+5}, $${i*6+6})`
        ).join(', ');
        
        const params = events.flatMap(e => [
            e.tenantId, e.userId, e.metricType, e.metricName, e.value, JSON.stringify(e.dimensions || {})
        ]);
        
        await this.pool.query(`
            INSERT INTO usage_metrics (tenant_id, user_id, metric_type, metric_name, metric_value, dimensions)
            VALUES ${values}
        `, params);
        
        // Send to CloudWatch
        await this.sendToCloudWatch(events);
    }
    
    private async sendToCloudWatch(events: MetricEvent[]): Promise<void> {
        const metricData = events.map(e => ({
            MetricName: e.metricName,
            Dimensions: [
                { Name: 'TenantId', Value: e.tenantId },
                { Name: 'MetricType', Value: e.metricType }
            ],
            Value: e.value,
            Timestamp: new Date(),
            Unit: this.getUnit(e.metricName)
        }));
        
        // CloudWatch accepts max 20 metrics per call
        for (let i = 0; i < metricData.length; i += 20) {
            await this.cloudwatch.send(new PutMetricDataCommand({
                Namespace: 'RADIANT',
                MetricData: metricData.slice(i, i + 20)
            }));
        }
    }
    
    private getUnit(metricName: string): string {
        if (metricName.includes('latency')) return 'Milliseconds';
        if (metricName.includes('cost')) return 'None';
        if (metricName.includes('tokens')) return 'Count';
        return 'Count';
    }
    
    async getAggregatedMetrics(
        tenantId: string, 
        periodType: 'hourly' | 'daily' | 'weekly' | 'monthly',
        startDate: Date,
        endDate: Date
    ) {
        const result = await this.pool.query(`
            SELECT * FROM aggregated_metrics
            WHERE tenant_id = $1
            AND period_type = $2
            AND period_start >= $3
            AND period_end <= $4
            ORDER BY period_start
        `, [tenantId, periodType, startDate, endDate]);
        
        return result.rows;
    }
}
```

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 13: USER NEURAL ENGINE (v3.0.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

## 13.1 Neural Engine Overview

The User Neural Engine provides personalized AI experiences through learned preferences, conversation memory with embeddings, and adaptive behavior patterns.

## 13.2 Neural Engine Database Schema

```sql
-- migrations/023_user_neural_engine.sql

-- Enable pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    preference_key VARCHAR(100) NOT NULL,
    preference_value JSONB NOT NULL,
    confidence DECIMAL(3, 2) DEFAULT 0.5,
    learned_from TEXT[],
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, user_id, preference_key)
);

CREATE TABLE user_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    memory_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    importance DECIMAL(3, 2) DEFAULT 0.5,
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_behavior_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    pattern_type VARCHAR(50) NOT NULL,
    pattern_data JSONB NOT NULL,
    occurrence_count INTEGER DEFAULT 1,
    last_occurred TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_memory_embedding ON user_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_user_preferences_user ON user_preferences(tenant_id, user_id);
CREATE INDEX idx_user_patterns_user ON user_behavior_patterns(tenant_id, user_id);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_behavior_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_preferences_isolation ON user_preferences USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY user_memory_isolation ON user_memory USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY user_patterns_isolation ON user_behavior_patterns USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

## 13.3 Neural Engine Service

```typescript
// packages/core/src/services/neural-engine.ts

import { Pool } from 'pg';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

export class NeuralEngine {
    private pool: Pool;
    private bedrock: BedrockRuntimeClient;
    
    constructor(pool: Pool) {
        this.pool = pool;
        this.bedrock = new BedrockRuntimeClient({});
    }
    
    async learnFromConversation(
        tenantId: string,
        userId: string,
        messages: { role: string; content: string }[]
    ): Promise<void> {
        // Extract preferences
        const preferences = await this.extractPreferences(messages);
        for (const pref of preferences) {
            await this.updatePreference(tenantId, userId, pref.key, pref.value, pref.confidence);
        }
        
        // Store important memories
        const memories = await this.extractMemories(messages);
        for (const memory of memories) {
            await this.storeMemory(tenantId, userId, memory);
        }
        
        // Update behavior patterns
        await this.updateBehaviorPatterns(tenantId, userId, messages);
    }
    
    async getRelevantMemories(
        tenantId: string,
        userId: string,
        query: string,
        limit: number = 5
    ): Promise<any[]> {
        const embedding = await this.generateEmbedding(query);
        
        const result = await this.pool.query(`
            SELECT content, importance, memory_type,
                   1 - (embedding <=> $4::vector) as similarity
            FROM user_memory
            WHERE tenant_id = $1 AND user_id = $2
            AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY embedding <=> $4::vector
            LIMIT $3
        `, [tenantId, userId, limit, `[${embedding.join(',')}]`]);
        
        // Update access counts
        for (const row of result.rows) {
            await this.pool.query(`
                UPDATE user_memory SET access_count = access_count + 1, last_accessed = NOW()
                WHERE id = $1
            `, [row.id]);
        }
        
        return result.rows;
    }
    
    async getPreferences(tenantId: string, userId: string): Promise<Record<string, any>> {
        const result = await this.pool.query(`
            SELECT preference_key, preference_value, confidence
            FROM user_preferences
            WHERE tenant_id = $1 AND user_id = $2
            ORDER BY confidence DESC
        `, [tenantId, userId]);
        
        const prefs: Record<string, any> = {};
        for (const row of result.rows) {
            prefs[row.preference_key] = {
                value: row.preference_value,
                confidence: row.confidence
            };
        }
        return prefs;
    }
    
    private async generateEmbedding(text: string): Promise<number[]> {
        const response = await this.bedrock.send(new InvokeModelCommand({
            modelId: 'amazon.titan-embed-text-v1',
            body: JSON.stringify({ inputText: text }),
            contentType: 'application/json'
        }));
        
        const result = JSON.parse(new TextDecoder().decode(response.body));
        return result.embedding;
    }
    
    private async extractPreferences(messages: any[]): Promise<any[]> {
        const conversationText = messages.map(m => `${m.role}: ${m.content}`).join('\n');
        
        const response = await this.bedrock.send(new InvokeModelCommand({
            modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 1024,
                messages: [{
                    role: 'user',
                    content: `Extract user preferences from this conversation. Return JSON array with objects containing key, value, and confidence (0-1):
                    
${conversationText}

Return only valid JSON array.`
                }]
            }),
            contentType: 'application/json'
        }));
        
        const result = JSON.parse(new TextDecoder().decode(response.body));
        try {
            return JSON.parse(result.content[0].text);
        } catch {
            return [];
        }
    }
    
    private async extractMemories(messages: any[]): Promise<any[]> {
        // Similar extraction for important facts/memories
        return [];
    }
    
    private async updatePreference(
        tenantId: string,
        userId: string,
        key: string,
        value: any,
        confidence: number
    ): Promise<void> {
        await this.pool.query(`
            INSERT INTO user_preferences (tenant_id, user_id, preference_key, preference_value, confidence)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (tenant_id, user_id, preference_key)
            DO UPDATE SET 
                preference_value = EXCLUDED.preference_value,
                confidence = GREATEST(user_preferences.confidence, EXCLUDED.confidence),
                updated_at = NOW()
        `, [tenantId, userId, key, JSON.stringify(value), confidence]);
    }
    
    private async storeMemory(tenantId: string, userId: string, memory: any): Promise<void> {
        const embedding = await this.generateEmbedding(memory.content);
        
        await this.pool.query(`
            INSERT INTO user_memory (tenant_id, user_id, memory_type, content, embedding, importance)
            VALUES ($1, $2, $3, $4, $5::vector, $6)
        `, [tenantId, userId, memory.type, memory.content, `[${embedding.join(',')}]`, memory.importance]);
    }
    
    private async updateBehaviorPatterns(
        tenantId: string,
        userId: string,
        messages: any[]
    ): Promise<void> {
        // Pattern detection logic
    }
}
```

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 14: CENTRALIZED ERROR LOGGING (v3.1.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

## 14.1 Error Logging Database Schema

```sql
-- migrations/024_centralized_error_logging.sql

CREATE TABLE error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    user_id UUID REFERENCES users(id),
    error_code VARCHAR(50) NOT NULL,
    error_type VARCHAR(50) NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    request_id VARCHAR(100),
    source_service VARCHAR(100),
    source_function VARCHAR(200),
    context JSONB DEFAULT '{}',
    severity VARCHAR(20) NOT NULL DEFAULT 'error',
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE error_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_name VARCHAR(100) NOT NULL,
    error_code_pattern VARCHAR(100),
    message_pattern TEXT,
    occurrence_count INTEGER DEFAULT 1,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    auto_resolve_enabled BOOLEAN DEFAULT false,
    auto_resolve_action JSONB
);

CREATE INDEX idx_error_logs_tenant ON error_logs(tenant_id, created_at DESC);
CREATE INDEX idx_error_logs_code ON error_logs(error_code);
CREATE INDEX idx_error_logs_unresolved ON error_logs(resolved) WHERE resolved = false;

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Allow admins to see all errors, users only their own
CREATE POLICY error_logs_policy ON error_logs USING (
    tenant_id = current_setting('app.current_tenant_id')::UUID OR
    current_setting('app.user_role') = 'admin'
);
```

## 14.2 Error Logger Service

```typescript
// packages/core/src/services/error-logger.ts

import { Pool } from 'pg';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

interface ErrorContext {
    tenantId?: string;
    userId?: string;
    requestId?: string;
    sourceService: string;
    sourceFunction: string;
    additionalContext?: Record<string, any>;
}

type ErrorSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

export class ErrorLogger {
    private pool: Pool;
    private sns: SNSClient;
    private alertTopicArn: string;
    
    constructor(pool: Pool, alertTopicArn: string) {
        this.pool = pool;
        this.sns = new SNSClient({});
        this.alertTopicArn = alertTopicArn;
    }
    
    async log(
        error: Error,
        context: ErrorContext,
        severity: ErrorSeverity = 'error'
    ): Promise<string> {
        const errorCode = this.extractErrorCode(error);
        const errorType = error.constructor.name;
        
        const result = await this.pool.query(`
            INSERT INTO error_logs (
                tenant_id, user_id, error_code, error_type, error_message,
                stack_trace, request_id, source_service, source_function,
                context, severity
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id
        `, [
            context.tenantId,
            context.userId,
            errorCode,
            errorType,
            error.message,
            error.stack,
            context.requestId,
            context.sourceService,
            context.sourceFunction,
            JSON.stringify(context.additionalContext || {}),
            severity
        ]);
        
        const errorId = result.rows[0].id;
        
        // Check for patterns and auto-resolve
        await this.checkPatterns(errorCode, error.message);
        
        // Send alerts for critical errors
        if (severity === 'critical') {
            await this.sendAlert(errorId, error, context);
        }
        
        return errorId;
    }
    
    async getUnresolvedErrors(
        tenantId?: string,
        limit: number = 50
    ): Promise<any[]> {
        const whereClause = tenantId ? 'AND tenant_id = $2' : '';
        const params = tenantId ? [limit, tenantId] : [limit];
        
        const result = await this.pool.query(`
            SELECT * FROM error_logs
            WHERE resolved = false ${whereClause}
            ORDER BY 
                CASE severity 
                    WHEN 'critical' THEN 1 
                    WHEN 'error' THEN 2 
                    WHEN 'warning' THEN 3 
                    ELSE 4 
                END,
                created_at DESC
            LIMIT $1
        `, params);
        
        return result.rows;
    }
    
    async resolve(
        errorId: string,
        resolvedBy: string,
        notes: string
    ): Promise<void> {
        await this.pool.query(`
            UPDATE error_logs
            SET resolved = true, resolved_at = NOW(), resolved_by = $2, resolution_notes = $3
            WHERE id = $1
        `, [errorId, resolvedBy, notes]);
    }
    
    private extractErrorCode(error: Error): string {
        if ('code' in error) return String((error as any).code);
        if (error.message.includes('ECONNREFUSED')) return 'CONN_REFUSED';
        if (error.message.includes('timeout')) return 'TIMEOUT';
        if (error.message.includes('rate limit')) return 'RATE_LIMIT';
        return 'UNKNOWN';
    }
    
    private async checkPatterns(errorCode: string, message: string): Promise<void> {
        await this.pool.query(`
            INSERT INTO error_patterns (pattern_name, error_code_pattern, message_pattern)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
        `, [`pattern_${errorCode}`, errorCode, message.substring(0, 100)]);
        
        await this.pool.query(`
            UPDATE error_patterns
            SET occurrence_count = occurrence_count + 1, last_seen = NOW()
            WHERE error_code_pattern = $1
        `, [errorCode]);
    }
    
    private async sendAlert(errorId: string, error: Error, context: ErrorContext): Promise<void> {
        await this.sns.send(new PublishCommand({
            TopicArn: this.alertTopicArn,
            Subject: `[RADIANT CRITICAL] ${error.message.substring(0, 50)}`,
            Message: JSON.stringify({
                errorId,
                message: error.message,
                service: context.sourceService,
                function: context.sourceFunction,
                tenantId: context.tenantId,
                timestamp: new Date().toISOString()
            })
        }));
    }
}
```

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 15: EXTERNAL CREDENTIALS REGISTRY (v3.2.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

## 15.1 Credentials Registry Overview

Secure storage and management of external API credentials with encryption, rotation, and access auditing.

## 15.2 Credentials Database Schema

```sql
-- migrations/025_credentials_registry.sql

CREATE TABLE credential_vaults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    vault_name VARCHAR(100) NOT NULL,
    description TEXT,
    encryption_key_arn VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, vault_name)
);

CREATE TABLE stored_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID NOT NULL REFERENCES credential_vaults(id) ON DELETE CASCADE,
    credential_name VARCHAR(100) NOT NULL,
    credential_type VARCHAR(50) NOT NULL,
    encrypted_value BYTEA NOT NULL,
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    last_rotated TIMESTAMPTZ,
    rotation_schedule VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE credential_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id UUID NOT NULL REFERENCES stored_credentials(id),
    accessed_by UUID REFERENCES users(id),
    access_type VARCHAR(50) NOT NULL,
    access_reason TEXT,
    source_ip VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_credentials_vault ON stored_credentials(vault_id);
CREATE INDEX idx_credential_access_log ON credential_access_log(credential_id, created_at DESC);

ALTER TABLE credential_vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE stored_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY vault_isolation ON credential_vaults USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY credentials_isolation ON stored_credentials USING (
    vault_id IN (SELECT id FROM credential_vaults WHERE tenant_id = current_setting('app.current_tenant_id')::UUID)
);
CREATE POLICY access_log_isolation ON credential_access_log USING (
    credential_id IN (
        SELECT sc.id FROM stored_credentials sc
        JOIN credential_vaults cv ON sc.vault_id = cv.id
        WHERE cv.tenant_id = current_setting('app.current_tenant_id')::UUID
    )
);
```

## 15.3 Credentials Manager Service

```typescript
// packages/core/src/services/credentials-manager.ts

import { Pool } from 'pg';
import { KMSClient, EncryptCommand, DecryptCommand, GenerateDataKeyCommand } from '@aws-sdk/client-kms';
import { SecretsManagerClient, GetSecretValueCommand, UpdateSecretCommand } from '@aws-sdk/client-secrets-manager';

export class CredentialsManager {
    private pool: Pool;
    private kms: KMSClient;
    private secrets: SecretsManagerClient;
    
    constructor(pool: Pool) {
        this.pool = pool;
        this.kms = new KMSClient({});
        this.secrets = new SecretsManagerClient({});
    }
    
    async createVault(
        tenantId: string,
        vaultName: string,
        description?: string
    ): Promise<string> {
        const keyArn = await this.createKmsKey(tenantId, vaultName);
        
        const result = await this.pool.query(`
            INSERT INTO credential_vaults (tenant_id, vault_name, description, encryption_key_arn)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `, [tenantId, vaultName, description, keyArn]);
        
        return result.rows[0].id;
    }
    
    async storeCredential(
        vaultId: string,
        name: string,
        type: string,
        value: string,
        metadata?: Record<string, any>,
        createdBy?: string
    ): Promise<string> {
        const vault = await this.getVault(vaultId);
        const encrypted = await this.encrypt(value, vault.encryption_key_arn);
        
        const result = await this.pool.query(`
            INSERT INTO stored_credentials (vault_id, credential_name, credential_type, encrypted_value, metadata, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `, [vaultId, name, type, encrypted, JSON.stringify(metadata || {}), createdBy]);
        
        return result.rows[0].id;
    }
    
    async getCredential(
        credentialId: string,
        accessedBy: string,
        accessReason: string,
        sourceIp?: string
    ): Promise<string> {
        const cred = await this.pool.query(`
            SELECT sc.*, cv.encryption_key_arn
            FROM stored_credentials sc
            JOIN credential_vaults cv ON sc.vault_id = cv.id
            WHERE sc.id = $1 AND sc.is_active = true
        `, [credentialId]);
        
        if (cred.rows.length === 0) {
            await this.logAccess(credentialId, accessedBy, 'read', accessReason, sourceIp, false);
            throw new Error('Credential not found or inactive');
        }
        
        const { encrypted_value, encryption_key_arn } = cred.rows[0];
        const decrypted = await this.decrypt(encrypted_value, encryption_key_arn);
        
        await this.logAccess(credentialId, accessedBy, 'read', accessReason, sourceIp, true);
        
        return decrypted;
    }
    
    async rotateCredential(
        credentialId: string,
        newValue: string,
        rotatedBy: string
    ): Promise<void> {
        const cred = await this.pool.query(`
            SELECT sc.*, cv.encryption_key_arn
            FROM stored_credentials sc
            JOIN credential_vaults cv ON sc.vault_id = cv.id
            WHERE sc.id = $1
        `, [credentialId]);
        
        if (cred.rows.length === 0) throw new Error('Credential not found');
        
        const encrypted = await this.encrypt(newValue, cred.rows[0].encryption_key_arn);
        
        await this.pool.query(`
            UPDATE stored_credentials
            SET encrypted_value = $2, last_rotated = NOW(), updated_at = NOW()
            WHERE id = $1
        `, [credentialId, encrypted]);
        
        await this.logAccess(credentialId, rotatedBy, 'rotate', 'Credential rotation', null, true);
    }
    
    private async encrypt(plaintext: string, keyArn: string): Promise<Buffer> {
        const response = await this.kms.send(new EncryptCommand({
            KeyId: keyArn,
            Plaintext: Buffer.from(plaintext)
        }));
        return Buffer.from(response.CiphertextBlob!);
    }
    
    private async decrypt(ciphertext: Buffer, keyArn: string): Promise<string> {
        const response = await this.kms.send(new DecryptCommand({
            KeyId: keyArn,
            CiphertextBlob: ciphertext
        }));
        return Buffer.from(response.Plaintext!).toString();
    }
    
    private async createKmsKey(tenantId: string, vaultName: string): Promise<string> {
        // In production, create a new KMS key
        return `arn:aws:kms:us-east-1:${process.env.AWS_ACCOUNT_ID}:key/${tenantId}-${vaultName}`;
    }
    
    private async getVault(vaultId: string) {
        const result = await this.pool.query(`SELECT * FROM credential_vaults WHERE id = $1`, [vaultId]);
        if (result.rows.length === 0) throw new Error('Vault not found');
        return result.rows[0];
    }
    
    private async logAccess(
        credentialId: string,
        accessedBy: string,
        accessType: string,
        reason: string,
        sourceIp: string | null,
        success: boolean
    ): Promise<void> {
        await this.pool.query(`
            INSERT INTO credential_access_log (credential_id, accessed_by, access_type, access_reason, source_ip, success)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [credentialId, accessedBy, accessType, reason, sourceIp, success]);
    }
}
```

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 16: AWS ADMIN CREDENTIALS (v3.2.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

## 16.1 AWS Admin Integration

Admin-level AWS credential management for deployment operations.

```typescript
// packages/core/src/services/aws-admin-credentials.ts

import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { IAMClient, CreateAccessKeyCommand, DeleteAccessKeyCommand, ListAccessKeysCommand } from '@aws-sdk/client-iam';

interface AssumedCredentials {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    expiration: Date;
}

export class AwsAdminCredentials {
    private sts: STSClient;
    private iam: IAMClient;
    
    constructor() {
        this.sts = new STSClient({});
        this.iam = new IAMClient({});
    }
    
    async assumeDeploymentRole(
        roleArn: string,
        sessionName: string,
        durationSeconds: number = 3600
    ): Promise<AssumedCredentials> {
        const response = await this.sts.send(new AssumeRoleCommand({
            RoleArn: roleArn,
            RoleSessionName: sessionName,
            DurationSeconds: durationSeconds
        }));
        
        if (!response.Credentials) {
            throw new Error('Failed to assume role');
        }
        
        return {
            accessKeyId: response.Credentials.AccessKeyId!,
            secretAccessKey: response.Credentials.SecretAccessKey!,
            sessionToken: response.Credentials.SessionToken!,
            expiration: response.Credentials.Expiration!
        };
    }
    
    async validateCredentials(): Promise<{ accountId: string; arn: string }> {
        const response = await this.sts.send(new GetCallerIdentityCommand({}));
        return {
            accountId: response.Account!,
            arn: response.Arn!
        };
    }
    
    async rotateAccessKeys(userName: string): Promise<{ accessKeyId: string; secretAccessKey: string }> {
        // List existing keys
        const listResponse = await this.iam.send(new ListAccessKeysCommand({ UserName: userName }));
        
        // Create new key
        const createResponse = await this.iam.send(new CreateAccessKeyCommand({ UserName: userName }));
        
        // Delete old keys (keep only the new one)
        for (const key of listResponse.AccessKeyMetadata || []) {
            if (key.AccessKeyId !== createResponse.AccessKey?.AccessKeyId) {
                await this.iam.send(new DeleteAccessKeyCommand({
                    UserName: userName,
                    AccessKeyId: key.AccessKeyId
                }));
            }
        }
        
        return {
            accessKeyId: createResponse.AccessKey!.AccessKeyId!,
            secretAccessKey: createResponse.AccessKey!.SecretAccessKey!
        };
    }
}
```

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 17: SIMPLE AUTO-RESOLVE API (v3.3.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

## 17.1 Auto-Resolve Overview

Intelligent model selection API that automatically picks the best model based on the request.

## 17.2 Auto-Resolve Database Schema

```sql
-- migrations/026_auto_resolve.sql

CREATE TABLE auto_resolve_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    request_type VARCHAR(50) NOT NULL,
    selected_model VARCHAR(100) NOT NULL,
    selection_reason TEXT,
    user_preferences JSONB DEFAULT '{}',
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost DECIMAL(10, 6),
    latency_ms INTEGER,
    success BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_auto_resolve_tenant ON auto_resolve_requests(tenant_id, created_at DESC);
CREATE INDEX idx_auto_resolve_model ON auto_resolve_requests(selected_model);

ALTER TABLE auto_resolve_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY auto_resolve_isolation ON auto_resolve_requests USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

## 17.3 Auto-Resolve Service

```typescript
// packages/core/src/services/auto-resolve.ts

import { Pool } from 'pg';
import { BrainRouter } from './brain-router';

interface AutoResolveRequest {
    tenantId: string;
    userId: string;
    prompt: string;
    preferences?: {
        maxCost?: number;
        maxLatencyMs?: number;
        preferredProvider?: string;
        qualityLevel?: 'economy' | 'balanced' | 'premium';
    };
}

interface AutoResolveResult {
    model: string;
    provider: string;
    reason: string;
    estimatedCost: number;
}

export class AutoResolveService {
    private pool: Pool;
    private router: BrainRouter;
    
    constructor(pool: Pool) {
        this.pool = pool;
        this.router = new BrainRouter(pool);
    }
    
    async resolve(request: AutoResolveRequest): Promise<AutoResolveResult> {
        // Analyze the prompt
        const analysis = this.analyzePrompt(request.prompt);
        
        // Get routing result
        const routing = await this.router.route({
            tenantId: request.tenantId,
            userId: request.userId,
            taskType: analysis.taskType,
            inputTokenEstimate: analysis.tokenEstimate,
            maxLatencyMs: request.preferences?.maxLatencyMs,
            maxCost: request.preferences?.maxCost,
            preferredProvider: request.preferences?.preferredProvider,
            requiresVision: analysis.requiresVision,
            requiresAudio: analysis.requiresAudio
        });
        
        // Log the request
        await this.pool.query(`
            INSERT INTO auto_resolve_requests (tenant_id, user_id, request_type, selected_model, selection_reason, user_preferences)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            request.tenantId,
            request.userId,
            analysis.taskType,
            routing.model,
            routing.reason,
            JSON.stringify(request.preferences || {})
        ]);
        
        return {
            model: routing.model,
            provider: routing.provider,
            reason: routing.reason,
            estimatedCost: routing.estimatedCost
        };
    }
    
    private analyzePrompt(prompt: string): {
        taskType: 'chat' | 'code' | 'analysis' | 'creative' | 'vision' | 'audio';
        tokenEstimate: number;
        requiresVision: boolean;
        requiresAudio: boolean;
    } {
        const lowerPrompt = prompt.toLowerCase();
        
        let taskType: 'chat' | 'code' | 'analysis' | 'creative' | 'vision' | 'audio' = 'chat';
        
        if (lowerPrompt.includes('code') || lowerPrompt.includes('function') || lowerPrompt.includes('debug')) {
            taskType = 'code';
        } else if (lowerPrompt.includes('analyze') || lowerPrompt.includes('data') || lowerPrompt.includes('statistics')) {
            taskType = 'analysis';
        } else if (lowerPrompt.includes('write') || lowerPrompt.includes('story') || lowerPrompt.includes('creative')) {
            taskType = 'creative';
        }
        
        return {
            taskType,
            tokenEstimate: Math.ceil(prompt.length / 4),
            requiresVision: lowerPrompt.includes('image') || lowerPrompt.includes('picture'),
            requiresAudio: lowerPrompt.includes('audio') || lowerPrompt.includes('speech')
        };
    }
}
```

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 18: THINK TANK CONSUMER PLATFORM (v3.5.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

## 18.1 Think Tank Overview

Complex problem decomposition and multi-step reasoning with chain-of-thought processing.

## 18.2 Think Tank Database Schema

```sql
-- migrations/027_think_tank.sql

CREATE TABLE thinktank_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    problem_summary TEXT,
    domain VARCHAR(50),
    complexity VARCHAR(20),
    total_steps INTEGER DEFAULT 0,
    avg_confidence DECIMAL(3, 2),
    solution_found BOOLEAN DEFAULT false,
    total_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 6) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ
);

CREATE TABLE thinktank_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES thinktank_sessions(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_type VARCHAR(50) NOT NULL,
    description TEXT,
    reasoning TEXT,
    result TEXT,
    confidence DECIMAL(3, 2),
    model_used VARCHAR(100),
    tokens_used INTEGER,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE thinktank_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_name VARCHAR(100) NOT NULL UNIQUE,
    tool_type VARCHAR(50) NOT NULL,
    description TEXT,
    parameters_schema JSONB NOT NULL,
    implementation TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_thinktank_sessions_tenant ON thinktank_sessions(tenant_id, created_at DESC);
CREATE INDEX idx_thinktank_steps_session ON thinktank_steps(session_id, step_number);

ALTER TABLE thinktank_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE thinktank_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY thinktank_sessions_isolation ON thinktank_sessions USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY thinktank_steps_isolation ON thinktank_steps USING (
    session_id IN (SELECT id FROM thinktank_sessions WHERE tenant_id = current_setting('app.current_tenant_id')::UUID)
);
```

## 18.3 Think Tank Engine Service

```typescript
// packages/core/src/services/thinktank-engine.ts

import { Pool } from 'pg';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

interface ThinkTankProblem {
    tenantId: string;
    userId: string;
    problem: string;
    domain?: string;
    maxSteps?: number;
    tools?: string[];
}

interface ThinkTankStep {
    stepNumber: number;
    type: 'decompose' | 'reason' | 'execute' | 'verify' | 'synthesize';
    description: string;
    reasoning: string;
    result: string;
    confidence: number;
}

interface ThinkTankResult {
    sessionId: string;
    solution: string;
    steps: ThinkTankStep[];
    confidence: number;
    totalTokens: number;
    totalCost: number;
}

export class ThinkTankEngine {
    private pool: Pool;
    private bedrock: BedrockRuntimeClient;
    
    constructor(pool: Pool) {
        this.pool = pool;
        this.bedrock = new BedrockRuntimeClient({});
    }
    
    async solve(problem: ThinkTankProblem): Promise<ThinkTankResult> {
        // Create session
        const sessionResult = await this.pool.query(`
            INSERT INTO thinktank_sessions (tenant_id, user_id, problem_summary, domain)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `, [problem.tenantId, problem.userId, problem.problem.substring(0, 500), problem.domain]);
        
        const sessionId = sessionResult.rows[0].id;
        const steps: ThinkTankStep[] = [];
        let totalTokens = 0;
        let totalCost = 0;
        
        // Step 1: Decompose problem
        const decomposition = await this.decomposeProblem(problem.problem);
        steps.push(await this.recordStep(sessionId, 1, 'decompose', decomposition));
        totalTokens += decomposition.tokens;
        
        // Step 2-N: Solve each sub-problem
        for (let i = 0; i < decomposition.subProblems.length && i < (problem.maxSteps || 10); i++) {
            const subProblem = decomposition.subProblems[i];
            
            // Reason about approach
            const reasoning = await this.reason(subProblem, steps);
            steps.push(await this.recordStep(sessionId, steps.length + 1, 'reason', reasoning));
            totalTokens += reasoning.tokens;
            
            // Execute solution
            const execution = await this.execute(subProblem, reasoning.approach, problem.tools);
            steps.push(await this.recordStep(sessionId, steps.length + 1, 'execute', execution));
            totalTokens += execution.tokens;
        }
        
        // Final step: Synthesize solution
        const synthesis = await this.synthesize(problem.problem, steps);
        steps.push(await this.recordStep(sessionId, steps.length + 1, 'synthesize', synthesis));
        totalTokens += synthesis.tokens;
        
        // Calculate cost and update session
        totalCost = totalTokens * 0.00001; // Simplified cost calculation
        const avgConfidence = steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length;
        
        await this.pool.query(`
            UPDATE thinktank_sessions
            SET total_steps = $2, avg_confidence = $3, solution_found = true,
                total_tokens = $4, total_cost = $5, completed_at = NOW()
            WHERE id = $1
        `, [sessionId, steps.length, avgConfidence, totalTokens, totalCost]);
        
        return {
            sessionId,
            solution: synthesis.result,
            steps,
            confidence: avgConfidence,
            totalTokens,
            totalCost
        };
    }
    
    private async decomposeProblem(problem: string): Promise<any> {
        const response = await this.invokeModel(`
            Decompose this problem into smaller sub-problems:
            
            Problem: ${problem}
            
            Return JSON: { "subProblems": ["sub1", "sub2", ...], "complexity": "low|medium|high" }
        `);
        
        return {
            subProblems: response.subProblems || [problem],
            complexity: response.complexity || 'medium',
            tokens: response.tokens,
            description: 'Problem decomposition',
            reasoning: `Identified ${response.subProblems?.length || 1} sub-problems`,
            result: JSON.stringify(response.subProblems),
            confidence: 0.9
        };
    }
    
    private async reason(subProblem: string, previousSteps: ThinkTankStep[]): Promise<any> {
        const context = previousSteps.map(s => s.result).join('\n');
        
        const response = await this.invokeModel(`
            Given context:
            ${context}
            
            Reason about how to solve: ${subProblem}
            
            Return JSON: { "approach": "description", "confidence": 0.0-1.0 }
        `);
        
        return {
            approach: response.approach,
            tokens: response.tokens,
            description: `Reasoning about: ${subProblem.substring(0, 50)}`,
            reasoning: response.approach,
            result: response.approach,
            confidence: response.confidence || 0.8
        };
    }
    
    private async execute(subProblem: string, approach: string, tools?: string[]): Promise<any> {
        const response = await this.invokeModel(`
            Execute this approach to solve the sub-problem:
            
            Sub-problem: ${subProblem}
            Approach: ${approach}
            Available tools: ${tools?.join(', ') || 'none'}
            
            Return JSON: { "result": "solution", "confidence": 0.0-1.0 }
        `);
        
        return {
            tokens: response.tokens,
            description: 'Executing solution',
            reasoning: approach,
            result: response.result,
            confidence: response.confidence || 0.8
        };
    }
    
    private async synthesize(originalProblem: string, steps: ThinkTankStep[]): Promise<any> {
        const stepResults = steps.map(s => s.result).join('\n');
        
        const response = await this.invokeModel(`
            Synthesize a final solution from these steps:
            
            Original problem: ${originalProblem}
            
            Step results:
            ${stepResults}
            
            Return JSON: { "solution": "complete solution", "confidence": 0.0-1.0 }
        `);
        
        return {
            tokens: response.tokens,
            description: 'Synthesizing final solution',
            reasoning: 'Combining all step results',
            result: response.solution,
            confidence: response.confidence || 0.85
        };
    }
    
    private async invokeModel(prompt: string): Promise<any> {
        const response = await this.bedrock.send(new InvokeModelCommand({
            modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 2048,
                messages: [{ role: 'user', content: prompt }]
            }),
            contentType: 'application/json'
        }));
        
        const result = JSON.parse(new TextDecoder().decode(response.body));
        const text = result.content[0].text;
        
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { result: text };
            return { ...parsed, tokens: result.usage?.output_tokens || 100 };
        } catch {
            return { result: text, tokens: result.usage?.output_tokens || 100 };
        }
    }
    
    private async recordStep(
        sessionId: string,
        stepNumber: number,
        stepType: string,
        data: any
    ): Promise<ThinkTankStep> {
        await this.pool.query(`
            INSERT INTO thinktank_steps (session_id, step_number, step_type, description, reasoning, result, confidence, tokens_used)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [sessionId, stepNumber, stepType, data.description, data.reasoning, data.result, data.confidence, data.tokens]);
        
        return {
            stepNumber,
            type: stepType as any,
            description: data.description,
            reasoning: data.reasoning,
            result: data.result,
            confidence: data.confidence
        };
    }
}
```

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 19: CONCURRENT CHAT & SPLIT-PANE UI (v3.6.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

## 19.1 Concurrent Chat Overview

Industry-first feature allowing users to run multiple AI conversations simultaneously with split-pane interface.

## 19.2 Concurrent Chat Database Schema

```sql
-- migrations/028_concurrent_chat.sql

CREATE TABLE concurrent_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    session_name VARCHAR(100),
    layout_config JSONB NOT NULL DEFAULT '{"type": "horizontal", "panes": []}',
    max_panes INTEGER DEFAULT 4,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE concurrent_panes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES concurrent_sessions(id) ON DELETE CASCADE,
    pane_index INTEGER NOT NULL,
    chat_id UUID REFERENCES chats(id),
    model VARCHAR(100),
    status VARCHAR(20) DEFAULT 'idle',
    last_activity TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, pane_index)
);

CREATE TABLE concurrent_sync_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES concurrent_sessions(id) ON DELETE CASCADE,
    sync_mode VARCHAR(20) NOT NULL DEFAULT 'independent',
    shared_context TEXT,
    sync_cursor INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_concurrent_sessions_user ON concurrent_sessions(tenant_id, user_id);
CREATE INDEX idx_concurrent_panes_session ON concurrent_panes(session_id);

ALTER TABLE concurrent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE concurrent_panes ENABLE ROW LEVEL SECURITY;
ALTER TABLE concurrent_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY concurrent_sessions_isolation ON concurrent_sessions USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY concurrent_panes_isolation ON concurrent_panes USING (
    session_id IN (SELECT id FROM concurrent_sessions WHERE tenant_id = current_setting('app.current_tenant_id')::UUID)
);
CREATE POLICY concurrent_sync_isolation ON concurrent_sync_state USING (
    session_id IN (SELECT id FROM concurrent_sessions WHERE tenant_id = current_setting('app.current_tenant_id')::UUID)
);
```

## 19.3 Concurrent Session Manager

```typescript
// packages/core/src/services/concurrent-session-manager.ts

import { Pool } from 'pg';

interface LayoutConfig {
    type: 'horizontal' | 'vertical' | 'grid';
    panes: PaneConfig[];
}

interface PaneConfig {
    id: string;
    size: number;
    model?: string;
    chatId?: string;
}

export class ConcurrentSessionManager {
    private pool: Pool;
    
    constructor(pool: Pool) {
        this.pool = pool;
    }
    
    async createSession(
        tenantId: string,
        userId: string,
        name?: string,
        initialPanes: number = 2
    ): Promise<string> {
        const layout: LayoutConfig = {
            type: 'horizontal',
            panes: Array(initialPanes).fill(null).map((_, i) => ({
                id: `pane-${i}`,
                size: 100 / initialPanes
            }))
        };
        
        const result = await this.pool.query(`
            INSERT INTO concurrent_sessions (tenant_id, user_id, session_name, layout_config)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `, [tenantId, userId, name, JSON.stringify(layout)]);
        
        const sessionId = result.rows[0].id;
        
        // Create pane records
        for (let i = 0; i < initialPanes; i++) {
            await this.pool.query(`
                INSERT INTO concurrent_panes (session_id, pane_index)
                VALUES ($1, $2)
            `, [sessionId, i]);
        }
        
        // Create sync state
        await this.pool.query(`
            INSERT INTO concurrent_sync_state (session_id)
            VALUES ($1)
        `, [sessionId]);
        
        return sessionId;
    }
    
    async addPane(sessionId: string, model?: string): Promise<number> {
        const session = await this.getSession(sessionId);
        if (session.layout_config.panes.length >= session.max_panes) {
            throw new Error('Maximum panes reached');
        }
        
        const newIndex = session.layout_config.panes.length;
        
        await this.pool.query(`
            INSERT INTO concurrent_panes (session_id, pane_index, model)
            VALUES ($1, $2, $3)
        `, [sessionId, newIndex, model]);
        
        // Update layout
        const newLayout = {
            ...session.layout_config,
            panes: [...session.layout_config.panes, { id: `pane-${newIndex}`, size: 100 / (newIndex + 1) }]
        };
        
        // Rebalance sizes
        const equalSize = 100 / newLayout.panes.length;
        newLayout.panes = newLayout.panes.map(p => ({ ...p, size: equalSize }));
        
        await this.pool.query(`
            UPDATE concurrent_sessions SET layout_config = $2, updated_at = NOW() WHERE id = $1
        `, [sessionId, JSON.stringify(newLayout)]);
        
        return newIndex;
    }
    
    async removePane(sessionId: string, paneIndex: number): Promise<void> {
        await this.pool.query(`DELETE FROM concurrent_panes WHERE session_id = $1 AND pane_index = $2`, [sessionId, paneIndex]);
        
        // Reindex remaining panes
        await this.pool.query(`
            UPDATE concurrent_panes
            SET pane_index = pane_index - 1
            WHERE session_id = $1 AND pane_index > $2
        `, [sessionId, paneIndex]);
        
        // Update layout
        const session = await this.getSession(sessionId);
        const newPanes = session.layout_config.panes.filter((_, i) => i !== paneIndex);
        const equalSize = 100 / newPanes.length;
        
        await this.pool.query(`
            UPDATE concurrent_sessions
            SET layout_config = $2, updated_at = NOW()
            WHERE id = $1
        `, [sessionId, JSON.stringify({ ...session.layout_config, panes: newPanes.map(p => ({ ...p, size: equalSize })) })]);
    }
    
    async updatePaneModel(sessionId: string, paneIndex: number, model: string): Promise<void> {
        await this.pool.query(`
            UPDATE concurrent_panes SET model = $3 WHERE session_id = $1 AND pane_index = $2
        `, [sessionId, paneIndex, model]);
    }
    
    async setSyncMode(sessionId: string, mode: 'independent' | 'synchronized' | 'broadcast'): Promise<void> {
        await this.pool.query(`
            UPDATE concurrent_sync_state SET sync_mode = $2, updated_at = NOW() WHERE session_id = $1
        `, [sessionId, mode]);
    }
    
    async getSession(sessionId: string) {
        const result = await this.pool.query(`SELECT * FROM concurrent_sessions WHERE id = $1`, [sessionId]);
        return result.rows[0];
    }
    
    async getPanes(sessionId: string) {
        const result = await this.pool.query(`
            SELECT * FROM concurrent_panes WHERE session_id = $1 ORDER BY pane_index
        `, [sessionId]);
        return result.rows;
    }
}
```

## 19.4 Split-Pane React Component

```tsx
// apps/admin-dashboard/src/components/concurrent/SplitPane.tsx

'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, ArrowLeftRight, ArrowUpDown, Grid } from 'lucide-react';

interface Pane {
    id: string;
    paneIndex: number;
    chatId?: string;
    model?: string;
    status: string;
}

interface SplitPaneProps {
    sessionId: string;
    onSendMessage: (paneIndex: number, message: string) => void;
}

export function SplitPane({ sessionId, onSendMessage }: SplitPaneProps) {
    const queryClient = useQueryClient();
    const [layout, setLayout] = useState<'horizontal' | 'vertical' | 'grid'>('horizontal');
    const [sizes, setSizes] = useState<number[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    
    const { data: session } = useQuery({
        queryKey: ['concurrent-session', sessionId],
        queryFn: async () => {
            const res = await fetch(`/api/admin/concurrent/${sessionId}`);
            return res.json();
        }
    });
    
    const { data: panes = [] } = useQuery({
        queryKey: ['concurrent-panes', sessionId],
        queryFn: async () => {
            const res = await fetch(`/api/admin/concurrent/${sessionId}/panes`);
            return res.json();
        }
    });
    
    const addPaneMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/admin/concurrent/${sessionId}/panes`, { method: 'POST' });
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['concurrent-panes', sessionId] })
    });
    
    const removePaneMutation = useMutation({
        mutationFn: async (paneIndex: number) => {
            await fetch(`/api/admin/concurrent/${sessionId}/panes/${paneIndex}`, { method: 'DELETE' });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['concurrent-panes', sessionId] })
    });
    
    const updateModelMutation = useMutation({
        mutationFn: async ({ paneIndex, model }: { paneIndex: number; model: string }) => {
            await fetch(`/api/admin/concurrent/${sessionId}/panes/${paneIndex}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model })
            });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['concurrent-panes', sessionId] })
    });
    
    const handleResize = useCallback((index: number, delta: number) => {
        setSizes(prev => {
            const newSizes = [...prev];
            newSizes[index] = Math.max(10, Math.min(90, newSizes[index] + delta));
            newSizes[index + 1] = Math.max(10, Math.min(90, newSizes[index + 1] - delta));
            return newSizes;
        });
    }, []);
    
    const getLayoutClasses = () => {
        switch (layout) {
            case 'vertical': return 'flex-col';
            case 'grid': return 'grid grid-cols-2';
            default: return 'flex-row';
        }
    };
    
    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 border-b bg-gray-50">
                <div className="flex items-center gap-2">
                    <Button
                        variant={layout === 'horizontal' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setLayout('horizontal')}
                    >
                        <ArrowLeftRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={layout === 'vertical' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setLayout('vertical')}
                    >
                        <ArrowUpDown className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={layout === 'grid' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setLayout('grid')}
                    >
                        <Grid className="h-4 w-4" />
                    </Button>
                </div>
                
                <Button
                    size="sm"
                    onClick={() => addPaneMutation.mutate()}
                    disabled={panes.length >= 4}
                >
                    <Plus className="h-4 w-4 mr-1" /> Add Pane
                </Button>
            </div>
            
            {/* Panes Container */}
            <div ref={containerRef} className={`flex-1 flex ${getLayoutClasses()} gap-1 p-1`}>
                {panes.map((pane: Pane, index: number) => (
                    <React.Fragment key={pane.id}>
                        <div 
                            className="flex-1 min-w-0 border rounded-lg overflow-hidden"
                            style={{ flex: sizes[index] ? `0 0 ${sizes[index]}%` : 1 }}
                        >
                            <PaneContent
                                pane={pane}
                                onRemove={() => removePaneMutation.mutate(pane.paneIndex)}
                                onModelChange={(model) => updateModelMutation.mutate({ paneIndex: pane.paneIndex, model })}
                                onSendMessage={(message) => onSendMessage(pane.paneIndex, message)}
                                canRemove={panes.length > 1}
                            />
                        </div>
                        {index < panes.length - 1 && layout !== 'grid' && (
                            <div
                                className={`${layout === 'horizontal' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'} bg-gray-300 hover:bg-blue-500`}
                                onMouseDown={(e) => {
                                    const startPos = layout === 'horizontal' ? e.clientX : e.clientY;
                                    const onMouseMove = (moveEvent: MouseEvent) => {
                                        const currentPos = layout === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
                                        handleResize(index, (currentPos - startPos) / 5);
                                    };
                                    const onMouseUp = () => {
                                        document.removeEventListener('mousemove', onMouseMove);
                                        document.removeEventListener('mouseup', onMouseUp);
                                    };
                                    document.addEventListener('mousemove', onMouseMove);
                                    document.addEventListener('mouseup', onMouseUp);
                                }}
                            />
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}

interface PaneContentProps {
    pane: Pane;
    onRemove: () => void;
    onModelChange: (model: string) => void;
    onSendMessage: (message: string) => void;
    canRemove: boolean;
}

function PaneContent({ pane, onRemove, onModelChange, onSendMessage, canRemove }: PaneContentProps) {
    const [input, setInput] = useState('');
    
    const models = [
        { id: 'claude-opus-4', name: 'Claude Opus 4' },
        { id: 'claude-sonnet-4', name: 'Claude Sonnet 4' },
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'grok-4', name: 'Grok 4' },
        { id: 'gemini-2', name: 'Gemini 2' }
    ];
    
    return (
        <div className="h-full flex flex-col">
            {/* Pane Header */}
            <div className="flex items-center justify-between p-2 border-b bg-white">
                <Select value={pane.model || ''} onValueChange={onModelChange}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                        {models.map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                
                {canRemove && (
                    <Button variant="ghost" size="sm" onClick={onRemove}>
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>
            
            {/* Chat Area */}
            <div className="flex-1 overflow-auto p-4 bg-gray-50">
                {/* Messages would render here */}
                <div className="text-gray-500 text-center">
                    {pane.model ? `Ready to chat with ${pane.model}` : 'Select a model to start'}
                </div>
            </div>
            
            {/* Input */}
            <div className="p-2 border-t bg-white">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 px-3 py-2 border rounded-lg"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && input.trim()) {
                                onSendMessage(input);
                                setInput('');
                            }
                        }}
                    />
                    <Button
                        onClick={() => {
                            if (input.trim()) {
                                onSendMessage(input);
                                setInput('');
                            }
                        }}
                    >
                        Send
                    </Button>
                </div>
            </div>
        </div>
    );
}
```

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 20: REAL-TIME COLLABORATION (v3.6.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

## 20.1 Collaboration Overview

Real-time collaborative editing using Yjs CRDT for shared workspaces.

## 20.2 Collaboration Database Schema

```sql
-- migrations/029_realtime_collaboration.sql

CREATE TABLE collaboration_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    room_name VARCHAR(100) NOT NULL,
    room_type VARCHAR(50) NOT NULL DEFAULT 'document',
    created_by UUID NOT NULL REFERENCES users(id),
    yjs_document BYTEA,
    is_active BOOLEAN DEFAULT true,
    max_participants INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE room_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES collaboration_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(20) NOT NULL DEFAULT 'editor',
    cursor_position JSONB,
    is_online BOOLEAN DEFAULT false,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(room_id, user_id)
);

CREATE TABLE collaboration_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES collaboration_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL,
    action_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_collab_rooms_tenant ON collaboration_rooms(tenant_id);
CREATE INDEX idx_room_participants ON room_participants(room_id);
CREATE INDEX idx_collab_history ON collaboration_history(room_id, created_at DESC);

ALTER TABLE collaboration_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY collab_rooms_isolation ON collaboration_rooms USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY room_participants_isolation ON room_participants USING (
    room_id IN (SELECT id FROM collaboration_rooms WHERE tenant_id = current_setting('app.current_tenant_id')::UUID)
);
CREATE POLICY collab_history_isolation ON collaboration_history USING (
    room_id IN (SELECT id FROM collaboration_rooms WHERE tenant_id = current_setting('app.current_tenant_id')::UUID)
);
```

## 20.3 Yjs Collaboration Provider

```typescript
// packages/core/src/services/yjs-provider.ts

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Pool } from 'pg';

export class YjsCollaborationProvider {
    private pool: Pool;
    private documents: Map<string, Y.Doc> = new Map();
    private providers: Map<string, WebsocketProvider> = new Map();
    
    constructor(pool: Pool) {
        this.pool = pool;
    }
    
    async getOrCreateRoom(
        tenantId: string,
        roomId: string,
        userId: string
    ): Promise<{ doc: Y.Doc; provider: WebsocketProvider }> {
        // Check if document already exists in memory
        if (this.documents.has(roomId)) {
            return {
                doc: this.documents.get(roomId)!,
                provider: this.providers.get(roomId)!
            };
        }
        
        // Load from database or create new
        const result = await this.pool.query(
            `SELECT yjs_document FROM collaboration_rooms WHERE id = $1 AND tenant_id = $2`,
            [roomId, tenantId]
        );
        
        const doc = new Y.Doc();
        
        if (result.rows[0]?.yjs_document) {
            Y.applyUpdate(doc, result.rows[0].yjs_document);
        }
        
        // Create WebSocket provider
        const wsUrl = process.env.YJS_WEBSOCKET_URL || 'wss://collab.radiant.ai';
        const provider = new WebsocketProvider(wsUrl, roomId, doc);
        
        // Set up persistence
        doc.on('update', async (update: Uint8Array) => {
            await this.persistDocument(roomId, Y.encodeStateAsUpdate(doc));
        });
        
        this.documents.set(roomId, doc);
        this.providers.set(roomId, provider);
        
        // Add user as participant
        await this.addParticipant(roomId, userId);
        
        return { doc, provider };
    }
    
    async addParticipant(roomId: string, userId: string): Promise<void> {
        await this.pool.query(`
            INSERT INTO room_participants (room_id, user_id, is_online)
            VALUES ($1, $2, true)
            ON CONFLICT (room_id, user_id)
            DO UPDATE SET is_online = true, last_seen = NOW()
        `, [roomId, userId]);
    }
    
    async removeParticipant(roomId: string, userId: string): Promise<void> {
        await this.pool.query(`
            UPDATE room_participants SET is_online = false, last_seen = NOW()
            WHERE room_id = $1 AND user_id = $2
        `, [roomId, userId]);
    }
    
    async updateCursor(roomId: string, userId: string, position: any): Promise<void> {
        await this.pool.query(`
            UPDATE room_participants SET cursor_position = $3, last_seen = NOW()
            WHERE room_id = $1 AND user_id = $2
        `, [roomId, userId, JSON.stringify(position)]);
    }
    
    private async persistDocument(roomId: string, update: Uint8Array): Promise<void> {
        await this.pool.query(`
            UPDATE collaboration_rooms SET yjs_document = $2, updated_at = NOW()
            WHERE id = $1
        `, [roomId, Buffer.from(update)]);
    }
    
    async getParticipants(roomId: string): Promise<any[]> {
        const result = await this.pool.query(`
            SELECT rp.*, u.email, u.display_name
            FROM room_participants rp
            JOIN users u ON rp.user_id = u.id
            WHERE rp.room_id = $1
        `, [roomId]);
        return result.rows;
    }
    
    async logAction(roomId: string, userId: string, actionType: string, data: any): Promise<void> {
        await this.pool.query(`
            INSERT INTO collaboration_history (room_id, user_id, action_type, action_data)
            VALUES ($1, $2, $3, $4)
        `, [roomId, userId, actionType, JSON.stringify(data)]);
    }
}
```

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 21: VOICE & VIDEO INPUT (v3.6.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

## 21.1 Voice/Video Overview

Integration with Deepgram for speech-to-text and ElevenLabs for text-to-speech.

## 21.2 Voice Database Schema

```sql
-- migrations/030_voice_video.sql

CREATE TABLE voice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    session_type VARCHAR(20) NOT NULL,
    input_format VARCHAR(20),
    output_format VARCHAR(20),
    language VARCHAR(10) DEFAULT 'en',
    voice_id VARCHAR(100),
    total_duration_ms INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 6) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMPTZ
);

CREATE TABLE voice_transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
    audio_url VARCHAR(500),
    transcription TEXT,
    confidence DECIMAL(3, 2),
    duration_ms INTEGER,
    word_timestamps JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE voice_synthesis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
    input_text TEXT NOT NULL,
    audio_url VARCHAR(500),
    voice_id VARCHAR(100) NOT NULL,
    duration_ms INTEGER,
    character_count INTEGER,
    cost DECIMAL(10, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_voice_sessions_user ON voice_sessions(tenant_id, user_id);
CREATE INDEX idx_voice_transcriptions ON voice_transcriptions(session_id);

ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_synthesis ENABLE ROW LEVEL SECURITY;

CREATE POLICY voice_sessions_isolation ON voice_sessions USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY voice_transcriptions_isolation ON voice_transcriptions USING (
    session_id IN (SELECT id FROM voice_sessions WHERE tenant_id = current_setting('app.current_tenant_id')::UUID)
);
CREATE POLICY voice_synthesis_isolation ON voice_synthesis USING (
    session_id IN (SELECT id FROM voice_sessions WHERE tenant_id = current_setting('app.current_tenant_id')::UUID)
);
```

## 21.3 Voice Service Integration

```typescript
// packages/core/src/services/voice-service.ts

import { Pool } from 'pg';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface DeepgramResponse {
    results: {
        channels: Array<{
            alternatives: Array<{
                transcript: string;
                confidence: number;
                words: Array<{ word: string; start: number; end: number }>;
            }>;
        }>;
    };
    metadata: {
        duration: number;
    };
}

export class VoiceService {
    private pool: Pool;
    private s3: S3Client;
    private deepgramApiKey: string;
    private elevenLabsApiKey: string;
    
    constructor(pool: Pool) {
        this.pool = pool;
        this.s3 = new S3Client({});
        this.deepgramApiKey = process.env.DEEPGRAM_API_KEY!;
        this.elevenLabsApiKey = process.env.ELEVENLABS_API_KEY!;
    }
    
    async createSession(
        tenantId: string,
        userId: string,
        sessionType: 'stt' | 'tts' | 'realtime',
        options?: { language?: string; voiceId?: string }
    ): Promise<string> {
        const result = await this.pool.query(`
            INSERT INTO voice_sessions (tenant_id, user_id, session_type, language, voice_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, [tenantId, userId, sessionType, options?.language || 'en', options?.voiceId]);
        
        return result.rows[0].id;
    }
    
    async transcribe(
        sessionId: string,
        audioBuffer: Buffer,
        format: string = 'webm'
    ): Promise<{ transcription: string; confidence: number; wordTimestamps: any[] }> {
        // Upload audio to S3
        const audioKey = `voice/${sessionId}/${Date.now()}.${format}`;
        await this.s3.send(new PutObjectCommand({
            Bucket: process.env.ASSETS_BUCKET!,
            Key: audioKey,
            Body: audioBuffer,
            ContentType: `audio/${format}`
        }));
        
        // Call Deepgram API
        const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${this.deepgramApiKey}`,
                'Content-Type': `audio/${format}`
            },
            body: audioBuffer
        });
        
        const data: DeepgramResponse = await response.json();
        const result = data.results.channels[0].alternatives[0];
        
        // Store transcription
        const audioUrl = await this.getSignedUrl(audioKey);
        await this.pool.query(`
            INSERT INTO voice_transcriptions (session_id, audio_url, transcription, confidence, duration_ms, word_timestamps)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [sessionId, audioUrl, result.transcript, result.confidence, data.metadata.duration * 1000, JSON.stringify(result.words)]);
        
        return {
            transcription: result.transcript,
            confidence: result.confidence,
            wordTimestamps: result.words
        };
    }
    
    async synthesize(
        sessionId: string,
        text: string,
        voiceId: string = 'EXAVITQu4vr4xnSDxMaL'
    ): Promise<{ audioUrl: string; durationMs: number }> {
        // Call ElevenLabs API
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'xi-api-key': this.elevenLabsApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            })
        });
        
        const audioBuffer = Buffer.from(await response.arrayBuffer());
        
        // Upload to S3
        const audioKey = `voice/${sessionId}/${Date.now()}_synthesis.mp3`;
        await this.s3.send(new PutObjectCommand({
            Bucket: process.env.ASSETS_BUCKET!,
            Key: audioKey,
            Body: audioBuffer,
            ContentType: 'audio/mpeg'
        }));
        
        const audioUrl = await this.getSignedUrl(audioKey);
        const durationMs = this.estimateDuration(text);
        const cost = text.length * 0.00003; // Approximate ElevenLabs cost
        
        // Store synthesis record
        await this.pool.query(`
            INSERT INTO voice_synthesis (session_id, input_text, audio_url, voice_id, duration_ms, character_count, cost)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [sessionId, text, audioUrl, voiceId, durationMs, text.length, cost]);
        
        return { audioUrl, durationMs };
    }
    
    private async getSignedUrl(key: string): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: process.env.ASSETS_BUCKET!,
            Key: key
        });
        return getSignedUrl(this.s3, command, { expiresIn: 3600 });
    }
    
    private estimateDuration(text: string): number {
        // Rough estimate: ~150 words per minute
        const wordCount = text.split(/\s+/).length;
        return Math.round((wordCount / 150) * 60 * 1000);
    }
}
```

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 22: PERSISTENT MEMORY (v3.6.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

## 22.1 Memory System Overview

Long-term memory storage using pgvector embeddings for semantic search.

## 22.2 Memory Database Schema

```sql
-- migrations/031_persistent_memory.sql

CREATE TABLE memory_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    store_name VARCHAR(100) NOT NULL DEFAULT 'default',
    embedding_model VARCHAR(100) DEFAULT 'text-embedding-3-small',
    total_memories INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, user_id, store_name)
);

CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES memory_stores(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536),
    memory_type VARCHAR(50) DEFAULT 'fact',
    source VARCHAR(100),
    importance DECIMAL(3, 2) DEFAULT 0.5,
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE memory_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    target_memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL,
    strength DECIMAL(3, 2) DEFAULT 0.5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_memory_id, target_memory_id, relationship_type)
);

CREATE INDEX idx_memories_embedding ON memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_memories_store ON memories(store_id);
CREATE INDEX idx_memory_relationships ON memory_relationships(source_memory_id);

ALTER TABLE memory_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY memory_stores_isolation ON memory_stores USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY memories_isolation ON memories USING (
    store_id IN (SELECT id FROM memory_stores WHERE tenant_id = current_setting('app.current_tenant_id')::UUID)
);
CREATE POLICY memory_relationships_isolation ON memory_relationships USING (
    source_memory_id IN (SELECT m.id FROM memories m JOIN memory_stores ms ON m.store_id = ms.id WHERE ms.tenant_id = current_setting('app.current_tenant_id')::UUID)
);
```

## 22.3 Memory Service

```typescript
// packages/core/src/services/memory-service.ts

import { Pool } from 'pg';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

export class MemoryService {
    private pool: Pool;
    private bedrock: BedrockRuntimeClient;
    
    constructor(pool: Pool) {
        this.pool = pool;
        this.bedrock = new BedrockRuntimeClient({});
    }
    
    async getOrCreateStore(tenantId: string, userId: string, storeName: string = 'default'): Promise<string> {
        const result = await this.pool.query(`
            INSERT INTO memory_stores (tenant_id, user_id, store_name)
            VALUES ($1, $2, $3)
            ON CONFLICT (tenant_id, user_id, store_name) DO UPDATE SET last_accessed = NOW()
            RETURNING id
        `, [tenantId, userId, storeName]);
        
        return result.rows[0].id;
    }
    
    async addMemory(
        storeId: string,
        content: string,
        options?: {
            type?: string;
            source?: string;
            importance?: number;
            metadata?: Record<string, any>;
        }
    ): Promise<string> {
        const embedding = await this.generateEmbedding(content);
        
        const result = await this.pool.query(`
            INSERT INTO memories (store_id, content, embedding, memory_type, source, importance, metadata)
            VALUES ($1, $2, $3::vector, $4, $5, $6, $7)
            RETURNING id
        `, [
            storeId,
            content,
            `[${embedding.join(',')}]`,
            options?.type || 'fact',
            options?.source,
            options?.importance || 0.5,
            JSON.stringify(options?.metadata || {})
        ]);
        
        // Update store count
        await this.pool.query(`
            UPDATE memory_stores SET total_memories = total_memories + 1 WHERE id = $1
        `, [storeId]);
        
        return result.rows[0].id;
    }
    
    async searchMemories(
        storeId: string,
        query: string,
        limit: number = 5,
        minSimilarity: number = 0.7
    ): Promise<any[]> {
        const embedding = await this.generateEmbedding(query);
        
        const result = await this.pool.query(`
            SELECT 
                id, content, memory_type, source, importance, metadata,
                1 - (embedding <=> $2::vector) as similarity
            FROM memories
            WHERE store_id = $1
            AND (expires_at IS NULL OR expires_at > NOW())
            AND 1 - (embedding <=> $2::vector) >= $4
            ORDER BY embedding <=> $2::vector
            LIMIT $3
        `, [storeId, `[${embedding.join(',')}]`, limit, minSimilarity]);
        
        // Update access counts
        const memoryIds = result.rows.map(r => r.id);
        if (memoryIds.length > 0) {
            await this.pool.query(`
                UPDATE memories SET access_count = access_count + 1, last_accessed = NOW()
                WHERE id = ANY($1)
            `, [memoryIds]);
        }
        
        return result.rows;
    }
    
    async addRelationship(
        sourceId: string,
        targetId: string,
        relationshipType: string,
        strength: number = 0.5
    ): Promise<void> {
        await this.pool.query(`
            INSERT INTO memory_relationships (source_memory_id, target_memory_id, relationship_type, strength)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (source_memory_id, target_memory_id, relationship_type)
            DO UPDATE SET strength = EXCLUDED.strength
        `, [sourceId, targetId, relationshipType, strength]);
    }
    
    async getRelatedMemories(memoryId: string, limit: number = 5): Promise<any[]> {
        const result = await this.pool.query(`
            SELECT m.*, mr.relationship_type, mr.strength
            FROM memory_relationships mr
            JOIN memories m ON mr.target_memory_id = m.id
            WHERE mr.source_memory_id = $1
            ORDER BY mr.strength DESC
            LIMIT $2
        `, [memoryId, limit]);
        
        return result.rows;
    }
    
    private async generateEmbedding(text: string): Promise<number[]> {
        const response = await this.bedrock.send(new InvokeModelCommand({
            modelId: 'amazon.titan-embed-text-v1',
            body: JSON.stringify({ inputText: text }),
            contentType: 'application/json'
        }));
        
        const result = JSON.parse(new TextDecoder().decode(response.body));
        return result.embedding;
    }
}
```

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 23: CANVAS & ARTIFACTS (v3.6.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

## 23.1 Canvas Overview

Rich content editing with artifacts for code, documents, and visualizations.

## 23.2 Canvas Database Schema

```sql
-- migrations/032_canvas_artifacts.sql

CREATE TABLE canvases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    chat_id UUID REFERENCES chats(id),
    canvas_name VARCHAR(200),
    canvas_type VARCHAR(50) NOT NULL DEFAULT 'general',
    content JSONB NOT NULL DEFAULT '{}',
    version INTEGER DEFAULT 1,
    is_published BOOLEAN DEFAULT false,
    published_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
    artifact_type VARCHAR(50) NOT NULL,
    title VARCHAR(200),
    content TEXT NOT NULL,
    language VARCHAR(50),
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    width INTEGER DEFAULT 400,
    height INTEGER DEFAULT 300,
    z_index INTEGER DEFAULT 0,
    is_collapsed BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE artifact_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_canvases_user ON canvases(tenant_id, user_id);
CREATE INDEX idx_artifacts_canvas ON artifacts(canvas_id);
CREATE INDEX idx_artifact_versions ON artifact_versions(artifact_id, version DESC);

ALTER TABLE canvases ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY canvases_isolation ON canvases USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY artifacts_isolation ON artifacts USING (
    canvas_id IN (SELECT id FROM canvases WHERE tenant_id = current_setting('app.current_tenant_id')::UUID)
);
CREATE POLICY artifact_versions_isolation ON artifact_versions USING (
    artifact_id IN (SELECT a.id FROM artifacts a JOIN canvases c ON a.canvas_id = c.id WHERE c.tenant_id = current_setting('app.current_tenant_id')::UUID)
);
```

## 23.3 Canvas Service

```typescript
// packages/core/src/services/canvas-service.ts

import { Pool } from 'pg';

type ArtifactType = 'code' | 'markdown' | 'mermaid' | 'html' | 'svg' | 'json' | 'table';

interface ArtifactCreate {
    type: ArtifactType;
    title?: string;
    content: string;
    language?: string;
    position?: { x: number; y: number };
    size?: { width: number; height: number };
}

export class CanvasService {
    private pool: Pool;
    
    constructor(pool: Pool) {
        this.pool = pool;
    }
    
    async createCanvas(
        tenantId: string,
        userId: string,
        options?: { name?: string; chatId?: string; type?: string }
    ): Promise<string> {
        const result = await this.pool.query(`
            INSERT INTO canvases (tenant_id, user_id, canvas_name, chat_id, canvas_type)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, [tenantId, userId, options?.name, options?.chatId, options?.type || 'general']);
        
        return result.rows[0].id;
    }
    
    async addArtifact(canvasId: string, artifact: ArtifactCreate, createdBy?: string): Promise<string> {
        const result = await this.pool.query(`
            INSERT INTO artifacts (canvas_id, artifact_type, title, content, language, position_x, position_y, width, height)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        `, [
            canvasId,
            artifact.type,
            artifact.title,
            artifact.content,
            artifact.language,
            artifact.position?.x || 0,
            artifact.position?.y || 0,
            artifact.size?.width || 400,
            artifact.size?.height || 300
        ]);
        
        const artifactId = result.rows[0].id;
        
        // Create initial version
        await this.pool.query(`
            INSERT INTO artifact_versions (artifact_id, version, content, created_by)
            VALUES ($1, 1, $2, $3)
        `, [artifactId, artifact.content, createdBy]);
        
        return artifactId;
    }
    
    async updateArtifact(artifactId: string, content: string, updatedBy?: string): Promise<void> {
        // Get current version
        const current = await this.pool.query(
            `SELECT COALESCE(MAX(version), 0) as max_version FROM artifact_versions WHERE artifact_id = $1`,
            [artifactId]
        );
        const newVersion = current.rows[0].max_version + 1;
        
        // Update artifact
        await this.pool.query(`
            UPDATE artifacts SET content = $2, updated_at = NOW() WHERE id = $1
        `, [artifactId, content]);
        
        // Save version
        await this.pool.query(`
            INSERT INTO artifact_versions (artifact_id, version, content, created_by)
            VALUES ($1, $2, $3, $4)
        `, [artifactId, newVersion, content, updatedBy]);
    }
    
    async getCanvas(canvasId: string): Promise<any> {
        const canvas = await this.pool.query(`SELECT * FROM canvases WHERE id = $1`, [canvasId]);
        const artifacts = await this.pool.query(`SELECT * FROM artifacts WHERE canvas_id = $1 ORDER BY z_index`, [canvasId]);
        
        return {
            ...canvas.rows[0],
            artifacts: artifacts.rows
        };
    }
    
    async getArtifactVersions(artifactId: string): Promise<any[]> {
        const result = await this.pool.query(`
            SELECT av.*, u.email as created_by_email
            FROM artifact_versions av
            LEFT JOIN users u ON av.created_by = u.id
            WHERE av.artifact_id = $1
            ORDER BY av.version DESC
        `, [artifactId]);
        
        return result.rows;
    }
    
    async moveArtifact(artifactId: string, x: number, y: number): Promise<void> {
        await this.pool.query(`
            UPDATE artifacts SET position_x = $2, position_y = $3, updated_at = NOW() WHERE id = $1
        `, [artifactId, x, y]);
    }
    
    async resizeArtifact(artifactId: string, width: number, height: number): Promise<void> {
        await this.pool.query(`
            UPDATE artifacts SET width = $2, height = $3, updated_at = NOW() WHERE id = $1
        `, [artifactId, width, height]);
    }
    
    async deleteArtifact(artifactId: string): Promise<void> {
        await this.pool.query(`DELETE FROM artifacts WHERE id = $1`, [artifactId]);
    }
    
    async publishCanvas(canvasId: string): Promise<string> {
        const publishedUrl = `https://canvas.radiant.ai/${canvasId}`;
        
        await this.pool.query(`
            UPDATE canvases SET is_published = true, published_url = $2, updated_at = NOW() WHERE id = $1
        `, [canvasId, publishedUrl]);
        
        return publishedUrl;
    }
}
```

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 24: RESULT MERGING & AI SYNTHESIS (v3.6.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

## 24.1 Result Merging Overview

Combine responses from multiple AI models with intelligent synthesis.

## 24.2 Merge Database Schema

```sql
-- migrations/033_result_merging.sql

CREATE TABLE merge_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    prompt TEXT NOT NULL,
    merge_strategy VARCHAR(50) NOT NULL DEFAULT 'consensus',
    models_used TEXT[] NOT NULL,
    final_result TEXT,
    quality_score DECIMAL(3, 2),
    total_cost DECIMAL(10, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE merge_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES merge_sessions(id) ON DELETE CASCADE,
    model VARCHAR(100) NOT NULL,
    response TEXT NOT NULL,
    tokens_used INTEGER,
    latency_ms INTEGER,
    contribution_weight DECIMAL(3, 2) DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_merge_sessions_user ON merge_sessions(tenant_id, user_id);
CREATE INDEX idx_merge_responses_session ON merge_responses(session_id);

ALTER TABLE merge_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE merge_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY merge_sessions_isolation ON merge_sessions USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY merge_responses_isolation ON merge_responses USING (
    session_id IN (SELECT id FROM merge_sessions WHERE tenant_id = current_setting('app.current_tenant_id')::UUID)
);
```

## 24.3 Result Merger Service

```typescript
// packages/core/src/services/result-merger.ts

import { Pool } from 'pg';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

type MergeStrategy = 'consensus' | 'best_of' | 'synthesize' | 'debate';

interface MergeResult {
    sessionId: string;
    mergedResponse: string;
    qualityScore: number;
    contributions: Array<{ model: string; weight: number }>;
}

export class ResultMerger {
    private pool: Pool;
    private bedrock: BedrockRuntimeClient;
    
    constructor(pool: Pool) {
        this.pool = pool;
        this.bedrock = new BedrockRuntimeClient({});
    }
    
    async merge(
        tenantId: string,
        userId: string,
        prompt: string,
        responses: Array<{ model: string; response: string; tokens?: number; latencyMs?: number }>,
        strategy: MergeStrategy = 'consensus'
    ): Promise<MergeResult> {
        // Create session
        const models = responses.map(r => r.model);
        const sessionResult = await this.pool.query(`
            INSERT INTO merge_sessions (tenant_id, user_id, prompt, merge_strategy, models_used)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, [tenantId, userId, prompt, strategy, models]);
        
        const sessionId = sessionResult.rows[0].id;
        
        // Store individual responses
        for (const response of responses) {
            await this.pool.query(`
                INSERT INTO merge_responses (session_id, model, response, tokens_used, latency_ms)
                VALUES ($1, $2, $3, $4, $5)
            `, [sessionId, response.model, response.response, response.tokens, response.latencyMs]);
        }
        
        // Perform merge based on strategy
        const mergeResult = await this.performMerge(prompt, responses, strategy);
        
        // Update session with result
        await this.pool.query(`
            UPDATE merge_sessions SET final_result = $2, quality_score = $3 WHERE id = $1
        `, [sessionId, mergeResult.mergedResponse, mergeResult.qualityScore]);
        
        return {
            sessionId,
            ...mergeResult
        };
    }
    
    private async performMerge(
        prompt: string,
        responses: Array<{ model: string; response: string }>,
        strategy: MergeStrategy
    ): Promise<{ mergedResponse: string; qualityScore: number; contributions: Array<{ model: string; weight: number }> }> {
        const strategyHandlers: Record<MergeStrategy, () => Promise<any>> = {
            consensus: () => this.consensusMerge(responses),
            best_of: () => this.bestOfMerge(prompt, responses),
            synthesize: () => this.synthesizeMerge(prompt, responses),
            debate: () => this.debateMerge(prompt, responses)
        };
        
        return strategyHandlers[strategy]();
    }
    
    private async consensusMerge(responses: Array<{ model: string; response: string }>) {
        const responsesText = responses.map((r, i) => `Response ${i + 1} (${r.model}):\n${r.response}`).join('\n\n');
        
        const synthesis = await this.invokeModel(`
            Analyze these AI responses and create a consensus response that incorporates the best elements from each:
            
            ${responsesText}
            
            Create a unified response that represents the consensus view. Return JSON: { "response": "...", "contributions": [{"model": "...", "weight": 0.0-1.0}] }
        `);
        
        return {
            mergedResponse: synthesis.response,
            qualityScore: 0.85,
            contributions: synthesis.contributions || responses.map(r => ({ model: r.model, weight: 1 / responses.length }))
        };
    }
    
    private async bestOfMerge(prompt: string, responses: Array<{ model: string; response: string }>) {
        const responsesText = responses.map((r, i) => `Response ${i + 1} (${r.model}):\n${r.response}`).join('\n\n');
        
        const evaluation = await this.invokeModel(`
            Original question: ${prompt}
            
            Evaluate these responses and select the best one:
            
            ${responsesText}
            
            Return JSON: { "bestIndex": 0-${responses.length - 1}, "reason": "...", "score": 0.0-1.0 }
        `);
        
        const bestResponse = responses[evaluation.bestIndex || 0];
        
        return {
            mergedResponse: bestResponse.response,
            qualityScore: evaluation.score || 0.8,
            contributions: [{ model: bestResponse.model, weight: 1.0 }]
        };
    }
    
    private async synthesizeMerge(prompt: string, responses: Array<{ model: string; response: string }>) {
        const responsesText = responses.map((r, i) => `Response ${i + 1} (${r.model}):\n${r.response}`).join('\n\n');
        
        const synthesis = await this.invokeModel(`
            Original question: ${prompt}
            
            Create a comprehensive synthesis that combines insights from all these responses:
            
            ${responsesText}
            
            Synthesize into a single, well-structured response that incorporates unique insights from each.
        `);
        
        return {
            mergedResponse: synthesis,
            qualityScore: 0.9,
            contributions: responses.map(r => ({ model: r.model, weight: 1 / responses.length }))
        };
    }
    
    private async debateMerge(prompt: string, responses: Array<{ model: string; response: string }>) {
        // Multi-round debate simulation
        const responsesText = responses.map((r, i) => `${r.model}:\n${r.response}`).join('\n\n---\n\n');
        
        const debate = await this.invokeModel(`
            Simulate a debate between these AI perspectives on: ${prompt}
            
            Initial positions:
            ${responsesText}
            
            Identify points of agreement and disagreement, then synthesize a conclusion that addresses the strongest arguments from each perspective.
        `);
        
        return {
            mergedResponse: debate,
            qualityScore: 0.85,
            contributions: responses.map(r => ({ model: r.model, weight: 1 / responses.length }))
        };
    }
    
    private async invokeModel(prompt: string): Promise<any> {
        const response = await this.bedrock.send(new InvokeModelCommand({
            modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 4096,
                messages: [{ role: 'user', content: prompt }]
            }),
            contentType: 'application/json'
        }));
        
        const result = JSON.parse(new TextDecoder().decode(response.body));
        const text = result.content[0].text;
        
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            return jsonMatch ? JSON.parse(jsonMatch[0]) : text;
        } catch {
            return text;
        }
    }
}
```

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
