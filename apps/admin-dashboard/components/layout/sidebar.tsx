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
  ScrollText,
  Wrench,
  Bot,
  Sparkles,
  Target,
  Compass,
  Heart,
  Activity,
  Map,
  TrendingUp,
  Gauge,
  FileBarChart,
  Server,
  Clock,
  GraduationCap,
  FlaskConical,
  Lightbulb,
  Route,
  Edit3,
  ListChecks,
  Smile,
  Lock,
  UsersRound,
  AlertTriangle,
  Star,
  GlobeIcon,
  Rocket,
  Thermometer,
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
  { name: 'Health', href: '/health', icon: Activity },
  
  // AI & Models Section
  { type: 'separator', label: 'AI & Models' },
  { name: 'Models', href: '/models', icon: Cpu },
  { name: 'Inference Components', href: '/inference-components', icon: Thermometer },
  { name: 'Model Pricing', href: '/models/pricing', icon: DollarSign },
  { name: 'Model Metadata', href: '/model-metadata', icon: FileText },
  { name: 'Specialty Rankings', href: '/specialty-rankings', icon: Star },
  { name: 'User Models', href: '/user-models', icon: UserCircle },
  { name: 'Providers', href: '/providers', icon: Globe },
  { name: 'Rate Limits', href: '/rate-limits', icon: Gauge },
  
  // Orchestration Section
  { type: 'separator', label: 'Orchestration' },
  { name: 'Orchestration', href: '/orchestration', icon: Brain },
  { name: 'Workflows', href: '/orchestration/workflows', icon: Workflow },
  { name: 'Pre-Prompts', href: '/orchestration/preprompts', icon: ListChecks },
  { name: 'Methods', href: '/orchestration/methods', icon: Route },
  { name: 'Editor', href: '/orchestration/editor', icon: Edit3 },
  { name: 'AGI Dashboard', href: '/orchestration/agi-dashboard', icon: Sparkles },
  { name: 'Patterns', href: '/orchestration-patterns', icon: Layers },
  { name: 'Pattern Editor', href: '/orchestration-patterns/editor', icon: Edit3 },
  
  // System Section
  { type: 'separator', label: 'System' },
  { name: 'Infrastructure Tier', href: '/system/infrastructure', icon: Server },
  
  // AGI & Cognition Section
  { type: 'separator', label: 'AGI & Cognition' },
  { name: 'Brain v6', href: '/brain', icon: Brain },
  { name: 'Brain Config', href: '/brain/config', icon: Settings },
  { name: 'Brain Cognition', href: '/brain/cognition', icon: Lightbulb },
  { name: 'Brain Dreams', href: '/brain/dreams', icon: Sparkles },
  { name: 'Brain Ghost', href: '/brain/ghost', icon: Activity },
  { name: 'Brain Oversight', href: '/brain/oversight', icon: Shield },
  { name: 'Brain SoFAI', href: '/brain/sofai', icon: Heart },
  { name: 'Brain ECD', href: '/brain/ecd', icon: Shield },
  { name: 'Cognitive Brain', href: '/cognitive-brain', icon: Brain },
  { name: 'Cognition', href: '/cognition', icon: Lightbulb },
  { name: 'Consciousness', href: '/consciousness', icon: Sparkles },
  { name: 'Bobble', href: '/consciousness/bobble', icon: Heart },
  { name: 'Bobble Global', href: '/consciousness/bobble/global', icon: GlobeIcon },
  { name: 'Bobble Genesis', href: '/bobble/genesis', icon: Rocket },
  { name: 'Cato Safety', href: '/cato', icon: ShieldCheck },
  { name: 'Cato Personas', href: '/cato/personas', icon: UserCircle },
  { name: 'Cato Recovery', href: '/cato/recovery', icon: Activity },
  { name: 'Cato Audit', href: '/cato/audit', icon: FileText },
  { name: 'Cato Advanced', href: '/cato/advanced', icon: Settings },
  { name: 'Engine', href: '/consciousness/engine', icon: Cpu },
  { name: 'Evolution', href: '/consciousness/evolution', icon: TrendingUp },
  { name: 'Formal Reasoning', href: '/consciousness/formal-reasoning', icon: Route },
  { name: 'Sleep Schedule', href: '/consciousness/sleep-schedule', icon: Clock },
  { name: 'Metacognition', href: '/metacognition', icon: Target },
  { name: 'World Model', href: '/world-model', icon: GlobeIcon },
  { name: 'Planning', href: '/planning', icon: ListChecks },
  { name: 'Agents', href: '/agents', icon: Bot },
  { name: 'Self-Improvement', href: '/self-improvement', icon: TrendingUp },
  { name: 'Request Handler', href: '/request-handler', icon: Zap },
  
  // Learning Section
  { type: 'separator', label: 'Learning' },
  { name: 'AGI Learning', href: '/agi-learning', icon: GraduationCap },
  { name: 'Learning', href: '/learning', icon: Lightbulb },
  { name: 'ML Training', href: '/ml-training', icon: FlaskConical },
  { name: 'Feedback', href: '/feedback', icon: MessageSquare },
  
  // Ethics Section
  { type: 'separator', label: 'Ethics' },
  { name: 'Ethics', href: '/ethics', icon: Heart },
  { name: 'Moral Compass', href: '/moral-compass', icon: Compass },
  
  // Think Tank Section
  { type: 'separator', label: 'Think Tank' },
  { name: 'Users', href: '/thinktank/users', icon: UserCircle },
  { name: 'Conversations', href: '/thinktank/conversations', icon: MessageSquare },
  { name: 'My Rules', href: '/thinktank/my-rules', icon: ListChecks },
  { name: 'Delight', href: '/thinktank/delight', icon: Smile },
  { name: 'Delight Stats', href: '/thinktank/delight/statistics', icon: BarChart3 },
  { name: 'Domain Modes', href: '/thinktank/domain-modes', icon: Layers },
  { name: 'Model Categories', href: '/thinktank/model-categories', icon: Grid },
  { name: 'Shadow Testing', href: '/thinktank/shadow-testing', icon: Beaker },
  { name: 'Collaborate', href: '/thinktank/collaborate', icon: UsersRound },
  { name: 'Ego System', href: '/thinktank/ego', icon: UserCircle },
  { name: 'TT Artifacts', href: '/thinktank/artifacts', icon: Sparkles },
  { name: 'TT Compliance', href: '/thinktank/compliance', icon: ShieldCheck },
  { name: 'TT Settings', href: '/thinktank/settings', icon: Settings },
  
  // Analytics & Reports Section
  { type: 'separator', label: 'Analytics' },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Metrics', href: '/metrics', icon: Gauge },
  { name: 'Rejections', href: '/analytics/rejections', icon: AlertTriangle },
  { name: 'Reports', href: '/reports', icon: FileBarChart },
  { name: 'SaaS Metrics', href: '/saas-metrics', icon: TrendingUp },
  { name: 'Revenue', href: '/revenue', icon: DollarSign },
  { name: 'Costs', href: '/costs', icon: CreditCard },
  
  // Operations Section
  { type: 'separator', label: 'Operations' },
  { name: 'Time Machine', href: '/time-machine', icon: History },
  { name: 'Experiments', href: '/experiments', icon: Beaker },
  { name: 'QA & Testing', href: '/qa', icon: FlaskConical },
  { name: 'Deployments', href: '/deployments', icon: Rocket },
  { name: 'Services', href: '/services', icon: Server },
  { name: 'Multi-Region', href: '/multi-region', icon: Map },
  { name: 'Geographic', href: '/geographic', icon: GlobeIcon },
  
  // Security & Compliance Section
  { type: 'separator', label: 'Security' },
  { name: 'Security', href: '/security', icon: Shield },
  { name: 'Sec Alerts', href: '/security/alerts', icon: AlertTriangle },
  { name: 'Protection', href: '/security/protection', icon: ShieldCheck },
  { name: 'Schedules', href: '/security/schedules', icon: Clock },
  { name: 'Sec Advanced', href: '/security/advanced', icon: Lock },
  { name: 'Attack Defense', href: '/security/attacks', icon: Shield },
  { name: 'Sec Feedback', href: '/security/feedback', icon: MessageSquare },
  { name: 'Compliance', href: '/compliance', icon: ShieldCheck },
  { name: 'Checklists', href: '/compliance/checklists', icon: ListChecks },
  { name: 'Self-Audit', href: '/compliance/self-audit', icon: Activity },
  { name: 'Reg Standards', href: '/compliance/regulatory-standards', icon: FileBarChart },
  { name: 'Tenants', href: '/tenants', icon: Users },
  { name: 'Administrators', href: '/administrators', icon: Users },
  { name: 'Audit Logs', href: '/audit-logs', icon: FileText },
  { name: 'AWS Logs', href: '/aws-logs', icon: ScrollText },
  
  // Billing & Storage Section
  { type: 'separator', label: 'Billing' },
  { name: 'Billing', href: '/billing', icon: CreditCard },
  { name: 'Storage', href: '/storage', icon: HardDrive },
  
  // Settings Section
  { type: 'separator', label: 'Settings' },
  { name: 'Cognitive Arch', href: '/settings/cognitive', icon: Brain },
  { name: 'Intelligence', href: '/settings/intelligence', icon: Zap },
  { name: 'Storage Tiers', href: '/settings/storage', icon: HardDrive },
  { name: 'Ethics Config', href: '/settings/ethics', icon: Lock },
  { name: 'System Config', href: '/system-config', icon: Wrench },
  { name: 'Localization', href: '/localization', icon: Languages },
  { name: 'Translations', href: '/localization/translations', icon: FileText },
  { name: 'Configuration', href: '/configuration', icon: Sliders },
  { name: 'System Settings', href: '/configuration/system', icon: Wrench },
  { name: 'Platform Libraries', href: '/platform/libraries', icon: Layers },
  { name: 'Platform Learning', href: '/platform/learning', icon: GraduationCap },
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
