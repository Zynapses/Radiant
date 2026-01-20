/**
 * Think Tank Consumer App Simulator - Mock Data
 * v3.0 - All mock data for the simulator
 */

import type {
  ModelOption,
  BrainPlan,
  TimelineSnapshot,
  WorkflowStep,
  Workflow,
  Artifact,
  Rule,
  UserProfile,
  HistorySession,
  Message,
  CatoMood,
} from './types';

export const MOCK_MODELS: ModelOption[] = [
  {
    id: 'auto',
    name: 'Auto (Recommended)',
    provider: 'Radiant',
    description: 'Automatically selects the best model based on your prompt',
    capabilities: ['general', 'coding', 'analysis', 'creative'],
    costPerToken: 0.00001,
    isDefault: true,
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    description: 'Best for complex reasoning and nuanced responses',
    capabilities: ['reasoning', 'analysis', 'coding', 'creative'],
    costPerToken: 0.000015,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    description: 'Multimodal model with vision capabilities',
    capabilities: ['vision', 'general', 'coding', 'analysis'],
    costPerToken: 0.00001,
  },
  {
    id: 'o1',
    name: 'o1',
    provider: 'OpenAI',
    description: 'Advanced reasoning with chain-of-thought',
    capabilities: ['reasoning', 'math', 'coding', 'science'],
    costPerToken: 0.00006,
  },
  {
    id: 'gemini-2-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    description: 'Fast responses with good quality',
    capabilities: ['general', 'coding', 'vision'],
    costPerToken: 0.000005,
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'DeepSeek',
    description: 'Specialized for reasoning tasks',
    capabilities: ['reasoning', 'math', 'coding'],
    costPerToken: 0.000002,
  },
];

export const MOCK_BRAIN_PLAN: BrainPlan = {
  id: 'bp-001',
  mode: 'extended_thinking',
  modeLabel: 'Extended Thinking',
  domain: {
    field: 'Computer Science',
    domain: 'Software Engineering',
    subspecialty: 'Web Development',
    confidence: 0.92,
  },
  model: {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    reason: 'Best match for coding + explanation tasks',
  },
  steps: [
    { id: 's1', type: 'analyze', label: 'Analyzing prompt', status: 'complete', duration: 120 },
    { id: 's2', type: 'detect_domain', label: 'Detecting domain', status: 'complete', duration: 85, detail: 'Web Development (92%)' },
    { id: 's3', type: 'select_model', label: 'Selecting model', status: 'complete', duration: 45, detail: 'Claude 3.5 Sonnet' },
    { id: 's4', type: 'prepare_context', label: 'Preparing context', status: 'complete', duration: 200 },
    { id: 's5', type: 'ethics_check', label: 'Ethics check', status: 'complete', duration: 30 },
    { id: 's6', type: 'generate', label: 'Generating response', status: 'running', detail: 'Extended thinking active...' },
    { id: 's7', type: 'verify', label: 'Verifying output', status: 'pending' },
    { id: 's8', type: 'refine', label: 'Refining response', status: 'pending' },
  ],
  estimatedTime: 8500,
  estimatedCost: 0.0024,
};

export const MOCK_SNAPSHOTS: TimelineSnapshot[] = [
  {
    id: 'snap-1',
    timestamp: new Date(Date.now() - 3600000 * 24),
    label: 'Session Start',
    type: 'checkpoint',
    messageCount: 0,
    isBookmarked: false,
    preview: 'New conversation started',
  },
  {
    id: 'snap-2',
    timestamp: new Date(Date.now() - 3600000 * 20),
    label: 'Initial Question',
    type: 'auto',
    messageCount: 2,
    isBookmarked: false,
    preview: 'How do I build a React component...',
  },
  {
    id: 'snap-3',
    timestamp: new Date(Date.now() - 3600000 * 16),
    label: 'Code Review',
    type: 'checkpoint',
    messageCount: 8,
    isBookmarked: true,
    preview: 'Here is the refactored code with TypeScript...',
  },
  {
    id: 'snap-4',
    timestamp: new Date(Date.now() - 3600000 * 12),
    label: 'Branch: Alternative Approach',
    type: 'branch',
    messageCount: 12,
    isBookmarked: false,
    preview: 'Let me try a different approach using hooks...',
  },
  {
    id: 'snap-5',
    timestamp: new Date(Date.now() - 3600000 * 8),
    label: 'Testing Phase',
    type: 'auto',
    messageCount: 18,
    isBookmarked: true,
    preview: 'Added unit tests for the component...',
  },
  {
    id: 'snap-6',
    timestamp: new Date(Date.now() - 3600000 * 4),
    label: 'Rollback: Undo changes',
    type: 'rollback',
    messageCount: 15,
    isBookmarked: false,
    preview: 'Reverted to previous working state',
  },
  {
    id: 'snap-7',
    timestamp: new Date(Date.now() - 3600000 * 2),
    label: 'Final Implementation',
    type: 'checkpoint',
    messageCount: 22,
    isBookmarked: true,
    preview: 'Complete implementation with all features',
  },
  {
    id: 'snap-8',
    timestamp: new Date(),
    label: 'Current State',
    type: 'auto',
    messageCount: 25,
    isBookmarked: false,
    preview: 'Latest changes applied',
  },
];

