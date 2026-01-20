'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, GitBranch, Bot, Play, MessageSquare, Network,
  Sparkles, Loader2, MessagesSquare, UserPlus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChatPanel } from './panels/ChatPanel';
import { BranchPanel } from './panels/BranchPanel';
import { RoundtablePanel } from './panels/RoundtablePanel';
import { KnowledgeGraphPanel } from './panels/KnowledgeGraphPanel';
import { PlaybackPanel } from './panels/PlaybackPanel';
import { ParticipantsSidebar } from './ParticipantsSidebar';
import { InviteDialog } from './dialogs/InviteDialog';
import { FacilitatorSettingsDialog } from './dialogs/FacilitatorSettingsDialog';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface EnhancedCollaborativeSessionProps {
  sessionId: string;
  currentUserId: string;
  isGuest?: boolean;
  guestToken?: string;
}

export default function EnhancedCollaborativeSession({
  sessionId,
  currentUserId,
  isGuest = false,
  guestToken,
}: EnhancedCollaborativeSessionProps) {
  const [activePanel, setActivePanel] = useState<'chat' | 'branches' | 'roundtable' | 'graph' | 'playback'>('chat');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showFacilitatorSettings, setShowFacilitatorSettings] = useState(false);

  const { data: session, isLoading } = useQuery({
    queryKey: ['enhanced-session', sessionId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/thinktank/collaboration/sessions/${sessionId}`);
      if (!res.ok) throw new Error('Failed to fetch session');
      const { data } = await res.json();
      return data;
    },
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
        <MessagesSquare className="h-12 w-12 mb-4 opacity-50" />
        <p>Session not found or access denied</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-14 border-b flex items-center justify-between px-4 bg-gradient-to-r from-background to-muted/20">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: session.color }} />
          <div>
            <h2 className="font-semibold">{session.name || 'Collaborative Session'}</h2>
            <p className="text-xs text-muted-foreground">
              {session.onlineCount} online • {(session.participants?.length || 0) + (session.guests?.length || 0)} total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.facilitator?.isEnabled && (
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              AI Facilitator Active
            </Badge>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setShowFacilitatorSettings(true)}>
                  <Bot className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>AI Facilitator Settings</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="default" size="sm" onClick={() => setShowInviteDialog(true)} className="gap-1">
            <UserPlus className="h-4 w-4" />
            Invite
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Side Navigation */}
        <div className="w-14 bg-muted/30 border-r flex flex-col items-center py-4 gap-2">
          <NavButton icon={MessageSquare} label="Chat" active={activePanel === 'chat'} onClick={() => setActivePanel('chat')} />
          <NavButton icon={GitBranch} label="Branches" active={activePanel === 'branches'} onClick={() => setActivePanel('branches')} badge={session.branches?.length} />
          <NavButton icon={Bot} label="AI Roundtable" active={activePanel === 'roundtable'} onClick={() => setActivePanel('roundtable')} badge={session.roundtables?.length} />
          <NavButton icon={Network} label="Knowledge Graph" active={activePanel === 'graph'} onClick={() => setActivePanel('graph')} />
          <NavButton icon={Play} label="Playback" active={activePanel === 'playback'} onClick={() => setActivePanel('playback')} badge={session.recordings?.length} />
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {activePanel === 'chat' && <ChatPanel key="chat" session={session} currentUserId={currentUserId} />}
            {activePanel === 'branches' && <BranchPanel key="branches" session={session} currentUserId={currentUserId} />}
            {activePanel === 'roundtable' && <RoundtablePanel key="roundtable" session={session} currentUserId={currentUserId} />}
            {activePanel === 'graph' && <KnowledgeGraphPanel key="graph" session={session} />}
            {activePanel === 'playback' && <PlaybackPanel key="playback" session={session} />}
          </AnimatePresence>
        </div>

        <ParticipantsSidebar session={session} />
      </div>

      <InviteDialog open={showInviteDialog} onOpenChange={setShowInviteDialog} sessionId={sessionId} />
      <FacilitatorSettingsDialog open={showFacilitatorSettings} onOpenChange={setShowFacilitatorSettings} session={session} />
    </div>
  );
}

function NavButton({ icon: Icon, label, active, onClick, badge }: { icon: any; label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              'relative w-10 h-10 rounded-lg flex items-center justify-center transition-all',
              active ? 'bg-primary text-primary-foreground shadow-lg' : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
            {badge !== undefined && badge > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center">
                {badge}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
