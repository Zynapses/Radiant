'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { AuditEntry } from '@/lib/types';

export default function AuditPage() {
  const [actionFilter, setActionFilter] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['forge', 'audit', actionFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '200' });
      if (actionFilter) params.set('action', actionFilter);
      const res = await fetch(`/api/audit?${params}`);
      if (!res.ok) throw new Error('Failed to load audit log');
      return res.json();
    },
  });

  const entries = data?.entries || [];

  const uniqueActions = [...new Set(entries.map((e: AuditEntry) => e.action))].sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="h-6 w-6 text-zinc-400" />
          System Audit Log
        </h1>
        <p className="text-zinc-400 mt-1">Full audit trail for all cartridge operations</p>
      </div>

      <div className="flex gap-3">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
        >
          <option value="">All Actions</option>
          {uniqueActions.map((a) => (
            <option key={a as string} value={a as string}>{a as string}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading audit log...</div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">No audit entries found</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="text-left py-3 px-4 text-xs font-medium text-zinc-400 uppercase">Action</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-zinc-400 uppercase">Cartridge</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-zinc-400 uppercase">Actor</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-zinc-400 uppercase">Tenant</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-zinc-400 uppercase">Time</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e: AuditEntry, i: number) => (
                <tr key={e.id || i} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-900/80 transition-colors">
                  <td className="py-3 px-4">
                    <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded font-mono">{e.action}</span>
                  </td>
                  <td className="py-3 px-4">
                    {e.cartridge_name ? (
                      <div>
                        <span className="text-amber-400">{e.cartridge_name}</span>
                        <span className="text-zinc-500 text-xs ml-1">v{e.cartridge_version}</span>
                      </div>
                    ) : (
                      <span className="text-zinc-600 font-mono text-xs">{e.cartridge_id?.slice(0, 8) || '—'}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-zinc-400 text-xs">{e.actor_id || '—'}</td>
                  <td className="py-3 px-4 text-zinc-500 font-mono text-xs">{e.tenant_id?.slice(0, 8) || 'system'}</td>
                  <td className="py-3 px-4 text-zinc-500 text-xs">{e.created_at ? new Date(e.created_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
