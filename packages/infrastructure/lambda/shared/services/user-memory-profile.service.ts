/**
 * User Memory Profile Service v1.1.0
 * 
 * Unified cross-chat, cross-model memory profile for every user.
 * This is THE single source of truth for what the AI knows about a user.
 * 
 * Consolidates:
 *   - user_persistent_context (facts, preferences, instructions, etc.)
 *   - AKG nodes/edges (knowledge graph)
 *   - memory_stores/memories (general memory)
 *   - user_preferences (preference engine)
 *   - uds_uploads (uploaded documents — PDFs, images, code, etc.)
 *   - uds_message_attachments (downloaded/generated files)
 * 
 * Produces a UserMemoryProfileSummary that gets injected into EVERY prompt
 * for EVERY chat on EVERY model via the Brain Router.
 * 
 * NO EXCEPTIONS: uploaded documents and downloaded files are ALWAYS included.
 */

import { executeStatement } from '../db/client';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'user/memory-profile',
  category: 'infrastructure',
  sourceType: 'application',
});
import { memoryRetentionPolicyService } from './memory-retention-policy.service';

// =============================================================================
// Types
// =============================================================================

interface ProfileSummary {
  userId: string;
  tenantId: string;
  facts: Array<{ content: string; importance: number; confidence: number }>;
  preferences: Array<{ key: string; value: string; confidence: number }>;
  instructions: string[];
  projects: Array<{ name: string; status: string }>;
  skills: string[];
  corrections: Array<{ content: string; correctedAt: string }>;
  topEntities: Array<{ label: string; type: string; importance: number }>;
  uploadedDocuments: Array<{ filename: string; contentType: string; fileSizeBytes: number; extractedSummary?: string; uploadedAt: string }>;
  downloadedFiles: Array<{ filename: string; contentType: string; fileSizeBytes: number; description?: string; createdAt: string }>;
  systemPromptInjection: string;
  profileCompleteness: number;
  lastUpdated: string;
  tokenEstimate: number;
}

interface ProfileStats {
  profileId: string;
  tenantId: string;
  userId: string;
  totalMemoryEntries: number;
  profileQuality: number;
  factsCount: number;
  preferencesCount: number;
  instructionsCount: number;
  projectsCount: number;
  skillsCount: number;
  relationshipsCount: number;
  correctionsCount: number;
  akgNodesCount: number;
  akgEdgesCount: number;
  conversationMemoriesCount: number;
  uploadedDocumentsCount: number;
  uploadedDocumentsTotalBytes: number;
  downloadedFilesCount: number;
  downloadedFilesTotalBytes: number;
  lastInteractionAt: string | null;
  lastMemoryUpdateAt: string | null;
  totalConversations: number;
  totalModelsUsed: number;
  modelsUsed: string[];
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Service
// =============================================================================

class UserMemoryProfileService {

  // =========================================================================
  // Profile Summary (for prompt injection)
  // =========================================================================

