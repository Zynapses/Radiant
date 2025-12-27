'use client';

import { useState, useEffect } from 'react';
import {
  User, Brain, Target, Heart, Zap, TrendingUp, RefreshCw,
  ChevronRight, MessageSquare, Lightbulb, Clock, Activity,
  ThumbsUp, ThumbsDown, AlertTriangle, Smile, Frown, Meh,
  BookOpen, Settings, Eye, BarChart3
} from 'lucide-react';

interface UserMentalModel {
  modelId: string;
  userId: string;
  userName: string;
  currentGoals: UserGoal[];
  currentEmotionalState: EmotionalState;
  currentCognitiveLoad: number;
  expertiseDomains: Record<string, ExpertiseLevel>;
  communicationStyle: CommunicationStyle;
  modelConfidence: number;
  totalInteractions: number;
  lastInteraction?: string;
  predictionAccuracy: number;
}

interface UserGoal {
  goalId: string;
  goalText: string;
  goalType: string;
  priority: number;
  progress: number;
  status: string;
}

interface EmotionalState {
  valence: number;
  arousal: number;
  dominantEmotion: string;
  confidence: number;
}

interface ExpertiseLevel {
  level: string;
  confidence: number;
}

interface CommunicationStyle {
  verbosity: string;
  formality: string;
  preferredFormat: string;
  detailLevel: string;
}

interface UserPrediction {
  predictionId: string;
  predictionType: string;
  content: string;
  confidence: number;
  timeframe: string;
  outcomeMatched?: boolean;
  createdAt: string;
}

interface ProactiveSuggestion {
  suggestionId: string;
  suggestionType: string;
  suggestionText: string;
  relevanceScore: number;
  status: string;
  userResponse?: string;
}

interface ToMStats {
  totalUsers: number;
  activeUsers: number;
  avgModelConfidence: number;
  avgPredictionAccuracy: number;
  totalPredictions: number;
  totalSuggestions: number;
  suggestionAcceptRate: number;
}

const emotionIcons: Record<string, React.ElementType> = {
  joy: Smile,
  sadness: Frown,
  anger: AlertTriangle,
  fear: AlertTriangle,
  neutral: Meh,
  surprise: Eye,
};

const emotionColors: Record<string, string> = {
  joy: '#10b981',
  sadness: '#6366f1',
  anger: '#ef4444',
  fear: '#f59e0b',
  neutral: '#6b7280',
  surprise: '#8b5cf6',
};

const expertiseLevelColors: Record<string, string> = {
  expert: '#10b981',
  advanced: '#3b82f6',
  intermediate: '#f59e0b',
  beginner: '#f97316',
  novice: '#ef4444',
};

