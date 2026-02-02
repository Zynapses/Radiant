'use client';

/**
 * Cartridge Indicator Component
 * 
 * Shows active cartridges (.RADz knowledge bundles) for the current session.
 * Integrates with the Cartridge System from v6.0.0 Neural Architecture.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  ChevronDown,
  ChevronUp,
  Layers,
  Shield,
  User,
  Building2,
  Globe,
  X,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export type CartridgeScope = 'system' | 'tenant' | 'user';

export interface ActiveCartridge {
  id: string;
  name: string;
  version: string;
  scope: CartridgeScope;
  domainId?: string;
  priority: number;
  isActive: boolean;
}

interface CartridgeIndicatorProps {
  cartridges?: ActiveCartridge[];
  onToggleCartridge?: (cartridgeId: string) => void;
  className?: string;
  compact?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const SCOPE_ICONS: Record<CartridgeScope, React.ReactNode> = {
  system: <Globe className="h-3.5 w-3.5" />,
  tenant: <Building2 className="h-3.5 w-3.5" />,
  user: <User className="h-3.5 w-3.5" />,
};

const SCOPE_COLORS: Record<CartridgeScope, string> = {
  system: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
  tenant: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
  user: 'text-green-400 bg-green-500/20 border-green-500/30',
};

const SCOPE_LABELS: Record<CartridgeScope, string> = {
  system: 'System',
  tenant: 'Organization',
  user: 'Personal',
};

// =============================================================================
// Component
// =============================================================================

export function CartridgeIndicator({
  cartridges: propCartridges,
  onToggleCartridge,
  className,
  compact = false,
}: CartridgeIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [cartridges, setCartridges] = useState<ActiveCartridge[]>(propCartridges || []);
  const [loading, setLoading] = useState(!propCartridges);

  useEffect(() => {
    if (!propCartridges) {
      fetchActiveCartridges();
    }
  }, [propCartridges]);

  const fetchActiveCartridges = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/cartridges/active');
      if (response.ok) {
        const data = await response.json();
        setCartridges(data.cartridges || []);
      }
    } catch {
      // Use mock data for development
      setCartridges([
        { id: 'sys-1', name: 'RADIANT Core', version: '6.0.0', scope: 'system', priority: 100, isActive: true },
        { id: 'sys-2', name: 'Safety Framework', version: '2.1.0', scope: 'system', priority: 99, isActive: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const activeCount = cartridges.filter(c => c.isActive).length;
  const totalCount = cartridges.length;

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 text-slate-500 text-xs", className)}>
        <Package className="h-3.5 w-3.5 animate-pulse" />
        <span>Loading...</span>
      </div>
    );
  }

  if (totalCount === 0) {
    return null;
  }

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "h-6 px-2 gap-1 text-[10px] text-slate-400 hover:text-slate-200",
          className
        )}
      >
        <Layers className="h-3 w-3" />
        {activeCount} active
      </Button>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Trigger Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "gap-2 text-xs",
          activeCount > 0
            ? "text-emerald-400 hover:text-emerald-300"
            : "text-slate-400 hover:text-slate-200"
        )}
      >
        <Package className="h-4 w-4" />
        <span>{activeCount} Cartridge{activeCount !== 1 ? 's' : ''}</span>
        {isExpanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </Button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isExpanded && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsExpanded(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 z-50 w-72"
            >
              <GlassCard className="overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-3 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-400" />
                    <span className="font-medium text-white text-sm">Active Cartridges</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsExpanded(false)}
                    className="h-6 w-6 text-slate-400 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Cartridge List */}
                <div className="max-h-64 overflow-y-auto p-2">
                  {cartridges.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-sm">
                      No cartridges loaded
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {cartridges.map((cartridge) => (
                        <CartridgeItem
                          key={cartridge.id}
                          cartridge={cartridge}
                          onToggle={onToggleCartridge}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-2 border-t border-white/[0.06] bg-white/[0.02]">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <Info className="h-3 w-3" />
                    <span>Cartridges provide domain-specific knowledge</span>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// CartridgeItem Sub-component
// =============================================================================

function CartridgeItem({
  cartridge,
  onToggle: _onToggle,
}: {
  cartridge: ActiveCartridge;
  onToggle?: (id: string) => void;
}) {
  const scopeColor = SCOPE_COLORS[cartridge.scope];

  return (
    <motion.div
      layout
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-lg transition-colors",
        cartridge.isActive
          ? "bg-white/[0.04]"
          : "bg-transparent opacity-60"
      )}
    >
      {/* Icon */}
      <div className={cn(
        "h-8 w-8 rounded-lg flex items-center justify-center border",
        scopeColor
      )}>
        <Package className="h-4 w-4" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white text-sm truncate">
            {cartridge.name}
          </span>
          <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
            v{cartridge.version}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {SCOPE_ICONS[cartridge.scope]}
          <span className="text-[10px] text-slate-400">
            {SCOPE_LABELS[cartridge.scope]}
          </span>
          {cartridge.priority > 90 && (
            <Shield className="h-3 w-3 text-amber-400" />
          )}
        </div>
      </div>

      {/* Status */}
      <div
        className={cn(
          "h-2 w-2 rounded-full shrink-0",
          cartridge.isActive ? "bg-emerald-400" : "bg-slate-600"
        )}
        title={cartridge.isActive ? "Active" : "Inactive"}
      />
    </motion.div>
  );
}
