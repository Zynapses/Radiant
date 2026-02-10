'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
  Loader2,
  Shield,
  Inbox,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Approval {
  id: string;
  queue_id: string;
  queue_name: string;
  agent_execution_id?: string;
  request_type: string;
  request_summary: string;
  request_details?: Record<string, unknown>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'rejected' | 'escalated' | 'expired';
  created_at: string;
  expires_at?: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_action?: string;
  resolution_notes?: string;
}

interface ApprovalComment {
  id: string;
  user_email: string;
  comment_text: string;
  created_at: string;
}

interface Queue {
  id: string;
  name: string;
  description?: string;
  pending_count: number;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function priorityBadge(priority: string) {
  const map: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${map[priority] || map.medium}`}>
      {priority}
    </span>
  );
}

function statusBadge(status: string) {
  const map: Record<string, { cls: string; icon: React.ReactNode }> = {
    pending: { cls: 'bg-yellow-100 text-yellow-800', icon: <Clock className="h-3 w-3" /> },
    approved: { cls: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-3 w-3" /> },
    rejected: { cls: 'bg-red-100 text-red-800', icon: <XCircle className="h-3 w-3" /> },
    escalated: { cls: 'bg-purple-100 text-purple-800', icon: <ArrowUpRight className="h-3 w-3" /> },
    expired: { cls: 'bg-gray-100 text-gray-500', icon: <Clock className="h-3 w-3" /> },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.icon} {status}
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SovereignMeshApprovalsPage() {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [comments, setComments] = useState<ApprovalComment[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [queueFilter, setQueueFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalPending = queues.reduce((sum, q) => sum + (q.pending_count || 0), 0);

  const loadQueues = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sovereign-mesh/approvals/queues');
      if (res.ok) {
        const data = await res.json();
        setQueues(data.queues || []);
      }
    } catch (err) {
      console.error('Failed to load queues:', err);
    }
  }, []);

  const loadApprovals = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/admin/sovereign-mesh/approvals?status=${statusFilter}&limit=50`;
      if (queueFilter) url += `&queueId=${encodeURIComponent(queueFilter)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setApprovals(data.approvals || []);
      }
    } catch (err) {
      console.error('Failed to load approvals:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, queueFilter]);

  const loadApprovalDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/sovereign-mesh/approvals/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedApproval(data.approval);
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error('Failed to load approval detail:', err);
    }
  };

  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const handleAction = async (approvalId: string, action: 'approve' | 'reject' | 'escalate') => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/sovereign-mesh/approvals/${approvalId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        setNotes('');
        setSelectedApproval(null);
        loadApprovals();
        loadQueues();
      }
    } catch (err) {
      console.error(`Failed to ${action} approval:`, err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> HITL Approval Queue
          </h1>
          <p className="text-muted-foreground mt-1">
            Human-in-the-loop approval requests from Sovereign Mesh agent executions
          </p>
        </div>
        <div className="flex items-center gap-3">
          {totalPending > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              {totalPending} pending
            </Badge>
          )}
          <Button variant="outline" onClick={() => { loadApprovals(); loadQueues(); }} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Queue Cards */}
      {queues.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {queues.map(q => (
            <Card
              key={q.id}
              className={`cursor-pointer transition-colors hover:border-primary/50 ${queueFilter === q.id ? 'border-primary ring-1 ring-primary/20' : ''}`}
              onClick={() => setQueueFilter(queueFilter === q.id ? '' : q.id)}
            >
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{q.name}</span>
                  <Badge variant={q.pending_count > 0 ? 'destructive' : 'secondary'}>
                    {q.pending_count}
                  </Badge>
                </div>
                {q.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{q.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filter Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="pending">
            <Inbox className="mr-1 h-4 w-4" /> Pending
          </TabsTrigger>
          <TabsTrigger value="approved">
            <CheckCircle className="mr-1 h-4 w-4" /> Approved
          </TabsTrigger>
          <TabsTrigger value="rejected">
            <XCircle className="mr-1 h-4 w-4" /> Rejected
          </TabsTrigger>
          <TabsTrigger value="escalated">
            <ArrowUpRight className="mr-1 h-4 w-4" /> Escalated
          </TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : approvals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No {statusFilter} approvals{queueFilter ? ' in this queue' : ''}.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {approvals.map(a => (
                <Card key={a.id} className="transition-all hover:shadow-md">
                  <CardContent className="pt-4 pb-3">
                    {/* Summary Row */}
                    <div
                      className="flex items-start justify-between cursor-pointer"
                      onClick={() => {
                        if (expandedId === a.id) {
                          setExpandedId(null);
                          setSelectedApproval(null);
                        } else {
                          setExpandedId(a.id);
                          loadApprovalDetail(a.id);
                        }
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {priorityBadge(a.priority)}
                          <span className="font-medium text-sm truncate">{a.request_summary}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{a.queue_name}</span>
                          <span>•</span>
                          <span>{a.request_type}</span>
                          <span>•</span>
                          <span>{timeAgo(a.created_at)}</span>
                          {a.expires_at && (
                            <>
                              <span>•</span>
                              <span className="text-orange-600">Expires {timeAgo(a.expires_at)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {statusBadge(a.status)}
                        {expandedId === a.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    {expandedId === a.id && selectedApproval && (
                      <div className="mt-4 border-t pt-4 space-y-4">
                        {/* Details */}
                        {selectedApproval.request_details && (
                          <div>
                            <h4 className="text-sm font-medium mb-1">Request Details</h4>
                            <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto max-h-48">
                              {JSON.stringify(selectedApproval.request_details, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Comments */}
                        {comments.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                              <MessageSquare className="h-4 w-4" /> Comments ({comments.length})
                            </h4>
                            <div className="space-y-2">
                              {comments.map(c => (
                                <div key={c.id} className="text-xs bg-muted/50 rounded-md p-2">
                                  <span className="font-medium">{c.user_email}</span>
                                  <span className="text-muted-foreground ml-2">{timeAgo(c.created_at)}</span>
                                  <p className="mt-1">{c.comment_text}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Resolution info for non-pending */}
                        {a.status !== 'pending' && selectedApproval.resolution_notes && (
                          <div className="bg-muted/50 rounded-md p-3 text-sm">
                            <span className="font-medium">Resolution: </span>
                            {selectedApproval.resolution_notes}
                            {selectedApproval.resolved_by && (
                              <span className="text-muted-foreground ml-2">
                                — by {selectedApproval.resolved_by} at {selectedApproval.resolved_at ? new Date(selectedApproval.resolved_at).toLocaleString() : ''}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Action buttons (only for pending) */}
                        {a.status === 'pending' && (
                          <div className="space-y-3">
                            <Textarea
                              placeholder="Resolution notes (optional)"
                              value={notes}
                              onChange={e => setNotes(e.target.value)}
                              rows={2}
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                onClick={() => handleAction(a.id, 'approve')}
                                disabled={actionLoading}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                Approve
                              </Button>
                              <Button
                                onClick={() => handleAction(a.id, 'reject')}
                                disabled={actionLoading}
                                variant="destructive"
                              >
                                <XCircle className="mr-2 h-4 w-4" /> Reject
                              </Button>
                              <Button
                                onClick={() => handleAction(a.id, 'escalate')}
                                disabled={actionLoading}
                                variant="outline"
                              >
                                <ArrowUpRight className="mr-2 h-4 w-4" /> Escalate
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
