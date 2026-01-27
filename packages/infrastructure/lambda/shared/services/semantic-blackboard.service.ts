/**
 * RADIANT Semantic Blackboard Service
 * 
 * Implements the "Semantic Blackboard" architecture for multi-agent orchestration:
 * 1. Question Matching - Vector similarity search for previously answered questions
 * 2. Answer Reuse - Auto-reply to agents with cached answers
 * 3. Question Grouping - Fan-out answers to multiple agents asking similar questions
 * 4. Answer Invalidation - Revoke incorrect answers and notify agents
 * 
 * This prevents the "Thundering Herd" problem where multiple agents spam the user
 * with the same question.
 */

import { Client } from 'pg';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { modelRouterService } from './model-router.service';

// ============================================================================
// Types
// ============================================================================

export interface AskUserParams {
  tenantId: string;
  agentId: string;
  agentType: string;
  sessionId: string;
  question: string;
  context: Record<string, unknown>;
  urgency?: 'low' | 'normal' | 'high' | 'critical';
  topic?: string;
  options?: string[];
  defaultValue?: string;
  timeoutSeconds?: number;
}

export interface AskUserResult {
  source: 'memory' | 'grouped' | 'user' | 'default' | 'timeout';
  answer: string;
  confidence: number;
  decisionId?: string;
  groupId?: string;
  matchedDecisionId?: string;
  waitRequired: boolean;
  estimatedWaitSeconds?: number;
}

export interface ResolvedDecision {
  id: string;
  tenantId: string;
  question: string;
  questionNormalized: string;
  answer: string;
  answerSource: 'user' | 'memory' | 'default' | 'inferred';
  confidence: number;
  isValid: boolean;
  topic?: string;
  timesReused: number;
  createdAt: Date;
  expiresAt?: Date;
}

export interface QuestionGroup {
  id: string;
  tenantId: string;
  canonicalQuestion: string;
  topic?: string;
  status: 'pending' | 'answered' | 'expired' | 'cancelled';
  answer?: string;
  memberCount: number;
  createdAt: Date;
}

export interface BlackboardConfig {
  similarityThreshold: number;
  embeddingModel: string;
  enableQuestionGrouping: boolean;
  groupingWindowSeconds: number;
  maxGroupSize: number;
  enableAnswerReuse: boolean;
  answerTtlSeconds: number;
  maxReuseCount: number;
}

export interface InvalidateAnswerParams {
  tenantId: string;
  decisionId: string;
  reason: string;
  invalidatedBy: string;
  newAnswer?: string;
}

// ============================================================================
// Service
// ============================================================================

class SemanticBlackboardService {
  private db: Client | null = null;
  private redis: Redis | null = null;
  private configCache: Map<string, BlackboardConfig> = new Map();

  /**
   * Initialize database and Redis connections
   */
  async initialize(db: Client, redis?: Redis): Promise<void> {
    this.db = db;
    this.redis = redis || null;
    logger.info('SemanticBlackboardService initialized');
  }

