'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Lock,
  CheckCircle2,
  Loader2,
  Sparkles,
  ArrowRight,
  Shield,
  Target,
  Brain,
  Scale,
  Flame,
  type LucideIcon,
} from 'lucide-react';
import { useDojoStore } from '@/lib/dojo-store';
import { fetchThemes, type CentralTheme } from '@/lib/api';
import { cn, RANK_META, DIFFICULTY_LABELS } from '@/lib/utils';

const THEME_ICONS: Record<string, LucideIcon> = {
  shield: Shield,
  target: Target,
  brain: Brain,
  scale: Scale,
  flame: Flame,
  book: BookOpen,
  sparkles: Sparkles,
};

export function ThemeSelector() {
  const { activeLibrary, selectedThemes, toggleTheme, clearThemes } = useDojoStore();

  const { data, isLoading } = useQuery({
    queryKey: ['dojo-themes', activeLibrary?.id],
    queryFn: () => fetchThemes(activeLibrary!.id),
    enabled: !!activeLibrary,
  });

  const themes = data?.themes || [];

  if (!activeLibrary) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BookOpen className="w-12 h-12 text-white/10 mb-4" />
        <h3 className="text-lg font-medium text-white/40">Select a Library First</h3>
        <p className="text-sm text-white/25 mt-1">Go to the Library tab and select a document library to discover themes</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-dojo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Central Themes</h1>
          <p className="text-sm text-white/40 mt-1">
            Select 1–3 themes to focus your training session. The AI will gate all content to these themes only.
          </p>
        </div>
        {selectedThemes.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={clearThemes}
              className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/60 border border-white/10 hover:border-white/20 transition-all"
            >
              Clear
            </button>
            <span className="text-xs text-dojo-400 font-mono">
              {selectedThemes.length}/3 selected
            </span>
          </div>
        )}
      </div>

      {/* Selected Themes Bar */}
      {selectedThemes.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-dojo-500/5 border border-dojo-500/20">
          <Sparkles className="w-4 h-4 text-dojo-400 flex-shrink-0" />
          <div className="flex-1 flex items-center gap-2 flex-wrap">
            {selectedThemes.map((t) => (
              <span
                key={t.id}
                className="px-2.5 py-1 rounded-full bg-dojo-500/15 text-dojo-300 text-xs font-medium border border-dojo-500/20"
              >
                {t.name}
              </span>
            ))}
          </div>
          <button
            onClick={() => {
              /* Navigate to train tab — handled by parent */
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-dojo-600 hover:bg-dojo-500 text-white text-sm font-medium transition-colors"
          >
            Start Training
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Theme Grid */}
      {themes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Sparkles className="w-12 h-12 text-white/10 mb-4" />
          <h3 className="text-lg font-medium text-white/40">No Themes Discovered</h3>
          <p className="text-sm text-white/25 mt-1">
            Go to the Library tab and click &quot;Discover Themes&quot; to analyze your documents
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {themes.map((theme, i) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              index={i}
              isSelected={selectedThemes.some((t) => t.id === theme.id)}
              onToggle={() => toggleTheme(theme)}
              disabled={selectedThemes.length >= 3 && !selectedThemes.some((t) => t.id === theme.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme Card Component
// ─────────────────────────────────────────────────────────────────────────────

interface ThemeCardProps {
  theme: CentralTheme;
  index: number;
  isSelected: boolean;
  onToggle: () => void;
  disabled: boolean;
}

function ThemeCard({ theme, index, isSelected, onToggle, disabled }: ThemeCardProps) {
  const IconComp = THEME_ICONS[theme.icon] || BookOpen;
  const diffMeta = DIFFICULTY_LABELS[theme.difficulty_tier] || DIFFICULTY_LABELS.fundamental;
  const rankMeta = RANK_META[theme.unlock_rank];
  const isLocked = false; // Would check against user rank in production

  return (
    <button
      onClick={onToggle}
      disabled={disabled || isLocked}
      className={cn(
        'text-left p-5 rounded-xl border transition-all duration-300 card-reveal group',
        isSelected
          ? 'bg-dojo-500/10 border-dojo-500/40 discipline-glow'
          : isLocked
            ? 'bg-white/[0.01] border-white/[0.04] opacity-50 cursor-not-allowed'
            : disabled
              ? 'bg-white/[0.01] border-white/[0.04] opacity-40 cursor-not-allowed'
              : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10'
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center',
          isSelected ? 'bg-dojo-500/20' : 'bg-white/5'
        )}>
          <IconComp className={cn('w-4.5 h-4.5', isSelected ? 'text-dojo-400' : 'text-white/40')} />
        </div>
        <div className="flex items-center gap-2">
          {isLocked && <Lock className="w-3.5 h-3.5 text-white/20" />}
          {isSelected && <CheckCircle2 className="w-4 h-4 text-dojo-400" />}
        </div>
      </div>

      {/* Name & Description */}
      <h3 className={cn(
        'font-semibold text-sm mb-1.5',
        isSelected ? 'text-dojo-200' : 'text-white'
      )}>
        {theme.name}
      </h3>
      <p className="text-xs text-white/40 line-clamp-2 mb-4">{theme.description}</p>

      {/* Footer Meta */}
      <div className="flex items-center justify-between">
        <span className={cn('text-[10px] font-medium uppercase tracking-wider', diffMeta.color)}>
          {diffMeta.label}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[10px]', rankMeta.color)}>
            {rankMeta.label}+
          </span>
          <span className="text-[10px] text-white/20">·</span>
          <span className="text-[10px] text-white/30 font-mono">{theme.chunk_count} chunks</span>
        </div>
      </div>
    </button>
  );
}
