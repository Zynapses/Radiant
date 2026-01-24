/**
 * RADIANT v5.52.16 - Ideas API Client
 * 
 * Client-side functions for the Ideas/Brainstorming feature.
 * Capture, organize, and develop ideas from conversations.
 */

import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export interface Idea {
  id: string;
  title: string;
  description: string;
  category: string;
  status: 'captured' | 'developing' | 'ready' | 'implemented' | 'archived';
  priority: 'low' | 'medium' | 'high';
  sourceConversationId?: string;
  sourceMessageId?: string;
  tags: string[];
  attachments: IdeaAttachment[];
  relatedIdeas: string[];
  createdAt: string;
  updatedAt: string;
}

export interface IdeaAttachment {
  id: string;
  type: 'link' | 'note' | 'artifact' | 'image';
  title: string;
  content: string;
  url?: string;
}

export interface IdeaBoard {
  id: string;
  name: string;
  description?: string;
  ideaCount: number;
  columns: IdeaBoardColumn[];
  createdAt: string;
}

export interface IdeaBoardColumn {
  id: string;
  name: string;
  ideaIds: string[];
  color?: string;
}

// ============================================================================
// API Service
// ============================================================================

class IdeasService {
  /**
   * List all ideas
   */
  async listIdeas(status?: string, category?: string): Promise<Idea[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (category) params.append('category', category);
    const query = params.toString() ? `?${params.toString()}` : '';
    
    const response = await api.get<{ success: boolean; data: Idea[] }>(
      `/api/thinktank/ideas${query}`
    );
    return response.data || [];
  }

  /**
   * Get a specific idea
   */
  async getIdea(ideaId: string): Promise<Idea> {
    const response = await api.get<{ success: boolean; data: Idea }>(
      `/api/thinktank/ideas/${ideaId}`
    );
    return response.data;
  }

  /**
   * Create a new idea
   */
  async createIdea(idea: Partial<Idea>): Promise<Idea> {
    const response = await api.post<{ success: boolean; data: Idea }>(
      '/api/thinktank/ideas',
      idea
    );
    return response.data;
  }

  /**
   * Capture idea from conversation message
   */
  async captureFromMessage(
    conversationId: string,
    messageId: string,
    title?: string
  ): Promise<Idea> {
    const response = await api.post<{ success: boolean; data: Idea }>(
      '/api/thinktank/ideas/capture',
      { conversationId, messageId, title }
    );
    return response.data;
  }

  /**
   * Update an idea
   */
  async updateIdea(ideaId: string, updates: Partial<Idea>): Promise<Idea> {
    const response = await api.patch<{ success: boolean; data: Idea }>(
      `/api/thinktank/ideas/${ideaId}`,
      updates
    );
    return response.data;
  }

  /**
   * Delete an idea
   */
  async deleteIdea(ideaId: string): Promise<void> {
    await api.delete(`/api/thinktank/ideas/${ideaId}`);
  }

  /**
   * Link related ideas
   */
  async linkIdeas(ideaId: string, relatedIdeaId: string): Promise<void> {
    await api.post(`/api/thinktank/ideas/${ideaId}/link`, { relatedIdeaId });
  }

  /**
   * List idea boards
   */
  async listBoards(): Promise<IdeaBoard[]> {
    const response = await api.get<{ success: boolean; data: IdeaBoard[] }>(
      '/api/thinktank/ideas/boards'
    );
    return response.data || [];
  }

  /**
   * Create an idea board
   */
  async createBoard(name: string, description?: string): Promise<IdeaBoard> {
    const response = await api.post<{ success: boolean; data: IdeaBoard }>(
      '/api/thinktank/ideas/boards',
      { name, description }
    );
    return response.data;
  }

  /**
   * Develop idea with AI assistance
   */
  async developIdea(ideaId: string, instructions?: string): Promise<Idea> {
    const response = await api.post<{ success: boolean; data: Idea }>(
      `/api/thinktank/ideas/${ideaId}/develop`,
      { instructions }
    );
    return response.data;
  }
}

export const ideasService = new IdeasService();
