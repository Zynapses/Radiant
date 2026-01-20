'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Save, Trash2, Copy, Search, ChevronRight, Layers, RefreshCw, Share2, Lock, Globe, Edit3 } from 'lucide-react';
import { toast } from 'sonner';

interface WorkflowStep { stepOrder: number; methodCode: string; displayName: string; parameters: Record<string, unknown>; isEnabled: boolean; }
interface UserWorkflowTemplate { templateId: string; templateName: string; templateDescription: string; baseWorkflowCode?: string; baseWorkflowName?: string; steps: WorkflowStep[]; category: string; tags: string[]; isShared: boolean; isPublic: boolean; timesUsed: number; createdAt: string; updatedAt: string; }
interface SystemWorkflow { workflowCode: string; commonName: string; category: string; description: string; }

const CATEGORY_COLORS: Record<string, string> = { adversarial: 'bg-red-500/10 text-red-500', debate: 'bg-indigo-500/10 text-indigo-500', ensemble: 'bg-purple-500/10 text-purple-500', reflection: 'bg-cyan-500/10 text-cyan-500', verification: 'bg-orange-500/10 text-orange-500', reasoning: 'bg-blue-500/10 text-blue-500', custom: 'bg-gray-500/10 text-gray-500' };

export default function WorkflowTemplatesPage() {
  const [templates, setTemplates] = useState<UserWorkflowTemplate[]>([]);
  const [systemWorkflows, setSystemWorkflows] = useState<SystemWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<UserWorkflowTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editMode, setEditMode] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [selectedBaseWorkflow, setSelectedBaseWorkflow] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesData, workflowsData] = await Promise.all([
        api.get<{ templates: UserWorkflowTemplate[] }>('/api/admin/orchestration/user-templates').catch(() => ({ templates: [] })),
        api.get<{ workflows: SystemWorkflow[] }>('/api/admin/orchestration/workflows').catch(() => ({ workflows: [] })),
      ]);
      setTemplates(templatesData.templates || []);
      setSystemWorkflows(workflowsData.workflows || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSelectTemplate = (template: UserWorkflowTemplate) => { setSelectedTemplate(template); setEditMode(false); };

  const handleCreateTemplate = async () => {
    if (!newTemplateName) return;
    setSaving(true);
    try {
      const baseWorkflow = systemWorkflows.find(w => w.workflowCode === selectedBaseWorkflow);
      const newTemplate: UserWorkflowTemplate = { templateId: `template_${Date.now()}`, templateName: newTemplateName, templateDescription: newTemplateDescription, baseWorkflowCode: selectedBaseWorkflow || undefined, baseWorkflowName: baseWorkflow?.commonName, steps: [], category: baseWorkflow?.category || 'custom', tags: [], isShared: false, isPublic: false, timesUsed: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const res = await api.post<{ template: UserWorkflowTemplate }>('/api/admin/orchestration/user-templates', newTemplate);
      setTemplates(prev => [...prev, res.template || newTemplate]);
      setShowCreateDialog(false);
      setNewTemplateName('');
      setNewTemplateDescription('');
      setSelectedBaseWorkflow('');
      toast.success('Template created');
    } catch { toast.error('Failed to create template'); } finally { setSaving(false); }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await api.delete(`/api/admin/orchestration/user-templates/${templateId}`);
      setTemplates(prev => prev.filter(t => t.templateId !== templateId));
      if (selectedTemplate?.templateId === templateId) setSelectedTemplate(null);
      toast.success('Template deleted');
    } catch { toast.error('Failed to delete template'); }
  };

  const handleDuplicateTemplate = (template: UserWorkflowTemplate) => {
    const duplicate: UserWorkflowTemplate = { ...template, templateId: `template_${Date.now()}`, templateName: `${template.templateName} (Copy)`, timesUsed: 0, isShared: false, isPublic: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setTemplates(prev => [...prev, duplicate]);
    toast.success('Template duplicated');
  };

  const handleToggleShare = async (template: UserWorkflowTemplate) => {
    try {
      await api.post(`/api/admin/orchestration/user-templates/${template.templateId}/share`, { isShared: !template.isShared });
      setTemplates(prev => prev.map(t => t.templateId === template.templateId ? { ...t, isShared: !t.isShared } : t));
      toast.success(template.isShared ? 'Stopped sharing' : 'Template shared');
    } catch { toast.error('Failed to toggle share'); }
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.templateName.toLowerCase().includes(searchQuery.toLowerCase()) || t.templateDescription?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(templates.map(t => t.category)));

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight">User Workflow Templates</h1><p className="text-muted-foreground">Create and customize your own AI orchestration workflows</p></div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline" size="sm"><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />New Template</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Workflow Template</DialogTitle><DialogDescription>Create a new custom workflow template.</DialogDescription></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2"><Label htmlFor="name">Template Name</Label><Input id="name" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="My Custom Workflow" /></div>
                <div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" value={newTemplateDescription} onChange={(e) => setNewTemplateDescription(e.target.value)} placeholder="Describe what this workflow does..." /></div>
                <div className="space-y-2"><Label htmlFor="base">Base on System Workflow (Optional)</Label><select id="base" className="w-full p-2 border rounded-md text-sm" value={selectedBaseWorkflow} onChange={(e) => setSelectedBaseWorkflow(e.target.value)}><option value="">Start from scratch</option>{systemWorkflows.map(w => <option key={w.workflowCode} value={w.workflowCode}>{w.commonName} ({w.workflowCode})</option>)}</select></div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button><Button onClick={handleCreateTemplate} disabled={!newTemplateName || saving}>{saving ? 'Creating...' : 'Create Template'}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Your Templates</CardTitle><Layers className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{templates.length}</div><p className="text-xs text-muted-foreground">{templates.filter(t => t.isShared).length} shared</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Uses</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{templates.reduce((sum, t) => sum + t.timesUsed, 0)}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Categories</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{categories.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">System Workflows</CardTitle><Globe className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{systemWorkflows.length}</div><p className="text-xs text-muted-foreground">Available as base templates</p></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Your Templates</CardTitle>
              <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search templates..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8" /></div>
              <div className="flex gap-1 flex-wrap pt-2">
                <Badge variant={categoryFilter === 'all' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setCategoryFilter('all')}>All</Badge>
                {categories.map(cat => <Badge key={cat} variant={categoryFilter === cat ? 'default' : 'outline'} className={`cursor-pointer ${categoryFilter === cat ? '' : CATEGORY_COLORS[cat] || CATEGORY_COLORS.custom}`} onClick={() => setCategoryFilter(cat)}>{cat}</Badge>)}
              </div>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-auto">
              <div className="space-y-2">
                {filteredTemplates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground"><Layers className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>No templates yet</p></div>
                ) : (
                  filteredTemplates.map(template => (
                    <div key={template.templateId} className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedTemplate?.templateId === template.templateId ? 'bg-accent border-primary' : 'hover:bg-accent/50'}`} onClick={() => handleSelectTemplate(template)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><Layers className="h-4 w-4" /><span className="font-medium text-sm">{template.templateName}</span></div>
                        <div className="flex items-center gap-1">{template.isShared && <Share2 className="h-3 w-3 text-blue-500" />}{template.isPublic && <Globe className="h-3 w-3 text-green-500" />}<ChevronRight className="h-4 w-4 text-muted-foreground" /></div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.templateDescription || 'No description'}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[template.category] || CATEGORY_COLORS.custom}`}>{template.category}</Badge>
                        <Badge variant="outline" className="text-xs">{template.steps.length} steps</Badge>
                        <Badge variant="outline" className="text-xs">{template.timesUsed} uses</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedTemplate ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div><CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" />{selectedTemplate.templateName}</CardTitle>{selectedTemplate.baseWorkflowCode && <CardDescription className="mt-1 text-xs">Based on: {selectedTemplate.baseWorkflowName}</CardDescription>}</div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleToggleShare(selectedTemplate)} title={selectedTemplate.isShared ? 'Stop sharing' : 'Share'}>{selectedTemplate.isShared ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}</Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDuplicateTemplate(selectedTemplate)} title="Duplicate"><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteTemplate(selectedTemplate.templateId)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                    <Button size="sm" onClick={() => setEditMode(!editMode)}><Edit3 className="h-4 w-4 mr-2" />{editMode ? 'View' : 'Edit'}</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{selectedTemplate.templateDescription || 'No description'}</p>
                <div className="space-y-3">
                  {selectedTemplate.steps.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg"><Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground" /><p className="text-muted-foreground">No steps defined</p></div>
                  ) : (
                    selectedTemplate.steps.map((step, index) => (
                      <div key={`${step.methodCode}-${index}`} className={`border rounded-lg p-4 ${!step.isEnabled ? 'opacity-50' : ''}`}>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">{step.stepOrder}</div>
                          <div className="flex-1"><div className="flex items-center gap-2"><span className="font-medium">{step.displayName}</span><code className="text-xs bg-muted px-1 py-0.5 rounded">{step.methodCode}</code></div></div>
                          {!step.isEnabled && <Badge variant="secondary">Disabled</Badge>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-16 text-center text-muted-foreground"><Layers className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Select a template to view details</p></CardContent></Card>
          )}
        </div>
      </div>
    </div>
  );
}
