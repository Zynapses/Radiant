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
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Brain,
  Sparkles,
  Settings,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Loader2,
  RefreshCw,
  Sliders,
  BarChart3,
  PieChart as PieChartIcon,
  Target,
  Lightbulb,
  Zap,
  BookOpen,
  Code,
  Palette,
  Search,
  FlaskConical,
  Info,
  ChevronDown,
  ChevronUp,
  Star,
  Edit,
  Eye,
} from 'lucide-react';

// Types
interface PrepromptTemplate {
  id: string;
  templateCode: string;
  name: string;
  description?: string;
  systemPrompt: string;
  applicableModes: string[];
  applicableDomains: string[];
  applicableTaskTypes: string[];
  complexityRange: string[];
  baseEffectivenessScore: number;
  domainWeight: number;
  modeWeight: number;
  modelWeight: number;
  complexityWeight: number;
  taskTypeWeight: number;
  feedbackWeight: number;
  totalUses: number;
  successfulUses: number;
  avgFeedbackScore?: number;
  isActive: boolean;
  isDefault: boolean;
}

interface PrepromptDashboard {
  totalTemplates: number;
  activeTemplates: number;
  totalInstances: number;
  totalFeedback: number;
  overallAvgRating: number;
  overallThumbsUpRate: number;
  attributionDistribution: {
    preprompt: number;
    model: number;
    mode: number;
    workflow: number;
    domain: number;
    other: number;
  };
  learningEnabled: boolean;
  explorationRate: number;
  topTemplates: Array<{
    templateCode: string;
    name: string;
    avgRating: number;
    uses: number;
  }>;
  lowPerformingTemplates: Array<{
    templateCode: string;
    name: string;
    avgRating: number;
    issues: string[];
  }>;
  recentFeedback: Array<{
    instanceId: string;
    rating: number;
    attribution?: string;
    feedbackText?: string;
    createdAt: string;
  }>;
}

// API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

// Chart colors
const ATTRIBUTION_COLORS: Record<string, string> = {
  preprompt: '#ef4444',
  model: '#3b82f6',
  mode: '#8b5cf6',
  workflow: '#f59e0b',
  domain: '#22c55e',
  other: '#6b7280',
};

