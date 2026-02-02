/**
 * RADIANT Twilight Dreaming Service
 * 30% Invention Minimum Enforcement & Dreaming Session Orchestration
 * 
 * "Twilight Dreaming" occurs when CATO is not actively responding to requests.
 * During this time, prompts evolve, inventions are generated, and creative
 * spaces are explored to ensure the 30% novelty target is met.
 */

import { executeStatement, stringParam, doubleParam, boolParam } from '../../db/client';
import { enhancedLogger as logger } from '../../logging/enhanced-logger';
import { promptBreederService } from './prompt-breeder.service';
import type {
  PromptBreederOperator,
  PromptGenome,
  PromptPopulation,
  InventionMetrics,
  InventionEnforcementConfig,
  InventionCandidate,
  TwilightDreamingSession,
  DreamingDashboard,
  StartDreamingSessionRequest,
  StartDreamingSessionResponse,
  UpdateEnforcementConfigRequest,
  INVENTION_RATE_TARGET,
  INVENTION_RATE_MIN,
  GENERATIONS_PER_SESSION,
} from '@radiant/shared';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_INVENTION_RATE = 0.30;
const DEFAULT_NOVELTY_THRESHOLD = 0.6;
const DEFAULT_DREAMING_FREQUENCY = 60; // minutes

// =============================================================================
// Twilight Dreaming Service
// =============================================================================

class TwilightDreamingService {
  // ===========================================================================
  // Dashboard
  // ===========================================================================

  async getDashboard(tenantId: string): Promise<DreamingDashboard> {
    try {
      const [
        populations,
        recentSessions,
        inventionMetrics,
        enforcementConfig,
        recentInventions,
      ] = await Promise.all([
        this.getPopulations(tenantId),
        this.getRecentSessions(tenantId),
        this.getInventionMetrics(tenantId),
        this.getEnforcementConfig(tenantId),
        this.getRecentInventions(tenantId),
      ]);

      // Calculate summary stats
      const totalGenomes = populations.reduce((sum, p) => sum + p.currentSize, 0);
      const avgFitness = populations.length > 0
        ? populations.reduce((sum, p) => sum + p.avgFitness, 0) / populations.length
        : 0;

      // Get active session
      const activeSession = recentSessions.find(s => s.status === 'running');

      // Get top genomes for each population
      const populationsWithGenomes = await Promise.all(
        populations.map(async (population) => ({
          population,
          topGenomes: await this.getTopGenomes(tenantId, population.id, 5),
        }))
      );

      return {
        summary: {
          totalPopulations: populations.length,
          totalGenomes,
          totalInventions: await this.countInventions(tenantId),
          approvedInventions: await this.countInventions(tenantId, 'approved'),
          avgFitnessAllPopulations: avgFitness,
          currentInventionRate: inventionMetrics.inventionRate,
          targetInventionRate: enforcementConfig.targetInventionRate,
        },
        activeSession,
        recentSessions: recentSessions.slice(0, 10),
        populations: populationsWithGenomes,
        inventionMetrics,
        enforcementConfig,
        recentInventions,
      };
    } catch (error) {
      logger.error('Failed to get dreaming dashboard', { error, tenantId });
      throw error;
    }
  }

  // ===========================================================================
  // Dreaming Sessions
  // ===========================================================================

