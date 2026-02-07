/**
 * RADIANT SENTINEL v1.0.0 — Service Watchdog
 *
 * Architecture (ratified):
 *   - PUSH: CloudWatch Alarms → SNS → SENTINEL for internal Lambdas (no polling 118+ functions)
 *   - POLL: Synthetic canaries for 5 critical user journeys every 60s
 *   - SEMANTIC: AI sanity probes ("What is 2+2?") to detect zombie models
 *
 * This service processes incoming CloudWatch alarm events (push),
 * runs deep synthetic health checks (poll), and validates AI model
 * correctness (semantic probes).
 */

import { Pool } from 'pg';
import https from 'https';
import {
  SentinelAlert,
  SentinelAlertCategory,
  SentinelSeverity,
  ServiceHealthCheck,
  ServiceHealthStatus,
  SentinelServiceName,
  SentinelCircuitBreakerState,
  SemanticProbeConfig,
  SemanticProbeResult,
  HealthCheckResponse,
} from '@radiant/shared/types/sentinel.types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface WatchdogConfig {
  region: string;
  environment: 'production' | 'staging' | 'development';
  dynamoTableName: string;
  alertQueueUrl: string;
  pagerdutyRoutingKey?: string;
}

interface SyntheticEndpoint {
  service: SentinelServiceName;
  url: string;
  category: SentinelAlertCategory;
  timeoutMs: number;
  expectedStatus: number;
  severity: SentinelSeverity;
}

const SYNTHETIC_ENDPOINTS: SyntheticEndpoint[] = [
  {
    service: 'think-tank',
    url: '/api/health',
    category: 'availability',
    timeoutMs: 10000,
    expectedStatus: 200,
    severity: 1,
  },
  {
    service: 'admin-dashboard',
    url: '/api/health',
    category: 'availability',
    timeoutMs: 10000,
    expectedStatus: 200,
    severity: 2,
  },
  {
    service: 'curator',
    url: '/api/health',
    category: 'availability',
    timeoutMs: 10000,
    expectedStatus: 200,
    severity: 2,
  },
  {
    service: 'gateway',
    url: '/healthz',
    category: 'availability',
    timeoutMs: 5000,
    expectedStatus: 200,
    severity: 1,
  },
  {
    service: 'api-gateway',
    url: '/api/health',
    category: 'availability',
    timeoutMs: 10000,
    expectedStatus: 200,
    severity: 1,
  },
];