  /**
   * Main entry point: Ask a question on behalf of an agent
   * 
   * Workflow:
   * 1. Generate embedding for the question
   * 2. Search for similar resolved decisions (vector similarity)
   * 3. If match found with high confidence: return cached answer
   * 4. If grouping enabled: check for pending similar questions
   * 5. Otherwise: create new HITL decision
   */
  async askUser(params: AskUserParams): Promise<AskUserResult> {
    const config = await this.getConfig(params.tenantId);
    
    // Normalize question
    const normalizedQuestion = this.normalizeQuestion(params.question);
    
    // Generate embedding
    const embedding = await this.generateEmbedding(params.question);
    
    // Step 1: Check for existing resolved decisions (Semantic Match)
    if (config.enableAnswerReuse) {
      const match = await this.findSimilarDecision(
        params.tenantId,
        embedding,
        config.similarityThreshold
      );
      
      if (match) {
        // Update reuse count
        await this.incrementReuseCount(match.id);
        
        // Log event
        await this.logEvent(params.tenantId, 'answer_reused', {
          agentId: params.agentId,
          decisionId: match.id,
          similarity: match.similarity,
        });
        
        logger.info('Semantic match found, reusing answer', {
          tenantId: params.tenantId,
          agentId: params.agentId,
          matchedDecisionId: match.id,
          similarity: match.similarity,
        });
        
        return {
          source: 'memory',
          answer: match.answer,
          confidence: match.similarity,
          matchedDecisionId: match.id,
          waitRequired: false,
        };
      }
    }
    
    // Step 2: Check for pending question groups (Question Grouping)
    if (config.enableQuestionGrouping) {
      const existingGroup = await this.findPendingQuestionGroup(
        params.tenantId,
        embedding,
        config.similarityThreshold
      );
      
      if (existingGroup) {
        // Add to existing group
        await this.addToQuestionGroup(existingGroup.id, params, embedding);
        
        logger.info('Added to existing question group', {
          tenantId: params.tenantId,
          agentId: params.agentId,
          groupId: existingGroup.id,
        });
        
        return {
          source: 'grouped',
          answer: '', // Will be filled when group is answered
          confidence: 0,
          groupId: existingGroup.id,
          waitRequired: true,
          estimatedWaitSeconds: config.groupingWindowSeconds,
        };
      }
    }
    
    // Step 3: Create new question (either as group or individual)
    if (config.enableQuestionGrouping) {
      // Create new question group and wait for similar questions
      const group = await this.createQuestionGroup(params, embedding);
      
      // Schedule group resolution after window expires
      await this.scheduleGroupResolution(group.id, config.groupingWindowSeconds);
      
      return {
        source: 'grouped',
        answer: '',
        confidence: 0,
        groupId: group.id,
        waitRequired: true,
        estimatedWaitSeconds: config.groupingWindowSeconds,
      };
    } else {
      // Create individual HITL decision
      const decisionId = await this.createHitlDecision(params);
      
      return {
        source: 'user',
        answer: '',
        confidence: 0,
        decisionId,
        waitRequired: true,
        estimatedWaitSeconds: params.timeoutSeconds || 300,
      };
    }
  }

