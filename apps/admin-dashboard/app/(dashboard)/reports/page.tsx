'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import {
  BarChart as RechartsBarChart, Bar, LineChart as RechartsLineChart, Line, PieChart as RechartsPieChart, Pie, AreaChart as RechartsAreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import * as aiReportsApi from '@/lib/api/ai-reports';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
  Sparkles,
  Layers,
  Table2,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  GripVertical,
  Code2,
  Save,
  PieChart as PieChartIcon,
  LineChart,
  BarChart2,
  Wand2,
  SlidersHorizontal,
  Mic,
  MicOff,
  MessageSquare,
  Bot,
  Palette,
  Type,
  Layout,
  Columns,
  Image,
  FileType,
  Heading1,
  Heading2,
  ListOrdered,
  Quote,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Printer,
  Share2,
  History,
  Undo2,
  Redo2,
  Maximize2,
  Settings2,
  Braces,
  Hash,
  AtSign,
  Globe,
  Lightbulb,
  TrendingDown,
  AlertTriangle,
  Target,
  Zap as ZapIcon,
  Upload,
  Paintbrush,
  ImageIcon,
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

interface SchemaColumn {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

interface SchemaTable {
  name: string;
  schema: string;
  columns: SchemaColumn[];
  rowCount: number;
  estimatedSize: string;
  hasTimestamps: boolean;
  hasTenantId: boolean;
}

interface SchemaCategory {
  name: string;
  tables: SchemaTable[];
  description: string;
}

interface ReportField {
  column: string;
  table: string;
  alias: string;
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct' | 'none';
  format?: 'number' | 'currency' | 'percentage' | 'date' | 'datetime' | 'text';
}

interface ReportFilter {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'between' | 'is_null' | 'is_not_null';
  value: string;
  value2?: string; // For 'between' operator
}

interface ReportSort {
  column: string;
  direction: 'asc' | 'desc';
}

const FILTER_OPERATORS = [
  { value: 'eq', label: '= (equals)' },
  { value: 'neq', label: '≠ (not equals)' },
  { value: 'gt', label: '> (greater than)' },
  { value: 'gte', label: '≥ (greater or equal)' },
  { value: 'lt', label: '< (less than)' },
  { value: 'lte', label: '≤ (less or equal)' },
  { value: 'like', label: 'LIKE (contains)' },
  { value: 'in', label: 'IN (list)' },
  { value: 'between', label: 'BETWEEN' },
  { value: 'is_null', label: 'IS NULL' },
  { value: 'is_not_null', label: 'IS NOT NULL' },
];

const AGGREGATION_OPTIONS = [
  { value: 'none', label: 'None (raw value)' },
  { value: 'count', label: 'COUNT' },
  { value: 'sum', label: 'SUM' },
  { value: 'avg', label: 'AVG' },
  { value: 'min', label: 'MIN' },
  { value: 'max', label: 'MAX' },
  { value: 'distinct', label: 'COUNT DISTINCT' },
];

const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
];

interface DynamicReportDefinition {
  id?: string;
  name: string;
  description: string;
  baseTable: string;
  fields: ReportField[];
  filters: { column: string; table: string; operator: string; value?: unknown }[];
  joins: { fromTable: string; fromColumn: string; toTable: string; toColumn: string; type: string }[];
  groupBy: string[];
  orderBy: { column: string; direction: 'asc' | 'desc' }[];
  limit?: number;
  schedule?: string;
  format: string;
}

interface ReportExecutionResult {
  columns: { name: string; type: string; format?: string }[];
  rows: Record<string, unknown>[];
  totalRows: number;
  executionTimeMs: number;
  generatedAt: string;
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
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  const handleEditReport = useCallback((reportId: string) => {
    setEditingReportId(reportId);
    setShowCreateDialog(true);
    toast({
      title: 'Edit Report',
      description: 'Loading report configuration...',
    });
  }, [toast]);

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
                <TabsTrigger value="ai-writer" className="gap-2">
                  <Bot className="h-4 w-4" />
                  AI Writer
                </TabsTrigger>
                <TabsTrigger value="builder" className="gap-2">
                  <Database className="h-4 w-4" />
                  Schema Builder
                </TabsTrigger>
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

      {/* AI Writer Tab */}
      {activeTab === 'ai-writer' && <AIReportWriter />}

      {/* Schema Builder Tab */}
      {activeTab === 'builder' && <SchemaAdaptiveBuilder />}

      {/* Reports Grid */}
      {activeTab !== 'builder' && activeTab !== 'ai-writer' && filteredReports.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onRun={() => handleRun(report.id)}
              onEdit={() => handleEditReport(report.id)}
              onDelete={() => handleDelete(report.id)}
              onToggleFavorite={() => handleToggleFavorite(report.id)}
            />
          ))}
        </div>
      ) : activeTab !== 'builder' ? (
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
      ) : null}

      <CreateReportDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </div>
  );
}

// AI Report Writer Component - Enterprise-grade AI-powered report generation
interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  reportData?: GeneratedReport;
}

interface GeneratedReport {
  title: string;
  subtitle?: string;
  executiveSummary?: string;
  sections: ReportSection[];
  charts?: ChartConfig[];
  tables?: TableConfig[];
  smartInsights?: SmartInsight[];
  metadata: {
    generatedAt: string;
    dataRange?: string;
    confidence: number;
  };
}

interface ReportSection {
  id: string;
  type: 'heading' | 'paragraph' | 'metrics' | 'chart' | 'table' | 'quote' | 'list';
  content: string;
  level?: 1 | 2 | 3;
  items?: string[];
  metrics?: { label: string; value: string; change?: string; trend?: 'up' | 'down' | 'neutral' }[];
}

interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area';
  title: string;
  data: { label: string; value: number }[];
}

interface TableConfig {
  title: string;
  headers: string[];
  rows: string[][];
}

// Smart Insights - AI-powered anomaly detection and trend analysis
interface SmartInsight {
  id: string;
  type: 'anomaly' | 'trend' | 'recommendation' | 'warning' | 'achievement';
  title: string;
  description: string;
  metric?: string;
  value?: string;
  change?: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
}

// Brand Kit - Custom branding for reports
interface BrandKit {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  headerFont: string;
  companyName: string;
  tagline: string;
}

