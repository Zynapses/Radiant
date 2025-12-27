// RADIANT v4.18.0 - World Model Service
// AGI Enhancement Phase 1: Entity-Relation Knowledge Graph with JEPA-style prediction

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { executeStatement } from '../db/client';

// ============================================================================
// Types
// ============================================================================

export type EntityType = 'person' | 'organization' | 'object' | 'concept' | 'location' | 'event' | 'time';

export interface Entity {
  entityId: string;
  entityType: EntityType;
  canonicalName: string;
  aliases: string[];
  attributes: Record<string, unknown>;
  confidence: number;
  mentionCount: number;
  firstMentioned?: Date;
  lastMentioned?: Date;
  currentState: Record<string, unknown>;
}

export interface Relation {
  relationId: string;
  subjectId: string;
  predicate: string;
  objectId: string;
  confidence: number;
  validFrom?: Date;
  validTo?: Date;
  isCurrent: boolean;
  attributes: Record<string, unknown>;
}

export interface WorldState {
  entities: Map<string, Entity>;
  relations: Relation[];
  timestamp: Date;
  context: Record<string, unknown>;
}

export interface EntityExtractionResult {
  entities: Array<{
    type: EntityType;
    name: string;
    aliases?: string[];
    attributes?: Record<string, unknown>;
    role?: string;
  }>;
  relations: Array<{
    subject: string;
    predicate: string;
    object: string;
    confidence?: number;
  }>;
}

export interface PredictionResult {
  predictedState: WorldState;
  confidence: number;
  reasoning: string;
  alternatives: WorldState[];
}

export interface SimulationResult {
  steps: Array<{
    step: number;
    action: string;
    resultingState: WorldState;
    probability: number;
  }>;
  finalState: WorldState;
  insights: string[];
}

// ============================================================================
// World Model Service
// ============================================================================

export class WorldModelService {
  private bedrock: BedrockRuntimeClient;
  private entityCache: Map<string, Map<string, Entity>> = new Map();

  constructor() {
    this.bedrock = new BedrockRuntimeClient({});
  }

  // ============================================================================
  // Entity Management
  // ============================================================================

