import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Re-export formatting utilities from shared package to avoid duplication
export {
  formatCurrency,
  formatNumber,
  formatCompactNumber,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatTokens,
  formatBytes,
  formatDuration,
  slugify,
  truncate,
} from '@radiant/shared';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
