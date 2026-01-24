/**
 * RADIANT v5.52.16 - Artifacts API Client
 * 
 * Client-side functions for AI-generated artifacts (code, documents, images, charts).
 */

import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export interface Artifact {
  id: string;
  conversationId: string;
  messageId: string;
  type: 'code' | 'document' | 'image' | 'chart' | 'diagram' | 'table' | 'file';
  title: string;
  content: string;
  language?: string; // For code artifacts
  mimeType?: string;
  metadata?: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactVersion {
  version: number;
  content: string;
  changedBy: 'ai' | 'user';
  changeReason?: string;
  createdAt: string;
}

export interface ArtifactExport {
  format: 'raw' | 'html' | 'pdf' | 'png' | 'svg';
  content: string;
  downloadUrl?: string;
}

// ============================================================================
// API Service
// ============================================================================

class ArtifactsService {
  /**
   * List artifacts for a conversation
   */
  async listArtifacts(conversationId: string): Promise<Artifact[]> {
    const response = await api.get<{ success: boolean; data: Artifact[] }>(
      `/api/thinktank/artifacts?conversationId=${conversationId}`
    );
    return response.data || [];
  }

  /**
   * Get all user's artifacts
   */
  async getAllArtifacts(type?: string): Promise<Artifact[]> {
    const params = type ? `?type=${type}` : '';
    const response = await api.get<{ success: boolean; data: Artifact[] }>(
      `/api/thinktank/artifacts${params}`
    );
    return response.data || [];
  }

  /**
   * Get a specific artifact
   */
  async getArtifact(artifactId: string): Promise<Artifact> {
    const response = await api.get<{ success: boolean; data: Artifact }>(
      `/api/thinktank/artifacts/${artifactId}`
    );
    return response.data;
  }

  /**
   * Update artifact content
   */
  async updateArtifact(artifactId: string, content: string, reason?: string): Promise<Artifact> {
    const response = await api.patch<{ success: boolean; data: Artifact }>(
      `/api/thinktank/artifacts/${artifactId}`,
      { content, changeReason: reason }
    );
    return response.data;
  }

  /**
   * Get artifact version history
   */
  async getVersionHistory(artifactId: string): Promise<ArtifactVersion[]> {
    const response = await api.get<{ success: boolean; data: ArtifactVersion[] }>(
      `/api/thinktank/artifacts/${artifactId}/versions`
    );
    return response.data || [];
  }

  /**
   * Restore a previous version
   */
  async restoreVersion(artifactId: string, version: number): Promise<Artifact> {
    const response = await api.post<{ success: boolean; data: Artifact }>(
      `/api/thinktank/artifacts/${artifactId}/restore`,
      { version }
    );
    return response.data;
  }

  /**
   * Export artifact in a specific format
   */
  async exportArtifact(artifactId: string, format: ArtifactExport['format']): Promise<ArtifactExport> {
    const response = await api.post<{ success: boolean; data: ArtifactExport }>(
      `/api/thinktank/artifacts/${artifactId}/export`,
      { format }
    );
    return response.data;
  }

  /**
   * Delete an artifact
   */
  async deleteArtifact(artifactId: string): Promise<void> {
    await api.delete(`/api/thinktank/artifacts/${artifactId}`);
  }

  /**
   * Fork artifact to new conversation
   */
  async forkArtifact(artifactId: string, targetConversationId: string): Promise<Artifact> {
    const response = await api.post<{ success: boolean; data: Artifact }>(
      `/api/thinktank/artifacts/${artifactId}/fork`,
      { targetConversationId }
    );
    return response.data;
  }

  /**
   * Request AI to refine artifact
   */
  async refineArtifact(artifactId: string, instructions: string): Promise<Artifact> {
    const response = await api.post<{ success: boolean; data: Artifact }>(
      `/api/thinktank/artifacts/${artifactId}/refine`,
      { instructions }
    );
    return response.data;
  }
}

export const artifactsService = new ArtifactsService();
