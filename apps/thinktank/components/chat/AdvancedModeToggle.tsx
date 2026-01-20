'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUIStore } from '@/lib/stores/ui-store';
import { cn } from '@/lib/utils';

export function AdvancedModeToggle() {
  const { advancedMode, toggleAdvancedMode } = useUIStore();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleAdvancedMode}
            className={cn(
              'relative overflow-hidden transition-all duration-300',
              advancedMode 
                ? 'bg-violet-500/20 text-violet-400 hover:bg-violet-500/30' 
                : 'text-slate-400 hover:text-slate-300'
            )}
          >
            <AnimatePresence mode="wait">
              {advancedMode ? (
                <motion.div
                  key="advanced"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-2"
                >
                  <Zap className="h-4 w-4" />
                  <span className="text-xs font-medium">Advanced</span>
                </motion.div>
              ) : (
                <motion.div
                  key="auto"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="text-xs font-medium">Auto</span>
                </motion.div>
              )}
            </AnimatePresence>
            
            {advancedMode && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                layoutId="advanced-glow"
              />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">
            {advancedMode 
              ? 'Advanced Mode: Full control over model selection and settings' 
              : 'Auto Mode: Cato handles everything automatically'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Press ⌘+Shift+A to toggle
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
