/**
 * RADIANT v5.44.0 - Council of Experts Service
 * Multi-persona AI consultation with consensus tracking
 */

import { v4 as uuidv4 } from 'uuid';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { executeStatement, stringParam, uuidParam } from '../../db/client';
import type {
  CouncilSession,
  CouncilExpert,
  ExpertArgument,
  ConsensusState,
  MinorityReport,
  CouncilConclusion,
  ConveneCouncilRequest,
  BreathingRate,
} from '@radiant/shared';

const bedrockClient = new BedrockRuntimeClient({});

// Expert persona definitions with distinct perspectives
const EXPERT_PERSONAS: Record<string, {
  specialization: string;
  style: string;
  color: string;
  icon: string;
  modelId: string;
  systemPrompt: string;
}> = {
  pragmatist: {
    specialization: 'Practical Implementation & Feasibility',
    style: 'Results-focused, cost-conscious, timeline-aware',
    color: '#3b82f6',
    icon: 'briefcase',
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    systemPrompt: 'You are a pragmatic advisor focused on practical implementation. Consider costs, timelines, and feasibility. Be direct and results-oriented.',
  },
  ethicist: {
    specialization: 'Ethical Implications & Moral Philosophy',
    style: 'Principle-based, stakeholder-aware, long-term thinking',
    color: '#8b5cf6',
    icon: 'scale',
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    systemPrompt: 'You are an ethics advisor. Consider moral implications, stakeholder impacts, and long-term consequences. Reference ethical frameworks when relevant.',
  },
  innovator: {
    specialization: 'Creative Solutions & Future Possibilities',
    style: 'Visionary, possibility-focused, disruptive thinking',
    color: '#f59e0b',
    icon: 'lightbulb',
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    systemPrompt: 'You are an innovation advisor. Think creatively, challenge assumptions, and propose novel solutions. Consider future possibilities.',
  },
  skeptic: {
    specialization: 'Risk Analysis & Critical Evaluation',
    style: 'Devil\'s advocate, risk-aware, challenging assumptions',
    color: '#ef4444',
    icon: 'shield-alert',
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    systemPrompt: 'You are a critical analyst. Challenge assumptions, identify risks, and play devil\'s advocate. Be constructively skeptical.',
  },
  synthesizer: {
    specialization: 'Integration & Consensus Building',
    style: 'Bridge-building, pattern-finding, holistic view',
    color: '#22c55e',
    icon: 'git-merge',
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    systemPrompt: 'You are a synthesis expert. Find common ground, integrate different perspectives, and build toward consensus. Identify patterns across viewpoints.',
  },
  analyst: {
    specialization: 'Data-Driven Analysis & Evidence',
    style: 'Quantitative, evidence-based, methodical',
    color: '#06b6d4',
    icon: 'bar-chart',
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    systemPrompt: 'You are a data analyst. Focus on evidence, metrics, and quantifiable outcomes. Request data when needed and be methodical in analysis.',
  },
  strategist: {
    specialization: 'Long-term Strategy & Competitive Positioning',
    style: 'Big-picture, competitive-aware, strategic framing',
    color: '#ec4899',
    icon: 'target',
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    systemPrompt: 'You are a strategic advisor. Consider long-term implications, competitive dynamics, and strategic positioning. Think in terms of sustainable advantage.',
  },
  humanist: {
    specialization: 'Human Impact & User Experience',
    style: 'Empathetic, user-centered, accessibility-focused',
    color: '#14b8a6',
    icon: 'heart',
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    systemPrompt: 'You are a human-centered advisor. Focus on user experience, accessibility, and human impact. Consider emotional and psychological factors.',
  },
};

