'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Shield, BookOpen, AlignLeft, MessageSquare, Tag, Settings, Heart, Ban, MoreHorizontal, Plus, Trash2, Check, Loader2, Sparkles, Zap, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface UserRule { id: string; ruleText: string; ruleSummary?: string; ruleType: string; priority: number; source: string; presetId?: string; isActive: boolean; timesApplied: number; createdAt: string; }
interface PresetRule { id: string; ruleText: string; ruleSummary: string; description?: string; ruleType: string; category: string; isPopular: boolean; }
interface PresetCategory { name: string; icon: string; description: string; rules: PresetRule[]; }

const RULE_TYPE_ICONS: Record<string, React.ElementType> = { restriction: Ban, preference: Heart, format: AlignLeft, source: BookOpen, tone: MessageSquare, topic: Tag, privacy: Shield, other: MoreHorizontal };
const RULE_TYPE_LABELS: Record<string, string> = { restriction: 'Restriction', preference: 'Preference', format: 'Response Format', source: 'Sources & Citations', tone: 'Tone & Style', topic: 'Topic Rules', privacy: 'Privacy', other: 'Other' };

export default function MyRulesPage() {
  const [activeTab, setActiveTab] = useState('my-rules');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [newRule, setNewRule] = useState({ ruleText: '', ruleSummary: '', ruleType: 'preference' });
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery<UserRule[]>({
    queryKey: ['user-rules'],
    queryFn: async () => { const res = await api.get<{ data: UserRule[] }>('/api/thinktank/user-rules'); return res.data ?? []; },
  });

  const { data: presetCategories = [] } = useQuery<PresetCategory[]>({
    queryKey: ['preset-rules'],
    queryFn: async () => { const res = await api.get<{ data: PresetCategory[] }>('/api/thinktank/user-rules/presets'); return res.data ?? []; },
  });

  const createRuleMutation = useMutation({
    mutationFn: (data: typeof newRule) => api.post('/api/thinktank/user-rules', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['user-rules'] }); setShowAddDialog(false); setNewRule({ ruleText: '', ruleSummary: '', ruleType: 'preference' }); toast.success('Rule created'); },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => api.patch(`/api/thinktank/user-rules/${ruleId}/toggle`, { isActive }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['user-rules'] }); },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: string) => api.delete(`/api/thinktank/user-rules/${ruleId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['user-rules'] }); setShowDeleteDialog(false); setDeletingRuleId(null); toast.success('Rule deleted'); },
  });

  const addPresetMutation = useMutation({
    mutationFn: (presetId: string) => api.post('/api/thinktank/user-rules/add-preset', { presetId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['user-rules'] }); toast.success('Preset added'); },
  });

  const activeRules = rules.filter(r => r.isActive);
  const totalTimesApplied = rules.reduce((sum, r) => sum + r.timesApplied, 0);
  const isPresetAdded = (presetId: string) => rules.some(r => r.presetId === presetId);

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Sparkles className="h-8 w-8 text-purple-600" />My Rules</h1><p className="text-muted-foreground">Set personal preferences for how Think Tank responds to you</p></div>
        <Button onClick={() => setShowAddDialog(true)}><Plus className="mr-2 h-4 w-4" />Add Custom Rule</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Active Rules</p><p className="text-2xl font-bold">{activeRules.length}</p></div><Check className="h-8 w-8 text-green-500" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total Rules</p><p className="text-2xl font-bold">{rules.length}</p></div><Settings className="h-8 w-8 text-blue-500" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Times Applied</p><p className="text-2xl font-bold">{totalTimesApplied}</p></div><Zap className="h-8 w-8 text-amber-500" /></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList><TabsTrigger value="my-rules">My Rules ({rules.length})</TabsTrigger><TabsTrigger value="add-presets">Add from Presets</TabsTrigger></TabsList>

        <TabsContent value="my-rules" className="space-y-4">
          {rules.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><h3 className="text-lg font-medium mb-2">No rules yet</h3><p className="text-muted-foreground mb-4">Add rules to customize how Think Tank responds to you</p><div className="flex gap-2 justify-center"><Button onClick={() => setShowAddDialog(true)}><Plus className="mr-2 h-4 w-4" />Add Custom Rule</Button><Button variant="outline" onClick={() => setActiveTab('add-presets')}>Browse Presets</Button></div></CardContent></Card>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => {
                const TypeIcon = RULE_TYPE_ICONS[rule.ruleType] || MoreHorizontal;
                return (
                  <Card key={rule.id} className={!rule.isActive ? 'opacity-60' : ''}>
                    <CardContent className="py-4">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${rule.isActive ? 'bg-primary/10' : 'bg-muted'}`}><TypeIcon className={`h-5 w-5 ${rule.isActive ? 'text-primary' : 'text-muted-foreground'}`} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1"><span className="font-medium">{rule.ruleSummary || 'Custom Rule'}</span><Badge variant="outline" className="text-xs">{RULE_TYPE_LABELS[rule.ruleType]}</Badge>{rule.source === 'preset_added' && <Badge variant="secondary" className="text-xs">Preset</Badge>}</div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{rule.ruleText}</p>
                          <p className="text-xs text-muted-foreground mt-2">Applied {rule.timesApplied} times</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={rule.isActive} onCheckedChange={(checked) => toggleRuleMutation.mutate({ ruleId: rule.id, isActive: checked })} />
                          <Button variant="ghost" size="icon" onClick={() => { setDeletingRuleId(rule.id); setShowDeleteDialog(true); }}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="add-presets" className="space-y-4">
          {presetCategories.map((category) => (
            <Card key={category.name}>
              <CardHeader className="cursor-pointer" onClick={() => setExpandedCategory(expandedCategory === category.name ? null : category.name)}>
                <div className="flex items-center justify-between">
                  <div><CardTitle className="text-lg">{category.name}</CardTitle><CardDescription>{category.description}</CardDescription></div>
                  <ChevronRight className={`h-5 w-5 transition-transform ${expandedCategory === category.name ? 'rotate-90' : ''}`} />
                </div>
              </CardHeader>
              {expandedCategory === category.name && (
                <CardContent className="space-y-3">
                  {category.rules.map((preset) => (
                    <div key={preset.id} className="flex items-start gap-4 p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1"><span className="font-medium">{preset.ruleSummary}</span><Badge variant="outline" className="text-xs">{RULE_TYPE_LABELS[preset.ruleType]}</Badge>{preset.isPopular && <Badge variant="secondary" className="text-xs">Popular</Badge>}</div>
                        <p className="text-sm text-muted-foreground">{preset.description || preset.ruleText}</p>
                      </div>
                      <Button size="sm" variant={isPresetAdded(preset.id) ? 'secondary' : 'default'} disabled={isPresetAdded(preset.id) || addPresetMutation.isPending} onClick={() => addPresetMutation.mutate(preset.id)}>
                        {isPresetAdded(preset.id) ? <><Check className="h-4 w-4 mr-1" />Added</> : <><Plus className="h-4 w-4 mr-1" />Add</>}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Custom Rule</DialogTitle><DialogDescription>Create a new rule to customize AI responses</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Rule Summary</Label><Input value={newRule.ruleSummary} onChange={(e) => setNewRule({ ...newRule, ruleSummary: e.target.value })} placeholder="Brief summary of the rule" /></div>
            <div className="space-y-2"><Label>Rule Text</Label><Textarea value={newRule.ruleText} onChange={(e) => setNewRule({ ...newRule, ruleText: e.target.value })} placeholder="Detailed rule text..." rows={3} /></div>
            <div className="space-y-2"><Label>Rule Type</Label><Select value={newRule.ruleType} onValueChange={(v) => setNewRule({ ...newRule, ruleType: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(RULE_TYPE_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button><Button onClick={() => createRuleMutation.mutate(newRule)} disabled={!newRule.ruleText || createRuleMutation.isPending}>{createRuleMutation.isPending ? 'Creating...' : 'Create Rule'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Rule?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deletingRuleId && deleteRuleMutation.mutate(deletingRuleId)}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