  async getEntity(tenantId: string, entityId: string): Promise<Entity | null> {
    const result = await executeStatement(
      `SELECT * FROM world_model_entities WHERE tenant_id = $1 AND entity_id = $2 AND is_active = true`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'entityId', value: { stringValue: entityId } },
      ]
    );
    if (result.rows.length === 0) return null;
    return this.mapEntity(result.rows[0] as Record<string, unknown>);
  }

  async findEntityByName(tenantId: string, name: string, type?: EntityType): Promise<Entity | null> {
    let query = `
      SELECT * FROM world_model_entities 
      WHERE tenant_id = $1 AND is_active = true
      AND (LOWER(canonical_name) = LOWER($2) OR LOWER($2) = ANY(SELECT LOWER(unnest(aliases))))
    `;
    const params: Array<{ name: string; value: { stringValue: string } }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'name', value: { stringValue: name } },
    ];

    if (type) {
      query += ` AND entity_type = $3`;
      params.push({ name: 'type', value: { stringValue: type } });
    }

    query += ` ORDER BY confidence DESC LIMIT 1`;

    const result = await executeStatement(query, params);
    if (result.rows.length === 0) return null;
    return this.mapEntity(result.rows[0] as Record<string, unknown>);
  }

  async findEntitiesBySemantic(tenantId: string, query: string, limit = 10): Promise<Entity[]> {
    const embedding = await this.generateEmbedding(query);
    const result = await executeStatement(
      `SELECT *, 1 - (name_embedding <=> $2::vector) as similarity
       FROM world_model_entities 
       WHERE tenant_id = $1 AND is_active = true
       ORDER BY name_embedding <=> $2::vector
       LIMIT $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );
    return result.rows.map((row) => this.mapEntity(row as Record<string, unknown>));
  }

  async createEntity(tenantId: string, entity: Partial<Entity>, sourceMemoryId?: string): Promise<Entity> {
    const nameEmbedding = await this.generateEmbedding(entity.canonicalName || '');
    
    const result = await executeStatement(
      `INSERT INTO world_model_entities (
        tenant_id, entity_type, canonical_name, aliases, attributes,
        name_embedding, confidence, source_memories, first_mentioned, last_mentioned
      ) VALUES ($1, $2, $3, $4, $5, $6::vector, $7, $8, NOW(), NOW())
      RETURNING *`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'entityType', value: { stringValue: entity.entityType || 'concept' } },
        { name: 'canonicalName', value: { stringValue: entity.canonicalName || 'Unknown' } },
        { name: 'aliases', value: { stringValue: `{${(entity.aliases || []).join(',')}}` } },
        { name: 'attributes', value: { stringValue: JSON.stringify(entity.attributes || {}) } },
        { name: 'embedding', value: { stringValue: `[${nameEmbedding.join(',')}]` } },
        { name: 'confidence', value: { doubleValue: entity.confidence || 0.5 } },
        { name: 'sourceMemories', value: sourceMemoryId ? { stringValue: `{${sourceMemoryId}}` } : { stringValue: '{}' } },
      ]
    );

    this.invalidateCache(tenantId);
    return this.mapEntity(result.rows[0] as Record<string, unknown>);
  }

  async updateEntityState(tenantId: string, entityId: string, newState: Record<string, unknown>, sourceMemoryId?: string): Promise<void> {
    await executeStatement(
      `UPDATE world_model_entities SET
        current_state = current_state || $3::jsonb,
        state_history = state_history || jsonb_build_array(jsonb_build_object(
          'timestamp', NOW(),
          'state', $3::jsonb,
          'source', $4
        )),
        last_mentioned = NOW(),
        mention_count = mention_count + 1,
        source_memories = array_append(source_memories, $4::uuid),
        updated_at = NOW()
      WHERE tenant_id = $1 AND entity_id = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'entityId', value: { stringValue: entityId } },
        { name: 'newState', value: { stringValue: JSON.stringify(newState) } },
        { name: 'sourceMemory', value: sourceMemoryId ? { stringValue: sourceMemoryId } : { isNull: true } },
      ]
    );
    this.invalidateCache(tenantId);
  }

  // ============================================================================
  // Relation Management
  // ============================================================================

  async getRelationsForEntity(tenantId: string, entityId: string, direction: 'outgoing' | 'incoming' | 'both' = 'both'): Promise<Relation[]> {
    let query = `SELECT * FROM world_model_relations WHERE tenant_id = $1 AND is_current = true`;
    
    if (direction === 'outgoing') {
      query += ` AND subject_id = $2`;
    } else if (direction === 'incoming') {
      query += ` AND object_id = $2`;
    } else {
      query += ` AND (subject_id = $2 OR object_id = $2)`;
    }

    const result = await executeStatement(query, [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'entityId', value: { stringValue: entityId } },
    ]);

    return result.rows.map((row) => this.mapRelation(row as Record<string, unknown>));
  }

  async createRelation(tenantId: string, relation: Partial<Relation>, sourceMemoryId?: string): Promise<Relation> {
    const predicateEmbedding = await this.generateEmbedding(relation.predicate || '');

    const result = await executeStatement(
      `INSERT INTO world_model_relations (
        tenant_id, subject_id, predicate, object_id, predicate_embedding,
        confidence, source_memories, is_current, valid_from
      ) VALUES ($1, $2, $3, $4, $5::vector, $6, $7, true, NOW())
      RETURNING *`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'subjectId', value: { stringValue: relation.subjectId || '' } },
        { name: 'predicate', value: { stringValue: relation.predicate || '' } },
        { name: 'objectId', value: { stringValue: relation.objectId || '' } },
        { name: 'embedding', value: { stringValue: `[${predicateEmbedding.join(',')}]` } },
        { name: 'confidence', value: { doubleValue: relation.confidence || 0.5 } },
        { name: 'sourceMemories', value: sourceMemoryId ? { stringValue: `{${sourceMemoryId}}` } : { stringValue: '{}' } },
      ]
    );

    return this.mapRelation(result.rows[0] as Record<string, unknown>);
  }

  async findRelationsBySemantic(tenantId: string, predicateQuery: string, limit = 10): Promise<Relation[]> {
    const embedding = await this.generateEmbedding(predicateQuery);
    const result = await executeStatement(
      `SELECT *, 1 - (predicate_embedding <=> $2::vector) as similarity
       FROM world_model_relations 
       WHERE tenant_id = $1 AND is_current = true
       ORDER BY predicate_embedding <=> $2::vector
       LIMIT $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );
    return result.rows.map((row) => this.mapRelation(row as Record<string, unknown>));
  }

  // ============================================================================
  // Entity & Relation Extraction from Text
  // ============================================================================

  async extractEntitiesAndRelations(tenantId: string, text: string, context?: Record<string, unknown>): Promise<EntityExtractionResult> {
    const prompt = `Analyze the following text and extract entities and relationships.

Text: "${text}"

${context ? `Context: ${JSON.stringify(context)}` : ''}

Return a JSON object with:
1. "entities": array of {type, name, aliases (if any), attributes (key facts), role (in context)}
   - type must be one of: person, organization, object, concept, location, event, time
2. "relations": array of {subject (entity name), predicate (relationship verb/phrase), object (entity name), confidence (0-1)}

Focus on:
- Named entities (people, places, organizations)
- Concepts and abstract ideas
- Temporal references
- Causal relationships
- Preferences and opinions

Return ONLY valid JSON, no explanation.`;

    try {
      const response = await this.invokeModel(prompt);
      const parsed = JSON.parse(response) as EntityExtractionResult;
      return parsed;
    } catch {
      return { entities: [], relations: [] };
    }
  }

  async processTextIntoWorldModel(tenantId: string, text: string, sourceMemoryId?: string): Promise<{
    newEntities: Entity[];
    updatedEntities: Entity[];
    newRelations: Relation[];
  }> {
    const extraction = await this.extractEntitiesAndRelations(tenantId, text);
    
    const newEntities: Entity[] = [];
    const updatedEntities: Entity[] = [];
    const entityNameToId = new Map<string, string>();

    // Process entities
    for (const extractedEntity of extraction.entities) {
      const existing = await this.findEntityByName(tenantId, extractedEntity.name, extractedEntity.type);
      
      if (existing) {
        // Update existing entity
        if (extractedEntity.attributes) {
          await this.updateEntityState(tenantId, existing.entityId, extractedEntity.attributes, sourceMemoryId);
        }
        updatedEntities.push(existing);
        entityNameToId.set(extractedEntity.name.toLowerCase(), existing.entityId);
      } else {
        // Create new entity
        const newEntity = await this.createEntity(tenantId, {
          entityType: extractedEntity.type,
          canonicalName: extractedEntity.name,
          aliases: extractedEntity.aliases || [],
          attributes: extractedEntity.attributes || {},
          confidence: 0.7,
        }, sourceMemoryId);
        newEntities.push(newEntity);
        entityNameToId.set(extractedEntity.name.toLowerCase(), newEntity.entityId);
      }
    }

    // Process relations
    const newRelations: Relation[] = [];
    for (const extractedRelation of extraction.relations) {
      const subjectId = entityNameToId.get(extractedRelation.subject.toLowerCase());
      const objectId = entityNameToId.get(extractedRelation.object.toLowerCase());
      
      if (subjectId && objectId) {
        const relation = await this.createRelation(tenantId, {
          subjectId,
          predicate: extractedRelation.predicate,
          objectId,
          confidence: extractedRelation.confidence || 0.7,
        }, sourceMemoryId);
        newRelations.push(relation);
      }
    }

    return { newEntities, updatedEntities, newRelations };
  }

  // ============================================================================
  // World State Management
  // ============================================================================

  async getCurrentWorldState(tenantId: string, userId?: string): Promise<WorldState> {
    // Get all active entities
    const entitiesResult = await executeStatement(
      `SELECT * FROM world_model_entities WHERE tenant_id = $1 AND is_active = true
       ${userId ? 'AND (user_id IS NULL OR user_id = $2)' : ''}
       ORDER BY last_mentioned DESC LIMIT 1000`,
      userId 
        ? [{ name: 'tenantId', value: { stringValue: tenantId } }, { name: 'userId', value: { stringValue: userId } }]
        : [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const entities = new Map<string, Entity>();
    for (const row of entitiesResult.rows) {
      const entity = this.mapEntity(row as Record<string, unknown>);
      entities.set(entity.entityId, entity);
    }

    // Get all current relations
    const relationsResult = await executeStatement(
      `SELECT * FROM world_model_relations WHERE tenant_id = $1 AND is_current = true`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const relations = relationsResult.rows.map((row) => this.mapRelation(row as Record<string, unknown>));

    return {
      entities,
      relations,
      timestamp: new Date(),
      context: {},
    };
  }

  async createWorldStateSnapshot(tenantId: string, userId?: string, sessionId?: string, description?: string): Promise<string> {
    const worldState = await this.getCurrentWorldState(tenantId, userId);

    const entitiesSnapshot: Record<string, unknown> = {};
    worldState.entities.forEach((entity, id) => {
      entitiesSnapshot[id] = {
        type: entity.entityType,
        name: entity.canonicalName,
        attributes: entity.attributes,
        state: entity.currentState,
        confidence: entity.confidence,
      };
    });

    const relationsSnapshot = worldState.relations.map((r) => ({
      subject: r.subjectId,
      predicate: r.predicate,
      object: r.objectId,
      confidence: r.confidence,
    }));

    const result = await executeStatement(
      `INSERT INTO world_state_snapshots (
        tenant_id, user_id, session_id, snapshot_type, description,
        entities_snapshot, relations_snapshot
      ) VALUES ($1, $2, $3, 'manual', $4, $5, $6)
      RETURNING snapshot_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: userId ? { stringValue: userId } : { isNull: true } },
        { name: 'sessionId', value: sessionId ? { stringValue: sessionId } : { isNull: true } },
        { name: 'description', value: description ? { stringValue: description } : { isNull: true } },
        { name: 'entities', value: { stringValue: JSON.stringify(entitiesSnapshot) } },
        { name: 'relations', value: { stringValue: JSON.stringify(relationsSnapshot) } },
      ]
    );

    return (result.rows[0] as { snapshot_id: string }).snapshot_id;
  }

  // ============================================================================
  // JEPA-Style Prediction
  // ============================================================================

  async predictNextState(tenantId: string, action: string, currentState?: WorldState): Promise<PredictionResult> {
    const state = currentState || await this.getCurrentWorldState(tenantId);

    // Build context from current state
    const entitySummary = Array.from(state.entities.values())
      .slice(0, 20)
      .map((e) => `${e.canonicalName} (${e.entityType}): ${JSON.stringify(e.currentState)}`)
      .join('\n');

    const relationSummary = state.relations
      .slice(0, 30)
      .map((r) => {
        const subject = state.entities.get(r.subjectId);
        const object = state.entities.get(r.objectId);
        return `${subject?.canonicalName || 'Unknown'} ${r.predicate} ${object?.canonicalName || 'Unknown'}`;
      })
      .join('\n');

    const prompt = `You are a world model that predicts how the world state changes in response to actions.

Current World State:
Entities:
${entitySummary}

Relations:
${relationSummary}

Action: "${action}"

Predict:
1. Which entities will change state?
2. Which new entities might be created?
3. Which relations will change or be created?
4. What is the confidence in this prediction?

Return JSON with:
{
  "changedEntities": [{entityName, oldState, newState, changeReason}],
  "newEntities": [{type, name, attributes}],
  "changedRelations": [{subject, predicate, object, isNew, confidence}],
  "overallConfidence": 0.0-1.0,
  "reasoning": "explanation"
}`;

    try {
      const response = await this.invokeModel(prompt);
      const prediction = JSON.parse(response) as {
        changedEntities: Array<{ entityName: string; oldState: unknown; newState: unknown }>;
        newEntities: Array<{ type: EntityType; name: string; attributes: Record<string, unknown> }>;
        changedRelations: Array<{ subject: string; predicate: string; object: string; isNew: boolean; confidence: number }>;
        overallConfidence: number;
        reasoning: string;
      };

      // Apply predicted changes to create predicted state
      const predictedState: WorldState = {
        entities: new Map(state.entities),
        relations: [...state.relations],
        timestamp: new Date(),
        context: { predictedFrom: action },
      };

      // Apply entity changes
      for (const change of prediction.changedEntities) {
        const entity = Array.from(predictedState.entities.values()).find(
          (e) => e.canonicalName.toLowerCase() === change.entityName.toLowerCase()
        );
        if (entity) {
          predictedState.entities.set(entity.entityId, {
            ...entity,
            currentState: { ...entity.currentState, ...(change.newState as Record<string, unknown>) },
          });
        }
      }

      return {
        predictedState,
        confidence: prediction.overallConfidence,
        reasoning: prediction.reasoning,
        alternatives: [],
      };
    } catch {
      return {
        predictedState: state,
        confidence: 0.1,
        reasoning: 'Prediction failed',
        alternatives: [],
      };
    }
  }

  async simulateScenario(tenantId: string, scenario: string, steps: number, currentState?: WorldState): Promise<SimulationResult> {
    const state = currentState || await this.getCurrentWorldState(tenantId);
    const simulationSteps: SimulationResult['steps'] = [];
    let currentSimState = state;

    const prompt = `You are simulating a scenario step by step.

Initial World State Summary:
${Array.from(state.entities.values()).slice(0, 10).map((e) => `- ${e.canonicalName}: ${JSON.stringify(e.currentState)}`).join('\n')}

Scenario: "${scenario}"

Generate ${steps} sequential steps showing how this scenario might unfold.
Each step should include an action and its effects on the world state.

Return JSON:
{
  "steps": [
    {"step": 1, "action": "what happens", "effects": [{entity, change}], "probability": 0.0-1.0}
  ],
  "insights": ["key observations about the simulation"]
}`;

    try {
      const response = await this.invokeModel(prompt);
      const simulation = JSON.parse(response) as {
        steps: Array<{
          step: number;
          action: string;
          effects: Array<{ entity: string; change: Record<string, unknown> }>;
          probability: number;
        }>;
        insights: string[];
      };

      for (const step of simulation.steps) {
        // Apply effects to create new state
        const newState: WorldState = {
          entities: new Map(currentSimState.entities),
          relations: [...currentSimState.relations],
          timestamp: new Date(),
          context: { simulationStep: step.step },
        };

        for (const effect of step.effects) {
          const entity = Array.from(newState.entities.values()).find(
            (e) => e.canonicalName.toLowerCase() === effect.entity.toLowerCase()
          );
          if (entity) {
            newState.entities.set(entity.entityId, {
              ...entity,
              currentState: { ...entity.currentState, ...effect.change },
            });
          }
        }

        simulationSteps.push({
          step: step.step,
          action: step.action,
          resultingState: newState,
          probability: step.probability,
        });

        currentSimState = newState;
      }

      return {
        steps: simulationSteps,
        finalState: currentSimState,
        insights: simulation.insights,
      };
    } catch {
      return {
        steps: [],
        finalState: state,
        insights: ['Simulation failed'],
      };
    }
  }

  // ============================================================================
  // Counterfactual Reasoning
  // ============================================================================

  async whatIf(tenantId: string, condition: string, currentState?: WorldState): Promise<WorldState[]> {
    const state = currentState || await this.getCurrentWorldState(tenantId);

    const prompt = `You are exploring counterfactual scenarios.

Current World State:
${Array.from(state.entities.values()).slice(0, 15).map((e) => `- ${e.canonicalName}: ${JSON.stringify(e.currentState)}`).join('\n')}

Counterfactual condition: "${condition}"

Generate 3 possible alternative world states if this condition were true.
Consider different interpretations and cascading effects.

Return JSON:
{
  "alternatives": [
    {
      "interpretation": "how you interpreted the condition",
      "changedEntities": [{name, newState}],
      "probability": 0.0-1.0
    }
  ]
}`;

    try {
      const response = await this.invokeModel(prompt);
      const result = JSON.parse(response) as {
        alternatives: Array<{
          interpretation: string;
          changedEntities: Array<{ name: string; newState: Record<string, unknown> }>;
          probability: number;
        }>;
      };

      return result.alternatives.map((alt) => {
        const altState: WorldState = {
          entities: new Map(state.entities),
          relations: [...state.relations],
          timestamp: new Date(),
          context: { counterfactual: condition, interpretation: alt.interpretation },
        };

        for (const change of alt.changedEntities) {
          const entity = Array.from(altState.entities.values()).find(
            (e) => e.canonicalName.toLowerCase() === change.name.toLowerCase()
          );
          if (entity) {
            altState.entities.set(entity.entityId, {
              ...entity,
              currentState: { ...entity.currentState, ...change.newState },
            });
          }
        }

        return altState;
      });
    } catch {
      return [state];
    }
  }

  // ============================================================================
  // Graph Traversal
  // ============================================================================

  async findPath(tenantId: string, fromEntityId: string, toEntityId: string, maxDepth = 5): Promise<Array<{ entity: Entity; relation?: Relation }>> {
    // BFS to find path between entities
    const visited = new Set<string>();
    const queue: Array<{ entityId: string; path: Array<{ entity: Entity; relation?: Relation }> }> = [];
    
    const startEntity = await this.getEntity(tenantId, fromEntityId);
    if (!startEntity) return [];
    
    queue.push({ entityId: fromEntityId, path: [{ entity: startEntity }] });
    visited.add(fromEntityId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (current.entityId === toEntityId) {
        return current.path;
      }

      if (current.path.length >= maxDepth) continue;

      const relations = await this.getRelationsForEntity(tenantId, current.entityId);
      
      for (const relation of relations) {
        const nextEntityId = relation.subjectId === current.entityId ? relation.objectId : relation.subjectId;
        
        if (!visited.has(nextEntityId)) {
          visited.add(nextEntityId);
          const nextEntity = await this.getEntity(tenantId, nextEntityId);
          if (nextEntity) {
            queue.push({
              entityId: nextEntityId,
              path: [...current.path, { entity: nextEntity, relation }],
            });
          }
        }
      }
    }

    return []; // No path found
  }

  async getEntityNeighborhood(tenantId: string, entityId: string, depth = 2): Promise<{ entities: Entity[]; relations: Relation[] }> {
    const visited = new Set<string>();
    const entities: Entity[] = [];
    const relations: Relation[] = [];
    const queue: Array<{ id: string; currentDepth: number }> = [{ id: entityId, currentDepth: 0 }];

    while (queue.length > 0) {
      const { id, currentDepth } = queue.shift()!;
      
      if (visited.has(id) || currentDepth > depth) continue;
      visited.add(id);

      const entity = await this.getEntity(tenantId, id);
      if (entity) {
        entities.push(entity);

        if (currentDepth < depth) {
          const entityRelations = await this.getRelationsForEntity(tenantId, id);
          for (const relation of entityRelations) {
            if (!relations.find((r) => r.relationId === relation.relationId)) {
              relations.push(relation);
            }
            const nextId = relation.subjectId === id ? relation.objectId : relation.subjectId;
            if (!visited.has(nextId)) {
              queue.push({ id: nextId, currentDepth: currentDepth + 1 });
            }
          }
        }
      }
    }

    return { entities, relations };
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
        modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
        contentType: 'application/json',
      })
    );
    const result = JSON.parse(new TextDecoder().decode(response.body));
    return result.content?.[0]?.text || '';
  }

  private invalidateCache(tenantId: string): void {
    this.entityCache.delete(tenantId);
  }

  private mapEntity(row: Record<string, unknown>): Entity {
    return {
      entityId: String(row.entity_id),
      entityType: row.entity_type as EntityType,
      canonicalName: String(row.canonical_name),
      aliases: (row.aliases as string[]) || [],
      attributes: typeof row.attributes === 'string' ? JSON.parse(row.attributes) : (row.attributes as Record<string, unknown>) || {},
      confidence: Number(row.confidence || 0.5),
      mentionCount: Number(row.mention_count || 1),
      firstMentioned: row.first_mentioned ? new Date(row.first_mentioned as string) : undefined,
      lastMentioned: row.last_mentioned ? new Date(row.last_mentioned as string) : undefined,
      currentState: typeof row.current_state === 'string' ? JSON.parse(row.current_state) : (row.current_state as Record<string, unknown>) || {},
    };
  }

  private mapRelation(row: Record<string, unknown>): Relation {
    return {
      relationId: String(row.relation_id),
      subjectId: String(row.subject_id),
      predicate: String(row.predicate),
      objectId: String(row.object_id),
      confidence: Number(row.confidence || 0.5),
      validFrom: row.valid_from ? new Date(row.valid_from as string) : undefined,
      validTo: row.valid_to ? new Date(row.valid_to as string) : undefined,
      isCurrent: Boolean(row.is_current),
      attributes: typeof row.attributes === 'string' ? JSON.parse(row.attributes) : (row.attributes as Record<string, unknown>) || {},
    };
  }
}

export const worldModelService = new WorldModelService();
