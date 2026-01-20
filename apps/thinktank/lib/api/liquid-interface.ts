/**
 * Liquid Interface API Client
 * 
 * "Don't Build the Tool. BE the Tool."
 * 
 * The chat interface morphs into the tool the user needs:
 * - Data talk → Spreadsheet
 * - Logic talk → Calculator
 * - Design talk → Canvas
 * 
 * And can export to Next.js apps!
 */

import { api } from './client';

// ============================================================================
// Types (mirrored from @radiant/shared for consumer app)
// ============================================================================

export type LiquidMode = 'chat' | 'morphed' | 'transitioning' | 'ejecting';

export type ComponentCategory =
  | 'data' | 'input' | 'layout' | 'visualization' | 'productivity'
  | 'code' | 'media' | 'ai' | 'finance' | 'custom';

export type IntentCategory =
  | 'data_analysis' | 'tracking' | 'visualization' | 'planning'
  | 'calculation' | 'design' | 'coding' | 'writing' | 'general';

export interface LiquidIntent {
  category: IntentCategory;
  action: string;
  confidence: number;
  entities: Record<string, string>;
  suggestedComponents: string[];
}

export interface LiquidComponent {
  id: string;
  name: string;
  category: ComponentCategory;
  description: string;
  icon: string;
  color: string;
  tags: string[];
}

export interface LiquidSchema {
  version: '1.0';
  id: string;
  intent: LiquidIntent;
  layout: unknown;
  initialData: Record<string, unknown>;
  bindings: unknown[];
  aiOverlay: unknown;
  ejectConfig?: EjectConfig;
}

export interface LiquidSession {
  id: string;
  tenantId: string;
  userId: string;
  mode: LiquidMode;
  currentSchema?: LiquidSchema;
  ghostState: Record<string, unknown>;
  conversationId: string;
  createdAt: string;
  lastActivityAt: string;
}

export interface MorphResponse {
  sessionId: string;
  shouldMorph: boolean;
  intent?: LiquidIntent;
  schema?: LiquidSchema;
  transition?: MorphTransition;
  aiMessage?: string;
  suggestions?: Array<{ id: string; text: string; action: string; confidence: number }>;
}

export interface MorphTransition {
  type: 'fade' | 'slide' | 'expand' | 'dissolve' | 'morph';
  duration: number;
  easing: string;
  staggerChildren: boolean;
}

export interface GhostEvent {
  id: string;
  timestamp: string;
  componentId: string;
  componentType: string;
  action: string;
  payload: Record<string, unknown>;
  currentState: Record<string, unknown>;
  userId: string;
  sessionId: string;
}

export interface AIReaction {
  id: string;
  eventId: string;
  type: 'speak' | 'update' | 'morph' | 'suggest';
  message?: string;
  stateUpdates?: Record<string, unknown>;
  newSchema?: LiquidSchema;
  suggestions?: Array<{ id: string; text: string; action: string; confidence: number }>;
}

export type EjectFramework = 'nextjs' | 'vite' | 'remix' | 'astro';
export type EjectFeature = 'database' | 'auth' | 'api' | 'ai' | 'realtime';

export interface EjectConfig {
  framework: EjectFramework;
  features: EjectFeature[];
  dependencies: Array<{ name: string; version: string; required: boolean; devOnly: boolean }>;
  secrets: Array<{ name: string; description: string; required: boolean; envKey: string }>;
  deployTarget?: 'vercel' | 'netlify' | 'github' | 'zip';
}

export interface EjectFile {
  path: string;
  content: string;
  type: 'source' | 'config' | 'asset' | 'doc';
}

export interface EjectResult {
  id: string;
  status: 'success' | 'partial' | 'failed';
  files: EjectFile[];
  setupInstructions: string[];
  envExample: string;
  deployUrl?: string;
  repoUrl?: string;
  warnings: string[];
}

const LIQUID_BASE = '/api/thinktank/liquid';

export interface LiquidInterfaceClient {
  // Registry
  getRegistry(): Promise<{
    version: string;
    categories: Array<{ id: ComponentCategory; name: string; componentCount: number }>;
    componentCount: number;
  }>;
  getComponents(options?: { category?: string; query?: string }): Promise<{ components: LiquidComponent[] }>;
  getComponent(componentId: string): Promise<{ component: LiquidComponent }>;

  // Sessions
  createSession(conversationId?: string): Promise<{ session: LiquidSession }>;
  getSession(sessionId: string): Promise<{ session: LiquidSession }>;

  // Morphing
  morph(params: {
    sessionId?: string;
    message: string;
    attachments?: string[];
    currentState?: Record<string, unknown>;
  }): Promise<MorphResponse>;
  detectIntent(message: string): Promise<{ intent: LiquidIntent }>;
  revertToChat(sessionId: string): Promise<{ transition: MorphTransition }>;

  // Ghost State
  sendGhostEvent(sessionId: string, event: Partial<GhostEvent>): Promise<{ reaction: AIReaction }>;
  getGhostState(sessionId: string): Promise<{ snapshot: Record<string, unknown> }>;
  syncGhostState(sessionId: string, updates: Record<string, unknown>): Promise<{ triggeredBindings: string[] }>;

  // Eject
  previewEject(sessionId: string): Promise<{
    schema: LiquidSchema;
    estimatedFiles: number;
    supportedFrameworks: string[];
    features: string[];
  }>;
  eject(sessionId: string, config: EjectConfig): Promise<{ result: EjectResult }>;
}

export const liquidInterfaceClient: LiquidInterfaceClient = {
  // Registry
  async getRegistry() {
    return api.get(`${LIQUID_BASE}/registry`);
  },

  async getComponents(options) {
    const params = new URLSearchParams();
    if (options?.category) params.append('category', options.category);
    if (options?.query) params.append('q', options.query);
    const queryString = params.toString();
    return api.get(`${LIQUID_BASE}/registry/components${queryString ? `?${queryString}` : ''}`);
  },

  async getComponent(componentId) {
    return api.get(`${LIQUID_BASE}/registry/components/${componentId}`);
  },

  // Sessions
  async createSession(conversationId) {
    return api.post(`${LIQUID_BASE}/sessions`, { conversationId });
  },

  async getSession(sessionId) {
    return api.get(`${LIQUID_BASE}/sessions/${sessionId}`);
  },

  // Morphing
  async morph(params) {
    return api.post(`${LIQUID_BASE}/morph`, params);
  },

  async detectIntent(message) {
    return api.post(`${LIQUID_BASE}/detect-intent`, { message });
  },

  async revertToChat(sessionId) {
    return api.post(`${LIQUID_BASE}/sessions/${sessionId}/revert`, {});
  },

  // Ghost State
  async sendGhostEvent(sessionId, event) {
    return api.post(`${LIQUID_BASE}/ghost/event`, { sessionId, event });
  },

  async getGhostState(sessionId) {
    return api.get(`${LIQUID_BASE}/ghost/state/${sessionId}`);
  },

  async syncGhostState(sessionId, updates) {
    return api.post(`${LIQUID_BASE}/ghost/sync`, { sessionId, updates });
  },

  // Eject
  async previewEject(sessionId) {
    return api.post(`${LIQUID_BASE}/eject/preview`, { sessionId });
  },

  async eject(sessionId, config) {
    return api.post(`${LIQUID_BASE}/eject`, { sessionId, config });
  },
};
