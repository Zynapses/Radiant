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
  Network,
  Database,
  Flame,
  Snowflake,
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
  { name: 'LoRA Adapters', href: '/lora', icon: Layers },
  { name: 'Inference Components', href: '/inference-components', icon: Thermometer },
  { name: 'Model Pricing', href: '/models/pricing', icon: DollarSign },
  { name: 'Model Metadata', href: '/model-metadata', icon: FileText },
  { name: 'Specialty Rankings', href: '/specialty-rankings', icon: Star },
  { name: 'User Models', href: '/user-models', icon: UserCircle },
  { name: 'Model Proficiency', href: '/model-proficiency', icon: Star },
  { name: 'Model Coordination', href: '/model-coordination', icon: Globe },
  { name: 'Providers', href: '/providers', icon: Globe },
  { name: 'Rate Limits', href: '/rate-limits', icon: Gauge },
  
  // Sovereign Mesh Section
  { type: 'separator', label: 'Sovereign Mesh' },
  { name: 'Mesh Dashboard', href: '/sovereign-mesh', icon: Network },
  { name: 'Agents', href: '/sovereign-mesh/agents', icon: Bot },
  { name: 'Apps', href: '/sovereign-mesh/apps', icon: Grid },
  { name: 'Transparency', href: '/sovereign-mesh/transparency', icon: Target },
  { name: 'Approvals', href: '/sovereign-mesh/approvals', icon: ListChecks },
  { name: 'AI Helper', href: '/sovereign-mesh/ai-helper', icon: Sparkles },
  { name: 'Performance', href: '/sovereign-mesh/performance', icon: Gauge },
  { name: 'Scaling', href: '/sovereign-mesh/scaling', icon: TrendingUp },
  
  // Orchestration Section
  { type: 'separator', label: 'Orchestration' },
  { name: 'Orchestration', href: '/orchestration', icon: Brain },
  { name: 'HITL Orchestration', href: '/hitl-orchestration', icon: UsersRound },
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
  
  // Memory Section
  { type: 'separator', label: 'Memory' },
  { name: 'Cortex', href: '/cortex', icon: Database },
  { name: 'Graph Explorer', href: '/cortex/graph', icon: Network },
  { name: 'Conflicts', href: '/cortex/conflicts', icon: GitPullRequest },
  { name: 'GDPR Erasure', href: '/cortex/gdpr', icon: Shield },
  
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
  { name: 'Ego System', href: '/ego', icon: Heart },
  { name: 'Empiricism', href: '/empiricism', icon: FlaskConical },
  { name: 'Cato', href: '/cato', icon: Heart },
  { name: 'Cato Global', href: '/cato', icon: GlobeIcon },
  { name: 'Cato Genesis', href: '/cato/genesis', icon: Rocket },
  { name: 'Cato Safety', href: '/cato', icon: ShieldCheck },
  { name: 'Cato Pipeline', href: '/cato/pipeline', icon: Workflow },
  { name: 'Cato Methods', href: '/cato/methods', icon: Route },
  { name: 'Cato Checkpoints', href: '/cato/checkpoints', icon: ListChecks },
  { name: 'Cato Personas', href: '/cato/personas', icon: UserCircle },
  { name: 'Cato Recovery', href: '/cato/recovery', icon: Activity },
  { name: 'Cato Audit', href: '/cato/audit', icon: FileText },
  { name: 'Cato Advanced', href: '/cato/advanced', icon: Settings },
  { name: 'Scout HITL', href: '/cato/scout-hitl', icon: Compass },
  { name: 'Engine', href: '/consciousness/engine', icon: Cpu },
  { name: 'Empiricism Loop', href: '/consciousness/empiricism', icon: Beaker },
  { name: 'Ethics-Free', href: '/consciousness/ethics-free', icon: Brain },
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
  { name: 'Enhanced Learning', href: '/enhanced-learning', icon: TrendingUp },
  { name: 'Internet Learning', href: '/internet-learning', icon: GlobeIcon },
  { name: 'ML Training', href: '/ml-training', icon: FlaskConical },
  { name: 'Feedback', href: '/feedback', icon: MessageSquare },
  
  // Ethics Section
  { type: 'separator', label: 'Ethics' },
  { name: 'Ethics', href: '/ethics', icon: Heart },
  { name: 'Moral Compass', href: '/moral-compass', icon: Compass },
  { name: 'Domain Ethics', href: '/domain-ethics', icon: Shield },
  { name: 'Ethics-Free Mode', href: '/ethics-free-reasoning', icon: AlertTriangle },
  
  // Think Tank Section - REMOVED: Think Tank is now a separate app (apps/thinktank-admin)
  // See docs/APP-ISOLATION-ARCHITECTURE.md for details
  
  // Analytics & Reports Section
  { type: 'separator', label: 'Analytics' },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Metrics', href: '/metrics', icon: Gauge },
  { name: 'Rejections', href: '/analytics/rejections', icon: AlertTriangle },
  { name: 'Reports', href: '/reports', icon: FileBarChart },
  { name: 'SaaS Metrics', href: '/saas-metrics', icon: TrendingUp },
  { name: 'Revenue', href: '/revenue', icon: DollarSign },
  { name: 'Costs', href: '/costs', icon: CreditCard },
  { name: 'AWS Costs', href: '/aws-costs', icon: DollarSign },
  
  // Operations Section
  { type: 'separator', label: 'Operations' },
  { name: 'Gateway', href: '/gateway', icon: Network },
  { name: 'Code Quality', href: '/code-quality', icon: FlaskConical },
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
  { name: 'Violations', href: '/compliance/violations', icon: AlertTriangle },
  { name: 'Checklists', href: '/compliance/checklists', icon: ListChecks },
  { name: 'Self-Audit', href: '/compliance/self-audit', icon: Activity },
  { name: 'Reg Standards', href: '/compliance/regulatory-standards', icon: FileBarChart },
  { name: 'Tenants', href: '/tenants', icon: Users },
  { name: 'Administrators', href: '/administrators', icon: Users },
  { name: 'Users', href: '/users', icon: UsersRound },
  { name: 'User Registry', href: '/user-registry', icon: FileText },
  { name: 'Invitations', href: '/invitations', icon: Bell },
  { name: 'Approvals', href: '/approvals', icon: ShieldCheck },
  { name: 'Audit Logs', href: '/audit-logs', icon: FileText },
  { name: 'AWS Logs', href: '/aws-logs', icon: ScrollText },
  
  // Billing & Storage Section
  { type: 'separator', label: 'Billing' },
  { name: 'Billing', href: '/billing', icon: CreditCard },
  { name: 'Pricing', href: '/pricing', icon: DollarSign },
  { name: 'Storage', href: '/storage', icon: HardDrive },
  
  // Settings Section
  { type: 'separator', label: 'Settings' },
  { name: 'Cognitive Arch', href: '/settings/cognitive', icon: Brain },
  { name: 'Intelligence', href: '/settings/intelligence', icon: Zap },
  { name: 'Storage Tiers', href: '/settings/storage', icon: HardDrive },
  { name: 'Ethics Config', href: '/settings/ethics', icon: Lock },
  { name: 'White-Label', href: '/settings/white-label', icon: Layers },
  { name: 'System Config', href: '/system-config', icon: Wrench },
  { name: 'Localization', href: '/localization', icon: Languages },
  { name: 'Translation AI', href: '/localization/translation-middleware', icon: Languages },
  { name: 'Translations', href: '/localization/translations', icon: FileText },
  { name: 'Configuration', href: '/configuration', icon: Sliders },
  { name: 'System Settings', href: '/configuration/system', icon: Wrench },
  { name: 'Infrastructure Tier', href: '/infrastructure-tier', icon: Server },
  { name: 'Library Registry', href: '/library-registry', icon: Layers },
  { name: 'Translation', href: '/translation', icon: Languages },
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
        'flex flex-col border-r border-white/10 bg-slate-900/80 backdrop-blur-xl transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
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

      <div className="border-t border-white/10 p-2">
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
