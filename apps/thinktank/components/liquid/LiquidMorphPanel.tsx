'use client';

/**
 * Liquid Interface Morph Panel
 * 
 * When the AI detects the user needs a tool (spreadsheet, chart, kanban),
 * the chat morphs into that tool. This component renders the morphed view.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Maximize2, Minimize2, MessageSquare, Sparkles, Table, BarChart3, 
  Kanban, Calculator, Code, FileText, Rocket
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlassCard, GlassPanel } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';
import type { LiquidSchema, LiquidIntent } from '@/lib/api/liquid-interface';

export type MorphedViewType = 
  | 'datagrid'
  | 'chart' 
  | 'kanban'
  | 'calculator'
  | 'code_editor'
  | 'document'
  | 'custom';

const VIEW_CONFIG: Record<MorphedViewType, {
  icon: React.ElementType;
  label: string;
  color: string;
  description: string;
}> = {
  datagrid: {
    icon: Table,
    label: 'Data Grid',
    color: 'text-green-400',
    description: 'Interactive spreadsheet view',
  },
  chart: {
    icon: BarChart3,
    label: 'Chart',
    color: 'text-blue-400',
    description: 'Data visualization',
  },
  kanban: {
    icon: Kanban,
    label: 'Kanban Board',
    color: 'text-purple-400',
    description: 'Task management board',
  },
  calculator: {
    icon: Calculator,
    label: 'Calculator',
    color: 'text-orange-400',
    description: 'Interactive calculations',
  },
  code_editor: {
    icon: Code,
    label: 'Code Editor',
    color: 'text-cyan-400',
    description: 'Edit and run code',
  },
  document: {
    icon: FileText,
    label: 'Document',
    color: 'text-amber-400',
    description: 'Rich text document',
  },
  custom: {
    icon: Sparkles,
    label: 'Custom View',
    color: 'text-violet-400',
    description: 'AI-generated interface',
  },
};

interface LiquidMorphPanelProps {
  viewType: MorphedViewType;
  schema?: LiquidSchema;
  intent?: LiquidIntent;
  isFullscreen?: boolean;
  onClose: () => void;
  onToggleFullscreen?: () => void;
  onEject?: () => void;
  onChatToggle?: () => void;
  showChat?: boolean;
  children?: React.ReactNode;
}

export function LiquidMorphPanel({
  viewType,
  // schema used for future dynamic rendering
  intent,
  isFullscreen = false,
  onClose,
  onToggleFullscreen,
  onEject,
  onChatToggle,
  showChat = false,
  children,
}: LiquidMorphPanelProps) {
  const config = VIEW_CONFIG[viewType];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={cn(
        'flex flex-col',
        isFullscreen ? 'fixed inset-0 z-50 bg-[#0a0a0f]' : 'h-full'
      )}
    >
      {/* Header */}
      <GlassPanel blur="md" className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className={cn('p-1.5 rounded-lg bg-white/[0.05]', config.color)}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">{config.label}</h3>
            <p className="text-xs text-slate-500">{config.description}</p>
          </div>
          {intent && (
            <Badge variant="outline" className="text-[10px] text-slate-400">
              {intent.category} • {Math.round(intent.confidence * 100)}%
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {/* Chat Toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onChatToggle}
            className={cn(
              'text-slate-400 hover:text-white',
              showChat && 'bg-violet-500/20 text-violet-400'
            )}
            title="Toggle AI chat"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          
          {/* Eject to Next.js */}
          {onEject && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onEject}
              className="text-slate-400 hover:text-white"
              title="Export to Next.js app"
            >
              <Rocket className="h-4 w-4" />
            </Button>
          )}
          
          {/* Fullscreen */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleFullscreen}
            className="text-slate-400 hover:text-white"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          
          {/* Close */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="text-slate-400 hover:text-red-400"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </GlassPanel>

      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Morphed View */}
        <div className={cn('flex-1 overflow-auto', showChat && 'border-r border-white/[0.06]')}>
          {children || (
            <div className="h-full flex items-center justify-center">
              <GlassCard variant="default" padding="lg" className="text-center max-w-md">
                <Icon className={cn('h-12 w-12 mx-auto mb-4', config.color)} />
                <h3 className="text-lg font-medium text-white mb-2">
                  {config.label} Ready
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  This view will display your {config.label.toLowerCase()} content.
                  Interact with it just like a native app.
                </p>
                <div className="flex justify-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Interactive
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    AI-Assisted
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Exportable
                  </Badge>
                </div>
              </GlassCard>
            </div>
          )}
        </div>
        
        {/* AI Chat Sidebar (when toggled) */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col bg-white/[0.02] overflow-hidden"
            >
              <div className="p-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-400" />
                  <span className="text-sm font-medium text-white">AI Assistant</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Ask questions about your data or request changes
                </p>
              </div>
              <div className="flex-1 p-3 overflow-auto">
                <p className="text-sm text-slate-400 text-center py-8">
                  Chat with Cato about this {config.label.toLowerCase()}...
                </p>
              </div>
              <div className="p-3 border-t border-white/[0.06]">
                <input
                  type="text"
                  placeholder="Ask about your data..."
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/**
 * Morph Transition Effect
 * Animated transition when chat morphs into a tool
 */
export function MorphTransitionEffect({
  isActive,
  // fromType used for future transition animations
  toType,
}: {
  isActive: boolean;
  fromType: string;
  toType: MorphedViewType;
}) {
  const config = VIEW_CONFIG[toType];
  const Icon = config.icon;

  if (!isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="text-center"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className={cn('p-4 rounded-full bg-white/[0.1] mx-auto mb-4', config.color)}
        >
          <Icon className="h-8 w-8" />
        </motion.div>
        <h3 className="text-xl font-semibold text-white mb-2">
          Morphing to {config.label}
        </h3>
        <p className="text-sm text-slate-400">
          Chat becomes app. App becomes whatever you need.
        </p>
      </motion.div>
    </motion.div>
  );
}
