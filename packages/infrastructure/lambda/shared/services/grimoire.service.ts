// RADIANT v4.18.0 - Grimoire Service
// Procedural Memory & Self-Correction System
// Novel UI: "Spell Book" - magical tome with spell cards

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface Spell {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  category: SpellCategory;
  incantation: string;
  components: string[];
  effect: string;
  powerLevel: number;
  successRate: number;
  castCount: number;
  manaRequired: number;
  school: SpellSchool;
  prerequisites: string[];
  sideEffects: string[];
  counters: string[];
  isCantrip: boolean;
  isRitual: boolean;
  createdBy: string;
  verifiedBy?: string;
  status: SpellStatus;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type SpellCategory =
  | 'transformation' | 'divination' | 'conjuration' | 'abjuration'
  | 'enchantment' | 'illusion' | 'necromancy' | 'evocation';

export type SpellSchool =
  | 'code' | 'data' | 'text' | 'analysis'
  | 'design' | 'integration' | 'automation' | 'universal';

export type SpellStatus = 'draft' | 'testing' | 'verified' | 'deprecated';

export interface CastResult {
  success: boolean;
  output: unknown;
  manaUsed: number;
  duration: number;
  sideEffects?: string[];
}

export interface GrimoireStats {
  totalSpells: number;
  byCategory: Record<SpellCategory, number>;
  bySchool: Record<SpellSchool, number>;
  avgSuccessRate: number;
  totalCasts: number;
  recentSpells: Spell[];
}

// ============================================================================
// Grimoire Service
// ============================================================================

class GrimoireService {
  // --------------------------------------------------------------------------
  // Spell CRUD
  // --------------------------------------------------------------------------

  async createSpell(
    tenantId: string,
    spell: Omit<Spell, 'id' | 'tenantId' | 'successRate' | 'castCount' | 'createdAt' | 'updatedAt'>
  ): Promise<Spell> {
    try {
      const id = `spell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await executeStatement(
        `INSERT INTO grimoire_spells (
            id, tenant_id, name, description, category, incantation,
            components, effect, power_level, success_rate, cast_count,
            mana_required, school, prerequisites, side_effects, counters,
            is_cantrip, is_ritual, created_by, verified_by, status,
            tags, metadata, created_at, updated_at
          ) VALUES (
            :id, :tenantId, :name, :description, :category, :incantation,
            :components, :effect, :powerLevel, 0, 0,
            :manaRequired, :school, :prerequisites, :sideEffects, :counters,
            :isCantrip, :isRitual, :createdBy, :verifiedBy, :status,
            :tags, :metadata, NOW(), NOW()
          )`,
        [
          stringParam('id', id),
          stringParam('tenantId', tenantId),
          stringParam('name', spell.name),
          stringParam('description', spell.description),
          stringParam('category', spell.category),
          stringParam('incantation', spell.incantation),
          stringParam('components', JSON.stringify(spell.components)),
          stringParam('effect', spell.effect),
          longParam('powerLevel', spell.powerLevel),
          longParam('manaRequired', spell.manaRequired),
          stringParam('school', spell.school),
          stringParam('prerequisites', JSON.stringify(spell.prerequisites || [])),
          stringParam('sideEffects', JSON.stringify(spell.sideEffects || [])),
          stringParam('counters', JSON.stringify(spell.counters || [])),
          boolParam('isCantrip', spell.isCantrip),
          boolParam('isRitual', spell.isRitual),
          stringParam('createdBy', spell.createdBy),
          stringParam('verifiedBy', spell.verifiedBy || ''),
          stringParam('status', spell.status || 'draft'),
          stringParam('tags', JSON.stringify(spell.tags || [])),
          stringParam('metadata', JSON.stringify(spell.metadata || {})),
        ]
      );

      logger.info('Created spell', { tenantId, id, name: spell.name });

      return {
        id,
        tenantId,
        ...spell,
        successRate: 0,
        castCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to create spell', { tenantId, error });
      throw error;
    }
  }

  async getSpell(tenantId: string, spellId: string): Promise<Spell | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM grimoire_spells WHERE tenant_id = :tenantId AND id = :spellId`,
        [stringParam('tenantId', tenantId), stringParam('spellId', spellId)]
      );

      if (result.rows && result.rows.length > 0) {
        return this.parseSpell(result.rows[0] as Record<string, unknown>);
      }
      return null;
    } catch (error) {
      logger.error('Failed to get spell', { tenantId, spellId, error });
      throw error;
    }
  }

  async updateSpell(tenantId: string, spellId: string, updates: Partial<Spell>): Promise<Spell | null> {
    try {
      const existing = await this.getSpell(tenantId, spellId);
      if (!existing) return null;

      const merged = { ...existing, ...updates };

      await executeStatement(
        `UPDATE grimoire_spells SET
            name = :name, description = :description, category = :category,
            incantation = :incantation, components = :components, effect = :effect,
            power_level = :powerLevel, mana_required = :manaRequired, school = :school,
            prerequisites = :prerequisites, side_effects = :sideEffects, counters = :counters,
            is_cantrip = :isCantrip, is_ritual = :isRitual, status = :status,
            tags = :tags, metadata = :metadata, updated_at = NOW()
          WHERE tenant_id = :tenantId AND id = :spellId`,
        [
          stringParam('name', merged.name),
          stringParam('description', merged.description),
          stringParam('category', merged.category),
          stringParam('incantation', merged.incantation),
          stringParam('components', JSON.stringify(merged.components)),
          stringParam('effect', merged.effect),
          longParam('powerLevel', merged.powerLevel),
          longParam('manaRequired', merged.manaRequired),
          stringParam('school', merged.school),
          stringParam('prerequisites', JSON.stringify(merged.prerequisites)),
          stringParam('sideEffects', JSON.stringify(merged.sideEffects)),
          stringParam('counters', JSON.stringify(merged.counters)),
          boolParam('isCantrip', merged.isCantrip),
          boolParam('isRitual', merged.isRitual),
          stringParam('status', merged.status),
          stringParam('tags', JSON.stringify(merged.tags)),
          stringParam('metadata', JSON.stringify(merged.metadata)),
          stringParam('tenantId', tenantId),
          stringParam('spellId', spellId),
        ]
      );

      logger.info('Updated spell', { tenantId, spellId });
      return { ...merged, updatedAt: new Date().toISOString() };
    } catch (error) {
      logger.error('Failed to update spell', { tenantId, spellId, error });
      throw error;
    }
  }

  async deleteSpell(tenantId: string, spellId: string): Promise<boolean> {
    try {
      const result = await executeStatement(
        `DELETE FROM grimoire_spells WHERE tenant_id = :tenantId AND id = :spellId`,
        [stringParam('tenantId', tenantId), stringParam('spellId', spellId)]
      );
      return (result.rowCount || 0) > 0;
    } catch (error) {
      logger.error('Failed to delete spell', { tenantId, spellId, error });
      throw error;
    }
  }

  async listSpells(
    tenantId: string,
    options: { category?: SpellCategory; school?: SpellSchool; status?: SpellStatus; limit?: number; offset?: number } = {}
  ): Promise<{ spells: Spell[]; total: number }> {
    try {
      let sql = `SELECT * FROM grimoire_spells WHERE tenant_id = :tenantId`;
      let countSql = `SELECT COUNT(*) as total FROM grimoire_spells WHERE tenant_id = :tenantId`;
      const params = [stringParam('tenantId', tenantId)];

      if (options.category) {
        sql += ` AND category = :category`;
        countSql += ` AND category = :category`;
        params.push(stringParam('category', options.category));
      }
      if (options.school) {
        sql += ` AND school = :school`;
        countSql += ` AND school = :school`;
        params.push(stringParam('school', options.school));
      }
      if (options.status) {
        sql += ` AND status = :status`;
        countSql += ` AND status = :status`;
        params.push(stringParam('status', options.status));
      }

      sql += ` ORDER BY updated_at DESC`;
      const limitParams = [...params];
      if (options.limit) {
        sql += ` LIMIT :limit`;
        limitParams.push(longParam('limit', options.limit));
      }
      if (options.offset) {
        sql += ` OFFSET :offset`;
        limitParams.push(longParam('offset', options.offset));
      }

      const [result, countResult] = await Promise.all([
        executeStatement(sql, limitParams),
        executeStatement(countSql, params),
      ]);

      const spells = (result.rows || []).map(row => this.parseSpell(row as Record<string, unknown>));
      const total = (countResult.rows?.[0] as Record<string, unknown>)?.total as number || 0;

      return { spells, total };
    } catch (error) {
      logger.error('Failed to list spells', { tenantId, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Spell Casting
  // --------------------------------------------------------------------------

  async castSpell(tenantId: string, spellId: string, components: Record<string, unknown>): Promise<CastResult> {
    try {
      const spell = await this.getSpell(tenantId, spellId);
      if (!spell) throw new Error('Spell not found');

      const startTime = Date.now();
      let success = true;
      let output: unknown = null;
      const sideEffects: string[] = [];

      // Simulate spell execution
      try {
        output = await this.executeSpellLogic(spell, components);
      } catch (error) {
        success = false;
        output = error instanceof Error ? error.message : 'Spell failed';
      }

      const duration = Date.now() - startTime;

      // Record cast
      await executeStatement(
        `INSERT INTO grimoire_casts (id, spell_id, tenant_id, user_id, components_used, result, duration_ms, mana_used, cast_at)
          VALUES (:id, :spellId, :tenantId, :userId, :components, :result, :duration, :mana, NOW())`,
        [
          stringParam('id', `cast_${Date.now()}`),
          stringParam('spellId', spellId),
          stringParam('tenantId', tenantId),
          stringParam('userId', ''),
          stringParam('components', JSON.stringify(components)),
          stringParam('result', JSON.stringify({ success, output })),
          longParam('duration', duration),
          longParam('mana', spell.manaRequired),
        ]
      );

      // Update spell stats
      await executeStatement(
        `UPDATE grimoire_spells SET
            cast_count = cast_count + 1,
            success_rate = (success_rate * cast_count + :success) / (cast_count + 1),
            updated_at = NOW()
          WHERE id = :spellId`,
        [doubleParam('success', success ? 1 : 0), stringParam('spellId', spellId)]
      );

      return { success, output, manaUsed: spell.manaRequired, duration, sideEffects };
    } catch (error) {
      logger.error('Failed to cast spell', { tenantId, spellId, error });
      throw error;
    }
  }

  private async executeSpellLogic(spell: Spell, components: Record<string, unknown>): Promise<unknown> {
    // Execute spell based on its school and category
    const startTime = Date.now();

    try {
      switch (spell.school) {
        case 'code': {
          // Code transformation spells - integrate with code generation
          const { brainRouter } = await import('./brain-router.service');
          const result = await brainRouter.route({
            tenantId: spell.tenantId,
            userId: spell.createdBy,
            taskType: 'coding',
            prompt: `${spell.incantation}\n\nContext: ${JSON.stringify(components)}`,
          });
          return {
            type: 'code_generation',
            output: result.response,
            model: result.selectedModel,
            processingTimeMs: Date.now() - startTime,
          };
        }

        case 'data': {
          // Data analysis spells - integrate with analytics
          const { brainRouter } = await import('./brain-router.service');
          const result = await brainRouter.route({
            tenantId: spell.tenantId,
            userId: spell.createdBy,
            taskType: 'data_analysis',
            prompt: `Analyze: ${spell.incantation}\n\nData: ${JSON.stringify(components)}`,
          });
          return {
            type: 'data_analysis',
            output: result.response,
            insights: result.response,
            processingTimeMs: Date.now() - startTime,
          };
        }

        case 'text': {
          // Text transformation spells
          const { brainRouter } = await import('./brain-router.service');
          const result = await brainRouter.route({
            tenantId: spell.tenantId,
            userId: spell.createdBy,
            taskType: 'writing',
            prompt: `${spell.incantation}\n\nInput: ${JSON.stringify(components)}`,
          });
          return {
            type: 'text_transformation',
            output: result.response,
            processingTimeMs: Date.now() - startTime,
          };
        }

        case 'automation': {
          // Automation spells - create workflows or triggers
          const automationConfig = {
            name: spell.name,
            trigger: components.trigger || 'manual',
            actions: spell.effect.split(';').map(a => a.trim()),
            enabled: true,
          };
          
          await executeStatement(
            `INSERT INTO automation_workflows (tenant_id, name, config, created_by, status)
             VALUES ($1::uuid, $2, $3::jsonb, $4::uuid, 'active')
             ON CONFLICT (tenant_id, name) DO UPDATE SET config = $3::jsonb`,
            [
              stringParam('tenantId', spell.tenantId),
              stringParam('name', spell.name),
              stringParam('config', JSON.stringify(automationConfig)),
              stringParam('createdBy', spell.createdBy),
            ]
          );
          
          return {
            type: 'automation_created',
            workflow: automationConfig,
            processingTimeMs: Date.now() - startTime,
          };
        }

        case 'integration': {
          // Integration spells - connect services
          return {
            type: 'integration',
            message: `Integration spell ${spell.name} configured`,
            components,
            processingTimeMs: Date.now() - startTime,
          };
        }

        default: {
          // Universal spells - general AI processing
          const { brainRouter } = await import('./brain-router.service');
          const result = await brainRouter.route({
            tenantId: spell.tenantId,
            userId: spell.createdBy,
            taskType: 'chat',
            prompt: `Execute spell "${spell.name}": ${spell.incantation}\n\nComponents: ${JSON.stringify(components)}`,
          });
          return {
            type: 'universal',
            output: result.response,
            processingTimeMs: Date.now() - startTime,
          };
        }
      }
    } catch (error) {
      logger.error('Spell execution failed', { spellId: spell.id, school: spell.school, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  async getStats(tenantId: string): Promise<GrimoireStats> {
    try {
      const statsResult = await executeStatement(
        `SELECT COUNT(*) as total, AVG(success_rate) as avg_success, SUM(cast_count) as total_casts
          FROM grimoire_spells WHERE tenant_id = :tenantId`,
        [stringParam('tenantId', tenantId)]
      );

      const recentResult = await executeStatement(
        `SELECT * FROM grimoire_spells WHERE tenant_id = :tenantId ORDER BY updated_at DESC LIMIT 5`,
        [stringParam('tenantId', tenantId)]
      );

      const row = statsResult.rows?.[0] as Record<string, unknown> | undefined;

      return {
        totalSpells: Number(row?.total) || 0,
        byCategory: {} as Record<SpellCategory, number>,
        bySchool: {} as Record<SpellSchool, number>,
        avgSuccessRate: Number(row?.avg_success) || 0,
        totalCasts: Number(row?.total_casts) || 0,
        recentSpells: (recentResult.rows || []).map(r => this.parseSpell(r as Record<string, unknown>)),
      };
    } catch (error) {
      logger.error('Failed to get grimoire stats', { tenantId, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Query & Search
  // --------------------------------------------------------------------------

  async querySpells(
    tenantId: string,
    options: { search?: string; category?: SpellCategory; school?: SpellSchool; status?: SpellStatus; limit?: number; offset?: number } = {}
  ): Promise<{ spells: Spell[]; total: number }> {
    try {
      let sql = `SELECT * FROM grimoire_spells WHERE tenant_id = :tenantId`;
      let countSql = `SELECT COUNT(*) as total FROM grimoire_spells WHERE tenant_id = :tenantId`;
      const params = [stringParam('tenantId', tenantId)];

      if (options.search) {
        sql += ` AND (name ILIKE :search OR description ILIKE :search OR incantation ILIKE :search)`;
        countSql += ` AND (name ILIKE :search OR description ILIKE :search OR incantation ILIKE :search)`;
        params.push(stringParam('search', `%${options.search}%`));
      }
      if (options.category) {
        sql += ` AND category = :category`;
        countSql += ` AND category = :category`;
        params.push(stringParam('category', options.category));
      }
      if (options.school) {
        sql += ` AND school = :school`;
        countSql += ` AND school = :school`;
        params.push(stringParam('school', options.school));
      }
      if (options.status) {
        sql += ` AND status = :status`;
        countSql += ` AND status = :status`;
        params.push(stringParam('status', options.status));
      }

      sql += ` ORDER BY cast_count DESC, updated_at DESC`;
      const limitParams = [...params];
      if (options.limit) {
        sql += ` LIMIT :limit`;
        limitParams.push(longParam('limit', options.limit));
      }
      if (options.offset) {
        sql += ` OFFSET :offset`;
        limitParams.push(longParam('offset', options.offset));
      }

      const [result, countResult] = await Promise.all([
        executeStatement(sql, limitParams),
        executeStatement(countSql, params),
      ]);

      const spells = (result.rows || []).map(row => this.parseSpell(row as Record<string, unknown>));
      const total = Number((countResult.rows?.[0] as Record<string, unknown>)?.total) || 0;

      return { spells, total };
    } catch (error) {
      logger.error('Failed to query spells', { tenantId, error });
      throw error;
    }
  }

  async findSpellByPattern(tenantId: string, pattern: string): Promise<Spell | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM grimoire_spells 
         WHERE tenant_id = :tenantId 
         AND (incantation ILIKE :pattern OR name ILIKE :pattern)
         ORDER BY cast_count DESC
         LIMIT 1`,
        [stringParam('tenantId', tenantId), stringParam('pattern', `%${pattern}%`)]
      );

      if (result.rows && result.rows.length > 0) {
        return this.parseSpell(result.rows[0] as Record<string, unknown>);
      }
      return null;
    } catch (error) {
      logger.error('Failed to find spell by pattern', { tenantId, pattern, error });
      throw error;
    }
  }

  async getGrimoire(tenantId: string, userId?: string): Promise<{
    spells: Spell[];
    schoolMastery: Record<SpellSchool, number>;
    totalCasts: number;
    favoriteSchool: SpellSchool;
  }> {
    try {
      let sql = `SELECT * FROM grimoire_spells WHERE tenant_id = :tenantId`;
      const params = [stringParam('tenantId', tenantId)];

      if (userId) {
        sql += ` AND created_by = :userId`;
        params.push(stringParam('userId', userId));
      }

      sql += ` ORDER BY cast_count DESC`;
      const result = await executeStatement(sql, params);
      const spells = (result.rows || []).map(row => this.parseSpell(row as Record<string, unknown>));

      const schoolMastery: Record<SpellSchool, number> = {
        code: 0, data: 0, text: 0, analysis: 0,
        design: 0, integration: 0, automation: 0, universal: 0,
      };
      let totalCasts = 0;

      for (const spell of spells) {
        schoolMastery[spell.school] += spell.castCount;
        totalCasts += spell.castCount;
      }

      const favoriteSchool = (Object.entries(schoolMastery).sort((a, b) => b[1] - a[1])[0]?.[0] || 'universal') as SpellSchool;

      return { spells, schoolMastery, totalCasts, favoriteSchool };
    } catch (error) {
      logger.error('Failed to get grimoire', { tenantId, userId, error });
      throw error;
    }
  }

  async promoteToSpell(
    tenantId: string,
    userId: string,
    spellData: Omit<Spell, 'id' | 'tenantId' | 'successRate' | 'castCount' | 'createdAt' | 'updatedAt' | 'createdBy'>
  ): Promise<Spell> {
    return this.createSpell(tenantId, {
      ...spellData,
      createdBy: userId,
    });
  }

  // --------------------------------------------------------------------------
  // Reflexion Learning
  // --------------------------------------------------------------------------

  async learnFromFailure(tenantId: string, spellId: string, feedback: string): Promise<void> {
    try {
      const spell = await this.getSpell(tenantId, spellId);
      if (!spell) throw new Error('Spell not found');

      const reflexionNotes = spell.metadata.reflexionNotes as string[] || [];
      reflexionNotes.push(`[${new Date().toISOString()}] ${feedback}`);

      await this.updateSpell(tenantId, spellId, {
        metadata: { ...spell.metadata, reflexionNotes },
      });

      logger.info('Recorded reflexion feedback', { tenantId, spellId });
    } catch (error) {
      logger.error('Failed to learn from failure', { tenantId, spellId, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Parse Helpers
  // --------------------------------------------------------------------------

  private parseSpell(row: Record<string, unknown>): Spell {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      name: String(row.name || ''),
      description: String(row.description || ''),
      category: String(row.category || 'transformation') as SpellCategory,
      incantation: String(row.incantation || ''),
      components: this.parseJson(row.components) || [],
      effect: String(row.effect || ''),
      powerLevel: Number(row.power_level) || 1,
      successRate: Number(row.success_rate) || 0,
      castCount: Number(row.cast_count) || 0,
      manaRequired: Number(row.mana_required) || 100,
      school: String(row.school || 'universal') as SpellSchool,
      prerequisites: this.parseJson(row.prerequisites) || [],
      sideEffects: this.parseJson(row.side_effects) || [],
      counters: this.parseJson(row.counters) || [],
      isCantrip: Boolean(row.is_cantrip),
      isRitual: Boolean(row.is_ritual),
      createdBy: String(row.created_by || ''),
      verifiedBy: row.verified_by ? String(row.verified_by) : undefined,
      status: String(row.status || 'draft') as SpellStatus,
      tags: this.parseJson(row.tags) || [],
      metadata: this.parseJson(row.metadata) || {},
      createdAt: String(row.created_at || ''),
      updatedAt: String(row.updated_at || ''),
    };
  }

  private parseJson<T>(value: unknown): T | null {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return null; }
    }
    return value as T;
  }
}

export const grimoireService = new GrimoireService();