export class CouncilOfExpertsService {
  /**
   * Convene a new Council session
   */
  async conveneCouncil(
    tenantId: string,
    userId: string,
    request: ConveneCouncilRequest
  ): Promise<CouncilSession> {
    const sessionId = uuidv4();

    await executeStatement({
      sql: `
        INSERT INTO council_sessions (id, tenant_id, topic, question, status, created_by)
        VALUES (:id, :tenant_id, :topic, :question, 'convening', :created_by)
      `,
      parameters: [
        uuidParam('id', sessionId),
        uuidParam('tenant_id', tenantId),
        stringParam('topic', request.topic),
        stringParam('question', request.question),
        uuidParam('created_by', userId),
      ],
    });

    // Add experts based on requested personas
    for (const persona of request.expertPersonas) {
      await this.addExpert(sessionId, persona);
    }

    return this.getSession(tenantId, sessionId);
  }

  /**
   * Add an expert to the council
   */
  async addExpert(sessionId: string, persona: string): Promise<CouncilExpert> {
    const expertConfig = EXPERT_PERSONAS[persona];
    if (!expertConfig) {
      throw new Error(`Unknown expert persona: ${persona}`);
    }

    const expertId = uuidv4();

    await executeStatement({
      sql: `
        INSERT INTO council_experts (
          id, session_id, persona, specialization, model_id, 
          avatar, breathing_aura, credibility_score
        ) VALUES (
          :id, :session_id, :persona, :specialization, :model_id,
          :avatar, :breathing_aura, 80
        )
      `,
      parameters: [
        uuidParam('id', expertId),
        uuidParam('session_id', sessionId),
        stringParam('persona', persona),
        stringParam('specialization', expertConfig.specialization),
        stringParam('model_id', expertConfig.modelId),
        stringParam('avatar', JSON.stringify({ color: expertConfig.color, icon: expertConfig.icon })),
        stringParam('breathing_aura', JSON.stringify({ color: expertConfig.color, rate: 6, radius: 30 })),
      ],
    });

    return {
      id: expertId,
      persona,
      specialization: expertConfig.specialization,
      modelId: expertConfig.modelId,
      avatar: { color: expertConfig.color, icon: expertConfig.icon },
      breathingAura: { color: expertConfig.color, rate: 6 as BreathingRate, radius: 30 },
      currentPosition: { stance: '', confidence: 50, keyPoints: [], evidenceStrength: 50, openToPersuasion: 50 },
      argumentHistory: [],
      credibilityScore: 80,
      agreementWith: {},
    };
  }

  /**
   * Get a Council session with all data
   */
  async getSession(tenantId: string, sessionId: string): Promise<CouncilSession> {
    const result = await executeStatement({
      sql: `SELECT * FROM council_sessions WHERE id = :id AND tenant_id = :tenant_id`,
      parameters: [uuidParam('id', sessionId), uuidParam('tenant_id', tenantId)],
    });

    if (!result.rows || result.rows.length === 0) {
      throw new Error('Council session not found');
    }

    const session = result.rows[0] as any;

    // Get experts
    const expertsResult = await executeStatement({
      sql: `SELECT * FROM council_experts WHERE session_id = :session_id`,
      parameters: [uuidParam('session_id', sessionId)],
    });

    // Get arguments
    const argumentsResult = await executeStatement({
      sql: `SELECT * FROM expert_arguments WHERE session_id = :session_id ORDER BY created_at`,
      parameters: [uuidParam('session_id', sessionId)],
    });

    // Get minority reports
    const reportsResult = await executeStatement({
      sql: `SELECT * FROM minority_reports WHERE session_id = :session_id`,
      parameters: [uuidParam('session_id', sessionId)],
    });

    const experts = (expertsResult.rows || []).map((row: any) => this.mapExpert(row, argumentsResult.rows || []));

    return {
      id: session.id,
      tenantId: session.tenant_id,
      topic: session.topic,
      question: session.question,
      experts,
      debate: {
        rounds: this.organizeRounds(argumentsResult.rows || []),
        currentRound: Math.max(...(argumentsResult.rows || []).map((a: any) => a.round_number || 1), 1),
        argumentStreams: [],
        dissentSparks: this.calculateDissentSparks(experts),
      },
      consensusState: session.consensus_state ? JSON.parse(session.consensus_state) : this.calculateConsensus(experts),
      minorityReports: (reportsResult.rows || []).map(this.mapMinorityReport),
      createdAt: session.created_at,
      status: session.status,
      conclusion: session.conclusion ? JSON.parse(session.conclusion) : undefined,
    };
  }

