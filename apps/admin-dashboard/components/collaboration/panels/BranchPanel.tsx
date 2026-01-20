'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { GitBranch, Plus, ChevronDown, ArrowRight, Merge, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface BranchPanelProps {
  session: any;
  currentUserId: string;
}

export function BranchPanel({ session, currentUserId }: BranchPanelProps) {
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const queryClient = useQueryClient();

  const createBranchMutation = useMutation({
    mutationFn: async (data: { branchName: string; hypothesis: string }) => {
      const res = await fetch(`${API_BASE}/api/thinktank/collaboration/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          branchName: data.branchName,
          explorationHypothesis: data.hypothesis,
        }),
      });
      if (!res.ok) throw new Error('Failed to create branch');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enhanced-session', session.id] });
      setShowCreateBranch(false);
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="h-full flex flex-col p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Conversation Branches
          </h3>
          <p className="text-sm text-muted-foreground">
            Explore different ideas in parallel, then merge insights
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreateBranch(true)} className="gap-1">
          <Plus className="h-4 w-4" />
          New Branch
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {session.branches?.length > 0 ? (
          <div className="space-y-3">
            <BranchCard
              branch={{
                id: 'main',
                branchName: 'Main Conversation',
                branchColor: session.color,
                status: 'active',
                messageCount: 0,
              }}
              isMain
            />
            {session.branches.map((branch: any) => (
              <BranchCard key={branch.id} branch={branch} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No branches yet</p>
            <p className="text-sm mt-1">Create a branch to explore an alternative direction</p>
          </div>
        )}
      </ScrollArea>

      <Dialog open={showCreateBranch} onOpenChange={setShowCreateBranch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Branch</DialogTitle>
            <DialogDescription>Fork the conversation to explore a different direction</DialogDescription>
          </DialogHeader>
          <CreateBranchForm
            onSubmit={(data) => createBranchMutation.mutate(data)}
            isPending={createBranchMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function BranchCard({ branch, isMain = false }: { branch: any; isMain?: boolean }) {
  return (
    <Card className={cn('transition-all hover:shadow-md', isMain && 'border-primary')}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: branch.branchColor }} />
            <div>
              <h4 className="font-medium flex items-center gap-2">
                {branch.branchName}
                {isMain && <Badge variant="outline" className="text-xs">Main</Badge>}
                {branch.status === 'merged' && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Merge className="h-3 w-3" />
                    Merged
                  </Badge>
                )}
              </h4>
              {branch.explorationHypothesis && (
                <p className="text-sm text-muted-foreground mt-1">{branch.explorationHypothesis}</p>
              )}
            </div>
          </div>
          {!isMain && branch.status === 'active' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Switch to Branch
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Merge className="h-4 w-4 mr-2" />
                  Merge to Main
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  <X className="h-4 w-4 mr-2" />
                  Abandon Branch
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span>{branch.messageCount || 0} messages</span>
          <span>{branch.participants?.length || 0} participants</span>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateBranchForm({ onSubmit, isPending }: { onSubmit: (data: { branchName: string; hypothesis: string }) => void; isPending: boolean }) {
  const [branchName, setBranchName] = useState('');
  const [hypothesis, setHypothesis] = useState('');

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="branchName">Branch Name</Label>
        <Input id="branchName" value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="e.g., Explore Option A" />
      </div>
      <div>
        <Label htmlFor="hypothesis">What are you exploring?</Label>
        <Textarea id="hypothesis" value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} placeholder="Describe the hypothesis or direction you want to explore..." />
      </div>
      <Button onClick={() => onSubmit({ branchName, hypothesis })} disabled={!branchName.trim() || isPending} className="w-full">
        {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Create Branch
      </Button>
    </div>
  );
}
