'use client';

/**
 * Gradient Text & Glow Effects
 * 
 * Modern text styling with animated gradients and glow.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  gradient?: 'violet' | 'cyan' | 'rainbow' | 'gold' | 'emerald';
  animate?: boolean;
}

const gradients = {
  violet: 'from-violet-400 via-fuchsia-400 to-pink-400',
  cyan: 'from-cyan-400 via-blue-400 to-violet-400',
  rainbow: 'from-red-400 via-yellow-400 via-green-400 via-blue-400 to-violet-400',
  gold: 'from-amber-300 via-yellow-400 to-orange-400',
  emerald: 'from-emerald-400 via-teal-400 to-cyan-400',
};

export function GradientText({ 
  children, 
  className, 
  gradient = 'violet',
  animate = false,
}: GradientTextProps) {
  const Component = animate ? motion.span : 'span';
  
  return (
    <Component
      className={cn(
        'bg-gradient-to-r bg-clip-text text-transparent',
        gradients[gradient],
        animate && 'animate-gradient-x bg-[length:200%_auto]',
        className
      )}
      {...(animate ? {
        animate: { backgroundPosition: ['0%', '100%', '0%'] },
        transition: { duration: 5, repeat: Infinity, ease: 'linear' },
      } : {})}
    >
      {children}
    </Component>
  );
}

interface GlowTextProps {
  children: React.ReactNode;
  className?: string;
  color?: 'violet' | 'cyan' | 'amber' | 'emerald' | 'rose';
}

const glowColors = {
  violet: 'text-violet-400 drop-shadow-[0_0_20px_rgba(139,92,246,0.5)]',
  cyan: 'text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]',
  amber: 'text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]',
  emerald: 'text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.5)]',
  rose: 'text-rose-400 drop-shadow-[0_0_20px_rgba(251,113,133,0.5)]',
};

export function GlowText({ children, className, color = 'violet' }: GlowTextProps) {
  return (
    <span className={cn(glowColors[color], className)}>
      {children}
    </span>
  );
}

/**
 * Animated counter for stats
 */
interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
  suffix?: string;
  prefix?: string;
}

export function AnimatedNumber({ 
  value, 
  duration = 1, 
  className,
  suffix = '',
  prefix = '',
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = React.useState(0);
  
  React.useEffect(() => {
    const startTime = Date.now();
    let startValue = 0;
    setDisplayValue(prev => {
      startValue = prev;
      return prev;
    });
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      
      // Easing function
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (value - startValue) * eased);
      
      setDisplayValue(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);
  
  return (
    <span className={className}>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
}

/**
 * Typing effect for text
 */
interface TypewriterProps {
  text: string;
  delay?: number;
  className?: string;
  onComplete?: () => void;
}

export function Typewriter({ text, delay = 30, className, onComplete }: TypewriterProps) {
  const [displayText, setDisplayText] = React.useState('');
  const [currentIndex, setCurrentIndex] = React.useState(0);
  
  React.useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, delay);
      
      return () => clearTimeout(timeout);
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, text, delay, onComplete]);
  
  React.useEffect(() => {
    setDisplayText('');
    setCurrentIndex(0);
  }, [text]);
  
  return (
    <span className={className}>
      {displayText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
        className="inline-block w-[2px] h-[1em] bg-current ml-0.5 align-middle"
      />
    </span>
  );
}