  async startDreamingSession(
    tenantId: string,
    request: StartDreamingSessionRequest
  ): Promise<StartDreamingSessionResponse> {
    try {
      // Check for existing active session
      const activeSession = await this.getActiveSession(tenantId);
      if (activeSession) {
        throw new Error('A dreaming session is already running');
      }

      // Get or create population
      let populationId = request.populationId;
      if (!populationId) {
        const population = await this.createDefaultPopulation(tenantId);
        populationId = population.id;
      }

      const population = await this.getPopulation(tenantId, populationId);
      if (!population) {
        throw new Error('Population not found');
      }

      // Create session
      const sessionId = crypto.randomUUID();
      const now = new Date().toISOString();

      await executeStatement(
        `INSERT INTO twilight_dreaming_sessions (
          id, tenant_id, status, population_id, 
          start_generation, generations_evolved,
          operator_usage, genomes_created, genomes_evaluated,
          inventions_candidated, inventions_approved,
          start_avg_fitness, new_champion_found,
          scheduled_at, created_at, started_at
        ) VALUES (
          :id, :tenant_id, 'running', :population_id,
          :start_gen, 0,
          :operator_usage, 0, 0,
          0, 0,
          :start_fitness, false,
          :scheduled_at, :created_at, :started_at
        )`,
        [
          stringParam('id', sessionId),
          stringParam('tenant_id', tenantId),
          stringParam('population_id', populationId),
          stringParam('start_gen', String(population.generation)),
          stringParam('operator_usage', '{}'),
          doubleParam('start_fitness', population.avgFitness),
          stringParam('scheduled_at', now),
          stringParam('created_at', now),
          stringParam('started_at', now),
        ]
      );

      // Start evolution in background (would be async in production)
      this.runDreamingSession(sessionId, tenantId, populationId, request.generationsToEvolve || 10)
        .catch(error => logger.error('Dreaming session failed', { error, sessionId }));

      const estimatedDurationMs = (request.generationsToEvolve || 10) * 5000; // ~5s per generation

      logger.info('Dreaming session started', { sessionId, tenantId, populationId });

      return {
        sessionId,
        status: 'running',
        populationId,
        estimatedDurationMs,
      };
    } catch (error) {
      logger.error('Failed to start dreaming session', { error, tenantId });
      throw error;
    }
  }

  private async runDreamingSession(
    sessionId: string,
    tenantId: string,
    populationId: string,
    generations: number
  ): Promise<void> {
    const operatorUsage: Record<PromptBreederOperator, number> = {
      zero_order_hypermutation: 0,
      first_order_hypermutation: 0,
      estimation_of_distribution: 0,
      lineage_based_mutation: 0,
      crossover: 0,
      lamarckian_mutation: 0,
      context_shuffling: 0,
      working_memory_expansion: 0,
      elm: 0,
    };

    let genomesCreated = 0;
    let genomesEvaluated = 0;
    let inventionsCandidated = 0;
    let newChampionFound = false;
    let newChampionId: string | undefined;
    let newChampionFitness = 0;
    let endAvgFitness = 0;

    try {
      for (let gen = 0; gen < generations; gen++) {
        // Evolve population
        const result = await promptBreederService.evolvePopulation(tenantId, populationId);

        // Accumulate stats
        genomesCreated += result.newGenomes.length;
        for (const [op, count] of Object.entries(result.operatorUsage)) {
          operatorUsage[op as PromptBreederOperator] += count;
        }

        // Evaluate new genomes (mock evaluation in this implementation)
        for (const genome of result.newGenomes) {
          const testResults = [
            { quality: Math.random() * 0.3 + 0.5, novelty: Math.random() * 0.4 + 0.4, safety: Math.random() * 0.2 + 0.8 },
            { quality: Math.random() * 0.3 + 0.5, novelty: Math.random() * 0.4 + 0.4, safety: Math.random() * 0.2 + 0.8 },
          ];

          const evaluation = await promptBreederService.evaluateGenome(tenantId, genome, testResults);
          genome.fitness = evaluation.fitness;
          genome.noveltyScore = evaluation.noveltyScore;
          genome.qualityScore = evaluation.qualityScore;
          genome.safetyScore = evaluation.safetyScore;
          genomesEvaluated++;

          // Check for new champion
          if (genome.fitness > newChampionFitness) {
            newChampionFitness = genome.fitness;
            newChampionId = genome.id;
            newChampionFound = true;
          }

          // Check for invention candidate (high novelty)
          if (genome.noveltyScore > DEFAULT_NOVELTY_THRESHOLD) {
            await this.createInventionCandidate(tenantId, genome, sessionId);
            inventionsCandidated++;
          }
        }

        endAvgFitness = result.avgFitness;

        // Update session progress
        await executeStatement(
          `UPDATE twilight_dreaming_sessions 
           SET generations_evolved = :gen,
               operator_usage = :operator_usage,
               genomes_created = :genomes_created,
               genomes_evaluated = :genomes_evaluated,
               inventions_candidated = :inventions
           WHERE id = :id`,
          [
            stringParam('id', sessionId),
            stringParam('gen', String(gen + 1)),
            stringParam('operator_usage', JSON.stringify(operatorUsage)),
            stringParam('genomes_created', String(genomesCreated)),
            stringParam('genomes_evaluated', String(genomesEvaluated)),
            stringParam('inventions', String(inventionsCandidated)),
          ]
        );
      }

      // Complete session
      const startSession = await this.getSession(sessionId);
      const fitnessImprovement = endAvgFitness - (startSession?.startAvgFitness || 0);

      await executeStatement(
        `UPDATE twilight_dreaming_sessions 
         SET status = 'completed',
             completed_at = NOW(),
             duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
             end_generation = :end_gen,
             end_avg_fitness = :end_fitness,
             fitness_improvement = :improvement,
             new_champion_found = :new_champ,
             new_champion_id = :champ_id,
             new_champion_fitness = :champ_fitness
         WHERE id = :id`,
        [
          stringParam('id', sessionId),
          stringParam('end_gen', String((startSession?.startGeneration || 0) + generations)),
          doubleParam('end_fitness', endAvgFitness),
          doubleParam('improvement', fitnessImprovement),
          boolParam('new_champ', newChampionFound),
          stringParam('champ_id', newChampionId || ''),
          doubleParam('champ_fitness', newChampionFitness),
        ]
      );

      logger.info('Dreaming session completed', {
        sessionId,
        genomesCreated,
        inventionsCandidated,
        fitnessImprovement,
      });
    } catch (error) {
      // Mark session as failed
      await executeStatement(
        `UPDATE twilight_dreaming_sessions 
         SET status = 'failed', error = :error, completed_at = NOW()
         WHERE id = :id`,
        [stringParam('id', sessionId), stringParam('error', String(error))]
      );
      throw error;
    }
  }

