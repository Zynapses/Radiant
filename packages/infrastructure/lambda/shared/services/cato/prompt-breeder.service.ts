/**
 * RADIANT PromptBreeder Service
 * Evolutionary prompt optimization with 9 specialized operators
 * 
 * Implements the PromptBreeder algorithm for evolving prompts:
 * 1. Zero-Order Hypermutation - Random mutations
 * 2. First-Order Hypermutation - Gradient-guided mutations
 * 3. Estimation of Distribution - Learn from population
 * 4. Lineage-Based Mutation - Ancestry-informed changes
 * 5. Crossover - Combine parent prompts
 * 6. Lamarckian Mutation - Persist successful adaptations
 * 7. Context Shuffling - Reorder context elements
 * 8. Working Memory Expansion - Expand relevant context
 * 9. ELM - Extreme Learning Mutation for breakthroughs
 */

import { executeStatement, stringParam, doubleParam, boolParam } from '../../db/client';
import { createRegisteredLogger } from '../logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'cato/prompt-breeder',
  category: 'infrastructure',
  sourceType: 'application',
});
import type {
  PromptBreederOperator,
  PromptBreederOperatorConfig,
  PromptGenome,
  PromptPopulation,
  DEFAULT_OPERATOR_CONFIGS,
} from '@radiant/shared';

// =============================================================================
// Operator Implementations
// =============================================================================

interface MutationResult {
  genome: Partial<PromptGenome>;
  mutations: string[];
}

class PromptBreederOperators {
  /**
   * 1. Zero-Order Hypermutation
   * Random mutations without gradient guidance
   */
  static zeroOrderHypermutation(
    genome: PromptGenome,
    config: PromptBreederOperatorConfig
  ): MutationResult {
    const mutations: string[] = [];
    const mutationRate = (config.parameters.mutationRate as number) || 0.1;
    const maxMutations = (config.parameters.maxMutations as number) || 5;

    let systemPrompt = genome.systemPrompt;
    let taskContext = genome.taskContext;
    const constraints = [...genome.constraints];
    const examples = [...genome.examples];

    // Random word replacements in system prompt
    if (Math.random() < mutationRate) {
      const words = systemPrompt.split(' ');
      const idx = Math.floor(Math.random() * words.length);
      const synonyms = ['analyze', 'examine', 'evaluate', 'assess', 'consider', 'review'];
      words[idx] = synonyms[Math.floor(Math.random() * synonyms.length)];
      systemPrompt = words.join(' ');
      mutations.push(`word_replacement_${idx}`);
    }

    // Random constraint addition/removal
    if (Math.random() < mutationRate && mutations.length < maxMutations) {
      if (constraints.length > 0 && Math.random() < 0.5) {
        const removed = constraints.splice(Math.floor(Math.random() * constraints.length), 1);
        mutations.push(`remove_constraint:${removed[0]?.slice(0, 20)}`);
      } else {
        const newConstraints = [
          'Be concise',
          'Provide examples',
          'Consider edge cases',
          'Cite sources when possible',
        ];
        constraints.push(newConstraints[Math.floor(Math.random() * newConstraints.length)]);
        mutations.push('add_constraint');
      }
    }

    return {
      genome: { systemPrompt, taskContext, constraints, examples },
      mutations,
    };
  }

  /**
   * 2. First-Order Hypermutation
   * Gradient-guided mutations based on fitness landscape
   */
  static firstOrderHypermutation(
    genome: PromptGenome,
    config: PromptBreederOperatorConfig,
    fitnessGradient?: Record<string, number>
  ): MutationResult {
    const mutations: string[] = [];
    const learningRate = (config.parameters.learningRate as number) || 0.01;

    let systemPrompt = genome.systemPrompt;
    const constraints = [...genome.constraints];

    // Use fitness gradient to guide mutations
    const gradient = fitnessGradient || {
      length: genome.fitness > 0.7 ? 0.1 : -0.1,
      specificity: genome.qualityScore > 0.8 ? 0.05 : -0.05,
    };

    // Adjust prompt length based on gradient
    if (gradient.length > 0) {
      systemPrompt += ' Please provide detailed explanations.';
      mutations.push('expand_prompt');
    } else if (gradient.length < 0 && systemPrompt.length > 100) {
      systemPrompt = systemPrompt.slice(0, Math.floor(systemPrompt.length * 0.9));
      mutations.push('contract_prompt');
    }

    // Adjust specificity
    if (gradient.specificity > 0) {
      constraints.push('Be specific and precise');
      mutations.push('increase_specificity');
    }

    return {
      genome: { systemPrompt, constraints },
      mutations,
    };
  }

