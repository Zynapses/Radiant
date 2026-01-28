'use client';

import { useState, useEffect } from 'react';
import {
  Brain, Network, Zap, Search, RefreshCw, Plus,
  ChevronRight, Circle, ArrowRight, Activity,
  TrendingUp, GitBranch, Layers, Sparkles
} from 'lucide-react';

interface Entity {
  entityId: string;
  entityType: string;
  canonicalName: string;
  aliases: string[];
  confidence: number;
  mentionCount: number;
  currentState: Record<string, unknown>;
  lastMentioned?: string;
}

interface Relation {
  relationId: string;
  subjectId: string;
  subjectName?: string;
  predicate: string;
  objectId: string;
  objectName?: string;
  confidence: number;
  isCurrent: boolean;
}

interface EpisodicMemory {
  memoryId: string;
  memoryType: string;
  content: string;
  summary?: string;
  currentImportance: number;
  occurredAt: string;
  entities: Array<{ name: string; type: string }>;
  emotions: { sentiment?: string; dominantEmotion?: string };
}

interface WorldModelStats {
  totalEntities: number;
  totalRelations: number;
  totalMemories: number;
  avgMemoryImportance: number;
  entitiesByType: Record<string, number>;
  memoriesByType: Record<string, number>;
  recentActivity: number;
}

const entityTypeColors: Record<string, string> = {
  person: '#3b82f6',
  organization: '#8b5cf6',
  object: '#f59e0b',
  concept: '#10b981',
  location: '#ef4444',
  event: '#ec4899',
  time: '#6366f1',
};

const memoryTypeColors: Record<string, string> = {
  input: '#3b82f6',
  output: '#10b981',
  action: '#f59e0b',
  observation: '#8b5cf6',
  decision: '#ef4444',
  emotion: '#ec4899',
};