const DEFAULT_BRAND_KIT: BrandKit = {
  logoUrl: null,
  primaryColor: '#3b82f6',
  secondaryColor: '#64748b',
  accentColor: '#10b981',
  fontFamily: 'Inter, system-ui, sans-serif',
  headerFont: 'Inter, system-ui, sans-serif',
  companyName: 'RADIANT',
  tagline: 'AI-Powered Analytics',
};

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const REPORT_STYLES = [
  { id: 'executive', name: 'Executive Summary', icon: <FileText className="h-4 w-4" />, description: 'High-level overview for leadership' },
  { id: 'detailed', name: 'Detailed Analysis', icon: <BarChart3 className="h-4 w-4" />, description: 'In-depth data with visualizations' },
  { id: 'dashboard', name: 'Dashboard View', icon: <Layout className="h-4 w-4" />, description: 'Metrics-focused layout with KPIs' },
  { id: 'narrative', name: 'Narrative Report', icon: <MessageSquare className="h-4 w-4" />, description: 'Story-driven insights and analysis' },
];

const EXAMPLE_PROMPTS = [
  "Generate a monthly usage report showing API calls, active users, and cost trends",
  "Create an executive summary of our AI model performance for Q4",
  "Build a security audit report with login attempts and anomaly detection",
  "Show me a cost breakdown by department with budget variance analysis",
  "Create a compliance status report for SOC2 and HIPAA requirements",
];

