// RADIANT v4.18.0 - Consciousness Graph Density Service
// Replaces fake IIT Phi with measurable graph connectivity metrics
// Since true Phi calculation is NP-hard, we measure semantic graph density instead

import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface GraphDensityMetrics {
  // Core metrics (replaces phi)
  semanticGraphDensity: number;      // 0-1, ratio of connections to possible connections
  conceptualConnectivity: number;    // Average connections per concept node
  informationIntegration: number;    // How interconnected the knowledge graph is
  causalDensity: number;             // Ratio of causal relationships to total relationships
  
  // Supporting metrics
  totalNodes: number;
  totalEdges: number;
  maxPossibleEdges: number;
  averagePathLength: number;
  clusteringCoefficient: number;     // Tendency for nodes to cluster together
  
  // Computed overall score (replaces phi)
  systemComplexityIndex: number;     // 0-1, composite score replacing phi
}

export interface ConceptNode {
  nodeId: string;
  label: string;
  type: 'entity' | 'concept' | 'memory' | 'goal' | 'belief';
  activation: number;
  connections: string[];
}

export interface ConceptEdge {
  sourceId: string;
  targetId: string;
  relationshipType: 'semantic' | 'causal' | 'temporal' | 'associative';
  strength: number;
}

// ============================================================================
// Consciousness Graph Service
// ============================================================================

class ConsciousnessGraphService {
  
  /**
   * Calculate graph density metrics for a tenant's knowledge graph
   * This replaces the fake phi calculation with real, measurable metrics
   */
  async calculateGraphDensity(tenantId: string): Promise<GraphDensityMetrics> {
    const [
      conceptNodes,
      conceptEdges,
      memoryNodes,
      causalRelations,
      knowledgeEntities,
      knowledgeRelationships,
    ] = await Promise.all([
      this.getConceptNodes(tenantId),
      this.getConceptEdges(tenantId),
      this.getMemoryNodes(tenantId),
      this.getCausalRelations(tenantId),
      this.getKnowledgeEntities(tenantId),
      this.getKnowledgeRelationships(tenantId),
    ]);
    
    // Combine all nodes
    const totalNodes = conceptNodes.length + memoryNodes + knowledgeEntities;
    const totalEdges = conceptEdges.length + causalRelations + knowledgeRelationships;
    
    // Calculate max possible edges (undirected graph)
    const maxPossibleEdges = totalNodes > 1 ? (totalNodes * (totalNodes - 1)) / 2 : 0;
    
    // Core metrics
    const semanticGraphDensity = maxPossibleEdges > 0 
      ? Math.min(1, totalEdges / maxPossibleEdges) 
      : 0;
    
    const conceptualConnectivity = totalNodes > 0 
      ? (totalEdges * 2) / totalNodes 
      : 0;
    
    // Information integration - how many unique clusters vs isolated nodes
    const integration = await this.calculateIntegration(tenantId);
    
    // Causal density - proportion of relationships that are causal
    const causalDensity = totalEdges > 0 
      ? causalRelations / totalEdges 
      : 0;
    
    // Estimate clustering coefficient
    const clusteringCoefficient = await this.estimateClusteringCoefficient(tenantId);
    
    // Average path length (estimated via sampling)
    const averagePathLength = await this.estimateAveragePathLength(tenantId, totalNodes);
    
    // Composite system complexity index (replaces phi)
    // Weighted combination of meaningful metrics
    const systemComplexityIndex = this.calculateComplexityIndex({
      density: semanticGraphDensity,
      connectivity: Math.min(1, conceptualConnectivity / 10), // Normalize to 0-1
      integration,
      causalDensity,
      clustering: clusteringCoefficient,
    });
    
    const metrics: GraphDensityMetrics = {
      semanticGraphDensity,
      conceptualConnectivity,
      informationIntegration: integration,
      causalDensity,
      totalNodes,
      totalEdges,
      maxPossibleEdges,
      averagePathLength,
      clusteringCoefficient,
      systemComplexityIndex,
    };
    
    // Store the metrics
    await this.storeMetrics(tenantId, metrics);
    
    logger.debug('Graph density calculated', { tenantId, metrics });
    
    return metrics;
  }
  
