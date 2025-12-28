// RADIANT v4.18.0 - Domain Taxonomy Service
// AI-powered domain detection and model matching based on hierarchical taxonomy

import { executeStatement } from '../db/client';
import { specialtyRankingService, SpecialtyCategory } from './specialty-ranking.service';

// ============================================================================
// Types (matching shared types)
// ============================================================================

export interface ProficiencyScores {
  reasoning_depth: number;
  mathematical_quantitative: number;
  code_generation: number;
  creative_generative: number;
  research_synthesis: number;
  factual_recall_precision: number;
  multi_step_problem_solving: number;
  domain_terminology_handling: number;
}

export type ProficiencyDimension = keyof ProficiencyScores;

export interface TerminologySignals {
  high_confidence: string[];
  medium_confidence: string[];
  exclusionary: string[];
}

export interface Subspecialty {
  subspecialty_id: string;
  subspecialty_name: string;
  description: string;
  parent_domain: string;
  detection_keywords: string[];
  terminology_signals: TerminologySignals;
  certifications: string[];
  subspecialty_proficiencies: ProficiencyScores;
}

export interface Domain {
  domain_id: string;
  domain_name: string;
  domain_icon: string;
  domain_description: string;
  parent_field: string;
  detection_keywords: string[];
  professional_associations: string[];
  key_journals: string[];
  reference_databases: string[];
  domain_proficiencies: ProficiencyScores;
  subspecialties: Subspecialty[];
}

export interface Field {
  field_id: string;
  field_name: string;
  field_icon: string;
  field_color: string;
  field_description: string;
  field_proficiencies: ProficiencyScores;
  domains: Domain[];
}

export interface DomainTaxonomy {
  metadata: {
    version: string;
    total_fields: number;
    total_domains: number;
    total_subspecialties: number;
  };
  fields: Field[];
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface DetectedSubspecialty {
  subspecialty: Subspecialty;
  confidence: number;
  confidence_level: ConfidenceLevel;
  matched_keywords: string[];
  matched_signals: string[];
}

export interface DetectedDomain {
  domain: Domain;
  confidence: number;
  confidence_level: ConfidenceLevel;
  matched_keywords: string[];
  detected_subspecialties: DetectedSubspecialty[];
}

export interface DetectedField {
  field: Field;
  confidence: number;
  confidence_level: ConfidenceLevel;
  detected_domains: DetectedDomain[];
}

export interface DomainDetectionResult {
  detected_fields: DetectedField[];
  primary_field?: Field;
  primary_domain?: Domain;
  primary_subspecialty?: Subspecialty;
  merged_proficiencies: ProficiencyScores;
  detection_method: 'auto' | 'manual' | 'hybrid';
  detection_confidence: number;
  processing_time_ms: number;
}

export interface ModelProficiencyMatch {
  model_id: string;
  provider: string;
  model_name: string;
  match_score: number;
  dimension_scores: Record<ProficiencyDimension, number>;
  strengths: ProficiencyDimension[];
  weaknesses: ProficiencyDimension[];
  recommended: boolean;
  ranking: number;
}

// ============================================================================
// Proficiency to Specialty Mapping
// ============================================================================

const PROFICIENCY_TO_SPECIALTY: Record<ProficiencyDimension, SpecialtyCategory> = {
  reasoning_depth: 'reasoning',
  mathematical_quantitative: 'math',
  code_generation: 'coding',
  creative_generative: 'creative',
  research_synthesis: 'research',
  factual_recall_precision: 'accuracy',
  multi_step_problem_solving: 'reasoning',
  domain_terminology_handling: 'instruction',
};

// ============================================================================
// Domain Taxonomy Service
// ============================================================================

export class DomainTaxonomyService {
  private taxonomyCache: DomainTaxonomy | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  async getTaxonomy(): Promise<DomainTaxonomy> {
    if (this.taxonomyCache && Date.now() - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return this.taxonomyCache;
    }

    const taxonomy = await this.loadTaxonomyFromDatabase();
    this.taxonomyCache = taxonomy;
    this.cacheTimestamp = Date.now();
    return taxonomy;
  }

