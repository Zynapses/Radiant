'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  FileText,
  Plus,
  Calendar,
  Download,
  Loader2,
  Settings,
  Filter,
} from 'lucide-react';

interface ReportConfig {
  name: string;
  description: string;
  dataSource: 'radiant' | 'thinktank' | 'combined';
  metrics: string[];
  filters: ReportFilter[];
  outputFormat: 'pdf' | 'csv' | 'json';
  schedule?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    time: string;
    recipients: string[];
  };
}

interface ReportFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'between';
  value: string;
  value2?: string;
}

const METRIC_CATEGORIES = [
  {
    category: 'Access & Authentication',
    metrics: [
      { id: 'login_attempts', label: 'Login Attempts' },
      { id: 'failed_logins', label: 'Failed Login Attempts' },
      { id: 'mfa_usage', label: 'MFA Usage Rate' },
      { id: 'session_duration', label: 'Session Duration' },
      { id: 'password_changes', label: 'Password Changes' },
    ],
  },
  {
    category: 'Data Access',
    metrics: [
      { id: 'data_exports', label: 'Data Exports' },
      { id: 'api_access', label: 'API Access Logs' },
      { id: 'sensitive_data_access', label: 'Sensitive Data Access' },
      { id: 'data_retention', label: 'Data Retention Compliance' },
    ],
  },
  {
    category: 'Security Events',
    metrics: [
      { id: 'security_incidents', label: 'Security Incidents' },
      { id: 'anomaly_detections', label: 'Anomaly Detections' },
      { id: 'blocked_requests', label: 'Blocked Requests' },
      { id: 'ip_blacklist_hits', label: 'IP Blacklist Hits' },
    ],
  },
  {
    category: 'System Health',
    metrics: [
      { id: 'uptime', label: 'System Uptime' },
      { id: 'error_rates', label: 'Error Rates' },
      { id: 'response_times', label: 'Response Times' },
      { id: 'resource_utilization', label: 'Resource Utilization' },
    ],
  },
  {
    category: 'User Activity',
    metrics: [
      { id: 'active_users', label: 'Active Users' },
      { id: 'feature_usage', label: 'Feature Usage' },
      { id: 'admin_actions', label: 'Admin Actions' },
      { id: 'permission_changes', label: 'Permission Changes' },
    ],
  },
];

