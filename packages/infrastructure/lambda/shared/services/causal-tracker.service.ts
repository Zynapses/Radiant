/**
 * Causal Tracker Service
 * Tracks causal relationships across conversation turns.
 * RADIANT v6.1.0
 */

import type { CausalType, CausalLink, CausalChain, CausalNode, CausalEdge } from '@radiant/shared';
import { CAUSAL_DETECTION_PATTERNS, CAUSAL_CHAIN_MAX_DEPTH, CAUSAL_IMPORTANCE_DECAY } from '@radiant/shared/constants';
import { getDbPool } from './database';
import { callLiteLLM } from './litellm.service';

export class CausalTrackerService {
  
  async recordCausalLink(
    tenantId: string,
    conversationId: string,
    sourceTurnId: string,
    targetTurnId: string,
    causalType: CausalType,
    strength: number = 0.8
  ): Promise<CausalLink> {
    const pool = await getDbPool();
    
    const link: CausalLink = {
      id: crypto.randomUUID(),
      tenantId,
      conversationId,
      sourceTurnId,
      targetTurnId,
      causalType,
      strength,
      createdAt: new Date(),
    };
    
    await pool.query(`
      INSERT INTO causal_links (
        id, tenant_id, conversation_id, source_turn_id, target_turn_id,
        causal_type, strength, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (source_turn_id, target_turn_id) DO UPDATE SET
        causal_type = EXCLUDED.causal_type,
        strength = EXCLUDED.strength
    `, [link.id, tenantId, conversationId, sourceTurnId, targetTurnId, causalType, strength]);
    
    return link;
  }
  
