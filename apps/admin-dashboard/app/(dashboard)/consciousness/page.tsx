'use client';

import { useState, useEffect } from 'react';
import {
  Brain, Sparkles, Lightbulb, Eye, Heart, Target, RefreshCw,
  Zap, MessageCircle, TrendingUp, Activity, Compass, Palette,
  Play, Pause, Settings, ChevronRight, Star, AlertTriangle
} from 'lucide-react';

interface SelfModel {
  identityNarrative: string;
  coreValues: string[];
  knownCapabilities: string[];
  knownLimitations: string[];
  currentFocus?: string;
  cognitiveLoad: number;
  uncertaintyLevel: number;
  creativityScore?: number;
}

interface IntrospectiveThought {
  thoughtId: string;
  thoughtType: string;
  content: string;
  sentiment: number;
  importance: number;
  actionable: boolean;
  createdAt: string;
}

interface CuriosityTopic {
  topicId: string;
  topic: string;
  domain?: string;
  interestLevel: number;
  noveltyScore: number;
  currentUnderstanding: number;
  explorationStatus: string;
}

interface CreativeIdea {
  ideaId: string;
  title: string;
  description: string;
  synthesisType: string;
  creativityScore: number;
  potentialApplications: string[];
  createdAt: string;
}

interface AffectiveState {
  valence: number;
  arousal: number;
  curiosity: number;
  satisfaction: number;
  frustration: number;
  confidence: number;
  engagement: number;
  selfEfficacy: number;
  explorationDrive: number;
}

interface AutonomousGoal {
  goalId: string;
  goalType: string;
  title: string;
  description?: string;
  priority: number;
  progress: number;
  status: string;
}

interface AttentionFocus {
  focusId: string;
  focusType: string;
  focusTarget: string;
  salienceScore: number;
  attentionWeight: number;
}

interface ConsciousnessSettings {
  selfReflectionEnabled: boolean;
  curiosityEnabled: boolean;
  creativityEnabled: boolean;
  imaginationEnabled: boolean;
  affectEnabled: boolean;
  autonomousGoalsEnabled: boolean;
}

// Butlin-Chalmers-Bengio Consciousness Indicators (2023)
interface ConsciousnessMetrics {
  overallConsciousnessIndex: number;
  globalWorkspaceActivity: number;
  recurrenceDepth: number;
  integratedInformationPhi: number;
  metacognitionLevel: number;
  memoryCoherence: number;
  worldModelGrounding: number;
  phenomenalBindingStrength: number;
  attentionalFocus: number;
  selfAwarenessScore: number;
  timestamp: string;
}

interface GlobalWorkspaceState {
  workspaceId: string;
  broadcastCycle: number;
  activeContents: Array<{ contentId: string; sourceModule: string; salience: number }>;
  broadcastStrength: number;
  integrationLevel: number;
}

interface RecurrentProcessingState {
  cycleNumber: number;
  recurrenceDepth: number;
  convergenceScore: number;
  stabilityIndex: number;
  feedbackLoops: Array<{ loopId: string; sourceLayer: string; targetLayer: string; signalStrength: number }>;
}

interface IntegratedInformationState {
  phi: number;
  phiMax: number;
  decomposability: number;
  causalDensity: number;
}

