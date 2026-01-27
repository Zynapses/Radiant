/**
 * Pre-Cognition Service
 * 
 * "Radiant answers before you ask."
 * 
 * Pre-Cognition uses speculative execution to predict the user's next 
 * likely actions and pre-compute solutions in the background. When the 
 * user's request matches a prediction, the response appears instantly.
 * 
 * @module reality-engine/pre-cognition
 */

import { v4 as uuidv4 } from 'uuid';
import { executeStatement } from '../../db/client';
import {
  PreCognitionPrediction,
  PreCognitionStatus,
  PreCognitionSolution,
  PreCognitionQueue,
  PreCognitionConfig,
  PreCognitionAction,
  MorphicIntent,
  MorphicLayout,
  RealityChatMessage,
} from '@radiant/shared';

// Type alias for flexible params
type LooseParam = any;



interface IntentPrediction {
  intent: MorphicIntent;
  prompt: string;
  confidence: number;
}

const DEFAULT_CONFIG: PreCognitionConfig = {
  enabled: true,
  maxPredictions: 3,
  predictionTTLMs: 60000, // 1 minute
  computeBudgetMs: 5000,  // 5 seconds
  minConfidenceThreshold: 0.6,
  useGenesisModel: true,
  genesisModelId: 'llama-3-8b-instruct',
};

class PreCognitionService {
  private queues: Map<string, PreCognitionQueue> = new Map();

  /**
   * Initialize pre-cognition for a session
   */
  async initializeQueue(
    sessionId: string,
    config: Partial<PreCognitionConfig> = {}
  ): Promise<PreCognitionQueue> {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    
    const queue: PreCognitionQueue = {
      sessionId,
      predictions: [],
      maxSize: fullConfig.maxPredictions,
      computeBudgetMs: fullConfig.computeBudgetMs,
      lastRefresh: new Date(),
    };

    this.queues.set(sessionId, queue);

    await executeStatement(
      `INSERT INTO precognition_queues (session_id, config, predictions, last_refresh)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id) DO UPDATE SET config = $2, last_refresh = $4`,
      [sessionId, JSON.stringify(fullConfig), '[]', new Date().toISOString()] as any[]
    );

    return queue;
  }

