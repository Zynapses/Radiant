'use client';

/**
 * RADIANT v5.44.0 - War Room UI
 * Strategic Decision Theater with confidence terrain and AI advisors
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Shield, Users, Target, AlertTriangle, CheckCircle, 
  Plus, Play, Pause, ChevronRight, Sparkles, Mountain,
  Brain, Zap, Eye, Settings
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface WarRoomSession {
  id: string;
  title: string;
  description: string;
  status: 'planning' | 'active' | 'deliberating' | 'decided' | 'archived';
  stakeLevel: 'low' | 'medium' | 'high' | 'critical';
  participants: { userId: string; displayName: string; role: string }[];
  advisors: Advisor[];
  decisionPaths: DecisionPath[];
  confidenceTerrain: TerrainData;
  createdAt: string;
}

interface Advisor {
  id: string;
  name: string;
  type: 'ai_model' | 'human_expert' | 'domain_specialist';
  specialization: string;
  confidence: number;
  breathingAura: { color: string; rate: number; intensity: number };
  position?: { advocating: string; confidence: number; reasoning: string };
}

interface DecisionPath {
  id: string;
  label: string;
  description: string;
  confidence: number;
  advocatedBy: string[];
  outcomes: { description: string; probability: number; impact: string }[];
}

interface TerrainData {
  segments: TerrainSegment[];
  peakConfidence: { x: number; y: number; z: number };
  valleyRisks: { x: number; y: number }[];
}

interface TerrainSegment {
  id: string;
  position: { x: number; y: number; z: number };
  elevation: number;
  color: string;
  hoverData: { title: string; confidence: number; risks: string[] };
}

// =============================================================================
// BREATHING ANIMATION STYLES
// =============================================================================

const breathingKeyframes = `
  @keyframes breathe-6 {
    0%, 100% { transform: scale(1); opacity: 0.7; }
    50% { transform: scale(1.05); opacity: 1; }
  }
  @keyframes breathe-8 {
    0%, 100% { transform: scale(1); opacity: 0.7; }
    50% { transform: scale(1.08); opacity: 1; }
  }
  @keyframes breathe-12 {
    0%, 100% { transform: scale(1); opacity: 0.6; }
    50% { transform: scale(1.12); opacity: 1; }
  }
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }
    50% { box-shadow: 0 0 40px rgba(59, 130, 246, 0.6); }
  }
`;

// =============================================================================
// CONFIDENCE TERRAIN COMPONENT
// =============================================================================

function ConfidenceTerrain({ terrain, onSegmentHover }: { 
  terrain: TerrainData; 
  onSegmentHover: (segment: TerrainSegment | null) => void;
}) {
  const gridSize = 10;
  
  return (
    <div className="relative w-full h-64 bg-slate-900 rounded-xl overflow-hidden">
      <div className="absolute inset-0 grid gap-0.5 p-2" style={{ 
        gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
        gridTemplateRows: `repeat(${gridSize}, 1fr)`,
      }}>
        {terrain.segments.map((segment) => (
          <div
            key={segment.id}
            className="relative cursor-pointer transition-all duration-300 hover:z-10"
            style={{
              backgroundColor: segment.color,
              opacity: 0.3 + (segment.elevation / 150),
              transform: `translateY(-${segment.elevation / 10}px)`,
              boxShadow: `0 ${segment.elevation / 5}px ${segment.elevation / 3}px rgba(0,0,0,0.3)`,
            }}
            onMouseEnter={() => onSegmentHover(segment)}
            onMouseLeave={() => onSegmentHover(null)}
          />
        ))}
      </div>
      
      {/* Peak indicator */}
      <div 
        className="absolute w-3 h-3 bg-green-400 rounded-full animate-pulse"
        style={{
          left: `${terrain.peakConfidence.x}%`,
          top: `${100 - terrain.peakConfidence.z}%`,
          transform: 'translate(-50%, -50%)',
        }}
      />
      
      {/* Risk valleys */}
      {terrain.valleyRisks.map((valley, i) => (
        <div 
          key={i}
          className="absolute w-2 h-2 bg-red-500 rounded-full"
          style={{
            left: `${valley.x}%`,
            top: `${valley.y}%`,
            transform: 'translate(-50%, -50%)',
            animation: 'breathe-12 1s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  );
}

// =============================================================================
// ADVISOR CARD COMPONENT
// =============================================================================

function AdvisorCard({ advisor, onAnalyze }: { 
  advisor: Advisor; 
  onAnalyze: () => void;
}) {
  const iconMap = {
    ai_model: Brain,
    human_expert: Users,
    domain_specialist: Target,
  };
  const Icon = iconMap[advisor.type] || Brain;

  return (
    <div 
      className="relative p-4 bg-slate-800 rounded-xl border border-slate-700 transition-all hover:border-slate-500"
      style={{
        animation: `breathe-${advisor.breathingAura.rate} ${10 / advisor.breathingAura.rate}s ease-in-out infinite`,
      }}
    >
      {/* Breathing aura */}
      <div 
        className="absolute inset-0 rounded-xl opacity-20"
        style={{ 
          backgroundColor: advisor.breathingAura.color,
          filter: `blur(${advisor.breathingAura.intensity * 20}px)`,
        }}
      />
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <div 
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${advisor.breathingAura.color}30` }}
          >
            <Icon className="w-5 h-5" style={{ color: advisor.breathingAura.color }} />
          </div>
          <div>
            <h4 className="font-medium text-white">{advisor.name}</h4>
            <p className="text-xs text-slate-400">{advisor.specialization}</p>
          </div>
        </div>
        
        {/* Confidence bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Confidence</span>
            <span>{advisor.confidence}%</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${advisor.confidence}%`,
                backgroundColor: advisor.breathingAura.color,
              }}
            />
          </div>
        </div>
        
        {/* Position if available */}
        {advisor.position?.advocating && (
          <div className="p-2 bg-slate-900/50 rounded-lg mb-3">
            <p className="text-xs text-slate-300 line-clamp-2">
              {advisor.position.advocating}
            </p>
          </div>
        )}
        
        <button
          onClick={onAnalyze}
          className="w-full py-2 px-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white flex items-center justify-center gap-2 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Request Analysis
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// DECISION PATH COMPONENT
// =============================================================================

function DecisionPathCard({ path, advisors, onSelect }: {
  path: DecisionPath;
  advisors: Advisor[];
  onSelect: () => void;
}) {
  const advocates = path.advocatedBy
    .map(id => advisors.find(a => a.id === id)?.name)
    .filter(Boolean);

  return (
    <div 
      className="p-4 bg-slate-800 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-all cursor-pointer"
      onClick={onSelect}
      style={{
        boxShadow: `0 0 ${path.confidence / 5}px rgba(59, 130, 246, ${path.confidence / 200})`,
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-medium text-white">{path.label}</h4>
        <span 
          className="px-2 py-0.5 rounded text-xs font-medium"
          style={{
            backgroundColor: path.confidence >= 70 ? '#22c55e30' : path.confidence >= 40 ? '#f59e0b30' : '#ef444430',
            color: path.confidence >= 70 ? '#22c55e' : path.confidence >= 40 ? '#f59e0b' : '#ef4444',
          }}
        >
          {path.confidence}% confidence
        </span>
      </div>
      
      <p className="text-sm text-slate-400 mb-3">{path.description}</p>
      
      {advocates.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-slate-500">Advocated by:</span>
          <div className="flex gap-1">
            {advocates.map((name, i) => (
              <span key={i} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Outcomes preview */}
      <div className="space-y-1">
        {path.outcomes.slice(0, 2).map((outcome, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {outcome.impact === 'positive' ? (
              <CheckCircle className="w-3 h-3 text-green-400" />
            ) : outcome.impact === 'negative' ? (
              <AlertTriangle className="w-3 h-3 text-red-400" />
            ) : (
              <ChevronRight className="w-3 h-3 text-slate-400" />
            )}
            <span className="text-slate-400">{outcome.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function WarRoomPage() {
  const [sessions, setSessions] = useState<WarRoomSession[]>([]);
  const [activeSession, setActiveSession] = useState<WarRoomSession | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<TerrainSegment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Mock data for demonstration
  useEffect(() => {
    const mockSession: WarRoomSession = {
      id: '1',
      title: 'Q2 Market Expansion Strategy',
      description: 'Evaluating options for expanding into APAC markets',
      status: 'active',
      stakeLevel: 'high',
      participants: [
        { userId: '1', displayName: 'CEO', role: 'owner' },
        { userId: '2', displayName: 'CFO', role: 'stakeholder' },
      ],
      advisors: [
        {
          id: 'a1',
          name: 'Claude Opus',
          type: 'ai_model',
          specialization: 'Strategic Analysis',
          confidence: 78,
          breathingAura: { color: '#3b82f6', rate: 6, intensity: 0.5 },
          position: { advocating: 'Phased entry starting with Singapore', confidence: 78, reasoning: 'Lower risk, established legal framework' },
        },
        {
          id: 'a2',
          name: 'Risk Analyst',
          type: 'domain_specialist',
          specialization: 'Risk Assessment',
          confidence: 65,
          breathingAura: { color: '#ef4444', rate: 8, intensity: 0.6 },
          position: { advocating: 'Delay expansion until Q3', confidence: 65, reasoning: 'Currency volatility concerns' },
        },
        {
          id: 'a3',
          name: 'Market Expert',
          type: 'human_expert',
          specialization: 'APAC Markets',
          confidence: 82,
          breathingAura: { color: '#22c55e', rate: 6, intensity: 0.4 },
          position: { advocating: 'Aggressive multi-market entry', confidence: 82, reasoning: 'Window of opportunity closing' },
        },
      ],
      decisionPaths: [
        {
          id: 'p1',
          label: 'Phased Singapore Entry',
          description: 'Start with Singapore, expand to Malaysia in 6 months',
          confidence: 75,
          advocatedBy: ['a1'],
          outcomes: [
            { description: 'Lower initial capital requirement', probability: 0.9, impact: 'positive' },
            { description: 'Delayed market presence', probability: 0.7, impact: 'negative' },
          ],
        },
        {
          id: 'p2',
          label: 'Aggressive Multi-Market',
          description: 'Simultaneous entry into Singapore, Malaysia, and Vietnam',
          confidence: 60,
          advocatedBy: ['a3'],
          outcomes: [
            { description: 'First-mover advantage', probability: 0.6, impact: 'positive' },
            { description: 'High execution risk', probability: 0.8, impact: 'negative' },
          ],
        },
        {
          id: 'p3',
          label: 'Strategic Delay',
          description: 'Wait for Q3 with focused preparation',
          confidence: 55,
          advocatedBy: ['a2'],
          outcomes: [
            { description: 'Better market timing', probability: 0.5, impact: 'positive' },
            { description: 'Competitor advantage', probability: 0.6, impact: 'negative' },
          ],
        },
      ],
      confidenceTerrain: generateMockTerrain(),
      createdAt: new Date().toISOString(),
    };

    setSessions([mockSession]);
    setActiveSession(mockSession);
    setLoading(false);
  }, []);

  function generateMockTerrain(): TerrainData {
    const segments: TerrainSegment[] = [];
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        const elevation = 30 + Math.sin(x / 2) * 20 + Math.cos(y / 2) * 20 + Math.random() * 10;
        segments.push({
          id: `${x}-${y}`,
          position: { x: x * 10, y: y * 10, z: elevation },
          elevation,
          color: elevation > 60 ? '#22c55e' : elevation > 40 ? '#f59e0b' : '#ef4444',
          hoverData: {
            title: `Zone ${x},${y}`,
            confidence: Math.round(elevation),
            risks: elevation < 40 ? ['High uncertainty', 'Incomplete data'] : [],
          },
        });
      }
    }
    return {
      segments,
      peakConfidence: { x: 50, y: 30, z: 75 },
      valleyRisks: [{ x: 20, y: 70 }, { x: 80, y: 60 }],
    };
  }

  const handleAnalyzeAdvisor = useCallback(async (advisorId: string) => {
    if (!activeSession) return;
    // Request analysis from advisor via API
    setLoading(true);
    try {
      await fetch(`/api/thinktank-admin/living-parchment/war-room/advisors/${advisorId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSession.id }),
      });
    } finally {
      setLoading(false);
    }
  }, [activeSession]);

  const handleSelectPath = useCallback((pathId: string) => {
    setActiveSession((prev: WarRoomSession | null) => prev ? {
      ...prev,
      selectedPathId: pathId,
    } : null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <style>{breathingKeyframes}</style>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Shield className="w-7 h-7 text-blue-500" />
            War Room
          </h1>
          <p className="text-slate-400 mt-1">Strategic Decision Theater</p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Session
        </button>
      </div>

      {activeSession && (
        <div className="grid grid-cols-12 gap-6">
          {/* Left Panel - Terrain & Status */}
          <div className="col-span-8 space-y-6">
            {/* Session Header */}
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">{activeSession.title}</h2>
                  <p className="text-slate-400 text-sm mt-1">{activeSession.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    activeSession.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    activeSession.status === 'decided' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>
                    {activeSession.status.charAt(0).toUpperCase() + activeSession.status.slice(1)}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    activeSession.stakeLevel === 'critical' ? 'bg-red-500/20 text-red-400' :
                    activeSession.stakeLevel === 'high' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>
                    {activeSession.stakeLevel.toUpperCase()} Stakes
                  </span>
                </div>
              </div>

              {/* Confidence Terrain */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Mountain className="w-4 h-4" />
                    Confidence Terrain
                  </h3>
                  {hoveredSegment && (
                    <span className="text-xs text-slate-400">
                      {hoveredSegment.hoverData.title}: {hoveredSegment.hoverData.confidence}% confidence
                    </span>
                  )}
                </div>
                <ConfidenceTerrain 
                  terrain={activeSession.confidenceTerrain} 
                  onSegmentHover={setHoveredSegment}
                />
              </div>

              {/* Legend */}
              <div className="flex items-center gap-6 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-green-500" />
                  <span>High Confidence (70%+)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-amber-500" />
                  <span>Moderate (40-70%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-red-500" />
                  <span>Low (&lt;40%)</span>
                </div>
              </div>
            </div>

            {/* Decision Paths */}
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-500" />
                Decision Paths
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {activeSession.decisionPaths.map(path => (
                  <DecisionPathCard
                    key={path.id}
                    path={path}
                    advisors={activeSession.advisors}
                    onSelect={() => handleSelectPath(path.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Advisors */}
          <div className="col-span-4 space-y-6">
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-500" />
                Advisory Council
              </h3>
              <div className="space-y-4">
                {activeSession.advisors.map(advisor => (
                  <AdvisorCard
                    key={advisor.id}
                    advisor={advisor}
                    onAnalyze={() => handleAnalyzeAdvisor(advisor.id)}
                  />
                ))}
              </div>
              <button className="w-full mt-4 py-2 px-4 border border-dashed border-slate-600 hover:border-slate-400 rounded-lg text-sm text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                Add Advisor
              </button>
            </div>

            {/* Quick Actions */}
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors">
                  <Play className="w-4 h-4" />
                  Run Analysis Round
                </button>
                <button className="w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors">
                  <Eye className="w-4 h-4" />
                  View Ghost Paths
                </button>
                <button className="w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors">
                  <Settings className="w-4 h-4" />
                  Session Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
