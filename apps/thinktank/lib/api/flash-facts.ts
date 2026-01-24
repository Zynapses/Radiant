/**
 * RADIANT v5.52.16 - Flash Facts API Client
 * 
 * Client-side functions for Flash Facts feature.
 * Quick fact extraction and verification from conversations.
 */

import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export interface FlashFact {
  id: string;
  conversationId: string;
  messageId: string;
  fact: string;
  category: 'definition' | 'statistic' | 'date' | 'name' | 'process' | 'claim' | 'other';
  confidence: number;
  source?: string;
  verified: boolean;
  verificationMethod?: 'ai_check' | 'user_confirmed' | 'citation_found';
  tags: string[];
  createdAt: string;
}

export interface FlashFactExtraction {
  conversationId: string;
  messageId?: string;
  content?: string;
}

export interface FlashFactCollection {
  id: string;
  name: string;
  description?: string;
  factCount: number;
  isPublic: boolean;
  createdAt: string;
}

// ============================================================================
// API Service
// ============================================================================

class FlashFactsService {
  /**
   * Extract facts from a conversation or message
   */
  async extractFacts(extraction: FlashFactExtraction): Promise<FlashFact[]> {
    const response = await api.post<{ success: boolean; data: FlashFact[] }>(
      '/api/thinktank/flash-facts/extract',
      extraction
    );
    return response.data || [];
  }

  /**
   * List facts for a conversation
   */
  async listFacts(conversationId: string): Promise<FlashFact[]> {
    const response = await api.get<{ success: boolean; data: FlashFact[] }>(
      `/api/thinktank/flash-facts?conversationId=${conversationId}`
    );
    return response.data || [];
  }

  /**
   * Get all user's facts
   */
  async getAllFacts(category?: string): Promise<FlashFact[]> {
    const params = category ? `?category=${category}` : '';
    const response = await api.get<{ success: boolean; data: FlashFact[] }>(
      `/api/thinktank/flash-facts${params}`
    );
    return response.data || [];
  }

  /**
   * Verify a fact
   */
  async verifyFact(factId: string): Promise<FlashFact> {
    const response = await api.post<{ success: boolean; data: FlashFact }>(
      `/api/thinktank/flash-facts/${factId}/verify`
    );
    return response.data;
  }

  /**
   * Mark fact as user-confirmed
   */
  async confirmFact(factId: string, confirmed: boolean): Promise<FlashFact> {
    const response = await api.post<{ success: boolean; data: FlashFact }>(
      `/api/thinktank/flash-facts/${factId}/confirm`,
      { confirmed }
    );
    return response.data;
  }

  /**
   * Delete a fact
   */
  async deleteFact(factId: string): Promise<void> {
    await api.delete(`/api/thinktank/flash-facts/${factId}`);
  }

  /**
   * Create a fact collection
   */
  async createCollection(name: string, description?: string): Promise<FlashFactCollection> {
    const response = await api.post<{ success: boolean; data: FlashFactCollection }>(
      '/api/thinktank/flash-facts/collections',
      { name, description }
    );
    return response.data;
  }

  /**
   * Add facts to a collection
   */
  async addToCollection(collectionId: string, factIds: string[]): Promise<void> {
    await api.post(`/api/thinktank/flash-facts/collections/${collectionId}/add`, { factIds });
  }

  /**
   * Search facts
   */
  async searchFacts(query: string): Promise<FlashFact[]> {
    const response = await api.get<{ success: boolean; data: FlashFact[] }>(
      `/api/thinktank/flash-facts/search?q=${encodeURIComponent(query)}`
    );
    return response.data || [];
  }
}

export const flashFactsService = new FlashFactsService();
