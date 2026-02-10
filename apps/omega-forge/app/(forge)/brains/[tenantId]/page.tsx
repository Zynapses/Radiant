'use client';

import { useQuery } from '@tanstack/react-query';
import { Brain, Package, Loader2, HardDrive, Clock } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatBytes } from '@/lib/utils';
import type { Row } from '@/lib/types';

export default function BrainDetailPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  const { data, isLoading } = useQuery({
    queryKey: ['forge', 'brain', tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/brains/${tenantId}`);
      if (!res.ok) throw new Error('Failed to load brain');
      return res.json();
    },
  });

  if (isLoading) return <div className="flex items-center gap-2 text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading brain state...</div>;

  const { tenant, cartridges, dreams, soft_rom } = data || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Brain className="h-6 w-6 text-purple-400" />
          {tenant?.name || 'Brain Detail'}
        </h1>
        <p className="text-zinc-500 font-mono text-sm mt-1">{tenantId}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Soft ROM */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center gap-2 text-zinc-400 mb-3">
            <HardDrive className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Soft ROM</span>
          </div>
          <div className="text-2xl font-bold text-white">{soft_rom?.files?.length || 0} files</div>
          <div className="text-xs text-zinc-500 mt-1">{formatBytes(soft_rom?.total_size || 0)}</div>
          <Link
            href={`/brains/${tenantId}/soft-rom`}
            className="inline-block mt-3 text-xs text-amber-400 hover:text-amber-300"
          >
            View & Export →
          </Link>
        </div>

        {/* Installed Cartridges */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center gap-2 text-zinc-400 mb-3">
            <Package className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Cartridges</span>
          </div>
          <div className="text-2xl font-bold text-white">{cartridges?.length || 0}</div>
          <div className="text-xs text-zinc-500 mt-1">installed</div>
        </div>

        {/* Dream History */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center gap-2 text-zinc-400 mb-3">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Dreams</span>
          </div>
          <div className="text-2xl font-bold text-white">{dreams?.length || 0}</div>
          <div className="text-xs text-zinc-500 mt-1">recent cycles</div>
        </div>
      </div>

      {/* Installed Cartridges Table */}
      {cartridges && cartridges.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Installed Cartridges</h2>
          <div className="space-y-2">
            {cartridges.map((c: Row) => (
              <div key={c.cartridge_id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                <div>
                  <span className="text-white font-medium">{c.display_name || c.name}</span>
                  <span className="text-zinc-500 text-xs ml-2">v{c.version}</span>
                </div>
                <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">Priority: {c.priority}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dream History Table */}
      {dreams && dreams.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Dream Cycle History</h2>
          <div className="space-y-2">
            {dreams.map((d: Row) => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0 text-sm">
                <span className={`font-medium ${d.status === 'completed' ? 'text-green-400' : d.status === 'failed' ? 'text-red-400' : 'text-zinc-300'}`}>
                  {d.status}
                </span>
                <span className="text-zinc-500">{d.duration_ms ? `${(d.duration_ms / 1000).toFixed(1)}s` : '—'}</span>
                <span className="text-zinc-500 text-xs">{d.started_at ? new Date(d.started_at).toLocaleString() : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