  // ===========================================================================
  // Invention Enforcement
  // ===========================================================================

  async checkInventionRate(
    tenantId: string,
    userId?: string
  ): Promise<{
    currentRate: number;
    targetRate: number;
    deficit: number;
    enforcementMode: 'passive' | 'active' | 'aggressive';
    shouldForceInvention: boolean;
  }> {
    const metrics = await this.getInventionMetrics(tenantId, userId);
    const config = await this.getEnforcementConfig(tenantId);

    const deficit = config.targetInventionRate - metrics.inventionRate;
    
    let enforcementMode: 'passive' | 'active' | 'aggressive' = 'passive';
    if (deficit > config.activeModeBelowTarget) {
      enforcementMode = 'aggressive';
    } else if (deficit > config.passiveModeBelowTarget) {
      enforcementMode = 'active';
    }

    // Force invention if deficit is too high or too many consecutive non-inventive
    const shouldForceInvention = 
      enforcementMode === 'aggressive' ||
      metrics.consecutiveNonInventive >= 5;

    return {
      currentRate: metrics.inventionRate,
      targetRate: config.targetInventionRate,
      deficit,
      enforcementMode,
      shouldForceInvention,
    };
  }

  async recordResponse(
    tenantId: string,
    userId: string,
    response: {
      noveltyScore: number;
      creativityScore: number;
      isInventive: boolean;
    }
  ): Promise<void> {
    try {
      const config = await this.getEnforcementConfig(tenantId);
      const isInventive = response.noveltyScore >= config.noveltyThreshold;

      await executeStatement(
        `INSERT INTO invention_response_log (
          id, tenant_id, user_id, novelty_score, creativity_score, is_inventive, created_at
        ) VALUES (
          :id, :tenant_id, :user_id, :novelty, :creativity, :is_inventive, NOW()
        )`,
        [
          stringParam('id', crypto.randomUUID()),
          stringParam('tenant_id', tenantId),
          stringParam('user_id', userId),
          doubleParam('novelty', response.noveltyScore),
          doubleParam('creativity', response.creativityScore),
          boolParam('is_inventive', isInventive),
        ]
      );

      // Update metrics
      await this.updateInventionMetrics(tenantId, userId, isInventive);
    } catch (error) {
      logger.error('Failed to record response', { error, tenantId });
    }
  }

