'use client';

import { useState, useEffect } from 'react';
import {
  Brain, GitBranch, Zap, Database, Bot, RefreshCw, Settings,
  Play, Pause, CheckCircle, XCircle, Clock, AlertTriangle,
  ChevronRight, Network, Layers, Cpu, Eye, Shield, Activity
} from 'lucide-react';

interface CausalNode {
  nodeId: string;
  name: string;
  nodeType: string;
  currentValue?: unknown;
  isManipulable: boolean;
}

interface CausalEdge {
  edgeId: string;
  causeNodeId: string;
  effectNodeId: string;
  causalStrength: number;
  confidence: number;
  mechanism?: string;
}

interface AutonomousTask {
  taskId: string;
  taskType: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  isPaused: boolean;
  requiresApproval: boolean;
  runCount: number;
  lastRunAt?: string;
}

interface PendingApproval {
  executionId: string;
  taskName: string;
  proposedActions: Array<{
    action: string;
    target: string;
    impactAssessment: { level: string; description: string };
  }>;
  triggeredAt: string;
}

interface ConsolidationJob {
  jobId: string;
  jobType: string;
  status: string;
  memoriesProcessed: number;
  conflictsFound: number;
  startedAt?: string;
}

interface MemoryConflict {
  conflictId: string;
  conflictType: string;
  severity: string;
  memoryAContent: string;
  memoryBContent: string;
  resolutionStatus: string;
}

interface CognitionStats {
  causalNodes: number;
  causalEdges: number;
  multimodalRepresentations: number;
  executableSkills: number;
  autonomousTasksEnabled: number;
  pendingApprovals: number;
  memoryConflicts: number;
  consolidationJobsRunning: number;
}

interface CognitionSettings {
  causalReasoningEnabled: boolean;
  consolidationEnabled: boolean;
  consolidationSchedule: string;
  multimodalBindingEnabled: boolean;
  skillExecutionEnabled: boolean;
  autonomousEnabled: boolean;
  autonomousApprovalRequired: boolean;
  maxAutonomousActionsPerDay: number;
}

const impactColors: Record<string, string> = {
  none: '#6b7280',
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
};

