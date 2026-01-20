'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import CollaborativeSession from '@/components/collaboration/CollaborativeSession';
import { Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface SessionData {
  sessionId: string;
  conversationTitle: string;
  messages: Array<{
    id: string;
    participantId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    model?: string;
    status: 'typing' | 'sent' | 'delivered' | 'edited' | 'deleted';
    reactions: Record<string, string[]>;
    threadCount: number;
    createdAt: string;
  }>;
}

export default function CollaboratePage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session') || 'default';
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSession() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/thinktank/collaborate/sessions/${sessionId}`);
        if (res.ok) {
          const { data } = await res.json();
          setSessionData(data);
        } else {
          setError('Failed to load collaborative session');
        }
      } catch {
        setError('Failed to connect to collaboration service');
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !sessionData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Collaborative Session</h1>
          <p className="text-muted-foreground">
            Real-time collaborative conversation sharing
          </p>
        </div>
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <p>{error || 'No session data available'}</p>
          <p className="text-sm mt-2">Create a new session or join an existing one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Collaborative Session</h1>
        <p className="text-muted-foreground">
          Real-time collaborative conversation sharing
        </p>
      </div>
      
      <CollaborativeSession
        sessionId={sessionData.sessionId}
        conversationTitle={sessionData.conversationTitle}
        currentUserId="current-user"
        initialMessages={sessionData.messages.map(msg => ({
          ...msg,
          createdAt: new Date(msg.createdAt),
        }))}
      />
    </div>
  );
}
