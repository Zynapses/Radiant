'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch,
  GitMerge,
  GitPullRequest,
  Plus,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Clock,
  User,
  MoreHorizontal,
  Trash2,
  Edit2,
  Eye,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface Branch {
  id: string;
  name: string;
  parentBranchId?: string;
  sourceMessageId?: string;
  createdBy: string;
  createdByName?: string;
  createdByColor?: string;
  createdAt: Date;
  messageCount: number;
  lastActivity?: Date;
  status: 'active' | 'merged' | 'archived';
  mergeRequests?: MergeRequest[];
}

interface MergeRequest {
  id: string;
  sourceBranchId: string;
  targetBranchId: string;
  status: 'pending' | 'approved' | 'rejected' | 'merged';
  createdBy: string;
  createdAt: Date;
  reviewers?: string[];
}

interface BranchVisualizationProps {
  branches: Branch[];
  currentBranchId: string;
  onSwitchBranch: (branchId: string) => void;
  onCreateBranch: (name: string, parentBranchId: string, sourceMessageId?: string) => Promise<void>;
  onMergeBranch: (sourceBranchId: string, targetBranchId: string) => Promise<void>;
  onDeleteBranch: (branchId: string) => Promise<void>;
  onRenameBranch: (branchId: string, newName: string) => Promise<void>;
}

