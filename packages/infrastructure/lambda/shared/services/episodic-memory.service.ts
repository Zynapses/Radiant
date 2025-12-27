// RADIANT v4.18.0 - Episodic Memory Service
// AGI Enhancement Phase 1: Temporal memory with importance decay and causal links

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { executeStatement } from '../db/client';
import { worldModelService } from './world-model.service';

// ============================================================================
// Types
// ============================================================================

export type MemoryType = 'input' | 'output' | 'action' | 'observation' | 'decision' | 'emotion';

export interface EpisodicMemory {
  memoryId: string;
  tenantId: string;
  userId: string;
  sessionId?: string;
  occurredAt: Date;
  memoryType: MemoryType;
  category?: string;
  tags: string[];
  content: string;
  summary?: string;
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
  emotions: EmotionState;
  intentions: string[];
  temporalBefore: string[];
  temporalAfter: string[];
  causedBy: string[];
  caused: string[];
  relatedTo: string[];
  contextSnapshot: Record<string, unknown>;
  baseImportance: number;
  currentImportance: number;
  decayRate: number;
  reinforcementCount: number;
  accessCount: number;
}

export interface ExtractedEntity {
  id?: string;
  type: string;
  name: string;
  role?: string;
}

export interface ExtractedRelation {
  subject: string;
  predicate: string;
  object: string;
}

export interface EmotionState {
  sentiment?: 'positive' | 'negative' | 'neutral';
  valence?: number; // -1 to 1
  arousal?: number; // 0 to 1
  dominantEmotion?: string;
}

export interface MemoryQuery {
  tenantId: string;
  userId: string;
  query?: string;
  memoryTypes?: MemoryType[];
  categories?: string[];
  tags?: string[];
  fromDate?: Date;
  toDate?: Date;
  minImportance?: number;
  limit?: number;
  includeRelated?: boolean;
}

export interface MemorySearchResult {
  memory: EpisodicMemory;
  relevance: number;
  temporalContext?: {
    before: EpisodicMemory[];
    after: EpisodicMemory[];
  };
}

export interface MemoryConsolidationResult {
  memoriesProcessed: number;
  semanticMemoriesCreated: number;
  proceduralMemoriesCreated: number;
  entitiesUpdated: number;
}

// ============================================================================
// Episodic Memory Service
// ============================================================================

export class EpisodicMemoryService {
  private bedrock: BedrockRuntimeClient;

  constructor() {
    this.bedrock = new BedrockRuntimeClient({});
  }

  // ============================================================================
  // Memory Creation
  // ============================================================================

