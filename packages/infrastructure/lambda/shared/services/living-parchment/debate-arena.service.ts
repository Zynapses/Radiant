/**
 * RADIANT v5.44.0 - Debate Arena Service
 * Adversarial exploration with attack/defense flows and steel-man overlays
 */

import { v4 as uuidv4 } from 'uuid';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { executeStatement, stringParam, uuidParam } from '../../db/client';
import type {
  DebateArena,
  Debater,
  DebateArgument,
  AttackDefenseFlow,
  WeakPoint,
  SteelManOverlay,
  ResolutionTracker,
  CreateDebateRequest,
  LPLivingInk,
} from '@radiant/shared';

const bedrockClient = new BedrockRuntimeClient({});

export class DebateArenaService {
  /**
   * Create a new debate arena
   */
  async createDebate(
    tenantId: string,
    userId: string,
    request: CreateDebateRequest
  ): Promise<DebateArena> {
    const arenaId = uuidv4();

    await executeStatement({
      sql: `
        INSERT INTO debate_arenas (id, tenant_id, topic, proposition, status, created_by)
        VALUES (:id, :tenant_id, :topic, :proposition, 'setup', :created_by)
      `,
      parameters: [
        uuidParam('id', arenaId),
        uuidParam('tenant_id', tenantId),
        stringParam('topic', request.topic),
        stringParam('proposition', request.proposition),
        uuidParam('created_by', userId),
      ],
    });

    // Add proposition debater
    await this.addDebater(arenaId, {
      name: 'Proposition',
      side: 'proposition',
      modelId: request.propositionModel,
      style: request.style === 'adversarial' ? 'aggressive' : 'balanced',
    });

    // Add opposition debater
    await this.addDebater(arenaId, {
      name: 'Opposition',
      side: 'opposition',
      modelId: request.oppositionModel,
      style: request.style === 'adversarial' ? 'aggressive' : 'balanced',
    });

    return this.getArena(tenantId, arenaId);
  }

  /**
   * Add a debater to the arena
   */
  async addDebater(
    arenaId: string,
    config: { name: string; side: 'proposition' | 'opposition'; modelId: string; style: string }
  ): Promise<Debater> {
    const debaterId = uuidv4();
    const color = config.side === 'proposition' ? '#3b82f6' : '#ef4444';

    await executeStatement({
      sql: `
        INSERT INTO debaters (id, arena_id, name, side, model_id, style, avatar, current_strength)
        VALUES (:id, :arena_id, :name, :side, :model_id, :style, :avatar, 50)
      `,
      parameters: [
        uuidParam('id', debaterId),
        uuidParam('arena_id', arenaId),
        stringParam('name', config.name),
        stringParam('side', config.side),
        stringParam('model_id', config.modelId),
        stringParam('style', config.style),
        stringParam('avatar', JSON.stringify({ color, icon: config.side === 'proposition' ? 'check' : 'x' })),
      ],
    });

    return {
      id: debaterId,
      name: config.name,
      side: config.side,
      modelId: config.modelId,
      style: config.style as any,
      positionHeatmap: { debaterId, segments: [], overallCoverage: 0 },
      currentStrength: 50,
      avatar: { color, icon: config.side === 'proposition' ? 'check' : 'x' },
    };
  }

  /**
   * Get arena with all data
   */
  async getArena(tenantId: string, arenaId: string): Promise<DebateArena> {
    const result = await executeStatement({
      sql: `SELECT * FROM debate_arenas WHERE id = :id AND tenant_id = :tenant_id`,
      parameters: [uuidParam('id', arenaId), uuidParam('tenant_id', tenantId)],
    });

    if (!result.rows || result.rows.length === 0) {
      throw new Error('Debate arena not found');
    }

    const arena = result.rows[0] as any;

    // Get debaters
    const debatersResult = await executeStatement({
      sql: `SELECT * FROM debaters WHERE arena_id = :arena_id`,
      parameters: [uuidParam('arena_id', arenaId)],
    });

    // Get arguments
    const argumentsResult = await executeStatement({
      sql: `SELECT * FROM debate_arguments WHERE arena_id = :arena_id ORDER BY created_at`,
      parameters: [uuidParam('arena_id', arenaId)],
    });

    // Get attack/defense flows
    const flowsResult = await executeStatement({
      sql: `SELECT * FROM attack_defense_flows WHERE arena_id = :arena_id`,
      parameters: [uuidParam('arena_id', arenaId)],
    });

    // Get weak points
    const weakPointsResult = await executeStatement({
      sql: `SELECT * FROM weak_points WHERE arena_id = :arena_id`,
      parameters: [uuidParam('arena_id', arenaId)],
    });

    // Get steel-man overlays
    const steelManResult = await executeStatement({
      sql: `SELECT * FROM steel_man_overlays WHERE arena_id = :arena_id`,
      parameters: [uuidParam('arena_id', arenaId)],
    });

    return {
      id: arena.id,
      tenantId: arena.tenant_id,
      topic: arena.topic,
      proposition: arena.proposition,
      debaters: (debatersResult.rows || []).map(this.mapDebater),
      arguments: (argumentsResult.rows || []).map(this.mapArgument),
      attackDefenseFlows: (flowsResult.rows || []).map(this.mapFlow),
      weakPoints: (weakPointsResult.rows || []).map(this.mapWeakPoint),
      steelManOverlays: (steelManResult.rows || []).map(this.mapSteelMan),
      resolutionTracker: arena.resolution_tracker 
        ? JSON.parse(arena.resolution_tracker) 
        : this.initializeResolutionTracker(),
      status: arena.status,
      createdAt: arena.created_at,
    };
  }

