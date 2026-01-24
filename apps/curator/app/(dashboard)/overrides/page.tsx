'use client';

import { useState, useEffect } from 'react';
import {
  PenTool,
  Search,
  Plus,
  Edit2,
  Trash2,
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  Lock,
  Shield,
  Sliders,
  FileText,
  Link2,
  Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ui/glass-card';
import { toast } from 'sonner';

type RuleType = 'force_override' | 'conditional' | 'context_dependent';

interface Override {
  id: string;
  originalFact: string;
  overriddenFact: string;
  reason: string;
  domain: string;
  createdBy: string;
  createdAt: string;
  status: 'active' | 'expired' | 'pending_review';
  expiresAt?: string;
  priority: number;
  ruleType: RuleType;
  condition?: string;
  chainOfCustodyId?: string;
}

function getRuleTypeConfig(ruleType: RuleType) {
  switch (ruleType) {
    case 'force_override':
      return { icon: Crown, label: 'Force Override', color: 'text-curator-gold', description: 'Supersedes ALL other data' };
    case 'conditional':
      return { icon: Shield, label: 'Conditional', color: 'text-curator-sapphire', description: 'Applies when condition is met' };
    case 'context_dependent':
      return { icon: Link2, label: 'Context Dependent', color: 'text-curator-emerald', description: 'Varies by context' };
  }
}

function getPriorityLabel(priority: number): { label: string; color: string } {
  if (priority >= 90) return { label: 'Critical', color: 'text-red-500' };
  if (priority >= 70) return { label: 'High', color: 'text-curator-gold' };
  if (priority >= 40) return { label: 'Medium', color: 'text-curator-sapphire' };
  return { label: 'Low', color: 'text-muted-foreground' };
}

export default function OverridesPage() {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOverride, setSelectedOverride] = useState<Override | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  
  // Create dialog state
  const [newOriginalFact, setNewOriginalFact] = useState('');
  const [newOverriddenFact, setNewOverriddenFact] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newPriority, setNewPriority] = useState(100);
  const [newRuleType, setNewRuleType] = useState<RuleType>('force_override');
  const [newCondition, setNewCondition] = useState('');
  const [newExpiresAt, setNewExpiresAt] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    async function fetchOverrides() {
      try {
        const res = await fetch('/api/curator/golden-rules');
        if (res.ok) {
          const data = await res.json();
          // Add default values for new fields if not present
          const overridesWithDefaults = (data.overrides || []).map((o: any) => ({
            ...o,
            priority: o.priority ?? 100,
            ruleType: o.ruleType || 'force_override',
          }));
          setOverrides(overridesWithDefaults);
        }
      } catch (error) {
        console.error('Failed to fetch overrides:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchOverrides();
  }, []);
  
  const handleCreate = async () => {
    if (!newOriginalFact || !newOverriddenFact || !newReason) {
      toast.error('Error', { description: 'Please fill in all required fields.' });
      return;
    }
    setCreateLoading(true);
    try {
      const res = await fetch('/api/curator/golden-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          condition: newOriginalFact,
          override: newOverriddenFact,
          reason: newReason,
          priority: newPriority,
          ruleType: newRuleType,
          expiresAt: newExpiresAt || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOverrides((prev) => [{
          id: data.id,
          originalFact: newOriginalFact,
          overriddenFact: newOverriddenFact,
          reason: newReason,
          domain: 'General',
          createdBy: 'Current User',
          createdAt: new Date().toISOString(),
          status: 'active',
          priority: newPriority,
          ruleType: newRuleType,
          condition: newCondition,
          expiresAt: newExpiresAt || undefined,
        }, ...prev]);
        toast.success('Golden Rule Created', {
          description: 'Your override has been saved with Chain of Custody tracking.',
        });
        setShowCreateDialog(false);
        resetCreateForm();
      } else {
        throw new Error('Failed to create');
      }
    } catch (error) {
      toast.error('Error', { description: 'Failed to create override. Please try again.' });
    } finally {
      setCreateLoading(false);
    }
  };
  
  const resetCreateForm = () => {
    setNewOriginalFact('');
    setNewOverriddenFact('');
    setNewReason('');
    setNewPriority(100);
    setNewRuleType('force_override');
    setNewCondition('');
    setNewExpiresAt('');
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(id);
    try {
      const res = await fetch(`/api/curator/golden-rules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setOverrides((prev) => prev.filter((o) => o.id !== id));
        toast.success('Override Removed', {
          description: 'The override has been removed and the original fact restored.',
        });
        if (selectedOverride?.id === id) setSelectedOverride(null);
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to remove the override. Please try again.',
      });
    } finally {
      setDeleteLoading(null);
    }
  };

  const filteredOverrides = overrides.filter((o) =>
    o.originalFact.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.overriddenFact.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: Override['status']) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-curator-emerald/10 text-curator-emerald">Active</span>;
      case 'expired':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-muted text-muted-foreground">Expired</span>;
      case 'pending_review':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-curator-gold/10 text-curator-gold">Pending Review</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-curator-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Overrides</h1>
          <p className="text-muted-foreground mt-1">
            Manage human corrections to AI-learned knowledge.
          </p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-2 px-4 py-2 bg-curator-gold text-white rounded-lg font-medium hover:bg-curator-gold/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Override
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search overrides..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background"
        />
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Overrides</p>
          <p className="text-2xl font-bold">{overrides.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-curator-emerald">
            {overrides.filter((o) => o.status === 'active').length}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Pending Review</p>
          <p className="text-2xl font-bold text-curator-gold">
            {overrides.filter((o) => o.status === 'pending_review').length}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Override List */}
        <div className="lg:col-span-2 space-y-3">
          {filteredOverrides.length > 0 ? (
            filteredOverrides.map((override) => (
              <button
                key={override.id}
                onClick={() => setSelectedOverride(override)}
                className={cn(
                  'w-full text-left transition-all',
                  selectedOverride?.id === override.id && 'ring-2 ring-primary'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <PenTool className="h-4 w-4 text-curator-gold shrink-0" />
                      {getStatusBadge(override.status)}
                    </div>
                    <div className="space-y-2">
                      <div className="p-2 bg-destructive/5 border border-destructive/20 rounded text-sm">
                        <span className="text-destructive line-through">{override.originalFact}</span>
                      </div>
                      <div className="p-2 bg-curator-emerald/5 border border-curator-emerald/20 rounded text-sm">
                        <span className="text-curator-emerald">{override.overriddenFact}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {override.domain} • {new Date(override.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <GlassCard variant="default" padding="lg" className="text-center">
              <PenTool className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="font-semibold">No Overrides Found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery ? 'Try adjusting your search' : 'Create an override to correct AI-learned facts'}
              </p>
            </GlassCard>
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          {selectedOverride ? (
            <GlassCard variant="elevated" padding="md" className="space-y-4 sticky top-20">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Override Details</h3>
                <div className="flex items-center gap-1">
                  <button className="p-2 hover:bg-accent rounded-md" title="Edit">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(selectedOverride.id)}
                    disabled={deleteLoading === selectedOverride.id}
                    className="p-2 hover:bg-accent rounded-md text-destructive"
                    title="Delete"
                  >
                    {deleteLoading === selectedOverride.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground uppercase">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedOverride.status)}</div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground uppercase">Original Fact</label>
                  <p className="text-sm mt-1 p-2 bg-destructive/5 rounded line-through text-destructive">
                    {selectedOverride.originalFact}
                  </p>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground uppercase">Corrected Fact</label>
                  <p className="text-sm mt-1 p-2 bg-curator-emerald/5 rounded text-curator-emerald">
                    {selectedOverride.overriddenFact}
                  </p>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground uppercase">Reason</label>
                  <p className="text-sm mt-1 text-muted-foreground">{selectedOverride.reason}</p>
                </div>

                <div className="pt-4 border-t space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedOverride.createdBy}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{new Date(selectedOverride.createdAt).toLocaleString()}</span>
                  </div>
                  {selectedOverride.expiresAt && (
                    <div className="flex items-center gap-2 text-curator-gold">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Expires: {new Date(selectedOverride.expiresAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          ) : (
            <GlassCard variant="default" padding="lg" className="flex flex-col items-center justify-center text-center h-[300px]">
              <PenTool className="h-8 w-8 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                Select an override to view details
              </p>
            </GlassCard>
          )}
        </div>
      </div>

      {/* Enhanced Create Dialog with God Mode Controls */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
          <div className="bg-card rounded-xl border shadow-lg p-6 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-curator-gold/10 rounded-lg">
                  <Crown className="h-6 w-6 text-curator-gold" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Create Golden Rule Override</h2>
                  <p className="text-sm text-muted-foreground">"God Mode" - Supersedes all AI learning</p>
                </div>
              </div>
              <button onClick={() => { setShowCreateDialog(false); resetCreateForm(); }} className="p-1 hover:bg-accent rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Rule Type Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">Rule Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['force_override', 'conditional', 'context_dependent'] as const).map((rt) => {
                    const config = getRuleTypeConfig(rt);
                    return (
                      <button
                        key={rt}
                        onClick={() => setNewRuleType(rt)}
                        className={cn(
                          'p-3 border rounded-lg text-left transition-all',
                          newRuleType === rt ? 'border-curator-gold bg-curator-gold/10' : 'hover:border-muted-foreground'
                        )}
                      >
                        <config.icon className={cn('h-5 w-5 mb-2', config.color)} />
                        <p className="font-medium text-sm">{config.label}</p>
                        <p className="text-xs text-muted-foreground">{config.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Original and Override Facts */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">When AI says (condition)</label>
                  <textarea
                    value={newOriginalFact}
                    onChange={(e) => setNewOriginalFact(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-md bg-background h-24"
                    placeholder="e.g., 'Replace filter every 30 days'"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Force this instead (override)</label>
                  <textarea
                    value={newOverriddenFact}
                    onChange={(e) => setNewOverriddenFact(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-md bg-background h-24"
                    placeholder="e.g., 'Replace filter every 15 days (Mexico City plant)'"
                  />
                </div>
              </div>

              {/* Condition (for conditional rules) */}
              {newRuleType !== 'force_override' && (
                <div>
                  <label className="text-sm font-medium">Condition / Context</label>
                  <input
                    type="text"
                    value={newCondition}
                    onChange={(e) => setNewCondition(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                    placeholder="e.g., 'When location = Mexico City' or 'When humidity > 80%'"
                  />
                </div>
              )}

              {/* Priority Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Sliders className="h-4 w-4" />
                    Priority Level
                  </label>
                  <span className={cn('text-sm font-medium', getPriorityLabel(newPriority).color)}>
                    {newPriority} - {getPriorityLabel(newPriority).label}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={newPriority}
                  onChange={(e) => setNewPriority(parseInt(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-curator-gold"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Low (1)</span>
                  <span>Medium (50)</span>
                  <span>Critical (100)</span>
                </div>
              </div>

              {/* Justification */}
              <div>
                <label className="text-sm font-medium">Justification (required for audit)</label>
                <textarea
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md bg-background h-20"
                  placeholder="Why is this override necessary? (e.g., Field testing revealed..., Regulation change..., SME knowledge...)"
                />
              </div>

              {/* Expiration */}
              <div>
                <label className="text-sm font-medium">Expiration Date (optional)</label>
                <input
                  type="date"
                  value={newExpiresAt}
                  onChange={(e) => setNewExpiresAt(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                />
                <p className="text-xs text-muted-foreground mt-1">Leave empty for permanent override</p>
              </div>

              {/* Chain of Custody Notice */}
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Lock className="h-5 w-5 text-curator-gold shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Chain of Custody</p>
                  <p className="text-xs text-muted-foreground">
                    This override will be cryptographically signed and tracked. All changes are auditable and immutable.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowCreateDialog(false); resetCreateForm(); }}
                  className="flex-1 py-2.5 border rounded-lg hover:bg-accent font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newOriginalFact || !newOverriddenFact || !newReason || createLoading}
                  className="flex-1 py-2.5 bg-curator-gold text-white rounded-lg hover:bg-curator-gold/90 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Crown className="h-4 w-4" />
                  )}
                  Create Golden Rule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
