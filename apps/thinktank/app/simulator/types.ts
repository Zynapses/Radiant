/**
 * Think Tank Consumer App Simulator - Types
 * v3.0 - All TypeScript interfaces and types
 */

export type ViewType = 'chat' | 'settings' | 'history' | 'profile' | 'rules' | 'artifacts' | 'workflows' | 'timemachine' | 'morphing';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

export type OrchestrationMode = 
  | 'thinking' 
  | 'extended_thinking' 
  | 'coding' 
  | 'creative' 
  | 'research' 
  | 'analysis' 
  | 'multi_model' 
  | 'chain_of_thought' 
  | 'self_consistency';

export type BrainStepType = 
  | 'analyze' 
  | 'detect_domain' 
  | 'select_model' 
  | 'prepare_context' 
  | 'ethics_check' 
  | 'generate' 
  | 'synthesize' 
  | 'verify' 
  | 'refine' 
  | 'calibrate' 
  | 'reflect';

export type StepStatus = 'pending' | 'running' | 'complete' | 'error';

export type CatoMood = 'balanced' | 'scout' | 'sage' | 'spark' | 'guide';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model?: string;
  brainPlan?: BrainPlan;
  mood?: CatoMood;
  artifacts?: Artifact[];
}

export interface BrainPlanStep {
  id: string;
  type: BrainStepType;
  label: string;
  status: StepStatus;
  duration?: number;
  detail?: string;
}

export interface BrainPlan {
  id: string;
  mode: OrchestrationMode;
  modeLabel: string;
  domain: {
    field: string;
    domain: string;
    subspecialty?: string;
    confidence: number;
  };
  model: {
    id: string;
    name: string;
    reason: string;
  };
  steps: BrainPlanStep[];
  estimatedTime: number;
  estimatedCost: number;
}

export interface TimelineSnapshot {
  id: string;
  timestamp: Date;
  label: string;
  type: 'checkpoint' | 'branch' | 'rollback' | 'auto';
  messageCount: number;
  isBookmarked: boolean;
  preview: string;
}

export interface WorkflowStep {
  id: string;
  type: 'generator' | 'critic' | 'verifier' | 'synthesizer';
  label: string;
  model?: string;
  position: { x: number; y: number };
  connections: string[];
  config: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Artifact {
  id: string;
  type: 'code' | 'image' | 'document' | 'chart' | 'table';
  title: string;
  content: string;
  language?: string;
  createdAt: Date;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  priority: number;
  conditions: string[];
  actions: string[];
}

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  description: string;
  capabilities: string[];
  costPerToken: number;
  isDefault?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  preferences: {
    defaultModel: string;
    theme: 'light' | 'dark' | 'system';
    soundEnabled: boolean;
    advancedMode: boolean;
    voiceEnabled: boolean;
  };
  stats: {
    totalMessages: number;
    totalTokens: number;
    sessionsCount: number;
    joinedAt: Date;
  };
}

export interface HistorySession {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  model: string;
  mood: CatoMood;
}

export interface NavItem {
  id: ViewType;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: number;
}