  /**
   * Run a debate round
   */
  async runRound(tenantId: string, arenaId: string): Promise<void> {
    const arena = await this.getArena(tenantId, arenaId);

    // Update status
    const nextStatus = this.getNextStatus(arena.status);
    await executeStatement({
      sql: `UPDATE debate_arenas SET status = :status WHERE id = :id`,
      parameters: [stringParam('status', nextStatus), uuidParam('id', arenaId)],
    });

    // Get arguments from both debaters
    for (const debater of arena.debaters) {
      const argument = await this.generateArgument(arena, debater);
      
      const argId = uuidv4();
      await executeStatement({
        sql: `
          INSERT INTO debate_arguments (
            id, arena_id, debater_id, content, argument_type, strength,
            target_argument_id, living_ink, position
          ) VALUES (
            :id, :arena_id, :debater_id, :content, :argument_type, :strength,
            :target_argument_id, :living_ink, :position
          )
        `,
        parameters: [
          uuidParam('id', argId),
          uuidParam('arena_id', arenaId),
          uuidParam('debater_id', debater.id),
          stringParam('content', argument.content),
          stringParam('argument_type', argument.type),
          stringParam('strength', String(argument.strength)),
          uuidParam('target_argument_id', argument.targetId || null),
          stringParam('living_ink', JSON.stringify({ 
            id: argId, 
            content: argument.content, 
            confidence: argument.strength,
            fontWeight: 350 + (argument.strength * 1.5),
            grayscale: 0,
            position: { start: 0, end: argument.content.length }
          })),
          stringParam('position', JSON.stringify({ x: Math.random() * 80 + 10, y: Math.random() * 80 + 10 })),
        ],
      });

      // Create attack/defense flow if targeting another argument
      if (argument.targetId) {
        await this.createFlow(arenaId, debater.id, argument.targetId, argId);
      }

      // Detect weak points
      await this.detectWeakPoints(arenaId, argId, debater.id, argument);

      // Update debater strength
      await executeStatement({
        sql: `UPDATE debaters SET current_strength = :strength WHERE id = :id`,
        parameters: [
          stringParam('strength', String(Math.min(100, debater.currentStrength + (argument.strength > 70 ? 5 : -2)))),
          uuidParam('id', debater.id),
        ],
      });
    }

    // Update resolution tracker
    const updatedArena = await this.getArena(tenantId, arenaId);
    await this.updateResolutionTracker(arenaId, updatedArena);
  }

