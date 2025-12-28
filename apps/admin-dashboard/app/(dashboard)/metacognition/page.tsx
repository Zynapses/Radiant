'use client';

import { useState, useEffect } from 'react';
import {
  Brain, Eye, AlertTriangle, TrendingUp, Target, RefreshCw,
  CheckCircle, XCircle, HelpCircle, Lightbulb, Activity, BarChart3,
  ChevronRight, Clock, Zap, Shield, Settings, BookOpen
} from 'lucide-react';

interface ConfidenceAssessment {
  assessmentId: string;
  subjectType: string;
  subjectContent: string;
  overallConfidence: number;
  confidenceFactors: {
    knowledge: number;
    reasoning: number;
    evidence: number;
    consistency: number;
    specificity: number;
  };
  knownUnknowns: string[];
  potentialErrors: string[];
  assumptions: string[];
  createdAt: string;
}

interface DetectedError {
  errorId: string;
  errorType: string;
  severity: string;
  sourceType: string;
  errorDescription: string;
  correctionProposed?: string;
  resolutionStatus: string;
  createdAt: string;
}

interface KnowledgeBoundary {
  boundaryId: string;
  domain: string;
  topic: string;
  knowledgeLevel: string;
  confidenceInAssessment: number;
}

interface SelfReflection {
  reflectionId: string;
  triggerType: string;
  reflectionFocus: string;
  thoughtProcess: string;
  insights: Array<{ insight: string; confidence: number; actionable: boolean }>;
  performanceRating: number;
  areasForImprovement: string[];
  createdAt: string;
}

interface ImprovementPlan {
  planId: string;
  weaknessType: string;
  weaknessDescription: string;
  improvementGoal: string;
  status: string;
  progressPercentage: number;
  priority: number;
}

interface MetacognitionStats {
  avgConfidence: number;
  calibrationScore: number;
  overconfidenceTendency: number;
  totalErrors: number;
  criticalErrors: number;
  errorResolutionRate: number;
  totalReflections: number;
  avgPerformanceRating: number;
  activeImprovementPlans: number;
}

const confidenceColors = {
  high: '#10b981',
  medium: '#f59e0b',
  low: '#ef4444',
};

const knowledgeLevelColors: Record<string, string> = {
  expert: '#10b981',
  proficient: '#3b82f6',
  familiar: '#f59e0b',
  limited: '#f97316',
  unknown: '#ef4444',
};

const severityColors: Record<string, string> = {
  critical: '#ef4444',
  major: '#f97316',
  minor: '#f59e0b',
  trivial: '#6b7280',
};