  /**
   * Build the unified memory profile summary for a user.
   * This is called by the Brain Router before EVERY prompt on EVERY model.
   * 
   * Returns null if session-to-session memory is disabled for this tenant.
   */
  async getProfileSummary(
    tenantId: string,
    userId: string,
    maxTokens: number = 800
  ): Promise<ProfileSummary | null> {
    // Check retention policy — is session memory enabled?
    const policy = await memoryRetentionPolicyService.getEffectivePolicy(tenantId);
    if (!policy.sessionToSessionMemoryEnabled) {
      return null;
    }

    const startTime = Date.now();

    // Check document/file toggles from policy
    const policyAny = policy as unknown as Record<string, unknown>;
    const docsEnabled = policyAny.uploadedDocumentsEnabled !== false;
    const filesEnabled = policyAny.downloadedFilesEnabled !== false;

    // Fetch all memory types in parallel — including documents and files, NO EXCEPTIONS
    const [facts, preferences, instructions, projects, skills, corrections, topEntities, uploadedDocuments, downloadedFiles] = await Promise.all([
      this.getUserFacts(tenantId, userId, 20),
      this.getUserPreferences(tenantId, userId, 15),
      this.getUserInstructions(tenantId, userId, 10),
      this.getUserProjects(tenantId, userId, 5),
      this.getUserSkills(tenantId, userId, 10),
      this.getUserCorrections(tenantId, userId, 5),
      this.getTopAKGEntities(tenantId, userId, 15),
      docsEnabled ? this.getUserUploadedDocuments(tenantId, userId, 20) : Promise.resolve([]),
      filesEnabled ? this.getUserDownloadedFiles(tenantId, userId, 10) : Promise.resolve([]),
    ]);

    // Build system prompt injection
    const sections: string[] = [];

    if (facts.length > 0) {
      sections.push(`[User Profile]\n${facts.map(f => `- ${f.content}`).join('\n')}`);
    }

    if (preferences.length > 0) {
      sections.push(`[User Preferences]\n${preferences.map(p => `- ${p.key}: ${p.value}`).join('\n')}`);
    }

    if (instructions.length > 0) {
      sections.push(`[Standing Instructions]\n${instructions.map(i => `- ${i}`).join('\n')}`);
    }

    if (projects.length > 0) {
      sections.push(`[Active Projects]\n${projects.map(p => `- ${p.name} (${p.status})`).join('\n')}`);
    }

    if (skills.length > 0) {
      sections.push(`[Known Skills]\n${skills.join(', ')}`);
    }

    if (corrections.length > 0) {
      sections.push(`[Important Corrections]\n${corrections.map(c => `- ${c.content}`).join('\n')}`);
    }

    if (topEntities.length > 0) {
      sections.push(`[Key Entities]\n${topEntities.map(e => `- ${e.label} (${e.type})`).join('\n')}`);
    }

    if (uploadedDocuments.length > 0) {
      sections.push(`[Available Documents]\nThe user has uploaded these files (available across all chats):\n${uploadedDocuments.map(d => {
        const sizeMb = (d.fileSizeBytes / 1048576).toFixed(1);
        const summary = d.extractedSummary ? ` — ${d.extractedSummary}` : '';
        return `- ${d.filename} (${d.contentType}, ${sizeMb}MB)${summary}`;
      }).join('\n')}`);
    }

    if (downloadedFiles.length > 0) {
      sections.push(`[Generated/Downloaded Files]\nFiles previously created or retrieved for this user:\n${downloadedFiles.map(f => {
        const desc = f.description ? ` — ${f.description}` : '';
        return `- ${f.filename} (${f.contentType})${desc}`;
      }).join('\n')}`);
    }

    let systemPromptInjection = sections.join('\n\n');

    // Trim to token budget (rough estimate: 1 token ≈ 4 chars)
    const maxChars = maxTokens * 4;
    if (systemPromptInjection.length > maxChars) {
      systemPromptInjection = systemPromptInjection.substring(0, maxChars) + '\n...';
    }

    const tokenEstimate = Math.ceil(systemPromptInjection.length / 4);

    // Calculate profile completeness (9 categories now including docs/files)
    const categoryCount = [facts, preferences, instructions, projects, skills, corrections, topEntities, uploadedDocuments, downloadedFiles]
      .filter(arr => arr.length > 0).length;
    const profileCompleteness = Math.min(1, categoryCount / 9);

    const latencyMs = Date.now() - startTime;
    logger.debug('Built user memory profile', { tenantId, userId, tokenEstimate, latencyMs, categories: categoryCount });

    return {
      userId,
      tenantId,
      facts,
      preferences,
      instructions,
      projects,
      skills,
      corrections,
      topEntities,
      uploadedDocuments,
      downloadedFiles,
      systemPromptInjection,
      profileCompleteness,
      lastUpdated: new Date().toISOString(),
      tokenEstimate,
    };
  }

