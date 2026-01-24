'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Brain,
  CheckCircle2,
  Clock,
  FolderTree,
  Home,
  Menu,
  Network,
  PenTool,
  Settings,
  Upload,
  X,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Ingest Documents', href: '/dashboard/ingest', icon: Upload },
  { name: 'Verify Knowledge', href: '/dashboard/verify', icon: CheckCircle2 },
  { name: 'Knowledge Graph', href: '/dashboard/graph', icon: Network },
  { name: 'Domain Taxonomy', href: '/dashboard/domains', icon: FolderTree },
  { name: 'Overrides', href: '/dashboard/overrides', icon: PenTool },
  { name: 'Conflict Queue', href: '/dashboard/conflicts', icon: AlertTriangle },
  { name: 'History', href: '/dashboard/history', icon: Clock },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform bg-slate-900/80 backdrop-blur-xl border-r border-white/10 transition-transform duration-200 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-curator-gold/10">
            <BookOpen className="h-6 w-6 text-curator-gold" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">RADIANT</h1>
            <p className="text-xs text-muted-foreground">Curator</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-curator-gold/10 text-curator-gold font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-4">
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
            <Brain className="h-8 w-8 text-curator-gold" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Knowledge Nodes</p>
              <p className="text-lg font-semibold">1,247</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-white/10 bg-slate-900/60 backdrop-blur-xl px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <div className="flex-1" />

          <Link
            href="/dashboard/settings"
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-accent"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 bg-white/[0.02]">{children}</main>
      </div>
    </div>
  );
}