export function BranchVisualization({
  branches,
  currentBranchId,
  onSwitchBranch,
  onCreateBranch,
  onMergeBranch,
  onDeleteBranch,
  onRenameBranch,
}: BranchVisualizationProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [selectedMergeSource, setSelectedMergeSource] = useState<string | null>(null);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set(['main']));
  const [viewMode, setViewMode] = useState<'tree' | 'timeline'>('tree');

  // Build branch tree
  const branchTree = useMemo(() => {
    const rootBranches = branches.filter((b) => !b.parentBranchId);
    const childMap = new Map<string, Branch[]>();
    
    branches.forEach((branch) => {
      if (branch.parentBranchId) {
        const children = childMap.get(branch.parentBranchId) || [];
        children.push(branch);
        childMap.set(branch.parentBranchId, children);
      }
    });

    return { rootBranches, childMap };
  }, [branches]);

  const toggleExpanded = (branchId: string) => {
    setExpandedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branchId)) {
        next.delete(branchId);
      } else {
        next.add(branchId);
      }
      return next;
    });
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    await onCreateBranch(newBranchName, currentBranchId);
    setNewBranchName('');
    setShowCreateDialog(false);
  };

  const handleMerge = async () => {
    if (!selectedMergeSource) return;
    await onMergeBranch(selectedMergeSource, currentBranchId);
    setSelectedMergeSource(null);
    setShowMergeDialog(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Conversation Branches
          </h3>
          <p className="text-sm text-muted-foreground">
            Explore different conversation paths without losing context
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === 'tree' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('tree')}
                >
                  <GitBranch className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Tree view</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === 'timeline' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('timeline')}
                >
                  <Clock className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Timeline view</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button size="sm" onClick={() => setShowCreateDialog(true)} className="gap-1">
            <Plus className="h-4 w-4" />
            New Branch
          </Button>
        </div>
      </div>

      {/* Current Branch Indicator */}
      <div className="px-4 py-3 bg-primary/5 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="font-medium">
              {branches.find((b) => b.id === currentBranchId)?.name || 'Main'}
            </span>
            <Badge variant="outline" className="text-xs">Current</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowMergeDialog(true)} className="gap-1">
            <GitMerge className="h-4 w-4" />
            Merge
          </Button>
        </div>
      </div>

      {/* Branch List */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {viewMode === 'tree' ? (
            <div className="space-y-1">
              {branchTree.rootBranches.map((branch) => (
                <BranchNode
                  key={branch.id}
                  branch={branch}
                  childMap={branchTree.childMap}
                  currentBranchId={currentBranchId}
                  expandedBranches={expandedBranches}
                  onToggleExpanded={toggleExpanded}
                  onSwitchBranch={onSwitchBranch}
                  onDeleteBranch={onDeleteBranch}
                  onRenameBranch={onRenameBranch}
                  depth={0}
                />
              ))}
            </div>
          ) : (
            <BranchTimeline
              branches={branches}
              currentBranchId={currentBranchId}
              onSwitchBranch={onSwitchBranch}
            />
          )}

          {branches.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No branches yet</p>
              <p className="text-sm mt-1">Create a branch to explore alternative paths</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Create First Branch
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Create Branch Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Create New Branch
            </DialogTitle>
            <DialogDescription>
              Fork the conversation to explore a different direction
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Branch Name</label>
              <Input
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="e.g., Alternative approach, What-if scenario"
                className="mt-1"
              />
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">
                <strong>Branching from:</strong>{' '}
                {branches.find((b) => b.id === currentBranchId)?.name || 'Main'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                The new branch will include all messages up to this point
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBranch} disabled={!newBranchName.trim()}>
              <GitBranch className="h-4 w-4 mr-2" />
              Create Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5" />
              Merge Branch
            </DialogTitle>
            <DialogDescription>
              Combine insights from another branch into the current one
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Select branch to merge</label>
              <div className="mt-2 space-y-2">
                {branches
                  .filter((b) => b.id !== currentBranchId && b.status === 'active')
                  .map((branch) => (
                    <button
                      key={branch.id}
                      className={cn(
                        'w-full p-3 rounded-lg border text-left transition-all',
                        selectedMergeSource === branch.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      )}
                      onClick={() => setSelectedMergeSource(branch.id)}
                    >
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{branch.name}</span>
                        {selectedMergeSource === branch.id && (
                          <Check className="h-4 w-4 text-primary ml-auto" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {branch.messageCount} messages • Updated {formatRelativeTime(branch.lastActivity || branch.createdAt)}
                      </p>
                    </button>
                  ))}
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Sparkles className="h-5 w-5 text-amber-600" />
              <div className="text-sm">
                <p className="font-medium text-amber-700">AI-Assisted Merge</p>
                <p className="text-amber-600/80">
                  Our AI will help synthesize insights and resolve conflicts
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMergeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleMerge} disabled={!selectedMergeSource}>
              <GitMerge className="h-4 w-4 mr-2" />
              Merge Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Branch Node Component for Tree View
function BranchNode({
  branch,
  childMap,
  currentBranchId,
  expandedBranches,
  onToggleExpanded,
  onSwitchBranch,
  onDeleteBranch,
  onRenameBranch,
  depth,
}: {
  branch: Branch;
  childMap: Map<string, Branch[]>;
  currentBranchId: string;
  expandedBranches: Set<string>;
  onToggleExpanded: (id: string) => void;
  onSwitchBranch: (id: string) => void;
  onDeleteBranch: (id: string) => void;
  onRenameBranch: (id: string, name: string) => void;
  depth: number;
}) {
  const children = childMap.get(branch.id) || [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedBranches.has(branch.id);
  const isCurrent = branch.id === currentBranchId;
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(branch.name);

  const handleRename = () => {
    if (editName.trim() && editName !== branch.name) {
      onRenameBranch(branch.id, editName);
    }
    setIsEditing(false);
  };

  const statusColors = {
    active: 'bg-green-500',
    merged: 'bg-blue-500',
    archived: 'bg-gray-400',
  };

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
          'group flex items-center gap-2 p-2 rounded-lg transition-all',
          isCurrent ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50',
        )}
        style={{ marginLeft: depth * 20 }}
      >
        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            className="p-1 hover:bg-muted rounded"
            onClick={() => onToggleExpanded(branch.id)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-6" />
        )}

        {/* Branch Line */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={cn('w-2 h-2 rounded-full flex-shrink-0', statusColors[branch.status])} />
          
          {isEditing ? (
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              className="h-7 text-sm"
              autoFocus
            />
          ) : (
            <button
              className="flex-1 text-left truncate font-medium text-sm"
              onClick={() => onSwitchBranch(branch.id)}
            >
              {branch.name}
            </button>
          )}

          {isCurrent && (
            <Badge variant="secondary" className="text-xs flex-shrink-0">Current</Badge>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {branch.messageCount}
          </span>
          <span>{formatRelativeTime(branch.lastActivity || branch.createdAt)}</span>
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onSwitchBranch(branch.id)}>
              <Eye className="h-4 w-4 mr-2" />
              Switch to branch
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsEditing(true)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => onDeleteBranch(branch.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete branch
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>

      {/* Children */}
      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {children.map((child) => (
              <BranchNode
                key={child.id}
                branch={child}
                childMap={childMap}
                currentBranchId={currentBranchId}
                expandedBranches={expandedBranches}
                onToggleExpanded={onToggleExpanded}
                onSwitchBranch={onSwitchBranch}
                onDeleteBranch={onDeleteBranch}
                onRenameBranch={onRenameBranch}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Branch Timeline Component
function BranchTimeline({
  branches,
  currentBranchId,
  onSwitchBranch,
}: {
  branches: Branch[];
  currentBranchId: string;
  onSwitchBranch: (id: string) => void;
}) {
  const sortedBranches = [...branches].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-4">
        {sortedBranches.map((branch, index) => (
          <motion.div
            key={branch.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="relative pl-10"
          >
            {/* Timeline dot */}
            <div
              className={cn(
                'absolute left-3 w-3 h-3 rounded-full border-2 border-background',
                branch.id === currentBranchId ? 'bg-primary' : 'bg-muted-foreground'
              )}
            />

            <Card
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                branch.id === currentBranchId && 'border-primary'
              )}
              onClick={() => onSwitchBranch(branch.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      {branch.name}
                      {branch.id === currentBranchId && (
                        <Badge variant="secondary" className="text-xs">Current</Badge>
                      )}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Created {formatRelativeTime(branch.createdAt)} by {branch.createdByName || 'Unknown'}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{branch.messageCount} messages</p>
                    <p>Last active {formatRelativeTime(branch.lastActivity || branch.createdAt)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString();
}