export default function WorldModelPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [memories, setMemories] = useState<EpisodicMemory[]>([]);
  const [stats, setStats] = useState<WorldModelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<EpisodicMemory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'entities' | 'memories' | 'graph'>('entities');

  useEffect(() => {
    loadData();
  }, []);

  const [_error, setError] = useState<string | null>(null);
  void _error; // Reserved for error display

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || '';
      const [entitiesRes, relationsRes, memoriesRes, statsRes] = await Promise.all([
        fetch(`${API}/admin/world-model/entities`),
        fetch(`${API}/admin/world-model/relations`),
        fetch(`${API}/admin/world-model/memories`),
        fetch(`${API}/admin/world-model/stats`),
      ]);
      if (entitiesRes.ok) { const { data } = await entitiesRes.json(); setEntities(data || []); }
      else setError('Failed to load world model data.');
      if (relationsRes.ok) { const { data } = await relationsRes.json(); setRelations(data || []); }
      if (memoriesRes.ok) { const { data } = await memoriesRes.json(); setMemories(data || []); }
      if (statsRes.ok) { const { data } = await statsRes.json(); setStats(data); }
    } catch { setError('Failed to connect to world model service.'); }
    setLoading(false);
  }

  const filteredEntities = entities.filter(e =>
    e.canonicalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.entityType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMemories = memories.filter(m =>
    m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.memoryType.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <Network className="h-7 w-7 text-indigo-600" />
            World Model
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            AGI Knowledge Graph with Episodic Memory and JEPA-style prediction
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search entities or memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white w-64"
            />
          </div>
          <button onClick={loadData} className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400">
            <RefreshCw className="h-5 w-5" />
          </button>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Entity
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <StatCard title="Entities" value={stats.totalEntities} icon={Layers} color="indigo" />
          <StatCard title="Relations" value={stats.totalRelations} icon={GitBranch} color="purple" />
          <StatCard title="Memories" value={stats.totalMemories} icon={Brain} color="blue" />
          <StatCard title="Avg Importance" value={`${(stats.avgMemoryImportance * 100).toFixed(0)}%`} icon={TrendingUp} color="green" />
          <StatCard title="Recent Activity" value={stats.recentActivity} icon={Activity} color="orange" subtitle="last 24h" />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {(['entities', 'memories', 'graph'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'entities' && <><Layers className="inline h-4 w-4 mr-2" />Entities ({entities.length})</>}
              {tab === 'memories' && <><Brain className="inline h-4 w-4 mr-2" />Episodic Memory ({memories.length})</>}
              {tab === 'graph' && <><Network className="inline h-4 w-4 mr-2" />Knowledge Graph</>}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2">
          {activeTab === 'entities' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">World Model Entities</h2>
                <p className="text-sm text-gray-500">Knowledge graph nodes representing people, places, concepts</p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredEntities.map((entity) => (
                  <EntityRow
                    key={entity.entityId}
                    entity={entity}
                    relations={relations.filter(r => r.subjectId === entity.entityId || r.objectId === entity.entityId)}
                    selected={selectedEntity?.entityId === entity.entityId}
                    onSelect={() => setSelectedEntity(entity)}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'memories' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Episodic Memories</h2>
                <p className="text-sm text-gray-500">Events and experiences with temporal context and importance decay</p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredMemories.map((memory) => (
                  <MemoryRow
                    key={memory.memoryId}
                    memory={memory}
                    selected={selectedMemory?.memoryId === memory.memoryId}
                    onSelect={() => setSelectedMemory(memory)}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'graph' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Knowledge Graph Visualization</h2>
              <div className="aspect-video bg-gray-50 dark:bg-gray-900 rounded-lg flex items-center justify-center relative overflow-hidden">
                {/* Simple graph visualization */}
                <svg className="w-full h-full">
                  {/* Relations as lines */}
                  {relations.slice(0, 15).map((rel, _i) => {
                    const subjectIdx = entities.findIndex(e => e.entityId === rel.subjectId);
                    const objectIdx = entities.findIndex(e => e.entityId === rel.objectId);
                    if (subjectIdx === -1 || objectIdx === -1) return null;
                    
                    const x1 = 100 + (subjectIdx % 5) * 120;
                    const y1 = 80 + Math.floor(subjectIdx / 5) * 100;
                    const x2 = 100 + (objectIdx % 5) * 120;
                    const y2 = 80 + Math.floor(objectIdx / 5) * 100;
                    
                    return (
                      <g key={rel.relationId}>
                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth="1" opacity="0.5" />
                        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 5} fontSize="10" fill="#64748b" textAnchor="middle">
                          {rel.predicate}
                        </text>
                      </g>
                    );
                  })}
                  
                  {/* Entities as nodes */}
                  {entities.slice(0, 10).map((entity, i) => {
                    const x = 100 + (i % 5) * 120;
                    const y = 80 + Math.floor(i / 5) * 100;
                    const color = entityTypeColors[entity.entityType] || '#6366f1';
                    
                    return (
                      <g key={entity.entityId} className="cursor-pointer" onClick={() => setSelectedEntity(entity)}>
                        <circle cx={x} cy={y} r={20 + entity.mentionCount} fill={color} opacity="0.8" />
                        <text x={x} y={y + 4} fontSize="11" fill="white" textAnchor="middle" fontWeight="500">
                          {entity.canonicalName.substring(0, 8)}
                        </text>
                        <text x={x} y={y + 35} fontSize="9" fill="#64748b" textAnchor="middle">
                          {entity.entityType}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                
                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-gray-800/90 rounded-lg p-3 shadow-sm">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Entity Types</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(entityTypeColors).map(([type, color]) => (
                      <div key={type} className="flex items-center gap-1">
                        <Circle className="h-3 w-3" fill={color} stroke="none" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">{type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="space-y-6">
          {/* Selected Entity Details */}
          {selectedEntity && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${entityTypeColors[selectedEntity.entityType]}20`, color: entityTypeColors[selectedEntity.entityType] }}
                  >
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{selectedEntity.canonicalName}</h3>
                    <p className="text-sm text-gray-500">{selectedEntity.entityType}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Confidence</label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${selectedEntity.confidence * 100}%` }} />
                    </div>
                    <span className="text-sm font-medium">{(selectedEntity.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Mentions</label>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedEntity.mentionCount}</p>
                </div>
                {selectedEntity.aliases.length > 0 && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Aliases</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedEntity.aliases.map((alias, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">{alias}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Current State</label>
                  <pre className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(selectedEntity.currentState, null, 2)}
                  </pre>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Relations</label>
                  <div className="mt-1 space-y-1">
                    {relations.filter(r => r.subjectId === selectedEntity.entityId || r.objectId === selectedEntity.entityId).slice(0, 5).map((rel) => {
                      const isSubject = rel.subjectId === selectedEntity.entityId;
                      const otherEntity = entities.find(e => e.entityId === (isSubject ? rel.objectId : rel.subjectId));
                      return (
                        <div key={rel.relationId} className="flex items-center gap-2 text-sm">
                          {isSubject ? (
                            <>
                              <span className="text-gray-600 dark:text-gray-400">{rel.predicate}</span>
                              <ArrowRight className="h-3 w-3 text-gray-400" />
                              <span className="font-medium text-gray-900 dark:text-white">{otherEntity?.canonicalName}</span>
                            </>
                          ) : (
                            <>
                              <span className="font-medium text-gray-900 dark:text-white">{otherEntity?.canonicalName}</span>
                              <ArrowRight className="h-3 w-3 text-gray-400" />
                              <span className="text-gray-600 dark:text-gray-400">{rel.predicate}</span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Selected Memory Details */}
          {selectedMemory && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${memoryTypeColors[selectedMemory.memoryType]}20`, color: memoryTypeColors[selectedMemory.memoryType] }}
                  >
                    <Brain className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white capitalize">{selectedMemory.memoryType} Memory</h3>
                    <p className="text-sm text-gray-500">{new Date(selectedMemory.occurredAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Importance</label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${selectedMemory.currentImportance * 100}%` }} />
                    </div>
                    <span className="text-sm font-medium">{(selectedMemory.currentImportance * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Content</label>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{selectedMemory.summary || selectedMemory.content}</p>
                </div>
                {selectedMemory.emotions.dominantEmotion && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Emotion</label>
                    <p className="mt-1 text-sm capitalize">
                      {selectedMemory.emotions.sentiment} - {selectedMemory.emotions.dominantEmotion}
                    </p>
                  </div>
                )}
                {selectedMemory.entities.length > 0 && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Mentioned Entities</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedMemory.entities.map((entity, i) => (
                        <span key={i} className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-xs">
                          {entity.name} ({entity.type})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* JEPA Prediction Panel */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                JEPA Prediction
              </h3>
              <p className="text-sm text-gray-500">Simulate future world states</p>
            </div>
            <div className="p-4">
              <textarea
                placeholder="Describe an action or scenario to predict..."
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
                rows={3}
              />
              <button className="mt-3 w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2">
                <Zap className="h-4 w-4" />
                Predict Outcome
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, subtitle }: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: 'indigo' | 'purple' | 'blue' | 'green' | 'orange';
  subtitle?: string;
}) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20',
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

function EntityRow({ entity, relations, selected, onSelect }: {
  entity: Entity;
  relations: Relation[];
  selected: boolean;
  onSelect: () => void;
}) {
  const color = entityTypeColors[entity.entityType] || '#6366f1';
  return (
    <div
      onClick={onSelect}
      className={`p-4 cursor-pointer transition-colors ${
        selected ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20`, color }}>
            <Circle className="h-4 w-4" fill={color} />
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">{entity.canonicalName}</h4>
            <p className="text-sm text-gray-500">{entity.entityType} • {entity.mentionCount} mentions • {relations.length} relations</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium">{(entity.confidence * 100).toFixed(0)}%</p>
            <p className="text-xs text-gray-500">confidence</p>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </div>
      </div>
    </div>
  );
}

function MemoryRow({ memory, selected, onSelect }: {
  memory: EpisodicMemory;
  selected: boolean;
  onSelect: () => void;
}) {
  const color = memoryTypeColors[memory.memoryType] || '#6366f1';
  return (
    <div
      onClick={onSelect}
      className={`p-4 cursor-pointer transition-colors ${
        selected ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20`, color }}>
            <Brain className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-medium rounded capitalize" style={{ backgroundColor: `${color}20`, color }}>
                {memory.memoryType}
              </span>
              {memory.emotions.dominantEmotion && (
                <span className="text-xs text-gray-500">• {memory.emotions.dominantEmotion}</span>
              )}
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 truncate mt-1">
              {memory.summary || memory.content}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-4">
          <div className="text-right">
            <div className="flex items-center gap-1">
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: `${memory.currentImportance * 100}%` }} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">{new Date(memory.occurredAt).toLocaleDateString()}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </div>
      </div>
    </div>
  );
}

