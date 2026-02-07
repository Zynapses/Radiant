'use client';

import { useRequireAuth } from '@/lib/auth/hooks';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { CriticalAlertBanner } from '@/components/layout/critical-alert-banner';
import AdminAIHelper from '@/components/admin-ai-helper';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, isAuthenticated } = useRequireAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <CriticalAlertBanner />
        <main className="flex-1 overflow-y-auto bg-white/[0.02] backdrop-blur-sm p-6">
          {children}
        </main>
      </div>
      <AdminAIHelper />
    </div>
  );
}
