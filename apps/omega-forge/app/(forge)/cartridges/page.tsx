'use client';

import { useQuery } from '@tanstack/react-query';
import { Package, Plus, Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { Row } from '@/lib/types';
import { formatBytes, formatRelativeTime } from '@/lib/utils';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    validated: 'bg-green-900 text-green-200',
    active: 'bg-blue-900 text-blue-200',
    archived: 'bg-zinc-700 text-zinc-300',
    draft: 'bg-yellow-900 text-yellow-200',
    failed: 'bg-red-900 text-red-200',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || 'bg-zinc-700 text-zinc-300'}`}>
      {status}
    </span>
  );
}

export default function CartridgesPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['forge', 'cartridges'],
    queryFn: async () => {
      const res = await fetch('/api/cartridges?limit=100');
      if (!res.ok) throw new Error('Failed to load cartridges');
      return res.json();
    },
  });

  const cartridges = data?.cartridges || [];
  const filtered = search
    ? cartridges.filter((c: Row) =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.display_name?.toLowerCase().includes(search.toLowerCase())
      )
    : cartridges;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-400" />
            All Cartridges
          </h1>
          <p className="text-zinc-400 mt-1">Platform-wide cartridge registry across all tenants</p>
        </div>
        <Link
          href="/cartridges/create"
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 transition-colors"
        >
          <Plus className="h-4 w-4" /> Create Cartridge
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Search cartridges..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading cartridges...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">
          No cartridges found
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="text-left py-3 px-4 text-xs font-medium text-zinc-400 uppercase">Name</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-zinc-400 uppercase">Version</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-zinc-400 uppercase">Type</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-zinc-400 uppercase">Targets</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-zinc-400 uppercase">Status</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-zinc-400 uppercase">Size</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-zinc-400 uppercase">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: Row) => (
                <tr key={c.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-900/80 transition-colors">
                  <td className="py-3 px-4">
                    <Link href={`/cartridges/${c.id}`} className="text-amber-400 hover:text-amber-300 font-medium">
                      {c.display_name || c.name}
                    </Link>
                    <div className="text-xs text-zinc-500 font-mono mt-0.5">{c.name}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-zinc-300">{c.version}</td>
                  <td className="py-3 px-4 text-zinc-400">{c.cartridge_type}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1 flex-wrap">
                      {(c.targets || []).map((t: string) => (
                        <span key={t} className="text-xs bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-mono">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4"><StatusBadge status={c.status} /></td>
                  <td className="py-3 px-4 text-zinc-400">{formatBytes(c.total_size_bytes || 0)}</td>
                  <td className="py-3 px-4 text-zinc-500">{c.created_at ? formatRelativeTime(c.created_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
