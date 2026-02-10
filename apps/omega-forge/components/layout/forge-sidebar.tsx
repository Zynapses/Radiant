'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, PenTool, Brain, Bot,
  Store, Target, Globe, Key, FileText, Shield,
  Activity, Database, Beaker, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavChild {
  title: string;
  href: string;
}

interface NavItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  children?: NavChild[];
}

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/', icon: LayoutDashboard },
  {
    title: 'Cartridges',
    icon: Package,
    children: [
      { title: 'All Cartridges', href: '/cartridges' },
      { title: 'Create New', href: '/cartridges/create' },
    ],
  },
  {
    title: 'Author',
    icon: PenTool,
    children: [
      { title: 'Workspace', href: '/author' },
      { title: 'Firmware Editor', href: '/author/firmware' },
      { title: 'Personality Editor', href: '/author/personality' },
      { title: 'Ambition Profiles', href: '/author/ambition' },
      { title: 'Q-Node Weights', href: '/author/qnodes' },
      { title: 'Knowledge Base', href: '/author/knowledge' },
      { title: 'Test Suites', href: '/author/tests' },
    ],
  },
  {
    title: 'OMEGA Brains',
    icon: Brain,
    children: [
      { title: 'All Brains', href: '/brains' },
      { title: 'Global Brain', href: '/brains/global' },
    ],
  },
  {
    title: 'CATO Instances',
    icon: Bot,
    children: [
      { title: 'All Instances', href: '/cato' },
    ],
  },
  {
    title: 'Global Brain',
    icon: Globe,
    children: [
      { title: 'Overview', href: '/global-brain' },
      { title: 'Gradient Monitor', href: '/global-brain/gradients' },
      { title: 'Federated Averaging', href: '/global-brain/federated' },
      { title: 'Cartridge Pipeline', href: '/global-brain/cartridge-pipeline' },
    ],
  },
  {
    title: 'Marketplace',
    icon: Store,
    children: [
      { title: 'Published', href: '/marketplace' },
      { title: 'Publish New', href: '/marketplace/publish' },
      { title: 'Review Queue', href: '/marketplace/reviews' },
    ],
  },
  {
    title: 'Targets',
    icon: Target,
    children: [
      { title: 'Registry', href: '/targets' },
      { title: 'Register New', href: '/targets/create' },
    ],
  },
  { title: 'Signing & PKI', href: '/signing', icon: Key },
  { title: 'System Audit', href: '/audit', icon: FileText },
];

export function ForgeSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-72 flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-200">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-zinc-800 px-6">
        <Shield className="h-7 w-7 text-amber-500" />
        <div>
          <div className="font-bold text-white">OMEGA Forge</div>
          <div className="text-xs text-zinc-500">System Admin</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navItems.map((item) => (
          <div key={item.title}>
            {item.href && !item.children ? (
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  pathname === item.href
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            ) : (
              <>
                <div className="flex items-center gap-3 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 mt-3">
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </div>
                {item.children?.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      'flex items-center rounded-lg px-3 py-1.5 pl-10 text-sm transition-colors',
                      pathname === child.href
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    )}
                  >
                    {child.title}
                  </Link>
                ))}
              </>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-800 p-4">
        <div className="text-xs text-zinc-500">
          RADIANT Platform &bull; Behind Firewall
        </div>
      </div>
    </aside>
  );
}
