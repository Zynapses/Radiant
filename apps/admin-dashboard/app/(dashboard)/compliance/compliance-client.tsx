'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
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
  FileText,
  Download,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Calendar,
  Users,
  Lock,
  Eye,
  Trash2,
  FileDown,
  Clock,
  AlertOctagon,
  Settings,
  Database,
  ShieldCheck,
  UserX,
  FileSearch,
  Bell,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { CustomReportBuilder } from '@/components/compliance/CustomReportBuilder';

interface ComplianceReport {
  id: string;
  reportType: 'soc2' | 'hipaa' | 'gdpr' | 'iso27001';
  status: 'compliant' | 'partial' | 'non_compliant';
  score: number;
  findings: ComplianceFinding[];
  generatedAt: string;
  expiresAt: string;
}

interface ComplianceFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  recommendation: string;
  status: 'open' | 'in_progress' | 'resolved';
}

interface ComplianceStats {
  overallScore: number;
  soc2Score: number;
  hipaaScore: number;
  gdprScore: number;
  iso27001Score: number;
  openFindings: number;
  lastAuditDate: string;
}

interface GDPRRequest {
  id: string;
  userId: string;
  userEmail: string;
  requestType: 'access' | 'rectification' | 'erasure' | 'restriction' | 'portability' | 'objection';
  status: 'pending' | 'verified' | 'in_progress' | 'completed' | 'rejected';
  deadline: string;
  createdAt: string;
  completedAt?: string;
}

interface ConsentRecord {
  userId: string;
  userEmail: string;
  consentType: string;
  granted: boolean;
  grantedAt?: string;
  withdrawnAt?: string;
}

interface HIPAAConfig {
  hipaaEnabled: boolean;
  phiDetectionEnabled: boolean;
  phiEncryptionEnabled: boolean;
  enhancedLoggingEnabled: boolean;
  mfaRequired: boolean;
  sessionTimeoutMinutes: number;
  accessReviewDays: number;
  phiRetentionDays: number;
  auditRetentionDays: number;
}

interface DataBreach {
  id: string;
  incidentType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'contained' | 'notifying' | 'resolved' | 'closed';
  discoveredAt: string;
  usersAffected: number;
  phiInvolved: boolean;
  description: string;
}

const REPORT_TYPES = [
  { value: 'soc2', label: 'SOC 2 Type II', icon: Shield },
  { value: 'hipaa', label: 'HIPAA', icon: Shield },
  { value: 'gdpr', label: 'GDPR', icon: Shield },
  { value: 'iso27001', label: 'ISO 27001', icon: Shield },
];

const GDPR_REQUEST_TYPES = {
  access: { label: 'Right to Access', icon: Eye, color: 'bg-blue-100 text-blue-700' },
  rectification: { label: 'Rectification', icon: FileText, color: 'bg-purple-100 text-purple-700' },
  erasure: { label: 'Erasure', icon: Trash2, color: 'bg-red-100 text-red-700' },
  restriction: { label: 'Restriction', icon: Lock, color: 'bg-amber-100 text-amber-700' },
  portability: { label: 'Portability', icon: FileDown, color: 'bg-green-100 text-green-700' },
  objection: { label: 'Objection', icon: XCircle, color: 'bg-orange-100 text-orange-700' },
};

