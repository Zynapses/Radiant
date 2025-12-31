'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  ClipboardCheck,
  FileText,
  Settings,
  History,
  RefreshCw,
  ChevronRight,
  Check,
  Clock,
  AlertTriangle,
  Ban,
  Play,
  ExternalLink,
  Info,
  Download,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ChecklistVersion {
  id: string;
  standardId: string;
  standardCode: string;
  standardName: string;
  version: string;
  versionDate: string;
  title: string;
  description?: string;
  isLatest: boolean;
  isActive: boolean;
}

interface ChecklistCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  itemCount: number;
  completedCount: number;
}

interface ChecklistItem {
  id: string;
  categoryCode?: string;
  categoryName?: string;
  itemCode: string;
  title: string;
  description?: string;
  guidance?: string;
  evidenceTypes: string[];
  apiEndpoint?: string;
  isRequired: boolean;
  isAutomatable: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedMinutes?: number;
  status?: string;
  completedAt?: string;
  completedBy?: string;
}

interface ChecklistProgress {
  standardCode: string;
  totalItems: number;
  completedItems: number;
  inProgressItems: number;
  completionPercentage: number;
  estimatedRemainingMinutes: number;
}

interface StandardDashboard {
  standardId: string;
  standardCode: string;
  standardName: string;
  effectiveVersionId: string | null;
  effectiveVersion: string | null;
  versionSelection: string;
  progress: ChecklistProgress | null;
  lastAuditRun: any;
}

interface DashboardData {
  standards: StandardDashboard[];
  pendingUpdates: number;
  recentAuditRuns: any[];
}

// ============================================================================
// API
// ============================================================================

const API_BASE = '/api/admin/compliance/checklists';

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch(`${API_BASE}/dashboard`);
  if (!res.ok) throw new Error('Failed to fetch dashboard');
  return res.json();
}

async function fetchVersions(standardId: string): Promise<ChecklistVersion[]> {
  const res = await fetch(`${API_BASE}/versions?standardId=${standardId}`);
  if (!res.ok) throw new Error('Failed to fetch versions');
  const data = await res.json();
  return data.versions;
}

async function fetchCategories(versionId: string): Promise<ChecklistCategory[]> {
  const res = await fetch(`${API_BASE}/versions/${versionId}/categories`);
  if (!res.ok) throw new Error('Failed to fetch categories');
  const data = await res.json();
  return data.categories;
}

async function fetchItems(versionId: string): Promise<ChecklistItem[]> {
  const res = await fetch(`${API_BASE}/versions/${versionId}/items`);
  if (!res.ok) throw new Error('Failed to fetch items');
  const data = await res.json();
  return data.items;
}

async function updateItemProgress(itemId: string, status: string, notes?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/progress/items/${itemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, notes })
  });
  if (!res.ok) throw new Error('Failed to update progress');
}

async function updateConfig(standardId: string, config: any): Promise<void> {
  const res = await fetch(`${API_BASE}/config/${standardId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  if (!res.ok) throw new Error('Failed to update config');
}

async function startAuditRun(versionId: string, runType: string): Promise<void> {
  const res = await fetch(`${API_BASE}/audit-runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ versionId, runType })
  });
  if (!res.ok) throw new Error('Failed to start audit run');
}

// ============================================================================
// COMPONENTS
// ============================================================================

function StatusBadge({ status }: { status?: string }) {
  switch (status) {
    case 'completed':
      return <Badge className="bg-green-500"><Check className="h-3 w-3 mr-1" /> Complete</Badge>;
    case 'in_progress':
      return <Badge className="bg-blue-500"><Clock className="h-3 w-3 mr-1" /> In Progress</Badge>;
    case 'blocked':
      return <Badge className="bg-red-500"><Ban className="h-3 w-3 mr-1" /> Blocked</Badge>;
    case 'not_applicable':
      return <Badge variant="secondary">N/A</Badge>;
    default:
      return <Badge variant="outline">Not Started</Badge>;
  }
}

