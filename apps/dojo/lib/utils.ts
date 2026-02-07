import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { RankTier } from './api';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const RANK_META: Record<RankTier, { label: string; color: string; bg: string; border: string; xpRequired: number }> = {
  novice:   { label: 'Novice',   color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/30',  xpRequired: 0 },
  initiate: { label: 'Initiate', color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30',  xpRequired: 500 },
  adept:    { label: 'Adept',    color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   xpRequired: 2000 },
  master:   { label: 'Master',   color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', xpRequired: 5000 },
  radiant:  { label: 'Radiant',  color: 'text-dojo-400',   bg: 'bg-dojo-500/10',   border: 'border-dojo-500/30',   xpRequired: 10000 },
};

export const DIFFICULTY_LABELS: Record<string, { label: string; color: string }> = {
  fundamental:   { label: 'Fundamental',   color: 'text-green-400' },
  intermediate:  { label: 'Intermediate',  color: 'text-blue-400' },
  advanced:      { label: 'Advanced',      color: 'text-purple-400' },
  expert:        { label: 'Expert',        color: 'text-dojo-400' },
};

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function xpPercentage(xp: number, xpToNext: number): number {
  if (xpToNext <= 0) return 100;
  return Math.min(100, Math.round((xp / (xp + xpToNext)) * 100));
}

export function accuracyColor(accuracy: number): string {
  if (accuracy >= 0.85) return 'text-green-400';
  if (accuracy >= 0.65) return 'text-dojo-400';
  if (accuracy >= 0.45) return 'text-yellow-400';
  return 'text-red-400';
}