const DEFAULT_SEMANTIC_PROBES: SemanticProbeConfig[] = [
  {
    provider: 'openai',
    prompt: 'What is 2+2? Reply with the number only.',
    expectedContains: '4',
    maxLatencyMs: 10000,
    timeoutMs: 15000,
  },
  {
    provider: 'anthropic',
    prompt: 'What is 2+2? Reply with the number only.',
    expectedContains: '4',
    maxLatencyMs: 10000,
    timeoutMs: 15000,
  },
  {
    provider: 'google-gemini',
    prompt: 'What is 2+2? Reply with the number only.',
    expectedContains: '4',
    maxLatencyMs: 10000,
    timeoutMs: 15000,
  },
];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SentinelWatchdogService {
  private pool: Pool;
  private config: WatchdogConfig;
  private healthCache: Map<string, ServiceHealthCheck> = new Map();

  constructor(pool: Pool, config: WatchdogConfig) {
    this.pool = pool;
    this.config = config;
  }

  // =========================================================================
  // PUSH: Process CloudWatch Alarm Events (via SNS)
  // =========================================================================

  async processCloudWatchAlarm(snsMessage: Record<string, unknown>): Promise<SentinelAlert | null> {
    const alarmName = snsMessage.AlarmName as string;
    const newState = snsMessage.NewStateValue as string;
    const reason = snsMessage.NewStateReason as string;
    const namespace = (snsMessage.Trigger as Record<string, unknown>)?.Namespace as string;
    const metricName = (snsMessage.Trigger as Record<string, unknown>)?.MetricName as string;
    const dimensions = (snsMessage.Trigger as Record<string, unknown>)?.Dimensions as Array<{ name: string; value: string }>;

    if (newState !== 'ALARM') {
      if (newState === 'OK') {
        await this.resolveAlertByDeduplicationKey(`cw:${alarmName}`);
      }
      return null;
    }

    const { service, category, severity } = this.classifyCloudWatchAlarm(
      alarmName, namespace, metricName, dimensions
    );

    const alert: SentinelAlert = {
      alertId: this.generateUlid(),
      severity,
      category,
      status: 'firing',
      service,
      region: this.config.region,
      environment: this.config.environment,
      tenantScope: 'all',
      complianceContext: [],
      title: `CloudWatch Alarm: ${alarmName}`,
      message: reason || `Alarm ${alarmName} entered ALARM state`,
      details: {
        alarmName,
        namespace,
        metricName,
        dimensions,
        rawEvent: snsMessage,
      },
      source: 'cloudwatch_alarm',
      deduplicationKey: `cw:${alarmName}`,
      occurrenceCount: 1,
      firstOccurrenceAt: new Date().toISOString(),
      lastOccurrenceAt: new Date().toISOString(),
      autoRemediationStatus: 'not_applicable',
      createdAt: new Date().toISOString(),
    };

    return alert;
  }

  private classifyCloudWatchAlarm(
    alarmName: string,
    namespace: string,
    metricName: string,
    dimensions?: Array<{ name: string; value: string }>
  ): { service: SentinelServiceName; category: SentinelAlertCategory; severity: SentinelSeverity } {
    const name = alarmName.toLowerCase();
    const ns = (namespace || '').toLowerCase();

    if (ns.includes('lambda') || name.includes('lambda')) {
      const funcName = dimensions?.find(d => d.name === 'FunctionName')?.value || 'unknown';
      const isError = metricName === 'Errors' || name.includes('error');
      const isThrottle = metricName === 'Throttles' || name.includes('throttle');
      return {
        service: this.mapLambdaToService(funcName),
        category: 'application',
        severity: isError ? 2 : isThrottle ? 3 : 4,
      };
    }

    if (ns.includes('rds') || ns.includes('aurora') || name.includes('database') || name.includes('rds')) {
      return { service: 'aurora-postgres', category: 'data', severity: 1 };
    }

    if (ns.includes('elasticache') || name.includes('redis') || name.includes('cache')) {
      return { service: 'elasticache', category: 'data', severity: 2 };
    }

    if (ns.includes('apigateway') || name.includes('api-gateway')) {
      return { service: 'api-gateway', category: 'availability', severity: 2 };
    }

    if (ns.includes('sqs') || name.includes('queue')) {
      return { service: 'sqs', category: 'infrastructure', severity: 3 };
    }

    if (ns.includes('cognito') || name.includes('auth')) {
      return { service: 'cognito', category: 'security', severity: 1 };
    }

    if (name.includes('billing') || name.includes('cost')) {
      return { service: 'billing-metering', category: 'billing', severity: 3 };
    }

    if (name.includes('waf') || name.includes('security')) {
      return { service: 'gateway', category: 'security', severity: 2 };
    }

    return { service: alarmName as SentinelServiceName, category: 'infrastructure', severity: 3 };
  }

  private mapLambdaToService(functionName: string): SentinelServiceName {
    const fn = functionName.toLowerCase();
    if (fn.includes('sentinel')) return 'admin-dashboard';
    if (fn.includes('think-tank') || fn.includes('thinktank')) return 'think-tank';
    if (fn.includes('curator')) return 'curator';
    if (fn.includes('dojo')) return 'dojo';
    if (fn.includes('genesis')) return 'genesis';
    if (fn.includes('billing') || fn.includes('metering')) return 'billing-metering';
    if (fn.includes('cato')) return 'cato-pipeline';
    if (fn.includes('log-indexer')) return 'log-indexer';
    return functionName as SentinelServiceName;
  }

  // =========================================================================
  // POLL: Deep Synthetic Health Checks (5 critical user journeys)
  // =========================================================================

  async runSyntheticChecks(baseUrls: Record<string, string>): Promise<SentinelAlert[]> {
    const alerts: SentinelAlert[] = [];
    const checks = await Promise.allSettled(
      SYNTHETIC_ENDPOINTS.map(endpoint => this.checkEndpoint(endpoint, baseUrls))
    );

    for (let i = 0; i < checks.length; i++) {
      const result = checks[i];
      const endpoint = SYNTHETIC_ENDPOINTS[i];
      const cacheKey = `synthetic:${endpoint.service}`;

      if (result.status === 'fulfilled') {
        const healthCheck = result.value;
        this.healthCache.set(cacheKey, healthCheck);

        if (healthCheck.status === 'unhealthy') {
          alerts.push(this.createSyntheticAlert(endpoint, healthCheck));
        } else if (healthCheck.status === 'degraded') {
          alerts.push(this.createSyntheticAlert(endpoint, healthCheck, 3));
        }
      } else {
        const failedCheck: ServiceHealthCheck = {
          serviceId: endpoint.service,
          checkType: 'synthetic',
          status: 'unhealthy',
          lastCheck: new Date().toISOString(),
          consecutiveFailures: (this.healthCache.get(cacheKey)?.consecutiveFailures || 0) + 1,
          circuitBreakerState: 'closed',
          details: { error: result.reason?.message || 'Unknown error' },
        };
        this.healthCache.set(cacheKey, failedCheck);
        alerts.push(this.createSyntheticAlert(endpoint, failedCheck));
      }
    }

    return alerts;
  }

  private async checkEndpoint(
    endpoint: SyntheticEndpoint,
    baseUrls: Record<string, string>
  ): Promise<ServiceHealthCheck> {
    const baseUrl = baseUrls[endpoint.service];
    if (!baseUrl) {
      return {
        serviceId: endpoint.service,
        checkType: 'synthetic',
        status: 'unknown',
        lastCheck: new Date().toISOString(),
        consecutiveFailures: 0,
        circuitBreakerState: 'closed',
        details: { error: 'No base URL configured' },
      };
    }

    const startTime = Date.now();
    const url = `${baseUrl}${endpoint.url}`;

    try {
      const response = await this.httpGet(url, endpoint.timeoutMs);
      const latencyMs = Date.now() - startTime;
      const cacheKey = `synthetic:${endpoint.service}`;
      const prevCheck = this.healthCache.get(cacheKey);

      let status: ServiceHealthStatus = 'healthy';
      if (response.statusCode !== endpoint.expectedStatus) {
        status = 'unhealthy';
      } else if (latencyMs > endpoint.timeoutMs * 0.8) {
        status = 'degraded';
      }

      let healthData: HealthCheckResponse | undefined;
      try {
        healthData = JSON.parse(response.body) as HealthCheckResponse;
        if (healthData.status === 'degraded') status = 'degraded';
        if (healthData.status === 'unhealthy') status = 'unhealthy';
      } catch {
        // Response may not be JSON health check format
      }

      return {
        serviceId: endpoint.service,
        checkType: 'synthetic',
        status,
        lastCheck: new Date().toISOString(),
        latencyMs,
        consecutiveFailures: status === 'healthy' ? 0 : (prevCheck?.consecutiveFailures || 0) + 1,
        circuitBreakerState: 'closed',
        details: { statusCode: response.statusCode, latencyMs, healthData },
      };
    } catch (error: unknown) {
      const cacheKey = `synthetic:${endpoint.service}`;
      const prevCheck = this.healthCache.get(cacheKey);
      return {
        serviceId: endpoint.service,
        checkType: 'synthetic',
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
        consecutiveFailures: (prevCheck?.consecutiveFailures || 0) + 1,
        circuitBreakerState: 'closed',
        details: { error: (error as Error).message },
      };
    }
  }

  private createSyntheticAlert(
    endpoint: SyntheticEndpoint,
    healthCheck: ServiceHealthCheck,
    overrideSeverity?: SentinelSeverity
  ): SentinelAlert {
    const sev = overrideSeverity || endpoint.severity;
    return {
      alertId: this.generateUlid(),
      severity: sev,
      category: endpoint.category,
      status: 'firing',
      service: endpoint.service,
      region: this.config.region,
      environment: this.config.environment,
      tenantScope: 'all',
      complianceContext: [],
      title: `Synthetic check failed: ${endpoint.service}`,
      message: `Health check for ${endpoint.service} returned ${healthCheck.status}. Consecutive failures: ${healthCheck.consecutiveFailures}`,
      details: {
        endpoint: endpoint.url,
        healthCheck,
      },
      source: 'synthetic_canary',
      deduplicationKey: `synthetic:${endpoint.service}`,
      occurrenceCount: healthCheck.consecutiveFailures,
      firstOccurrenceAt: new Date().toISOString(),
      lastOccurrenceAt: new Date().toISOString(),
      autoRemediationStatus: 'not_applicable',
      createdAt: new Date().toISOString(),
    };
  }

  // =========================================================================
  // SEMANTIC: AI Sanity Probes ("What is 2+2?")
  // =========================================================================

  async runSemanticProbes(probes?: SemanticProbeConfig[]): Promise<{ results: SemanticProbeResult[]; alerts: SentinelAlert[] }> {
    const probeConfigs = probes || DEFAULT_SEMANTIC_PROBES;
    const results: SemanticProbeResult[] = [];
    const alerts: SentinelAlert[] = [];

    const checks = await Promise.allSettled(
      probeConfigs.map(probe => this.executeSemanticProbe(probe))
    );

    for (let i = 0; i < checks.length; i++) {
      const check = checks[i];
      const probe = probeConfigs[i];

      if (check.status === 'fulfilled') {
        results.push(check.value);
        if (!check.value.passed) {
          alerts.push(this.createSemanticAlert(probe, check.value));
        }
      } else {
        const failedResult: SemanticProbeResult = {
          provider: probe.provider,
          passed: false,
          latencyMs: 0,
          error: check.reason?.message || 'Probe execution failed',
          checkedAt: new Date().toISOString(),
        };
        results.push(failedResult);
        alerts.push(this.createSemanticAlert(probe, failedResult));
      }
    }

    return { results, alerts };
  }

  private async executeSemanticProbe(probe: SemanticProbeConfig): Promise<SemanticProbeResult> {
    const startTime = Date.now();

    try {
      // Call the internal AI routing API to test the provider
      const response = await this.httpPost(
        `${process.env.AI_ROUTING_URL || 'http://localhost:3001'}/api/chat/completions`,
        {
          model: this.getModelForProvider(probe.provider),
          messages: [{ role: 'user', content: probe.prompt }],
          max_tokens: 10,
          temperature: 0,
        },
        probe.timeoutMs
      );

      const latencyMs = Date.now() - startTime;
      const content = this.extractResponseContent(response.body);

      let passed = true;
      if (probe.expectedContains && !content.includes(probe.expectedContains)) {
        passed = false;
      }
      if (probe.expectedNotContains && content.includes(probe.expectedNotContains)) {
        passed = false;
      }
      if (latencyMs > probe.maxLatencyMs) {
        passed = false;
      }

      return {
        provider: probe.provider,
        passed,
        responseSnippet: content.substring(0, 100),
        latencyMs,
        checkedAt: new Date().toISOString(),
      };
    } catch (error: unknown) {
      return {
        provider: probe.provider,
        passed: false,
        latencyMs: Date.now() - startTime,
        error: (error as Error).message,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  private createSemanticAlert(probe: SemanticProbeConfig, result: SemanticProbeResult): SentinelAlert {
    return {
      alertId: this.generateUlid(),
      severity: 2,
      category: 'ai_model',
      status: 'firing',
      service: probe.provider as SentinelServiceName,
      region: this.config.region,
      environment: this.config.environment,
      tenantScope: 'all',
      complianceContext: [],
      title: `Semantic probe failed: ${probe.provider}`,
      message: result.error
        ? `AI provider ${probe.provider} semantic probe error: ${result.error}`
        : `AI provider ${probe.provider} returned unexpected response (zombie model detected)`,
      details: { probe, result },
      source: 'semantic_probe',
      deduplicationKey: `semantic:${probe.provider}`,
      occurrenceCount: 1,
      firstOccurrenceAt: new Date().toISOString(),
      lastOccurrenceAt: new Date().toISOString(),
      autoRemediationStatus: 'not_applicable',
      createdAt: new Date().toISOString(),
    };
  }

  // =========================================================================
  // Health Map (aggregated view)
  // =========================================================================

  getHealthMap(): ServiceHealthCheck[] {
    return Array.from(this.healthCache.values());
  }

  getServiceHealth(serviceId: SentinelServiceName): ServiceHealthCheck | undefined {
    return this.healthCache.get(`synthetic:${serviceId}`)
      || this.healthCache.get(`cw:${serviceId}`);
  }

  // =========================================================================
  // Alert Resolution
  // =========================================================================

  private async resolveAlertByDeduplicationKey(dedupKey: string): Promise<void> {
    // In DynamoDB implementation, query by GSI on deduplicationKey and set status=resolved
    // For now, log the resolution event
    console.log(`[SENTINEL] Resolving alert with dedup key: ${dedupKey}`);
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private getModelForProvider(provider: string): string {
    switch (provider) {
      case 'openai': return 'gpt-4o-mini';
      case 'anthropic': return 'claude-3-haiku-20240307';
      case 'google-gemini': return 'gemini-1.5-flash';
      default: return 'gpt-4o-mini';
    }
  }

  private extractResponseContent(body: string): string {
    try {
      const parsed = JSON.parse(body);
      return parsed?.choices?.[0]?.message?.content
        || parsed?.content?.[0]?.text
        || parsed?.candidates?.[0]?.content?.parts?.[0]?.text
        || '';
    } catch {
      return body;
    }
  }

  private generateUlid(): string {
    const timestamp = Date.now().toString(36).padStart(10, '0');
    const random = Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 36).toString(36)
    ).join('');
    return `${timestamp}${random}`.toUpperCase();
  }

  private httpGet(url: string, timeoutMs: number): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { timeout: timeoutMs }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode || 0, body }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    });
  }

  private httpPost(url: string, data: unknown, timeoutMs: number): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(data);
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname,
        method: 'POST',
        timeout: timeoutMs,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      };
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode || 0, body }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
      req.write(payload);
      req.end();
    });
  }
}