  // =========================================================================
  // Profile Stats (for admin dashboards)
  // =========================================================================

  async getProfileStats(tenantId: string, userId: string): Promise<ProfileStats | null> {
    // Refresh profile first
    await executeStatement(
      `SELECT refresh_user_memory_profile($1, $2)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );

    const result = await executeStatement(
      `SELECT * FROM user_memory_profiles WHERE tenant_id = $1 AND user_id = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );

    if (result.rows.length === 0) return null;
    return this.mapProfileStats(result.rows[0] as Record<string, unknown>);
  }

  async listProfiles(
    tenantId: string,
    options?: { limit?: number; offset?: number; minQuality?: number; sortBy?: string }
  ): Promise<{ profiles: ProfileStats[]; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    let query = `SELECT * FROM user_memory_profiles WHERE tenant_id = $1`;
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
    ];

    if (options?.minQuality !== undefined) {
      query += ` AND profile_quality >= $${params.length + 1}`;
      params.push({ name: 'minQuality', value: { doubleValue: options.minQuality } });
    }

    const sortCol = options?.sortBy === 'quality' ? 'profile_quality DESC' :
      options?.sortBy === 'entries' ? 'total_memory_entries DESC' :
      'last_interaction_at DESC NULLS LAST';
    query += ` ORDER BY ${sortCol} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push({ name: 'limit', value: { longValue: limit } });
    params.push({ name: 'offset', value: { longValue: offset } });

    const result = await executeStatement(query, params as Parameters<typeof executeStatement>[1]);

    // Count
    const countResult = await executeStatement(
      `SELECT COUNT(*) as cnt FROM user_memory_profiles WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return {
      profiles: result.rows.map(r => this.mapProfileStats(r as Record<string, unknown>)),
      total: Number((countResult.rows[0] as Record<string, unknown>).cnt || 0),
    };
  }

  // =========================================================================
  // Record Model Usage (tracks which models a user interacts with)
  // =========================================================================

