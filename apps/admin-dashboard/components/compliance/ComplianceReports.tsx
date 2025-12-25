'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  FileText,
  Download,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Calendar,
  Building,
} from 'lucide-react';

interface ComplianceReport {
  id: string;
  tenantId: string;
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

interface ComplianceScore {
  framework: string;
  score: number;
  status: 'compliant' | 'partial' | 'non_compliant';
  lastAssessment: string;
  nextAssessment: string;
  openFindings: number;
}

const frameworkConfig = {
  soc2: {
    name: 'SOC 2',
    description: 'Service Organization Control 2',
    icon: Shield,
    controls: ['CC6.1', 'CC7.1', 'CC8.1', 'CC9.1', 'CC9.2'],
  },
  hipaa: {
    name: 'HIPAA',
    description: 'Health Insurance Portability and Accountability Act',
    icon: Building,
    controls: ['PHI Protection', 'BAA Compliance', 'Incident Response', 'Training', 'Risk Assessment'],
  },
  gdpr: {
    name: 'GDPR',
    description: 'General Data Protection Regulation',
    icon: FileText,
    controls: ['DSR Handling', 'Consent Management', 'Data Processing', 'Cross-Border Transfers', 'Breach Notification'],
  },
  iso27001: {
    name: 'ISO 27001',
    description: 'Information Security Management System',
    icon: CheckCircle,
    controls: ['A.5-A.8', 'A.9-A.12', 'A.13-A.15', 'A.16-A.18'],
  },
};

const statusColors = {
  compliant: 'text-green-500',
  partial: 'text-yellow-500',
  non_compliant: 'text-red-500',
};

const statusIcons = {
  compliant: CheckCircle,
  partial: AlertTriangle,
  non_compliant: XCircle,
};

const severityColors = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
};

export function ComplianceReports() {
  const [product, setProduct] = useState<string>('combined');
  const [framework, setFramework] = useState<string>('soc2');

  const { data: scores, isLoading: scoresLoading } = useQuery<ComplianceScore[]>({
    queryKey: ['compliance-scores', product],
    queryFn: () => fetch(`/api/compliance/scores?product=${product}`).then((r) => r.json()),
  });

  const { data: report, isLoading: reportLoading, refetch } = useQuery<ComplianceReport>({
    queryKey: ['compliance-report', product, framework],
    queryFn: () => fetch(`/api/compliance/report?product=${product}&framework=${framework}`).then((r) => r.json()),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/compliance/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, framework }),
      }).then((r) => r.json()),
    onSuccess: () => refetch(),
  });

  const currentFramework = frameworkConfig[framework as keyof typeof frameworkConfig];
  const StatusIcon = report ? statusIcons[report.status] : Clock;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Compliance Reports</h2>
          <p className="text-muted-foreground">SOC2, HIPAA, GDPR, and ISO 27001 compliance</p>
        </div>
        <div className="flex gap-2">
          <Select value={product} onValueChange={setProduct}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="combined">Combined</SelectItem>
              <SelectItem value="radiant">Radiant</SelectItem>
              <SelectItem value="thinktank">Think Tank</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            Generate Report
          </Button>
        </div>
      </div>

      {/* Compliance Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(frameworkConfig).map(([key, config]) => {
          const score = scores?.find((s) => s.framework === key);
          const Icon = config.icon;
          const ScoreStatusIcon = score ? statusIcons[score.status] : Clock;
          
          return (
            <Card
              key={key}
              className={`cursor-pointer transition-colors ${
                framework === key ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setFramework(key)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <ScoreStatusIcon className={`h-5 w-5 ${score ? statusColors[score.status] : 'text-muted-foreground'}`} />
                </div>
                <CardTitle className="text-lg">{config.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{score?.score || 0}%</span>
                    <Badge variant={score?.status === 'compliant' ? 'default' : 'secondary'}>
                      {score?.status || 'pending'}
                    </Badge>
                  </div>
                  <Progress value={score?.score || 0} className="h-2" />
                  {score?.openFindings ? (
                    <p className="text-xs text-muted-foreground">
                      {score.openFindings} open findings
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Framework Tabs */}
      <Tabs value={framework} onValueChange={setFramework}>
        <TabsList>
          {Object.entries(frameworkConfig).map(([key, config]) => (
            <TabsTrigger key={key} value={key}>
              {config.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(frameworkConfig).map(([key, config]) => (
          <TabsContent key={key} value={key} className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Report Summary */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{config.name} Compliance Report</CardTitle>
                      <CardDescription>{config.description}</CardDescription>
                    </div>
                    {report && (
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export PDF
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {reportLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : report ? (
                    <div className="space-y-4">
                      {/* Score Overview */}
                      <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                        <StatusIcon className={`h-12 w-12 ${statusColors[report.status]}`} />
                        <div>
                          <div className="text-3xl font-bold">{report.score}%</div>
                          <div className="text-sm text-muted-foreground capitalize">
                            {report.status.replace('_', ' ')}
                          </div>
                        </div>
                        <div className="ml-auto text-right text-sm text-muted-foreground">
                          <div>Generated: {new Date(report.generatedAt).toLocaleDateString()}</div>
                          <div>Expires: {new Date(report.expiresAt).toLocaleDateString()}</div>
                        </div>
                      </div>

                      {/* Control Categories */}
                      <div>
                        <h4 className="font-medium mb-2">Control Categories</h4>
                        <div className="space-y-2">
                          {config.controls.map((control, i) => (
                            <div key={control} className="flex items-center gap-3 p-2 border rounded">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span className="flex-1">{control}</span>
                              <Badge variant="outline">Compliant</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-2" />
                      <p>No report generated yet</p>
                      <Button className="mt-4" onClick={() => generateMutation.mutate()}>
                        Generate Report
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Findings */}
              <Card>
                <CardHeader>
                  <CardTitle>Findings</CardTitle>
                  <CardDescription>
                    {report?.findings.filter((f) => f.status !== 'resolved').length || 0} open issues
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!report || report.findings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                      <p>No findings</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {report.findings.map((finding) => (
                        <div key={finding.id} className="border rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${severityColors[finding.severity]}`} />
                            <span className="font-medium text-sm">{finding.category}</span>
                            <Badge
                              variant={finding.status === 'resolved' ? 'default' : 'secondary'}
                              className="ml-auto text-xs"
                            >
                              {finding.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{finding.description}</p>
                          {finding.status !== 'resolved' && (
                            <p className="text-xs text-blue-500 mt-1">
                              → {finding.recommendation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Schedule Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Assessment Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {scores?.map((score) => (
              <div key={score.framework} className="text-center p-3 border rounded-lg">
                <div className="font-medium">
                  {frameworkConfig[score.framework as keyof typeof frameworkConfig]?.name}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Next: {new Date(score.nextAssessment).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
