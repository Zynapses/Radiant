'use client';

import { useQuery } from '@tanstack/react-query';
import { Brain, Loader2, Activity } from 'lucide-react';
import Link from 'next/link';

export default function BrainsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['forge', 'brains'],
    queryFn: async () => {
      const res = await fetch('/api/brains');
      if (!res.ok) throw new Error('Failed to load brains');
      return res.json();
    },
  });

  const brains = data?.brains || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Brain className="h-6 w-6 text-purple-400" />
          OMEGA Brains
        </h1>
        <p className="text-zinc-400 mt-1">All OMEGA brain instances across tenants</p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading brains...</div>
      ) : brains.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">No brain instances found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brains.map((b: any) => (
            <Link key={b.tenant_id} href={`/brains/${b.tenant_id}`} className="block rounded-lg border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-700 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <Brain className="h-5 w-5 text-purple-400" />
                <span className="font-semibold text-white">{b.tenant_name || 'Unknown Tenant'}</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Status</span>
                  <span className={`font-medium ${b.brain_status === 'healthy' ? 'text-green-400' : 'text-zinc-400'}`}>
                    {b.brain_status || 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Boot</span>
                  <span className="text-zinc-300 font-mono text-xs">{b.boot_status || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Last Dream</span>
                  <span className="text-zinc-300 text-xs">{b.last_dream_at ? new Date(b.last_dream_at).toLocaleDateString() : 'Never'}</span>
                </div>
              </div>
              <div className="mt-3 text-xs text-zinc-600 font-mono truncate">{b.tenant_id}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
