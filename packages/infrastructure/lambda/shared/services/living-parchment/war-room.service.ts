/**
 * RADIANT v5.44.0 - War Room Service
 * Strategic Decision Theater with AI advisors and confidence terrain
 */

import { v4 as uuidv4 } from 'uuid';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { executeStatement, stringParam, uuidParam } from '../../db/client';
import type {
  WarRoomSession,
  WarRoomAdvisor,
  WarRoomDecisionPath,
  WarRoomTerrain,
  WarRoomTerrainSegment,
  CreateWarRoomRequest,
  WarRoomActionRequest,
  LPGhostPath,
  ConfidenceScore,
} from '@radiant/shared';

const bedrockClient = new BedrockRuntimeClient({});
const EXTRACTION_MODEL = 'anthropic.claude-3-5-sonnet-20241022-v2:0';

export class WarRoomService {
  /**
   * Create a new War Room session
   */
  async createSession(
    tenantId: string,
    userId: string,
    request: CreateWarRoomRequest
  ): Promise<WarRoomSession> {
    const sessionId = uuidv4();

    // Create initial terrain with default grid
    const terrain = this.generateInitialTerrain();

    const result = await executeStatement({
      sql: `
        INSERT INTO war_room_sessions (
          id, tenant_id, title, description, status, stake_level, 
          deadline, created_by, confidence_terrain
        ) VALUES (
          :id, :tenant_id, :title, :description, 'planning', :stake_level,
          :deadline, :created_by, :terrain
        )
        RETURNING *
      `,
      parameters: [
        uuidParam('id', sessionId),
        uuidParam('tenant_id', tenantId),
        stringParam('title', request.title),
        stringParam('description', request.description),
        stringParam('stake_level', request.stakeLevel),
        stringParam('deadline', request.deadline || null),
        uuidParam('created_by', userId),
        stringParam('terrain', JSON.stringify(terrain)),
      ],
    });

    // Add creator as owner participant
    await this.addParticipant(sessionId, userId, 'Owner', 'owner');

    // Add AI advisors based on config
    if (request.advisorConfig.aiModels) {
      for (const modelId of request.advisorConfig.aiModels) {
        await this.addAdvisor(sessionId, {
          type: 'ai_model',
          name: this.getModelDisplayName(modelId),
          modelId,
          specialization: this.getModelSpecialization(modelId),
        });
      }
    }

    return this.getSession(tenantId, sessionId);
  }

  /**
   * Get a War Room session with all related data
   */
  async getSession(tenantId: string, sessionId: string): Promise<WarRoomSession> {
    const result = await executeStatement({
      sql: `SELECT * FROM war_room_sessions WHERE id = :id AND tenant_id = :tenant_id`,
      parameters: [
        uuidParam('id', sessionId),
        uuidParam('tenant_id', tenantId),
      ],
    });

    if (!result.rows || result.rows.length === 0) {
      throw new Error('War Room session not found');
    }

    const session = result.rows[0];

    // Get participants
    const participantsResult = await executeStatement({
      sql: `SELECT * FROM war_room_participants WHERE session_id = :session_id ORDER BY joined_at`,
      parameters: [uuidParam('session_id', sessionId)],
    });

    // Get advisors
    const advisorsResult = await executeStatement({
      sql: `SELECT * FROM war_room_advisors WHERE session_id = :session_id ORDER BY created_at`,
      parameters: [uuidParam('session_id', sessionId)],
    });

    return {
      id: session.id,
      tenantId: session.tenant_id,
      title: session.title,
      description: session.description,
      status: session.status,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      createdBy: session.created_by,
      participants: (participantsResult.rows || []).map(this.mapParticipant),
      advisors: (advisorsResult.rows || []).map(this.mapAdvisor),
      decision: session.decision ? JSON.parse(session.decision) : undefined,
      decisionPaths: session.decision_paths ? JSON.parse(session.decision_paths) : [],
      confidenceTerrain: session.confidence_terrain ? JSON.parse(session.confidence_terrain) : this.generateInitialTerrain(),
      stakeLevel: session.stake_level,
      deadline: session.deadline,
      metadata: session.metadata ? JSON.parse(session.metadata) : {},
    };
  }

