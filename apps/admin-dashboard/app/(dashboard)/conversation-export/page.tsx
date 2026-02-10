'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Download,
  FileJson,
  FileText,
  Archive,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  Plus,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExportFormat = 'json' | 'markdown' | 'zip';
type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'expired';

interface ConversationExport {
  exportId: string;
  conversationId: string;
  format: ExportFormat;
  status: ExportStatus;
  messageCount: number;
  attachmentCount: number;
  fileSizeBytes?: number;
  downloadUrl?: string;
  downloadExpiresAt?: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadge(status: ExportStatus) {
  const map: Record<ExportStatus, { variant: string; icon: React.ReactNode; label: string }> = {
    pending: { variant: 'bg-yellow-100 text-yellow-800', icon: <Clock className="h-3 w-3" />, label: 'Pending' },
    processing: { variant: 'bg-blue-100 text-blue-800', icon: <Loader2 className="h-3 w-3 animate-spin" />, label: 'Processing' },
    completed: { variant: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-3 w-3" />, label: 'Completed' },
    failed: { variant: 'bg-red-100 text-red-800', icon: <XCircle className="h-3 w-3" />, label: 'Failed' },
    expired: { variant: 'bg-gray-100 text-gray-800', icon: <Clock className="h-3 w-3" />, label: 'Expired' },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.variant}`}>
      {s.icon} {s.label}
    </span>
  );
}

function formatIcon(format: ExportFormat) {
  switch (format) {
    case 'json': return <FileJson className="h-4 w-4 text-amber-500" />;
    case 'markdown': return <FileText className="h-4 w-4 text-blue-500" />;
    case 'zip': return <Archive className="h-4 w-4 text-purple-500" />;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ConversationExportPage() {
  const [exports, setExports] = useState<ConversationExport[]>([]);
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [userId, setUserId] = useState('');
  const [searched, setSearched] = useState(false);

  // New export form
  const [showNew, setShowNew] = useState(false);
  const [newConvId, setNewConvId] = useState('');
  const [newFormat, setNewFormat] = useState<ExportFormat>('json');
  const [creating, setCreating] = useState(false);

  const loadExports = useCallback(async () => {
    if (!tenantId || !userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/conversation-export?tenant_id=${encodeURIComponent(tenantId)}&user_id=${encodeURIComponent(userId)}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setExports(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load exports:', err);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, [tenantId, userId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadExports();
  };

  const handleCreate = async () => {
    if (!tenantId || !userId || !newConvId) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/conversation-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          userId,
          conversationId: newConvId,
          format: newFormat,
          includeAttachments: true,
          includeMetadata: true,
        }),
      });
      if (res.ok) {
        setNewConvId('');
        setShowNew(false);
        loadExports();
      }
    } catch (err) {
      console.error('Failed to create export:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conversation Export</h1>
          <p className="text-muted-foreground mt-1">
            Export conversation history as JSON, Markdown, or ZIP archives with attachments
          </p>
        </div>
        <Button onClick={() => setShowNew(!showNew)} variant={showNew ? 'secondary' : 'default'}>
          <Plus className="mr-2 h-4 w-4" /> New Export
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lookup Exports</CardTitle>
          <CardDescription>Enter a tenant ID and user ID to view their export history</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex items-end gap-4">
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">Tenant ID</label>
              <Input placeholder="uuid" value={tenantId} onChange={e => setTenantId(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">User ID</label>
              <Input placeholder="uuid" value={userId} onChange={e => setUserId(e.target.value)} />
            </div>
            <Button type="submit" disabled={!tenantId || !userId || loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Search
            </Button>
            {searched && (
              <Button variant="ghost" onClick={loadExports} disabled={loading}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* New Export Form */}
      {showNew && (
        <Card className="border-dashed border-2 border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">Request New Export</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-sm font-medium">Conversation ID</label>
                <Input placeholder="uuid" value={newConvId} onChange={e => setNewConvId(e.target.value)} />
              </div>
              <div className="w-48 space-y-1">
                <label className="text-sm font-medium">Format</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={newFormat}
                  onChange={e => setNewFormat(e.target.value as ExportFormat)}
                >
                  <option value="json">JSON</option>
                  <option value="markdown">Markdown</option>
                  <option value="zip">ZIP (with attachments)</option>
                </select>
              </div>
              <Button onClick={handleCreate} disabled={creating || !newConvId || !tenantId || !userId}>
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Create Export
              </Button>
            </div>
            {(!tenantId || !userId) && (
              <p className="mt-2 text-xs text-muted-foreground">Enter tenant &amp; user IDs above first.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      {searched && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Export History</CardTitle>
            <CardDescription>{exports.length} export{exports.length !== 1 ? 's' : ''} found</CardDescription>
          </CardHeader>
          <CardContent>
            {exports.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No exports found for this tenant/user.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">Export ID</th>
                      <th className="pb-2 pr-4">Conversation</th>
                      <th className="pb-2 pr-4">Format</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Messages</th>
                      <th className="pb-2 pr-4">Attachments</th>
                      <th className="pb-2 pr-4">Size</th>
                      <th className="pb-2 pr-4">Created</th>
                      <th className="pb-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exports.map(exp => (
                      <tr key={exp.exportId} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-3 pr-4 font-mono text-xs">{exp.exportId?.slice(0, 8)}…</td>
                        <td className="py-3 pr-4 font-mono text-xs">{exp.conversationId?.slice(0, 8)}…</td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex items-center gap-1">
                            {formatIcon(exp.format)} {exp.format.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 pr-4">{statusBadge(exp.status)}</td>
                        <td className="py-3 pr-4 text-center">{exp.messageCount}</td>
                        <td className="py-3 pr-4 text-center">{exp.attachmentCount}</td>
                        <td className="py-3 pr-4">{formatBytes(exp.fileSizeBytes)}</td>
                        <td className="py-3 pr-4 text-xs text-muted-foreground">
                          {exp.createdAt ? new Date(exp.createdAt).toLocaleString() : '—'}
                        </td>
                        <td className="py-3">
                          {exp.status === 'completed' && exp.downloadUrl && (
                            <a href={exp.downloadUrl} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline">
                                <Download className="mr-1 h-3 w-3" /> Download
                              </Button>
                            </a>
                          )}
                          {exp.status === 'failed' && (
                            <span className="text-xs text-red-600">{exp.errorMessage || 'Export failed'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
