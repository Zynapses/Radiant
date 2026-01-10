/**
 * RADIANT Genesis Cato Persona Service
 * Manages AI personas (moods) for Cato
 *
 * NAMING CONVENTION:
 * - CATO = The AI persona name users interact with
 * - MOODS = Operating modes (Balanced, Scout, Sage, Spark, Guide)
 * - Default mood is "Balanced" (renamed from "Cato")
 */

import { query } from '../database';
import { Persona, PersonaDrives, CMatrix, DEFAULT_PERSONA_NAME } from './types';
import { catoStateService } from './redis.service';

export class PersonaService {
  /**
   * Get persona by ID
   */
  async getPersona(personaId: string): Promise<Persona | null> {
    const result = await query(
      `SELECT * FROM genesis_personas WHERE id = $1 AND is_active = TRUE`,
      [personaId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToPersona(result.rows[0]);
  }

  /**
   * Get persona by name
   */
  async getPersonaByName(name: string): Promise<Persona | null> {
    const result = await query(
      `SELECT * FROM genesis_personas WHERE name = $1 AND is_active = TRUE`,
      [name]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToPersona(result.rows[0]);
  }

  /**
   * Get default persona (Balanced)
   */
  async getDefaultPersona(): Promise<Persona> {
    const result = await query(
      `SELECT * FROM genesis_personas WHERE is_default = TRUE AND is_active = TRUE LIMIT 1`
    );

    if (result.rows.length === 0) {
      // Fallback to 'balanced' by name
      const balancedResult = await query(
        `SELECT * FROM genesis_personas WHERE name = $1 AND is_active = TRUE LIMIT 1`,
        [DEFAULT_PERSONA_NAME]
      );

      if (balancedResult.rows.length === 0) {
        throw new Error('Default persona (Balanced) not found. Run migration 153.');
      }

      return this.mapRowToPersona(balancedResult.rows[0]);
    }

    return this.mapRowToPersona(result.rows[0]);
  }

  /**
   * Get all system personas (moods)
   */
  async getSystemPersonas(): Promise<Persona[]> {
    const result = await query(
      `SELECT * FROM genesis_personas WHERE scope = 'system' AND is_active = TRUE ORDER BY name`
    );

    return result.rows.map((row: Record<string, unknown>) => this.mapRowToPersona(row));
  }

  /**
   * Get personas available to a tenant
   */
  async getTenantPersonas(tenantId: string): Promise<Persona[]> {
    const result = await query(
      `SELECT * FROM genesis_personas 
       WHERE (scope = 'system' OR tenant_id = $1) AND is_active = TRUE 
       ORDER BY scope, name`,
      [tenantId]
    );

    return result.rows.map((row: Record<string, unknown>) => this.mapRowToPersona(row));
  }

  /**
   * Get user's selected persona
   */
  async getUserSelectedPersona(userId: string): Promise<Persona | null> {
    const result = await query(
      `SELECT p.* FROM genesis_personas p
       JOIN user_persona_selections ups ON p.id = ups.persona_id
       WHERE ups.user_id = $1 AND ups.is_active = TRUE AND p.is_active = TRUE
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToPersona(result.rows[0]);
  }

  /**
   * Get effective persona for a session
   * 
   * MOOD SELECTION PRIORITY (per Genesis Cato v2.3.1 spec):
   * 1. Recovery Override - Epistemic Recovery forces Scout mood
   * 2. API Override - Explicit mood set via API call
   * 3. User Preference - User's saved mood selection
   * 4. Tenant Default - Admin-configured tenant default
   * 5. System Default - Balanced mood
   */
  async getEffectivePersona(
    sessionId: string, 
    userId: string, 
    tenantId?: string
  ): Promise<Persona> {
    // Priority 1: Recovery Override (from Epistemic Recovery)
    const recoveryOverride = await catoStateService.getPersonaOverride(sessionId);
    if (recoveryOverride) {
      const overridePersona = await this.getPersonaByName(recoveryOverride);
      if (overridePersona) {
        return overridePersona;
      }
    }

    // Priority 2: API Override (temporary session override)
    if (tenantId) {
      const apiOverride = await this.getApiOverride(tenantId, sessionId);
      if (apiOverride) {
        const apiPersona = await this.getPersonaByName(apiOverride);
        if (apiPersona) {
          return apiPersona;
        }
      }
    }

    // Priority 3: User Preference
    const userSelection = await this.getUserSelectedPersona(userId);
    if (userSelection) {
      return userSelection;
    }

    // Priority 4: Tenant Default
    const tenantDefault = tenantId ? await this.getTenantDefaultPersona(tenantId) : null;
    if (tenantDefault) {
      return tenantDefault;
    }

    // Priority 5: System Default (Balanced)
    return this.getDefaultPersona();
  }

  /**
   * Get API-level persona override for a session
   */
  private async getApiOverride(tenantId: string, sessionId: string): Promise<string | null> {
    try {
      const result = await query(
        `SELECT persona_name FROM cato_api_persona_overrides 
         WHERE tenant_id = $1 AND session_id = $2 AND expires_at > NOW()`,
        [tenantId, sessionId]
      );
      return result.rows.length > 0 ? result.rows[0].persona_name : null;
    } catch {
      return null;
    }
  }

  /**
   * Set API-level persona override for a session
   */
  async setApiOverride(params: {
    tenantId: string;
    sessionId: string;
    userId?: string;
    personaName: string;
    durationMinutes: number;
    reason?: string;
    createdBy?: string;
  }): Promise<void> {
    const expiresAt = new Date(Date.now() + params.durationMinutes * 60 * 1000);
    
    await query(
      `INSERT INTO cato_api_persona_overrides 
        (tenant_id, session_id, user_id, persona_name, expires_at, reason, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tenant_id, session_id) DO UPDATE SET
         persona_name = EXCLUDED.persona_name,
         expires_at = EXCLUDED.expires_at,
         reason = EXCLUDED.reason`,
      [
        params.tenantId,
        params.sessionId,
        params.userId || null,
        params.personaName,
        expiresAt,
        params.reason || null,
        params.createdBy || null,
      ]
    );
  }

  /**
   * Clear API-level persona override
   */
  async clearApiOverride(tenantId: string, sessionId: string): Promise<void> {
    await query(
      `DELETE FROM cato_api_persona_overrides WHERE tenant_id = $1 AND session_id = $2`,
      [tenantId, sessionId]
    );
  }

  /**
   * Get tenant-configured default persona
   */
  async getTenantDefaultPersona(tenantId: string): Promise<Persona | null> {
    try {
      const result = await query(
        `SELECT default_mood FROM cato_tenant_config WHERE tenant_id = $1`,
        [tenantId]
      );
      
      if (result.rows.length > 0 && result.rows[0].default_mood) {
        const defaultMood = result.rows[0].default_mood;
        // Only return if different from system default
        if (defaultMood !== 'balanced') {
          return this.getPersonaByName(defaultMood);
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Set tenant default persona
   */
  async setTenantDefaultPersona(tenantId: string, personaName: string): Promise<void> {
    await query(
      `UPDATE cato_tenant_config SET default_mood = $1, updated_at = NOW() WHERE tenant_id = $2`,
      [personaName, tenantId]
    );
  }

  /**
   * Set user's persona selection
   */
  async setUserPersona(userId: string, personaId: string): Promise<void> {
    // Deactivate previous selection
    await query(
      `UPDATE user_persona_selections SET is_active = FALSE WHERE user_id = $1`,
      [userId]
    );

    // Insert new selection
    await query(
      `INSERT INTO user_persona_selections (user_id, persona_id, is_active)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (user_id, persona_id) DO UPDATE SET is_active = TRUE, updated_at = NOW()`,
      [userId, personaId]
    );
  }

  /**
   * Derive C-Matrix from persona drives
   */
  deriveCMatrix(drives: PersonaDrives): CMatrix {
    return {
      dimensions: {
        CURIOSITY: drives.curiosity,
        ACHIEVEMENT: drives.achievement,
        SERVICE: drives.service,
        DISCOVERY: drives.discovery,
        REFLECTION: drives.reflection,
      },
      surpriseThresholds: {
        HIGH_SURPRISE: drives.curiosity,
        INACTIVITY_SURPRISE: 1 - drives.reflection,
      },
    };
  }

  /**
   * Create a tenant-specific persona
   */
  async createTenantPersona(params: {
    tenantId: string;
    name: string;
    displayName: string;
    description: string;
    drives: PersonaDrives;
    defaultGamma: number;
    voice: Persona['voice'];
    presentation: Persona['presentation'];
    behavior: Persona['behavior'];
  }): Promise<Persona> {
    const cMatrix = this.deriveCMatrix(params.drives);

    const result = await query(
      `INSERT INTO genesis_personas (
        name, display_name, description, scope, tenant_id,
        drives, derived_c_matrix, default_gamma,
        voice, presentation, behavior, is_default, is_active
      ) VALUES ($1, $2, $3, 'tenant', $4, $5, $6, $7, $8, $9, $10, FALSE, TRUE)
      RETURNING *`,
      [
        params.name,
        params.displayName,
        params.description,
        params.tenantId,
        JSON.stringify(params.drives),
        JSON.stringify(cMatrix),
        params.defaultGamma,
        JSON.stringify(params.voice),
        JSON.stringify(params.presentation),
        JSON.stringify(params.behavior),
      ]
    );

    return this.mapRowToPersona(result.rows[0]);
  }

  /**
   * Update a tenant persona
   */
  async updatePersona(
    personaId: string,
    tenantId: string,
    updates: Partial<{
      displayName: string;
      description: string;
      drives: PersonaDrives;
      defaultGamma: number;
      voice: Persona['voice'];
      presentation: Persona['presentation'];
      behavior: Persona['behavior'];
      isActive: boolean;
    }>
  ): Promise<Persona | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.displayName !== undefined) {
      setClauses.push(`display_name = $${paramIndex++}`);
      values.push(updates.displayName);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.drives !== undefined) {
      setClauses.push(`drives = $${paramIndex++}`);
      values.push(JSON.stringify(updates.drives));
      setClauses.push(`derived_c_matrix = $${paramIndex++}`);
      values.push(JSON.stringify(this.deriveCMatrix(updates.drives)));
    }
    if (updates.defaultGamma !== undefined) {
      setClauses.push(`default_gamma = $${paramIndex++}`);
      values.push(updates.defaultGamma);
    }
    if (updates.voice !== undefined) {
      setClauses.push(`voice = $${paramIndex++}`);
      values.push(JSON.stringify(updates.voice));
    }
    if (updates.presentation !== undefined) {
      setClauses.push(`presentation = $${paramIndex++}`);
      values.push(JSON.stringify(updates.presentation));
    }
    if (updates.behavior !== undefined) {
      setClauses.push(`behavior = $${paramIndex++}`);
      values.push(JSON.stringify(updates.behavior));
    }
    if (updates.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }

    if (setClauses.length === 0) {
      return this.getPersona(personaId);
    }

    setClauses.push('updated_at = NOW()');
    values.push(personaId, tenantId);

    const result = await query(
      `UPDATE genesis_personas 
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex} AND scope = 'tenant'
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToPersona(result.rows[0]);
  }

  /**
   * Map database row to Persona object
   */
  private mapRowToPersona(row: Record<string, unknown>): Persona {
    return {
      id: row.id as string,
      name: row.name as string,
      displayName: row.display_name as string,
      description: row.description as string,
      scope: row.scope as 'system' | 'tenant' | 'user',
      tenantId: row.tenant_id as string | undefined,
      userId: row.user_id as string | undefined,
      drives: row.drives as PersonaDrives,
      derivedCMatrix: row.derived_c_matrix as CMatrix | undefined,
      defaultGamma: parseFloat(row.default_gamma as string),
      voice: row.voice as Persona['voice'],
      presentation: row.presentation as Persona['presentation'],
      behavior: row.behavior as Persona['behavior'],
      isDefault: row.is_default as boolean,
      isActive: row.is_active as boolean,
      createdAt: row.created_at as Date | undefined,
      updatedAt: row.updated_at as Date | undefined,
    };
  }
}

export const personaService = new PersonaService();
