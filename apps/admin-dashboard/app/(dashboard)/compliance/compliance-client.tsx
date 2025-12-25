'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  FileText,
  Download,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
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

const REPORT_TYPES = [
  { value: 'soc2', label: 'SOC 2 Type II', icon: Shield },
  { value: 'hipaa', label: 'HIPAA', icon: Shield },
  { value: 'gdpr', label: 'GDPR', icon: Shield },
  { value: 'iso27001', label: 'ISO 27001', icon: Shield },
];

export function ComplianceClient() {
  const [selectedReport, setSelectedReport] = useState<string>('soc2');

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Compliance Reports</h1>
          <p className="text-muted-foreground">
            SOC 2, HIPAA, GDPR, and ISO 27001 compliance monitoring
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => generateReportMutation.mutate(selectedReport)}
            disabled={generateReportMutation.isPending}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${
                generateReportMutation.isPending ? 'animate-spin' : ''
              }`}
            />
            Generate Report
          </Button>
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <CustomReportBuilder />
        </div>
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
          const score =
            stats?.[`${type.value}Score` as keyof ComplianceStats] || 0;
          return (
            <Card
              key={type.value}
              className={`cursor-pointer transition-colors ${
                selectedReport === type.value ? 'border-primary' : ''
              }`}
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
              {/* Summary */}
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="text-4xl font-bold">{report.score}%</div>
                <div>
                  <div className="font-medium">Compliance Score</div>
                  <div className="text-sm text-muted-foreground">
                    {report.findings.length} findings identified
                  </div>
                </div>
              </div>

              {/* Findings */}
              <div>
                <h3 className="font-medium mb-3">Findings</h3>
                <div className="space-y-3">
                  {report.findings.map((finding) => (
                    <div
                      key={finding.id}
                      className="border rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={getSeverityColor(finding.severity)}
                          >
                            {finding.severity.toUpperCase()}
                          </Badge>
                          <Badge variant="secondary">{finding.category}</Badge>
                        </div>
                        <Badge
                          variant={
                            finding.status === 'resolved'
                              ? 'default'
                              : finding.status === 'in_progress'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
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
    </div>
  );
}