const FILTER_FIELDS = [
  { id: 'tenant_id', label: 'Tenant ID', type: 'string' },
  { id: 'user_id', label: 'User ID', type: 'string' },
  { id: 'date_range', label: 'Date Range', type: 'date' },
  { id: 'severity', label: 'Severity', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
  { id: 'status', label: 'Status', type: 'select', options: ['active', 'resolved', 'dismissed'] },
  { id: 'region', label: 'Region', type: 'string' },
];

export function CustomReportBuilder() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ReportConfig>({
    name: '',
    description: '',
    dataSource: 'combined',
    metrics: [],
    filters: [],
    outputFormat: 'pdf',
    schedule: {
      enabled: false,
      frequency: 'weekly',
      time: '09:00',
      recipients: [],
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (reportConfig: ReportConfig) => {
      const response = await fetch('/api/admin/compliance/reports/generate-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportConfig),
      });
      if (!response.ok) throw new Error('Failed to generate report');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }
      setIsOpen(false);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (reportConfig: ReportConfig) => {
      const response = await fetch('/api/admin/compliance/reports/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportConfig),
      });
      if (!response.ok) throw new Error('Failed to save template');
      return response.json();
    },
  });

  const toggleMetric = (metricId: string) => {
    setConfig((prev) => ({
      ...prev,
      metrics: prev.metrics.includes(metricId)
        ? prev.metrics.filter((m) => m !== metricId)
        : [...prev.metrics, metricId],
    }));
  };

  const addFilter = () => {
    setConfig((prev) => ({
      ...prev,
      filters: [...prev.filters, { field: 'tenant_id', operator: 'eq', value: '' }],
    }));
  };

  const updateFilter = (index: number, updates: Partial<ReportFilter>) => {
    setConfig((prev) => ({
      ...prev,
      filters: prev.filters.map((f, i) => (i === index ? { ...f, ...updates } : f)),
    }));
  };

  const removeFilter = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      filters: prev.filters.filter((_, i) => i !== index),
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Custom Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Custom Report Builder
          </DialogTitle>
          <DialogDescription>
            Create a custom compliance report with specific metrics and filters
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Report Name</Label>
              <Input
                id="name"
                placeholder="Monthly Security Review"
                value={config.name}
                onChange={(e) => setConfig((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataSource">Data Source</Label>
              <Select
                value={config.dataSource}
                onValueChange={(value: 'radiant' | 'thinktank' | 'combined') =>
                  setConfig((prev) => ({ ...prev, dataSource: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="radiant">Radiant Only</SelectItem>
                  <SelectItem value="thinktank">Think Tank Only</SelectItem>
                  <SelectItem value="combined">Combined</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the purpose of this report..."
              value={config.description}
              onChange={(e) => setConfig((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="space-y-3">
            <Label>Metrics to Include</Label>
            <div className="border rounded-lg p-4 space-y-4 max-h-64 overflow-y-auto">
              {METRIC_CATEGORIES.map((category) => (
                <div key={category.category}>
                  <h4 className="font-medium text-sm mb-2">{category.category}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {category.metrics.map((metric) => (
                      <div key={metric.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={metric.id}
                          checked={config.metrics.includes(metric.id)}
                          onCheckedChange={() => toggleMetric(metric.id)}
                        />
                        <label htmlFor={metric.id} className="text-sm cursor-pointer">
                          {metric.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {config.metrics.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {config.metrics.map((m) => (
                  <Badge key={m} variant="secondary" className="text-xs">
                    {m}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </Label>
              <Button variant="outline" size="sm" onClick={addFilter}>
                <Plus className="h-4 w-4 mr-1" />
                Add Filter
              </Button>
            </div>
            {config.filters.length > 0 && (
              <div className="space-y-2">
                {config.filters.map((filter, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select
                      value={filter.field}
                      onValueChange={(value) => updateFilter(index, { field: value })}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FILTER_FIELDS.map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={filter.operator}
                      onValueChange={(value: ReportFilter['operator']) =>
                        updateFilter(index, { operator: value })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eq">Equals</SelectItem>
                        <SelectItem value="neq">Not Equals</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="gt">Greater Than</SelectItem>
                        <SelectItem value="lt">Less Than</SelectItem>
                        <SelectItem value="between">Between</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Value"
                      value={filter.value}
                      onChange={(e) => updateFilter(index, { value: e.target.value })}
                      className="flex-1"
                    />
                    {filter.operator === 'between' && (
                      <Input
                        placeholder="End Value"
                        value={filter.value2 || ''}
                        onChange={(e) => updateFilter(index, { value2: e.target.value })}
                        className="w-32"
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFilter(index)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Output Format</Label>
              <Select
                value={config.outputFormat}
                onValueChange={(value: 'pdf' | 'csv' | 'json') =>
                  setConfig((prev) => ({ ...prev, outputFormat: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="csv">CSV Spreadsheet</SelectItem>
                  <SelectItem value="json">JSON Data</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Schedule Report
                </CardTitle>
                <Checkbox
                  checked={config.schedule?.enabled}
                  onCheckedChange={(checked: boolean | 'indeterminate') =>
                    setConfig((prev) => ({
                      ...prev,
                      schedule: { ...prev.schedule!, enabled: checked === true },
                    }))
                  }
                />
              </div>
            </CardHeader>
            {config.schedule?.enabled && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select
                      value={config.schedule.frequency}
                      onValueChange={(value: 'daily' | 'weekly' | 'monthly') =>
                        setConfig((prev) => ({
                          ...prev,
                          schedule: { ...prev.schedule!, frequency: value },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Time (UTC)</Label>
                    <Input
                      type="time"
                      value={config.schedule.time}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          schedule: { ...prev.schedule!, time: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Recipients (comma-separated emails)</Label>
                  <Input
                    placeholder="admin@example.com, security@example.com"
                    value={config.schedule.recipients.join(', ')}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        schedule: {
                          ...prev.schedule!,
                          recipients: e.target.value.split(',').map((s) => s.trim()),
                        },
                      }))
                    }
                  />
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => saveMutation.mutate(config)}
            disabled={!config.name || config.metrics.length === 0 || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Settings className="h-4 w-4 mr-2" />
            )}
            Save Template
          </Button>
          <Button
            onClick={() => generateMutation.mutate(config)}
            disabled={!config.name || config.metrics.length === 0 || generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Generate Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
