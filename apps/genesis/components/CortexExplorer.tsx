'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Brain,
  RefreshCw,
  Camera,
  RotateCcw,
  Trash2,
  Flame,
  Snowflake,
  Thermometer,
  Activity,
  ChevronRight,
  Search,
} from 'lucide-react';
import {
  fetchBrains,
  fetchBrain,
  createSnapshot,
  restoreBrain,
  lobotomizeBrain,
  type BrainInfo,
} from '@/lib/api';

export function CortexExplorer() {
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const { data: brains, isLoading } = useQuery({
    queryKey: ['brains'],
    queryFn: fetchBrains,
    refetchInterval: 15000,
  });

  const filteredBrains = brains?.brains?.filter((brain: BrainInfo) =>
    brain.tenant_id.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="flex gap-6">
      {/* Brain List */}
      <div className="w-1/3 space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white">Brains</h2>
          <span className="px-2 py-0.5 rounded-full bg-omega-800 text-omega-400 text-sm">
            {brains?.count || 0}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-omega-500" />
          <input
            type="text"
            placeholder="Search tenants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-omega-900/50 border border-omega-800/50 rounded-lg
                       text-white placeholder-omega-500 focus:outline-none focus:border-omega-600"
          />
        </div>

        {/* Brain List */}
        <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 text-omega-400 animate-spin" />
            </div>
          ) : filteredBrains.length === 0 ? (
            <div className="text-center py-8 text-omega-500">
              No brains found
            </div>
          ) : (
            filteredBrains.map((brain: BrainInfo) => (
              <BrainCard
                key={brain.tenant_id}
                brain={brain}
                selected={selectedTenant === brain.tenant_id}
                onClick={() => setSelectedTenant(brain.tenant_id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <div className="flex-1">
        {selectedTenant ? (
          <BrainDetail
            tenantId={selectedTenant}
            onClose={() => setSelectedTenant(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-omega-500">
            <Brain className="w-16 h-16 mb-4 opacity-50" />
            <p>Select a brain to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BrainCard({
  brain,
  selected,
  onClick,
}: {
  brain: BrainInfo;
  selected: boolean;
  onClick: () => void;
}) {
  const ThermalIcon = {
    warm: Flame,
    cooling: Thermometer,
    cold: Snowflake,
    frozen: Snowflake,
  }[brain.thermal_status];

  const thermalColors = {
    warm: 'text-red-400 bg-red-500/10',
    cooling: 'text-orange-400 bg-orange-500/10',
    cold: 'text-blue-400 bg-blue-500/10',
    frozen: 'text-indigo-400 bg-indigo-500/10',
  };

  const coherenceColor =
    brain.coherence_score > 0.7
      ? 'text-green-400'
      : brain.coherence_score > 0.3
      ? 'text-yellow-400'
      : 'text-red-400';

  return (
    <button
      onClick={onClick}
      className={`
        w-full p-4 rounded-xl border transition-all text-left
        ${selected
          ? 'bg-omega-800/50 border-omega-500 neural-glow'
          : 'bg-omega-900/50 border-omega-800/50 hover:border-omega-700'
        }
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${thermalColors[brain.thermal_status]}`}>
            <ThermalIcon className="w-4 h-4" />
          </div>
          <span className="font-medium text-white truncate max-w-[150px]">
            {brain.tenant_id}
          </span>
        </div>
        <ChevronRight className={`w-4 h-4 text-omega-500 transition-transform ${selected ? 'rotate-90' : ''}`} />
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <Activity className={`w-3 h-3 ${coherenceColor}`} />
          <span className={coherenceColor}>
            {(brain.coherence_score * 100).toFixed(0)}%
          </span>
        </div>
        <div className="text-omega-500">
          v{brain.version}
        </div>
        <div className="text-omega-500">
          {brain.total_cycles.toLocaleString()} cycles
        </div>
      </div>
    </button>
  );
}

function BrainDetail({
  tenantId,
  onClose,
}: {
  tenantId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: brain, isLoading } = useQuery({
    queryKey: ['brain', tenantId],
    queryFn: () => fetchBrain(tenantId),
    refetchInterval: 5000,
  });

  const snapshotMutation = useMutation({
    mutationFn: () => createSnapshot(tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brain', tenantId] });
    },
  });

  const lobotomyMutation = useMutation({
    mutationFn: () => lobotomizeBrain(tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brain', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['brains'] });
    },
  });

  if (isLoading || !brain?.success) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 text-omega-400 animate-spin" />
      </div>
    );
  }

  const { metadata, ambition_state, visualization } = brain;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{tenantId}</h2>
          <p className="text-omega-400">
            {brain.thermal_status} • v{metadata.version} • {metadata.total_cycles.toLocaleString()} cycles
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => snapshotMutation.mutate()}
            disabled={snapshotMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-omega-800 hover:bg-omega-700
                       text-white transition-colors disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            {snapshotMutation.isPending ? 'Saving...' : 'Snapshot'}
          </button>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to reset this brain? This cannot be undone.')) {
                lobotomyMutation.mutate();
              }
            }}
            disabled={lobotomyMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-900/50 hover:bg-red-800/50
                       text-red-400 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {lobotomyMutation.isPending ? 'Resetting...' : 'Lobotomy'}
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Coherence"
          value={`${(metadata.coherence_score * 100).toFixed(1)}%`}
          color={metadata.coherence_score > 0.7 ? 'green' : metadata.coherence_score > 0.3 ? 'yellow' : 'red'}
        />
        <MetricCard
          label="Entropy"
          value={`${(metadata.entropy_level * 100).toFixed(1)}%`}
          color={metadata.entropy_level < 0.5 ? 'green' : metadata.entropy_level < 0.8 ? 'yellow' : 'red'}
        />
        <MetricCard
          label="Neural Density"
          value={`${metadata.neural_density_mb.toFixed(2)} MB`}
          color="blue"
        />
        <MetricCard
          label="Active ROM"
          value={metadata.firmware_name}
          color="purple"
        />
      </div>

      {/* Ambition State */}
      {ambition_state && (
        <div className="bg-omega-900/50 rounded-xl border border-omega-800/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Ambition State</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <AmbitionBar label="Dopamine" value={ambition_state.dopamine} color="green" />
            <AmbitionBar label="Entropy" value={ambition_state.entropy} color="red" />
            <AmbitionBar label="Curiosity" value={ambition_state.curiosity} color="purple" />
            <AmbitionBar label="Arousal" value={ambition_state.arousal} color="orange" />
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm text-omega-400">
            <span>Dreams: {ambition_state.total_dreams}</span>
            <span>Rewards: {ambition_state.total_rewards}</span>
            <span>Idle: {ambition_state.consecutive_idle_ticks} ticks</span>
          </div>
        </div>
      )}

      {/* Phase Visualization */}
      {visualization?.phase_distribution && (
        <div className="bg-omega-900/50 rounded-xl border border-omega-800/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Phase Distribution</h3>
          <div className="h-24 flex items-end gap-0.5">
            {visualization.phase_distribution.map((phase: number, i: number) => (
              <div
                key={i}
                className="flex-1 bg-omega-500 rounded-t opacity-70 hover:opacity-100 transition-opacity"
                style={{
                  height: `${Math.abs(phase / Math.PI) * 100}%`,
                  backgroundColor: phase > 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
                }}
                title={`Neuron ${i}: ${phase.toFixed(3)} rad`}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-omega-500 mt-2">
            <span>-π</span>
            <span>0</span>
            <span>+π</span>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="bg-omega-900/50 rounded-xl border border-omega-800/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Metadata</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-omega-500">Created:</span>
            <span className="ml-2 text-white">{new Date(metadata.created_at).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-omega-500">Last Active:</span>
            <span className="ml-2 text-white">{new Date(metadata.last_awake).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-omega-500">S3 Backup:</span>
            <span className="ml-2 text-white truncate">
              {metadata.s3_backup_key || 'None'}
            </span>
          </div>
          <div>
            <span className="text-omega-500">ROM Version:</span>
            <span className="ml-2 text-white font-mono text-xs">
              {metadata.firmware_version}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: 'green' | 'yellow' | 'red' | 'blue' | 'purple';
}) {
  const colorClasses = {
    green: 'border-green-500/30 text-green-400',
    yellow: 'border-yellow-500/30 text-yellow-400',
    red: 'border-red-500/30 text-red-400',
    blue: 'border-blue-500/30 text-blue-400',
    purple: 'border-purple-500/30 text-purple-400',
  };

  return (
    <div className={`p-4 rounded-lg border bg-omega-900/30 ${colorClasses[color]}`}>
      <div className="text-omega-400 text-sm mb-1">{label}</div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  );
}

function AmbitionBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'green' | 'red' | 'purple' | 'orange';
}) {
  const colorClasses = {
    green: 'bg-green-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-omega-400">{label}</span>
        <span className="text-white">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-omega-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-300`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}
