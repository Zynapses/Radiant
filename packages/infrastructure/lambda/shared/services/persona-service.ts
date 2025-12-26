import { executeStatement, toSqlParams } from '../db/client';
import type { SqlParameter } from '@aws-sdk/client-rds-data';

export interface PersonaCreate {
  name: string;
  displayName?: string;
  systemPrompt: string;
  avatarUrl?: string;
  voiceId?: string;
  traits?: string[];
  domains?: string[];
  style?: Record<string, unknown>;
  isPublic?: boolean;
}

export interface FocusMode {
  id: string;
  tenantId?: string;
  modeName: string;
  displayName: string;
  description?: string;
  icon?: string;
  systemPrompt: string;
  defaultModel?: string;
  settings: Record<string, unknown>;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
}

export interface UserPersona {
  id: string;
  tenantId: string;
  userId: string;
  personaName: string;
  displayName?: string;
  avatarUrl?: string;
  systemPrompt: string;
  voiceId?: string;
  personalityTraits: string[];
  knowledgeDomains: string[];
  conversationStyle: Record<string, unknown>;
  isPublic: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class PersonaService {
  async getFocusModes(tenantId?: string): Promise<FocusMode[]> {
    const result = await executeStatement(
      `SELECT id, tenant_id, mode_name, display_name, description, icon,
              system_prompt, default_model, settings, is_system, is_active, created_at
       FROM focus_modes
       WHERE is_active = true AND (is_system = true OR tenant_id IS NULL OR tenant_id = $1)
       ORDER BY is_system DESC, mode_name`,
      [{ name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } }]
    );

    return result.rows as unknown as FocusMode[];
  }

  async getFocusMode(modeId: string): Promise<FocusMode | null> {
    const result = await executeStatement(
      `SELECT id, tenant_id, mode_name, display_name, description, icon,
              system_prompt, default_model, settings, is_system, is_active, created_at
       FROM focus_modes WHERE id = $1`,
      [{ name: 'modeId', value: { stringValue: modeId } }]
    );

    return result.rows.length > 0 ? (result.rows[0] as unknown as FocusMode) : null;
  }

