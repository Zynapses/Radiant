'use client';

import { useQuery } from '@tanstack/react-query';
import { Globe, Loader2, Users, Activity, Database } from 'lucide-react';

export default function GlobalBrainPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['forge', 'global-brain', 'federated'],
    queryFn: async () => {
      const res = await fetch('/api/global-brain/federated');
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Globe className="h-6 w-6 text-amber-400" />
          Global Brain
        </h1>
        <p className="text-zinc-400 mt-1">Federated learning, gradient aggregation, and base cartridge generation</p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center gap-2 text-zinc-400 mb-2"><Users className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-wide">Enrollment</span></div>
              <div className="text-2xl font-bold text-white">{data?.enrollment?.enrolled || 0} / {data?.enrollment?.total || 0}</div>
              <div className="text-xs text-zinc-500 mt-1">Avg quality: {data?.enrollment?.avg_quality != null ? `${(Number(data.enrollment.avg_quality) * 100).toFixed(0)}%` : '—'}</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center gap-2 text-zinc-400 mb-2"><Activity className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-wide">Rounds</span></div>
              <div className="text-2xl font-bold text-white">{data?.rounds?.length || 0}</div>
              <div className="text-xs text-zinc-500 mt-1">{data?.rounds?.filter((r: any) => r.status === 'completed').length || 0} completed</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center gap-2 text-zinc-400 mb-2"><Database className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-wide">Pipelines</span></div>
              <div className="text-2xl font-bold text-white">{data?.pipelines?.length || 0}</div>
              <div className="text-xs text-zinc-500 mt-1">{data?.pipelines?.filter((p: any) => p.status === 'completed').length || 0} completed</div>
            </div>
          </div>

          {data?.rounds?.length > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="text-lg font-semibold text-white mb-4">Recent Rounds</h2>
              <div className="space-y-2">
                {data.rounds.slice(0, 10).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0 text-sm">
                    <span className="text-white font-medium">Round #{r.round_number}</span>
                    <span className="font-mono text-xs text-zinc-500">{r.round_type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'completed' ? 'bg-green-900 text-green-200' : r.status === 'collecting' ? 'bg-blue-900 text-blue-200' : 'bg-zinc-700 text-zinc-300'}`}>{r.status}</span>
                    <span className="text-zinc-500 text-xs">{r.actual_participants}/{r.target_participants} participants</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
