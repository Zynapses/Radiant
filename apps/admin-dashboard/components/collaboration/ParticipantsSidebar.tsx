'use client';

import { useState } from 'react';
import { Users, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ParticipantsSidebarProps {
  session: any;
}

export function ParticipantsSidebar({ session }: ParticipantsSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const allParticipants = [
    ...(session.participants || []).map((p: any) => ({ ...p, isGuest: false })),
    ...(session.guests || []).map((g: any) => ({ ...g, isGuest: true })),
  ];

  const online = allParticipants.filter((p) => p.isOnline);
  const offline = allParticipants.filter((p) => !p.isOnline);

  if (collapsed) {
    return (
      <div className="w-10 border-l flex flex-col items-center py-4">
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(false)}>
          <Users className="h-4 w-4" />
        </Button>
        <div className="mt-2 space-y-1">
          {online.slice(0, 5).map((p: any) => (
            <div
              key={p.id}
              className="w-6 h-6 rounded-full border-2 border-green-500"
              style={{ backgroundColor: p.color }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 border-l flex flex-col">
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-medium text-sm">Participants</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCollapsed(true)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Online — {online.length}
            </p>
            <div className="space-y-2">
              {online.map((p: any) => (
                <ParticipantRow key={p.id} participant={p} />
              ))}
            </div>
          </div>

          {offline.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Offline — {offline.length}
              </p>
              <div className="space-y-2">
                {offline.map((p: any) => (
                  <ParticipantRow key={p.id} participant={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ParticipantRow({ participant }: { participant: any }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="relative">
        <Avatar className="h-8 w-8">
          <AvatarImage src={participant.avatarUrl} />
          <AvatarFallback
            style={{ backgroundColor: participant.color }}
            className="text-white text-xs"
          >
            {(participant.name || participant.displayName || 'U').slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {participant.isOnline && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {participant.name || participant.displayName || 'Unknown'}
        </p>
        <p className="text-xs text-muted-foreground">
          {participant.isGuest ? 'Guest' : participant.permission}
          {participant.isTyping && ' • typing...'}
        </p>
      </div>
    </div>
  );
}