export default function CognitionPage() {
  const [stats, setStats] = useState<CognitionStats | null>(null);
  const [settings, setSettings] = useState<CognitionSettings | null>(null);
  const [causalNodes, setCausalNodes] = useState<CausalNode[]>([]);
  const [causalEdges, setCausalEdges] = useState<CausalEdge[]>([]);
  const [autonomousTasks, setAutonomousTasks] = useState<AutonomousTask[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [consolidationJobs, setConsolidationJobs] = useState<ConsolidationJob[]>([]);
  const [memoryConflicts, setMemoryConflicts] = useState<MemoryConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'causal' | 'memory' | 'skills' | 'autonomous'>('overview');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      setStats(mockStats);
      setSettings(mockSettings);
      setCausalNodes(mockCausalNodes);
      setCausalEdges(mockCausalEdges);
      setAutonomousTasks(mockAutonomousTasks);
      setPendingApprovals(mockPendingApprovals);
      setConsolidationJobs(mockConsolidationJobs);
      setMemoryConflicts(mockMemoryConflicts);
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
            <Cpu className="h-7 w-7 text-indigo-600" />
            Advanced Cognition
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Causal reasoning, memory consolidation, multimodal binding, skills, and autonomous agents
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
        <div className="grid grid-cols-6 gap-4">
          <StatCard title="Causal Nodes" value={stats.causalNodes} icon={Network} color="indigo" />
          <StatCard title="Representations" value={stats.multimodalRepresentations} icon={Layers} color="blue" />
          <StatCard title="Skills" value={stats.executableSkills} icon={Zap} color="green" />
          <StatCard title="Auto Tasks" value={stats.autonomousTasksEnabled} icon={Bot} color="purple" />
          <StatCard title="Pending Approvals" value={stats.pendingApprovals} icon={Clock} color={stats.pendingApprovals > 0 ? 'orange' : 'gray'} />
          <StatCard title="Conflicts" value={stats.memoryConflicts} icon={AlertTriangle} color={stats.memoryConflicts > 0 ? 'red' : 'gray'} />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: Eye },
            { id: 'causal', label: 'Causal Graph', icon: Network },
            { id: 'memory', label: 'Memory', icon: Database },
            { id: 'skills', label: 'Skills', icon: Zap },
            { id: 'autonomous', label: 'Autonomous', icon: Bot },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && settings && (
        <div className="grid grid-cols-2 gap-6">
          {/* Feature Status */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Feature Status</h2>
            </div>
            <div className="p-4 space-y-3">
              <FeatureToggle name="Causal Reasoning" enabled={settings.causalReasoningEnabled} description="Do-calculus and counterfactual reasoning" />
              <FeatureToggle name="Memory Consolidation" enabled={settings.consolidationEnabled} description={`Schedule: ${settings.consolidationSchedule}`} />
              <FeatureToggle name="Multimodal Binding" enabled={settings.multimodalBindingEnabled} description="Cross-modal search and grounding" />
              <FeatureToggle name="Skill Execution" enabled={settings.skillExecutionEnabled} description="Procedural memory replay" />
              <FeatureToggle name="Autonomous Agent" enabled={settings.autonomousEnabled} description={settings.autonomousApprovalRequired ? 'Approval required' : 'Auto-execute'} warning={!settings.autonomousApprovalRequired} />
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pending Approvals</h2>
              {pendingApprovals.length > 0 && (
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                  {pendingApprovals.length} pending
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-80 overflow-y-auto">
              {pendingApprovals.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p>No pending approvals</p>
                </div>
              ) : (
                pendingApprovals.map((approval) => (
                  <ApprovalRow key={approval.executionId} approval={approval} />
                ))
              )}
            </div>
          </div>

          {/* Memory Conflicts */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Memory Conflicts</h2>
              {memoryConflicts.length > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                  {memoryConflicts.length} unresolved
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-80 overflow-y-auto">
              {memoryConflicts.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p>No memory conflicts</p>
                </div>
              ) : (
                memoryConflicts.map((conflict) => (
                  <ConflictRow key={conflict.conflictId} conflict={conflict} />
                ))
              )}
            </div>
          </div>

          {/* Consolidation Jobs */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Consolidation Jobs</h2>
              <button className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
                Run Now
              </button>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {consolidationJobs.map((job) => (
                <JobRow key={job.jobId} job={job} />
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'causal' && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Causal Knowledge Graph</h2>
              <p className="text-sm text-gray-500">Nodes and edges representing causal relationships</p>
            </div>
            <div className="p-4">
              {/* Simple graph visualization - in production would use D3 or similar */}
              <div className="h-96 bg-gray-50 dark:bg-gray-900 rounded-lg p-4 relative overflow-hidden">
                {causalNodes.map((node, i) => {
                  const x = 50 + (i % 4) * 150;
                  const y = 50 + Math.floor(i / 4) * 100;
                  return (
                    <div
                      key={node.nodeId}
                      className="absolute p-2 bg-white dark:bg-gray-700 rounded-lg shadow border border-gray-200 dark:border-gray-600 cursor-pointer hover:ring-2 hover:ring-indigo-500"
                      style={{ left: x, top: y }}
                    >
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{node.name}</div>
                      <div className="text-xs text-gray-500">{node.nodeType}</div>
                    </div>
                  );
                })}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {causalEdges.map((edge, i) => {
                    const sourceIdx = causalNodes.findIndex((n) => n.nodeId === edge.causeNodeId);
                    const targetIdx = causalNodes.findIndex((n) => n.nodeId === edge.effectNodeId);
                    if (sourceIdx === -1 || targetIdx === -1) return null;
                    const x1 = 100 + (sourceIdx % 4) * 150;
                    const y1 = 70 + Math.floor(sourceIdx / 4) * 100;
                    const x2 = 50 + (targetIdx % 4) * 150;
                    const y2 = 70 + Math.floor(targetIdx / 4) * 100;
                    return (
                      <line
                        key={edge.edgeId}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#6366f1"
                        strokeWidth={Math.max(1, edge.causalStrength * 3)}
                        strokeOpacity={edge.confidence}
                        markerEnd="url(#arrowhead)"
                      />
                    );
                  })}
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
                    </marker>
                  </defs>
                </svg>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Intervention Panel */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">Causal Intervention</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-sm text-gray-500">Target Variable</label>
                  <select className="mt-1 w-full p-2 border rounded-lg">
                    {causalNodes.filter((n) => n.isManipulable).map((n) => (
                      <option key={n.nodeId} value={n.nodeId}>{n.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Set Value To</label>
                  <input type="text" className="mt-1 w-full p-2 border rounded-lg" placeholder="New value..." />
                </div>
                <button className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  do(X = value)
                </button>
                <button className="w-full py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50">
                  Counterfactual Query
                </button>
              </div>
            </div>

            {/* Edge List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">Causal Edges</h3>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-60 overflow-y-auto">
                {causalEdges.map((edge) => {
                  const cause = causalNodes.find((n) => n.nodeId === edge.causeNodeId);
                  const effect = causalNodes.find((n) => n.nodeId === edge.effectNodeId);
                  return (
                    <div key={edge.edgeId} className="p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{cause?.name || '?'}</span>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{effect?.name || '?'}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Strength: {(edge.causalStrength * 100).toFixed(0)}% • Confidence: {(edge.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'autonomous' && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Autonomous Tasks</h2>
                <p className="text-sm text-gray-500">Background tasks with bounded autonomy</p>
              </div>
              <button className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
                + Add Task
              </button>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {autonomousTasks.map((task) => (
                <TaskRow key={task.taskId} task={task} />
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {/* Safety Controls */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-500" />
                  Safety Controls
                </h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Require Approval</span>
                  <div className="w-10 h-5 bg-green-500 rounded-full relative">
                    <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Max Actions/Day</label>
                  <input type="number" defaultValue={10} className="mt-1 w-full p-2 border rounded-lg" />
                </div>
                <div>
                  <label className="text-sm text-gray-500">Max Tokens/Day</label>
                  <input type="number" defaultValue={100000} className="mt-1 w-full p-2 border rounded-lg" />
                </div>
                <div>
                  <label className="text-sm text-gray-500">Allowed Task Types</label>
                  <div className="mt-2 space-y-1">
                    {['suggestion', 'maintenance', 'background_learning', 'monitoring'].map((type) => (
                      <label key={type} className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked={['suggestion', 'maintenance'].includes(type)} />
                        <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Log */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-500" />
                  Recent Activity
                </h3>
              </div>
              <div className="p-4 space-y-2 text-sm max-h-60 overflow-y-auto">
                <ActivityItem time="2m ago" action="Memory consolidation completed" status="success" />
                <ActivityItem time="15m ago" action="Suggestion approved by admin" status="success" />
                <ActivityItem time="1h ago" action="Pattern analysis triggered" status="pending" />
                <ActivityItem time="3h ago" action="Skill extraction failed" status="failed" />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'memory' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Consolidation Settings</h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm text-gray-500">Schedule</label>
                <select className="mt-1 w-full p-2 border rounded-lg">
                  <option value="hourly">Hourly</option>
                  <option value="daily" selected>Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="manual">Manual Only</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-500">Compression Ratio</label>
                <input type="range" min="0" max="100" defaultValue="70" className="w-full" />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Keep All</span>
                  <span>70%</span>
                  <span>Max Compression</span>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Importance Decay Rate (per day)</label>
                <input type="number" defaultValue="0.05" step="0.01" className="mt-1 w-full p-2 border rounded-lg" />
              </div>
              <div>
                <label className="text-sm text-gray-500">Auto-Prune Threshold</label>
                <input type="number" defaultValue="0.1" step="0.01" className="mt-1 w-full p-2 border rounded-lg" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Auto-Resolve Conflicts</span>
                <div className="w-10 h-5 bg-green-500 rounded-full relative">
                  <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Memory Statistics</h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
                  <p className="text-2xl font-bold text-indigo-600">1,247</p>
                  <p className="text-xs text-gray-500">Episodic Memories</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">438</p>
                  <p className="text-xs text-gray-500">Semantic Memories</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">56</p>
                  <p className="text-xs text-gray-500">Procedural Memories</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
                  <p className="text-2xl font-bold text-purple-600">89</p>
                  <p className="text-xs text-gray-500">Consolidated</p>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Storage Used</span>
                  <span className="font-medium">2.4 GB / 10 GB</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: '24%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'skills' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Executable Skills</h2>
              <p className="text-sm text-gray-500">Learned procedures that can be replayed</p>
            </div>
            <button className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
              + Learn Skill
            </button>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {mockSkills.map((skill) => (
              <SkillRow key={skill.skillId} skill={skill} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: 'indigo' | 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'gray';
}) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20',
    gray: 'bg-gray-50 text-gray-600 dark:bg-gray-700',
  };
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function FeatureToggle({ name, enabled, description, warning }: { name: string; enabled: boolean; description: string; warning?: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-white">{name}</span>
          {warning && <AlertTriangle className="h-4 w-4 text-orange-500" />}
        </div>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <div className={`w-10 h-5 rounded-full relative ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${enabled ? 'right-0.5' : 'left-0.5'}`} />
      </div>
    </div>
  );
}

function ApprovalRow({ approval }: { approval: PendingApproval }) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white">{approval.taskName}</h4>
          <p className="text-xs text-gray-500">{new Date(approval.triggeredAt).toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          <button className="p-1.5 text-green-600 hover:bg-green-50 rounded">
            <CheckCircle className="h-5 w-5" />
          </button>
          <button className="p-1.5 text-red-600 hover:bg-red-50 rounded">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="mt-2 space-y-1">
        {approval.proposedActions.map((action, i) => (
          <div key={i} className="text-sm flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: `${impactColors[action.impactAssessment.level]}20`, color: impactColors[action.impactAssessment.level] }}>
              {action.impactAssessment.level}
            </span>
            <span className="text-gray-600 dark:text-gray-400">{action.action}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConflictRow({ conflict }: { conflict: MemoryConflict }) {
  const severityColors: Record<string, string> = { critical: '#ef4444', major: '#f59e0b', minor: '#6b7280' };
  const color = severityColors[conflict.severity] || '#6b7280';
  return (
    <div className="p-4">
      <div className="flex items-center gap-2">
        <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: `${color}20`, color }}>
          {conflict.severity}
        </span>
        <span className="text-sm text-gray-500 capitalize">{conflict.conflictType.replace('_', ' ')}</span>
      </div>
      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
        A: {conflict.memoryAContent.substring(0, 50)}...
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
        B: {conflict.memoryBContent.substring(0, 50)}...
      </div>
      <button className="mt-2 text-sm text-indigo-600 hover:underline">Resolve</button>
    </div>
  );
}

function JobRow({ job }: { job: ConsolidationJob }) {
  const statusColors: Record<string, string> = { pending: '#6b7280', running: '#3b82f6', completed: '#10b981', failed: '#ef4444' };
  const color = statusColors[job.status] || '#6b7280';
  return (
    <div className="p-4 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-white capitalize">{job.jobType}</span>
          <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: `${color}20`, color }}>
            {job.status}
          </span>
        </div>
        <p className="text-xs text-gray-500">{job.memoriesProcessed} processed • {job.conflictsFound} conflicts</p>
      </div>
      {job.status === 'running' && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600" />}
    </div>
  );
}

function TaskRow({ task }: { task: AutonomousTask }) {
  return (
    <div className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${task.isEnabled && !task.isPaused ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-white">{task.name}</span>
            {task.requiresApproval && <Shield className="h-3.5 w-3.5 text-green-500" />}
          </div>
          <p className="text-xs text-gray-500">{task.taskType} • {task.runCount} runs</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {task.isEnabled && !task.isPaused ? (
          <button className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded">
            <Pause className="h-4 w-4" />
          </button>
        ) : (
          <button className="p-1.5 text-green-600 hover:bg-green-50 rounded">
            <Play className="h-4 w-4" />
          </button>
        )}
        <button className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded">
          <Zap className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SkillRow({ skill }: { skill: { skillId: string; name: string; skillType: string; executionCount: number; successRate: number } }) {
  return (
    <div className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <span className="font-medium text-gray-900 dark:text-white">{skill.name}</span>
          <p className="text-xs text-gray-500">{skill.skillType} • {skill.executionCount} executions • {(skill.successRate * 100).toFixed(0)}% success</p>
        </div>
      </div>
      <button className="px-3 py-1.5 border border-indigo-600 text-indigo-600 rounded-lg text-sm hover:bg-indigo-50">
        Execute
      </button>
    </div>
  );
}

function ActivityItem({ time, action, status }: { time: string; action: string; status: 'success' | 'pending' | 'failed' }) {
  const colors = { success: 'text-green-500', pending: 'text-yellow-500', failed: 'text-red-500' };
  const icons = { success: CheckCircle, pending: Clock, failed: XCircle };
  const Icon = icons[status];
  return (
    <div className="flex items-start gap-2">
      <Icon className={`h-4 w-4 mt-0.5 ${colors[status]}`} />
      <div className="flex-1">
        <p className="text-gray-700 dark:text-gray-300">{action}</p>
        <p className="text-xs text-gray-400">{time}</p>
      </div>
    </div>
  );
}

// Mock data
const mockStats: CognitionStats = { causalNodes: 24, causalEdges: 31, multimodalRepresentations: 156, executableSkills: 12, autonomousTasksEnabled: 3, pendingApprovals: 2, memoryConflicts: 1, consolidationJobsRunning: 0 };
const mockSettings: CognitionSettings = { causalReasoningEnabled: true, consolidationEnabled: true, consolidationSchedule: 'daily at 3:00 UTC', multimodalBindingEnabled: true, skillExecutionEnabled: true, autonomousEnabled: true, autonomousApprovalRequired: true, maxAutonomousActionsPerDay: 10 };
const mockCausalNodes: CausalNode[] = [
  { nodeId: 'n1', name: 'User Request', nodeType: 'event', isManipulable: false },
  { nodeId: 'n2', name: 'Task Complexity', nodeType: 'variable', currentValue: 'medium', isManipulable: true },
  { nodeId: 'n3', name: 'Model Selection', nodeType: 'action', isManipulable: true },
  { nodeId: 'n4', name: 'Response Quality', nodeType: 'outcome', isManipulable: false },
  { nodeId: 'n5', name: 'User Satisfaction', nodeType: 'outcome', isManipulable: false },
  { nodeId: 'n6', name: 'Context Length', nodeType: 'variable', currentValue: 2000, isManipulable: true },
];
const mockCausalEdges: CausalEdge[] = [
  { edgeId: 'e1', causeNodeId: 'n1', effectNodeId: 'n2', causalStrength: 0.8, confidence: 0.9 },
  { edgeId: 'e2', causeNodeId: 'n2', effectNodeId: 'n3', causalStrength: 0.7, confidence: 0.85 },
  { edgeId: 'e3', causeNodeId: 'n3', effectNodeId: 'n4', causalStrength: 0.9, confidence: 0.8 },
  { edgeId: 'e4', causeNodeId: 'n4', effectNodeId: 'n5', causalStrength: 0.85, confidence: 0.9 },
  { edgeId: 'e5', causeNodeId: 'n6', effectNodeId: 'n4', causalStrength: 0.5, confidence: 0.7 },
];
const mockAutonomousTasks: AutonomousTask[] = [
  { taskId: 't1', taskType: 'maintenance', name: 'Daily Memory Consolidation', description: 'Compress and organize memories', isEnabled: true, isPaused: false, requiresApproval: false, runCount: 45, lastRunAt: new Date(Date.now() - 86400000).toISOString() },
  { taskId: 't2', taskType: 'suggestion', name: 'Proactive User Suggestions', description: 'Generate helpful suggestions', isEnabled: true, isPaused: false, requiresApproval: true, runCount: 23, lastRunAt: new Date(Date.now() - 3600000).toISOString() },
  { taskId: 't3', taskType: 'monitoring', name: 'Knowledge Graph Update', description: 'Update causal graph', isEnabled: false, isPaused: true, requiresApproval: false, runCount: 12 },
];
const mockPendingApprovals: PendingApproval[] = [
  { executionId: 'ex1', taskName: 'Proactive User Suggestions', proposedActions: [{ action: 'create_suggestion', target: 'user-123', impactAssessment: { level: 'low', description: 'Will show suggestion to user' } }], triggeredAt: new Date(Date.now() - 1800000).toISOString() },
  { executionId: 'ex2', taskName: 'Skill Learning', proposedActions: [{ action: 'extract_skill', target: 'procedural_memory', impactAssessment: { level: 'low', description: 'Will create new skill from patterns' } }], triggeredAt: new Date(Date.now() - 7200000).toISOString() },
];
const mockConsolidationJobs: ConsolidationJob[] = [
  { jobId: 'j1', jobType: 'compress', status: 'completed', memoriesProcessed: 120, conflictsFound: 3, startedAt: new Date(Date.now() - 86400000).toISOString() },
  { jobId: 'j2', jobType: 'decay', status: 'completed', memoriesProcessed: 450, conflictsFound: 0, startedAt: new Date(Date.now() - 86400000).toISOString() },
];
const mockMemoryConflicts: MemoryConflict[] = [
  { conflictId: 'c1', conflictType: 'contradiction', severity: 'major', memoryAContent: 'The API uses REST endpoints for all operations', memoryBContent: 'The API uses GraphQL for queries and mutations', resolutionStatus: 'pending' },
];
const mockSkills = [
  { skillId: 's1', name: 'Code Review Procedure', skillType: 'procedure', executionCount: 34, successRate: 0.91 },
  { skillId: 's2', name: 'Bug Analysis Workflow', skillType: 'workflow', executionCount: 18, successRate: 0.83 },
  { skillId: 's3', name: 'Documentation Generation', skillType: 'pattern', executionCount: 56, successRate: 0.95 },
];
