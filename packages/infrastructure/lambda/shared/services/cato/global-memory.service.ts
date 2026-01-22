/**
 * Global Memory Service
 * 
 * Manages global memory state for Cato consciousness.
 * Provides cross-session memory persistence and retrieval.
 */

export interface MemoryEntry {
  id: string;
  tenantId: string;
  category: 'episodic' | 'semantic' | 'procedural' | 'working';
  key: string;
  value: unknown;
  importance: number;
  accessCount: number;
  lastAccessedAt: Date;
  createdAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface MemoryStats {
  tenantId?: string;
  totalEntries: number;
  byCategory: Record<string, number>;
  totalSizeBytes: number;
  oldestEntry?: Date;
  newestEntry?: Date;
  averageImportance: number;
}

class GlobalMemoryService {
  private memories: Map<string, MemoryEntry[]> = new Map();

  async store(
    tenantId: string,
    category: MemoryEntry['category'],
    key: string,
    value: unknown,
    options?: { importance?: number; expiresAt?: Date; metadata?: Record<string, unknown> }
  ): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      category,
      key,
      value,
      importance: options?.importance ?? 0.5,
      accessCount: 0,
      lastAccessedAt: new Date(),
      createdAt: new Date(),
      expiresAt: options?.expiresAt,
      metadata: options?.metadata,
    };

    if (!this.memories.has(tenantId)) {
      this.memories.set(tenantId, []);
    }
    this.memories.get(tenantId)!.push(entry);
    return entry;
  }

  async retrieve(tenantId: string, key: string): Promise<MemoryEntry | null> {
    const entries = this.memories.get(tenantId) || [];
    const entry = entries.find(e => e.key === key);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessedAt = new Date();
    }
    return entry || null;
  }

  async search(
    tenantId: string,
    query: { category?: MemoryEntry['category']; minImportance?: number; limit?: number }
  ): Promise<MemoryEntry[]> {
    let entries = this.memories.get(tenantId) || [];

    if (query.category) {
      entries = entries.filter(e => e.category === query.category);
    }
    if (query.minImportance !== undefined) {
      entries = entries.filter(e => e.importance >= query.minImportance!);
    }

    entries.sort((a, b) => b.importance - a.importance);

    if (query.limit) {
      entries = entries.slice(0, query.limit);
    }

    return entries;
  }

  async forget(tenantId: string, key: string): Promise<boolean> {
    const entries = this.memories.get(tenantId);
    if (!entries) return false;
    const index = entries.findIndex(e => e.key === key);
    if (index === -1) return false;
    entries.splice(index, 1);
    return true;
  }

  async consolidate(tenantId: string): Promise<number> {
    const entries = this.memories.get(tenantId);
    if (!entries) return 0;

    const now = new Date();
    const before = entries.length;
    
    // Remove expired entries
    const valid = entries.filter(e => !e.expiresAt || e.expiresAt > now);
    this.memories.set(tenantId, valid);
    
    return before - valid.length;
  }

  async getStats(tenantId?: string): Promise<MemoryStats> {
    const actualTenantId = tenantId || 'default';
    const entries = this.memories.get(actualTenantId) || [];
    
    const byCategory: Record<string, number> = {};
    let totalImportance = 0;
    let oldest: Date | undefined;
    let newest: Date | undefined;

    for (const entry of entries) {
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
      totalImportance += entry.importance;
      if (!oldest || entry.createdAt < oldest) oldest = entry.createdAt;
      if (!newest || entry.createdAt > newest) newest = entry.createdAt;
    }

    return {
      tenantId,
      totalEntries: entries.length,
      byCategory,
      totalSizeBytes: JSON.stringify(entries).length,
      oldestEntry: oldest,
      newestEntry: newest,
      averageImportance: entries.length > 0 ? totalImportance / entries.length : 0,
    };
  }

  async clear(tenantId: string, category?: MemoryEntry['category']): Promise<number> {
    if (!category) {
      const count = (this.memories.get(tenantId) || []).length;
      this.memories.delete(tenantId);
      return count;
    }

    const entries = this.memories.get(tenantId) || [];
    const filtered = entries.filter(e => e.category !== category);
    this.memories.set(tenantId, filtered);
    return entries.length - filtered.length;
  }

  async storeFact(tenantIdOrFact: string | { subject: string; predicate: string; object: string; domain: string; confidence?: number; sources?: string[] } = 'default', key = '', value?: unknown): Promise<MemoryEntry | string> {
    if (typeof tenantIdOrFact === 'object') {
      const fact = tenantIdOrFact;
      const factKey = `${fact.subject}:${fact.predicate}:${fact.object}`;
      const entry = await this.store('default', 'semantic', factKey, fact, { importance: fact.confidence || 0.7 });
      return entry.id;
    }
    return this.store(tenantIdOrFact, 'semantic', key, value, { importance: 0.7 });
  }

  async getFactsByDomain(tenantIdOrDomain: string = 'default', domainOrLimit?: string | number): Promise<MemoryEntry[]> {
    const hasTenantId = typeof domainOrLimit === 'string' || typeof domainOrLimit === 'number';
    const tenantId = hasTenantId ? tenantIdOrDomain : 'default';
    return this.search(tenantId, { category: 'semantic' });
  }

  async getGoals(tenantId = 'default'): Promise<string[]> {
    const entries = await this.search(tenantId, { category: 'procedural' });
    return entries.map(e => e.key);
  }

  async updateGoals(tenantIdOrGoals: string | string[] = 'default', goals?: string[]): Promise<void> {
    const isGoals = Array.isArray(tenantIdOrGoals);
    const tenantId = isGoals ? 'default' : tenantIdOrGoals;
    const actualGoals = isGoals ? tenantIdOrGoals : (goals || []);
    await this.clear(tenantId, 'procedural');
    for (const goal of actualGoals) {
      await this.store(tenantId, 'procedural', goal, { active: true });
    }
  }

  async getMetaState(tenantId = 'default'): Promise<Record<string, unknown>> {
    const stats = await this.getStats(tenantId);
    return { ...stats, meta: true };
  }

  async getAttentionFocus(tenantId = 'default'): Promise<string | null> {
    const entries = await this.search(tenantId, { category: 'working', limit: 1 });
    return entries[0]?.key || null;
  }
}

export const globalMemoryService = new GlobalMemoryService();
