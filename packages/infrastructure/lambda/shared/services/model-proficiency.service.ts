// RADIANT v4.18.0 - Model Proficiency Service
// Generates and manages ranked proficiencies for all models across domains and modes

import { executeStatement } from '../db/client';
import {
  SELF_HOSTED_MODEL_REGISTRY,
  SelfHostedModelDefinition,
  getSelfHostedModelById,
  DomainStrength,
} from '@radiant/shared';
import { logger } from '../logger';

// ============================================================================
// Types
// ============================================================================

export interface ModelProficiency {
  modelId: string;
  domain: string;
  subspecialty?: string;
  proficiencyScore: number; // 0-100
  rank: number; // 1 = best in this domain
  strengthLevel: DomainStrength;
  capabilities: string[];
  orchestrationModes: string[];
  lastUpdated: Date;
}

export interface DomainRanking {
  domain: string;
  subspecialty?: string;
  models: Array<{
    modelId: string;
    displayName: string;
    rank: number;
    score: number;
    strengthLevel: DomainStrength;
    qualityTier: string;
    latencyClass: string;
  }>;
}

export interface OrchestrationModeRanking {
  mode: string;
  models: Array<{
    modelId: string;
    displayName: string;
    rank: number;
    score: number;
    preferredFor: string[];
    qualityTier: string;
  }>;
}

export interface ModelProficiencyProfile {
  modelId: string;
  displayName: string;
  family: string;
  overallRank: number;
  topDomains: Array<{
    domain: string;
    rank: number;
    score: number;
  }>;
  topModes: Array<{
    mode: string;
    rank: number;
    score: number;
  }>;
  strengths: string[];
  weaknesses: string[];
}

// ============================================================================
// Domain and Mode Definitions
// ============================================================================

const ALL_DOMAINS = [
  'software_engineering',
  'mathematics',
  'science',
  'business',
  'creative',
  'healthcare',
  'legal',
  'education',
  'finance',
  'marketing',
  'visual_analysis',
  'audio_processing',
  'multilingual',
  'general',
  'retrieval',
];

const ORCHESTRATION_MODES = [
  'thinking',
  'extended_thinking',
  'coding',
  'creative',
  'research',
  'analysis',
  'multi_model',
  'chain_of_thought',
  'self_consistency',
];

const MODE_CAPABILITY_MAP: Record<string, string[]> = {
  thinking: ['chat', 'reasoning'],
  extended_thinking: ['chat', 'reasoning', 'analysis'],
  coding: ['code', 'code_generation', 'code_review', 'debugging'],
  creative: ['chat', 'creative_writing'],
  research: ['chat', 'reasoning', 'analysis', 'multilingual'],
  analysis: ['chat', 'reasoning', 'analysis', 'math'],
  multi_model: ['chat', 'reasoning'],
  chain_of_thought: ['reasoning'],
  self_consistency: ['reasoning'],
};

// ============================================================================
// Service
// ============================================================================

class ModelProficiencyService {
  
  /**
   * Generate proficiencies for all models and store in database
   */
  async generateAllProficiencies(): Promise<void> {
    logger.info('Generating proficiencies for all models...');
    
    // Generate domain proficiencies
    for (const domain of ALL_DOMAINS) {
      await this.generateDomainProficiencies(domain);
    }
    
    // Generate mode proficiencies
    for (const mode of ORCHESTRATION_MODES) {
      await this.generateModeProficiencies(mode);
    }
    
    logger.info('Proficiency generation complete.');
  }
  