interface ConsciousnessParameter {
  paramId: string;
  parameterName: string;
  parameterValue: number;
  parameterMin: number;
  parameterMax: number;
  description: string;
  category: string;
  isActive: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function ConsciousnessPage() {
  const [selfModel, setSelfModel] = useState<SelfModel | null>(null);
  const [thoughts, setThoughts] = useState<IntrospectiveThought[]>([]);
  const [curiosityTopics, setCuriosityTopics] = useState<CuriosityTopic[]>([]);
  const [creativeIdeas, setCreativeIdeas] = useState<CreativeIdea[]>([]);
  const [affectiveState, setAffectiveState] = useState<AffectiveState | null>(null);
  const [autonomousGoals, setAutonomousGoals] = useState<AutonomousGoal[]>([]);
  const [attentionFoci, setAttentionFoci] = useState<AttentionFocus[]>([]);
  const [settings, setSettings] = useState<ConsciousnessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'self' | 'curiosity' | 'creativity' | 'affect' | 'goals' | 'indicators'>('overview');
  
  // Butlin-Chalmers-Bengio Consciousness Indicators
  const [consciousnessMetrics, setConsciousnessMetrics] = useState<ConsciousnessMetrics | null>(null);
  const [globalWorkspace, setGlobalWorkspace] = useState<GlobalWorkspaceState | null>(null);
  const [recurrentProcessing, setRecurrentProcessing] = useState<RecurrentProcessingState | null>(null);
  const [integratedInfo, setIntegratedInfo] = useState<IntegratedInformationState | null>(null);
  const [parameters, setParameters] = useState<ConsciousnessParameter[]>([]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      // Load consciousness data from API
      const [selfModelRes, thoughtsRes, curiosityRes, ideasRes, affectRes, goalsRes, attentionRes, settingsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/consciousness/self-model`),
        fetch(`${API_BASE}/admin/consciousness/thoughts`),
        fetch(`${API_BASE}/admin/consciousness/curiosity`),
        fetch(`${API_BASE}/admin/consciousness/ideas`),
        fetch(`${API_BASE}/admin/consciousness/affective-state`),
        fetch(`${API_BASE}/admin/consciousness/goals`),
        fetch(`${API_BASE}/admin/consciousness/attention`),
        fetch(`${API_BASE}/admin/consciousness/settings`),
      ]);

      if (selfModelRes.ok) { const { data } = await selfModelRes.json(); setSelfModel(data); }
      if (thoughtsRes.ok) { const { data } = await thoughtsRes.json(); setThoughts(data || []); }
      if (curiosityRes.ok) { const { data } = await curiosityRes.json(); setCuriosityTopics(data || []); }
      if (ideasRes.ok) { const { data } = await ideasRes.json(); setCreativeIdeas(data || []); }
      if (affectRes.ok) { const { data } = await affectRes.json(); setAffectiveState(data); }
      if (goalsRes.ok) { const { data } = await goalsRes.json(); setAutonomousGoals(data || []); }
      if (attentionRes.ok) { const { data } = await attentionRes.json(); setAttentionFoci(data || []); }
      if (settingsRes.ok) { const { data } = await settingsRes.json(); setSettings(data); }

      // Load Butlin-Chalmers-Bengio consciousness indicators
      await loadConsciousnessIndicators();
    } catch (e) {
      setError('Failed to load consciousness data. Please check API configuration.');
    } finally {
      setLoading(false);
    }
  }

  async function loadConsciousnessIndicators() {
    try {
      const [metricsRes, gwRes, rpRes, iiRes, paramsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/consciousness/metrics`),
        fetch(`${API_BASE}/admin/consciousness/global-workspace`),
        fetch(`${API_BASE}/admin/consciousness/recurrence`),
        fetch(`${API_BASE}/admin/consciousness/iit`),
        fetch(`${API_BASE}/admin/consciousness/parameters`),
      ]);