  /**
   * List War Room sessions for a tenant
   */
  async listSessions(
    tenantId: string,
    filters?: { status?: string; stakeLevel?: string }
  ): Promise<WarRoomSession[]> {
    let sql = `SELECT * FROM war_room_sessions WHERE tenant_id = :tenant_id`;
    const params = [uuidParam('tenant_id', tenantId)];

    if (filters?.status) {
      sql += ` AND status = :status`;
      params.push(stringParam('status', filters.status));
    }

    if (filters?.stakeLevel) {
      sql += ` AND stake_level = :stake_level`;
      params.push(stringParam('stake_level', filters.stakeLevel));
    }

    sql += ` ORDER BY updated_at DESC`;

    const result = await executeStatement({ sql, parameters: params });

    const sessions: WarRoomSession[] = [];
    for (const row of result.rows || []) {
      sessions.push(await this.getSession(tenantId, row.id));
    }

    return sessions;
  }

  /**
   * Add a participant to the War Room
   */
  async addParticipant(
    sessionId: string,
    userId: string,
    displayName: string,
    role: 'owner' | 'advisor' | 'observer' | 'stakeholder'
  ): Promise<void> {
    await executeStatement({
      sql: `
        INSERT INTO war_room_participants (session_id, user_id, display_name, role)
        VALUES (:session_id, :user_id, :display_name, :role)
        ON CONFLICT (session_id, user_id) DO UPDATE SET role = :role
      `,
      parameters: [
        uuidParam('session_id', sessionId),
        uuidParam('user_id', userId),
        stringParam('display_name', displayName),
        stringParam('role', role),
      ],
    });
  }

  /**
   * Add an AI advisor to the War Room
   */
  async addAdvisor(
    sessionId: string,
    advisor: {
      type: 'ai_model' | 'human_expert' | 'domain_specialist';
      name: string;
      modelId?: string;
      specialization: string;
    }
  ): Promise<WarRoomAdvisor> {
    const advisorId = uuidv4();
    const breathingAura = this.generateAdvisorAura(advisor.type);

    await executeStatement({
      sql: `
        INSERT INTO war_room_advisors (
          id, session_id, advisor_type, name, model_id, specialization, breathing_aura
        ) VALUES (
          :id, :session_id, :advisor_type, :name, :model_id, :specialization, :breathing_aura
        )
      `,
      parameters: [
        uuidParam('id', advisorId),
        uuidParam('session_id', sessionId),
        stringParam('advisor_type', advisor.type),
        stringParam('name', advisor.name),
        stringParam('model_id', advisor.modelId || null),
        stringParam('specialization', advisor.specialization),
        stringParam('breathing_aura', JSON.stringify(breathingAura)),
      ],
    });

    return {
      id: advisorId,
      type: advisor.type,
      name: advisor.name,
      modelId: advisor.modelId,
      specialization: advisor.specialization,
      confidence: 50,
      breathingAura,
      position: { advocating: '', confidence: 50, reasoning: '', evidenceIds: [], risks: [] },
      agreementMap: {},
    };
  }

