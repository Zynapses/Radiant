'use client';

import React, { useState } from 'react';

// ML Training Configuration (editable)
const defaultTrainingConfig = {
  // Training Thresholds
  minSamplesForTraining: 5000,
  minQualityScoreThreshold: 0.7,
  minPositiveFeedbackRatio: 0.6,
  
  // Model Training Parameters
  baseModel: 'mistral-7b-instruct',
  learningRate: 0.0001,
  batchSize: 32,
  epochs: 3,
  warmupSteps: 100,
  
  // A/B Testing
  newModelTrafficPercent: 10,
  minTestSamples: 500,
  promotionAccuracyThreshold: 0.02, // Must be 2% better to promote
  
  // Auto-Training
  autoTrainingEnabled: false,
  autoTrainingSchedule: 'weekly',
  
  // Data Collection
  collectUserFeedback: true,
  collectQualityScores: true,
  sampleRetentionDays: 90,
  
  // Model Capabilities Weights (for routing decisions)
  capabilityWeights: {
    reasoning: 1.0,
    coding: 1.0,
    math: 0.8,
    creative: 0.7,
    vision: 0.9,
    speed: 0.6,
    costEfficiency: 0.5,
  },
};

// Current AI Models (keeping up to date!)
const currentModels = [
  // OpenAI
  { id: 'openai/gpt-4o', provider: 'openai', name: 'GPT-4o', version: '2024-11-20', reasoning: 0.92, coding: 0.90, vision: true, price: '$2.50/$10' },
  { id: 'openai/gpt-4o-mini', provider: 'openai', name: 'GPT-4o Mini', version: '2024-07-18', reasoning: 0.82, coding: 0.80, vision: true, price: '$0.15/$0.60' },
  { id: 'openai/o1', provider: 'openai', name: 'o1', version: '2024-12-17', reasoning: 0.98, coding: 0.96, vision: true, price: '$15/$60' },
  { id: 'openai/o1-mini', provider: 'openai', name: 'o1-mini', version: '2024-09-12', reasoning: 0.92, coding: 0.94, vision: false, price: '$3/$12' },
  { id: 'openai/o3-mini', provider: 'openai', name: 'o3-mini', version: '2025-01-31', reasoning: 0.96, coding: 0.97, vision: false, price: '$1.10/$4.40' },
  
  // Anthropic
  { id: 'anthropic/claude-3-5-sonnet-20241022', provider: 'anthropic', name: 'Claude 3.5 Sonnet', version: '2024-10-22', reasoning: 0.94, coding: 0.96, vision: true, price: '$3/$15' },
  { id: 'anthropic/claude-3-5-haiku-20241022', provider: 'anthropic', name: 'Claude 3.5 Haiku', version: '2024-10-22', reasoning: 0.82, coding: 0.85, vision: true, price: '$0.80/$4' },
  { id: 'anthropic/claude-3-opus-20240229', provider: 'anthropic', name: 'Claude 3 Opus', version: '2024-02-29', reasoning: 0.95, coding: 0.93, vision: true, price: '$15/$75' },
  
  // Google
  { id: 'google/gemini-2.0-flash', provider: 'google', name: 'Gemini 2.0 Flash', version: '2024-12-11', reasoning: 0.88, coding: 0.85, vision: true, price: '$0.075/$0.30' },
  { id: 'google/gemini-2.0-flash-thinking', provider: 'google', name: 'Gemini 2.0 Flash Thinking', version: '2024-12-19', reasoning: 0.94, coding: 0.92, vision: true, price: '$0.075/$0.30' },
  { id: 'google/gemini-1.5-pro', provider: 'google', name: 'Gemini 1.5 Pro', version: '2024-05-14', reasoning: 0.90, coding: 0.88, vision: true, price: '$1.25/$5' },
  
  // DeepSeek
  { id: 'deepseek/deepseek-chat', provider: 'deepseek', name: 'DeepSeek V3', version: '2024-12-26', reasoning: 0.92, coding: 0.94, vision: false, price: '$0.27/$1.10' },
  { id: 'deepseek/deepseek-reasoner', provider: 'deepseek', name: 'DeepSeek R1', version: '2025-01-20', reasoning: 0.96, coding: 0.95, vision: false, price: '$0.55/$2.19' },
  
  // Meta
  { id: 'meta/llama-3.3-70b', provider: 'meta', name: 'Llama 3.3 70B', version: '2024-12-06', reasoning: 0.88, coding: 0.85, vision: false, price: '$0.90/$0.90' },
  
  // Mistral
  { id: 'mistral/mistral-large-2411', provider: 'mistral', name: 'Mistral Large', version: '2024-11-18', reasoning: 0.90, coding: 0.88, vision: false, price: '$2/$6' },
  { id: 'mistral/codestral-2501', provider: 'mistral', name: 'Codestral', version: '2025-01-14', reasoning: 0.80, coding: 0.96, vision: false, price: '$0.30/$0.90' },
  
  // xAI
  { id: 'xai/grok-2', provider: 'xai', name: 'Grok 2', version: '2024-12-12', reasoning: 0.90, coding: 0.88, vision: true, price: '$2/$10' },
  
  // Amazon
  { id: 'amazon/nova-pro', provider: 'amazon', name: 'Nova Pro', version: '2024-12-03', reasoning: 0.86, coding: 0.82, vision: true, price: '$0.80/$3.20' },
];