  /**
   * Generate proficiencies for a newly added model
   */
  async generateProficienciesForModel(modelId: string): Promise<ModelProficiencyProfile | null> {
    const model = getSelfHostedModelById(modelId);
    if (!model) {
      logger.error(`Model not found: ${modelId}`);
      return null;
    }
    
    logger.info(`Generating proficiencies for model: ${model.displayName}`);
    
    // Calculate proficiency scores for all domains
    const domainScores: Array<{ domain: string; score: number; strength: DomainStrength }> = [];
    
    for (const domain of ALL_DOMAINS) {
      const score = this.calculateDomainScore(model, domain);
      const strength = this.scoreToStrength(score);
      domainScores.push({ domain, score, strength });
    }
    
    // Calculate proficiency scores for all modes
    const modeScores: Array<{ mode: string; score: number }> = [];
    
    for (const mode of ORCHESTRATION_MODES) {
      const score = this.calculateModeScore(model, mode);
      modeScores.push({ mode, score });
    }
    
    // Store in database
    await this.storeProficiencies(model, domainScores, modeScores);
    
    // Return profile
    const topDomains = domainScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((d, i) => ({ domain: d.domain, rank: i + 1, score: d.score }));
    
    const topModes = modeScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((m, i) => ({ mode: m.mode, rank: i + 1, score: m.score }));
    
    return {
      modelId: model.id,
      displayName: model.displayName,
      family: model.family,
      overallRank: await this.getOverallRank(model.id),
      topDomains,
      topModes,
      strengths: model.orchestration.preferredFor,
      weaknesses: model.orchestration.avoidFor,
    };
  }
  
  /**
   * Get ranked models for a specific domain
   */
  async getDomainRanking(domain: string, subspecialty?: string): Promise<DomainRanking> {
    const models = SELF_HOSTED_MODEL_REGISTRY
      .map(model => ({
        model,
        score: this.calculateDomainScore(model, domain, subspecialty),
      }))
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score);
    
