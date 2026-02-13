'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Activity,
  Zap,
  Play,
  Pause,
  RotateCcw,
  Send,
  Cpu,
  Waves,
  Target,
  TrendingUp,
  Timer,
  Gauge,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from 'recharts';
import {
  getState,
  getHealth,
  think,
  loadTraining,
  runTraining,
  getTrainStatus,
  infer,
  type BrainState,
  type ThinkResult,
  type TrainEpoch,
} from '@/lib/proving-ground';

// ─── Phase Wheel Canvas ─────────────────────────────────────────────────────

function PhaseWheel({
  phases,
  magnitudes,
  size = 280,
}: {
  phases: number[];
  magnitudes: number[];
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const maxR = size / 2 - 24;
    const numBins = phases.length || 32;
    const binAngle = (Math.PI * 2) / numBins;

    const maxPhaseVal = Math.max(...(phases.length ? phases : [1]), 0.001);
    const maxMagVal = Math.max(...(magnitudes.length ? magnitudes : [1]), 0.001);

    function draw() {
      timeRef.current += 0.008;
      ctx.clearRect(0, 0, size, size);

      // Background rings with subtle pulse
      const pulse = 0.06 + Math.sin(timeRef.current) * 0.02;
      ctx.strokeStyle = `rgba(139, 92, 246, ${pulse})`;
      ctx.lineWidth = 0.5;
      for (let r = maxR * 0.2; r <= maxR; r += maxR * 0.2) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Axis lines
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.04)';
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
        ctx.stroke();
      }

      if (phases.length === 0) {
        // Empty state — draw pulsing ring
        ctx.strokeStyle = `rgba(139, 92, 246, ${0.2 + Math.sin(timeRef.current * 2) * 0.1})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * 0.5, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Draw phase histogram as polar sectors with glow
        for (let i = 0; i < numBins; i++) {
          const startAngle = -Math.PI + i * binAngle - Math.PI / 2;
          const endAngle = startAngle + binAngle;

          // Phase bin height = how many neurons have this phase
          const phaseNorm = phases[i] / maxPhaseVal;
          // Magnitude bin intensity = average magnitude in this range
          const magNorm = magnitudes[i] ? magnitudes[i] / maxMagVal : 0;

          const r = (0.15 + phaseNorm * 0.85) * maxR;
          const hue = (i / numBins) * 360;
          const lightness = 45 + magNorm * 20;
          const alpha = 0.25 + phaseNorm * 0.55;

          // Glow layer
          ctx.fillStyle = `hsla(${hue}, 75%, ${lightness}%, ${alpha * 0.3})`;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, r + 6, startAngle, endAngle);
          ctx.closePath();
          ctx.fill();

          // Main sector
          ctx.fillStyle = `hsla(${hue}, 75%, ${lightness}%, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, r, startAngle, endAngle);
          ctx.closePath();
          ctx.fill();

          // Bright edge
          ctx.strokeStyle = `hsla(${hue}, 80%, 70%, ${alpha * 0.6})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(cx, cy, r, startAngle, endAngle);
          ctx.stroke();
        }
      }

      // Center glow
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12);
      grad.addColorStop(0, 'rgba(139, 92, 246, 0.6)');
      grad.addColorStop(1, 'rgba(139, 92, 246, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.fill();

      // Center dot
      ctx.fillStyle = 'rgba(139, 92, 246, 0.9)';
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Labels
      ctx.fillStyle = 'rgba(139, 92, 246, 0.35)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('0', cx + maxR + 14, cy + 4);
      ctx.fillText('\u03C0/2', cx, cy - maxR - 8);
      ctx.fillText('\u03C0', cx - maxR - 14, cy + 4);
      ctx.fillText('-\u03C0/2', cx, cy + maxR + 14);

      animRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => cancelAnimationFrame(animRef.current);
  }, [phases, magnitudes, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="rounded-xl"
    />
  );
}

// ─── Coherence Gauge ─────────────────────────────────────────────────────────

function CoherenceGauge({ value, label }: { value: number; label: string }) {
  const percentage = Math.min(Math.max(value * 100, 0), 100);
  const strokeDasharray = 251.2; // 2 * PI * 40
  const strokeDashoffset = strokeDasharray * (1 - percentage / 100);

  const color =
    percentage > 60
      ? 'text-green-400'
      : percentage > 30
        ? 'text-yellow-400'
        : 'text-red-400';

  const glowColor =
    percentage > 60
      ? 'drop-shadow(0 0 8px rgba(74, 222, 128, 0.5))'
      : percentage > 30
        ? 'drop-shadow(0 0 8px rgba(250, 204, 21, 0.5))'
        : 'drop-shadow(0 0 8px rgba(248, 113, 113, 0.5))';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full -rotate-90"
          style={{ filter: glowColor }}
        >
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-omega-800/30"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className={`${color} transition-all duration-700`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-bold ${color}`}>
            {percentage.toFixed(1)}%
          </span>
        </div>
      </div>
      <span className="text-xs text-omega-400 mt-1">{label}</span>
    </div>
  );
}

