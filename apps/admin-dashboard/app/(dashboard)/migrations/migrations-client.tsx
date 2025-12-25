'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  GitPullRequest, 
  CheckCircle, 
  XCircle, 
  Clock,
  Play,
  RefreshCw,
  Shield,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api';

interface MigrationRequest {
  id: string;
  migrationName: string;
  migrationVersion: string;
  environment: string;
  status: string;
  approvalsRequired: number;
  approvalsReceived: number;
  requestedBy: string;
  requestedAt: string;
}

interface Approval {
  id: string;
  admin_id: string;
  decision: string;
  reason: string;
  reviewed_at: string;
}

export function MigrationsClient() {
  const [selectedRequest, setSelectedRequest] = useState<MigrationRequest | null>(null);
  const [approvalReason, setApprovalReason] = useState('');
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: pendingRequests } = useQuery<MigrationRequest[]>({
    queryKey: ['migrations', 'pending'],
    queryFn: async () => {
      const res = await apiClient.get<{ requests: MigrationRequest[] }>('/migration-approval/pending');
      return res.requests;
    },
  });

  const { data: approvals } = useQuery<Approval[]>({
    queryKey: ['migrations', 'approvals', selectedRequest?.id],
    queryFn: async () => {
      if (!selectedRequest) return [];
      const res = await apiClient.get<{ approvals: Approval[] }>(`/migration-approval/${selectedRequest.id}/approvals`);
      return res.approvals;
    },
    enabled: !!selectedRequest,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await apiClient.post(`/migration-approval/${id}/approve`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
      setShowApproveDialog(false);
      setApprovalReason('');
      setSelectedRequest(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await apiClient.post(`/migration-approval/${id}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
      setShowRejectDialog(false);
      setApprovalReason('');
      setSelectedRequest(null);
    },
  });

  const executeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/migration-approval/${id}/execute`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="mr-1 h-3 w-3" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
      case 'executed':
        return <Badge><Play className="mr-1 h-3 w-3" />Executed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getEnvironmentBadge = (env: string) => {
    switch (env) {
      case 'production':
        return <Badge variant="destructive">{env}</Badge>;
      case 'staging':
        return <Badge variant="secondary">{env}</Badge>;
      default:
        return <Badge variant="outline">{env}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Migration Approvals</h1>
          <p className="text-muted-foreground">
            Dual-admin approval for database migrations
          </p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['migrations'] })}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pendingRequests?.filter(r => r.status === 'pending').length ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ready to Execute</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pendingRequests?.filter(r => r.status === 'approved').length ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requires 2 Approvals</CardTitle>
            <Shield className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pendingRequests?.filter(r => r.approvalsRequired >= 2).length ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitPullRequest className="h-5 w-5" />
            Migration Requests
          </CardTitle>
          <CardDescription>Review and approve pending migrations</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Migration</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approvals</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingRequests?.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">{request.migrationName}</TableCell>
                  <TableCell><code className="text-sm">{request.migrationVersion}</code></TableCell>
                  <TableCell>{getEnvironmentBadge(request.environment)}</TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell>
                    <span className={request.approvalsReceived >= request.approvalsRequired ? 'text-green-600' : ''}>
                      {request.approvalsReceived} / {request.approvalsRequired}
                    </span>
                  </TableCell>
                  <TableCell>{new Date(request.requestedAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-2">
                    {request.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowApproveDialog(true);
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowRejectDialog(true);
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                    {request.status === 'approved' && (
                      <Button
                        size="sm"
                        onClick={() => executeMutation.mutate(request.id)}
                        disabled={executeMutation.isPending}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Execute
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!pendingRequests || pendingRequests.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No pending migration requests
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Migration</DialogTitle>
            <DialogDescription>
              {selectedRequest?.migrationName} ({selectedRequest?.migrationVersion})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span className="text-sm">This action cannot be undone</span>
            </div>
            <div className="space-y-2">
              <Label>Approval Reason (optional)</Label>
              <Textarea
                value={approvalReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setApprovalReason(e.target.value)}
                placeholder="Why are you approving this migration?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>Cancel</Button>
            <Button
              onClick={() => selectedRequest && approveMutation.mutate({ id: selectedRequest.id, reason: approvalReason })}
              disabled={approveMutation.isPending}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Migration</DialogTitle>
            <DialogDescription>
              {selectedRequest?.migrationName} ({selectedRequest?.migrationVersion})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <Textarea
                value={approvalReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setApprovalReason(e.target.value)}
                placeholder="Why are you rejecting this migration?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => selectedRequest && rejectMutation.mutate({ id: selectedRequest.id, reason: approvalReason })}
              disabled={rejectMutation.isPending}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