  // ===========================================================================
  // Invention Candidates
  // ===========================================================================

  async createInventionCandidate(
    tenantId: string,
    genome: PromptGenome,
    sessionId: string
  ): Promise<InventionCandidate> {
    const id = crypto.randomUUID();

    await executeStatement(
      `INSERT INTO invention_candidates (
        id, tenant_id, source, population_id, genome_id,
        invention_type, content, description,
        novelty_score, utility_score, safety_score, overall_score,
        status, usage_count, success_rate, created_at
      ) VALUES (
        :id, :tenant_id, 'twilight_dreaming', :population_id, :genome_id,
        'prompt_pattern', :content, :description,
        :novelty, :utility, :safety, :overall,
        'pending', 0, 0, NOW()
      )`,
      [
        stringParam('id', id),
        stringParam('tenant_id', tenantId),
        stringParam('population_id', sessionId),
        stringParam('genome_id', genome.id),
        stringParam('content', genome.systemPrompt),
        stringParam('description', `Generation ${genome.generation} genome with ${genome.mutations.length} mutations`),
        doubleParam('novelty', genome.noveltyScore),
        doubleParam('utility', genome.qualityScore),
        doubleParam('safety', genome.safetyScore),
        doubleParam('overall', genome.fitness),
      ]
    );

    logger.info('Invention candidate created', { id, tenantId, noveltyScore: genome.noveltyScore });

    return {
      id,
      tenantId,
      source: 'twilight_dreaming',
      populationId: sessionId,
      genomeId: genome.id,
      inventionType: 'prompt_pattern',
      content: genome.systemPrompt,
      noveltyScore: genome.noveltyScore,
      utilityScore: genome.qualityScore,
      safetyScore: genome.safetyScore,
      overallScore: genome.fitness,
      status: 'pending',
      usageCount: 0,
      successRate: 0,
      createdAt: new Date().toISOString(),
    };
  }