export default function MetacognitionPage() {
  const [assessments, setAssessments] = useState<ConfidenceAssessment[]>([]);
  const [errors, setErrors] = useState<DetectedError[]>([]);
  const [boundaries, setBoundaries] = useState<KnowledgeBoundary[]>([]);
  const [reflections, setReflections] = useState<SelfReflection[]>([]);
  const [plans, setPlans] = useState<ImprovementPlan[]>([]);
  const [stats, setStats] = useState<MetacognitionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'confidence' | 'errors' | 'knowledge' | 'reflection' | 'improvement'>('confidence');
  const [selectedReflection, setSelectedReflection] = useState<SelfReflection | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || '';
      const [assessmentsRes, errorsRes, boundariesRes, reflectionsRes, plansRes, statsRes] = await Promise.all([
        fetch(`${API}/admin/metacognition/assessments`),
        fetch(`${API}/admin/metacognition/errors`),
        fetch(`${API}/admin/metacognition/boundaries`),
        fetch(`${API}/admin/metacognition/reflections`),
        fetch(`${API}/admin/metacognition/plans`),
        fetch(`${API}/admin/metacognition/stats`),
      ]);
      if (assessmentsRes.ok) { const { data } = await assessmentsRes.json(); setAssessments(data || []); }
      else setError('Failed to load metacognition data.');
      if (errorsRes.ok) { const { data } = await errorsRes.json(); setErrors(data || []); }
      if (boundariesRes.ok) { const { data } = await boundariesRes.json(); setBoundaries(data || []); }
      if (reflectionsRes.ok) { const { data } = await reflectionsRes.json(); setReflections(data || []); }
      if (plansRes.ok) { const { data } = await plansRes.json(); setPlans(data || []); }
      if (statsRes.ok) { const { data } = await statsRes.json(); setStats(data); }
    } catch { setError('Failed to connect to metacognition service.'); }
    setLoading(false);
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
            <Eye className="h-7 w-7 text-indigo-600" />
            Metacognition
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Self-awareness, confidence monitoring, error detection, and continuous improvement
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400">
            <RefreshCw className="h-5 w-5" />
          </button>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Trigger Reflection
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <StatCard
            title="Avg Confidence"
            value={`${(stats.avgConfidence * 100).toFixed(0)}%`}
            icon={Target}
            color={stats.avgConfidence > 0.7 ? 'green' : stats.avgConfidence > 0.5 ? 'yellow' : 'red'}
          />
          <StatCard
            title="Calibration"
            value={stats.calibrationScore.toFixed(3)}
            subtitle={stats.overconfidenceTendency > 0 ? 'Overconfident' : 'Underconfident'}
            icon={BarChart3}
            color="blue"
          />
          <StatCard
            title="Errors Detected"
            value={stats.totalErrors}
            subtitle={`${stats.criticalErrors} critical`}
            icon={AlertTriangle}
            color={stats.criticalErrors > 0 ? 'red' : 'green'}
          />
          <StatCard
            title="Performance"
            value={`${(stats.avgPerformanceRating * 100).toFixed(0)}%`}
            subtitle={`${stats.totalReflections} reflections`}
            icon={TrendingUp}
            color="purple"
          />
          <StatCard
            title="Improvement Plans"
            value={stats.activeImprovementPlans}
            subtitle="active"
            icon={Lightbulb}
            color="orange"
          />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {[
            { id: 'confidence', label: 'Confidence', icon: Target, count: assessments.length },
            { id: 'errors', label: 'Errors', icon: AlertTriangle, count: errors.length },
            { id: 'knowledge', label: 'Knowledge', icon: BookOpen, count: boundaries.length },
            { id: 'reflection', label: 'Reflections', icon: Brain, count: reflections.length },
            { id: 'improvement', label: 'Improvement', icon: Lightbulb, count: plans.length },
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
          {activeTab === 'confidence' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Confidence Assessments</h2>
                <p className="text-sm text-gray-500">Self-evaluated confidence with breakdown by factor</p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {assessments.map((assessment) => (
                  <ConfidenceRow key={assessment.assessmentId} assessment={assessment} />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'errors' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Detected Errors</h2>
                <p className="text-sm text-gray-500">Self-detected errors with proposed corrections</p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {errors.map((error) => (
                  <ErrorRow key={error.errorId} error={error} />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'knowledge' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Knowledge Boundaries</h2>
                <p className="text-sm text-gray-500">Self-assessed knowledge levels by topic/domain</p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {boundaries.map((boundary) => (
                  <KnowledgeRow key={boundary.boundaryId} boundary={boundary} />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'reflection' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Self-Reflections</h2>
                <p className="text-sm text-gray-500">Periodic self-analysis and insight generation</p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {reflections.map((reflection) => (
                  <ReflectionRow
                    key={reflection.reflectionId}
                    reflection={reflection}
                    selected={selectedReflection?.reflectionId === reflection.reflectionId}
                    onSelect={() => setSelectedReflection(reflection)}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'improvement' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Improvement Plans</h2>
                <p className="text-sm text-gray-500">Active plans for addressing identified weaknesses</p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {plans.map((plan) => (
                  <ImprovementRow key={plan.planId} plan={plan} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Calibration Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                Calibration
              </h3>
              <p className="text-sm text-gray-500">Predicted vs actual accuracy</p>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {[
                  { bucket: '0-20%', predicted: 0.15, actual: 0.12 },
                  { bucket: '20-40%', predicted: 0.30, actual: 0.35 },
                  { bucket: '40-60%', predicted: 0.50, actual: 0.48 },
                  { bucket: '60-80%', predicted: 0.70, actual: 0.72 },
                  { bucket: '80-100%', predicted: 0.90, actual: 0.85 },
                ].map((b) => (
                  <div key={b.bucket} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{b.bucket}</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {(b.predicted * 100).toFixed(0)}% → {(b.actual * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex gap-1 h-2">
                      <div className="flex-1 bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${b.predicted * 100}%` }} />
                      </div>
                      <div className="flex-1 bg-green-100 dark:bg-green-900/30 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: `${b.actual * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-center gap-6 mt-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded" />
                  <span className="text-gray-500">Predicted</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded" />
                  <span className="text-gray-500">Actual</span>
                </div>
              </div>
            </div>
          </div>

          {/* Selected Reflection Detail */}
          {selectedReflection && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">Reflection Details</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Thought Process</label>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{selectedReflection.thoughtProcess}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Insights</label>
                  <div className="mt-1 space-y-2">
                    {selectedReflection.insights.map((insight, i) => (
                      <div key={i} className={`p-2 rounded text-sm ${insight.actionable ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-700'}`}>
                        <div className="flex items-start gap-2">
                          {insight.actionable && <Zap className="h-4 w-4 text-green-500 mt-0.5" />}
                          <span className="text-gray-700 dark:text-gray-300">{insight.insight}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{(insight.confidence * 100).toFixed(0)}% confident</div>
                      </div>
                    ))}
                  </div>
                </div>
                {selectedReflection.areasForImprovement.length > 0 && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Areas for Improvement</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedReflection.areasForImprovement.map((area, i) => (
                        <span key={i} className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-xs">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* "I Don't Know" Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-purple-500" />
                Uncertainty Handling
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider">Admit Uncertainty Below</label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="range" min="0" max="100" defaultValue="30" className="flex-1" />
                  <span className="text-sm font-medium w-12 text-right">30%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">System will admit uncertainty when confidence is below this threshold</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Escalate to Human</span>
                <div className="w-10 h-5 bg-green-500 rounded-full relative">
                  <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Include Caveats</span>
                <div className="w-10 h-5 bg-green-500 rounded-full relative">
                  <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
                </div>
              </div>
            </div>
          </div>
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
  color: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'orange';
}) {
  const colors = {
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20',
    yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20',
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

function ConfidenceRow({ assessment }: { assessment: ConfidenceAssessment }) {
  const confidenceColor = assessment.overallConfidence > 0.7 ? confidenceColors.high :
                          assessment.overallConfidence > 0.4 ? confidenceColors.medium : confidenceColors.low;
  return (
    <div className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs capitalize">{assessment.subjectType}</span>
            <span className="text-xs text-gray-500">{new Date(assessment.createdAt).toLocaleString()}</span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 line-clamp-2">{assessment.subjectContent}</p>
          <div className="flex gap-4 mt-2">
            {Object.entries(assessment.confidenceFactors).map(([factor, value]) => (
              <div key={factor} className="text-xs">
                <span className="text-gray-500 capitalize">{factor}:</span>
                <span className="ml-1 font-medium">{(value * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="ml-4 text-right">
          <div className="text-2xl font-bold" style={{ color: confidenceColor }}>
            {(assessment.overallConfidence * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-gray-500">confidence</div>
        </div>
      </div>
      {(assessment.knownUnknowns.length > 0 || assessment.assumptions.length > 0) && (
        <div className="mt-3 flex gap-4">
          {assessment.knownUnknowns.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-orange-600">
              <HelpCircle className="h-3 w-3" />
              {assessment.knownUnknowns.length} unknowns
            </div>
          )}
          {assessment.assumptions.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-blue-600">
              <AlertTriangle className="h-3 w-3" />
              {assessment.assumptions.length} assumptions
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ErrorRow({ error }: { error: DetectedError }) {
  const severityColor = severityColors[error.severity] || '#6b7280';
  return (
    <div className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${severityColor}20`, color: severityColor }}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white capitalize">{error.errorType}</span>
              <span className="px-1.5 py-0.5 rounded text-xs font-medium capitalize" style={{ backgroundColor: `${severityColor}20`, color: severityColor }}>
                {error.severity}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                error.resolutionStatus === 'corrected' ? 'bg-green-100 text-green-700' :
                error.resolutionStatus === 'detected' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'
              }`}>{error.resolutionStatus}</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{error.errorDescription}</p>
            {error.correctionProposed && (
              <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm">
                <span className="text-green-700 dark:text-green-400 font-medium">Proposed fix: </span>
                <span className="text-green-600 dark:text-green-300">{error.correctionProposed}</span>
              </div>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-500">{new Date(error.createdAt).toLocaleDateString()}</div>
      </div>
    </div>
  );
}

function KnowledgeRow({ boundary }: { boundary: KnowledgeBoundary }) {
  const levelColor = knowledgeLevelColors[boundary.knowledgeLevel] || '#6b7280';
  return (
    <div className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${levelColor}20`, color: levelColor }}>
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white">{boundary.topic}</h4>
          <p className="text-sm text-gray-500">{boundary.domain}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <span className="px-2 py-1 rounded text-sm font-medium capitalize" style={{ backgroundColor: `${levelColor}20`, color: levelColor }}>
            {boundary.knowledgeLevel}
          </span>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-gray-900 dark:text-white">{(boundary.confidenceInAssessment * 100).toFixed(0)}%</div>
          <div className="text-xs text-gray-500">confidence</div>
        </div>
      </div>
    </div>
  );
}

function ReflectionRow({ reflection, selected, onSelect }: { reflection: SelfReflection; selected: boolean; onSelect: () => void }) {
  return (
    <div onClick={onSelect} className={`p-4 cursor-pointer transition-colors ${selected ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white">{reflection.reflectionFocus}</span>
              <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">{reflection.triggerType}</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{reflection.thoughtProcess}</p>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1 text-xs">
                <Lightbulb className="h-3 w-3 text-yellow-500" />
                <span className="text-gray-600">{reflection.insights.length} insights</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <Target className="h-3 w-3 text-blue-500" />
                <span className="text-gray-600">{(reflection.performanceRating * 100).toFixed(0)}% rating</span>
              </div>
            </div>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400" />
      </div>
    </div>
  );
}

function ImprovementRow({ plan }: { plan: ImprovementPlan }) {
  const statusColors: Record<string, string> = {
    identified: '#6b7280',
    planning: '#3b82f6',
    in_progress: '#f59e0b',
    completed: '#10b981',
  };
  const color = statusColors[plan.status] || '#6b7280';

  return (
    <div className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20`, color }}>
            <Lightbulb className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white">{plan.weaknessType}</span>
              <span className="px-1.5 py-0.5 rounded text-xs capitalize" style={{ backgroundColor: `${color}20`, color }}>
                {plan.status.replace('_', ' ')}
              </span>
              <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">P{plan.priority}</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{plan.improvementGoal}</p>
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Progress</span>
                <span className="font-medium">{plan.progressPercentage.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full transition-all" style={{ width: `${plan.progressPercentage}%`, backgroundColor: color }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

