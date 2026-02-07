'use client';

/**
 * Collaboration Presence Components
 * RADIANT v5.53.0
 * 
 * Real-time collaboration UI for CRDT workflow editing:
 * - Collaborator avatars with presence indicators
 * - Live cursor positions
 * - Selection highlights
 * - Presence awareness sidebar
 * 
 * Uses glass UI design system for modern 2026+ aesthetics.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { Users, Eye, MousePointer2, Edit3 } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface Collaborator {
  clientId: string;
  userId: string;
  userName: string;
  color: string;
  cursor?: { x: number; y: number };
  selectedNodeIds: string[];
  lastSeen: string;
  isTyping?: boolean;
  currentAction?: 'viewing' | 'editing' | 'selecting';
}

export interface CollaborationPresenceProps {
  collaborators: Collaborator[];
  currentUserId?: string;
  onCollaboratorClick?: (collaborator: Collaborator) => void;
  className?: string;
}

// =============================================================================
// Collaborator Avatar
// =============================================================================

export function CollaboratorAvatar({
  collaborator,
  size = 'md',
  showStatus = true,
  onClick,
}: {
  collaborator: Collaborator;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  onClick?: () => void;
}) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  const statusSizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  const initials = collaborator.userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  const isOnline = new Date(collaborator.lastSeen).getTime() > Date.now() - 30000;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            onClick={onClick}
            className={cn(
              'relative rounded-full flex items-center justify-center font-medium',
              'ring-2 ring-offset-2 ring-offset-background transition-all',
              'hover:scale-110 focus:outline-none focus:ring-offset-4',
              sizeClasses[size]
            )}
            style={{ 
              backgroundColor: collaborator.color,
              ['--tw-ring-color' as string]: collaborator.color,
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-white drop-shadow-sm">{initials}</span>
            
            {showStatus && (
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-background',
                  statusSizeClasses[size],
                  isOnline ? 'bg-emerald-500' : 'bg-zinc-400'
                )}
              />
            )}
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="flex flex-col gap-1">
            <span className="font-medium">{collaborator.userName}</span>
            <span className="text-muted-foreground">
              {collaborator.currentAction === 'editing' && 'Editing workflow'}
              {collaborator.currentAction === 'selecting' && `Selected ${collaborator.selectedNodeIds.length} nodes`}
              {collaborator.currentAction === 'viewing' && 'Viewing'}
              {!collaborator.currentAction && (isOnline ? 'Online' : 'Away')}
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// =============================================================================
// Collaborator Stack (Overlapping Avatars)
// =============================================================================

export function CollaboratorStack({
  collaborators,
  maxVisible = 4,
  onViewAll,
  className,
}: {
  collaborators: Collaborator[];
  maxVisible?: number;
  onViewAll?: () => void;
  className?: string;
}) {
  const visible = collaborators.slice(0, maxVisible);
  const overflow = collaborators.length - maxVisible;

  return (
    <div className={cn('flex items-center', className)}>
      <div className="flex -space-x-2">
        <AnimatePresence>
          {visible.map((collaborator, index) => (
            <motion.div
              key={collaborator.clientId}
              initial={{ opacity: 0, scale: 0.5, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.5, x: -10 }}
              transition={{ delay: index * 0.05 }}
              style={{ zIndex: visible.length - index }}
            >
              <CollaboratorAvatar collaborator={collaborator} size="sm" />
            </motion.div>
          ))}
        </AnimatePresence>
        
        {overflow > 0 && (
          <motion.button
            onClick={onViewAll}
            className={cn(
              'w-6 h-6 rounded-full bg-zinc-700 text-white text-xs',
              'flex items-center justify-center font-medium',
              'ring-2 ring-offset-2 ring-offset-background ring-zinc-600',
              'hover:bg-zinc-600 transition-colors'
            )}
            whileHover={{ scale: 1.1 }}
          >
            +{overflow}
          </motion.button>
        )}
      </div>
      
      {collaborators.length > 0 && (
        <span className="ml-3 text-xs text-muted-foreground">
          {collaborators.length} {collaborators.length === 1 ? 'collaborator' : 'collaborators'}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// Live Cursor
// =============================================================================

export function LiveCursor({
  collaborator,
  containerRef,
}: {
  collaborator: Collaborator;
  containerRef?: React.RefObject<HTMLElement>;
}) {
  if (!collaborator.cursor) return null;

  return (
    <motion.div
      className="absolute pointer-events-none z-50"
      initial={{ opacity: 0, scale: 0 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        x: collaborator.cursor.x,
        y: collaborator.cursor.y,
      }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    >
      <MousePointer2 
        className="w-4 h-4 drop-shadow-lg" 
        style={{ color: collaborator.color }}
        fill={collaborator.color}
      />
      <div
        className="ml-4 -mt-1 px-2 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap"
        style={{ backgroundColor: collaborator.color }}
      >
        {collaborator.userName.split(' ')[0]}
      </div>
    </motion.div>
  );
}

// =============================================================================
// Selection Highlight
// =============================================================================

export function SelectionHighlight({
  nodeId,
  collaborator,
  position,
  size,
}: {
  nodeId: string;
  collaborator: Collaborator;
  position: { x: number; y: number };
  size: { width: number; height: number };
}) {
  return (
    <motion.div
      className="absolute pointer-events-none rounded-lg"
      style={{
        left: position.x - 4,
        top: position.y - 4,
        width: size.width + 8,
        height: size.height + 8,
        border: `2px solid ${collaborator.color}`,
        boxShadow: `0 0 0 2px ${collaborator.color}20`,
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <div
        className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
        style={{ backgroundColor: collaborator.color }}
      >
        {collaborator.userName.split(' ')[0]}
      </div>
    </motion.div>
  );
}

// =============================================================================
// Presence Sidebar
// =============================================================================

export function PresenceSidebar({
  collaborators,
  currentUserId,
  isOpen,
  onClose,
}: {
  collaborators: Collaborator[];
  currentUserId?: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const others = collaborators.filter(c => c.userId !== currentUserId);
  const online = others.filter(c => new Date(c.lastSeen).getTime() > Date.now() - 30000);
  const away = others.filter(c => new Date(c.lastSeen).getTime() <= Date.now() - 30000);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className={cn(
            'fixed right-0 top-16 bottom-0 w-72 z-40',
            'bg-background/80 backdrop-blur-xl border-l border-white/10',
            'p-4 overflow-y-auto'
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              Collaborators
            </h3>
            <Badge variant="secondary" className="text-xs">
              {online.length} online
            </Badge>
          </div>

          {online.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                Online Now
              </h4>
              <div className="space-y-2">
                {online.map(collaborator => (
                  <CollaboratorListItem 
                    key={collaborator.clientId} 
                    collaborator={collaborator} 
                  />
                ))}
              </div>
            </div>
          )}

          {away.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                Away
              </h4>
              <div className="space-y-2 opacity-60">
                {away.map(collaborator => (
                  <CollaboratorListItem 
                    key={collaborator.clientId} 
                    collaborator={collaborator} 
                  />
                ))}
              </div>
            </div>
          )}

          {others.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No other collaborators yet
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CollaboratorListItem({ collaborator }: { collaborator: Collaborator }) {
  const ActionIcon = collaborator.currentAction === 'editing' 
    ? Edit3 
    : collaborator.currentAction === 'selecting' 
    ? MousePointer2 
    : Eye;

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
      <CollaboratorAvatar collaborator={collaborator} size="md" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{collaborator.userName}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <ActionIcon className="w-3 h-3" />
          {collaborator.currentAction === 'editing' && 'Editing'}
          {collaborator.currentAction === 'selecting' && `${collaborator.selectedNodeIds.length} selected`}
          {collaborator.currentAction === 'viewing' && 'Viewing'}
          {!collaborator.currentAction && 'Idle'}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Collaboration Presence Bar
// =============================================================================

export function CollaborationPresenceBar({
  collaborators,
  currentUserId,
  onToggleSidebar,
  className,
}: CollaborationPresenceProps & { onToggleSidebar?: () => void }) {
  const others = collaborators.filter(c => c.userId !== currentUserId);
  const editing = others.filter(c => c.currentAction === 'editing');

  return (
    <div className={cn(
      'flex items-center gap-4 px-3 py-2 rounded-lg',
      'bg-white/[0.03] backdrop-blur-md border border-white/[0.06]',
      className
    )}>
      <CollaboratorStack 
        collaborators={others} 
        maxVisible={5}
        onViewAll={onToggleSidebar}
      />
      
      {editing.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Edit3 className="w-3 h-3" />
          <span>
            {editing.length === 1 
              ? `${editing[0].userName.split(' ')[0]} is editing`
              : `${editing.length} people editing`
            }
          </span>
        </div>
      )}
      
      <button
        onClick={onToggleSidebar}
        className="ml-auto p-1.5 rounded hover:bg-white/10 transition-colors"
      >
        <Users className="w-4 h-4" />
      </button>
    </div>
  );
}

export default CollaborationPresenceBar;
