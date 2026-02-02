'use client';

/**
 * Domain Selector Component
 * 
 * Allows users to select their domain expertise context for improved
 * AI responses via Domain Expert Cortex integration.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Search,
  Stethoscope,
  Scale,
  DollarSign,
  GraduationCap,
  Laptop,
  Dumbbell,
  Beaker,
  BookOpen,
  X,
  Check,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
// Note: Input component may need to be created or imported from shared UI
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export interface Domain {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  fieldId?: string;
  fieldName?: string;
}

interface DomainSelectorProps {
  selectedDomain?: Domain | null;
  onSelectDomain: (domain: Domain | null) => void;
  className?: string;
  compact?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  healthcare: <Stethoscope className="h-4 w-4" />,
  legal: <Scale className="h-4 w-4" />,
  finance: <DollarSign className="h-4 w-4" />,
  education: <GraduationCap className="h-4 w-4" />,
  technology: <Laptop className="h-4 w-4" />,
  fitness: <Dumbbell className="h-4 w-4" />,
  science: <Beaker className="h-4 w-4" />,
  default: <BookOpen className="h-4 w-4" />,
};

const POPULAR_DOMAINS: Domain[] = [
  { id: 'healthcare', name: 'Healthcare', description: 'Medical, clinical, pharmaceutical', fieldId: 'medicine', fieldName: 'Medicine & Health' },
  { id: 'legal', name: 'Legal', description: 'Law, contracts, regulations', fieldId: 'law', fieldName: 'Law & Legal' },
  { id: 'finance', name: 'Finance', description: 'Investment, banking, markets', fieldId: 'finance', fieldName: 'Finance & Economics' },
  { id: 'technology', name: 'Technology', description: 'Software, hardware, AI/ML', fieldId: 'tech', fieldName: 'Technology' },
  { id: 'education', name: 'Education', description: 'Teaching, curriculum, learning', fieldId: 'education', fieldName: 'Education' },
  { id: 'science', name: 'Science', description: 'Research, experiments, discovery', fieldId: 'science', fieldName: 'Science' },
];

// =============================================================================
// Component
// =============================================================================

export function DomainSelector({
  selectedDomain,
  onSelectDomain,
  className,
  compact = false,
}: DomainSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [domains, setDomains] = useState<Domain[]>(POPULAR_DOMAINS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchDomains(searchQuery);
    } else {
      setDomains(POPULAR_DOMAINS);
    }
  }, [searchQuery]);

  const searchDomains = async (query: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v2/domain-taxonomy/search?q=${encodeURIComponent(query)}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setDomains(data.results || POPULAR_DOMAINS);
      }
    } catch {
      // Fallback to defaults
      setDomains(POPULAR_DOMAINS);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (domain: Domain | null) => {
    onSelectDomain(domain);
    setIsOpen(false);
    setSearchQuery('');

    // Save user selection
    if (domain) {
      try {
        await fetch('/api/v2/domain-taxonomy/user-selection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain_id: domain.id,
            field_id: domain.fieldId,
            is_default: false,
          }),
        });
      } catch {
        // Silent fail for non-critical
      }
    }
  };

  const getIcon = (domain: Domain) => {
    const iconKey = domain.id.toLowerCase();
    return DOMAIN_ICONS[iconKey] || DOMAIN_ICONS.default;
  };

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={cn(
          "h-7 px-2 gap-1.5 text-xs",
          selectedDomain 
            ? "text-violet-400 hover:text-violet-300" 
            : "text-slate-400 hover:text-slate-200",
          className
        )}
      >
        {selectedDomain ? getIcon(selectedDomain) : <Sparkles className="h-3.5 w-3.5" />}
        {selectedDomain?.name || 'Auto'}
        <ChevronDown className="h-3 w-3" />
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={cn(
          "gap-2 text-sm",
          selectedDomain 
            ? "text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20" 
            : "text-slate-400 hover:text-slate-200",
          className
        )}
      >
        {selectedDomain ? (
          <>
            {getIcon(selectedDomain)}
            <span>{selectedDomain.name}</span>
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            <span>Auto Domain</span>
          </>
        )}
        <ChevronDown className="h-4 w-4" />
      </Button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setIsOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-1/4 z-50 max-w-md mx-auto"
            >
              <GlassCard className="overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
                  <div>
                    <h3 className="font-semibold text-white">Select Domain</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Choose your expertise area for optimized responses
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(false)}
                    className="h-8 w-8 text-slate-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Search */}
                <div className="p-3 border-b border-white/[0.06]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                      placeholder="Search domains..."
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                    />
                  </div>
                </div>

                {/* Auto Option */}
                <div className="p-2 border-b border-white/[0.06]">
                  <button
                    onClick={() => handleSelect(null)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
                      !selectedDomain
                        ? "bg-violet-500/20 border border-violet-500/30"
                        : "hover:bg-white/[0.04]"
                    )}
                  >
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center",
                      !selectedDomain ? "bg-violet-500/30" : "bg-white/[0.06]"
                    )}>
                      <Sparkles className="h-5 w-5 text-violet-400" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-white text-sm">Auto Detect</p>
                      <p className="text-xs text-slate-400">
                        Let Cato detect the domain from your message
                      </p>
                    </div>
                    {!selectedDomain && (
                      <Check className="h-5 w-5 text-violet-400" />
                    )}
                  </button>
                </div>

                {/* Domain List */}
                <div className="max-h-64 overflow-y-auto p-2">
                  {loading ? (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      Searching...
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {domains.map((domain) => (
                        <button
                          key={domain.id}
                          onClick={() => handleSelect(domain)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
                            selectedDomain?.id === domain.id
                              ? "bg-violet-500/20 border border-violet-500/30"
                              : "hover:bg-white/[0.04]"
                          )}
                        >
                          <div className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center",
                            selectedDomain?.id === domain.id ? "bg-violet-500/30" : "bg-white/[0.06]"
                          )}>
                            {getIcon(domain)}
                          </div>
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-white text-sm">{domain.name}</p>
                              {domain.fieldName && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-slate-400 border-slate-700">
                                  {domain.fieldName}
                                </Badge>
                              )}
                            </div>
                            {domain.description && (
                              <p className="text-xs text-slate-400 mt-0.5">{domain.description}</p>
                            )}
                          </div>
                          {selectedDomain?.id === domain.id && (
                            <Check className="h-5 w-5 text-violet-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-white/[0.06] bg-white/[0.02]">
                  <p className="text-[10px] text-slate-500 text-center">
                    Domain selection optimizes responses using Domain Expert Cortex
                  </p>
                </div>
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
