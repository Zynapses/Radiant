'use client';

/**
 * Eject Dialog - Export Liquid Interface to Next.js App
 * 
 * "Chat becomes App. Export to Next.js."
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Rocket, Github, Globe, Check, 
  Loader2, Package, Database, Lock, Zap, Code
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EjectConfig, EjectFramework, EjectFeature } from '@/lib/api/liquid-interface';

interface EjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  onEject: (config: EjectConfig) => Promise<void>;
}

const FRAMEWORKS: Array<{
  id: EjectFramework;
  name: string;
  icon: string;
  description: string;
}> = [
  { id: 'nextjs', name: 'Next.js', icon: '▲', description: 'React framework with SSR' },
  { id: 'vite', name: 'Vite', icon: '⚡', description: 'Fast build tool for React' },
  { id: 'remix', name: 'Remix', icon: '💿', description: 'Full stack web framework' },
  { id: 'astro', name: 'Astro', icon: '🚀', description: 'Static site generator' },
];

const FEATURES: Array<{
  id: EjectFeature;
  name: string;
  icon: React.ElementType;
  description: string;
}> = [
  { id: 'database', name: 'Database', icon: Database, description: 'PostgreSQL schema & migrations' },
  { id: 'auth', name: 'Authentication', icon: Lock, description: 'User auth scaffolding' },
  { id: 'api', name: 'API Routes', icon: Code, description: 'REST API endpoints' },
  { id: 'ai', name: 'AI Integration', icon: Zap, description: 'OpenAI/Anthropic setup' },
  { id: 'realtime', name: 'Realtime', icon: Globe, description: 'WebSocket support' },
];

const DEPLOY_TARGETS = [
  { id: 'vercel', name: 'Vercel', icon: '▲' },
  { id: 'netlify', name: 'Netlify', icon: '◆' },
  { id: 'github', name: 'GitHub', icon: '⚫' },
  { id: 'zip', name: 'Download ZIP', icon: '📦' },
] as const;

export function EjectDialog({ isOpen, onClose, sessionId, onEject }: EjectDialogProps) {
  const [selectedFramework, setSelectedFramework] = useState<EjectFramework>('nextjs');
  const [selectedFeatures, setSelectedFeatures] = useState<EjectFeature[]>(['api']);
  const [deployTarget, setDeployTarget] = useState<'vercel' | 'netlify' | 'github' | 'zip'>('vercel');
  const [isEjecting, setIsEjecting] = useState(false);
  const [ejectSuccess, setEjectSuccess] = useState(false);

  const toggleFeature = (feature: EjectFeature) => {
    setSelectedFeatures(prev => 
      prev.includes(feature) 
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  };

  const handleEject = async () => {
    setIsEjecting(true);
    try {
      await onEject({
        framework: selectedFramework,
        features: selectedFeatures,
        dependencies: [],
        secrets: [],
        deployTarget,
      });
      setEjectSuccess(true);
    } catch (error) {
      console.error('Eject failed:', error);
    } finally {
      setIsEjecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-[#0d0d14] border border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
                <Rocket className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Export to App</h2>
                <p className="text-xs text-slate-500">Turn your Liquid Interface into a real application</p>
              </div>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <X className="h-5 w-5 text-slate-400" />
            </Button>
          </div>

          {ejectSuccess ? (
            /* Success State */
            <div className="p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4"
              >
                <Check className="h-8 w-8 text-green-400" />
              </motion.div>
              <h3 className="text-xl font-semibold text-white mb-2">Export Complete!</h3>
              <p className="text-slate-400 mb-6">
                Your app has been exported and is ready to deploy.
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
                <Button className="bg-violet-600 hover:bg-violet-700">
                  <Github className="h-4 w-4 mr-2" />
                  View on GitHub
                </Button>
              </div>
            </div>
          ) : (
            /* Configuration Form */
            <div className="overflow-y-auto max-h-[calc(85vh-140px)]">
              {/* Framework Selection */}
              <div className="p-4 border-b border-white/[0.06]">
                <h3 className="text-sm font-medium text-white mb-3">Framework</h3>
                <div className="grid grid-cols-4 gap-2">
                  {FRAMEWORKS.map((fw) => (
                    <button
                      key={fw.id}
                      onClick={() => setSelectedFramework(fw.id)}
                      className={cn(
                        'p-3 rounded-lg border text-left transition-all',
                        selectedFramework === fw.id
                          ? 'border-violet-500/50 bg-violet-500/10'
                          : 'border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02]'
                      )}
                    >
                      <div className="text-2xl mb-1">{fw.icon}</div>
                      <div className="text-sm font-medium text-white">{fw.name}</div>
                      <div className="text-xs text-slate-500">{fw.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Features */}
              <div className="p-4 border-b border-white/[0.06]">
                <h3 className="text-sm font-medium text-white mb-3">Include Features</h3>
                <div className="grid grid-cols-2 gap-2">
                  {FEATURES.map((feature) => {
                    const Icon = feature.icon;
                    const isSelected = selectedFeatures.includes(feature.id);
                    return (
                      <button
                        key={feature.id}
                        onClick={() => toggleFeature(feature.id)}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border text-left transition-all',
                          isSelected
                            ? 'border-violet-500/50 bg-violet-500/10'
                            : 'border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02]'
                        )}
                      >
                        <div className={cn(
                          'p-1.5 rounded-lg',
                          isSelected ? 'bg-violet-500/20 text-violet-400' : 'bg-white/[0.05] text-slate-400'
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">{feature.name}</div>
                          <div className="text-xs text-slate-500">{feature.description}</div>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-violet-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Deploy Target */}
              <div className="p-4">
                <h3 className="text-sm font-medium text-white mb-3">Deploy To</h3>
                <div className="flex gap-2">
                  {DEPLOY_TARGETS.map((target) => (
                    <button
                      key={target.id}
                      onClick={() => setDeployTarget(target.id)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg border transition-all',
                        deployTarget === target.id
                          ? 'border-violet-500/50 bg-violet-500/10 text-violet-400'
                          : 'border-white/[0.06] hover:border-white/[0.12] text-slate-400'
                      )}
                    >
                      <span>{target.icon}</span>
                      <span className="text-sm">{target.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          {!ejectSuccess && (
            <div className="flex items-center justify-between p-4 border-t border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Package className="h-4 w-4" />
                <span>Session: {sessionId.slice(0, 8)}...</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleEject}
                  disabled={isEjecting}
                  className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
                >
                  {isEjecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4 mr-2" />
                      Export App
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
