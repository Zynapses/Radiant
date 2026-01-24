'use client';

import { useState, useEffect } from 'react';
import { Brain, CheckCircle2, Clock, FileText, Network, Upload, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ui/glass-card';
import Link from 'next/link';

interface DashboardStats {
  knowledgeNodes: number;
  documentsIngested: number;
  verifiedFacts: number;
  pendingVerification: number;
}

interface ActivityItem {
  id: string;
  type: 'ingestion' | 'verification' | 'override';
  message: string;
  time: string;
  status: 'success' | 'verified' | 'override' | 'pending' | 'error';
}

const quickActions = [
  {
    title: 'Ingest Documents',
    description: 'Upload PDFs, manuals, or connect to external sources',
    href: '/dashboard/ingest',
    icon: Upload,
    color: 'bg-curator-gold/10 text-curator-gold',
  },
  {
    title: 'Verify Knowledge',
    description: 'Review AI understanding and confirm accuracy',
    href: '/dashboard/verify',
    icon: CheckCircle2,
    color: 'bg-curator-emerald/10 text-curator-emerald',
  },
  {
    title: 'View Knowledge Graph',
    description: 'Explore relationships between concepts',
    href: '/dashboard/graph',
    icon: Network,
    color: 'bg-curator-sapphire/10 text-curator-sapphire',
  },
];

function getStatusColor(status: string) {
  switch (status) {
    case 'success': return 'bg-curator-emerald/10 text-curator-emerald';
    case 'verified': return 'bg-curator-emerald/10 text-curator-emerald';
    case 'override': return 'bg-curator-sapphire/10 text-curator-sapphire';
    case 'pending': return 'bg-curator-gold/10 text-curator-gold';
    default: return 'bg-muted text-muted-foreground';
  }
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [statsRes, activityRes] = await Promise.allSettled([
          fetch('/api/curator/dashboard'),
          fetch('/api/curator/audit?limit=10'),
        ]);

        if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
          const data = await statsRes.value.json();
          setStats(data);
        } else {
          setStats({ knowledgeNodes: 0, documentsIngested: 0, verifiedFacts: 0, pendingVerification: 0 });
        }

        if (activityRes.status === 'fulfilled' && activityRes.value.ok) {
          const data = await activityRes.value.json();
          setActivity(data.items || []);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        setStats({ knowledgeNodes: 0, documentsIngested: 0, verifiedFacts: 0, pendingVerification: 0 });
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  const statCards = stats ? [
    { name: 'Knowledge Nodes', value: stats.knowledgeNodes.toLocaleString(), icon: Brain, color: 'text-curator-gold' },
    { name: 'Documents Ingested', value: stats.documentsIngested.toLocaleString(), icon: FileText, color: 'text-curator-sapphire' },
    { name: 'Verified Facts', value: stats.verifiedFacts.toLocaleString(), icon: CheckCircle2, color: 'text-curator-emerald' },
    { name: 'Pending Verification', value: stats.pendingVerification.toLocaleString(), icon: Clock, color: 'text-curator-bronze' },
  ] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-curator-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Welcome to RADIANT Curator</h1>
        <p className="text-muted-foreground mt-1">
          Teach your AI. Verify its understanding. Build the Corporate Brain.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <GlassCard key={stat.name} variant="elevated" glowColor="none" padding="lg">
            <div className="flex items-center gap-4">
              <div className={`rounded-lg bg-muted p-2 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.name}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link key={action.title} href={action.href} className="group block">
              <GlassCard variant="default" hoverEffect padding="lg">
                <div className={`inline-flex rounded-lg p-3 ${action.color}`}>
                  <action.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-semibold group-hover:text-primary transition-colors">
                  {action.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {action.description}
                </p>
              </GlassCard>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <GlassCard variant="default" padding="none">
          {activity.length > 0 ? (
            <div className="divide-y divide-white/[0.06]">
              {activity.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(item.status)}`}>
                      {item.status}
                    </div>
                    <span className="text-sm">{item.message}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.time}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No recent activity</p>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Pending Verification Alert */}
      {stats && stats.pendingVerification > 0 && (
      <div className="rounded-xl border border-curator-gold/50 bg-curator-gold/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-curator-gold mt-0.5" />
          <div>
            <h3 className="font-semibold text-curator-gold">{stats.pendingVerification} Items Awaiting Verification</h3>
            <p className="text-sm text-muted-foreground mt-1">
              The AI has learned new facts that need human confirmation before deployment.
            </p>
            <Link
              href="/dashboard/verify"
              className="inline-flex items-center gap-1 text-sm font-medium text-curator-gold mt-2 hover:underline"
            >
              Review Now →
            </Link>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
