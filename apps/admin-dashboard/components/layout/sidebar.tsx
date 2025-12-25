'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Cpu,
  Globe,
  Users,
  CreditCard,
  Settings,
  Shield,
  FileText,
  Bell,
  ChevronLeft,
  ChevronRight,
  Languages,
  Sliders,
  HardDrive,
  GitPullRequest,
  Brain,
  Zap,
  BarChart3,
  DollarSign,
  MessageSquare,
  Layers,
  Grid,
  UserCircle,
  History,
  Beaker,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  type?: 'link';
}

interface NavSeparator {
  type: 'separator';
  label: string;
}

type NavigationItem = NavItem | NavSeparator;

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  
  // AI & Models Section
  { type: 'separator', label: 'AI & Models' },
  { name: 'Models', href: '/models', icon: Cpu },
  { name: 'Model Pricing', href: '/models/pricing', icon: DollarSign },
  { name: 'Providers', href: '/providers', icon: Globe },
  { name: 'Orchestration', href: '/orchestration', icon: Brain },
  { name: 'Workflows', href: '/orchestration/workflows', icon: Workflow },
  
  // Think Tank Section
  { type: 'separator', label: 'Think Tank' },
  { name: 'Think Tank Users', href: '/thinktank/users', icon: UserCircle },
  { name: 'Conversations', href: '/thinktank/conversations', icon: MessageSquare },
  { name: 'Domain Modes', href: '/thinktank/domain-modes', icon: Layers },
  { name: 'Model Categories', href: '/thinktank/model-categories', icon: Grid },
  
  // Operations Section
  { type: 'separator', label: 'Operations' },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Time Machine', href: '/time-machine', icon: History },
  { name: 'Experiments', href: '/experiments', icon: Beaker },
  { name: 'Security', href: '/security', icon: Shield },
  { name: 'Compliance', href: '/compliance', icon: ShieldCheck },
  { name: 'Billing', href: '/billing', icon: CreditCard },
  { name: 'Storage', href: '/storage', icon: HardDrive },
  { name: 'Administrators', href: '/administrators', icon: Users },
  { name: 'Audit Logs', href: '/audit-logs', icon: FileText },
  
  // Settings Section
  { type: 'separator', label: 'Settings' },
  { name: 'Localization', href: '/localization', icon: Languages },
  { name: 'Configuration', href: '/configuration', icon: Sliders },
  { name: 'Migrations', href: '/migrations', icon: GitPullRequest },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Settings', href: '/settings', icon: Settings },
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
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-radiant-500" />
            <span className="text-xl font-bold">RADIANT</span>
          </Link>
        )}
        {collapsed && (
          <Shield className="h-8 w-8 text-radiant-500 mx-auto" />
        )}
      </div>

      <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
        {navigation.map((item, index) => {
          if (item.type === 'separator') {
            if (collapsed) return null;
            return (
              <div
                key={`sep-${item.label}`}
                className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-4 first:mt-0"
              >
                {item.label}
              </div>
            );
          }

          const navItem = item as NavItem;
          const isActive = pathname === navItem.href || 
            (navItem.href !== '/' && pathname.startsWith(navItem.href));
          
          return (
            <Link
              key={navItem.name}
              href={navItem.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-radiant-100 text-radiant-700 dark:bg-radiant-900 dark:text-radiant-300'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <navItem.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{navItem.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