  /**
   * Process an answer from the user
   * - Store as resolved decision
   * - Fan out to all grouped questions
   * - Notify waiting agents
   */
  async processAnswer(
    tenantId: string,
    decisionId: string,
    answer: string,
    answeredBy: string
  ): Promise<{ fanOutCount: number; resolvedDecisionId: string }> {
    if (!this.db) throw new Error('Database not initialized');
    
    // Get the decision/group
    const decision = await this.db.query(
      `SELECT * FROM pending_decisions WHERE id = $1 AND tenant_id = $2`,
      [decisionId, tenantId]
    );
    
    if (decision.rows.length === 0) {
      throw new Error(`Decision not found: ${decisionId}`);
    }
    
    const decisionRow = decision.rows[0];
    
    // Generate embedding for the question
    const embedding = await this.generateEmbedding(decisionRow.question);
    
    // Store as resolved decision
    const resolvedResult = await this.db.query(
      `INSERT INTO resolved_decisions (
        tenant_id, question, question_normalized, question_embedding,
        topic_tag, context, answer, answer_source, confidence,
        original_agent, original_session_id, original_decision_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
      [
        tenantId,
        decisionRow.question,
        this.normalizeQuestion(decisionRow.question),
        `[${embedding.join(',')}]`,
        decisionRow.topic_tag,
        JSON.stringify(decisionRow.context),
        answer,
        'user',
        1.0,
        decisionRow.flyte_node_id, // Using as agent identifier
        decisionRow.session_id,
        decisionId,
      ]
    );
    
    const resolvedDecisionId = resolvedResult.rows[0].id;
    
    // Check if this is part of a question group
    const groupResult = await this.db.query(
      `SELECT qg.* FROM question_groups qg
       JOIN pending_decisions pd ON pd.id = $1
       WHERE qg.decision_id = pd.id OR qg.id = pd.id`,
      [decisionId]
    );
    
    let fanOutCount = 1;
    
    if (groupResult.rows.length > 0) {
      const group = groupResult.rows[0];
      
      // Update group status
      await this.db.query(
        `UPDATE question_groups SET status = 'answered', answer = $1, answered_by = $2, answered_at = NOW()
         WHERE id = $3`,
        [answer, answeredBy, group.id]
      );
      
      // Get all group members
      const members = await this.db.query(
        `SELECT * FROM question_group_members WHERE group_id = $1 AND answer_delivered = FALSE`,
        [group.id]
      );
      
      fanOutCount = members.rows.length;
      
      // Fan out answer to all members
      for (const member of members.rows) {
        await this.deliverAnswerToAgent(
          tenantId,
          member.agent_id,
          answer,
          resolvedDecisionId
        );
        
        await this.db.query(
          `UPDATE question_group_members SET answer_delivered = TRUE, delivered_at = NOW()
           WHERE id = $1`,
          [member.id]
        );
      }
      
      logger.info('Answer fanned out to group members', {
        tenantId,
        groupId: group.id,
        fanOutCount,
      });
    }
    
    // Update original decision
    await this.db.query(
      `UPDATE pending_decisions SET status = 'resolved', resolution = 'approved',
       guidance = $1, resolved_by = $2, resolved_at = NOW()
       WHERE id = $3`,
      [answer, answeredBy, decisionId]
    );
    
    // Log event
    await this.logEvent(tenantId, 'answer_provided', {
      decisionId,
      resolvedDecisionId,
      fanOutCount,
      answeredBy,
    });
    
    return { fanOutCount, resolvedDecisionId };
  }

  /**
   * Invalidate a previously resolved decision
   * - Mark as invalid
   * - Optionally provide new answer
   * - Notify agents that received the old answer
   */
  async invalidateAnswer(params: InvalidateAnswerParams): Promise<{ affectedAgents: string[] }> {
    if (!this.db) throw new Error('Database not initialized');
    
    // Get the decision
    const decision = await this.db.query(
      `SELECT * FROM resolved_decisions WHERE id = $1 AND tenant_id = $2`,
      [params.decisionId, params.tenantId]
    );
    
    if (decision.rows.length === 0) {
      throw new Error(`Decision not found: ${params.decisionId}`);
    }
    
    // Mark as invalid
    await this.db.query(
      `UPDATE resolved_decisions 
       SET is_valid = FALSE, invalidated_at = NOW(), 
           invalidated_by = $1, invalidation_reason = $2
       WHERE id = $3`,
      [params.invalidatedBy, params.reason, params.decisionId]
    );
    
    // If new answer provided, create new resolved decision
    let newDecisionId: string | undefined;
    if (params.newAnswer) {
      const embedding = await this.generateEmbedding(decision.rows[0].question);
      
      const newResult = await this.db.query(
        `INSERT INTO resolved_decisions (
          tenant_id, question, question_normalized, question_embedding,
          topic_tag, context, answer, answer_source, confidence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id`,
        [
          params.tenantId,
          decision.rows[0].question,
          decision.rows[0].question_normalized,
          `[${embedding.join(',')}]`,
          decision.rows[0].topic_tag,
          decision.rows[0].context,
          params.newAnswer,
          'user',
          1.0,
        ]
      );
      
      newDecisionId = newResult.rows[0].id;
      
      // Link old to new
      await this.db.query(
        `UPDATE resolved_decisions SET superseded_by = $1 WHERE id = $2`,
        [newDecisionId, params.decisionId]
      );
    }
    
    // Get agents that received this answer (from blackboard events)
    const eventsResult = await this.db.query(
      `SELECT DISTINCT details->>'agentId' as agent_id
       FROM blackboard_events
       WHERE event_type = 'answer_reused' AND decision_id = $1`,
      [params.decisionId]
    );
    
    const affectedAgents = eventsResult.rows
      .map(r => r.agent_id)
      .filter(Boolean);
    
    // Notify affected agents via Redis pub/sub
    if (this.redis && affectedAgents.length > 0) {
      const correction = {
        type: 'answer_correction',
        oldDecisionId: params.decisionId,
        newDecisionId,
        oldAnswer: decision.rows[0].answer,
        newAnswer: params.newAnswer,
        reason: params.reason,
        timestamp: new Date().toISOString(),
      };
      
      for (const agentId of affectedAgents) {
        await this.redis.publish(`agent:${agentId}:corrections`, JSON.stringify(correction));
      }
    }
    
    // Log event
    await this.logEvent(params.tenantId, 'answer_invalidated', {
      decisionId: params.decisionId,
      newDecisionId,
      reason: params.reason,
      affectedAgents,
    });
    
    logger.info('Answer invalidated', {
      tenantId: params.tenantId,
      decisionId: params.decisionId,
      affectedAgents: affectedAgents.length,
    });
    
    return { affectedAgents };
  }

  /**
   * Get all resolved decisions for a tenant (for Facts tab in UI)
   */
  async getResolvedDecisions(
    tenantId: string,
    options: {
      includeInvalid?: boolean;
      topic?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ decisions: ResolvedDecision[]; total: number }> {
    if (!this.db) throw new Error('Database not initialized');
    
    const { includeInvalid = false, topic, limit = 50, offset = 0 } = options;
    
    let whereClause = 'tenant_id = $1';
    const params: (string | number | boolean)[] = [tenantId];
    let paramIndex = 2;
    
    if (!includeInvalid) {
      whereClause += ' AND is_valid = TRUE';
    }
    
    if (topic) {
      whereClause += ` AND topic_tag = $${paramIndex}`;
      params.push(topic);
      paramIndex++;
    }
    
    const countResult = await this.db.query(
      `SELECT COUNT(*) FROM resolved_decisions WHERE ${whereClause}`,
      params
    );
    
    const result = await this.db.query(
      `SELECT * FROM resolved_decisions 
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );
    
    const decisions: ResolvedDecision[] = result.rows.map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      question: row.question,
      questionNormalized: row.question_normalized,
      answer: row.answer,
      answerSource: row.answer_source,
      confidence: parseFloat(row.confidence),
      isValid: row.is_valid,
      topic: row.topic_tag,
      timesReused: row.times_reused,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));
    
