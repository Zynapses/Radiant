// RADIANT v4.18.0 - Causal Reasoning Service
// Advanced Cognition: Do-calculus, interventions, counterfactual simulation

import { executeStatement } from '../db/client';
import { modelRouterService } from './model-router.service';

// ============================================================================
// Types
// ============================================================================

export type NodeType = 'variable' | 'event' | 'state' | 'action' | 'outcome';
export type CausalType = 'direct' | 'indirect' | 'confounded' | 'mediated' | 'moderated';
export type InterventionType = 'do' | 'observe' | 'counterfactual';

export interface CausalNode {
  nodeId: string;
  name: string;
  nodeType: NodeType;
  description?: string;
  isObservable: boolean;
  isManipulable: boolean;
  domainType?: string;
  possibleValues: unknown[];
  currentValue?: unknown;
  valueConfidence?: number;
}

export interface CausalEdge {
  edgeId: string;
  causeNodeId: string;
  effectNodeId: string;
  causalType: CausalType;
  mechanism?: string;
  causalStrength: number;
  confidence: number;
  timeLagMins?: number;
  conditions: Array<{ variable: string; operator: string; value: unknown }>;
  evidenceType?: string;
  evidenceCount: number;
}

export interface CausalGraph {
  nodes: CausalNode[];
  edges: CausalEdge[];
}

export interface InterventionResult {
  interventionId: string;
  interventionType: InterventionType;
  targetNode: CausalNode;
  interventionValue: unknown;
  predictedEffects: Record<string, { value: unknown; confidence: number }>;
  reasoningTrace: string[];
}

export interface CounterfactualResult {
  interventionId: string;
  premise: string;
  conclusion: string;
  confidence: number;
  affectedNodes: Array<{ nodeId: string; originalValue: unknown; counterfactualValue: unknown }>;
  reasoningTrace: string[];
}

export interface CausalPath {
  path: string[];
  totalStrength: number;
  edgeCount: number;
}

// ============================================================================
// Causal Reasoning Service
// ============================================================================

export class CausalReasoningService {
  // ============================================================================
  // Node Management
  // ============================================================================

  async createNode(
    tenantId: string,
    name: string,
    nodeType: NodeType,
    options: {
      description?: string;
      isObservable?: boolean;
      isManipulable?: boolean;
      domainType?: string;
      possibleValues?: unknown[];
      currentValue?: unknown;
    } = {}
  ): Promise<CausalNode> {
    const embedding = await this.generateEmbedding(name + ' ' + (options.description || ''));

    const result = await executeStatement(
      `INSERT INTO causal_nodes (
        tenant_id, name, node_type, description, node_embedding,
        is_observable, is_manipulable, domain_type, possible_values, current_value
      ) VALUES ($1, $2, $3, $4, $5::vector, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'name', value: { stringValue: name } },
        { name: 'nodeType', value: { stringValue: nodeType } },
        { name: 'description', value: options.description ? { stringValue: options.description } : { isNull: true } },
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
        { name: 'isObservable', value: { booleanValue: options.isObservable ?? true } },
        { name: 'isManipulable', value: { booleanValue: options.isManipulable ?? true } },
        { name: 'domainType', value: options.domainType ? { stringValue: options.domainType } : { isNull: true } },
        { name: 'possibleValues', value: { stringValue: JSON.stringify(options.possibleValues || []) } },
        { name: 'currentValue', value: options.currentValue !== undefined ? { stringValue: JSON.stringify(options.currentValue) } : { isNull: true } },
      ]
    );

    return this.mapNode(result.rows[0] as Record<string, unknown>);
  }

  async getNode(nodeId: string): Promise<CausalNode | null> {
    const result = await executeStatement(
      `SELECT * FROM causal_nodes WHERE node_id = $1`,
      [{ name: 'nodeId', value: { stringValue: nodeId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapNode(result.rows[0] as Record<string, unknown>);
  }

  async findNodesByName(tenantId: string, query: string): Promise<CausalNode[]> {
    const embedding = await this.generateEmbedding(query);

    const result = await executeStatement(
      `SELECT *, 1 - (node_embedding <=> $2::vector) as similarity
       FROM causal_nodes
       WHERE tenant_id = $1 AND is_active = true
       ORDER BY node_embedding <=> $2::vector
       LIMIT 10`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
      ]
    );

    return result.rows.map((row) => this.mapNode(row as Record<string, unknown>));
  }

  async updateNodeValue(nodeId: string, value: unknown, confidence?: number): Promise<void> {
    await executeStatement(
      `UPDATE causal_nodes SET
        current_value = $2,
        value_confidence = COALESCE($3, value_confidence),
        last_observed = NOW(),
        observation_count = observation_count + 1
      WHERE node_id = $1`,
      [
        { name: 'nodeId', value: { stringValue: nodeId } },
        { name: 'value', value: { stringValue: JSON.stringify(value) } },
        { name: 'confidence', value: confidence !== undefined ? { doubleValue: confidence } : { isNull: true } },
      ]
    );
  }

  // ============================================================================
  // Edge Management
  // ============================================================================

  async createEdge(
    tenantId: string,
    causeNodeId: string,
    effectNodeId: string,
    options: {
      causalType?: CausalType;
      mechanism?: string;
      causalStrength?: number;
      confidence?: number;
      timeLagMins?: number;
      conditions?: Array<{ variable: string; operator: string; value: unknown }>;
      evidenceType?: string;
    } = {}
  ): Promise<CausalEdge> {
    const result = await executeStatement(
      `INSERT INTO causal_edges (
        tenant_id, cause_node_id, effect_node_id, causal_type, mechanism,
        causal_strength, confidence, time_lag_mins, conditions, evidence_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'causeNodeId', value: { stringValue: causeNodeId } },
        { name: 'effectNodeId', value: { stringValue: effectNodeId } },
        { name: 'causalType', value: { stringValue: options.causalType || 'direct' } },
        { name: 'mechanism', value: options.mechanism ? { stringValue: options.mechanism } : { isNull: true } },
        { name: 'causalStrength', value: { doubleValue: options.causalStrength ?? 0.5 } },
        { name: 'confidence', value: { doubleValue: options.confidence ?? 0.5 } },
        { name: 'timeLagMins', value: options.timeLagMins ? { longValue: options.timeLagMins } : { isNull: true } },
        { name: 'conditions', value: { stringValue: JSON.stringify(options.conditions || []) } },
        { name: 'evidenceType', value: options.evidenceType ? { stringValue: options.evidenceType } : { isNull: true } },
      ]
    );

