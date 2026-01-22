'use client';

/**
 * RADIANT v5.43.0 - Decision Records (DIA Engine)
 * 
 * Main page for viewing and managing Decision Intelligence Artifacts.
 * The "Glass Box" decision records with full evidence provenance.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api/client';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
  FileText,
  ChevronRight,
  Activity,
  TrendingUp,
  Archive,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { DIAColors } from './components/dia-tokens';

interface ArtifactSummary {
  id: string;
  conversationId: string;
  title: string;
  status: 'active' | 'frozen' | 'archived' | 'invalidated';
  validationStatus: 'fresh' | 'stale' | 'verified' | 'invalidated';
  version: number;
  claimCount: number;
  dissentCount: number;
  overallConfidence: number;
  phiDetected: boolean;
  piiDetected: boolean;
  primaryDomain?: string;
  createdAt: string;
  updatedAt: string;
}

interface DashboardMetrics {
  totalArtifacts: number;
  activeArtifacts: number;
  frozenArtifacts: number;
  averageConfidence: number;
  artifactsWithPhi: number;
  artifactsWithPii: number;
  validationCostMtd: number;
  staleArtifacts: number;
  topDomains: Array<{ domain: string; count: number }>;
  complianceFrameworkUsage: Array<{ framework: string; count: number }>;
}

const statusColors: Record<string, string> = {
  active: DIAColors.heatmapVerified,
  frozen: '#6366F1',
  archived: DIAColors.textMuted,
  invalidated: DIAColors.heatmapContested,
};

const validationStatusColors: Record<string, string> = {
  fresh: DIAColors.heatmapVerified,
  verified: DIAColors.heatmapVerified,
  stale: DIAColors.heatmapStale,
  invalidated: DIAColors.heatmapContested,
};

export default function DecisionRecordsPage() {
  const router = useRouter();
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Create dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [conversationId, setConversationId] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [artifactsRes, dashboardRes] = await Promise.all([
        api.get<{ artifacts: ArtifactSummary[]; total: number }>(
          `/api/thinktank/decision-artifacts${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`
        ),
        api.get<{ dashboard: DashboardMetrics }>('/api/thinktank/decision-artifacts/dashboard'),
      ]);
      
      setArtifacts(artifactsRes.artifacts);
      setMetrics(dashboardRes.dashboard);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch decision records:', err);
      setError(err instanceof Error ? err.message : 'Failed to load decision records');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredArtifacts = useMemo(() => {
    if (!searchQuery) return artifacts;
    const query = searchQuery.toLowerCase();
    return artifacts.filter(
      (a) =>
        a.title.toLowerCase().includes(query) ||
        a.primaryDomain?.toLowerCase().includes(query)
    );
  }, [artifacts, searchQuery]);

  const handleCreateArtifact = async () => {
    if (!conversationId.trim()) return;
    
    try {
      setCreating(true);
      const result = await api.post<{ artifact: ArtifactSummary }>(
        '/api/thinktank/decision-artifacts',
        { conversationId: conversationId.trim() }
      );
      
      setShowCreateDialog(false);
      setConversationId('');
      router.push(`/decision-records/${result.artifact.id}`);
    } catch (err) {
      console.error('Failed to create artifact:', err);
      setError(err instanceof Error ? err.message : 'Failed to create artifact');
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await api.delete(`/api/thinktank/decision-artifacts/${id}`);
      fetchData();
    } catch (err) {
      console.error('Failed to archive artifact:', err);
    }
  };

  if (loading && artifacts.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">Decision Records</h1>
          <p className="text-muted-foreground">
            Glass Box decision intelligence with full evidence provenance
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Generate Artifact
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
          {error}
        </div>
      )}

      {/* Metrics cards */}
      {metrics && (
        <div className="grid grid-cols-4 gap-4">
          <MetricCard
            title="Total Artifacts"
            value={metrics.totalArtifacts}
            icon={FileText}
            description={`${metrics.activeArtifacts} active, ${metrics.frozenArtifacts} frozen`}
          />
          <MetricCard
            title="Avg Confidence"
            value={`${Math.round(metrics.averageConfidence * 100)}%`}
            icon={TrendingUp}
            description="Across all active artifacts"
            color={metrics.averageConfidence > 0.7 ? DIAColors.heatmapVerified : DIAColors.heatmapUnverified}
          />
          <MetricCard
            title="Stale Data"
            value={metrics.staleArtifacts}
            icon={Clock}
            description="Artifacts needing validation"
            color={metrics.staleArtifacts > 0 ? DIAColors.heatmapStale : DIAColors.heatmapVerified}
          />
          <MetricCard
            title="Sensitive Data"
            value={metrics.artifactsWithPhi + metrics.artifactsWithPii}
            icon={Shield}
            description={`${metrics.artifactsWithPhi} PHI, ${metrics.artifactsWithPii} PII`}
            color={metrics.artifactsWithPhi > 0 ? DIAColors.heatmapContested : undefined}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search artifacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="frozen">Frozen</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Artifacts list */}
      <Card>
        <CardHeader>
          <CardTitle>Artifacts</CardTitle>
          <CardDescription>
            {filteredArtifacts.length} artifact{filteredArtifacts.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredArtifacts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No decision records found</p>
              <p className="text-sm mt-1">
                Generate an artifact from a conversation to get started
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filteredArtifacts.map((artifact) => (
                  <ArtifactRow
                    key={artifact.id}
                    artifact={artifact}
                    onClick={() => router.push(`/decision-records/${artifact.id}`)}
                    onArchive={() => handleArchive(artifact.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Compliance & Domain stats */}
      {metrics && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Domains</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.topDomains.length === 0 ? (
                <p className="text-muted-foreground text-sm">No domain data</p>
              ) : (
                <div className="space-y-2">
                  {metrics.topDomains.slice(0, 5).map((d) => (
                    <div key={d.domain} className="flex justify-between items-center">
                      <span className="text-sm">{d.domain}</span>
                      <Badge variant="secondary">{d.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compliance Frameworks</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.complianceFrameworkUsage.length === 0 ? (
                <p className="text-muted-foreground text-sm">No compliance data</p>
              ) : (
                <div className="space-y-2">
                  {metrics.complianceFrameworkUsage.map((f) => (
                    <div key={f.framework} className="flex justify-between items-center">
                      <span className="text-sm uppercase">{f.framework}</span>
                      <Badge variant="secondary">{f.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Decision Artifact</DialogTitle>
            <DialogDescription>
              Extract a decision record from a Think Tank conversation
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              Conversation ID
            </label>
            <Input
              placeholder="Enter conversation UUID"
              value={conversationId}
              onChange={(e) => setConversationId(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateArtifact} disabled={creating || !conversationId.trim()}>
              {creating ? 'Generating...' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  color,
}: {
  title: string;
  value: string | number;
  icon: typeof Activity;
  description?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p 
              className="text-2xl font-semibold mt-1"
              style={color ? { color } : undefined}
            >
              {value}
            </p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div 
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${color || DIAColors.islandActiveTab}20` }}
          >
            <Icon 
              className="w-5 h-5" 
              style={{ color: color || DIAColors.islandActiveTab }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ArtifactRow({
  artifact,
  onClick,
  onArchive,
}: {
  artifact: ArtifactSummary;
  onClick: () => void;
  onArchive: () => void;
}) {
  return (
    <div
      className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      {/* Status indicator */}
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: statusColors[artifact.status] }}
      />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium truncate">{artifact.title}</h3>
          {artifact.version > 1 && (
            <Badge variant="outline" className="text-xs">v{artifact.version}</Badge>
          )}
        </div>
        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
          <span>{artifact.claimCount} claims</span>
          {artifact.dissentCount > 0 && (
            <span className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3" style={{ color: DIAColors.heatmapContested }} />
              {artifact.dissentCount} dissent
            </span>
          )}
          {artifact.primaryDomain && (
            <span>{artifact.primaryDomain}</span>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2">
        {/* Validation status */}
        <Badge
          variant="outline"
          className="text-xs"
          style={{ 
            borderColor: validationStatusColors[artifact.validationStatus],
            color: validationStatusColors[artifact.validationStatus],
          }}
        >
          {artifact.validationStatus === 'stale' && <Clock className="w-3 h-3 mr-1" />}
          {artifact.validationStatus === 'verified' && <CheckCircle2 className="w-3 h-3 mr-1" />}
          {artifact.validationStatus}
        </Badge>

        {/* PHI/PII warning */}
        {(artifact.phiDetected || artifact.piiDetected) && (
          <Badge
            variant="outline"
            className="text-xs"
            style={{ 
              borderColor: DIAColors.heatmapContested,
              color: DIAColors.heatmapContested,
            }}
          >
            <Shield className="w-3 h-3 mr-1" />
            {artifact.phiDetected ? 'PHI' : 'PII'}
          </Badge>
        )}

        {/* Confidence */}
        <span 
          className="text-sm font-medium"
          style={{ 
            color: artifact.overallConfidence > 0.7 
              ? DIAColors.heatmapVerified 
              : DIAColors.heatmapUnverified 
          }}
        >
          {Math.round(artifact.overallConfidence * 100)}%
        </span>
      </div>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }}>
            <FileText className="w-4 h-4 mr-2" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={(e) => { e.stopPropagation(); onArchive(); }}
            className="text-destructive"
          >
            <Archive className="w-4 h-4 mr-2" />
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </div>
  );
}
