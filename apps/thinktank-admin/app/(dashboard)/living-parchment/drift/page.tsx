'use client';

/**
 * RADIANT v5.44.0 - Temporal Drift Observatory UI
 * Monitor fact evolution, detect drift alerts, and track citation half-life
 */

import React, { useState, useEffect } from 'react';
import { 
  Clock, AlertTriangle, TrendingUp, TrendingDown, History,
  FileText, RefreshCw, Eye, GitCompare, Calendar, Zap
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface MonitoredFact {
  id: string;
  content: string;
  originalSource: string;
  originalDate: string;
  currentConfidence: number;
  driftScore: number;
  lastVerified: string;
  verificationCount: number;
  category: string;
  status: 'stable' | 'drifting' | 'stale' | 'invalidated';
}

interface DriftAlert {
  id: string;
  factId: string;
  alertType: 'contradiction' | 'update' | 'retraction' | 'context_change';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: string;
  newEvidence: string;
  suggestedAction: string;
}

interface VersionGhost {
  id: string;
  factId: string;
  version: number;
  content: string;
  validFrom: string;
  validUntil: string | null;
  changeReason: string;
  confidence: number;
}

interface CitationMetrics {
  factId: string;
  halfLife: number;
  totalCitations: number;
  recentCitations: number;
  citationTrend: 'growing' | 'stable' | 'declining';
  projectedRelevance: number;
}

// =============================================================================
// STYLES
// =============================================================================

const driftStyles = `
  @keyframes drift-indicator {
    0%, 100% { transform: translateX(0); opacity: 0.7; }
    50% { transform: translateX(3px); opacity: 1; }
  }
  @keyframes ghost-overlay {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.5; }
  }
  @keyframes alert-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
    50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
  }
  @keyframes stale-fade {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.7; }
  }
`;

// =============================================================================
// FACT CARD
// =============================================================================

function FactCard({ 
  fact, 
  onSelect,
  isSelected 
}: { 
  fact: MonitoredFact;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const statusConfig = {
    stable: { color: 'border-green-500/30 bg-green-900/10', icon: <div className="w-2 h-2 rounded-full bg-green-500" />, label: 'Stable' },
    drifting: { color: 'border-amber-500/30 bg-amber-900/10', icon: <TrendingUp className="w-4 h-4 text-amber-400" style={{ animation: 'drift-indicator 1.5s ease-in-out infinite' }} />, label: 'Drifting' },
    stale: { color: 'border-gray-500/30 bg-gray-900/10', icon: <Clock className="w-4 h-4 text-gray-400" style={{ animation: 'stale-fade 3s ease-in-out infinite' }} />, label: 'Stale' },
    invalidated: { color: 'border-red-500/30 bg-red-900/10', icon: <AlertTriangle className="w-4 h-4 text-red-400" />, label: 'Invalidated' },
  };

  const config = statusConfig[fact.status];
  const driftPercent = Math.round(fact.driftScore * 100);

  return (
    <div 
      onClick={onSelect}
      className={`p-4 rounded-xl border cursor-pointer transition-all ${config.color} ${
        isSelected ? 'ring-2 ring-amber-500' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {config.icon}
          <span className="text-xs text-slate-400">{config.label}</span>
        </div>
        <span className="text-xs text-slate-500">{fact.category}</span>
      </div>

      <p 
        className="text-sm text-white mb-3"
        style={{ 
          fontWeight: 350 + fact.currentConfidence * 150,
          opacity: fact.status === 'stale' ? 0.6 : 1
        }}
      >
        {fact.content}
      </p>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-500">
          <FileText className="w-3 h-3" />
          <span>{fact.originalSource}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`${driftPercent > 30 ? 'text-amber-400' : 'text-slate-400'}`}>
            Drift: {driftPercent}%
          </span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DRIFT ALERT CARD
// =============================================================================

function AlertCard({ alert, onDismiss }: { alert: DriftAlert; onDismiss: () => void }) {
  const severityConfig = {
    low: { color: 'border-slate-600 bg-slate-800', textColor: 'text-slate-300' },
    medium: { color: 'border-amber-500/50 bg-amber-900/20', textColor: 'text-amber-400' },
    high: { color: 'border-orange-500/50 bg-orange-900/20', textColor: 'text-orange-400' },
    critical: { color: 'border-red-500/50 bg-red-900/20', textColor: 'text-red-400' },
  };

  const typeIcons = {
    contradiction: <GitCompare className="w-4 h-4" />,
    update: <RefreshCw className="w-4 h-4" />,
    retraction: <AlertTriangle className="w-4 h-4" />,
    context_change: <History className="w-4 h-4" />,
  };

  const config = severityConfig[alert.severity];

  return (
    <div 
      className={`p-4 rounded-xl border ${config.color}`}
      style={alert.severity === 'critical' ? { animation: 'alert-pulse 2s ease-in-out infinite' } : {}}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={config.textColor}>{typeIcons[alert.alertType]}</span>
          <span className={`text-sm font-medium ${config.textColor} capitalize`}>
            {alert.alertType.replace('_', ' ')}
          </span>
        </div>
        <span className="text-xs text-slate-500">
          {new Date(alert.detectedAt).toLocaleDateString()}
        </span>
      </div>

      <p className="text-sm text-white mb-2">{alert.description}</p>
      
      <div className="p-2 bg-slate-900/50 rounded text-xs text-slate-400 mb-3">
        <span className="text-slate-500">New evidence:</span> {alert.newEvidence}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{alert.suggestedAction}</span>
        <button 
          onClick={onDismiss}
          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white"
        >
          Acknowledge
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// VERSION GHOST TIMELINE
// =============================================================================

function VersionTimeline({ versions, currentFactContent }: { versions: VersionGhost[]; currentFactContent: string }) {
  return (
    <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
      <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
        <History className="w-4 h-4 text-purple-400" />
        Version History
      </h3>

      <div className="relative">
        {/* Current version */}
        <div className="flex gap-3 mb-4">
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <div className="w-0.5 flex-1 bg-slate-700" />
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-green-400">Current</span>
              <span className="text-xs text-slate-500">Now</span>
            </div>
            <p className="text-sm text-white">{currentFactContent}</p>
          </div>
        </div>

        {/* Ghost versions */}
        {versions.map((version, i) => (
          <div 
            key={version.id} 
            className="flex gap-3"
            style={{ animation: 'ghost-overlay 4s ease-in-out infinite' }}
          >
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-slate-600 border border-slate-500" />
              {i < versions.length - 1 && <div className="w-0.5 flex-1 bg-slate-700" />}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-500">v{version.version}</span>
                <span className="text-xs text-slate-600">
                  {new Date(version.validFrom).toLocaleDateString()}
                  {version.validUntil && ` - ${new Date(version.validUntil).toLocaleDateString()}`}
                </span>
              </div>
              <p className="text-sm text-slate-400 opacity-60">{version.content}</p>
              <p className="text-xs text-slate-600 mt-1 italic">{version.changeReason}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// CITATION METRICS
// =============================================================================

function CitationCard({ metrics }: { metrics: CitationMetrics }) {
  const trendIcons = {
    growing: <TrendingUp className="w-4 h-4 text-green-400" />,
    stable: <div className="w-4 h-0.5 bg-slate-400" />,
    declining: <TrendingDown className="w-4 h-4 text-red-400" />,
  };

  return (
    <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-300">Citation Metrics</span>
        {trendIcons[metrics.citationTrend]}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-xs text-slate-500">Half-Life</p>
          <p className="text-lg font-bold text-white">{metrics.halfLife} days</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Total Citations</p>
          <p className="text-lg font-bold text-white">{metrics.totalCitations}</p>
        </div>
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-1">Projected Relevance</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-purple-500 rounded-full"
              style={{ width: `${metrics.projectedRelevance * 100}%` }}
            />
          </div>
          <span className="text-xs text-white">{Math.round(metrics.projectedRelevance * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function TemporalDriftPage() {
  const [facts, setFacts] = useState<MonitoredFact[]>([]);
  const [alerts, setAlerts] = useState<DriftAlert[]>([]);
  const [selectedFact, setSelectedFact] = useState<MonitoredFact | null>(null);
  const [versions, setVersions] = useState<VersionGhost[]>([]);
  const [citationMetrics, setCitationMetrics] = useState<CitationMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/api/thinktank/living-parchment/temporal-drift');
        if (response.ok) {
          const data = await response.json();
          setFacts(data.facts || []);
          setAlerts(data.alerts || []);
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
    const generatedFacts: MonitoredFact[] = [
      {
        id: 'f1',
        content: 'AI market size projected to reach $407B by 2027',
        originalSource: 'Gartner Report 2024',
        originalDate: '2024-03-15',
        currentConfidence: 0.85,
        driftScore: 0.12,
        lastVerified: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        verificationCount: 8,
        category: 'Market',
        status: 'stable',
      },
      {
        id: 'f2',
        content: 'Enterprise AI adoption rate at 35% globally',
        originalSource: 'McKinsey Survey 2024',
        originalDate: '2024-01-20',
        currentConfidence: 0.72,
        driftScore: 0.38,
        lastVerified: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        verificationCount: 5,
        category: 'Adoption',
        status: 'drifting',
      },
      {
        id: 'f3',
        content: 'GPT-4 holds 60% market share in enterprise LLMs',
        originalSource: 'Industry Analysis Q3',
        originalDate: '2023-09-01',
        currentConfidence: 0.45,
        driftScore: 0.65,
        lastVerified: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        verificationCount: 3,
        category: 'Competition',
        status: 'stale',
      },
      {
        id: 'f4',
        content: 'EU AI Act enforcement begins Q2 2025',
        originalSource: 'EU Official Journal',
        originalDate: '2024-02-15',
        currentConfidence: 0.95,
        driftScore: 0.05,
        lastVerified: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        verificationCount: 12,
        category: 'Regulatory',
        status: 'stable',
      },
    ];

    const generatedAlerts: DriftAlert[] = [
      {
        id: 'a1',
        factId: 'f2',
        alertType: 'update',
        severity: 'medium',
        description: 'New survey data suggests adoption rate may have increased to 42%',
        detectedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        newEvidence: 'Deloitte 2025 AI Survey reports 42% enterprise adoption',
        suggestedAction: 'Review and update fact with new data',
      },
      {
        id: 'a2',
        factId: 'f3',
        alertType: 'context_change',
        severity: 'high',
        description: 'Market dynamics have shifted significantly since original measurement',
        detectedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        newEvidence: 'Claude and Gemini have gained significant market share',
        suggestedAction: 'Mark as stale or update with current data',
      },
    ];

    setFacts(generatedFacts);
    setAlerts(generatedAlerts);
  }

  useEffect(() => {
    if (selectedFact) {
      // Generate version history for selected fact
      setVersions([
        {
          id: 'v1',
          factId: selectedFact.id,
          version: 1,
          content: selectedFact.content.replace(/\d+/, String(Math.floor(Math.random() * 100))),
          validFrom: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
          validUntil: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          changeReason: 'Initial measurement',
          confidence: 0.75,
        },
        {
          id: 'v2',
          factId: selectedFact.id,
          version: 2,
          content: selectedFact.content.replace(/\d+/, String(Math.floor(Math.random() * 100))),
          validFrom: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          validUntil: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          changeReason: 'Updated with Q2 data',
          confidence: 0.82,
        },
      ]);

      setCitationMetrics({
        factId: selectedFact.id,
        halfLife: Math.floor(Math.random() * 90) + 30,
        totalCitations: Math.floor(Math.random() * 50) + 10,
        recentCitations: Math.floor(Math.random() * 10) + 2,
        citationTrend: ['growing', 'stable', 'declining'][Math.floor(Math.random() * 3)] as any,
        projectedRelevance: 0.5 + Math.random() * 0.4,
      });
    }
  }, [selectedFact]);

  const handleDismissAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const filteredFacts = filterStatus === 'all' 
    ? facts 
    : facts.filter(f => f.status === filterStatus);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <style>{driftStyles}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Clock className="w-7 h-7 text-amber-500" />
            Temporal Drift Observatory
          </h1>
          <p className="text-slate-400 mt-1">Monitor fact evolution and citation half-life</p>
        </div>
        <button className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Verify All
        </button>
      </div>

      {/* Alerts section */}
      {alerts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Active Drift Alerts ({alerts.length})
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {alerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} onDismiss={() => handleDismissAlert(alert.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {['all', 'stable', 'drifting', 'stale', 'invalidated'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1.5 rounded-lg text-xs capitalize ${
              filterStatus === status
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {status} {status !== 'all' && `(${facts.filter(f => f.status === status).length})`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Facts list */}
        <div className="col-span-5">
          <div className="space-y-3">
            {filteredFacts.map(fact => (
              <FactCard
                key={fact.id}
                fact={fact}
                isSelected={selectedFact?.id === fact.id}
                onSelect={() => setSelectedFact(fact)}
              />
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="col-span-7 space-y-4">
          {selectedFact ? (
            <>
              {/* Version timeline */}
              <VersionTimeline versions={versions} currentFactContent={selectedFact.content} />

              {/* Citation metrics */}
              {citationMetrics && <CitationCard metrics={citationMetrics} />}

              {/* Fact details */}
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Fact Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Original Source</p>
                    <p className="text-white">{selectedFact.originalSource}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Original Date</p>
                    <p className="text-white">{new Date(selectedFact.originalDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Last Verified</p>
                    <p className="text-white">{new Date(selectedFact.lastVerified).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Verification Count</p>
                    <p className="text-white">{selectedFact.verificationCount}</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 bg-slate-900 rounded-xl border border-slate-800">
              <div className="text-center">
                <Eye className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500">Select a fact to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