  async createMemory(
    tenantId: string,
    userId: string,
    content: string,
    type: MemoryType,
    options: {
      sessionId?: string;
      category?: string;
      tags?: string[];
      contextSnapshot?: Record<string, unknown>;
      importance?: number;
    } = {}
  ): Promise<EpisodicMemory> {
    // Generate embedding for semantic search
    const embedding = await this.generateEmbedding(content);

    // Extract entities and relations using AI
    const extraction = await this.extractMemoryContent(content);

    // Analyze emotional content
    const emotions = await this.analyzeEmotions(content);

    // Calculate initial importance
    const baseImportance = options.importance ?? this.calculateImportance(content, extraction, emotions);

    // Generate summary for long content
    const summary = content.length > 500 ? await this.generateSummary(content) : undefined;

    const result = await executeStatement(
      `INSERT INTO episodic_memories (
        tenant_id, user_id, session_id, memory_type, category, tags,
        content, summary, content_embedding, entities, relations, emotions,
        intentions, context_snapshot, base_importance, current_importance, decay_rate
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector, $10, $11, $12, $13, $14, $15, $15, $16)
      RETURNING *`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'sessionId', value: options.sessionId ? { stringValue: options.sessionId } : { isNull: true } },
        { name: 'memoryType', value: { stringValue: type } },
        { name: 'category', value: options.category ? { stringValue: options.category } : { isNull: true } },
        { name: 'tags', value: { stringValue: `{${(options.tags || []).join(',')}}` } },
        { name: 'content', value: { stringValue: content } },
        { name: 'summary', value: summary ? { stringValue: summary } : { isNull: true } },
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
        { name: 'entities', value: { stringValue: JSON.stringify(extraction.entities) } },
        { name: 'relations', value: { stringValue: JSON.stringify(extraction.relations) } },
        { name: 'emotions', value: { stringValue: JSON.stringify(emotions) } },
        { name: 'intentions', value: { stringValue: JSON.stringify(extraction.intentions) } },
        { name: 'contextSnapshot', value: { stringValue: JSON.stringify(options.contextSnapshot || {}) } },
        { name: 'importance', value: { doubleValue: baseImportance } },
        { name: 'decayRate', value: { doubleValue: 0.001 } },
      ]
    );

    const memory = this.mapMemory(result.rows[0] as Record<string, unknown>);

    // Update world model with extracted entities
    await worldModelService.processTextIntoWorldModel(tenantId, content, memory.memoryId);

    // Find and link temporally adjacent memories
    await this.linkTemporalNeighbors(memory);

    return memory;
  }

  // ============================================================================
  // Memory Retrieval
  // ============================================================================

  async getMemory(memoryId: string): Promise<EpisodicMemory | null> {
    const result = await executeStatement(
      `SELECT * FROM episodic_memories WHERE memory_id = $1`,
      [{ name: 'memoryId', value: { stringValue: memoryId } }]
    );
    if (result.rows.length === 0) return null;

    // Reinforce memory on access
    await this.reinforceMemory(memoryId);

    return this.mapMemory(result.rows[0] as Record<string, unknown>);
  }

  async searchMemories(query: MemoryQuery): Promise<MemorySearchResult[]> {
    const results: MemorySearchResult[] = [];

    if (query.query) {
      // Semantic search
      const embedding = await this.generateEmbedding(query.query);
      const semanticResults = await executeStatement(
        `SELECT *, 1 - (content_embedding <=> $3::vector) as relevance
         FROM episodic_memories
         WHERE tenant_id = $1 AND user_id = $2 AND current_importance > $4
         ${query.memoryTypes?.length ? `AND memory_type = ANY($5)` : ''}
         ${query.fromDate ? `AND occurred_at >= $6` : ''}
         ${query.toDate ? `AND occurred_at <= $7` : ''}
         ORDER BY content_embedding <=> $3::vector
         LIMIT $8`,
        [
          { name: 'tenantId', value: { stringValue: query.tenantId } },
          { name: 'userId', value: { stringValue: query.userId } },
          { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
          { name: 'minImportance', value: { doubleValue: query.minImportance || 0.01 } },
          ...(query.memoryTypes?.length ? [{ name: 'types', value: { stringValue: `{${query.memoryTypes.join(',')}}` } }] : []),
          ...(query.fromDate ? [{ name: 'fromDate', value: { stringValue: query.fromDate.toISOString() } }] : []),
          ...(query.toDate ? [{ name: 'toDate', value: { stringValue: query.toDate.toISOString() } }] : []),
          { name: 'limit', value: { longValue: query.limit || 20 } },
        ]
      );

      for (const row of semanticResults.rows) {
        const memory = this.mapMemory(row as Record<string, unknown>);
        const relevance = Number((row as { relevance: number }).relevance || 0);
        
        let temporalContext;
        if (query.includeRelated) {
          temporalContext = await this.getTemporalContext(memory.memoryId, query.tenantId, query.userId);
        }

        results.push({ memory, relevance, temporalContext });

        // Reinforce accessed memories
        await this.reinforceMemory(memory.memoryId);
      }
    } else {
      // Recency-based retrieval
      const recentResults = await executeStatement(
        `SELECT * FROM episodic_memories
         WHERE tenant_id = $1 AND user_id = $2 AND current_importance > $3
         ${query.memoryTypes?.length ? `AND memory_type = ANY($4)` : ''}
         ORDER BY occurred_at DESC
         LIMIT $5`,
        [
          { name: 'tenantId', value: { stringValue: query.tenantId } },
          { name: 'userId', value: { stringValue: query.userId } },
          { name: 'minImportance', value: { doubleValue: query.minImportance || 0.01 } },
          ...(query.memoryTypes?.length ? [{ name: 'types', value: { stringValue: `{${query.memoryTypes.join(',')}}` } }] : []),
          { name: 'limit', value: { longValue: query.limit || 20 } },
        ]
      );

      for (const row of recentResults.rows) {
        const memory = this.mapMemory(row as Record<string, unknown>);
        results.push({ memory, relevance: memory.currentImportance });
      }
    }

    return results;
  }

  async getRecentMemories(tenantId: string, userId: string, limit = 10): Promise<EpisodicMemory[]> {
    const result = await executeStatement(
      `SELECT * FROM episodic_memories
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY occurred_at DESC
       LIMIT $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );
    return result.rows.map((row) => this.mapMemory(row as Record<string, unknown>));
  }

  async getMemoriesBySession(tenantId: string, sessionId: string): Promise<EpisodicMemory[]> {
    const result = await executeStatement(
      `SELECT * FROM episodic_memories
       WHERE tenant_id = $1 AND session_id = $2
       ORDER BY occurred_at ASC`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'sessionId', value: { stringValue: sessionId } },
      ]
    );
    return result.rows.map((row) => this.mapMemory(row as Record<string, unknown>));
  }

  // ============================================================================
  // Temporal & Causal Linking
  // ============================================================================

  async linkTemporalNeighbors(memory: EpisodicMemory, windowMinutes = 30): Promise<void> {
    const result = await executeStatement(
      `SELECT memory_id, occurred_at FROM episodic_memories
       WHERE tenant_id = $1 AND user_id = $2 AND memory_id != $3
       AND occurred_at BETWEEN $4::timestamptz - interval '${windowMinutes} minutes'
                          AND $4::timestamptz + interval '${windowMinutes} minutes'
       ORDER BY occurred_at`,
      [
        { name: 'tenantId', value: { stringValue: memory.tenantId } },
        { name: 'userId', value: { stringValue: memory.userId } },
        { name: 'memoryId', value: { stringValue: memory.memoryId } },
        { name: 'occurredAt', value: { stringValue: memory.occurredAt.toISOString() } },
      ]
    );

    const before: string[] = [];
    const after: string[] = [];

    for (const row of result.rows) {
      const r = row as { memory_id: string; occurred_at: string };
      const otherTime = new Date(r.occurred_at);
      if (otherTime < memory.occurredAt) {
        before.push(r.memory_id);
      } else {
        after.push(r.memory_id);
      }
    }

    if (before.length > 0 || after.length > 0) {
      await executeStatement(
        `UPDATE episodic_memories SET
          temporal_before = $2,
          temporal_after = $3,
          updated_at = NOW()
        WHERE memory_id = $1`,
        [
          { name: 'memoryId', value: { stringValue: memory.memoryId } },
          { name: 'before', value: { stringValue: `{${before.join(',')}}` } },
          { name: 'after', value: { stringValue: `{${after.join(',')}}` } },
        ]
      );
    }
  }

  async createCausalLink(causeMemoryId: string, effectMemoryId: string, strength = 0.7): Promise<void> {
    // Get tenant_id from memory
    const causeResult = await executeStatement(
      `SELECT tenant_id FROM episodic_memories WHERE memory_id = $1`,
      [{ name: 'memoryId', value: { stringValue: causeMemoryId } }]
    );
    if (causeResult.rows.length === 0) return;
    const tenantId = (causeResult.rows[0] as { tenant_id: string }).tenant_id;

    await executeStatement(
      `INSERT INTO causal_links (tenant_id, cause_type, cause_id, effect_type, effect_id, causal_strength, source_memories)
       VALUES ($1, 'memory', $2, 'memory', $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'causeId', value: { stringValue: causeMemoryId } },
        { name: 'effectId', value: { stringValue: effectMemoryId } },
        { name: 'strength', value: { doubleValue: strength } },
        { name: 'sourceMemories', value: { stringValue: `{${causeMemoryId},${effectMemoryId}}` } },
      ]
    );

    // Update the memory's causal links
    await executeStatement(
      `UPDATE episodic_memories SET caused = array_append(caused, $2) WHERE memory_id = $1`,
      [
        { name: 'causeId', value: { stringValue: causeMemoryId } },
        { name: 'effectId', value: { stringValue: effectMemoryId } },
      ]
    );
    await executeStatement(
      `UPDATE episodic_memories SET caused_by = array_append(caused_by, $2) WHERE memory_id = $1`,
      [
        { name: 'effectId', value: { stringValue: effectMemoryId } },
        { name: 'causeId', value: { stringValue: causeMemoryId } },
      ]
    );
  }

  async getCausalChain(memoryId: string, direction: 'causes' | 'effects' | 'both' = 'both', maxDepth = 3): Promise<EpisodicMemory[]> {
    const result = await executeStatement(
      `SELECT * FROM find_causal_chain($1, $2, $3)`,
      [
        { name: 'memoryId', value: { stringValue: memoryId } },
        { name: 'direction', value: { stringValue: direction } },
        { name: 'maxDepth', value: { longValue: maxDepth } },
      ]
    );

    const memories: EpisodicMemory[] = [];
    for (const row of result.rows) {
      const r = row as { memory_id: string };
      if (r.memory_id) {
        const memory = await this.getMemory(r.memory_id);
        if (memory) memories.push(memory);
      }
    }
    return memories;
  }

  async getTemporalContext(memoryId: string, tenantId: string, userId: string): Promise<{ before: EpisodicMemory[]; after: EpisodicMemory[] }> {
    const memory = await this.getMemory(memoryId);
    if (!memory) return { before: [], after: [] };

    const before: EpisodicMemory[] = [];
    const after: EpisodicMemory[] = [];

    for (const beforeId of memory.temporalBefore.slice(0, 3)) {
      const m = await this.getMemory(beforeId);
      if (m) before.push(m);
    }

    for (const afterId of memory.temporalAfter.slice(0, 3)) {
      const m = await this.getMemory(afterId);
      if (m) after.push(m);
    }

    return { before, after };
  }

  // ============================================================================
  // Memory Importance & Decay
  // ============================================================================

  async reinforceMemory(memoryId: string): Promise<void> {
    await executeStatement(`SELECT reinforce_memory($1)`, [
      { name: 'memoryId', value: { stringValue: memoryId } },
    ]);
  }

  async decayAllMemories(tenantId: string): Promise<void> {
    await executeStatement(
      `UPDATE episodic_memories SET
        current_importance = GREATEST(0.01, current_importance * (1 - decay_rate * EXTRACT(EPOCH FROM (NOW() - COALESCE(last_reinforced, created_at))) / 3600)),
        updated_at = NOW()
      WHERE tenant_id = $1 AND current_importance > 0.01`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
  }

  private calculateImportance(content: string, extraction: { entities: ExtractedEntity[]; intentions: string[] }, emotions: EmotionState): number {
    let importance = 0.3; // Base importance

    // More entities = more important
    importance += Math.min(0.2, extraction.entities.length * 0.05);

    // Intentions indicate actionable content
    importance += Math.min(0.15, extraction.intentions.length * 0.05);

    // Strong emotions = more memorable
    if (emotions.arousal && emotions.arousal > 0.5) {
      importance += 0.15;
    }

    // Longer content might be more significant
    if (content.length > 500) importance += 0.1;

    return Math.min(1.0, importance);
  }

  // ============================================================================
  // Memory Consolidation (Episodic → Semantic/Procedural)
  // ============================================================================

  async consolidateMemories(tenantId: string, userId: string): Promise<MemoryConsolidationResult> {
    const result: MemoryConsolidationResult = {
      memoriesProcessed: 0,
      semanticMemoriesCreated: 0,
      proceduralMemoriesCreated: 0,
      entitiesUpdated: 0,
    };

    // Get high-importance memories that haven't been consolidated recently
    const memoriesResult = await executeStatement(
      `SELECT * FROM episodic_memories
       WHERE tenant_id = $1 AND user_id = $2
       AND current_importance > 0.5
       AND access_count > 2
       ORDER BY current_importance DESC
       LIMIT 50`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );

    const memories = memoriesResult.rows.map((row) => this.mapMemory(row as Record<string, unknown>));
    result.memoriesProcessed = memories.length;

    // Group memories by category for pattern detection
    const categoryGroups = new Map<string, EpisodicMemory[]>();
    for (const memory of memories) {
      const category = memory.category || 'general';
      if (!categoryGroups.has(category)) {
        categoryGroups.set(category, []);
      }
      categoryGroups.get(category)!.push(memory);
    }

    // Extract semantic facts from recurring patterns
    for (const [category, categoryMemories] of categoryGroups) {
      if (categoryMemories.length >= 3) {
        const facts = await this.extractSemanticFacts(categoryMemories);
        for (const fact of facts) {
          await this.createSemanticMemory(tenantId, userId, fact, categoryMemories.map((m) => m.memoryId));
          result.semanticMemoriesCreated++;
        }
      }
    }

    // Extract procedural patterns from action sequences
    const actionMemories = memories.filter((m) => m.memoryType === 'action');
    if (actionMemories.length >= 3) {
      const procedures = await this.extractProcedures(actionMemories);
      for (const procedure of procedures) {
        await this.createProceduralMemory(tenantId, userId, procedure, actionMemories.map((m) => m.memoryId));
        result.proceduralMemoriesCreated++;
      }
    }

    return result;
  }

  private async extractSemanticFacts(memories: EpisodicMemory[]): Promise<Array<{ subject: string; predicate: string; object: string; statement: string }>> {
    const memorySummaries = memories.map((m) => m.summary || m.content.substring(0, 200)).join('\n---\n');

    const prompt = `Analyze these related memories and extract general facts or knowledge that can be derived from them.

Memories:
${memorySummaries}

Extract factual knowledge in the form of subject-predicate-object triples.
Return JSON array:
[
  {"subject": "...", "predicate": "...", "object": "...", "statement": "full natural language statement"}
]

Only extract facts that appear consistently across multiple memories. Return empty array if no clear patterns.`;

    try {
      const response = await this.invokeModel(prompt);
      return JSON.parse(response);
    } catch {
      return [];
    }
  }

  private async extractProcedures(memories: EpisodicMemory[]): Promise<Array<{ name: string; description: string; steps: string[]; triggers: string[] }>> {
    const memorySummaries = memories.map((m) => m.content.substring(0, 300)).join('\n---\n');

    const prompt = `Analyze these action memories and identify any repeating procedures or workflows.

Action Memories:
${memorySummaries}

Extract procedures that appear multiple times.
Return JSON array:
[
  {"name": "procedure name", "description": "what it does", "steps": ["step1", "step2"], "triggers": ["when to use"]}
]

Return empty array if no clear procedures found.`;

    try {
      const response = await this.invokeModel(prompt);
      return JSON.parse(response);
    } catch {
      return [];
    }
  }

  private async createSemanticMemory(tenantId: string, userId: string, fact: { subject: string; predicate: string; object: string; statement: string }, sourceMemoryIds: string[]): Promise<void> {
    const subjectEmbedding = await this.generateEmbedding(fact.subject);
    const statementEmbedding = await this.generateEmbedding(fact.statement);

    await executeStatement(
      `INSERT INTO semantic_memories (
        tenant_id, user_id, knowledge_type, subject, predicate, object, full_statement,
        subject_embedding, statement_embedding, source_type, source_memories, confidence
      ) VALUES ($1, $2, 'fact', $3, $4, $5, $6, $7::vector, $8::vector, 'inferred', $9, 0.7)
      ON CONFLICT DO NOTHING`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'subject', value: { stringValue: fact.subject } },
        { name: 'predicate', value: { stringValue: fact.predicate } },
        { name: 'object', value: { stringValue: fact.object } },
        { name: 'statement', value: { stringValue: fact.statement } },
        { name: 'subjectEmbedding', value: { stringValue: `[${subjectEmbedding.join(',')}]` } },
        { name: 'statementEmbedding', value: { stringValue: `[${statementEmbedding.join(',')}]` } },
        { name: 'sourceMemories', value: { stringValue: `{${sourceMemoryIds.join(',')}}` } },
      ]
    );
  }

  private async createProceduralMemory(tenantId: string, userId: string, procedure: { name: string; description: string; steps: string[]; triggers: string[] }, sourceMemoryIds: string[]): Promise<void> {
    const descEmbedding = await this.generateEmbedding(procedure.description);
    const slug = procedure.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    await executeStatement(
      `INSERT INTO procedural_memories (
        tenant_id, user_id, name, slug, description, steps, trigger_conditions,
        description_embedding, learned_from_episodes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9)
      ON CONFLICT (tenant_id, slug) DO UPDATE SET
        steps = EXCLUDED.steps,
        trigger_conditions = EXCLUDED.trigger_conditions,
        updated_at = NOW()`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'name', value: { stringValue: procedure.name } },
        { name: 'slug', value: { stringValue: slug } },
        { name: 'description', value: { stringValue: procedure.description } },
        { name: 'steps', value: { stringValue: JSON.stringify(procedure.steps.map((s, i) => ({ step: i + 1, action: s }))) } },
        { name: 'triggers', value: { stringValue: JSON.stringify(procedure.triggers) } },
        { name: 'embedding', value: { stringValue: `[${descEmbedding.join(',')}]` } },
        { name: 'sourceMemories', value: { stringValue: `{${sourceMemoryIds.join(',')}}` } },
      ]
    );
  }

  // ============================================================================
  // Content Analysis
  // ============================================================================

  private async extractMemoryContent(content: string): Promise<{ entities: ExtractedEntity[]; relations: ExtractedRelation[]; intentions: string[] }> {
    const prompt = `Analyze this text and extract:
1. Entities (people, places, things, concepts)
2. Relations between entities
3. Any intentions or goals expressed

Text: "${content.substring(0, 2000)}"

Return JSON:
{
  "entities": [{"type": "person|organization|object|concept|location|event|time", "name": "...", "role": "context role"}],
  "relations": [{"subject": "entity name", "predicate": "relationship", "object": "entity name"}],
  "intentions": ["intention1", "intention2"]
}`;

    try {
      const response = await this.invokeModel(prompt);
      return JSON.parse(response);
    } catch {
      return { entities: [], relations: [], intentions: [] };
    }
  }

  private async analyzeEmotions(content: string): Promise<EmotionState> {
    const prompt = `Analyze the emotional content of this text.

Text: "${content.substring(0, 1000)}"

Return JSON:
{
  "sentiment": "positive|negative|neutral",
  "valence": -1 to 1 (negative to positive),
  "arousal": 0 to 1 (calm to excited),
  "dominantEmotion": "joy|sadness|anger|fear|surprise|disgust|neutral"
}`;

    try {
      const response = await this.invokeModel(prompt);
      return JSON.parse(response);
    } catch {
      return { sentiment: 'neutral', valence: 0, arousal: 0.5 };
    }
  }

  private async generateSummary(content: string): Promise<string> {
    const prompt = `Summarize this text in 1-2 sentences, preserving key entities and actions.

Text: "${content.substring(0, 3000)}"`;

    try {
      return await this.invokeModel(prompt);
    } catch {
      return content.substring(0, 200) + '...';
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.bedrock.send(
        new InvokeModelCommand({
          modelId: 'amazon.titan-embed-text-v1',
          body: JSON.stringify({ inputText: text.substring(0, 8000) }),
          contentType: 'application/json',
        })
      );
      const result = JSON.parse(new TextDecoder().decode(response.body));
      return result.embedding;
    } catch {
      return new Array(1536).fill(0);
    }
  }

  private async invokeModel(prompt: string): Promise<string> {
    const response = await this.bedrock.send(
      new InvokeModelCommand({
        modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }],
        }),
        contentType: 'application/json',
      })
    );
    const result = JSON.parse(new TextDecoder().decode(response.body));
    return result.content?.[0]?.text || '';
  }

  private mapMemory(row: Record<string, unknown>): EpisodicMemory {
    return {
      memoryId: String(row.memory_id),
      tenantId: String(row.tenant_id),
      userId: String(row.user_id),
      sessionId: row.session_id ? String(row.session_id) : undefined,
      occurredAt: new Date(row.occurred_at as string),
      memoryType: row.memory_type as MemoryType,
      category: row.category ? String(row.category) : undefined,
      tags: (row.tags as string[]) || [],
      content: String(row.content),
      summary: row.summary ? String(row.summary) : undefined,
      entities: typeof row.entities === 'string' ? JSON.parse(row.entities) : (row.entities as ExtractedEntity[]) || [],
      relations: typeof row.relations === 'string' ? JSON.parse(row.relations) : (row.relations as ExtractedRelation[]) || [],
      emotions: typeof row.emotions === 'string' ? JSON.parse(row.emotions) : (row.emotions as EmotionState) || {},
      intentions: typeof row.intentions === 'string' ? JSON.parse(row.intentions) : (row.intentions as string[]) || [],
      temporalBefore: (row.temporal_before as string[]) || [],
      temporalAfter: (row.temporal_after as string[]) || [],
      causedBy: (row.caused_by as string[]) || [],
      caused: (row.caused as string[]) || [],
      relatedTo: (row.related_to as string[]) || [],
      contextSnapshot: typeof row.context_snapshot === 'string' ? JSON.parse(row.context_snapshot) : (row.context_snapshot as Record<string, unknown>) || {},
      baseImportance: Number(row.base_importance || 0.5),
      currentImportance: Number(row.current_importance || 0.5),
      decayRate: Number(row.decay_rate || 0.001),
      reinforcementCount: Number(row.reinforcement_count || 0),
      accessCount: Number(row.access_count || 0),
    };
  }
}

export const episodicMemoryService = new EpisodicMemoryService();
