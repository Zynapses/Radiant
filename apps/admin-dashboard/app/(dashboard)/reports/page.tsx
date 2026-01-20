'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  FileText,
  Plus,
  Download,
  Clock,
  Calendar,
  BarChart3,
  PieChart,
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  Shield,
  Database,
  Zap,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Play,
  Send,
  Search,
  Filter,
  Loader2,
  FileJson,
  FileSpreadsheet,
  File,
  Mail,
  Eye,
  Star,
  StarOff,
  CheckCircle2,
} from 'lucide-react';

interface Report {
  id: string;
  name: string;
  description: string;
  type: 'usage' | 'cost' | 'security' | 'performance' | 'compliance' | 'custom';
  schedule: 'manual' | 'daily' | 'weekly' | 'monthly';
  lastRun: string | null;
  nextRun: string | null;
  format: 'pdf' | 'csv' | 'json' | 'excel';
  recipients: string[];
  isFavorite: boolean;
  createdBy: string;
  createdAt: string;
  status: 'active' | 'paused' | 'draft';
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: Report['type'];
  icon: React.ReactNode;
  metrics: string[];
  preview: string;
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'usage-summary',
    name: 'Usage Summary',
    description: 'API calls, token usage, and active users over time',
    type: 'usage',
    icon: <Activity className="h-5 w-5" />,
    metrics: ['API Calls', 'Tokens Used', 'Active Users', 'Sessions'],
    preview: '/reports/templates/usage-summary.png',
  },
  {
    id: 'cost-breakdown',
    name: 'Cost Breakdown',
    description: 'Detailed cost analysis by model, user, and tenant',
    type: 'cost',
    icon: <DollarSign className="h-5 w-5" />,
    metrics: ['Total Cost', 'Cost by Model', 'Cost by User', 'Trend'],
    preview: '/reports/templates/cost-breakdown.png',
  },
  {
    id: 'security-audit',
    name: 'Security Audit',
    description: 'Login attempts, anomalies, and access patterns',
    type: 'security',
    icon: <Shield className="h-5 w-5" />,
    metrics: ['Failed Logins', 'Anomalies', 'Access Logs', 'Threats'],
    preview: '/reports/templates/security-audit.png',
  },
  {
    id: 'performance-metrics',
    name: 'Performance Metrics',
    description: 'Latency, throughput, and error rates',
    type: 'performance',
    icon: <Zap className="h-5 w-5" />,
    metrics: ['P50/P95/P99 Latency', 'Throughput', 'Error Rate', 'Uptime'],
    preview: '/reports/templates/performance.png',
  },
  {
    id: 'compliance-report',
    name: 'Compliance Report',
    description: 'SOC2, GDPR, and HIPAA compliance status',
    type: 'compliance',
    icon: <CheckCircle2 className="h-5 w-5" />,
    metrics: ['Compliance Score', 'Controls', 'Findings', 'Remediation'],
    preview: '/reports/templates/compliance.png',
  },
  {
    id: 'user-analytics',
    name: 'User Analytics',
    description: 'User engagement, retention, and activity patterns',
    type: 'usage',
    icon: <Users className="h-5 w-5" />,
    metrics: ['Active Users', 'New Users', 'Retention', 'Engagement'],
    preview: '/reports/templates/user-analytics.png',
  },
];

const TYPE_COLORS: Record<Report['type'], string> = {
  usage: 'bg-blue-500',
  cost: 'bg-green-500',
  security: 'bg-red-500',
  performance: 'bg-amber-500',
  compliance: 'bg-purple-500',
  custom: 'bg-slate-500',
};

const TYPE_ICONS: Record<Report['type'], React.ReactNode> = {
  usage: <Activity className="h-4 w-4" />,
  cost: <DollarSign className="h-4 w-4" />,
  security: <Shield className="h-4 w-4" />,
  performance: <Zap className="h-4 w-4" />,
  compliance: <CheckCircle2 className="h-4 w-4" />,
  custom: <FileText className="h-4 w-4" />,
};

