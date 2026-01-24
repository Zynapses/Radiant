/**
 * RADIANT v5.52.16 - Enhanced Collaboration API Client
 * 
 * Client-side functions for real-time collaboration features.
 * Enables shared conversations, co-editing, and team workspaces.
 */

import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export interface CollaborationSession {
  id: string;
  conversationId: string;
  name: string;
  status: 'active' | 'paused' | 'ended';
  participants: Participant[];
  settings: SessionSettings;
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  userId: string;
  displayName: string;
  avatar?: string;
  role: 'owner' | 'editor' | 'viewer';
  isOnline: boolean;
  cursor?: CursorPosition;
  joinedAt: string;
}

export interface CursorPosition {
  messageId?: string;
  position?: number;
  selection?: { start: number; end: number };
}

export interface SessionSettings {
  allowAnonymous: boolean;
  requireApproval: boolean;
  maxParticipants: number;
  allowVoice: boolean;
  allowVideo: boolean;
}

export interface CollaborationInvite {
  id: string;
  sessionId: string;
  inviteCode: string;
  expiresAt: string;
  maxUses?: number;
  usedCount: number;
}

export interface CollaborationMessage {
  id: string;
  sessionId: string;
  userId: string;
  type: 'chat' | 'system' | 'reaction';
  content: string;
  timestamp: string;
}

// ============================================================================
// API Service
// ============================================================================

class CollaborationService {
  /**
   * Create a collaboration session for a conversation
   */
  async createSession(
    conversationId: string,
    name: string,
    settings?: Partial<SessionSettings>
  ): Promise<CollaborationSession> {
    const response = await api.post<{ success: boolean; data: CollaborationSession }>(
      '/api/thinktank/enhanced-collaboration/sessions',
      { conversationId, name, settings }
    );
    return response.data;
  }

  /**
   * Get session details
   */
  async getSession(sessionId: string): Promise<CollaborationSession> {
    const response = await api.get<{ success: boolean; data: CollaborationSession }>(
      `/api/thinktank/enhanced-collaboration/sessions/${sessionId}`
    );
    return response.data;
  }

  /**
   * List user's collaboration sessions
   */
  async listSessions(): Promise<CollaborationSession[]> {
    const response = await api.get<{ success: boolean; data: CollaborationSession[] }>(
      '/api/thinktank/enhanced-collaboration/sessions'
    );
    return response.data || [];
  }

  /**
   * Join a session via invite code
   */
  async joinSession(inviteCode: string): Promise<CollaborationSession> {
    const response = await api.post<{ success: boolean; data: CollaborationSession }>(
      '/api/thinktank/enhanced-collaboration/join',
      { inviteCode }
    );
    return response.data;
  }

  /**
   * Leave a session
   */
  async leaveSession(sessionId: string): Promise<void> {
    await api.post(`/api/thinktank/enhanced-collaboration/sessions/${sessionId}/leave`);
  }

  /**
   * Create an invite link
   */
  async createInvite(
    sessionId: string,
    options?: { maxUses?: number; expiresInHours?: number }
  ): Promise<CollaborationInvite> {
    const response = await api.post<{ success: boolean; data: CollaborationInvite }>(
      `/api/thinktank/enhanced-collaboration/sessions/${sessionId}/invite`,
      options
    );
    return response.data;
  }

  /**
   * Update participant role
   */
  async updateParticipantRole(
    sessionId: string,
    userId: string,
    role: 'editor' | 'viewer'
  ): Promise<void> {
    await api.patch(
      `/api/thinktank/enhanced-collaboration/sessions/${sessionId}/participants/${userId}`,
      { role }
    );
  }

  /**
   * Remove participant from session
   */
  async removeParticipant(sessionId: string, userId: string): Promise<void> {
    await api.delete(
      `/api/thinktank/enhanced-collaboration/sessions/${sessionId}/participants/${userId}`
    );
  }

  /**
   * Update cursor position (for real-time presence)
   */
  async updateCursor(sessionId: string, cursor: CursorPosition): Promise<void> {
    await api.post(
      `/api/thinktank/enhanced-collaboration/sessions/${sessionId}/cursor`,
      cursor
    );
  }

  /**
   * Send a collaboration chat message
   */
  async sendMessage(sessionId: string, content: string): Promise<CollaborationMessage> {
    const response = await api.post<{ success: boolean; data: CollaborationMessage }>(
      `/api/thinktank/enhanced-collaboration/sessions/${sessionId}/messages`,
      { content }
    );
    return response.data;
  }

  /**
   * End a session
   */
  async endSession(sessionId: string): Promise<void> {
    await api.post(`/api/thinktank/enhanced-collaboration/sessions/${sessionId}/end`);
  }
}

export const collaborationService = new CollaborationService();
