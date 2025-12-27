'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

// Mock data for 49 orchestration patterns organized by category
const PATTERN_CATEGORIES = [
  { code: 'adversarial', name: 'Adversarial & Validation', count: 2, color: 'red' },
  { code: 'debate', name: 'Debate & Deliberation', count: 3, color: 'purple' },
  { code: 'judge', name: 'Judge & Critic', count: 3, color: 'blue' },
  { code: 'ensemble', name: 'Ensemble & Aggregation', count: 3, color: 'green' },
  { code: 'reflection', name: 'Reflection & Self-Improvement', count: 3, color: 'yellow' },
  { code: 'verification', name: 'Verification & Fact-Checking', count: 2, color: 'cyan' },
  { code: 'collaboration', name: 'Multi-Agent Collaboration', count: 2, color: 'pink' },
  { code: 'reasoning', name: 'Reasoning Enhancement', count: 9, color: 'orange' },
  { code: 'routing', name: 'Model Routing Strategies', count: 4, color: 'indigo' },
  { code: 'domain', name: 'Domain-Specific Orchestration', count: 4, color: 'teal' },
  { code: 'cognitive', name: 'Cognitive Frameworks', count: 14, color: 'violet' },
];

const ORCHESTRATION_PATTERNS = [
  // Adversarial & Validation
  { code: 'ARE', common: 'Red Team Attack', formal: 'Adversarial Robustness Evaluation', category: 'adversarial', num: 1, latency: 'high', cost: 'high', models: 2, improvement: 'Identifies 80-95% vulnerabilities' },
  { code: 'LM_VS_LM', common: 'Cross-Examination', formal: 'LM vs LM Factual Verification', category: 'adversarial', num: 2, latency: 'high', cost: 'high', models: 2, improvement: 'Reduces hallucinations 40-60%' },
  
  // Debate & Deliberation
  { code: 'SOD', common: 'AI Debate', formal: 'Scalable Oversight via Debate', category: 'debate', num: 3, latency: 'very_high', cost: 'very_high', models: 3, improvement: 'Decision quality +25-35%' },
  { code: 'MDA', common: 'Multi-Agent Debate', formal: 'Multiagent Deliberative Alignment', category: 'debate', num: 4, latency: 'very_high', cost: 'very_high', models: 3, improvement: 'Consensus quality +30-45%' },
  { code: 'ReConcile', common: 'Round Table Consensus', formal: 'Reconciled Ensemble Deliberation', category: 'debate', num: 5, latency: 'very_high', cost: 'high', models: 3, improvement: 'Reduces bias 50-70%' },
  
  // Judge & Critic
  { code: 'LAAJE', common: 'AI Judge', formal: 'LLM-as-a-Judge Evaluation', category: 'judge', num: 6, latency: 'medium', cost: 'medium', models: 2, improvement: 'Evaluation accuracy 85-95%' },
  { code: 'RLAIF', common: 'Constitutional Critic', formal: 'Reinforcement Learning from AI Feedback', category: 'judge', num: 7, latency: 'high', cost: 'medium', models: 2, improvement: 'Alignment +60-80%' },
  { code: 'IREF', common: 'Critique-Revise Loop', formal: 'Iterative Refinement with External Feedback', category: 'judge', num: 8, latency: 'high', cost: 'high', models: 2, improvement: 'Quality +15-25% per iteration' },
  
  // Ensemble & Aggregation
  { code: 'SCMR', common: 'Majority Vote', formal: 'Self-Consistency via Marginal Reasoning', category: 'ensemble', num: 9, latency: 'medium', cost: 'medium', models: 3, improvement: '+15-25% accuracy' },
  { code: 'CWMA', common: 'Weighted Ensemble', formal: 'Confidence-Weighted Model Aggregation', category: 'ensemble', num: 10, latency: 'medium', cost: 'medium', models: 3, improvement: '+20-35% over averaging' },
  { code: 'SMoE', common: 'Mixture Router', formal: 'Sparse Mixture-of-Experts Routing', category: 'ensemble', num: 11, latency: 'low', cost: 'low', models: 2, improvement: 'Cost -40-60%' },
  
  // Reflection & Self-Improvement
  { code: 'ISFR', common: 'Self-Refine Loop', formal: 'Iterative Self-Feedback Refinement', category: 'reflection', num: 12, latency: 'high', cost: 'medium', models: 1, improvement: '+20-30% per iteration' },
  { code: 'VRL', common: 'Reflexion Agent', formal: 'Verbal Reinforcement Learning', category: 'reflection', num: 13, latency: 'high', cost: 'medium', models: 1, improvement: '+30-50% on repeated tasks' },
  { code: 'LATS', common: 'Tree Search Reasoning', formal: 'Language Agent Tree Search', category: 'reflection', num: 14, latency: 'very_high', cost: 'very_high', models: 1, improvement: '4%→74% on puzzles' },
  
  // Verification & Fact-Checking
  { code: 'CoVe', common: 'Chain of Verification', formal: 'Stepwise Verification Prompting', category: 'verification', num: 15, latency: 'high', cost: 'medium', models: 1, improvement: 'Errors -30-50%' },
  { code: 'SelfRAG', common: 'Retrieval-Augmented Verification', formal: 'Self-Reflective RAG', category: 'verification', num: 16, latency: 'high', cost: 'medium', models: 1, improvement: 'Accuracy +40-60%' },
  
  // Multi-Agent Collaboration
  { code: 'LLM_MAS', common: 'Agent Team', formal: 'LLM-based Multi-Agent Systems', category: 'collaboration', num: 17, latency: 'very_high', cost: 'high', models: 3, improvement: 'Complex tasks +40-60%' },
  { code: 'MAPR', common: 'Peer Review Pipeline', formal: 'Multi-Agent Peer Review', category: 'collaboration', num: 18, latency: 'high', cost: 'high', models: 3, improvement: 'Errors -50-70%' },
  
  // Reasoning Enhancement
  { code: 'CoT', common: 'Chain-of-Thought', formal: 'CoT Prompting', category: 'reasoning', num: 19, latency: 'medium', cost: 'medium', models: 1, improvement: '+20-40% on math/logic' },
  { code: 'ZeroShotCoT', common: 'Zero-Shot CoT', formal: '"Let\'s think step by step"', category: 'reasoning', num: 20, latency: 'low', cost: 'low', models: 1, improvement: '+15-30% no examples' },
  { code: 'ToT', common: 'Tree-of-Thoughts', formal: 'ToT with BFS/DFS', category: 'reasoning', num: 21, latency: 'very_high', cost: 'very_high', models: 1, improvement: '4%→74% on puzzles' },
  { code: 'GoT', common: 'Graph-of-Thoughts', formal: 'GoT Synthesis', category: 'reasoning', num: 22, latency: 'very_high', cost: 'very_high', models: 1, improvement: '+62% over ToT' },
  { code: 'ReAct', common: 'ReAct', formal: 'Reasoning + Acting', category: 'reasoning', num: 23, latency: 'high', cost: 'medium', models: 1, improvement: '+34% interactive' },
  { code: 'L2M', common: 'Least-to-Most', formal: 'Decomposition Prompting', category: 'reasoning', num: 24, latency: 'high', cost: 'medium', models: 1, improvement: '16%→99% on SCAN' },
  { code: 'PS', common: 'Plan-and-Solve', formal: 'Explicit Planning', category: 'reasoning', num: 25, latency: 'medium', cost: 'medium', models: 1, improvement: 'Matches 8-shot CoT' },
  { code: 'MCP', common: 'Metacognitive Prompting', formal: '5-stage reflection', category: 'reasoning', num: 26, latency: 'high', cost: 'medium', models: 1, improvement: 'Beats CoT on NLU' },
  { code: 'PoT', common: 'Program-of-Thought', formal: 'Code-based Reasoning', category: 'reasoning', num: 27, latency: 'medium', cost: 'low', models: 1, improvement: 'Math computation' },
  
  // Model Routing
  { code: 'SINGLE', common: 'Single Model', formal: 'Primary model only', category: 'routing', num: 28, latency: 'low', cost: 'low', models: 1, improvement: 'Fastest' },
  { code: 'ENSEMBLE', common: 'Ensemble', formal: 'Query multiple, synthesize', category: 'routing', num: 29, latency: 'high', cost: 'high', models: 3, improvement: 'Best quality' },
  { code: 'CASCADE', common: 'Cascade', formal: 'Escalate on low confidence', category: 'routing', num: 30, latency: 'variable', cost: 'low', models: 2, improvement: 'Cost -40-60%' },
  { code: 'SPECIALIST', common: 'Specialist Routing', formal: 'Route to domain expert', category: 'routing', num: 31, latency: 'medium', cost: 'medium', models: 2, improvement: 'Best domain perf' },
  
  // Domain-Specific
  { code: 'DOMAIN_INJECT', common: 'Domain Expert Injection', formal: 'Prepend domain prompts', category: 'domain', num: 32, latency: 'low', cost: 'low', models: 1, improvement: 'Domain +20-40%' },
  { code: 'MULTI_EXPERT', common: 'Multi-Expert Consensus', formal: 'Multiple domain experts', category: 'domain', num: 33, latency: 'high', cost: 'high', models: 3, improvement: 'Expert consensus +30%' },
  { code: 'CHALLENGER_CONSENSUS', common: 'Challenger + Consensus', formal: 'Baseline then challenge', category: 'domain', num: 34, latency: 'high', cost: 'high', models: 2, improvement: 'Blind spots -40%' },
  { code: 'CROSS_DOMAIN', common: 'Cross-Domain Synthesis', formal: 'Multi-domain merge', category: 'domain', num: 35, latency: 'high', cost: 'high', models: 3, improvement: 'Cross-domain +50%' },
  
  // Cognitive Frameworks
  { code: 'FIRST_PRINCIPLES', common: 'First Principles Thinking', formal: 'Decompose to fundamentals', category: 'cognitive', num: 36, latency: 'high', cost: 'medium', models: 1, improvement: 'Novel solutions +60%' },
  { code: 'ANALOGICAL', common: 'Analogical Reasoning', formal: 'Cross-domain patterns', category: 'cognitive', num: 37, latency: 'medium', cost: 'medium', models: 1, improvement: 'Creative +40%' },
  { code: 'SYSTEMS', common: 'Systems Thinking', formal: 'Feedback loops, emergence', category: 'cognitive', num: 38, latency: 'high', cost: 'medium', models: 1, improvement: 'System understanding +50%' },
  { code: 'SOCRATIC', common: 'Socratic Method', formal: 'Dialectical questioning', category: 'cognitive', num: 39, latency: 'medium', cost: 'medium', models: 1, improvement: 'Understanding +40%' },
  { code: 'TRIZ', common: 'TRIZ', formal: 'Contradiction resolution', category: 'cognitive', num: 40, latency: 'high', cost: 'medium', models: 1, improvement: 'Inventive +70%' },
  { code: 'DESIGN_THINKING', common: 'Design Thinking', formal: 'Empathize→Define→Ideate→Prototype→Test', category: 'cognitive', num: 41, latency: 'very_high', cost: 'high', models: 1, improvement: 'User satisfaction +50%' },
  { code: 'SCIENTIFIC', common: 'Scientific Method', formal: 'Hypothesis→Experiment→Analysis', category: 'cognitive', num: 42, latency: 'high', cost: 'medium', models: 1, improvement: 'Rigorous +60%' },
  { code: 'LATERAL', common: 'Lateral Thinking', formal: 'Random entry, provocation', category: 'cognitive', num: 43, latency: 'medium', cost: 'low', models: 1, improvement: 'Breakthroughs +80%' },
  { code: 'ABDUCTIVE', common: 'Abductive Reasoning', formal: 'Inference to best explanation', category: 'cognitive', num: 44, latency: 'medium', cost: 'medium', models: 1, improvement: 'Explanation +40%' },
  { code: 'COUNTERFACTUAL', common: 'Counterfactual Thinking', formal: 'What-if analysis', category: 'cognitive', num: 45, latency: 'high', cost: 'medium', models: 1, improvement: 'Risk identification +50%' },
  { code: 'DIALECTICAL', common: 'Dialectical Thinking', formal: 'Thesis-antithesis-synthesis', category: 'cognitive', num: 46, latency: 'high', cost: 'medium', models: 1, improvement: 'Balanced +45%' },
  { code: 'MORPHOLOGICAL', common: 'Morphological Analysis', formal: 'Parameter space exploration', category: 'cognitive', num: 47, latency: 'high', cost: 'medium', models: 1, improvement: 'Option coverage +70%' },
  { code: 'PREMORTEM', common: 'Pre-mortem Analysis', formal: 'Prospective hindsight', category: 'cognitive', num: 48, latency: 'medium', cost: 'low', models: 1, improvement: 'Risk mitigation +60%' },
  { code: 'FERMI', common: 'Fermi Estimation', formal: 'Order of magnitude reasoning', category: 'cognitive', num: 49, latency: 'low', cost: 'low', models: 1, improvement: 'Estimation +50%' },
];

