'use client';

/**
 * RADIANT v5.44.0 - Debate Arena UI
 * Adversarial exploration with attack/defense flows
 */

import React, { useState, useEffect } from 'react';
import { 
  Swords, Play, Pause, ChevronRight, Shield, Target,
  Zap, Eye, Sparkles, BarChart2, ArrowRight, Check, X
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface DebateArena {
  id: string;
  topic: string;
  proposition: string;
  status: 'setup' | 'opening' | 'main' | 'rebuttal' | 'closing' | 'resolved';
  debaters: Debater[];
  arguments: DebateArgument[];
  resolutionBalance: number; // -100 to 100
  weakPoints: WeakPoint[];
}

interface Debater {
  id: string;
  name: string;
  side: 'proposition' | 'opposition';
  style: string;
  currentStrength: number;
  avatar: { color: string; icon: string };
}

interface DebateArgument {
  id: string;
  debaterId: string;
  content: string;
  type: 'claim' | 'evidence' | 'reasoning' | 'rebuttal' | 'concession';
  strength: number;
  targetArgumentId?: string;
}

interface WeakPoint {
  id: string;
  argumentId: string;
  debaterId: string;
  vulnerability: string;
}

// =============================================================================
// STYLES
// =============================================================================

const arenaStyles = `
  @keyframes attack-flow {
    0% { stroke-dashoffset: 20; }
    100% { stroke-dashoffset: 0; }
  }
  @keyframes strength-pulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }
  @keyframes weak-point-breathe {
    0%, 100% { transform: scale(1); opacity: 0.6; }
    50% { transform: scale(1.2); opacity: 1; }
  }
`;

// =============================================================================
// RESOLUTION METER
// =============================================================================

function ResolutionMeter({ balance }: { balance: number }) {
  const position = (balance + 100) / 2; // Convert -100..100 to 0..100

  return (
    <div className="relative h-8 bg-slate-800 rounded-full overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 flex">
        <div className="flex-1 bg-gradient-to-r from-red-500/30 to-transparent" />
        <div className="flex-1 bg-gradient-to-l from-blue-500/30 to-transparent" />
      </div>
      
      {/* Center line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-600 -translate-x-1/2" />
      
      {/* Position indicator */}
      <div 
        className="absolute top-1 bottom-1 w-4 rounded-full transition-all duration-500"
        style={{
          left: `calc(${position}% - 8px)`,
          backgroundColor: balance > 0 ? '#3b82f6' : balance < 0 ? '#ef4444' : '#f59e0b',
          boxShadow: `0 0 10px ${balance > 0 ? '#3b82f6' : balance < 0 ? '#ef4444' : '#f59e0b'}`,
        }}
      />

      {/* Labels */}
      <div className="absolute inset-x-4 inset-y-0 flex items-center justify-between text-xs font-medium">
        <span className="text-red-400">Opposition</span>
        <span className="text-blue-400">Proposition</span>
      </div>
    </div>
  );
}

// =============================================================================
// DEBATER CARD
// =============================================================================

function DebaterCard({ debater, arguments: args }: { debater: Debater; arguments: DebateArgument[] }) {
  const debaterArgs = args.filter(a => a.debaterId === debater.id);
  const avgStrength = debaterArgs.length > 0 
    ? Math.round(debaterArgs.reduce((sum, a) => sum + a.strength, 0) / debaterArgs.length)
    : 0;

  return (
    <div className={`p-4 rounded-xl border ${
      debater.side === 'proposition' 
        ? 'bg-blue-500/10 border-blue-500/30' 
        : 'bg-red-500/10 border-red-500/30'
    }`}>
      <div className="flex items-center gap-3 mb-3">
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: debater.avatar.color }}
        >
          {debater.side === 'proposition' ? (
            <Check className="w-5 h-5 text-white" />
          ) : (
            <X className="w-5 h-5 text-white" />
          )}
        </div>
        <div>
          <h4 className="font-medium text-white">{debater.name}</h4>
          <p className="text-xs text-slate-400 capitalize">{debater.style} style</p>
        </div>
      </div>

      {/* Strength meter */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Current Strength</span>
          <span>{debater.currentStrength}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-500"
            style={{ 
              width: `${debater.currentStrength}%`,
              backgroundColor: debater.avatar.color,
              animation: 'strength-pulse 2s ease-in-out infinite',
            }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 bg-slate-800/50 rounded">
          <span className="text-slate-400">Arguments</span>
          <p className="font-medium text-white">{debaterArgs.length}</p>
        </div>
        <div className="p-2 bg-slate-800/50 rounded">
          <span className="text-slate-400">Avg Strength</span>
          <p className="font-medium text-white">{avgStrength}%</p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// ARGUMENT FLOW
// =============================================================================

function ArgumentFlow({ argument, debater, targetArg, targetDebater }: { 
  argument: DebateArgument; 
  debater?: Debater;
  targetArg?: DebateArgument;
  targetDebater?: Debater;
}) {
  const typeColors: Record<string, string> = {
    claim: '#3b82f6',
    evidence: '#22c55e',
    reasoning: '#8b5cf6',
    rebuttal: '#ef4444',
    concession: '#f59e0b',
  };

  return (
    <div className={`p-4 rounded-lg border ${
      debater?.side === 'proposition' 
        ? 'bg-blue-500/5 border-blue-500/20' 
        : 'bg-red-500/5 border-red-500/20'
    }`}>
      <div className="flex items-start gap-3">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: debater?.avatar.color || '#6366f1' }}
        >
          {debater?.side === 'proposition' ? (
            <Check className="w-4 h-4 text-white" />
          ) : (
            <X className="w-4 h-4 text-white" />
          )}
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-white">{debater?.name}</span>
            <span 
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: `${typeColors[argument.type]}20`, color: typeColors[argument.type] }}
            >
              {argument.type}
            </span>
            <span className="text-xs text-slate-500">
              Strength: {argument.strength}%
            </span>
          </div>
          
          <p 
            className="text-sm text-slate-300"
            style={{ fontWeight: 350 + (argument.strength * 1.5) }}
          >
            {argument.content}
          </p>

          {/* Attack indicator */}
          {targetArg && targetDebater && (
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <ArrowRight className="w-3 h-3" />
              <span>Targeting {targetDebater.name}&apos;s {targetArg.type}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// WEAK POINTS DISPLAY
// =============================================================================

function WeakPointsPanel({ weakPoints, arguments: args, debaters }: {
  weakPoints: WeakPoint[];
  arguments: DebateArgument[];
  debaters: Debater[];
}) {
  if (weakPoints.length === 0) return null;

  return (
    <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/30">
      <h4 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
        <Zap className="w-4 h-4" />
        Detected Weak Points
      </h4>
      <div className="space-y-2">
        {weakPoints.map(wp => {
          const arg = args.find(a => a.id === wp.argumentId);
          const debater = debaters.find(d => d.id === wp.debaterId);
          return (
            <div 
              key={wp.id} 
              className="p-2 bg-slate-900/50 rounded flex items-start gap-2"
              style={{ animation: 'weak-point-breathe 2s ease-in-out infinite' }}
            >
              <Shield className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-slate-300">{debater?.name}: &ldquo;{arg?.content.substring(0, 50)}...&rdquo;</p>
                <p className="text-xs text-red-400 mt-1">{wp.vulnerability}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function DebateArenaPage() {
  const [arena, setArena] = useState<DebateArena | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningRound, setRunningRound] = useState(false);

  useEffect(() => {
    const mockArena: DebateArena = {
      id: '1',
      topic: 'Remote Work Policy',
      proposition: 'Companies should adopt permanent hybrid work models',
      status: 'main',
      resolutionBalance: 15, // Slightly favoring proposition
      debaters: [
        {
          id: 'd1',
          name: 'Proposition AI',
          side: 'proposition',
          style: 'balanced',
          currentStrength: 62,
          avatar: { color: '#3b82f6', icon: 'check' },
        },
        {
          id: 'd2',
          name: 'Opposition AI',
          side: 'opposition',
          style: 'aggressive',
          currentStrength: 55,
          avatar: { color: '#ef4444', icon: 'x' },
        },
      ],
      arguments: [
        {
          id: 'a1',
          debaterId: 'd1',
          content: 'Hybrid work models have been shown to increase employee satisfaction by 23% according to recent studies, while maintaining productivity levels.',
          type: 'claim',
          strength: 72,
        },
        {
          id: 'a2',
          debaterId: 'd2',
          content: 'Those studies primarily surveyed knowledge workers. Manufacturing, healthcare, and service industries cannot adopt hybrid models.',
          type: 'rebuttal',
          strength: 68,
          targetArgumentId: 'a1',
        },
        {
          id: 'a3',
          debaterId: 'd1',
          content: 'The proposition specifically addresses companies where hybrid is feasible. Not all policies must be universal to be beneficial.',
          type: 'reasoning',
          strength: 65,
          targetArgumentId: 'a2',
        },
        {
          id: 'a4',
          debaterId: 'd2',
          content: 'This creates a two-tier workforce where some employees have flexibility while others do not, potentially causing resentment and retention issues.',
          type: 'claim',
          strength: 70,
        },
        {
          id: 'a5',
          debaterId: 'd1',
          content: 'Companies can offer equivalent benefits to non-remote workers, such as flexible scheduling or compressed work weeks.',
          type: 'rebuttal',
          strength: 60,
          targetArgumentId: 'a4',
        },
      ],
      weakPoints: [
        {
          id: 'wp1',
          argumentId: 'a5',
          debaterId: 'd1',
          vulnerability: 'Lacks specific evidence for equivalent benefit effectiveness',
        },
        {
          id: 'wp2',
          argumentId: 'a4',
          debaterId: 'd2',
          vulnerability: 'Assumes resentment without supporting data',
        },
      ],
    };

    setArena(mockArena);
    setLoading(false);
  }, []);

  const handleRunRound = async () => {
    setRunningRound(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setRunningRound(false);
  };

  if (loading || !arena) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  const proposition = arena.debaters.find(d => d.side === 'proposition')!;
  const opposition = arena.debaters.find(d => d.side === 'opposition')!;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <style>{arenaStyles}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Swords className="w-7 h-7 text-orange-500" />
            Debate Arena
          </h1>
          <p className="text-slate-400 mt-1">Adversarial exploration</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm ${
          arena.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
          arena.status === 'main' ? 'bg-blue-500/20 text-blue-400' :
          'bg-slate-500/20 text-slate-400'
        }`}>
          {arena.status.charAt(0).toUpperCase() + arena.status.slice(1)} Phase
        </span>
      </div>

      {/* Topic */}
      <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 mb-6">
        <div className="text-sm text-slate-400 mb-2">Topic: {arena.topic}</div>
        <h2 className="text-xl font-semibold">&ldquo;{arena.proposition}&rdquo;</h2>
      </div>

      {/* Resolution Meter */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-slate-400 mb-2">
          <span>Resolution Balance</span>
          <span>{arena.resolutionBalance > 0 ? '+' : ''}{arena.resolutionBalance}</span>
        </div>
        <ResolutionMeter balance={arena.resolutionBalance} />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left - Opposition */}
        <div className="col-span-3">
          <DebaterCard debater={opposition} arguments={arena.arguments} />
        </div>

        {/* Center - Arguments */}
        <div className="col-span-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">Argument Flow</h3>
            <button
              onClick={handleRunRound}
              disabled={runningRound || arena.status === 'resolved'}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              {runningRound ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Next Round
                </>
              )}
            </button>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {arena.arguments.map(arg => {
              const debater = arena.debaters.find(d => d.id === arg.debaterId);
              const targetArg = arg.targetArgumentId 
                ? arena.arguments.find(a => a.id === arg.targetArgumentId)
                : undefined;
              const targetDebater = targetArg 
                ? arena.debaters.find(d => d.id === targetArg.debaterId)
                : undefined;

              return (
                <ArgumentFlow
                  key={arg.id}
                  argument={arg}
                  debater={debater}
                  targetArg={targetArg}
                  targetDebater={targetDebater}
                />
              );
            })}
          </div>

          {/* Weak Points */}
          <WeakPointsPanel 
            weakPoints={arena.weakPoints} 
            arguments={arena.arguments}
            debaters={arena.debaters}
          />
        </div>

        {/* Right - Proposition */}
        <div className="col-span-3">
          <DebaterCard debater={proposition} arguments={arena.arguments} />
          
          {/* Steel-man button */}
          <button className="w-full mt-4 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors">
            <Sparkles className="w-4 h-4 text-yellow-500" />
            Generate Steel-Man
          </button>
        </div>
      </div>
    </div>
  );
}
