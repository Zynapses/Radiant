'use client';

import { useQuery } from '@tanstack/react-query';
import { Bot, Loader2 } from 'lucide-react';

export default function CatoPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['forge', 'cato'],
    queryFn: async () => {
      const res = await fetch('/api/cato');
      if (!res.ok) throw new Error('Failed to load CATO instances');
      return res.json();
    },
  });

  const instances = data?.instances || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Bot className="h-6 w-6 text-green-400" />
          CATO Instances
        </h1>
        <p className="text-zinc-400 mt-1">All CATO personality instances across tenants</p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading CATO instances...</div>
      ) : instances.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">No CATO instances found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map((inst: any) => (
            <div key={inst.tenant_id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center gap-3 mb-3">
                <Bot className="h-5 w-5 text-green-400" />
                <span className="font-semibold text-white">{inst.tenant_name || 'Unknown'}</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Evolved Patterns</span>
                  <span className="text-zinc-300">{inst.pattern_count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Config Entries</span>
                  <span className="text-zinc-300">{inst.config_count || 0}</span>
                </div>
              </div>
              <div className="mt-3 text-xs text-zinc-600 font-mono truncate">{inst.tenant_id}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