    return this.mapEdge(result.rows[0] as Record<string, unknown>);
  }

  async getNodeEdges(nodeId: string, direction: 'causes' | 'effects' | 'both' = 'both'): Promise<CausalEdge[]> {
    let query = `SELECT * FROM causal_edges WHERE is_active = true AND `;

    if (direction === 'causes') {
      query += `effect_node_id = $1`;
    } else if (direction === 'effects') {
      query += `cause_node_id = $1`;
    } else {
      query += `(cause_node_id = $1 OR effect_node_id = $1)`;
    }

    const result = await executeStatement(query, [{ name: 'nodeId', value: { stringValue: nodeId } }]);
    return result.rows.map((row) => this.mapEdge(row as Record<string, unknown>));
  }

  async updateEdgeStrength(edgeId: string, strength: number, confidence?: number): Promise<void> {
    await executeStatement(
      `UPDATE causal_edges SET
        causal_strength = $2,
        confidence = COALESCE($3, confidence),
        evidence_count = evidence_count + 1
      WHERE edge_id = $1`,
      [
        { name: 'edgeId', value: { stringValue: edgeId } },
        { name: 'strength', value: { doubleValue: strength } },
        { name: 'confidence', value: confidence !== undefined ? { doubleValue: confidence } : { isNull: true } },
      ]
    );
  }

  // ============================================================================
  // Causal Graph Operations
  // ============================================================================

  async getGraph(tenantId: string): Promise<CausalGraph> {
    const nodesResult = await executeStatement(
      `SELECT * FROM causal_nodes WHERE tenant_id = $1 AND is_active = true`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const edgesResult = await executeStatement(
      `SELECT * FROM causal_edges WHERE tenant_id = $1 AND is_active = true`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return {
      nodes: nodesResult.rows.map((row) => this.mapNode(row as Record<string, unknown>)),
      edges: edgesResult.rows.map((row) => this.mapEdge(row as Record<string, unknown>)),
    };
  }

  async findCausalPath(tenantId: string, sourceNodeId: string, targetNodeId: string, maxDepth = 5): Promise<CausalPath[]> {
    const result = await executeStatement(
      `SELECT * FROM find_causal_path($1, $2, $3, $4)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'sourceNodeId', value: { stringValue: sourceNodeId } },
        { name: 'targetNodeId', value: { stringValue: targetNodeId } },
        { name: 'maxDepth', value: { longValue: maxDepth } },
      ]
    );

    return result.rows.map((row) => {
      const r = row as { path: string[]; total_strength: number; edge_count: number };
      return {
        path: r.path,
        totalStrength: Number(r.total_strength),
        edgeCount: r.edge_count,
      };
    });
  }

  // ============================================================================
  // Do-Calculus Operations
  // ============================================================================

  async doIntervention(
    tenantId: string,
    targetNodeId: string,
    interventionValue: unknown,
    queryNodeIds: string[],
    context?: { userId?: string; sessionId?: string }
  ): Promise<InterventionResult> {
    const targetNode = await this.getNode(targetNodeId);
    if (!targetNode) throw new Error('Target node not found');

    if (!targetNode.isManipulable) {
      throw new Error(`Node "${targetNode.name}" is not manipulable`);
    }

    // Get the causal graph
    const graph = await this.getGraph(tenantId);

    // Find all nodes affected by this intervention
    const affectedNodes = await this.findDownstreamNodes(tenantId, targetNodeId);

    // Use LLM to predict effects based on causal structure
    const predictedEffects = await this.predictInterventionEffects(
      targetNode,
      interventionValue,
      affectedNodes,
      queryNodeIds.map((id) => graph.nodes.find((n) => n.nodeId === id)!).filter(Boolean),
      graph.edges
    );

    // Store the intervention
    const result = await executeStatement(
      `INSERT INTO causal_interventions (
        tenant_id, user_id, session_id, intervention_type, target_node_id,
        intervention_value, query_node_ids, predicted_effects, reasoning_trace
      ) VALUES ($1, $2, $3, 'do', $4, $5, $6, $7, $8)
      RETURNING intervention_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: context?.userId ? { stringValue: context.userId } : { isNull: true } },
        { name: 'sessionId', value: context?.sessionId ? { stringValue: context.sessionId } : { isNull: true } },
        { name: 'targetNodeId', value: { stringValue: targetNodeId } },
        { name: 'interventionValue', value: { stringValue: JSON.stringify(interventionValue) } },
        { name: 'queryNodeIds', value: { stringValue: `{${queryNodeIds.join(',')}}` } },
        { name: 'predictedEffects', value: { stringValue: JSON.stringify(predictedEffects.effects) } },
        { name: 'reasoningTrace', value: { stringValue: JSON.stringify(predictedEffects.trace) } },
      ]
    );

    return {
      interventionId: (result.rows[0] as { intervention_id: string }).intervention_id,
      interventionType: 'do',
      targetNode,
      interventionValue,
      predictedEffects: predictedEffects.effects,
      reasoningTrace: predictedEffects.trace,
    };
  }

  async counterfactual(
    tenantId: string,
    premise: string,
    targetNodeId: string,
    counterfactualValue: unknown,
    context?: { userId?: string; sessionId?: string }
  ): Promise<CounterfactualResult> {
    const targetNode = await this.getNode(targetNodeId);
    if (!targetNode) throw new Error('Target node not found');

    const graph = await this.getGraph(tenantId);
    const affectedNodes = await this.findDownstreamNodes(tenantId, targetNodeId);

    // Use LLM for counterfactual reasoning
    const result = await this.reasonCounterfactual(premise, targetNode, counterfactualValue, affectedNodes, graph);

    // Store the counterfactual
    const insertResult = await executeStatement(
      `INSERT INTO causal_interventions (
        tenant_id, user_id, session_id, intervention_type, target_node_id,
        intervention_value, counterfactual_premise, counterfactual_conclusion,
        predicted_effects, reasoning_trace
      ) VALUES ($1, $2, $3, 'counterfactual', $4, $5, $6, $7, $8, $9)
      RETURNING intervention_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: context?.userId ? { stringValue: context.userId } : { isNull: true } },
        { name: 'sessionId', value: context?.sessionId ? { stringValue: context.sessionId } : { isNull: true } },
        { name: 'targetNodeId', value: { stringValue: targetNodeId } },
        { name: 'counterfactualValue', value: { stringValue: JSON.stringify(counterfactualValue) } },
        { name: 'premise', value: { stringValue: premise } },
        { name: 'conclusion', value: { stringValue: result.conclusion } },
        { name: 'effects', value: { stringValue: JSON.stringify(result.affectedNodes) } },
        { name: 'trace', value: { stringValue: JSON.stringify(result.trace) } },
      ]
    );

    return {
      interventionId: (insertResult.rows[0] as { intervention_id: string }).intervention_id,
      premise,
      conclusion: result.conclusion,
      confidence: result.confidence,
      affectedNodes: result.affectedNodes,
      reasoningTrace: result.trace,
    };
  }

  private async findDownstreamNodes(tenantId: string, nodeId: string): Promise<CausalNode[]> {
    const result = await executeStatement(
      `WITH RECURSIVE downstream AS (
        SELECT effect_node_id as node_id, 1 as depth
        FROM causal_edges
        WHERE cause_node_id = $1 AND is_active = true
        
        UNION
        
        SELECT ce.effect_node_id, d.depth + 1
        FROM causal_edges ce
        JOIN downstream d ON ce.cause_node_id = d.node_id
        WHERE ce.is_active = true AND d.depth < 5
      )
      SELECT DISTINCT cn.*
      FROM downstream d
      JOIN causal_nodes cn ON cn.node_id = d.node_id
      WHERE cn.tenant_id = $2`,
      [
        { name: 'nodeId', value: { stringValue: nodeId } },
        { name: 'tenantId', value: { stringValue: tenantId } },
      ]
    );

    return result.rows.map((row) => this.mapNode(row as Record<string, unknown>));
  }

  private async predictInterventionEffects(
    targetNode: CausalNode,
    interventionValue: unknown,
    affectedNodes: CausalNode[],
    queryNodes: CausalNode[],
    edges: CausalEdge[]
  ): Promise<{ effects: Record<string, { value: unknown; confidence: number }>; trace: string[] }> {
    const prompt = `You are performing causal inference using do-calculus.

INTERVENTION: do(${targetNode.name} = ${JSON.stringify(interventionValue)})

This intervention sets "${targetNode.name}" to ${JSON.stringify(interventionValue)}, breaking all causal arrows INTO this node.

CAUSAL STRUCTURE:
${edges.map((e) => {
  const cause = affectedNodes.find((n) => n.nodeId === e.causeNodeId)?.name || e.causeNodeId;
  const effect = affectedNodes.find((n) => n.nodeId === e.effectNodeId)?.name || e.effectNodeId;
  return `  ${cause} --[${e.causalStrength.toFixed(2)}]--> ${effect}${e.mechanism ? ` (${e.mechanism})` : ''}`;
}).join('\n')}

AFFECTED VARIABLES:
${affectedNodes.map((n) => `  - ${n.name}: current=${JSON.stringify(n.currentValue)}`).join('\n')}

QUERY: What are the predicted values for these variables after the intervention?
${queryNodes.map((n) => `  - ${n.name}`).join('\n')}

Reason step by step through the causal graph. For each query variable, predict:
1. The new value after intervention
2. Your confidence (0-1)

Return JSON:
{
  "effects": {
    "variable_name": {"value": ..., "confidence": 0.0-1.0}
  },
  "reasoning": ["step 1...", "step 2..."]
}`;

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const effects: Record<string, { value: unknown; confidence: number }> = {};

        for (const node of queryNodes) {
          if (parsed.effects?.[node.name]) {
            effects[node.nodeId] = parsed.effects[node.name];
          }
        }

        return { effects, trace: parsed.reasoning || [] };
      }
    } catch { /* use defaults */ }

    return { effects: {}, trace: ['Unable to perform causal inference'] };
  }

  private async reasonCounterfactual(
    premise: string,
    targetNode: CausalNode,
    counterfactualValue: unknown,
    affectedNodes: CausalNode[],
    graph: CausalGraph
  ): Promise<{
    conclusion: string;
    confidence: number;
    affectedNodes: Array<{ nodeId: string; originalValue: unknown; counterfactualValue: unknown }>;
    trace: string[];
  }> {
    const prompt = `You are performing counterfactual reasoning.

PREMISE: ${premise}

COUNTERFACTUAL: What if "${targetNode.name}" had been ${JSON.stringify(counterfactualValue)} instead of ${JSON.stringify(targetNode.currentValue)}?

CAUSAL STRUCTURE:
${graph.edges.slice(0, 20).map((e) => {
  const cause = graph.nodes.find((n) => n.nodeId === e.causeNodeId)?.name || '?';
  const effect = graph.nodes.find((n) => n.nodeId === e.effectNodeId)?.name || '?';
  return `  ${cause} --> ${effect}`;
}).join('\n')}

CURRENT STATE:
${affectedNodes.slice(0, 10).map((n) => `  ${n.name} = ${JSON.stringify(n.currentValue)}`).join('\n')}

Using the counterfactual framework:
1. ABDUCTION: Given the actual outcome, what are the latent factors?
2. ACTION: Apply the counterfactual change
3. PREDICTION: What would the outcome have been?

Return JSON:
{
  "conclusion": "natural language conclusion",
  "confidence": 0.0-1.0,
  "affected_nodes": [
    {"name": "...", "original": ..., "counterfactual": ...}
  ],
  "reasoning": ["step 1...", "step 2..."]
}`;

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        const affected = (parsed.affected_nodes || []).map((an: { name: string; original: unknown; counterfactual: unknown }) => {
          const node = affectedNodes.find((n) => n.name === an.name);
          return {
            nodeId: node?.nodeId || '',
            originalValue: an.original,
            counterfactualValue: an.counterfactual,
          };
        });

        return {
          conclusion: parsed.conclusion || 'Unable to determine counterfactual outcome',
          confidence: parsed.confidence || 0.5,
          affectedNodes: affected,
          trace: parsed.reasoning || [],
        };
      }
    } catch { /* use defaults */ }

    return {
      conclusion: 'Unable to perform counterfactual reasoning',
      confidence: 0,
      affectedNodes: [],
      trace: ['Reasoning failed'],
    };
  }

  // ============================================================================
  // Causal Discovery
  // ============================================================================

  async discoverCausalRelations(tenantId: string, text: string): Promise<{ nodes: CausalNode[]; edges: CausalEdge[] }> {
    const prompt = `Extract causal relationships from this text.

TEXT: "${text.substring(0, 3000)}"

Identify:
1. Variables/events that cause other things
2. The direction and strength of causation
3. Any conditions or moderators

Return JSON:
{
  "nodes": [
    {"name": "...", "type": "variable|event|state|action|outcome", "description": "..."}
  ],
  "edges": [
    {"cause": "cause_name", "effect": "effect_name", "type": "direct|indirect|confounded|mediated", "strength": 0.0-1.0, "mechanism": "how cause produces effect"}
  ]
}`;

    const createdNodes: CausalNode[] = [];
    const createdEdges: CausalEdge[] = [];

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Create nodes
        const nodeMap: Record<string, string> = {};
        for (const n of parsed.nodes || []) {
          const node = await this.createNode(tenantId, n.name, n.type || 'variable', { description: n.description });
          createdNodes.push(node);
          nodeMap[n.name] = node.nodeId;
        }

        // Create edges
        for (const e of parsed.edges || []) {
          if (nodeMap[e.cause] && nodeMap[e.effect]) {
            const edge = await this.createEdge(tenantId, nodeMap[e.cause], nodeMap[e.effect], {
              causalType: e.type,
              causalStrength: e.strength,
              mechanism: e.mechanism,
              evidenceType: 'inferred',
            });
            createdEdges.push(edge);
          }
        }
      }
    } catch { /* extraction failed */ }

    return { nodes: createdNodes, edges: createdEdges };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      await modelRouterService.invoke({
        modelId: 'amazon/titan-embed-text',
        messages: [{ role: 'user', content: text.substring(0, 8000) }],
      });
      return new Array(1536).fill(0);
    } catch {
      return new Array(1536).fill(0);
    }
  }

  private async invokeModel(prompt: string): Promise<string> {
    const response = await modelRouterService.invoke({
      modelId: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 4096,
    });
    return response.content;
  }

  private mapNode(row: Record<string, unknown>): CausalNode {
    return {
      nodeId: String(row.node_id),
      name: String(row.name),
      nodeType: row.node_type as NodeType,
      description: row.description ? String(row.description) : undefined,
      isObservable: Boolean(row.is_observable ?? true),
      isManipulable: Boolean(row.is_manipulable ?? true),
      domainType: row.domain_type ? String(row.domain_type) : undefined,
      possibleValues: typeof row.possible_values === 'string' ? JSON.parse(row.possible_values) : (row.possible_values as unknown[]) || [],
      currentValue: row.current_value ? (typeof row.current_value === 'string' ? JSON.parse(row.current_value) : row.current_value) : undefined,
      valueConfidence: row.value_confidence ? Number(row.value_confidence) : undefined,
    };
  }

  private mapEdge(row: Record<string, unknown>): CausalEdge {
    return {
      edgeId: String(row.edge_id),
      causeNodeId: String(row.cause_node_id),
      effectNodeId: String(row.effect_node_id),
      causalType: row.causal_type as CausalType,
      mechanism: row.mechanism ? String(row.mechanism) : undefined,
      causalStrength: Number(row.causal_strength ?? 0.5),
      confidence: Number(row.confidence ?? 0.5),
      timeLagMins: row.time_lag_mins ? Number(row.time_lag_mins) : undefined,
      conditions: typeof row.conditions === 'string' ? JSON.parse(row.conditions) : (row.conditions as Array<{ variable: string; operator: string; value: unknown }>) || [],
      evidenceType: row.evidence_type ? String(row.evidence_type) : undefined,
      evidenceCount: Number(row.evidence_count || 0),
    };
  }
}

export const causalReasoningService = new CausalReasoningService();