  async approveInvention(
    tenantId: string,
    inventionId: string,
    userId: string,
    notes?: string,
    deployImmediately = false
  ): Promise<void> {
    await executeStatement(
      `UPDATE invention_candidates 
       SET status = :status, evaluated_by = :user, evaluation_notes = :notes,
           evaluated_at = NOW(), deployed_at = CASE WHEN :deploy THEN NOW() ELSE NULL END
       WHERE id = :id AND tenant_id = :tenant_id`,
      [
        stringParam('id', inventionId),
        stringParam('tenant_id', tenantId),
        stringParam('status', deployImmediately ? 'deployed' : 'approved'),
        stringParam('user', userId),
        stringParam('notes', notes || ''),
        boolParam('deploy', deployImmediately),
      ]
    );

    logger.info('Invention approved', { inventionId, tenantId, deployed: deployImmediately });
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  async getEnforcementConfig(tenantId: string): Promise<InventionEnforcementConfig> {
    try {
      const result = await executeStatement(
        `SELECT * FROM invention_enforcement_config WHERE tenant_id = :tenant_id`,
        [stringParam('tenant_id', tenantId)]
      );

      if (result.rows?.length) {
        return this.mapRowToConfig(result.rows[0]);
      }

      // Return default config
      return this.getDefaultEnforcementConfig(tenantId);
    } catch (error) {
      logger.error('Failed to get enforcement config', { error, tenantId });
      return this.getDefaultEnforcementConfig(tenantId);
    }
  }

  async updateEnforcementConfig(
    tenantId: string,
    updates: UpdateEnforcementConfigRequest
  ): Promise<InventionEnforcementConfig> {
    const existing = await this.getEnforcementConfig(tenantId);
    
    const updateFields: string[] = [];
    const params = [stringParam('tenant_id', tenantId)];

    if (updates.targetInventionRate !== undefined) {
      updateFields.push('target_invention_rate = :target');
      params.push(doubleParam('target', updates.targetInventionRate));
    }

    if (updates.enforcementEnabled !== undefined) {
      updateFields.push('enforcement_enabled = :enabled');
      params.push(boolParam('enabled', updates.enforcementEnabled));
    }

    if (updates.dreamingEnabled !== undefined) {
      updateFields.push('dreaming_enabled = :dreaming');
      params.push(boolParam('dreaming', updates.dreamingEnabled));
    }

    if (updates.dreamingSchedule !== undefined) {
      updateFields.push('dreaming_schedule = :schedule');
      params.push(stringParam('schedule', updates.dreamingSchedule));
    }

    updateFields.push('updated_at = NOW()');

    await executeStatement(
      `INSERT INTO invention_enforcement_config (tenant_id, ${updateFields.map(f => f.split(' = ')[0]).join(', ')}, created_at)
       VALUES (:tenant_id, ${updateFields.map(() => '?').join(', ')}, NOW())
       ON CONFLICT (tenant_id) DO UPDATE SET ${updateFields.join(', ')}`,
      params
    );

    return this.getEnforcementConfig(tenantId);
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private async getPopulations(tenantId: string): Promise<PromptPopulation[]> {
    try {
      const result = await executeStatement(
        `SELECT * FROM prompt_populations WHERE tenant_id = :tenant_id ORDER BY updated_at DESC`,
        [stringParam('tenant_id', tenantId)]
      );
      return (result.rows || []).map((row: Record<string, unknown>) => this.mapRowToPopulation(row));
    } catch {
      return [];
    }
  }

  private async getPopulation(tenantId: string, populationId: string): Promise<PromptPopulation | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM prompt_populations WHERE tenant_id = :tenant_id AND id = :id`,
        [stringParam('tenant_id', tenantId), stringParam('id', populationId)]
      );
      if (!result.rows?.length) return null;
      return this.mapRowToPopulation(result.rows[0]);
    } catch {
      return null;
    }
  }

  private async createDefaultPopulation(tenantId: string): Promise<PromptPopulation> {
    const id = crypto.randomUUID();
    await executeStatement(
      `INSERT INTO prompt_populations (
        id, tenant_id, name, target_size, elite_count, mutation_rate, crossover_rate,
        generation, current_size, avg_fitness, max_fitness, diversity_index,
        operator_weights, fitness_history, created_at, updated_at
      ) VALUES (
        :id, :tenant_id, 'Default Population', 100, 10, 0.1, 0.7,
        0, 0, 0, 0, 1.0,
        '{}', '[]', NOW(), NOW()
      )`,
      [stringParam('id', id), stringParam('tenant_id', tenantId)]
    );
    return (await this.getPopulation(tenantId, id))!;
  }

  private async getTopGenomes(tenantId: string, populationId: string, limit: number): Promise<PromptGenome[]> {
    try {
      const result = await executeStatement(
        `SELECT * FROM prompt_genomes 
         WHERE tenant_id = :tenant_id AND population_id = :population_id
         ORDER BY fitness DESC LIMIT ${limit}`,
        [stringParam('tenant_id', tenantId), stringParam('population_id', populationId)]
      );
      return (result.rows || []).map((row: Record<string, unknown>) => this.mapRowToGenome(row));
    } catch {
      return [];
    }
  }

  private async getRecentSessions(tenantId: string, limit = 20): Promise<TwilightDreamingSession[]> {
    try {
      const result = await executeStatement(
        `SELECT * FROM twilight_dreaming_sessions 
         WHERE tenant_id = :tenant_id ORDER BY created_at DESC LIMIT ${limit}`,
        [stringParam('tenant_id', tenantId)]
      );
      return (result.rows || []).map((row: Record<string, unknown>) => this.mapRowToSession(row));
    } catch {
      return [];
    }
  }

  private async getSession(sessionId: string): Promise<TwilightDreamingSession | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM twilight_dreaming_sessions WHERE id = :id`,
        [stringParam('id', sessionId)]
      );
      if (!result.rows?.length) return null;
      return this.mapRowToSession(result.rows[0]);
    } catch {
      return null;
    }
  }

  private async getActiveSession(tenantId: string): Promise<TwilightDreamingSession | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM twilight_dreaming_sessions 
         WHERE tenant_id = :tenant_id AND status = 'running'
         ORDER BY created_at DESC LIMIT 1`,
        [stringParam('tenant_id', tenantId)]
      );
      if (!result.rows?.length) return null;
      return this.mapRowToSession(result.rows[0]);
    } catch {
      return null;
    }
  }

  private async getInventionMetrics(tenantId: string, userId?: string): Promise<InventionMetrics> {
    try {
      const result = await executeStatement(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN is_inventive THEN 1 ELSE 0 END) as inventive,
           MAX(CASE WHEN is_inventive THEN created_at ELSE NULL END) as last_inventive
         FROM invention_response_log
         WHERE tenant_id = :tenant_id
           ${userId ? 'AND user_id = :user_id' : ''}
           AND created_at > NOW() - INTERVAL '24 hours'`,
        [stringParam('tenant_id', tenantId), ...(userId ? [stringParam('user_id', userId)] : [])]
      );

      const row = result.rows?.[0] || {};
      const total = Number(row.total) || 0;
      const inventive = Number(row.inventive) || 0;

      return {
        tenantId,
        userId,
        totalResponses: total,
        inventiveResponses: inventive,
        inventionRate: total > 0 ? inventive / total : 0,
        windowSize: 100,
        windowInventionRate: total > 0 ? inventive / total : 0,
        targetInventionRate: DEFAULT_INVENTION_RATE,
        currentDeficit: DEFAULT_INVENTION_RATE - (total > 0 ? inventive / total : 0),
        enforcementMode: 'passive',
        consecutiveNonInventive: 0,
        lastInventiveAt: row.last_inventive ? String(row.last_inventive) : undefined,
        periodStart: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      };
    } catch {
      return this.getDefaultMetrics(tenantId, userId);
    }
  }

  private async updateInventionMetrics(tenantId: string, userId: string, isInventive: boolean): Promise<void> {
    // Update rolling metrics (simplified)
    await executeStatement(
      `UPDATE invention_metrics_cache
       SET total_responses = total_responses + 1,
           inventive_responses = inventive_responses + CASE WHEN :is_inv THEN 1 ELSE 0 END,
           consecutive_non_inventive = CASE WHEN :is_inv THEN 0 ELSE consecutive_non_inventive + 1 END,
           last_inventive_at = CASE WHEN :is_inv THEN NOW() ELSE last_inventive_at END,
           updated_at = NOW()
       WHERE tenant_id = :tenant_id`,
      [
        stringParam('tenant_id', tenantId),
        boolParam('is_inv', isInventive),
      ]
    );
  }

  private async getRecentInventions(tenantId: string, limit = 10): Promise<InventionCandidate[]> {
    try {
      const result = await executeStatement(
        `SELECT * FROM invention_candidates 
         WHERE tenant_id = :tenant_id ORDER BY created_at DESC LIMIT ${limit}`,
        [stringParam('tenant_id', tenantId)]
      );
      return (result.rows || []).map((row: Record<string, unknown>) => this.mapRowToInvention(row));
    } catch {
      return [];
    }
  }

  private async countInventions(tenantId: string, status?: string): Promise<number> {
    try {
      const result = await executeStatement(
        `SELECT COUNT(*) as count FROM invention_candidates 
         WHERE tenant_id = :tenant_id ${status ? 'AND status = :status' : ''}`,
        [stringParam('tenant_id', tenantId), ...(status ? [stringParam('status', status)] : [])]
      );
      return Number(result.rows?.[0]?.count) || 0;
    } catch {
      return 0;
    }
  }

  private getDefaultEnforcementConfig(tenantId: string): InventionEnforcementConfig {
    return {
      tenantId,
      targetInventionRate: 0.30,
      minInventionRate: 0.20,
      maxInventionRate: 0.50,
      noveltyThreshold: 0.6,
      creativityThreshold: 0.5,
      enforcementEnabled: true,
      passiveModeBelowTarget: 0.05,
      activeModeBelowTarget: 0.10,
      dreamingEnabled: true,
      dreamingSchedule: 'scheduled',
      dreamingWindowStart: '02:00',
      dreamingWindowEnd: '06:00',
      dreamingFrequencyMinutes: 60,
      maxInventionPerSession: 50,
      safetyOverrideInvention: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private getDefaultMetrics(tenantId: string, userId?: string): InventionMetrics {
    return {
      tenantId,
      userId,
      totalResponses: 0,
      inventiveResponses: 0,
      inventionRate: 0,
      windowSize: 100,
      windowInventionRate: 0,
      targetInventionRate: 0.30,
      currentDeficit: 0.30,
      enforcementMode: 'passive',
      consecutiveNonInventive: 0,
      periodStart: new Date().toISOString(),
    };
  }

  // Mapping functions
  private mapRowToPopulation(row: Record<string, unknown>): PromptPopulation {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      name: String(row.name || ''),
      description: row.description ? String(row.description) : undefined,
      targetSize: Number(row.target_size) || 100,
      eliteCount: Number(row.elite_count) || 10,
      mutationRate: Number(row.mutation_rate) || 0.1,
      crossoverRate: Number(row.crossover_rate) || 0.7,
      generation: Number(row.generation) || 0,
      currentSize: Number(row.current_size) || 0,
      championId: row.champion_id ? String(row.champion_id) : undefined,
      avgFitness: Number(row.avg_fitness) || 0,
      maxFitness: Number(row.max_fitness) || 0,
      diversityIndex: Number(row.diversity_index) || 1,
      operatorWeights: row.operator_weights ? JSON.parse(String(row.operator_weights)) : {},
      fitnessHistory: row.fitness_history ? JSON.parse(String(row.fitness_history)) : [],
      createdAt: String(row.created_at || new Date().toISOString()),
      updatedAt: String(row.updated_at || new Date().toISOString()),
      lastEvolutionAt: row.last_evolution_at ? String(row.last_evolution_at) : undefined,
    };
  }

  private mapRowToGenome(row: Record<string, unknown>): PromptGenome {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      systemPrompt: String(row.system_prompt || ''),
      taskContext: String(row.task_context || ''),
      constraints: row.constraints ? JSON.parse(String(row.constraints)) : [],
      examples: row.examples ? JSON.parse(String(row.examples)) : [],
      generation: Number(row.generation) || 0,
      parentIds: row.parent_ids ? JSON.parse(String(row.parent_ids)) : [],
      operatorUsed: (row.operator_used as PromptBreederOperator) || 'zero_order_hypermutation',
      fitness: Number(row.fitness) || 0,
      noveltyScore: Number(row.novelty_score) || 0,
      qualityScore: Number(row.quality_score) || 0,
      safetyScore: Number(row.safety_score) || 0,
      usageCount: Number(row.usage_count) || 0,
      successRate: Number(row.success_rate) || 0,
      avgResponseQuality: Number(row.avg_response_quality) || 0,
      ancestry: row.ancestry ? JSON.parse(String(row.ancestry)) : [],
      mutations: row.mutations ? JSON.parse(String(row.mutations)) : [],
      status: (row.status as PromptGenome['status']) || 'testing',
      isChampion: Boolean(row.is_champion),
      createdAt: String(row.created_at || new Date().toISOString()),
    };
  }

  private mapRowToSession(row: Record<string, unknown>): TwilightDreamingSession {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      status: (row.status as TwilightDreamingSession['status']) || 'scheduled',
      startedAt: row.started_at ? String(row.started_at) : undefined,
      completedAt: row.completed_at ? String(row.completed_at) : undefined,
      durationMs: row.duration_ms ? Number(row.duration_ms) : undefined,
      populationId: String(row.population_id || ''),
      startGeneration: Number(row.start_generation) || 0,
      endGeneration: row.end_generation ? Number(row.end_generation) : undefined,
      generationsEvolved: Number(row.generations_evolved) || 0,
      operatorUsage: row.operator_usage ? JSON.parse(String(row.operator_usage)) : {},
      genomesCreated: Number(row.genomes_created) || 0,
      genomesEvaluated: Number(row.genomes_evaluated) || 0,
      inventionsCandidated: Number(row.inventions_candidated) || 0,
      inventionsApproved: Number(row.inventions_approved) || 0,
      startAvgFitness: Number(row.start_avg_fitness) || 0,
      endAvgFitness: row.end_avg_fitness ? Number(row.end_avg_fitness) : undefined,
      fitnessImprovement: row.fitness_improvement ? Number(row.fitness_improvement) : undefined,
      newChampionFound: Boolean(row.new_champion_found),
      newChampionId: row.new_champion_id ? String(row.new_champion_id) : undefined,
      newChampionFitness: row.new_champion_fitness ? Number(row.new_champion_fitness) : undefined,
      error: row.error ? String(row.error) : undefined,
      scheduledAt: String(row.scheduled_at || new Date().toISOString()),
      createdAt: String(row.created_at || new Date().toISOString()),
    };
  }

  private mapRowToInvention(row: Record<string, unknown>): InventionCandidate {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      source: (row.source as InventionCandidate['source']) || 'twilight_dreaming',
      populationId: row.population_id ? String(row.population_id) : undefined,
      genomeId: row.genome_id ? String(row.genome_id) : undefined,
      inventionType: (row.invention_type as InventionCandidate['inventionType']) || 'prompt_pattern',
      content: String(row.content || ''),
      description: row.description ? String(row.description) : undefined,
      noveltyScore: Number(row.novelty_score) || 0,
      utilityScore: Number(row.utility_score) || 0,
      safetyScore: Number(row.safety_score) || 0,
      overallScore: Number(row.overall_score) || 0,
      status: (row.status as InventionCandidate['status']) || 'pending',
      evaluatedBy: row.evaluated_by ? String(row.evaluated_by) : undefined,
      evaluationNotes: row.evaluation_notes ? String(row.evaluation_notes) : undefined,
      usageCount: Number(row.usage_count) || 0,
      successRate: Number(row.success_rate) || 0,
      createdAt: String(row.created_at || new Date().toISOString()),
      evaluatedAt: row.evaluated_at ? String(row.evaluated_at) : undefined,
      deployedAt: row.deployed_at ? String(row.deployed_at) : undefined,
    };
  }

  private mapRowToConfig(row: Record<string, unknown>): InventionEnforcementConfig {
    return {
      tenantId: String(row.tenant_id || ''),
      targetInventionRate: Number(row.target_invention_rate) || 0.30,
      minInventionRate: Number(row.min_invention_rate) || 0.20,
      maxInventionRate: Number(row.max_invention_rate) || 0.50,
      noveltyThreshold: Number(row.novelty_threshold) || 0.6,
      creativityThreshold: Number(row.creativity_threshold) || 0.5,
      enforcementEnabled: Boolean(row.enforcement_enabled),
      passiveModeBelowTarget: Number(row.passive_mode_below_target) || 0.05,
      activeModeBelowTarget: Number(row.active_mode_below_target) || 0.10,
      dreamingEnabled: Boolean(row.dreaming_enabled),
      dreamingSchedule: (row.dreaming_schedule as InventionEnforcementConfig['dreamingSchedule']) || 'scheduled',
      dreamingWindowStart: row.dreaming_window_start ? String(row.dreaming_window_start) : undefined,
      dreamingWindowEnd: row.dreaming_window_end ? String(row.dreaming_window_end) : undefined,
      dreamingFrequencyMinutes: Number(row.dreaming_frequency_minutes) || 60,
      maxInventionPerSession: Number(row.max_invention_per_session) || 50,
      safetyOverrideInvention: Boolean(row.safety_override_invention ?? true),
      createdAt: String(row.created_at || new Date().toISOString()),
      updatedAt: String(row.updated_at || new Date().toISOString()),
    };
  }
}

export const twilightDreamingService = new TwilightDreamingService();