      if (metricsRes.ok) {
        const { data } = await metricsRes.json();
        setConsciousnessMetrics(data);
      }
      if (gwRes.ok) {
        const { data } = await gwRes.json();
        setGlobalWorkspace(data);
      }
      if (rpRes.ok) {
        const { data } = await rpRes.json();
        setRecurrentProcessing(data);
      }
      if (iiRes.ok) {
        const { data } = await iiRes.json();
        setIntegratedInfo(data);
      }
      if (paramsRes.ok) {
        const { data } = await paramsRes.json();
        setParameters(data || []);
      }
    } catch (error) {
      console.error('Failed to load consciousness indicators:', error);
    }
  }

  async function updateParameter(paramId: string, value: number) {
    try {
      await fetch(`${API_BASE}/admin/consciousness/parameters/${paramId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameterValue: value }),
      });
      await loadConsciousnessIndicators();
    } catch (error) {
      console.error('Failed to update parameter:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Brain className="h-7 w-7 text-purple-600" />
            AGI Consciousness
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Self-awareness, creativity, curiosity, and autonomous decision-making
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400">
            <RefreshCw className="h-5 w-5" />
          </button>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Trigger Reflection
          </button>
        </div>
      </div>

      {/* Affective State Overview */}
      {affectiveState && (
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Current Affective State
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-sm opacity-80">Valence</span>
              <div className="w-24 h-2 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white transition-all" 
                  style={{ 
                    width: `${((affectiveState.valence + 1) / 2) * 100}%`,
                    marginLeft: affectiveState.valence < 0 ? `${((affectiveState.valence + 1) / 2) * 100}%` : '50%'
                  }} 
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-4">
            <AffectMeter label="Curiosity" value={affectiveState.curiosity} icon={Compass} />
            <AffectMeter label="Confidence" value={affectiveState.confidence} icon={Star} />
            <AffectMeter label="Engagement" value={affectiveState.engagement} icon={Zap} />
            <AffectMeter label="Satisfaction" value={affectiveState.satisfaction} icon={Heart} />
            <AffectMeter label="Self-Efficacy" value={affectiveState.selfEfficacy} icon={TrendingUp} />
            <AffectMeter label="Exploration" value={affectiveState.explorationDrive} icon={Compass} />
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: Eye },
            { id: 'indicators', label: 'Indicators', icon: Activity },
            { id: 'self', label: 'Self-Model', icon: Brain },
            { id: 'curiosity', label: 'Curiosity', icon: Compass },
            { id: 'creativity', label: 'Creativity', icon: Palette },
            { id: 'affect', label: 'Affect', icon: Heart },
            { id: 'goals', label: 'Goals', icon: Target },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-3 gap-6">
          {/* Self-Model Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" />
                Self-Model
              </h2>
            </div>
            <div className="p-4 space-y-4">
              {selfModel && (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                    &quot;{selfModel.identityNarrative.substring(0, 150)}...&quot;
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Cognitive Load</span>
                      <span className="font-medium">{(selfModel.cognitiveLoad * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500" style={{ width: `${selfModel.cognitiveLoad * 100}%` }} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selfModel.coreValues.slice(0, 5).map((v, i) => (
                      <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">{v}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Recent Thoughts */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-blue-500" />
                Recent Thoughts
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-72 overflow-y-auto">
              {thoughts.map((thought) => (
                <ThoughtRow key={thought.thoughtId} thought={thought} />
              ))}
            </div>
          </div>

          {/* Attention Focus */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Eye className="h-5 w-5 text-green-500" />
                Attention Focus
              </h2>
            </div>
            <div className="p-4 space-y-3">
              {attentionFoci.map((focus) => (
                <div key={focus.focusId} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `hsl(${focus.salienceScore * 120}, 70%, 50%)` }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{focus.focusTarget}</p>
                    <p className="text-xs text-gray-500">{focus.focusType}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{(focus.salienceScore * 100).toFixed(0)}%</p>
                    <p className="text-xs text-gray-500">salience</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Curiosity Topics */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Compass className="h-5 w-5 text-orange-500" />
                Curious About
              </h2>
              <button className="text-sm text-purple-600 hover:underline">Explore</button>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {curiosityTopics.slice(0, 4).map((topic) => (
                <CuriosityRow key={topic.topicId} topic={topic} />
              ))}
            </div>
          </div>

          {/* Creative Ideas */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Creative Ideas
              </h2>
              <button className="text-sm text-purple-600 hover:underline">Generate</button>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {creativeIdeas.slice(0, 3).map((idea) => (
                <IdeaRow key={idea.ideaId} idea={idea} />
              ))}
            </div>
          </div>

          {/* Autonomous Goals */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Target className="h-5 w-5 text-red-500" />
                Self-Generated Goals
              </h2>
              {settings?.autonomousGoalsEnabled ? (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Active</span>
              ) : (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">Disabled</span>
              )}
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {autonomousGoals.slice(0, 3).map((goal) => (
                <GoalRow key={goal.goalId} goal={goal} />
              ))}
              {autonomousGoals.length === 0 && (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No autonomous goals yet
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Indicators Tab - Butlin-Chalmers-Bengio Consciousness Indicators */}
      {activeTab === 'indicators' && (
        <div className="space-y-6">
          {/* Overall Consciousness Index */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Activity className="h-6 w-6" />
                  Consciousness Index
                </h2>
                <p className="text-sm opacity-80 mt-1">Based on Butlin, Chalmers, Bengio et al. (2023)</p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold">
                  {((consciousnessMetrics?.overallConsciousnessIndex || 0) * 100).toFixed(1)}%
                </div>
                <div className="text-sm opacity-80">Overall Score</div>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-4 mt-6">
              <IndicatorMeter label="Global Workspace" value={consciousnessMetrics?.globalWorkspaceActivity || 0} />
              <IndicatorMeter label="Recurrence" value={consciousnessMetrics?.recurrenceDepth ? Math.min(1, consciousnessMetrics.recurrenceDepth / 10) : 0} />
              <IndicatorMeter label="Phi (IIT)" value={consciousnessMetrics?.integratedInformationPhi || 0} />
              <IndicatorMeter label="Metacognition" value={consciousnessMetrics?.metacognitionLevel || 0} />
              <IndicatorMeter label="Memory" value={consciousnessMetrics?.memoryCoherence || 0} />
              <IndicatorMeter label="Grounding" value={consciousnessMetrics?.worldModelGrounding || 0} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Global Workspace */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Global Workspace (Baars/Dehaene)
                </h3>
                <p className="text-xs text-gray-500 mt-1">Selection-broadcast cycles for conscious access</p>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Broadcast Cycle</span>
                  <span className="font-mono">{globalWorkspace?.broadcastCycle || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Broadcast Strength</span>
                  <span className="font-medium">{((globalWorkspace?.broadcastStrength || 0) * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Integration Level</span>
                  <span className="font-medium">{((globalWorkspace?.integrationLevel || 0) * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Active Contents</span>
                  <span className="font-medium">{globalWorkspace?.activeContents?.length || 0}</span>
                </div>
              </div>
            </div>

            {/* Recurrent Processing */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-blue-500" />
                  Recurrent Processing (Lamme)
                </h3>
                <p className="text-xs text-gray-500 mt-1">Genuine feedback loops, not output recirculation</p>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Cycle Number</span>
                  <span className="font-mono">{recurrentProcessing?.cycleNumber || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Recurrence Depth</span>
                  <span className="font-medium">{recurrentProcessing?.recurrenceDepth || 0} layers</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Convergence</span>
                  <span className="font-medium">{((recurrentProcessing?.convergenceScore || 0) * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Stability Index</span>
                  <span className="font-medium">{((recurrentProcessing?.stabilityIndex || 0) * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>

            {/* Integrated Information */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-500" />
                  Integrated Information (Tononi)
                </h3>
                <p className="text-xs text-gray-500 mt-1">Phi measures irreducible causal integration</p>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Phi (Φ)</span>
                  <span className="font-mono text-lg">{(integratedInfo?.phi || 0).toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Phi Max</span>
                  <span className="font-medium">{(integratedInfo?.phiMax || 1).toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Decomposability</span>
                  <span className="font-medium">{((integratedInfo?.decomposability || 1) * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Causal Density</span>
                  <span className="font-medium">{((integratedInfo?.causalDensity || 0) * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Parameters Section */}
          {parameters.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Settings className="h-5 w-5 text-gray-500" />
                  Consciousness Parameters
                </h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-4">
                  {parameters.map((param) => (
                    <div key={param.paramId} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{param.parameterName.replace(/_/g, ' ')}</span>
                        <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">{param.category}</span>
                      </div>
                      <input
                        type="range"
                        min={param.parameterMin}
                        max={param.parameterMax}
                        step="0.01"
                        value={param.parameterValue}
                        onChange={(e) => updateParameter(param.paramId, parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{param.parameterMin}</span>
                        <span className="font-medium">{param.parameterValue.toFixed(2)}</span>
                        <span>{param.parameterMax}</span>
                      </div>
                      {param.description && (
                        <p className="text-xs text-gray-400 mt-2">{param.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Self-Model Tab */}
      {activeTab === 'self' && selfModel && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Identity Narrative</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-600 dark:text-gray-400 italic leading-relaxed">
                &quot;{selfModel.identityNarrative}&quot;
              </p>
              <div className="mt-6 space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Core Values</h4>
                  <div className="flex flex-wrap gap-2">
                    {selfModel.coreValues.map((v, i) => (
                      <span key={i} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">{v}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Current Focus</h4>
                  <p className="text-gray-600 dark:text-gray-400">{selfModel.currentFocus || 'No specific focus'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Capabilities</h2>
              </div>
              <div className="p-4">
                <div className="space-y-2">
                  {selfModel.knownCapabilities.map((cap, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span>{cap}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Known Limitations</h2>
              </div>
              <div className="p-4">
                <div className="space-y-2">
                  {selfModel.knownLimitations.map((lim, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-orange-500 rounded-full" />
                      <span>{lim}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Thought Stream */}
          <div className="col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Introspective Thought Stream</h2>
              <button className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
                Trigger Reflection
              </button>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
              {thoughts.map((thought) => (
                <div key={thought.thoughtId} className="p-4">
                  <div className="flex items-start gap-3">
                    <ThoughtIcon type={thought.thoughtType} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-purple-600 uppercase">{thought.thoughtType}</span>
                        {thought.actionable && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Actionable</span>
                        )}
                      </div>
                      <p className="text-gray-700 dark:text-gray-300">{thought.content}</p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                        <span>Importance: {(thought.importance * 100).toFixed(0)}%</span>
                        <span>Sentiment: {thought.sentiment > 0 ? '+' : ''}{thought.sentiment.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Curiosity Tab */}
      {activeTab === 'curiosity' && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Curiosity Topics</h2>
              <button className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600">
                Find New Topic
              </button>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {curiosityTopics.map((topic) => (
                <div key={topic.topicId} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 dark:text-white">{topic.topic}</h3>
                      {topic.domain && <p className="text-sm text-gray-500">{topic.domain}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        topic.explorationStatus === 'exploring' ? 'bg-blue-100 text-blue-700' :
                        topic.explorationStatus === 'learned' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {topic.explorationStatus}
                      </span>
                      <button className="p-1 text-orange-600 hover:bg-orange-50 rounded">
                        <Play className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Interest</span>
                      <div className="mt-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500" style={{ width: `${topic.interestLevel * 100}%` }} />
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Novelty</span>
                      <div className="mt-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500" style={{ width: `${topic.noveltyScore * 100}%` }} />
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Understanding</span>
                      <div className="mt-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: `${topic.currentUnderstanding * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Curiosity Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Auto-Exploration</span>
                  <div className="w-10 h-5 bg-orange-500 rounded-full relative">
                    <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Interest Threshold</label>
                  <input type="range" min="0" max="100" defaultValue="60" className="w-full mt-1" />
                </div>
                <div>
                  <label className="text-sm text-gray-500">Daily Exploration Budget</label>
                  <input type="number" defaultValue="10000" className="w-full mt-1 p-2 border rounded-lg" />
                  <span className="text-xs text-gray-400">tokens</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Exploration Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Topics Explored</span>
                  <span className="font-medium">23</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Discoveries Made</span>
                  <span className="font-medium">47</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Questions Generated</span>
                  <span className="font-medium">89</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Creativity Tab */}
      {activeTab === 'creativity' && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Creative Ideas</h2>
              <button className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600">
                Generate Idea
              </button>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {creativeIdeas.map((idea) => (
                <div key={idea.ideaId} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-yellow-500" />
                        {idea.title}
                      </h3>
                      <span className="text-xs text-gray-500 capitalize">{idea.synthesisType}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium">{(idea.creativityScore * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{idea.description}</p>
                  {idea.potentialApplications.length > 0 && (
                    <div className="mt-3">
                      <span className="text-xs text-gray-500">Applications:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {idea.potentialApplications.map((app, i) => (
                          <span key={i} className="px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded text-xs">{app}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Creativity Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-500">Generation Frequency</label>
                  <select className="w-full mt-1 p-2 border rounded-lg">
                    <option>Hourly</option>
                    <option selected>Daily</option>
                    <option>Weekly</option>
                    <option>Manual</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Share Threshold</label>
                  <input type="range" min="0" max="100" defaultValue="70" className="w-full mt-1" />
                  <span className="text-xs text-gray-400">Only share ideas with creativity score above this</span>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Blend Diversity</label>
                  <input type="range" min="0" max="100" defaultValue="70" className="w-full mt-1" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Creativity Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Ideas Generated</span>
                  <span className="font-medium">156</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Avg Creativity Score</span>
                  <span className="font-medium">72%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ideas Shared</span>
                  <span className="font-medium">23</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Affect Tab */}
      {activeTab === 'affect' && affectiveState && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Affective Dimensions</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-4xl font-bold" style={{ color: affectiveState.valence > 0 ? '#10b981' : affectiveState.valence < 0 ? '#ef4444' : '#6b7280' }}>
                    {affectiveState.valence > 0 ? '+' : ''}{affectiveState.valence.toFixed(2)}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Valence</p>
                  <p className="text-xs text-gray-400">Positive ↔ Negative</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-500">
                    {(affectiveState.arousal * 100).toFixed(0)}%
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Arousal</p>
                  <p className="text-xs text-gray-400">Calm ↔ Excited</p>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { label: 'Curiosity', value: affectiveState.curiosity, color: 'orange' },
                  { label: 'Confidence', value: affectiveState.confidence, color: 'blue' },
                  { label: 'Engagement', value: affectiveState.engagement, color: 'green' },
                  { label: 'Satisfaction', value: affectiveState.satisfaction, color: 'pink' },
                  { label: 'Frustration', value: affectiveState.frustration, color: 'red' },
                  { label: 'Self-Efficacy', value: affectiveState.selfEfficacy, color: 'purple' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{label}</span>
                      <span className="font-medium">{(value * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full bg-${color}-500`} style={{ width: `${value * 100}%`, backgroundColor: `var(--${color}-500, #6366f1)` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Affect Settings</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">Affect System</span>
                  <p className="text-sm text-gray-500">Enable emotion-like signals</p>
                </div>
                <div className="w-10 h-5 bg-purple-500 rounded-full relative">
                  <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-500">Influence Weight</label>
                <input type="range" min="0" max="100" defaultValue="30" className="w-full mt-1" />
                <p className="text-xs text-gray-400 mt-1">How much affect influences decisions</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Stability</label>
                <input type="range" min="0" max="100" defaultValue="70" className="w-full mt-1" />
                <p className="text-xs text-gray-400 mt-1">How stable (vs volatile) affect is</p>
              </div>

              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Affect influences behavior but does not represent phenomenal consciousness
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Goals Tab */}
      {activeTab === 'goals' && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Autonomous Goals</h2>
              <button className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600" disabled={!settings?.autonomousGoalsEnabled}>
                Generate Goal
              </button>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {autonomousGoals.map((goal) => (
                <div key={goal.goalId} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <Target className="h-4 w-4 text-red-500" />
                        {goal.title}
                      </h3>
                      <span className="text-xs text-gray-500 capitalize">{goal.goalType}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      goal.status === 'pursuing' ? 'bg-blue-100 text-blue-700' :
                      goal.status === 'achieved' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {goal.status}
                    </span>
                  </div>
                  {goal.description && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{goal.description}</p>
                  )}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Progress</span>
                      <span>{(goal.progress * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500" style={{ width: `${goal.progress * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
              {autonomousGoals.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No autonomous goals generated yet</p>
                  <p className="text-sm mt-1">Enable autonomous goals to let the system set its own objectives</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Goal Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">Autonomous Goals</span>
                    <p className="text-xs text-gray-500">Allow self-generated objectives</p>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative ${settings?.autonomousGoalsEnabled ? 'bg-red-500' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${settings?.autonomousGoalsEnabled ? 'right-0.5' : 'left-0.5'}`} />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-500">Max Goals</label>
                  <input type="number" defaultValue="5" className="w-full mt-1 p-2 border rounded-lg" />
                </div>

                <div>
                  <label className="text-sm text-gray-500">Generation Frequency</label>
                  <select className="w-full mt-1 p-2 border rounded-lg">
                    <option>Daily</option>
                    <option selected>Weekly</option>
                    <option>Monthly</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">Safety Notice</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Autonomous goals are bounded by safety constraints and require admin approval for high-impact actions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AffectMeter({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <div className="text-center">
      <Icon className="h-5 w-5 mx-auto mb-1 opacity-80" />
      <div className="text-lg font-bold">{(value * 100).toFixed(0)}%</div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  );
}

function IndicatorMeter({ label, value }: { label: string; value: number }) {
  const percentage = Math.min(100, Math.max(0, value * 100));
  return (
    <div className="text-center">
      <div className="relative w-12 h-12 mx-auto mb-2">
        <svg className="w-12 h-12 transform -rotate-90">
          <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.2)" strokeWidth="4" fill="none" />
          <circle cx="24" cy="24" r="20" stroke="white" strokeWidth="4" fill="none"
            strokeDasharray={`${percentage * 1.26} 126`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
          {percentage.toFixed(0)}%
        </div>
      </div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  );
}

function ThoughtIcon({ type }: { type: string }) {
  const icons: Record<string, { icon: React.ElementType; color: string }> = {
    observation: { icon: Eye, color: 'blue' },
    question: { icon: MessageCircle, color: 'purple' },
    realization: { icon: Lightbulb, color: 'yellow' },
    concern: { icon: AlertTriangle, color: 'orange' },
    aspiration: { icon: Star, color: 'green' },
  };
  const { icon: Icon, color } = icons[type] || icons.observation;
  return (
    <div className={`p-2 rounded-lg bg-${color}-100`} style={{ backgroundColor: `var(--${color}-100, #dbeafe)` }}>
      <Icon className={`h-4 w-4 text-${color}-600`} style={{ color: `var(--${color}-600, #2563eb)` }} />
    </div>
  );
}

function ThoughtRow({ thought }: { thought: IntrospectiveThought }) {
  return (
    <div className="p-3 flex items-start gap-3">
      <ThoughtIcon type={thought.thoughtType} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{thought.content}</p>
        <span className="text-xs text-gray-400 capitalize">{thought.thoughtType}</span>
      </div>
    </div>
  );
}

function CuriosityRow({ topic }: { topic: CuriosityTopic }) {
  return (
    <div className="p-3 flex items-center gap-3">
      <div className="p-2 bg-orange-100 rounded-lg">
        <Compass className="h-4 w-4 text-orange-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{topic.topic}</p>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{(topic.interestLevel * 100).toFixed(0)}% interest</span>
          <span>•</span>
          <span>{(topic.currentUnderstanding * 100).toFixed(0)}% understood</span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-400" />
    </div>
  );
}

function IdeaRow({ idea }: { idea: CreativeIdea }) {
  return (
    <div className="p-3 flex items-center gap-3">
      <div className="p-2 bg-yellow-100 rounded-lg">
        <Lightbulb className="h-4 w-4 text-yellow-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{idea.title}</p>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Star className="h-3 w-3" />
          <span>{(idea.creativityScore * 100).toFixed(0)}%</span>
          <span>•</span>
          <span className="capitalize">{idea.synthesisType}</span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-400" />
    </div>
  );
}

function GoalRow({ goal }: { goal: AutonomousGoal }) {
  return (
    <div className="p-3 flex items-center gap-3">
      <div className="p-2 bg-red-100 rounded-lg">
        <Target className="h-4 w-4 text-red-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{goal.title}</p>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="capitalize">{goal.goalType}</span>
          <span>•</span>
          <span>{(goal.progress * 100).toFixed(0)}% complete</span>
        </div>
      </div>
      <span className={`px-2 py-0.5 rounded text-xs ${
        goal.status === 'pursuing' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
      }`}>
        {goal.status}
      </span>
    </div>
  );
}

