'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  ListChecks,
  Smile,
  BarChart3,
  Layers,
  Grid,
  Beaker,
  UserCircle,
  UsersRound,
  ShieldCheck,
  Settings,
  Zap,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Compass,
  GitBranch,
  Shapes,
  Network,
  Bot,
  AppWindow,
  Eye,
  Wand2,
  ClipboardCheck,
  Gauge,
  Swords,
  Shield,
  FileText,
} from 'lucide-react';
import { useState } from 'react';

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
    label: 'Users & Content',
    items: [
      { name: 'Users', href: '/users', icon: Users },
      { name: 'Conversations', href: '/conversations', icon: MessageSquare },
      { name: 'My Rules', href: '/my-rules', icon: ListChecks },
    ],
  },
  {
    label: 'Experience',
    items: [
      { name: 'Delight', href: '/delight', icon: Smile },
      { name: 'Delight Stats', href: '/delight/statistics', icon: BarChart3 },
      { name: 'Domain Modes', href: '/domain-modes', icon: Layers },
      { name: 'Model Categories', href: '/model-categories', icon: Grid },
    ],
  },
  {
    label: 'Advanced',
    items: [
      { name: 'Shadow Testing', href: '/shadow-testing', icon: Beaker },
      { name: 'Ego System', href: '/ego', icon: UserCircle },
      { name: 'Collaborate', href: '/collaborate', icon: UsersRound },
      { name: 'Enhanced Collab', href: '/collaborate/enhanced', icon: Network },
      { name: 'Artifacts', href: '/artifacts', icon: Sparkles },
      { name: 'Grimoire', href: '/grimoire', icon: Layers },
      { name: 'Governor', href: '/governor', icon: Zap },
      { name: 'Workflows', href: '/workflow-templates', icon: Settings },
      { name: 'Magic Carpet', href: '/magic-carpet', icon: Compass },
      { name: 'Polymorphic', href: '/polymorphic', icon: Shapes },
      { name: 'Concurrent Exec', href: '/concurrent-execution', icon: GitBranch },
      { name: 'Structure', href: '/structure-from-chaos', icon: Network },
    ],
  },
  {
    label: 'Sovereign Mesh',
    items: [
      { name: 'Overview', href: '/sovereign-mesh', icon: Network },
      { name: 'Agents', href: '/sovereign-mesh/agents', icon: Bot },
      { name: 'Apps', href: '/sovereign-mesh/apps', icon: AppWindow },
      { name: 'Transparency', href: '/sovereign-mesh/transparency', icon: Eye },
      { name: 'AI Helper', href: '/sovereign-mesh/ai-helper', icon: Wand2 },
      { name: 'Approvals', href: '/sovereign-mesh/approvals', icon: ClipboardCheck },
      { name: 'HITL Orchestration', href: '/hitl-orchestration', icon: UsersRound },
      { name: 'Scout HITL', href: '/scout-hitl', icon: Compass },
    ],
  },
  {
    label: 'Cato Safety',
    items: [
      { name: 'Governance', href: '/cato/governance', icon: Gauge },
      { name: 'War Room', href: '/cato/war-room', icon: Swords },
      { name: 'Safety Overview', href: '/cato/safety', icon: Shield },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { name: 'Gateway Status', href: '/gateway', icon: Network },
      { name: 'Code Quality', href: '/code-quality', icon: Beaker },
    ],
  },
  {
    label: 'Administration',
    items: [
      { name: 'Compliance', href: '/compliance', icon: ShieldCheck },
      { name: 'Analytics', href: '/analytics', icon: BarChart3 },
      { name: 'Reports', href: '/reports', icon: FileText },
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold">Think Tank</span>
          </Link>
        )}
        {collapsed && (
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mx-auto">
            <Zap className="h-4 w-4 text-white" />
          </div>
        )}
      </div>

      {/* Navigation */}
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

      {/* Collapse Button */}
      <div className="border-t p-2">
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
  );
}