  /**
   * Request advisor analysis on the current decision
   */
  async requestAdvisorAnalysis(
    tenantId: string,
    sessionId: string,
    advisorId: string,
    context: string
  ): Promise<{ position: string; confidence: number; reasoning: string; risks: string[] }> {
    const session = await this.getSession(tenantId, sessionId);
    const advisor = session.advisors.find(a => a.id === advisorId);

    if (!advisor || advisor.type !== 'ai_model' || !advisor.modelId) {
      throw new Error('Invalid AI advisor');
    }

    const prompt = `You are ${advisor.name}, a ${advisor.specialization} advisor in a strategic War Room.

Context: ${session.title}
${session.description}

Current situation: ${context}

Analyze this strategic decision and provide:
1. Your position (what you advocate for)
2. Your confidence level (0-100)
3. Your reasoning
4. Key risks to consider

Respond in JSON format:
{
  "position": "your advocated position",
  "confidence": 75,
  "reasoning": "your detailed reasoning",
  "risks": ["risk 1", "risk 2", "risk 3"]
}`;

    const response = await bedrockClient.send(
      new InvokeModelCommand({
        modelId: advisor.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
    );

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const content = responseBody.content[0].text;

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse advisor response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Update advisor position in database
    await executeStatement({
      sql: `
        UPDATE war_room_advisors 
        SET current_position = :position, confidence = :confidence
        WHERE id = :id
      `,
      parameters: [
        stringParam('position', JSON.stringify({
          advocating: analysis.position,
          confidence: analysis.confidence,
          reasoning: analysis.reasoning,
          evidenceIds: [],
          risks: analysis.risks.map((r: string, i: number) => ({
            id: uuidv4(),
            description: r,
            severity: i === 0 ? 'high' : 'medium',
            probability: 0.5,
          })),
        })),
        stringParam('confidence', String(analysis.confidence)),
        uuidParam('id', advisorId),
      ],
    });

    return analysis;
  }

  /**
   * Propose a new decision path
   */
  async proposeDecisionPath(
    tenantId: string,
    sessionId: string,
    path: Omit<WarRoomDecisionPath, 'id' | 'ghostBranches' | 'visualPath' | 'glowIntensity'>
  ): Promise<WarRoomDecisionPath> {
    const session = await this.getSession(tenantId, sessionId);
    
    const newPath: WarRoomDecisionPath = {
      id: uuidv4(),
      label: path.label,
      description: path.description,
      advocatedBy: path.advocatedBy,
      confidence: path.confidence,
      outcomes: path.outcomes,
      ghostBranches: [],
      visualPath: this.generatePathVisual(session.decisionPaths.length),
      glowIntensity: path.confidence / 100,
    };

    const updatedPaths = [...session.decisionPaths, newPath];

    await executeStatement({
      sql: `UPDATE war_room_sessions SET decision_paths = :paths WHERE id = :id`,
      parameters: [
        stringParam('paths', JSON.stringify(updatedPaths)),
        uuidParam('id', sessionId),
      ],
    });

    // Update terrain based on new path
    await this.updateTerrain(tenantId, sessionId);

    return newPath;
  }

  /**
   * Update the confidence terrain based on current state
   */
  async updateTerrain(tenantId: string, sessionId: string): Promise<WarRoomTerrain> {
    const session = await this.getSession(tenantId, sessionId);
    
    const segments: WarRoomTerrainSegment[] = [];
    const gridSize = 10;

    // Generate terrain based on advisor positions and decision paths
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const baseConfidence = this.calculateTerrainConfidence(
          x, y, gridSize, session.advisors, session.decisionPaths
        );
        
        segments.push({
          id: `${x}-${y}`,
          position: { x: x * 10, y: y * 10, z: baseConfidence },
          elevation: baseConfidence,
          color: this.getTerrainColor(baseConfidence),
          hoverData: {
            title: `Zone ${x},${y}`,
            confidence: baseConfidence,
            risks: [],
            supporters: [],
          },
        });
      }
    }

    const terrain: WarRoomTerrain = {
      segments,
      peakConfidence: segments.reduce((max, s) => 
        s.elevation > max.elevation ? s.position : max, 
        { x: 0, y: 0, z: 0 }
      ) as any,
      valleyRisks: segments
        .filter(s => s.elevation < 30)
        .map(s => s.position),
      gradientMap: this.generateGradientMap(segments, gridSize),
    };

    await executeStatement({
      sql: `UPDATE war_room_sessions SET confidence_terrain = :terrain WHERE id = :id`,
      parameters: [
        stringParam('terrain', JSON.stringify(terrain)),
        uuidParam('id', sessionId),
      ],
    });

    return terrain;
  }

  /**
   * Make a final decision
   */
  async makeDecision(
    tenantId: string,
    sessionId: string,
    userId: string,
    pathId: string,
    rationale: string
  ): Promise<void> {
    const session = await this.getSession(tenantId, sessionId);
    const path = session.decisionPaths.find(p => p.id === pathId);

    if (!path) {
      throw new Error('Decision path not found');
    }

    const dissenters = session.advisors
      .filter(a => !path.advocatedBy.includes(a.id))
      .map(a => a.id);

    const decision = {
      id: uuidv4(),
      selectedPathId: pathId,
      rationale,
      confidence: path.confidence,
      decidedAt: new Date().toISOString(),
      decidedBy: userId,
      dissenterIds: dissenters,
    };

    await executeStatement({
      sql: `
        UPDATE war_room_sessions 
        SET decision = :decision, status = 'decided', updated_at = NOW()
        WHERE id = :id
      `,
      parameters: [
        stringParam('decision', JSON.stringify(decision)),
        uuidParam('id', sessionId),
      ],
    });
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private generateInitialTerrain(): WarRoomTerrain {
    const segments: WarRoomTerrainSegment[] = [];
    const gridSize = 10;

    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        segments.push({
          id: `${x}-${y}`,
          position: { x: x * 10, y: y * 10, z: 50 },
          elevation: 50,
          color: '#f59e0b',
          hoverData: {
            title: `Zone ${x},${y}`,
            confidence: 50,
            risks: [],
            supporters: [],
          },
        });
      }
    }

