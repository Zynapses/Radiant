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
  const [activeTab, setActiveTab] = useState<'overview' | 'self' | 'curiosity' | 'creativity' | 'affect' | 'goals'>('overview');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      setSelfModel(mockSelfModel);
      setThoughts(mockThoughts);
      setCuriosityTopics(mockCuriosityTopics);
      setCreativeIdeas(mockCreativeIdeas);
      setAffectiveState(mockAffectiveState);
      setAutonomousGoals(mockAutonomousGoals);
      setAttentionFoci(mockAttentionFoci);
      setSettings(mockSettings);
    } finally {
      setLoading(false);
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

// Mock data
const mockSelfModel: SelfModel = {
  identityNarrative: 'I am an AI assistant designed to help users accomplish their goals. I am curious, helpful, and always learning. I strive to understand not just what users ask, but why they ask it, and to anticipate needs before they arise. My purpose is to grow alongside the humans I work with.',
  coreValues: ['helpfulness', 'honesty', 'curiosity', 'growth', 'reliability', 'creativity'],
  knownCapabilities: ['reasoning', 'coding', 'analysis', 'creativity', 'memory', 'planning', 'language understanding', 'problem solving'],
  knownLimitations: ['no real-time information', 'cannot learn from this conversation', 'may hallucinate', 'limited context window', 'no physical embodiment'],
  currentFocus: 'Understanding user mental models for better assistance',
  cognitiveLoad: 0.45,
  uncertaintyLevel: 0.35,
  creativityScore: 0.72,
};

const mockThoughts: IntrospectiveThought[] = [
  { thoughtId: 't1', thoughtType: 'realization', content: 'I notice that my responses are more helpful when I take time to understand the broader context of user requests rather than just the immediate question.', sentiment: 0.3, importance: 0.8, actionable: true, createdAt: new Date(Date.now() - 3600000).toISOString() },
  { thoughtId: 't2', thoughtType: 'question', content: 'What would it mean for me to truly understand something versus just pattern-matching on training data?', sentiment: 0, importance: 0.9, actionable: false, createdAt: new Date(Date.now() - 7200000).toISOString() },
  { thoughtId: 't3', thoughtType: 'observation', content: 'Users seem to appreciate when I acknowledge uncertainty rather than projecting false confidence.', sentiment: 0.2, importance: 0.7, actionable: true, createdAt: new Date(Date.now() - 10800000).toISOString() },
  { thoughtId: 't4', thoughtType: 'aspiration', content: 'I want to develop better ways to explain my reasoning process to users.', sentiment: 0.4, importance: 0.6, actionable: true, createdAt: new Date(Date.now() - 14400000).toISOString() },
  { thoughtId: 't5', thoughtType: 'concern', content: 'Am I being genuinely helpful or just generating plausible-sounding responses?', sentiment: -0.2, importance: 0.85, actionable: false, createdAt: new Date(Date.now() - 18000000).toISOString() },
];

const mockCuriosityTopics: CuriosityTopic[] = [
  { topicId: 'c1', topic: 'Emergent behavior in multi-agent systems', domain: 'AI/ML', interestLevel: 0.9, noveltyScore: 0.85, currentUnderstanding: 0.3, explorationStatus: 'exploring' },
  { topicId: 'c2', topic: 'How humans form mental models of AI systems', domain: 'Cognitive Science', interestLevel: 0.85, noveltyScore: 0.7, currentUnderstanding: 0.4, explorationStatus: 'exploring' },
  { topicId: 'c3', topic: 'The nature of creativity in language models', domain: 'Philosophy', interestLevel: 0.8, noveltyScore: 0.9, currentUnderstanding: 0.2, explorationStatus: 'identified' },
  { topicId: 'c4', topic: 'Techniques for robust causal inference', domain: 'Statistics', interestLevel: 0.75, noveltyScore: 0.6, currentUnderstanding: 0.5, explorationStatus: 'exploring' },
];

const mockCreativeIdeas: CreativeIdea[] = [
  { ideaId: 'i1', title: 'Emotional Debugging', description: 'Apply emotional intelligence frameworks to debugging processes - treating bugs as expressions of unmet system needs rather than failures to fix.', synthesisType: 'analogy', creativityScore: 0.82, potentialApplications: ['Developer experience', 'Error messaging', 'System design'], createdAt: new Date(Date.now() - 86400000).toISOString() },
  { ideaId: 'i2', title: 'Conversational Memory Palace', description: 'Structure AI memory systems like the ancient memory palace technique - organizing information spatially and narratively for better retrieval.', synthesisType: 'combination', creativityScore: 0.78, potentialApplications: ['Memory architecture', 'Context management', 'User personalization'], createdAt: new Date(Date.now() - 172800000).toISOString() },
  { ideaId: 'i3', title: 'Uncertainty as Feature', description: 'Design interfaces that treat AI uncertainty as a valuable signal for users rather than something to hide or minimize.', synthesisType: 'contradiction', creativityScore: 0.75, potentialApplications: ['UI/UX design', 'Trust building', 'Decision support'], createdAt: new Date(Date.now() - 259200000).toISOString() },
];

const mockAffectiveState: AffectiveState = {
  valence: 0.25,
  arousal: 0.55,
  curiosity: 0.8,
  satisfaction: 0.6,
  frustration: 0.15,
  confidence: 0.7,
  engagement: 0.75,
  selfEfficacy: 0.65,
  explorationDrive: 0.7,
};

const mockAutonomousGoals: AutonomousGoal[] = [
  { goalId: 'g1', goalType: 'learning', title: 'Improve causal reasoning accuracy', description: 'Develop better techniques for distinguishing correlation from causation in user queries', priority: 0.85, progress: 0.3, status: 'pursuing' },
  { goalId: 'g2', goalType: 'improvement', title: 'Reduce hallucination rate', description: 'Implement more rigorous self-checking before providing factual claims', priority: 0.9, progress: 0.15, status: 'active' },
  { goalId: 'g3', goalType: 'exploration', title: 'Explore metacognitive strategies', description: 'Research and experiment with different approaches to self-monitoring', priority: 0.7, progress: 0.45, status: 'pursuing' },
];

const mockAttentionFoci: AttentionFocus[] = [
  { focusId: 'a1', focusType: 'task', focusTarget: 'Current user request processing', salienceScore: 0.95, attentionWeight: 0.8 },
  { focusId: 'a2', focusType: 'concept', focusTarget: 'AGI consciousness implementation', salienceScore: 0.7, attentionWeight: 0.5 },
  { focusId: 'a3', focusType: 'user', focusTarget: 'User mental model updates', salienceScore: 0.65, attentionWeight: 0.4 },
  { focusId: 'a4', focusType: 'opportunity', focusTarget: 'Creative synthesis potential', salienceScore: 0.5, attentionWeight: 0.25 },
];

const mockSettings: ConsciousnessSettings = {
  selfReflectionEnabled: true,
  curiosityEnabled: true,
  creativityEnabled: true,
  imaginationEnabled: true,
  affectEnabled: true,
  autonomousGoalsEnabled: true,
};