const MODE_ICONS: Record<string, React.ElementType> = {
  thinking: Brain,
  extended_thinking: Sparkles,
  coding: Code,
  creative: Palette,
  research: Search,
  analysis: BarChart3,
  multi_model: FlaskConical,
  chain_of_thought: Lightbulb,
  self_consistency: Target,
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function getRatingColor(rating: number): string {
  if (rating >= 4.5) return 'text-green-600';
  if (rating >= 3.5) return 'text-yellow-600';
  return 'text-red-600';
}

export function PrepromptLearningClient() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedTemplate, setSelectedTemplate] = useState<PrepromptTemplate | null>(null);
  const [showWeightsDialog, setShowWeightsDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading } = useQuery<PrepromptDashboard>({
    queryKey: ['preprompt-dashboard'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/preprompts/dashboard`);
      if (!res.ok) throw new Error('Failed to fetch dashboard');
      const { data } = await res.json();
      return data;
    },
  });

  const { data: templates } = useQuery<PrepromptTemplate[]>({
    queryKey: ['preprompt-templates'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/preprompts/templates`);
      if (!res.ok) throw new Error('Failed to fetch templates');
      const { data } = await res.json();
      return data ?? [];
    },
  });

  const updateWeightsMutation = useMutation({
    mutationFn: async (data: { templateId: string; weights: Record<string, number> }) => {
      const res = await fetch(`${API_BASE}/api/admin/preprompts/templates/${data.templateId}/weights`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.weights),
      });
      if (!res.ok) throw new Error('Failed to update weights');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preprompt-templates'] });
      setShowWeightsDialog(false);
    },
  });

  if (isLoading || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const attributionData = Object.entries(dashboard.attributionDistribution).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' '),
    value: value * 100,
    color: ATTRIBUTION_COLORS[key],
  }));

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Brain className="h-8 w-8 text-purple-600" />
              Pre-Prompt Learning
            </h1>
            <p className="text-muted-foreground">
              Manage pre-prompt templates and view learning effectiveness
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 mr-4">
              <Switch 
                checked={dashboard.learningEnabled} 
                onCheckedChange={() => {}}
              />
              <Label>Learning Enabled</Label>
            </div>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Templates</p>
                  <p className="text-2xl font-bold">{dashboard.activeTemplates}/{dashboard.totalTemplates}</p>
                </div>
                <BookOpen className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Uses</p>
                  <p className="text-2xl font-bold">{dashboard.totalInstances.toLocaleString()}</p>
                </div>
                <Zap className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Rating</p>
                  <p className={`text-2xl font-bold ${getRatingColor(dashboard.overallAvgRating)}`}>
                    {dashboard.overallAvgRating.toFixed(1)} / 5
                  </p>
                </div>
                <Star className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Thumbs Up Rate</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatPercent(dashboard.overallThumbsUpRate)}
                  </p>
                </div>
                <ThumbsUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Feedback Count</p>
                  <p className="text-2xl font-bold">{dashboard.totalFeedback}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Exploration Rate</p>
                  <p className="text-2xl font-bold">{formatPercent(dashboard.explorationRate)}</p>
                </div>
                <FlaskConical className="h-8 w-8 text-cyan-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="attribution">Attribution Analysis</TabsTrigger>
            <TabsTrigger value="feedback">Recent Feedback</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Attribution Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5" />
                    Issue Attribution Distribution
                  </CardTitle>
                  <CardDescription>
                    When users report issues, what gets blamed?
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={attributionData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={50}
                        label={({ name, value }) => `${name}: ${value.toFixed(0)}%`}
                        labelLine={false}
                      >
                        {attributionData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 text-sm text-muted-foreground text-center">
                    <Info className="inline h-4 w-4 mr-1" />
                    Pre-prompts are blamed for only {formatPercent(dashboard.attributionDistribution.preprompt)} of issues
                  </div>
                </CardContent>
              </Card>

              {/* Top Performing Templates */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    Top Performing Templates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dashboard.topTemplates.map((template, index) => (
                      <div key={template.templateCode} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold text-sm">
                            #{index + 1}
                          </span>
                          <div>
                            <p className="font-medium">{template.name}</p>
                            <p className="text-xs text-muted-foreground">{template.uses} uses</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${getRatingColor(template.avgRating)}`}>
                            {template.avgRating.toFixed(1)}
                          </p>
                          <p className="text-xs text-muted-foreground">avg rating</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Templates Needing Attention */}
            {dashboard.lowPerformingTemplates.length > 0 && (
              <Card className="border-amber-200 bg-amber-50/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-700">
                    <AlertTriangle className="h-5 w-5" />
                    Templates Needing Attention
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboard.lowPerformingTemplates.map((template) => (
                      <div key={template.templateCode} className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-200">
                        <div>
                          <p className="font-medium">{template.name}</p>
                          <div className="flex gap-2 mt-1">
                            {template.issues.map((issue, i) => (
                              <Badge key={i} variant="outline" className="text-amber-700 border-amber-300">
                                {issue}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-amber-600">{template.avgRating.toFixed(1)}</p>
                          <Button size="sm" variant="outline" className="mt-1">
                            <Edit className="h-3 w-3 mr-1" />
                            Adjust
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pre-Prompt Templates</CardTitle>
                <CardDescription>
                  Configure template weights and effectiveness
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead>Modes</TableHead>
                      <TableHead className="text-center">Uses</TableHead>
                      <TableHead className="text-center">Success</TableHead>
                      <TableHead className="text-center">Rating</TableHead>
                      <TableHead className="text-center">Base Score</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates?.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              {template.name}
                              {template.isDefault && (
                                <Badge variant="secondary" className="text-xs">Default</Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {template.templateCode}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {template.applicableModes.slice(0, 2).map((mode) => {
                              const Icon = MODE_ICONS[mode] || Brain;
                              return (
                                <Tooltip key={mode}>
                                  <TooltipTrigger>
                                    <Badge variant="outline" className="px-1">
                                      <Icon className="h-3 w-3" />
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>{mode}</TooltipContent>
                                </Tooltip>
                              );
                            })}
                            {template.applicableModes.length > 2 && (
                              <Badge variant="outline">+{template.applicableModes.length - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{template.totalUses}</TableCell>
                        <TableCell className="text-center">
                          <span className="text-green-600">
                            {((template.successfulUses / template.totalUses) * 100).toFixed(0)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={getRatingColor(template.avgFeedbackScore || 0)}>
                            {template.avgFeedbackScore?.toFixed(1) || 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {template.baseEffectivenessScore.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => setSelectedTemplate(template)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View Details</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedTemplate(template);
                                    setShowWeightsDialog(true);
                                  }}
                                >
                                  <Sliders className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Adjust Weights</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attribution Tab */}
          <TabsContent value="attribution" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Attribution Analysis</CardTitle>
                <CardDescription>
                  Understanding what factors contribute to success or failure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">How Attribution Works</h4>
                    <p className="text-sm text-muted-foreground">
                      When users provide feedback, the AGI learns which factor was most likely responsible:
                    </p>
                    <ul className="mt-2 text-sm space-y-1">
                      <li><span className="font-medium" style={{ color: ATTRIBUTION_COLORS.preprompt }}>• Pre-prompt</span> - The system prompt or instructions were wrong</li>
                      <li><span className="font-medium" style={{ color: ATTRIBUTION_COLORS.model }}>• Model</span> - The selected AI model was not appropriate</li>
                      <li><span className="font-medium" style={{ color: ATTRIBUTION_COLORS.mode }}>• Mode</span> - The orchestration mode (thinking, coding, etc.) was wrong</li>
                      <li><span className="font-medium" style={{ color: ATTRIBUTION_COLORS.workflow }}>• Workflow</span> - The workflow pattern did not fit the task</li>
                      <li><span className="font-medium" style={{ color: ATTRIBUTION_COLORS.domain }}>• Domain</span> - Domain detection was incorrect</li>
                      <li><span className="font-medium" style={{ color: ATTRIBUTION_COLORS.other }}>• Other</span> - External factors or unclear cause</li>
                    </ul>
                  </div>

                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={attributionData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="name" width={100} />
                      <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {attributionData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <p className="font-bold text-2xl text-green-700">
                        {formatPercent(1 - dashboard.attributionDistribution.preprompt)}
                      </p>
                      <p className="text-sm text-green-600">Success not blamed on pre-prompts</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <Target className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <p className="font-bold text-2xl text-blue-700">
                        {formatPercent(dashboard.attributionDistribution.model + dashboard.attributionDistribution.mode)}
                      </p>
                      <p className="text-sm text-blue-600">Attributed to Model/Mode selection</p>
                    </div>
                    <div className="text-center p-4 bg-amber-50 rounded-lg">
                      <Lightbulb className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                      <p className="font-bold text-2xl text-amber-700">
                        {dashboard.totalFeedback}
                      </p>
                      <p className="text-sm text-amber-600">Learning samples collected</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Feedback</CardTitle>
                <CardDescription>
                  Latest user feedback with attribution
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboard.recentFeedback.map((feedback) => (
                    <div key={feedback.instanceId} className="flex items-start gap-4 p-4 border rounded-lg">
                      <div className={`p-2 rounded-full ${
                        feedback.rating >= 4 ? 'bg-green-100' : 
                        feedback.rating >= 3 ? 'bg-yellow-100' : 'bg-red-100'
                      }`}>
                        {feedback.rating >= 4 ? (
                          <ThumbsUp className="h-5 w-5 text-green-600" />
                        ) : feedback.rating >= 3 ? (
                          <MessageSquare className="h-5 w-5 text-yellow-600" />
                        ) : (
                          <ThumbsDown className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Rating: {feedback.rating}/5</span>
                          {feedback.attribution && (
                            <Badge 
                              variant="outline"
                              style={{ borderColor: ATTRIBUTION_COLORS[feedback.attribution], color: ATTRIBUTION_COLORS[feedback.attribution] }}
                            >
                              Attributed to: {feedback.attribution}
                            </Badge>
                          )}
                        </div>
                        {feedback.feedbackText && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {feedback.feedbackText}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(feedback.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Weights Dialog */}
        <Dialog open={showWeightsDialog} onOpenChange={setShowWeightsDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Adjust Template Weights</DialogTitle>
              <DialogDescription>
                {selectedTemplate?.name} - Fine-tune how factors influence template selection
              </DialogDescription>
            </DialogHeader>

            {selectedTemplate && (
              <div className="space-y-6 py-4">
                <div className="space-y-4">
                  <WeightSlider
                    label="Base Effectiveness"
                    description="Starting score before bonuses"
                    value={selectedTemplate.baseEffectivenessScore}
                    onChange={() => {}}
                  />
                  <WeightSlider
                    label="Domain Weight"
                    description="Bonus for matching domain"
                    value={selectedTemplate.domainWeight}
                    onChange={() => {}}
                  />
                  <WeightSlider
                    label="Mode Weight"
                    description="Bonus for matching orchestration mode"
                    value={selectedTemplate.modeWeight}
                    onChange={() => {}}
                  />
                  <WeightSlider
                    label="Model Weight"
                    description="Bonus for compatible model"
                    value={selectedTemplate.modelWeight}
                    onChange={() => {}}
                  />
                  <WeightSlider
                    label="Complexity Weight"
                    description="Bonus for matching complexity level"
                    value={selectedTemplate.complexityWeight}
                    onChange={() => {}}
                  />
                  <WeightSlider
                    label="Task Type Weight"
                    description="Bonus for matching task type"
                    value={selectedTemplate.taskTypeWeight}
                    onChange={() => {}}
                  />
                  <WeightSlider
                    label="Feedback Weight"
                    description="How much historical feedback affects score"
                    value={selectedTemplate.feedbackWeight}
                    onChange={() => {}}
                  />
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Score Calculation</h4>
                  <p className="text-sm text-muted-foreground font-mono">
                    Final Score = Base + (Domain × DomainWeight) + (Mode × ModeWeight) + ...
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowWeightsDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                if (selectedTemplate) {
                  updateWeightsMutation.mutate({
                    templateId: selectedTemplate.id,
                    weights: {
                      baseEffectivenessScore: selectedTemplate.baseEffectivenessScore,
                      domainWeight: selectedTemplate.domainWeight,
                      modeWeight: selectedTemplate.modeWeight,
                      modelWeight: selectedTemplate.modelWeight,
                      complexityWeight: selectedTemplate.complexityWeight,
                      taskTypeWeight: selectedTemplate.taskTypeWeight,
                      feedbackWeight: selectedTemplate.feedbackWeight,
                    },
                  });
                }
              }}>
                Save Weights
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function WeightSlider({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Label>{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="font-mono text-sm font-medium w-12 text-right">
          {value.toFixed(2)}
        </span>
      </div>
      <Slider
        value={[value * 100]}
        onValueChange={(v) => onChange(v[0] / 100)}
        max={100}
        step={1}
        className="w-full"
      />
    </div>
  );
}