  /**
   * Get the current system complexity index (phi replacement)
   */
  async getSystemComplexityIndex(tenantId: string): Promise<number> {
    const result = await executeStatement(
      `SELECT system_complexity_index FROM integrated_information WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    if (result.rows.length === 0) {
      // Calculate if not exists
      const metrics = await this.calculateGraphDensity(tenantId);
      return metrics.systemComplexityIndex;
    }
    
    return Number((result.rows[0] as Record<string, unknown>).system_complexity_index || 0);
  }
  
  // ============================================================================
  // Data Collection Methods
  // ============================================================================
  
  private async getConceptNodes(tenantId: string): Promise<ConceptNode[]> {
    // Get nodes from conceptual_blends table
    const result = await executeStatement(
      `SELECT idea_id as node_id, title as label, 'concept' as type, 
              novelty_score as activation, source_concepts as connections
       FROM creative_ideas WHERE tenant_id = $1
       UNION ALL
       SELECT topic_id as node_id, topic as label, 'concept' as type,
              interest_level as activation, '[]'::text as connections
       FROM curiosity_topics WHERE tenant_id = $1
       LIMIT 500`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    return result.rows.map((row: Record<string, unknown>) => ({
      nodeId: String(row.node_id),
      label: String(row.label),
      type: 'concept' as const,
      activation: Number(row.activation || 0.5),
      connections: typeof row.connections === 'string' 
        ? JSON.parse(row.connections) 
        : [],
    }));
  }
  
  private async getConceptEdges(tenantId: string): Promise<ConceptEdge[]> {
    // Get edges from various relationship tables
    const result = await executeStatement(
      `SELECT source_id, target_id, relationship_type, strength
       FROM knowledge_relationships WHERE tenant_id = $1
       LIMIT 1000`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    return result.rows.map((row: Record<string, unknown>) => ({
      sourceId: String(row.source_id),
      targetId: String(row.target_id),
      relationshipType: (row.relationship_type as ConceptEdge['relationshipType']) || 'associative',
      strength: Number(row.strength || 0.5),
    }));
  }
  
  private async getMemoryNodes(tenantId: string): Promise<number> {
    const result = await executeStatement(
      `SELECT COUNT(*) as count FROM semantic_memories WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    return parseInt(String((result.rows[0] as Record<string, unknown>)?.count || 0), 10);
  }
  
  private async getCausalRelations(tenantId: string): Promise<number> {
    const result = await executeStatement(
      `SELECT COUNT(*) as count FROM knowledge_relationships 
       WHERE tenant_id = $1 AND relationship_type = 'causal'`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    return parseInt(String((result.rows[0] as Record<string, unknown>)?.count || 0), 10);
  }
  
  private async getKnowledgeEntities(tenantId: string): Promise<number> {
    const result = await executeStatement(
      `SELECT COUNT(*) as count FROM knowledge_entities WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    return parseInt(String((result.rows[0] as Record<string, unknown>)?.count || 0), 10);
  }
  
  private async getKnowledgeRelationships(tenantId: string): Promise<number> {
    const result = await executeStatement(
      `SELECT COUNT(*) as count FROM knowledge_relationships WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    return parseInt(String((result.rows[0] as Record<string, unknown>)?.count || 0), 10);
  }
  
  // ============================================================================
  // Graph Analysis Methods
  // ============================================================================
  
  private async calculateIntegration(tenantId: string): Promise<number> {
    // Measure how many distinct source modules contribute to the workspace
    const result = await executeStatement(
      `SELECT COUNT(DISTINCT source_type) as sources,
              COUNT(*) as total
       FROM (
         SELECT 'creative' as source_type FROM creative_ideas WHERE tenant_id = $1
         UNION ALL
         SELECT 'curiosity' FROM curiosity_topics WHERE tenant_id = $1
         UNION ALL
         SELECT 'memory' FROM semantic_memories WHERE tenant_id = $1
         UNION ALL
         SELECT 'knowledge' FROM knowledge_entities WHERE tenant_id = $1
         UNION ALL
         SELECT 'goal' FROM autonomous_goals WHERE tenant_id = $1
       ) sources`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    const row = result.rows[0] as Record<string, unknown>;
    const sources = parseInt(String(row?.sources || 0), 10);
    const maxSources = 5; // creative, curiosity, memory, knowledge, goal
    
    return sources / maxSources;
  }
  
  private async estimateClusteringCoefficient(tenantId: string): Promise<number> {
    // Estimate local clustering via triangle counting
    // For each node, what fraction of its neighbors are also connected?
    const result = await executeStatement(
      `WITH node_connections AS (
        SELECT source_id as node_id, target_id as neighbor_id FROM knowledge_relationships WHERE tenant_id = $1
        UNION
        SELECT target_id as node_id, source_id as neighbor_id FROM knowledge_relationships WHERE tenant_id = $1
      ),
      triangles AS (
        SELECT a.node_id, COUNT(*) as triangle_count
        FROM node_connections a
        JOIN node_connections b ON a.neighbor_id = b.node_id AND a.node_id != b.neighbor_id
        JOIN node_connections c ON b.neighbor_id = c.node_id AND c.neighbor_id = a.node_id
        GROUP BY a.node_id
        LIMIT 100
      )
      SELECT AVG(triangle_count) as avg_triangles,
             COUNT(*) as nodes_sampled
      FROM triangles`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    const row = result.rows[0] as Record<string, unknown>;
    const avgTriangles = parseFloat(String(row?.avg_triangles || 0));
    
    // Normalize to 0-1 (assuming max useful triangles per node is ~20)
    return Math.min(1, avgTriangles / 20);
  }
  
  private async estimateAveragePathLength(tenantId: string, totalNodes: number): Promise<number> {
    if (totalNodes < 2) return 0;
    
    // Sample-based BFS estimate (full calculation is expensive)
    // Use a simple heuristic based on density
    const edgeResult = await executeStatement(
      `SELECT COUNT(*) as edges FROM knowledge_relationships WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    const edges = parseInt(String((edgeResult.rows[0] as Record<string, unknown>)?.edges || 0), 10);
    const avgDegree = edges * 2 / totalNodes;
    
    // Estimate path length using small-world approximation
    // L ≈ ln(N) / ln(k) where N is nodes and k is average degree
    if (avgDegree > 1) {
      return Math.log(totalNodes) / Math.log(avgDegree);
    }
    return totalNodes; // Worst case: linear chain
  }
  
  private calculateComplexityIndex(metrics: {
    density: number;
    connectivity: number;
    integration: number;
    causalDensity: number;
    clustering: number;
  }): number {
    // Weighted combination of metrics
    // This is our "functional phi" - measures system complexity without NP-hard calculation
    const weights = {
      density: 0.15,       // Raw connectivity
      connectivity: 0.20,  // Average connections per node
      integration: 0.30,   // Cross-module integration (most important)
      causalDensity: 0.20, // Causal reasoning capability
      clustering: 0.15,    // Local structure
    };
    
    return (
      metrics.density * weights.density +
      metrics.connectivity * weights.connectivity +
      metrics.integration * weights.integration +
      metrics.causalDensity * weights.causalDensity +
      metrics.clustering * weights.clustering
    );
  }
  
  // ============================================================================
  // Persistence
  // ============================================================================
  
  private async storeMetrics(tenantId: string, metrics: GraphDensityMetrics): Promise<void> {
    await executeStatement(
      `INSERT INTO integrated_information (
        tenant_id, semantic_graph_density, conceptual_connectivity,
        information_integration, causal_density, system_complexity_index,
        total_nodes, total_edges, clustering_coefficient
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (tenant_id) DO UPDATE SET
        semantic_graph_density = $2, conceptual_connectivity = $3,
        information_integration = $4, causal_density = $5,
        system_complexity_index = $6, total_nodes = $7, total_edges = $8,
        clustering_coefficient = $9, updated_at = NOW()`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'density', value: { doubleValue: metrics.semanticGraphDensity } },
        { name: 'connectivity', value: { doubleValue: metrics.conceptualConnectivity } },
        { name: 'integration', value: { doubleValue: metrics.informationIntegration } },
        { name: 'causal', value: { doubleValue: metrics.causalDensity } },
        { name: 'complexity', value: { doubleValue: metrics.systemComplexityIndex } },
        { name: 'nodes', value: { longValue: metrics.totalNodes } },
        { name: 'edges', value: { longValue: metrics.totalEdges } },
        { name: 'clustering', value: { doubleValue: metrics.clusteringCoefficient } },
      ]
    );
  }
}

export const consciousnessGraphService = new ConsciousnessGraphService();