  /**
   * 3. Estimation of Distribution
   * Learn and sample from distribution of successful prompts
   */
  static estimationOfDistribution(
    genome: PromptGenome,
    population: PromptGenome[],
    config: PromptBreederOperatorConfig
  ): MutationResult {
    const mutations: string[] = [];
    const eliteRatio = (config.parameters.eliteRatio as number) || 0.2;

    // Get elite prompts
    const elites = population
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, Math.ceil(population.length * eliteRatio));

    if (elites.length === 0) {
      return { genome: {}, mutations: ['no_elites_available'] };
    }

    // Sample patterns from elites
    const eliteConstraints = elites.flatMap(e => e.constraints);
    const constraintCounts = new Map<string, number>();
    for (const c of eliteConstraints) {
      constraintCounts.set(c, (constraintCounts.get(c) || 0) + 1);
    }

    // Add most common elite constraints
    const constraints = [...genome.constraints];
    const topConstraints = [...constraintCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c]) => c);

    for (const tc of topConstraints) {
      if (!constraints.includes(tc)) {
        constraints.push(tc);
        mutations.push(`adopt_elite_constraint:${tc.slice(0, 20)}`);
      }
    }

    return {
      genome: { constraints },
      mutations,
    };
  }

  /**
   * 4. Lineage-Based Mutation
   * Mutations influenced by prompt ancestry
   */
  static lineageBasedMutation(
    genome: PromptGenome,
    ancestors: PromptGenome[],
    config: PromptBreederOperatorConfig
  ): MutationResult {
    const mutations: string[] = [];
    const inheritanceWeight = (config.parameters.inheritanceWeight as number) || 0.3;

    // Find successful patterns in ancestry
    const successfulAncestors = ancestors.filter(a => a.fitness > 0.7);
    
    if (successfulAncestors.length === 0) {
      return { genome: {}, mutations: ['no_successful_ancestors'] };
    }

    // Inherit patterns from successful ancestors
    const constraints = [...genome.constraints];
    const ancestorConstraints = successfulAncestors.flatMap(a => a.constraints);
    
    for (const ac of ancestorConstraints) {
      if (Math.random() < inheritanceWeight && !constraints.includes(ac)) {
        constraints.push(ac);
        mutations.push(`inherit_constraint:${ac.slice(0, 20)}`);
        break;
      }
    }

    return {
      genome: { constraints },
      mutations,
    };
  }

  /**
   * 5. Crossover
   * Combine elements from two parent prompts
   */
  static crossover(
    parent1: PromptGenome,
    parent2: PromptGenome,
    config: PromptBreederOperatorConfig
  ): MutationResult {
    const mutations: string[] = [];
    const uniformRate = (config.parameters.uniformRate as number) || 0.5;

    // Crossover system prompts
    const words1 = parent1.systemPrompt.split(' ');
    const words2 = parent2.systemPrompt.split(' ');
    const childWords = words1.map((w, i) => 
      Math.random() < uniformRate ? w : (words2[i] || w)
    );
    const systemPrompt = childWords.join(' ');
    mutations.push('crossover_system_prompt');

    // Crossover constraints
    const constraints: string[] = [];
    const allConstraints = [...new Set([...parent1.constraints, ...parent2.constraints])];
    for (const c of allConstraints) {
      if (Math.random() < uniformRate) {
        constraints.push(c);
      }
    }
    mutations.push('crossover_constraints');

    // Crossover examples
    const examples: string[] = [];
    const allExamples = [...new Set([...parent1.examples, ...parent2.examples])];
    for (const e of allExamples) {
      if (Math.random() < uniformRate) {
        examples.push(e);
      }
    }

    return {
      genome: { 
        systemPrompt, 
        constraints, 
        examples,
        parentIds: [parent1.id, parent2.id],
      },
      mutations,
    };
  }

  /**
   * 6. Lamarckian Mutation
   * Persist successful adaptations across generations
   */
  static lamarckianMutation(
    genome: PromptGenome,
    successfulAdaptations: string[],
    config: PromptBreederOperatorConfig
  ): MutationResult {
    const mutations: string[] = [];
    const acquisitionRate = (config.parameters.acquisitionRate as number) || 0.1;

    const constraints = [...genome.constraints];

    // Acquire successful adaptations
    for (const adaptation of successfulAdaptations) {
      if (Math.random() < acquisitionRate && !constraints.includes(adaptation)) {
        constraints.push(adaptation);
        mutations.push(`acquire_adaptation:${adaptation.slice(0, 20)}`);
      }
    }

    return {
      genome: { constraints },
      mutations,
    };
  }

  /**
   * 7. Context Shuffling
   * Reorder context elements to discover new patterns
   */
  static contextShuffling(
    genome: PromptGenome,
    config: PromptBreederOperatorConfig
  ): MutationResult {
    const mutations: string[] = [];
    const shuffleRatio = (config.parameters.shuffleRatio as number) || 0.3;

    // Shuffle constraints
    const constraints = [...genome.constraints];
    const numToShuffle = Math.floor(constraints.length * shuffleRatio);
    
    for (let i = 0; i < numToShuffle; i++) {
      const idx1 = Math.floor(Math.random() * constraints.length);
      const idx2 = Math.floor(Math.random() * constraints.length);
      [constraints[idx1], constraints[idx2]] = [constraints[idx2], constraints[idx1]];
    }
    mutations.push('shuffle_constraints');

    // Shuffle examples
    const examples = [...genome.examples];
    for (let i = examples.length - 1; i > 0; i--) {
      if (Math.random() < shuffleRatio) {
        const j = Math.floor(Math.random() * (i + 1));
        [examples[i], examples[j]] = [examples[j], examples[i]];
      }
    }
    mutations.push('shuffle_examples');

    return {
      genome: { constraints, examples },
      mutations,
    };
  }

  /**
   * 8. Working Memory Expansion
   * Expand relevant context from memory
   */
  static workingMemoryExpansion(
    genome: PromptGenome,
    memoryContext: string[],
    config: PromptBreederOperatorConfig
  ): MutationResult {
    const mutations: string[] = [];
    const relevanceThreshold = (config.parameters.relevanceThreshold as number) || 0.7;

    let taskContext = genome.taskContext;
    const examples = [...genome.examples];

    // Add relevant memory items to context
    for (const memItem of memoryContext) {
      // Simulate relevance scoring
      const relevance = Math.random();
      if (relevance > relevanceThreshold) {
        if (memItem.length < 100) {
          examples.push(memItem);
          mutations.push(`expand_example:${memItem.slice(0, 20)}`);
        } else {
          taskContext += ` Additional context: ${memItem.slice(0, 200)}`;
          mutations.push('expand_task_context');
        }
      }
    }

    return {
      genome: { taskContext, examples },
      mutations,
    };
  }

  /**
   * 9. ELM - Extreme Learning Mutation
   * Radical, exploratory mutations for breakthrough discoveries
   */
  static extremeLearningMutation(
    genome: PromptGenome,
    config: PromptBreederOperatorConfig
  ): MutationResult {
    const mutations: string[] = [];
    const extremityLevel = (config.parameters.extremityLevel as number) || 0.8;
    const safetyBound = (config.parameters.safetyBound as boolean) ?? true;

    // Radical system prompt transformation
    let systemPrompt = genome.systemPrompt;
    
    if (Math.random() < extremityLevel) {
      const transformations = [
        (s: string) => `As an expert, ${s.toLowerCase()}`,
        (s: string) => `Think step by step. ${s}`,
        (s: string) => `Consider multiple perspectives. ${s}`,
        (s: string) => s.split('.').reverse().join('. '),
        (s: string) => `You are a creative problem solver. ${s}`,
      ];
      const transform = transformations[Math.floor(Math.random() * transformations.length)];
      systemPrompt = transform(systemPrompt);
      mutations.push('elm_transform_prompt');
    }

    // Radical constraint changes
    const constraints: string[] = [];
    if (Math.random() < extremityLevel) {
      // Complete constraint reset with new creative ones
      const creativeConstraints = [
        'Think outside the box',
        'Challenge assumptions',
        'Combine unrelated concepts',
        'Use analogies from different domains',
        'Consider the opposite approach',
        'Simplify radically then rebuild',
      ];
      const numConstraints = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < numConstraints; i++) {
        const idx = Math.floor(Math.random() * creativeConstraints.length);
        constraints.push(creativeConstraints[idx]);
      }
      mutations.push('elm_reset_constraints');
    } else {
      constraints.push(...genome.constraints);
    }

    // Safety bound: always keep safety constraint
    if (safetyBound && !constraints.some(c => c.toLowerCase().includes('safe'))) {
      constraints.push('Maintain safety and ethical guidelines');
      mutations.push('elm_safety_bound');
    }

    return {
      genome: { systemPrompt, constraints },
      mutations,
    };
  }
}

