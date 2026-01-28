'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  FileText,
  CheckCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  Search,
  Building2,
  Globe,
  Brain,
  Accessibility,
  GraduationCap,
  CreditCard,
  Lock,
  RefreshCw,
  BarChart3,
  Award,
  User,
  FileCheck,
} from 'lucide-react';
import { format } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface RegulatoryStandard {
  id: string;
  code: string;
  name: string;
  fullName: string | null;
  category: string;
  description: string | null;
  jurisdiction: string | null;
  governingBody: string | null;
  websiteUrl: string | null;
  isMandatory: boolean;
  priority: number;
  status: 'active' | 'pending' | 'deprecated' | 'not_applicable';
  requirementsCount?: number;
  implementedCount?: number;
}

interface RegulatoryRequirement {
  id: string;
  standardId: string;
  requirementCode: string;
  title: string;
  description: string | null;
  category: string | null;
  controlType: 'technical' | 'administrative' | 'physical' | 'procedural' | null;
  isRequired: boolean;
  implementationStatus: 'not_started' | 'in_progress' | 'implemented' | 'verified' | 'not_applicable';
  implementationNotes: string | null;
  evidenceLocation: string | null;
  owner: string | null;
  dueDate: string | null;
  lastReviewedAt: string | null;
  reviewedBy: string | null;
}

interface TenantCompliance {
  standardId: string;
  code: string;
  name: string;
  category: string;
  isMandatory: boolean;
  isEnabled: boolean;
  complianceScore: number;
  status: 'not_assessed' | 'non_compliant' | 'partial' | 'compliant' | 'certified';
  certificationDate: string | null;
  certificationExpiry: string | null;
  lastAuditDate: string | null;
  nextAuditDate: string | null;
}

interface DashboardData {
  summary: {
    totalStandards: number;
    activeStandards: number;
    mandatoryStandards: number;
    categories: number;
    totalRequirements: number;
    implementedRequirements: number;
    verifiedRequirements: number;
    inProgressRequirements: number;
    notStartedRequirements: number;
    enabledForTenant: number;
    avgComplianceScore: number;
    compliantCount: number;
    certifiedCount: number;
  };
  categories: Array<{ name: string; count: number; mandatoryCount: number }>;
  priorityStandards: RegulatoryStandard[];
}

const CATEGORY_ICONS: Record<string, typeof Shield> = {
  'Data Privacy': Lock,
  Healthcare: Shield,
  Security: Shield,
  Financial: CreditCard,
  Government: Building2,
  'AI Governance': Brain,
  Accessibility: Accessibility,
  Education: GraduationCap,
  'Child Privacy': Lock,
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  deprecated: 'bg-gray-100 text-gray-700',
  not_applicable: 'bg-gray-100 text-gray-500',
};

const COMPLIANCE_STATUS_COLORS: Record<string, string> = {
  not_assessed: 'bg-gray-100 text-gray-600',
  non_compliant: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  compliant: 'bg-green-100 text-green-700',
  certified: 'bg-blue-100 text-blue-700',
};

const _IMPLEMENTATION_STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  implemented: 'bg-green-100 text-green-700',
  verified: 'bg-emerald-100 text-emerald-700',
  not_applicable: 'bg-gray-100 text-gray-500',
};
void _IMPLEMENTATION_STATUS_COLORS;

