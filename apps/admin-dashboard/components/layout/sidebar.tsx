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
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Models', href: '/models', icon: Cpu },
  { name: 'Providers', href: '/providers', icon: Globe },
  { name: 'Orchestration', href: '/orchestration', icon: Brain },
  { name: 'Administrators', href: '/administrators', icon: Users },
  { name: 'Billing', href: '/billing', icon: CreditCard },
  { name: 'Storage', href: '/storage', icon: HardDrive },
  { name: 'Localization', href: '/localization', icon: Languages },
  { name: 'Configuration', href: '/configuration', icon: Sliders },
  { name: 'Migrations', href: '/migrations', icon: GitPullRequest },
  { name: 'Audit Logs', href: '/audit-logs', icon: FileText },
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

      <nav className="flex-1 space-y-1 p-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-radiant-100 text-radiant-700 dark:bg-radiant-900 dark:text-radiant-300'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.name}</span>}
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