function PriorityBadge({ priority }: { priority: string }) {
  switch (priority) {
    case 'critical':
      return <Badge className="bg-red-600">Critical</Badge>;
    case 'high':
      return <Badge className="bg-orange-500">High</Badge>;
    case 'medium':
      return <Badge className="bg-yellow-500 text-black">Medium</Badge>;
    default:
      return <Badge variant="secondary">Low</Badge>;
  }
}

function StandardCard({ standard, onSelect }: { standard: StandardDashboard; onSelect: () => void }) {
  const progress = standard.progress;
  
  return (
    <Card className="cursor-pointer hover:border-primary transition-colors" onClick={onSelect}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{standard.standardCode}</CardTitle>
          <Badge variant={standard.versionSelection === 'auto' ? 'default' : 'secondary'}>
            {standard.versionSelection === 'auto' ? 'Auto' : 'Pinned'}
          </Badge>
        </div>
        <CardDescription>{standard.standardName}</CardDescription>
      </CardHeader>
      <CardContent>
        {progress ? (
          <>
            <div className="flex items-center justify-between text-sm mb-2">
              <span>{progress.completedItems} / {progress.totalItems} items</span>
              <span className="font-medium">{progress.completionPercentage.toFixed(0)}%</span>
            </div>
            <Progress value={progress.completionPercentage} className="h-2" />
            {progress.estimatedRemainingMinutes > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                ~{Math.ceil(progress.estimatedRemainingMinutes / 60)}h remaining
              </p>
            )}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">
            {standard.effectiveVersionId ? (
              <span>Version: {standard.effectiveVersion}</span>
            ) : (
              <span className="text-yellow-600">No checklist available</span>
            )}
          </div>
        )}
        <div className="flex items-center justify-end mt-3">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function ChecklistItemRow({ 
  item, 
  onStatusChange 
}: { 
  item: ChecklistItem; 
  onStatusChange: (itemId: string, status: string) => void;
}) {
  const [showGuidance, setShowGuidance] = useState(false);
  const [notes, setNotes] = useState('');
  
  const isComplete = item.status === 'completed' || item.status === 'not_applicable';
  
  return (
    <>
      <TableRow className={isComplete ? 'opacity-60' : ''}>
        <TableCell className="w-10">
          <Checkbox
            checked={isComplete}
            onCheckedChange={(checked) => {
              onStatusChange(item.id, checked ? 'completed' : 'not_started');
            }}
          />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted px-1 rounded">{item.itemCode}</code>
            <PriorityBadge priority={item.priority} />
            {item.isAutomatable && (
              <Badge variant="outline" className="text-xs">
                <Play className="h-3 w-3 mr-1" /> Auto
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div>
            <p className={`font-medium ${isComplete ? 'line-through' : ''}`}>{item.title}</p>
            {item.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">{item.description}</p>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            {item.evidenceTypes.map((type) => (
              <Badge key={type} variant="outline" className="text-xs">{type}</Badge>
            ))}
          </div>
        </TableCell>
        <TableCell>
          <StatusBadge status={item.status} />
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            {item.estimatedMinutes && (
              <span className="text-xs text-muted-foreground">{item.estimatedMinutes}m</span>
            )}
            {item.guidance && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowGuidance(!showGuidance);
                }}
              >
                <Info className="h-4 w-4" />
              </Button>
            )}
            {item.apiEndpoint && (
              <Button variant="ghost" size="sm" asChild>
                <a href={item.apiEndpoint} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {showGuidance && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/50">
            <div className="p-4">
              <h4 className="font-medium mb-2">Guidance</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.guidance}</p>
              <div className="mt-4">
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this item..."
                  className="mt-1"
                />
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function VersionSelector({
  standardId,
  currentVersionId,
  versionSelection,
  onConfigChange
}: {
  standardId: string;
  currentVersionId?: string;
  versionSelection: string;
  onConfigChange: (config: any) => void;
}) {
  const { data: versions } = useQuery({
    queryKey: ['checklist-versions', standardId],
    queryFn: () => fetchVersions(standardId)
  });

  return (
    <div className="flex items-center gap-4">
      <div>
        <label className="text-sm font-medium">Version Selection</label>
        <Select
          value={versionSelection}
          onValueChange={(value) => onConfigChange({ versionSelection: value })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto (Latest)</SelectItem>
            <SelectItem value="specific">Specific Version</SelectItem>
            <SelectItem value="pinned">Pinned</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {versionSelection !== 'auto' && versions && (
        <div>
          <label className="text-sm font-medium">Selected Version</label>
          <Select
            value={currentVersionId}
            onValueChange={(value) => onConfigChange({ 
              versionSelection, 
              selectedVersionId: value 
            })}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select version" />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.version} {v.isLatest && '(Latest)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function ComplianceChecklistsPage() {
  const queryClient = useQueryClient();
  const [selectedStandard, setSelectedStandard] = useState<StandardDashboard | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['checklist-dashboard'],
    queryFn: fetchDashboard
  });

  const { data: categories } = useQuery({
    queryKey: ['checklist-categories', selectedStandard?.effectiveVersionId],
    queryFn: () => fetchCategories(selectedStandard!.effectiveVersionId!),
    enabled: !!selectedStandard?.effectiveVersionId
  });

  const { data: items } = useQuery({
    queryKey: ['checklist-items', selectedStandard?.effectiveVersionId],
    queryFn: () => fetchItems(selectedStandard!.effectiveVersionId!),
    enabled: !!selectedStandard?.effectiveVersionId
  });

  const updateProgressMutation = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: string }) => 
      updateItemProgress(itemId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-items'] });
      queryClient.invalidateQueries({ queryKey: ['checklist-dashboard'] });
    }
  });

  const updateConfigMutation = useMutation({
    mutationFn: ({ standardId, config }: { standardId: string; config: any }) =>
      updateConfig(standardId, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-dashboard'] });
    }
  });

  const startAuditMutation = useMutation({
    mutationFn: ({ versionId, runType }: { versionId: string; runType: string }) =>
      startAuditRun(versionId, runType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-dashboard'] });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Detail view for a selected standard
  if (selectedStandard) {
    const groupedItems = items?.reduce((acc, item) => {
      const cat = item.categoryCode || 'uncategorized';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, ChecklistItem[]>) || {};

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => setSelectedStandard(null)} className="mb-2">
              ← Back to Overview
            </Button>
            <h1 className="text-2xl font-bold">{selectedStandard.standardCode} Checklist</h1>
            <p className="text-muted-foreground">{selectedStandard.standardName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => startAuditMutation.mutate({
                versionId: selectedStandard.effectiveVersionId!,
                runType: 'pre_audit'
              })}
              disabled={!selectedStandard.effectiveVersionId}
            >
              <Play className="h-4 w-4 mr-2" /> Start Pre-Audit
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
          </div>
        </div>

        {selectedStandard.progress && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-3xl font-bold">
                    {selectedStandard.progress.completionPercentage.toFixed(0)}%
                  </p>
                  <p className="text-muted-foreground">
                    {selectedStandard.progress.completedItems} of {selectedStandard.progress.totalItems} items complete
                  </p>
                </div>
                <VersionSelector
                  standardId={selectedStandard.standardId}
                  currentVersionId={selectedStandard.effectiveVersionId || undefined}
                  versionSelection={selectedStandard.versionSelection}
                  onConfigChange={(config) => updateConfigMutation.mutate({
                    standardId: selectedStandard.standardId,
                    config
                  })}
                />
              </div>
              <Progress value={selectedStandard.progress.completionPercentage} className="h-3" />
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">
              <ClipboardCheck className="h-4 w-4 mr-2" /> Overview
            </TabsTrigger>
            <TabsTrigger value="items">
              <FileText className="h-4 w-4 mr-2" /> All Items
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" /> Audit History
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" /> Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categories?.map((category) => (
                <Card key={category.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{category.name}</CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">{category.completedCount} / {category.itemCount}</span>
                      <span className="text-sm font-medium">
                        {category.itemCount > 0 
                          ? Math.round((category.completedCount / category.itemCount) * 100)
                          : 0}%
                      </span>
                    </div>
                    <Progress 
                      value={category.itemCount > 0 
                        ? (category.completedCount / category.itemCount) * 100 
                        : 0} 
                      className="h-2" 
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="items">
            {Object.entries(groupedItems).map(([categoryCode, categoryItems]) => {
              const category = categories?.find(c => c.code === categoryCode);
              return (
                <Card key={categoryCode} className="mb-4">
                  <CardHeader>
                    <CardTitle>{category?.name || categoryCode}</CardTitle>
                    {category?.description && (
                      <CardDescription>{category.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead className="w-48">Code</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead className="w-40">Evidence</TableHead>
                          <TableHead className="w-32">Status</TableHead>
                          <TableHead className="w-24 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryItems.map((item) => (
                          <ChecklistItemRow
                            key={item.id}
                            item={item}
                            onStatusChange={(itemId, status) => 
                              updateProgressMutation.mutate({ itemId, status })
                            }
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Audit Run History</CardTitle>
                <CardDescription>Previous checklist audits and reviews</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard?.recentAuditRuns.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No audit runs yet. Start a pre-audit to begin.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Items</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboard?.recentAuditRuns.map((run) => (
                        <TableRow key={run.id}>
                          <TableCell>
                            {new Date(run.startedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{run.runType}</Badge>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={run.status} />
                          </TableCell>
                          <TableCell>
                            {run.score ? `${run.score.toFixed(0)}%` : '-'}
                          </TableCell>
                          <TableCell>
                            {run.passedItems}/{run.totalItems}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Checklist Configuration</CardTitle>
                <CardDescription>
                  Configure version selection and notification preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <VersionSelector
                  standardId={selectedStandard.standardId}
                  currentVersionId={selectedStandard.effectiveVersionId || undefined}
                  versionSelection={selectedStandard.versionSelection}
                  onConfigChange={(config) => updateConfigMutation.mutate({
                    standardId: selectedStandard.standardId,
                    config
                  })}
                />
                
                <div className="border-t pt-4">
                  <h3 className="font-medium mb-4">Auto-Update Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Auto-update enabled</p>
                        <p className="text-sm text-muted-foreground">
                          Automatically update to new checklist versions when available
                        </p>
                      </div>
                      <Checkbox defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Notification on update</p>
                        <p className="text-sm text-muted-foreground">
                          Receive notifications when new versions are available
                        </p>
                      </div>
                      <Checkbox defaultChecked />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Overview dashboard
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compliance Checklists</h1>
          <p className="text-muted-foreground">
            Manage versioned compliance checklists linked to regulatory standards
          </p>
        </div>
        {dashboard && dashboard.pendingUpdates > 0 && (
          <Badge variant="destructive" className="text-sm">
            <AlertTriangle className="h-4 w-4 mr-1" />
            {dashboard.pendingUpdates} pending updates
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {dashboard?.standards.map((standard) => (
          <StandardCard
            key={standard.standardId}
            standard={standard}
            onSelect={() => setSelectedStandard(standard)}
          />
        ))}
      </div>

      {dashboard?.recentAuditRuns && dashboard.recentAuditRuns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Recent Audit Runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Standard</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.recentAuditRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">{run.standardCode}</TableCell>
                    <TableCell>{new Date(run.startedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{run.runType}</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                    <TableCell>
                      {run.score ? `${run.score.toFixed(0)}%` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
