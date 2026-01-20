'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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
  AlertTriangle,
  Shield,
  Users,
  FileText,
  Activity,
  Settings,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Ban,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Gavel,
  Scale,
  UserX,
  UserCheck,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface Violation {
  id: string;
  userId: string;
  category: string;
  type: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  actionTaken?: string;
  occurredAt: string;
  reportedAt: string;
}

interface Appeal {
  id: string;
  violationId: string;
  userId: string;
  reason: string;
  status: string;
  submittedAt: string;
}

interface ViolationSummary {
  userId: string;
  totalViolations: number;
  activeViolations: number;
  riskLevel: string;
  riskScore: number;
  currentEnforcementAction?: string;
}

interface DashboardData {
  config: {
    enabled: boolean;
    autoDetectionEnabled: boolean;
    autoEnforcementEnabled: boolean;
    allowAppeals: boolean;
    appealWindowDays: number;
  };
  recentViolations: Violation[];
  pendingAppeals: Appeal[];
  metrics: {
    totalViolations: number;
    newViolations: number;
    resolvedViolations: number;
    violationTrend: string;
    averageResolutionTimeHours: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  highRiskUsers: ViolationSummary[];
}

const categoryOptions = [
  { value: 'hipaa', label: 'HIPAA' },
  { value: 'gdpr', label: 'GDPR' },
  { value: 'soc2', label: 'SOC2' },
  { value: 'terms_of_service', label: 'Terms of Service' },
  { value: 'acceptable_use', label: 'Acceptable Use' },
  { value: 'content_policy', label: 'Content Policy' },
  { value: 'security', label: 'Security' },
  { value: 'billing', label: 'Billing' },
  { value: 'abuse', label: 'Abuse' },
  { value: 'other', label: 'Other' },
];

const severityOptions = [
  { value: 'warning', label: 'Warning', color: 'bg-yellow-500' },
  { value: 'minor', label: 'Minor', color: 'bg-blue-500' },
  { value: 'major', label: 'Major', color: 'bg-orange-500' },
  { value: 'critical', label: 'Critical', color: 'bg-red-500' },
];

const actionOptions = [
  { value: 'warning_issued', label: 'Issue Warning' },
  { value: 'feature_restricted', label: 'Restrict Features' },
  { value: 'rate_limited', label: 'Rate Limit' },
  { value: 'temporarily_suspended', label: 'Temporary Suspension' },
  { value: 'permanently_suspended', label: 'Permanent Suspension' },
  { value: 'account_terminated', label: 'Terminate Account' },
  { value: 'no_action', label: 'No Action' },
];

export default function ViolationsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    severity: '',
    status: '',
    search: '',
  });

  // New violation form
  const [newViolation, setNewViolation] = useState({
    userId: '',
    category: 'terms_of_service',
    type: 'policy_violation',
    severity: 'warning',
    title: '',
    description: '',
  });

  // Action form
  const [actionForm, setActionForm] = useState({
    action: 'warning_issued',
    notes: '',
    durationDays: 7,
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await fetch('/api/admin/violations/dashboard');
      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
        setViolations(data.recentViolations);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchViolations = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.category) params.append('category', filters.category);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.status) params.append('status', filters.status);

      const response = await fetch(`/api/admin/violations/violations?${params}`);
      if (response.ok) {
        const data = await response.json();
        setViolations(data.violations);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to search violations', variant: 'destructive' });
    }
  };

  const reportViolation = async () => {
    try {
      const response = await fetch('/api/admin/violations/violations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newViolation),
      });
      if (response.ok) {
        toast({ title: 'Violation Reported', description: 'The violation has been recorded.' });
        setShowReportDialog(false);
        loadDashboard();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to report violation', variant: 'destructive' });
    }
  };

  const takeAction = async () => {
    if (!selectedViolation) return;
    try {
      const response = await fetch(`/api/admin/violations/violations/${selectedViolation.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionForm.action,
          notes: actionForm.notes,
          expiresAt: actionForm.action.includes('temporarily') 
            ? new Date(Date.now() + actionForm.durationDays * 24 * 60 * 60 * 1000).toISOString()
            : undefined,
        }),
      });
      if (response.ok) {
        toast({ title: 'Action Taken', description: 'Enforcement action has been applied.' });
        setShowActionDialog(false);
        loadDashboard();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to take action', variant: 'destructive' });
    }
  };

  const reviewAppeal = async (appealId: string, decision: string) => {
    try {
      const response = await fetch(`/api/admin/violations/appeals/${appealId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reviewNotes: 'Reviewed by admin',
        }),
      });
      if (response.ok) {
        toast({ title: 'Appeal Reviewed', description: `Appeal has been ${decision}.` });
        loadDashboard();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to review appeal', variant: 'destructive' });
    }
  };

  const getSeverityBadge = (severity: string) => {
    const config = severityOptions.find(s => s.value === severity);
    return (
      <Badge variant="outline" className={`${config?.color} text-white`}>
        {config?.label || severity}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      reported: 'bg-yellow-500',
      investigating: 'bg-blue-500',
      confirmed: 'bg-orange-500',
      resolved: 'bg-green-500',
      dismissed: 'bg-gray-500',
      appealed: 'bg-purple-500',
    };
    return (
      <Badge variant="outline" className={`${colors[status] || 'bg-gray-500'} text-white`}>
        {status}
      </Badge>
    );
  };

  const getRiskBadge = (level: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-500',
      moderate: 'bg-yellow-500',
      elevated: 'bg-orange-500',
      high: 'bg-red-500',
      critical: 'bg-red-700',
    };
    return (
      <Badge variant="outline" className={`${colors[level] || 'bg-gray-500'} text-white`}>
        {level}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Violations</h1>
          <p className="text-muted-foreground">
            Track, investigate, and enforce regulatory and policy violations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={dashboard?.config.enabled ? 'default' : 'secondary'}>
            {dashboard?.config.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
          <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Report Violation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Report New Violation</DialogTitle>
                <DialogDescription>
                  Document a policy or regulatory violation for a user.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>User ID</Label>
                  <Input
                    value={newViolation.userId}
                    onChange={(e) => setNewViolation({ ...newViolation, userId: e.target.value })}
                    placeholder="Enter user ID"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={newViolation.category}
                      onValueChange={(v) => setNewViolation({ ...newViolation, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Severity</Label>
                    <Select
                      value={newViolation.severity}
                      onValueChange={(v) => setNewViolation({ ...newViolation, severity: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {severityOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={newViolation.title}
                    onChange={(e) => setNewViolation({ ...newViolation, title: e.target.value })}
                    placeholder="Brief description of the violation"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newViolation.description}
                    onChange={(e) => setNewViolation({ ...newViolation, description: e.target.value })}
                    placeholder="Detailed description of what occurred..."
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowReportDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={reportViolation}>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Report Violation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Metrics Cards */}
      {dashboard?.metrics && (
        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Violations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard.metrics.totalViolations}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {dashboard.metrics.violationTrend === 'increasing' && (
                  <><TrendingUp className="h-3 w-3 mr-1 text-red-500" /> Increasing</>
                )}
                {dashboard.metrics.violationTrend === 'decreasing' && (
                  <><TrendingDown className="h-3 w-3 mr-1 text-green-500" /> Decreasing</>
                )}
                {dashboard.metrics.violationTrend === 'stable' && (
                  <><Minus className="h-3 w-3 mr-1" /> Stable</>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                New (30d)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard.metrics.newViolations}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Resolved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{dashboard.metrics.resolvedViolations}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Appeals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{dashboard.pendingAppeals.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Resolution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboard.metrics.averageResolutionTimeHours.toFixed(1)}h
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="violations">
        <TabsList>
          <TabsTrigger value="violations">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Violations
          </TabsTrigger>
          <TabsTrigger value="appeals">
            <Scale className="h-4 w-4 mr-2" />
            Appeals ({dashboard?.pendingAppeals.length || 0})
          </TabsTrigger>
          <TabsTrigger value="high-risk">
            <UserX className="h-4 w-4 mr-2" />
            High Risk Users
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Violations Tab */}
        <TabsContent value="violations" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search violations..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="max-w-sm"
                  />
                </div>
                <Select
                  value={filters.category}
                  onValueChange={(v) => setFilters({ ...filters, category: v })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Categories</SelectItem>
                    {categoryOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filters.severity}
                  onValueChange={(v) => setFilters({ ...filters, severity: v })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {severityOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={searchViolations}>
                  <Filter className="h-4 w-4 mr-2" />
                  Apply
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Violations List */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Violations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {violations.map((violation) => (
                  <div
                    key={violation.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-4">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      <div>
                        <div className="font-medium">{violation.title}</div>
                        <div className="text-sm text-muted-foreground">
                          User: {violation.userId.substring(0, 8)}... | {violation.category.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getSeverityBadge(violation.severity)}
                      {getStatusBadge(violation.status)}
                      <div className="text-sm text-muted-foreground">
                        {new Date(violation.occurredAt).toLocaleDateString()}
                      </div>
                      <Dialog open={showActionDialog && selectedViolation?.id === violation.id} onOpenChange={(open) => {
                        setShowActionDialog(open);
                        if (open) setSelectedViolation(violation);
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Gavel className="h-4 w-4 mr-1" />
                            Action
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Take Enforcement Action</DialogTitle>
                            <DialogDescription>
                              Select an action to take for this violation.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Action</Label>
                              <Select
                                value={actionForm.action}
                                onValueChange={(v) => setActionForm({ ...actionForm, action: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {actionOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {actionForm.action.includes('temporarily') && (
                              <div className="space-y-2">
                                <Label>Duration (days)</Label>
                                <Input
                                  type="number"
                                  value={actionForm.durationDays}
                                  onChange={(e) => setActionForm({ ...actionForm, durationDays: parseInt(e.target.value) })}
                                />
                              </div>
                            )}
                            <div className="space-y-2">
                              <Label>Notes</Label>
                              <Textarea
                                value={actionForm.notes}
                                onChange={(e) => setActionForm({ ...actionForm, notes: e.target.value })}
                                placeholder="Reason for this action..."
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setShowActionDialog(false)}>
                              Cancel
                            </Button>
                            <Button onClick={takeAction} variant="destructive">
                              Apply Action
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
                {violations.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No violations found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appeals Tab */}
        <TabsContent value="appeals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Appeals</CardTitle>
              <CardDescription>Review and decide on user appeals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboard?.pendingAppeals.map((appeal) => (
                  <div
                    key={appeal.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium">Appeal from User {appeal.userId.substring(0, 8)}...</div>
                      <div className="text-sm text-muted-foreground">{appeal.reason}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Submitted: {new Date(appeal.submittedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => reviewAppeal(appeal.id, 'overturned')}
                      >
                        <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => reviewAppeal(appeal.id, 'upheld')}
                      >
                        <XCircle className="h-4 w-4 mr-1 text-red-500" />
                        Deny
                      </Button>
                    </div>
                  </div>
                ))}
                {(!dashboard?.pendingAppeals || dashboard.pendingAppeals.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No pending appeals
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* High Risk Users Tab */}
        <TabsContent value="high-risk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>High Risk Users</CardTitle>
              <CardDescription>Users with elevated violation risk scores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboard?.highRiskUsers.map((user) => (
                  <div
                    key={user.userId}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <UserX className="h-5 w-5 text-red-500" />
                      <div>
                        <div className="font-medium">User {user.userId.substring(0, 8)}...</div>
                        <div className="text-sm text-muted-foreground">
                          {user.totalViolations} total | {user.activeViolations} active
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getRiskBadge(user.riskLevel)}
                      <div className="text-sm">
                        Score: <span className="font-bold">{user.riskScore.toFixed(0)}</span>
                      </div>
                      {user.currentEnforcementAction && (
                        <Badge variant="destructive">{user.currentEnforcementAction}</Badge>
                      )}
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                ))}
                {(!dashboard?.highRiskUsers || dashboard.highRiskUsers.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No high risk users found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Violation System Settings</CardTitle>
              <CardDescription>Configure violation tracking and enforcement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Violation Tracking</Label>
                  <p className="text-sm text-muted-foreground">
                    Track and log policy violations
                  </p>
                </div>
                <Switch checked={dashboard?.config.enabled} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto Detection</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically detect violations from system events
                  </p>
                </div>
                <Switch checked={dashboard?.config.autoDetectionEnabled} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto Enforcement</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically apply escalation policy actions
                  </p>
                </div>
                <Switch checked={dashboard?.config.autoEnforcementEnabled} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow Appeals</Label>
                  <p className="text-sm text-muted-foreground">
                    Users can appeal violations within the appeal window
                  </p>
                </div>
                <Switch checked={dashboard?.config.allowAppeals} />
              </div>
              <div className="space-y-2">
                <Label>Appeal Window (days)</Label>
                <Input
                  type="number"
                  value={dashboard?.config.appealWindowDays || 30}
                  className="max-w-xs"
                  disabled
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
