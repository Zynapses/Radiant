'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Layers,
  Loader2,
  FileText,
  CheckCircle2,
  GitCompare,
  AlertTriangle,
  Clock,
  ListChecks,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useCatoTrainerStore } from '@/lib/cato-trainer-store';
import {
  generateDigest,
  type DigestType,
  type DigestResult,
  type Citation,
} from '@/lib/api';
import { cn, confidenceColor } from '@/lib/utils';

const DIGEST_TYPES: Array<{ type: DigestType; label: string; icon: typeof Layers; color: string; description: string }> = [
  { type: 'summary',       label: 'Summary',        icon: FileText,      color: 'text-cato-400',   description: 'Comprehensive summary of selected documents' },
  { type: 'comparison',    label: 'Comparison',      icon: GitCompare,    color: 'text-blue-400',   description: 'Compare and contrast key themes and findings' },
  { type: 'contradiction', label: 'Contradictions',  icon: AlertTriangle, color: 'text-red-400',    description: 'Find conflicts and inconsistencies between documents' },
  { type: 'timeline',      label: 'Timeline',        icon: Clock,         color: 'text-purple-400', description: 'Extract chronological events and milestones' },
  { type: 'key_facts',     label: 'Key Facts',       icon: Lightbulb,     color: 'text-yellow-400', description: 'Extract the most important facts and figures' },
  { type: 'action_items',  label: 'Action Items',    icon: ListChecks,    color: 'text-ground-400', description: 'Pull out actionable items and recommendations' },
];

export function DigestPanel() {
  const {
    tenantId,
    selectedDocumentIds,
    activeDigest,
    setActiveDigest,
    digests,
    setDigests,
  } = useCatoTrainerStore();

  const [selectedType, setSelectedType] = useState<DigestType>('summary');
  const [customPrompt, setCustomPrompt] = useState('');

  const digestMutation = useMutation({
    mutationFn: () =>
      generateDigest(tenantId, {
        document_ids: selectedDocumentIds,
        digest_type: selectedType,
        custom_prompt: customPrompt || undefined,
      }),
    onSuccess: (data) => {
      setActiveDigest(data.digest);
      setDigests([data.digest, ...digests]);
    },
  });

  // No documents selected
  if (selectedDocumentIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <Layers className="w-16 h-16 text-white/[0.03] mb-4" />
        <h3 className="text-lg font-medium text-white/20">Multi-Document Digest</h3>
        <p className="text-sm text-white/10 max-w-md text-center mt-2">
          Select documents from the Documents tab (use checkboxes), then come here to generate summaries, comparisons, contradiction analysis, and more.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Digest</h2>
        <p className="text-xs text-white/30">
          {selectedDocumentIds.length} document{selectedDocumentIds.length !== 1 ? 's' : ''} selected — choose an analysis type
        </p>
      </div>

      {/* Digest type selector */}
      <div className="grid grid-cols-3 gap-3">
        {DIGEST_TYPES.map((dt) => {
          const active = selectedType === dt.type;
          return (
            <button
              key={dt.type}
              onClick={() => setSelectedType(dt.type)}
              className={cn(
                'glass-panel rounded-xl p-4 text-left transition-all',
                active
                  ? 'border-cato-500/30 bg-cato-500/5'
                  : 'hover:bg-white/[0.02]'
              )}
            >
              <dt.icon className={cn('w-5 h-5 mb-2', active ? dt.color : 'text-white/15')} />
              <p className={cn('text-sm font-medium', active ? 'text-white' : 'text-white/40')}>{dt.label}</p>
              <p className="text-[10px] text-white/20 mt-1">{dt.description}</p>
            </button>
          );
        })}
      </div>

      {/* Custom prompt */}
      <div className="glass-panel rounded-xl p-4">
        <p className="text-[10px] uppercase tracking-wider text-white/15 mb-2">Custom Instructions (Optional)</p>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="e.g., Focus on financial metrics and compare year-over-year trends..."
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white/60 placeholder:text-white/10 resize-none focus:border-cato-500/30 focus:outline-none"
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={() => digestMutation.mutate()}
            disabled={digestMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cato-600 hover:bg-cato-500 text-white text-sm font-medium disabled:opacity-40 transition-colors"
          >
            {digestMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Layers className="w-4 h-4" /> Generate Digest
              </>
            )}
          </button>
        </div>
      </div>

      {/* Active digest result */}
      {activeDigest && <DigestResultCard digest={activeDigest} />}

      {/* History */}
      {digests.length > 1 && (
        <div>
          <h3 className="text-sm font-semibold text-white/40 mb-3">Previous Digests</h3>
          <div className="space-y-2">
            {digests.slice(1).map((d) => (
              <button
                key={d.id}
                onClick={() => setActiveDigest(d)}
                className="w-full text-left glass-panel rounded-lg p-3 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">{d.title}</span>
                  <span className="text-[10px] text-white/15 capitalize">{d.digest_type.replace('_', ' ')}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DigestResultCard({ digest }: { digest: DigestResult }) {
  const [showCitations, setShowCitations] = useState(false);

  return (
    <div className="glass-panel rounded-xl p-6 card-reveal">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{digest.title}</h3>
          <p className="text-[10px] text-white/20 capitalize">{digest.digest_type.replace('_', ' ')} · {digest.document_count} documents</p>
        </div>
        <CheckCircle2 className="w-5 h-5 text-ground-400" />
      </div>

      <div className="text-sm text-white/60 leading-relaxed cato-prose whitespace-pre-wrap">
        {digest.content}
      </div>

      {digest.citations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/[0.04]">
          <button
            onClick={() => setShowCitations(!showCitations)}
            className="flex items-center gap-1.5 text-[10px] text-ground-400/60 hover:text-ground-400 transition-colors"
          >
            <CheckCircle2 className="w-3 h-3" />
            {digest.citations.length} source{digest.citations.length !== 1 ? 's' : ''}
            {showCitations ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showCitations && (
            <div className="mt-2 space-y-2">
              {digest.citations.map((cite) => (
                <div key={cite.id} className="citation-highlight rounded-lg py-2 pr-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <FileText className="w-3 h-3 text-white/20" />
                    <span className="text-[10px] text-white/30 truncate">{cite.document_title}</span>
                    <span className={cn('text-[10px] ml-auto', confidenceColor(cite.relevance_score))}>
                      {Math.round(cite.relevance_score * 100)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-white/40 italic">&ldquo;{cite.exact_quote}&rdquo;</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
