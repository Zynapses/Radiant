'use client';

/**
 * RADIANT v5.44.0 - Council of Experts UI
 * Multi-persona AI consultation with consensus visualization
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, Brain, MessageSquare, GitMerge, Zap, 
  Play, CheckCircle, AlertTriangle, ChevronRight,
  Plus, Sparkles, Scale, Lightbulb, Shield, Target,
  BarChart2, Heart
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface CouncilSession {
  id: string;
  topic: string;
  question: string;
  status: 'convening' | 'debating' | 'converging' | 'concluded';
  experts: Expert[];
  consensusLevel: number;
  rounds: DebateRound[];
  conclusion?: Conclusion;
}

interface Expert {
  id: string;
  persona: string;
  specialization: string;
  avatar: { color: string; icon: string };
  breathingAura: { color: string; rate: number; radius: number };
  currentPosition: {
    stance: string;
    confidence: number;
    keyPoints: string[];
  };
  credibilityScore: number;
}

interface DebateRound {
  number: number;
  arguments: ExpertArgument[];
}

interface ExpertArgument {
  id: string;
  expertId: string;
  content: string;
  type: 'assertion' | 'rebuttal' | 'concession' | 'question' | 'synthesis';
  livingInk: { fontWeight: number; conviction: number };
}

interface Conclusion {
  summary: string;
  confidence: number;
  keyInsights: string[];
  actionItems: string[];
  uncertainties: string[];
}

// =============================================================================
// EXPERT PERSONAS CONFIG
// =============================================================================

const PERSONA_ICONS: Record<string, React.ElementType> = {
  pragmatist: Target,
  ethicist: Scale,
  innovator: Lightbulb,
  skeptic: Shield,
  synthesizer: GitMerge,
  analyst: BarChart2,
  strategist: Target,
  humanist: Heart,
};

// =============================================================================
// BREATHING STYLES
// =============================================================================

const breathingStyles = `
  @keyframes expert-breathe {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
    50% { transform: scale(1.02); box-shadow: 0 0 20px 5px rgba(59, 130, 246, 0.2); }
  }
  @keyframes consensus-pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
  @keyframes spark {
    0% { opacity: 0; transform: scale(0.5); }
    50% { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(0.5); }
  }
`;

// =============================================================================
// EXPERT CARD COMPONENT
// =============================================================================

function ExpertCard({ expert, isActive }: { expert: Expert; isActive: boolean }) {
  const IconComponent = PERSONA_ICONS[expert.persona] || Brain;

  return (
    <div 
      className={`relative p-4 rounded-xl border transition-all duration-300 ${
        isActive 
          ? 'bg-slate-800 border-slate-600' 
          : 'bg-slate-900 border-slate-800'
      }`}
      style={{
        animation: isActive ? 'expert-breathe 3s ease-in-out infinite' : 'none',
      }}
    >
      {/* Breathing aura background */}
      <div 
        className="absolute inset-0 rounded-xl opacity-10"
        style={{ 
          backgroundColor: expert.breathingAura.color,
          filter: `blur(${expert.breathingAura.radius / 3}px)`,
        }}
      />

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${expert.avatar.color}30` }}
          >
            <IconComponent className="w-5 h-5" style={{ color: expert.avatar.color }} />
          </div>
          <div>
            <h4 className="font-medium text-white capitalize">{expert.persona}</h4>
            <p className="text-xs text-slate-400">{expert.specialization}</p>
          </div>
        </div>

        {/* Credibility bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Credibility</span>
            <span>{expert.credibilityScore}%</span>
          </div>
          <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full"
              style={{ 
                width: `${expert.credibilityScore}%`,
                backgroundColor: expert.avatar.color,
              }}
            />
          </div>
        </div>

        {/* Current stance */}
        {expert.currentPosition.stance && (
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <p 
              className="text-sm text-slate-300"
              style={{ fontWeight: 350 + (expert.currentPosition.confidence * 1.5) }}
            >
              &ldquo;{expert.currentPosition.stance}&rdquo;
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-slate-500">Conviction:</span>
              <span 
                className="text-xs font-medium"
                style={{ color: expert.avatar.color }}
              >
                {expert.currentPosition.confidence}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// ARGUMENT STREAM COMPONENT
// =============================================================================

function ArgumentStream({ argument, expert }: { argument: ExpertArgument; expert?: Expert }) {
  const typeColors: Record<string, string> = {
    assertion: '#3b82f6',
    rebuttal: '#ef4444',
    concession: '#22c55e',
    question: '#f59e0b',
    synthesis: '#8b5cf6',
  };

  const typeIcons: Record<string, React.ElementType> = {
    assertion: ChevronRight,
    rebuttal: AlertTriangle,
    concession: CheckCircle,
    question: MessageSquare,
    synthesis: GitMerge,
  };

  const Icon = typeIcons[argument.type] || MessageSquare;
  const color = typeColors[argument.type] || '#6366f1';

  return (
    <div className="flex gap-3 p-3 bg-slate-800/50 rounded-lg">
      <div 
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-white capitalize">
            {expert?.persona || 'Expert'}
          </span>
          <span 
            className="px-2 py-0.5 rounded text-xs"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {argument.type}
          </span>
        </div>
        <p 
          className="text-sm text-slate-300"
          style={{ fontWeight: argument.livingInk.fontWeight }}
        >
          {argument.content}
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// CONSENSUS VISUALIZATION
// =============================================================================

function ConsensusVisualization({ level, experts }: { level: number; experts: Expert[] }) {
  // Calculate positions on a circle
  const radius = 80;
  const center = { x: 100, y: 100 };

  return (
    <div className="relative w-[200px] h-[200px] mx-auto">
      {/* Consensus circle */}
      <svg className="absolute inset-0" viewBox="0 0 200 200">
        {/* Background circle */}
        <circle 
          cx={center.x} 
          cy={center.y} 
          r={radius} 
          fill="none" 
          stroke="#334155" 
          strokeWidth="2"
        />
        
        {/* Consensus fill */}
        <circle 
          cx={center.x} 
          cy={center.y} 
          r={radius * (level / 100)} 
          fill={level > 70 ? '#22c55e20' : level > 40 ? '#f59e0b20' : '#ef444420'}
          style={{ animation: 'consensus-pulse 2s ease-in-out infinite' }}
        />

        {/* Expert positions */}
        {experts.map((expert, i) => {
          const angle = (i / experts.length) * 2 * Math.PI - Math.PI / 2;
          const distance = radius * (1 - (level / 200)); // Move closer as consensus increases
          const x = center.x + Math.cos(angle) * distance;
          const y = center.y + Math.sin(angle) * distance;

          return (
            <g key={expert.id}>
              <circle 
                cx={x} 
                cy={y} 
                r={8} 
                fill={expert.avatar.color}
                style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.3))' }}
              />
              {/* Connection lines when converging */}
              {level > 50 && (
                <line
                  x1={x}
                  y1={y}
                  x2={center.x}
                  y2={center.y}
                  stroke={expert.avatar.color}
                  strokeWidth="1"
                  strokeOpacity="0.3"
                  strokeDasharray="4,4"
                />
              )}
            </g>
          );
        })}

        {/* Dissent sparks */}
        {level < 50 && experts.map((e1, i) => 
          experts.slice(i + 1).map((e2, j) => {
            if (e1.currentPosition.stance !== e2.currentPosition.stance && e1.currentPosition.stance && e2.currentPosition.stance) {
              const angle1 = (i / experts.length) * 2 * Math.PI - Math.PI / 2;
              const angle2 = ((i + j + 1) / experts.length) * 2 * Math.PI - Math.PI / 2;
              const x1 = center.x + Math.cos(angle1) * (radius * 0.7);
              const y1 = center.y + Math.sin(angle1) * (radius * 0.7);
              const x2 = center.x + Math.cos(angle2) * (radius * 0.7);
              const y2 = center.y + Math.sin(angle2) * (radius * 0.7);
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              return (
                <circle
                  key={`spark-${i}-${j}`}
                  cx={midX}
                  cy={midY}
                  r={3}
                  fill="#ef4444"
                  style={{ animation: 'spark 1s ease-in-out infinite' }}
                />
              );
            }
            return null;
          })
        )}
      </svg>

      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{level}%</span>
        <span className="text-xs text-slate-400">Consensus</span>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function CouncilPage() {
  const [session, setSession] = useState<CouncilSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningRound, setRunningRound] = useState(false);

  useEffect(() => {
    // Mock data
    const mockSession: CouncilSession = {
      id: '1',
      topic: 'AI Ethics in Healthcare',
      question: 'Should AI systems be allowed to make autonomous treatment recommendations without human oversight?',
      status: 'debating',
      consensusLevel: 45,
      experts: [
        {
          id: 'e1',
          persona: 'pragmatist',
          specialization: 'Practical Implementation',
          avatar: { color: '#3b82f6', icon: 'target' },
          breathingAura: { color: '#3b82f6', rate: 6, radius: 30 },
          currentPosition: {
            stance: 'Limited autonomy with clear escalation protocols',
            confidence: 72,
            keyPoints: ['Reduces clinician workload', 'Maintains safety nets'],
          },
          credibilityScore: 85,
        },
        {
          id: 'e2',
          persona: 'ethicist',
          specialization: 'Medical Ethics',
          avatar: { color: '#8b5cf6', icon: 'scale' },
          breathingAura: { color: '#8b5cf6', rate: 6, radius: 30 },
          currentPosition: {
            stance: 'Human oversight is non-negotiable for treatment decisions',
            confidence: 88,
            keyPoints: ['Patient autonomy', 'Accountability'],
          },
          credibilityScore: 90,
        },
        {
          id: 'e3',
          persona: 'innovator',
          specialization: 'AI Technology',
          avatar: { color: '#f59e0b', icon: 'lightbulb' },
          breathingAura: { color: '#f59e0b', rate: 8, radius: 30 },
          currentPosition: {
            stance: 'AI can outperform humans in specific diagnostic tasks',
            confidence: 78,
            keyPoints: ['Superior pattern recognition', 'Consistency'],
          },
          credibilityScore: 75,
        },
        {
          id: 'e4',
          persona: 'skeptic',
          specialization: 'Risk Analysis',
          avatar: { color: '#ef4444', icon: 'shield' },
          breathingAura: { color: '#ef4444', rate: 8, radius: 30 },
          currentPosition: {
            stance: 'Current AI systems are not reliable enough for autonomous decisions',
            confidence: 82,
            keyPoints: ['Hallucination risks', 'Liability concerns'],
          },
          credibilityScore: 80,
        },
      ],
      rounds: [
        {
          number: 1,
          arguments: [
            {
              id: 'a1',
              expertId: 'e1',
              content: 'We should focus on specific use cases where AI has proven reliability, like image analysis for radiology.',
              type: 'assertion',
              livingInk: { fontWeight: 420, conviction: 72 },
            },
            {
              id: 'a2',
              expertId: 'e2',
              content: 'Even in radiology, the final diagnosis should involve human review. The question is about treatment, which has higher stakes.',
              type: 'rebuttal',
              livingInk: { fontWeight: 440, conviction: 88 },
            },
            {
              id: 'a3',
              expertId: 'e3',
              content: 'What if AI recommendations come with confidence intervals and mandatory review thresholds?',
              type: 'question',
              livingInk: { fontWeight: 400, conviction: 78 },
            },
            {
              id: 'a4',
              expertId: 'e4',
              content: 'That approach has merit, but who determines the thresholds? And who is liable when the AI is wrong but confident?',
              type: 'rebuttal',
              livingInk: { fontWeight: 430, conviction: 82 },
            },
          ],
        },
      ],
      conclusion: undefined,
    };

    setSession(mockSession);
    setLoading(false);
  }, []);

  const handleRunRound = async () => {
    setRunningRound(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setRunningRound(false);
  };

  const handleConclude = async () => {
    // Would call API to conclude session
    console.log('Concluding session');
  };

  if (loading || !session) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <style>{breathingStyles}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Users className="w-7 h-7 text-purple-500" />
            Council of Experts
          </h1>
          <p className="text-slate-400 mt-1">Multi-persona AI consultation</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm ${
            session.status === 'converging' ? 'bg-green-500/20 text-green-400' :
            session.status === 'debating' ? 'bg-blue-500/20 text-blue-400' :
            'bg-slate-500/20 text-slate-400'
          }`}>
            {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Topic */}
      <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 mb-6">
        <h2 className="text-lg font-semibold mb-2">{session.topic}</h2>
        <p className="text-slate-400">{session.question}</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left - Experts & Consensus */}
        <div className="col-span-4 space-y-6">
          {/* Consensus Visualization */}
          <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
            <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
              <GitMerge className="w-4 h-4" />
              Consensus State
            </h3>
            <ConsensusVisualization level={session.consensusLevel} experts={session.experts} />
            <div className="mt-4 text-center text-sm text-slate-400">
              {session.consensusLevel < 40 && 'Significant divergence - more rounds needed'}
              {session.consensusLevel >= 40 && session.consensusLevel < 70 && 'Positions converging'}
              {session.consensusLevel >= 70 && 'Strong consensus emerging'}
            </div>
          </div>

          {/* Expert Cards */}
          <div className="space-y-4">
            {session.experts.map(expert => (
              <ExpertCard 
                key={expert.id} 
                expert={expert} 
                isActive={session.status === 'debating'}
              />
            ))}
          </div>
        </div>

        {/* Right - Debate Stream */}
        <div className="col-span-8 space-y-6">
          {/* Argument Stream */}
          <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                Debate Stream
              </h3>
              <span className="text-sm text-slate-400">
                Round {session.rounds.length}
              </span>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {session.rounds.flatMap(round => 
                round.arguments.map(arg => (
                  <ArgumentStream
                    key={arg.id}
                    argument={arg}
                    expert={session.experts.find(e => e.id === arg.expertId)}
                  />
                ))
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
              <button
                onClick={handleRunRound}
                disabled={runningRound || session.status === 'concluded'}
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {runningRound ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Running Round...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Debate Round
                  </>
                )}
              </button>
              <button
                onClick={handleConclude}
                disabled={session.consensusLevel < 40 || session.status === 'concluded'}
                className="px-4 py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Conclude
              </button>
            </div>
          </div>

          {/* Conclusion (if available) */}
          {session.conclusion && (
            <div className="p-6 bg-slate-900 rounded-xl border border-green-500/30">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Council Conclusion
              </h3>
              <p className="text-slate-300 mb-4">{session.conclusion.summary}</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Key Insights</h4>
                  <ul className="space-y-1">
                    {session.conclusion.keyInsights.map((insight, i) => (
                      <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                        <Sparkles className="w-3 h-3 text-yellow-500 mt-1 flex-shrink-0" />
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Action Items</h4>
                  <ul className="space-y-1">
                    {session.conclusion.actionItems.map((item, i) => (
                      <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                        <ChevronRight className="w-3 h-3 text-blue-500 mt-1 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
