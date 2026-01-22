// RADIANT v4.18.0 - Council of Rivals Service
// Adversarial Consensus System (Multi-Model Debate)
// Novel UI: "Debate Arena" - amphitheater with model avatars

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface Council {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  members: CouncilMember[];
  moderator: Moderator;
  rules: DebateRules;
  status: CouncilStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type CouncilStatus = 'idle' | 'deliberating' | 'voting' | 'concluded';

export interface CouncilMember {
  id: string;
  name: string;
  model: string;
  role: MemberRole;
  avatar: string;
  color: string;
  personality: string;
}

export type MemberRole = 'advocate' | 'critic' | 'synthesizer' | 'specialist' | 'contrarian';

export interface Moderator {
  model: string;
  style: ModeratorStyle;
  maxRounds: number;
  consensusThreshold: number;
  timeoutMs: number;
}

export type ModeratorStyle = 'strict' | 'facilitator' | 'socratic' | 'democratic';

export interface DebateRules {
  minArguments: number;
  maxArguments: number;
  requireEvidence: boolean;
  allowRebuttals: boolean;
  votingMethod: VotingMethod;
  tieBreaker: TieBreaker;
}

export type VotingMethod = 'majority' | 'unanimous' | 'weighted' | 'ranked';
export type TieBreaker = 'moderator' | 'synthesize' | 'random' | 'defer';

export interface Debate {
  id: string;
  councilId: string;
  tenantId: string;
  topic: string;
  context: string;
  rounds: DebateRound[];
  currentRound: number;
  status: DebateStatus;
  verdict?: Verdict;
  startedAt: string;
  completedAt?: string;
  metadata: Record<string, unknown>;
}

export type DebateStatus = 'setup' | 'active' | 'voting' | 'concluded' | 'deadlocked';

export interface DebateRound {
  number: number;
  phase: RoundPhase;
  arguments: Argument[];
  rebuttals: Rebuttal[];
}

export type RoundPhase = 'opening' | 'arguments' | 'rebuttals' | 'closing';

export interface Argument {
  id: string;
  memberId: string;
  position: string;
  reasoning: string;
  evidence?: string[];
  confidence: number;
  timestamp: string;
}

export interface Rebuttal {
  id: string;
  memberId: string;
  targetArgumentId: string;
  counterpoint: string;
  strength: number;
  timestamp: string;
}

export interface Verdict {
  outcome: VerdictOutcome;
  summary: string;
  winningPosition?: string;
  confidence: number;
  votes: Vote[];
  synthesizedAnswer?: string;
}

export type VerdictOutcome = 'consensus' | 'majority' | 'split' | 'deadlock' | 'synthesized';

export interface Vote {
  memberId: string;
  position: string;
  weight: number;
}

export type PresetCouncilType = 'balanced' | 'technical' | 'creative';

// ============================================================================
// Council of Rivals Service
// ============================================================================

class CouncilOfRivalsService {
  // --------------------------------------------------------------------------
  // Council CRUD
  // --------------------------------------------------------------------------

  async createCouncil(
    tenantId: string,
    council: Omit<Council, 'id' | 'tenantId' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<Council> {
    try {
      const id = `council_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await executeStatement(
        `INSERT INTO council_of_rivals (id, tenant_id, name, description, members, moderator, rules, status, created_by, created_at, updated_at)
          VALUES (:id, :tenantId, :name, :description, :members, :moderator, :rules, 'idle', :createdBy, NOW(), NOW())`,
        [
          stringParam('id', id),
          stringParam('tenantId', tenantId),
          stringParam('name', council.name),
          stringParam('description', council.description || ''),
          stringParam('members', JSON.stringify(council.members)),
          stringParam('moderator', JSON.stringify(council.moderator)),
          stringParam('rules', JSON.stringify(council.rules)),
          stringParam('createdBy', council.createdBy),
        ]
      );

      logger.info('Created council', { tenantId, id, name: council.name });

      return {
        id,
        tenantId,
        ...council,
        status: 'idle',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to create council', { tenantId, error });
      throw error;
    }
  }

  async getCouncil(tenantId: string, councilId: string): Promise<Council | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM council_of_rivals WHERE tenant_id = :tenantId AND id = :councilId`,
        [stringParam('tenantId', tenantId), stringParam('councilId', councilId)]
      );

      if (result.rows && result.rows.length > 0) {
        return this.parseCouncil(result.rows[0] as Record<string, unknown>);
      }
      return null;
    } catch (error) {
      logger.error('Failed to get council', { tenantId, councilId, error });
      throw error;
    }
  }

  async listCouncils(tenantId: string): Promise<Council[]> {
    try {
      const result = await executeStatement(
        `SELECT * FROM council_of_rivals WHERE tenant_id = :tenantId ORDER BY updated_at DESC`,
        [stringParam('tenantId', tenantId)]
      );

      return (result.rows || []).map(row => this.parseCouncil(row as Record<string, unknown>));
    } catch (error) {
      logger.error('Failed to list councils', { tenantId, error });
      throw error;
    }
  }

  async updateCouncil(tenantId: string, councilId: string, updates: Partial<Council>): Promise<Council | null> {
    try {
      const existing = await this.getCouncil(tenantId, councilId);
      if (!existing) return null;

      const merged = { ...existing, ...updates };

      await executeStatement(
        `UPDATE council_of_rivals SET name = :name, description = :description, members = :members, moderator = :moderator, rules = :rules, updated_at = NOW()
          WHERE tenant_id = :tenantId AND id = :councilId`,
        [
          stringParam('name', merged.name),
          stringParam('description', merged.description),
          stringParam('members', JSON.stringify(merged.members)),
          stringParam('moderator', JSON.stringify(merged.moderator)),
          stringParam('rules', JSON.stringify(merged.rules)),
          stringParam('tenantId', tenantId),
          stringParam('councilId', councilId),
        ]
      );

      return { ...merged, updatedAt: new Date().toISOString() };
    } catch (error) {
      logger.error('Failed to update council', { tenantId, councilId, error });
      throw error;
    }
  }

  async deleteCouncil(tenantId: string, councilId: string): Promise<boolean> {
    try {
      const result = await executeStatement(
        `DELETE FROM council_of_rivals WHERE tenant_id = :tenantId AND id = :councilId`,
        [stringParam('tenantId', tenantId), stringParam('councilId', councilId)]
      );
      return (result.rowCount || 0) > 0;
    } catch (error) {
      logger.error('Failed to delete council', { tenantId, councilId, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Debate Management
  // --------------------------------------------------------------------------

  async startDebate(tenantId: string, councilId: string, topic: string, context: string): Promise<Debate> {
    try {
      const debateId = `debate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await executeStatement(
        `INSERT INTO council_debates (id, council_id, tenant_id, topic, context, rounds, current_round, status, started_at, metadata)
          VALUES (:id, :councilId, :tenantId, :topic, :context, '[]', 0, 'active', NOW(), '{}')`,
        [
          stringParam('id', debateId),
          stringParam('councilId', councilId),
          stringParam('tenantId', tenantId),
          stringParam('topic', topic),
          stringParam('context', context),
        ]
      );

      // Update council status
      await executeStatement(
        `UPDATE council_of_rivals SET status = 'deliberating', updated_at = NOW() WHERE id = :councilId`,
        [stringParam('councilId', councilId)]
      );

      return {
        id: debateId,
        councilId,
        tenantId,
        topic,
        context,
        rounds: [],
        currentRound: 0,
        status: 'active',
        startedAt: new Date().toISOString(),
        metadata: {},
      };
    } catch (error) {
      logger.error('Failed to start debate', { tenantId, councilId, error });
      throw error;
    }
  }

  async getDebate(tenantId: string, debateId: string): Promise<Debate | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM council_debates WHERE tenant_id = :tenantId AND id = :debateId`,
        [stringParam('tenantId', tenantId), stringParam('debateId', debateId)]
      );

      if (result.rows && result.rows.length > 0) {
        return this.parseDebate(result.rows[0] as Record<string, unknown>);
      }
      return null;
    } catch (error) {
      logger.error('Failed to get debate', { tenantId, debateId, error });
      throw error;
    }
  }

  async submitArgument(
    tenantId: string,
    debateId: string,
    memberId: string,
    argument: { position: string; reasoning: string; evidence?: string[]; confidence: number }
  ): Promise<Debate> {
    try {
      const debate = await this.getDebate(tenantId, debateId);
      if (!debate) throw new Error('Debate not found');

      const newArgument: Argument = {
        id: `arg_${Date.now()}`,
        memberId,
        ...argument,
        timestamp: new Date().toISOString(),
      };

      // Ensure current round exists
      if (debate.rounds.length <= debate.currentRound) {
        debate.rounds.push({ number: debate.currentRound, phase: 'arguments', arguments: [], rebuttals: [] });
      }

      debate.rounds[debate.currentRound].arguments.push(newArgument);

      await executeStatement(
        `UPDATE council_debates SET rounds = :rounds, updated_at = NOW() WHERE id = :debateId`,
        [stringParam('rounds', JSON.stringify(debate.rounds)), stringParam('debateId', debateId)]
      );

      return debate;
    } catch (error) {
      logger.error('Failed to submit argument', { tenantId, debateId, error });
      throw error;
    }
  }

  async submitRebuttal(
    tenantId: string,
    debateId: string,
    memberId: string,
    rebuttal: { targetArgumentId: string; counterpoint: string; strength: number }
  ): Promise<Debate> {
    try {
      const debate = await this.getDebate(tenantId, debateId);
      if (!debate) throw new Error('Debate not found');

      const newRebuttal: Rebuttal = {
        id: `reb_${Date.now()}`,
        memberId,
        ...rebuttal,
        timestamp: new Date().toISOString(),
      };

      if (debate.rounds.length > debate.currentRound) {
        debate.rounds[debate.currentRound].rebuttals.push(newRebuttal);
        debate.rounds[debate.currentRound].phase = 'rebuttals';
      }

      await executeStatement(
        `UPDATE council_debates SET rounds = :rounds, updated_at = NOW() WHERE id = :debateId`,
        [stringParam('rounds', JSON.stringify(debate.rounds)), stringParam('debateId', debateId)]
      );

      return debate;
    } catch (error) {
      logger.error('Failed to submit rebuttal', { tenantId, debateId, error });
      throw error;
    }
  }

  async conductVoting(tenantId: string, debateId: string): Promise<Verdict> {
    try {
      const debate = await this.getDebate(tenantId, debateId);
      if (!debate) throw new Error('Debate not found');

      const council = await this.getCouncil(tenantId, debate.councilId);
      if (!council) throw new Error('Council not found');

      // Collect all positions
      const positions: Record<string, number> = {};
      const votes: Vote[] = [];

      for (const round of debate.rounds) {
        for (const arg of round.arguments) {
          positions[arg.position] = (positions[arg.position] || 0) + arg.confidence;
          votes.push({ memberId: arg.memberId, position: arg.position, weight: arg.confidence });
        }
      }

      // Determine outcome
      const sortedPositions = Object.entries(positions).sort((a, b) => b[1] - a[1]);
      let outcome: VerdictOutcome = 'split';
      let winningPosition: string | undefined;

      if (sortedPositions.length === 1) {
        outcome = 'consensus';
        winningPosition = sortedPositions[0][0];
      } else if (sortedPositions.length > 1) {
        const [first, second] = sortedPositions;
        if (first[1] > second[1] * 1.5) {
          outcome = 'majority';
          winningPosition = first[0];
        } else if (Math.abs(first[1] - second[1]) < 0.1) {
          outcome = 'synthesized';
        }
      }

      const verdict: Verdict = {
        outcome,
        summary: `Debate concluded with ${outcome} on topic: ${debate.topic}`,
        winningPosition,
        confidence: sortedPositions.length > 0 ? sortedPositions[0][1] / council.members.length : 0,
        votes,
        synthesizedAnswer: outcome === 'synthesized' ? 'Synthesized answer from multiple perspectives' : undefined,
      };

      // Update debate
      await executeStatement(
        `UPDATE council_debates SET status = 'concluded', verdict = :verdict, completed_at = NOW() WHERE id = :debateId`,
        [stringParam('verdict', JSON.stringify(verdict)), stringParam('debateId', debateId)]
      );

      // Update council status
      await executeStatement(
        `UPDATE council_of_rivals SET status = 'concluded', updated_at = NOW() WHERE id = :councilId`,
        [stringParam('councilId', debate.councilId)]
      );

      return verdict;
    } catch (error) {
      logger.error('Failed to conduct voting', { tenantId, debateId, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Preset Councils
  // --------------------------------------------------------------------------

  async getRecentDebates(tenantId: string, limit: number = 10): Promise<Debate[]> {
    try {
      const result = await executeStatement(
        `SELECT * FROM council_debates WHERE tenant_id = :tenantId ORDER BY started_at DESC LIMIT :limit`,
        [stringParam('tenantId', tenantId), longParam('limit', limit)]
      );
      return (result.rows || []).map(row => this.parseDebate(row as Record<string, unknown>));
    } catch (error) {
      logger.error('Failed to get recent debates', { tenantId, error });
      throw error;
    }
  }

  async advanceDebate(tenantId: string, debateId: string): Promise<Debate> {
    try {
      const debate = await this.getDebate(tenantId, debateId);
      if (!debate) throw new Error('Debate not found');

      const council = await this.getCouncil(tenantId, debate.councilId);
      if (!council) throw new Error('Council not found');

      // Check if we should conclude
      if (debate.currentRound >= council.moderator.maxRounds - 1) {
        await this.conductVoting(tenantId, debateId);
        return (await this.getDebate(tenantId, debateId))!;
      }

      // Advance to next round
      const nextRound = debate.currentRound + 1;
      debate.rounds.push({ number: nextRound, phase: 'opening', arguments: [], rebuttals: [] });

      await executeStatement(
        `UPDATE council_debates SET current_round = :nextRound, rounds = :rounds WHERE id = :debateId`,
        [
          longParam('nextRound', nextRound),
          stringParam('rounds', JSON.stringify(debate.rounds)),
          stringParam('debateId', debateId),
        ]
      );

      return { ...debate, currentRound: nextRound };
    } catch (error) {
      logger.error('Failed to advance debate', { tenantId, debateId, error });
      throw error;
    }
  }

  async concludeDebate(tenantId: string, debateId: string): Promise<Debate> {
    await this.conductVoting(tenantId, debateId);
    return (await this.getDebate(tenantId, debateId))!;
  }

  async cancelDebate(tenantId: string, debateId: string): Promise<void> {
    try {
      const debate = await this.getDebate(tenantId, debateId);
      if (!debate) throw new Error('Debate not found');

      await executeStatement(
        `UPDATE council_debates SET status = 'deadlocked', completed_at = NOW() WHERE id = :debateId`,
        [stringParam('debateId', debateId)]
      );

      await executeStatement(
        `UPDATE council_of_rivals SET status = 'idle', updated_at = NOW() WHERE id = :councilId`,
        [stringParam('councilId', debate.councilId)]
      );
    } catch (error) {
      logger.error('Failed to cancel debate', { tenantId, debateId, error });
      throw error;
    }
  }

  async getStatistics(tenantId: string): Promise<{
    totalDebates: number;
    consensusCount: number;
    majorityCount: number;
    deadlockedCount: number;
    avgRoundsPerDebate: number;
  }> {
    try {
      const result = await executeStatement(
        `SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE verdict->>'outcome' = 'consensus') as consensus,
          COUNT(*) FILTER (WHERE verdict->>'outcome' = 'majority') as majority,
          COUNT(*) FILTER (WHERE status = 'deadlocked') as deadlocked,
          AVG(current_round) as avg_rounds
        FROM council_debates WHERE tenant_id = :tenantId`,
        [stringParam('tenantId', tenantId)]
      );

      const row = result.rows?.[0] as Record<string, unknown> || {};
      return {
        totalDebates: Number(row.total) || 0,
        consensusCount: Number(row.consensus) || 0,
        majorityCount: Number(row.majority) || 0,
        deadlockedCount: Number(row.deadlocked) || 0,
        avgRoundsPerDebate: Number(row.avg_rounds) || 0,
      };
    } catch (error) {
      logger.error('Failed to get statistics', { tenantId, error });
      throw error;
    }
  }

  getPresetConfigurations(): Record<PresetCouncilType, { name: string; description: string; memberCount: number }> {
    return {
      balanced: { name: 'Balanced Council', description: 'Diverse perspectives with advocate, critic, and synthesizer', memberCount: 3 },
      technical: { name: 'Technical Review Board', description: 'Expert council for technical decisions', memberCount: 3 },
      creative: { name: 'Creative Council', description: 'Diverse voices for creative exploration', memberCount: 3 },
    };
  }

  async createFromPreset(tenantId: string, preset: PresetCouncilType, createdBy: string): Promise<Council> {
    return this.createPresetCouncil(tenantId, preset, createdBy);
  }

  async createPresetCouncil(tenantId: string, preset: PresetCouncilType, createdBy: string): Promise<Council> {
    const presets: Record<PresetCouncilType, Omit<Council, 'id' | 'tenantId' | 'status' | 'createdAt' | 'updatedAt'>> = {
      balanced: {
        name: 'Balanced Council',
        description: 'A balanced council with diverse perspectives',
        members: [
          { id: 'm1', name: 'Advocate', model: 'gpt-4o', role: 'advocate', avatar: '📣', color: '#10B981', personality: 'Supportive and constructive' },
          { id: 'm2', name: 'Critic', model: 'claude-3-sonnet', role: 'critic', avatar: '🔍', color: '#EF4444', personality: 'Analytical and questioning' },
          { id: 'm3', name: 'Synthesizer', model: 'gpt-4-turbo', role: 'synthesizer', avatar: '🔮', color: '#8B5CF6', personality: 'Integrative and holistic' },
        ],
        moderator: { model: 'gpt-4o', style: 'facilitator', maxRounds: 3, consensusThreshold: 0.7, timeoutMs: 30000 },
        rules: { minArguments: 1, maxArguments: 3, requireEvidence: false, allowRebuttals: true, votingMethod: 'majority', tieBreaker: 'synthesize' },
        createdBy,
      },
      technical: {
        name: 'Technical Review Board',
        description: 'Expert council for technical decisions',
        members: [
          { id: 'm1', name: 'Architect', model: 'gpt-4-turbo', role: 'specialist', avatar: '🏗️', color: '#3B82F6', personality: 'Systems thinking' },
          { id: 'm2', name: 'Pragmatist', model: 'claude-3-sonnet', role: 'advocate', avatar: '⚙️', color: '#10B981', personality: 'Practical and efficient' },
          { id: 'm3', name: 'Skeptic', model: 'gpt-4o', role: 'critic', avatar: '🧐', color: '#F59E0B', personality: 'Risk-aware and cautious' },
        ],
        moderator: { model: 'claude-3-opus', style: 'strict', maxRounds: 4, consensusThreshold: 0.8, timeoutMs: 45000 },
        rules: { minArguments: 2, maxArguments: 4, requireEvidence: true, allowRebuttals: true, votingMethod: 'weighted', tieBreaker: 'moderator' },
        createdBy,
      },
      creative: {
        name: 'Creative Council',
        description: 'Diverse voices for creative exploration',
        members: [
          { id: 'm1', name: 'Visionary', model: 'claude-3-opus', role: 'advocate', avatar: '🌟', color: '#EC4899', personality: 'Imaginative and bold' },
          { id: 'm2', name: 'Craftsman', model: 'gpt-4o', role: 'specialist', avatar: '🎨', color: '#8B5CF6', personality: 'Detail-oriented and skilled' },
          { id: 'm3', name: 'Audience', model: 'gpt-4-turbo', role: 'critic', avatar: '👁️', color: '#06B6D4', personality: 'User-focused perspective' },
        ],
        moderator: { model: 'gpt-4o', style: 'democratic', maxRounds: 3, consensusThreshold: 0.6, timeoutMs: 30000 },
        rules: { minArguments: 1, maxArguments: 5, requireEvidence: false, allowRebuttals: true, votingMethod: 'ranked', tieBreaker: 'synthesize' },
        createdBy,
      },
    };

    return this.createCouncil(tenantId, presets[preset]);
  }

  // --------------------------------------------------------------------------
  // Parse Helpers
  // --------------------------------------------------------------------------

  private parseCouncil(row: Record<string, unknown>): Council {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      name: String(row.name || ''),
      description: String(row.description || ''),
      members: this.parseJson(row.members) || [],
      moderator: this.parseJson(row.moderator) || { model: 'gpt-4o', style: 'facilitator', maxRounds: 3, consensusThreshold: 0.7, timeoutMs: 30000 },
      rules: this.parseJson(row.rules) || { minArguments: 1, maxArguments: 3, requireEvidence: false, allowRebuttals: true, votingMethod: 'majority', tieBreaker: 'synthesize' },
      status: String(row.status || 'idle') as CouncilStatus,
      createdBy: String(row.created_by || ''),
      createdAt: String(row.created_at || ''),
      updatedAt: String(row.updated_at || ''),
    };
  }

  private parseDebate(row: Record<string, unknown>): Debate {
    return {
      id: String(row.id || ''),
      councilId: String(row.council_id || ''),
      tenantId: String(row.tenant_id || ''),
      topic: String(row.topic || ''),
      context: String(row.context || ''),
      rounds: this.parseJson(row.rounds) || [],
      currentRound: Number(row.current_round) || 0,
      status: String(row.status || 'setup') as DebateStatus,
      verdict: this.parseJson(row.verdict) || undefined,
      startedAt: String(row.started_at || ''),
      completedAt: row.completed_at ? String(row.completed_at) : undefined,
      metadata: this.parseJson(row.metadata) || {},
    };
  }

  private parseJson<T>(value: unknown): T | null {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return null; }
    }
    return value as T;
  }
}

export const councilOfRivalsService = new CouncilOfRivalsService();