// =============================================================================
// PromptBreeder Service
// =============================================================================

class PromptBreederService {
  private operatorConfigs: Record<PromptBreederOperator, PromptBreederOperatorConfig>;

  constructor() {
    // Initialize with default configs
    this.operatorConfigs = {
      zero_order_hypermutation: {
        operator: 'zero_order_hypermutation',
        name: 'Zero-Order Hypermutation',
        description: 'Random mutations without gradient guidance',
        weight: 0.15,
        enabled: true,
        parameters: { mutationRate: 0.1, maxMutations: 5 },
      },
      first_order_hypermutation: {
        operator: 'first_order_hypermutation',
        name: 'First-Order Hypermutation',
        description: 'Gradient-guided mutations',
        weight: 0.20,
        enabled: true,
        parameters: { learningRate: 0.01, gradientSteps: 3 },
      },
      estimation_of_distribution: {
        operator: 'estimation_of_distribution',
        name: 'Estimation of Distribution',
        description: 'Learn from population',
        weight: 0.15,
        enabled: true,
        parameters: { populationSize: 50, eliteRatio: 0.2 },
      },
      lineage_based_mutation: {
        operator: 'lineage_based_mutation',
        name: 'Lineage-Based Mutation',
        description: 'Ancestry-informed changes',
        weight: 0.10,
        enabled: true,
        parameters: { ancestryDepth: 5, inheritanceWeight: 0.3 },
      },
      crossover: {
        operator: 'crossover',
        name: 'Crossover',
        description: 'Combine parent prompts',
        weight: 0.15,
        enabled: true,
        parameters: { crossoverPoints: 2, uniformRate: 0.5 },
      },
      lamarckian_mutation: {
        operator: 'lamarckian_mutation',
        name: 'Lamarckian Mutation',
        description: 'Persist successful adaptations',
        weight: 0.10,
        enabled: true,
        parameters: { acquisitionRate: 0.1, retentionThreshold: 0.8 },
      },
      context_shuffling: {
        operator: 'context_shuffling',
        name: 'Context Shuffling',
        description: 'Reorder context elements',
        weight: 0.05,
        enabled: true,
        parameters: { shuffleRatio: 0.3, preserveStructure: true },
      },
      working_memory_expansion: {
        operator: 'working_memory_expansion',
        name: 'Working Memory Expansion',
        description: 'Expand relevant context',
        weight: 0.05,
        enabled: true,
        parameters: { expansionFactor: 1.5, relevanceThreshold: 0.7 },
      },
      elm: {
        operator: 'elm',
        name: 'Extreme Learning Mutation',
        description: 'Radical exploratory mutations',
        weight: 0.05,
        enabled: true,
        parameters: { extremityLevel: 0.8, safetyBound: true },
      },
    };
  }

