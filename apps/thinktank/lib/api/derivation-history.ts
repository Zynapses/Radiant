/**
 * RADIANT v5.52.16 - Derivation History API Client
 * 
 * Client-side functions for viewing AI reasoning provenance.
 * Shows how conclusions were derived with evidence chains.
 */

import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export interface DerivationNode {
  id: string;
  type: 'claim' | 'evidence' | 'inference' | 'source' | 'tool_call';
  content: string;
  confidence: number;
  sourceMessageId?: string;
  parentIds: string[];
  childIds: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface DerivationChain {
  id: string;
  conversationId: string;
  rootNodeId: string;
  nodes: DerivationNode[];
  totalConfidence: number;
  weakestLink?: {
    nodeId: string;
    confidence: number;
    reason: string;
  };
}

export interface ProvenanceReport {
  messageId: string;
  claims: Array<{
    claim: string;
    derivationChainId: string;
    confidence: number;
    evidenceCount: number;
  }>;
  overallReliability: 'high' | 'medium' | 'low';
  warnings: string[];
}

// ============================================================================
// API Service
// ============================================================================

class DerivationHistoryService {
  /**
   * Get derivation chains for a message
   */
  async getMessageDerivations(messageId: string): Promise<DerivationChain[]> {
    const response = await api.get<{ success: boolean; data: DerivationChain[] }>(
      `/api/thinktank/derivation-history/message/${messageId}`
    );
    return response.data || [];
  }

  /**
   * Get a specific derivation chain
   */
  async getDerivationChain(chainId: string): Promise<DerivationChain> {
    const response = await api.get<{ success: boolean; data: DerivationChain }>(
      `/api/thinktank/derivation-history/chain/${chainId}`
    );
    return response.data;
  }

  /**
   * Get provenance report for a message
   */
  async getProvenanceReport(messageId: string): Promise<ProvenanceReport> {
    const response = await api.get<{ success: boolean; data: ProvenanceReport }>(
      `/api/thinktank/derivation-history/provenance/${messageId}`
    );
    return response.data;
  }

  /**
   * Get all derivation chains for a conversation
   */
  async getConversationDerivations(conversationId: string): Promise<DerivationChain[]> {
    const response = await api.get<{ success: boolean; data: DerivationChain[] }>(
      `/api/thinktank/derivation-history/conversation/${conversationId}`
    );
    return response.data || [];
  }

  /**
   * Challenge a derivation node (request re-evaluation)
   */
  async challengeNode(nodeId: string, reason: string): Promise<DerivationNode> {
    const response = await api.post<{ success: boolean; data: DerivationNode }>(
      `/api/thinktank/derivation-history/challenge`,
      { nodeId, reason }
    );
    return response.data;
  }

  /**
   * Get evidence sources for a claim
   */
  async getEvidenceSources(claimNodeId: string): Promise<DerivationNode[]> {
    const response = await api.get<{ success: boolean; data: DerivationNode[] }>(
      `/api/thinktank/derivation-history/evidence/${claimNodeId}`
    );
    return response.data || [];
  }
}

export const derivationHistoryService = new DerivationHistoryService();
