'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  GitBranch,
  Bot,
  Network,
  Play,
  Settings,
  Share2,
  Users,
  Sparkles,
  ChevronLeft,
  MoreHorizontal,
  Copy,
  Download,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Send,
  Loader2,
  Lightbulb,
  ListTodo,
  Plus,
  X,
  Check,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ParticipantsSidebar } from '@/components/collaboration/ParticipantsSidebar';
import { ChatPanel } from '@/components/collaboration/panels/ChatPanel';
import { BranchPanel } from '@/components/collaboration/panels/BranchPanel';
import { RoundtablePanel } from '@/components/collaboration/panels/RoundtablePanel';
import { KnowledgeGraphPanel } from '@/components/collaboration/panels/KnowledgeGraphPanel';
import { PlaybackPanel } from '@/components/collaboration/panels/PlaybackPanel';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

type TabType = 'chat' | 'branches' | 'roundtable' | 'graph' | 'playback';

export default function CollaborationSessionPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [showParticipants, setShowParticipants] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();

  // Fetch session data
  const { data: session, isLoading } = useQuery({
    queryKey: ['collaboration-session', sessionId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/thinktank/collaboration/sessions/${sessionId}`);
      if (!res.ok) throw new Error('Session not found');
      return res.json();
    },
    refetchInterval: isConnected ? false : 5000, // Poll if not connected via WebSocket
  });

  // Define callbacks before useEffect
  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'message':
        queryClient.invalidateQueries({ queryKey: ['collaboration-session', sessionId] });
        break;
      case 'typing':
        setTypingUsers((prev) => 
          data.isTyping 
            ? prev.includes(data.userId) ? prev : [...prev, data.userId]
            : prev.filter((id) => id !== data.userId)
        );
        break;
      case 'presence':
        queryClient.invalidateQueries({ queryKey: ['collaboration-session', sessionId] });
        break;
      case 'branch_created':
      case 'roundtable_update':
      case 'graph_update':
        queryClient.invalidateQueries({ queryKey: ['collaboration-session', sessionId] });
        break;
    }
  }, [queryClient, sessionId]);

  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing', sessionId, isTyping }));
    }
  }, [sessionId]);

  // WebSocket connection
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://api.radiant.ai/ws';
    const ws = new WebSocket(`${wsUrl}?sessionId=${sessionId}`);

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: 'join', sessionId }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [sessionId, handleWebSocketMessage]);

  if (isLoading) {
    return <SessionSkeleton />;
  }

  if (!session) {
    return <SessionNotFound />;
  }

  const currentUserId = 'current-user'; // Would come from auth context

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b flex items-center justify-between px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <Link href="/collaborate">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold text-sm flex items-center gap-2">
              {session.name || 'Collaboration Session'}
              {session.facilitator?.isEnabled && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Sparkles className="h-3 w-3" />
                  AI Facilitated
                </Badge>
              )}
            </h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn(
                'flex items-center gap-1',
                isConnected ? 'text-green-600' : 'text-amber-600'
              )}>
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isConnected ? 'bg-green-500' : 'bg-amber-500 animate-pulse'
                )} />
                {isConnected ? 'Connected' : 'Reconnecting...'}
              </span>
              <span>•</span>
              <span>{session.participants?.length || 0} participants</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Typing indicator */}
          <AnimatePresence>
            {typingUsers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="text-xs text-muted-foreground flex items-center gap-1"
              >
                <span className="flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-1 h-1 bg-muted-foreground rounded-full"
                      animate={{ y: [0, -3, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.2 }}
                    />
                  ))}
                </span>
                {typingUsers.length === 1 ? '1 person typing' : `${typingUsers.length} people typing`}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Voice/Video Controls */}
          <div className="flex items-center gap-1 border-l pl-2 ml-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Mic className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle microphone</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Video className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle camera</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Actions */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Share2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share session</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => setShowParticipants(!showParticipants)}
          >
            <Users className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Copy className="h-4 w-4 mr-2" />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="h-4 w-4 mr-2" />
                Export transcript
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="h-4 w-4 mr-2" />
                Session settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tab Navigation - Left Side */}
        <div className="w-14 border-r bg-muted/30 flex flex-col items-center py-3 gap-1">
          {tabs.map((tab) => (
            <TooltipProvider key={tab.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTab === tab.id ? 'secondary' : 'ghost'}
                    size="icon"
                    className={cn(
                      'h-10 w-10',
                      activeTab === tab.id && 'bg-primary/10 text-primary'
                    )}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <tab.icon className="h-5 w-5" />
                    {tab.badge && session[tab.badge]?.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                        {session[tab.badge].length}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{tab.label}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>

        {/* Main Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'chat' && (
              <ChatPanel key="chat" session={session} currentUserId={currentUserId} />
            )}
            {activeTab === 'branches' && (
              <BranchPanel key="branches" session={session} currentUserId={currentUserId} />
            )}
            {activeTab === 'roundtable' && (
              <RoundtablePanel key="roundtable" session={session} currentUserId={currentUserId} />
            )}
            {activeTab === 'graph' && (
              <KnowledgeGraphPanel key="graph" session={session} />
            )}
            {activeTab === 'playback' && (
              <PlaybackPanel key="playback" session={session} />
            )}
          </AnimatePresence>
        </div>

        {/* Participants Sidebar */}
        <AnimatePresence>
          {showParticipants && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 256, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <ParticipantsSidebar session={session} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const tabs: { id: TabType; label: string; icon: any; badge?: string }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'branches', label: 'Branches', icon: GitBranch, badge: 'branches' },
  { id: 'roundtable', label: 'AI Roundtable', icon: Bot, badge: 'roundtables' },
  { id: 'graph', label: 'Knowledge Graph', icon: Network },
  { id: 'playback', label: 'Playback', icon: Play },
];

function SessionSkeleton() {
  return (
    <div className="h-screen flex flex-col">
      <div className="h-14 border-b flex items-center px-4 gap-3">
        <div className="h-8 w-8 bg-muted rounded animate-pulse" />
        <div className="space-y-1">
          <div className="h-4 w-48 bg-muted rounded animate-pulse" />
          <div className="h-3 w-32 bg-muted rounded animate-pulse" />
        </div>
      </div>
      <div className="flex-1 flex">
        <div className="w-14 border-r bg-muted/30" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

function SessionNotFound() {
  return (
    <div className="h-screen flex flex-col items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold mb-2">Session Not Found</h1>
        <p className="text-muted-foreground mb-4">
          This collaboration session may have ended or you don&apos;t have access.
        </p>
        <Link href="/collaborate">
          <Button>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Collaborate
          </Button>
        </Link>
      </div>
    </div>
  );
}
