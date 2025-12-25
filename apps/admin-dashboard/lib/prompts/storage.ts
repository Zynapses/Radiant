// Shared storage utilities for pinned prompts

import { PinnedPrompt, PromptScope, STORAGE_KEYS } from './types';

export function getStorageKey(scope: PromptScope): string {
  return scope === 'thinktank' ? STORAGE_KEYS.thinktank : STORAGE_KEYS.admin;
}

export function loadPrompts(scope: PromptScope): PinnedPrompt[] | null {
  if (typeof window === 'undefined') return null;
  
  const key = getStorageKey(scope);
  const stored = localStorage.getItem(key);
  
  if (!stored) return null;
  
  try {
    return JSON.parse(stored) as PinnedPrompt[];
  } catch {
    return null;
  }
}

export function savePrompts(prompts: PinnedPrompt[], scope: PromptScope): void {
  if (typeof window === 'undefined') return;
  
  const key = getStorageKey(scope);
  localStorage.setItem(key, JSON.stringify(prompts));
}

export function filterPrompts(
  prompts: PinnedPrompt[],
  options: {
    scope?: PromptScope;
    searchQuery?: string;
    category?: string | null;
  }
): PinnedPrompt[] {
  let filtered = [...prompts];

  // Filter by scope
  if (options.scope && options.scope !== 'all') {
    filtered = filtered.filter(
      (p) => p.scope === options.scope || p.scope === 'all' || !p.scope
    );
  }

  // Filter by category
  if (options.category) {
    filtered = filtered.filter((p) => p.category === options.category);
  }

  // Filter by search query
  if (options.searchQuery) {
    const query = options.searchQuery.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.prompt.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
    );
  }

  // Sort: favorites first, then by usage count
  return filtered.sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return b.usageCount - a.usageCount;
  });
}

export function createPrompt(
  name: string,
  prompt: string,
  category: string,
  scope: PromptScope = 'all'
): PinnedPrompt {
  return {
    id: `${scope}-${Date.now()}`,
    name,
    prompt,
    category,
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isFavorite: false,
    scope,
  };
}

export function updatePromptUsage(
  prompts: PinnedPrompt[],
  promptId: string
): PinnedPrompt[] {
  return prompts.map((p) =>
    p.id === promptId ? { ...p, usageCount: p.usageCount + 1 } : p
  );
}

export function togglePromptFavorite(
  prompts: PinnedPrompt[],
  promptId: string
): PinnedPrompt[] {
  return prompts.map((p) =>
    p.id === promptId ? { ...p, isFavorite: !p.isFavorite } : p
  );
}

export function deletePrompt(
  prompts: PinnedPrompt[],
  promptId: string
): PinnedPrompt[] {
  return prompts.filter((p) => p.id !== promptId);
}
