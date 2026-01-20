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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Shield,
  BookOpen,
  AlignLeft,
  MessageSquare,
  Eye,
  Tag,
  Settings,
  Heart,
  Ban,
  MoreHorizontal,
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap,
  Star,
  ChevronRight,
  Info,
  GraduationCap,
  Calendar,
  List,
  Heading,
  Code,
  Briefcase,
  Smile,
  Lightbulb,
  HelpCircle,
  MessageCircle,
  Scale,
  DollarSign,
} from 'lucide-react';

// Types
interface UserRule {
  id: string;
  ruleText: string;
  ruleSummary?: string;
  ruleType: string;
  priority: number;
  source: string;
  presetId?: string;
  isActive: boolean;
  timesApplied: number;
  createdAt: string;
}

interface PresetRule {
  id: string;
  ruleText: string;
  ruleSummary: string;
  description?: string;
  ruleType: string;
  category: string;
  icon?: string;
  isPopular: boolean;
}

interface PresetCategory {
  name: string;
  icon: string;
  description: string;
  rules: PresetRule[];
}

// Icon mapping
const ICON_MAP: Record<string, React.ElementType> = {
  Shield,
  BookOpen,
  AlignLeft,
  MessageSquare,
  Eye,
  Tag,
  Settings,
  Heart,
  Ban,
  MoreHorizontal,
  GraduationCap,
  Calendar,
  List,
  Heading,
  Code,
  Briefcase,
  Smile,
  Lightbulb,
  HelpCircle,
  MessageCircle,
  Scale,
  DollarSign,
};

const RULE_TYPE_ICONS: Record<string, React.ElementType> = {
  restriction: Ban,
  preference: Heart,
  format: AlignLeft,
  source: BookOpen,
  tone: MessageSquare,
  topic: Tag,
  privacy: Shield,
  accessibility: Eye,
  other: MoreHorizontal,
};

const RULE_TYPE_LABELS: Record<string, string> = {
  restriction: 'Restriction',
  preference: 'Preference',
  format: 'Response Format',
  source: 'Sources & Citations',
  tone: 'Tone & Style',
  topic: 'Topic Rules',
  privacy: 'Privacy',
  accessibility: 'Accessibility',
  other: 'Other',
};

// API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';


