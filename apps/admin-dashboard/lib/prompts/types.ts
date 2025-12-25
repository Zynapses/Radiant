// Shared types and utilities for pinned prompts across Admin Dashboard and Think Tank

export interface PinnedPrompt {
  id: string;
  name: string;
  prompt: string;
  category: string;
  createdAt: string;
  usageCount: number;
  isFavorite: boolean;
  scope?: 'admin' | 'thinktank' | 'all';
  model?: string;
}

export type PromptScope = 'admin' | 'thinktank' | 'all';

export const PROMPT_CATEGORIES = [
  'General',
  'Summarization',
  'Development',
  'Education',
  'Writing',
  'Analytics',
  'Research',
  'Creative',
  'Support',
  'Learning',
  'Analysis',
  'Instructions',
] as const;

export type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

export const STORAGE_KEYS = {
  admin: 'radiant.pinnedPrompts',
  thinktank: 'thinktank.pinnedPrompts',
} as const;