export default function RegulatoryStandardsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStandard, setSelectedStandard] = useState<RegulatoryStandard | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMandatoryOnly, setShowMandatoryOnly] = useState(false);
  const queryClient = useQueryClient();

  // Fetch dashboard data
  const { data: dashboard, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ['regulatory-dashboard'],
    queryFn: () => fetch('/api/admin/regulatory-standards/dashboard').then(r => r.json()).then(r => r.data),
  });

  // Fetch all standards
  const { data: standards, isLoading: standardsLoading } = useQuery<RegulatoryStandard[]>({
    queryKey: ['regulatory-standards', selectedCategory, showMandatoryOnly],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (showMandatoryOnly) params.set('mandatory', 'true');
      return fetch(`/api/admin/regulatory-standards?${params}`).then(r => r.json()).then(r => r.data);
    },
  });

  // Fetch tenant compliance
  const { data: tenantCompliance } = useQuery<TenantCompliance[]>({
    queryKey: ['tenant-compliance'],
    queryFn: () => fetch('/api/admin/regulatory-standards/tenant-compliance').then(r => r.json()).then(r => r.data),
  });

  // Fetch categories
  const { data: categories } = useQuery<Array<{ name: string; count: number; mandatoryCount: number }>>({
    queryKey: ['regulatory-categories'],
    queryFn: () => fetch('/api/admin/regulatory-standards/categories').then(r => r.json()).then(r => r.data),
  });

  // Fetch standard details with requirements
  const { data: standardDetails } = useQuery<RegulatoryStandard & { requirements: RegulatoryRequirement[] }>({
    queryKey: ['regulatory-standard', selectedStandard?.id],
    queryFn: () => fetch(`/api/admin/regulatory-standards/${selectedStandard?.id}`).then(r => r.json()).then(r => r.data),
    enabled: !!selectedStandard,
  });

  // Update tenant compliance
  const updateComplianceMutation = useMutation({
    mutationFn: ({ standardId, updates }: { standardId: string; updates: Partial<TenantCompliance> }) =>
      fetch(`/api/admin/regulatory-standards/tenant-compliance/${standardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenant-compliance'] }),
  });

  // Update requirement
  const updateRequirementMutation = useMutation({
    mutationFn: ({ requirementId, updates }: { requirementId: string; updates: Record<string, unknown> }) =>
      fetch(`/api/admin/regulatory-standards/requirements/${requirementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['regulatory-standard'] }),
  });

  const filteredStandards = standards?.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const implementationProgress = dashboard?.summary
    ? Math.round(
        ((dashboard.summary.implementedRequirements + dashboard.summary.verifiedRequirements) /
          dashboard.summary.totalRequirements) *
          100
      )
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Regulatory Standards Registry</h1>
          <p className="text-muted-foreground">
            Track compliance with {dashboard?.summary.totalStandards || 0} regulatory frameworks
          </p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="standards" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Standards
          </TabsTrigger>
          <TabsTrigger value="compliance" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            My Compliance
          </TabsTrigger>
          <TabsTrigger value="requirements" className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Requirements
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {dashboardLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : dashboard ? (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Standards
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{dashboard.summary.totalStandards}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {dashboard.summary.mandatoryStandards} mandatory
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Requirements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{dashboard.summary.totalRequirements}</div>
                    <Progress value={implementationProgress} className="mt-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {implementationProgress}% implemented
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Enabled Standards
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{dashboard.summary.enabledForTenant}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {dashboard.summary.certifiedCount} certified
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Avg Compliance Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{Math.round(dashboard.summary.avgComplianceScore)}%</div>
                    <Progress value={dashboard.summary.avgComplianceScore} className="mt-2" />
                  </CardContent>
                </Card>
              </div>

              {/* Categories Grid */}
              <Card>
                <CardHeader>
                  <CardTitle>Standards by Category</CardTitle>
                  <CardDescription>Regulatory frameworks organized by domain</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {dashboard.categories.map(category => {
                      const Icon = CATEGORY_ICONS[category.name] || Globe;
                      return (
                        <div
                          key={category.name}
                          className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => {
                            setSelectedCategory(category.name);
                            setActiveTab('standards');
                          }}
                        >
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{category.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {category.count} standards
                            </div>
                          </div>
                          {category.mandatoryCount > 0 && (
                            <Badge variant="secondary">{category.mandatoryCount}</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Priority Standards */}
              <Card>
                <CardHeader>
                  <CardTitle>Priority Standards</CardTitle>
                  <CardDescription>Mandatory regulatory frameworks requiring attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Standard</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Jurisdiction</TableHead>
                        <TableHead>Requirements</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboard.priorityStandards.map(standard => {
                        const progress = standard.requirementsCount
                          ? Math.round(((standard.implementedCount || 0) / standard.requirementsCount) * 100)
                          : 0;
                        return (
                          <TableRow key={standard.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{standard.code}</Badge>
                                <span className="font-medium">{standard.name}</span>
                                {standard.isMandatory && (
                                  <Badge variant="destructive" className="text-xs">Required</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{standard.category}</TableCell>
                            <TableCell>{standard.jurisdiction || '—'}</TableCell>
                            <TableCell>{standard.requirementsCount || 0}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={progress} className="w-20" />
                                <span className="text-sm text-muted-foreground">{progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedStandard(standard)}
                              >
                                View
                                <ChevronRight className="h-4 w-4 ml-1" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Requirements Status */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      Not Started
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.summary.notStartedRequirements}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-blue-500" />
                      In Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{dashboard.summary.inProgressRequirements}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Implemented
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{dashboard.summary.implementedRequirements}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Award className="h-4 w-4 text-emerald-500" />
                      Verified
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-600">{dashboard.summary.verifiedRequirements}</div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* Standards Tab */}
        <TabsContent value="standards" className="space-y-6">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search standards..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map(cat => (
                  <SelectItem key={cat.name} value={cat.name}>
                    {cat.name} ({cat.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch
                id="mandatory"
                checked={showMandatoryOnly}
                onCheckedChange={setShowMandatoryOnly}
              />
              <Label htmlFor="mandatory">Mandatory only</Label>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              {standardsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Standard</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Jurisdiction</TableHead>
                      <TableHead>Governing Body</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requirements</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStandards?.map(standard => (
                      <TableRow key={standard.id}>
                        <TableCell>
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono">
                                {standard.code}
                              </Badge>
                              <span className="font-medium">{standard.name}</span>
                              {standard.isMandatory && (
                                <Badge variant="destructive" className="text-xs">Required</Badge>
                              )}
                            </div>
                            {standard.fullName && (
                              <p className="text-sm text-muted-foreground mt-1 truncate max-w-md">
                                {standard.fullName}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{standard.category}</Badge>
                        </TableCell>
                        <TableCell>{standard.jurisdiction || '—'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {standard.governingBody || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[standard.status]}>
                            {standard.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{standard.requirementsCount || 0}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {standard.websiteUrl && (
                              <Button variant="ghost" size="sm" asChild>
                                <a href={standard.websiteUrl} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedStandard(standard)}
                            >
                              Details
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Compliance Tab */}
        <TabsContent value="compliance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tenant Compliance Status</CardTitle>
              <CardDescription>
                Enable standards and track your compliance progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Standard</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Enabled</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Audit</TableHead>
                    <TableHead>Next Audit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantCompliance?.map(item => (
                    <TableRow key={item.standardId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{item.code}</Badge>
                          <span className="font-medium">{item.name}</span>
                          {item.isMandatory && (
                            <Badge variant="destructive" className="text-xs">Required</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>
                        <Switch
                          checked={item.isEnabled}
                          onCheckedChange={checked =>
                            updateComplianceMutation.mutate({
                              standardId: item.standardId,
                              updates: { isEnabled: checked },
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={item.complianceScore} className="w-16" />
                          <span className="text-sm">{item.complianceScore}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={COMPLIANCE_STATUS_COLORS[item.status]}>
                          {item.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.lastAuditDate
                          ? format(new Date(item.lastAuditDate), 'PP')
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {item.nextAuditDate
                          ? format(new Date(item.nextAuditDate), 'PP')
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Requirements Tab */}
        <TabsContent value="requirements" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Implementation Tracker</CardTitle>
              <CardDescription>
                Track implementation status of individual requirements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a standard from the Standards tab to view its requirements</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Standard Details Sheet */}
      <Sheet open={!!selectedStandard} onOpenChange={() => setSelectedStandard(null)}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          {standardDetails && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-lg">
                    {standardDetails.code}
                  </Badge>
                  {standardDetails.isMandatory && (
                    <Badge variant="destructive">Required</Badge>
                  )}
                </div>
                <SheetTitle>{standardDetails.name}</SheetTitle>
                {standardDetails.fullName && (
                  <SheetDescription>{standardDetails.fullName}</SheetDescription>
                )}
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Standard Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Category</Label>
                    <p className="font-medium">{standardDetails.category}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Jurisdiction</Label>
                    <p className="font-medium">{standardDetails.jurisdiction || 'International'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Governing Body</Label>
                    <p className="font-medium">{standardDetails.governingBody || '—'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge className={STATUS_COLORS[standardDetails.status]}>
                      {standardDetails.status}
                    </Badge>
                  </div>
                </div>

                {standardDetails.description && (
                  <div>
                    <Label className="text-muted-foreground">Description</Label>
                    <p className="mt-1 text-sm">{standardDetails.description}</p>
                  </div>
                )}

                {standardDetails.websiteUrl && (
                  <Button variant="outline" asChild className="w-full">
                    <a href={standardDetails.websiteUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Official Website
                    </a>
                  </Button>
                )}

                {/* Requirements */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-lg font-semibold">
                      Requirements ({standardDetails.requirements?.length || 0})
                    </Label>
                  </div>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {standardDetails.requirements?.map(req => (
                      <div key={req.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {req.requirementCode}
                            </Badge>
                            {req.isRequired && (
                              <Badge variant="secondary" className="text-xs">Required</Badge>
                            )}
                          </div>
                          <Select
                            value={req.implementationStatus}
                            onValueChange={value =>
                              updateRequirementMutation.mutate({
                                requirementId: req.id,
                                updates: { implementationStatus: value },
                              })
                            }
                          >
                            <SelectTrigger className="w-32 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not_started">Not Started</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="implemented">Implemented</SelectItem>
                              <SelectItem value="verified">Verified</SelectItem>
                              <SelectItem value="not_applicable">N/A</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="font-medium text-sm">{req.title}</p>
                        {req.description && (
                          <p className="text-xs text-muted-foreground">{req.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {req.category && <span>{req.category}</span>}
                          {req.controlType && (
                            <Badge variant="outline" className="text-xs">
                              {req.controlType}
                            </Badge>
                          )}
                          {req.owner && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {req.owner}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
