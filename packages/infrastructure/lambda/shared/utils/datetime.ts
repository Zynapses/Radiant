/**
 * Timezone-Aware Date/Time Utilities
 * 
 * Standardized date handling for multi-region deployments
 * with proper timezone support.
 */

export type TimezoneId = string; // e.g., 'America/New_York', 'Europe/London'

/**
 * Get current timestamp in UTC ISO format
 */
export function utcNow(): string {
  return new Date().toISOString();
}

/**
 * Get current Unix timestamp in seconds
 */
export function unixTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get current Unix timestamp in milliseconds
 */
export function unixTimestampMs(): number {
  return Date.now();
}

/**
 * Parse a date string and return UTC Date object
 */
export function parseToUtc(dateString: string): Date {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date string: ${dateString}`);
  }
  return date;
}

/**
 * Format a date to ISO string in UTC
 */
export function toUtcIsoString(date: Date | string | number): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return d.toISOString();
}

/**
 * Format a date for database storage (UTC)
 */
export function toDbTimestamp(date: Date | string | number = new Date()): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return d.toISOString().replace('T', ' ').replace('Z', '+00');
}

/**
 * Parse a database timestamp to Date
 */
export function fromDbTimestamp(timestamp: string): Date {
  // Handle PostgreSQL timestamp formats
  const normalized = timestamp
    .replace(' ', 'T')
    .replace('+00', 'Z')
    .replace(/(\d{2})$/, ':$1'); // Handle timezone offset format
  return new Date(normalized);
}

/**
 * Get start of day in UTC
 */
export function startOfDayUtc(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day in UTC
 */
export function endOfDayUtc(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Get start of month in UTC
 */
export function startOfMonthUtc(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of month in UTC
 */
export function endOfMonthUtc(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Add duration to a date
 */
export function addDuration(
  date: Date,
  amount: number,
  unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'
): Date {
  const d = new Date(date);
  switch (unit) {
    case 'seconds':
      d.setTime(d.getTime() + amount * 1000);
      break;
    case 'minutes':
      d.setTime(d.getTime() + amount * 60 * 1000);
      break;
    case 'hours':
      d.setTime(d.getTime() + amount * 60 * 60 * 1000);
      break;
    case 'days':
      d.setTime(d.getTime() + amount * 24 * 60 * 60 * 1000);
      break;
    case 'weeks':
      d.setTime(d.getTime() + amount * 7 * 24 * 60 * 60 * 1000);
      break;
    case 'months':
      d.setUTCMonth(d.getUTCMonth() + amount);
      break;
  }
  return d;
}

/**
 * Calculate difference between two dates
 */
export function dateDiff(
  date1: Date,
  date2: Date,
  unit: 'seconds' | 'minutes' | 'hours' | 'days'
): number {
  const diffMs = date1.getTime() - date2.getTime();
  switch (unit) {
    case 'seconds':
      return Math.floor(diffMs / 1000);
    case 'minutes':
      return Math.floor(diffMs / (60 * 1000));
    case 'hours':
      return Math.floor(diffMs / (60 * 60 * 1000));
    case 'days':
      return Math.floor(diffMs / (24 * 60 * 60 * 1000));
  }
}

/**
 * Check if a date is in the past
 */
export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * Check if a date is in the future
 */
export function isFuture(date: Date): boolean {
  return date.getTime() > Date.now();
}

/**
 * Check if a date is within a time window
 */
export function isWithinWindow(date: Date, windowMs: number): boolean {
  return Math.abs(Date.now() - date.getTime()) <= windowMs;
}

/**
 * Format duration in human-readable form
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Get relative time description
 */
export function relativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  
  return date.toISOString().split('T')[0];
}

/**
 * Parse duration string (e.g., "1h", "30m", "1d") to milliseconds
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d|w)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  
  const amount = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 's': return amount * 1000;
    case 'm': return amount * 60 * 1000;
    case 'h': return amount * 60 * 60 * 1000;
    case 'd': return amount * 24 * 60 * 60 * 1000;
    case 'w': return amount * 7 * 24 * 60 * 60 * 1000;
    default: throw new Error(`Unknown duration unit: ${unit}`);
  }
}

/**
 * Create a date range for billing periods
 */
export function getBillingPeriod(date: Date = new Date()): {
  start: Date;
  end: Date;
  label: string;
} {
  const start = startOfMonthUtc(date);
  const end = endOfMonthUtc(date);
  const label = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  
  return { start, end, label };
}

/**
 * Safely compare dates with null handling
 */
export function compareDates(
  a: Date | null | undefined,
  b: Date | null | undefined
): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a.getTime() - b.getTime();
}

/**
 * Get time until expiration
 */
export function timeUntilExpiration(expiresAt: Date): {
  expired: boolean;
  remainingMs: number;
  remainingFormatted: string;
} {
  const remainingMs = expiresAt.getTime() - Date.now();
  return {
    expired: remainingMs <= 0,
    remainingMs: Math.max(0, remainingMs),
    remainingFormatted: remainingMs > 0 ? formatDuration(remainingMs) : 'expired',
  };
}
