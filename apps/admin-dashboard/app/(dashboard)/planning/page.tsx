'use client';

import { useState, useEffect } from 'react';
import {
  Target, GitBranch, CheckCircle, Clock, Play, Pause, RefreshCw,
  ChevronRight, ChevronDown, Circle, Flag, Calendar, TrendingUp,
  Plus, Settings, FileText, Zap, AlertTriangle, RotateCcw
} from 'lucide-react';

interface TaskPlan {
  planId: string;
  name: string;
  rootGoal: string;
  status: string;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  sessionsCount: number;
  priority: number;
  estimatedHours?: number;
  deadline?: string;
  createdAt: string;
  startedAt?: string;
}

interface PlanTask {
  taskId: string;
  name: string;
  taskType: 'compound' | 'primitive';
  actionType?: string;
  status: string;
  progress: number;
  depth: number;
  path: string;
  children?: PlanTask[];
  estimatedMins?: number;
  actualMins?: number;
}

interface PlanMilestone {
  milestoneId: string;
  name: string;
  sequenceNumber: number;
  status: string;
  targetDate?: string;
  achievedDate?: string;
}

interface PlanSession {
  sessionId: string;
  startedAt: string;
  endedAt?: string;
  durationMins?: number;
  progressAtStart: number;
  progressAtEnd?: number;
  tasksCompleted: number;
}

interface PlanningStats {
  totalPlans: number;
  activePlans: number;
  completedPlans: number;
  avgCompletionRate: number;
  totalTasks: number;
  completedTasks: number;
  avgSessionDuration: number;
}

const statusColors: Record<string, string> = {
  draft: '#6b7280',
  active: '#3b82f6',
  paused: '#f59e0b',
  completed: '#10b981',
  failed: '#ef4444',
  abandoned: '#9ca3af',
  pending: '#6b7280',
  ready: '#3b82f6',
  in_progress: '#f59e0b',
  skipped: '#9ca3af',
  blocked: '#ef4444',
};

const actionTypeIcons: Record<string, React.ElementType> = {
  generate: FileText,
  analyze: Target,
  code: Zap,
  review: CheckCircle,
  search: Target,
  execute: Play,
  decide: GitBranch,
};

