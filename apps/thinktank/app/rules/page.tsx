'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, Plus, Sparkles, Shield, BookOpen, Heart, Ban, 
  AlignLeft, MessageSquare, Tag, MoreHorizontal, Trash2, 
  Check, Loader2, ChevronRight, Zap, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { GlassCard } from '@/components/ui/glass-card';
import { AuroraBackground } from '@/components/ui/aurora-background';
import { rulesService } from '@/lib/api/rules';
import { cn } from '@/lib/utils';
import { useTranslation, T } from '@/lib/i18n';
// Types imported but used implicitly by react-query return types

const RULE_TYPE_ICONS: Record<string, React.ElementType> = {
  restriction: Ban,
  preference: Heart,
  format: AlignLeft,
  source: BookOpen,
  tone: MessageSquare,
  topic: Tag,
  privacy: Shield,
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
  other: 'Other',
};

export default function RulesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'my-rules' | 'presets'>('my-rules');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newRule, setNewRule] = useState({ ruleText: '', ruleSummary: '', ruleType: 'preference' });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['user-rules'],
    queryFn: () => rulesService.listRules(),
  });

  const { data: presetCategories = [] } = useQuery({
    queryKey: ['preset-rules'],
    queryFn: () => rulesService.listPresets(),
  });

  const createRuleMutation = useMutation({
    mutationFn: (data: typeof newRule) => rulesService.createRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-rules'] });
      setShowAddDialog(false);
      setNewRule({ ruleText: '', ruleSummary: '', ruleType: 'preference' });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) =>
      rulesService.toggleRule(ruleId, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-rules'] }),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: string) => rulesService.deleteRule(ruleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-rules'] }),
  });

  const addPresetMutation = useMutation({
    mutationFn: (presetId: string) => rulesService.addPreset(presetId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-rules'] }),
  });

  const activeRules = rules.filter((r) => r.isActive);
  const totalTimesApplied = rules.reduce((sum, r) => sum + r.timesApplied, 0);
  const isPresetAdded = (presetId: string) => rules.some((r) => r.presetId === presetId);

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative">
      <AuroraBackground colors="cyan" intensity="subtle" className="fixed inset-0 pointer-events-none" />
      {/* Header */}
      <header className="sticky top-0 z-10 h-14 border-b border-slate-800/50 flex items-center px-4 bg-[#0d0d14]/80 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm">{t(T.common.back)}</span>
        </Link>
        <h1 className="flex-1 text-center font-semibold text-white">{t(T.rules.title)}</h1>
        <Button onClick={() => setShowAddDialog(true)} size="sm" className="bg-violet-600 hover:bg-violet-700">
          <Plus className="h-4 w-4 mr-1" />
          {t(T.rules.addRule)}
        </Button>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <GlassCard variant="default" hoverEffect padding="md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Active Rules</p>
                <p className="text-2xl font-bold text-white">{activeRules.length}</p>
              </div>
              <Check className="h-8 w-8 text-green-500" />
            </div>
          </GlassCard>
          <GlassCard variant="default" hoverEffect padding="md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Rules</p>
                <p className="text-2xl font-bold text-white">{rules.length}</p>
              </div>
              <Settings className="h-8 w-8 text-blue-500" />
            </div>
          </GlassCard>
          <GlassCard variant="default" hoverEffect padding="md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Times Applied</p>
                <p className="text-2xl font-bold text-white">{totalTimesApplied}</p>
              </div>
              <Zap className="h-8 w-8 text-amber-500" />
            </div>
          </GlassCard>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'my-rules' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('my-rules')}
            className={activeTab === 'my-rules' ? 'bg-violet-600 hover:bg-violet-700' : 'text-slate-400'}
          >
            My Rules ({rules.length})
          </Button>
          <Button
            variant={activeTab === 'presets' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('presets')}
            className={activeTab === 'presets' ? 'bg-violet-600 hover:bg-violet-700' : 'text-slate-400'}
          >
            Add from Presets
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
          </div>
        ) : activeTab === 'my-rules' ? (
          <div className="space-y-3">
            {rules.length === 0 ? (
              <GlassCard variant="default" hoverEffect={false} padding="none">
                <CardContent className="py-12 text-center">
                  <Sparkles className="h-12 w-12 mx-auto text-slate-600 mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No rules yet</h3>
                  <p className="text-slate-400 mb-4">
                    Add rules to customize how Cato responds to you
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={() => setShowAddDialog(true)} className="bg-violet-600 hover:bg-violet-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Custom Rule
                    </Button>
                    <Button variant="outline" onClick={() => setActiveTab('presets')}>
                      Browse Presets
                    </Button>
                  </div>
                </CardContent>
              </GlassCard>
            ) : (
              rules.map((rule) => {
                const TypeIcon = RULE_TYPE_ICONS[rule.ruleType] || MoreHorizontal;
                return (
                  <motion.div
                    key={rule.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <GlassCard 
                      variant="default" 
                      hoverEffect 
                      padding="md"
                      className={cn('transition-opacity', !rule.isActive && 'opacity-60')}
                    >
                        <div className="flex items-start gap-4">
                          <div className={cn(
                            'p-2 rounded-lg',
                            rule.isActive ? 'bg-violet-500/20' : 'bg-slate-800'
                          )}>
                            <TypeIcon className={cn(
                              'h-5 w-5',
                              rule.isActive ? 'text-violet-400' : 'text-slate-500'
                            )} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-white">
                                {rule.ruleSummary || 'Custom Rule'}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {RULE_TYPE_LABELS[rule.ruleType]}
                              </Badge>
                              {rule.source === 'preset_added' && (
                                <Badge variant="secondary" className="text-xs">Preset</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-400 line-clamp-2">{rule.ruleText}</p>
                            <p className="text-xs text-slate-500 mt-2">
                              Applied {rule.timesApplied} times
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.isActive}
                              onCheckedChange={(checked) =>
                                toggleRuleMutation.mutate({ ruleId: rule.id, isActive: checked })
                              }
                            />
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => deleteRuleMutation.mutate(rule.id)}
                              className="text-slate-500 hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                    </GlassCard>
                  </motion.div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {presetCategories.map((category) => (
              <Card key={category.name} className="bg-slate-900/50 border-slate-700/50">
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => setExpandedCategory(
                    expandedCategory === category.name ? null : category.name
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg text-white">{category.name}</CardTitle>
                      <CardDescription>{category.description}</CardDescription>
                    </div>
                    <ChevronRight className={cn(
                      'h-5 w-5 text-slate-400 transition-transform',
                      expandedCategory === category.name && 'rotate-90'
                    )} />
                  </div>
                </CardHeader>
                <AnimatePresence>
                  {expandedCategory === category.name && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                    >
                      <CardContent className="space-y-3 pt-0">
                        {category.rules.map((preset) => (
                          <div
                            key={preset.id}
                            className="flex items-start gap-4 p-3 border border-slate-700/50 rounded-lg bg-slate-800/30"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-white">{preset.ruleSummary}</span>
                                <Badge variant="outline" className="text-xs">
                                  {RULE_TYPE_LABELS[preset.ruleType]}
                                </Badge>
                                {preset.isPopular && (
                                  <Badge variant="secondary" className="text-xs">Popular</Badge>
                                )}
                              </div>
                              <p className="text-sm text-slate-400">
                                {preset.description || preset.ruleText}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant={isPresetAdded(preset.id) ? 'secondary' : 'default'}
                              disabled={isPresetAdded(preset.id) || addPresetMutation.isPending}
                              onClick={() => addPresetMutation.mutate(preset.id)}
                              className={!isPresetAdded(preset.id) ? 'bg-violet-600 hover:bg-violet-700' : ''}
                            >
                              {isPresetAdded(preset.id) ? (
                                <>
                                  <Check className="h-4 w-4 mr-1" />
                                  Added
                                </>
                              ) : (
                                <>
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add
                                </>
                              )}
                            </Button>
                          </div>
                        ))}
                      </CardContent>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            ))}
          </div>
        )}

        {/* Add Rule Dialog */}
        <AnimatePresence>
          {showAddDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
              onClick={() => setShowAddDialog(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-xl font-semibold text-white mb-4">Add Custom Rule</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Rule Summary</label>
                    <input
                      type="text"
                      value={newRule.ruleSummary}
                      onChange={(e) => setNewRule({ ...newRule, ruleSummary: e.target.value })}
                      placeholder="Brief summary of the rule"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Rule Text</label>
                    <textarea
                      value={newRule.ruleText}
                      onChange={(e) => setNewRule({ ...newRule, ruleText: e.target.value })}
                      placeholder="Detailed rule text..."
                      rows={3}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Rule Type</label>
                    <select
                      value={newRule.ruleType}
                      onChange={(e) => setNewRule({ ...newRule, ruleType: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500"
                    >
                      {Object.entries(RULE_TYPE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <Button variant="ghost" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createRuleMutation.mutate(newRule)}
                    disabled={!newRule.ruleText || createRuleMutation.isPending}
                    className="bg-violet-600 hover:bg-violet-700"
                  >
                    {createRuleMutation.isPending ? 'Creating...' : 'Create Rule'}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
