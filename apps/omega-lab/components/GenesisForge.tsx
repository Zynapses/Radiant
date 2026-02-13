'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Dna,
  Zap,
  Brain,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  MessageSquare,
  Send,
  ArrowLeftRight,
  Save,
  Download,
  Flame,
  Target,
  Activity,
  BarChart3,
  Database,
  Cpu,
} from 'lucide-react';
import {
  getHealth,
  getState,
  bootBrain,
  loadTraining,
  runTraining,
  evaluate,
  infer,
  compare,
  saveCheckpoint,
  loadCheckpoint,
  resetBrain,
  type BrainState,
  type TrainEpoch,
  type TrainRunResult,
  type LoadTrainingResult,
  type InferResult,
  type CompareResult,
  type EvalResult,
} from '@/lib/proving-ground';

// ============================================================================
// Types
// ============================================================================

type Phase = 'connect' | 'boot' | 'load' | 'train' | 'evaluate' | 'infer';

interface ServerHealth {
  status: string;
  device: string;
  brain_booted: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'omega';
  text: string;
  behavior?: string;
  confidence?: number;
  omegaMs?: number;
  llamaMs?: number;
  totalMs?: number;
  topBehaviors?: Array<[string, number]>;
}

// ============================================================================
// GenesisForge — main component
// ============================================================================

