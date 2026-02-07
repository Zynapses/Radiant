'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Search,
  Clock,
  Sparkles,
  MessageSquare,
  GitBranch,
  Bot,
  ArrowRight,
  Zap,
  Globe,
  Lock,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreateSessionDialog } from '@/components/collaboration/dialogs/CreateSessionDialog';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export default function CollaboratePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['collaboration-sessions'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/thinktank/collaborate/sessions`);
      if (!res.ok) return { active: [], recent: [] };
      return res.json();
    },
  });

  const activeSessions = sessions?.active || [];
  const recentSessions = sessions?.recent || [];

  return (
    <div className="min-h-screen">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative px-6 py-12 md:py-16">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
            >
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
                  <Users className="h-8 w-8" />
                  Collaborate
                </h1>
                <p className="text-white/80 text-lg max-w-xl">
                  Real-time AI collaboration that goes beyond chat. Branch conversations, 
                  debate with multiple models, and build knowledge together.
                </p>
              </div>
              
              <Button
                size="lg"
                className="bg-white text-purple-700 hover:bg-white/90 shadow-xl"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="h-5 w-5 mr-2" />
                New Session
              </Button>
            </motion.div>

            {/* Quick Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8"
            >
              {[
                { label: 'Active Sessions', value: activeSessions.length, icon: Zap },
                { label: 'Collaborators Online', value: activeSessions.reduce((sum: number, s: any) => sum + (s.participants?.filter((p: any) => p.isOnline).length || 0), 0), icon: Users },
                { label: 'AI Roundtables', value: activeSessions.reduce((sum: number, s: any) => sum + (s.roundtables?.length || 0), 0), icon: Bot },
                { label: 'Branches Created', value: activeSessions.reduce((sum: number, s: any) => sum + (s.branches?.length || 0), 0), icon: GitBranch },
              ].map((stat, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <stat.icon className="h-5 w-5 mb-2 text-white/70" />
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-sm text-white/70">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sessions, topics, or collaborators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-lg"
          />
        </div>

        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="active" className="gap-2">
              <Zap className="h-4 w-4" />
              Active
            </TabsTrigger>
            <TabsTrigger value="recent" className="gap-2">
              <Clock className="h-4 w-4" />
              Recent
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <Star className="h-4 w-4" />
              Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <AnimatePresence mode="popLayout">
              {isLoading ? (
                <LoadingGrid />
              ) : activeSessions.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeSessions.map((session: any, i: number) => (
                    <SessionCard key={session.id} session={session} index={i} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Users}
                  title="No active sessions"
                  description="Start a new collaboration session to work with AI and teammates in real-time"
                  action={
                    <Button onClick={() => setShowCreateDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Session
                    </Button>
                  }
                />
              )}
            </AnimatePresence>
          </TabsContent>

          <TabsContent value="recent">
            {recentSessions.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentSessions.map((session: any, i: number) => (
                  <SessionCard key={session.id} session={session} index={i} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Clock}
                title="No recent sessions"
                description="Your completed collaboration sessions will appear here"
              />
            )}
          </TabsContent>

          <TabsContent value="templates">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessionTemplates.map((template, i) => (
                <TemplateCard key={i} template={template} onUse={() => setShowCreateDialog(true)} />
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Features Showcase */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-6">Collaboration Superpowers</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-xl ${feature.bgColor} flex items-center justify-center mb-2`}>
                      <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <CreateSessionDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </div>
  );
}

