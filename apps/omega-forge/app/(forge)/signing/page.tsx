'use client';

import { useQuery } from '@tanstack/react-query';
import { Key, Loader2, Shield } from 'lucide-react';

export default function SigningPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['forge', 'signing'],
    queryFn: async () => {
      const res = await fetch('/api/signing');
      if (!res.ok) throw new Error('Failed to load signing info');
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Key className="h-6 w-6 text-yellow-400" />
          Signing & PKI
        </h1>
        <p className="text-zinc-400 mt-1">KMS signing key management and certificate inspection</p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading key info...</div>
      ) : error ? (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-red-300 text-sm">{(error as Error).message}</div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-zinc-400" />
              Cartridge Signing Key
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-zinc-500">Key ID</span>
                <div className="text-white font-mono text-xs mt-1">{data?.key?.keyId || '—'}</div>
              </div>
              <div>
                <span className="text-zinc-500">State</span>
                <div className={`mt-1 font-medium ${data?.key?.keyState === 'Enabled' ? 'text-green-400' : 'text-red-400'}`}>{data?.key?.keyState || '—'}</div>
              </div>
              <div>
                <span className="text-zinc-500">Usage</span>
                <div className="text-zinc-300 mt-1">{data?.key?.keyUsage || '—'}</div>
              </div>
              <div>
                <span className="text-zinc-500">Algorithms</span>
                <div className="text-zinc-300 mt-1">{data?.key?.signingAlgorithms?.join(', ') || '—'}</div>
              </div>
              <div>
                <span className="text-zinc-500">Created</span>
                <div className="text-zinc-300 mt-1">{data?.key?.creationDate ? new Date(data.key.creationDate).toLocaleString() : '—'}</div>
              </div>
            </div>
          </div>

          {data?.publicKeyPem && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="text-lg font-semibold text-white mb-3">Public Key PEM</h2>
              <pre className="bg-zinc-950 rounded p-4 text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">{data.publicKeyPem}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
