// RADIANT v4.18.0 - Background AGI Learning Service
import { executeStatement } from '../db/client';
import { internetLearningService } from './internet-learning.service';

export type ThrottleLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'maximum';

export interface LearningConfig {
  enabled: boolean;
  throttleLevel: ThrottleLevel;
  maxHourlyCostCents: number;
  maxDailyCostCents: number;
  maxMonthlyCostCents: number;
  batchSize: number;
}

export interface LearningCosts {
  currentHour: number;
  currentDay: number;
  currentMonth: number;
  currentYear: number;
}

export interface LearningStatus {
  isRunning: boolean;
  currentThrottle: ThrottleLevel;
  lastLearningAt?: string;
  samplesProcessedToday: number;
  costs: LearningCosts;
  config: LearningConfig;
}

const THROTTLE_MULT: Record<ThrottleLevel, number> = { off: 0, minimal: 0.1, low: 0.25, medium: 0.5, high: 0.75, maximum: 1.0 };
const DEFAULT: LearningConfig = { enabled: true, throttleLevel: 'medium', maxHourlyCostCents: 100, maxDailyCostCents: 1000, maxMonthlyCostCents: 20000, batchSize: 50 };

export class BackgroundLearningService {
  private running = false;

  async startLearning(tenantId: string): Promise<void> {
    const cfg = await this.getConfig(tenantId);
    if (!cfg.enabled || cfg.throttleLevel === 'off') return;
    this.running = true;
    await this.runCycle(tenantId);
  }

  async stopLearning(tenantId: string): Promise<void> {
    this.running = false;
    await this.logEvent(tenantId, 'stopped', 0);
  }

  async runCycle(tenantId: string): Promise<void> {
    const cfg = await this.getConfig(tenantId);
    const costs = await this.getCosts(tenantId);
    if (costs.currentHour >= cfg.maxHourlyCostCents || costs.currentDay >= cfg.maxDailyCostCents) return;
    const batch = Math.max(1, Math.floor(cfg.batchSize * THROTTLE_MULT[cfg.throttleLevel]));
    
    // Fetch from internet sources for learning
    const sources = await internetLearningService.getSources(tenantId);
    for (const source of sources.slice(0, batch)) {
      await internetLearningService.fetchUrl(tenantId, source.url);
    }
    
    const cost = batch * 0.1;
    await this.recordCost(tenantId, cost);
    await this.logEvent(tenantId, 'cycle', cost);
  }

  async getConfig(tenantId: string): Promise<LearningConfig> {
    const r = await executeStatement(`SELECT * FROM background_learning_config WHERE tenant_id = $1`, [{ name: 't', value: { stringValue: tenantId } }]);
    if (!r.rows.length) { await this.saveConfig(tenantId, DEFAULT); return DEFAULT; }
    const row = r.rows[0] as Record<string, unknown>;
    return {
      enabled: Boolean(row.enabled ?? true),
      throttleLevel: String(row.throttle_level || 'medium') as ThrottleLevel,
      maxHourlyCostCents: Number(row.max_hourly_cost_cents || 100),
      maxDailyCostCents: Number(row.max_daily_cost_cents || 1000),
      maxMonthlyCostCents: Number(row.max_monthly_cost_cents || 20000),
      batchSize: Number(row.batch_size || 50),
    };
  }

  async saveConfig(tenantId: string, cfg: Partial<LearningConfig>): Promise<void> {
    await executeStatement(
      `INSERT INTO background_learning_config (tenant_id, enabled, throttle_level, max_hourly_cost_cents, max_daily_cost_cents, max_monthly_cost_cents, batch_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (tenant_id) DO UPDATE SET
       enabled = COALESCE($2, background_learning_config.enabled), throttle_level = COALESCE($3, background_learning_config.throttle_level),
       max_hourly_cost_cents = COALESCE($4, background_learning_config.max_hourly_cost_cents), max_daily_cost_cents = COALESCE($5, background_learning_config.max_daily_cost_cents),
       max_monthly_cost_cents = COALESCE($6, background_learning_config.max_monthly_cost_cents), batch_size = COALESCE($7, background_learning_config.batch_size), updated_at = NOW()`,
      [
        { name: 't', value: { stringValue: tenantId } },
        { name: 'e', value: cfg.enabled !== undefined ? { booleanValue: cfg.enabled } : { isNull: true } },
        { name: 'l', value: cfg.throttleLevel ? { stringValue: cfg.throttleLevel } : { isNull: true } },
        { name: 'h', value: cfg.maxHourlyCostCents ? { longValue: cfg.maxHourlyCostCents } : { isNull: true } },
        { name: 'd', value: cfg.maxDailyCostCents ? { longValue: cfg.maxDailyCostCents } : { isNull: true } },
        { name: 'm', value: cfg.maxMonthlyCostCents ? { longValue: cfg.maxMonthlyCostCents } : { isNull: true } },
        { name: 'b', value: cfg.batchSize ? { longValue: cfg.batchSize } : { isNull: true } },
      ]
    );
  }

  async setThrottle(tenantId: string, level: ThrottleLevel): Promise<void> {
    await this.saveConfig(tenantId, { throttleLevel: level });
  }

  async getCosts(tenantId: string): Promise<LearningCosts> {
    const r = await executeStatement(
      `SELECT SUM(CASE WHEN created_at >= date_trunc('hour', NOW()) THEN cost_cents ELSE 0 END) as h,
              SUM(CASE WHEN created_at >= CURRENT_DATE THEN cost_cents ELSE 0 END) as d,
              SUM(CASE WHEN created_at >= date_trunc('month', NOW()) THEN cost_cents ELSE 0 END) as m,
              SUM(CASE WHEN created_at >= date_trunc('year', NOW()) THEN cost_cents ELSE 0 END) as y
       FROM learning_costs WHERE tenant_id = $1`,
      [{ name: 't', value: { stringValue: tenantId } }]
    );
    const row = r.rows[0] as Record<string, unknown> || {};
    return { currentHour: Number(row.h || 0), currentDay: Number(row.d || 0), currentMonth: Number(row.m || 0), currentYear: Number(row.y || 0) };
  }

  private async recordCost(tenantId: string, cents: number): Promise<void> {
    await executeStatement(`INSERT INTO learning_costs (tenant_id, cost_cents) VALUES ($1, $2)`, [{ name: 't', value: { stringValue: tenantId } }, { name: 'c', value: { doubleValue: cents } }]);
  }

  private async logEvent(tenantId: string, type: string, cost: number): Promise<void> {
    await executeStatement(`INSERT INTO learning_events (tenant_id, event_type, cost_cents) VALUES ($1, $2, $3)`, [{ name: 't', value: { stringValue: tenantId } }, { name: 'e', value: { stringValue: type } }, { name: 'c', value: { doubleValue: cost } }]);
  }

  async getStatus(tenantId: string): Promise<LearningStatus> {
    const cfg = await this.getConfig(tenantId);
    const costs = await this.getCosts(tenantId);
    const r = await executeStatement(`SELECT COUNT(*) as cnt, MAX(created_at) as last FROM learning_events WHERE tenant_id = $1 AND created_at >= CURRENT_DATE`, [{ name: 't', value: { stringValue: tenantId } }]);
    const s = r.rows[0] as Record<string, unknown> || {};
    return { isRunning: this.running, currentThrottle: cfg.throttleLevel, lastLearningAt: s.last ? String(s.last) : undefined, samplesProcessedToday: Number(s.cnt || 0), costs, config: cfg };
  }
}

export const backgroundLearningService = new BackgroundLearningService();