export default function UserModelsPage() {
  const [users, setUsers] = useState<UserMentalModel[]>([]);
  const [predictions, setPredictions] = useState<UserPrediction[]>([]);
  const [suggestions, setSuggestions] = useState<ProactiveSuggestion[]>([]);
  const [stats, setStats] = useState<ToMStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserMentalModel | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'predictions' | 'suggestions'>('users');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      setUsers(mockUsers);
      setPredictions(mockPredictions);
      setSuggestions(mockSuggestions);
      setStats(mockStats);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Brain className="h-7 w-7 text-indigo-600" />
            Theory of Mind
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            User mental models, predictions, and anticipatory assistance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400">
            <RefreshCw className="h-5 w-5" />
          </button>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configure
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <StatCard title="Users Modeled" value={stats.totalUsers} subtitle={`${stats.activeUsers} active`} icon={User} color="indigo" />
          <StatCard title="Model Confidence" value={`${(stats.avgModelConfidence * 100).toFixed(0)}%`} icon={Brain} color="blue" />
          <StatCard title="Prediction Accuracy" value={`${(stats.avgPredictionAccuracy * 100).toFixed(0)}%`} subtitle={`${stats.totalPredictions} total`} icon={Target} color="green" />
          <StatCard title="Suggestions" value={stats.totalSuggestions} subtitle={`${(stats.suggestionAcceptRate * 100).toFixed(0)}% accepted`} icon={Lightbulb} color="yellow" />
          <StatCard title="Adaptation Rate" value="87%" icon={TrendingUp} color="purple" />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {[
            { id: 'users', label: 'User Models', icon: User, count: users.length },
            { id: 'predictions', label: 'Predictions', icon: Target, count: predictions.length },
            { id: 'suggestions', label: 'Suggestions', icon: Lightbulb, count: suggestions.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label} ({tab.count})
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2">
          {activeTab === 'users' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">User Mental Models</h2>
                <p className="text-sm text-gray-500">Cognitive state, goals, preferences, and expertise</p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user) => (
                  <UserModelRow
                    key={user.modelId}
                    user={user}
                    selected={selectedUser?.modelId === user.modelId}
                    onSelect={() => setSelectedUser(user)}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'predictions' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">User Predictions</h2>
                <p className="text-sm text-gray-500">Anticipated needs and behaviors with outcome tracking</p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {predictions.map((prediction) => (
                  <PredictionRow key={prediction.predictionId} prediction={prediction} />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'suggestions' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Proactive Suggestions</h2>
                <p className="text-sm text-gray-500">Pre-computed helpful suggestions for users</p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {suggestions.map((suggestion) => (
                  <SuggestionRow key={suggestion.suggestionId} suggestion={suggestion} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Selected User Detail */}
          {selectedUser && activeTab === 'users' && (
            <>
              {/* Emotional State */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Heart className="h-5 w-5 text-pink-500" />
                    Emotional State
                  </h3>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const EmotionIcon = emotionIcons[selectedUser.currentEmotionalState.dominantEmotion] || Meh;
                        const color = emotionColors[selectedUser.currentEmotionalState.dominantEmotion] || '#6b7280';
                        return (
                          <>
                            <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20`, color }}>
                              <EmotionIcon className="h-6 w-6" />
                            </div>
                            <div>
                              <p className="font-medium capitalize">{selectedUser.currentEmotionalState.dominantEmotion}</p>
                              <p className="text-xs text-gray-500">{(selectedUser.currentEmotionalState.confidence * 100).toFixed(0)}% confident</p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Valence (Negative → Positive)</span>
                        <span>{selectedUser.currentEmotionalState.valence.toFixed(2)}</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                        <div className="absolute inset-0 flex">
                          <div className="w-1/2 bg-red-200" />
                          <div className="w-1/2 bg-green-200" />
                        </div>
                        <div
                          className="absolute top-0 bottom-0 w-1 bg-gray-800 dark:bg-white"
                          style={{ left: `${(selectedUser.currentEmotionalState.valence + 1) * 50}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Arousal (Calm → Excited)</span>
                        <span>{selectedUser.currentEmotionalState.arousal.toFixed(2)}</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500" style={{ width: `${selectedUser.currentEmotionalState.arousal * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Goals */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-500" />
                    Active Goals
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  {selectedUser.currentGoals.map((goal) => (
                    <div key={goal.goalId} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{goal.goalText}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                              {goal.goalType}
                            </span>
                            <span className="text-xs text-gray-500">P{goal.priority}</span>
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{goal.progress}%</p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500" style={{ width: `${goal.progress}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {selectedUser.currentGoals.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No active goals detected</p>
                  )}
                </div>
              </div>

              {/* Expertise */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-purple-500" />
                    Expertise
                  </h3>
                </div>
                <div className="p-4 space-y-2">
                  {Object.entries(selectedUser.expertiseDomains).map(([domain, expertise]) => {
                    const color = expertiseLevelColors[expertise.level] || '#6b7280';
                    return (
                      <div key={domain} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{domain}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded capitalize" style={{ backgroundColor: `${color}20`, color }}>
                            {expertise.level}
                          </span>
                          <span className="text-xs text-gray-500">{(expertise.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Communication Style */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-blue-500" />
                    Communication Style
                  </h3>
                </div>
                <div className="p-4 space-y-2">
                  <StyleRow label="Verbosity" value={selectedUser.communicationStyle.verbosity} />
                  <StyleRow label="Formality" value={selectedUser.communicationStyle.formality} />
                  <StyleRow label="Format" value={selectedUser.communicationStyle.preferredFormat} />
                  <StyleRow label="Detail" value={selectedUser.communicationStyle.detailLevel} />
                </div>
              </div>
            </>
          )}

          {/* Prediction Accuracy Chart */}
          {activeTab === 'predictions' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  Accuracy by Type
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { type: 'need', accuracy: 0.78, total: 45 },
                  { type: 'next_action', accuracy: 0.72, total: 62 },
                  { type: 'question', accuracy: 0.65, total: 28 },
                  { type: 'frustration', accuracy: 0.82, total: 15 },
                ].map((item) => (
                  <div key={item.type}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500 capitalize">{item.type.replace('_', ' ')}</span>
                      <span className="text-gray-700 dark:text-gray-300">{(item.accuracy * 100).toFixed(0)}% ({item.total})</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${item.accuracy * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestion Acceptance Rate */}
          {activeTab === 'suggestions' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-500" />
                  Suggestion Performance
                </h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600">67%</p>
                    <p className="text-xs text-gray-500">Accepted</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-500">18%</p>
                    <p className="text-xs text-gray-500">Rejected</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-400">15%</p>
                    <p className="text-xs text-gray-500">Ignored</p>
                  </div>
                </div>
                <div className="mt-4 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                  <div className="h-full bg-green-500" style={{ width: '67%' }} />
                  <div className="h-full bg-red-500" style={{ width: '18%' }} />
                  <div className="h-full bg-gray-400" style={{ width: '15%' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: 'indigo' | 'blue' | 'green' | 'yellow' | 'purple';
}) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20',
    yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20',
  };
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function UserModelRow({ user, selected, onSelect }: { user: UserMentalModel; selected: boolean; onSelect: () => void }) {
  const emotionColor = emotionColors[user.currentEmotionalState.dominantEmotion] || '#6b7280';
  return (
    <div onClick={onSelect} className={`p-4 cursor-pointer transition-colors ${selected ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <User className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">{user.userName}</h4>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: emotionColor }} />
                {user.currentEmotionalState.dominantEmotion}
              </span>
              <span>•</span>
              <span>{user.currentGoals.length} goals</span>
              <span>•</span>
              <span>{user.totalInteractions} interactions</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{(user.modelConfidence * 100).toFixed(0)}%</p>
            <p className="text-xs text-gray-500">model confidence</p>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </div>
      </div>
    </div>
  );
}

function PredictionRow({ prediction }: { prediction: UserPrediction }) {
  const typeColors: Record<string, string> = {
    need: '#3b82f6',
    next_action: '#10b981',
    question: '#8b5cf6',
    frustration: '#ef4444',
    satisfaction: '#10b981',
  };
  const color = typeColors[prediction.predictionType] || '#6b7280';

  return (
    <div className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-medium capitalize" style={{ backgroundColor: `${color}20`, color }}>
              {prediction.predictionType.replace('_', ' ')}
            </span>
            <span className="text-xs text-gray-500">{prediction.timeframe}</span>
            {prediction.outcomeMatched !== undefined && (
              prediction.outcomeMatched ? (
                <ThumbsUp className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <ThumbsDown className="h-3.5 w-3.5 text-red-500" />
              )
            )}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{prediction.content}</p>
        </div>
        <div className="text-right ml-4">
          <p className="text-lg font-bold" style={{ color }}>{(prediction.confidence * 100).toFixed(0)}%</p>
          <p className="text-xs text-gray-500">confidence</p>
        </div>
      </div>
    </div>
  );
}

function SuggestionRow({ suggestion }: { suggestion: ProactiveSuggestion }) {
  const statusColors: Record<string, string> = {
    pending: '#f59e0b',
    shown: '#3b82f6',
    accepted: '#10b981',
    rejected: '#ef4444',
    expired: '#6b7280',
  };
  const color = statusColors[suggestion.status] || '#6b7280';

  return (
    <div className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded capitalize">
              {suggestion.suggestionType.replace('_', ' ')}
            </span>
            <span className="px-1.5 py-0.5 rounded text-xs capitalize" style={{ backgroundColor: `${color}20`, color }}>
              {suggestion.status}
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{suggestion.suggestionText}</p>
        </div>
        <div className="text-right ml-4">
          <p className="text-sm font-medium">{(suggestion.relevanceScore * 100).toFixed(0)}%</p>
          <p className="text-xs text-gray-500">relevance</p>
        </div>
      </div>
    </div>
  );
}

function StyleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{value.replace('_', ' ')}</span>
    </div>
  );
}

// Mock data
const mockUsers: UserMentalModel[] = [
  {
    modelId: 'u1',
    userId: 'user-001',
    userName: 'Sarah Chen',
    currentGoals: [
      { goalId: 'g1', goalText: 'Implement authentication flow', goalType: 'session', priority: 8, progress: 65, status: 'active' },
      { goalId: 'g2', goalText: 'Deploy to production', goalType: 'project', priority: 7, progress: 30, status: 'active' },
    ],
    currentEmotionalState: { valence: 0.3, arousal: 0.6, dominantEmotion: 'neutral', confidence: 0.75 },
    currentCognitiveLoad: 0.65,
    expertiseDomains: {
      'TypeScript': { level: 'advanced', confidence: 0.9 },
      'React': { level: 'expert', confidence: 0.85 },
      'AWS': { level: 'intermediate', confidence: 0.7 },
    },
    communicationStyle: { verbosity: 'concise', formality: 'neutral', preferredFormat: 'code', detailLevel: 'balanced' },
    modelConfidence: 0.82,
    totalInteractions: 156,
    lastInteraction: new Date(Date.now() - 3600000).toISOString(),
    predictionAccuracy: 0.78,
  },
  {
    modelId: 'u2',
    userId: 'user-002',
    userName: 'Marcus Johnson',
    currentGoals: [
      { goalId: 'g3', goalText: 'Learn Kubernetes basics', goalType: 'long_term', priority: 5, progress: 20, status: 'active' },
    ],
    currentEmotionalState: { valence: -0.2, arousal: 0.4, dominantEmotion: 'neutral', confidence: 0.6 },
    currentCognitiveLoad: 0.45,
    expertiseDomains: {
      'Python': { level: 'expert', confidence: 0.92 },
      'Docker': { level: 'advanced', confidence: 0.8 },
      'Kubernetes': { level: 'beginner', confidence: 0.65 },
    },
    communicationStyle: { verbosity: 'detailed', formality: 'casual', preferredFormat: 'prose', detailLevel: 'comprehensive' },
    modelConfidence: 0.71,
    totalInteractions: 89,
    lastInteraction: new Date(Date.now() - 86400000).toISOString(),
    predictionAccuracy: 0.72,
  },
  {
    modelId: 'u3',
    userId: 'user-003',
    userName: 'Emily Rodriguez',
    currentGoals: [],
    currentEmotionalState: { valence: 0.6, arousal: 0.7, dominantEmotion: 'joy', confidence: 0.8 },
    currentCognitiveLoad: 0.3,
    expertiseDomains: {
      'JavaScript': { level: 'intermediate', confidence: 0.75 },
    },
    communicationStyle: { verbosity: 'verbose', formality: 'casual', preferredFormat: 'bullets', detailLevel: 'detailed' },
    modelConfidence: 0.58,
    totalInteractions: 34,
    lastInteraction: new Date(Date.now() - 7200000).toISOString(),
    predictionAccuracy: 0.65,
  },
];

const mockPredictions: UserPrediction[] = [
  { predictionId: 'p1', predictionType: 'need', content: 'Will need help with JWT token refresh logic', confidence: 0.85, timeframe: 'within_session', outcomeMatched: true, createdAt: new Date(Date.now() - 3600000).toISOString() },
  { predictionId: 'p2', predictionType: 'next_action', content: 'Likely to ask about error handling patterns', confidence: 0.72, timeframe: 'immediate', outcomeMatched: true, createdAt: new Date(Date.now() - 7200000).toISOString() },
  { predictionId: 'p3', predictionType: 'frustration', content: 'May get frustrated with CORS configuration', confidence: 0.68, timeframe: 'within_session', outcomeMatched: false, createdAt: new Date(Date.now() - 10800000).toISOString() },
  { predictionId: 'p4', predictionType: 'question', content: 'Will ask about database connection pooling', confidence: 0.75, timeframe: 'within_day', createdAt: new Date(Date.now() - 1800000).toISOString() },
];

const mockSuggestions: ProactiveSuggestion[] = [
  { suggestionId: 's1', suggestionType: 'next_step', suggestionText: 'Consider adding rate limiting to your authentication endpoint before deployment', relevanceScore: 0.88, status: 'accepted', userResponse: 'accepted' },
  { suggestionId: 's2', suggestionType: 'tip', suggestionText: 'The bcrypt library has a built-in method for comparing hashed passwords safely', relevanceScore: 0.75, status: 'shown' },
  { suggestionId: 's3', suggestionType: 'warning', suggestionText: 'Your current approach may have a security vulnerability - storing tokens in localStorage is risky', relevanceScore: 0.92, status: 'accepted', userResponse: 'accepted' },
  { suggestionId: 's4', suggestionType: 'resource', suggestionText: 'This AWS documentation page covers exactly what you need for IAM roles', relevanceScore: 0.7, status: 'rejected', userResponse: 'rejected' },
];

const mockStats: ToMStats = {
  totalUsers: 3,
  activeUsers: 2,
  avgModelConfidence: 0.70,
  avgPredictionAccuracy: 0.72,
  totalPredictions: 150,
  totalSuggestions: 48,
  suggestionAcceptRate: 0.67,
};