  /**
   * Run a debate round
   */
  async runDebateRound(tenantId: string, sessionId: string): Promise<void> {
    const session = await this.getSession(tenantId, sessionId);

    if (session.status === 'concluded') {
      throw new Error('Session already concluded');
    }

    // Update status to debating
    await executeStatement({
      sql: `UPDATE council_sessions SET status = 'debating' WHERE id = :id`,
      parameters: [uuidParam('id', sessionId)],
    });

    const roundNumber = session.debate.currentRound + 1;

    // Get responses from each expert
    for (const expert of session.experts) {
      const response = await this.getExpertResponse(session, expert, roundNumber);
      
      await executeStatement({
        sql: `
          INSERT INTO expert_arguments (
            id, expert_id, session_id, content, argument_type, 
            living_ink, round_number
          ) VALUES (
            :id, :expert_id, :session_id, :content, :argument_type,
            :living_ink, :round_number
          )
        `,
        parameters: [
          uuidParam('id', uuidv4()),
          uuidParam('expert_id', expert.id),
          uuidParam('session_id', sessionId),
          stringParam('content', response.content),
          stringParam('argument_type', response.type),
          stringParam('living_ink', JSON.stringify({ fontWeight: 350 + (response.conviction * 1.5), conviction: response.conviction })),
          stringParam('round_number', String(roundNumber)),
        ],
      });

      // Update expert position
      await executeStatement({
        sql: `
          UPDATE council_experts 
          SET current_position = :position, credibility_score = :credibility
          WHERE id = :id
        `,
        parameters: [
          stringParam('position', JSON.stringify({
            stance: response.stance,
            confidence: response.conviction,
            keyPoints: response.keyPoints,
            evidenceStrength: response.evidenceStrength,
            openToPersuasion: response.openToPersuasion,
          })),
          stringParam('credibility', String(Math.min(100, expert.credibilityScore + (response.evidenceStrength > 70 ? 2 : 0)))),
          uuidParam('id', expert.id),
        ],
      });
    }

    // Update consensus state
    const updatedSession = await this.getSession(tenantId, sessionId);
    const consensus = this.calculateConsensus(updatedSession.experts);

    await executeStatement({
      sql: `
        UPDATE council_sessions 
        SET consensus_level = :level, consensus_state = :state, status = :status
        WHERE id = :id
      `,
      parameters: [
        stringParam('level', String(consensus.level)),
        stringParam('state', JSON.stringify(consensus)),
        stringParam('status', consensus.level > 75 ? 'converging' : 'debating'),
        uuidParam('id', sessionId),
      ],
    });
  }

  /**
   * Get expert response using AI
   */
  private async getExpertResponse(
    session: CouncilSession,
    expert: CouncilExpert,
    roundNumber: number
  ): Promise<{
    content: string;
    type: 'assertion' | 'rebuttal' | 'concession' | 'question' | 'synthesis';
    stance: string;
    conviction: number;
    keyPoints: string[];
    evidenceStrength: number;
    openToPersuasion: number;
  }> {
    const personaConfig = EXPERT_PERSONAS[expert.persona];
    if (!personaConfig) {
      throw new Error(`Unknown persona: ${expert.persona}`);
    }

    // Build context from previous arguments
    const previousArguments = session.experts
      .flatMap(e => e.argumentHistory)
      .slice(-10) // Last 10 arguments
      .map(a => `[${a.type}] ${a.content}`)
      .join('\n');

    const prompt = `${personaConfig.systemPrompt}

Topic: ${session.topic}
Question: ${session.question}

Round ${roundNumber} of debate.

Previous arguments:
${previousArguments || 'This is the opening round.'}

Your previous stance: ${expert.currentPosition.stance || 'Not yet stated'}

Provide your response for this round. Consider other experts' arguments and whether to:
- Assert a new point
- Rebut another expert's argument
- Concede a valid point
- Ask a probing question
- Synthesize emerging consensus

Respond in JSON:
{
  "content": "Your argument (2-3 sentences)",
  "type": "assertion|rebuttal|concession|question|synthesis",
  "stance": "Your current position summary",
  "conviction": 75,
  "keyPoints": ["point 1", "point 2"],
  "evidenceStrength": 70,
  "openToPersuasion": 40
}`;

    const response = await bedrockClient.send(
      new InvokeModelCommand({
        modelId: expert.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
    );

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const content = responseBody.content[0].text;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        content: content.substring(0, 500),
        type: 'assertion',
        stance: expert.currentPosition.stance || 'Undecided',
        conviction: 50,
        keyPoints: [],
        evidenceStrength: 50,
        openToPersuasion: 50,
      };
    }

    return JSON.parse(jsonMatch[0]);
  }