  async recordInteraction(
    tenantId: string,
    userId: string,
    modelId: string,
    conversationId?: string
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO user_memory_profiles (tenant_id, user_id, last_interaction_at, total_conversations, total_models_used, models_used)
         VALUES ($1, $2, NOW(), 1, 1, ARRAY[$3])
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET
           last_interaction_at = NOW(),
           total_conversations = user_memory_profiles.total_conversations + 1,
           models_used = CASE 
             WHEN $3 = ANY(user_memory_profiles.models_used) THEN user_memory_profiles.models_used
             ELSE array_append(user_memory_profiles.models_used, $3)
           END,
           total_models_used = CASE
             WHEN $3 = ANY(user_memory_profiles.models_used) THEN user_memory_profiles.total_models_used
             ELSE user_memory_profiles.total_models_used + 1
           END,
           updated_at = NOW()`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'userId', value: { stringValue: userId } },
          { name: 'modelId', value: { stringValue: modelId } },
        ]
      );
    } catch (error) {
      logger.warn('Failed to record interaction', { tenantId, userId, modelId, error: String(error) });
    }
  }

  // =========================================================================
  // Memory Data Fetchers
  // =========================================================================

  private async getUserFacts(tenantId: string, userId: string, limit: number): Promise<Array<{ content: string; importance: number; confidence: number }>> {
    const result = await executeStatement(
      `SELECT content, importance, confidence FROM user_persistent_context
       WHERE tenant_id = $1 AND user_id = $2 AND context_type = 'fact'
       AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY importance DESC, updated_at DESC LIMIT $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );
    return result.rows.map(r => {
      const row = r as Record<string, unknown>;
      return { content: String(row.content), importance: Number(row.importance), confidence: Number(row.confidence) };
    });
  }

  private async getUserPreferences(tenantId: string, userId: string, limit: number): Promise<Array<{ key: string; value: string; confidence: number }>> {
    // Try user_preferences table first (preference engine)
    const result = await executeStatement(
      `SELECT preference_key, preference_value, confidence FROM user_preferences
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY confidence DESC LIMIT $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    const prefs = result.rows.map(r => {
      const row = r as Record<string, unknown>;
      return { key: String(row.preference_key), value: String(row.preference_value), confidence: Number(row.confidence) };
    });

    // Also get preference-type entries from user_persistent_context
    if (prefs.length < limit) {
      const contextResult = await executeStatement(
        `SELECT content, confidence FROM user_persistent_context
         WHERE tenant_id = $1 AND user_id = $2 AND context_type = 'preference'
         AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY importance DESC LIMIT $3`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'userId', value: { stringValue: userId } },
          { name: 'limit', value: { longValue: limit - prefs.length } },
        ]
      );
      for (const r of contextResult.rows) {
        const row = r as Record<string, unknown>;
        prefs.push({ key: 'preference', value: String(row.content), confidence: Number(row.confidence) });
      }
    }

    return prefs;
  }

  private async getUserInstructions(tenantId: string, userId: string, limit: number): Promise<string[]> {
    const result = await executeStatement(
      `SELECT content FROM user_persistent_context
       WHERE tenant_id = $1 AND user_id = $2 AND context_type = 'instruction'
       AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY importance DESC LIMIT $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );
    return result.rows.map(r => String((r as Record<string, unknown>).content));
  }

  private async getUserProjects(tenantId: string, userId: string, limit: number): Promise<Array<{ name: string; status: string }>> {
    const result = await executeStatement(
      `SELECT content FROM user_persistent_context
       WHERE tenant_id = $1 AND user_id = $2 AND context_type = 'project'
       AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY importance DESC LIMIT $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );
    return result.rows.map(r => ({ name: String((r as Record<string, unknown>).content), status: 'active' }));
  }

  private async getUserSkills(tenantId: string, userId: string, limit: number): Promise<string[]> {
    const result = await executeStatement(
      `SELECT content FROM user_persistent_context
       WHERE tenant_id = $1 AND user_id = $2 AND context_type = 'skill'
       AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY importance DESC LIMIT $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );
    return result.rows.map(r => String((r as Record<string, unknown>).content));
  }

  private async getUserCorrections(tenantId: string, userId: string, limit: number): Promise<Array<{ content: string; correctedAt: string }>> {
    const result = await executeStatement(
      `SELECT content, updated_at FROM user_persistent_context
       WHERE tenant_id = $1 AND user_id = $2 AND context_type = 'correction'
       AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY updated_at DESC LIMIT $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );
    return result.rows.map(r => {
      const row = r as Record<string, unknown>;
      return { content: String(row.content), correctedAt: String(row.updated_at) };
    });
  }

  private async getTopAKGEntities(tenantId: string, userId: string, limit: number): Promise<Array<{ label: string; type: string; importance: number }>> {
    try {
      const result = await executeStatement(
        `SELECT label, entity_type, importance FROM akg_nodes
         WHERE tenant_id = $1 AND user_id = $2
         ORDER BY importance DESC LIMIT $3`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'userId', value: { stringValue: userId } },
          { name: 'limit', value: { longValue: limit } },
        ]
      );
      return result.rows.map(r => {
        const row = r as Record<string, unknown>;
        return { label: String(row.label), type: String(row.entity_type), importance: Number(row.importance) };
      });
    } catch {
      // AKG table may not exist yet
      return [];
    }
  }

  // =========================================================================
  // Document & File Fetchers
  // =========================================================================

  private async getUserUploadedDocuments(tenantId: string, userId: string, limit: number): Promise<Array<{ filename: string; contentType: string; fileSizeBytes: number; extractedSummary?: string; uploadedAt: string }>> {
    try {
      const result = await executeStatement(
        `SELECT original_filename, content_type, file_size_bytes, extracted_text, created_at
         FROM uds_uploads
         WHERE tenant_id = $1 AND user_id = $2 AND status != 'deleted'
         ORDER BY created_at DESC LIMIT $3`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'userId', value: { stringValue: userId } },
          { name: 'limit', value: { longValue: limit } },
        ]
      );
      return result.rows.map(r => {
        const row = r as Record<string, unknown>;
        const extractedText = row.extracted_text ? String(row.extracted_text) : undefined;
        const extractedSummary = extractedText && extractedText.length > 200
          ? extractedText.substring(0, 200) + '...'
          : extractedText;
        return {
          filename: String(row.original_filename),
          contentType: String(row.content_type),
          fileSizeBytes: Number(row.file_size_bytes || 0),
          extractedSummary,
          uploadedAt: String(row.created_at),
        };
      });
    } catch {
      return [];
    }
  }

  private async getUserDownloadedFiles(tenantId: string, userId: string, limit: number): Promise<Array<{ filename: string; contentType: string; fileSizeBytes: number; description?: string; createdAt: string }>> {
    try {
      const result = await executeStatement(
        `SELECT ma.filename, ma.content_type, ma.content_size, ma.caption, ma.created_at
         FROM uds_message_attachments ma
         JOIN uds_messages m ON m.id = ma.message_id
         WHERE m.tenant_id = $1 AND m.user_id = $2
         AND ma.attachment_type = 'file'
         ORDER BY ma.created_at DESC LIMIT $3`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'userId', value: { stringValue: userId } },
          { name: 'limit', value: { longValue: limit } },
        ]
      );
      return result.rows.map(r => {
        const row = r as Record<string, unknown>;
        return {
          filename: String(row.filename || 'unnamed'),
          contentType: String(row.content_type || 'binary'),
          fileSizeBytes: Number(row.content_size || 0),
          description: row.caption ? String(row.caption) : undefined,
          createdAt: String(row.created_at),
        };
      });
    } catch {
      return [];
    }
  }

  // =========================================================================
  // Mapper
  // =========================================================================

  private mapProfileStats(row: Record<string, unknown>): ProfileStats {
    return {
      profileId: String(row.profile_id || ''),
      tenantId: String(row.tenant_id || ''),
      userId: String(row.user_id || ''),
      totalMemoryEntries: Number(row.total_memory_entries || 0),
      profileQuality: Number(row.profile_quality || 0),
      factsCount: Number(row.facts_count || 0),
      preferencesCount: Number(row.preferences_count || 0),
      instructionsCount: Number(row.instructions_count || 0),
      projectsCount: Number(row.projects_count || 0),
      skillsCount: Number(row.skills_count || 0),
      relationshipsCount: Number(row.relationships_count || 0),
      correctionsCount: Number(row.corrections_count || 0),
      akgNodesCount: Number(row.akg_nodes_count || 0),
      akgEdgesCount: Number(row.akg_edges_count || 0),
      conversationMemoriesCount: Number(row.conversation_memories_count || 0),
      uploadedDocumentsCount: Number(row.uploaded_documents_count || 0),
      uploadedDocumentsTotalBytes: Number(row.uploaded_documents_total_bytes || 0),
      downloadedFilesCount: Number(row.downloaded_files_count || 0),
      downloadedFilesTotalBytes: Number(row.downloaded_files_total_bytes || 0),
      lastInteractionAt: row.last_interaction_at ? String(row.last_interaction_at) : null,
      lastMemoryUpdateAt: row.last_memory_update_at ? String(row.last_memory_update_at) : null,
      totalConversations: Number(row.total_conversations || 0),
      totalModelsUsed: Number(row.total_models_used || 0),
      modelsUsed: Array.isArray(row.models_used) ? row.models_used as string[] : [],
      createdAt: String(row.created_at || ''),
      updatedAt: String(row.updated_at || ''),
    };
  }
}

export const userMemoryProfileService = new UserMemoryProfileService();
