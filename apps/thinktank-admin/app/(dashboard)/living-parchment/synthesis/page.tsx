'use client';

/**
 * RADIANT v5.44.0 - Synthesis Engine UI
 * Multi-source fusion visualization with agreement/tension zones
 */

import React, { useState, useEffect } from 'react';
import { 
  GitMerge, FileText, CheckCircle, AlertCircle, Link2,
  Zap, Eye, Filter, RefreshCw, ChevronDown, ChevronRight
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface SynthesisSource {
  id: string;
  name: string;
  type: 'document' | 'database' | 'api' | 'expert' | 'model';
  reliability: number;
  lastUpdated: string;
  claimCount: number;
}

interface SynthesisClaim {
  id: string;
  content: string;
  sourceIds: string[];
  confidence: number;
  agreementLevel: number;
  tensionLevel: number;
  category: string;
  provenanceTrail: { sourceId: string; excerpt: string; confidence: number }[];
}

interface AgreementZone {
  id: string;
  topic: string;
  claims: string[];
  sourceAgreement: number;
  strength: number;
}

interface TensionZone {
  id: string;
  topic: string;
  conflictingClaims: { claimId: string; position: string }[];
  severity: 'low' | 'medium' | 'high';
  resolutionSuggestion: string;
}

// =============================================================================
// STYLES
// =============================================================================

const synthesisStyles = `
  @keyframes agreement-glow {
    0%, 100% { box-shadow: 0 0 10px rgba(34, 197, 94, 0.2); }
    50% { box-shadow: 0 0 20px rgba(34, 197, 94, 0.4); }
  }
  @keyframes tension-crackle {
    0%, 100% { opacity: 0.8; }
    25% { opacity: 1; }
    50% { opacity: 0.6; }
    75% { opacity: 0.9; }
  }
  @keyframes provenance-flow {
    0% { background-position: 0% 50%; }
    100% { background-position: 100% 50%; }
  }
`;

// =============================================================================
// SOURCE CARD
// =============================================================================

function SourceCard({ source, isSelected, onToggle }: { 
  source: SynthesisSource; 
  isSelected: boolean;
  onToggle: () => void;
}) {
  const typeIcons: Record<string, React.ReactNode> = {
    document: <FileText className="w-4 h-4" />,
    database: <GitMerge className="w-4 h-4" />,
    api: <Link2 className="w-4 h-4" />,
    expert: <Eye className="w-4 h-4" />,
    model: <Zap className="w-4 h-4" />,
  };

  const typeColors: Record<string, string> = {
    document: 'text-blue-400',
    database: 'text-green-400',
    api: 'text-purple-400',
    expert: 'text-amber-400',
    model: 'text-cyan-400',
  };

  return (
    <div 
      onClick={onToggle}
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected 
          ? 'bg-green-900/20 border-green-500/50' 
          : 'bg-slate-800 border-slate-700 hover:border-slate-600'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={typeColors[source.type]}>{typeIcons[source.type]}</span>
        <span className="text-sm font-medium text-white">{source.name}</span>
        {isSelected && <CheckCircle className="w-4 h-4 text-green-400 ml-auto" />}
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span>Reliability: {Math.round(source.reliability * 100)}%</span>
        <span>{source.claimCount} claims</span>
      </div>
    </div>
  );
}

// =============================================================================
// CLAIM CARD
// =============================================================================

function ClaimCard({ 
  claim, 
  sources,
  isExpanded,
  onToggle 
}: { 
  claim: SynthesisClaim;
  sources: SynthesisSource[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const getClaimSources = () => claim.sourceIds.map(id => sources.find(s => s.id === id)).filter(Boolean);

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div 
        className="p-4 cursor-pointer hover:bg-slate-750"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
          )}
          <div className="flex-1">
            <p className="text-sm text-white" style={{ fontWeight: 350 + claim.confidence * 150 }}>
              {claim.content}
            </p>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ 
                    backgroundColor: claim.agreementLevel > 0.7 ? '#22c55e' : 
                      claim.agreementLevel > 0.4 ? '#f59e0b' : '#ef4444' 
                  }}
                />
                <span className="text-xs text-slate-400">
                  {Math.round(claim.agreementLevel * 100)}% agreement
                </span>
              </div>
              {claim.tensionLevel > 0.3 && (
                <span className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Tension detected
                </span>
              )}
              <span className="text-xs text-slate-500">
                {claim.sourceIds.length} sources
              </span>
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-700">
          <p className="text-xs text-slate-500 mb-2">Provenance Trail</p>
          <div className="space-y-2">
            {claim.provenanceTrail.map((trail, i) => {
              const source = sources.find(s => s.id === trail.sourceId);
              return (
                <div 
                  key={i} 
                  className="p-2 bg-slate-900 rounded-lg border-l-2"
                  style={{ 
                    borderColor: trail.confidence > 0.7 ? '#22c55e' : '#f59e0b',
                    background: `linear-gradient(90deg, rgba(34, 197, 94, 0.05) 0%, transparent 100%)`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-slate-300">{source?.name || 'Unknown'}</span>
                    <span className="text-xs text-slate-500">{Math.round(trail.confidence * 100)}% confident</span>
                  </div>
                  <p className="text-xs text-slate-400 italic">&ldquo;{trail.excerpt}&rdquo;</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// AGREEMENT ZONE
// =============================================================================

function AgreementZoneCard({ zone }: { zone: AgreementZone }) {
  return (
    <div 
      className="p-4 bg-green-900/20 rounded-xl border border-green-500/30"
      style={{ animation: 'agreement-glow 3s ease-in-out infinite' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle className="w-5 h-5 text-green-400" />
        <span className="text-sm font-medium text-white">{zone.topic}</span>
      </div>
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${zone.sourceAgreement * 100}%` }}
            />
          </div>
          <span className="text-xs text-green-400">{Math.round(zone.sourceAgreement * 100)}%</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">{zone.claims.length} supporting claims</p>
      </div>
    </div>
  );
}

// =============================================================================
// TENSION ZONE
// =============================================================================

function TensionZoneCard({ zone }: { zone: TensionZone }) {
  const severityColors = {
    low: 'border-amber-500/30 bg-amber-900/10',
    medium: 'border-orange-500/30 bg-orange-900/10',
    high: 'border-red-500/30 bg-red-900/10',
  };

  return (
    <div 
      className={`p-4 rounded-xl border ${severityColors[zone.severity]}`}
      style={{ animation: zone.severity === 'high' ? 'tension-crackle 1s ease-in-out infinite' : 'none' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Zap className={`w-5 h-5 ${
          zone.severity === 'high' ? 'text-red-400' : 
          zone.severity === 'medium' ? 'text-orange-400' : 'text-amber-400'
        }`} />
        <span className="text-sm font-medium text-white">{zone.topic}</span>
        <span className={`ml-auto px-2 py-0.5 rounded text-xs ${
          zone.severity === 'high' ? 'bg-red-500/20 text-red-400' :
          zone.severity === 'medium' ? 'bg-orange-500/20 text-orange-400' : 'bg-amber-500/20 text-amber-400'
        }`}>
          {zone.severity.toUpperCase()}
        </span>
      </div>

      <div className="space-y-2 mb-3">
        {zone.conflictingClaims.map((conflict, i) => (
          <div key={i} className="p-2 bg-slate-900/50 rounded text-xs text-slate-300">
            {conflict.position}
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-slate-700/50">
        <p className="text-xs text-slate-500">Suggested Resolution</p>
        <p className="text-xs text-slate-300 mt-1">{zone.resolutionSuggestion}</p>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function SynthesisEnginePage() {
  const [sources, setSources] = useState<SynthesisSource[]>([]);
  const [claims, setClaims] = useState<SynthesisClaim[]>([]);
  const [agreementZones, setAgreementZones] = useState<AgreementZone[]>([]);
  const [tensionZones, setTensionZones] = useState<TensionZone[]>([]);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [expandedClaims, setExpandedClaims] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'claims' | 'zones'>('claims');

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/api/thinktank/living-parchment/synthesis');
        if (response.ok) {
          const data = await response.json();
          setSources(data.sources || []);
          setClaims(data.claims || []);
          setAgreementZones(data.agreementZones || []);
          setTensionZones(data.tensionZones || []);
          setSelectedSources(new Set(data.sources?.map((s: SynthesisSource) => s.id) || []));
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
    const generatedSources: SynthesisSource[] = [
      { id: 's1', name: 'Market Research Report', type: 'document', reliability: 0.85, lastUpdated: new Date().toISOString(), claimCount: 12 },
      { id: 's2', name: 'CRM Database', type: 'database', reliability: 0.95, lastUpdated: new Date().toISOString(), claimCount: 8 },
      { id: 's3', name: 'Industry API Feed', type: 'api', reliability: 0.78, lastUpdated: new Date().toISOString(), claimCount: 15 },
      { id: 's4', name: 'Domain Expert Analysis', type: 'expert', reliability: 0.90, lastUpdated: new Date().toISOString(), claimCount: 6 },
      { id: 's5', name: 'AI Model Inference', type: 'model', reliability: 0.82, lastUpdated: new Date().toISOString(), claimCount: 20 },
    ];

    const generatedClaims: SynthesisClaim[] = [
      {
        id: 'c1',
        content: 'Market growth rate is projected at 15-20% annually for the next 3 years',
        sourceIds: ['s1', 's3', 's5'],
        confidence: 0.85,
        agreementLevel: 0.88,
        tensionLevel: 0.1,
        category: 'market',
        provenanceTrail: [
          { sourceId: 's1', excerpt: 'Annual growth expected between 15-18%', confidence: 0.85 },
          { sourceId: 's3', excerpt: 'Industry indicators suggest 17-20% growth', confidence: 0.80 },
          { sourceId: 's5', excerpt: 'Projected CAGR of 16.5%', confidence: 0.90 },
        ],
      },
      {
        id: 'c2',
        content: 'Customer acquisition cost has decreased by 30% due to organic channels',
        sourceIds: ['s2', 's4'],
        confidence: 0.92,
        agreementLevel: 0.95,
        tensionLevel: 0.05,
        category: 'operations',
        provenanceTrail: [
          { sourceId: 's2', excerpt: 'CAC reduced from $120 to $84 in Q4', confidence: 0.95 },
          { sourceId: 's4', excerpt: 'Organic growth driving 30%+ CAC reduction', confidence: 0.88 },
        ],
      },
      {
        id: 'c3',
        content: 'Enterprise segment represents largest growth opportunity',
        sourceIds: ['s1', 's4', 's5'],
        confidence: 0.75,
        agreementLevel: 0.60,
        tensionLevel: 0.45,
        category: 'strategy',
        provenanceTrail: [
          { sourceId: 's1', excerpt: 'Enterprise segment growing 25% YoY', confidence: 0.80 },
          { sourceId: 's4', excerpt: 'Mid-market may offer better margins', confidence: 0.70 },
          { sourceId: 's5', excerpt: 'Enterprise adoption accelerating', confidence: 0.75 },
        ],
      },
    ];

    const generatedAgreementZones: AgreementZone[] = [
      { id: 'a1', topic: 'Market Growth Trajectory', claims: ['c1'], sourceAgreement: 0.88, strength: 0.85 },
      { id: 'a2', topic: 'Operational Efficiency', claims: ['c2'], sourceAgreement: 0.95, strength: 0.92 },
    ];

    const generatedTensionZones: TensionZone[] = [
      {
        id: 't1',
        topic: 'Target Market Segment',
        conflictingClaims: [
          { claimId: 'c3', position: 'Enterprise segment has highest growth potential' },
          { claimId: 'c3', position: 'Mid-market offers better unit economics' },
        ],
        severity: 'medium',
        resolutionSuggestion: 'Conduct segment-specific ROI analysis before committing resources',
      },
    ];

    setSources(generatedSources);
    setClaims(generatedClaims);
    setAgreementZones(generatedAgreementZones);
    setTensionZones(generatedTensionZones);
    setSelectedSources(new Set(generatedSources.map(s => s.id)));
  }

  const toggleSource = (id: string) => {
    const newSelected = new Set(selectedSources);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSources(newSelected);
  };

  const toggleClaim = (id: string) => {
    const newExpanded = new Set(expandedClaims);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedClaims(newExpanded);
  };

  const filteredClaims = claims.filter(c => 
    c.sourceIds.some(id => selectedSources.has(id))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <style>{synthesisStyles}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <GitMerge className="w-7 h-7 text-green-500" />
            Synthesis Engine
          </h1>
          <p className="text-slate-400 mt-1">Multi-source fusion with provenance trails</p>
        </div>
        <button className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Re-synthesize
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sources sidebar */}
        <div className="col-span-3">
          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-300">Sources</h3>
              <span className="text-xs text-slate-500">{selectedSources.size}/{sources.length}</span>
            </div>
            <div className="space-y-2">
              {sources.map(source => (
                <SourceCard
                  key={source.id}
                  source={source}
                  isSelected={selectedSources.has(source.id)}
                  onToggle={() => toggleSource(source.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="col-span-9">
          {/* View toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveView('claims')}
              className={`px-4 py-2 rounded-lg text-sm ${
                activeView === 'claims' ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              Synthesized Claims ({filteredClaims.length})
            </button>
            <button
              onClick={() => setActiveView('zones')}
              className={`px-4 py-2 rounded-lg text-sm ${
                activeView === 'zones' ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              Agreement/Tension Zones
            </button>
          </div>

          {activeView === 'claims' && (
            <div className="space-y-3">
              {filteredClaims.map(claim => (
                <ClaimCard
                  key={claim.id}
                  claim={claim}
                  sources={sources}
                  isExpanded={expandedClaims.has(claim.id)}
                  onToggle={() => toggleClaim(claim.id)}
                />
              ))}
            </div>
          )}

          {activeView === 'zones' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Agreement Zones
                </h3>
                <div className="space-y-3">
                  {agreementZones.map(zone => (
                    <AgreementZoneCard key={zone.id} zone={zone} />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Tension Zones
                </h3>
                <div className="space-y-3">
                  {tensionZones.map(zone => (
                    <TensionZoneCard key={zone.id} zone={zone} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
