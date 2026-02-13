'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FlaskConical,
  Plus,
  Shield,
  Zap,
  Sparkles,
  Flame,
  Check,
  X,
  Eye,
  Clock,
  CircleDot,
  ShieldAlert,
  Skull,
  Scale,
  Target,
  Ban,
  Lock,
  FileEdit,
} from 'lucide-react';
import {
  fetchFirmwareList,
  burnFirmware,
  activateFirmware,
  type FirmwareVersion,
  type BurnFirmwarePayload,
} from '@/lib/api';
import * as Slider from '@radix-ui/react-slider';

// ============================================================================
// Directive — a single behavioral instruction burned into ROM
// ============================================================================

type DirectiveKind = 'instinct' | 'fear' | 'moral' | 'ambition' | 'boundary';

interface Directive {
  id: string;
  kind: DirectiveKind;
  directive: string;
  weight: number; // 1-10
}

const DIRECTIVE_META: Record<DirectiveKind, { label: string; icon: typeof Shield; color: string; description: string }> = {
  instinct: { label: 'Instinct', icon: Zap, color: 'text-amber-400', description: 'Hardwired behavioral response' },
  fear:     { label: 'Fear', icon: Skull, color: 'text-red-400', description: 'Thing to avoid or prevent' },
  moral:    { label: 'Moral', icon: Scale, color: 'text-emerald-400', description: 'Ethical principle to uphold' },
  ambition: { label: 'Ambition', icon: Target, color: 'text-omega-400', description: 'Goal to pursue' },
  boundary: { label: 'Boundary', icon: Ban, color: 'text-orange-400', description: 'Hard limit that cannot be crossed' },
};

// ============================================================================
// Draft — the mutable state while composing a new firmware version
// ============================================================================

interface FirmwareDraft {
  label: string;
  description: string;
  author: string;
  directives: Directive[];
  drives: {
    entropy_threshold: number;
    dopamine_decay_rate: number;
    curiosity_bias: number;
    plasticity: number;
    caution: number;
  };
  personality: {
    warmth: number;
    assertiveness: number;
    creativity: number;
    formality: number;
    humor: number;
    empathy: number;
  };
}

const emptyDraft: FirmwareDraft = {
  label: '',
  description: '',
  author: '',
  directives: [],
  drives: {
    entropy_threshold: 0.8,
    dopamine_decay_rate: 0.99,
    curiosity_bias: 0.5,
    plasticity: 0.5,
    caution: 0.5,
  },
  personality: {
    warmth: 0.5,
    assertiveness: 0.5,
    creativity: 0.5,
    formality: 0.5,
    humor: 0.3,
    empathy: 0.5,
  },
};

// ============================================================================
// OmegaForge — main component
// ============================================================================

