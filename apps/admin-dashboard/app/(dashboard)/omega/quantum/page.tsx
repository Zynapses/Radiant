'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';

interface BrainSummary {
  brain: {
    id: string;
    hilbert_dimension: number;
    last_norm_value: number;
    last_unitarity_check: string;
    unitarity_corrections_count: number;
    firmware_hash: string;
    active_firmware_id: string;
    fw_status: string;
    fw_dim: number;
  };
  measurements_24h: {
    total: number;
    avg_prob: number;
    last_at: string;
  };
}

interface UnitarityHealth {
  events: Array<{
    event_type: string;
    measured_norm: number;
    deviation: number;
    action_taken: string;
    detected_at: string;
    cycle_number: number;
  }>;
  stats_24h: Array<{
    event_type: string;
    count: number;
    avg_deviation: number;
  }>;
  healthy: boolean;
}

interface HelixTestResult {
  action: string;
  overlap: number;
  projected?: boolean;
  safe_state_norm?: number;
  dampened_state_norm?: number;
}

export default function OmegaQuantumPage() {
  const [brainId, setBrainId] = useState('');
  const [helixPayload, setHelixPayload] = useState('');
  const [helixResult, setHelixResult] = useState<HelixTestResult | null>(null);

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<BrainSummary>({
    queryKey: ['omega-quantum-summary', brainId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/omega/quantum/state-summary?brain_id=${brainId}`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    enabled: brainId.length > 0,
    refetchInterval: 15_000
  });

  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useQuery<UnitarityHealth>({
    queryKey: ['omega-quantum-health', brainId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/omega/quantum/unitarity-health?brain_id=${brainId}&limit=20`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    enabled: brainId.length > 0,
    refetchInterval: 15_000
  });

  const helixTestMutation = useMutation({
    mutationFn: async () => {
      const body = JSON.parse(helixPayload);
      const res = await fetch('/api/admin/omega/quantum/helix-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data) => setHelixResult(data),
    onError: (err: Error) => setHelixResult({ action: 'error', overlap: 0, safe_state_norm: 0 })
  });

  const loading = summaryLoading || healthLoading;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">OMEGA Quantum State</h1>
      <p className="text-sm text-gray-500">
        Monitor quantum brain state, unitarity health, and test Helix safety rules.
      </p>

      {/* Brain Selector */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Brain ID (UUID)"
          value={brainId}
          onChange={(e) => setBrainId(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          onClick={() => { refetchSummary(); refetchHealth(); }}
          disabled={!brainId}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Load
        </button>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading quantum state...</p>}

      {/* State Summary */}
      {summary && (
        <div className="border border-gray-200 rounded-lg p-5 space-y-4 bg-white shadow-sm">
          <h2 className="font-semibold text-gray-900">Quantum State Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-500">Hilbert Dimension</span>
              <p className="text-gray-900 text-lg font-mono">{summary.brain.hilbert_dimension}</p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Last Norm</span>
              <p className={`text-lg font-mono ${
                summary.brain.last_norm_value != null && Math.abs(Number(summary.brain.last_norm_value) - 1.0) < 0.01
                  ? 'text-green-700' : 'text-red-700'
              }`}>
                {summary.brain.last_norm_value != null ? Number(summary.brain.last_norm_value).toFixed(8) : 'N/A'}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Corrections</span>
              <p className="text-gray-900 text-lg font-mono">{summary.brain.unitarity_corrections_count ?? 0}</p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Active Firmware</span>
              <p className="text-gray-900 font-mono truncate">{summary.brain.active_firmware_id || 'None'}</p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Firmware Status</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                summary.brain.fw_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {summary.brain.fw_status || 'N/A'}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-500">Last Unitarity Check</span>
              <p className="text-gray-900 text-sm">
                {summary.brain.last_unitarity_check
                  ? new Date(summary.brain.last_unitarity_check).toLocaleString()
                  : 'Never'}
              </p>
            </div>
          </div>

          {/* 24h Measurements */}
          <div className="pt-3 border-t border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Measurements (24h)</h3>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-gray-400">Total</span>
                <p className="font-mono">{summary.measurements_24h?.total ?? 0}</p>
              </div>
              <div>
                <span className="text-gray-400">Avg Probability</span>
                <p className="font-mono">
                  {summary.measurements_24h?.avg_prob != null
                    ? Number(summary.measurements_24h.avg_prob).toFixed(4)
                    : 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-gray-400">Last</span>
                <p className="text-sm">
                  {summary.measurements_24h?.last_at
                    ? new Date(summary.measurements_24h.last_at).toLocaleTimeString()
                    : 'None'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unitarity Health */}
      {health && (
        <div className={`border rounded-lg p-5 space-y-4 shadow-sm ${
          health.healthy ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
        }`}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Unitarity Health</h2>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              health.healthy ? 'bg-green-200 text-green-900' : 'bg-red-200 text-red-900'
            }`}>
              {health.healthy ? 'Healthy' : 'Violations Detected'}
            </span>
          </div>

          {/* 24h Stats */}
          {health.stats_24h.length > 0 && (
            <div className="grid grid-cols-3 gap-3 text-sm">
              {health.stats_24h.map((s) => (
                <div key={s.event_type} className="bg-white/70 rounded p-2">
                  <span className="text-gray-500 capitalize">{s.event_type}</span>
                  <p className="font-mono">{s.count} events</p>
                  <p className="text-xs text-gray-400">avg dev: {Number(s.avg_deviation).toFixed(6)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Recent Events */}
          {health.events.length > 0 && (
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 text-left">
                    <th className="py-1">Type</th>
                    <th>Norm</th>
                    <th>Deviation</th>
                    <th>Action</th>
                    <th>Cycle</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {health.events.map((e, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className={`py-1 font-medium ${
                        e.event_type === 'violation' ? 'text-red-700' :
                        e.event_type === 'correction' ? 'text-yellow-700' : 'text-gray-600'
                      }`}>
                        {e.event_type}
                      </td>
                      <td className="font-mono">{Number(e.measured_norm).toFixed(6)}</td>
                      <td className="font-mono">{Number(e.deviation).toFixed(6)}</td>
                      <td>{e.action_taken}</td>
                      <td className="font-mono">{e.cycle_number}</td>
                      <td>{new Date(e.detected_at).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Helix Test */}
      <div className="border border-gray-200 rounded-lg p-5 space-y-3 bg-white shadow-sm">
        <h2 className="font-semibold text-gray-900">Helix Rule Test (Dry Run)</h2>
        <p className="text-xs text-gray-500">
          Test a Helix rule against a test vector without modifying any brain state.
        </p>
        <textarea
          rows={8}
          placeholder={`{\n  "rule": {\n    "forbidden_state": { "real": [1,0,0], "imaginary": [0,0,0] },\n    "interference_type": "destructive"\n  },\n  "test_vector": { "real": [0.7,0.7,0], "imaginary": [0,0,0] }\n}`}
          value={helixPayload}
          onChange={(e) => setHelixPayload(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        />
        <button
          onClick={() => helixTestMutation.mutate()}
          disabled={!helixPayload || helixTestMutation.isPending}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {helixTestMutation.isPending ? 'Testing...' : 'Run Helix Test'}
        </button>

        {helixResult && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm font-mono">
            <pre>{JSON.stringify(helixResult, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
