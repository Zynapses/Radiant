// RADIANT v4.18.0 - Internet Learning Service
import { executeStatement } from '../db/client';

export interface WebSource { sourceId: string; url: string; sourceType: string; priority: number; isActive: boolean; }
export interface InternetConfig { enabled: boolean; maxFetchesPerHour: number; blockedDomains: string[]; }

const DEFAULT_CFG: InternetConfig = { enabled: true, maxFetchesPerHour: 100, blockedDomains: ['facebook.com', 'twitter.com'] };

export class InternetLearningService {
  async fetchUrl(tenantId: string, url: string): Promise<string | null> {
    const cfg = await this.getConfig(tenantId);
    if (!cfg.enabled) return null;
    const domain = new URL(url).hostname;
    if (cfg.blockedDomains.some(d => domain.includes(d))) return null;

    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'RADIANT-AGI/4.18.0' }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) return null;
      const text = await res.text();
      const clean = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 50000);
      await this.saveContent(tenantId, url, clean);
      return clean;
    } catch { return null; }
  }

  async addSource(tenantId: string, url: string, type: string, priority = 1): Promise<string> {
    const r = await executeStatement(`INSERT INTO internet_sources (tenant_id, url, source_type, priority) VALUES ($1, $2, $3, $4) RETURNING source_id`,
      [{ name: 't', value: { stringValue: tenantId } }, { name: 'u', value: { stringValue: url } }, { name: 's', value: { stringValue: type } }, { name: 'p', value: { longValue: priority } }]);
    return String((r.rows[0] as { source_id: string }).source_id);
  }

  async getSources(tenantId: string): Promise<WebSource[]> {
    const r = await executeStatement(`SELECT * FROM internet_sources WHERE tenant_id = $1 AND is_active = true ORDER BY priority DESC`, [{ name: 't', value: { stringValue: tenantId } }]);
    return r.rows.map((row: Record<string, unknown>) => ({ sourceId: String(row.source_id), url: String(row.url), sourceType: String(row.source_type), priority: Number(row.priority), isActive: Boolean(row.is_active) }));
  }

  async getConfig(tenantId: string): Promise<InternetConfig> {
    const r = await executeStatement(`SELECT * FROM internet_learning_config WHERE tenant_id = $1`, [{ name: 't', value: { stringValue: tenantId } }]);
    if (!r.rows.length) { await this.saveConfig(tenantId, DEFAULT_CFG); return DEFAULT_CFG; }
    const row = r.rows[0] as Record<string, unknown>;
    return { enabled: Boolean(row.enabled ?? true), maxFetchesPerHour: Number(row.max_fetches_per_hour || 100), blockedDomains: Array.isArray(row.blocked_domains) ? row.blocked_domains as string[] : DEFAULT_CFG.blockedDomains };
  }

  async saveConfig(tenantId: string, cfg: Partial<InternetConfig>): Promise<void> {
    await executeStatement(`INSERT INTO internet_learning_config (tenant_id, enabled, max_fetches_per_hour, blocked_domains) VALUES ($1, $2, $3, $4)
      ON CONFLICT (tenant_id) DO UPDATE SET enabled = COALESCE($2, internet_learning_config.enabled), max_fetches_per_hour = COALESCE($3, internet_learning_config.max_fetches_per_hour), blocked_domains = COALESCE($4, internet_learning_config.blocked_domains), updated_at = NOW()`,
      [{ name: 't', value: { stringValue: tenantId } }, { name: 'e', value: cfg.enabled !== undefined ? { booleanValue: cfg.enabled } : { isNull: true } },
       { name: 'f', value: cfg.maxFetchesPerHour ? { longValue: cfg.maxFetchesPerHour } : { isNull: true } }, { name: 'b', value: cfg.blockedDomains ? { stringValue: JSON.stringify(cfg.blockedDomains) } : { isNull: true } }]);
  }

  private async saveContent(tenantId: string, url: string, content: string): Promise<void> {
    await executeStatement(`INSERT INTO internet_content (tenant_id, url, content) VALUES ($1, $2, $3)`,
      [{ name: 't', value: { stringValue: tenantId } }, { name: 'u', value: { stringValue: url } }, { name: 'c', value: { stringValue: content } }]);
  }
}

export const internetLearningService = new InternetLearningService();
