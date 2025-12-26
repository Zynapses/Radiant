import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { executeStatement } from '../db/client';

type PatternComplexity = 'low' | 'medium' | 'high' | 'very_high';
type ExecutionType = 'serial' | 'parallel' | 'hybrid';

interface PatternMatch {
  patternId: string;
  name: string;
  similarity: number;
  complexity: PatternComplexity;
  estimatedLatencyMs: number;
  estimatedCostMultiplier: number;
}

interface WorkflowMatch {
  workflowId: string;
  name: string;
  similarity: number;
  complexity: string;
  estimatedDurationMinutes: number;
}

interface UserNeuralModel {
  preferredModels: Record<string, number>;
  preferredPatterns: string[];
  preferredWorkflows: string[];
  confidence: number;
}

export class NeuralOrchestrationService {
  private bedrock: BedrockRuntimeClient;

  constructor() {
    this.bedrock = new BedrockRuntimeClient({});
  }

  async findMatchingPatterns(
    query: string,
    limit: number = 5,
    minSimilarity: number = 0.7
  ): Promise<PatternMatch[]> {
    const embedding = await this.generateEmbedding(query);

    const result = await executeStatement(
      `SELECT 
         pattern_id, name, complexity, typical_latency_ms, typical_cost_multiplier,
         1 - (semantic_embedding <=> $1::vector) as similarity
       FROM orchestration_patterns
       WHERE is_active = true
       AND semantic_embedding IS NOT NULL
       AND 1 - (semantic_embedding <=> $1::vector) >= $3
       ORDER BY semantic_embedding <=> $1::vector
       LIMIT $2`,
      [
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
        { name: 'limit', value: { longValue: limit } },
        { name: 'minSimilarity', value: { doubleValue: minSimilarity } },
      ]
    );

    return result.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        patternId: String(r.pattern_id),
        name: String(r.name),
        similarity: Number(r.similarity),
        complexity: r.complexity as PatternComplexity,
        estimatedLatencyMs: parseInt(String(r.typical_latency_ms || 1000), 10),
        estimatedCostMultiplier: Number(r.typical_cost_multiplier || 1.0),
      };
    });
  }

  async findMatchingWorkflows(
    query: string,
    limit: number = 5,
    minSimilarity: number = 0.7
  ): Promise<WorkflowMatch[]> {
    const embedding = await this.generateEmbedding(query);

    const result = await executeStatement(
      `SELECT 
         workflow_id, name, complexity, estimated_duration_minutes,
         1 - (semantic_embedding <=> $1::vector) as similarity
       FROM production_workflows
       WHERE is_active = true
       AND semantic_embedding IS NOT NULL
       AND 1 - (semantic_embedding <=> $1::vector) >= $3
       ORDER BY semantic_embedding <=> $1::vector
       LIMIT $2`,
      [
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
        { name: 'limit', value: { longValue: limit } },
        { name: 'minSimilarity', value: { doubleValue: minSimilarity } },
      ]
    );

    return result.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        workflowId: String(r.workflow_id),
        name: String(r.name),
        similarity: Number(r.similarity),
        complexity: String(r.complexity || 'medium'),
        estimatedDurationMinutes: parseInt(String(r.estimated_duration_minutes || 5), 10),
      };
    });
  }

  async getOrCreateUserNeuralModel(tenantId: string, userId: string): Promise<UserNeuralModel> {
    const result = await executeStatement(
      `SELECT preferred_models, preferred_patterns, preferred_workflows, confidence
       FROM user_neural_models
       WHERE tenant_id = $1 AND user_id = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );

    if (result.rows.length === 0) {
      // Create new model
      await executeStatement(
        `INSERT INTO user_neural_models (tenant_id, user_id) VALUES ($1, $2)`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'userId', value: { stringValue: userId } },
        ]
      );

      return {
        preferredModels: {},
        preferredPatterns: [],
        preferredWorkflows: [],
        confidence: 0,
      };
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      preferredModels: typeof row.preferred_models === 'string' 
        ? JSON.parse(row.preferred_models) 
        : (row.preferred_models as Record<string, number>) || {},
      preferredPatterns: (row.preferred_patterns as string[]) || [],
      preferredWorkflows: (row.preferred_workflows as string[]) || [],
      confidence: Number(row.confidence || 0),
    };
  }

  async updateUserPreferences(
    tenantId: string,
    userId: string,
    updates: {
      modelId?: string;
      modelScore?: number;
      patternId?: string;
      workflowId?: string;
    }
  ): Promise<void> {
    const model = await this.getOrCreateUserNeuralModel(tenantId, userId);

    if (updates.modelId && updates.modelScore !== undefined) {
      model.preferredModels[updates.modelId] = 
        (model.preferredModels[updates.modelId] || 0.5) * 0.9 + updates.modelScore * 0.1;
    }

    if (updates.patternId && !model.preferredPatterns.includes(updates.patternId)) {
      model.preferredPatterns = [updates.patternId, ...model.preferredPatterns].slice(0, 10);
    }

    if (updates.workflowId && !model.preferredWorkflows.includes(updates.workflowId)) {
      model.preferredWorkflows = [updates.workflowId, ...model.preferredWorkflows].slice(0, 10);
    }

    const newConfidence = Math.min(1.0, model.confidence + 0.01);

    await executeStatement(
      `UPDATE user_neural_models 
       SET preferred_models = $3, preferred_patterns = $4, preferred_workflows = $5, 
           confidence = $6, last_updated = NOW()
       WHERE tenant_id = $1 AND user_id = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'preferredModels', value: { stringValue: JSON.stringify(model.preferredModels) } },
        { name: 'preferredPatterns', value: { stringValue: `{${model.preferredPatterns.join(',')}}` } },
        { name: 'preferredWorkflows', value: { stringValue: `{${model.preferredWorkflows.join(',')}}` } },
        { name: 'confidence', value: { doubleValue: newConfidence } },
      ]
    );
  }

  async selectOrchestration(
    tenantId: string,
    userId: string,
    query: string,
    taskType: string,
    constraints?: {
      maxLatencyMs?: number;
      maxCostMultiplier?: number;
      requiredCapabilities?: string[];
    }
  ): Promise<{
    patternId?: string;
    workflowId?: string;
    confidence: number;
    reasoning: string;
    alternatives: Array<{ id: string; type: 'pattern' | 'workflow'; score: number }>;
  }> {
    // Get user preferences
    const userModel = await this.getOrCreateUserNeuralModel(tenantId, userId);

    // Find matching patterns and workflows
    const [patterns, workflows] = await Promise.all([
      this.findMatchingPatterns(query, 5, 0.5),
      this.findMatchingWorkflows(query, 5, 0.5),
    ]);

    // Score and rank candidates
    const candidates: Array<{
      id: string;
      type: 'pattern' | 'workflow';
      score: number;
      name: string;
    }> = [];

    for (const pattern of patterns) {
      let score = pattern.similarity;

      // Boost for user preferences
      if (userModel.preferredPatterns.includes(pattern.patternId)) {
        score += 0.1;
      }

      // Apply constraints
      if (constraints?.maxLatencyMs && pattern.estimatedLatencyMs > constraints.maxLatencyMs) {
        score *= 0.5;
      }
      if (constraints?.maxCostMultiplier && pattern.estimatedCostMultiplier > constraints.maxCostMultiplier) {
        score *= 0.7;
      }

      candidates.push({ id: pattern.patternId, type: 'pattern', score, name: pattern.name });
    }

    for (const workflow of workflows) {
      let score = workflow.similarity;

      if (userModel.preferredWorkflows.includes(workflow.workflowId)) {
        score += 0.1;
      }

      candidates.push({ id: workflow.workflowId, type: 'workflow', score, name: workflow.name });
    }

    // Sort by score
    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length === 0) {
      return {
        confidence: 0.3,
        reasoning: 'No matching patterns or workflows found. Using default approach.',
        alternatives: [],
      };
    }

    const best = candidates[0];
    const alternatives = candidates.slice(1, 4).map((c) => ({ id: c.id, type: c.type, score: c.score }));

    return {
      patternId: best.type === 'pattern' ? best.id : undefined,
      workflowId: best.type === 'workflow' ? best.id : undefined,
      confidence: Math.min(best.score, 0.95),
      reasoning: `Selected ${best.type} "${best.name}" with score ${best.score.toFixed(2)} based on semantic similarity and user preferences.`,
      alternatives,
    };
  }

  async getPatternCategories(): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT * FROM orchestration_pattern_categories ORDER BY display_order`,
      []
    );
    return result.rows;
  }

  async getWorkflowCategories(): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT * FROM production_workflow_categories ORDER BY display_order`,
      []
    );
    return result.rows;
  }

  async getPatternsByCategory(categoryId: string): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT * FROM orchestration_patterns WHERE category_id = $1 AND is_active = true ORDER BY usage_count DESC`,
      [{ name: 'categoryId', value: { stringValue: categoryId } }]
    );
    return result.rows;
  }

  async getWorkflowsByCategory(categoryId: string): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT * FROM production_workflows WHERE category_id = $1 AND is_active = true ORDER BY usage_count DESC`,
      [{ name: 'categoryId', value: { stringValue: categoryId } }]
    );
    return result.rows;
  }

  async recordPatternUsage(patternId: string, satisfactionScore?: number): Promise<void> {
    await executeStatement(
      `UPDATE orchestration_patterns 
       SET usage_count = usage_count + 1,
           avg_satisfaction_score = COALESCE(
             (avg_satisfaction_score * usage_count + $2) / (usage_count + 1),
             $2
           ),
           updated_at = NOW()
       WHERE pattern_id = $1`,
      [
        { name: 'patternId', value: { stringValue: patternId } },
        { name: 'satisfactionScore', value: satisfactionScore !== undefined ? { doubleValue: satisfactionScore } : { isNull: true } },
      ]
    );
  }

  async recordWorkflowUsage(workflowId: string, qualityScore?: number): Promise<void> {
    await executeStatement(
      `UPDATE production_workflows 
       SET usage_count = usage_count + 1,
           avg_quality_score = COALESCE(
             (avg_quality_score * usage_count + $2) / (usage_count + 1),
             $2
           ),
           updated_at = NOW()
       WHERE workflow_id = $1`,
      [
        { name: 'workflowId', value: { stringValue: workflowId } },
        { name: 'qualityScore', value: qualityScore !== undefined ? { doubleValue: qualityScore } : { isNull: true } },
      ]
    );
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.bedrock.send(
        new InvokeModelCommand({
          modelId: 'amazon.titan-embed-text-v1',
          body: JSON.stringify({ inputText: text }),
          contentType: 'application/json',
        })
      );

      const result = JSON.parse(new TextDecoder().decode(response.body));
      return result.embedding;
    } catch (error) {
      console.error('Embedding generation error:', error);
      return new Array(768).fill(0);
    }
  }
}

export const neuralOrchestrationService = new NeuralOrchestrationService();
