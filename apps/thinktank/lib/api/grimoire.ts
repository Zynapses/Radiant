/**
 * RADIANT v5.52.16 - Grimoire API Client
 * 
 * Client-side functions for the Grimoire (Spellbook) feature.
 * Grimoire stores reusable prompt templates ("spells") that users can invoke.
 */

import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export interface Spell {
  id: string;
  name: string;
  description: string;
  category: 'productivity' | 'creative' | 'analysis' | 'code' | 'research' | 'custom';
  prompt: string;
  variables: SpellVariable[];
  icon?: string;
  color?: string;
  isPublic: boolean;
  usageCount: number;
  rating?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SpellVariable {
  name: string;
  type: 'text' | 'number' | 'select' | 'multiselect';
  label: string;
  description?: string;
  defaultValue?: string;
  options?: string[]; // For select/multiselect
  required: boolean;
}

export interface SpellExecution {
  spellId: string;
  variables: Record<string, string | number>;
  conversationId?: string;
}

export interface SpellResult {
  executionId: string;
  renderedPrompt: string;
  response?: string;
}

// ============================================================================
// API Service
// ============================================================================

class GrimoireService {
  /**
   * List all spells available to the user
   */
  async listSpells(category?: string): Promise<Spell[]> {
    const params = category ? `?category=${category}` : '';
    const response = await api.get<{ success: boolean; data: Spell[] }>(
      `/api/thinktank/grimoire/spells${params}`
    );
    return response.data || [];
  }

  /**
   * Get a specific spell
   */
  async getSpell(spellId: string): Promise<Spell> {
    const response = await api.get<{ success: boolean; data: Spell }>(
      `/api/thinktank/grimoire/spells/${spellId}`
    );
    return response.data;
  }

  /**
   * Create a new spell
   */
  async createSpell(spell: Omit<Spell, 'id' | 'usageCount' | 'rating' | 'createdAt' | 'updatedAt'>): Promise<Spell> {
    const response = await api.post<{ success: boolean; data: Spell }>(
      '/api/thinktank/grimoire/spells',
      spell
    );
    return response.data;
  }

  /**
   * Update a spell
   */
  async updateSpell(spellId: string, updates: Partial<Spell>): Promise<Spell> {
    const response = await api.patch<{ success: boolean; data: Spell }>(
      `/api/thinktank/grimoire/spells/${spellId}`,
      updates
    );
    return response.data;
  }

  /**
   * Delete a spell
   */
  async deleteSpell(spellId: string): Promise<void> {
    await api.delete(`/api/thinktank/grimoire/spells/${spellId}`);
  }

  /**
   * Execute a spell (render and optionally send to AI)
   */
  async executeSpell(execution: SpellExecution): Promise<SpellResult> {
    const response = await api.post<{ success: boolean; data: SpellResult }>(
      '/api/thinktank/grimoire/execute',
      execution
    );
    return response.data;
  }

  /**
   * Get popular/featured spells
   */
  async getFeaturedSpells(): Promise<Spell[]> {
    const response = await api.get<{ success: boolean; data: Spell[] }>(
      '/api/thinktank/grimoire/featured'
    );
    return response.data || [];
  }

  /**
   * Rate a spell
   */
  async rateSpell(spellId: string, rating: number): Promise<void> {
    await api.post(`/api/thinktank/grimoire/spells/${spellId}/rate`, { rating });
  }
}

export const grimoireService = new GrimoireService();
