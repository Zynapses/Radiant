/**
 * Cortex Intelligence Service
 * 
 * Provides knowledge density insights from Cortex to inform:
 * 1. Domain detection confidence boosting
 * 2. Orchestration mode selection
 * 3. Model selection optimization
 * 
 * This service answers: "How much does the enterprise knowledge graph know about this topic?"
 */

import { executeStatement, stringParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface KnowledgeDensity {
  tenantId: string;
  query: string;
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<string, number>;
  topDomains: DomainKnowledge[];
  keyEntities: string[];
  knowledgeDepth: 'none' | 'sparse' | 'moderate' | 'rich' | 'expert';
  confidenceBoost: number; // 0.0 to 0.3 boost for domain detection
  recommendedOrchestration: OrchestrationRecommendation;
  retrievalTimeMs: number;
}

export interface DomainKnowledge {
  domain: string;
  nodeCount: number;
  edgeCount: number;
  avgConfidence: number;
  recentActivity: boolean;
}

export interface OrchestrationRecommendation {
  mode: 'thinking' | 'extended_thinking' | 'research' | 'analysis';
  reason: string;
  useKnowledgeBase: boolean;
  suggestedMaxNodes: number;
}

export interface ModelRecommendation {
  preferFactualModels: boolean;
  preferReasoningModels: boolean;
  knowledgeContextSize: 'small' | 'medium' | 'large';
  reason: string;
}

export interface CortexInsights {
  knowledgeDensity: KnowledgeDensity;
  modelRecommendation: ModelRecommendation;
  domainBoosts: Map<string, number>;
}

// ============================================================================
// Knowledge Depth Thresholds
// ============================================================================

const DEPTH_THRESHOLDS = {
  none: 0,
  sparse: 5,
  moderate: 20,
  rich: 50,
  expert: 100,
};

// ============================================================================
// Cortex Intelligence Service
// ============================================================================

class CortexIntelligenceService {
  private insightsCache = new Map<string, { insights: CortexInsights; cachedAt: number }>();
  private CACHE_TTL = 30000; // 30 seconds

  /**
   * Get comprehensive Cortex insights for a query
   * Used by AGI Brain Planner for informed decision-making
   */
  async getInsights(tenantId: string, query: string): Promise<CortexInsights> {
    const cacheKey = `${tenantId}:${query.substring(0, 100)}`;
    const cached = this.insightsCache.get(cacheKey);
    
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL) {
      return cached.insights;
    }

    const startTime = Date.now();

    try {
      // Get knowledge density
      const knowledgeDensity = await this.measureKnowledgeDensity(tenantId, query);
      knowledgeDensity.retrievalTimeMs = Date.now() - startTime;

      // Generate model recommendation based on knowledge
      const modelRecommendation = this.generateModelRecommendation(knowledgeDensity);

      // Calculate domain-specific confidence boosts
      const domainBoosts = this.calculateDomainBoosts(knowledgeDensity);

      const insights: CortexInsights = {
        knowledgeDensity,
        modelRecommendation,
        domainBoosts,
      };

      this.insightsCache.set(cacheKey, { insights, cachedAt: Date.now() });
      return insights;

    } catch (error) {
      logger.warn('Failed to get Cortex insights, using defaults', { error: String(error) });
      return this.getDefaultInsights(tenantId, query);
    }
  }

  /**
   * Measure knowledge density for a query
   */
  private async measureKnowledgeDensity(tenantId: string, query: string): Promise<KnowledgeDensity> {
    // Extract key terms from query for searching
    const searchTerms = this.extractSearchTerms(query);
    
    // Count matching nodes
    const nodeResult = await executeStatement(
      `SELECT 
        node_type,
        COUNT(*) as count,
        AVG(confidence) as avg_confidence
       FROM cortex_graph_nodes
       WHERE tenant_id = $1
       AND status = 'active'
       AND (
         label ILIKE ANY($2::text[])
         OR properties::text ILIKE ANY($2::text[])
       )
       GROUP BY node_type`,
      [
        stringParam('tenantId', tenantId),
        stringParam('terms', `{${searchTerms.map(t => `%${t}%`).join(',')}}`),
      ]
    );

    // Count total nodes for context
    const totalResult = await executeStatement(
      `SELECT COUNT(*) as total FROM cortex_graph_nodes 
       WHERE tenant_id = $1 AND status = 'active'`,
      [stringParam('tenantId', tenantId)]
    );

    // Get edge count for matched nodes
    const edgeResult = await executeStatement(
      `SELECT COUNT(DISTINCT e.id) as edge_count
       FROM cortex_graph_edges e
       JOIN cortex_graph_nodes n ON (e.source_node_id = n.id OR e.target_node_id = n.id)
       WHERE n.tenant_id = $1
       AND n.status = 'active'
       AND (n.label ILIKE ANY($2::text[]) OR n.properties::text ILIKE ANY($2::text[]))`,
      [
        stringParam('tenantId', tenantId),
        stringParam('terms', `{${searchTerms.map(t => `%${t}%`).join(',')}}`),
      ]
    );

    // Get top entities
    const entitiesResult = await executeStatement(
      `SELECT label, confidence
       FROM cortex_graph_nodes
       WHERE tenant_id = $1
       AND status = 'active'
       AND (label ILIKE ANY($2::text[]) OR properties::text ILIKE ANY($2::text[]))
       ORDER BY confidence DESC, access_count DESC
       LIMIT 10`,
      [
        stringParam('tenantId', tenantId),
        stringParam('terms', `{${searchTerms.map(t => `%${t}%`).join(',')}}`),
      ]
    );

    // Get domain distribution
    const domainResult = await executeStatement(
      `SELECT 
        COALESCE(properties->>'domain', 'general') as domain,
        COUNT(*) as node_count,
        AVG(confidence) as avg_confidence
       FROM cortex_graph_nodes
       WHERE tenant_id = $1
       AND status = 'active'
       AND (label ILIKE ANY($2::text[]) OR properties::text ILIKE ANY($2::text[]))
       GROUP BY COALESCE(properties->>'domain', 'general')
       ORDER BY COUNT(*) DESC
       LIMIT 5`,
      [
        stringParam('tenantId', tenantId),
        stringParam('terms', `{${searchTerms.map(t => `%${t}%`).join(',')}}`),
      ]
    );

    // Calculate totals
    const nodesByType: Record<string, number> = {};
    let totalNodes = 0;
    
    for (const row of nodeResult.rows as Record<string, unknown>[]) {
      const nodeType = String(row.node_type);
      const count = Number(row.count) || 0;
      nodesByType[nodeType] = count;
      totalNodes += count;
    }

    const totalEdges = Number((edgeResult.rows[0] as Record<string, unknown>)?.edge_count) || 0;
    const keyEntities = (entitiesResult.rows as Record<string, unknown>[]).map(r => String(r.label));

    const topDomains: DomainKnowledge[] = (domainResult.rows as Record<string, unknown>[]).map(r => ({
      domain: String(r.domain),
      nodeCount: Number(r.node_count) || 0,
      edgeCount: 0, // Would need separate query
      avgConfidence: Number(r.avg_confidence) || 0.5,
      recentActivity: true, // Simplified
    }));

    // Determine knowledge depth
    const knowledgeDepth = this.determineKnowledgeDepth(totalNodes);
    const confidenceBoost = this.calculateConfidenceBoost(totalNodes, totalEdges);
    const recommendedOrchestration = this.recommendOrchestration(knowledgeDepth, totalNodes);

    return {
      tenantId,
      query,
      totalNodes,
      totalEdges,
      nodesByType,
      topDomains,
      keyEntities,
      knowledgeDepth,
      confidenceBoost,
      recommendedOrchestration,
      retrievalTimeMs: 0, // Set by caller
    };
  }

  /**
   * Extract search terms from a query
   */
  private extractSearchTerms(query: string): string[] {
    // Remove common words and extract meaningful terms
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
      'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
      'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
      'below', 'between', 'under', 'again', 'further', 'then', 'once',
      'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
      'am', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'how',
      'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
      'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
      'very', 'just', 'also', 'now', 'here', 'there', 'when', 'where', 'why',
    ]);

    const words = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    // Return unique terms, max 10
    return [...new Set(words)].slice(0, 10);
  }

  /**
   * Determine knowledge depth category
   */
  private determineKnowledgeDepth(nodeCount: number): KnowledgeDensity['knowledgeDepth'] {
    if (nodeCount >= DEPTH_THRESHOLDS.expert) return 'expert';
    if (nodeCount >= DEPTH_THRESHOLDS.rich) return 'rich';
    if (nodeCount >= DEPTH_THRESHOLDS.moderate) return 'moderate';
    if (nodeCount >= DEPTH_THRESHOLDS.sparse) return 'sparse';
    return 'none';
  }

  /**
   * Calculate confidence boost for domain detection
   */
  private calculateConfidenceBoost(nodeCount: number, edgeCount: number): number {
    // More nodes and edges = higher confidence boost
    // Max boost is 0.3 (30% confidence increase)
    const nodeBoost = Math.min(nodeCount / 200, 0.2); // Max 0.2 from nodes
    const edgeBoost = Math.min(edgeCount / 500, 0.1); // Max 0.1 from edges
    return Math.min(nodeBoost + edgeBoost, 0.3);
  }

  /**
   * Recommend orchestration mode based on knowledge
   */
  private recommendOrchestration(
    depth: KnowledgeDensity['knowledgeDepth'],
    nodeCount: number
  ): OrchestrationRecommendation {
    switch (depth) {
      case 'expert':
        return {
          mode: 'research',
          reason: 'Rich enterprise knowledge available - use research mode to synthesize',
          useKnowledgeBase: true,
          suggestedMaxNodes: 15,
        };
      case 'rich':
        return {
          mode: 'analysis',
          reason: 'Good knowledge coverage - analysis mode with knowledge retrieval',
          useKnowledgeBase: true,
          suggestedMaxNodes: 12,
        };
      case 'moderate':
        return {
          mode: 'thinking',
          reason: 'Moderate knowledge - standard thinking with some knowledge support',
          useKnowledgeBase: true,
          suggestedMaxNodes: 8,
        };
      case 'sparse':
        return {
          mode: 'extended_thinking',
          reason: 'Limited knowledge - rely more on model reasoning',
          useKnowledgeBase: true,
          suggestedMaxNodes: 5,
        };
      case 'none':
      default:
        return {
          mode: 'thinking',
          reason: 'No relevant enterprise knowledge - use general reasoning',
          useKnowledgeBase: false,
          suggestedMaxNodes: 0,
        };
    }
  }

  /**
   * Generate model recommendation based on knowledge density
   */
  private generateModelRecommendation(density: KnowledgeDensity): ModelRecommendation {
    const { knowledgeDepth, totalNodes, nodesByType } = density;

    // If we have lots of facts, prefer factual models
    const factCount = (nodesByType['fact'] || 0) + (nodesByType['entity'] || 0);
    const procedureCount = nodesByType['procedure'] || 0;

    if (knowledgeDepth === 'expert' || knowledgeDepth === 'rich') {
      return {
        preferFactualModels: factCount > procedureCount,
        preferReasoningModels: procedureCount > factCount,
        knowledgeContextSize: 'large',
        reason: `Rich knowledge (${totalNodes} nodes) - use model that excels at knowledge integration`,
      };
    }

    if (knowledgeDepth === 'moderate') {
      return {
        preferFactualModels: false,
        preferReasoningModels: true,
        knowledgeContextSize: 'medium',
        reason: 'Moderate knowledge - balance between retrieval and reasoning',
      };
    }

    return {
      preferFactualModels: false,
      preferReasoningModels: true,
      knowledgeContextSize: 'small',
      reason: 'Limited knowledge - rely primarily on model capabilities',
    };
  }

  /**
   * Calculate domain-specific confidence boosts
   */
  private calculateDomainBoosts(density: KnowledgeDensity): Map<string, number> {
    const boosts = new Map<string, number>();

    for (const domainKnowledge of density.topDomains) {
      // Map Cortex domains to taxonomy domains
      const taxonomyDomain = this.mapCortexDomainToTaxonomy(domainKnowledge.domain);
      if (taxonomyDomain) {
        // Calculate boost based on node count and confidence
        const boost = Math.min(
          (domainKnowledge.nodeCount / 50) * domainKnowledge.avgConfidence * 0.2,
          0.25
        );
        boosts.set(taxonomyDomain, boost);
      }
    }

    return boosts;
  }

  /**
   * Map Cortex domain labels to taxonomy domain IDs
   */
  private mapCortexDomainToTaxonomy(cortexDomain: string): string | null {
    const mapping: Record<string, string> = {
      'medical': 'healthcare',
      'healthcare': 'healthcare',
      'pharma': 'healthcare',
      'pharmaceutical': 'healthcare',
      'legal': 'legal',
      'law': 'legal',
      'finance': 'finance',
      'financial': 'finance',
      'banking': 'finance',
      'technology': 'technology',
      'tech': 'technology',
      'software': 'technology',
      'engineering': 'engineering',
      'scientific': 'scientific',
      'science': 'scientific',
      'research': 'scientific',
      'business': 'business',
      'marketing': 'business',
      'creative': 'creative',
      'education': 'education',
      'general': null,
    };

    return mapping[cortexDomain.toLowerCase()] || null;
  }

  /**
   * Get default insights when Cortex query fails
   */
  private getDefaultInsights(tenantId: string, query: string): CortexInsights {
    return {
      knowledgeDensity: {
        tenantId,
        query,
        totalNodes: 0,
        totalEdges: 0,
        nodesByType: {},
        topDomains: [],
        keyEntities: [],
        knowledgeDepth: 'none',
        confidenceBoost: 0,
        recommendedOrchestration: {
          mode: 'thinking',
          reason: 'No Cortex data available',
          useKnowledgeBase: false,
          suggestedMaxNodes: 0,
        },
        retrievalTimeMs: 0,
      },
      modelRecommendation: {
        preferFactualModels: false,
        preferReasoningModels: true,
        knowledgeContextSize: 'small',
        reason: 'Default - no Cortex insights available',
      },
      domainBoosts: new Map(),
    };
  }

  /**
   * Quick check if Cortex has any knowledge for a domain
   */
  async hasKnowledgeForDomain(tenantId: string, domainId: string): Promise<boolean> {
    try {
      const result = await executeStatement(
        `SELECT COUNT(*) as count FROM cortex_graph_nodes
         WHERE tenant_id = $1
         AND status = 'active'
         AND properties->>'domain' = $2
         LIMIT 1`,
        [stringParam('tenantId', tenantId), stringParam('domainId', domainId)]
      );
      return Number((result.rows[0] as Record<string, unknown>)?.count) > 0;
    } catch {
      return false;
    }
  }
}

export const cortexIntelligenceService = new CortexIntelligenceService();