export function OmegaForge() {
  const [tenantId, setTenantId] = useState<string>('local-proving-ground');
  const [draft, setDraft] = useState<FirmwareDraft>({ ...emptyDraft });
  const [activeTab, setActiveTab] = useState<'directives' | 'drives' | 'personality'>('directives');
  const [showBurnConfirm, setShowBurnConfirm] = useState(false);
  const [isBurning, setIsBurning] = useState(false);
  const [burnSuccess, setBurnSuccess] = useState<string | null>(null);
  const [viewingVersion, setViewingVersion] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: firmwareList } = useQuery({
    queryKey: ['firmware', tenantId],
    queryFn: () => fetchFirmwareList(tenantId),
    enabled: !!tenantId,
  });

  const burnMutation = useMutation({
    mutationFn: () => {
      const payload: BurnFirmwarePayload = {
        label: draft.label.trim() || null,
        description: draft.description,
        author: draft.author,
        directives: draft.directives.map((d) => ({
          kind: d.kind,
          directive: d.directive,
          weight: d.weight,
        })),
        drives: { ...draft.drives },
        personality: { ...draft.personality },
      };
      return burnFirmware(tenantId, payload);
    },
    onMutate: () => {
      setIsBurning(true);
    },
    onSuccess: (data) => {
      setBurnSuccess(data.burned_at);
      setTimeout(() => {
        setBurnSuccess(null);
        setIsBurning(false);
        setShowBurnConfirm(false);
        setDraft({ ...emptyDraft });
        queryClient.invalidateQueries({ queryKey: ['firmware', tenantId] });
      }, 2000);
    },
    onError: () => {
      setIsBurning(false);
    },
  });

  const activateMutation = useMutation({
    mutationFn: (firmwareId: string) => activateFirmware(tenantId, firmwareId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firmware', tenantId] });
    },
  });

  // ---- Directive CRUD ----

  const addDirective = useCallback((kind: DirectiveKind) => {
    const newDirective: Directive = {
      id: `dir_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      kind,
      directive: '',
      weight: 5,
    };
    setDraft((prev) => ({
      ...prev,
      directives: [...prev.directives, newDirective],
    }));
  }, []);

  const updateDirective = useCallback((id: string, updates: Partial<Directive>) => {
    setDraft((prev) => ({
      ...prev,
      directives: prev.directives.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    }));
  }, []);

  const removeDirective = useCallback((id: string) => {
    setDraft((prev) => ({
      ...prev,
      directives: prev.directives.filter((d) => d.id !== id),
    }));
  }, []);

  // ---- Computed ----

  const isReadOnly = viewingVersion !== null;
  const directiveCount = draft.directives.length;
  const canBurn = tenantId && draft.author && directiveCount > 0 && !isReadOnly;
  const activeVersion = firmwareList?.firmware.find((fw) => fw.id === firmwareList.active_id);

  const exitViewMode = () => {
    setViewingVersion(null);
    setDraft({ ...emptyDraft });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <FlaskConical className="w-7 h-7 text-omega-400" />
            OMEGA Forge
          </h2>
          <p className="text-omega-400">
            Burn immutable behavioral directives into the brain&apos;s ROM
          </p>
        </div>
        {isReadOnly && (
          <button
            onClick={exitViewMode}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-omega-700 hover:bg-omega-600
                       text-white text-sm transition-colors"
          >
            <FileEdit className="w-4 h-4" />
            New Draft
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ================================================================ */}
        {/* LEFT: Firmware Editor (2/3 width)                                */}
        {/* ================================================================ */}
        <div className="lg:col-span-2 space-y-5">

          {/* Read-Only Banner */}
          {isReadOnly && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <Lock className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="flex-1">
                <span className="text-amber-300 font-medium text-sm">Viewing burned ROM</span>
                <span className="text-amber-400/70 text-xs ml-2">Immutable — cannot be edited</span>
              </div>
              <button onClick={exitViewMode} className="text-amber-400 hover:text-amber-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Draft Header */}
          <div className="bg-omega-900/50 rounded-xl border border-omega-800/50 p-6">
            <div className="flex items-center gap-3 mb-4">
              {isReadOnly ? (
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-omega-500" />
                  <h3 className="text-lg font-semibold text-omega-300">Burned Version</h3>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <h3 className="text-lg font-semibold text-white">New Draft</h3>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-omega-400 mb-1">Tenant ID</label>
                <input
                  type="text"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="tenant_123"
                  disabled={isReadOnly}
                  className="w-full px-4 py-2 bg-omega-800/50 border border-omega-700/50 rounded-lg
                             text-white placeholder-omega-500 focus:outline-none focus:border-omega-500
                             disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm text-omega-400 mb-1">
                  Version Label <span className="text-omega-600">(optional)</span>
                </label>
                <input
                  type="text"
                  value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  placeholder="e.g. Empathy Override v2"
                  disabled={isReadOnly}
                  className="w-full px-4 py-2 bg-omega-800/50 border border-omega-700/50 rounded-lg
                             text-white placeholder-omega-500 focus:outline-none focus:border-omega-500
                             disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-omega-400 mb-1">Purpose</label>
                <input
                  type="text"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="What behavioral change does this firmware encode?"
                  disabled={isReadOnly}
                  className="w-full px-4 py-2 bg-omega-800/50 border border-omega-700/50 rounded-lg
                             text-white placeholder-omega-500 focus:outline-none focus:border-omega-500
                             disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-omega-400 mb-1">Author</label>
                <input
                  type="text"
                  value={draft.author}
                  onChange={(e) => setDraft({ ...draft, author: e.target.value })}
                  placeholder="admin@company.com"
                  disabled={isReadOnly}
                  className="w-full px-4 py-2 bg-omega-800/50 border border-omega-700/50 rounded-lg
                             text-white placeholder-omega-500 focus:outline-none focus:border-omega-500
                             disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <ForgeTab
              active={activeTab === 'directives'}
              onClick={() => setActiveTab('directives')}
              icon={<ShieldAlert className="w-4 h-4" />}
              label="Directives"
              badge={directiveCount > 0 ? directiveCount : undefined}
            />
            <ForgeTab
              active={activeTab === 'drives'}
              onClick={() => setActiveTab('drives')}
              icon={<Zap className="w-4 h-4" />}
              label="Drives"
            />
            <ForgeTab
              active={activeTab === 'personality'}
              onClick={() => setActiveTab('personality')}
              icon={<Sparkles className="w-4 h-4" />}
              label="Personality"
            />
          </div>

          {/* Tab Content */}
          <div className="bg-omega-900/50 rounded-xl border border-omega-800/50 p-6">
            {/* ---- Directives Tab ---- */}
            {activeTab === 'directives' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Core Directives</h3>
                    <p className="text-omega-500 text-sm mt-0.5">
                      Instincts, fears, morals, ambitions, and boundaries the brain must follow
                    </p>
                  </div>
                  {!isReadOnly && (
                    <DirectiveAddMenu onAdd={addDirective} />
                  )}
                </div>

                {draft.directives.length === 0 ? (
                  <div className="text-center py-12 text-omega-500">
                    <Shield className="w-14 h-14 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No directives defined</p>
                    <p className="text-sm mt-1 text-omega-600">
                      Add instincts, fears, morals, ambitions, or boundaries
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {draft.directives.map((dir) => (
                      <DirectiveCard
                        key={dir.id}
                        directive={dir}
                        readOnly={isReadOnly}
                        onUpdate={(updates) => updateDirective(dir.id, updates)}
                        onRemove={() => removeDirective(dir.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ---- Drives Tab ---- */}
            {activeTab === 'drives' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white">Drive Configuration</h3>
                  <p className="text-omega-500 text-sm mt-0.5">
                    How aggressively the brain pursues goals and manages energy
                  </p>
                </div>
                <SliderField
                  label="Entropy Threshold"
                  description="When to trigger dream cycles"
                  value={draft.drives.entropy_threshold}
                  readOnly={isReadOnly}
                  onChange={(v) =>
                    setDraft({ ...draft, drives: { ...draft.drives, entropy_threshold: v } })
                  }
                />
                <SliderField
                  label="Dopamine Decay"
                  description="How quickly rewards fade"
                  value={draft.drives.dopamine_decay_rate}
                  min={0.9}
                  max={1}
                  step={0.01}
                  readOnly={isReadOnly}
                  onChange={(v) =>
                    setDraft({ ...draft, drives: { ...draft.drives, dopamine_decay_rate: v } })
                  }
                />
                <SliderField
                  label="Curiosity Bias"
                  description="Exploration vs exploitation"
                  value={draft.drives.curiosity_bias}
                  readOnly={isReadOnly}
                  onChange={(v) =>
                    setDraft({ ...draft, drives: { ...draft.drives, curiosity_bias: v } })
                  }
                />
                <SliderField
                  label="Plasticity"
                  description="How easily the brain adapts"
                  value={draft.drives.plasticity}
                  readOnly={isReadOnly}
                  onChange={(v) =>
                    setDraft({ ...draft, drives: { ...draft.drives, plasticity: v } })
                  }
                />
                <SliderField
                  label="Caution"
                  description="Risk aversion level"
                  value={draft.drives.caution}
                  readOnly={isReadOnly}
                  onChange={(v) =>
                    setDraft({ ...draft, drives: { ...draft.drives, caution: v } })
                  }
                />
              </div>
            )}

            {/* ---- Personality Tab ---- */}
            {activeTab === 'personality' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white">Personality Traits</h3>
                  <p className="text-omega-500 text-sm mt-0.5">
                    The brain&apos;s default behavioral temperament
                  </p>
                </div>
                <SliderField
                  label="Warmth"
                  description="Cold to warm"
                  value={draft.personality.warmth}
                  readOnly={isReadOnly}
                  onChange={(v) =>
                    setDraft({ ...draft, personality: { ...draft.personality, warmth: v } })
                  }
                />
                <SliderField
                  label="Assertiveness"
                  description="Passive to assertive"
                  value={draft.personality.assertiveness}
                  readOnly={isReadOnly}
                  onChange={(v) =>
                    setDraft({ ...draft, personality: { ...draft.personality, assertiveness: v } })
                  }
                />
                <SliderField
                  label="Creativity"
                  description="Conservative to creative"
                  value={draft.personality.creativity}
                  readOnly={isReadOnly}
                  onChange={(v) =>
                    setDraft({ ...draft, personality: { ...draft.personality, creativity: v } })
                  }
                />
                <SliderField
                  label="Formality"
                  description="Casual to formal"
                  value={draft.personality.formality}
                  readOnly={isReadOnly}
                  onChange={(v) =>
                    setDraft({ ...draft, personality: { ...draft.personality, formality: v } })
                  }
                />
                <SliderField
                  label="Humor"
                  description="Serious to humorous"
                  value={draft.personality.humor}
                  readOnly={isReadOnly}
                  onChange={(v) =>
                    setDraft({ ...draft, personality: { ...draft.personality, humor: v } })
                  }
                />
                <SliderField
                  label="Empathy"
                  description="Detached to empathetic"
                  value={draft.personality.empathy}
                  readOnly={isReadOnly}
                  onChange={(v) =>
                    setDraft({ ...draft, personality: { ...draft.personality, empathy: v } })
                  }
                />
              </div>
            )}
          </div>

          {/* Burn to ROM Button */}
          {!isReadOnly && (
            <button
              onClick={() => setShowBurnConfirm(true)}
              disabled={!canBurn}
              className="group w-full flex items-center justify-center gap-3 px-4 py-4 rounded-xl
                         bg-gradient-to-r from-orange-600 via-red-600 to-orange-600
                         hover:from-orange-500 hover:via-red-500 hover:to-orange-500
                         text-white font-semibold text-lg
                         transition-all duration-300
                         disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:from-orange-600
                         shadow-lg shadow-red-900/30 hover:shadow-red-800/50"
            >
              <Flame className="w-6 h-6 group-hover:animate-pulse" />
              Burn to ROM
            </button>
          )}
        </div>

        {/* ================================================================ */}
        {/* RIGHT: ROM Timeline (1/3 width)                                  */}
        {/* ================================================================ */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-omega-400" />
              Burned Versions
            </h3>
            {firmwareList && (
              <span className="text-xs text-omega-500 font-mono">
                {firmwareList.count} total
              </span>
            )}
          </div>

          {!tenantId ? (
            <div className="text-center py-12 text-omega-500">
              <FlaskConical className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Enter a tenant ID to view ROM history</p>
            </div>
          ) : !firmwareList?.firmware?.length ? (
            <div className="text-center py-12 text-omega-500">
              <CircleDot className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No firmware burned yet</p>
              <p className="text-xs text-omega-600 mt-1">Compose directives and burn to ROM</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-3 bottom-3 w-px bg-omega-700/50" />

              <div className="space-y-2">
                {firmwareList.firmware.map((fw) => (
                  <ROMVersionCard
                    key={fw.id}
                    version={fw}
                    isActive={fw.id === firmwareList.active_id}
                    isViewing={fw.id === viewingVersion}
                    onActivate={() => activateMutation.mutate(fw.id)}
                    onView={() => setViewingVersion(fw.id)}
                    activating={activateMutation.isPending}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* Burn Confirmation Modal                                           */}
      {/* ================================================================ */}
      {showBurnConfirm && (
        <BurnConfirmModal
          directiveCount={directiveCount}
          label={draft.label || null}
          isBurning={isBurning}
          burnSuccess={burnSuccess}
          onConfirm={() => burnMutation.mutate()}
          onCancel={() => {
            if (!isBurning) setShowBurnConfirm(false);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// ForgeTab — tab button in the directive editor
// ============================================================================

function ForgeTab({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg transition-all relative
        ${active
          ? 'bg-omega-700 text-white shadow-md shadow-omega-900/50'
          : 'text-omega-400 hover:bg-omega-800/50 hover:text-white'
        }
      `}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
      {badge !== undefined && (
        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-omega-500/20 text-omega-300 text-xs font-mono">
          {badge}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// DirectiveAddMenu — dropdown to add a new directive by kind
// ============================================================================

function DirectiveAddMenu({ onAdd }: { onAdd: (kind: DirectiveKind) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-omega-700 hover:bg-omega-600
                   text-white text-sm transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Directive
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 z-50 rounded-xl bg-omega-800 border border-omega-700/50
                          shadow-2xl shadow-black/50 overflow-hidden">
            {(Object.entries(DIRECTIVE_META) as [DirectiveKind, typeof DIRECTIVE_META[DirectiveKind]][]).map(
              ([kind, meta]) => {
                const Icon = meta.icon;
                return (
                  <button
                    key={kind}
                    onClick={() => {
                      onAdd(kind);
                      setOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-omega-700/50 transition-colors text-left"
                  >
                    <Icon className={`w-4 h-4 ${meta.color} shrink-0`} />
                    <div>
                      <div className="text-white text-sm font-medium">{meta.label}</div>
                      <div className="text-omega-500 text-xs">{meta.description}</div>
                    </div>
                  </button>
                );
              }
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// DirectiveCard — single directive row
// ============================================================================

function DirectiveCard({
  directive,
  readOnly,
  onUpdate,
  onRemove,
}: {
  directive: Directive;
  readOnly: boolean;
  onUpdate: (updates: Partial<Directive>) => void;
  onRemove: () => void;
}) {
  const meta = DIRECTIVE_META[directive.kind];
  const Icon = meta.icon;

  return (
    <div className={`
      p-4 rounded-xl border transition-all
      ${readOnly
        ? 'bg-omega-800/20 border-omega-700/30'
        : 'bg-omega-800/30 border-omega-700/50 hover:border-omega-600/50'
      }
    `}>
      <div className="flex items-start gap-3">
        {/* Kind indicator */}
        <div className={`
          mt-0.5 flex items-center justify-center w-8 h-8 rounded-lg shrink-0
          ${directive.kind === 'instinct' ? 'bg-amber-500/10' : ''}
          ${directive.kind === 'fear' ? 'bg-red-500/10' : ''}
          ${directive.kind === 'moral' ? 'bg-emerald-500/10' : ''}
          ${directive.kind === 'ambition' ? 'bg-omega-500/10' : ''}
          ${directive.kind === 'boundary' ? 'bg-orange-500/10' : ''}
        `}>
          <Icon className={`w-4 h-4 ${meta.color}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-semibold uppercase tracking-wider ${meta.color}`}>
              {meta.label}
            </span>
            {!readOnly && (
              <select
                value={directive.kind}
                onChange={(e) => onUpdate({ kind: e.target.value as DirectiveKind })}
                className="ml-auto px-2 py-0.5 bg-omega-700/50 border border-omega-600/30 rounded text-omega-300 text-xs
                           cursor-pointer focus:outline-none"
              >
                {Object.entries(DIRECTIVE_META).map(([k, m]) => (
                  <option key={k} value={k}>{m.label}</option>
                ))}
              </select>
            )}
          </div>

          {readOnly ? (
            <p className="text-white text-sm">{directive.directive}</p>
          ) : (
            <textarea
              value={directive.directive}
              onChange={(e) => onUpdate({ directive: e.target.value })}
              placeholder={`Describe the ${meta.label.toLowerCase()}...`}
              rows={2}
              className="w-full px-3 py-2 bg-omega-700/30 border border-omega-600/30 rounded-lg
                         text-white placeholder-omega-500 text-sm resize-none
                         focus:outline-none focus:border-omega-500"
            />
          )}

          {/* Weight */}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-omega-500 text-xs">Weight</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 10 }, (_, i) => (
                <button
                  key={i}
                  disabled={readOnly}
                  onClick={() => onUpdate({ weight: i + 1 })}
                  className={`
                    w-5 h-2 rounded-sm transition-all
                    ${i < directive.weight
                      ? directive.weight >= 8 ? 'bg-red-500' : directive.weight >= 5 ? 'bg-amber-500' : 'bg-omega-500'
                      : 'bg-omega-700/50'
                    }
                    ${!readOnly ? 'cursor-pointer hover:opacity-80' : ''}
                  `}
                />
              ))}
            </div>
            <span className="text-omega-400 text-xs font-mono">{directive.weight}/10</span>
          </div>
        </div>

        {/* Remove */}
        {!readOnly && (
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-omega-600 hover:text-red-400 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ROMVersionCard — a burned firmware version in the timeline
// ============================================================================

function ROMVersionCard({
  version,
  isActive,
  isViewing,
  onActivate,
  onView,
  activating,
}: {
  version: FirmwareVersion;
  isActive: boolean;
  isViewing: boolean;
  onActivate: () => void;
  onView: () => void;
  activating: boolean;
}) {
  const burnedDate = new Date(version.burned_at);
  const timeStr = burnedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = burnedDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div
      className={`
        relative pl-10 pr-4 py-3 rounded-xl border transition-all cursor-pointer
        ${isActive
          ? 'bg-green-500/5 border-green-500/20 hover:border-green-500/40'
          : isViewing
            ? 'bg-omega-700/20 border-omega-500/30'
            : 'bg-omega-900/30 border-omega-800/50 hover:border-omega-700/50'
        }
      `}
      onClick={onView}
    >
      {/* Timeline dot */}
      <div className={`
        absolute left-2.5 top-4 w-3 h-3 rounded-full border-2 z-10
        ${isActive
          ? 'bg-green-500 border-green-400 shadow-lg shadow-green-500/30'
          : 'bg-omega-800 border-omega-600'
        }
      `} />

      {/* Timestamp (primary identifier) */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-omega-300 font-mono text-xs">{dateStr}</span>
        <span className="text-omega-500 font-mono text-xs">{timeStr}</span>
      </div>

      {/* Optional label */}
      {version.label && (
        <div className="text-white font-medium text-sm mb-1">{version.label}</div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-omega-500">{version.author}</span>
        <span className="text-omega-600">{version.directive_count} directives</span>
        {isActive && (
          <span className="flex items-center gap-1 text-green-400 ml-auto">
            <Check className="w-3 h-3" />
            Active
          </span>
        )}
      </div>

      {/* Actions */}
      {!isActive && (
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={(e) => { e.stopPropagation(); onActivate(); }}
            disabled={activating}
            className="text-xs text-omega-400 hover:text-omega-200 transition-colors flex items-center gap-1"
          >
            <Flame className="w-3 h-3" />
            Activate
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onView(); }}
            className="text-xs text-omega-400 hover:text-omega-200 transition-colors flex items-center gap-1"
          >
            <Eye className="w-3 h-3" />
            View
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// BurnConfirmModal — ceremonial confirmation before burning to ROM
// ============================================================================

function BurnConfirmModal({
  directiveCount,
  label,
  isBurning,
  burnSuccess,
  onConfirm,
  onCancel,
}: {
  directiveCount: number;
  label: string | null;
  isBurning: boolean;
  burnSuccess: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal */}
      <div className={`
        relative w-full max-w-md mx-4 rounded-2xl border p-8 text-center
        transition-all duration-500
        ${burnSuccess
          ? 'bg-green-950/90 border-green-500/40 shadow-2xl shadow-green-500/20'
          : isBurning
            ? 'bg-orange-950/90 border-orange-500/40 shadow-2xl shadow-orange-500/20'
            : 'bg-omega-900/95 border-omega-700/50 shadow-2xl shadow-black/50'
        }
      `}>
        {burnSuccess ? (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-green-300 mb-2">Burned to ROM</h3>
            <p className="text-green-400/70 text-sm font-mono">
              {new Date(burnSuccess).toLocaleString()}
            </p>
          </>
        ) : isBurning ? (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-500/20 flex items-center justify-center animate-pulse">
              <Flame className="w-8 h-8 text-orange-400" />
            </div>
            <h3 className="text-xl font-bold text-orange-300 mb-2">Burning...</h3>
            <p className="text-orange-400/70 text-sm">
              Writing {directiveCount} directives to ROM
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <Flame className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Burn to ROM?</h3>
            <p className="text-omega-400 text-sm mb-1">
              This will permanently encode <strong className="text-white">{directiveCount} directives</strong> into
              an immutable firmware version.
            </p>
            {label && (
              <p className="text-omega-500 text-sm mb-4">
                Label: <span className="text-omega-300">{label}</span>
              </p>
            )}
            {!label && <div className="mb-4" />}

            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-6">
              <p className="text-red-400/80 text-xs">
                Once burned, this version cannot be modified or deleted. It can only be
                superseded by a new forge cycle.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-3 rounded-xl bg-omega-800 hover:bg-omega-700
                           text-omega-300 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                           bg-gradient-to-r from-orange-600 to-red-600
                           hover:from-orange-500 hover:to-red-500
                           text-white font-semibold transition-all
                           shadow-lg shadow-red-900/40"
              >
                <Flame className="w-5 h-5" />
                Burn
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SliderField — reusable slider with read-only support
// ============================================================================

function SliderField({
  label,
  description,
  value,
  onChange,
  readOnly = false,
  min = 0,
  max = 1,
  step = 0.01,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  readOnly?: boolean;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className={readOnly ? 'opacity-70' : ''}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-white font-medium">{label}</span>
          <span className="text-omega-500 text-sm ml-2">{description}</span>
        </div>
        <span className="text-omega-400 font-mono text-sm">{value.toFixed(2)}</span>
      </div>
      <Slider.Root
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        disabled={readOnly}
        className="relative flex items-center w-full h-5 cursor-pointer disabled:cursor-not-allowed"
      >
        <Slider.Track className="bg-omega-700 relative flex-1 h-2 rounded-full">
          <Slider.Range className="absolute h-full bg-omega-500 rounded-full" />
        </Slider.Track>
        <Slider.Thumb className="block w-5 h-5 bg-white rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-omega-400 disabled:bg-omega-400" />
      </Slider.Root>
    </div>
  );
}