export const MOCK_WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'wf-1',
    type: 'generator',
    label: 'Initial Generator',
    model: 'claude-3-5-sonnet',
    position: { x: 100, y: 150 },
    connections: ['wf-2', 'wf-3'],
    config: { temperature: 0.7, maxTokens: 4096 },
  },
  {
    id: 'wf-2',
    type: 'critic',
    label: 'Quality Critic',
    model: 'gpt-4o',
    position: { x: 350, y: 80 },
    connections: ['wf-4'],
    config: { strictness: 'high', focusAreas: ['accuracy', 'clarity'] },
  },
  {
    id: 'wf-3',
    type: 'critic',
    label: 'Style Critic',
    model: 'claude-3-5-sonnet',
    position: { x: 350, y: 220 },
    connections: ['wf-4'],
    config: { strictness: 'medium', focusAreas: ['tone', 'consistency'] },
  },
  {
    id: 'wf-4',
    type: 'synthesizer',
    label: 'Feedback Synthesizer',
    model: 'claude-3-5-sonnet',
    position: { x: 600, y: 150 },
    connections: ['wf-5'],
    config: { mergeStrategy: 'weighted', weights: { quality: 0.6, style: 0.4 } },
  },
  {
    id: 'wf-5',
    type: 'verifier',
    label: 'Final Verifier',
    model: 'o1',
    position: { x: 850, y: 150 },
    connections: [],
    config: { verifyFactual: true, verifyLogic: true, verifySafety: true },
  },
];

export const MOCK_WORKFLOWS: Workflow[] = [
  {
    id: 'workflow-1',
    name: 'Multi-Critic Review',
    description: 'Uses multiple critic models to review and improve responses',
    steps: MOCK_WORKFLOW_STEPS,
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 7),
    updatedAt: new Date(Date.now() - 86400000),
  },
  {
    id: 'workflow-2',
    name: 'Code Review Pipeline',
    description: 'Specialized workflow for code generation and review',
    steps: [],
    isActive: false,
    createdAt: new Date(Date.now() - 86400000 * 14),
    updatedAt: new Date(Date.now() - 86400000 * 3),
  },
  {
    id: 'workflow-3',
    name: 'Research Synthesis',
    description: 'Gathers and synthesizes information from multiple sources',
    steps: [],
    isActive: false,
    createdAt: new Date(Date.now() - 86400000 * 21),
    updatedAt: new Date(Date.now() - 86400000 * 10),
  },
];

export const MOCK_ARTIFACTS: Artifact[] = [
  {
    id: 'art-1',
    type: 'code',
    title: 'React Component',
    content: `import React, { useState } from 'react';

export const Counter: React.FC = () => {
  const [count, setCount] = useState(0);
  
  return (
    <div className="counter">
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>
        Increment
      </button>
    </div>
  );
};`,
    language: 'typescript',
    createdAt: new Date(Date.now() - 3600000 * 2),
  },
  {
    id: 'art-2',
    type: 'document',
    title: 'API Documentation',
    content: '# API Endpoints\n\n## GET /users\nReturns a list of all users...',
    createdAt: new Date(Date.now() - 3600000 * 5),
  },
  {
    id: 'art-3',
    type: 'table',
    title: 'Performance Metrics',
    content: JSON.stringify([
      { metric: 'Response Time', value: '120ms', status: 'good' },
      { metric: 'Throughput', value: '1.2k/s', status: 'good' },
      { metric: 'Error Rate', value: '0.1%', status: 'good' },
    ]),
    createdAt: new Date(Date.now() - 3600000 * 8),
  },
];

export const MOCK_RULES: Rule[] = [
  {
    id: 'rule-1',
    name: 'Code Style Enforcement',
    description: 'Ensure all code follows project style guidelines',
    isEnabled: true,
    priority: 1,
    conditions: ['When generating code', 'When reviewing code'],
    actions: ['Apply ESLint rules', 'Use Prettier formatting', 'Follow TypeScript strict mode'],
  },
  {
    id: 'rule-2',
    name: 'Privacy Protection',
    description: 'Never expose sensitive user information',
    isEnabled: true,
    priority: 0,
    conditions: ['Always'],
    actions: ['Mask PII', 'Encrypt sensitive data', 'Log access attempts'],
  },
  {
    id: 'rule-3',
    name: 'Response Length Limit',
    description: 'Keep responses concise unless detailed explanation requested',
    isEnabled: true,
    priority: 2,
    conditions: ['Unless user asks for detail', 'For quick questions'],
    actions: ['Limit to 500 words', 'Use bullet points', 'Offer to expand'],
  },
  {
    id: 'rule-4',
    name: 'Citation Required',
    description: 'Include sources for factual claims',
    isEnabled: false,
    priority: 3,
    conditions: ['When making factual claims', 'For research tasks'],
    actions: ['Include inline citations', 'List sources at end'],
  },
];

