'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Plus, Check, Merge, MoreHorizontal, GitPullRequest, Clock, ChevronRight, Loader2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface BranchPanelProps {
  session: any;
  currentUserId: string;
}

export function BranchPanel({ session, currentUserId }: BranchPanelProps) {
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchDescription, setBranchDescription] = useState('');
  const queryClient = useQueryClient();

  const createBranchMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/api/thinktank/collaboration/sessions/${session.id}/branches`, {
        name: branchName,
        description: branchDescription,
      });
      return response;
    },
    onSuccess: () => {
      setShowNewBranch(false);
      setBranchName('');
      setBranchDescription('');
      queryClient.invalidateQueries({ queryKey: ['enhanced-session', session.id] });
    },
  });

  const switchBranchMutation = useMutation({
    mutationFn: async (branchId: string) => {
      const response = await api.post(`/api/thinktank/collaboration/sessions/${session.id}/branches/${branchId}/switch`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enhanced-session', session.id] });
    },
  });

  const mergeBranchMutation = useMutation({
    mutationFn: async (branchId: string) => {
      const response = await api.post(`/api/thinktank/collaboration/sessions/${session.id}/branches/${branchId}/merge`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enhanced-session', session.id] });
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="h-full flex flex-col"
    >
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Conversation Branches
          </h3>
          <p className="text-sm text-muted-foreground">Explore alternative discussion paths</p>
        </div>
        <Dialog open={showNewBranch} onOpenChange={setShowNewBranch}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Branch
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Branch</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Input
                  placeholder="Branch name"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                />
              </div>
              <div>
                <Textarea
                  placeholder="What direction should this branch explore?"
                  value={branchDescription}
                  onChange={(e) => setBranchDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewBranch(false)}>Cancel</Button>
              <Button onClick={() => createBranchMutation.mutate()} disabled={!branchName || createBranchMutation.isPending}>
                {createBranchMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Branch
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          <Card className="border-primary bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <GitBranch className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">main</span>
                      <Badge variant="default" className="text-xs">Current</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Primary conversation thread</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <AnimatePresence>
            {session.branches?.map((branch: any) => (
              <motion.div key={branch.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <GitBranch className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{branch.name}</span>
                            {branch.status === 'merged' && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Check className="h-3 w-3" /> Merged
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{branch.description}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(branch.createdAt).toLocaleDateString()}
                            </span>
                            <span>{branch.messageCount || 0} messages</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => switchBranchMutation.mutate(branch.id)} disabled={switchBranchMutation.isPending}>
                          <ChevronRight className="h-4 w-4 mr-1" />
                          Switch
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => mergeBranchMutation.mutate(branch.id)}>
                              <Merge className="h-4 w-4 mr-2" /> Merge to main
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <GitPullRequest className="h-4 w-4 mr-2" /> Compare
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          {(!session.branches || session.branches.length === 0) && (
            <div className="text-center py-12 text-muted-foreground">
              <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No branches yet</p>
              <p className="text-sm mt-1">Create a branch to explore alternative discussion paths</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </motion.div>
  );
}