function AIReportWriter() {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [reportStyle, setReportStyle] = useState('executive');
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [modificationPrompt, setModificationPrompt] = useState('');
  const [showFormatPanel, setShowFormatPanel] = useState(true);
  const [reportHistory, setReportHistory] = useState<GeneratedReport[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [brandKit, setBrandKit] = useState<BrandKit>(DEFAULT_BRAND_KIT);
  const [showInsights, setShowInsights] = useState(true);
  const [showBrandKit, setShowBrandKit] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const recognitionRef = React.useRef<unknown>(null);

  // Logo upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setBrandKit(prev => ({ ...prev, logoUrl: event.target?.result as string }));
        toast({ title: 'Logo Uploaded', description: 'Your brand logo has been added to reports.' });
      };
      reader.readAsDataURL(file);
    }
  };

  // Initialize speech recognition
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
      if ('SpeechRecognition' in win || 'webkitSpeechRecognition' in win) {
        const SpeechRecognitionConstructor = (win.SpeechRecognition || win.webkitSpeechRecognition) as new () => {
          continuous: boolean;
          interimResults: boolean;
          lang: string;
          onresult: ((event: { results: { [index: number]: { transcript: string }[] } }) => void) | null;
          onerror: (() => void) | null;
          onend: (() => void) | null;
          start: () => void;
          stop: () => void;
        };
        const recognition = new SpeechRecognitionConstructor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
          const results = event.results;
          let transcript = '';
          for (let i = 0; i < Object.keys(results).length; i++) {
            if (results[i] && results[i][0]) {
              transcript += results[i][0].transcript;
            }
          }
          setPrompt(transcript);
        };

        recognition.onerror = () => {
          setIsListening(false);
          toast({ title: 'Voice Error', description: 'Speech recognition failed. Please try again.', variant: 'destructive' });
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
    return () => {
      const recognition = recognitionRef.current as { stop?: () => void } | null;
      if (recognition?.stop) recognition.stop();
    };
  }, [toast]);

  const toggleVoiceInput = () => {
    const recognition = recognitionRef.current as { start?: () => void; stop?: () => void } | null;
    if (!recognition) {
      toast({ title: 'Not Supported', description: 'Voice input is not supported in this browser.', variant: 'destructive' });
      return;
    }
    if (isListening) {
      recognition.stop?.();
      setIsListening(false);
    } else {
      recognition.start?.();
      setIsListening(true);
      toast({ title: 'Listening...', description: 'Speak your report request now.' });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateReport = async (userPrompt: string) => {
    if (!userPrompt.trim()) return;

    const userMessage: AIMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userPrompt,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setPrompt('');
    setIsGenerating(true);

    try {
      // Call the real API to generate report
      const report = await aiReportsApi.generateReport({
        prompt: userPrompt,
        style: reportStyle as 'executive' | 'detailed' | 'dashboard' | 'narrative',
      });

      setGeneratedReport(report as unknown as GeneratedReport);
      setReportHistory(prev => [...prev, report]);
      setHistoryIndex(reportHistory.length);

      const assistantMessage: AIMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `I've generated your "${report.title}" based on your request. The report includes an executive summary, key metrics, detailed analysis with visualizations, and actionable recommendations.\n\nYou can:\n• **Edit any section** by clicking on it\n• **Ask me to modify** specific parts using the chat\n• **Change the style** using the format panel\n• **Export** to PDF, Excel, or HTML`,
        timestamp: new Date(),
        reportData: report,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Report generation error:', error);
      toast({ title: 'Generation Failed', description: 'Failed to generate report. Please try again.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const modifyReport = async () => {
    if (!modificationPrompt.trim() || !generatedReport) return;
    
    const userMessage: AIMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: `Modify: ${modificationPrompt}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setModificationPrompt('');
    setIsGenerating(true);

    try {
      // Call the real API to modify report via chat
      const modifiedReport = await aiReportsApi.sendChatMessage({
        reportId: (generatedReport as { id?: string }).id || 'temp',
        sessionId: `session-${Date.now()}`,
        message: modificationPrompt,
      });

      setGeneratedReport(modifiedReport as unknown as GeneratedReport);
      setReportHistory(prev => [...prev, modifiedReport as unknown as GeneratedReport]);
      setHistoryIndex(reportHistory.length);

      const assistantMessage: AIMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `Done! I've updated the report based on your request: "${modificationPrompt}". The changes have been applied and you can see them in the preview.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Report modification error:', error);
      toast({ title: 'Modification Failed', description: 'Failed to modify report. Please try again.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setGeneratedReport(reportHistory[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < reportHistory.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setGeneratedReport(reportHistory[historyIndex + 1]);
    }
  };

  const exportReport = async (format: 'pdf' | 'excel' | 'html') => {
    if (!generatedReport) return;
    
    toast({ title: 'Exporting...', description: `Generating ${format.toUpperCase()} file...` });
    
    try {
      const reportId = (generatedReport as { id?: string }).id;
      if (!reportId) {
        toast({ title: 'Export Failed', description: 'Report must be saved before exporting.', variant: 'destructive' });
        return;
      }
      
      const response = await aiReportsApi.exportReport(reportId, { format });
      aiReportsApi.downloadExport(response.downloadUrl, response.fileName);
      toast({ title: 'Export Complete', description: `Your ${format.toUpperCase()} report is ready for download.` });
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: 'Export Failed', description: 'Failed to export report. Please try again.', variant: 'destructive' });
    }
  };

  const renderSection = (section: ReportSection) => {
    const isSelected = selectedSection === section.id;
    const baseClass = cn(
      'relative group rounded-lg transition-all cursor-pointer',
      isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50',
      editMode && 'cursor-text'
    );

    switch (section.type) {
      case 'heading':
        const HeadingTag = section.level === 1 ? 'h1' : section.level === 2 ? 'h2' : 'h3';
        const headingClass = section.level === 1 ? 'text-2xl font-bold' : section.level === 2 ? 'text-xl font-semibold' : 'text-lg font-medium';
        return (
          <div key={section.id} className={cn(baseClass, 'py-2')} onClick={() => setSelectedSection(section.id)}>
            <HeadingTag className={headingClass}>{section.content}</HeadingTag>
          </div>
        );
      case 'paragraph':
        return (
          <div key={section.id} className={cn(baseClass, 'py-2')} onClick={() => setSelectedSection(section.id)}>
            <p className="text-muted-foreground leading-relaxed">{section.content}</p>
          </div>
        );
      case 'metrics':
        return (
          <div key={section.id} className={cn(baseClass, 'py-4')} onClick={() => setSelectedSection(section.id)}>
            <div className="grid grid-cols-4 gap-4">
              {section.metrics?.map((metric, i) => (
                <Card key={i} className="bg-gradient-to-br from-background to-muted/30">
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">{metric.label}</p>
                    <p className="text-2xl font-bold">{metric.value}</p>
                    {metric.change && (
                      <p className={cn('text-sm font-medium', metric.trend === 'up' ? 'text-green-600' : metric.trend === 'down' ? 'text-red-600' : 'text-muted-foreground')}>
                        {metric.change} {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : ''}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      case 'list':
        return (
          <div key={section.id} className={cn(baseClass, 'py-2')} onClick={() => setSelectedSection(section.id)}>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              {section.items?.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        );
      case 'quote':
        return (
          <div key={section.id} className={cn(baseClass, 'py-2')} onClick={() => setSelectedSection(section.id)}>
            <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground">{section.content}</blockquote>
          </div>
        );
      case 'chart':
        // Find matching chart config from generatedReport
        const chartConfig = generatedReport?.charts?.find(c => 
          c.title.toLowerCase().includes(section.content.split('_')[0]) ||
          section.content.includes(c.title.toLowerCase().replace(/\s+/g, '_'))
        ) || generatedReport?.charts?.[0];
        
        return (
          <div key={section.id} className={cn(baseClass, 'py-4')} onClick={() => setSelectedSection(section.id)}>
            {chartConfig ? (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">{chartConfig.title}</h4>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartConfig.type === 'bar' ? (
                      <RechartsBarChart data={chartConfig.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="label" className="text-xs" tick={{ fill: 'currentColor' }} />
                        <YAxis className="text-xs" tick={{ fill: 'currentColor' }} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                        <Tooltip formatter={(value: number) => value >= 1000000 ? `${(value/1000000).toFixed(2)}M` : value >= 1000 ? `${(value/1000).toFixed(1)}K` : value} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {chartConfig.data.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </RechartsBarChart>
                    ) : chartConfig.type === 'line' ? (
                      <RechartsLineChart data={chartConfig.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="label" className="text-xs" tick={{ fill: 'currentColor' }} />
                        <YAxis className="text-xs" tick={{ fill: 'currentColor' }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}K` : v} />
                        <Tooltip formatter={(value: number) => value >= 1000 ? `${(value/1000).toFixed(1)}K` : value} />
                        <Line type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ fill: CHART_COLORS[0], r: 4 }} />
                      </RechartsLineChart>
                    ) : chartConfig.type === 'pie' ? (
                      <RechartsPieChart>
                        <Pie data={chartConfig.data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" nameKey="label" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {chartConfig.data.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </RechartsPieChart>
                    ) : (
                      <RechartsAreaChart data={chartConfig.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="label" className="text-xs" tick={{ fill: 'currentColor' }} />
                        <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.3} />
                      </RechartsAreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="h-64 bg-gradient-to-br from-muted/50 to-muted rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Chart: {section.content}</p>
                </div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Report Writer
          </h2>
          <p className="text-sm text-muted-foreground">
            Generate professional reports using natural language or voice commands
          </p>
        </div>
        <div className="flex items-center gap-2">
          {generatedReport && (
            <>
              <Button variant="outline" size="sm" onClick={handleUndo} disabled={historyIndex <= 0}>
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleRedo} disabled={historyIndex >= reportHistory.length - 1}>
                <Redo2 className="h-4 w-4" />
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => exportReport('pdf')}>
                    <File className="h-4 w-4 mr-2 text-red-500" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportReport('excel')}>
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-green-500" />
                    Export as Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportReport('html')}>
                    <Globe className="h-4 w-4 mr-2 text-blue-500" />
                    Export as HTML
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* AI Chat Panel */}
        <Card className="col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              AI Assistant
            </CardTitle>
            <CardDescription>Describe your report or ask for modifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Style Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Report Style</Label>
              <div className="grid grid-cols-2 gap-2">
                {REPORT_STYLES.map(style => (
                  <button
                    key={style.id}
                    onClick={() => setReportStyle(style.id)}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-lg border text-left text-sm transition-all',
                      reportStyle === style.id ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                    )}
                  >
                    {style.icon}
                    <span className="font-medium">{style.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Chat Messages */}
            <ScrollArea className="h-[280px]">
              <div className="space-y-4 pr-2">
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="font-medium mb-2">Start with a prompt</p>
                    <p className="text-sm text-muted-foreground mb-4">Describe what you want in your report</p>
                    <div className="space-y-2">
                      {EXAMPLE_PROMPTS.slice(0, 3).map((example, i) => (
                        <button
                          key={i}
                          onClick={() => setPrompt(example)}
                          className="w-full text-left text-xs p-2 rounded border hover:bg-muted transition-colors"
                        >
                          &ldquo;{example}&rdquo;
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : '')}>
                      {msg.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div className={cn(
                        'rounded-lg px-3 py-2 max-w-[85%]',
                        msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      )}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-xs opacity-60 mt-1">{msg.timestamp.toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))
                )}
                {isGenerating && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    </div>
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <p className="text-sm">Generating your report...</p>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <Separator />

            {/* Input Area */}
            <div className="space-y-2">
              {generatedReport && (
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    value={modificationPrompt}
                    onChange={(e) => setModificationPrompt(e.target.value)}
                    placeholder="Ask AI to modify the report..."
                    className="flex-1 h-9 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && modifyReport()}
                  />
                  <Button size="sm" onClick={modifyReport} disabled={isGenerating || !modificationPrompt.trim()}>
                    <Wand2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={generatedReport ? "Describe a new report..." : "Describe your report (e.g., 'Create a monthly usage summary with cost trends')"}
                    className="min-h-[80px] pr-12 resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        generateReport(prompt);
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    variant={isListening ? 'default' : 'ghost'}
                    className={cn('absolute right-2 bottom-2 h-8 w-8', isListening && 'bg-red-500 hover:bg-red-600')}
                    onClick={toggleVoiceInput}
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button className="w-full" onClick={() => generateReport(prompt)} disabled={isGenerating || !prompt.trim()}>
                {isGenerating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" /> Generate Report</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Report Preview */}
        <Card className="col-span-8">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Report Preview</CardTitle>
              {generatedReport && (
                <div className="flex items-center gap-2">
                  <Button variant={editMode ? 'default' : 'outline'} size="sm" onClick={() => setEditMode(!editMode)}>
                    <Edit className="h-4 w-4 mr-2" />
                    {editMode ? 'Done Editing' : 'Edit Mode'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowFormatPanel(!showFormatPanel)}>
                    <Palette className="h-4 w-4 mr-2" />
                    Format
                  </Button>
                  <Button variant={showInsights ? 'default' : 'outline'} size="sm" onClick={() => setShowInsights(!showInsights)}>
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Insights
                  </Button>
                  <Button variant={showBrandKit ? 'default' : 'outline'} size="sm" onClick={() => setShowBrandKit(!showBrandKit)}>
                    <Paintbrush className="h-4 w-4 mr-2" />
                    Brand
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {generatedReport ? (
              <div className="flex">
                <ScrollArea className={cn('p-6', showFormatPanel ? 'flex-1' : 'w-full')} style={{ height: '600px' }}>
                  <div className="max-w-3xl mx-auto space-y-4">
                    {/* Report Header */}
                    <div className="text-center pb-6 border-b">
                      <h1 className="text-3xl font-bold mb-2">{generatedReport.title}</h1>
                      {generatedReport.subtitle && <p className="text-muted-foreground">{generatedReport.subtitle}</p>}
                      <div className="flex items-center justify-center gap-4 mt-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {generatedReport.metadata.dataRange}</span>
                        <span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-green-500" /> {(generatedReport.metadata.confidence * 100).toFixed(0)}% confidence</span>
                      </div>
                    </div>

                    {/* Executive Summary */}
                    {generatedReport.executiveSummary && (
                      <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="pt-4">
                          <h3 className="font-semibold mb-2 flex items-center gap-2">
                            <Quote className="h-4 w-4" /> Executive Summary
                          </h3>
                          <p className="text-muted-foreground">{generatedReport.executiveSummary}</p>
                        </CardContent>
                      </Card>
                    )}

                    {/* Report Sections */}
                    {generatedReport.sections.map(renderSection)}

                    {/* Tables */}
                    {generatedReport.tables?.map((table, i) => (
                      <div key={i} className="py-4">
                        <h3 className="font-semibold mb-3">{table.title}</h3>
                        <div className="rounded-lg border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>{table.headers.map((h, j) => <TableHead key={j}>{h}</TableHead>)}</TableRow>
                            </TableHeader>
                            <TableBody>
                              {table.rows.map((row, j) => (
                                <TableRow key={j}>{row.map((cell, k) => <TableCell key={k}>{cell}</TableCell>)}</TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ))}

                    {/* Smart Insights Panel */}
                    {showInsights && generatedReport.smartInsights && generatedReport.smartInsights.length > 0 && (
                      <div className="py-4">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <Lightbulb className="h-4 w-4 text-amber-500" />
                          AI-Powered Insights
                        </h3>
                        <div className="space-y-3">
                          {generatedReport.smartInsights.map((insight) => (
                            <Card key={insight.id} className={cn(
                              'border-l-4',
                              insight.type === 'trend' && 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20',
                              insight.type === 'anomaly' && 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20',
                              insight.type === 'achievement' && 'border-l-green-500 bg-green-50/50 dark:bg-green-950/20',
                              insight.type === 'recommendation' && 'border-l-purple-500 bg-purple-50/50 dark:bg-purple-950/20',
                              insight.type === 'warning' && 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20',
                            )}>
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      {insight.type === 'trend' && <TrendingUp className="h-4 w-4 text-blue-500" />}
                                      {insight.type === 'anomaly' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                                      {insight.type === 'achievement' && <Target className="h-4 w-4 text-green-500" />}
                                      {insight.type === 'recommendation' && <ZapIcon className="h-4 w-4 text-purple-500" />}
                                      {insight.type === 'warning' && <AlertCircle className="h-4 w-4 text-red-500" />}
                                      <span className="font-medium text-sm">{insight.title}</span>
                                      <Badge variant="outline" className={cn(
                                        'text-xs',
                                        insight.severity === 'low' && 'border-green-500 text-green-600',
                                        insight.severity === 'medium' && 'border-amber-500 text-amber-600',
                                        insight.severity === 'high' && 'border-red-500 text-red-600',
                                      )}>
                                        {insight.severity}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                                    {(insight.metric || insight.value) && (
                                      <div className="flex items-center gap-4 mt-2 text-sm">
                                        {insight.metric && <span className="text-muted-foreground">{insight.metric}:</span>}
                                        {insight.value && <span className="font-semibold">{insight.value}</span>}
                                        {insight.change && (
                                          <span className={cn(
                                            'font-medium',
                                            insight.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
                                          )}>
                                            {insight.change}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <span className="text-xs text-muted-foreground">{(insight.confidence * 100).toFixed(0)}% confidence</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Format Panel */}
                {showFormatPanel && (
                  <div className="w-64 border-l p-4 space-y-4">
                    <h3 className="font-medium text-sm">Formatting</h3>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Text Style</Label>
                        <div className="flex gap-1 mt-1">
                          <Button variant="outline" size="icon" className="h-8 w-8"><Bold className="h-3 w-3" /></Button>
                          <Button variant="outline" size="icon" className="h-8 w-8"><Italic className="h-3 w-3" /></Button>
                          <Button variant="outline" size="icon" className="h-8 w-8"><Underline className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Alignment</Label>
                        <div className="flex gap-1 mt-1">
                          <Button variant="outline" size="icon" className="h-8 w-8"><AlignLeft className="h-3 w-3" /></Button>
                          <Button variant="outline" size="icon" className="h-8 w-8"><AlignCenter className="h-3 w-3" /></Button>
                          <Button variant="outline" size="icon" className="h-8 w-8"><AlignRight className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <Label className="text-xs">Insert Element</Label>
                        <div className="grid grid-cols-2 gap-1 mt-1">
                          <Button variant="outline" size="sm" className="h-8 text-xs"><Heading1 className="h-3 w-3 mr-1" /> Heading</Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs"><Type className="h-3 w-3 mr-1" /> Text</Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs"><BarChart2 className="h-3 w-3 mr-1" /> Chart</Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs"><Table2 className="h-3 w-3 mr-1" /> Table</Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs"><ListOrdered className="h-3 w-3 mr-1" /> List</Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs"><FileType className="h-3 w-3 mr-1" /> Media</Button>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <Label className="text-xs">Color Scheme</Label>
                        <div className="flex gap-2 mt-1">
                          <button className="w-6 h-6 rounded-full bg-blue-500 ring-2 ring-offset-2 ring-blue-500" onClick={() => setBrandKit(p => ({ ...p, primaryColor: '#3b82f6' }))} />
                          <button className="w-6 h-6 rounded-full bg-green-500" onClick={() => setBrandKit(p => ({ ...p, primaryColor: '#10b981' }))} />
                          <button className="w-6 h-6 rounded-full bg-purple-500" onClick={() => setBrandKit(p => ({ ...p, primaryColor: '#8b5cf6' }))} />
                          <button className="w-6 h-6 rounded-full bg-amber-500" onClick={() => setBrandKit(p => ({ ...p, primaryColor: '#f59e0b' }))} />
                          <button className="w-6 h-6 rounded-full bg-slate-500" onClick={() => setBrandKit(p => ({ ...p, primaryColor: '#64748b' }))} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Brand Kit Panel */}
                {showBrandKit && (
                  <div className="w-72 border-l p-4 space-y-4 overflow-y-auto" style={{ maxHeight: '600px' }}>
                    <h3 className="font-medium text-sm flex items-center gap-2">
                      <Paintbrush className="h-4 w-4" />
                      Brand Kit
                    </h3>
                    <div className="space-y-4">
                      {/* Logo Upload */}
                      <div className="space-y-2">
                        <Label className="text-xs">Company Logo</Label>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoUpload}
                        />
                        <div
                          className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {brandKit.logoUrl ? (
                            <div className="space-y-2">
                              <Image src={brandKit.logoUrl} alt="Logo" width={120} height={64} className="max-h-16 mx-auto object-contain" />
                              <p className="text-xs text-muted-foreground">Click to change</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">Upload logo (PNG, JPG)</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Company Name */}
                      <div className="space-y-2">
                        <Label className="text-xs">Company Name</Label>
                        <Input
                          value={brandKit.companyName}
                          onChange={(e) => setBrandKit(p => ({ ...p, companyName: e.target.value }))}
                          placeholder="Your Company"
                          className="h-8 text-sm"
                        />
                      </div>

                      {/* Tagline */}
                      <div className="space-y-2">
                        <Label className="text-xs">Tagline</Label>
                        <Input
                          value={brandKit.tagline}
                          onChange={(e) => setBrandKit(p => ({ ...p, tagline: e.target.value }))}
                          placeholder="Your tagline here"
                          className="h-8 text-sm"
                        />
                      </div>

                      <Separator />

                      {/* Brand Colors */}
                      <div className="space-y-2">
                        <Label className="text-xs">Brand Colors</Label>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Primary</p>
                            <div className="flex items-center gap-1">
                              <input
                                type="color"
                                value={brandKit.primaryColor}
                                onChange={(e) => setBrandKit(p => ({ ...p, primaryColor: e.target.value }))}
                                className="w-8 h-8 rounded cursor-pointer border-0"
                              />
                              <span className="text-xs font-mono">{brandKit.primaryColor}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Secondary</p>
                            <div className="flex items-center gap-1">
                              <input
                                type="color"
                                value={brandKit.secondaryColor}
                                onChange={(e) => setBrandKit(p => ({ ...p, secondaryColor: e.target.value }))}
                                className="w-8 h-8 rounded cursor-pointer border-0"
                              />
                              <span className="text-xs font-mono">{brandKit.secondaryColor}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Accent</p>
                            <div className="flex items-center gap-1">
                              <input
                                type="color"
                                value={brandKit.accentColor}
                                onChange={(e) => setBrandKit(p => ({ ...p, accentColor: e.target.value }))}
                                className="w-8 h-8 rounded cursor-pointer border-0"
                              />
                              <span className="text-xs font-mono">{brandKit.accentColor}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Font Settings */}
                      <div className="space-y-2">
                        <Label className="text-xs">Fonts</Label>
                        <div className="space-y-2">
                          <Select value={brandKit.headerFont} onValueChange={(v) => setBrandKit(p => ({ ...p, headerFont: v }))}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Header font" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Inter, system-ui, sans-serif">Inter (Modern)</SelectItem>
                              <SelectItem value="Georgia, serif">Georgia (Classic)</SelectItem>
                              <SelectItem value="Playfair Display, serif">Playfair (Elegant)</SelectItem>
                              <SelectItem value="Roboto, sans-serif">Roboto (Clean)</SelectItem>
                              <SelectItem value="Montserrat, sans-serif">Montserrat (Bold)</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={brandKit.fontFamily} onValueChange={(v) => setBrandKit(p => ({ ...p, fontFamily: v }))}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Body font" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Inter, system-ui, sans-serif">Inter</SelectItem>
                              <SelectItem value="Georgia, serif">Georgia</SelectItem>
                              <SelectItem value="Roboto, sans-serif">Roboto</SelectItem>
                              <SelectItem value="Open Sans, sans-serif">Open Sans</SelectItem>
                              <SelectItem value="Lato, sans-serif">Lato</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Separator />

                      {/* Preview */}
                      <div className="space-y-2">
                        <Label className="text-xs">Preview</Label>
                        <Card className="p-3" style={{ borderColor: brandKit.primaryColor }}>
                          <div className="flex items-center gap-2 mb-2">
                            {brandKit.logoUrl && <Image src={brandKit.logoUrl} alt="" width={48} height={24} className="h-6 object-contain" />}
                            <span className="font-semibold text-sm" style={{ color: brandKit.primaryColor, fontFamily: brandKit.headerFont }}>
                              {brandKit.companyName}
                            </span>
                          </div>
                          <p className="text-xs" style={{ color: brandKit.secondaryColor, fontFamily: brandKit.fontFamily }}>
                            {brandKit.tagline}
                          </p>
                        </Card>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setBrandKit(DEFAULT_BRAND_KIT)}
                      >
                        Reset to Defaults
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[600px] text-muted-foreground">
                <FileText className="h-16 w-16 mb-4 opacity-30" />
                <h3 className="text-lg font-medium mb-2">No Report Generated</h3>
                <p className="text-sm text-center max-w-md">
                  Use the AI assistant to describe your report requirements. You can type or use voice input to get started.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Schema-Adaptive Report Builder Component
function SchemaAdaptiveBuilder() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedFields, setSelectedFields] = useState<ReportField[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [sortBy, setSortBy] = useState<ReportSort[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [limit, setLimit] = useState(100);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [executionResult, setExecutionResult] = useState<ReportExecutionResult | null>(null);
  const [showSqlPreview, setShowSqlPreview] = useState(false);
  const [activeConfigTab, setActiveConfigTab] = useState('fields');
  const [visualizationType, setVisualizationType] = useState<'table' | 'bar' | 'line' | 'pie'>('table');

  // Fetch schema from API
  const { data: schemaData, isLoading: schemaLoading, refetch: refetchSchema } = useQuery({
    queryKey: ['dynamic-reports', 'schema'],
    queryFn: async () => {
      const res = await apiClient.get<{ schema: SchemaCategory[] }>('/admin/dynamic-reports/schema');
      return res.schema;
    },
  });

  // Fetch suggestions
  const { data: suggestionsData } = useQuery({
    queryKey: ['dynamic-reports', 'suggestions'],
    queryFn: async () => {
      const res = await apiClient.get<{ suggestions: DynamicReportDefinition[] }>('/admin/dynamic-reports/suggestions');
      return res.suggestions;
    },
  });

  const schema = useMemo(() => schemaData || [], [schemaData]);
  const suggestions = useMemo(() => suggestionsData || [], [suggestionsData]);

  const selectedTableSchema = useMemo(() => {
    for (const category of schema) {
      const table = category.tables.find(t => t.name === selectedTable);
      if (table) return table;
    }
    return null;
  }, [schema, selectedTable]);

  const allColumns = useMemo(() => {
    return selectedTableSchema?.columns || [];
  }, [selectedTableSchema]);

  // Generate SQL preview
  const sqlPreview = useMemo(() => {
    if (!selectedTable || selectedFields.length === 0) return '';
    
    const selectClauses = selectedFields.map(f => {
      const agg = f.aggregation && f.aggregation !== 'none' ? f.aggregation.toUpperCase() : null;
      const col = `"${f.table}"."${f.column}"`;
      if (agg === 'DISTINCT') return `COUNT(DISTINCT ${col}) AS "${f.alias}"`;
      if (agg) return `${agg}(${col}) AS "${f.alias}"`;
      return `${col} AS "${f.alias}"`;
    });

    let sql = `SELECT\n  ${selectClauses.join(',\n  ')}\nFROM "${selectedTable}"`;

    if (filters.length > 0) {
      const whereClauses = filters.map(f => {
        const col = `"${f.column}"`;
        switch (f.operator) {
          case 'eq': return `${col} = '${f.value}'`;
          case 'neq': return `${col} != '${f.value}'`;
          case 'gt': return `${col} > '${f.value}'`;
          case 'gte': return `${col} >= '${f.value}'`;
          case 'lt': return `${col} < '${f.value}'`;
          case 'lte': return `${col} <= '${f.value}'`;
          case 'like': return `${col} LIKE '%${f.value}%'`;
          case 'in': return `${col} IN (${f.value})`;
          case 'between': return `${col} BETWEEN '${f.value}' AND '${f.value2}'`;
          case 'is_null': return `${col} IS NULL`;
          case 'is_not_null': return `${col} IS NOT NULL`;
          default: return '';
        }
      }).filter(Boolean);
      if (whereClauses.length > 0) {
        sql += `\nWHERE ${whereClauses.join('\n  AND ')}`;
      }
    }

    if (groupBy.length > 0) {
      sql += `\nGROUP BY ${groupBy.map(g => `"${g}"`).join(', ')}`;
    }

    if (sortBy.length > 0) {
      sql += `\nORDER BY ${sortBy.map(s => `"${s.column}" ${s.direction.toUpperCase()}`).join(', ')}`;
    }

    sql += `\nLIMIT ${limit}`;
    return sql;
  }, [selectedTable, selectedFields, filters, groupBy, sortBy, limit]);

  const handleFieldToggle = (column: SchemaColumn) => {
    const existing = selectedFields.find(f => f.column === column.name && f.table === selectedTable);
    if (existing) {
      setSelectedFields(selectedFields.filter(f => !(f.column === column.name && f.table === selectedTable)));
    } else {
      setSelectedFields([...selectedFields, {
        column: column.name,
        table: selectedTable,
        alias: column.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        aggregation: 'none',
        format: inferFormat(column.dataType),
      }]);
    }
  };

  const updateFieldAggregation = (index: number, aggregation: ReportField['aggregation']) => {
    const updated = [...selectedFields];
    updated[index] = { ...updated[index], aggregation };
    setSelectedFields(updated);
  };

  const updateFieldAlias = (index: number, alias: string) => {
    const updated = [...selectedFields];
    updated[index] = { ...updated[index], alias };
    setSelectedFields(updated);
  };

  const removeField = (index: number) => {
    setSelectedFields(selectedFields.filter((_, i) => i !== index));
  };

  const addFilter = () => {
    if (allColumns.length > 0) {
      setFilters([...filters, { column: allColumns[0].name, operator: 'eq', value: '' }]);
    }
  };

  const updateFilter = (index: number, updates: Partial<ReportFilter>) => {
    const updated = [...filters];
    updated[index] = { ...updated[index], ...updates };
    setFilters(updated);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const addSort = () => {
    if (selectedFields.length > 0) {
      setSortBy([...sortBy, { column: selectedFields[0].column, direction: 'asc' }]);
    }
  };

  const updateSort = (index: number, updates: Partial<ReportSort>) => {
    const updated = [...sortBy];
    updated[index] = { ...updated[index], ...updates };
    setSortBy(updated);
  };

  const removeSort = (index: number) => {
    setSortBy(sortBy.filter((_, i) => i !== index));
  };

  const toggleGroupBy = (column: string) => {
    if (groupBy.includes(column)) {
      setGroupBy(groupBy.filter(g => g !== column));
    } else {
      setGroupBy([...groupBy, column]);
    }
  };

  const inferFormat = (dataType: string): ReportField['format'] => {
    if (dataType.includes('int') || dataType.includes('numeric') || dataType.includes('decimal')) return 'number';
    if (dataType.includes('timestamp') || dataType.includes('date')) return 'datetime';
    return 'text';
  };

  const applyDatePreset = (preset: string) => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (preset) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'yesterday':
        startDate = new Date(now.setDate(now.getDate() - 1));
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last_7_days':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'last_30_days':
        startDate = new Date(now.setDate(now.getDate() - 30));
        break;
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'this_quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return;
    }

    const dateColumn = allColumns.find(c => c.dataType.includes('timestamp') || c.dataType.includes('date'));
    if (dateColumn) {
      setFilters([
        ...filters.filter(f => f.column !== dateColumn.name),
        {
          column: dateColumn.name,
          operator: 'between',
          value: startDate.toISOString().split('T')[0],
          value2: endDate.toISOString().split('T')[0],
        },
      ]);
      toast({ title: 'Date filter applied', description: `Filtering by ${preset.replace(/_/g, ' ')}` });
    } else {
      toast({ title: 'No date column', description: 'This table has no timestamp column', variant: 'destructive' });
    }
  };

  const handleExecuteReport = async () => {
    if (!selectedTable || selectedFields.length === 0) {
      toast({ title: 'Error', description: 'Please select a table and at least one field', variant: 'destructive' });
      return;
    }

    setIsExecuting(true);
    try {
      const definition: DynamicReportDefinition = {
        name: reportName || 'Ad-hoc Report',
        description: reportDescription,
        baseTable: selectedTable,
        fields: selectedFields,
        filters: filters.map(f => ({ column: f.column, table: selectedTable, operator: f.operator, value: f.value, value2: f.value2 })),
        joins: [],
        groupBy,
        orderBy: sortBy,
        limit,
        format: 'json',
      };

      const res = await apiClient.post<{ result: ReportExecutionResult }>('/admin/dynamic-reports/execute', definition);
      setExecutionResult(res.result);
      toast({ title: 'Report executed', description: `${res.result.totalRows} rows returned in ${res.result.executionTimeMs}ms` });
    } catch (error) {
      toast({ title: 'Execution failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSaveReport = async () => {
    if (!reportName) {
      toast({ title: 'Error', description: 'Please enter a report name', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const definition: DynamicReportDefinition = {
        name: reportName,
        description: reportDescription,
        baseTable: selectedTable,
        fields: selectedFields,
        filters: filters.map(f => ({ column: f.column, table: selectedTable, operator: f.operator, value: f.value })),
        joins: [],
        groupBy,
        orderBy: sortBy,
        limit,
        format: 'json',
      };

      await apiClient.post('/admin/dynamic-reports', definition);
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast({ title: 'Report saved', description: 'Your report has been saved successfully' });
    } catch (error) {
      toast({ title: 'Save failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUseSuggestion = (suggestion: DynamicReportDefinition) => {
    setSelectedTable(suggestion.baseTable);
    setSelectedFields(suggestion.fields);
    setReportName(suggestion.name);
    setReportDescription(suggestion.description);
    setFilters([]);
    setSortBy(suggestion.orderBy || []);
    setGroupBy(suggestion.groupBy || []);
  };

  const handleExportCSV = async () => {
    if (!executionResult) return;
    
    const headers = executionResult.columns.map(c => c.name).join(',');
    const rows = executionResult.rows.map(row =>
      executionResult.columns.map(c => {
        const val = row[c.name];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
        return String(val);
      }).join(',')
    ).join('\n');
    
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportName || 'report'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (schemaLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading database schema...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Database className="h-5 w-5" />
            Schema-Adaptive Report Builder
          </h2>
          <p className="text-sm text-muted-foreground">
            Build custom reports with filters, aggregations, and visualizations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSqlPreview(!showSqlPreview)}>
            <Code2 className="h-4 w-4 mr-2" />
            {showSqlPreview ? 'Hide' : 'Show'} SQL
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetchSchema()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* SQL Preview */}
      {showSqlPreview && sqlPreview && (
        <Card className="bg-slate-950 text-slate-50">
          <CardContent className="py-4">
            <pre className="text-sm font-mono overflow-x-auto whitespace-pre-wrap">{sqlPreview}</pre>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Schema Browser */}
        <Card className="col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Database Schema</CardTitle>
            <CardDescription>Select a table</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[450px]">
              <Accordion type="multiple" className="w-full">
                {schema.map((category) => (
                  <AccordionItem key={category.name} value={category.name}>
                    <AccordionTrigger className="text-sm">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        {category.name}
                        <Badge variant="secondary" className="ml-auto">{category.tables.length}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-1">
                        {category.tables.map((table) => (
                          <button
                            key={table.name}
                            onClick={() => {
                              setSelectedTable(table.name);
                              setSelectedFields([]);
                              setFilters([]);
                              setSortBy([]);
                              setGroupBy([]);
                            }}
                            className={cn(
                              'w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors',
                              selectedTable === table.name
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <Table2 className="h-3 w-3" />
                              {table.name}
                            </span>
                            <span className="text-xs opacity-60">{table.rowCount.toLocaleString()}</span>
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Configuration Panel */}
        <Card className="col-span-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {selectedTable ? `Configure: ${selectedTable}` : 'Select a table to configure'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedTableSchema ? (
              <Tabs value={activeConfigTab} onValueChange={setActiveConfigTab}>
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="fields" className="text-xs">
                    <Table2 className="h-3 w-3 mr-1" />
                    Fields ({selectedFields.length})
                  </TabsTrigger>
                  <TabsTrigger value="filters" className="text-xs">
                    <Filter className="h-3 w-3 mr-1" />
                    Filters ({filters.length})
                  </TabsTrigger>
                  <TabsTrigger value="sort" className="text-xs">
                    <ArrowUpDown className="h-3 w-3 mr-1" />
                    Sort ({sortBy.length})
                  </TabsTrigger>
                  <TabsTrigger value="group" className="text-xs">
                    <Layers className="h-3 w-3 mr-1" />
                    Group ({groupBy.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="fields" className="mt-4">
                  <ScrollArea className="h-[350px]">
                    <div className="space-y-2">
                      {selectedTableSchema.columns.map((column) => {
                        const fieldIndex = selectedFields.findIndex(
                          f => f.column === column.name && f.table === selectedTable
                        );
                        const isSelected = fieldIndex !== -1;
                        return (
                          <div
                            key={column.name}
                            className={cn(
                              'p-3 rounded-md border transition-colors',
                              isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleFieldToggle(column)}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{column.name}</span>
                                  <Badge variant="outline" className="text-xs">{column.dataType}</Badge>
                                  {column.isPrimaryKey && <Badge variant="secondary" className="text-xs">PK</Badge>}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="mt-3 pl-7 grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs">Alias</Label>
                                  <Input
                                    value={selectedFields[fieldIndex].alias}
                                    onChange={(e) => updateFieldAlias(fieldIndex, e.target.value)}
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Aggregation</Label>
                                  <Select
                                    value={selectedFields[fieldIndex].aggregation || 'none'}
                                    onValueChange={(v) => updateFieldAggregation(fieldIndex, v as ReportField['aggregation'])}
                                  >
                                    <SelectTrigger className="h-8 text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {AGGREGATION_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="filters" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Date Presets</Label>
                      <div className="flex flex-wrap gap-1">
                        {DATE_PRESETS.slice(0, 4).map(preset => (
                          <Button
                            key={preset.value}
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => applyDatePreset(preset.value)}
                          >
                            <Calendar className="h-3 w-3 mr-1" />
                            {preset.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <Separator />
                    <ScrollArea className="h-[280px]">
                      <div className="space-y-3">
                        {filters.map((filter, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 rounded border bg-muted/50">
                            <Select
                              value={filter.column}
                              onValueChange={(v) => updateFilter(i, { column: v })}
                            >
                              <SelectTrigger className="w-[140px] h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {allColumns.map(col => (
                                  <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={filter.operator}
                              onValueChange={(v) => updateFilter(i, { operator: v as ReportFilter['operator'] })}
                            >
                              <SelectTrigger className="w-[130px] h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FILTER_OPERATORS.map(op => (
                                  <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {!['is_null', 'is_not_null'].includes(filter.operator) && (
                              <Input
                                value={filter.value}
                                onChange={(e) => updateFilter(i, { value: e.target.value })}
                                placeholder="Value"
                                className="flex-1 h-8 text-sm"
                              />
                            )}
                            {filter.operator === 'between' && (
                              <Input
                                value={filter.value2 || ''}
                                onChange={(e) => updateFilter(i, { value2: e.target.value })}
                                placeholder="To"
                                className="w-[100px] h-8 text-sm"
                              />
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeFilter(i)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        {filters.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No filters added</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                    <Button variant="outline" size="sm" onClick={addFilter} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Filter
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="sort" className="mt-4">
                  <ScrollArea className="h-[320px]">
                    <div className="space-y-3">
                      {sortBy.map((sort, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded border bg-muted/50">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <Select
                            value={sort.column}
                            onValueChange={(v) => updateSort(i, { column: v })}
                          >
                            <SelectTrigger className="flex-1 h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedFields.map(f => (
                                <SelectItem key={f.column} value={f.column}>{f.alias}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant={sort.direction === 'asc' ? 'default' : 'outline'}
                            size="sm"
                            className="h-8"
                            onClick={() => updateSort(i, { direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
                          >
                            {sort.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeSort(i)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {sortBy.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <ArrowUpDown className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No sorting configured</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addSort}
                    disabled={selectedFields.length === 0}
                    className="w-full mt-4"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Sort
                  </Button>
                </TabsContent>

                <TabsContent value="group" className="mt-4">
                  <ScrollArea className="h-[350px]">
                    <div className="space-y-2">
                      {selectedFields.map((field) => (
                        <div
                          key={field.column}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors',
                            groupBy.includes(field.column) ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                          )}
                          onClick={() => toggleGroupBy(field.column)}
                        >
                          <Checkbox checked={groupBy.includes(field.column)} />
                          <span className="font-medium text-sm">{field.alias}</span>
                          <Badge variant="outline" className="text-xs ml-auto">{field.column}</Badge>
                        </div>
                      ))}
                      {selectedFields.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Select fields first to enable grouping</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                <Database className="h-12 w-12 mb-4 opacity-50" />
                <p>Select a table from the schema browser</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Report Config & Execute */}
        <Card className="col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Report Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Report Name</Label>
              <Input
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                placeholder="My Custom Report"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="What does this report show?"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Row Limit</Label>
              <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 rows</SelectItem>
                  <SelectItem value="100">100 rows</SelectItem>
                  <SelectItem value="500">500 rows</SelectItem>
                  <SelectItem value="1000">1,000 rows</SelectItem>
                  <SelectItem value="5000">5,000 rows</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Summary</Label>
              <div className="text-sm space-y-1">
                <p><strong>Table:</strong> {selectedTable || 'None'}</p>
                <p><strong>Fields:</strong> {selectedFields.length}</p>
                <p><strong>Filters:</strong> {filters.length}</p>
                <p><strong>Sort:</strong> {sortBy.length}</p>
                <p><strong>Group:</strong> {groupBy.length}</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={handleExecuteReport}
                disabled={isExecuting || selectedFields.length === 0}
              >
                {isExecuting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Executing...</>
                ) : (
                  <><Play className="h-4 w-4 mr-2" /> Execute Report</>
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSaveReport}
                disabled={isSaving || !reportName || selectedFields.length === 0}
              >
                {isSaving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" /> Save Report</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-amber-500" />
              AI-Suggested Reports
            </CardTitle>
            <CardDescription>Quick-start with auto-generated report templates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              {suggestions.slice(0, 8).map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleUseSuggestion(suggestion)}
                  className="p-3 text-left rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <p className="font-medium text-sm">{suggestion.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{suggestion.description}</p>
                  <Badge variant="outline" className="mt-2 text-xs">{suggestion.baseTable}</Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Execution Results */}
      {executionResult && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Report Results</CardTitle>
                <CardDescription>
                  {executionResult.totalRows} rows in {executionResult.executionTimeMs}ms
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center border rounded-md">
                  <Button
                    variant={visualizationType === 'table' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-r-none"
                    onClick={() => setVisualizationType('table')}
                  >
                    <Table2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={visualizationType === 'bar' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-none border-x"
                    onClick={() => setVisualizationType('bar')}
                  >
                    <BarChart2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={visualizationType === 'line' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-none"
                    onClick={() => setVisualizationType('line')}
                  >
                    <LineChart className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={visualizationType === 'pie' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-l-none"
                    onClick={() => setVisualizationType('pie')}
                  >
                    <PieChartIcon className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {visualizationType === 'table' ? (
              <>
                <div className="rounded-md border overflow-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {executionResult.columns.map((col) => (
                          <TableHead key={col.name}>{col.name}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {executionResult.rows.slice(0, 50).map((row, i) => (
                        <TableRow key={i}>
                          {executionResult.columns.map((col) => (
                            <TableCell key={col.name}>
                              {formatCellValue(row[col.name], col.format)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {executionResult.rows.length > 50 && (
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    Showing 50 of {executionResult.totalRows} rows
                  </p>
                )}
              </>
            ) : (
              <div className="h-[400px] flex items-center justify-center border rounded-md bg-muted/20">
                <div className="text-center text-muted-foreground">
                  {visualizationType === 'bar' && <BarChart2 className="h-16 w-16 mx-auto mb-4 opacity-50" />}
                  {visualizationType === 'line' && <LineChart className="h-16 w-16 mx-auto mb-4 opacity-50" />}
                  {visualizationType === 'pie' && <PieChartIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />}
                  <p className="font-medium">Chart Visualization</p>
                  <p className="text-sm">
                    {executionResult.totalRows} data points • {executionResult.columns.length} columns
                  </p>
                  <p className="text-xs mt-2">
                    Install @tremor/react or recharts for interactive charts
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatCellValue(value: unknown, format?: string): string {
  if (value === null || value === undefined) return '-';
  if (format === 'currency') return `$${Number(value).toLocaleString()}`;
  if (format === 'percentage') return `${Number(value).toFixed(1)}%`;
  if (format === 'number') return Number(value).toLocaleString();
  if (format === 'date' || format === 'datetime') {
    const date = new Date(String(value));
    return format === 'date' ? date.toLocaleDateString() : date.toLocaleString();
  }
  return String(value);
}
