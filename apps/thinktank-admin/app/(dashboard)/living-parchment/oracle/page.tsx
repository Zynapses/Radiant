'use client';

/**
 * RADIANT v5.44.0 - Oracle View UI
 * Probability heatmap timeline with bifurcation points and ghost futures
 */

import React, { useState, useEffect } from 'react';
import { 
  Eye, TrendingUp, TrendingDown, AlertTriangle, Clock,
  GitBranch, Zap, Target, ChevronRight, RefreshCw
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface PredictionPoint {
  id: string;
  timestamp: string;
  prediction: string;
  probability: number;
  confidence: number;
  category: 'market' | 'technology' | 'regulatory' | 'competitive' | 'operational';
  impact: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'confirmed' | 'invalidated';
}

interface BifurcationPoint {
  id: string;
  timestamp: string;
  description: string;
  branchA: { label: string; probability: number; impact: string };
  branchB: { label: string; probability: number; impact: string };
  triggerConditions: string[];
}

interface GhostFuture {
  id: string;
  scenario: string;
  probability: number;
  timeHorizon: string;
  keyEvents: string[];
  indicators: { name: string; value: number; trend: 'up' | 'down' | 'stable' }[];
}

interface BlackSwanIndicator {
  id: string;
  name: string;
  probability: number;
  potentialImpact: number;
  description: string;
  warningSignals: string[];
  lastUpdated: string;
}

// =============================================================================
// STYLES
// =============================================================================

const oracleStyles = `
  @keyframes timeline-pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
  @keyframes ghost-fade {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.5; }
  }
  @keyframes bifurcation-glow {
    0%, 100% { box-shadow: 0 0 10px rgba(139, 92, 246, 0.3); }
    50% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.6); }
  }
  @keyframes black-swan-warning {
    0%, 100% { background-color: rgba(239, 68, 68, 0.1); }
    50% { background-color: rgba(239, 68, 68, 0.2); }
  }
`;

// =============================================================================
// PREDICTION CARD
// =============================================================================

function PredictionCard({ prediction }: { prediction: PredictionPoint }) {
  const impactColors = {
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const statusIcons = {
    pending: <Clock className="w-4 h-4 text-slate-400" />,
    confirmed: <Target className="w-4 h-4 text-green-400" />,
    invalidated: <AlertTriangle className="w-4 h-4 text-red-400" />,
  };

  return (
    <div className="p-4 bg-slate-800 rounded-xl border border-slate-700 hover:border-purple-500/50 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {statusIcons[prediction.status]}
          <span className={`px-2 py-0.5 rounded-full text-xs border ${impactColors[prediction.impact]}`}>
            {prediction.impact.toUpperCase()}
          </span>
        </div>
        <span className="text-xs text-slate-500">
          {new Date(prediction.timestamp).toLocaleDateString()}
        </span>
      </div>

      <p className="text-sm text-white mb-3">{prediction.prediction}</p>

      <div className="flex items-center gap-4">
        <div>
          <p className="text-xs text-slate-500">Probability</p>
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 rounded-full"
                style={{ width: `${prediction.probability * 100}%` }}
              />
            </div>
            <span className="text-xs text-white">{Math.round(prediction.probability * 100)}%</span>
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500">Confidence</p>
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-cyan-500 rounded-full"
                style={{ width: `${prediction.confidence * 100}%` }}
              />
            </div>
            <span className="text-xs text-white">{Math.round(prediction.confidence * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// BIFURCATION POINT
// =============================================================================

function BifurcationCard({ point }: { point: BifurcationPoint }) {
  return (
    <div 
      className="p-4 bg-slate-800 rounded-xl border border-purple-500/30"
      style={{ animation: 'bifurcation-glow 3s ease-in-out infinite' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="w-5 h-5 text-purple-400" />
        <span className="text-sm font-medium text-white">Decision Point</span>
        <span className="text-xs text-slate-500 ml-auto">
          {new Date(point.timestamp).toLocaleDateString()}
        </span>
      </div>

      <p className="text-sm text-slate-300 mb-4">{point.description}</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-slate-900 rounded-lg border border-blue-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-blue-400">Path A</span>
            <span className="text-xs text-white">{Math.round(point.branchA.probability * 100)}%</span>
          </div>
          <p className="text-sm text-white">{point.branchA.label}</p>
          <p className="text-xs text-slate-400 mt-1">{point.branchA.impact}</p>
        </div>
        <div className="p-3 bg-slate-900 rounded-lg border border-amber-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-amber-400">Path B</span>
            <span className="text-xs text-white">{Math.round(point.branchB.probability * 100)}%</span>
          </div>
          <p className="text-sm text-white">{point.branchB.label}</p>
          <p className="text-xs text-slate-400 mt-1">{point.branchB.impact}</p>
        </div>
      </div>

      {point.triggerConditions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <p className="text-xs text-slate-500 mb-2">Trigger Conditions</p>
          <div className="flex flex-wrap gap-1">
            {point.triggerConditions.map((condition, i) => (
              <span key={i} className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">
                {condition}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// GHOST FUTURE CARD
// =============================================================================

function GhostFutureCard({ future }: { future: GhostFuture }) {
  return (
    <div 
      className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50"
      style={{ animation: 'ghost-fade 4s ease-in-out infinite' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-300">{future.scenario}</span>
        <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-400">
          {future.timeHorizon}
        </span>
      </div>

      <div className="mb-3">
        <p className="text-xs text-slate-500">Probability</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-slate-500 rounded-full"
              style={{ width: `${future.probability * 100}%`, opacity: 0.6 }}
            />
          </div>
          <span className="text-xs text-slate-400">{Math.round(future.probability * 100)}%</span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-slate-500">Key Events</p>
        {future.keyEvents.map((event, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
            <ChevronRight className="w-3 h-3" />
            <span>{event}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-700/50">
        <p className="text-xs text-slate-500 mb-2">Indicators</p>
        <div className="grid grid-cols-3 gap-2">
          {future.indicators.map((ind, i) => (
            <div key={i} className="text-center">
              <p className="text-xs text-slate-500">{ind.name}</p>
              <div className="flex items-center justify-center gap-1">
                {ind.trend === 'up' && <TrendingUp className="w-3 h-3 text-green-400" />}
                {ind.trend === 'down' && <TrendingDown className="w-3 h-3 text-red-400" />}
                <span className="text-sm text-slate-300">{ind.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// BLACK SWAN INDICATOR
// =============================================================================

function BlackSwanCard({ indicator }: { indicator: BlackSwanIndicator }) {
  const isHighRisk = indicator.probability * indicator.potentialImpact > 0.3;

  return (
    <div 
      className={`p-4 rounded-xl border ${
        isHighRisk 
          ? 'bg-red-900/20 border-red-500/30' 
          : 'bg-slate-800 border-slate-700'
      }`}
      style={isHighRisk ? { animation: 'black-swan-warning 2s ease-in-out infinite' } : {}}
    >
      <div className="flex items-center gap-2 mb-3">
        <Zap className={`w-5 h-5 ${isHighRisk ? 'text-red-400' : 'text-amber-400'}`} />
        <span className="text-sm font-medium text-white">{indicator.name}</span>
      </div>

      <p className="text-sm text-slate-300 mb-3">{indicator.description}</p>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-xs text-slate-500">Probability</p>
          <p className="text-lg font-bold text-white">{Math.round(indicator.probability * 100)}%</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Impact</p>
          <p className="text-lg font-bold text-white">{Math.round(indicator.potentialImpact * 100)}%</p>
        </div>
      </div>

      {indicator.warningSignals.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2">Warning Signals</p>
          <div className="space-y-1">
            {indicator.warningSignals.map((signal, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span className="text-slate-300">{signal}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function OracleViewPage() {
  const [predictions, setPredictions] = useState<PredictionPoint[]>([]);
  const [bifurcations, setBifurcations] = useState<BifurcationPoint[]>([]);
  const [ghostFutures, setGhostFutures] = useState<GhostFuture[]>([]);
  const [blackSwans, setBlackSwans] = useState<BlackSwanIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'bifurcations' | 'ghosts' | 'swans'>('timeline');

  useEffect(() => {
    async function loadOracleData() {
      try {
        const response = await fetch('/api/thinktank/living-parchment/oracle');
        if (response.ok) {
          const data = await response.json();
          setPredictions(data.predictions || []);
          setBifurcations(data.bifurcations || []);
          setGhostFutures(data.ghostFutures || []);
          setBlackSwans(data.blackSwans || []);
        } else {
          generateInitialData();
        }
      } catch {
        generateInitialData();
      }
      setLoading(false);
    }

    loadOracleData();
  }, []);

  function generateInitialData() {
    const now = Date.now();
    
    setPredictions([
      {
        id: 'p1',
        timestamp: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
        prediction: 'Market adoption of AI assistants will increase 40% in enterprise segment',
        probability: 0.78,
        confidence: 0.85,
        category: 'market',
        impact: 'high',
        status: 'pending',
      },
      {
        id: 'p2',
        timestamp: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
        prediction: 'New regulatory framework for AI transparency will be proposed',
        probability: 0.65,
        confidence: 0.72,
        category: 'regulatory',
        impact: 'critical',
        status: 'pending',
      },
      {
        id: 'p3',
        timestamp: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
        prediction: 'Competitor will launch similar decision intelligence feature',
        probability: 0.45,
        confidence: 0.60,
        category: 'competitive',
        impact: 'medium',
        status: 'pending',
      },
    ]);

    setBifurcations([
      {
        id: 'b1',
        timestamp: new Date(now + 21 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Board decision on international expansion strategy',
        branchA: { label: 'Aggressive Expansion', probability: 0.6, impact: 'High growth, higher risk' },
        branchB: { label: 'Focused Growth', probability: 0.4, impact: 'Steady growth, lower risk' },
        triggerConditions: ['Q1 revenue target met', 'Market conditions favorable'],
      },
    ]);

    setGhostFutures([
      {
        id: 'g1',
        scenario: 'AI Market Consolidation',
        probability: 0.35,
        timeHorizon: '12-18 months',
        keyEvents: ['Major acquisition announced', 'Pricing pressure increases', 'Feature parity achieved'],
        indicators: [
          { name: 'Competition', value: 85, trend: 'up' },
          { name: 'Margins', value: 42, trend: 'down' },
          { name: 'Market Share', value: 12, trend: 'stable' },
        ],
      },
      {
        id: 'g2',
        scenario: 'Regulatory Disruption',
        probability: 0.25,
        timeHorizon: '6-12 months',
        keyEvents: ['GDPR-like AI law passed', 'Compliance requirements increase', 'Market restructures'],
        indicators: [
          { name: 'Risk', value: 72, trend: 'up' },
          { name: 'Cost', value: 58, trend: 'up' },
          { name: 'Barriers', value: 65, trend: 'up' },
        ],
      },
    ]);

    setBlackSwans([
      {
        id: 's1',
        name: 'Major AI Security Breach',
        probability: 0.08,
        potentialImpact: 0.95,
        description: 'Large-scale compromise of AI systems leading to data exposure or manipulation',
        warningSignals: ['Increased attack attempts', 'New vulnerability classes', 'State actor interest'],
        lastUpdated: new Date().toISOString(),
      },
      {
        id: 's2',
        name: 'Breakthrough in Alternative AI',
        probability: 0.12,
        potentialImpact: 0.80,
        description: 'Fundamental new approach to AI that obsoletes current architectures',
        warningSignals: ['Academic paper surge', 'DARPA funding shifts', 'Patent activity'],
        lastUpdated: new Date().toISOString(),
      },
    ]);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <style>{oracleStyles}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Eye className="w-7 h-7 text-purple-500" />
            Oracle View
          </h1>
          <p className="text-slate-400 mt-1">Predictive landscape with bifurcation analysis</p>
        </div>
        <button className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh Predictions
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'timeline', label: 'Timeline', count: predictions.length },
          { key: 'bifurcations', label: 'Bifurcations', count: bifurcations.length },
          { key: 'ghosts', label: 'Ghost Futures', count: ghostFutures.length },
          { key: 'swans', label: 'Black Swans', count: blackSwans.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-all ${
              activeTab === tab.key
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {tab.label}
            <span className="px-1.5 py-0.5 bg-slate-900/50 rounded text-xs">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'timeline' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {predictions.map(pred => (
            <PredictionCard key={pred.id} prediction={pred} />
          ))}
        </div>
      )}

      {activeTab === 'bifurcations' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {bifurcations.map(point => (
            <BifurcationCard key={point.id} point={point} />
          ))}
        </div>
      )}

      {activeTab === 'ghosts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {ghostFutures.map(future => (
            <GhostFutureCard key={future.id} future={future} />
          ))}
        </div>
      )}

      {activeTab === 'swans' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {blackSwans.map(swan => (
            <BlackSwanCard key={swan.id} indicator={swan} />
          ))}
        </div>
      )}
    </div>
  );
}