export function MyRulesClient() {
  const [activeTab, setActiveTab] = useState('my-rules');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<UserRule | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [newRule, setNewRule] = useState({
    ruleText: '',
    ruleSummary: '',
    ruleType: 'preference',
  });
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery<UserRule[]>({
    queryKey: ['user-rules'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/thinktank/user-rules`);
      if (!res.ok) throw new Error('Failed to fetch user rules');
      const { data } = await res.json();
      return data ?? [];
    },
  });

  const { data: presetCategories = [] } = useQuery<PresetCategory[]>({
    queryKey: ['preset-rules'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/thinktank/user-rules/presets`);
      if (!res.ok) throw new Error('Failed to fetch preset rules');
      const { data } = await res.json();
      return data ?? [];
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: async (data: typeof newRule) => {
      const res = await fetch(`${API_BASE}/api/thinktank/user-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create rule');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-rules'] });
      setShowAddDialog(false);
      setNewRule({ ruleText: '', ruleSummary: '', ruleType: 'preference' });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => {
      const res = await fetch(`${API_BASE}/api/thinktank/user-rules/${ruleId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('Failed to toggle rule');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-rules'] });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const res = await fetch(`${API_BASE}/api/thinktank/user-rules/${ruleId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete rule');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-rules'] });
      setShowDeleteDialog(false);
      setDeletingRuleId(null);
    },
  });

  const addPresetMutation = useMutation({
    mutationFn: async (presetId: string) => {
      const res = await fetch(`${API_BASE}/api/thinktank/user-rules/add-preset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetId }),
      });
      if (!res.ok) throw new Error('Failed to add preset');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-rules'] });
    },
  });

  const activeRules = rules.filter(r => r.isActive);
  const totalTimesApplied = rules.reduce((sum, r) => sum + r.timesApplied, 0);
  const popularPresets = presetCategories.flatMap(c => c.rules).filter(r => r.isPopular);

  // Check if a preset is already added
  const isPresetAdded = (presetId: string) => {
    return rules.some(r => r.presetId === presetId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-purple-600" />
              My Rules
            </h1>
            <p className="text-muted-foreground">
              Set personal preferences for how Think Tank responds to you
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Custom Rule
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Rules</p>
                  <p className="text-2xl font-bold">{activeRules.length}</p>
                </div>
                <Check className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Rules</p>
                  <p className="text-2xl font-bold">{rules.length}</p>
                </div>
                <Settings className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Times Applied</p>
                  <p className="text-2xl font-bold">{totalTimesApplied}</p>
                </div>
                <Zap className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="my-rules">My Rules ({rules.length})</TabsTrigger>
            <TabsTrigger value="add-presets">Add from Presets</TabsTrigger>
          </TabsList>

          {/* My Rules Tab */}
          <TabsContent value="my-rules" className="space-y-4">
            {rules.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No rules yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Add rules to customize how Think Tank responds to you
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={() => setShowAddDialog(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Custom Rule
                    </Button>
                    <Button variant="outline" onClick={() => setActiveTab('add-presets')}>
                      Browse Presets
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => {
                  const TypeIcon = RULE_TYPE_ICONS[rule.ruleType] || MoreHorizontal;
                  return (
                    <Card key={rule.id} className={!rule.isActive ? 'opacity-60' : ''}>
                      <CardContent className="py-4">
                        <div className="flex items-start gap-4">
                          <div className={`p-2 rounded-lg ${rule.isActive ? 'bg-primary/10' : 'bg-muted'}`}>
                            <TypeIcon className={`h-5 w-5 ${rule.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{rule.ruleSummary || 'Custom Rule'}</span>
                              <Badge variant="outline" className="text-xs">
                                {RULE_TYPE_LABELS[rule.ruleType]}
                              </Badge>
                              {rule.source === 'preset_added' && (
                                <Badge variant="secondary" className="text-xs">Preset</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {rule.ruleText}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Applied {rule.timesApplied} times
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={rule.isActive}
                                    onCheckedChange={(checked) => 
                                      toggleRuleMutation.mutate({ ruleId: rule.id, isActive: checked })
                                    }
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {rule.isActive ? 'Disable rule' : 'Enable rule'}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingRule(rule)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => {
                                    setDeletingRuleId(rule.id);
                                    setShowDeleteDialog(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Add from Presets Tab */}
          <TabsContent value="add-presets" className="space-y-6">
            {/* Popular Presets */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500" />
                  Popular Rules
                </CardTitle>
                <CardDescription>
                  Most commonly used rules by Think Tank users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {popularPresets.map((preset) => {
                    const PresetIcon = ICON_MAP[preset.icon || ''] || MoreHorizontal;
                    const alreadyAdded = isPresetAdded(preset.id);
                    return (
                      <div
                        key={preset.id}
                        className={`p-4 border rounded-lg ${alreadyAdded ? 'bg-muted/50' : 'hover:bg-muted/30 cursor-pointer'}`}
                        onClick={() => !alreadyAdded && addPresetMutation.mutate(preset.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <PresetIcon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{preset.ruleSummary}</span>
                              {alreadyAdded && (
                                <Badge variant="secondary" className="text-xs">Added</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {preset.description}
                            </p>
                          </div>
                          {!alreadyAdded && (
                            <Button size="sm" variant="ghost">
                              <Plus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* All Categories */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">All Categories</h3>
              {presetCategories.map((category) => {
                const CategoryIcon = ICON_MAP[category.icon] || Settings;
                const isExpanded = expandedCategory === category.name;
                const addedCount = category.rules.filter(r => isPresetAdded(r.id)).length;
                
                return (
                  <Card key={category.name}>
                    <CardHeader
                      className="cursor-pointer"
                      onClick={() => setExpandedCategory(isExpanded ? null : category.name)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <CategoryIcon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{category.name}</CardTitle>
                            <CardDescription className="text-sm">
                              {category.description}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {addedCount}/{category.rules.length} added
                          </Badge>
                          <ChevronRight className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </div>
                      </div>
                    </CardHeader>
                    {isExpanded && (
                      <CardContent className="pt-0">
                        <div className="space-y-3 border-t pt-4">
                          {category.rules.map((preset) => {
                            const PresetIcon = ICON_MAP[preset.icon || ''] || MoreHorizontal;
                            const alreadyAdded = isPresetAdded(preset.id);
                            return (
                              <div
                                key={preset.id}
                                className={`p-3 border rounded-lg ${alreadyAdded ? 'bg-muted/50' : 'hover:bg-muted/30'}`}
                              >
                                <div className="flex items-start gap-3">
                                  <PresetIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">{preset.ruleSummary}</span>
                                      {alreadyAdded && (
                                        <Check className="h-4 w-4 text-green-500" />
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {preset.ruleText}
                                    </p>
                                  </div>
                                  {!alreadyAdded && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addPresetMutation.mutate(preset.id);
                                      }}
                                    >
                                      <Plus className="h-4 w-4 mr-1" />
                                      Add
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* Add Custom Rule Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Custom Rule</DialogTitle>
              <DialogDescription>
                Create a personal rule for how Think Tank should respond to you
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Rule Type</Label>
                <Select
                  value={newRule.ruleType}
                  onValueChange={(v) => setNewRule({ ...newRule, ruleType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RULE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Short Summary</Label>
                <Input
                  placeholder="e.g., Always cite sources"
                  value={newRule.ruleSummary}
                  onChange={(e) => setNewRule({ ...newRule, ruleSummary: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Full Rule Text</Label>
                <Textarea
                  placeholder="Describe the rule in detail. For example: Always provide sources and citations for factual claims..."
                  value={newRule.ruleText}
                  onChange={(e) => setNewRule({ ...newRule, ruleText: e.target.value })}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Be specific about what you want. The AI will follow this rule in all conversations.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createRuleMutation.mutate(newRule)}
                disabled={!newRule.ruleText.trim()}
              >
                Add Rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Rule</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this rule? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground"
                onClick={() => deletingRuleId && deleteRuleMutation.mutate(deletingRuleId)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium">How Rules Work</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your rules are automatically applied to every conversation in Think Tank. 
                  They help the AI understand your preferences and provide responses tailored to you.
                  Rules are organized by priority - restrictions are always enforced first.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
