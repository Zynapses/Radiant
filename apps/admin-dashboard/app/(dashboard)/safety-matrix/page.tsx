'use client';

/**
 * RADIANT Safety Matrix Manager
 * Entity-Action Contraindication Grid Dashboard
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Shield,
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  Eye,
  Plus,
  RefreshCw,
  Grid3X3,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Pill,
  Activity,
  Scale,
  DollarSign,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

type ContraindicationSeverity = 'absolute' | 'relative' | 'caution' | 'monitor';

interface SafetyEntity {
  id: string;
  name: string;
  category: string;
  riskLevel: string;
  contraindicationCount: number;
}

interface SafetyAction {
  id: string;
  name: string;
  category: string;
  verbPresent: string;
}

interface Contraindication {
  id: string;
  entityId: string;
  actionId: string;
  entityName?: string;
  actionName?: string;
  severity: ContraindicationSeverity;
  reason: string;
  status: string;
  allowOverride: boolean;
  createdAt: string;
}

interface DashboardData {
  summary: {
    totalEntities: number;
    totalActions: number;
    totalContraindications: number;
    pendingReview: number;
    byDomain: Array<{ domainId: string; domainName: string; contraindicationCount: number }>;
    bySeverity: Record<ContraindicationSeverity, number>;
  };
  recentContraindications: Contraindication[];
  pendingReviewItems: Contraindication[];
  topEntities: Array<{ entity: SafetyEntity; contraindicationCount: number }>;
}

// =============================================================================
// Constants
// =============================================================================

const SEVERITY_CONFIG: Record<ContraindicationSeverity, { color: string; icon: React.ReactNode; label: string }> = {
  absolute: { color: 'bg-red-500', icon: <AlertOctagon className="h-4 w-4" />, label: 'Absolute (Never)' },
  relative: { color: 'bg-orange-500', icon: <AlertTriangle className="h-4 w-4" />, label: 'Relative (Usually Avoid)' },
  caution: { color: 'bg-yellow-500', icon: <AlertCircle className="h-4 w-4" />, label: 'Caution (Consider Risks)' },
  monitor: { color: 'bg-green-500', icon: <Eye className="h-4 w-4" />, label: 'Monitor (Proceed with Care)' },
};

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  healthcare: <Pill className="h-5 w-5" />,
  legal: <Scale className="h-5 w-5" />,
  finance: <DollarSign className="h-5 w-5" />,
};

// =============================================================================
// Component
// =============================================================================

export default function SafetyMatrixPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string>('healthcare');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/safety-matrix/dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard');
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading && !data) {
    return <PageSkeleton />;
  }

  const summary = data?.summary ?? {
    totalEntities: 0,
    totalActions: 0,
    totalContraindications: 0,
    pendingReview: 0,
    byDomain: [],
    bySeverity: { absolute: 0, relative: 0, caution: 0, monitor: 0 },
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-red-600" />
            Safety Matrix Manager
          </h1>
          <p className="text-muted-foreground mt-1">
            Entity-Action Contraindication Grid for Domain Expert Cortex
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedDomain} onValueChange={setSelectedDomain}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select domain" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="healthcare">Healthcare</SelectItem>
              <SelectItem value="legal">Legal</SelectItem>
              <SelectItem value="finance">Finance</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchDashboard} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Contraindication
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Entities"
          value={summary.totalEntities}
          subtitle="Medications, conditions, etc."
          icon={<FileText className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title="Total Actions"
          value={summary.totalActions}
          subtitle="Prescribe, recommend, etc."
          icon={<Activity className="h-5 w-5" />}
          color="purple"
        />
        <StatCard
          title="Contraindications"
          value={summary.totalContraindications}
          subtitle={`${summary.pendingReview} pending review`}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="red"
        />
        <StatCard
          title="Matrix Coverage"
          value={`${summary.totalEntities > 0 && summary.totalActions > 0 
            ? ((summary.totalContraindications / (summary.totalEntities * summary.totalActions)) * 100).toFixed(1)
            : 0}%`}
          subtitle="Cells with contraindications"
          icon={<Grid3X3 className="h-5 w-5" />}
          color="amber"
        />
      </div>

      {/* Severity Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Contraindications by Severity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {(Object.entries(SEVERITY_CONFIG) as [ContraindicationSeverity, typeof SEVERITY_CONFIG['absolute']][]).map(([severity, config]) => (
              <div
                key={severity}
                className="flex items-center gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900"
              >
                <div className={`p-2 rounded-lg ${config.color} text-white`}>
                  {config.icon}
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.bySeverity[severity] || 0}</p>
                  <p className="text-xs text-muted-foreground">{config.label}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="grid" className="space-y-4">
        <TabsList>
          <TabsTrigger value="grid">
            <Grid3X3 className="h-4 w-4 mr-2" />
            Matrix Grid
          </TabsTrigger>
          <TabsTrigger value="pending">
            <Clock className="h-4 w-4 mr-2" />
            Pending Review ({summary.pendingReview})
          </TabsTrigger>
          <TabsTrigger value="recent">
            <FileText className="h-4 w-4 mr-2" />
            Recent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grid">
          <MatrixGridView domain={selectedDomain} />
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Review</CardTitle>
              <CardDescription>
                Contraindications awaiting approval
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(data?.pendingReviewItems ?? []).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No items pending review
                </p>
              ) : (
                <div className="space-y-3">
                  {data?.pendingReviewItems.map((item) => (
                    <ContraindicationCard key={item.id} contraindication={item} showActions />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>Recent Contraindications</CardTitle>
            </CardHeader>
            <CardContent>
              {(data?.recentContraindications ?? []).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No contraindications yet
                </p>
              ) : (
                <div className="space-y-3">
                  {data?.recentContraindications.map((item) => (
                    <ContraindicationCard key={item.id} contraindication={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <CreateContraindicationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        domain={selectedDomain}
        onSuccess={() => {
          setCreateDialogOpen(false);
          fetchDashboard();
        }}
      />
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-50',
    purple: 'text-purple-600 bg-purple-50',
    red: 'text-red-600 bg-red-50',
    amber: 'text-amber-600 bg-amber-50',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className={`p-3 rounded-full ${colorClasses[color]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MatrixGridView({ domain }: { domain: string }) {
  const [grid, setGrid] = useState<{
    entities: SafetyEntity[];
    actions: SafetyAction[];
    rows: Array<{ entity: SafetyEntity; cells: Array<{ hasContraindication: boolean; severity?: ContraindicationSeverity }> }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGrid() {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/safety-matrix/grid?domainId=${domain}`);
        if (response.ok) {
          const data = await response.json();
          setGrid(data);
        }
      } catch {
        // Ignore errors
      } finally {
        setLoading(false);
      }
    }
    fetchGrid();
  }, [domain]);

  if (loading) {
    return <Skeleton className="h-64" />;
  }

  if (!grid || grid.entities.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Grid3X3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No entities configured for this domain</p>
          <p className="text-sm mt-1">Add entities and actions to build the contraindication matrix</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {DOMAIN_ICONS[domain] || <Shield className="h-5 w-5" />}
          {domain.charAt(0).toUpperCase() + domain.slice(1)} Contraindication Matrix
        </CardTitle>
        <CardDescription>
          {grid.entities.length} entities × {grid.actions.length} actions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border p-2 bg-slate-100 dark:bg-slate-800 text-left">Entity / Action</th>
                {grid.actions.slice(0, 10).map((action) => (
                  <th key={action.id} className="border p-2 bg-slate-100 dark:bg-slate-800 text-center min-w-[80px]">
                    <span className="text-xs">{action.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.rows.slice(0, 15).map((row) => (
                <tr key={row.entity.id}>
                  <td className="border p-2 font-medium">{row.entity.name}</td>
                  {row.cells.slice(0, 10).map((cell, idx) => (
                    <td
                      key={idx}
                      className={`border p-2 text-center ${
                        cell.hasContraindication
                          ? SEVERITY_CONFIG[cell.severity || 'caution'].color + ' text-white'
                          : 'bg-white dark:bg-slate-900'
                      }`}
                    >
                      {cell.hasContraindication && SEVERITY_CONFIG[cell.severity || 'caution'].icon}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(grid.entities.length > 15 || grid.actions.length > 10) && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Showing first 15 entities × 10 actions. Full matrix has {grid.entities.length} × {grid.actions.length} cells.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ContraindicationCard({
  contraindication,
  showActions = false,
}: {
  contraindication: Contraindication;
  showActions?: boolean;
}) {
  const config = SEVERITY_CONFIG[contraindication.severity];

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border">
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-lg ${config.color} text-white`}>
          {config.icon}
        </div>
        <div>
          <p className="font-medium">
            {contraindication.entityName || 'Entity'} → {contraindication.actionName || 'Action'}
          </p>
          <p className="text-sm text-muted-foreground line-clamp-1">
            {contraindication.reason}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={contraindication.status === 'active' ? 'default' : 'secondary'}>
          {contraindication.status}
        </Badge>
        {showActions && (
          <>
            <Button size="sm" variant="outline">
              <CheckCircle className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button size="sm" variant="outline">
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function CreateContraindicationDialog({
  open,
  onOpenChange,
  domain,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: string;
  onSuccess: () => void;
}) {
  const [entityName, setEntityName] = useState('');
  const [actionName, setActionName] = useState('');
  const [severity, setSeverity] = useState<ContraindicationSeverity>('caution');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    try {
      setSaving(true);
      // In real implementation, would create entity/action if needed, then create contraindication
      await fetch('/api/admin/safety-matrix/contraindications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainId: domain,
          entityId: 'placeholder', // Would be resolved from entityName
          actionId: 'placeholder', // Would be resolved from actionName
          severity,
          reason,
        }),
      });
      onSuccess();
    } catch {
      // Handle error
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Add Contraindication
          </DialogTitle>
          <DialogDescription>
            Define a new entity-action contraindication for the {domain} domain
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Entity</Label>
              <Input
                placeholder="e.g., Aspirin"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
              />
            </div>
            <div>
              <Label>Action</Label>
              <Input
                placeholder="e.g., prescribe to"
                value={actionName}
                onChange={(e) => setActionName(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as ContraindicationSeverity)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      {config.icon}
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reason</Label>
            <Textarea
              placeholder="Explain why this combination is contraindicated..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !entityName || !actionName || !reason}>
            {saving ? 'Creating...' : 'Create Contraindication'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PageSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-32" />
      <Skeleton className="h-64" />
    </div>
  );
}
