import { executeStatement } from '../db/client';

type ConfigValueType = 'string' | 'integer' | 'decimal' | 'boolean' | 'json' | 'duration' | 'percentage' | 'enum';

interface ConfigValue {
  key: string;
  value: unknown;
  valueType: ConfigValueType;
  displayName: string;
  description?: string;
  unit?: string;
  isOverridden: boolean;
}

interface ConfigDefinition {
  key: string;
  categoryId: string;
  valueType: ConfigValueType;
  displayName: string;
  description?: string;
  unit?: string;
  defaultValue: unknown;
  minValue?: number;
  maxValue?: number;
  enumValues?: string[];
}

export class ConfigurationService {
  private cache: Map<string, { value: unknown; expiresAt: number }> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute

  async getConfig<T = unknown>(key: string, tenantId?: string): Promise<T | null> {
    const cacheKey = `${key}:${tenantId || 'global'}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    // Check for tenant override first
    if (tenantId) {
      const overrideResult = await executeStatement(
        `SELECT tco.*, sc.value_type
         FROM tenant_configuration_overrides tco
         JOIN system_configuration sc ON tco.config_key = sc.key
         WHERE tco.tenant_id = $1 AND tco.config_key = $2 
         AND tco.is_active = true
         AND (tco.expires_at IS NULL OR tco.expires_at > NOW())`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'key', value: { stringValue: key } },
        ]
      );

      if (overrideResult.rows.length > 0) {
        const row = overrideResult.rows[0] as Record<string, unknown>;
        const value = this.extractValue(row, String(row.value_type) as ConfigValueType);
        this.cache.set(cacheKey, { value, expiresAt: Date.now() + this.CACHE_TTL });
        return value as T;
      }
    }

    // Get system default
    const result = await executeStatement(
      `SELECT * FROM system_configuration WHERE key = $1`,
      [{ name: 'key', value: { stringValue: key } }]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0] as Record<string, unknown>;
    const value = this.extractValue(row, String(row.value_type) as ConfigValueType);
    this.cache.set(cacheKey, { value, expiresAt: Date.now() + this.CACHE_TTL });
    
    return value as T;
  }

  async getConfigWithMetadata(key: string, tenantId?: string): Promise<ConfigValue | null> {
    const result = await executeStatement(
      `SELECT * FROM system_configuration WHERE key = $1`,
      [{ name: 'key', value: { stringValue: key } }]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0] as Record<string, unknown>;
    const valueType = String(row.value_type) as ConfigValueType;
    let value = this.extractValue(row, valueType);
    let isOverridden = false;

    // Check for tenant override
    if (tenantId) {
      const overrideResult = await executeStatement(
        `SELECT * FROM tenant_configuration_overrides 
         WHERE tenant_id = $1 AND config_key = $2 AND is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'key', value: { stringValue: key } },
        ]
      );

      if (overrideResult.rows.length > 0) {
        value = this.extractValue(overrideResult.rows[0] as Record<string, unknown>, valueType);
        isOverridden = true;
      }
    }

    return {
      key,
      value,
      valueType,
      displayName: String(row.display_name),
      description: row.description ? String(row.description) : undefined,
      unit: row.unit ? String(row.unit) : undefined,
      isOverridden,
    };
  }

  async setConfig(key: string, value: unknown, updatedBy?: string): Promise<void> {
    const configResult = await executeStatement(
      `SELECT value_type FROM system_configuration WHERE key = $1`,
      [{ name: 'key', value: { stringValue: key } }]
    );

    if (configResult.rows.length === 0) {
      throw new Error(`Configuration key not found: ${key}`);
    }

    const valueType = String((configResult.rows[0] as Record<string, unknown>).value_type) as ConfigValueType;
    const updateClause = this.buildUpdateClause(valueType, value);

    await executeStatement(
      `UPDATE system_configuration 
       SET ${updateClause.field} = $2, updated_at = NOW(), updated_by = $3
       WHERE key = $1`,
      [
        { name: 'key', value: { stringValue: key } },
        updateClause.param,
        { name: 'updatedBy', value: updatedBy ? { stringValue: updatedBy } : { isNull: true } },
      ] as unknown as Parameters<typeof executeStatement>[1]
    );

    // Log audit
    await this.logAudit(key, null, 'update', value, updatedBy);

    // Invalidate cache
    this.invalidateCache(key);
  }

  async setTenantOverride(
    tenantId: string,
    key: string,
    value: unknown,
    reason?: string,
    approvedBy?: string,
    expiresAt?: Date
  ): Promise<void> {
    const configResult = await executeStatement(
      `SELECT value_type FROM system_configuration WHERE key = $1`,
      [{ name: 'key', value: { stringValue: key } }]
    );

    if (configResult.rows.length === 0) {
      throw new Error(`Configuration key not found: ${key}`);
    }

    const valueType = String((configResult.rows[0] as Record<string, unknown>).value_type) as ConfigValueType;
    const updateClause = this.buildUpdateClause(valueType, value);

    await executeStatement(
      `INSERT INTO tenant_configuration_overrides 
       (tenant_id, config_key, ${updateClause.field}, override_reason, approved_by, approved_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)
       ON CONFLICT (tenant_id, config_key) DO UPDATE SET
         ${updateClause.field} = $3,
         override_reason = $4,
         approved_by = $5,
         approved_at = NOW(),
         expires_at = $6,
         updated_at = NOW()`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'key', value: { stringValue: key } },
        updateClause.param,
        { name: 'reason', value: reason ? { stringValue: reason } : { isNull: true } },
        { name: 'approvedBy', value: approvedBy ? { stringValue: approvedBy } : { isNull: true } },
        { name: 'expiresAt', value: expiresAt ? { stringValue: expiresAt.toISOString() } : { isNull: true } },
      ] as unknown as Parameters<typeof executeStatement>[1]
    );

    await this.logAudit(key, tenantId, 'override', value, approvedBy, reason);
    this.invalidateCache(key, tenantId);
  }

  async removeTenantOverride(tenantId: string, key: string, removedBy?: string): Promise<void> {
    await executeStatement(
      `UPDATE tenant_configuration_overrides 
       SET is_active = false, updated_at = NOW()
       WHERE tenant_id = $1 AND config_key = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'key', value: { stringValue: key } },
      ]
    );

    await this.logAudit(key, tenantId, 'revert', null, removedBy);
    this.invalidateCache(key, tenantId);
  }

  async getConfigsByCategory(categoryId: string, tenantId?: string): Promise<ConfigValue[]> {
    const result = await executeStatement(
      `SELECT * FROM system_configuration WHERE category_id = $1 ORDER BY display_name`,
      [{ name: 'categoryId', value: { stringValue: categoryId } }]
    );

    const configs: ConfigValue[] = [];
    for (const row of result.rows) {
      const r = row as Record<string, unknown>;
      const config = await this.getConfigWithMetadata(String(r.key), tenantId);
      if (config) configs.push(config);
    }

    return configs;
  }

  async getCategories(): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT * FROM configuration_categories ORDER BY display_order`,
      []
    );
    return result.rows;
  }

  async getAuditLog(key?: string, tenantId?: string, limit: number = 50): Promise<unknown[]> {
    let sql = `SELECT * FROM configuration_audit_log WHERE 1=1`;
    const params: Array<{ name: string; value: { stringValue: string } }> = [];

    if (key) {
      sql += ` AND config_key = $${params.length + 1}`;
      params.push({ name: 'key', value: { stringValue: key } });
    }

    if (tenantId) {
      sql += ` AND tenant_id = $${params.length + 1}`;
      params.push({ name: 'tenantId', value: { stringValue: tenantId } });
    }

    sql += ` ORDER BY created_at DESC LIMIT ${limit}`;

    const result = await executeStatement(sql, params as Parameters<typeof executeStatement>[1]);
    return result.rows;
  }

  private extractValue(row: Record<string, unknown>, valueType: ConfigValueType): unknown {
    switch (valueType) {
      case 'string':
      case 'enum':
        return row.value_string;
      case 'integer':
      case 'duration':
        return row.value_integer ? parseInt(String(row.value_integer), 10) : null;
      case 'decimal':
      case 'percentage':
        return row.value_decimal ? parseFloat(String(row.value_decimal)) : null;
      case 'boolean':
        return row.value_boolean;
      case 'json':
        return typeof row.value_json === 'string' ? JSON.parse(row.value_json) : row.value_json;
      default:
        return row.value_string;
    }
  }

  private buildUpdateClause(valueType: ConfigValueType, value: unknown): { field: string; param: { name: string; value: Record<string, unknown> } } {
    switch (valueType) {
      case 'string':
      case 'enum':
        return { field: 'value_string', param: { name: 'value', value: { stringValue: String(value) } } };
      case 'integer':
      case 'duration':
        return { field: 'value_integer', param: { name: 'value', value: { longValue: Number(value) } } };
      case 'decimal':
      case 'percentage':
        return { field: 'value_decimal', param: { name: 'value', value: { doubleValue: Number(value) } } };
      case 'boolean':
        return { field: 'value_boolean', param: { name: 'value', value: { booleanValue: Boolean(value) } } };
      case 'json':
        return { field: 'value_json', param: { name: 'value', value: { stringValue: JSON.stringify(value) } } };
      default:
        return { field: 'value_string', param: { name: 'value', value: { stringValue: String(value) } } };
    }
  }

  private async logAudit(
    key: string,
    tenantId: string | null,
    action: string,
    newValue: unknown,
    changedBy?: string,
    reason?: string
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO configuration_audit_log (config_key, tenant_id, action, new_value, changed_by, change_reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        { name: 'key', value: { stringValue: key } },
        { name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } },
        { name: 'action', value: { stringValue: action } },
        { name: 'newValue', value: { stringValue: JSON.stringify(newValue) } },
        { name: 'changedBy', value: changedBy ? { stringValue: changedBy } : { isNull: true } },
        { name: 'reason', value: reason ? { stringValue: reason } : { isNull: true } },
      ]
    );
  }

  private invalidateCache(key: string, tenantId?: string): void {
    const cacheKey = `${key}:${tenantId || 'global'}`;
    this.cache.delete(cacheKey);
    this.cache.delete(`${key}:global`);
  }
}

export const configurationService = new ConfigurationService();