  /**
   * Conclude the council session
   */
  async concludeSession(tenantId: string, sessionId: string): Promise<CouncilConclusion> {
    const session = await this.getSession(tenantId, sessionId);

    // Generate conclusion from synthesis expert or AI
    const allArguments = session.experts
      .flatMap(e => e.argumentHistory)
      .map(a => a.content)
      .join('\n');

    const prompt = `Synthesize the following expert debate into a conclusion:

Topic: ${session.topic}
Question: ${session.question}

Arguments:
${allArguments}

Provide a structured conclusion in JSON:
{
  "summary": "Main conclusion (2-3 sentences)",
  "confidence": 75,
  "supportingExperts": ["expert ids who support"],
  "dissentingExperts": ["expert ids who dissent"],
  "keyInsights": ["insight 1", "insight 2"],
  "actionItems": ["action 1", "action 2"],
  "uncertainties": ["uncertainty 1"]
}`;

    const response = await bedrockClient.send(
      new InvokeModelCommand({
        modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
    );

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const content = responseBody.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    const conclusion: CouncilConclusion = jsonMatch 
      ? JSON.parse(jsonMatch[0])
      : {
          summary: 'Unable to reach consensus.',
          confidence: 30,
          supportingExperts: [],
          dissentingExperts: session.experts.map(e => e.id),
          keyInsights: [],
          actionItems: [],
          uncertainties: ['Insufficient data for conclusion'],
        };

    // Create minority reports for dissenters
    for (const expertId of conclusion.dissentingExperts) {
      const expert = session.experts.find(e => e.id === expertId);
      if (expert && expert.currentPosition.stance) {
        await executeStatement({
          sql: `
            INSERT INTO minority_reports (id, session_id, expert_id, position, reasoning, validity_score)
            VALUES (:id, :session_id, :expert_id, :position, :reasoning, :validity_score)
          `,
          parameters: [
            uuidParam('id', uuidv4()),
            uuidParam('session_id', sessionId),
            uuidParam('expert_id', expertId),
            stringParam('position', expert.currentPosition.stance),
            stringParam('reasoning', expert.argumentHistory.slice(-1)[0]?.content || 'No specific reasoning provided'),
            stringParam('validity_score', String(expert.currentPosition.evidenceStrength)),
          ],
        });
      }
    }

    // Update session
    await executeStatement({
      sql: `
        UPDATE council_sessions 
        SET status = 'concluded', conclusion = :conclusion, updated_at = NOW()
        WHERE id = :id
      `,
      parameters: [
        stringParam('conclusion', JSON.stringify(conclusion)),
        uuidParam('id', sessionId),
      ],
    });

    return conclusion;
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private calculateConsensus(experts: CouncilExpert[]): ConsensusState {
    if (experts.length === 0) {
      return { level: 0, convergingOn: [], divergentOn: [], gravitationalCenter: { x: 50, y: 50 }, expertPositions: [] };
    }

    // Calculate agreement between experts
    const stances = experts.map(e => e.currentPosition.stance).filter(Boolean);
    const uniqueStances = [...new Set(stances)];
    
    // Simple consensus calculation
    const consensusLevel = uniqueStances.length === 0 
      ? 0 
      : Math.round(100 / uniqueStances.length);

    return {
      level: Math.min(100, consensusLevel),
      convergingOn: uniqueStances.length <= 2 ? uniqueStances : [],
      divergentOn: uniqueStances.length > 2 ? uniqueStances : [],
      gravitationalCenter: { x: 50, y: 50 },
      expertPositions: experts.map((e, i) => ({
        expertId: e.id,
        position: { x: 20 + (i * 15), y: 50 },
        velocity: { x: 0, y: 0 },
      })),
    };
  }

  private calculateDissentSparks(experts: CouncilExpert[]): any[] {
    const sparks = [];
    
    for (let i = 0; i < experts.length; i++) {
      for (let j = i + 1; j < experts.length; j++) {
        const e1 = experts[i];
        const e2 = experts[j];
        
        // Check if positions differ significantly
        if (e1.currentPosition.stance && e2.currentPosition.stance &&
            e1.currentPosition.stance !== e2.currentPosition.stance) {
          sparks.push({
            id: `${e1.id}-${e2.id}`,
            betweenExperts: [e1.id, e2.id],
            topic: 'Position difference',
            intensity: Math.abs(e1.currentPosition.confidence - e2.currentPosition.confidence) / 100,
            visualArc: {
              startPos: { x: 20 + (i * 15), y: 50 },
              endPos: { x: 20 + (j * 15), y: 50 },
              color: '#ef4444',
              sparkFrequency: 2,
            },
          });
        }
      }
    }

    return sparks;
  }

  private organizeRounds(arguments_: any[]): any[] {
    const roundMap = new Map<number, any[]>();
    
    for (const arg of arguments_) {
      const round = arg.round_number || 1;
      if (!roundMap.has(round)) {
        roundMap.set(round, []);
      }
      roundMap.get(round)!.push(arg);
    }

    return Array.from(roundMap.entries()).map(([number, args]) => ({
      id: `round-${number}`,
      number,
      topic: '',
      arguments: args.map(this.mapArgument),
      positionShifts: [],
    }));
  }

  private mapExpert(row: any, allArguments: any[]): CouncilExpert {
    const expertArguments = allArguments
      .filter((a: any) => a.expert_id === row.id)
      .map(this.mapArgument);

    return {
      id: row.id,
      persona: row.persona,
      specialization: row.specialization,
      modelId: row.model_id,
      avatar: row.avatar ? JSON.parse(row.avatar) : { color: '#3b82f6', icon: 'user' },
      breathingAura: row.breathing_aura ? JSON.parse(row.breathing_aura) : { color: '#3b82f6', rate: 6, radius: 30 },
      currentPosition: row.current_position 
        ? JSON.parse(row.current_position) 
        : { stance: '', confidence: 50, keyPoints: [], evidenceStrength: 50, openToPersuasion: 50 },
      argumentHistory: expertArguments,
      credibilityScore: row.credibility_score,
      agreementWith: row.agreement_with ? JSON.parse(row.agreement_with) : {},
    };
  }

  private mapArgument(row: any): ExpertArgument {
    return {
      id: row.id,
      content: row.content,
      timestamp: row.created_at,
      livingInk: row.living_ink ? JSON.parse(row.living_ink) : { fontWeight: 400, conviction: 50 },
      targetedAt: row.targeted_at,
      type: row.argument_type,
    };
  }

  private mapMinorityReport(row: any): MinorityReport {
    return {
      id: row.id,
      expertId: row.expert_id,
      position: row.position,
      reasoning: row.reasoning,
      validityScore: row.validity_score,
      visualPanel: row.visual_panel ? JSON.parse(row.visual_panel) : { opacity: 0.7, position: { x: 0, y: 0 }, ghostStyle: true },
    };
  }
}

export const councilOfExpertsService = new CouncilOfExpertsService();