// ─── Behavior Decode Bar ─────────────────────────────────────────────────────

function BehaviorDecode({
  topK,
}: {
  topK: Array<[string, number]>;
}) {
  if (!topK?.length) return null;

  const maxConf = Math.max(...topK.map(([, c]) => c), 0.01);

  return (
    <div className="space-y-2">
      {topK.map(([behavior, confidence], i) => (
        <motion.div
          key={behavior}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center gap-3"
        >
          <span className="text-xs text-omega-400 w-28 truncate font-mono">
            {behavior}
          </span>
          <div className="flex-1 h-5 bg-omega-800/50 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                i === 0
                  ? 'bg-gradient-to-r from-omega-500 to-purple-500'
                  : 'bg-omega-600/50'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${(confidence / maxConf) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <span
            className={`text-xs font-mono w-14 text-right ${
              i === 0 ? 'text-white font-bold' : 'text-omega-400'
            }`}
          >
            {(confidence * 100).toFixed(1)}%
          </span>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Main Q-Node Visualization ───────────────────────────────────────────────

export function QNodeViz() {
  const [inferenceLog, setInferenceLog] = useState<ThinkResult[]>([]);
  const [trainingHistory, setTrainingHistory] = useState<TrainEpoch[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTraining, setIsTraining] = useState(false);
  const [lastInfer, setLastInfer] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Live brain state polling
  const { data: brainState, refetch: refetchState } = useQuery({
    queryKey: ['pg-state'],
    queryFn: getState,
    refetchInterval: autoRefresh ? 1000 : false,
    retry: 1,
  });

  const { data: health } = useQuery({
    queryKey: ['pg-health'],
    queryFn: getHealth,
    refetchInterval: 5000,
    retry: 1,
  });

  const { data: trainStatus, refetch: refetchTrain } = useQuery({
    queryKey: ['pg-train-status'],
    queryFn: getTrainStatus,
    refetchInterval: autoRefresh ? 2000 : false,
    retry: 1,
  });

  // Load training on first render if not loaded
  const loadMutation = useMutation({
    mutationFn: () => loadTraining(),
    onSuccess: () => refetchTrain(),
  });

  // Think mutation
  const thinkMutation = useMutation({
    mutationFn: (text: string) => think(text),
    onSuccess: (result) => {
      setInferenceLog((prev) => [...prev.slice(-49), result]);
      refetchState();
    },
  });

  // Infer mutation (OMEGA + Llama)
  const inferMutation = useMutation({
    mutationFn: (text: string) => infer(text),
    onSuccess: (result) => {
      setLastInfer(result);
      refetchState();
    },
  });

  // Train mutation
  const trainMutation = useMutation({
    mutationFn: (params: { epochs: number; target: number }) =>
      runTraining(params.epochs, params.target),
    onMutate: () => setIsTraining(true),
    onSuccess: (result) => {
      if (result.history) {
        setTrainingHistory((prev) => [...prev, ...result.history]);
      }
      setIsTraining(false);
      refetchTrain();
    },
    onError: () => setIsTraining(false),
  });

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;
    if (trainStatus?.is_trained) {
      inferMutation.mutate(inputText.trim());
    } else {
      thinkMutation.mutate(inputText.trim());
    }
    setInputText('');
  }, [inputText, trainStatus, inferMutation, thinkMutation]);

  // Coherence history for chart
  const coherenceHistory = useMemo(
    () =>
      inferenceLog.map((r, i) => ({
        idx: i,
        pre: r.pre_coherence,
        post: r.post_coherence,
        delta: r.coherence_delta,
        latency: r.latency_ms,
      })),
    [inferenceLog]
  );

  // Training chart data
  const trainChartData = useMemo(() => {
    const history = trainingHistory;
    return history.map((e: TrainEpoch) => ({
      epoch: e.epoch,
      loss: e.avg_loss,
      accuracy: e.behavior_accuracy * 100,
      lr: e.learning_rate,
      ms: e.elapsed_ms,
    }));
  }, [trainingHistory]);

  // Phase/magnitude histograms from the server (32 bins each)
  const phaseHist = brainState?.cortex?.phase_histogram || [];
  const magHist = brainState?.cortex?.magnitude_histogram || [];
  const connected = !!health?.status;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="relative">
              <Brain className="w-8 h-8 text-omega-400" />
              {connected && (
                <motion.div
                  className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                />
              )}
            </div>
            Q-Node Live
          </h2>
          <p className="text-omega-400 text-sm mt-1">
            Real-time phase dynamics visualization
            {health?.device && (
              <span className="ml-2 px-2 py-0.5 rounded bg-omega-800/80 text-omega-300 text-xs font-mono">
                {health.device.toUpperCase()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
              autoRefresh
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-omega-800/50 border border-omega-700/30 text-omega-400'
            }`}
          >
            {autoRefresh ? (
              <Activity className="w-4 h-4 animate-pulse" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
        </div>
      </div>

      {/* ── Top Row: Phase Wheel + Gauges + Behavior ── */}
      <div className="grid grid-cols-12 gap-6">
        {/* Phase Wheel */}
        <div className="col-span-4 bg-omega-900/50 rounded-xl border border-omega-800/50 p-5">
          <h3 className="text-sm font-semibold text-omega-300 mb-4 flex items-center gap-2">
            <Waves className="w-4 h-4 text-omega-400" />
            Phase Space
          </h3>
          <div className="flex justify-center">
            <PhaseWheel phases={phaseHist} magnitudes={magHist} size={260} />
          </div>
          <div className="mt-3 text-center text-xs text-omega-500">
            {brainState?.config?.hidden_dim?.toLocaleString() ?? '—'} neurons • 32 bins •
            phase → color • magnitude → radius
          </div>
        </div>

        {/* Gauges */}
        <div className="col-span-4 bg-omega-900/50 rounded-xl border border-omega-800/50 p-5">
          <h3 className="text-sm font-semibold text-omega-300 mb-4 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-omega-400" />
            Brain Vitals
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <CoherenceGauge
              value={brainState?.cortex?.coherence ?? 0}
              label="Coherence"
            />
            <CoherenceGauge
              value={Math.min((brainState?.cortex?.state_norm ?? 0) / 100, 1)}
              label="State Norm"
            />
            <CoherenceGauge
              value={brainState?.ambition?.dopamine ?? 0}
              label="Dopamine"
            />
            <CoherenceGauge
              value={brainState?.ambition?.curiosity ?? 0}
              label="Curiosity"
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="bg-omega-800/30 rounded-lg p-2.5">
              <span className="text-omega-500">Inferences</span>
              <div className="text-white font-bold text-lg">
                {brainState?.inference_count ?? 0}
              </div>
            </div>
            <div className="bg-omega-800/30 rounded-lg p-2.5">
              <span className="text-omega-500">Uptime</span>
              <div className="text-white font-bold text-lg">
                {brainState?.uptime_seconds
                  ? `${Math.floor(brainState.uptime_seconds / 60)}m`
                  : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Behavior Decode / Last Inference */}
        <div className="col-span-4 bg-omega-900/50 rounded-xl border border-omega-800/50 p-5">
          <h3 className="text-sm font-semibold text-omega-300 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-omega-400" />
            Behavior Decode
          </h3>
          {lastInfer ? (
            <>
              <BehaviorDecode topK={lastInfer.top_k || []} />
              <div className="mt-4 p-3 bg-omega-800/30 rounded-lg">
                <div className="text-xs text-omega-500 mb-1">Llama Response</div>
                <div className="text-sm text-omega-200 line-clamp-4">
                  {lastInfer.llama_response || '—'}
                </div>
              </div>
              <div className="mt-2 flex gap-2 text-xs text-omega-500">
                <span>
                  OMEGA: {lastInfer.omega_latency_ms?.toFixed(0) ?? '?'}ms
                </span>
                <span>•</span>
                <span>
                  Llama: {lastInfer.llama_latency_ms?.toFixed(0) ?? '?'}ms
                </span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-omega-500 text-sm">
              <Target className="w-8 h-8 mb-2 opacity-30" />
              Send a message to see behavior decode
            </div>
          )}
        </div>
      </div>

      {/* ── Input Bar ── */}
      <div className="bg-omega-900/50 rounded-xl border border-omega-800/50 p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Send a thought to OMEGA..."
            className="flex-1 bg-omega-800/50 border border-omega-700/30 rounded-lg px-4 py-2.5 text-white placeholder:text-omega-500 focus:outline-none focus:border-omega-500/50 focus:ring-1 focus:ring-omega-500/20"
          />
          <button
            onClick={handleSend}
            disabled={
              !inputText.trim() ||
              thinkMutation.isPending ||
              inferMutation.isPending
            }
            className="px-5 py-2.5 rounded-lg bg-omega-600 hover:bg-omega-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium flex items-center gap-2 transition-all"
          >
            <Send className="w-4 h-4" />
            {trainStatus?.is_trained ? 'Infer' : 'Think'}
          </button>
        </div>
      </div>

      {/* ── Bottom Row: Training + Coherence History ── */}
      <div className="grid grid-cols-12 gap-6">
        {/* Training Panel */}
        <div className="col-span-7 bg-omega-900/50 rounded-xl border border-omega-800/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-omega-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-omega-400" />
              Training
            </h3>
            <div className="flex items-center gap-2">
              {!trainStatus?.trainer_initialized && (
                <button
                  onClick={() => loadMutation.mutate()}
                  disabled={loadMutation.isPending}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs hover:bg-blue-600/30 transition-all disabled:opacity-50"
                >
                  {loadMutation.isPending ? 'Loading...' : 'Load Data'}
                </button>
              )}
              {trainStatus?.trainer_initialized && (
                <button
                  onClick={() =>
                    trainMutation.mutate({ epochs: 50, target: 0.95 })
                  }
                  disabled={isTraining}
                  className="px-3 py-1.5 rounded-lg bg-green-600/20 border border-green-500/30 text-green-400 text-xs hover:bg-green-600/30 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isTraining ? (
                    <>
                      <div className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                      Training...
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" /> Train 50 Epochs
                    </>
                  )}
                </button>
              )}
              {trainStatus?.is_trained && (
                <span className="px-2 py-1 rounded bg-green-500/10 text-green-400 text-xs font-medium">
                  Best: {((trainStatus.best_accuracy ?? 0) * 100).toFixed(1)}%
                </span>
              )}
            </div>
          </div>

          {trainChartData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trainChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1b4b22" />
                  <XAxis
                    dataKey="epoch"
                    stroke="#6b7280"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="loss"
                    stroke="#6b7280"
                    fontSize={11}
                    tickLine={false}
                    domain={[0, 'auto']}
                  />
                  <YAxis
                    yAxisId="acc"
                    orientation="right"
                    stroke="#6b7280"
                    fontSize={11}
                    tickLine={false}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e1033',
                      border: '1px solid #4c1d95',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    yAxisId="loss"
                    type="monotone"
                    dataKey="loss"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                    name="Loss"
                  />
                  <Line
                    yAxisId="acc"
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    dot={false}
                    name="Accuracy %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-omega-500 text-sm">
              <div className="text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Load data & train to see curves
              </div>
            </div>
          )}

          {/* Per-epoch speed */}
          {trainChartData.length > 0 && (
            <div className="mt-3 flex gap-4 text-xs text-omega-500">
              <span>
                Epochs: {trainChartData.length}
              </span>
              <span>
                Avg:{' '}
                {(
                  trainChartData.reduce((s: number, d: any) => s + d.ms, 0) /
                  trainChartData.length
                ).toFixed(0)}
                ms/epoch
              </span>
              <span>
                Final loss: {trainChartData[trainChartData.length - 1]?.loss.toFixed(4)}
              </span>
            </div>
          )}
        </div>

        {/* Coherence History */}
        <div className="col-span-5 bg-omega-900/50 rounded-xl border border-omega-800/50 p-5">
          <h3 className="text-sm font-semibold text-omega-300 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-omega-400" />
            Coherence History
          </h3>
          {coherenceHistory.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={coherenceHistory}>
                  <defs>
                    <linearGradient
                      id="coherenceGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop
                        offset="95%"
                        stopColor="#8b5cf6"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1b4b22" />
                  <XAxis
                    dataKey="idx"
                    stroke="#6b7280"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={11}
                    tickLine={false}
                    domain={[0, 1]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e1033',
                      border: '1px solid #4c1d95',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="post"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#coherenceGrad)"
                    name="Post-think"
                  />
                  <Line
                    type="monotone"
                    dataKey="pre"
                    stroke="#6366f1"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    dot={false}
                    name="Pre-think"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-omega-500 text-sm">
              <div className="text-center">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Send thoughts to see coherence evolution
              </div>
            </div>
          )}

          {/* Recent inferences */}
          {inferenceLog.length > 0 && (
            <div className="mt-3 space-y-1 max-h-24 overflow-y-auto">
              {inferenceLog
                .slice(-5)
                .reverse()
                .map((r, i) => (
                  <div
                    key={r.inference_id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-omega-500">
                      #{r.inference_id}
                    </span>
                    <span
                      className={
                        r.coherence_delta > 0
                          ? 'text-green-400'
                          : 'text-red-400'
                      }
                    >
                      Δ{r.coherence_delta > 0 ? '+' : ''}
                      {r.coherence_delta.toFixed(4)}
                    </span>
                    <span className="text-omega-500">
                      {r.latency_ms.toFixed(0)}ms
                    </span>
                    <span
                      className={
                        r.is_safe ? 'text-green-500' : 'text-red-500'
                      }
                    >
                      {r.is_safe ? '✓ safe' : '✗ blocked'}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
