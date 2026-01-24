'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ClipboardCheck,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Bot,
  Shield,
  AlertTriangle,
  Eye,
  MessageSquare,
} from 'lucide-react';

interface Approval {
  id: string;
  timestamp: string;
  type: 'deployment' | 'access' | 'config' | 'data';
  title: string;
  description: string;
  requester: string;
  status: 'pending' | 'approved' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'critical';
  resource: string;
  reviewedBy?: string;
  reviewedAt?: string;
  comments?: string;
}

const defaultApprovals: Approval[] = [];

const typeConfig = {
  deployment: { color: 'bg-purple-500', label: 'Deployment' },
  access: { color: 'bg-blue-500', label: 'Access' },
  config: { color: 'bg-amber-500', label: 'Config' },
  data: { color: 'bg-green-500', label: 'Data' },
};

const priorityConfig = {
  low: { color: 'bg-gray-500', label: 'Low' },
  medium: { color: 'bg-blue-500', label: 'Medium' },
  high: { color: 'bg-amber-500', label: 'High' },
  critical: { color: 'bg-red-500', label: 'Critical' },
};

const statusConfig = {
  pending: { icon: Clock, color: 'text-amber-500', label: 'Pending' },
  approved: { icon: CheckCircle2, color: 'text-green-500', label: 'Approved' },
  rejected: { icon: XCircle, color: 'text-red-500', label: 'Rejected' },
};

export default function SovereignMeshApprovalsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [reviewComment, setReviewComment] = useState('');

  const { data: approvals = defaultApprovals } = useQuery<Approval[]>({
    queryKey: ['sovereign-mesh', 'approvals'],
    queryFn: async () => {
      const res = await fetch('/api/thinktank-admin/sovereign-mesh/approvals');
      if (!res.ok) return defaultApprovals;
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, action, comment }: { id: string; action: 'approve' | 'reject'; comment: string }) => {
      const res = await fetch(`/api/thinktank-admin/sovereign-mesh/approvals/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment }),
      });
      if (!res.ok) throw new Error('Failed to process approval');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sovereign-mesh', 'approvals'] });
      setSelectedApproval(null);
      setReviewComment('');
    },
  });

  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  const processedApprovals = approvals.filter(a => a.status !== 'pending');

  const filteredPending = pendingApprovals.filter(a =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.requester.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const handleReview = (action: 'approve' | 'reject') => {
    if (selectedApproval) {
      approveMutation.mutate({ id: selectedApproval.id, action, comment: reviewComment });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6" />
            Approvals
          </h1>
          <p className="text-muted-foreground">
            Review and approve requests for mesh operations
          </p>
        </div>
        {pendingApprovals.length > 0 && (
          <Badge variant="destructive" className="text-lg px-4 py-2">
            {pendingApprovals.length} Pending
          </Badge>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingApprovals.length}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{approvals.filter(a => a.status === 'approved').length}</p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{approvals.filter(a => a.status === 'rejected').length}</p>
                <p className="text-sm text-muted-foreground">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <AlertTriangle className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingApprovals.filter(a => a.priority === 'critical' || a.priority === 'high').length}</p>
                <p className="text-sm text-muted-foreground">High Priority</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="pending">Pending ({pendingApprovals.length})</TabsTrigger>
            <TabsTrigger value="processed">Processed</TabsTrigger>
          </TabsList>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search approvals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <TabsContent value="pending" className="space-y-4">
          {filteredPending.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-medium">All caught up!</h3>
                <p className="text-muted-foreground">No pending approvals</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredPending.map((approval) => {
                const type = typeConfig[approval.type];
                const priority = priorityConfig[approval.priority];
                return (
                  <Card key={approval.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={type.color}>{type.label}</Badge>
                            <Badge className={priority.color}>{priority.label}</Badge>
                            <span className="text-sm text-muted-foreground">{formatDate(approval.timestamp)}</span>
                          </div>
                          <h3 className="text-lg font-medium mb-1">{approval.title}</h3>
                          <p className="text-muted-foreground mb-3">{approval.description}</p>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              <span>{approval.requester}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Shield className="h-4 w-4" />
                              <span>{approval.resource}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setSelectedApproval(approval)}>
                            <Eye className="h-4 w-4 mr-1" />
                            Review
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="processed" className="space-y-4">
          <div className="space-y-4">
            {processedApprovals.map((approval) => {
              const type = typeConfig[approval.type];
              const status = statusConfig[approval.status];
              return (
                <Card key={approval.id} className="opacity-80">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={type.color}>{type.label}</Badge>
                          <div className={`flex items-center gap-1 ${status.color}`}>
                            <status.icon className="h-4 w-4" />
                            <span>{status.label}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">{formatDate(approval.timestamp)}</span>
                        </div>
                        <h3 className="text-lg font-medium mb-1">{approval.title}</h3>
                        <p className="text-muted-foreground mb-3">{approval.description}</p>
                        {approval.reviewedBy && (
                          <div className="text-sm text-muted-foreground">
                            Reviewed by {approval.reviewedBy} on {formatDate(approval.reviewedAt!)}
                            {approval.comments && (
                              <p className="mt-1 italic">&ldquo;{approval.comments}&rdquo;</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={!!selectedApproval} onOpenChange={() => setSelectedApproval(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Request</DialogTitle>
            <DialogDescription>
              Review and approve or reject this request
            </DialogDescription>
          </DialogHeader>
          {selectedApproval && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">{selectedApproval.title}</h4>
                <p className="text-sm text-muted-foreground">{selectedApproval.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Requester:</span>
                  <p className="font-medium">{selectedApproval.requester}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Resource:</span>
                  <p className="font-medium">{selectedApproval.resource}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Comment (optional)</label>
                <Textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedApproval(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleReview('reject')}>
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
            <Button onClick={() => handleReview('approve')}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
