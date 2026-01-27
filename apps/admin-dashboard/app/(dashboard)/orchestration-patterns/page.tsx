'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import * as orchestrationApi from '@/lib/api/orchestration-patterns';
import type { OrchestrationPattern, PatternCategory, OrchestrationMethod } from '@/lib/api/orchestration-patterns';
import { Loader2, Search, Plus, LayoutGrid, Settings, Users } from 'lucide-react';

export default function OrchestrationPatternsPage() {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<'patterns' | 'methods' | 'customization'>('patterns');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPattern, setSelectedPattern] = useState<OrchestrationPattern | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch pattern categories from API
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['orchestration-pattern-categories'],
    queryFn: orchestrationApi.getPatternCategories,
  });

  // Fetch all patterns from API
  const { data: patterns = [], isLoading: patternsLoading } = useQuery({
    queryKey: ['orchestration-patterns'],
    queryFn: orchestrationApi.getAllPatterns,
  });

  // Fetch orchestration methods from API
  const { data: methods = [], isLoading: methodsLoading } = useQuery({
    queryKey: ['orchestration-methods'],
    queryFn: orchestrationApi.getOrchestrationMethods,
  });

  // Filter patterns based on category and search
  const filteredPatterns = useMemo(() => {
    return patterns.filter(p => {
      const matchesCategory = !selectedCategory || p.category === selectedCategory;
      const matchesSearch = !searchTerm || 
        p.common.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.formal.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [patterns, selectedCategory, searchTerm]);

  const isLoading = categoriesLoading || patternsLoading;

  const getLatencyColor = (latency: string) => {
    switch (latency) {
      case 'low': return 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'medium': return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400';
      case 'high': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400';
      case 'very_high': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  const getCostColor = (cost: string) => {
    switch (cost) {
      case 'low': return 'text-emerald-600 dark:text-emerald-400';
      case 'medium': return 'text-amber-600 dark:text-amber-400';
      case 'high': return 'text-orange-600 dark:text-orange-400';
      case 'very_high': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading orchestration patterns...</p>
        </div>
      </div>
    );
  }

  const systemPatterns = patterns.filter(p => !p.isEnabled || p.isEnabled);
  const userPatterns = patterns.filter(p => p.isEnabled === false);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Orchestration Patterns</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {patterns.length} documented patterns with parameterized methods for AGI selection
          </p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 shadow-sm transition-all">
            <Plus className="w-4 h-4" />
            Create Custom Pattern
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Patterns</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{patterns.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Categories</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{categories.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Shared Methods</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{methods.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">System Patterns</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{systemPatterns.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">User Patterns</p>
          <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{userPatterns.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Executions Today</p>
          <p className="text-2xl font-bold text-pink-600 dark:text-pink-400">—</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          {[
            { key: 'patterns', label: `Orchestration Patterns (${patterns.length})`, icon: LayoutGrid },
            { key: 'methods', label: `Shared Methods (${methods.length})`, icon: Settings },
            { key: 'customization', label: 'Tenant Customizations', icon: Users },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key as typeof selectedTab)}
              className={`inline-flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                selectedTab === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Patterns Tab */}
      {selectedTab === 'patterns' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Category Sidebar */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">Categories</h3>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  !selectedCategory 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                All Patterns ({patterns.length})
              </button>
              {categories.map(cat => (
                <button
                  key={cat.code}
                  onClick={() => setSelectedCategory(cat.code)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex justify-between items-center ${
                    selectedCategory === cat.code 
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span className="text-sm truncate">{cat.name}</span>
                  <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full ml-2">{cat.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Patterns List */}
          <div className="lg:col-span-3 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search patterns by name, code, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Pattern Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPatterns.map(pattern => (
                <div 
                  key={pattern.code}
                  onClick={() => setSelectedPattern(pattern)}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer transition-all hover:shadow-lg ${
                    selectedPattern?.code === pattern.code ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-xs font-mono text-gray-500">#{pattern.num} {pattern.code}</span>
                      <h4 className="font-semibold">{pattern.common}</h4>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${getLatencyColor(pattern.latency)}`}>
                      {pattern.latency}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">{pattern.formal}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-green-600">{pattern.improvement}</span>
                    <div className="flex items-center gap-2">
                      <span className={getCostColor(pattern.cost)}>💰 {pattern.cost}</span>
                      <span className="text-gray-500">🤖 {pattern.models}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Methods Tab */}
      {selectedTab === 'methods' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-5 border border-blue-100 dark:border-blue-800">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Shared Methods Architecture</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Methods are reusable building blocks that can be composed into workflows. Each method has default parameters 
              that can be overridden per-workflow. This allows the same method to behave differently in different orchestration patterns.
            </p>
          </div>

          {methodsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : methods.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No orchestration methods found. Configure methods in the backend.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {methods.map(method => (
                <div key={method.code} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{method.code}</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">{method.role}</span>
                  </div>
                  <h4 className="font-semibold mb-1 text-gray-900 dark:text-white">{method.name}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Category: {method.category}</p>
                  <button className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">
                    View Parameters →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Customization Tab */}
      {selectedTab === 'customization' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">How Customization Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
                <div className="w-12 h-12 mx-auto mb-3 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                  <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h4 className="font-medium mb-1 text-gray-900 dark:text-white">Workflow Level</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Override default config for entire workflow</p>
              </div>
              <div className="text-center p-5 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-100 dark:border-purple-800 rounded-xl">
                <div className="w-12 h-12 mx-auto mb-3 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center">
                  <LayoutGrid className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h4 className="font-medium mb-1 text-gray-900 dark:text-white">Method Level</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Override method parameters per-workflow</p>
              </div>
              <div className="text-center p-5 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl">
                <div className="w-12 h-12 mx-auto mb-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h4 className="font-medium mb-1 text-gray-900 dark:text-white">Model Preferences</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Choose preferred models for each role</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Active Customizations</h3>
            </div>
            <div className="p-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <Settings className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 mb-4">No customizations configured yet</p>
                <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Plus className="w-4 h-4" />
                  Create Customization
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pattern Detail Modal */}
      {selectedPattern && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedPattern(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-sm font-mono text-gray-500 dark:text-gray-400">#{selectedPattern.num} {selectedPattern.code}</span>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedPattern.common}</h2>
                  <p className="text-gray-500 dark:text-gray-400">{selectedPattern.formal}</p>
                </div>
                <button 
                  onClick={() => setSelectedPattern(null)} 
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Latency</p>
                  <p className={`font-semibold ${getLatencyColor(selectedPattern.latency).split(' ')[0]}`}>{selectedPattern.latency}</p>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Cost</p>
                  <p className={`font-semibold ${getCostColor(selectedPattern.cost)}`}>{selectedPattern.cost}</p>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Min Models</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedPattern.models}</p>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">Quality Improvement</h4>
                <p className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 rounded-xl border border-emerald-100 dark:border-emerald-800">{selectedPattern.improvement}</p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => router.push(`/orchestration-patterns/editor?pattern=${selectedPattern.code}`)}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 flex items-center justify-center gap-2 font-medium shadow-sm transition-all"
                >
                  <LayoutGrid className="w-4 h-4" />
                  Open Visual Editor
                </button>
                <button className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium transition-colors">
                  Customize
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
