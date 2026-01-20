'use client';

/**
 * Modern Button Variants
 * 
 * Enhanced buttons with glow effects, gradients, and micro-interactions.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModernButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'glow' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function ModernButton({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading,
  leftIcon,
  rightIcon,
  disabled,
  ...props
}: ModernButtonProps) {
  const baseStyles = cn(
    'relative inline-flex items-center justify-center font-medium',
    'transition-all duration-200 ease-out',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  );

  const variants = {
    primary: cn(
      'bg-gradient-to-r from-violet-600 to-fuchsia-600',
      'hover:from-violet-500 hover:to-fuchsia-500',
      'active:from-violet-700 active:to-fuchsia-700',
      'text-white shadow-lg shadow-violet-500/25',
      'hover:shadow-xl hover:shadow-violet-500/30',
      'hover:-translate-y-0.5 active:translate-y-0',
    ),
    secondary: cn(
      'bg-white/[0.06] border border-white/[0.1]',
      'hover:bg-white/[0.1] hover:border-white/[0.2]',
      'active:bg-white/[0.08]',
      'text-white',
    ),
    ghost: cn(
      'bg-transparent',
      'hover:bg-white/[0.06]',
      'active:bg-white/[0.08]',
      'text-slate-400 hover:text-white',
    ),
    glow: cn(
      'bg-gradient-to-r from-violet-600 to-fuchsia-600',
      'text-white',
      'shadow-[0_0_20px_rgba(139,92,246,0.5)]',
      'hover:shadow-[0_0_30px_rgba(139,92,246,0.6)]',
      'hover:-translate-y-0.5 active:translate-y-0',
    ),
    outline: cn(
      'bg-transparent border-2 border-violet-500/50',
      'hover:bg-violet-500/10 hover:border-violet-500',
      'text-violet-400 hover:text-violet-300',
    ),
  };

  const sizes = {
    sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
    md: 'h-10 px-4 text-sm rounded-xl gap-2',
    lg: 'h-12 px-6 text-base rounded-xl gap-2.5',
  };

  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      onClick={props.onClick}
      type={props.type}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : leftIcon ? (
        <span className="shrink-0">{leftIcon}</span>
      ) : null}
      <span>{children}</span>
      {rightIcon && !isLoading && (
        <span className="shrink-0">{rightIcon}</span>
      )}
    </motion.button>
  );
}

/**
 * Icon-only button with tooltip
 */
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  variant?: 'default' | 'ghost' | 'glow';
  size?: 'sm' | 'md' | 'lg';
}

export function IconButton({
  icon,
  label,
  className,
  variant = 'default',
  size = 'md',
  ...props
}: IconButtonProps) {
  const variants = {
    default: 'bg-white/[0.06] hover:bg-white/[0.1] text-slate-400 hover:text-white',
    ghost: 'bg-transparent hover:bg-white/[0.06] text-slate-400 hover:text-white',
    glow: 'bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 hover:text-violet-300 hover:shadow-[0_0_15px_rgba(139,92,246,0.3)]',
  };

  const sizes = {
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-11 w-11',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        'inline-flex items-center justify-center rounded-lg transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
        variants[variant],
        sizes[size],
        className
      )}
      title={label}
      aria-label={label}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {icon}
    </motion.button>
  );
}

/**
 * Pill button for tags/filters
 */
interface PillButtonProps {
  children: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

export function PillButton({ children, isActive, onClick, className }: PillButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
        isActive
          ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25'
          : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.1] hover:text-white',
        className
      )}
    >
      {children}
    </motion.button>
  );
}