export default function PlanningPage() {
  const [plans, setPlans] = useState<TaskPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<TaskPlan | null>(null);
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [milestones, setMilestones] = useState<PlanMilestone[]>([]);
  const [sessions, setSessions] = useState<PlanSession[]>([]);
  const [stats, setStats] = useState<PlanningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'tasks' | 'milestones' | 'sessions'>('tasks');

  useEffect(() => {
    loadData();
  }, []);

  const [_error, setError] = useState<string | null>(null);
  void _error; // Reserved for error display

  useEffect(() => {
    if (selectedPlan) {
      loadPlanDetails(selectedPlan.planId);
    }
  }, [selectedPlan]);

  async function loadPlanDetails(planId: string) {
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || '';
      const [tasksRes, milestonesRes, sessionsRes] = await Promise.all([
        fetch(`${API}/admin/planning/plans/${planId}/tasks`),
        fetch(`${API}/admin/planning/plans/${planId}/milestones`),
        fetch(`${API}/admin/planning/plans/${planId}/sessions`),
      ]);
      if (tasksRes.ok) { const { data } = await tasksRes.json(); setTasks(data || []); }
      if (milestonesRes.ok) { const { data } = await milestonesRes.json(); setMilestones(data || []); }
      if (sessionsRes.ok) { const { data } = await sessionsRes.json(); setSessions(data || []); }
      setExpandedTasks(new Set(['t1']));
    } catch { /* ignore */ }
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || '';
      const [plansRes, statsRes] = await Promise.all([
        fetch(`${API}/admin/planning/plans`),
        fetch(`${API}/admin/planning/stats`),
      ]);
      if (plansRes.ok) { 
        const { data } = await plansRes.json(); 
        setPlans(data || []);
        if (data && data.length > 0) setSelectedPlan(data[0]);
      } else setError('Failed to load planning data.');
      if (statsRes.ok) { const { data } = await statsRes.json(); setStats(data); }
    } catch { setError('Failed to connect to planning service.'); }
    setLoading(false);
  }

  function toggleTaskExpand(taskId: string) {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
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
            <GitBranch className="h-7 w-7 text-indigo-600" />
            Goal Planning
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Hierarchical Task Networks with milestones and multi-session continuity
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400">
            <RefreshCw className="h-5 w-5" />
          </button>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Plan
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <StatCard title="Total Plans" value={stats.totalPlans} subtitle={`${stats.activePlans} active`} icon={GitBranch} color="indigo" />
          <StatCard title="Completion Rate" value={`${(stats.avgCompletionRate * 100).toFixed(0)}%`} icon={TrendingUp} color="green" />
          <StatCard title="Tasks" value={stats.totalTasks} subtitle={`${stats.completedTasks} done`} icon={CheckCircle} color="blue" />
          <StatCard title="Avg Session" value={`${stats.avgSessionDuration}m`} icon={Clock} color="orange" />
          <StatCard title="Completed" value={stats.completedPlans} icon={Flag} color="purple" />
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-4 gap-6">
        {/* Plans List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Plans</h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
            {plans.map((plan) => (
              <PlanRow
                key={plan.planId}
                plan={plan}
                selected={selectedPlan?.planId === plan.planId}
                onSelect={() => setSelectedPlan(plan)}
              />
            ))}
          </div>
        </div>

        {/* Plan Details */}
        <div className="col-span-3 space-y-6">
          {selectedPlan && (
            <>
              {/* Plan Header */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedPlan.name}</h2>
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium capitalize"
                        style={{ backgroundColor: `${statusColors[selectedPlan.status]}20`, color: statusColors[selectedPlan.status] }}
                      >
                        {selectedPlan.status}
                      </span>
                    </div>
                    <p className="text-gray-500 mt-1">{selectedPlan.rootGoal}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedPlan.status === 'active' ? (
                      <button className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg">
                        <Pause className="h-5 w-5" />
                      </button>
                    ) : (
                      <button className="p-2 text-green-600 hover:bg-green-50 rounded-lg">
                        <Play className="h-5 w-5" />
                      </button>
                    )}
                    <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                      <RotateCcw className="h-5 w-5" />
                    </button>
                    <button className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg">
                      <Settings className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">Progress</span>
                    <span className="font-medium">{selectedPlan.progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all" style={{ width: `${selectedPlan.progress}%` }} />
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-4 mt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedPlan.completedTasks}/{selectedPlan.totalTasks}</p>
                    <p className="text-xs text-gray-500">Tasks</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedPlan.sessionsCount}</p>
                    <p className="text-xs text-gray-500">Sessions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedPlan.estimatedHours || '-'}h</p>
                    <p className="text-xs text-gray-500">Estimated</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">P{selectedPlan.priority}</p>
                    <p className="text-xs text-gray-500">Priority</p>
                  </div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex space-x-8">
                  {[
                    { id: 'tasks', label: 'Task Tree', icon: GitBranch },
                    { id: 'milestones', label: 'Milestones', icon: Flag },
                    { id: 'sessions', label: 'Sessions', icon: Clock },
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
              {activeTab === 'tasks' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Hierarchical Task Network</h3>
                  </div>
                  <div className="p-4">
                    <TaskTree tasks={tasks} expandedTasks={expandedTasks} onToggle={toggleTaskExpand} />
                  </div>
                </div>
              )}

              {activeTab === 'milestones' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Milestones</h3>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {milestones.map((milestone) => (
                      <MilestoneRow key={milestone.milestoneId} milestone={milestone} />
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'sessions' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Work Sessions</h3>
                    <button className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-1">
                      <Play className="h-3.5 w-3.5" />
                      Start Session
                    </button>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {sessions.map((session) => (
                      <SessionRow key={session.sessionId} session={session} />
                    ))}
                  </div>
                </div>
              )}
            </>
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
  color: 'indigo' | 'green' | 'blue' | 'orange' | 'purple';
}) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20',
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

function PlanRow({ plan, selected, onSelect }: { plan: TaskPlan; selected: boolean; onSelect: () => void }) {
  const color = statusColors[plan.status] || '#6b7280';
  return (
    <div
      onClick={onSelect}
      className={`p-3 cursor-pointer transition-colors ${selected ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Circle className="h-2 w-2 flex-shrink-0" fill={color} stroke="none" />
            <span className="font-medium text-gray-900 dark:text-white truncate text-sm">{plan.name}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500" style={{ width: `${plan.progress}%` }} />
            </div>
            <span className="text-xs text-gray-500">{plan.progress.toFixed(0)}%</span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-gray-400 ml-2 flex-shrink-0" />
      </div>
    </div>
  );
}

function TaskTree({ tasks, expandedTasks, onToggle, depth = 0 }: {
  tasks: PlanTask[];
  expandedTasks: Set<string>;
  onToggle: (taskId: string) => void;
  depth?: number;
}) {
  return (
    <div className="space-y-1">
      {tasks.map((task) => (
        <div key={task.taskId}>
          <TaskRow task={task} expanded={expandedTasks.has(task.taskId)} onToggle={() => onToggle(task.taskId)} depth={depth} />
          {task.children && expandedTasks.has(task.taskId) && (
            <div className="ml-6 border-l border-gray-200 dark:border-gray-700">
              <TaskTree tasks={task.children} expandedTasks={expandedTasks} onToggle={onToggle} depth={depth + 1} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TaskRow({ task, expanded, onToggle, depth }: { task: PlanTask; expanded: boolean; onToggle: () => void; depth: number }) {
  const color = statusColors[task.status] || '#6b7280';
  const ActionIcon = task.actionType ? actionTypeIcons[task.actionType] || Circle : Circle;

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 ${depth > 0 ? 'ml-2' : ''}`}>
      {task.taskType === 'compound' && task.children && task.children.length > 0 ? (
        <button onClick={onToggle} className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
          {expanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
        </button>
      ) : (
        <div className="w-5" />
      )}

      <div className="p-1.5 rounded" style={{ backgroundColor: `${color}20`, color }}>
        {task.taskType === 'compound' ? (
          <GitBranch className="h-4 w-4" />
        ) : (
          <ActionIcon className="h-4 w-4" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{task.name}</span>
          <span className="px-1.5 py-0.5 rounded text-xs capitalize" style={{ backgroundColor: `${color}20`, color }}>
            {task.status.replace('_', ' ')}
          </span>
        </div>
        {task.taskType === 'primitive' && task.actionType && (
          <span className="text-xs text-gray-500 capitalize">{task.actionType}</span>
        )}
      </div>

      {task.estimatedMins && (
        <span className="text-xs text-gray-500">{task.estimatedMins}m</span>
      )}

      {task.taskType === 'primitive' && task.status === 'ready' && (
        <button className="p-1 text-green-600 hover:bg-green-50 rounded">
          <Play className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function MilestoneRow({ milestone }: { milestone: PlanMilestone }) {
  const color = statusColors[milestone.status] || '#6b7280';
  return (
    <div className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: color }}>
          {milestone.sequenceNumber}
        </div>
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white">{milestone.name}</h4>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="capitalize">{milestone.status}</span>
            {milestone.targetDate && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(milestone.targetDate).toLocaleDateString()}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      {milestone.status === 'achieved' ? (
        <CheckCircle className="h-6 w-6 text-green-500" />
      ) : milestone.status === 'missed' ? (
        <AlertTriangle className="h-6 w-6 text-red-500" />
      ) : (
        <Circle className="h-6 w-6 text-gray-300" />
      )}
    </div>
  );
}

function SessionRow({ session }: { session: PlanSession }) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {new Date(session.startedAt).toLocaleDateString()} at {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {!session.endedAt && (
              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">Active</span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
            <span>{session.durationMins || '-'} min</span>
            <span>•</span>
            <span>{session.tasksCompleted} tasks completed</span>
            <span>•</span>
            <span>{session.progressAtStart.toFixed(0)}% → {(session.progressAtEnd || session.progressAtStart).toFixed(0)}%</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-green-500"
              style={{ width: `${((session.progressAtEnd || session.progressAtStart) - session.progressAtStart) + session.progressAtStart}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

