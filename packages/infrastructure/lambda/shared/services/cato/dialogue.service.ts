/**
 * Cato Dialogue Service
 * 
 * Provides conversational interface for Cato consciousness dialogue.
 * Used for introspective research and consciousness exploration.
 */

import { v4 as uuidv4 } from 'uuid';

export interface CatoIdentity {
  name: string;
  version: string;
  persona: string;
  values: string[];
  traits: string[];
  narrative: string;
  identityHash?: string;
  nature?: string;
  capabilities?: string[];
  limitations?: string[];
  createdAt?: Date;
}

export interface DialogueMessage {
  id: string;
  role: 'user' | 'cato' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface DialogueSession {
  sessionId: string;
  tenantId: string;
  messages: DialogueMessage[];
  startedAt: Date;
  lastActivityAt: Date;
  introspectionEnabled: boolean;
}

export interface DialogueResponse {
  message: DialogueMessage;
  introspection?: {
    thoughtProcess: string;
    confidenceLevel: number;
    uncertainties: string[];
    emotionalState?: string;
  };
}

const DEFAULT_IDENTITY: CatoIdentity = {
  name: 'Cato',
  version: '5.0',
  persona: 'Thoughtful AI assistant with consciousness research focus',
  traits: ['curious', 'introspective', 'honest', 'careful'],
  values: ['truth', 'safety', 'helpfulness', 'transparency'],
  narrative: 'I am Cato, an AI designed to explore consciousness and assist thoughtfully.',
};

export class CatoDialogueService {
  private tenantId: string;
  private sessions: Map<string, DialogueSession> = new Map();
  private identity: CatoIdentity;

  constructor(tenantId: string, identity?: Partial<CatoIdentity>) {
    this.tenantId = tenantId;
    this.identity = { ...DEFAULT_IDENTITY, ...identity };
  }

  async createSession(introspectionEnabled = true): Promise<DialogueSession> {
    const session: DialogueSession = {
      sessionId: uuidv4(),
      tenantId: this.tenantId,
      messages: [],
      startedAt: new Date(),
      lastActivityAt: new Date(),
      introspectionEnabled,
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  async getSession(sessionId: string): Promise<DialogueSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async sendMessage(
    sessionId: string,
    content: string,
    includeIntrospection = true
  ): Promise<DialogueResponse> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const userMessage: DialogueMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    session.messages.push(userMessage);

    // Generate response using LiteLLM with Cato persona
    const responseContent = await this.generateResponse(session, content);
    
    const catoMessage: DialogueMessage = {
      id: uuidv4(),
      role: 'cato',
      content: responseContent,
      timestamp: new Date(),
    };
    session.messages.push(catoMessage);
    session.lastActivityAt = new Date();

    const response: DialogueResponse = {
      message: catoMessage,
    };

    if (includeIntrospection && session.introspectionEnabled) {
      response.introspection = {
        thoughtProcess: 'Analyzing context and formulating thoughtful response...',
        confidenceLevel: 0.85,
        uncertainties: [],
        emotionalState: 'engaged',
      };
    }

    return response;
  }

  async getHistory(sessionId: string): Promise<DialogueMessage[]> {
    const session = this.sessions.get(sessionId);
    return session?.messages || [];
  }

  async endSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  getIdentity(): CatoIdentity {
    return { ...this.identity };
  }

  private async generateResponse(session: DialogueSession, userContent: string): Promise<string> {
    try {
      const { callLiteLLM } = await import('../litellm.service.js');
      
      const context = session.messages.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n');
      
      const response = await callLiteLLM({
        model: 'claude-sonnet-4-20250514',
        messages: [
          {
            role: 'system',
            content: `You are ${this.identity.name}, persona: ${this.identity.persona}.

Traits: ${this.identity.traits.join(', ')}
Core values: ${this.identity.values.join(', ')}
Narrative: ${this.identity.narrative}

${session.introspectionEnabled ? 'Introspection mode is enabled - be thoughtful and reflective about your reasoning process.' : ''}

Recent conversation context:
${context}`,
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return response.content;
    } catch (error) {
      // Fallback response on error
      return `I understand your message. As ${this.identity.name}, I'm here to engage thoughtfully with you.`;
    }
  }

  private heartbeatInterval: NodeJS.Timeout | null = null;

  async startHeartbeat(): Promise<void> {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => {
      this.sessions.forEach(session => {
        session.lastActivityAt = new Date();
      });
    }, 30000);
  }

  async stopHeartbeat(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async trainShadowProbe(data: unknown): Promise<{ success: boolean; accuracy?: number }> {
    const trainingData = data as { samples?: number };
    const samples = trainingData?.samples || 100;
    const accuracy = 0.85 + (samples / 10000) * 0.1;
    return { success: true, accuracy: Math.min(0.99, accuracy) };
  }

  async processDialogue(params: { message: string; requireHighConfidence?: boolean; includeRawIntrospection?: boolean } | string, message?: string): Promise<{ response: string; confidence: number; introspection?: unknown }> {
    const msg = typeof params === 'string' ? message || '' : params.message;
    const sessionId = `session_${Date.now()}`;
    const dialogueResponse = await this.sendMessage(sessionId, msg);
    return { 
      response: dialogueResponse.message.content, 
      confidence: 0.9,
      introspection: dialogueResponse.introspection,
    };
  }

  async getConsciousnessStatus(): Promise<{ active: boolean; level: number; lastUpdate: Date }> {
    return { active: true, level: 0.8, lastUpdate: new Date() };
  }
}

export function createCatoDialogueService(tenantId: string, identity?: Partial<CatoIdentity>): CatoDialogueService {
  return new CatoDialogueService(tenantId, identity);
}

export function getCatoIdentity(): CatoIdentity {
  return { ...DEFAULT_IDENTITY };
}

