'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Users, MessageSquare, RefreshCw } from 'lucide-react';

interface SessionData {
  sessionId: string;
  conversationTitle: string;
  messages: Array<{
    id: string;
    participantId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    model?: string;
    status: string;
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
        const data = await api.get<{ data: SessionData }>(`/api/thinktank/collaborate/sessions/${sessionId}`);
        setSessionData(data.data);
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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Collaborative Session
          </h1>
          <p className="text-muted-foreground">Real-time collaborative conversation sharing</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{error || 'No session data available'}</h3>
            <p className="text-muted-foreground mb-4">Create a new session or join an existing one</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Collaborative Session
          </h1>
          <p className="text-muted-foreground">Real-time collaborative conversation sharing</p>
        </div>
        <Badge variant="outline">{sessionData.sessionId}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{sessionData.conversationTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sessionData.messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No messages yet</p>
              </div>
            ) : (
              sessionData.messages.map((msg) => (
                <div key={msg.id} className={`p-4 rounded-lg ${msg.role === 'assistant' ? 'bg-muted' : 'bg-primary/5'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={msg.role === 'assistant' ? 'secondary' : 'outline'}>{msg.role}</Badge>
                    {msg.model && <Badge variant="outline" className="text-xs">{msg.model}</Badge>}
                    <span className="text-xs text-muted-foreground ml-auto">{new Date(msg.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
