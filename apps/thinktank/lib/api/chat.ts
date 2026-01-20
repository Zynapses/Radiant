/**
 * Chat API Service
 * Handles conversation and message operations via Radiant API
 */

import { api } from './client';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  modelId?: string;
  metadata?: {
    tokensUsed?: number;
    latencyMs?: number;
    orchestrationMode?: string;
  };
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: string;
  isFavorite?: boolean;
  tags?: string[];
  domainMode?: string;
}

export interface ChatResponse {
  messageId: string;
  content: string;
  modelId: string;
  tokensUsed: number;
  latencyMs: number;
  orchestrationMode?: string;
}

export interface StreamChunk {
  type: 'content' | 'metadata' | 'done' | 'error';
  content?: string;
  metadata?: ChatResponse;
  error?: string;
}

class ChatService {
  async listConversations(): Promise<Conversation[]> {
    const response = await api.get<{ conversations: Conversation[] }>('/api/thinktank/conversations');
    return response.conversations || [];
  }

  async getConversation(conversationId: string): Promise<{ conversation: Conversation; messages: Message[] }> {
    return api.get<{ conversation: Conversation; messages: Message[] }>(
      `/api/thinktank/conversations/${conversationId}`
    );
  }

  async createConversation(title?: string): Promise<Conversation> {
    const response = await api.post<{ conversation: Conversation }>('/api/thinktank/conversations', {
      title: title || 'New Conversation',
    });
    return response.conversation;
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await api.delete(`/api/thinktank/conversations/${conversationId}`);
  }

  async sendMessage(
    conversationId: string,
    content: string,
    options?: {
      modelId?: string;
      orchestrationMode?: string;
    }
  ): Promise<ChatResponse> {
    return api.post<ChatResponse>(`/api/thinktank/conversations/${conversationId}/messages`, {
      content,
      ...options,
    });
  }

  async streamMessage(
    conversationId: string,
    content: string,
    onChunk: (chunk: StreamChunk) => void,
    options?: {
      modelId?: string;
      orchestrationMode?: string;
    }
  ): Promise<void> {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
    
    const response = await fetch(`${API_URL}/api/thinktank/conversations/${conversationId}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        content,
        ...options,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      onChunk({ type: 'error', error: error.message || 'Failed to send message' });
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onChunk({ type: 'error', error: 'Streaming not supported' });
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              onChunk({ type: 'done' });
            } else {
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  onChunk({ type: 'content', content: parsed.content });
                } else if (parsed.metadata) {
                  onChunk({ type: 'metadata', metadata: parsed.metadata });
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async rateMessage(
    conversationId: string,
    messageId: string,
    rating: 'positive' | 'negative',
    feedback?: string
  ): Promise<void> {
    await api.post(`/api/thinktank/conversations/${conversationId}/messages/${messageId}/rate`, {
      rating,
      feedback,
    });
  }

  async regenerateMessage(
    conversationId: string,
    messageId: string,
    options?: { modelId?: string }
  ): Promise<ChatResponse> {
    return api.post<ChatResponse>(
      `/api/thinktank/conversations/${conversationId}/messages/${messageId}/regenerate`,
      options
    );
  }
}

export const chatService = new ChatService();
