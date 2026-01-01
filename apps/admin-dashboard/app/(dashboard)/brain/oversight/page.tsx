'use client';

/**
 * RADIANT v6.0.4 - Oversight Queue Page
 * Human oversight for high-risk domain insights
 * EU AI Act Article 14 compliance
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Shield,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  Eye,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

interface OversightStats {
  pending: number;
  escalated: number;
  approvedToday: number;
  rejectedToday: number;
  expiredToday: number;
  avgReviewTimeMs: number;
  oldestPendingAt: string | null;
  byDomain: Record<string, number>;
}

interface OversightItem {
  id: string;
  insightId: string;
  tenantId: string;
  insightJson: Record<string, unknown>;
  domain: string;
  status: string;
  assignedTo: string | null;
  createdAt: string;
  reviewedAt: string | null;
  escalatedAt: string | null;
  expiresAt: string;
}

export default function OversightQueuePage() {
  const [stats, setStats] = useState<OversightStats | null>(null);
  const [items, setItems] = useState<OversightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState('');
  const [selectedItem, setSelectedItem] = useState<OversightItem | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [reasoning, setReasoning] = useState('');
  const [attestation, setAttestation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const statsRes = await fetch('/api/admin/brain/oversight/stats');
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }

      if (tenantId) {
        const itemsRes = await fetch(`/api/admin/brain/oversight?tenantId=${tenantId}&limit=50`);
        if (itemsRes.ok) {
          const data = await itemsRes.json();
          setItems(data.items || []);
        }
      }
    } catch (err) {
      console.error('Failed to load oversight data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async () => {
    if (!selectedItem || !reviewAction || !reasoning || !attestation) return;
    setSubmitting(true);
    try {
      const endpoint = `/api/admin/brain/oversight/${selectedItem.insightId}/${reviewAction}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerId: 'admin', // Would come from auth context
          reasoning,
          attestation,
        }),
      });

      if (response.ok) {
        setSelectedItem(null);
        setReviewAction(null);
        setReasoning('');
        setAttestation('');
        fetchData();
      }
    } catch (err) {
      console.error('Failed to submit review:', err);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [tenantId]);

  const getDomainBadgeVariant = (domain: string) => {
    switch (domain) {
      case 'healthcare':
        return 'destructive';
      case 'financial':
        return 'default';
      case 'legal':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (remaining < 0) return 'Expired';
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  if (loading && !stats) {
    return <OversightSkeleton />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/brain">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-amber-600" />
              Oversight Queue
            </h1>
            <p className="text-muted-foreground">
              Human oversight for high-risk domains (EU AI Act Article 14)
            </p>
          </div>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Important Notice */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800">7-Day Auto-Reject Rule</h3>
              <p className="text-sm text-amber-700">
                Items not reviewed within 7 days are automatically rejected.
                <strong> Silence ≠ Consent.</strong> Escalation occurs at 3 days.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className={stats?.pending ? 'border-amber-300' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Clock className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold">{stats?.pending || 0}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Pending</p>
          </CardContent>
        </Card>
        <Card className={stats?.escalated ? 'border-red-300 bg-red-50' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold">{stats?.escalated || 0}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Escalated</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{stats?.approvedToday || 0}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Approved Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold">{stats?.rejectedToday || 0}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Rejected Today</p>
          </CardContent>
        </Card>
        <Card className={stats?.expiredToday ? 'border-red-300 bg-red-50' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold">{stats?.expiredToday || 0}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Expired Today</p>
          </CardContent>
        </Card>
      </div>

      {/* By Domain */}
      {stats?.byDomain && Object.keys(stats.byDomain).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>By Domain</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              {Object.entries(stats.byDomain).map(([domain, count]) => (
                <div key={domain} className="flex items-center gap-2">
                  <Badge variant={getDomainBadgeVariant(domain)}>{domain}</Badge>
                  <span className="font-mono">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue Items */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Items</CardTitle>
          <CardDescription>Review insights from high-risk domains</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Enter tenant ID to load items"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="max-w-md"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Insight ID</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Time Remaining</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {tenantId ? 'No pending items found' : 'Enter a tenant ID to load items'}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">
                      {item.insightId.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Badge variant={getDomainBadgeVariant(item.domain)}>{item.domain}</Badge>
                    </TableCell>
                    <TableCell>
                      {item.status === 'escalated' ? (
                        <Badge variant="destructive">Escalated</Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <span
                        className={
                          getTimeRemaining(item.expiresAt).includes('d') &&
                          parseInt(getTimeRemaining(item.expiresAt)) <= 3
                            ? 'text-red-600 font-bold'
                            : ''
                        }
                      >
                        {getTimeRemaining(item.expiresAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedItem(item);
                            setReviewAction(null);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600"
                          onClick={() => {
                            setSelectedItem(item);
                            setReviewAction('approve');
                          }}
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          onClick={() => {
                            setSelectedItem(item);
                            setReviewAction('reject');
                          }}
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve'
                ? 'Approve Insight'
                : reviewAction === 'reject'
                ? 'Reject Insight'
                : 'View Insight'}
            </DialogTitle>
            <DialogDescription>
              {reviewAction
                ? 'Provide reasoning and attestation for your decision'
                : 'Review the insight details'}
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Insight Content</h4>
                <pre className="text-sm overflow-auto max-h-48">
                  {JSON.stringify(selectedItem.insightJson, null, 2)}
                </pre>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Domain:</span>{' '}
                  <Badge variant={getDomainBadgeVariant(selectedItem.domain)}>
                    {selectedItem.domain}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Expires:</span>{' '}
                  {getTimeRemaining(selectedItem.expiresAt)}
                </div>
              </div>

              {reviewAction && (
                <>
                  <div>
                    <label className="text-sm font-medium">Reasoning *</label>
                    <Textarea
                      placeholder="Explain your decision..."
                      value={reasoning}
                      onChange={(e) => setReasoning(e.target.value)}
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Attestation *</label>
                    <Input
                      placeholder="I attest that I have reviewed this insight..."
                      value={attestation}
                      onChange={(e) => setAttestation(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItem(null)}>
              Cancel
            </Button>
            {reviewAction && (
              <Button
                onClick={handleReview}
                disabled={!reasoning || !attestation || submitting}
                className={reviewAction === 'approve' ? 'bg-green-600' : 'bg-red-600'}
              >
                {submitting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : reviewAction === 'approve' ? (
                  <ThumbsUp className="h-4 w-4 mr-2" />
                ) : (
                  <ThumbsDown className="h-4 w-4 mr-2" />
                )}
                {reviewAction === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OversightSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-24" />
      <div className="grid grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
