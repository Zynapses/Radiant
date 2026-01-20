'use client';

/**
 * Spatial Glass Card
 * 
 * Glassmorphism card with depth perception and spatial layers.
 * Uses backdrop blur, gradient overlays, and subtle shadows to create
 * a sense of depth inspired by Apple's Vision Pro "Liquid Glass" aesthetic.
 */

import React, { forwardRef } from 'react';
import { motion, MotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

// Types
type GlassVariant = 'subtle' | 'medium' | 'strong' | 'solid';
type GlassLayer = 'base' | 'raised' | 'floating' | 'overlay';
type GlowColor = 'purple' | 'blue' | 'cyan' | 'pink' | 'amber' | 'green';

interface SpatialGlassCardProps extends Omit<MotionProps, 'children'> {
  children: React.ReactNode;
  variant?: GlassVariant;
  layer?: GlassLayer;
  glow?: boolean;
  glowColor?: GlowColor;
  interactive?: boolean;
  className?: string;
}

// Variant configurations
const VARIANT_STYLES: Record<GlassVariant, string> = {
  subtle: 'bg-background/40 backdrop-blur-sm border-white/5',
  medium: 'bg-background/60 backdrop-blur-md border-white/10',
  strong: 'bg-background/80 backdrop-blur-xl border-white/20',
  solid: 'bg-background/95 backdrop-blur-2xl border-white/30',
};

// Layer configurations (elevation/depth)
const LAYER_STYLES: Record<GlassLayer, string> = {
  base: 'shadow-sm',
  raised: 'shadow-md hover:shadow-lg',
  floating: 'shadow-xl hover:shadow-2xl',
  overlay: 'shadow-2xl',
};

const LAYER_TRANSFORMS: Record<GlassLayer, { scale: number; y: number }> = {
  base: { scale: 1, y: 0 },
  raised: { scale: 1.01, y: -2 },
  floating: { scale: 1.02, y: -4 },
  overlay: { scale: 1.03, y: -8 },
};

const GLOW_STYLES: Record<GlowColor, string> = {
  purple: 'shadow-purple-500/20 hover:shadow-purple-500/30',
  blue: 'shadow-blue-500/20 hover:shadow-blue-500/30',
  cyan: 'shadow-cyan-500/20 hover:shadow-cyan-500/30',
  pink: 'shadow-pink-500/20 hover:shadow-pink-500/30',
  amber: 'shadow-amber-500/20 hover:shadow-amber-500/30',
  green: 'shadow-green-500/20 hover:shadow-green-500/30',
};

export const SpatialGlassCard = forwardRef<HTMLDivElement, SpatialGlassCardProps>(
  function SpatialGlassCard(
    {
      children,
      variant = 'medium',
      layer = 'raised',
      glow = false,
      glowColor = 'purple',
      interactive = true,
      className,
      ...motionProps
    },
    ref
  ) {
    const glowStyle = glow ? GLOW_STYLES[glowColor] : '';

    return (
      <motion.div
        ref={ref}
        className={cn(
          'relative rounded-xl border',
          VARIANT_STYLES[variant],
          LAYER_STYLES[layer],
          glow && glowStyle,
          interactive && 'transition-all duration-300 cursor-pointer',
          className
        )}
        whileHover={interactive ? {
          scale: LAYER_TRANSFORMS[layer].scale,
          y: LAYER_TRANSFORMS[layer].y,
        } : undefined}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        {...motionProps}
      >
        {/* Gradient Overlay for Glass Effect */}
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent" />
        </div>

        {/* Edge Highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        
        {/* Content */}
        <div className="relative z-10">
          {children}
        </div>
      </motion.div>
    );
  }
);

/**
 * Glass Panel - For larger content areas
 */
interface GlassPanelProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: GlassVariant;
  className?: string;
}

export function GlassPanel({
  children,
  header,
  footer,
  variant = 'medium',
  className,
}: GlassPanelProps) {
  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden',
      VARIANT_STYLES[variant],
      'shadow-xl',
      className
    )}>
      {/* Gradient Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
      </div>

      {header && (
        <div className="relative border-b border-white/10 px-6 py-4">
          {header}
        </div>
      )}

      <div className="relative">
        {children}
      </div>

      {footer && (
        <div className="relative border-t border-white/10 px-6 py-4">
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * Glass Button - Interactive glass-styled button
 */
interface GlassButtonProps {
  children?: React.ReactNode;
  variant?: 'default' | 'primary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export function GlassButton({
  children,
  variant = 'default',
  size = 'md',
  glow = false,
  className,
  onClick,
  disabled,
  type = 'button',
}: GlassButtonProps) {
  const variantStyles = {
    default: 'bg-white/10 hover:bg-white/20 border-white/20',
    primary: 'bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/30 text-purple-300',
    danger: 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30 text-red-300',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center justify-center',
        'rounded-lg border backdrop-blur-sm',
        'font-medium transition-colors',
        variantStyles[variant],
        sizeStyles[size],
        glow && 'shadow-lg shadow-purple-500/20',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
    >
      {/* Highlight */}
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      {children}
    </motion.button>
  );
}

/**
 * Glass Divider - Subtle separator with glass effect
 */
interface GlassDividerProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function GlassDivider({
  orientation = 'horizontal',
  className,
}: GlassDividerProps) {
  return (
    <div className={cn(
      'bg-gradient-to-r from-transparent via-white/10 to-transparent',
      orientation === 'horizontal' ? 'h-px w-full' : 'w-px h-full',
      className
    )} />
  );
}

/**
 * Glass Badge - Status indicator with glass effect
 */
interface GlassBadgeProps {
  children: React.ReactNode;
  color?: 'default' | 'success' | 'warning' | 'error' | 'info';
  pulse?: boolean;
  className?: string;
}

export function GlassBadge({
  children,
  color = 'default',
  pulse = false,
  className,
}: GlassBadgeProps) {
  const colorStyles = {
    default: 'bg-white/10 border-white/20 text-foreground',
    success: 'bg-green-500/20 border-green-500/30 text-green-400',
    warning: 'bg-amber-500/20 border-amber-500/30 text-amber-400',
    error: 'bg-red-500/20 border-red-500/30 text-red-400',
    info: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5',
      'rounded-full border backdrop-blur-sm',
      'text-xs font-medium',
      colorStyles[color],
      className
    )}>
      {pulse && (
        <span className={cn(
          'w-1.5 h-1.5 rounded-full animate-pulse',
          color === 'success' && 'bg-green-400',
          color === 'warning' && 'bg-amber-400',
          color === 'error' && 'bg-red-400',
          color === 'info' && 'bg-blue-400',
          color === 'default' && 'bg-foreground',
        )} />
      )}
      {children}
    </span>
  );
}