export const MOCK_USER_PROFILE: UserProfile = {
  id: 'user-1',
  name: 'Alex Developer',
  email: 'alex@example.com',
  avatar: undefined,
  preferences: {
    defaultModel: 'auto',
    theme: 'dark',
    soundEnabled: true,
    advancedMode: false,
    voiceEnabled: true,
  },
  stats: {
    totalMessages: 1247,
    totalTokens: 2456000,
    sessionsCount: 89,
    joinedAt: new Date('2024-01-15'),
  },
};

export const MOCK_HISTORY_SESSIONS: HistorySession[] = [
  {
    id: 'session-1',
    title: 'React Component Architecture',
    preview: 'Discussion about component patterns and best practices...',
    messageCount: 25,
    createdAt: new Date(Date.now() - 3600000 * 2),
    updatedAt: new Date(Date.now() - 3600000),
    model: 'claude-3-5-sonnet',
    mood: 'sage',
  },
  {
    id: 'session-2',
    title: 'Database Schema Design',
    preview: 'Designing a scalable PostgreSQL schema for...',
    messageCount: 42,
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(Date.now() - 86400000 + 3600000),
    model: 'gpt-4o',
    mood: 'balanced',
  },
  {
    id: 'session-3',
    title: 'Creative Writing Session',
    preview: 'Working on a short story about...',
    messageCount: 18,
    createdAt: new Date(Date.now() - 86400000 * 2),
    updatedAt: new Date(Date.now() - 86400000 * 2 + 7200000),
    model: 'claude-3-5-sonnet',
    mood: 'spark',
  },
  {
    id: 'session-4',
    title: 'API Integration Help',
    preview: 'How to integrate with the Stripe API...',
    messageCount: 31,
    createdAt: new Date(Date.now() - 86400000 * 3),
    updatedAt: new Date(Date.now() - 86400000 * 3 + 5400000),
    model: 'auto',
    mood: 'guide',
  },
  {
    id: 'session-5',
    title: 'Code Review Request',
    preview: 'Please review this TypeScript code for...',
    messageCount: 15,
    createdAt: new Date(Date.now() - 86400000 * 5),
    updatedAt: new Date(Date.now() - 86400000 * 5 + 3600000),
    model: 'o1',
    mood: 'scout',
  },
];

export const INITIAL_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    role: 'assistant',
    content: "Hello! I'm Cato, your AI assistant. How can I help you today?",
    timestamp: new Date(Date.now() - 60000),
    mood: 'balanced',
  },
];

export const CATO_MOODS: Record<CatoMood, { label: string; color: string; description: string }> = {
  balanced: {
    label: 'Balanced',
    color: 'blue',
    description: 'Default mode - balanced and helpful',
  },
  scout: {
    label: 'Scout',
    color: 'green',
    description: 'Exploratory mode - seeks diverse perspectives',
  },
  sage: {
    label: 'Sage',
    color: 'purple',
    description: 'Deep reasoning mode - thorough analysis',
  },
  spark: {
    label: 'Spark',
    color: 'orange',
    description: 'Creative mode - innovative and playful',
  },
  guide: {
    label: 'Guide',
    color: 'cyan',
    description: 'Teaching mode - patient explanations',
  },
};

export const ORCHESTRATION_MODES: Record<string, { label: string; icon: string; description: string }> = {
  thinking: { label: 'Thinking', icon: '🧠', description: 'Standard reasoning' },
  extended_thinking: { label: 'Extended Thinking', icon: '🔮', description: 'Deep multi-step reasoning' },
  coding: { label: 'Coding', icon: '💻', description: 'Code generation' },
  creative: { label: 'Creative', icon: '🎨', description: 'Creative writing' },
  research: { label: 'Research', icon: '🔬', description: 'Research synthesis' },
  analysis: { label: 'Analysis', icon: '📊', description: 'Quantitative analysis' },
  multi_model: { label: 'Multi-Model', icon: '🤝', description: 'Multiple model consensus' },
  chain_of_thought: { label: 'Chain of Thought', icon: '🔗', description: 'Explicit reasoning chain' },
  self_consistency: { label: 'Self-Consistency', icon: '✅', description: 'Multiple samples for consistency' },
};