  async createPersona(tenantId: string, userId: string, persona: PersonaCreate): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO user_personas (
         tenant_id, user_id, persona_name, display_name, system_prompt,
         avatar_url, voice_id, personality_traits, knowledge_domains,
         conversation_style, is_public
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11)
       RETURNING id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'personaName', value: { stringValue: persona.name } },
        { name: 'displayName', value: persona.displayName ? { stringValue: persona.displayName } : { isNull: true } },
        { name: 'systemPrompt', value: { stringValue: persona.systemPrompt } },
        { name: 'avatarUrl', value: persona.avatarUrl ? { stringValue: persona.avatarUrl } : { isNull: true } },
        { name: 'voiceId', value: persona.voiceId ? { stringValue: persona.voiceId } : { isNull: true } },
        { name: 'traits', value: { stringValue: JSON.stringify(persona.traits || []) } },
        { name: 'domains', value: { stringValue: JSON.stringify(persona.domains || []) } },
        { name: 'style', value: { stringValue: JSON.stringify(persona.style || {}) } },
        { name: 'isPublic', value: { booleanValue: persona.isPublic || false } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>)?.id || '');
  }

  async getUserPersonas(tenantId: string, userId: string): Promise<UserPersona[]> {
    const result = await executeStatement(
      `SELECT id, tenant_id, user_id, persona_name, display_name, avatar_url,
              system_prompt, voice_id, personality_traits, knowledge_domains,
              conversation_style, is_public, usage_count, created_at, updated_at
       FROM user_personas
       WHERE tenant_id = $1 AND (user_id = $2 OR is_public = true)
       ORDER BY usage_count DESC`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );

    return result.rows as unknown as UserPersona[];
  }

  async getPersona(personaId: string): Promise<UserPersona | null> {
    const result = await executeStatement(`SELECT * FROM user_personas WHERE id = $1`, [
      { name: 'personaId', value: { stringValue: personaId } },
    ]);

    return result.rows.length > 0 ? (result.rows[0] as unknown as UserPersona) : null;
  }

  async updatePersona(personaId: string, updates: Partial<PersonaCreate>): Promise<void> {
    const setClauses: string[] = [];
    const params: SqlParameter[] = [
      { name: 'personaId', value: { stringValue: personaId } },
    ];
    let paramIndex = 2;

    if (updates.name !== undefined) {
      setClauses.push(`persona_name = $${paramIndex++}`);
      params.push({ name: 'name', value: { stringValue: updates.name } });
    }
    if (updates.displayName !== undefined) {
      setClauses.push(`display_name = $${paramIndex++}`);
      params.push({ name: 'displayName', value: { stringValue: updates.displayName } });
    }
    if (updates.systemPrompt !== undefined) {
      setClauses.push(`system_prompt = $${paramIndex++}`);
      params.push({ name: 'systemPrompt', value: { stringValue: updates.systemPrompt } });
    }
    if (updates.avatarUrl !== undefined) {
      setClauses.push(`avatar_url = $${paramIndex++}`);
      params.push({ name: 'avatarUrl', value: { stringValue: updates.avatarUrl } });
    }
    if (updates.voiceId !== undefined) {
      setClauses.push(`voice_id = $${paramIndex++}`);
      params.push({ name: 'voiceId', value: { stringValue: updates.voiceId } });
    }
    if (updates.traits !== undefined) {
      setClauses.push(`personality_traits = $${paramIndex++}::jsonb`);
      params.push({ name: 'traits', value: { stringValue: JSON.stringify(updates.traits) } });
    }
    if (updates.domains !== undefined) {
      setClauses.push(`knowledge_domains = $${paramIndex++}::jsonb`);
      params.push({ name: 'domains', value: { stringValue: JSON.stringify(updates.domains) } });
    }
    if (updates.style !== undefined) {
      setClauses.push(`conversation_style = $${paramIndex++}::jsonb`);
      params.push({ name: 'style', value: { stringValue: JSON.stringify(updates.style) } });
    }
    if (updates.isPublic !== undefined) {
      setClauses.push(`is_public = $${paramIndex++}`);
      params.push({ name: 'isPublic', value: { booleanValue: updates.isPublic } });
    }

    if (setClauses.length === 0) return;

    setClauses.push('updated_at = NOW()');

    await executeStatement(
      `UPDATE user_personas SET ${setClauses.join(', ')} WHERE id = $1`,
      params
    );
  }

  async deletePersona(personaId: string): Promise<void> {
    await executeStatement(`DELETE FROM user_personas WHERE id = $1`, [
      { name: 'personaId', value: { stringValue: personaId } },
    ]);
  }

  async logUsage(
    personaId: string,
    userId: string,
    chatId?: string,
    tokensUsed?: number
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO persona_usage_log (persona_id, user_id, chat_id, tokens_used)
       VALUES ($1, $2, $3, $4)`,
      [
        { name: 'personaId', value: { stringValue: personaId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'chatId', value: chatId ? { stringValue: chatId } : { isNull: true } },
        { name: 'tokensUsed', value: tokensUsed ? { longValue: tokensUsed } : { isNull: true } },
      ]
    );

    await executeStatement(
      `UPDATE user_personas SET usage_count = usage_count + 1 WHERE id = $1`,
      [{ name: 'personaId', value: { stringValue: personaId } }]
    );
  }

  async getPersonaUsageStats(personaId: string): Promise<Record<string, unknown>> {
    const result = await executeStatement(
      `SELECT 
         COUNT(*) as total_uses,
         SUM(tokens_used) as total_tokens,
         MIN(created_at) as first_used,
         MAX(created_at) as last_used
       FROM persona_usage_log
       WHERE persona_id = $1`,
      [{ name: 'personaId', value: { stringValue: personaId } }]
    );

    return (result.rows[0] as Record<string, unknown>) || {};
  }

  async buildPrompt(personaId: string): Promise<string> {
    const persona = await this.getPersona(personaId);
    if (!persona) throw new Error('Persona not found');

    let prompt = persona.systemPrompt;

    const traits = persona.personalityTraits || [];
    const domains = persona.knowledgeDomains || [];

    if (traits.length > 0) {
      prompt += `\n\nPersonality traits: ${traits.join(', ')}.`;
    }

    if (domains.length > 0) {
      prompt += `\n\nAreas of expertise: ${domains.join(', ')}.`;
    }

    const style = persona.conversationStyle || {};
    if (Object.keys(style).length > 0) {
      if (style.tone) prompt += `\n\nCommunication tone: ${style.tone}.`;
      if (style.verbosity) prompt += `\n\nResponse style: ${style.verbosity}.`;
      if (style.formality) prompt += `\n\nFormality level: ${style.formality}.`;
    }

    return prompt;
  }

  async getPublicPersonas(tenantId: string, limit: number = 20): Promise<UserPersona[]> {
    const result = await executeStatement(
      `SELECT * FROM user_personas
       WHERE tenant_id = $1 AND is_public = true
       ORDER BY usage_count DESC
       LIMIT $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows as unknown as UserPersona[];
  }

  async duplicatePersona(personaId: string, newUserId: string): Promise<string> {
    const original = await this.getPersona(personaId);
    if (!original) throw new Error('Persona not found');

    return this.createPersona(original.tenantId, newUserId, {
      name: `${original.personaName} (Copy)`,
      displayName: original.displayName,
      systemPrompt: original.systemPrompt,
      avatarUrl: original.avatarUrl || undefined,
      voiceId: original.voiceId || undefined,
      traits: original.personalityTraits,
      domains: original.knowledgeDomains,
      style: original.conversationStyle,
      isPublic: false,
    });
  }
}

export const personaService = new PersonaService();
