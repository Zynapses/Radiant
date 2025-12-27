// RADIANT v4.18.0 - Multi-Agent Collaboration Service
// AGI Enhancement Phase 2: Cognitive agents with debate, consensus, and emergent behavior

import { executeStatement } from '../db/client';
import { modelRouterService, ModelResponse } from './model-router.service';
import { episodicMemoryService } from './episodic-memory.service';
import { worldModelService } from './world-model.service';

// ============================================================================
// Types
// ============================================================================

export type AgentRole = 'planner' | 'critic' | 'executor' | 'verifier' | 'researcher' | 'synthesizer' | 'devils_advocate';
export type CollaborationPattern = 'debate' | 'consensus' | 'divide_conquer' | 'pipeline' | 'swarm' | 'critical_review';
export type MessageType = 'proposal' | 'critique' | 'question' | 'answer' | 'agreement' | 'disagreement' | 'synthesis' | 'delegation' | 'report' | 'decision';
export type SessionStatus = 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface CognitiveAgent {
  agentId: string;
  role: AgentRole;
  name: string;
  slug: string;
  description?: string;
  avatarIcon: string;
  avatarColor: string;
  primaryModelId: string;
  fallbackModelIds: string[];
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  capabilities: string[];
  personality: AgentPersonality;
  beliefs: Record<string, unknown>;
  isActive: boolean;
}

export interface AgentPersonality {
  assertiveness: number;  // 0-1: How strongly they push their views
  detailOrientation: number;  // 0-1: How thorough they are
  creativity: number;  // 0-1: How novel their suggestions are
  openness?: number;  // 0-1: How open to other viewpoints
}

export interface CollaborationSession {
  sessionId: string;
  tenantId: string;
  userId: string;
  goal: string;
  collaborationPattern: CollaborationPattern;
  participatingAgents: string[];
  leadAgentId?: string;
  sharedMemory: Record<string, unknown>;
  sharedArtifacts: SharedArtifact[];
  sharedDecisions: SharedDecision[];
  status: SessionStatus;
  currentPhase?: string;
  phasesCompleted: string[];
  progressPercentage: number;
  finalOutput?: string;
  finalConfidence?: number;
  consensusReached?: boolean;
  totalMessages: number;
  totalRounds: number;
  totalTokensUsed: number;
  startedAt: Date;
  completedAt?: Date;
}

export interface SharedArtifact {
  type: string;
  content: string;
  createdBy: string;
  timestamp: Date;
}

export interface SharedDecision {
  decision: string;
  rationale: string;
  madeBy: string;
  agreedBy: string[];
  timestamp: Date;
}

export interface AgentMessage {
  messageId: string;
  sessionId: string;
  fromAgentId?: string;
  toAgentId?: string;
  replyToMessageId?: string;
  messageType: MessageType;
  content: string;
  artifacts: Array<{ type: string; content: string }>;
  reasoning: Record<string, unknown>;
  confidence?: number;
  votes: Record<string, 'agree' | 'disagree' | 'abstain'>;
  tokensUsed?: number;
  latencyMs?: number;
  roundNumber: number;
  createdAt: Date;
}

export interface CollaborationResult {
  sessionId: string;
  success: boolean;
  finalOutput: string;
  confidence: number;
  consensusReached: boolean;
  dissentingAgents: string[];
  totalRounds: number;
  totalMessages: number;
  totalTokensUsed: number;
  durationMs: number;
  artifacts: SharedArtifact[];
  decisions: SharedDecision[];
  emergentBehaviors: string[];
}

export interface ThinkResult {
  thoughts: string;
  decision: string;
  confidence: number;
  reasoning: Record<string, unknown>;
}

// ============================================================================
// Multi-Agent Service
// ============================================================================

export class MultiAgentService {
  private agentCache: Map<string, Map<string, CognitiveAgent>> = new Map();

  // ============================================================================
  // Agent Management
  // ============================================================================