function ReportCard({ report, onRun, onEdit, onDelete, onToggleFavorite }: {
  report: Report;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg text-white', TYPE_COLORS[report.type])}>
              {TYPE_ICONS[report.type]}
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {report.name}
                {report.isFavorite && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
              </CardTitle>
              <CardDescription className="text-sm">{report.description}</CardDescription>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onRun}>
                <Play className="h-4 w-4 mr-2" />
                Run Now
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleFavorite}>
                {report.isFavorite ? (
                  <>
                    <StarOff className="h-4 w-4 mr-2" />
                    Remove from Favorites
                  </>
                ) : (
                  <>
                    <Star className="h-4 w-4 mr-2" />
                    Add to Favorites
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Schedule</span>
            <div className="font-medium capitalize flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {report.schedule}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Format</span>
            <div className="font-medium uppercase">{report.format}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Last Run</span>
            <div className="font-medium">{formatDate(report.lastRun)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Next Run</span>
            <div className="font-medium">{formatDate(report.nextRun)}</div>
          </div>
        </div>
        <Separator className="my-4" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={report.status === 'active' ? 'default' : 'secondary'}>
              {report.status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {report.recipients.length} recipient{report.recipients.length !== 1 ? 's' : ''}
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={onRun}>
            <Play className="h-3 w-3 mr-1" />
            Run
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateReportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [reportConfig, setReportConfig] = useState({
    name: '',
    description: '',
    schedule: 'manual',
    format: 'pdf',
    recipients: '',
  });

  const handleCreate = () => {
    // In production, would create the report
    onOpenChange(false);
    setStep(1);
    setSelectedTemplate(null);
    setReportConfig({ name: '', description: '', schedule: 'manual', format: 'pdf', recipients: '' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create New Report</DialogTitle>
          <DialogDescription>
            {step === 1 ? 'Choose a template to get started' : 'Configure your report settings'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="grid grid-cols-2 gap-4 py-4">
            {REPORT_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  setSelectedTemplate(template.id);
                  setReportConfig(prev => ({
                    ...prev,
                    name: template.name,
                    description: template.description,
                  }));
                  setStep(2);
                }}
                className={cn(
                  'flex items-start gap-4 p-4 rounded-lg border text-left transition-colors hover:bg-muted',
                  selectedTemplate === template.id && 'border-primary bg-primary/5'
                )}
              >
                <div className={cn('p-2 rounded-lg text-white', TYPE_COLORS[template.type])}>
                  {template.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">{template.name}</h4>
                  <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {template.metrics.slice(0, 3).map((metric) => (
                      <Badge key={metric} variant="secondary" className="text-xs">
                        {metric}
                      </Badge>
                    ))}
                    {template.metrics.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{template.metrics.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Report Name</Label>
                <Input
                  value={reportConfig.name}
                  onChange={(e) => setReportConfig(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My Custom Report"
                />
              </div>
              <div className="space-y-2">
                <Label>Schedule</Label>
                <Select
                  value={reportConfig.schedule}
                  onValueChange={(v) => setReportConfig(prev => ({ ...prev, schedule: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={reportConfig.description}
                onChange={(e) => setReportConfig(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this report contains..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Output Format</Label>
                <Select
                  value={reportConfig.format}
                  onValueChange={(v) => setReportConfig(prev => ({ ...prev, format: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">
                      <div className="flex items-center gap-2">
                        <File className="h-4 w-4 text-red-500" />
                        PDF
                      </div>
                    </SelectItem>
                    <SelectItem value="excel">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-green-500" />
                        Excel
                      </div>
                    </SelectItem>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        CSV
                      </div>
                    </SelectItem>
                    <SelectItem value="json">
                      <div className="flex items-center gap-2">
                        <FileJson className="h-4 w-4 text-amber-500" />
                        JSON
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Recipients (comma-separated)</Label>
                <Input
                  value={reportConfig.recipients}
                  onChange={(e) => setReportConfig(prev => ({ ...prev, recipients: e.target.value }))}
                  placeholder="email@example.com, team@example.com"
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {step === 2 && (
            <Button onClick={handleCreate}>
              Create Report
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSchedule, setFilterSchedule] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // Fetch reports from API
  const { data: reportsData, isLoading } = useQuery({
    queryKey: ['reports', filterType, filterSchedule, activeTab === 'favorites'],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterType !== 'all') params.append('type', filterType);
      if (filterSchedule !== 'all') params.append('schedule', filterSchedule);
      if (activeTab === 'favorites') params.append('favorite', 'true');
      
      const res = await apiClient.get<{ reports: Report[]; count: number }>(
        `/admin/reports?${params.toString()}`
      );
      return res;
    },
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['reports', 'stats'],
    queryFn: async () => {
      const res = await apiClient.get<{
        total_reports: number;
        scheduled_reports: number;
        favorite_reports: number;
        sent_this_month: number;
      }>('/admin/reports/stats');
      return res;
    },
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      await apiClient.put(`/admin/reports/${id}`, { is_favorite: !isFavorite });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast({ title: 'Report deleted', description: 'The report has been deleted.' });
    },
  });

  // Run report mutation
  const runReportMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<{ success: boolean; download_url?: string; error?: string }>(
        `/admin/reports/${id}/run`, {}
      );
      return res;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      if (data.success && data.download_url) {
        toast({ 
          title: 'Report generated', 
          description: 'Your report is ready for download.',
        });
        // Open download in new tab
        window.open(data.download_url, '_blank');
      } else if (data.error) {
        toast({ title: 'Report failed', description: data.error, variant: 'destructive' });
      }
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to generate report.', variant: 'destructive' });
    },
  });

  const reports = reportsData?.reports || [];

  const filteredReports = reports.filter(report => {
    if (searchQuery && !report.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (activeTab === 'scheduled' && report.schedule === 'manual') {
      return false;
    }
    return true;
  });

  const handleToggleFavorite = (reportId: string) => {
    const report = reports.find(r => r.id === reportId);
    if (report) {
      toggleFavoriteMutation.mutate({ id: reportId, isFavorite: report.isFavorite });
    }
  };

  const handleDelete = (reportId: string) => {
    deleteMutation.mutate(reportId);
  };

  const handleRun = (reportId: string) => {
    runReportMutation.mutate(reportId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Reports
          </h1>
          <p className="text-muted-foreground">
            Create, schedule, and manage custom reports
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Report
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total_reports ?? reports.length}</p>
                <p className="text-sm text-muted-foreground">Total Reports</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats?.scheduled_reports ?? reports.filter(r => r.schedule !== 'manual').length}
                </p>
                <p className="text-sm text-muted-foreground">Scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Star className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats?.favorite_reports ?? reports.filter(r => r.isFavorite).length}
                </p>
                <p className="text-sm text-muted-foreground">Favorites</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Send className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.sent_this_month ?? 0}</p>
                <p className="text-sm text-muted-foreground">Sent This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
              <TabsList>
                <TabsTrigger value="all">All Reports</TabsTrigger>
                <TabsTrigger value="favorites">Favorites</TabsTrigger>
                <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="usage">Usage</SelectItem>
                  <SelectItem value="cost">Cost</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterSchedule} onValueChange={setFilterSchedule}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Schedule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Schedules</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports Grid */}
      {filteredReports.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onRun={() => handleRun(report.id)}
              onEdit={() => console.log('Edit report:', report.id)}
              onDelete={() => handleDelete(report.id)}
              onToggleFavorite={() => handleToggleFavorite(report.id)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No reports found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery || filterType !== 'all' || filterSchedule !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first report to get started'}
            </p>
            {!searchQuery && filterType === 'all' && filterSchedule === 'all' && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Report
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <CreateReportDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </div>
  );
}