  /**
   * Generate argument using AI
   */
  private async generateArgument(
    arena: DebateArena,
    debater: Debater
  ): Promise<{ content: string; type: string; strength: number; targetId?: string }> {
    const opponentArgs = arena.arguments
      .filter(a => {
        const argDebater = arena.debaters.find(d => d.id === a.debaterId);
        return argDebater?.side !== debater.side;
      })
      .slice(-3);

    const styleInstructions: Record<string, string> = {
      aggressive: 'Be forceful and direct. Challenge every weak point.',
      balanced: 'Present measured arguments with evidence.',
      defensive: 'Focus on strengthening your position and deflecting attacks.',
      socratic: 'Use questions to expose flaws in opposing arguments.',
    };

    const prompt = `You are debating ${debater.side === 'proposition' ? 'FOR' : 'AGAINST'} the proposition:
"${arena.proposition}"

Topic: ${arena.topic}
Current phase: ${arena.status}
Style: ${styleInstructions[debater.style] || styleInstructions.balanced}

Recent opponent arguments:
${opponentArgs.map(a => `- ${a.content}`).join('\n') || 'None yet'}

${arena.status === 'opening' ? 'Make your opening statement.' : 
  arena.status === 'rebuttal' ? 'Rebut the opponent\'s key points.' :
  'Present your strongest argument.'}

Respond in JSON:
{
  "content": "Your argument (2-4 sentences, compelling and specific)",
  "type": "claim|evidence|reasoning|rebuttal|concession",
  "strength": 75,
  "targetArgumentIndex": null
}`;

    const response = await bedrockClient.send(
      new InvokeModelCommand({
        modelId: debater.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
    );

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const content = responseBody.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return { content: content.substring(0, 300), type: 'claim', strength: 50 };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      content: parsed.content,
      type: parsed.type || 'claim',
      strength: parsed.strength || 50,
      targetId: parsed.targetArgumentIndex !== null && opponentArgs[parsed.targetArgumentIndex]
        ? opponentArgs[parsed.targetArgumentIndex].id
        : undefined,
    };
  }

  /**
   * Create attack/defense flow
   */
  private async createFlow(
    arenaId: string,
    attackerId: string,
    targetArgId: string,
    attackArgId: string
  ): Promise<void> {
    // Find the defender
    const targetArg = await executeStatement({
      sql: `SELECT debater_id FROM debate_arguments WHERE id = :id`,
      parameters: [uuidParam('id', targetArgId)],
    });

    if (!targetArg.rows || targetArg.rows.length === 0) return;

    const defenderId = targetArg.rows[0].debater_id;

    await executeStatement({
      sql: `
        INSERT INTO attack_defense_flows (
          id, arena_id, attacker_id, defender_id, attack_argument_id, 
          flow_visualization, effectiveness
        ) VALUES (
          :id, :arena_id, :attacker_id, :defender_id, :attack_argument_id,
          :flow_visualization, 50
        )
      `,
      parameters: [
        uuidParam('id', uuidv4()),
        uuidParam('arena_id', arenaId),
        uuidParam('attacker_id', attackerId),
        uuidParam('defender_id', defenderId as string),
        uuidParam('attack_argument_id', attackArgId),
        stringParam('flow_visualization', JSON.stringify({
          startPos: { x: 30, y: 50 },
          endPos: { x: 70, y: 50 },
          arrowStyle: 'attack',
          color: '#ef4444',
          animationSpeed: 1,
        })),
      ],
    });
  }

  /**
   * Detect weak points in argument
   */
  private async detectWeakPoints(
    arenaId: string,
    argId: string,
    debaterId: string,
    argument: { content: string; strength: number }
  ): Promise<void> {
    // Simple heuristic: arguments with low strength or certain patterns have weak points
    if (argument.strength < 60) {
      const weaknesses = [
        'Lacks specific evidence',
        'Relies on assumption',
        'Potential logical gap',
        'Unsubstantiated claim',
      ];

      await executeStatement({
        sql: `
          INSERT INTO weak_points (id, arena_id, argument_id, debater_id, vulnerability, breathing_indicator, position)
          VALUES (:id, :arena_id, :argument_id, :debater_id, :vulnerability, :breathing_indicator, :position)
        `,
        parameters: [
          uuidParam('id', uuidv4()),
          uuidParam('arena_id', arenaId),
          uuidParam('argument_id', argId),
          uuidParam('debater_id', debaterId),
          stringParam('vulnerability', weaknesses[Math.floor(Math.random() * weaknesses.length)]),
          stringParam('breathing_indicator', JSON.stringify({ color: '#ef4444', rate: 12, intensity: 0.7 })),
          stringParam('position', JSON.stringify({ x: Math.random() * 80 + 10, y: Math.random() * 80 + 10 })),
        ],
      });
    }
  }

  /**
   * Generate steel-man overlay for an argument
   */
  async generateSteelMan(tenantId: string, arenaId: string, argumentId: string): Promise<SteelManOverlay> {
    const arena = await this.getArena(tenantId, arenaId);
    const argument = arena.arguments.find(a => a.id === argumentId);

    if (!argument) {
      throw new Error('Argument not found');
    }

    const prompt = `Given this debate argument:
"${argument.content}"

Create the STRONGEST possible version of this argument (steel-man). 
Make it more compelling while keeping the same core position.

Respond in JSON:
{
  "strongerVersion": "The improved argument (2-3 sentences)",
  "improvements": ["improvement 1", "improvement 2", "improvement 3"]
}`;

    const response = await bedrockClient.send(
      new InvokeModelCommand({
        modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
    );

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const content = responseBody.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { strongerVersion: argument.content, improvements: [] };

    const overlayId = uuidv4();
    await executeStatement({
      sql: `
        INSERT INTO steel_man_overlays (id, arena_id, argument_id, stronger_version, improvements, visual_overlay, shown)
        VALUES (:id, :arena_id, :argument_id, :stronger_version, :improvements, :visual_overlay, false)
      `,
      parameters: [
        uuidParam('id', overlayId),
        uuidParam('arena_id', arenaId),
        uuidParam('argument_id', argumentId),
        stringParam('stronger_version', parsed.strongerVersion),
        stringParam('improvements', JSON.stringify(parsed.improvements)),
        stringParam('visual_overlay', JSON.stringify({ opacity: 0.8, ghostPath: {}, enhancementGlow: '#22c55e' })),
      ],
    });

    return {
      argumentId,
      strongerVersion: parsed.strongerVersion,
      improvements: parsed.improvements,
      visualOverlay: { opacity: 0.8, ghostPath: {} as any, enhancementGlow: '#22c55e' },
      shown: false,
    };
  }

  /**
   * Update resolution tracker
   */
  private async updateResolutionTracker(arenaId: string, arena: DebateArena): Promise<void> {
    const propStrength = arena.debaters.find(d => d.side === 'proposition')?.currentStrength || 50;
    const oppStrength = arena.debaters.find(d => d.side === 'opposition')?.currentStrength || 50;
    
    const balance = propStrength - oppStrength; // -100 to 100
    const lastArg = arena.arguments[arena.arguments.length - 1];

    const tracker: ResolutionTracker = {
      currentBalance: balance,
      balanceHistory: [
        ...(arena.resolutionTracker.balanceHistory || []),
        { timestamp: new Date().toISOString(), balance, triggerArgumentId: lastArg?.id || '' },
      ].slice(-20),
      projectedOutcome: balance > 10 ? 'proposition' : balance < -10 ? 'opposition' : 'undecided',
      confidenceInProjection: Math.abs(balance),
      visualMeter: {
        position: (balance + 100) / 2, // 0-100 scale
        momentum: balance - (arena.resolutionTracker.currentBalance || 0),
        color: balance > 0 ? '#3b82f6' : balance < 0 ? '#ef4444' : '#f59e0b',
      },
    };

    await executeStatement({
      sql: `UPDATE debate_arenas SET resolution_tracker = :tracker WHERE id = :id`,
      parameters: [stringParam('tracker', JSON.stringify(tracker)), uuidParam('id', arenaId)],
    });
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private getNextStatus(current: string): string {
    const flow = ['setup', 'opening', 'main', 'main', 'main', 'rebuttal', 'closing', 'resolved'];
    const idx = flow.indexOf(current);
    return flow[Math.min(idx + 1, flow.length - 1)];
  }

  private initializeResolutionTracker(): ResolutionTracker {
    return {
      currentBalance: 0,
      balanceHistory: [],
      projectedOutcome: 'undecided',
      confidenceInProjection: 0,
      visualMeter: { position: 50, momentum: 0, color: '#f59e0b' },
    };
  }

  private mapDebater(row: any): Debater {
    return {
      id: row.id,
      name: row.name,
      side: row.side,
      modelId: row.model_id,
      style: row.style,
      positionHeatmap: row.position_heatmap ? JSON.parse(row.position_heatmap) : { debaterId: row.id, segments: [], overallCoverage: 0 },
      currentStrength: row.current_strength,
      avatar: row.avatar ? JSON.parse(row.avatar) : { color: '#3b82f6', icon: 'user' },
    };
  }

  private mapArgument(row: any): DebateArgument {
    return {
      id: row.id,
      debaterId: row.debater_id,
      content: row.content,
      type: row.argument_type,
      strength: row.strength,
      targetArgumentId: row.target_argument_id,
      supportingArgumentIds: row.supporting_argument_ids || [],
      timestamp: row.created_at,
      livingInk: row.living_ink ? JSON.parse(row.living_ink) : {} as LPLivingInk,
      position: row.position ? JSON.parse(row.position) : { x: 0, y: 0 },
    };
  }

  private mapFlow(row: any): AttackDefenseFlow {
    return {
      id: row.id,
      attackerId: row.attacker_id,
      defenderId: row.defender_id,
      attackArgumentId: row.attack_argument_id,
      defenseArgumentId: row.defense_argument_id,
      flowVisualization: row.flow_visualization ? JSON.parse(row.flow_visualization) : {},
      effectiveness: row.effectiveness,
    };
  }

  private mapWeakPoint(row: any): WeakPoint {
    return {
      id: row.id,
      argumentId: row.argument_id,
      debaterId: row.debater_id,
      vulnerability: row.vulnerability,
      exploitedBy: row.exploited_by,
      breathingIndicator: row.breathing_indicator ? JSON.parse(row.breathing_indicator) : { color: '#ef4444', rate: 12, intensity: 0.7 },
      position: row.position ? JSON.parse(row.position) : { x: 0, y: 0 },
    };
  }

  private mapSteelMan(row: any): SteelManOverlay {
    return {
      argumentId: row.argument_id,
      strongerVersion: row.stronger_version,
      improvements: row.improvements ? JSON.parse(row.improvements) : [],
      visualOverlay: row.visual_overlay ? JSON.parse(row.visual_overlay) : {},
      shown: row.shown,
    };
  }
}

export const debateArenaService = new DebateArenaService();
