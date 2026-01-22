'use client';

/**
 * RADIANT v5.44.0 - Cognitive Load Monitor UI
 * Attention heatmap, fatigue indicators, and adaptive UI recommendations
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, Brain, AlertTriangle, TrendingUp, TrendingDown,
  Clock, Eye, Zap, Battery, BatteryLow, BatteryWarning,
  RefreshCw, Settings, BarChart3
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface CognitiveMetrics {
  overallLoad: number;
  attentionScore: number;
  fatigueLevel: number;
  comprehensionRate: number;
  decisionQuality: number;
  sessionDuration: number;
}

interface AttentionZone {
  id: string;
  area: string;
  attention: number;
  timeSpent: number;
  interactions: number;
}

interface FatigueIndicator {
  id: string;
  type: 'response_time' | 'error_rate' | 'engagement' | 'pattern_deviation';
  severity: 'low' | 'medium' | 'high';
  value: number;
  threshold: number;
  trend: 'improving' | 'stable' | 'declining';
  description: string;
}

interface AdaptiveRecommendation {
  id: string;
  type: 'simplify' | 'break' | 'focus' | 'reduce' | 'assist';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  action: string;
  estimatedImpact: number;
}

interface OverwhelmWarning {
  active: boolean;
  level: number;
  triggerFactors: string[];
  suggestedActions: string[];
}

// =============================================================================
// STYLES
// =============================================================================

const cognitiveStyles = `
  @keyframes load-pulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }
  @keyframes fatigue-wave {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  @keyframes overwhelm-breathing {
    0%, 100% { border-color: rgba(239, 68, 68, 0.3); }
    50% { border-color: rgba(239, 68, 68, 0.8); }
  }
  @keyframes attention-heat {
    0%, 100% { background-color: rgba(34, 197, 94, 0.1); }
    50% { background-color: rgba(34, 197, 94, 0.2); }
  }
`;

// =============================================================================
// COGNITIVE GAUGE
// =============================================================================

function CognitiveGauge({ 
  label, 
  value, 
  icon: Icon, 
  color,
  warning 
}: { 
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  warning?: boolean;
}) {
  const percentage = Math.round(value * 100);
  
  return (
    <div className={`p-4 bg-slate-800 rounded-xl border ${warning ? 'border-red-500/50' : 'border-slate-700'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${color}`} />
          <span className="text-sm text-slate-300">{label}</span>
        </div>
        {warning && <AlertTriangle className="w-4 h-4 text-red-400" />}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-white">{percentage}%</span>
        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden mb-1">
          <div 
            className="h-full rounded-full transition-all duration-500"
            style={{ 
              width: `${percentage}%`,
              backgroundColor: warning ? '#ef4444' : color.includes('green') ? '#22c55e' : 
                color.includes('blue') ? '#3b82f6' : color.includes('amber') ? '#f59e0b' : '#8b5cf6'
            }}
          />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// ATTENTION HEATMAP
// =============================================================================

function AttentionHeatmap({ zones }: { zones: AttentionZone[] }) {
  const maxAttention = Math.max(...zones.map(z => z.attention));

  return (
    <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
      <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
        <Eye className="w-4 h-4 text-cyan-400" />
        Attention Heatmap
      </h3>
      <div className="space-y-2">
        {zones.map(zone => {
          const intensity = zone.attention / maxAttention;
          return (
            <div 
              key={zone.id}
              className="p-3 rounded-lg transition-all"
              style={{ 
                backgroundColor: `rgba(34, 197, 94, ${intensity * 0.3})`,
                animation: intensity > 0.7 ? 'attention-heat 2s ease-in-out infinite' : 'none'
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white">{zone.area}</span>
                <span className="text-xs text-slate-400">{Math.round(zone.attention * 100)}%</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>{Math.round(zone.timeSpent / 60)}m spent</span>
                <span>{zone.interactions} interactions</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// FATIGUE INDICATOR CARD
// =============================================================================

function FatigueCard({ indicator }: { indicator: FatigueIndicator }) {
  const severityColors = {
    low: 'border-green-500/30 bg-green-900/10',
    medium: 'border-amber-500/30 bg-amber-900/10',
    high: 'border-red-500/30 bg-red-900/10',
  };

  const trendIcons = {
    improving: <TrendingUp className="w-4 h-4 text-green-400" />,
    stable: <Activity className="w-4 h-4 text-slate-400" />,
    declining: <TrendingDown className="w-4 h-4 text-red-400" />,
  };

  const BatteryIcon = indicator.severity === 'high' ? BatteryLow : 
    indicator.severity === 'medium' ? BatteryWarning : Battery;

  return (
    <div className={`p-4 rounded-xl border ${severityColors[indicator.severity]}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BatteryIcon className={`w-5 h-5 ${
            indicator.severity === 'high' ? 'text-red-400' :
            indicator.severity === 'medium' ? 'text-amber-400' : 'text-green-400'
          }`} />
          <span className="text-sm font-medium text-white capitalize">
            {indicator.type.replace('_', ' ')}
          </span>
        </div>
        {trendIcons[indicator.trend]}
      </div>
      <p className="text-xs text-slate-400 mb-3">{indicator.description}</p>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">Current</p>
          <p className="text-lg font-bold text-white">{Math.round(indicator.value * 100)}%</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Threshold</p>
          <p className="text-lg font-bold text-slate-400">{Math.round(indicator.threshold * 100)}%</p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// RECOMMENDATION CARD
// =============================================================================

function RecommendationCard({ rec, onApply }: { rec: AdaptiveRecommendation; onApply: () => void }) {
  const typeIcons: Record<string, React.ReactNode> = {
    simplify: <Zap className="w-5 h-5 text-purple-400" />,
    break: <Clock className="w-5 h-5 text-blue-400" />,
    focus: <Eye className="w-5 h-5 text-cyan-400" />,
    reduce: <BarChart3 className="w-5 h-5 text-amber-400" />,
    assist: <Brain className="w-5 h-5 text-green-400" />,
  };

  const priorityColors = {
    low: 'border-slate-600',
    medium: 'border-amber-500/50',
    high: 'border-red-500/50',
  };

  return (
    <div className={`p-4 bg-slate-800 rounded-xl border ${priorityColors[rec.priority]}`}>
      <div className="flex items-start gap-3">
        {typeIcons[rec.type]}
        <div className="flex-1">
          <h4 className="text-sm font-medium text-white">{rec.title}</h4>
          <p className="text-xs text-slate-400 mt-1">{rec.description}</p>
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-slate-500">
              Est. impact: +{Math.round(rec.estimatedImpact * 100)}%
            </span>
            <button 
              onClick={onApply}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white"
            >
              {rec.action}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// OVERWHELM WARNING
// =============================================================================

function OverwhelmPanel({ warning }: { warning: OverwhelmWarning }) {
  if (!warning.active) return null;

  return (
    <div 
      className="p-4 bg-red-900/20 rounded-xl border-2 border-red-500/30"
      style={{ animation: 'overwhelm-breathing 2s ease-in-out infinite' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-red-400" />
        <span className="text-sm font-medium text-red-400">Cognitive Overwhelm Detected</span>
        <span className="ml-auto px-2 py-0.5 bg-red-500/20 rounded text-xs text-red-400">
          Level {Math.round(warning.level * 100)}%
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-500 mb-2">Contributing Factors</p>
          <div className="space-y-1">
            {warning.triggerFactors.map((factor, i) => (
              <div key={i} className="text-xs text-slate-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                {factor}
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-2">Suggested Actions</p>
          <div className="space-y-1">
            {warning.suggestedActions.map((action, i) => (
              <div key={i} className="text-xs text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                {action}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function CognitiveLoadPage() {
  const [metrics, setMetrics] = useState<CognitiveMetrics | null>(null);
  const [attentionZones, setAttentionZones] = useState<AttentionZone[]>([]);
  const [fatigueIndicators, setFatigueIndicators] = useState<FatigueIndicator[]>([]);
  const [recommendations, setRecommendations] = useState<AdaptiveRecommendation[]>([]);
  const [overwhelmWarning, setOverwhelmWarning] = useState<OverwhelmWarning>({ active: false, level: 0, triggerFactors: [], suggestedActions: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/api/thinktank/living-parchment/cognitive-load');
        if (response.ok) {
          const data = await response.json();
          setMetrics(data.metrics);
          setAttentionZones(data.attentionZones || []);
          setFatigueIndicators(data.fatigueIndicators || []);
          setRecommendations(data.recommendations || []);
          setOverwhelmWarning(data.overwhelmWarning || { active: false, level: 0, triggerFactors: [], suggestedActions: [] });
        } else {
          generateInitialData();
        }
      } catch {
        generateInitialData();
      }
      setLoading(false);
    }

    loadData();
  }, []);

  function generateInitialData() {
    setMetrics({
      overallLoad: 0.65,
      attentionScore: 0.78,
      fatigueLevel: 0.35,
      comprehensionRate: 0.82,
      decisionQuality: 0.75,
      sessionDuration: 4500,
    });

    setAttentionZones([
      { id: 'z1', area: 'Decision Records', attention: 0.85, timeSpent: 1200, interactions: 45 },
      { id: 'z2', area: 'War Room', attention: 0.72, timeSpent: 900, interactions: 32 },
      { id: 'z3', area: 'Council of Experts', attention: 0.58, timeSpent: 600, interactions: 18 },
      { id: 'z4', area: 'Settings', attention: 0.25, timeSpent: 180, interactions: 5 },
    ]);

    setFatigueIndicators([
      { id: 'f1', type: 'response_time', severity: 'low', value: 0.25, threshold: 0.5, trend: 'stable', description: 'User response time within normal range' },
      { id: 'f2', type: 'error_rate', severity: 'medium', value: 0.42, threshold: 0.4, trend: 'declining', description: 'Slight increase in input errors detected' },
      { id: 'f3', type: 'engagement', severity: 'low', value: 0.78, threshold: 0.6, trend: 'improving', description: 'Good engagement with content' },
    ]);

    setRecommendations([
      { id: 'r1', type: 'break', priority: 'medium', title: 'Take a Short Break', description: 'Session duration suggests a 5-minute break would improve focus', action: 'Set Reminder', estimatedImpact: 0.15 },
      { id: 'r2', type: 'simplify', priority: 'low', title: 'Simplify Current View', description: 'Hide advanced options to reduce visual complexity', action: 'Apply', estimatedImpact: 0.08 },
    ]);

    setOverwhelmWarning({ active: false, level: 0.3, triggerFactors: [], suggestedActions: [] });
  }

  const handleApplyRecommendation = useCallback((id: string) => {
    setRecommendations(prev => prev.filter(r => r.id !== id));
  }, []);

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <style>{cognitiveStyles}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Activity className="w-7 h-7 text-pink-500" />
            Cognitive Load Monitor
          </h1>
          <p className="text-slate-400 mt-1">Real-time cognitive state awareness</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            Session: {Math.floor(metrics.sessionDuration / 60)}m
          </span>
          <button className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700">
            <Settings className="w-4 h-4" />
          </button>
          <button className="px-4 py-2 bg-pink-600 hover:bg-pink-500 rounded-lg text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Overwhelm Warning */}
      <OverwhelmPanel warning={overwhelmWarning} />

      {/* Metrics Grid */}
      <div className="grid grid-cols-5 gap-4 mb-6 mt-4">
        <CognitiveGauge label="Overall Load" value={metrics.overallLoad} icon={Brain} color="text-purple-400" warning={metrics.overallLoad > 0.8} />
        <CognitiveGauge label="Attention" value={metrics.attentionScore} icon={Eye} color="text-cyan-400" />
        <CognitiveGauge label="Fatigue" value={metrics.fatigueLevel} icon={Battery} color="text-amber-400" warning={metrics.fatigueLevel > 0.6} />
        <CognitiveGauge label="Comprehension" value={metrics.comprehensionRate} icon={Zap} color="text-green-400" />
        <CognitiveGauge label="Decision Quality" value={metrics.decisionQuality} icon={BarChart3} color="text-blue-400" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Attention Heatmap */}
        <div className="col-span-4">
          <AttentionHeatmap zones={attentionZones} />
        </div>

        {/* Fatigue Indicators */}
        <div className="col-span-4">
          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
            <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
              <Battery className="w-4 h-4 text-amber-400" />
              Fatigue Indicators
            </h3>
            <div className="space-y-3">
              {fatigueIndicators.map(ind => (
                <FatigueCard key={ind.id} indicator={ind} />
              ))}
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="col-span-4">
          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
            <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              Adaptive Recommendations
            </h3>
            <div className="space-y-3">
              {recommendations.map(rec => (
                <RecommendationCard 
                  key={rec.id} 
                  rec={rec} 
                  onApply={() => handleApplyRecommendation(rec.id)} 
                />
              ))}
              {recommendations.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">
                  No recommendations at this time
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
