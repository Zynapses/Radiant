// Default prompts for Admin Dashboard and Think Tank

import { PinnedPrompt } from './types';

export const DEFAULT_ADMIN_PROMPTS: PinnedPrompt[] = [
  {
    id: 'admin-1',
    name: 'Summarize Document',
    prompt: 'Please summarize the key points from this document in a concise bullet list.',
    category: 'Summarization',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: true,
    scope: 'all',
  },
  {
    id: 'admin-2',
    name: 'Code Review',
    prompt: 'Review this code for potential bugs, security issues, and suggest improvements.',
    category: 'Development',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: false,
    scope: 'all',
  },
  {
    id: 'admin-3',
    name: 'Explain Simply',
    prompt: 'Explain this concept in simple terms that a non-technical person would understand.',
    category: 'Education',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: true,
    scope: 'all',
  },
  {
    id: 'admin-4',
    name: 'Draft Email',
    prompt: 'Help me draft a professional email regarding the following topic:',
    category: 'Writing',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: false,
    scope: 'all',
  },
  {
    id: 'admin-5',
    name: 'Data Analysis',
    prompt: 'Analyze this data and provide insights on trends, patterns, and recommendations.',
    category: 'Analytics',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: false,
    scope: 'admin',
  },
];

export const DEFAULT_THINKTANK_PROMPTS: PinnedPrompt[] = [
  {
    id: 'tt-1',
    name: "Explain Like I'm 5",
    prompt: 'Explain this concept in very simple terms, as if you were explaining to a 5-year-old:',
    category: 'Learning',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: true,
    scope: 'thinktank',
  },
  {
    id: 'tt-2',
    name: 'Pros and Cons',
    prompt: 'List the pros and cons of the following, with a brief analysis:',
    category: 'Analysis',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: true,
    scope: 'thinktank',
  },
  {
    id: 'tt-3',
    name: 'Step by Step',
    prompt: 'Break this down into clear, numbered steps:',
    category: 'Instructions',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: false,
    scope: 'thinktank',
  },
  {
    id: 'tt-4',
    name: 'Creative Story',
    prompt: 'Write a creative short story based on the following premise:',
    category: 'Creative',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: false,
    scope: 'thinktank',
  },
  {
    id: 'tt-5',
    name: 'Debug Helper',
    prompt: "Help me debug this issue. Here's what's happening and what I've tried:",
    category: 'Development',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: true,
    scope: 'thinktank',
  },
  {
    id: 'tt-6',
    name: 'Brainstorm Ideas',
    prompt: 'Brainstorm 10 creative ideas for the following:',
    category: 'Creative',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: false,
    scope: 'thinktank',
  },
  {
    id: 'tt-7',
    name: 'Summarize',
    prompt: 'Provide a concise summary of the following in bullet points:',
    category: 'Summarization',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: true,
    scope: 'thinktank',
  },
  {
    id: 'tt-8',
    name: 'Compare Options',
    prompt: 'Compare these options and recommend the best choice with reasoning:',
    category: 'Analysis',
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: false,
    scope: 'thinktank',
  },
];

export function getDefaultPrompts(scope: 'admin' | 'thinktank' | 'all'): PinnedPrompt[] {
  switch (scope) {
    case 'admin':
      return DEFAULT_ADMIN_PROMPTS;
    case 'thinktank':
      return DEFAULT_THINKTANK_PROMPTS;
    case 'all':
    default:
      return [...DEFAULT_ADMIN_PROMPTS, ...DEFAULT_THINKTANK_PROMPTS];
  }
}