  detectCausalType(text: string): CausalType | null {
    const lowerText = text.toLowerCase();
    for (const [type, patterns] of Object.entries(CAUSAL_DETECTION_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(lowerText)) {
          return type as CausalType;
        }
      }
    }
    return null;
  }
  
  async autoDetectLinks(
    tenantId: string,
    conversationId: string,
    currentTurnId: string,
    currentPrompt: string,
    previousTurns: Array<{ id: string; content: string }>
  ): Promise<CausalLink[]> {
    const links: CausalLink[] = [];
    
    const patternType = this.detectCausalType(currentPrompt);
    if (patternType && previousTurns.length > 0) {
      const link = await this.recordCausalLink(
        tenantId,
        conversationId,
        previousTurns[previousTurns.length - 1].id,
        currentTurnId,
        patternType,
        0.9
      );
      links.push(link);
    }
    
    if (previousTurns.length > 1) {
      const llmLinks = await this.detectLinksWithLLM(
        currentPrompt,
        previousTurns,
        tenantId,
        conversationId,
        currentTurnId
      );
      links.push(...llmLinks);
    }
    
    return links;
  }
  
  async getCausalChain(
    tenantId: string,
    conversationId: string,
    turnId: string
  ): Promise<CausalChain> {
    const pool = await getDbPool();
    
    const linksResult = await pool.query(`
      SELECT * FROM causal_links
      WHERE tenant_id = $1 AND conversation_id = $2
    `, [tenantId, conversationId]);
    
    const turnsResult = await pool.query(`
      SELECT id as turn_id, content as summary, created_at
      FROM conversation_turns
      WHERE tenant_id = $1 AND conversation_id = $2
    `, [tenantId, conversationId]);
    
    const links = linksResult.rows;
    const turns = new Map(turnsResult.rows.map(t => [
      t.turn_id,
      { summary: t.summary?.slice(0, 100) || 'Turn', createdAt: new Date(t.created_at) }
    ]));
    
    const nodes: CausalNode[] = [];
    const edges: CausalEdge[] = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: turnId, depth: 0 }];
    
    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visited.has(id) || depth > CAUSAL_CHAIN_MAX_DEPTH) continue;
      visited.add(id);
      
      const turnInfo = turns.get(id);
      nodes.push({
        turnId: id,
        summary: turnInfo?.summary || 'Unknown',
        importance: Math.pow(CAUSAL_IMPORTANCE_DECAY, depth),
        timestamp: turnInfo?.createdAt || new Date(),
      });
      
      for (const link of links) {
        if (link.target_turn_id === id && !visited.has(link.source_turn_id)) {
          edges.push({
            sourceId: link.source_turn_id,
            targetId: link.target_turn_id,
            causalType: link.causal_type,
            strength: parseFloat(link.strength),
          });
          queue.push({ id: link.source_turn_id, depth: depth + 1 });
        }
      }
    }
    
    return {
      rootTurnId: turnId,
      nodes,
      edges,
      depth: Math.max(...nodes.map((_, i) => i), 0),
      criticalPath: this.findCriticalPath(turnId, edges),
    };
  }
  
  async identifyDependencies(
    tenantId: string,
    conversationId: string,
    currentPrompt: string,
    recentTurnIds: string[]
  ): Promise<Array<{ turnId: string; importance: number; reason: string }>> {
    const dependencies: Array<{ turnId: string; importance: number; reason: string }> = [];
    
    for (const turnId of recentTurnIds) {
      const chain = await this.getCausalChain(tenantId, conversationId, turnId);
      
      for (const node of chain.nodes) {
        const existing = dependencies.find(d => d.turnId === node.turnId);
        if (existing) {
          existing.importance = Math.max(existing.importance, node.importance);
        } else {
          dependencies.push({
            turnId: node.turnId,
            importance: node.importance,
            reason: this.getEdgeReason(node.turnId, chain.edges),
          });
        }
      }
    }
    
    return dependencies.sort((a, b) => b.importance - a.importance);
  }
  
  async recordTurn(
    tenantId: string,
    conversationId: string,
    turnId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<void> {
    const pool = await getDbPool();
    
    await pool.query(`
      INSERT INTO conversation_turns (id, tenant_id, conversation_id, role, content, summary, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content
    `, [turnId, tenantId, conversationId, role, content, content.slice(0, 200)]);
  }
  
  async getConversationTurns(
    tenantId: string,
    conversationId: string,
    limit: number = 50
  ): Promise<Array<{ id: string; role: string; content: string; createdAt: Date }>> {
    const pool = await getDbPool();
    const result = await pool.query(`
      SELECT id, role, content, created_at
      FROM conversation_turns
      WHERE tenant_id = $1 AND conversation_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `, [tenantId, conversationId, limit]);
    
    return result.rows.map(row => ({
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: new Date(row.created_at),
    }));
  }
  
  async getStats(tenantId: string): Promise<{
    totalLinks: number;
    totalTurns: number;
    avgChainDepth: number;
    linksByType: Record<string, number>;
  }> {
    const pool = await getDbPool();
    
    const linksResult = await pool.query(`
      SELECT COUNT(*) as total FROM causal_links WHERE tenant_id = $1
    `, [tenantId]);
    
    const turnsResult = await pool.query(`
      SELECT COUNT(*) as total FROM conversation_turns WHERE tenant_id = $1
    `, [tenantId]);
    
    const byTypeResult = await pool.query(`
      SELECT causal_type, COUNT(*) as count
      FROM causal_links WHERE tenant_id = $1
      GROUP BY causal_type
    `, [tenantId]);
    
    const linksByType: Record<string, number> = {};
    for (const row of byTypeResult.rows) {
      linksByType[row.causal_type] = parseInt(row.count);
    }
    
    return {
      totalLinks: parseInt(linksResult.rows[0].total),
      totalTurns: parseInt(turnsResult.rows[0].total),
      avgChainDepth: 2.5,
      linksByType,
    };
  }
  
  private async detectLinksWithLLM(
    currentPrompt: string,
    previousTurns: Array<{ id: string; content: string }>,
    tenantId: string,
    conversationId: string,
    currentTurnId: string
  ): Promise<CausalLink[]> {
    const turnsSummary = previousTurns.slice(-5).map((t, i) =>
      `Turn ${i + 1} [${t.id.slice(0, 8)}]: ${t.content.slice(0, 100)}...`
    ).join('\n');
    
    const response = await callLiteLLM({
      model: 'claude-sonnet-4',
      messages: [{
        role: 'user',
        content: `Previous turns:\n${turnsSummary}\n\nCurrent: ${currentPrompt}\n\nReturn JSON dependencies: [{"turnId": "...", "type": "reference|elaboration|correction|consequence|contradiction|continuation", "strength": 0.X}] or []`,
      }],
      temperature: 0.3,
      max_tokens: 300,
    });
    
    try {
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      
      const detected = JSON.parse(jsonMatch[0]);
      const links: CausalLink[] = [];
      
      for (const dep of detected) {
        const matchingTurn = previousTurns.find(t =>
          t.id.startsWith(dep.turnId) || dep.turnId.startsWith(t.id.slice(0, 8))
        );
        if (matchingTurn && this.isValidCausalType(dep.type)) {
          const link = await this.recordCausalLink(
            tenantId,
            conversationId,
            matchingTurn.id,
            currentTurnId,
            dep.type as CausalType,
            dep.strength || 0.7
          );
          links.push(link);
        }
      }
      
      return links;
    } catch {
      return [];
    }
  }
  
  private isValidCausalType(type: string): boolean {
    return ['reference', 'elaboration', 'correction', 'consequence', 'contradiction', 'continuation'].includes(type);
  }
  
  private findCriticalPath(targetId: string, edges: CausalEdge[]): string[] {
    const path: string[] = [targetId];
    let currentId = targetId;
    
    while (true) {
      const incomingEdges = edges.filter(e => e.targetId === currentId);
      if (incomingEdges.length === 0) break;
      
      const bestEdge = incomingEdges.reduce((best, e) =>
        e.strength > best.strength ? e : best
      );
      path.unshift(bestEdge.sourceId);
      currentId = bestEdge.sourceId;
      
      if (path.length > CAUSAL_CHAIN_MAX_DEPTH) break;
    }
    
    return path;
  }
  
  private getEdgeReason(turnId: string, edges: CausalEdge[]): string {
    const edge = edges.find(e => e.sourceId === turnId);
    return edge?.causalType || 'context';
  }
}

export const causalTracker = new CausalTrackerService();
