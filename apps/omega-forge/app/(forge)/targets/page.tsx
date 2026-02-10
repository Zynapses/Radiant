'use client';

import { useQuery } from '@tanstack/react-query';
import { Target, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';

export default function TargetsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['forge', 'targets'],
    queryFn: async () => {
      const res = await fetch('/api/targets');
      if (!res.ok) throw new Error('Failed to load targets');
      return res.json();
    },
  });

  const targets = data?.targets || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target className="h-6 w-6 text-cyan-400" />
            Target Service Registry
          </h1>
          <p className="text-zinc-400 mt-1">Pluggable target services for cartridge delivery</p>
        </div>
        <Link href="/targets/create" className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 transition-colors">
          <Plus className="h-4 w-4" /> Register Target
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading targets...</div>
      ) : targets.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">No target services registered</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {targets.map((t: any) => (
            <div key={t.id || t.service_key} className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white">{t.display_name || t.service_key}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${t.is_active ? 'bg-green-900 text-green-200' : 'bg-zinc-700 text-zinc-300'}`}>
                  {t.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="text-xs font-mono text-zinc-500 mb-2">{t.service_key}</div>
              {t.description && <div className="text-sm text-zinc-400">{t.description}</div>}
              <div className="text-xs text-zinc-600 mt-2">{t.spec_count || 0} section specs</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
