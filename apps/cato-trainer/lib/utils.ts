import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

export function confidenceColor(score: number): string {
  if (score >= 0.9) return 'text-citation-exact';
  if (score >= 0.7) return 'text-citation-high';
  if (score >= 0.5) return 'text-citation-moderate';
  return 'text-citation-low';
}

export function confidenceLabel(score: number): string {
  if (score >= 0.9) return 'Exact Match';
  if (score >= 0.7) return 'High Confidence';
  if (score >= 0.5) return 'Moderate';
  return 'Low Confidence';
}

export const DOC_TYPE_ICONS: Record<string, string> = {
  'application/pdf': 'FileText',
  'text/plain': 'FileText',
  'text/markdown': 'FileCode',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'FileText',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Table',
  'text/csv': 'Table',
  'text/html': 'Globe',
  'image/png': 'Image',
  'image/jpeg': 'Image',
  'default': 'File',
};
