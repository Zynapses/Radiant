'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
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
  Plus,
  Save,
  Trash2,
  Copy,
  Play,
  Search,
  Filter,
  ChevronRight,
  ChevronDown,
  Settings2,
  Layers,
  RefreshCw,
  Share2,
  Lock,
  Globe,
  GripVertical,
  AlertCircle,
  CheckCircle2,
  Edit3,
} from 'lucide-react';

interface WorkflowMethod {
  methodId: string;
  methodCode: string;
  displayName: string;
  scientificName: string;
  description: string;
  methodCategory: string;
  defaultParameters: Record<string, unknown>;
  parameterSchema: Record<string, unknown>;
}

interface WorkflowStep {
  stepOrder: number;
  methodCode: string;
  displayName: string;
  parameters: Record<string, unknown>;
  condition?: string;
  isEnabled: boolean;
}

interface UserWorkflowTemplate {
  templateId: string;
  templateName: string;
  templateDescription: string;
  baseWorkflowCode?: string;
  baseWorkflowName?: string;
  steps: WorkflowStep[];
  workflowConfig: Record<string, unknown>;
  category: string;
  tags: string[];
  isShared: boolean;
  isPublic: boolean;
  timesUsed: number;
  avgQualityScore?: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface SystemWorkflow {
  workflowId: string;
  workflowCode: string;
  commonName: string;
  formalName: string;
  category: string;
  description: string;
  qualityImprovement: string;
  typicalLatency: string;
  typicalCost: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  adversarial: 'bg-red-500/10 text-red-500',
  debate: 'bg-indigo-500/10 text-indigo-500',
  judge: 'bg-amber-500/10 text-amber-500',
  ensemble: 'bg-purple-500/10 text-purple-500',
  reflection: 'bg-cyan-500/10 text-cyan-500',
  verification: 'bg-orange-500/10 text-orange-500',
  collaboration: 'bg-violet-500/10 text-violet-500',
  reasoning: 'bg-blue-500/10 text-blue-500',
  routing: 'bg-green-500/10 text-green-500',
  domain: 'bg-pink-500/10 text-pink-500',
  cognitive: 'bg-teal-500/10 text-teal-500',
  custom: 'bg-gray-500/10 text-gray-500',
};

export default function WorkflowTemplatesPage() {
  const [templates, setTemplates] = useState<UserWorkflowTemplate[]>([]);
  const [systemWorkflows, setSystemWorkflows] = useState<SystemWorkflow[]>([]);
  const [methods, setMethods] = useState<WorkflowMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<UserWorkflowTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editMode, setEditMode] = useState(false);
  const [editedSteps, setEditedSteps] = useState<WorkflowStep[]>([]);
  const [saving, setSaving] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [selectedBaseWorkflow, setSelectedBaseWorkflow] = useState<string>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesRes, workflowsRes, methodsRes] = await Promise.all([
        fetch('/api/admin/orchestration/user-templates'),
        fetch('/api/admin/orchestration/workflows'),
        fetch('/api/admin/orchestration/methods'),
      ]);

      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data.templates || []);
      } else {
        console.warn('Templates API not available');
        setTemplates([]);
      }

      if (workflowsRes.ok) {
        const data = await workflowsRes.json();
        setSystemWorkflows(data.workflows || []);
      }

      if (methodsRes.ok) {
        const data = await methodsRes.json();
        setMethods(data.methods || []);
      } else {
        console.warn('Methods API not available');
        setMethods([]);
      }
    } catch (err) {
      console.error('Failed to load workflow templates', err);
      setTemplates([]);
      setMethods([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectTemplate = (template: UserWorkflowTemplate) => {
    setSelectedTemplate(template);
    setEditedSteps([...template.steps]);
    setEditMode(false);
  };

  const handleStepParamChange = (stepIndex: number, paramKey: string, value: unknown) => {
    setEditedSteps(prev => prev.map((step, i) => 
      i === stepIndex 
        ? { ...step, parameters: { ...step.parameters, [paramKey]: value } }
        : step
    ));
  };

  const handleToggleStepEnabled = (stepIndex: number) => {
    setEditedSteps(prev => prev.map((step, i) => 
      i === stepIndex ? { ...step, isEnabled: !step.isEnabled } : step
    ));
  };

  const handleAddStep = (methodCode: string) => {
    const method = methods.find(m => m.methodCode === methodCode);
    if (!method) return;

    const newStep: WorkflowStep = {
      stepOrder: editedSteps.length + 1,
      methodCode: method.methodCode,
      displayName: method.displayName,
      parameters: { ...method.defaultParameters },
      isEnabled: true,
    };
    setEditedSteps(prev => [...prev, newStep]);
  };

  const handleRemoveStep = (stepIndex: number) => {
    setEditedSteps(prev => prev.filter((_, i) => i !== stepIndex).map((step, i) => ({
      ...step,
      stepOrder: i + 1,
    })));
  };

  const handleMoveStep = (stepIndex: number, direction: 'up' | 'down') => {
    if (direction === 'up' && stepIndex === 0) return;
    if (direction === 'down' && stepIndex === editedSteps.length - 1) return;

    setEditedSteps(prev => {
      const newSteps = [...prev];
      const targetIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
      [newSteps[stepIndex], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[stepIndex]];
      return newSteps.map((step, i) => ({ ...step, stepOrder: i + 1 }));
    });
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orchestration/user-templates/${selectedTemplate.templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: editedSteps }),
      });
      if (res.ok) {
        setTemplates(prev => prev.map(t => 
          t.templateId === selectedTemplate.templateId 
            ? { ...t, steps: editedSteps, updatedAt: new Date().toISOString() }
            : t
        ));
        setSelectedTemplate(prev => prev ? { ...prev, steps: editedSteps } : null);
        setEditMode(false);
      }
    } catch (err) {
      console.error('Failed to save template', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName) return;
    setSaving(true);
    try {
      const baseWorkflow = systemWorkflows.find(w => w.workflowCode === selectedBaseWorkflow);
      
      const newTemplate: UserWorkflowTemplate = {
        templateId: `template_${Date.now()}`,
        templateName: newTemplateName,
        templateDescription: newTemplateDescription,
        baseWorkflowCode: selectedBaseWorkflow || undefined,
        baseWorkflowName: baseWorkflow?.commonName,
        steps: [],
        workflowConfig: {},
        category: baseWorkflow?.category || 'custom',
        tags: [],
        isShared: false,
        isPublic: false,
        timesUsed: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const res = await fetch('/api/admin/orchestration/user-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      });

      if (res.ok) {
        const data = await res.json();
        setTemplates(prev => [...prev, data.template || newTemplate]);
      } else {
        setTemplates(prev => [...prev, newTemplate]);
      }

      setShowCreateDialog(false);
      setNewTemplateName('');
      setNewTemplateDescription('');
      setSelectedBaseWorkflow('');
    } catch (err) {
      console.error('Failed to create template', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      await fetch(`/api/admin/orchestration/user-templates/${templateId}`, {
        method: 'DELETE',
      });
      setTemplates(prev => prev.filter(t => t.templateId !== templateId));
      if (selectedTemplate?.templateId === templateId) {
        setSelectedTemplate(null);
      }
    } catch (err) {
      console.error('Failed to delete template', err);
    }
  };

  const handleDuplicateTemplate = async (template: UserWorkflowTemplate) => {
    const duplicate: UserWorkflowTemplate = {
      ...template,
      templateId: `template_${Date.now()}`,
      templateName: `${template.templateName} (Copy)`,
      timesUsed: 0,
      isShared: false,
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTemplates(prev => [...prev, duplicate]);
  };

  const handleToggleShare = async (template: UserWorkflowTemplate) => {
    try {
      await fetch(`/api/admin/orchestration/user-templates/${template.templateId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isShared: !template.isShared }),
      });
      setTemplates(prev => prev.map(t => 
        t.templateId === template.templateId ? { ...t, isShared: !t.isShared } : t
      ));
    } catch (err) {
      console.error('Failed to toggle share', err);
    }
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.templateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         t.templateDescription?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(templates.map(t => t.category)));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Workflow Templates</h1>
          <p className="text-muted-foreground">
            Create and customize your own AI orchestration workflows with custom method parameters
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Workflow Template</DialogTitle>
                <DialogDescription>
                  Create a new custom workflow template. You can start from scratch or base it on an existing system workflow.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="My Custom Workflow"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newTemplateDescription}
                    onChange={(e) => setNewTemplateDescription(e.target.value)}
                    placeholder="Describe what this workflow does..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="base">Base on System Workflow (Optional)</Label>
                  <select
                    id="base"
                    className="w-full p-2 border rounded-md text-sm"
                    value={selectedBaseWorkflow}
                    onChange={(e) => setSelectedBaseWorkflow(e.target.value)}
                  >
                    <option value="">Start from scratch</option>
                    {systemWorkflows.map(w => (
                      <option key={w.workflowCode} value={w.workflowCode}>
                        {w.commonName} ({w.workflowCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTemplate} disabled={!newTemplateName || saving}>
                  {saving ? 'Creating...' : 'Create Template'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Templates</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
            <p className="text-xs text-muted-foreground">
              {templates.filter(t => t.isShared).length} shared
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Uses</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {templates.reduce((sum, t) => sum + t.timesUsed, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all templates
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Methods</CardTitle>
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{methods.length}</div>
            <p className="text-xs text-muted-foreground">
              Reusable workflow steps
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Workflows</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemWorkflows.length}</div>
            <p className="text-xs text-muted-foreground">
              Available as base templates
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Templates List */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Your Templates</CardTitle>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="flex gap-1 flex-wrap pt-2">
                <Badge 
                  variant={categoryFilter === 'all' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setCategoryFilter('all')}
                >
                  All
                </Badge>
                {categories.map(cat => (
                  <Badge
                    key={cat}
                    variant={categoryFilter === cat ? 'default' : 'outline'}
                    className={`cursor-pointer ${categoryFilter === cat ? '' : CATEGORY_COLORS[cat] || CATEGORY_COLORS.custom}`}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {cat}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-auto">
              <div className="space-y-2">
                {filteredTemplates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No templates yet</p>
                    <p className="text-xs">Create your first workflow template</p>
                  </div>
                ) : (
                  filteredTemplates.map(template => (
                    <div
                      key={template.templateId}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTemplate?.templateId === template.templateId
                          ? 'bg-accent border-primary'
                          : 'hover:bg-accent/50'
                      }`}
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4" />
                          <span className="font-medium text-sm">{template.templateName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {template.isShared && <Share2 className="h-3 w-3 text-blue-500" />}
                          {template.isPublic && <Globe className="h-3 w-3 text-green-500" />}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {template.templateDescription || 'No description'}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[template.category] || CATEGORY_COLORS.custom}`}>
                          {template.category}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {template.steps.length} steps
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {template.timesUsed} uses
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Template Details */}
        <div className="lg:col-span-2">
          {selectedTemplate ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5" />
                      {selectedTemplate.templateName}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {selectedTemplate.baseWorkflowCode && (
                        <span className="text-xs">Based on: {selectedTemplate.baseWorkflowName}</span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleShare(selectedTemplate)}
                      title={selectedTemplate.isShared ? 'Stop sharing' : 'Share with team'}
                    >
                      {selectedTemplate.isShared ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDuplicateTemplate(selectedTemplate)}
                      title="Duplicate"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteTemplate(selectedTemplate.templateId)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    {editMode ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveTemplate} disabled={saving}>
                          <Save className="h-4 w-4 mr-2" />
                          {saving ? 'Saving...' : 'Save'}
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={() => setEditMode(true)}>
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="steps" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="steps">Steps ({editedSteps.length})</TabsTrigger>
                    <TabsTrigger value="methods">Add Methods</TabsTrigger>
                    <TabsTrigger value="config">Config</TabsTrigger>
                  </TabsList>

                  <TabsContent value="steps" className="space-y-4">
                    {selectedTemplate.templateDescription && (
                      <p className="text-sm text-muted-foreground">{selectedTemplate.templateDescription}</p>
                    )}
                    
                    {editedSteps.length === 0 ? (
                      <div className="text-center py-8 border-2 border-dashed rounded-lg">
                        <Settings2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-muted-foreground">No steps defined</p>
                        <p className="text-xs text-muted-foreground">Add methods from the &quot;Add Methods&quot; tab</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {editedSteps.map((step, index) => (
                          <div 
                            key={`${step.methodCode}-${index}`}
                            className={`border rounded-lg p-4 ${!step.isEnabled ? 'opacity-50' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              {editMode && (
                                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                              )}
                              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                                {step.stepOrder}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{step.displayName}</span>
                                  <code className="text-xs bg-muted px-1 py-0.5 rounded">{step.methodCode}</code>
                                </div>
                              </div>
                              {editMode && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleMoveStep(index, 'up')}
                                    disabled={index === 0}
                                  >
                                    <ChevronDown className="h-4 w-4 rotate-180" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleMoveStep(index, 'down')}
                                    disabled={index === editedSteps.length - 1}
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                  <Switch
                                    checked={step.isEnabled}
                                    onCheckedChange={() => handleToggleStepEnabled(index)}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveStep(index)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            
                            {editMode && Object.keys(step.parameters).length > 0 && (
                              <div className="mt-4 pl-9 space-y-3">
                                {Object.entries(step.parameters).map(([key, value]) => (
                                  <div key={key} className="flex items-center gap-4">
                                    <Label className="w-32 text-sm capitalize">
                                      {key.replace(/_/g, ' ')}
                                    </Label>
                                    {typeof value === 'boolean' ? (
                                      <Switch
                                        checked={value}
                                        onCheckedChange={(v) => handleStepParamChange(index, key, v)}
                                      />
                                    ) : typeof value === 'number' ? (
                                      <div className="flex items-center gap-2 flex-1">
                                        <Slider
                                          value={[value]}
                                          onValueChange={([v]) => handleStepParamChange(index, key, v)}
                                          max={key.includes('temperature') ? 2 : 100}
                                          min={0}
                                          step={key.includes('temperature') ? 0.1 : 1}
                                          className="flex-1"
                                        />
                                        <span className="text-sm w-12 text-right">{value}</span>
                                      </div>
                                    ) : (
                                      <Input
                                        value={String(value)}
                                        onChange={(e) => handleStepParamChange(index, key, e.target.value)}
                                        className="flex-1"
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="methods" className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Select methods to add as steps in your workflow. Each method can be customized with its own parameters.
                    </p>
                    <div className="grid gap-2 max-h-[400px] overflow-auto">
                      {methods.map(method => (
                        <div
                          key={method.methodCode}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{method.displayName}</span>
                              <Badge variant="outline" className="text-xs">
                                {method.methodCategory}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {method.description}
                            </p>
                            {method.scientificName && (
                              <p className="text-xs text-muted-foreground italic">
                                {method.scientificName}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddStep(method.methodCode)}
                            disabled={!editMode}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="config" className="space-y-4">
                    <div className="border rounded-lg p-4 space-y-4">
                      <h4 className="font-medium">Template Settings</h4>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label>Category</Label>
                          <Input value={selectedTemplate.category} disabled />
                        </div>
                        <div className="space-y-2">
                          <Label>Tags</Label>
                          <Input value={selectedTemplate.tags.join(', ')} placeholder="No tags" disabled />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Share with Team</Label>
                            <p className="text-xs text-muted-foreground">Allow others in your organization to use this template</p>
                          </div>
                          <Switch checked={selectedTemplate.isShared} />
                        </div>
                      </div>
                    </div>
                    <div className="border rounded-lg p-4 space-y-2">
                      <h4 className="font-medium">Usage Statistics</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Times Used:</span>
                          <span className="ml-2 font-medium">{selectedTemplate.timesUsed}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Quality:</span>
                          <span className="ml-2 font-medium">
                            {selectedTemplate.avgQualityScore 
                              ? `${(selectedTemplate.avgQualityScore * 100).toFixed(0)}%` 
                              : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Created:</span>
                          <span className="ml-2 font-medium">
                            {new Date(selectedTemplate.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Last Used:</span>
                          <span className="ml-2 font-medium">
                            {selectedTemplate.lastUsedAt 
                              ? new Date(selectedTemplate.lastUsedAt).toLocaleDateString() 
                              : 'Never'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Layers className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Select a Template</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mt-2">
                  Choose a template from the list to view and edit its steps and parameters, or create a new one.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

