'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Brain,
  Activity,
  Zap,
  Thermometer,
  Clock,
  Cpu,
  Target,
  MapPin,
  UtensilsCrossed,
  Flame,
  RefreshCw,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  getHealth,
  getState,
  getTrainStatus,
  getMcMenu,
  getMcStores,
  getMcDeals,
  type BrainState,
  type McMenuResult,
  type McStoresResult,
  type McDealsResult,
} from '@/lib/proving-ground';

export function Dashboard() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [storesOpen, setStoresOpen] = useState(false);

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['dash-health'],
    queryFn: getHealth,
    refetchInterval: 5000,
    retry: 1,
  });

  const { data: brainState } = useQuery<BrainState>({
    queryKey: ['dash-state'],
    queryFn: getState,
    refetchInterval: 3000,
    retry: 1,
    enabled: !!health?.brain_booted,
  });

  const { data: trainStatus } = useQuery({
    queryKey: ['dash-train'],
    queryFn: getTrainStatus,
    refetchInterval: 5000,
    retry: 1,
    enabled: !!health,
  });

  const { data: mcMenu, isLoading: menuLoading, refetch: refetchMenu } = useQuery<McMenuResult>({
    queryKey: ['mc-menu'],
    queryFn: () => getMcMenu(),
    staleTime: 3600_000,
    retry: 1,
  });

  const { data: mcStores, isLoading: storesLoading, refetch: refetchStores } = useQuery<McStoresResult>({
    queryKey: ['mc-stores'],
    queryFn: () => getMcStores(),
    staleTime: 1800_000,
    retry: 1,
  });

  const { data: mcDeals } = useQuery<McDealsResult>({
    queryKey: ['mc-deals'],
    queryFn: () => getMcDeals(),
    staleTime: 3600_000,
    retry: 1,
  });

  const connected = !!health?.status;
  const cortex = brainState?.cortex;
  const ambition = brainState?.ambition;
  const uptime = brainState?.uptime_seconds || 0;
  const uptimeStr = uptime > 3600
    ? `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`
    : uptime > 60
      ? `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`
      : `${Math.floor(uptime)}s`;

  if (healthLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Brain className="w-12 h-12 text-omega-400 animate-pulse" />
          <span className="text-omega-400">Connecting to OMEGA Server...</span>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Cpu className="w-12 h-12 text-red-400" />
          <span className="text-red-400">Cannot reach OMEGA server at localhost:11435</span>
          <span className="text-omega-500 text-sm">Start it with: python3 server.py</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">OMEGA Dashboard</h2>
          <p className="text-omega-400">Real-time brain health + McDonald&apos;s live data</p>
        </div>
        <div className="flex items-center gap-3">
          {mcMenu && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              <UtensilsCrossed className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-amber-400">
                {mcMenu.source === 'mcdonalds_api' ? 'Live API' : 'Local Menu'} ({mcMenu.total_items} items)
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-400 font-mono">{health?.device?.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Brain State Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard label="Status" value={health?.brain_booted ? 'Booted' : 'Cold'} color={health?.brain_booted ? 'green' : 'red'} icon={<Brain className="w-4 h-4" />} />
        <StatCard label="Coherence" value={cortex ? `${(cortex.coherence * 100).toFixed(1)}%` : '—'} color={cortex && cortex.coherence > 0.5 ? 'green' : 'amber'} icon={<Activity className="w-4 h-4" />} />
        <StatCard label="Inferences" value={brainState?.inference_count?.toLocaleString() ?? '0'} color="omega" icon={<Zap className="w-4 h-4" />} />
        <StatCard label="Uptime" value={uptimeStr} color="blue" icon={<Clock className="w-4 h-4" />} />
        <StatCard label="State Norm" value={cortex ? cortex.state_norm.toFixed(1) : '—'} color="purple" icon={<Target className="w-4 h-4" />} />
        <StatCard label="Dopamine" value={ambition ? `${(ambition.dopamine * 100).toFixed(0)}%` : '—'} color="emerald" icon={<Flame className="w-4 h-4" />} />
      </div>

      {/* Training Status + Ambition */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Training Status */}
        <div className="bg-omega-900/50 rounded-xl border border-omega-800/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-omega-400" />
            Training Status
          </h3>
          {trainStatus ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-omega-800/30 rounded-lg p-3">
                  <div className="text-omega-500 text-xs mb-1">Status</div>
                  <div className={`font-bold ${trainStatus.is_trained ? 'text-green-400' : 'text-amber-400'}`}>
                    {trainStatus.is_trained ? 'Trained' : trainStatus.trainer_initialized ? 'Initialized' : 'Not Loaded'}
                  </div>
                </div>
                <div className="bg-omega-800/30 rounded-lg p-3">
                  <div className="text-omega-500 text-xs mb-1">Best Accuracy</div>
                  <div className="text-white font-bold font-mono">
                    {trainStatus.best_accuracy > 0 ? `${(trainStatus.best_accuracy * 100).toFixed(1)}%` : '—'}
                  </div>
                </div>
                <div className="bg-omega-800/30 rounded-lg p-3">
                  <div className="text-omega-500 text-xs mb-1">Examples</div>
                  <div className="text-white font-bold font-mono">{trainStatus.training_examples.toLocaleString()}</div>
                </div>
                <div className="bg-omega-800/30 rounded-lg p-3">
                  <div className="text-omega-500 text-xs mb-1">Epochs</div>
                  <div className="text-white font-bold font-mono">{trainStatus.total_epochs}</div>
                </div>
              </div>
              {trainStatus.is_trained && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/5 border border-green-500/20">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-green-400 text-sm">Llama bridge {trainStatus.llama_available ? 'active' : 'unavailable'}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-omega-500 text-sm">Loading training status...</div>
          )}
        </div>

        {/* Ambition State */}
        <div className="bg-omega-900/50 rounded-xl border border-omega-800/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-omega-400" />
            Ambition State
          </h3>
          {ambition ? (
            <div className="space-y-3">
              <AmbitionBar label="Dopamine" value={ambition.dopamine} color="green" />
              <AmbitionBar label="Entropy" value={ambition.entropy} color="red" />
              <AmbitionBar label="Curiosity" value={ambition.curiosity} color="purple" />
              <AmbitionBar label="Arousal" value={ambition.arousal} color="orange" />
              <div className="flex items-center gap-4 pt-2 text-xs text-omega-500">
                <span>Dreams: {ambition.total_dreams}</span>
                <span>Rewards: {ambition.total_rewards}</span>
                <span>Idle: {ambition.consecutive_idle_ticks} ticks</span>
              </div>
            </div>
          ) : (
            <div className="text-omega-500 text-sm">Brain not booted</div>
          )}
        </div>
      </div>

      {/* McDonald's Live Menu */}
      <div className="bg-omega-900/50 rounded-xl border border-omega-800/50">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-full flex items-center justify-between p-6 hover:bg-omega-800/20 transition-colors rounded-xl"
        >
          <span className="text-lg font-semibold text-white flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-amber-400" />
            McDonald&apos;s Live Menu
            {mcMenu && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-mono">
                {mcMenu.total_items} items • {mcMenu.source === 'mcdonalds_api' ? 'LIVE' : 'LOCAL'}
              </span>
            )}
          </span>
          {menuOpen ? <ChevronUp className="w-5 h-5 text-omega-400" /> : <ChevronDown className="w-5 h-5 text-omega-400" />}
        </button>

        {menuOpen && (
          <div className="px-6 pb-6">
            {menuLoading ? (
              <div className="flex items-center gap-2 text-omega-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Fetching menu...
              </div>
            ) : mcMenu ? (
              <div className="space-y-4">
                {mcMenu.categories.map((cat) => (
                  <div key={cat.name}>
                    <h4 className="text-sm font-semibold text-omega-300 mb-2">{cat.name}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {cat.items.slice(0, 6).map((item) => (
                        <div key={item.id} className="flex items-center justify-between px-3 py-2 bg-omega-800/30 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white truncate">{item.name}</div>
                            <div className="text-xs text-omega-500">{item.calories} cal</div>
                          </div>
                          <div className="text-amber-400 font-mono text-sm font-bold ml-2">
                            ${item.price.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                    {cat.items.length > 6 && (
                      <div className="text-xs text-omega-600 mt-1">+{cat.items.length - 6} more items</div>
                    )}
                  </div>
                ))}
                <div className="text-xs text-omega-600 pt-2 border-t border-omega-800/50">
                  Last fetched: {mcMenu.timestamp} • Source: {mcMenu.source}
                </div>
              </div>
            ) : (
              <div className="text-omega-500 text-sm">Failed to load menu data</div>
            )}
          </div>
        )}
      </div>

      {/* Nearby Stores */}
      <div className="bg-omega-900/50 rounded-xl border border-omega-800/50">
        <button
          onClick={() => setStoresOpen(!storesOpen)}
          className="w-full flex items-center justify-between p-6 hover:bg-omega-800/20 transition-colors rounded-xl"
        >
          <span className="text-lg font-semibold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-red-400" />
            Nearby McDonald&apos;s Stores
            {mcStores && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs font-mono">
                {mcStores.count} found
              </span>
            )}
          </span>
          {storesOpen ? <ChevronUp className="w-5 h-5 text-omega-400" /> : <ChevronDown className="w-5 h-5 text-omega-400" />}
        </button>

        {storesOpen && (
          <div className="px-6 pb-6">
            {storesLoading ? (
              <div className="flex items-center gap-2 text-omega-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Finding nearby stores...
              </div>
            ) : mcStores?.stores?.length ? (
              <div className="space-y-2">
                {mcStores.stores.slice(0, 10).map((store) => (
                  <div key={store.id} className="flex items-center gap-4 px-4 py-3 bg-omega-800/30 rounded-lg">
                    <MapPin className="w-4 h-4 text-red-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white">{store.name || `McDonald's #${store.id}`}</div>
                      <div className="text-xs text-omega-500 truncate">{store.address}</div>
                    </div>
                    <div className="flex items-center gap-3 text-xs shrink-0">
                      {store.drive_thru && (
                        <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400">Drive-Thru</span>
                      )}
                      {store.open_24h && (
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">24h</span>
                      )}
                      <span className="text-omega-400 font-mono">{store.distance_miles.toFixed(1)} mi</span>
                    </div>
                  </div>
                ))}
                <div className="text-xs text-omega-600 pt-2">
                  Source: {mcStores.source} • Query: {mcStores.query.lat}, {mcStores.query.lng}
                </div>
              </div>
            ) : (
              <div className="text-omega-500 text-sm">No stores found</div>
            )}
          </div>
        )}
      </div>

      {/* System Status */}
      <div className="bg-omega-900/50 rounded-xl border border-omega-800/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">System Connectivity</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatusRow label="OMEGA Server" status={connected ? 'online' : 'offline'} />
          <StatusRow label="Llama Bridge" status={trainStatus?.llama_available ? 'online' : 'offline'} />
          <StatusRow label="McDonald's API" status={mcMenu?.source === 'mcdonalds_api' ? 'online' : mcMenu ? 'degraded' : 'offline'} />
          <StatusRow label="Store Locator" status={mcStores?.success ? 'online' : 'offline'} />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: 'omega' | 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'emerald';
  icon: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    omega: 'border-omega-500/20 bg-omega-500/5',
    green: 'border-green-500/20 bg-green-500/5',
    amber: 'border-amber-500/20 bg-amber-500/5',
    red: 'border-red-500/20 bg-red-500/5',
    blue: 'border-blue-500/20 bg-blue-500/5',
    purple: 'border-purple-500/20 bg-purple-500/5',
    emerald: 'border-emerald-500/20 bg-emerald-500/5',
  };

  return (
    <div className={`p-4 rounded-xl border ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-omega-500">{icon}</span>
        <span className="text-xs text-omega-500">{label}</span>
      </div>
      <div className="text-lg font-bold text-white font-mono">{value}</div>
    </div>
  );
}

function AmbitionBar({ label, value, color }: { label: string; value: number; color: 'green' | 'red' | 'purple' | 'orange' }) {
  const colorClasses = { green: 'bg-green-500', red: 'bg-red-500', purple: 'bg-purple-500', orange: 'bg-orange-500' };
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-omega-400">{label}</span>
        <span className="text-white font-mono text-xs">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-omega-800 rounded-full overflow-hidden">
        <div className={`h-full ${colorClasses[color]} transition-all duration-300`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

function StatusRow({ label, status }: { label: string; status: 'online' | 'offline' | 'degraded' }) {
  const statusColors = { online: 'bg-green-500', offline: 'bg-red-500', degraded: 'bg-yellow-500' };
  const statusText = { online: 'text-green-400', offline: 'text-red-400', degraded: 'text-yellow-400' };
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-omega-800/20 rounded-lg">
      <span className="text-omega-300 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
        <span className={`text-xs capitalize ${statusText[status]}`}>{status}</span>
      </div>
    </div>
  );
}
