'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Workflow, RefreshCw, Plus, Copy, Trash2, Edit3, Star,
  Clock, Users, BarChart3, ChevronDown, ChevronUp, Check,
} from 'lucide-react';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: Array<{ name: string; type: string; config: Record<string, unknown> }>;
  isPublic: boolean;
  isStarred: boolean;
  usageCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const API = '/api/admin/orchestration-user-templates';

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

export default function OrchestrationTemplatesPage() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const load = useCallback(async () => {
    try {
      const data = await fetchApi('/list');
      setTemplates(data.templates || data || []);
    } catch (err) {
      console.error('Failed to load', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const duplicateTemplate = async (id: string) => {
    try {
      await fetchApi(`/${id}/duplicate`, { method: 'POST' });
      await load();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  const togglePublic = async (id: string, isPublic: boolean) => {
    try {
      await fetchApi(`/${id}`, { method: 'PUT', body: JSON.stringify({ isPublic }) });
      await load();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await fetchApi(`/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-cyan-400" /></div>;
  }

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category).filter(Boolean)))];
  const filtered = filterCategory === 'all' ? templates : templates.filter(t => t.category === filterCategory);
  const publicCount = templates.filter(t => t.isPublic).length;
  const totalUsage = templates.reduce((s, t) => s + (t.usageCount || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Workflow className="h-7 w-7 text-cyan-400" />
            Workflow Templates
          </h1>
          <p className="text-sm text-slate-400 mt-1">User-saved orchestration workflow templates — reusable patterns and configurations</p>
        </div>
        <button onClick={load} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Workflow} label="Total Templates" value={templates.length} color="text-cyan-400" />
        <StatCard icon={Users} label="Public Templates" value={publicCount} color="text-blue-400" />
        <StatCard icon={BarChart3} label="Total Usage" value={totalUsage} color="text-purple-400" />
        <StatCard icon={Star} label="Categories" value={categories.length - 1} color="text-yellow-400" />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400">Filter:</span>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1 text-xs rounded-full ${filterCategory === cat ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
            {cat === 'all' ? 'All' : cat}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center text-slate-500 py-12">No templates found.</div>
        ) : filtered.map(template => (
          <div key={template.id} className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
            <button className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50"
              onClick={() => setExpandedTemplate(expandedTemplate === template.id ? null : template.id)}>
              <div className="flex items-center gap-3">
                <Workflow className="h-5 w-5 text-cyan-400" />
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{template.name}</span>
                    {template.isPublic && <span className="text-xs bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded">Public</span>}
                    {template.isStarred && <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />}
                  </div>
                  <p className="text-xs text-slate-500">{template.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-slate-400">{template.steps?.length || 0} steps</span>
                <span className="text-xs text-slate-400">{template.usageCount || 0} uses</span>
                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{template.category || 'uncategorized'}</span>
                {expandedTemplate === template.id ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </div>
            </button>
            {expandedTemplate === template.id && (
              <div className="border-t border-slate-700/50 p-4 space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 mb-2">Steps</h4>
                  <div className="space-y-1">
                    {(template.steps || []).map((step, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-slate-300 bg-slate-800/50 rounded px-3 py-2">
                        <span className="text-xs bg-slate-600 text-white w-5 h-5 rounded-full flex items-center justify-center">{i + 1}</span>
                        <span className="font-medium">{step.name}</span>
                        <span className="text-xs text-slate-500">({step.type})</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Created by: {template.createdBy}</span>
                  <span>•</span>
                  <span>{new Date(template.createdAt).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>Updated: {new Date(template.updatedAt).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => duplicateTemplate(template.id)}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded-lg flex items-center gap-1">
                    <Copy className="h-3 w-3" /> Duplicate
                  </button>
                  <button onClick={() => togglePublic(template.id, !template.isPublic)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg flex items-center gap-1">
                    {template.isPublic ? 'Make Private' : 'Make Public'}
                  </button>
                  <button onClick={() => deleteTemplate(template.id)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded-lg flex items-center gap-1">
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