interface TrainingStats { totalSamples: number; unusedSamples: number; positiveRatio: number; lastTrainingDate: string; activeModelVersion: number; modelAccuracy: number; }
interface TrainingBatch { id: string; name: string; status: string; samples: number; accuracy: number; date: string; }

const defaultTrainingStats: TrainingStats = { totalSamples: 0, unusedSamples: 0, positiveRatio: 0, lastTrainingDate: '', activeModelVersion: 0, modelAccuracy: 0 };

export default function MLTrainingPage() {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'models' | 'training' | 'data' | 'settings' | 'metrics'>('overview');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [config, setConfig] = useState(defaultTrainingConfig);
  const [hasConfigChanges, setHasConfigChanges] = useState(false);
  const [trainingStats, setTrainingStats] = useState<TrainingStats>(defaultTrainingStats);
  const [trainingBatches, setTrainingBatches] = useState<TrainingBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const API = process.env.NEXT_PUBLIC_API_URL || '';
        const [statsRes, batchesRes] = await Promise.all([
          fetch(`${API}/api/admin/ml-training/stats`),
          fetch(`${API}/api/admin/ml-training/batches`),
        ]);
        if (statsRes.ok) { const { data } = await statsRes.json(); setTrainingStats(data || defaultTrainingStats); }
        else setError('Failed to load training data.');
        if (batchesRes.ok) { const { data } = await batchesRes.json(); setTrainingBatches(data || []); }
      } catch { setError('Failed to connect to training service.'); }
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-96 text-red-500"><p className="text-lg font-medium">Error</p><p className="text-sm">{error}</p></div>;

  const filteredModels = currentModels.filter(m => 
    providerFilter === 'all' || m.provider === providerFilter
  );

  const providers = Array.from(new Set(currentModels.map(m => m.provider)));

  const getScoreColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600';
    if (score >= 0.8) return 'text-blue-600';
    if (score >= 0.7) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const updateConfig = (key: string, value: unknown) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setHasConfigChanges(true);
  };

  const updateCapabilityWeight = (key: string, value: number) => {
    setConfig(prev => ({
      ...prev,
      capabilityWeights: { ...prev.capabilityWeights, [key]: value }
    }));
    setHasConfigChanges(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ML Training Pipeline</h1>
          <p className="text-gray-600 dark:text-gray-400">Train routing models from real usage data</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            Start Training
          </button>
          <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Refresh Models
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Training Samples</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{trainingStats.totalSamples.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Unused Samples</p>
          <p className="text-xl font-bold text-blue-600">{trainingStats.unusedSamples.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Positive Ratio</p>
          <p className="text-xl font-bold text-green-600">{Math.round(trainingStats.positiveRatio * 100)}%</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Model Version</p>
          <p className="text-xl font-bold text-purple-600">v{trainingStats.activeModelVersion}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Model Accuracy</p>
          <p className="text-xl font-bold text-green-600">{Math.round(trainingStats.modelAccuracy * 100)}%</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Available Models</p>
          <p className="text-xl font-bold text-orange-600">{currentModels.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'models', label: `AI Models (${currentModels.length})` },
            { key: 'training', label: 'Training History' },
            { key: 'data', label: 'Training Data' },
            { key: 'settings', label: '⚙️ Settings' },
            { key: 'metrics', label: '📈 Metrics' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key as typeof selectedTab)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                selectedTab === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {selectedTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* How It Works */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">How ML Training Works</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <div>
                  <p className="font-medium">Collect Training Data</p>
                  <p className="text-gray-500">Every routing decision is logged with task, model selection, and outcome</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <div>
                  <p className="font-medium">Label with Feedback</p>
                  <p className="text-gray-500">User feedback and quality scores determine if routing was correct</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <div>
                  <p className="font-medium">Export & Train</p>
                  <p className="text-gray-500">Data exported to S3, fine-tune model on SageMaker</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                <div>
                  <p className="font-medium">Deploy & Evaluate</p>
                  <p className="text-gray-500">New model deployed, A/B tested, promoted if better</p>
                </div>
              </div>
            </div>
          </div>

          {/* Training History */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Recent Training Runs</h2>
            <div className="space-y-3">
              {trainingBatches.map(batch => (
                <div key={batch.id} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                  <div>
                    <p className="font-medium">{batch.name}</p>
                    <p className="text-xs text-gray-500">{batch.samples.toLocaleString()} samples • {batch.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-green-600">{Math.round(batch.accuracy * 100)}%</span>
                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                      {batch.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* What the Model Learns */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4">What the Routing Model Learns</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="font-medium text-blue-800 dark:text-blue-200">Task Classification</p>
                <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                  Learns to identify task type (coding, reasoning, creative, etc.) from text
                </p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="font-medium text-green-800 dark:text-green-200">Model Selection</p>
                <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                  Predicts which AI model will perform best for each task type
                </p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <p className="font-medium text-purple-800 dark:text-purple-200">Quality Prediction</p>
                <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">
                  Estimates expected response quality before making the call
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Models Tab */}
      {selectedTab === 'models' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-4">
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="all">All Providers</option>
              {providers.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <p className="text-sm text-gray-500 self-center">
              Showing {filteredModels.length} models • Last updated: Jan 2025
            </p>
          </div>

          {/* Models Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reasoning</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Coding</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vision</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price (In/Out)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredModels.map(model => (
                  <tr key={model.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-3">
                      <p className="font-medium">{model.name}</p>
                      <p className="text-xs text-gray-500 font-mono">{model.id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {model.provider}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{model.version}</td>
                    <td className={`px-4 py-3 font-medium ${getScoreColor(model.reasoning)}`}>
                      {Math.round(model.reasoning * 100)}%
                    </td>
                    <td className={`px-4 py-3 font-medium ${getScoreColor(model.coding)}`}>
                      {Math.round(model.coding * 100)}%
                    </td>
                    <td className="px-4 py-3">
                      {model.vision ? (
                        <span className="text-green-600">✓</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono">{model.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Keeping Models Current:</strong> The model registry is updated with every Radiant deployment. 
              The ML training pipeline automatically incorporates new models as they become available.
              Model capabilities are benchmarked and scored for intelligent routing.
            </p>
          </div>
        </div>
      )}

      {/* Training History Tab */}
      {selectedTab === 'training' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold">Training Batch History</h2>
            <p className="text-sm text-gray-500">All model training runs and their results</p>
          </div>
          <div className="p-4">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase">
                  <th className="pb-3">Batch Name</th>
                  <th className="pb-3">Samples</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Accuracy</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {trainingBatches.map(batch => (
                  <tr key={batch.id}>
                    <td className="py-3 font-medium">{batch.name}</td>
                    <td className="py-3">{batch.samples.toLocaleString()}</td>
                    <td className="py-3">
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                        {batch.status}
                      </span>
                    </td>
                    <td className="py-3 font-medium text-green-600">{Math.round(batch.accuracy * 100)}%</td>
                    <td className="py-3 text-gray-500">{batch.date}</td>
                    <td className="py-3">
                      <button className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Training Data Tab */}
      {selectedTab === 'data' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Training Data Collection</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-2">Data Quality</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>With quality scores</span>
                    <span className="font-medium">89%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>With user feedback</span>
                    <span className="font-medium">34%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Labeled as good choice</span>
                    <span className="font-medium">78%</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2">Ready for Training</h3>
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {trainingStats.unusedSamples.toLocaleString()}
                </div>
                <p className="text-sm text-gray-500">
                  samples ready for next training batch
                </p>
                <button className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
                  Create Training Batch
                </button>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Continuous Learning</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              The system automatically collects training data from every request. 
              When enough new samples are available (default: 5,000), you can trigger a new training run.
              The model will be A/B tested before being fully deployed.
            </p>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {selectedTab === 'settings' && (
        <div className="space-y-6">
          {hasConfigChanges && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 flex items-center justify-between">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">You have unsaved changes</p>
              <button 
                onClick={() => setHasConfigChanges(false)}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
              >
                Save Changes
              </button>
            </div>
          )}

          {/* Training Thresholds */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold">Training Thresholds</h2>
              <p className="text-sm text-gray-500">Configure when and how training is triggered</p>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Min Samples for Training
                  </label>
                  <input
                    type="number"
                    value={config.minSamplesForTraining}
                    onChange={(e) => updateConfig('minSamplesForTraining', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum samples required to start training</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Min Quality Score Threshold
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={config.minQualityScoreThreshold}
                    onChange={(e) => updateConfig('minQualityScoreThreshold', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">Quality score to consider routing &quot;good&quot;</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Min Positive Feedback Ratio
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={config.minPositiveFeedbackRatio}
                    onChange={(e) => updateConfig('minPositiveFeedbackRatio', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">Required positive feedback ratio for training data</p>
                </div>
              </div>
            </div>
          </div>

          {/* Model Training Parameters */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold">Model Training Parameters</h2>
              <p className="text-sm text-gray-500">Fine-tuning hyperparameters for the routing model</p>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Base Model
                  </label>
                  <select
                    value={config.baseModel}
                    onChange={(e) => updateConfig('baseModel', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                  >
                    <option value="mistral-7b-instruct">Mistral 7B Instruct</option>
                    <option value="llama-3-8b">Llama 3 8B</option>
                    <option value="phi-3-mini">Phi-3 Mini</option>
                    <option value="gemma-2-9b">Gemma 2 9B</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Learning Rate
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    value={config.learningRate}
                    onChange={(e) => updateConfig('learningRate', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Batch Size
                  </label>
                  <input
                    type="number"
                    value={config.batchSize}
                    onChange={(e) => updateConfig('batchSize', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Epochs
                  </label>
                  <input
                    type="number"
                    value={config.epochs}
                    onChange={(e) => updateConfig('epochs', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Warmup Steps
                  </label>
                  <input
                    type="number"
                    value={config.warmupSteps}
                    onChange={(e) => updateConfig('warmupSteps', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* A/B Testing */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold">A/B Testing Configuration</h2>
              <p className="text-sm text-gray-500">Control how new models are tested before full deployment</p>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Initial Traffic % for New Model
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={config.newModelTrafficPercent}
                    onChange={(e) => updateConfig('newModelTrafficPercent', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Min Test Samples
                  </label>
                  <input
                    type="number"
                    value={config.minTestSamples}
                    onChange={(e) => updateConfig('minTestSamples', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Promotion Threshold (accuracy improvement)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={config.promotionAccuracyThreshold}
                    onChange={(e) => updateConfig('promotionAccuracyThreshold', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">New model must be this much better to be promoted</p>
                </div>
              </div>
            </div>
          </div>

          {/* Auto-Training & Data Collection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold">Auto-Training</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Enable Auto-Training</p>
                    <p className="text-sm text-gray-500">Automatically start training when enough samples</p>
                  </div>
                  <button
                    onClick={() => updateConfig('autoTrainingEnabled', !config.autoTrainingEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.autoTrainingEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.autoTrainingEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Schedule
                  </label>
                  <select
                    value={config.autoTrainingSchedule}
                    onChange={(e) => updateConfig('autoTrainingSchedule', e.target.value)}
                    disabled={!config.autoTrainingEnabled}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 disabled:opacity-50"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold">Data Collection</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Collect User Feedback</p>
                    <p className="text-sm text-gray-500">Record thumbs up/down from users</p>
                  </div>
                  <button
                    onClick={() => updateConfig('collectUserFeedback', !config.collectUserFeedback)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.collectUserFeedback ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.collectUserFeedback ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Collect Quality Scores</p>
                    <p className="text-sm text-gray-500">Auto-assess response quality</p>
                  </div>
                  <button
                    onClick={() => updateConfig('collectQualityScores', !config.collectQualityScores)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.collectQualityScores ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.collectQualityScores ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sample Retention (days)
                  </label>
                  <input
                    type="number"
                    value={config.sampleRetentionDays}
                    onChange={(e) => updateConfig('sampleRetentionDays', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Capability Weights */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold">Capability Weights for Routing</h2>
              <p className="text-sm text-gray-500">Adjust how much each capability matters when selecting models</p>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(config.capabilityWeights).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()} ({value.toFixed(1)})
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={value}
                      onChange={(e) => updateCapabilityWeight(key, parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Tab */}
      {selectedTab === 'metrics' && (
        <div className="space-y-6">
          {/* Current Model Performance */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold">Current Model Performance</h2>
              <p className="text-sm text-gray-500">Real-time metrics from the active routing model</p>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-3xl font-bold text-green-600">84%</p>
                  <p className="text-sm text-gray-500">Accuracy</p>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-3xl font-bold text-blue-600">23ms</p>
                  <p className="text-sm text-gray-500">P50 Latency</p>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-3xl font-bold text-purple-600">89ms</p>
                  <p className="text-sm text-gray-500">P99 Latency</p>
                </div>
                <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <p className="text-3xl font-bold text-orange-600">156K</p>
                  <p className="text-sm text-gray-500">Predictions Today</p>
                </div>
              </div>
            </div>
          </div>

          {/* Routing Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold">Model Selection Distribution</h2>
              <p className="text-sm text-gray-500">Which models are being selected by the router</p>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {[
                  { model: 'Claude 3.5 Sonnet', percent: 34, quality: 0.91 },
                  { model: 'GPT-4o', percent: 28, quality: 0.89 },
                  { model: 'DeepSeek V3', percent: 18, quality: 0.88 },
                  { model: 'Gemini 2.0 Flash', percent: 12, quality: 0.85 },
                  { model: 'o1-mini', percent: 8, quality: 0.94 },
                ].map(item => (
                  <div key={item.model} className="flex items-center gap-4">
                    <div className="w-40 text-sm font-medium">{item.model}</div>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                      <div 
                        className="bg-blue-600 h-4 rounded-full"
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                    <div className="w-12 text-sm text-right">{item.percent}%</div>
                    <div className="w-16 text-sm text-right text-green-600">{Math.round(item.quality * 100)}% qual</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Learning Progress */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold">Learning Progress Over Time</h2>
              <p className="text-sm text-gray-500">Model accuracy improvement across training versions</p>
            </div>
            <div className="p-4">
              <div className="flex items-end gap-4 h-48">
                {[
                  { version: 'v1', accuracy: 0.72 },
                  { version: 'v2', accuracy: 0.79 },
                  { version: 'v3', accuracy: 0.84 },
                ].map(item => (
                  <div key={item.version} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t"
                      style={{ height: `${item.accuracy * 180}px` }}
                    />
                    <p className="mt-2 text-sm font-medium">{item.version}</p>
                    <p className="text-xs text-gray-500">{Math.round(item.accuracy * 100)}%</p>
                  </div>
                ))}
                <div className="flex-1 flex flex-col items-center opacity-50">
                  <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-t border-2 border-dashed border-gray-400" style={{ height: '160px' }} />
                  <p className="mt-2 text-sm font-medium">v4</p>
                  <p className="text-xs text-gray-500">~88%?</p>
                </div>
              </div>
            </div>
          </div>

          {/* Specialty Performance */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold">Performance by Task Specialty</h2>
              <p className="text-sm text-gray-500">How well the router performs for different task types</p>
            </div>
            <div className="p-4">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase">
                    <th className="pb-3">Specialty</th>
                    <th className="pb-3">Samples</th>
                    <th className="pb-3">Routing Accuracy</th>
                    <th className="pb-3">Avg Quality</th>
                    <th className="pb-3">Top Model</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {[
                    { specialty: 'Coding', samples: 8234, accuracy: 0.89, quality: 0.91, topModel: 'Claude 3.5 Sonnet' },
                    { specialty: 'Reasoning', samples: 5621, accuracy: 0.86, quality: 0.88, topModel: 'o1' },
                    { specialty: 'Creative', samples: 3456, accuracy: 0.82, quality: 0.85, topModel: 'GPT-4o' },
                    { specialty: 'Math', samples: 2341, accuracy: 0.91, quality: 0.93, topModel: 'DeepSeek R1' },
                    { specialty: 'General', samples: 4912, accuracy: 0.78, quality: 0.82, topModel: 'GPT-4o' },
                  ].map(item => (
                    <tr key={item.specialty}>
                      <td className="py-3 font-medium">{item.specialty}</td>
                      <td className="py-3">{item.samples.toLocaleString()}</td>
                      <td className="py-3">
                        <span className={`font-medium ${item.accuracy >= 0.85 ? 'text-green-600' : 'text-yellow-600'}`}>
                          {Math.round(item.accuracy * 100)}%
                        </span>
                      </td>
                      <td className="py-3 text-green-600">{Math.round(item.quality * 100)}%</td>
                      <td className="py-3 text-sm text-gray-500">{item.topModel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
