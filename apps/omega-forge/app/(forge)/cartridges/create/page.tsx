'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Package, Loader2, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Row } from '@/lib/types';

export default function CreateCartridgePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    display_name: '',
    version: '1.0.0',
    cartridge_type: 'base',
    description: '',
    targets: [] as string[],
  });

  const { data: targetsData } = useQuery({
    queryKey: ['forge', 'targets'],
    queryFn: async () => {
      const res = await fetch('/api/targets');
      if (!res.ok) throw new Error('Failed to load targets');
      return res.json();
    },
  });

  const buildMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/cartridges/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          author: { name: 'OMEGA Forge', org_id: 'radiant-platform' },
          sections: {},
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Build failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      router.push(`/cartridges/${data.cartridge_id}`);
    },
  });

  const targets = targetsData?.targets || [];

  function toggleTarget(key: string) {
    setForm(prev => ({
      ...prev,
      targets: prev.targets.includes(key)
        ? prev.targets.filter(t => t !== key)
        : [...prev.targets, key],
    }));
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Package className="h-6 w-6 text-amber-500" />
          Create Cartridge
        </h1>
        <p className="text-zinc-400 mt-1">Build a new .RADz cartridge from authored sections</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Name (slug)</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="my-cartridge"
            className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Display Name</label>
          <input
            type="text"
            value={form.display_name}
            onChange={(e) => setForm(prev => ({ ...prev, display_name: e.target.value }))}
            placeholder="My Cartridge"
            className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Version</label>
            <input
              type="text"
              value={form.version}
              onChange={(e) => setForm(prev => ({ ...prev, version: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Type</label>
            <select
              value={form.cartridge_type}
              onChange={(e) => setForm(prev => ({ ...prev, cartridge_type: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="base">Base</option>
              <option value="domain">Domain</option>
              <option value="personality">Personality</option>
              <option value="firmware">Firmware</option>
              <option value="soft_rom">Soft ROM</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Target Services</label>
          <div className="grid grid-cols-2 gap-2">
            {targets.map((t: Row) => (
              <button
                key={t.service_key}
                onClick={() => toggleTarget(t.service_key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                  form.targets.includes(t.service_key)
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                {form.targets.includes(t.service_key) && <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />}
                <div>
                  <div className="font-medium">{t.display_name || t.service_key}</div>
                  <div className="text-xs text-zinc-500">{t.service_key}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {buildMutation.isError && (
          <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-300">
            {(buildMutation.error as Error).message}
          </div>
        )}

        <button
          onClick={() => buildMutation.mutate()}
          disabled={!form.name || !form.display_name || form.targets.length === 0 || buildMutation.isPending}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {buildMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Building...</>
          ) : (
            <><Package className="h-4 w-4" /> Build .RADz Cartridge</>
          )}
        </button>
      </div>
    </div>
  );
}
