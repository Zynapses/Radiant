'use client';

/**
 * Modern Empty States
 * 
 * Beautiful illustrations and animations for empty content.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, History, Sparkles, 
  Zap, Search, Star, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { GradientText } from '@/components/ui/gradient-text';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  type: 'chat' | 'history' | 'artifacts' | 'search' | 'rules';
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const configs = {
  chat: {
    icon: MessageSquare,
    title: 'Start a conversation',
    description: 'Ask Cato anything. Get intelligent answers powered by 106+ AI models.',
    gradient: 'violet' as const,
  },
  history: {
    icon: History,
    title: 'No conversations yet',
    description: 'Your chat history will appear here. Start exploring!',
    gradient: 'cyan' as const,
  },
  artifacts: {
    icon: Layers,
    title: 'No artifacts created',
    description: 'Code, documents, and files generated in chats will show here.',
    gradient: 'emerald' as const,
  },
  search: {
    icon: Search,
    title: 'No results found',
    description: 'Try adjusting your search or filters.',
    gradient: 'gold' as const,
  },
  rules: {
    icon: Star,
    title: 'No rules configured',
    description: 'Add rules to customize how Cato responds to you.',
    gradient: 'violet' as const,
  },
};

export function EmptyState({ 
  type, 
  title, 
  description, 
  action,
  className,
}: EmptyStateProps) {
  const config = configs[type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn('flex flex-col items-center justify-center py-16 px-4', className)}
    >
      {/* Animated Icon */}
      <motion.div
        className="relative mb-6"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 blur-2xl opacity-30">
          <div className={cn(
            'w-20 h-20 rounded-full',
            config.gradient === 'violet' && 'bg-violet-500',
            config.gradient === 'cyan' && 'bg-cyan-500',
            config.gradient === 'emerald' && 'bg-emerald-500',
            config.gradient === 'gold' && 'bg-amber-500',
          )} />
        </div>
        
        {/* Icon container */}
        <GlassCard 
          variant="elevated" 
          padding="lg" 
          className="relative"
        >
          <Icon className={cn(
            'h-10 w-10',
            config.gradient === 'violet' && 'text-violet-400',
            config.gradient === 'cyan' && 'text-cyan-400',
            config.gradient === 'emerald' && 'text-emerald-400',
            config.gradient === 'gold' && 'text-amber-400',
          )} />
        </GlassCard>
        
        {/* Decorative sparkles */}
        <motion.div
          className="absolute -top-2 -right-2"
          animate={{ rotate: 360, scale: [1, 1.2, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <Sparkles className="h-4 w-4 text-violet-400/60" />
        </motion.div>
      </motion.div>

      {/* Title */}
      <h3 className="text-xl font-semibold text-white mb-2 text-center">
        <GradientText gradient={config.gradient}>
          {title || config.title}
        </GradientText>
      </h3>

      {/* Description */}
      <p className="text-slate-400 text-center max-w-sm mb-6">
        {description || config.description}
      </p>

      {/* Action button */}
      {action && (
        <Button
          onClick={action.onClick}
          className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
        >
          <Zap className="h-4 w-4 mr-2" />
          {action.label}
        </Button>
      )}
    </motion.div>
  );
}

/**
 * Welcome Hero - First-time user experience
 */
export function WelcomeHero({ onStart }: { onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-[60vh] px-4"
    >
      {/* Animated logo/brand */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring' }}
        className="relative mb-8"
      >
        <motion.div
          className="absolute inset-0 blur-3xl opacity-40 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 rounded-full"
          animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
        <div className="relative p-6 rounded-3xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-white/10">
          <Sparkles className="h-12 w-12 text-violet-400" />
        </div>
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-4xl font-bold text-center mb-4"
      >
        <GradientText gradient="violet" animate>
          Welcome to Think Tank
        </GradientText>
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-lg text-slate-400 text-center max-w-md mb-8"
      >
        Your intelligent AI assistant powered by 106+ models.
        Ask anything, create anything.
      </motion.p>

      {/* CTA */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <Button
          size="lg"
          onClick={onStart}
          className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-500/25"
        >
          <MessageSquare className="h-5 w-5 mr-2" />
          Start a conversation
        </Button>
      </motion.div>

      {/* Features grid */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="grid grid-cols-3 gap-4 mt-12 max-w-lg"
      >
        {[
          { icon: Zap, label: '106+ Models' },
          { icon: Layers, label: 'Multi-Agent' },
          { icon: Star, label: 'Personalized' },
        ].map((feature, i) => (
          <div 
            key={i}
            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]"
          >
            <feature.icon className="h-5 w-5 text-violet-400" />
            <span className="text-xs text-slate-400">{feature.label}</span>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