  private async loadTaxonomyFromDatabase(): Promise<DomainTaxonomy> {
    const fieldsResult = await executeStatement(
      `SELECT * FROM domain_taxonomy_fields ORDER BY field_name`,
      []
    );

    const domainsResult = await executeStatement(
      `SELECT * FROM domain_taxonomy_domains ORDER BY domain_name`,
      []
    );

    const subspecialtiesResult = await executeStatement(
      `SELECT * FROM domain_taxonomy_subspecialties ORDER BY subspecialty_name`,
      []
    );

    const fields: Field[] = [];
    const domainsByField = new Map<string, Domain[]>();
    const subspecialtiesByDomain = new Map<string, Subspecialty[]>();

    // Parse subspecialties
    for (const row of subspecialtiesResult.rows) {
      const r = row as Record<string, unknown>;
      const subspecialty: Subspecialty = {
        subspecialty_id: String(r.subspecialty_id),
        subspecialty_name: String(r.subspecialty_name),
        description: String(r.description || ''),
        parent_domain: String(r.parent_domain),
        detection_keywords: this.parseJsonArray(r.detection_keywords),
        terminology_signals: this.parseJsonObject(r.terminology_signals) as TerminologySignals,
        certifications: this.parseJsonArray(r.certifications),
        subspecialty_proficiencies: this.parseJsonObject(r.subspecialty_proficiencies) as ProficiencyScores,
      };

      const existing = subspecialtiesByDomain.get(subspecialty.parent_domain) || [];
      existing.push(subspecialty);
      subspecialtiesByDomain.set(subspecialty.parent_domain, existing);
    }

    // Parse domains
    for (const row of domainsResult.rows) {
      const r = row as Record<string, unknown>;
      const domain: Domain = {
        domain_id: String(r.domain_id),
        domain_name: String(r.domain_name),
        domain_icon: String(r.domain_icon || '📁'),
        domain_description: String(r.domain_description || ''),
        parent_field: String(r.parent_field),
        detection_keywords: this.parseJsonArray(r.detection_keywords),
        professional_associations: this.parseJsonArray(r.professional_associations),
        key_journals: this.parseJsonArray(r.key_journals),
        reference_databases: this.parseJsonArray(r.reference_databases),
        domain_proficiencies: this.parseJsonObject(r.domain_proficiencies) as ProficiencyScores,
        subspecialties: subspecialtiesByDomain.get(String(r.domain_id)) || [],
      };

      const existing = domainsByField.get(domain.parent_field) || [];
      existing.push(domain);
      domainsByField.set(domain.parent_field, existing);
    }

    // Parse fields
    for (const row of fieldsResult.rows) {
      const r = row as Record<string, unknown>;
      const field: Field = {
        field_id: String(r.field_id),
        field_name: String(r.field_name),
        field_icon: String(r.field_icon || '📚'),
        field_color: String(r.field_color || '#6366f1'),
        field_description: String(r.field_description || ''),
        field_proficiencies: this.parseJsonObject(r.field_proficiencies) as ProficiencyScores,
        domains: domainsByField.get(String(r.field_id)) || [],
      };
      fields.push(field);
    }

    // Calculate totals
    let totalDomains = 0;
    let totalSubspecialties = 0;
    for (const field of fields) {
      totalDomains += field.domains.length;
      for (const domain of field.domains) {
        totalSubspecialties += domain.subspecialties.length;
      }
    }

    return {
      metadata: {
        version: '2.0.0',
        total_fields: fields.length,
        total_domains: totalDomains,
        total_subspecialties: totalSubspecialties,
      },
      fields,
    };
  }