export function GenesisForge() {
  const [phase, setPhase] = useState<Phase>('connect');
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [brainState, setBrainState] = useState<BrainState | null>(null);
  const [loadResult, setLoadResult] = useState<LoadTrainingResult | null>(null);
  const [trainResult, setTrainResult] = useState<TrainRunResult | null>(null);
  const [evalResults, setEvalResults] = useState<{ accuracy: number; correct: number; total: number; results: EvalResult[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);

  // ---- Connection check ----
  const checkConnection = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const h = await getHealth();
      setHealth(h);
      if (h.brain_booted) {
        const state = await getState();
        setBrainState(state);
        setPhase('load');
      } else {
        setPhase('boot');
      }
    } catch (e: any) {
      setError(`Cannot reach OMEGA server at localhost:11435. Start it with: python3 server.py`);
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- Boot brain ----
  const doBoot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const state = await bootBrain();
      setBrainState(state);
      setPhase('load');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- Load training data ----
  const doLoad = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadTraining();
      setLoadResult(result);
      setPhase('train');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- Train ----
  const doTrain = useCallback(async (epochs: number = 100) => {
    setLoading(true);
    setError(null);
    setTrainResult(null);
    try {
      const result = await runTraining(epochs, 0.95);
      setTrainResult(result);
      setPhase('evaluate');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- Evaluate ----
  const doEvaluate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await evaluate();
      setEvalResults(result);
      setPhase('infer');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- Infer ----
  const doInfer = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: text.trim(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setCompareResult(null);

    try {
      if (compareMode) {
        const result = await compare(text.trim());
        setCompareResult(result);
        const omegaMsg: ChatMessage = {
          id: `o_${Date.now()}`,
          role: 'omega',
          text: result.omega_response,
          behavior: result.omega?.behavior,
          confidence: result.omega?.confidence,
          omegaMs: result.comparison?.omega_ms,
        };
        setChatMessages((prev) => [...prev, omegaMsg]);
      } else {
        const result = await infer(text.trim());
        const omegaMsg: ChatMessage = {
          id: `o_${Date.now()}`,
          role: 'omega',
          text: result.response,
          behavior: result.omega?.behavior,
          confidence: result.omega?.confidence,
          topBehaviors: result.omega?.top_behaviors,
          omegaMs: result.omega?.processing_ms,
          llamaMs: result.llama?.processing_ms,
          totalMs: result.total_ms,
        };
        setChatMessages((prev) => [...prev, omegaMsg]);
      }
    } catch (e: any) {
      const errMsg: ChatMessage = {
        id: `e_${Date.now()}`,
        role: 'omega',
        text: `Error: ${e.message}`,
      };
      setChatMessages((prev) => [...prev, errMsg]);
    }
  }, [compareMode]);

  // ---- Save/Load checkpoint ----
  const doSave = useCallback(async () => {
    try {
      await saveCheckpoint();
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const doLoadCheckpoint = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadCheckpoint();
      if (result.loaded) {
        setPhase('evaluate');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- Reset ----
  const doReset = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await resetBrain();
      setBrainState(null);
      setLoadResult(null);
      setTrainResult(null);
      setEvalResults(null);
      setChatMessages([]);
      setPhase('boot');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Dna className="w-7 h-7 text-emerald-400 phase-ring" />
            Genesis Forge
          </h2>
          <p className="text-omega-400">
            Create, train, and test an OMEGA brain from scratch
          </p>
        </div>
        <div className="flex items-center gap-2">
          {health && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-emerald-400 font-mono">{health.device.toUpperCase()}</span>
            </div>
          )}
          {brainState?.booted && (
            <button
              onClick={doReset}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20
                         text-red-400 text-xs hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Phase Progress Bar */}
      <PhaseProgress currentPhase={phase} />

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-300 text-sm font-mono">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Phase Content */}
      {phase === 'connect' && (
        <PhaseConnect loading={loading} onConnect={checkConnection} />
      )}

      {phase === 'boot' && (
        <PhaseBoot loading={loading} onBoot={doBoot} onLoadCheckpoint={doLoadCheckpoint} />
      )}

      {phase === 'load' && (
        <PhaseLoad loading={loading} brainState={brainState} onLoad={doLoad} onLoadCheckpoint={doLoadCheckpoint} />
      )}

      {phase === 'train' && (
        <PhaseTrain
          loading={loading}
          loadResult={loadResult}
          trainResult={trainResult}
          onTrain={doTrain}
          onSkip={() => setPhase('evaluate')}
        />
      )}

      {phase === 'evaluate' && (
        <PhaseEvaluate
          loading={loading}
          trainResult={trainResult}
          evalResults={evalResults}
          onEvaluate={doEvaluate}
          onSave={doSave}
          onSkip={() => setPhase('infer')}
        />
      )}

      {phase === 'infer' && (
        <PhaseInfer
          loading={loading}
          chatMessages={chatMessages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          onSend={doInfer}
          compareMode={compareMode}
          setCompareMode={setCompareMode}
          compareResult={compareResult}
          evalResults={evalResults}
        />
      )}
    </div>
  );
}

// ============================================================================
// Phase Progress Bar
// ============================================================================

const PHASES: { key: Phase; label: string; icon: typeof Dna }[] = [
  { key: 'connect', label: 'Connect', icon: Cpu },
  { key: 'boot', label: 'Boot', icon: Zap },
  { key: 'load', label: 'Load Data', icon: Database },
  { key: 'train', label: 'Train', icon: Flame },
  { key: 'evaluate', label: 'Evaluate', icon: Target },
  { key: 'infer', label: 'Infer', icon: MessageSquare },
];

function PhaseProgress({ currentPhase }: { currentPhase: Phase }) {
  const currentIdx = PHASES.findIndex((p) => p.key === currentPhase);

  return (
    <div className="flex items-center gap-1">
      {PHASES.map((p, i) => {
        const Icon = p.icon;
        const isComplete = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isFuture = i > currentIdx;

        return (
          <div key={p.key} className="flex items-center gap-1 flex-1">
            <div
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg transition-all flex-1
                ${isComplete ? 'bg-emerald-500/10 border border-emerald-500/20' : ''}
                ${isCurrent ? 'bg-omega-700/50 border border-omega-500/30 shadow-lg shadow-omega-500/10' : ''}
                ${isFuture ? 'bg-omega-900/30 border border-omega-800/30 opacity-40' : ''}
              `}
            >
              {isComplete ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Icon className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-omega-300' : 'text-omega-600'}`} />
              )}
              <span className={`text-xs font-medium truncate ${isComplete ? 'text-emerald-400' : isCurrent ? 'text-white' : 'text-omega-600'}`}>
                {p.label}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isComplete ? 'text-emerald-500/40' : 'text-omega-700/50'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Phase: Connect
// ============================================================================

function PhaseConnect({ loading, onConnect }: { loading: boolean; onConnect: () => void }) {
  // Auto-connect on mount
  useEffect(() => {
    onConnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="relative mb-6">
        <Cpu className="w-16 h-16 text-omega-400" />
        <div className="absolute inset-0 blur-xl bg-omega-400/20 rounded-full" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">Connecting to OMEGA Server</h3>
      <p className="text-omega-400 text-sm mb-6">Looking for the proving ground at localhost:11435</p>
      <button
        onClick={onConnect}
        disabled={loading}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-omega-600 hover:bg-omega-500
                   text-white font-medium transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
        {loading ? 'Connecting...' : 'Retry Connection'}
      </button>
    </div>
  );
}

// ============================================================================
// Phase: Boot
// ============================================================================

function PhaseBoot({
  loading,
  onBoot,
  onLoadCheckpoint,
}: {
  loading: boolean;
  onBoot: () => void;
  onLoadCheckpoint: () => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <button
        onClick={onBoot}
        disabled={loading}
        className="group flex flex-col items-center gap-4 p-8 rounded-2xl
                   bg-gradient-to-br from-emerald-500/10 to-omega-900/50
                   border border-emerald-500/20 hover:border-emerald-500/40
                   transition-all hover:shadow-lg hover:shadow-emerald-500/10
                   disabled:opacity-50"
      >
        <div className="relative">
          <Brain className="w-14 h-14 text-emerald-400 group-hover:scale-110 transition-transform" />
          <div className="absolute inset-0 blur-lg bg-emerald-400/20 rounded-full" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-1">Boot Fresh Brain</h3>
          <p className="text-omega-400 text-sm">
            Create a new OMEGA cortex with random initial state
          </p>
        </div>
        {loading && <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />}
      </button>

      <button
        onClick={onLoadCheckpoint}
        disabled={loading}
        className="group flex flex-col items-center gap-4 p-8 rounded-2xl
                   bg-gradient-to-br from-amber-500/10 to-omega-900/50
                   border border-amber-500/20 hover:border-amber-500/40
                   transition-all hover:shadow-lg hover:shadow-amber-500/10
                   disabled:opacity-50"
      >
        <div className="relative">
          <Download className="w-14 h-14 text-amber-400 group-hover:scale-110 transition-transform" />
          <div className="absolute inset-0 blur-lg bg-amber-400/20 rounded-full" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-1">Load Checkpoint</h3>
          <p className="text-omega-400 text-sm">
            Restore a previously saved brain with trained weights
          </p>
        </div>
      </button>
    </div>
  );
}

// ============================================================================
// Phase: Load Training Data
// ============================================================================

function PhaseLoad({
  loading,
  brainState,
  onLoad,
  onLoadCheckpoint,
}: {
  loading: boolean;
  brainState: BrainState | null;
  onLoad: () => void;
  onLoadCheckpoint: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Brain Info */}
      {brainState?.booted && brainState.config && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Input Dim" value={brainState.config.input_dim.toLocaleString()} icon={<Activity className="w-4 h-4" />} />
          <StatCard label="Hidden Dim" value={brainState.config.hidden_dim.toLocaleString()} icon={<Brain className="w-4 h-4" />} />
          <StatCard label="Coherence" value={brainState.cortex?.coherence.toFixed(4) ?? '—'} icon={<BarChart3 className="w-4 h-4" />} />
          <StatCard label="Transducer Params" value={brainState.transducer?.params.toLocaleString() ?? '—'} icon={<Cpu className="w-4 h-4" />} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={onLoad}
          disabled={loading}
          className="group flex flex-col items-center gap-4 p-8 rounded-2xl
                     bg-gradient-to-br from-sky-500/10 to-omega-900/50
                     border border-sky-500/20 hover:border-sky-500/40
                     transition-all hover:shadow-lg hover:shadow-sky-500/10
                     disabled:opacity-50"
        >
          <div className="relative">
            <Database className="w-14 h-14 text-sky-400 group-hover:scale-110 transition-transform" />
            <div className="absolute inset-0 blur-lg bg-sky-400/20 rounded-full" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-white mb-1">Load Training Data</h3>
            <p className="text-omega-400 text-sm">
              McDonald&apos;s behavioral dataset + knowledge base + Llama bridge
            </p>
          </div>
          {loading && <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />}
        </button>

        <button
          onClick={onLoadCheckpoint}
          disabled={loading}
          className="group flex flex-col items-center gap-4 p-8 rounded-2xl
                     bg-gradient-to-br from-amber-500/10 to-omega-900/50
                     border border-amber-500/20 hover:border-amber-500/40
                     transition-all hover:shadow-lg hover:shadow-amber-500/10
                     disabled:opacity-50"
        >
          <div className="relative">
            <Download className="w-14 h-14 text-amber-400 group-hover:scale-110 transition-transform" />
            <div className="absolute inset-0 blur-lg bg-amber-400/20 rounded-full" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-white mb-1">Load Checkpoint</h3>
            <p className="text-omega-400 text-sm">
              Skip to inference with previously trained weights
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Phase: Train
// ============================================================================

function PhaseTrain({
  loading,
  loadResult,
  trainResult,
  onTrain,
  onSkip,
}: {
  loading: boolean;
  loadResult: LoadTrainingResult | null;
  trainResult: TrainRunResult | null;
  onTrain: (epochs: number) => void;
  onSkip: () => void;
}) {
  const [epochs, setEpochs] = useState(100);

  return (
    <div className="space-y-6">
      {/* Loaded Data Summary */}
      {loadResult && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Training Examples" value={loadResult.training_examples.toString()} icon={<Database className="w-4 h-4" />} />
          <StatCard label="Behavior Types" value={loadResult.behavior_types.toString()} icon={<Target className="w-4 h-4" />} />
          <StatCard label="Codebook Size" value={loadResult.codebook_size.toString()} icon={<BarChart3 className="w-4 h-4" />} />
          <StatCard
            label="Llama"
            value={loadResult.llama_available ? loadResult.llama_model : 'Unavailable'}
            icon={<Brain className="w-4 h-4" />}
            color={loadResult.llama_available ? 'emerald' : 'amber'}
          />
        </div>
      )}

      {/* Training Controls */}
      <div className="bg-omega-900/50 rounded-xl border border-omega-800/50 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Wirtinger E-Prop Training</h3>
            <p className="text-omega-500 text-sm mt-0.5">
              No backpropagation. No computation graph. Pure physics-based learning.
            </p>
          </div>
          <button
            onClick={onSkip}
            className="text-omega-500 hover:text-omega-300 text-sm transition-colors"
          >
            Skip →
          </button>
        </div>

        <div className="flex items-end gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm text-omega-400 mb-1">Epochs</label>
            <input
              type="number"
              value={epochs}
              onChange={(e) => setEpochs(Number(e.target.value))}
              min={1}
              max={500}
              disabled={loading}
              className="w-full px-4 py-2 bg-omega-800/50 border border-omega-700/50 rounded-lg
                         text-white font-mono focus:outline-none focus:border-omega-500
                         disabled:opacity-50"
            />
          </div>
          <button
            onClick={() => onTrain(epochs)}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl
                       bg-gradient-to-r from-orange-600 to-red-600
                       hover:from-orange-500 hover:to-red-500
                       text-white font-semibold transition-all
                       disabled:opacity-50 shadow-lg shadow-red-900/20"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Flame className="w-5 h-5" />}
            {loading ? 'Training...' : 'Train'}
          </button>
        </div>

        {/* Training Progress */}
        {loading && !trainResult && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-orange-500/5 border border-orange-500/20">
            <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
            <span className="text-orange-300 text-sm">Training in progress — Wirtinger eligibility traces accumulating...</span>
          </div>
        )}

        {/* Training Results */}
        {trainResult && (
          <TrainingResultsPanel result={trainResult} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Training Results Panel
// ============================================================================

function TrainingResultsPanel({ result }: { result: TrainRunResult }) {
  const maxAcc = result.best_accuracy;
  const finalAcc = result.final_accuracy;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
          <div className="text-2xl font-bold text-emerald-400 font-mono">{(finalAcc * 100).toFixed(1)}%</div>
          <div className="text-xs text-emerald-500 mt-1">Final Accuracy</div>
        </div>
        <div className="p-4 rounded-xl bg-omega-500/5 border border-omega-500/20 text-center">
          <div className="text-2xl font-bold text-omega-300 font-mono">{(maxAcc * 100).toFixed(1)}%</div>
          <div className="text-xs text-omega-500 mt-1">Best Accuracy</div>
        </div>
        <div className="p-4 rounded-xl bg-sky-500/5 border border-sky-500/20 text-center">
          <div className="text-2xl font-bold text-sky-400 font-mono">{result.epochs_run}</div>
          <div className="text-xs text-sky-500 mt-1">Epochs Run</div>
        </div>
      </div>

      {/* Accuracy Chart (ASCII-style bar chart) */}
      <div className="bg-omega-900/80 rounded-xl border border-omega-800/50 p-4">
        <h4 className="text-sm font-medium text-omega-300 mb-3">Accuracy Curve</h4>
        <div className="flex items-end gap-px h-32">
          {result.history.map((epoch, i) => {
            const height = Math.max(2, epoch.behavior_accuracy * 100);
            const isLast = i === result.history.length - 1;
            const color = epoch.behavior_accuracy >= 0.9
              ? 'bg-emerald-500'
              : epoch.behavior_accuracy >= 0.5
                ? 'bg-omega-400'
                : epoch.behavior_accuracy >= 0.2
                  ? 'bg-amber-500'
                  : 'bg-red-500';

            return (
              <div
                key={epoch.epoch}
                className="flex-1 flex flex-col justify-end group relative"
                title={`Epoch ${epoch.epoch}: ${(epoch.behavior_accuracy * 100).toFixed(1)}%`}
              >
                <div
                  className={`${color} ${isLast ? 'opacity-100' : 'opacity-60'} rounded-t-sm transition-all
                              group-hover:opacity-100 min-w-[2px]`}
                  style={{ height: `${height}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-xs text-omega-600 font-mono">
          <span>Epoch 1</span>
          <span>Epoch {result.epochs_run}</span>
        </div>
      </div>

      {/* Per-Behavior Breakdown (last epoch) */}
      {result.history.length > 0 && (
        <div className="bg-omega-900/80 rounded-xl border border-omega-800/50 p-4">
          <h4 className="text-sm font-medium text-omega-300 mb-3">Per-Behavior Accuracy (Final Epoch)</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(result.history[result.history.length - 1].per_behavior_accuracy)
              .sort(([, a], [, b]) => b - a)
              .map(([behavior, acc]) => (
                <div key={behavior} className="flex items-center gap-2 text-xs">
                  <div className="flex-1 truncate font-mono text-omega-400">{behavior}</div>
                  <div
                    className={`font-mono font-bold ${
                      acc >= 1 ? 'text-emerald-400' : acc >= 0.5 ? 'text-amber-400' : 'text-red-400'
                    }`}
                  >
                    {(acc * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Phase: Evaluate
// ============================================================================

function PhaseEvaluate({
  loading,
  trainResult,
  evalResults,
  onEvaluate,
  onSave,
  onSkip,
}: {
  loading: boolean;
  trainResult: TrainRunResult | null;
  evalResults: { accuracy: number; correct: number; total: number; results: EvalResult[] } | null;
  onEvaluate: () => void;
  onSave: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={onEvaluate}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl
                     bg-gradient-to-r from-sky-600 to-cyan-600
                     hover:from-sky-500 hover:to-cyan-500
                     text-white font-semibold transition-all
                     disabled:opacity-50 shadow-lg shadow-sky-900/20"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Target className="w-5 h-5" />}
          {loading ? 'Evaluating...' : 'Run Evaluation'}
        </button>
        <button
          onClick={onSave}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-omega-700 hover:bg-omega-600
                     text-white text-sm transition-colors"
        >
          <Save className="w-4 h-4" />
          Save Checkpoint
        </button>
        <button
          onClick={onSkip}
          className="text-omega-500 hover:text-omega-300 text-sm transition-colors ml-auto"
        >
          Skip to Inference →
        </button>
      </div>

      {/* Evaluation Results */}
      {evalResults && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                {(evalResults.accuracy * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-emerald-500 mt-1">Accuracy</div>
            </div>
            <div className="p-4 rounded-xl bg-sky-500/5 border border-sky-500/20 text-center">
              <div className="text-2xl font-bold text-sky-400 font-mono">{evalResults.correct}</div>
              <div className="text-xs text-sky-500 mt-1">Correct</div>
            </div>
            <div className="p-4 rounded-xl bg-omega-500/5 border border-omega-500/20 text-center">
              <div className="text-2xl font-bold text-omega-300 font-mono">{evalResults.total}</div>
              <div className="text-xs text-omega-500 mt-1">Total</div>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-omega-900/80 rounded-xl border border-omega-800/50 overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-omega-900">
                  <tr className="border-b border-omega-800/50">
                    <th className="text-left px-4 py-2 text-omega-400 font-medium">Input</th>
                    <th className="text-left px-4 py-2 text-omega-400 font-medium">Expected</th>
                    <th className="text-left px-4 py-2 text-omega-400 font-medium">Decoded</th>
                    <th className="text-right px-4 py-2 text-omega-400 font-medium">Conf</th>
                    <th className="text-center px-4 py-2 text-omega-400 font-medium">✓</th>
                  </tr>
                </thead>
                <tbody>
                  {evalResults.results.map((r, i) => (
                    <tr key={i} className={`border-b border-omega-800/30 ${r.correct ? '' : 'bg-red-500/5'}`}>
                      <td className="px-4 py-2 text-omega-300 truncate max-w-[200px]" title={r.input}>
                        {r.input}
                      </td>
                      <td className="px-4 py-2 text-omega-400 font-mono text-xs">{r.expected_behavior}</td>
                      <td className={`px-4 py-2 font-mono text-xs ${r.correct ? 'text-emerald-400' : 'text-red-400'}`}>
                        {r.decoded_behavior}
                      </td>
                      <td className="px-4 py-2 text-right text-omega-300 font-mono text-xs">
                        {(r.confidence * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-2 text-center">
                        {r.correct ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 inline" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Phase: Infer (Chat Interface)
// ============================================================================

function PhaseInfer({
  loading,
  chatMessages,
  chatInput,
  setChatInput,
  onSend,
  compareMode,
  setCompareMode,
  compareResult,
  evalResults,
}: {
  loading: boolean;
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (v: string) => void;
  onSend: (text: string) => void;
  compareMode: boolean;
  setCompareMode: (v: boolean) => void;
  compareResult: CompareResult | null;
  evalResults: { accuracy: number; correct: number; total: number; results: EvalResult[] } | null;
}) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend(chatInput);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Chat Area (2/3) */}
      <div className="lg:col-span-2 flex flex-col">
        {/* Mode Toggle */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setCompareMode(false)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm
              ${!compareMode ? 'bg-omega-600 text-white' : 'text-omega-400 hover:bg-omega-800/50'}`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </button>
          <button
            onClick={() => setCompareMode(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm
              ${compareMode ? 'bg-omega-600 text-white' : 'text-omega-400 hover:bg-omega-800/50'}`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            Compare
          </button>
          {evalResults && (
            <span className="ml-auto text-xs text-omega-500 font-mono">
              Eval: {(evalResults.accuracy * 100).toFixed(1)}% ({evalResults.correct}/{evalResults.total})
            </span>
          )}
        </div>

        {/* Chat Messages */}
        <div className="flex-1 min-h-[400px] max-h-[600px] overflow-y-auto bg-omega-900/50 rounded-xl border border-omega-800/50 p-4 space-y-4 mb-4">
          {chatMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-omega-500">
              <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Ask the OMEGA brain something</p>
              <p className="text-xs text-omega-600 mt-1">
                Try: &quot;How much is a Big Mac?&quot; or &quot;I&apos;m allergic to gluten&quot;
              </p>
            </div>
          )}

          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-omega-600 text-white rounded-br-md'
                    : 'bg-omega-800/50 border border-omega-700/50 text-omega-200 rounded-bl-md'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                {msg.role === 'omega' && msg.behavior && (
                  <div className="mt-2 pt-2 border-t border-omega-700/30 flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono">
                      {msg.behavior}
                    </span>
                    {msg.confidence !== undefined && (
                      <span className="px-2 py-0.5 rounded-full bg-omega-500/10 text-omega-300 font-mono">
                        {(msg.confidence * 100).toFixed(1)}%
                      </span>
                    )}
                    {msg.omegaMs !== undefined && (
                      <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 font-mono">
                        Ω {msg.omegaMs.toFixed(0)}ms
                      </span>
                    )}
                    {msg.llamaMs !== undefined && msg.llamaMs > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-mono">
                        🦙 {msg.llamaMs.toFixed(0)}ms
                      </span>
                    )}
                    {msg.totalMs !== undefined && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono">
                        Σ {msg.totalMs.toFixed(0)}ms
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Compare Side-by-Side */}
          {compareMode && compareResult && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Dna className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-400">OMEGA + Llama</span>
                  <span className="ml-auto text-xs text-emerald-500 font-mono">
                    {compareResult.comparison?.omega_ms?.toFixed(0)}ms
                  </span>
                </div>
                <p className="text-sm text-omega-200">{compareResult.omega_response}</p>
              </div>
              <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-semibold text-red-400">Raw Llama (no OMEGA)</span>
                  <span className="ml-auto text-xs text-red-500 font-mono">
                    {compareResult.comparison?.raw_ms?.toFixed(0)}ms
                  </span>
                </div>
                <p className="text-sm text-omega-200">{compareResult.raw_response}</p>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={compareMode ? 'Ask to compare OMEGA vs raw Llama...' : 'Ask the OMEGA brain...'}
            className="flex-1 px-4 py-3 bg-omega-800/50 border border-omega-700/50 rounded-xl
                       text-white placeholder-omega-500 focus:outline-none focus:border-omega-500
                       text-sm"
          />
          <button
            onClick={() => onSend(chatInput)}
            disabled={!chatInput.trim()}
            className="p-3 rounded-xl bg-omega-600 hover:bg-omega-500 text-white
                       transition-colors disabled:opacity-30"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Quick Prompts (1/3) */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-omega-300">Quick Prompts</h3>
        <div className="space-y-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt.text}
              onClick={() => onSend(prompt.text)}
              className="w-full text-left px-4 py-3 rounded-xl bg-omega-900/50 border border-omega-800/50
                         hover:border-omega-700/50 hover:bg-omega-800/30 transition-all group"
            >
              <div className="text-sm text-omega-300 group-hover:text-white transition-colors">
                {prompt.text}
              </div>
              <div className="text-xs text-omega-600 mt-0.5">
                Expected: <span className="text-omega-500 font-mono">{prompt.expected}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Shared Components
// ============================================================================

function StatCard({
  label,
  value,
  icon,
  color = 'omega',
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: 'omega' | 'emerald' | 'amber' | 'sky';
}) {
  const colorMap = {
    omega: 'bg-omega-500/5 border-omega-500/20 text-omega-300',
    emerald: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300',
    amber: 'bg-amber-500/5 border-amber-500/20 text-amber-300',
    sky: 'bg-sky-500/5 border-sky-500/20 text-sky-300',
  };

  return (
    <div className={`p-4 rounded-xl border ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-omega-500">{icon}</span>
        <span className="text-xs text-omega-500">{label}</span>
      </div>
      <div className="text-lg font-bold font-mono">{value}</div>
    </div>
  );
}

// ============================================================================
// Quick Prompts
// ============================================================================

const QUICK_PROMPTS = [
  { text: 'How much is a Big Mac?', expected: 'price_inquiry' },
  { text: 'Hi, I\'d like to place an order', expected: 'greet' },
  { text: 'Can I get a Quarter Pounder meal?', expected: 'take_order' },
  { text: 'I\'m allergic to gluten, what can I eat?', expected: 'allergen_alert' },
  { text: 'What do you recommend?', expected: 'recommend' },
  { text: 'Can I upgrade to a large fries?', expected: 'size_selection' },
  { text: 'How many calories in a McFlurry?', expected: 'nutrition_inquiry' },
  { text: 'The ice cream machine is broken again?', expected: 'machine_down' },
  { text: 'I want to change my order', expected: 'order_modify' },
  { text: 'Do you have any deals right now?', expected: 'value_recommendation' },
];