    return {
      decisions,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Get pending question groups
   */
  async getPendingGroups(tenantId: string): Promise<QuestionGroup[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.query(
      `SELECT qg.*, COUNT(qgm.id) as member_count
       FROM question_groups qg
       LEFT JOIN question_group_members qgm ON qg.id = qgm.group_id
       WHERE qg.tenant_id = $1 AND qg.status = 'pending'
       GROUP BY qg.id
       ORDER BY qg.created_at DESC`,
      [tenantId]
    );
    
    return result.rows.map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      canonicalQuestion: row.canonical_question,
      topic: row.topic_tag,
      status: row.status,
      answer: row.answer,
      memberCount: parseInt(row.member_count, 10),
      createdAt: row.created_at,
    }));
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async getConfig(tenantId: string): Promise<BlackboardConfig> {
    // Check cache
    if (this.configCache.has(tenantId)) {
      return this.configCache.get(tenantId)!;
    }
    
    if (!this.db) {
      return this.getDefaultConfig();
    }
    
    const result = await this.db.query(
      `SELECT * FROM blackboard_config WHERE tenant_id = $1 OR tenant_id IS NULL
       ORDER BY tenant_id NULLS LAST LIMIT 1`,
      [tenantId]
    );
    
    const config: BlackboardConfig = result.rows.length > 0
      ? {
          similarityThreshold: parseFloat(result.rows[0].similarity_threshold),
          embeddingModel: result.rows[0].embedding_model,
          enableQuestionGrouping: result.rows[0].enable_question_grouping,
          groupingWindowSeconds: result.rows[0].grouping_window_seconds,
          maxGroupSize: result.rows[0].max_group_size,
          enableAnswerReuse: result.rows[0].enable_answer_reuse,
          answerTtlSeconds: result.rows[0].answer_ttl_seconds,
          maxReuseCount: result.rows[0].max_reuse_count,
        }
      : this.getDefaultConfig();
    
    this.configCache.set(tenantId, config);
    return config;
  }

  private getDefaultConfig(): BlackboardConfig {
    return {
      similarityThreshold: 0.85,
      embeddingModel: 'text-embedding-ada-002',
      enableQuestionGrouping: true,
      groupingWindowSeconds: 60,
      maxGroupSize: 10,
      enableAnswerReuse: true,
      answerTtlSeconds: 3600,
      maxReuseCount: 100,
    };
  }

  private normalizeQuestion(question: string): string {
    return question
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ');
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const result = await modelRouterService.invoke({
        modelId: 'openai/text-embedding-ada-002',
        messages: [{ role: 'user', content: text }],
        maxTokens: 1,
      });
      
      // OpenAI embedding response
      if ((result as any).embedding) {
        return (result as any).embedding;
      }
      
      // Fallback: generate a simple hash-based embedding for development
      return this.generateFallbackEmbedding(text);
    } catch (error) {
      logger.warn('Failed to generate embedding, using fallback', { error });
      return this.generateFallbackEmbedding(text);
    }
  }

  private generateFallbackEmbedding(text: string): number[] {
    // Simple hash-based embedding for development/fallback
    const embedding = new Array(1536).fill(0);
    const normalized = this.normalizeQuestion(text);
    
    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i);
      embedding[i % 1536] += charCode / 1000;
      embedding[(i * 7) % 1536] += Math.sin(charCode);
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map(v => v / (magnitude || 1));
  }

  private async findSimilarDecision(
    tenantId: string,
    embedding: number[],
    threshold: number
  ): Promise<{ id: string; answer: string; similarity: number } | null> {
    if (!this.db) return null;
    
    const result = await this.db.query(
      `SELECT * FROM find_similar_decisions($1, $2, $3, 1)`,
      [tenantId, `[${embedding.join(',')}]`, threshold]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.decision_id,
      answer: row.answer,
      similarity: parseFloat(row.similarity),
    };
  }

  private async findPendingQuestionGroup(
    tenantId: string,
    embedding: number[],
    threshold: number
  ): Promise<{ id: string } | null> {
    if (!this.db) return null;
    
    const result = await this.db.query(
      `SELECT id, (1 - (question_embedding <=> $2)) as similarity
       FROM question_groups
       WHERE tenant_id = $1 AND status = 'pending'
         AND (1 - (question_embedding <=> $2)) >= $3
       ORDER BY similarity DESC
       LIMIT 1`,
      [tenantId, `[${embedding.join(',')}]`, threshold]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return { id: result.rows[0].id };
  }

  private async createQuestionGroup(
    params: AskUserParams,
    embedding: number[]
  ): Promise<{ id: string }> {
    if (!this.db) throw new Error('Database not initialized');
    
    const config = await this.getConfig(params.tenantId);
    
    const result = await this.db.query(
      `INSERT INTO question_groups (
        tenant_id, canonical_question, topic_tag, question_embedding, expires_at
      ) VALUES ($1, $2, $3, $4, NOW() + ($5 || ' seconds')::INTERVAL)
      RETURNING id`,
      [
        params.tenantId,
        params.question,
        params.topic,
        `[${embedding.join(',')}]`,
        config.groupingWindowSeconds,
      ]
    );
    
    const groupId = result.rows[0].id;
    
    // Add the original question as first member
    await this.addToQuestionGroup(groupId, params, embedding);
    
    // Log event
    await this.logEvent(params.tenantId, 'question_grouped', {
      groupId,
      agentId: params.agentId,
      question: params.question,
    });
    
    return { id: groupId };
  }

  private async addToQuestionGroup(
    groupId: string,
    params: AskUserParams,
    embedding: number[]
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    // Get agent registry ID
    const agentResult = await this.db.query(
      `SELECT id FROM agent_registry 
       WHERE tenant_id = $1 AND agent_instance_id = $2`,
      [params.tenantId, params.agentId]
    );
    
    let agentRegistryId: string;
    if (agentResult.rows.length === 0) {
      // Register agent
      const newAgent = await this.db.query(
        `INSERT INTO agent_registry (tenant_id, agent_type, agent_instance_id, session_id)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [params.tenantId, params.agentType, params.agentId, params.sessionId]
      );
      agentRegistryId = newAgent.rows[0].id;
    } else {
      agentRegistryId = agentResult.rows[0].id;
    }
    
    // Calculate similarity to canonical question
    const similarityResult = await this.db.query(
      `SELECT (1 - (question_embedding <=> $1)) as similarity
       FROM question_groups WHERE id = $2`,
      [`[${embedding.join(',')}]`, groupId]
    );
    
    const similarity = similarityResult.rows[0]?.similarity || 1.0;
    
    await this.db.query(
      `INSERT INTO question_group_members (group_id, agent_id, question, context, similarity_score)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [groupId, agentRegistryId, params.question, JSON.stringify(params.context), similarity]
    );
  }

  private async scheduleGroupResolution(groupId: string, delaySeconds: number): Promise<void> {
    if (this.redis) {
      // Use Redis delayed queue for immediate processing
      const executeAt = Date.now() + delaySeconds * 1000;
      await this.redis.zadd('blackboard:group_resolution_queue', executeAt, groupId);
    }
    
    // Also schedule via EventBridge for reliable execution
    await this.scheduleViaEventBridge(groupId, delaySeconds);
  }
  
  /**
   * Schedule group resolution via EventBridge Scheduler for reliable execution
   */
  private async scheduleViaEventBridge(groupId: string, delaySeconds: number): Promise<void> {
    const schedulerArn = process.env.EVENTBRIDGE_SCHEDULER_ARN;
    const targetLambdaArn = process.env.BLACKBOARD_RESOLVER_LAMBDA_ARN;
    
    if (!schedulerArn && !targetLambdaArn) {
      logger.debug('EventBridge scheduler not configured, relying on Redis queue only');
      return;
    }
    
    try {
      const { SchedulerClient, CreateScheduleCommand } = await import('@aws-sdk/client-scheduler');
      const scheduler = new SchedulerClient({ region: process.env.AWS_REGION || 'us-east-1' });
      
      const scheduleTime = new Date(Date.now() + delaySeconds * 1000);
      const scheduleName = `blackboard-resolve-${groupId.replace(/-/g, '')}`.substring(0, 64);
      
      const command = new CreateScheduleCommand({
        Name: scheduleName,
        GroupName: process.env.EVENTBRIDGE_SCHEDULE_GROUP || 'radiant-blackboard',
        ScheduleExpression: `at(${scheduleTime.toISOString().split('.')[0]})`,
        ScheduleExpressionTimezone: 'UTC',
        FlexibleTimeWindow: { Mode: 'OFF' },
        Target: {
          Arn: targetLambdaArn || process.env.BLACKBOARD_RESOLVER_LAMBDA_ARN,
          RoleArn: process.env.EVENTBRIDGE_SCHEDULER_ROLE_ARN,
          Input: JSON.stringify({
            action: 'resolve_group',
            groupId,
            scheduledAt: new Date().toISOString(),
          }),
        },
        ActionAfterCompletion: 'DELETE',
      });
      
      await scheduler.send(command);
      logger.debug('Scheduled group resolution via EventBridge', { groupId, scheduleTime });
      
    } catch (error) {
      // Don't fail the operation if EventBridge scheduling fails - Redis queue is the fallback
      logger.warn('Failed to schedule via EventBridge, using Redis queue only', { 
        groupId, 
        error: error instanceof Error ? error.message : 'Unknown' 
      });
    }
  }

  private async createHitlDecision(params: AskUserParams): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');
    
    const timeoutSeconds = params.timeoutSeconds || 300;
    
    const result = await this.db.query(
      `INSERT INTO pending_decisions (
        tenant_id, session_id, question, context, topic_tag, domain, urgency,
        timeout_seconds, expires_at, flyte_execution_id, flyte_node_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() + ($8 || ' seconds')::INTERVAL, $9, $10)
      RETURNING id`,
      [
        params.tenantId,
        params.sessionId,
        params.question,
        JSON.stringify(params.context),
        params.topic,
        'general',
        params.urgency || 'normal',
        timeoutSeconds,
        `blackboard-${uuidv4()}`,
        params.agentId,
      ]
    );
    
    const decisionId = result.rows[0].id;
    
    // Log event
    await this.logEvent(params.tenantId, 'question_asked', {
      decisionId,
      agentId: params.agentId,
      question: params.question,
    });
    
    // Publish to Redis for real-time notification
    if (this.redis) {
      await this.redis.publish(
        `decision_pending:${params.tenantId}`,
        JSON.stringify({
          decisionId,
          question: params.question,
          urgency: params.urgency,
          topic: params.topic,
          timestamp: new Date().toISOString(),
        })
      );
    }
    
    return decisionId;
  }

  private async incrementReuseCount(decisionId: string): Promise<void> {
    if (!this.db) return;
    
    await this.db.query(
      `UPDATE resolved_decisions SET times_reused = times_reused + 1, last_reused_at = NOW()
       WHERE id = $1`,
      [decisionId]
    );
  }

  private async deliverAnswerToAgent(
    tenantId: string,
    agentRegistryId: string,
    answer: string,
    resolvedDecisionId: string
  ): Promise<void> {
    if (this.redis) {
      await this.redis.publish(
        `agent:${agentRegistryId}:answer`,
        JSON.stringify({
          answer,
          resolvedDecisionId,
          source: 'grouped',
          timestamp: new Date().toISOString(),
        })
      );
    }
    
    // Update agent status
    if (this.db) {
      await this.db.query(
        `UPDATE agent_registry SET status = 'active', blocked_reason = NULL
         WHERE id = $1`,
        [agentRegistryId]
      );
    }
  }

  private async logEvent(
    tenantId: string,
    eventType: string,
    details: Record<string, unknown>
  ): Promise<void> {
    if (!this.db) return;
    
    await this.db.query(
      `INSERT INTO blackboard_events (tenant_id, event_type, details)
       VALUES ($1, $2, $3)`,
      [tenantId, eventType, JSON.stringify(details)]
    );
  }
}

// Export singleton
export const semanticBlackboardService = new SemanticBlackboardService();