  async detectDomain(
    prompt: string,
    options: {
      include_subspecialties?: boolean;
      min_confidence?: number;
      max_results?: number;
      manual_override?: {
        field_id?: string;
        domain_id?: string;
        subspecialty_id?: string;
      };
    } = {}
  ): Promise<DomainDetectionResult> {
    const startTime = Date.now();
    const taxonomy = await this.getTaxonomy();

    const {
      include_subspecialties = true,
      min_confidence = 0.3,
      max_results = 5,
      manual_override,
    } = options;

    // Handle manual override
    if (manual_override?.field_id || manual_override?.domain_id || manual_override?.subspecialty_id) {
      return this.handleManualOverride(taxonomy, manual_override, startTime);
    }

    // Tokenize and normalize prompt
    const tokens = this.tokenizePrompt(prompt);
    const detectedFields: DetectedField[] = [];

    // Score each field
    for (const field of taxonomy.fields) {
      const fieldResult = this.scoreField(field, tokens, include_subspecialties);
      if (fieldResult.confidence >= min_confidence) {
        detectedFields.push(fieldResult);
      }
    }

    // Sort by confidence
    detectedFields.sort((a, b) => b.confidence - a.confidence);
    const topFields = detectedFields.slice(0, max_results);

    // Determine primary selections
    const primaryField = topFields[0]?.field;
    const primaryDomain = topFields[0]?.detected_domains[0]?.domain;
    const primarySubspecialty = topFields[0]?.detected_domains[0]?.detected_subspecialties[0]?.subspecialty;

    // Merge proficiencies from detected hierarchy
    const mergedProficiencies = this.mergeProficiencies(
      primaryField,
      primaryDomain,
      primarySubspecialty
    );

    return {
      detected_fields: topFields,
      primary_field: primaryField,
      primary_domain: primaryDomain,
      primary_subspecialty: primarySubspecialty,
      merged_proficiencies: mergedProficiencies,
      detection_method: 'auto',
      detection_confidence: topFields[0]?.confidence || 0,
      processing_time_ms: Date.now() - startTime,
    };
  }

  private handleManualOverride(
    taxonomy: DomainTaxonomy,
    override: { field_id?: string; domain_id?: string; subspecialty_id?: string },
    startTime: number
  ): DomainDetectionResult {
    let primaryField: Field | undefined;
    let primaryDomain: Domain | undefined;
    let primarySubspecialty: Subspecialty | undefined;

    // Find by subspecialty first (most specific)
    if (override.subspecialty_id) {
      for (const field of taxonomy.fields) {
        for (const domain of field.domains) {
          const sub = domain.subspecialties.find(s => s.subspecialty_id === override.subspecialty_id);
          if (sub) {
            primaryField = field;
            primaryDomain = domain;
            primarySubspecialty = sub;
            break;
          }
        }
        if (primarySubspecialty) break;
      }
    }

    // Find by domain
    if (!primaryDomain && override.domain_id) {
      for (const field of taxonomy.fields) {
        const domain = field.domains.find(d => d.domain_id === override.domain_id);
        if (domain) {
          primaryField = field;
          primaryDomain = domain;
          break;
        }
      }
    }

    // Find by field
    if (!primaryField && override.field_id) {
      primaryField = taxonomy.fields.find(f => f.field_id === override.field_id);
      primaryDomain = primaryField?.domains[0];
    }

    const mergedProficiencies = this.mergeProficiencies(
      primaryField,
      primaryDomain,
      primarySubspecialty
    );

    return {
      detected_fields: primaryField ? [{
        field: primaryField,
        confidence: 1.0,
        confidence_level: 'high',
        detected_domains: primaryDomain ? [{
          domain: primaryDomain,
          confidence: 1.0,
          confidence_level: 'high',
          matched_keywords: [],
          detected_subspecialties: primarySubspecialty ? [{
            subspecialty: primarySubspecialty,
            confidence: 1.0,
            confidence_level: 'high',
            matched_keywords: [],
            matched_signals: [],
          }] : [],
        }] : [],
      }] : [],
      primary_field: primaryField,
      primary_domain: primaryDomain,
      primary_subspecialty: primarySubspecialty,
      merged_proficiencies: mergedProficiencies,
      detection_method: 'manual',
      detection_confidence: 1.0,
      processing_time_ms: Date.now() - startTime,
    };
  }

  private scoreField(
    field: Field,
    tokens: Set<string>,
    includeSubspecialties: boolean
  ): DetectedField {
    let totalScore = 0;
    const detectedDomains: DetectedDomain[] = [];

    for (const domain of field.domains) {
      const domainResult = this.scoreDomain(domain, tokens, includeSubspecialties);
      if (domainResult.confidence > 0) {
        detectedDomains.push(domainResult);
        totalScore += domainResult.confidence;
      }
    }

    detectedDomains.sort((a, b) => b.confidence - a.confidence);

    const confidence = detectedDomains.length > 0 
      ? Math.min(detectedDomains[0].confidence + (totalScore * 0.1), 1.0)
      : 0;

    return {
      field,
      confidence,
      confidence_level: this.getConfidenceLevel(confidence),
      detected_domains: detectedDomains.slice(0, 3),
    };
  }

