'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { 
  Search, X, Zap, Brain, Code, Sparkles, DollarSign, 
  Clock, Star, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { modelsService } from '@/lib/api/models';
import { cn } from '@/lib/utils';
import type { Model } from '@/lib/api/types';

interface ModelSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModel: string | null;
  onSelectModel: (modelId: string) => void;
}

const CAPABILITY_ICONS: Record<string, React.ElementType> = {
  reasoning: Brain,
  coding: Code,
  creative: Sparkles,
  fast: Zap,
};

export function ModelSelector({ isOpen, onClose, selectedModel, onSelectModel }: ModelSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: ['models'],
    queryFn: () => modelsService.listModels(),
    enabled: isOpen,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['model-categories'],
    queryFn: () => modelsService.listCategories(),
    enabled: isOpen,
  });

  const filteredModels = models.filter((model) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (model.name || '').toLowerCase().includes(query) ||
             model.provider.toLowerCase().includes(query) ||
             model.description?.toLowerCase().includes(query);
    }
    if (selectedCategory) {
      return model.category === selectedCategory;
    }
    return true;
  });

  const handleSelect = (modelId: string) => {
    onSelectModel(modelId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Select Model</h2>
              <Button variant="ghost" size="icon-sm" onClick={onClose}>
                <X className="h-5 w-5 text-slate-400" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="p-3 border-b border-slate-700/50 flex gap-2 overflow-x-auto">
            <Button
              variant={!selectedCategory ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className={!selectedCategory ? 'bg-violet-600' : ''}
            >
              All
            </Button>
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className={selectedCategory === category.id ? 'bg-violet-600' : ''}
              >
                {category.name}
              </Button>
            ))}
          </div>

          {/* Models List */}
          <div className="overflow-y-auto max-h-[50vh] p-3 space-y-2">
            {modelsLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No models found
              </div>
            ) : (
              filteredModels.map((model) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  isSelected={selectedModel === model.id}
                  onSelect={() => handleSelect(model.id)}
                />
              ))
            )}
          </div>

          {/* Auto Mode Option */}
          <div className="p-3 border-t border-slate-700/50">
            <button
              onClick={() => handleSelect('auto')}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg border transition-all',
                selectedModel === 'auto'
                  ? 'bg-violet-500/20 border-violet-500/50'
                  : 'border-slate-700/50 hover:border-slate-600/50'
              )}
            >
              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
                <Sparkles className="h-5 w-5 text-violet-400" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-white">Auto Mode</div>
                <p className="text-sm text-slate-400">
                  Let Cato automatically select the best model for each task
                </p>
              </div>
              {selectedModel === 'auto' && (
                <Check className="h-5 w-5 text-violet-400" />
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ModelCard({ 
  model, 
  isSelected, 
  onSelect 
}: { 
  model: Model; 
  isSelected: boolean; 
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left',
        isSelected
          ? 'bg-violet-500/20 border-violet-500/50'
          : 'border-slate-700/50 hover:border-slate-600/50 bg-slate-800/30'
      )}
    >
      <div className={cn(
        'p-2 rounded-lg',
        model.tier === 'pro' || model.tier === 'enterprise' ? 'bg-amber-500/20' : 'bg-slate-700/50'
      )}>
        <Zap className={cn(
          'h-5 w-5',
          model.tier === 'pro' || model.tier === 'enterprise' ? 'text-amber-400' : 'text-slate-400'
        )} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-white">{model.name}</span>
          {(model.tier === 'pro' || model.tier === 'enterprise') && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
              {model.tier === 'enterprise' ? 'Enterprise' : 'Pro'}
            </Badge>
          )}
          {model.isNew && (
            <Badge variant="glow" className="text-xs">New</Badge>
          )}
        </div>
        <p className="text-sm text-slate-400 line-clamp-1">{model.description}</p>
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            ~{model.avgLatencyMs}ms
          </span>
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            ${model.costPer1kTokens?.toFixed(4)}/1k
          </span>
          {model.contextLength && (
            <span>{(model.contextLength / 1000).toFixed(0)}k context</span>
          )}
        </div>
        {model.capabilities && model.capabilities.length > 0 && (
          <div className="flex items-center gap-1 mt-2">
            {model.capabilities.slice(0, 4).map((cap) => {
              const Icon = CAPABILITY_ICONS[cap] || Star;
              return (
                <Badge key={cap} variant="outline" className="text-xs py-0">
                  <Icon className="h-3 w-3 mr-1" />
                  {cap}
                </Badge>
              );
            })}
          </div>
        )}
      </div>
      {isSelected && (
        <Check className="h-5 w-5 text-violet-400 shrink-0" />
      )}
    </button>
  );
}