export function ComplianceClient() {
  const [selectedReport, setSelectedReport] = useState<string>('soc2');
  const [activeTab, setActiveTab] = useState<string>('reports');
  const queryClient = useQueryClient();

  const { data: stats } = useQuery<ComplianceStats>({
    queryKey: ['compliance-stats'],
    queryFn: () => fetch('/api/admin/compliance/stats').then((r) => r.json()),
  });

  const { data: report, isLoading } = useQuery<ComplianceReport>({
    queryKey: ['compliance-report', selectedReport],
    queryFn: () =>
      fetch(`/api/admin/compliance/reports/${selectedReport}`).then((r) => r.json()),
  });

  const generateReportMutation = useMutation({
    mutationFn: (reportType: string) =>
      fetch('/api/admin/compliance/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType }),
      }).then((r) => r.json()),
  });

  // GDPR Requests
  const { data: gdprRequests } = useQuery<GDPRRequest[]>({
    queryKey: ['gdpr-requests'],
    queryFn: () => fetch('/api/admin/compliance/gdpr/requests').then((r) => r.json()),
  });

  // Consent Records
  const { data: consentRecords } = useQuery<ConsentRecord[]>({
    queryKey: ['consent-records'],
    queryFn: () => fetch('/api/admin/compliance/gdpr/consents').then((r) => r.json()),
  });

  // HIPAA Config
  const { data: hipaaConfig } = useQuery<HIPAAConfig>({
    queryKey: ['hipaa-config'],
    queryFn: () => fetch('/api/admin/compliance/hipaa/config').then((r) => r.json()),
  });

  // Data Breaches
  const { data: dataBreaches } = useQuery<DataBreach[]>({
    queryKey: ['data-breaches'],
    queryFn: () => fetch('/api/admin/compliance/breaches').then((r) => r.json()),
  });

  // Process GDPR Request
  const processGDPRMutation = useMutation({
    mutationFn: (requestId: string) =>
      fetch(`/api/admin/compliance/gdpr/requests/${requestId}/process`, {
        method: 'POST',
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gdpr-requests'] }),
  });

  // Update HIPAA Config
  const updateHIPAAMutation = useMutation({
    mutationFn: (config: Partial<HIPAAConfig>) =>
      fetch('/api/admin/compliance/hipaa/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hipaa-config'] }),
  });

  const getStatusBadge = (status: ComplianceReport['status']) => {
    switch (status) {
      case 'compliant':
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Compliant
          </Badge>
        );
      case 'partial':
        return (
          <Badge className="bg-amber-500">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Partial
          </Badge>
        );
      case 'non_compliant':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Non-Compliant
          </Badge>
        );
    }
  };

  const getSeverityColor = (severity: ComplianceFinding['severity']) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50';
      case 'high':
        return 'text-orange-600 bg-orange-50';
      case 'medium':
        return 'text-amber-600 bg-amber-50';
      case 'low':
        return 'text-blue-600 bg-blue-50';
    }
  };

  const pendingGDPRCount = gdprRequests?.filter(r => r.status === 'pending' || r.status === 'in_progress').length || 0;
  const openBreachCount = dataBreaches?.filter(b => b.status !== 'closed').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Compliance & Privacy</h1>
          <p className="text-muted-foreground">
            SOC 2, HIPAA, GDPR, and ISO 27001 compliance management
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="gdpr" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            GDPR
            {pendingGDPRCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {pendingGDPRCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="hipaa" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            HIPAA
          </TabsTrigger>
          <TabsTrigger value="breaches" className="flex items-center gap-2">
            <AlertOctagon className="h-4 w-4" />
            Breaches
            {openBreachCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {openBreachCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="retention" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Retention
          </TabsTrigger>
        </TabsList>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => generateReportMutation.mutate(selectedReport)}
              disabled={generateReportMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${generateReportMutation.isPending ? 'animate-spin' : ''}`} />
              Generate Report
            </Button>
            <Button>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <CustomReportBuilder />
          </div>

          {/* Compliance Scores */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Overall Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.overallScore || 0}%</div>
                <Progress value={stats?.overallScore || 0} className="mt-2" />
              </CardContent>
            </Card>
            {REPORT_TYPES.map((type) => {
              const score = stats?.[`${type.value}Score` as keyof ComplianceStats] || 0;
              return (
                <Card
                  key={type.value}
                  className={`cursor-pointer transition-colors ${selectedReport === type.value ? 'border-primary' : ''}`}
                  onClick={() => setSelectedReport(type.value)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {type.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{score as number}%</div>
                    <Progress value={score as number} className="mt-2" />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Report Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Select value={selectedReport} onValueChange={setSelectedReport}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPORT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {report && getStatusBadge(report.status)}
                </div>
                {report && (
                  <div className="text-sm text-muted-foreground flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Generated: {format(new Date(report.generatedAt), 'PPp')}
                    </span>
                    <span>Expires: {format(new Date(report.expiresAt), 'PP')}</span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading report...</div>
              ) : report ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                    <div className="text-4xl font-bold">{report.score}%</div>
                    <div>
                      <div className="font-medium">Compliance Score</div>
                      <div className="text-sm text-muted-foreground">
                        {report.findings.length} findings identified
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium mb-3">Findings</h3>
                    <div className="space-y-3">
                      {report.findings.map((finding) => (
                        <div key={finding.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={getSeverityColor(finding.severity)}>
                                {finding.severity.toUpperCase()}
                              </Badge>
                              <Badge variant="secondary">{finding.category}</Badge>
                            </div>
                            <Badge variant={finding.status === 'resolved' ? 'default' : finding.status === 'in_progress' ? 'secondary' : 'outline'}>
                              {finding.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="font-medium">{finding.description}</p>
                          <p className="text-sm text-muted-foreground">
                            <strong>Recommendation:</strong> {finding.recommendation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No report available. Click &quot;Generate Report&quot; to create one.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* GDPR Tab */}
        <TabsContent value="gdpr" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-600">{pendingGDPRCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{gdprRequests?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Consents Tracked</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{consentRecords?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">2.3 days</div>
              </CardContent>
            </Card>
          </div>

          {/* GDPR Requests Table */}
          <Card>
            <CardHeader>
              <CardTitle>Data Subject Requests</CardTitle>
              <CardDescription>GDPR Articles 15-22 requests from users</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request Type</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gdprRequests?.length ? (
                    gdprRequests.map((request) => {
                      const typeInfo = GDPR_REQUEST_TYPES[request.requestType];
                      const TypeIcon = typeInfo?.icon || FileText;
                      const isOverdue = new Date(request.deadline) < new Date() && request.status !== 'completed';
                      return (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded ${typeInfo?.color || 'bg-gray-100'}`}>
                                <TypeIcon className="h-4 w-4" />
                              </div>
                              <span className="font-medium">{typeInfo?.label || request.requestType}</span>
                            </div>
                          </TableCell>
                          <TableCell>{request.userEmail}</TableCell>
                          <TableCell>
                            <Badge variant={request.status === 'completed' ? 'default' : request.status === 'pending' ? 'outline' : 'secondary'}>
                              {request.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600' : ''}`}>
                              <Clock className="h-4 w-4" />
                              {format(new Date(request.deadline), 'PP')}
                              {isOverdue && <AlertTriangle className="h-4 w-4" />}
                            </div>
                          </TableCell>
                          <TableCell>{formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => processGDPRMutation.mutate(request.id)}
                              disabled={request.status === 'completed' || processGDPRMutation.isPending}
                            >
                              Process
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No GDPR requests found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HIPAA Tab */}
        <TabsContent value="hipaa" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                HIPAA Configuration
              </CardTitle>
              <CardDescription>Configure HIPAA compliance settings for your tenant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div>
                  <h3 className="font-medium">HIPAA Mode</h3>
                  <p className="text-sm text-muted-foreground">Enable HIPAA compliance features</p>
                </div>
                <Switch
                  checked={hipaaConfig?.hipaaEnabled || false}
                  onCheckedChange={(checked) => updateHIPAAMutation.mutate({ hipaaEnabled: checked })}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="font-medium">PHI Protection</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>PHI Detection</Label>
                      <Switch
                        checked={hipaaConfig?.phiDetectionEnabled || false}
                        onCheckedChange={(checked) => updateHIPAAMutation.mutate({ phiDetectionEnabled: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>PHI Encryption</Label>
                      <Switch
                        checked={hipaaConfig?.phiEncryptionEnabled || false}
                        onCheckedChange={(checked) => updateHIPAAMutation.mutate({ phiEncryptionEnabled: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Enhanced Logging</Label>
                      <Switch
                        checked={hipaaConfig?.enhancedLoggingEnabled || false}
                        onCheckedChange={(checked) => updateHIPAAMutation.mutate({ enhancedLoggingEnabled: checked })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Access Controls</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>MFA Required</Label>
                      <Switch
                        checked={hipaaConfig?.mfaRequired || false}
                        onCheckedChange={(checked) => updateHIPAAMutation.mutate({ mfaRequired: checked })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Session Timeout (minutes)</Label>
                      <Input
                        type="number"
                        value={hipaaConfig?.sessionTimeoutMinutes || 15}
                        onChange={(e) => updateHIPAAMutation.mutate({ sessionTimeoutMinutes: parseInt(e.target.value) })}
                        className="w-32"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Access Review Period (days)</Label>
                      <Input
                        type="number"
                        value={hipaaConfig?.accessReviewDays || 90}
                        onChange={(e) => updateHIPAAMutation.mutate({ accessReviewDays: parseInt(e.target.value) })}
                        className="w-32"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                <div className="space-y-2">
                  <Label>PHI Retention (days)</Label>
                  <Input
                    type="number"
                    value={hipaaConfig?.phiRetentionDays || 2190}
                    onChange={(e) => updateHIPAAMutation.mutate({ phiRetentionDays: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">HIPAA requires minimum 6 years (2190 days)</p>
                </div>
                <div className="space-y-2">
                  <Label>Audit Log Retention (days)</Label>
                  <Input
                    type="number"
                    value={hipaaConfig?.auditRetentionDays || 2555}
                    onChange={(e) => updateHIPAAMutation.mutate({ auditRetentionDays: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">Recommended 7 years (2555 days)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Breaches Tab */}
        <TabsContent value="breaches" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Open Incidents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{openBreachCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Incidents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dataBreaches?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">PHI Involved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dataBreaches?.filter(b => b.phiInvolved).length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Users Affected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dataBreaches?.reduce((sum, b) => sum + b.usersAffected, 0) || 0}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Data Breach Incidents</CardTitle>
                  <CardDescription>Track and manage security incidents</CardDescription>
                </div>
                <Button>
                  <AlertOctagon className="h-4 w-4 mr-2" />
                  Report Incident
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Discovered</TableHead>
                    <TableHead>Users Affected</TableHead>
                    <TableHead>PHI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataBreaches?.length ? (
                    dataBreaches.map((breach) => (
                      <TableRow key={breach.id}>
                        <TableCell className="font-medium">{breach.incidentType.replace('_', ' ')}</TableCell>
                        <TableCell>
                          <Badge className={getSeverityColor(breach.severity)}>{breach.severity}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={breach.status === 'closed' ? 'default' : 'outline'}>{breach.status}</Badge>
                        </TableCell>
                        <TableCell>{format(new Date(breach.discoveredAt), 'PP')}</TableCell>
                        <TableCell>{breach.usersAffected}</TableCell>
                        <TableCell>{breach.phiInvolved ? <AlertTriangle className="h-4 w-4 text-red-500" /> : '—'}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No breach incidents recorded
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Retention Tab */}
        <TabsContent value="retention" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Data Retention Policies</CardTitle>
              <CardDescription>Configure how long different types of data are retained</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data Type</TableHead>
                    <TableHead>Retention Period</TableHead>
                    <TableHead>Legal Basis</TableHead>
                    <TableHead>Action on Expiry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Session Data</TableCell>
                    <TableCell>90 days</TableCell>
                    <TableCell><Badge variant="outline">Legitimate Interest</Badge></TableCell>
                    <TableCell>Delete</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Usage Analytics</TableCell>
                    <TableCell>2 years</TableCell>
                    <TableCell><Badge variant="outline">Legitimate Interest</Badge></TableCell>
                    <TableCell>Anonymize</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Audit Logs</TableCell>
                    <TableCell>7 years</TableCell>
                    <TableCell><Badge variant="outline">Legal Obligation</Badge></TableCell>
                    <TableCell>Archive</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">PHI Data</TableCell>
                    <TableCell>6 years</TableCell>
                    <TableCell><Badge variant="outline">Legal Obligation</Badge></TableCell>
                    <TableCell>Archive</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Billing Records</TableCell>
                    <TableCell>7 years</TableCell>
                    <TableCell><Badge variant="outline">Legal Obligation</Badge></TableCell>
                    <TableCell>Archive</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">GDPR Requests</TableCell>
                    <TableCell>3 years</TableCell>
                    <TableCell><Badge variant="outline">Legal Obligation</Badge></TableCell>
                    <TableCell>Archive</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Consent Records</TableCell>
                    <TableCell>7 years</TableCell>
                    <TableCell><Badge variant="outline">Legal Obligation</Badge></TableCell>
                    <TableCell>Archive</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
