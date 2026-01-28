'use client';

/**
 * Magic Carpet Navigator
 * 
 * "We are building 'The Magic Carpet.' You don't drive it. You don't write code 
 * for it. You just say where you want to go, and the ground beneath you reshapes 
 * itself to take you there instantly."
 * 
 * Bottom navigation bar for Think Tank with:
 * - Journey breadcrumbs showing navigation history
 * - Destination selector with quick access
 * - Flight animations and trail effects
 * - Pre-cognition suggestions
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, 
  Hammer, 
  Clock, 
  Sparkles, 
  Image, 
  Lock,
  ChevronRight,
  Search,
  Compass,
  Zap,
  GitBranch,
  Eye,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// Types
interface CarpetDestination {
  id: string;
  type: string;
  name: string;
  description?: string;
  icon: string;
  isPreCognized?: boolean;
}

interface JourneyPoint {
  id: string;
  destination: CarpetDestination;
  arrivedAt: Date;
}

interface MagicCarpetNavigatorProps {
  currentDestination?: CarpetDestination | null;
  journey?: JourneyPoint[];
  predictions?: CarpetDestination[];
  telepathyScore?: number;
  mode?: 'resting' | 'flying' | 'hovering' | 'exploring' | 'rewinding' | 'anticipating';
  altitude?: 'ground' | 'low' | 'medium' | 'high' | 'stratosphere';
  onFly?: (destination: CarpetDestination) => void;
  onLand?: () => void;
  onCommand?: (command: string) => void;
  className?: string;
}

// Default destinations
const DEFAULT_DESTINATIONS: CarpetDestination[] = [
  { id: 'dashboard', type: 'dashboard', name: 'Command Center', icon: '🏠', description: 'Overview dashboard' },
  { id: 'workspace', type: 'workspace', name: 'Workshop', icon: '🔨', description: 'Build and create' },
  { id: 'timeline', type: 'timeline', name: 'Time Stream', icon: '⏳', description: 'Reality Scrubber' },
  { id: 'multiverse', type: 'multiverse', name: 'Quantum Realm', icon: '🌌', description: 'Parallel realities' },
  { id: 'oracle', type: 'oracle', name: "Oracle's Chamber", icon: '🔮', description: 'Pre-Cognition' },
  { id: 'gallery', type: 'gallery', name: 'Gallery', icon: '🖼️', description: 'View creations' },
  { id: 'vault', type: 'vault', name: 'Vault', icon: '🔐', description: 'Saved items' },
];

// Icon mapping for destinations
const DESTINATION_ICONS: Record<string, React.ElementType> = {
  dashboard: Home,
  workspace: Hammer,
  timeline: Clock,
  multiverse: GitBranch,
  oracle: Eye,
  gallery: Image,
  vault: Lock,
};

// Mode colors and effects
const MODE_STYLES: Record<string, { glow: string; pulse: boolean; trail: boolean }> = {
  resting: { glow: 'shadow-purple-500/20', pulse: false, trail: false },
  flying: { glow: 'shadow-purple-500/50', pulse: true, trail: true },
  hovering: { glow: 'shadow-purple-500/30', pulse: false, trail: false },
  exploring: { glow: 'shadow-blue-500/40', pulse: true, trail: false },
  rewinding: { glow: 'shadow-amber-500/40', pulse: true, trail: true },
  anticipating: { glow: 'shadow-cyan-500/40', pulse: true, trail: false },
};

export function MagicCarpetNavigator({
  currentDestination,
  journey = [],
  predictions = [],
  telepathyScore = 0,
  mode = 'resting',
  altitude = 'ground',
  onFly,
  onLand,
  onCommand: _onCommand,
  className,
}: MagicCarpetNavigatorProps) {
  void _onCommand; // Reserved for command handling
  const [searchQuery, setSearchQuery] = useState('');
  const [_isExpanded, _setIsExpanded] = useState(false);
  void _isExpanded; void _setIsExpanded; // Reserved for expanded state
  const [showDestinations, setShowDestinations] = useState(false);

  const modeStyle = MODE_STYLES[mode] || MODE_STYLES.resting;

  // Filter destinations based on search
  const filteredDestinations = DEFAULT_DESTINATIONS.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle destination selection
  const handleSelectDestination = useCallback((destination: CarpetDestination) => {
    onFly?.(destination);
    setShowDestinations(false);
    setSearchQuery('');
  }, [onFly]);

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowDestinations(true);
      }
      if (e.key === 'Escape') {
        setShowDestinations(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <TooltipProvider>
      <motion.div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'bg-gradient-to-t from-background/95 via-background/80 to-transparent',
          'backdrop-blur-xl border-t border-border/50',
          'shadow-2xl',
          modeStyle.glow,
          className
        )}
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      >
        {/* Carpet Pattern Overlay */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500" />
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        {/* Main Content */}
        <div className="relative px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center gap-4">
            
            {/* Journey Trail */}
            <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-hide">
              <AnimatePresence mode="popLayout">
                {journey.slice(-5).map((point, index) => {
                  const _Icon = DESTINATION_ICONS[point.destination.type] || Compass;
                  void _Icon; // Reserved for icon display
                  const isLast = index === journey.length - 1;
                  
                  return (
                    <React.Fragment key={point.id}>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8, x: -20 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.8, x: -20 }}
                        transition={{ type: 'spring', damping: 15 }}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                'h-8 px-2 gap-1.5',
                                isLast && 'bg-primary/10 text-primary'
                              )}
                              onClick={() => handleSelectDestination(point.destination)}
                            >
                              <span className="text-base">{point.destination.icon}</span>
                              <span className="text-xs hidden sm:inline">{point.destination.name}</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{point.destination.name}</p>
                            <p className="text-xs text-muted-foreground">{point.destination.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </motion.div>
                      {!isLast && (
                        <ChevronRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                      )}
                    </React.Fragment>
                  );
                })}
              </AnimatePresence>

              {journey.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  ✨ Say where you want to go...
                </span>
              )}
            </div>

            {/* Current Location Indicator */}
            {currentDestination && (
              <motion.div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20"
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring' }}
              >
                <span className="text-lg">{currentDestination.icon}</span>
                <span className="text-sm font-medium">{currentDestination.name}</span>
                {mode === 'flying' && (
                  <motion.div
                    className="w-2 h-2 rounded-full bg-primary"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  />
                )}
              </motion.div>
            )}

            {/* Destination Search */}
            <Popover open={showDestinations} onOpenChange={setShowDestinations}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'gap-2 min-w-[200px] justify-start',
                    'bg-background/50 hover:bg-background/80',
                    'border-border/50'
                  )}
                >
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Fly to...</span>
                  <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">
                    ⌘K
                  </kbd>
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-[350px] p-0" 
                align="end"
                sideOffset={8}
              >
                <div className="p-3 border-b">
                  <Input
                    placeholder="Where do you want to go?"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9"
                    autoFocus
                  />
                </div>
                
                {/* Pre-Cognition Suggestions */}
                {predictions.length > 0 && searchQuery === '' && (
                  <div className="p-2 border-b bg-gradient-to-r from-cyan-500/5 to-purple-500/5">
                    <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                      <Zap className="h-3 w-3 text-cyan-500" />
                      <span>Pre-Cognized</span>
                      {telepathyScore > 0 && (
                        <Badge variant="outline" className="ml-auto text-xs h-5">
                          {Math.round(telepathyScore * 100)}% telepathy
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      {predictions.slice(0, 3).map((pred) => (
                        <motion.button
                          key={pred.id}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-md',
                            'hover:bg-accent text-left',
                            'transition-colors',
                            'ring-1 ring-cyan-500/20'
                          )}
                          onClick={() => handleSelectDestination(pred)}
                          whileHover={{ x: 4 }}
                        >
                          <span className="text-lg">{pred.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{pred.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{pred.description}</p>
                          </div>
                          <Sparkles className="h-4 w-4 text-cyan-500 flex-shrink-0" />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Destination List */}
                <div className="p-2 max-h-[300px] overflow-y-auto">
                  <div className="space-y-1">
                    {filteredDestinations.map((dest) => {
                      const _Icon = DESTINATION_ICONS[dest.type] || Compass;
                      void _Icon; // Reserved for icon display
                      const isCurrent = currentDestination?.id === dest.id;
                      
                      return (
                        <motion.button
                          key={dest.id}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-md',
                            'hover:bg-accent text-left',
                            'transition-colors',
                            isCurrent && 'bg-primary/10'
                          )}
                          onClick={() => handleSelectDestination(dest)}
                          whileHover={{ x: 4 }}
                        >
                          <span className="text-lg">{dest.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{dest.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{dest.description}</p>
                          </div>
                          {isCurrent && (
                            <Badge variant="secondary" className="text-xs">
                              Here
                            </Badge>
                          )}
                          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Mode Indicator */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs',
                  'border',
                  mode === 'resting' && 'border-muted-foreground/30 text-muted-foreground',
                  mode === 'flying' && 'border-purple-500/50 text-purple-500 bg-purple-500/10',
                  mode === 'hovering' && 'border-green-500/50 text-green-500 bg-green-500/10',
                  mode === 'exploring' && 'border-blue-500/50 text-blue-500 bg-blue-500/10',
                  mode === 'rewinding' && 'border-amber-500/50 text-amber-500 bg-amber-500/10',
                  mode === 'anticipating' && 'border-cyan-500/50 text-cyan-500 bg-cyan-500/10',
                )}>
                  {mode === 'flying' && (
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full bg-current"
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{ repeat: Infinity, duration: 0.5 }}
                    />
                  )}
                  <span className="capitalize">{mode}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="capitalize">{altitude}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Carpet Mode: {mode}</p>
                <p className="text-xs text-muted-foreground">Altitude: {altitude}</p>
              </TooltipContent>
            </Tooltip>

            {/* Land Button */}
            {currentDestination && mode !== 'resting' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onLand}
                className="text-muted-foreground hover:text-foreground"
              >
                Land
              </Button>
            )}
          </div>
        </div>

        {/* Flying Trail Effect */}
        <AnimatePresence>
          {mode === 'flying' && modeStyle.trail && (
            <motion.div
              className="absolute inset-x-0 bottom-full h-20 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-purple-500/20 to-transparent" />
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-purple-400/60"
                  style={{ left: `${20 + i * 15}%` }}
                  animate={{
                    y: [0, -40, -80],
                    opacity: [0.8, 0.4, 0],
                    scale: [1, 0.8, 0.5],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.5,
                    delay: i * 0.2,
                    ease: 'easeOut',
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </TooltipProvider>
  );
}
