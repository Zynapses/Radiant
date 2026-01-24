'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, RefreshCw, Plus, Trash2, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface ErasureRequest {
  id: string;
  userId: string;
  userEmail?: string;
  scopeType: 'user' | 'document' | 'entity' | 'full';
  scopeId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: string;
  completedAt?: string;
  deletedCounts?: {
    nodes: number;
    edges: number;
    documents: number;
    archives: number;
  };
  error?: string;
}

export default function CortexGDPRPage() {
  const [requests, setRequests] = useState<ErasureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({
    userId: '',
    scopeType: 'user' as ErasureRequest['scopeType'],
    scopeId: '',
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/cortex/gdpr/erasure');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Failed to fetch erasure requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const createRequest = async () => {
    if (!newRequest.userId) return;

    setCreating(true);
    try {
      const res = await fetch('/api/admin/cortex/gdpr/erasure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRequest),
      });

      if (res.ok) {
        setDialogOpen(false);
        setNewRequest({ userId: '', scopeType: 'user', scopeId: '' });
        fetchRequests();
      }
    } catch (error) {
      console.error('Failed to create erasure request:', error);
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: ErasureRequest['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline"><Clock className="mr-1 h-3 w-3" /> Pending</Badge>;
      case 'processing':
        return <Badge variant="secondary"><RefreshCw className="mr-1 h-3 w-3 animate-spin" /> Processing</Badge>;
      case 'completed':
        return <Badge variant="default"><CheckCircle className="mr-1 h-3 w-3" /> Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Failed</Badge>;
    }
  };

  const getScopeBadge = (scopeType: ErasureRequest['scopeType']) => {
    switch (scopeType) {
      case 'user':
        return <Badge variant="outline">User Data</Badge>;
      case 'document':
        return <Badge variant="outline">Document</Badge>;
      case 'entity':
        return <Badge variant="outline">Entity</Badge>;
      case 'full':
        return <Badge variant="destructive">Full Erasure</Badge>;
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const processingCount = requests.filter(r => r.status === 'processing').length;
  const completedCount = requests.filter(r => r.status === 'completed').length;
  const failedCount = requests.filter(r => r.status === 'failed').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">GDPR Erasure</h1>
          <p className="text-muted-foreground">
            Manage right-to-be-forgotten requests with cascading deletion across all Cortex tiers
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchRequests} variant="outline" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Erasure Request
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Erasure Request</DialogTitle>
                <DialogDescription>
                  This will permanently delete data from all Cortex tiers (Hot, Warm, Cold).
                  This action cannot be undone.
                </DialogDescription>
              </DialogHeader>

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                  Erasure cascades through all tiers and deletes nodes, edges, documents, and archives.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">User ID</label>
                  <Input
                    placeholder="Enter user UUID..."
                    value={newRequest.userId}
                    onChange={(e) => setNewRequest({ ...newRequest, userId: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Scope Type</label>
                  <Select
                    value={newRequest.scopeType}
                    onValueChange={(v) => setNewRequest({ ...newRequest, scopeType: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User Data - All data associated with this user</SelectItem>
                      <SelectItem value="document">Document - Specific document and derivatives</SelectItem>
                      <SelectItem value="entity">Entity - Specific entity and relationships</SelectItem>
                      <SelectItem value="full">Full Erasure - Complete user removal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(newRequest.scopeType === 'document' || newRequest.scopeType === 'entity') && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {newRequest.scopeType === 'document' ? 'Document ID' : 'Entity ID'}
                    </label>
                    <Input
                      placeholder={`Enter ${newRequest.scopeType} UUID...`}
                      value={newRequest.scopeId}
                      onChange={(e) => setNewRequest({ ...newRequest, scopeId: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={createRequest}
                  disabled={creating || !newRequest.userId}
                >
                  {creating ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Create Erasure Request
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{processingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Notice */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>GDPR Article 17 Compliance</AlertTitle>
        <AlertDescription>
          Erasure requests are processed within 72 hours. Deleted data is removed from all tiers:
          Hot (Redis), Warm (PostgreSQL/Neptune), and Cold (S3/Iceberg archives).
        </AlertDescription>
      </Alert>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Erasure Requests</CardTitle>
          <CardDescription>
            All data subject erasure requests and their processing status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Deleted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <div>
                      <code className="text-xs">{request.userId.slice(0, 8)}...</code>
                      {request.userEmail && (
                        <p className="text-xs text-muted-foreground">{request.userEmail}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {getScopeBadge(request.scopeType)}
                      {request.scopeId && (
                        <p className="text-xs text-muted-foreground">
                          ID: {request.scopeId.slice(0, 8)}...
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(request.status)}
                    {request.error && (
                      <p className="text-xs text-red-500 mt-1">{request.error}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{new Date(request.requestedAt).toLocaleDateString()}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(request.requestedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {request.deletedCounts ? (
                      <div className="text-xs space-y-0.5">
                        <p>Nodes: {request.deletedCounts.nodes}</p>
                        <p>Edges: {request.deletedCounts.edges}</p>
                        <p>Docs: {request.deletedCounts.documents}</p>
                        <p>Archives: {request.deletedCounts.archives}</p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {requests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No erasure requests found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