function SessionCard({ session, index }: { session: any; index: number }) {
  const onlineParticipants = session.participants?.filter((p: any) => p.isOnline) || [];
  const hasAIFacilitator = session.facilitator?.isEnabled;
  const branchCount = session.branches?.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link href={`/collaborate/${session.id}`}>
        <Card className="h-full hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer group">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                  {session.name || 'Untitled Session'}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {session.description || session.topic || 'No description'}
                </p>
              </div>
              {session.isPublic ? (
                <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </div>

            {/* Participants */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex -space-x-2">
                {onlineParticipants.slice(0, 4).map((p: any, i: number) => (
                  <Avatar key={i} className="h-7 w-7 border-2 border-background">
                    <AvatarImage src={p.avatarUrl} />
                    <AvatarFallback
                      style={{ backgroundColor: p.color }}
                      className="text-white text-xs"
                    >
                      {(p.name || p.displayName || 'U').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              {onlineParticipants.length > 4 && (
                <span className="text-xs text-muted-foreground">
                  +{onlineParticipants.length - 4}
                </span>
              )}
              {onlineParticipants.length > 0 && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  {onlineParticipants.length} online
                </span>
              )}
            </div>

            {/* Features */}
            <div className="flex flex-wrap gap-1.5">
              {hasAIFacilitator && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Sparkles className="h-3 w-3" />
                  AI Facilitated
                </Badge>
              )}
              {branchCount > 0 && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <GitBranch className="h-3 w-3" />
                  {branchCount} branches
                </Badge>
              )}
              {session.roundtables?.length > 0 && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Bot className="h-3 w-3" />
                  {session.roundtables.length} roundtables
                </Badge>
              )}
            </div>

            {/* Join CTA */}
            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {session.lastActivity ? `Active ${formatRelativeTime(session.lastActivity)}` : 'New session'}
              </span>
              <Button variant="ghost" size="sm" className="gap-1 group-hover:bg-primary group-hover:text-primary-foreground">
                Join
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

function TemplateCard({ template, onUse }: { template: typeof sessionTemplates[0]; onUse: () => void }) {
  return (
    <Card className="h-full hover:shadow-lg transition-shadow">
      <CardContent className="p-5">
        <div className={`w-12 h-12 rounded-xl ${template.bgColor} flex items-center justify-center mb-3`}>
          <template.icon className={`h-6 w-6 ${template.iconColor}`} />
        </div>
        <h3 className="font-semibold mb-1">{template.name}</h3>
        <p className="text-sm text-muted-foreground mb-4">{template.description}</p>
        <div className="flex flex-wrap gap-1 mb-4">
          {template.features.map((feature, i) => (
            <Badge key={i} variant="secondary" className="text-xs">{feature}</Badge>
          ))}
        </div>
        <Button variant="outline" className="w-full" onClick={onUse}>
          Use Template
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action 
}: { 
  icon: any; 
  title: string; 
  description: string; 
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm mx-auto mb-4">{description}</p>
      {action}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="h-48 animate-pulse">
          <CardContent className="p-5">
            <div className="h-4 bg-muted rounded w-3/4 mb-3" />
            <div className="h-3 bg-muted rounded w-full mb-2" />
            <div className="h-3 bg-muted rounded w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function formatRelativeTime(date: string) {
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const features = [
  {
    icon: Users,
    title: 'Real-Time Collaboration',
    description: 'See teammates typing, editing, and thinking in real-time with live cursors and presence indicators.',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    icon: GitBranch,
    title: 'Conversation Branching',
    description: 'Fork any conversation to explore different directions without losing the original thread.',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  {
    icon: Bot,
    title: 'AI Roundtable',
    description: 'Watch multiple AI models debate, collaborate, and synthesize insights on any topic.',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    iconColor: 'text-purple-600 dark:text-purple-400',
  },
  {
    icon: Sparkles,
    title: 'AI Facilitator',
    description: 'Let AI guide your session, summarize discussions, and resolve conflicts automatically.',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    icon: MessageSquare,
    title: 'Guest Access',
    description: 'Invite anyone with a link - no account required. Perfect for client collaboration.',
    bgColor: 'bg-pink-100 dark:bg-pink-900/30',
    iconColor: 'text-pink-600 dark:text-pink-400',
  },
  {
    icon: Globe,
    title: 'Knowledge Graph',
    description: 'Visualize concepts and connections that emerge from your conversations.',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
  },
];

const sessionTemplates = [
  {
    name: 'Strategy Session',
    description: 'Structured brainstorming with AI facilitation and multi-model perspectives.',
    icon: Sparkles,
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    iconColor: 'text-violet-600 dark:text-violet-400',
    features: ['AI Facilitator', 'Roundtable', 'Knowledge Graph'],
  },
  {
    name: 'Team Standup',
    description: 'Quick sync with AI-powered summaries and action item tracking.',
    icon: Users,
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    features: ['Quick Mode', 'Action Items', 'Recording'],
  },
  {
    name: 'Research Deep Dive',
    description: 'Explore topics with branching conversations and comprehensive synthesis.',
    icon: GitBranch,
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
    features: ['Branching', 'Multi-Model', 'Citations'],
  },
  {
    name: 'Client Workshop',
    description: 'Professional collaboration with guest access and exportable artifacts.',
    icon: Globe,
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    features: ['Guest Access', 'Recording', 'Export'],
  },
  {
    name: 'AI Debate',
    description: 'Watch AI models argue different perspectives and synthesize conclusions.',
    icon: Bot,
    bgColor: 'bg-rose-100 dark:bg-rose-900/30',
    iconColor: 'text-rose-600 dark:text-rose-400',
    features: ['Adversarial', '5 Models', 'Synthesis'],
  },
  {
    name: 'Blank Canvas',
    description: 'Start fresh with full flexibility to configure your session.',
    icon: MessageSquare,
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    iconColor: 'text-gray-600 dark:text-gray-400',
    features: ['Customizable'],
  },
];
