'use client';

/**
 * GlassCard - Glassmorphism Card Component
 * 
 * Modern 2026+ glass effect with:
 * - Frosted glass background
 * - Subtle border glow
 * - Depth shadows
 * - Hover animations
 */

import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'inset' | 'glow';
  intensity?: 'light' | 'medium' | 'strong';
  hoverEffect?: boolean;
  glowColor?: 'violet' | 'fuchsia' | 'cyan' | 'emerald' | 'none';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const intensityStyles = {
  light: 'bg-white/[0.02] backdrop-blur-md',
  medium: 'bg-white/[0.04] backdrop-blur-lg',
  strong: 'bg-white/[0.08] backdrop-blur-xl',
};

const variantStyles = {
  default: 'border border-white/[0.06]',
  elevated: 'border border-white/[0.08] shadow-lg shadow-black/20',
  inset: 'border border-white/[0.04] shadow-inner',
  glow: 'border border-white/[0.1]',
};

const glowStyles = {
  violet: 'shadow-[0_0_30px_rgba(139,92,246,0.15)]',
  fuchsia: 'shadow-[0_0_30px_rgba(217,70,239,0.15)]',
  cyan: 'shadow-[0_0_30px_rgba(34,211,238,0.15)]',
  emerald: 'shadow-[0_0_30px_rgba(52,211,153,0.15)]',
  none: '',
};

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function GlassCard({
  children,
  className,
  variant = 'default',
  intensity = 'medium',
  hoverEffect = true,
  glowColor = 'none',
  padding = 'md',
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        'rounded-xl transition-all duration-300',
        intensityStyles[intensity],
        variantStyles[variant],
        glowStyles[glowColor],
        paddingStyles[padding],
        hoverEffect && 'hover:bg-white/[0.06] hover:border-white/[0.12] hover:shadow-lg',
        className
      )}
      whileHover={hoverEffect ? { scale: 1.01, y: -2 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  blur?: 'sm' | 'md' | 'lg' | 'xl';
}

export function GlassPanel({
  children,
  className,
  blur = 'lg',
  ...props
}: GlassPanelProps) {
  const blurStyles = {
    sm: 'backdrop-blur-sm',
    md: 'backdrop-blur-md',
    lg: 'backdrop-blur-lg',
    xl: 'backdrop-blur-xl',
  };

  return (
    <div
      className={cn(
        'bg-white/[0.03] border border-white/[0.06] rounded-2xl',
        blurStyles[blur],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
