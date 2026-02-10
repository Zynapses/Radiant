'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Users2,
  Package,
  Layers,
  Brain,
  FileText,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Management',
    items: [
      { name: 'Users', href: '/users', icon: Users },
      { name: 'Cartridges', href: '/cartridges', icon: Package },
      { name: 'Stacking & Resolution', href: '/cartridges/stacking', icon: Layers },
      { name: 'OMEGA Brain Status', href: '/cartridges/omega', icon: Brain },
    ],
  },
  {
    label: 'Insights',
    items: [
      { name: 'Reports', href: '/reports', icon: FileText },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { name: 'Security', href: '/security', icon: Shield },
      { name: 'Collaboration', href: '/collaboration', icon: Users2 },
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <aside
        className={cn(
          'flex flex-col border-r border-white/10 bg-slate-900/80 backdrop-blur-xl transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <div>
                <span className="text-sm font-bold text-white">Think Tank</span>
                <p className="text-[10px] text-slate-400">Tenant Administration</p>
              </div>
            </Link>
          )}
          {collapsed && (
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mx-auto">
              <Zap className="h-4 w-4 text-white" />
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {navigation.map((section) => (
            <div key={section.label} className="mb-4">
              {!collapsed && (
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {section.label}
                </div>
              )}
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
