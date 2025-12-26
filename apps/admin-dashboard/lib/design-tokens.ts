/**
 * Radiant Design System Tokens
 * 
 * Unified design tokens following best practices from:
 * shadcn/ui, Material Design 3, Atlassian, Shopify Polaris, GitHub Primer
 */

// Subscription tier styling
export const tierStyles = {
  free: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  pro: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  team: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  enterprise: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
} as const;

// Status colors
export const statusStyles = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  inactive: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  archived: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  deleted: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
} as const;

// Feature accent colors
export const featureColors = {
  conversations: { icon: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  users: { icon: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  models: { icon: 'text-violet-500', bg: 'bg-violet-100 dark:bg-violet-900/30' },
  billing: { icon: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
  analytics: { icon: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  security: { icon: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
} as const;

// Stat card variants with icons
export const statCardStyles = {
  default: {
    iconBg: 'bg-slate-100 dark:bg-slate-800',
    iconColor: 'text-slate-600 dark:text-slate-400',
  },
  primary: {
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  success: {
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  danger: {
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
  },
} as const;

// Grid layouts
export const gridLayouts = {
  stats2: 'grid grid-cols-1 sm:grid-cols-2 gap-4',
  stats3: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4',
  stats4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
  stats5: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4',
  cards2: 'grid grid-cols-1 md:grid-cols-2 gap-6',
  cards3: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
} as const;

export type TierType = keyof typeof tierStyles;
export type StatusType = keyof typeof statusStyles;
export type FeatureType = keyof typeof featureColors;
export type StatCardVariant = keyof typeof statCardStyles;
