'use client';

/**
 * AuroraBackground - Animated Aurora Gradient Effect
 * 
 * Creates a beautiful animated aurora borealis effect
 * for backgrounds and hero sections.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface AuroraBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  intensity?: 'subtle' | 'medium' | 'strong';
  animate?: boolean;
  colors?: 'violet' | 'cyan' | 'emerald' | 'mixed';
}

const colorPresets = {
  violet: {
    blob1: 'bg-violet-500/30',
    blob2: 'bg-fuchsia-500/20',
    blob3: 'bg-purple-500/25',
  },
  cyan: {
    blob1: 'bg-cyan-500/30',
    blob2: 'bg-blue-500/20',
    blob3: 'bg-teal-500/25',
  },
  emerald: {
    blob1: 'bg-emerald-500/30',
    blob2: 'bg-green-500/20',
    blob3: 'bg-teal-500/25',
  },
  mixed: {
    blob1: 'bg-violet-500/30',
    blob2: 'bg-cyan-500/20',
    blob3: 'bg-fuchsia-500/25',
  },
};

const intensityBlur = {
  subtle: 'blur-[100px]',
  medium: 'blur-[80px]',
  strong: 'blur-[60px]',
};

export function AuroraBackground({
  children,
  className,
  intensity = 'medium',
  animate = true,
  colors = 'violet',
}: AuroraBackgroundProps) {
  const colorSet = colorPresets[colors];

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Aurora blobs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className={cn(
            'absolute -top-1/2 -left-1/4 w-[600px] h-[600px] rounded-full',
            colorSet.blob1,
            intensityBlur[intensity]
          )}
          animate={animate ? {
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.1, 1],
          } : undefined}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
        <motion.div
          className={cn(
            'absolute top-1/4 -right-1/4 w-[500px] h-[500px] rounded-full',
            colorSet.blob2,
            intensityBlur[intensity]
          )}
          animate={animate ? {
            x: [0, -80, 0],
            y: [0, 100, 0],
            scale: [1, 1.2, 1],
          } : undefined}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
        <motion.div
          className={cn(
            'absolute -bottom-1/4 left-1/3 w-[400px] h-[400px] rounded-full',
            colorSet.blob3,
            intensityBlur[intensity]
          )}
          animate={animate ? {
            x: [0, 60, 0],
            y: [0, -40, 0],
            scale: [1, 1.15, 1],
          } : undefined}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </div>

      {/* Content */}
      {children && (
        <div className="relative z-10">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * GlowOrb - Floating glowing orb for decorative effects
 */
export interface GlowOrbProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'violet' | 'cyan' | 'fuchsia' | 'emerald';
  className?: string;
  animate?: boolean;
}

export function GlowOrb({
  size = 'md',
  color = 'violet',
  className,
  animate = true,
}: GlowOrbProps) {
  const sizeStyles = {
    sm: 'w-32 h-32',
    md: 'w-48 h-48',
    lg: 'w-64 h-64',
  };

  const colorStyles = {
    violet: 'bg-violet-500/40 shadow-[0_0_60px_30px_rgba(139,92,246,0.3)]',
    cyan: 'bg-cyan-500/40 shadow-[0_0_60px_30px_rgba(34,211,238,0.3)]',
    fuchsia: 'bg-fuchsia-500/40 shadow-[0_0_60px_30px_rgba(217,70,239,0.3)]',
    emerald: 'bg-emerald-500/40 shadow-[0_0_60px_30px_rgba(52,211,153,0.3)]',
  };

  return (
    <motion.div
      className={cn(
        'rounded-full blur-xl',
        sizeStyles[size],
        colorStyles[color],
        className
      )}
      animate={animate ? {
        scale: [1, 1.2, 1],
        opacity: [0.6, 0.8, 0.6],
      } : undefined}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}