  private scoreDomain(
    domain: Domain,
    tokens: Set<string>,
    includeSubspecialties: boolean
  ): DetectedDomain {
    const matchedKeywords: string[] = [];

    // Check domain keywords
    for (const keyword of domain.detection_keywords) {
      const normalizedKeyword = keyword.toLowerCase();
      if (tokens.has(normalizedKeyword)) {
        matchedKeywords.push(keyword);
      }
      // Check for multi-word keywords
      if (normalizedKeyword.includes(' ')) {
        const parts = normalizedKeyword.split(' ');
        if (parts.every(part => tokens.has(part))) {
          matchedKeywords.push(keyword);
        }
      }
    }

    const detectedSubspecialties: DetectedSubspecialty[] = [];

    if (includeSubspecialties) {
      for (const subspecialty of domain.subspecialties) {
        const subResult = this.scoreSubspecialty(subspecialty, tokens);
        if (subResult.confidence > 0) {
          detectedSubspecialties.push(subResult);
        }
      }
      detectedSubspecialties.sort((a, b) => b.confidence - a.confidence);
    }

    // Calculate confidence
    const keywordScore = Math.min(matchedKeywords.length * 0.15, 0.6);
    const subspecialtyBonus = detectedSubspecialties.length > 0 
      ? detectedSubspecialties[0].confidence * 0.4 
      : 0;
    const confidence = Math.min(keywordScore + subspecialtyBonus, 1.0);

    return {
      domain,
      confidence,
      confidence_level: this.getConfidenceLevel(confidence),
      matched_keywords: matchedKeywords,
      detected_subspecialties: detectedSubspecialties.slice(0, 3),
    };
  }