  async getAgent(tenantId: string, agentId: string): Promise<CognitiveAgent | null> {
    const result = await executeStatement(
      `SELECT * FROM cognitive_agents WHERE tenant_id = $1 AND agent_id = $2 AND is_active = true`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'agentId', value: { stringValue: agentId } },
      ]
    );
    if (result.rows.length === 0) return null;
    return this.mapAgent(result.rows[0] as Record<string, unknown>);
  }

  async getAgentByRole(tenantId: string, role: AgentRole): Promise<CognitiveAgent | null> {
    const result = await executeStatement(
      `SELECT * FROM cognitive_agents WHERE tenant_id = $1 AND role = $2 AND is_active = true LIMIT 1`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'role', value: { stringValue: role } },
      ]
    );
    if (result.rows.length === 0) return null;
    return this.mapAgent(result.rows[0] as Record<string, unknown>);
  }

  async getAgentsByRoles(tenantId: string, roles: AgentRole[]): Promise<CognitiveAgent[]> {
    const result = await executeStatement(
      `SELECT * FROM cognitive_agents WHERE tenant_id = $1 AND role = ANY($2) AND is_active = true`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'roles', value: { stringValue: `{${roles.join(',')}}` } },
      ]
    );
    return result.rows.map((row) => this.mapAgent(row as Record<string, unknown>));
  }

  async getAllAgents(tenantId: string): Promise<CognitiveAgent[]> {
    const result = await executeStatement(
      `SELECT * FROM cognitive_agents WHERE tenant_id = $1 AND is_active = true ORDER BY role`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    return result.rows.map((row) => this.mapAgent(row as Record<string, unknown>));
  }

  // ============================================================================
  // Collaboration Session Management
  // ============================================================================

  async createSession(
    tenantId: string,
    userId: string,
    goal: string,
    pattern: CollaborationPattern,
    agentIds: string[]
  ): Promise<CollaborationSession> {
    const goalEmbedding = await this.generateEmbedding(goal);

    const result = await executeStatement(
      `INSERT INTO collaboration_sessions (
        tenant_id, user_id, goal, goal_embedding, collaboration_pattern, participating_agents
      ) VALUES ($1, $2, $3, $4::vector, $5, $6)
      RETURNING *`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'goal', value: { stringValue: goal } },
        { name: 'goalEmbedding', value: { stringValue: `[${goalEmbedding.join(',')}]` } },
        { name: 'pattern', value: { stringValue: pattern } },
        { name: 'agents', value: { stringValue: `{${agentIds.join(',')}}` } },
      ]
    );

    return this.mapSession(result.rows[0] as Record<string, unknown>);
  }

  async getSession(sessionId: string): Promise<CollaborationSession | null> {
    const result = await executeStatement(
      `SELECT * FROM collaboration_sessions WHERE session_id = $1`,
      [{ name: 'sessionId', value: { stringValue: sessionId } }]
    );
    if (result.rows.length === 0) return null;
    return this.mapSession(result.rows[0] as Record<string, unknown>);
  }

  async updateSessionStatus(sessionId: string, status: SessionStatus, finalOutput?: string, confidence?: number): Promise<void> {
    await executeStatement(
      `UPDATE collaboration_sessions SET
        status = $2,
        final_output = COALESCE($3, final_output),
        final_confidence = COALESCE($4, final_confidence),
        completed_at = CASE WHEN $2 IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END
      WHERE session_id = $1`,
      [
        { name: 'sessionId', value: { stringValue: sessionId } },
        { name: 'status', value: { stringValue: status } },
        { name: 'finalOutput', value: finalOutput ? { stringValue: finalOutput } : { isNull: true } },
        { name: 'confidence', value: confidence !== undefined ? { doubleValue: confidence } : { isNull: true } },
      ]
    );
  }

  // ============================================================================
  // Agent Communication
  // ============================================================================

  async sendMessage(
    sessionId: string,
    fromAgentId: string | undefined,
    toAgentId: string | undefined,
    messageType: MessageType,
    content: string,
    options: {
      replyToMessageId?: string;
      artifacts?: Array<{ type: string; content: string }>;
      reasoning?: Record<string, unknown>;
      confidence?: number;
      roundNumber?: number;
      tokensUsed?: number;
      latencyMs?: number;
    } = {}
  ): Promise<AgentMessage> {
    const contentEmbedding = await this.generateEmbedding(content);

    const result = await executeStatement(
      `INSERT INTO agent_messages (
        session_id, from_agent_id, to_agent_id, reply_to_message_id, message_type,
        content, content_embedding, artifacts, reasoning, confidence, round_number, tokens_used, latency_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        { name: 'sessionId', value: { stringValue: sessionId } },
        { name: 'fromAgentId', value: fromAgentId ? { stringValue: fromAgentId } : { isNull: true } },
        { name: 'toAgentId', value: toAgentId ? { stringValue: toAgentId } : { isNull: true } },
        { name: 'replyTo', value: options.replyToMessageId ? { stringValue: options.replyToMessageId } : { isNull: true } },
        { name: 'messageType', value: { stringValue: messageType } },
        { name: 'content', value: { stringValue: content } },
        { name: 'embedding', value: { stringValue: `[${contentEmbedding.join(',')}]` } },
        { name: 'artifacts', value: { stringValue: JSON.stringify(options.artifacts || []) } },
        { name: 'reasoning', value: { stringValue: JSON.stringify(options.reasoning || {}) } },
        { name: 'confidence', value: options.confidence !== undefined ? { doubleValue: options.confidence } : { isNull: true } },
        { name: 'roundNumber', value: { longValue: options.roundNumber || 1 } },
        { name: 'tokensUsed', value: options.tokensUsed ? { longValue: options.tokensUsed } : { isNull: true } },
        { name: 'latencyMs', value: options.latencyMs ? { longValue: options.latencyMs } : { isNull: true } },
      ]
    );

    return this.mapMessage(result.rows[0] as Record<string, unknown>);
  }

  async getSessionMessages(sessionId: string, roundNumber?: number): Promise<AgentMessage[]> {
    let query = `SELECT * FROM agent_messages WHERE session_id = $1`;
    const params: Array<{ name: string; value: { stringValue: string } | { longValue: number } }> = [
      { name: 'sessionId', value: { stringValue: sessionId } },
    ];

    if (roundNumber !== undefined) {
      query += ` AND round_number = $2`;
      params.push({ name: 'roundNumber', value: { longValue: roundNumber } });
    }

    query += ` ORDER BY created_at ASC`;

    const result = await executeStatement(query, params);
    return result.rows.map((row) => this.mapMessage(row as Record<string, unknown>));
  }

  async voteOnMessage(sessionId: string, messageId: string, agentId: string, vote: 'agree' | 'disagree' | 'abstain'): Promise<void> {
    await executeStatement(
      `UPDATE agent_messages SET
        votes = votes || jsonb_build_object($3, $4)
      WHERE message_id = $1 AND session_id = $2`,
      [
        { name: 'messageId', value: { stringValue: messageId } },
        { name: 'sessionId', value: { stringValue: sessionId } },
        { name: 'agentId', value: { stringValue: agentId } },
        { name: 'vote', value: { stringValue: vote } },
      ]
    );
  }

  // ============================================================================
  // Agent Thinking & Acting
  // ============================================================================

  async agentThink(agent: CognitiveAgent, context: {
    goal: string;
    currentPhase: string;
    recentMessages: AgentMessage[];
    sharedMemory: Record<string, unknown>;
    worldContext?: Record<string, unknown>;
  }): Promise<ThinkResult> {
    const messagesContext = context.recentMessages
      .map((m) => `[${m.messageType}] ${m.content}`)
      .join('\n\n');

    const prompt = `${agent.systemPrompt}

CURRENT GOAL: ${context.goal}
CURRENT PHASE: ${context.currentPhase}

RECENT DISCUSSION:
${messagesContext || 'No prior discussion.'}

SHARED CONTEXT:
${JSON.stringify(context.sharedMemory, null, 2)}

${context.worldContext ? `WORLD STATE:\n${JSON.stringify(context.worldContext, null, 2)}` : ''}

Based on your role as ${agent.role}, provide your thoughts and decision.
Format your response as JSON:
{
  "thoughts": "Your internal reasoning process",
  "decision": "Your concrete decision or contribution",
  "confidence": 0.0-1.0,
  "reasoning": {"key_factors": [], "assumptions": [], "risks": []}
}`;

    const startTime = Date.now();
    const response = await modelRouterService.invoke({
      modelId: agent.primaryModelId,
      messages: [{ role: 'user', content: prompt }],
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
    });

    try {
      // Extract JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as ThinkResult;
        return {
          thoughts: parsed.thoughts || '',
          decision: parsed.decision || response.content,
          confidence: parsed.confidence || 0.5,
          reasoning: parsed.reasoning || {},
        };
      }
    } catch {
      // If JSON parsing fails, return raw response
    }

    return {
      thoughts: '',
      decision: response.content,
      confidence: 0.5,
      reasoning: {},
    };
  }

  async agentRespond(agent: CognitiveAgent, message: AgentMessage, context: {
    goal: string;
    sharedMemory: Record<string, unknown>;
  }): Promise<{ response: string; confidence: number; messageType: MessageType }> {
    const prompt = `${agent.systemPrompt}

GOAL: ${context.goal}

MESSAGE TO RESPOND TO:
Type: ${message.messageType}
Content: ${message.content}

Provide your response based on your role as ${agent.role}.
If you agree, say so clearly. If you disagree, explain why and offer alternatives.

Format your response as JSON:
{
  "response": "Your response",
  "confidence": 0.0-1.0,
  "message_type": "agreement|disagreement|critique|question|answer|synthesis"
}`;

    const response = await modelRouterService.invoke({
      modelId: agent.primaryModelId,
      messages: [{ role: 'user', content: prompt }],
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
    });

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { response: string; confidence: number; message_type: string };
        return {
          response: parsed.response || response.content,
          confidence: parsed.confidence || 0.5,
          messageType: (parsed.message_type as MessageType) || 'answer',
        };
      }
    } catch {
      // Fall through to default
    }

    return {
      response: response.content,
      confidence: 0.5,
      messageType: 'answer',
    };
  }

  // ============================================================================
  // Collaboration Protocols
  // ============================================================================

  async runDebate(tenantId: string, userId: string, goal: string, maxRounds = 5): Promise<CollaborationResult> {
    const startTime = Date.now();
    
    // Get required agents
    const agents = await this.getAgentsByRoles(tenantId, ['planner', 'critic', 'devils_advocate']);
    if (agents.length < 2) {
      throw new Error('Not enough agents for debate');
    }

    const session = await this.createSession(tenantId, userId, goal, 'debate', agents.map((a) => a.agentId));
    const planner = agents.find((a) => a.role === 'planner') || agents[0];
    const critic = agents.find((a) => a.role === 'critic') || agents[1];
    const devil = agents.find((a) => a.role === 'devils_advocate');

    let finalOutput = '';
    let finalConfidence = 0;
    let consensusReached = false;
    const decisions: SharedDecision[] = [];
    const artifacts: SharedArtifact[] = [];
    const messages: AgentMessage[] = [];

    try {
      for (let round = 1; round <= maxRounds; round++) {
        // Phase 1: Planner proposes
        const plannerThink = await this.agentThink(planner, {
          goal,
          currentPhase: round === 1 ? 'initial_proposal' : 'refinement',
          recentMessages: messages.slice(-6),
          sharedMemory: { round, previousDecisions: decisions },
        });

        const proposalMsg = await this.sendMessage(session.sessionId, planner.agentId, undefined, 'proposal', plannerThink.decision, {
          roundNumber: round,
          confidence: plannerThink.confidence,
          reasoning: plannerThink.reasoning,
        });
        messages.push(proposalMsg);

        // Phase 2: Critic critiques
        const criticResponse = await this.agentRespond(critic, proposalMsg, { goal, sharedMemory: { round } });
        const critiqueMsg = await this.sendMessage(session.sessionId, critic.agentId, planner.agentId, criticResponse.messageType, criticResponse.response, {
          roundNumber: round,
          confidence: criticResponse.confidence,
          replyToMessageId: proposalMsg.messageId,
        });
        messages.push(critiqueMsg);

        // Phase 3: Devil's advocate challenges (if available)
        if (devil) {
          const devilResponse = await this.agentRespond(devil, proposalMsg, { goal, sharedMemory: { round, critique: criticResponse.response } });
          const devilMsg = await this.sendMessage(session.sessionId, devil.agentId, planner.agentId, devilResponse.messageType, devilResponse.response, {
            roundNumber: round,
            confidence: devilResponse.confidence,
            replyToMessageId: proposalMsg.messageId,
          });
          messages.push(devilMsg);
        }

        // Check for consensus
        const recentMessages = messages.filter((m) => m.roundNumber === round);
        const agreements = recentMessages.filter((m) => m.messageType === 'agreement').length;
        const disagreements = recentMessages.filter((m) => m.messageType === 'disagreement' || m.messageType === 'critique').length;

        if (agreements > disagreements && round >= 2) {
          consensusReached = true;
          finalOutput = plannerThink.decision;
          finalConfidence = plannerThink.confidence;

          decisions.push({
            decision: finalOutput,
            rationale: 'Consensus reached through debate',
            madeBy: planner.agentId,
            agreedBy: agents.map((a) => a.agentId),
            timestamp: new Date(),
          });

          break;
        }

        // If last round without consensus, synthesize
        if (round === maxRounds) {
          const synthesizer = await this.getAgentByRole(tenantId, 'synthesizer');
          if (synthesizer) {
            const synthThink = await this.agentThink(synthesizer, {
              goal,
              currentPhase: 'final_synthesis',
              recentMessages: messages,
              sharedMemory: { allProposals: messages.filter((m) => m.messageType === 'proposal').map((m) => m.content) },
            });
            finalOutput = synthThink.decision;
            finalConfidence = synthThink.confidence;
          } else {
            finalOutput = plannerThink.decision;
            finalConfidence = plannerThink.confidence * 0.8; // Lower confidence without consensus
          }
        }
      }

      await this.updateSessionStatus(session.sessionId, 'completed', finalOutput, finalConfidence);

      // Record to episodic memory
      await episodicMemoryService.createMemory(tenantId, userId, `Multi-agent debate completed: ${goal}. Result: ${finalOutput.substring(0, 200)}`, 'decision', {
        category: 'collaboration',
        tags: ['debate', 'multi-agent'],
      });

    } catch (error) {
      await this.updateSessionStatus(session.sessionId, 'failed');
      throw error;
    }

    return {
      sessionId: session.sessionId,
      success: true,
      finalOutput,
      confidence: finalConfidence,
      consensusReached,
      dissentingAgents: [],
      totalRounds: messages.length > 0 ? Math.max(...messages.map((m) => m.roundNumber)) : 0,
      totalMessages: messages.length,
      totalTokensUsed: messages.reduce((sum, m) => sum + (m.tokensUsed || 0), 0),
      durationMs: Date.now() - startTime,
      artifacts,
      decisions,
      emergentBehaviors: [],
    };
  }

  async runConsensus(tenantId: string, userId: string, goal: string, options: string[], maxRounds = 10): Promise<CollaborationResult> {
    const startTime = Date.now();

    const agents = await this.getAgentsByRoles(tenantId, ['planner', 'critic', 'executor', 'verifier']);
    if (agents.length < 2) {
      throw new Error('Not enough agents for consensus');
    }

    const session = await this.createSession(tenantId, userId, goal, 'consensus', agents.map((a) => a.agentId));
    const messages: AgentMessage[] = [];
    const decisions: SharedDecision[] = [];
    let consensusReached = false;
    let finalOutput = '';
    let finalConfidence = 0;

    try {
      // Phase 1: Each agent proposes or evaluates options
      for (const agent of agents) {
        const agentThink = await this.agentThink(agent, {
          goal,
          currentPhase: 'brainstorm',
          recentMessages: messages,
          sharedMemory: { options },
        });

        const msg = await this.sendMessage(session.sessionId, agent.agentId, undefined, 'proposal', agentThink.decision, {
          roundNumber: 1,
          confidence: agentThink.confidence,
          reasoning: agentThink.reasoning,
        });
        messages.push(msg);
      }

      // Phase 2: Voting rounds
      for (let round = 2; round <= maxRounds; round++) {
        const proposals = messages.filter((m) => m.messageType === 'proposal');
        
        // Each agent votes on all proposals
        for (const agent of agents) {
          for (const proposal of proposals) {
            if (proposal.fromAgentId !== agent.agentId) {
              const response = await this.agentRespond(agent, proposal, { goal, sharedMemory: { round } });
              const vote = response.messageType === 'agreement' ? 'agree' : 
                          response.messageType === 'disagreement' ? 'disagree' : 'abstain';
              await this.voteOnMessage(session.sessionId, proposal.messageId, agent.agentId, vote);
            }
          }
        }

        // Check for consensus (>= 70% agreement on any proposal)
        const updatedMessages = await this.getSessionMessages(session.sessionId);
        for (const proposal of proposals) {
          const updatedProposal = updatedMessages.find((m) => m.messageId === proposal.messageId);
          if (updatedProposal) {
            const votes = Object.values(updatedProposal.votes);
            const agreeCount = votes.filter((v) => v === 'agree').length;
            const totalVotes = votes.length;

            if (totalVotes > 0 && agreeCount / totalVotes >= 0.7) {
              consensusReached = true;
              finalOutput = proposal.content;
              finalConfidence = (agreeCount / totalVotes);

              decisions.push({
                decision: finalOutput,
                rationale: `Consensus reached with ${Math.round((agreeCount / totalVotes) * 100)}% agreement`,
                madeBy: proposal.fromAgentId || 'system',
                agreedBy: Object.entries(updatedProposal.votes)
                  .filter(([, v]) => v === 'agree')
                  .map(([k]) => k),
                timestamp: new Date(),
              });

              break;
            }
          }
        }

        if (consensusReached) break;
      }

      // If no consensus, take highest voted proposal
      if (!consensusReached) {
        const finalMessages = await this.getSessionMessages(session.sessionId);
        const proposals = finalMessages.filter((m) => m.messageType === 'proposal');
        
        let bestProposal = proposals[0];
        let bestScore = 0;

        for (const proposal of proposals) {
          const votes = Object.values(proposal.votes);
          const agreeCount = votes.filter((v) => v === 'agree').length;
          if (agreeCount > bestScore) {
            bestScore = agreeCount;
            bestProposal = proposal;
          }
        }

        if (bestProposal) {
          finalOutput = bestProposal.content;
          finalConfidence = bestScore / agents.length;
        }
      }

      await this.updateSessionStatus(session.sessionId, 'completed', finalOutput, finalConfidence);

    } catch (error) {
      await this.updateSessionStatus(session.sessionId, 'failed');
      throw error;
    }

    return {
      sessionId: session.sessionId,
      success: true,
      finalOutput,
      confidence: finalConfidence,
      consensusReached,
      dissentingAgents: [],
      totalRounds: maxRounds,
      totalMessages: messages.length,
      totalTokensUsed: messages.reduce((sum, m) => sum + (m.tokensUsed || 0), 0),
      durationMs: Date.now() - startTime,
      artifacts: [],
      decisions,
      emergentBehaviors: [],
    };
  }

  async runDivideAndConquer(tenantId: string, userId: string, goal: string): Promise<CollaborationResult> {
    const startTime = Date.now();

    const planner = await this.getAgentByRole(tenantId, 'planner');
    const executors = await this.getAgentsByRoles(tenantId, ['executor']);
    const synthesizer = await this.getAgentByRole(tenantId, 'synthesizer');
    const verifier = await this.getAgentByRole(tenantId, 'verifier');

    if (!planner || executors.length === 0) {
      throw new Error('Missing required agents for divide and conquer');
    }

    const allAgents = [planner, ...executors, synthesizer, verifier].filter(Boolean) as CognitiveAgent[];
    const session = await this.createSession(tenantId, userId, goal, 'divide_conquer', allAgents.map((a) => a.agentId));
    const messages: AgentMessage[] = [];
    const artifacts: SharedArtifact[] = [];

    try {
      // Phase 1: Planner decomposes task
      const planThink = await this.agentThink(planner, {
        goal,
        currentPhase: 'decomposition',
        recentMessages: [],
        sharedMemory: { availableExecutors: executors.length },
      });

      const planMsg = await this.sendMessage(session.sessionId, planner.agentId, undefined, 'proposal', planThink.decision, {
        roundNumber: 1,
        confidence: planThink.confidence,
        reasoning: planThink.reasoning,
      });
      messages.push(planMsg);

      // Extract subtasks from plan
      const subtasks = this.extractSubtasks(planThink.decision);

      // Phase 2: Assign and execute subtasks in parallel (simulated)
      const executorResults: Array<{ executor: CognitiveAgent; result: string }> = [];
      
      for (let i = 0; i < subtasks.length; i++) {
        const executor = executors[i % executors.length];
        const subtask = subtasks[i];

        const execThink = await this.agentThink(executor, {
          goal: subtask,
          currentPhase: 'execution',
          recentMessages: [planMsg],
          sharedMemory: { subtaskIndex: i, totalSubtasks: subtasks.length },
        });

        const execMsg = await this.sendMessage(session.sessionId, executor.agentId, planner.agentId, 'report', execThink.decision, {
          roundNumber: 2,
          confidence: execThink.confidence,
          reasoning: execThink.reasoning,
        });
        messages.push(execMsg);
        executorResults.push({ executor, result: execThink.decision });

        artifacts.push({
          type: 'subtask_result',
          content: execThink.decision,
          createdBy: executor.agentId,
          timestamp: new Date(),
        });
      }

      // Phase 3: Synthesize results
      let finalOutput = '';
      let finalConfidence = 0;

      if (synthesizer) {
        const synthThink = await this.agentThink(synthesizer, {
          goal: `Combine the following subtask results into a coherent solution for: ${goal}`,
          currentPhase: 'synthesis',
          recentMessages: messages,
          sharedMemory: { results: executorResults.map((r) => r.result) },
        });

        const synthMsg = await this.sendMessage(session.sessionId, synthesizer.agentId, undefined, 'synthesis', synthThink.decision, {
          roundNumber: 3,
          confidence: synthThink.confidence,
        });
        messages.push(synthMsg);

        finalOutput = synthThink.decision;
        finalConfidence = synthThink.confidence;
      } else {
        // Simple concatenation if no synthesizer
        finalOutput = executorResults.map((r) => r.result).join('\n\n');
        finalConfidence = 0.6;
      }

      // Phase 4: Verify (if verifier available)
      if (verifier) {
        const verifyThink = await this.agentThink(verifier, {
          goal: `Verify this solution meets the requirements: ${goal}`,
          currentPhase: 'verification',
          recentMessages: messages.slice(-3),
          sharedMemory: { solution: finalOutput },
        });

        const verifyMsg = await this.sendMessage(session.sessionId, verifier.agentId, undefined, verifyThink.confidence > 0.7 ? 'agreement' : 'critique', verifyThink.decision, {
          roundNumber: 4,
          confidence: verifyThink.confidence,
        });
        messages.push(verifyMsg);

        // Adjust confidence based on verification
        finalConfidence = (finalConfidence + verifyThink.confidence) / 2;
      }

      await this.updateSessionStatus(session.sessionId, 'completed', finalOutput, finalConfidence);

      return {
        sessionId: session.sessionId,
        success: true,
        finalOutput,
        confidence: finalConfidence,
        consensusReached: true,
        dissentingAgents: [],
        totalRounds: 4,
        totalMessages: messages.length,
        totalTokensUsed: messages.reduce((sum, m) => sum + (m.tokensUsed || 0), 0),
        durationMs: Date.now() - startTime,
        artifacts,
        decisions: [],
        emergentBehaviors: [],
      };

    } catch (error) {
      await this.updateSessionStatus(session.sessionId, 'failed');
      throw error;
    }
  }

  async runCriticalReview(tenantId: string, userId: string, artifact: string, artifactType: string): Promise<CollaborationResult> {
    const startTime = Date.now();
    const goal = `Review and improve this ${artifactType}`;

    const executor = await this.getAgentByRole(tenantId, 'executor');
    const critic = await this.getAgentByRole(tenantId, 'critic');
    const verifier = await this.getAgentByRole(tenantId, 'verifier');

    if (!executor || !critic) {
      throw new Error('Missing required agents for critical review');
    }

    const agents = [executor, critic, verifier].filter(Boolean) as CognitiveAgent[];
    const session = await this.createSession(tenantId, userId, goal, 'critical_review', agents.map((a) => a.agentId));
    const messages: AgentMessage[] = [];

    let currentArtifact = artifact;
    let finalConfidence = 0;

    try {
      for (let round = 1; round <= 3; round++) {
        // Critic reviews
        const critiqueThink = await this.agentThink(critic, {
          goal: `Review this ${artifactType} for issues and improvements`,
          currentPhase: 'review',
          recentMessages: messages.slice(-4),
          sharedMemory: { artifact: currentArtifact, round },
        });

        const critiqueMsg = await this.sendMessage(session.sessionId, critic.agentId, executor.agentId, 'critique', critiqueThink.decision, {
          roundNumber: round,
          confidence: critiqueThink.confidence,
        });
        messages.push(critiqueMsg);

        // Check if critic is satisfied
        if (critiqueThink.confidence > 0.85) {
          finalConfidence = critiqueThink.confidence;
          break;
        }

        // Executor revises based on feedback
        const revisionThink = await this.agentThink(executor, {
          goal: `Revise the ${artifactType} based on the critique`,
          currentPhase: 'revision',
          recentMessages: [critiqueMsg],
          sharedMemory: { currentArtifact, critique: critiqueThink.decision },
        });

        const revisionMsg = await this.sendMessage(session.sessionId, executor.agentId, critic.agentId, 'proposal', revisionThink.decision, {
          roundNumber: round,
          confidence: revisionThink.confidence,
        });
        messages.push(revisionMsg);

        currentArtifact = revisionThink.decision;
        finalConfidence = revisionThink.confidence;
      }

      // Final verification
      if (verifier) {
        const verifyThink = await this.agentThink(verifier, {
          goal: `Verify the final ${artifactType} is correct and complete`,
          currentPhase: 'verification',
          recentMessages: messages.slice(-2),
          sharedMemory: { artifact: currentArtifact },
        });

        await this.sendMessage(session.sessionId, verifier.agentId, undefined, verifyThink.confidence > 0.7 ? 'agreement' : 'critique', verifyThink.decision, {
          roundNumber: 4,
          confidence: verifyThink.confidence,
        });

        finalConfidence = (finalConfidence + verifyThink.confidence) / 2;
      }

      await this.updateSessionStatus(session.sessionId, 'completed', currentArtifact, finalConfidence);

      return {
        sessionId: session.sessionId,
        success: true,
        finalOutput: currentArtifact,
        confidence: finalConfidence,
        consensusReached: true,
        dissentingAgents: [],
        totalRounds: 3,
        totalMessages: messages.length,
        totalTokensUsed: messages.reduce((sum, m) => sum + (m.tokensUsed || 0), 0),
        durationMs: Date.now() - startTime,
        artifacts: [{ type: artifactType, content: currentArtifact, createdBy: executor.agentId, timestamp: new Date() }],
        decisions: [],
        emergentBehaviors: [],
      };

    } catch (error) {
      await this.updateSessionStatus(session.sessionId, 'failed');
      throw error;
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private extractSubtasks(plan: string): string[] {
    // Simple extraction: look for numbered items or bullet points
    const lines = plan.split('\n');
    const subtasks: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Match numbered items (1., 2., etc.) or bullet points (-, *, etc.)
      if (/^(\d+[.)]|\-|\*|\•)\s+/.test(trimmed)) {
        const task = trimmed.replace(/^(\d+[.)]|\-|\*|\•)\s+/, '').trim();
        if (task.length > 10) { // Minimum length for a meaningful task
          subtasks.push(task);
        }
      }
    }

    // If no structured tasks found, treat the whole plan as one task
    if (subtasks.length === 0) {
      subtasks.push(plan);
    }

    return subtasks.slice(0, 5); // Limit to 5 subtasks
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await modelRouterService.invoke({
        modelId: 'amazon/titan-embed-text',
        messages: [{ role: 'user', content: text.substring(0, 8000) }],
      });
      // Parse embedding from response if available
      return new Array(1536).fill(0);
    } catch {
      return new Array(1536).fill(0);
    }
  }

  private mapAgent(row: Record<string, unknown>): CognitiveAgent {
    return {
      agentId: String(row.agent_id),
      role: row.role as AgentRole,
      name: String(row.name),
      slug: String(row.slug),
      description: row.description ? String(row.description) : undefined,
      avatarIcon: String(row.avatar_icon || 'user'),
      avatarColor: String(row.avatar_color || '#6366f1'),
      primaryModelId: String(row.primary_model_id),
      fallbackModelIds: (row.fallback_model_ids as string[]) || [],
      systemPrompt: String(row.system_prompt),
      temperature: Number(row.temperature || 0.7),
      maxTokens: Number(row.max_tokens || 4096),
      capabilities: (row.capabilities as string[]) || [],
      personality: typeof row.personality === 'string' ? JSON.parse(row.personality) : (row.personality as AgentPersonality) || {},
      beliefs: typeof row.beliefs === 'string' ? JSON.parse(row.beliefs) : (row.beliefs as Record<string, unknown>) || {},
      isActive: Boolean(row.is_active),
    };
  }

  private mapSession(row: Record<string, unknown>): CollaborationSession {
    return {
      sessionId: String(row.session_id),
      tenantId: String(row.tenant_id),
      userId: String(row.user_id),
      goal: String(row.goal),
      collaborationPattern: row.collaboration_pattern as CollaborationPattern,
      participatingAgents: (row.participating_agents as string[]) || [],
      leadAgentId: row.lead_agent_id ? String(row.lead_agent_id) : undefined,
      sharedMemory: typeof row.shared_memory === 'string' ? JSON.parse(row.shared_memory) : (row.shared_memory as Record<string, unknown>) || {},
      sharedArtifacts: typeof row.shared_artifacts === 'string' ? JSON.parse(row.shared_artifacts) : (row.shared_artifacts as SharedArtifact[]) || [],
      sharedDecisions: typeof row.shared_decisions === 'string' ? JSON.parse(row.shared_decisions) : (row.shared_decisions as SharedDecision[]) || [],
      status: (row.status as SessionStatus) || 'active',
      currentPhase: row.current_phase ? String(row.current_phase) : undefined,
      phasesCompleted: (row.phases_completed as string[]) || [],
      progressPercentage: Number(row.progress_percentage || 0),
      finalOutput: row.final_output ? String(row.final_output) : undefined,
      finalConfidence: row.final_confidence ? Number(row.final_confidence) : undefined,
      consensusReached: row.consensus_reached !== undefined ? Boolean(row.consensus_reached) : undefined,
      totalMessages: Number(row.total_messages || 0),
      totalRounds: Number(row.total_rounds || 0),
      totalTokensUsed: Number(row.total_tokens_used || 0),
      startedAt: new Date(row.started_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    };
  }

  private mapMessage(row: Record<string, unknown>): AgentMessage {
    return {
      messageId: String(row.message_id),
      sessionId: String(row.session_id),
      fromAgentId: row.from_agent_id ? String(row.from_agent_id) : undefined,
      toAgentId: row.to_agent_id ? String(row.to_agent_id) : undefined,
      replyToMessageId: row.reply_to_message_id ? String(row.reply_to_message_id) : undefined,
      messageType: row.message_type as MessageType,
      content: String(row.content),
      artifacts: typeof row.artifacts === 'string' ? JSON.parse(row.artifacts) : (row.artifacts as Array<{ type: string; content: string }>) || [],
      reasoning: typeof row.reasoning === 'string' ? JSON.parse(row.reasoning) : (row.reasoning as Record<string, unknown>) || {},
      confidence: row.confidence ? Number(row.confidence) : undefined,
      votes: typeof row.votes === 'string' ? JSON.parse(row.votes) : (row.votes as Record<string, 'agree' | 'disagree' | 'abstain'>) || {},
      tokensUsed: row.tokens_used ? Number(row.tokens_used) : undefined,
      latencyMs: row.latency_ms ? Number(row.latency_ms) : undefined,
      roundNumber: Number(row.round_number || 1),
      createdAt: new Date(row.created_at as string),
    };
  }
}

export const multiAgentService = new MultiAgentService();