const ORCHESTRATION_METHODS = [
  { code: 'GENERATE_RESPONSE', name: 'Generate Response', category: 'generation', role: 'generator' },
  { code: 'GENERATE_WITH_COT', name: 'Generate with Chain-of-Thought', category: 'generation', role: 'generator' },
  { code: 'CRITIQUE_RESPONSE', name: 'Critique Response', category: 'evaluation', role: 'critic' },
  { code: 'JUDGE_RESPONSES', name: 'Judge Multiple Responses', category: 'evaluation', role: 'judge' },
  { code: 'VERIFY_FACTS', name: 'Verify Factual Claims', category: 'verification', role: 'verifier' },
  { code: 'SYNTHESIZE_RESPONSES', name: 'Synthesize Multiple Responses', category: 'synthesis', role: 'synthesizer' },
  { code: 'BUILD_CONSENSUS', name: 'Build Consensus', category: 'synthesis', role: 'synthesizer' },
  { code: 'GENERATE_CHALLENGE', name: 'Generate Challenge', category: 'evaluation', role: 'challenger' },
  { code: 'DEFEND_POSITION', name: 'Defend Position', category: 'evaluation', role: 'defender' },
  { code: 'DETECT_TASK_TYPE', name: 'Detect Task Type', category: 'routing', role: 'router' },
  { code: 'SELECT_BEST_MODEL', name: 'Select Best Model', category: 'routing', role: 'router' },
  { code: 'REFINE_RESPONSE', name: 'Refine Response', category: 'generation', role: 'generator' },
  { code: 'DECOMPOSE_PROBLEM', name: 'Decompose Problem', category: 'reasoning', role: 'reasoner' },
  { code: 'SELF_REFLECT', name: 'Self Reflect', category: 'evaluation', role: 'critic' },
  { code: 'MAJORITY_VOTE', name: 'Majority Vote', category: 'aggregation', role: 'aggregator' },
  { code: 'WEIGHTED_AGGREGATE', name: 'Weighted Aggregate', category: 'aggregation', role: 'aggregator' },
];