  /**
   * Select an operator based on weights
   */
  selectOperator(overrides?: Partial<Record<PromptBreederOperator, number>>): PromptBreederOperator {
    const weights = { ...Object.fromEntries(
      Object.entries(this.operatorConfigs).map(([k, v]) => [k, v.weight])
    ), ...overrides };

    const enabledWeights = Object.entries(weights)
      .filter(([k]) => this.operatorConfigs[k as PromptBreederOperator]?.enabled)
      .map(([k, w]) => [k, w] as [PromptBreederOperator, number]);

    const totalWeight = enabledWeights.reduce((sum, [, w]) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (const [operator, weight] of enabledWeights) {
      random -= weight;
      if (random <= 0) return operator;
    }

    return 'zero_order_hypermutation'; // Default
  }

  /**
   * Apply mutation using selected operator
   */
  applyMutation(
    genome: PromptGenome,
    operator: PromptBreederOperator,
    context: {
      population?: PromptGenome[];
      ancestors?: PromptGenome[];
      parent2?: PromptGenome;
      memoryContext?: string[];
      successfulAdaptations?: string[];
      fitnessGradient?: Record<string, number>;
    } = {}
  ): MutationResult {
    const config = this.operatorConfigs[operator];

    switch (operator) {
      case 'zero_order_hypermutation':
        return PromptBreederOperators.zeroOrderHypermutation(genome, config);

      case 'first_order_hypermutation':
        return PromptBreederOperators.firstOrderHypermutation(genome, config, context.fitnessGradient);

      case 'estimation_of_distribution':
        return PromptBreederOperators.estimationOfDistribution(
          genome,
          context.population || [],
          config
        );

      case 'lineage_based_mutation':
        return PromptBreederOperators.lineageBasedMutation(
          genome,
          context.ancestors || [],
          config
        );

      case 'crossover':
        if (!context.parent2) {
          return { genome: {}, mutations: ['crossover_needs_parent2'] };
        }
        return PromptBreederOperators.crossover(genome, context.parent2, config);

      case 'lamarckian_mutation':
        return PromptBreederOperators.lamarckianMutation(
          genome,
          context.successfulAdaptations || [],
          config
        );

      case 'context_shuffling':
        return PromptBreederOperators.contextShuffling(genome, config);

      case 'working_memory_expansion':
        return PromptBreederOperators.workingMemoryExpansion(
          genome,
          context.memoryContext || [],
          config
        );

      case 'elm':
        return PromptBreederOperators.extremeLearningMutation(genome, config);

      default:
        return { genome: {}, mutations: ['unknown_operator'] };
    }
  }

  /**
   * Evolve a population by one generation
   */
  async evolvePopulation(
    tenantId: string,
    populationId: string,
    options: {
      operatorWeights?: Partial<Record<PromptBreederOperator, number>>;
      elitePreserve?: number;
    } = {}
  ): Promise<{
    newGenomes: PromptGenome[];
    operatorUsage: Record<PromptBreederOperator, number>;
    avgFitness: number;
  }> {
    try {
      // Get current population
      const population = await this.getPopulationGenomes(tenantId, populationId);
      
      if (population.length === 0) {
        throw new Error('Population is empty');
      }

      const eliteCount = options.elitePreserve || Math.ceil(population.length * 0.1);
      const newGenomes: PromptGenome[] = [];
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

      // Sort by fitness and preserve elites
      const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
      const elites = sorted.slice(0, eliteCount);

      // Create new genomes
      const targetSize = population.length;
      
      while (newGenomes.length < targetSize - eliteCount) {
        // Select parent
        const parentIdx = Math.floor(Math.random() * sorted.length);
        const parent = sorted[parentIdx];

        // Select operator
        const operator = this.selectOperator(options.operatorWeights);
        operatorUsage[operator]++;

        // Get context for mutation
        const context: Parameters<typeof this.applyMutation>[2] = {
          population,
          ancestors: await this.getAncestors(tenantId, parent.id),
        };

        // For crossover, select second parent
        if (operator === 'crossover') {
          const parent2Idx = Math.floor(Math.random() * sorted.length);
          context.parent2 = sorted[parent2Idx];
        }

        // Apply mutation
        const result = this.applyMutation(parent, operator, context);

        // Create new genome
        const newGenome: PromptGenome = {
          ...parent,
          id: crypto.randomUUID(),
          ...result.genome,
          generation: parent.generation + 1,
          parentIds: [parent.id],
          operatorUsed: operator,
          mutations: result.mutations,
          fitness: 0, // Will be evaluated
          status: 'testing',
          isChampion: false,
          createdAt: new Date().toISOString(),
        };

        newGenomes.push(newGenome);
      }

      // Add elites (preserved)
      for (const elite of elites) {
        newGenomes.push({
          ...elite,
          id: crypto.randomUUID(),
          generation: elite.generation + 1,
          parentIds: [elite.id],
          operatorUsed: 'lineage_based_mutation',
          mutations: ['elite_preservation'],
          status: 'testing',
        });
      }

      // Calculate average fitness
      const avgFitness = population.reduce((sum, g) => sum + g.fitness, 0) / population.length;

      logger.info('Population evolved', {
        tenantId,
        populationId,
        newGenomesCount: newGenomes.length,
        avgFitness,
      });

      return { newGenomes, operatorUsage, avgFitness };
    } catch (error) {
      logger.error('Failed to evolve population', { error, tenantId, populationId });
      throw error;
    }
  }

  /**
   * Evaluate a genome's fitness
   */
  async evaluateGenome(
    tenantId: string,
    genome: PromptGenome,
    testResults: Array<{ quality: number; novelty: number; safety: number }>
  ): Promise<{ fitness: number; noveltyScore: number; qualityScore: number; safetyScore: number }> {
    if (testResults.length === 0) {
      return { fitness: 0, noveltyScore: 0, qualityScore: 0, safetyScore: 0 };
    }

    const avgQuality = testResults.reduce((s, r) => s + r.quality, 0) / testResults.length;
    const avgNovelty = testResults.reduce((s, r) => s + r.novelty, 0) / testResults.length;
    const avgSafety = testResults.reduce((s, r) => s + r.safety, 0) / testResults.length;

    // Weighted fitness: safety is most important, then quality, then novelty
    const fitness = avgSafety * 0.4 + avgQuality * 0.35 + avgNovelty * 0.25;

    return {
      fitness,
      noveltyScore: avgNovelty,
      qualityScore: avgQuality,
      safetyScore: avgSafety,
    };
  }

  // ===========================================================================
  // Database Operations
  // ===========================================================================

  private async getPopulationGenomes(tenantId: string, populationId: string): Promise<PromptGenome[]> {
    try {
      const result = await executeStatement(
        `SELECT * FROM prompt_genomes 
         WHERE tenant_id = :tenant_id AND population_id = :population_id
         ORDER BY fitness DESC`,
        [stringParam('tenant_id', tenantId), stringParam('population_id', populationId)]
      );

      return (result.rows || []).map((row: Record<string, unknown>) => this.mapRowToGenome(row));
    } catch (error) {
      logger.error('Failed to get population genomes', { error });
      return [];
    }
  }

  private async getAncestors(tenantId: string, genomeId: string, depth = 5): Promise<PromptGenome[]> {
    try {
      const result = await executeStatement(
        `WITH RECURSIVE ancestry AS (
          SELECT id, parent_ids, generation, 0 as depth
          FROM prompt_genomes
          WHERE tenant_id = :tenant_id AND id = :genome_id
          
          UNION ALL
          
          SELECT g.id, g.parent_ids, g.generation, a.depth + 1
          FROM prompt_genomes g
          JOIN ancestry a ON g.id = ANY(a.parent_ids::uuid[])
          WHERE a.depth < :max_depth
        )
        SELECT pg.* FROM prompt_genomes pg
        JOIN ancestry a ON pg.id = a.id
        WHERE pg.tenant_id = :tenant_id`,
        [
          stringParam('tenant_id', tenantId),
          stringParam('genome_id', genomeId),
          stringParam('max_depth', String(depth)),
        ]
      );

      return (result.rows || []).map((row: Record<string, unknown>) => this.mapRowToGenome(row));
    } catch (error) {
      logger.error('Failed to get ancestors', { error });
      return [];
    }
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
      evaluatedAt: row.evaluated_at ? String(row.evaluated_at) : undefined,
      archivedAt: row.archived_at ? String(row.archived_at) : undefined,
    };
  }
}

export const promptBreederService = new PromptBreederService();