  private scoreSubspecialty(
    subspecialty: Subspecialty,
    tokens: Set<string>
  ): DetectedSubspecialty {
    const matchedKeywords: string[] = [];
    const matchedSignals: string[] = [];
    let hasExclusionary = false;

    // Check detection keywords
    for (const keyword of subspecialty.detection_keywords) {
      if (tokens.has(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
      }
    }

    // Check terminology signals
    const signals = subspecialty.terminology_signals;
    
    for (const signal of signals.high_confidence || []) {
      if (tokens.has(signal.toLowerCase())) {
        matchedSignals.push(signal);
      }
    }

    for (const signal of signals.medium_confidence || []) {
      if (tokens.has(signal.toLowerCase())) {
        matchedSignals.push(signal);
      }
    }

    for (const signal of signals.exclusionary || []) {
      if (tokens.has(signal.toLowerCase())) {
        hasExclusionary = true;
        break;
      }
    }

    // Calculate confidence
    let confidence = 0;
    if (!hasExclusionary) {
      const highConfidenceMatches = matchedSignals.filter(s => 
        (signals.high_confidence || []).map(h => h.toLowerCase()).includes(s.toLowerCase())
      ).length;
      const mediumConfidenceMatches = matchedSignals.length - highConfidenceMatches;

      confidence = 
        (matchedKeywords.length * 0.1) +
        (highConfidenceMatches * 0.25) +
        (mediumConfidenceMatches * 0.1);
      confidence = Math.min(confidence, 1.0);
    }

    return {
      subspecialty,
      confidence,
      confidence_level: this.getConfidenceLevel(confidence),
      matched_keywords: matchedKeywords,
      matched_signals: matchedSignals,
    };
  }

  mergeProficiencies(
    field?: Field,
    domain?: Domain,
    subspecialty?: Subspecialty
  ): ProficiencyScores {
    const defaultProficiencies: ProficiencyScores = {
      reasoning_depth: 5,
      mathematical_quantitative: 5,
      code_generation: 5,
      creative_generative: 5,
      research_synthesis: 5,
      factual_recall_precision: 5,
      multi_step_problem_solving: 5,
      domain_terminology_handling: 5,
    };

    if (!field && !domain && !subspecialty) {
      return defaultProficiencies;
    }

    // Weighted merge: subspecialty > domain > field
    // Weights: subspecialty=0.6, domain=0.3, field=0.1
    const merged: ProficiencyScores = { ...defaultProficiencies };
    const dimensions = Object.keys(defaultProficiencies) as ProficiencyDimension[];

    for (const dim of dimensions) {
      let total = 0;
      let weight = 0;

      if (subspecialty?.subspecialty_proficiencies) {
        total += subspecialty.subspecialty_proficiencies[dim] * 0.6;
        weight += 0.6;
      }

      if (domain?.domain_proficiencies) {
        total += domain.domain_proficiencies[dim] * 0.3;
        weight += 0.3;
      }

      if (field?.field_proficiencies) {
        total += field.field_proficiencies[dim] * 0.1;
        weight += 0.1;
      }

      if (weight > 0) {
        merged[dim] = Math.round((total / weight) * 10) / 10;
      }
    }

    return merged;
  }

  async getMatchingModels(
    proficiencies: ProficiencyScores,
    options: {
      max_models?: number;
      min_match_score?: number;
      include_self_hosted?: boolean;
    } = {}
  ): Promise<ModelProficiencyMatch[]> {
    const {
      max_models = 10,
      min_match_score = 50,
      include_self_hosted = true,
    } = options;

    // Get available models
    let sql = `
      SELECT model_id, provider, model_name, capabilities, is_available, is_hosted
      FROM model_metadata
      WHERE is_available = true
    `;
    if (!include_self_hosted) {
      sql += ` AND is_hosted = false`;
    }
    sql += ` LIMIT 100`;

    const modelsResult = await executeStatement(sql, []);
    const matches: ModelProficiencyMatch[] = [];

    for (const row of modelsResult.rows) {
      const r = row as Record<string, unknown>;
      const modelId = String(r.model_id);
      
      // Get specialty rankings for this model
      const dimensionScores: Record<ProficiencyDimension, number> = {} as Record<ProficiencyDimension, number>;
      let totalScore = 0;
      let matchedDimensions = 0;

      for (const [dim, specialty] of Object.entries(PROFICIENCY_TO_SPECIALTY)) {
        const requiredScore = proficiencies[dim as ProficiencyDimension];
        
        try {
          const rankings = await specialtyRankingService.getModelRankings(modelId);
          const ranking = rankings.find(r => r.specialty === specialty);
          
          if (ranking) {
            const modelScore = ranking.proficiencyScore / 10; // Convert 0-100 to 0-10
            dimensionScores[dim as ProficiencyDimension] = modelScore;
            
            // Calculate match (higher model score for higher requirements is good)
            const matchQuality = Math.min(modelScore / requiredScore, 1.0) * 100;
            totalScore += matchQuality;
            matchedDimensions++;
          } else {
            dimensionScores[dim as ProficiencyDimension] = 5; // Default
            totalScore += 50; // Neutral match
            matchedDimensions++;
          }
        } catch {
          dimensionScores[dim as ProficiencyDimension] = 5;
          totalScore += 50;
          matchedDimensions++;
        }
      }

      const matchScore = matchedDimensions > 0 ? totalScore / matchedDimensions : 50;
      
      if (matchScore >= min_match_score) {
        // Determine strengths and weaknesses
        const dimensions = Object.keys(proficiencies) as ProficiencyDimension[];
        const strengths: ProficiencyDimension[] = [];
        const weaknesses: ProficiencyDimension[] = [];

        for (const dim of dimensions) {
          const modelScore = dimensionScores[dim];
          const required = proficiencies[dim];
          if (modelScore >= required * 1.2) {
            strengths.push(dim);
          } else if (modelScore < required * 0.8) {
            weaknesses.push(dim);
          }
        }

        matches.push({
          model_id: modelId,
          provider: String(r.provider),
          model_name: String(r.model_name),
          match_score: Math.round(matchScore),
          dimension_scores: dimensionScores,
          strengths,
          weaknesses,
          recommended: matchScore >= 75 && weaknesses.length === 0,
          ranking: 0, // Will be set after sorting
        });
      }
    }

    // Sort by match score and assign rankings
    matches.sort((a, b) => b.match_score - a.match_score);
    matches.forEach((m, i) => { m.ranking = i + 1; });

    return matches.slice(0, max_models);
  }

  async recordFeedback(feedback: {
    tenant_id: string;
    user_id: string;
    prompt_hash: string;
    detected_domain_id?: string;
    detected_subspecialty_id?: string;
    actual_domain_id?: string;
    actual_subspecialty_id?: string;
    model_used: string;
    quality_score: number;
    domain_accuracy: boolean;
    proficiency_match_quality?: number;
    feedback_text?: string;
  }): Promise<string> {
    const feedbackId = `feedback-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').substring(0, 9)}`;

    await executeStatement(
      `INSERT INTO domain_taxonomy_feedback (
        feedback_id, tenant_id, user_id, prompt_hash,
        detected_domain_id, detected_subspecialty_id,
        actual_domain_id, actual_subspecialty_id,
        model_used, quality_score, domain_accuracy,
        proficiency_match_quality, feedback_text, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
      [
        { name: 'feedbackId', value: { stringValue: feedbackId } },
        { name: 'tenantId', value: { stringValue: feedback.tenant_id } },
        { name: 'userId', value: { stringValue: feedback.user_id } },
        { name: 'promptHash', value: { stringValue: feedback.prompt_hash } },
        { name: 'detectedDomainId', value: feedback.detected_domain_id ? { stringValue: feedback.detected_domain_id } : { isNull: true } },
        { name: 'detectedSubspecialtyId', value: feedback.detected_subspecialty_id ? { stringValue: feedback.detected_subspecialty_id } : { isNull: true } },
        { name: 'actualDomainId', value: feedback.actual_domain_id ? { stringValue: feedback.actual_domain_id } : { isNull: true } },
        { name: 'actualSubspecialtyId', value: feedback.actual_subspecialty_id ? { stringValue: feedback.actual_subspecialty_id } : { isNull: true } },
        { name: 'modelUsed', value: { stringValue: feedback.model_used } },
        { name: 'qualityScore', value: { longValue: feedback.quality_score } },
        { name: 'domainAccuracy', value: { booleanValue: feedback.domain_accuracy } },
        { name: 'proficiencyMatchQuality', value: feedback.proficiency_match_quality ? { longValue: feedback.proficiency_match_quality } : { isNull: true } },
        { name: 'feedbackText', value: feedback.feedback_text ? { stringValue: feedback.feedback_text } : { isNull: true } },
      ]
    );

    return feedbackId;
  }

  async getFeedbackSummary(domainId: string): Promise<{
    total_count: number;
    avg_quality_score: number;
    detection_accuracy_rate: number;
    avg_proficiency_match: number;
  }> {
    const result = await executeStatement(
      `SELECT 
        COUNT(*) as total_count,
        AVG(quality_score) as avg_quality_score,
        AVG(CASE WHEN domain_accuracy THEN 1.0 ELSE 0.0 END) as detection_accuracy_rate,
        AVG(proficiency_match_quality) as avg_proficiency_match
      FROM domain_taxonomy_feedback
      WHERE detected_domain_id = $1 OR actual_domain_id = $1`,
      [{ name: 'domainId', value: { stringValue: domainId } }]
    );

    const row = result.rows[0] as Record<string, unknown>;
    return {
      total_count: parseInt(String(row.total_count || 0), 10),
      avg_quality_score: parseFloat(String(row.avg_quality_score || 0)),
      detection_accuracy_rate: parseFloat(String(row.detection_accuracy_rate || 0)),
      avg_proficiency_match: parseFloat(String(row.avg_proficiency_match || 0)),
    };
  }

  // ============================================================================
  // Admin Methods
  // ============================================================================

  async updateTaxonomyField(
    fieldId: string,
    updates: Partial<Field>,
    adminUserId: string
  ): Promise<void> {
    const setClause: string[] = [];
    const params: Array<{ name: string; value: Record<string, unknown> }> = [
      { name: 'fieldId', value: { stringValue: fieldId } },
    ];

    if (updates.field_name) {
      setClause.push('field_name = $2');
      params.push({ name: 'fieldName', value: { stringValue: updates.field_name } });
    }
    if (updates.field_icon) {
      setClause.push(`field_icon = $${params.length + 1}`);
      params.push({ name: 'fieldIcon', value: { stringValue: updates.field_icon } });
    }
    if (updates.field_color) {
      setClause.push(`field_color = $${params.length + 1}`);
      params.push({ name: 'fieldColor', value: { stringValue: updates.field_color } });
    }
    if (updates.field_description) {
      setClause.push(`field_description = $${params.length + 1}`);
      params.push({ name: 'fieldDescription', value: { stringValue: updates.field_description } });
    }
    if (updates.field_proficiencies) {
      setClause.push(`field_proficiencies = $${params.length + 1}`);
      params.push({ name: 'fieldProficiencies', value: { stringValue: JSON.stringify(updates.field_proficiencies) } });
    }

    if (setClause.length === 0) return;

    setClause.push(`updated_at = NOW()`);
    setClause.push(`updated_by = $${params.length + 1}`);
    params.push({ name: 'updatedBy', value: { stringValue: adminUserId } });

    await executeStatement(
      `UPDATE domain_taxonomy_fields SET ${setClause.join(', ')} WHERE field_id = $1`,
      params
    );

    // Invalidate cache
    this.taxonomyCache = null;
  }

  async updateTaxonomyDomain(
    domainId: string,
    updates: Partial<Domain>,
    adminUserId: string
  ): Promise<void> {
    const sets: string[] = [];
    const params: Array<{ name: string; value: Record<string, unknown> }> = [
      { name: 'domainId', value: { stringValue: domainId } },
    ];

    if (updates.domain_name) {
      sets.push(`domain_name = $${params.length + 1}`);
      params.push({ name: 'domainName', value: { stringValue: updates.domain_name } });
    }
    if (updates.domain_icon) {
      sets.push(`domain_icon = $${params.length + 1}`);
      params.push({ name: 'domainIcon', value: { stringValue: updates.domain_icon } });
    }
    if (updates.domain_description) {
      sets.push(`domain_description = $${params.length + 1}`);
      params.push({ name: 'domainDescription', value: { stringValue: updates.domain_description } });
    }
    if (updates.detection_keywords) {
      sets.push(`detection_keywords = $${params.length + 1}`);
      params.push({ name: 'detectionKeywords', value: { stringValue: JSON.stringify(updates.detection_keywords) } });
    }
    if (updates.domain_proficiencies) {
      sets.push(`domain_proficiencies = $${params.length + 1}`);
      params.push({ name: 'domainProficiencies', value: { stringValue: JSON.stringify(updates.domain_proficiencies) } });
    }

    if (sets.length === 0) return;

    sets.push('updated_at = NOW()');
    sets.push(`updated_by = $${params.length + 1}`);
    params.push({ name: 'updatedBy', value: { stringValue: adminUserId } });

    await executeStatement(
      `UPDATE domain_taxonomy_domains SET ${sets.join(', ')} WHERE domain_id = $1`,
      params
    );

    this.taxonomyCache = null;
  }

  async listFields(): Promise<Array<{ field_id: string; field_name: string; field_icon: string; domain_count: number }>> {
    const result = await executeStatement(
      `SELECT f.field_id, f.field_name, f.field_icon,
              COUNT(d.domain_id) as domain_count
       FROM domain_taxonomy_fields f
       LEFT JOIN domain_taxonomy_domains d ON d.parent_field = f.field_id
       GROUP BY f.field_id, f.field_name, f.field_icon
       ORDER BY f.field_name`,
      []
    );

    return result.rows.map(row => {
      const r = row as Record<string, unknown>;
      return {
        field_id: String(r.field_id),
        field_name: String(r.field_name),
        field_icon: String(r.field_icon),
        domain_count: parseInt(String(r.domain_count || 0), 10),
      };
    });
  }

  async listDomainsByField(fieldId: string): Promise<Array<{ domain_id: string; domain_name: string; domain_icon: string; subspecialty_count: number }>> {
    const result = await executeStatement(
      `SELECT d.domain_id, d.domain_name, d.domain_icon,
              COUNT(s.subspecialty_id) as subspecialty_count
       FROM domain_taxonomy_domains d
       LEFT JOIN domain_taxonomy_subspecialties s ON s.parent_domain = d.domain_id
       WHERE d.parent_field = $1
       GROUP BY d.domain_id, d.domain_name, d.domain_icon
       ORDER BY d.domain_name`,
      [{ name: 'fieldId', value: { stringValue: fieldId } }]
    );

    return result.rows.map(row => {
      const r = row as Record<string, unknown>;
      return {
        domain_id: String(r.domain_id),
        domain_name: String(r.domain_name),
        domain_icon: String(r.domain_icon),
        subspecialty_count: parseInt(String(r.subspecialty_count || 0), 10),
      };
    });
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private tokenizePrompt(prompt: string): Set<string> {
    const normalized = prompt.toLowerCase();
    const words = normalized.match(/\b[\w'-]+\b/g) || [];
    return new Set(words);
  }

  private getConfidenceLevel(confidence: number): ConfidenceLevel {
    if (confidence >= 0.7) return 'high';
    if (confidence >= 0.4) return 'medium';
    return 'low';
  }

  private parseJsonArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    return [];
  }

  private parseJsonObject(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    }
    return {};
  }
}

export const domainTaxonomyService = new DomainTaxonomyService();