  /**
   * Predict the next likely user intents based on conversation history
   */
  async predictNextIntents(
    tenantId: string,
    userId: string,
    sessionId: string,
    conversationHistory: RealityChatMessage[],
    currentLayout: MorphicLayout | null
  ): Promise<IntentPrediction[]> {
    // Analyze the last few messages to predict next moves
    const recentMessages = conversationHistory.slice(-5);
    const predictions: IntentPrediction[] = [];

    // Pattern matching for common follow-up intents
    const lastUserMessage = recentMessages
      .filter(m => m.role === 'user')
      .pop();

    if (!lastUserMessage) return [];

    const content = lastUserMessage.content.toLowerCase();

    // Context-aware predictions based on current state
    if (currentLayout) {
      // If they have a data grid, they might want to visualize
      if (currentLayout.components.some(c => c.componentType === 'DataGrid')) {
        predictions.push({
          intent: 'visualization',
          prompt: 'Visualize this data as a chart',
          confidence: 0.75,
        });
        predictions.push({
          intent: 'data_analysis',
          prompt: 'Analyze trends in this data',
          confidence: 0.65,
        });
      }

      // If they have a chart, they might want to export or share
      if (currentLayout.components.some(c => 
        ['LineChart', 'BarChart', 'PieChart'].includes(c.componentType)
      )) {
        predictions.push({
          intent: 'communication',
          prompt: 'Export this chart',
          confidence: 0.7,
        });
      }

      // If they have a Kanban, they might want calendar view
      if (currentLayout.components.some(c => c.componentType === 'KanbanBoard')) {
        predictions.push({
          intent: 'planning',
          prompt: 'Show this as a calendar',
          confidence: 0.65,
        });
      }
    }

    // Content-based predictions
    if (content.includes('login') || content.includes('auth')) {
      predictions.push({
        intent: 'coding',
        prompt: 'Add password reset functionality',
        confidence: 0.8,
      });
      predictions.push({
        intent: 'coding',
        prompt: 'Add OAuth integration',
        confidence: 0.7,
      });
    }

    if (content.includes('dashboard') || content.includes('analytics')) {
      predictions.push({
        intent: 'visualization',
        prompt: 'Add more metrics to the dashboard',
        confidence: 0.75,
      });
    }

    if (content.includes('budget') || content.includes('cost') || content.includes('expense')) {
      predictions.push({
        intent: 'finance',
        prompt: 'Create a budget breakdown',
        confidence: 0.8,
      });
    }

    if (content.includes('project') || content.includes('task')) {
      predictions.push({
        intent: 'tracking',
        prompt: 'Add timeline view',
        confidence: 0.7,
      });
    }

    // Sort by confidence and limit
    return predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, DEFAULT_CONFIG.maxPredictions);
  }

  /**
   * Pre-compute solutions for predicted intents
   */
  async preComputeSolutions(
    tenantId: string,
    userId: string,
    sessionId: string,
    predictions: IntentPrediction[]
  ): Promise<void> {
    const startTime = Date.now();
    const config = await this.getConfig(sessionId);
    
    for (const prediction of predictions) {
      // Check budget
      if (Date.now() - startTime > config.computeBudgetMs) {
        break;
      }

      // Skip low confidence predictions
      if (prediction.confidence < config.minConfidenceThreshold) {
        continue;
      }

      const solution = await this.generateSolution(
        tenantId,
        prediction.intent,
        prediction.prompt
      );

      const preCognition: PreCognitionPrediction = {
        id: uuidv4(),
        tenantId,
        userId,
        sessionId,
        predictedIntent: prediction.intent,
        predictedPrompt: prediction.prompt,
        confidence: prediction.confidence,
        solution,
        status: 'ready',
        computeTimeMs: Date.now() - startTime,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + config.predictionTTLMs),
      };

      await this.storePrediction(preCognition);
    }
  }

  /**
   * Check if a user's request matches any pre-computed prediction
   */
  async matchPrediction(
    sessionId: string,
    userPrompt: string,
    intent?: MorphicIntent
  ): Promise<PreCognitionPrediction | null> {
    const predictions = await this.getActivePredictions(sessionId);
    
    for (const prediction of predictions) {
      // Check if expired
      if (new Date() > prediction.expiresAt) {
        await this.updatePredictionStatus(prediction.id, 'expired');
        continue;
      }

      // Match by intent first (fast)
      if (intent && prediction.predictedIntent === intent) {
        await this.updatePredictionStatus(prediction.id, 'used');
        return prediction;
      }

      // Fuzzy match on prompt content
      const similarity = this.calculateSimilarity(
        userPrompt.toLowerCase(),
        prediction.predictedPrompt.toLowerCase()
      );

      if (similarity > 0.7) {
        await this.updatePredictionStatus(prediction.id, 'used');
        return prediction;
      }
    }

    return null;
  }

  /**
   * Record that a prediction was used (for analytics)
   */
  async recordPredictionHit(
    predictionId: string,
    actualLatencyMs: number
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO precognition_analytics (
        prediction_id, was_hit, actual_latency_ms, created_at
      ) VALUES ($1, true, $2, $3)`,
      [predictionId, actualLatencyMs, new Date().toISOString()] as any[]
    );
  }

  /**
   * Record that no prediction matched (for learning)
   */
  async recordPredictionMiss(
    sessionId: string,
    actualIntent: MorphicIntent,
    actualPrompt: string
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO precognition_analytics (
        session_id, was_hit, actual_intent, actual_prompt, created_at
      ) VALUES ($1, false, $2, $3, $4)`,
      [sessionId, actualIntent, actualPrompt, new Date().toISOString()] as any[]
    );
  }

  /**
   * Get pre-cognition analytics for a session
   */
  async getAnalytics(sessionId: string): Promise<{
    totalPredictions: number;
    hits: number;
    misses: number;
    hitRate: number;
    avgLatencySavedMs: number;
  }> {
    const result = await executeStatement(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN was_hit THEN 1 ELSE 0 END) as hits,
        AVG(CASE WHEN was_hit THEN actual_latency_ms ELSE NULL END) as avg_latency
       FROM precognition_analytics 
       WHERE session_id = $1`,
      [sessionId] as any[]
    );

    const row = result.rows?.[0] as Record<string, unknown> || {};
    const total = Number(row.total) || 0;
    const hits = Number(row.hits) || 0;
    const avgLatency = Number(row.avg_latency) || 0;

    return {
      totalPredictions: total,
      hits,
      misses: total - hits,
      hitRate: total > 0 ? hits / total : 0,
      avgLatencySavedMs: avgLatency,
    };
  }

  /**
   * Generate suggested actions for the current state
   */
  generateSuggestedActions(
    currentLayout: MorphicLayout | null,
    predictions: IntentPrediction[]
  ): PreCognitionAction[] {
    const actions: PreCognitionAction[] = [];

    // Always-available actions based on layout
    if (currentLayout) {
      actions.push({
        id: 'export-pdf',
        label: 'Export to PDF',
        icon: '📄',
        type: 'button',
        handler: 'export.pdf',
        priority: 1,
      });

      if (currentLayout.components.some(c => c.componentType === 'DataGrid')) {
        actions.push({
          id: 'export-csv',
          label: 'Export to CSV',
          icon: '📊',
          type: 'button',
          handler: 'export.csv',
          priority: 2,
        });
      }
    }

    // Add predicted actions
    for (const prediction of predictions.slice(0, 3)) {
      actions.push({
        id: `predicted-${prediction.intent}`,
        label: prediction.prompt,
        icon: this.getIntentIcon(prediction.intent),
        type: 'button',
        handler: `morph.${prediction.intent}`,
        priority: 10 - Math.floor(prediction.confidence * 10),
      });
    }

    return actions.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Cleanup expired predictions
   */
  async cleanupExpired(sessionId?: string): Promise<number> {
    const result = await executeStatement(
      `DELETE FROM precognition_predictions 
       WHERE expires_at < $1 ${sessionId ? 'AND session_id = $2' : ''}
       RETURNING id`,
      sessionId ? [new Date().toISOString(), sessionId] : [new Date().toISOString()] as any[]
    );

    return result.rows?.length || 0;
  }

  // Private helper methods

  private async getConfig(sessionId: string): Promise<PreCognitionConfig> {
    const result = await executeStatement(
      `SELECT config FROM precognition_queues WHERE session_id = $1`, [sessionId] as any[]
    );

    if (!result.rows || result.rows.length === 0) {
      return DEFAULT_CONFIG;
    }

    const row = result.rows[0] as Record<string, unknown>;
    return JSON.parse((row.config as string) || JSON.stringify(DEFAULT_CONFIG));
  }

  private async generateSolution(
    tenantId: string,
    intent: MorphicIntent,
    prompt: string
  ): Promise<PreCognitionSolution> {
    // Use Genesis model (Claude Sonnet) to pre-generate intelligent solutions
    const solution: PreCognitionSolution = {
      type: 'morph',
      suggestedActions: [],
    };

    try {
      const { callLiteLLM } = await import('../litellm.service.js');
      
      const response = await callLiteLLM({
        model: 'claude-sonnet-4-20250514',
        messages: [{
          role: 'user',
          content: `Based on this user intent and prompt, generate a pre-cognition solution.

Intent: ${intent}
Prompt: ${prompt}

Respond with JSON:
{
  "componentType": "string (LineChart|BarChart|DataGrid|KanbanBoard|Calendar|Form|TextEditor)",
  "props": { /* component-specific props */ },
  "suggestedActions": ["action1", "action2"],
  "dataBindings": ["field1", "field2"]
}`
        }],
        temperature: 0.3,
        max_tokens: 1000,
      });

      // Parse LLM response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Build layout from LLM suggestion
        solution.morphLayout = {
          id: uuidv4(),
          type: 'single',
          components: [{
            id: uuidv4(),
            componentId: parsed.componentType?.toLowerCase() || 'data-grid',
            componentType: parsed.componentType || 'DataGrid',
            props: parsed.props || {},
            position: { x: 0, y: 0, w: 12, h: 8 },
            ghostBindings: (parsed.dataBindings || []).map((b: string) => ({
              targetProp: b,
              sourceType: 'ghost',
              sourceId: 'auto',
            })),
          }],
        };
        
        solution.suggestedActions = parsed.suggestedActions || [];
        return solution;
      }
    } catch (error) {
      // Fall through to template-based solutions
    }

    // Fallback: template solutions based on intent
    switch (intent) {
      case 'visualization':
        solution.morphLayout = {
          id: uuidv4(),
          type: 'single',
          components: [{
            id: uuidv4(),
            componentId: 'line-chart',
            componentType: 'LineChart',
            props: { data: [], xKey: 'date', yKey: 'value' },
            position: { x: 0, y: 0, w: 12, h: 8 },
            ghostBindings: [],
          }],
        };
        break;

      case 'tracking':
        solution.morphLayout = {
          id: uuidv4(),
          type: 'single',
          components: [{
            id: uuidv4(),
            componentId: 'kanban-board',
            componentType: 'KanbanBoard',
            props: { columns: ['To Do', 'In Progress', 'Done'], items: [] },
            position: { x: 0, y: 0, w: 12, h: 10 },
            ghostBindings: [],
          }],
        };
        break;

      case 'finance':
        solution.morphLayout = {
          id: uuidv4(),
          type: 'split',
          components: [
            {
              id: uuidv4(),
              componentId: 'data-grid',
              componentType: 'DataGrid',
              props: { columns: ['Category', 'Amount', 'Date'], data: [] },
              position: { x: 0, y: 0, w: 6, h: 10 },
              ghostBindings: [],
            },
            {
              id: uuidv4(),
              componentId: 'pie-chart',
              componentType: 'PieChart',
              props: { data: [], nameKey: 'category', valueKey: 'amount' },
              position: { x: 6, y: 0, w: 6, h: 10 },
              ghostBindings: [],
            },
          ],
        };
        break;

      default:
        solution.preRenderedResponse = `I can help you with ${intent}. Let me set that up for you.`;
    }

    return solution;
  }

  private async storePrediction(prediction: PreCognitionPrediction): Promise<void> {
    await executeStatement(
      `INSERT INTO precognition_predictions (
        id, tenant_id, user_id, session_id, predicted_intent, predicted_prompt,
        confidence, solution, status, compute_time_ms, created_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        prediction.id,
        prediction.tenantId,
        prediction.userId,
        prediction.sessionId,
        prediction.predictedIntent,
        prediction.predictedPrompt,
        prediction.confidence,
        JSON.stringify(prediction.solution),
        prediction.status,
        prediction.computeTimeMs,
        prediction.createdAt.toISOString(),
        prediction.expiresAt.toISOString(),
      ] as any[]
    );

    // Update in-memory queue
    const queue = this.queues.get(prediction.sessionId);
    if (queue) {
      queue.predictions.push(prediction);
      if (queue.predictions.length > queue.maxSize) {
        queue.predictions.shift();
      }
    }
  }

  private async getActivePredictions(
    sessionId: string
  ): Promise<PreCognitionPrediction[]> {
    const result = await executeStatement(
      `SELECT * FROM precognition_predictions 
       WHERE session_id = $1 AND status = 'ready' AND expires_at > $2
       ORDER BY confidence DESC`, [sessionId, new Date().toISOString()] as any[]
    );

    return (result.rows || []).map((row: unknown) => 
      this.mapRowToPrediction(row as Record<string, unknown>)
    );
  }

  private async updatePredictionStatus(
    predictionId: string,
    status: PreCognitionStatus
  ): Promise<void> {
    const updates: Record<string, unknown> = { status };
    if (status === 'used') {
      updates.used_at = new Date().toISOString();
    }

    await executeStatement(
      `UPDATE precognition_predictions SET status = $1, used_at = $2 WHERE id = $3`,
      [status, updates.used_at || null, predictionId] as any[]
    );
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple word overlap similarity
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));
    
    let overlap = 0;
    for (const word of words1) {
      if (words2.has(word)) overlap++;
    }

    const union = new Set([...words1, ...words2]).size;
    return union > 0 ? overlap / union : 0;
  }

  private getIntentIcon(intent: MorphicIntent): string {
    const icons: Record<MorphicIntent, string> = {
      data_analysis: '📊',
      tracking: '📋',
      visualization: '📈',
      planning: '📅',
      calculation: '🧮',
      design: '🎨',
      coding: '💻',
      writing: '✍️',
      finance: '💰',
      communication: '📧',
    };
    return icons[intent] || '✨';
  }

  private mapRowToPrediction(row: Record<string, unknown>): PreCognitionPrediction {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string,
      sessionId: row.session_id as string,
      predictedIntent: row.predicted_intent as MorphicIntent,
      predictedPrompt: row.predicted_prompt as string,
      confidence: row.confidence as number,
      solution: JSON.parse((row.solution as string) || '{}'),
      status: row.status as PreCognitionStatus,
      computeTimeMs: row.compute_time_ms as number,
      createdAt: new Date(row.created_at as string),
      expiresAt: new Date(row.expires_at as string),
      usedAt: row.used_at ? new Date(row.used_at as string) : undefined,
    };
  }
}

export const preCognitionService = new PreCognitionService();