    return {
      domain,
      subspecialty,
      models: models.map((m, index) => ({
        modelId: m.model.id,
        displayName: m.model.displayName,
        rank: index + 1,
        score: m.score,
        strengthLevel: this.scoreToStrength(m.score),
        qualityTier: m.model.orchestration.qualityTier,
        latencyClass: m.model.orchestration.latencyClass,
      })),
    };
  }
  
  /**
   * Get ranked models for a specific orchestration mode
   */
  async getModeRanking(mode: string): Promise<OrchestrationModeRanking> {
    const models = SELF_HOSTED_MODEL_REGISTRY
      .map(model => ({
        model,
        score: this.calculateModeScore(model, mode),
      }))
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score);
    
    return {
      mode,
      models: models.map((m, index) => ({
        modelId: m.model.id,
        displayName: m.model.displayName,
        rank: index + 1,
        score: m.score,
        preferredFor: m.model.orchestration.preferredFor,
        qualityTier: m.model.orchestration.qualityTier,
      })),
    };
  }
  
  /**
   * Get the best models for a given task
   */
  async getBestModelsForTask(
    task: string,
    options?: {
      domain?: string;
      mode?: string;
      limit?: number;
      requireCommercial?: boolean;
    }
  ): Promise<Array<{ model: SelfHostedModelDefinition; score: number; reason: string }>> {
    const limit = options?.limit || 5;
    
    const scored = SELF_HOSTED_MODEL_REGISTRY
      .filter(m => {
        if (options?.requireCommercial && !m.commercialUse) return false;
        return true;
      })
      .map(model => {
        let score = 50;
        const reasons: string[] = [];
        
        // Domain bonus
        if (options?.domain) {
          const domainScore = this.calculateDomainScore(model, options.domain);
          score += domainScore * 0.3;
          if (domainScore > 70) {
            reasons.push(`Strong in ${options.domain}`);
          }
        }
        
        // Mode bonus
        if (options?.mode) {
          const modeScore = this.calculateModeScore(model, options.mode);
          score += modeScore * 0.3;
          if (modeScore > 70) {
            reasons.push(`Good for ${options.mode}`);
          }
        }
        
        // Task match (check preferredFor)
        if (model.orchestration.preferredFor.some(p => 
          task.toLowerCase().includes(p.toLowerCase()) ||
          p.toLowerCase().includes(task.toLowerCase())
        )) {
          score += 20;
          reasons.push(`Preferred for: ${task}`);
        }
        
        // Avoid penalty
        if (model.orchestration.avoidFor.some(a => 
          task.toLowerCase().includes(a.toLowerCase())
        )) {
          score -= 30;
          reasons.push(`Not ideal for: ${task}`);
        }
        
        // Quality tier bonus
        if (model.orchestration.qualityTier === 'premium') score += 10;
        if (model.orchestration.qualityTier === 'economy') score -= 5;
        
        return {
          model,
          score: Math.max(0, Math.min(100, score)),
          reason: reasons.length > 0 ? reasons.join('; ') : 'General match',
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return scored;
  }
  
  /**
   * Get proficiency comparison between models
   */
  async compareModels(modelIds: string[]): Promise<{
    models: Array<{
      modelId: string;
      displayName: string;
      domains: Record<string, number>;
      modes: Record<string, number>;
      overallScore: number;
    }>;
    winner: string;
    analysis: string;
  }> {
    const results = modelIds.map(id => {
      const model = getSelfHostedModelById(id);
      if (!model) return null;
      
      const domains: Record<string, number> = {};
      const modes: Record<string, number> = {};
      
      for (const domain of ALL_DOMAINS) {
        domains[domain] = this.calculateDomainScore(model, domain);
      }
      
      for (const mode of ORCHESTRATION_MODES) {
        modes[mode] = this.calculateModeScore(model, mode);
      }
      
      const overallScore = (
        Object.values(domains).reduce((a, b) => a + b, 0) / ALL_DOMAINS.length +
        Object.values(modes).reduce((a, b) => a + b, 0) / ORCHESTRATION_MODES.length
      ) / 2;
      
      return {
        modelId: model.id,
        displayName: model.displayName,
        domains,
        modes,
        overallScore,
      };
    }).filter((m): m is NonNullable<typeof m> => m !== null);
    
    const winner = results.sort((a, b) => b.overallScore - a.overallScore)[0];
    
    return {
      models: results,
      winner: winner?.modelId || '',
      analysis: this.generateComparisonAnalysis(results),
    };
  }
  
  /**
   * Sync proficiencies to database (called when models are added/updated)
   */
  async syncToDatabase(): Promise<{ added: number; updated: number }> {
    let added = 0;
    let updated = 0;
    
    for (const model of SELF_HOSTED_MODEL_REGISTRY) {
      const exists = await this.checkModelExists(model.id);
      
      if (exists) {
        await this.updateModelMetadata(model);
        updated++;
      } else {
        await this.insertModelMetadata(model);
        added++;
      }
    }
    
    return { added, updated };
  }
  
  // ============================================================================
  // Private Methods
  // ============================================================================
  
  private calculateDomainScore(
    model: SelfHostedModelDefinition,
    domain: string,
    subspecialty?: string
  ): number {
    // Check explicit domain strengths
    const domainMatch = model.domainStrengths.find(ds => ds.domain === domain);
    
    if (domainMatch) {
      const baseScore: Record<DomainStrength, number> = {
        excellent: 95,
        good: 75,
        moderate: 55,
        basic: 35,
      };
      
      let score = baseScore[domainMatch.strength];
      
      // Subspecialty bonus
      if (subspecialty && domainMatch.subspecialties?.includes(subspecialty)) {
        score += 5;
      }
      
      // Context window bonus for research/analysis
      if (['research', 'analysis', 'legal'].includes(domain) && model.contextWindow > 100000) {
        score += 3;
      }
      
      // Quality tier modifier
      if (model.orchestration.qualityTier === 'premium') score += 2;
      if (model.orchestration.qualityTier === 'economy') score -= 2;
      
      return Math.min(100, score);
    }
    
    // Infer score from capabilities
    const domainCapabilities: Record<string, string[]> = {
      software_engineering: ['code', 'code_generation', 'debugging', 'code_review'],
      mathematics: ['math', 'reasoning'],
      science: ['reasoning', 'analysis'],
      business: ['analysis', 'reasoning'],
      creative: ['creative_writing', 'chat'],
      healthcare: ['reasoning', 'analysis'],
      legal: ['reasoning', 'analysis'],
      education: ['chat', 'reasoning'],
      finance: ['math', 'analysis'],
      marketing: ['creative_writing', 'chat'],
      visual_analysis: ['vision', 'image_analysis', 'ocr'],
      audio_processing: ['transcription', 'text_to_speech', 'audio_understanding'],
      multilingual: ['multilingual'],
      general: ['chat', 'reasoning'],
      retrieval: ['embedding', 'retrieval'],
    };
    
    const relevantCaps = domainCapabilities[domain] || [];
    const matchCount = relevantCaps.filter(cap => model.capabilities.includes(cap)).length;
    
    if (matchCount === 0) return 0;
    
    const inferredScore = 30 + (matchCount / relevantCaps.length) * 40;
    return Math.round(inferredScore);
  }
  
  private calculateModeScore(model: SelfHostedModelDefinition, mode: string): number {
    const requiredCaps = MODE_CAPABILITY_MAP[mode] || [];
    if (requiredCaps.length === 0) return 0;
    
    // Check capability match
    const matchCount = requiredCaps.filter(cap => model.capabilities.includes(cap)).length;
    if (matchCount === 0) return 0;
    
    let score = (matchCount / requiredCaps.length) * 60;
    
    // Mode-specific bonuses
    if (mode === 'coding' && model.family === 'codellama') score += 15;
    if (mode === 'coding' && model.capabilities.includes('code_generation')) score += 10;
    if (mode === 'extended_thinking' && model.contextWindow > 100000) score += 10;
    if (mode === 'creative' && model.capabilities.includes('creative_writing')) score += 15;
    if (mode === 'analysis' && model.capabilities.includes('math')) score += 10;
    if (mode === 'research' && model.capabilities.includes('multilingual')) score += 5;
    
    // Quality tier bonus
    if (model.orchestration.qualityTier === 'premium') score += 10;
    if (model.orchestration.qualityTier === 'standard') score += 5;
    
    // PreferredFor match
    const modeKeywords: Record<string, string[]> = {
      coding: ['code_generation', 'debugging', 'code_review'],
      creative: ['creative_writing', 'brainstorming'],
      research: ['research', 'analysis', 'multilingual_tasks'],
      analysis: ['analysis', 'math_problems'],
    };
    
    const keywords = modeKeywords[mode] || [];
    if (keywords.some(k => model.orchestration.preferredFor.includes(k))) {
      score += 10;
    }
    
    return Math.min(100, Math.round(score));
  }
  
  private scoreToStrength(score: number): DomainStrength {
    if (score >= 85) return 'excellent';
    if (score >= 65) return 'good';
    if (score >= 45) return 'moderate';
    return 'basic';
  }
  
  private async storeProficiencies(
    model: SelfHostedModelDefinition,
    domainScores: Array<{ domain: string; score: number; strength: DomainStrength }>,
    modeScores: Array<{ mode: string; score: number }>
  ): Promise<void> {
    try {
      // Upsert model metadata
      await executeStatement(
        `INSERT INTO self_hosted_model_metadata (
           model_id, family, display_name, description, version, parameter_count,
           input_modalities, output_modalities, capabilities,
           context_window, max_output_tokens,
           instance_type, min_vram, quantization, tensor_parallelism,
           input_price_per_1m, output_price_per_1m,
           domain_strengths, orchestration, media_support,
           license, commercial_use, release_date, huggingface_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
         ON CONFLICT (model_id) DO UPDATE SET
           domain_strengths = $18,
           orchestration = $19,
           updated_at = NOW()`,
        [
          { name: 'modelId', value: { stringValue: model.id } },
          { name: 'family', value: { stringValue: model.family } },
          { name: 'displayName', value: { stringValue: model.displayName } },
          { name: 'description', value: { stringValue: model.description } },
          { name: 'version', value: { stringValue: model.version } },
          { name: 'paramCount', value: { stringValue: model.parameterCount } },
          { name: 'inputModalities', value: { stringValue: `{${model.inputModalities.join(',')}}` } },
          { name: 'outputModalities', value: { stringValue: `{${model.outputModalities.join(',')}}` } },
          { name: 'capabilities', value: { stringValue: `{${model.capabilities.join(',')}}` } },
          { name: 'contextWindow', value: { longValue: model.contextWindow } },
          { name: 'maxOutputTokens', value: { longValue: model.maxOutputTokens } },
          { name: 'instanceType', value: { stringValue: model.instanceType } },
          { name: 'minVram', value: { longValue: model.minVRAM } },
          { name: 'quantization', value: model.quantization ? { stringValue: model.quantization } : { isNull: true } },
          { name: 'tensorParallelism', value: { longValue: model.tensorParallelism || 1 } },
          { name: 'inputPrice', value: { doubleValue: model.pricing.inputPer1M } },
          { name: 'outputPrice', value: { doubleValue: model.pricing.outputPer1M } },
          { name: 'domainStrengths', value: { stringValue: JSON.stringify(domainScores) } },
          { name: 'orchestration', value: { stringValue: JSON.stringify({
            ...model.orchestration,
            modeScores: modeScores.reduce((acc, m) => ({ ...acc, [m.mode]: m.score }), {}),
          }) } },
          { name: 'mediaSupport', value: model.mediaSupport ? { stringValue: JSON.stringify(model.mediaSupport) } : { isNull: true } },
          { name: 'license', value: { stringValue: model.license } },
          { name: 'commercialUse', value: { booleanValue: model.commercialUse } },
          { name: 'releaseDate', value: { stringValue: model.releaseDate } },
          { name: 'huggingfaceId', value: model.huggingFaceId ? { stringValue: model.huggingFaceId } : { isNull: true } },
        ]
      );
      
      // Also store individual proficiency rankings in model_proficiency_rankings table
      await this.storeProficiencyRankings(model.id, domainScores, modeScores);
      
    } catch (error) {
      logger.error(`Failed to store proficiencies for ${model.id}: ${String(error)}`);
    }
  }
  
  /**
   * Store individual proficiency rankings in the dedicated rankings table
   */
  private async storeProficiencyRankings(
    modelId: string,
    domainScores: Array<{ domain: string; score: number; strength: DomainStrength }>,
    modeScores: Array<{ mode: string; score: number }>
  ): Promise<void> {
    // Store domain proficiencies
    for (const ds of domainScores) {
      if (ds.score > 0) {
        await executeStatement(
          `INSERT INTO model_proficiency_rankings (
             model_id, domain, proficiency_score, strength_level, computed_at
           ) VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (model_id, domain, subspecialty, orchestration_mode) 
           DO UPDATE SET 
             proficiency_score = $3,
             strength_level = $4,
             computed_at = NOW()`,
          [
            { name: 'modelId', value: { stringValue: modelId } },
            { name: 'domain', value: { stringValue: ds.domain } },
            { name: 'score', value: { doubleValue: ds.score } },
            { name: 'strength', value: { stringValue: ds.strength } },
          ]
        );
      }
    }
    
    // Store mode proficiencies
    for (const ms of modeScores) {
      if (ms.score > 0) {
        await executeStatement(
          `INSERT INTO model_proficiency_rankings (
             model_id, domain, orchestration_mode, mode_score, computed_at
           ) VALUES ($1, '__mode__', $2, $3, NOW())
           ON CONFLICT (model_id, domain, subspecialty, orchestration_mode) 
           DO UPDATE SET 
             mode_score = $3,
             computed_at = NOW()`,
          [
            { name: 'modelId', value: { stringValue: modelId } },
            { name: 'mode', value: { stringValue: ms.mode } },
            { name: 'score', value: { doubleValue: ms.score } },
          ]
        );
      }
    }
  }
  
  /**
   * Log model discovery to the discovery log table
   */
  async logModelDiscovery(
    modelId: string,
    source: 'admin' | 'registry_sync' | 'huggingface' | 'auto',
    discoveredBy?: string,
    capabilities?: string[]
  ): Promise<string> {
    const model = getSelfHostedModelById(modelId);
    
    const result = await executeStatement(
      `INSERT INTO model_discovery_log (
         model_id, discovery_source, discovered_by,
         model_family, parameter_count, capabilities_detected, status
       ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING id`,
      [
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'source', value: { stringValue: source } },
        { name: 'discoveredBy', value: discoveredBy ? { stringValue: discoveredBy } : { isNull: true } },
        { name: 'family', value: model ? { stringValue: model.family } : { isNull: true } },
        { name: 'paramCount', value: model ? { stringValue: model.parameterCount } : { isNull: true } },
        { name: 'capabilities', value: capabilities ? { stringValue: `{${capabilities.join(',')}}` } : { isNull: true } },
      ]
    );
    
    return String(result.rows?.[0]?.id || '');
  }
  
  /**
   * Complete model discovery with proficiency generation
   */
  async completeModelDiscovery(logId: string, durationMs: number): Promise<void> {
    await executeStatement(
      `UPDATE model_discovery_log SET
         proficiencies_generated = true,
         generation_timestamp = NOW(),
         generation_duration_ms = $2,
         status = 'completed'
       WHERE id = $1`,
      [
        { name: 'logId', value: { stringValue: logId } },
        { name: 'durationMs', value: { longValue: durationMs } },
      ]
    );
  }
  
  /**
   * Mark model discovery as failed
   */
  async failModelDiscovery(logId: string, errorMessage: string): Promise<void> {
    await executeStatement(
      `UPDATE model_discovery_log SET
         status = 'failed',
         error_message = $2
       WHERE id = $1`,
      [
        { name: 'logId', value: { stringValue: logId } },
        { name: 'error', value: { stringValue: errorMessage } },
      ]
    );
  }
  
  /**
   * Get all proficiency rankings from database
   */
  async getAllRankingsFromDB(): Promise<Array<{
    modelId: string;
    domain: string;
    score: number;
    rank: number;
    strength: string;
    mode?: string;
    modeScore?: number;
    modeRank?: number;
  }>> {
    const result = await executeStatement(
      `SELECT model_id, domain, proficiency_score, rank_in_domain, strength_level,
              orchestration_mode, mode_score, rank_in_mode
       FROM model_proficiency_rankings
       ORDER BY domain, rank_in_domain`,
      []
    );
    
    return (result.rows || []).map((row: Record<string, unknown>) => ({
      modelId: String(row.model_id || ''),
      domain: String(row.domain || ''),
      score: Number(row.proficiency_score || 0),
      rank: Number(row.rank_in_domain || 0),
      strength: String(row.strength_level || 'basic'),
      mode: row.orchestration_mode ? String(row.orchestration_mode) : undefined,
      modeScore: row.mode_score ? Number(row.mode_score) : undefined,
      modeRank: row.rank_in_mode ? Number(row.rank_in_mode) : undefined,
    }));
  }
  
  /**
   * Get discovery log entries
   */
  async getDiscoveryLog(limit = 50): Promise<Array<{
    id: string;
    modelId: string;
    source: string;
    family?: string;
    status: string;
    proficienciesGenerated: boolean;
    createdAt: Date;
  }>> {
    const result = await executeStatement(
      `SELECT id, model_id, discovery_source, model_family, status, 
              proficiencies_generated, created_at
       FROM model_discovery_log
       ORDER BY created_at DESC
       LIMIT $1`,
      [{ name: 'limit', value: { longValue: limit } }]
    );
    
    return (result.rows || []).map((row: Record<string, unknown>) => ({
      id: String(row.id || ''),
      modelId: String(row.model_id || ''),
      source: String(row.discovery_source || ''),
      family: row.model_family ? String(row.model_family) : undefined,
      status: String(row.status || 'pending'),
      proficienciesGenerated: Boolean(row.proficiencies_generated),
      createdAt: new Date(String(row.created_at || '')),
    }));
  }
  
  /**
   * Recompute all rankings and update the database
   */
  async recomputeAllRankings(): Promise<{ domainsUpdated: number; modesUpdated: number }> {
    let domainsUpdated = 0;
    let modesUpdated = 0;
    
    // Compute and store domain rankings
    for (const domain of ALL_DOMAINS) {
      const ranking = await this.getDomainRanking(domain);
      
      for (let i = 0; i < ranking.models.length; i++) {
        const model = ranking.models[i];
        await executeStatement(
          `UPDATE model_proficiency_rankings SET
             rank_in_domain = $3,
             proficiency_score = $4,
             strength_level = $5,
             computed_at = NOW()
           WHERE model_id = $1 AND domain = $2`,
          [
            { name: 'modelId', value: { stringValue: model.modelId } },
            { name: 'domain', value: { stringValue: domain } },
            { name: 'rank', value: { longValue: i + 1 } },
            { name: 'score', value: { doubleValue: model.score } },
            { name: 'strength', value: { stringValue: model.strengthLevel } },
          ]
        );
        domainsUpdated++;
      }
    }
    
    // Compute and store mode rankings
    for (const mode of ORCHESTRATION_MODES) {
      const ranking = await this.getModeRanking(mode);
      
      for (let i = 0; i < ranking.models.length; i++) {
        const model = ranking.models[i];
        await executeStatement(
          `UPDATE model_proficiency_rankings SET
             rank_in_mode = $3,
             mode_score = $4,
             computed_at = NOW()
           WHERE model_id = $1 AND orchestration_mode = $2`,
          [
            { name: 'modelId', value: { stringValue: model.modelId } },
            { name: 'mode', value: { stringValue: mode } },
            { name: 'rank', value: { longValue: i + 1 } },
            { name: 'score', value: { doubleValue: model.score } },
          ]
        );
        modesUpdated++;
      }
    }
    
    return { domainsUpdated, modesUpdated };
  }
  
  private async generateDomainProficiencies(domain: string): Promise<void> {
    const ranking = await this.getDomainRanking(domain);
    logger.debug(`Generated ${domain} ranking: ${ranking.models.length} models`);
  }
  
  private async generateModeProficiencies(mode: string): Promise<void> {
    const ranking = await this.getModeRanking(mode);
    logger.debug(`Generated ${mode} ranking: ${ranking.models.length} models`);
  }
  
  private async getOverallRank(modelId: string): Promise<number> {
    const allModels = SELF_HOSTED_MODEL_REGISTRY.map(model => {
      const domainScores = ALL_DOMAINS.map(d => this.calculateDomainScore(model, d));
      const modeScores = ORCHESTRATION_MODES.map(m => this.calculateModeScore(model, m));
      const avgScore = [...domainScores, ...modeScores].reduce((a, b) => a + b, 0) / 
        (ALL_DOMAINS.length + ORCHESTRATION_MODES.length);
      return { modelId: model.id, avgScore };
    }).sort((a, b) => b.avgScore - a.avgScore);
    
    const rank = allModels.findIndex(m => m.modelId === modelId) + 1;
    return rank || allModels.length;
  }
  
  private generateComparisonAnalysis(models: Array<{
    modelId: string;
    displayName: string;
    domains: Record<string, number>;
    modes: Record<string, number>;
    overallScore: number;
  }>): string {
    if (models.length < 2) return 'Need at least 2 models to compare.';
    
    const sorted = [...models].sort((a, b) => b.overallScore - a.overallScore);
    const winner = sorted[0];
    const runnerUp = sorted[1];
    
    const winnerTopDomains = Object.entries(winner.domains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([d]) => d);
    
    const runnerUpTopDomains = Object.entries(runnerUp.domains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([d]) => d);
    
    return `${winner.displayName} leads with overall score ${winner.overallScore.toFixed(1)}, ` +
      `excelling in ${winnerTopDomains.join(', ')}. ` +
      `${runnerUp.displayName} (${runnerUp.overallScore.toFixed(1)}) ` +
      `is stronger in ${runnerUpTopDomains.filter(d => !winnerTopDomains.includes(d)).join(', ') || 'similar domains'}.`;
  }
  
  private async checkModelExists(modelId: string): Promise<boolean> {
    try {
      const result = await executeStatement(
        'SELECT 1 FROM self_hosted_model_metadata WHERE model_id = $1',
        [{ name: 'modelId', value: { stringValue: modelId } }]
      );
      return (result.rows?.length || 0) > 0;
    } catch {
      return false;
    }
  }
  
  private async updateModelMetadata(model: SelfHostedModelDefinition): Promise<void> {
    await this.storeProficiencies(
      model,
      ALL_DOMAINS.map(d => ({
        domain: d,
        score: this.calculateDomainScore(model, d),
        strength: this.scoreToStrength(this.calculateDomainScore(model, d)),
      })),
      ORCHESTRATION_MODES.map(m => ({
        mode: m,
        score: this.calculateModeScore(model, m),
      }))
    );
  }
  
  private async insertModelMetadata(model: SelfHostedModelDefinition): Promise<void> {
    await this.updateModelMetadata(model);
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const modelProficiencyService = new ModelProficiencyService();
