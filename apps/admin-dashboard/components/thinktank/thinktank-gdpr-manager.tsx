'use client';

/**
 * Think Tank GDPR Data Request Manager
 * Handles data export (Right to Portability) and deletion (Right to Erasure) requests
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Download,
  Trash2,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileArchive,
  User,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface DataRequest {
  id: string;
  userId: string;
  email: string;
  requestType: 'export' | 'delete';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: string;
  completedAt: string | null;
  downloadUrl: string | null;
  expiresAt: string | null;
}

interface RequestStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  exportRequests: number;
  deleteRequests: number;
}

const statusConfig = {
  pending: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-100', badge: 'secondary' as const },
  processing: { icon: RefreshCw, color: 'text-blue-500', bg: 'bg-blue-100', badge: 'default' as const },
  completed: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100', badge: 'default' as const },
  failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100', badge: 'destructive' as const },
};

export function ThinkTankGDPRManager() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showNewRequestDialog, setShowNewRequestDialog] = useState(false);
  const [newRequestType, setNewRequestType] = useState<'export' | 'delete'>('export');
  const [newRequestEmail, setNewRequestEmail] = useState('');
  const [newRequestUserId, setNewRequestUserId] = useState('');

  const { data, isLoading, refetch } = useQuery<{ requests: DataRequest[]; stats: RequestStats }>({
    queryKey: ['thinktank-gdpr', statusFilter, typeFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('requestType', typeFilter);
      return fetch(`/api/admin/thinktank/gdpr?${params}`).then((r) => r.json());
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: (data: { userId: string; email: string; requestType: 'export' | 'delete' }) =>
      fetch('/api/admin/thinktank/gdpr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinktank-gdpr'] });
      setShowNewRequestDialog(false);
      setNewRequestEmail('');
      setNewRequestUserId('');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ requestId, status }: { requestId: string; status: string }) =>
      fetch('/api/admin/thinktank/gdpr', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinktank-gdpr'] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileArchive className="h-6 w-6" />
            GDPR Data Requests
          </h2>
          <p className="text-muted-foreground">
            Manage data export and deletion requests for Think Tank users
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showNewRequestDialog} onOpenChange={setShowNewRequestDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Request
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create GDPR Request</DialogTitle>
                <DialogDescription>
                  Submit a data export or deletion request on behalf of a user.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="requestType">Request Type</Label>
                  <Select value={newRequestType} onValueChange={(v) => setNewRequestType(v as 'export' | 'delete')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="export">
                        <div className="flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          Data Export (Right to Portability)
                        </div>
                      </SelectItem>
                      <SelectItem value="delete">
                        <div className="flex items-center gap-2">
                          <Trash2 className="h-4 w-4" />
                          Data Deletion (Right to Erasure)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userId">User ID</Label>
                  <Input
                    id="userId"
                    placeholder="user-123"
                    value={newRequestUserId}
                    onChange={(e) => setNewRequestUserId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={newRequestEmail}
                    onChange={(e) => setNewRequestEmail(e.target.value)}
                  />
                </div>
                {newRequestType === 'delete' && (
                  <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-200">
                          Warning: Data Deletion
                        </p>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          This will permanently delete all user data including conversations, 
                          files, and preferences. This action cannot be undone.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewRequestDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    createRequestMutation.mutate({
                      userId: newRequestUserId,
                      email: newRequestEmail,
                      requestType: newRequestType,
                    });
                  }}
                  disabled={!newRequestUserId || !newRequestEmail || createRequestMutation.isPending}
                >
                  {createRequestMutation.isPending ? 'Creating...' : 'Create Request'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FileArchive className="h-4 w-4" />
              <span className="text-sm">Total Requests</span>
            </div>
            <p className="text-2xl font-bold">{data?.stats?.total || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-sm">Pending</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">
              {(data?.stats?.pending || 0) + (data?.stats?.processing || 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Download className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Export Requests</span>
            </div>
            <p className="text-2xl font-bold">{data?.stats?.exportRequests || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Trash2 className="h-4 w-4 text-red-500" />
              <span className="text-sm">Delete Requests</span>
            </div>
            <p className="text-2xl font-bold">{data?.stats?.deleteRequests || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Request Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Requests</TabsTrigger>
          <TabsTrigger value="export">
            <Download className="h-4 w-4 mr-1" />
            Exports
          </TabsTrigger>
          <TabsTrigger value="delete">
            <Trash2 className="h-4 w-4 mr-1" />
            Deletions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <RequestsTable
            requests={data?.requests || []}
            isLoading={isLoading}
            onUpdateStatus={(requestId, status) => updateStatusMutation.mutate({ requestId, status })}
          />
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <RequestsTable
            requests={(data?.requests || []).filter((r) => r.requestType === 'export')}
            isLoading={isLoading}
            onUpdateStatus={(requestId, status) => updateStatusMutation.mutate({ requestId, status })}
          />
        </TabsContent>

        <TabsContent value="delete" className="space-y-4">
          <RequestsTable
            requests={(data?.requests || []).filter((r) => r.requestType === 'delete')}
            isLoading={isLoading}
            onUpdateStatus={(requestId, status) => updateStatusMutation.mutate({ requestId, status })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RequestsTable({
  requests,
  isLoading,
  onUpdateStatus,
}: {
  requests: DataRequest[];
  isLoading: boolean;
  onUpdateStatus: (requestId: string, status: string) => void;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No requests found
                </TableCell>
              </TableRow>
            ) : (
              requests.map((request) => {
                const config = statusConfig[request.status];
                const StatusIcon = config.icon;

                return (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{request.email}</p>
                        <p className="text-xs text-muted-foreground">{request.userId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {request.requestType === 'export' ? (
                          <Download className="h-3 w-3 mr-1" />
                        ) : (
                          <Trash2 className="h-3 w-3 mr-1" />
                        )}
                        {request.requestType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.badge}>
                        <StatusIcon className={`h-3 w-3 mr-1 ${request.status === 'processing' ? 'animate-spin' : ''}`} />
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{format(new Date(request.requestedAt), 'PP')}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(request.requestedAt), { addSuffix: true })}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {request.completedAt ? (
                        <div>
                          <p className="text-sm">{format(new Date(request.completedAt), 'PP')}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(request.completedAt), { addSuffix: true })}
                          </p>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {request.status === 'completed' && request.downloadUrl && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={request.downloadUrl} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {request.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onUpdateStatus(request.id, 'processing')}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