    return {
      segments,
      peakConfidence: { x: 50, y: 50, z: 50 },
      valleyRisks: [],
      gradientMap: Array(gridSize).fill(null).map(() => Array(gridSize).fill(50)),
    };
  }

  private calculateTerrainConfidence(
    x: number,
    y: number,
    gridSize: number,
    advisors: WarRoomAdvisor[],
    paths: WarRoomDecisionPath[]
  ): number {
    let totalConfidence = 50;
    let contributors = 1;

    // Add advisor confidence influence
    for (const advisor of advisors) {
      totalConfidence += advisor.confidence;
      contributors++;
    }

    // Add path confidence influence
    for (const path of paths) {
      totalConfidence += path.confidence;
      contributors++;
    }

    return Math.round(totalConfidence / contributors);
  }

  private getTerrainColor(confidence: number): string {
    if (confidence >= 80) return '#22c55e'; // green
    if (confidence >= 60) return '#84cc16'; // lime
    if (confidence >= 40) return '#f59e0b'; // amber
    if (confidence >= 20) return '#f97316'; // orange
    return '#ef4444'; // red
  }

  private generateGradientMap(segments: WarRoomTerrainSegment[], gridSize: number): number[][] {
    const map: number[][] = [];
    for (let x = 0; x < gridSize; x++) {
      map[x] = [];
      for (let y = 0; y < gridSize; y++) {
        const segment = segments.find(s => s.id === `${x}-${y}`);
        map[x][y] = segment?.elevation || 50;
      }
    }
    return map;
  }

  private generatePathVisual(pathIndex: number): { x: number; y: number }[] {
    const startX = 10;
    const startY = 50;
    const endX = 90;
    const endY = 50 + (pathIndex - 1) * 20;

    return [
      { x: startX, y: startY },
      { x: startX + 20, y: startY },
      { x: startX + 40, y: (startY + endY) / 2 },
      { x: startX + 60, y: endY },
      { x: endX, y: endY },
    ];
  }

  private generateAdvisorAura(type: string): { color: string; rate: number; intensity: number } {
    const colors: Record<string, string> = {
      ai_model: '#3b82f6',
      human_expert: '#8b5cf6',
      domain_specialist: '#06b6d4',
    };

    return {
      color: colors[type] || '#6366f1',
      rate: 6,
      intensity: 0.5,
    };
  }

  private getModelDisplayName(modelId: string): string {
    const names: Record<string, string> = {
      'anthropic.claude-3-5-sonnet-20241022-v2:0': 'Claude Sonnet',
      'anthropic.claude-3-opus-20240229-v1:0': 'Claude Opus',
      'amazon.titan-text-express-v1': 'Titan Express',
    };
    return names[modelId] || modelId.split('.')[1]?.split('-')[0] || 'AI Advisor';
  }

  private getModelSpecialization(modelId: string): string {
    if (modelId.includes('opus')) return 'Strategic Analysis & Complex Reasoning';
    if (modelId.includes('sonnet')) return 'Balanced Analysis & Synthesis';
    if (modelId.includes('titan')) return 'Data Analysis & Pattern Recognition';
    return 'General Advisory';
  }

  private mapParticipant(row: any) {
    return {
      userId: row.user_id,
      displayName: row.display_name,
      role: row.role,
      joinedAt: row.joined_at,
      currentFocus: row.current_focus ? JSON.parse(row.current_focus) : undefined,
      lastActiveAt: row.last_active_at,
    };
  }

  private mapAdvisor(row: any): WarRoomAdvisor {
    return {
      id: row.id,
      type: row.advisor_type,
      name: row.name,
      modelId: row.model_id,
      specialization: row.specialization,
      confidence: row.confidence,
      breathingAura: row.breathing_aura ? JSON.parse(row.breathing_aura) : { color: '#3b82f6', rate: 6, intensity: 0.5 },
      position: row.current_position ? JSON.parse(row.current_position) : { advocating: '', confidence: 50, reasoning: '', evidenceIds: [], risks: [] },
      agreementMap: row.agreement_map ? JSON.parse(row.agreement_map) : {},
    };
  }
}

export const warRoomService = new WarRoomService();
