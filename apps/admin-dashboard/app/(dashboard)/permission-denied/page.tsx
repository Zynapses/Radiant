'use client';

import { useSearchParams } from 'next/navigation';
import { ShieldX, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PermissionDeniedPage() {
  const searchParams = useSearchParams();
  const path = searchParams.get('path') || '';

  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 bg-red-600/10 border border-red-500/20 rounded-full flex items-center justify-center mb-6">
          <ShieldX className="h-8 w-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-slate-400 mb-2">
          You don&apos;t have permission to access this area.
        </p>
        {path && (
          <p className="text-slate-500 text-sm mb-6">
            Requested: <code className="text-slate-400 bg-slate-800 px-2 py-0.5 rounded">{path}</code>
          </p>
        )}
        <p className="text-slate-500 text-xs mb-6">
          Contact your system administrator (super_admin) to request elevated access.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