export default function OrchestrationPatternsPage() {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<'patterns' | 'methods' | 'customization'>('patterns');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPattern, setSelectedPattern] = useState<typeof ORCHESTRATION_PATTERNS[0] | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPatterns = ORCHESTRATION_PATTERNS.filter(p => {
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    const matchesSearch = !searchTerm || 
      p.common.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.formal.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getLatencyColor = (latency: string) => {
    switch (latency) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'very_high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getCostColor = (cost: string) => {
    switch (cost) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-orange-600';
      case 'very_high': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Orchestration Patterns</h1>
          <p className="text-gray-600 dark:text-gray-400">49 documented patterns with parameterized methods for AGI selection</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            + Create Custom Pattern
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Total Patterns</p>
          <p className="text-2xl font-bold text-blue-600">49</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Categories</p>
          <p className="text-2xl font-bold text-purple-600">11</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Shared Methods</p>
          <p className="text-2xl font-bold text-green-600">{ORCHESTRATION_METHODS.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">System Patterns</p>
          <p className="text-2xl font-bold text-orange-600">49</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">User Patterns</p>
          <p className="text-2xl font-bold text-cyan-600">0</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Executions Today</p>
          <p className="text-2xl font-bold text-pink-600">1,234</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {[
            { key: 'patterns', label: 'Orchestration Patterns (49)' },
            { key: 'methods', label: 'Shared Methods' },
            { key: 'customization', label: 'Tenant Customizations' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key as typeof selectedTab)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                selectedTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Patterns Tab */}
      {selectedTab === 'patterns' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Category Sidebar */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-semibold mb-4">Categories</h3>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  !selectedCategory ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                All Patterns (49)
              </button>
              {PATTERN_CATEGORIES.map(cat => (
                <button
                  key={cat.code}
                  onClick={() => setSelectedCategory(cat.code)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex justify-between items-center ${
                    selectedCategory === cat.code ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="text-sm">{cat.name}</span>
                  <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">{cat.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Patterns List */}
          <div className="lg:col-span-3 space-y-4">
            {/* Search */}
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Search patterns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
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
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Shared Methods Architecture</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Methods are reusable building blocks that can be composed into workflows. Each method has default parameters 
              that can be overridden per-workflow. This allows the same method to behave differently in different orchestration patterns.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ORCHESTRATION_METHODS.map(method => (
              <div key={method.code} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-mono text-gray-500">{method.code}</span>
                  <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700">{method.role}</span>
                </div>
                <h4 className="font-semibold mb-1">{method.name}</h4>
                <p className="text-xs text-gray-500 mb-3">Category: {method.category}</p>
                <button className="text-xs text-blue-600 hover:text-blue-800">
                  View Parameters →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customization Tab */}
      {selectedTab === 'customization' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">How Customization Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="text-3xl mb-2">🔧</div>
                <h4 className="font-medium mb-1">Workflow Level</h4>
                <p className="text-sm text-gray-500">Override default config for entire workflow</p>
              </div>
              <div className="text-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="text-3xl mb-2">🎯</div>
                <h4 className="font-medium mb-1">Method Level</h4>
                <p className="text-sm text-gray-500">Override method parameters per-workflow</p>
              </div>
              <div className="text-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="text-3xl mb-2">🤖</div>
                <h4 className="font-medium mb-1">Model Preferences</h4>
                <p className="text-sm text-gray-500">Choose preferred models for each role</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold">Active Customizations</h3>
            </div>
            <div className="p-4">
              <p className="text-gray-500 text-center py-8">No customizations configured yet</p>
            </div>
          </div>
        </div>
      )}

      {/* Pattern Detail Modal */}
      {selectedPattern && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedPattern(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-sm font-mono text-gray-500">#{selectedPattern.num} {selectedPattern.code}</span>
                  <h2 className="text-xl font-bold">{selectedPattern.common}</h2>
                  <p className="text-gray-500">{selectedPattern.formal}</p>
                </div>
                <button onClick={() => setSelectedPattern(null)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <p className="text-xs text-gray-500">Latency</p>
                  <p className={`font-semibold ${getLatencyColor(selectedPattern.latency).split(' ')[0]}`}>{selectedPattern.latency}</p>
                </div>
                <div className="text-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <p className="text-xs text-gray-500">Cost</p>
                  <p className={`font-semibold ${getCostColor(selectedPattern.cost)}`}>{selectedPattern.cost}</p>
                </div>
                <div className="text-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <p className="text-xs text-gray-500">Min Models</p>
                  <p className="font-semibold">{selectedPattern.models}</p>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold mb-2">Quality Improvement</h4>
                <p className="text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">{selectedPattern.improvement}</p>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => router.push(`/orchestration-patterns/editor?pattern=${selectedPattern.code}`)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="9" x2="9" y1="21" y2="9"/></svg>
                  Open Visual Editor
                </button>
                <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
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
