'use client';

// ============================================================================
// RADIANT Think Tank - Chat with Artifacts Component
// apps/admin-dashboard/components/thinktank/chat-with-artifacts.tsx
// Version: 4.19.0
//
// Split-screen layout combining chat interface with artifact generation
// and preview. Supports real-time streaming and validation feedback.
// ============================================================================

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  PanelRightClose,
  PanelRight,
  Loader2,
  Code,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { ArtifactViewer } from './artifact-viewer';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  artifactSessionId?: string;
}

interface ChatWithArtifactsProps {
  chatId?: string;
  canvasId?: string;
  initialMessages?: Message[];
  onSendMessage?: (message: string) => Promise<void>;
}

export function ChatWithArtifacts({
  chatId,
  canvasId,
  initialMessages = [],
  onSendMessage,
}: ChatWithArtifactsProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeArtifactSession, setActiveArtifactSession] = useState<string | null>(null);
  const [showArtifactPanel, setShowArtifactPanel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Detect if prompt should generate an artifact
  const isArtifactPrompt = useCallback((prompt: string): boolean => {
    const artifactKeywords = [
      /build\s+(a|an|me)/i,
      /create\s+(a|an|me)/i,
      /make\s+(a|an|me)/i,
      /generate\s+(a|an|me)/i,
      /calculator/i,
      /chart/i,
      /graph/i,
      /form/i,
      /table/i,
      /dashboard/i,
      /game/i,
      /visualization/i,
      /component/i,
      /widget/i,
      /app/i,
      /ui/i,
    ];
    return artifactKeywords.some((pattern) => pattern.test(prompt));
  }, []);

  // Generate artifact
  const generateArtifact = useCallback(
    async (prompt: string): Promise<string | null> => {
      try {
        const response = await fetch('/api/thinktank/artifacts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            chatId,
            canvasId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate artifact');
        }

        const result = await response.json();
        return result.sessionId;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return null;
      }
    },
    [chatId, canvasId]
  );

  // Handle send message
  const handleSend = useCallback(async () => {
    if (!input.trim() || isGenerating) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);
    setError(null);

    try {
      // Check if this should generate an artifact
      if (isArtifactPrompt(userMessage.content)) {
        const sessionId = await generateArtifact(userMessage.content);

        if (sessionId) {
          setActiveArtifactSession(sessionId);
          setShowArtifactPanel(true);

          // Add assistant message with artifact reference
          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `I'm generating an artifact for you. You can see the progress in the panel on the right.`,
            timestamp: new Date(),
            artifactSessionId: sessionId,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }
      } else if (onSendMessage) {
        // Regular chat message
        await onSendMessage(userMessage.content);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [input, isGenerating, isArtifactPrompt, generateArtifact, onSendMessage]);

  // Handle key press
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // View artifact from message
  const handleViewArtifact = useCallback((sessionId: string) => {
    setActiveArtifactSession(sessionId);
    setShowArtifactPanel(true);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Chat Panel */}
        <ResizablePanel defaultSize={showArtifactPanel ? 50 : 100} minSize={30}>
          <div className="flex flex-col h-full">
            {/* Chat Header */}
            <div className="flex items-center justify-between p-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                <span className="font-medium">Think Tank Chat</span>
                {isGenerating && (
                  <Badge variant="outline" className="ml-2">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Generating...
                  </Badge>
                )}
              </div>
              {activeArtifactSession && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowArtifactPanel(!showArtifactPanel)}
                >
                  {showArtifactPanel ? (
                    <PanelRightClose className="w-4 h-4" />
                  ) : (
                    <PanelRight className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Start a conversation</p>
                    <p className="text-sm mt-1">
                      Ask me to build calculators, charts, forms, games, and more!
                    </p>
                  </div>
                )}

                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    onViewArtifact={handleViewArtifact}
                  />
                ))}

                {error && (
                  <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                    Error: {error}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t bg-background">
              <div className="max-w-3xl mx-auto flex gap-2">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me to build something... (e.g., 'Build a calculator')"
                  className="min-h-[60px] max-h-[200px] resize-none"
                  disabled={isGenerating}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isGenerating}
                  className="h-auto"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <div className="max-w-3xl mx-auto mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="w-3 h-3" />
                <span>
                  Tip: Use keywords like &quot;build&quot;, &quot;create&quot;, &quot;chart&quot;, &quot;calculator&quot; to generate
                  interactive artifacts
                </span>
              </div>
            </div>
          </div>
        </ResizablePanel>

        {/* Artifact Panel */}
        {showArtifactPanel && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={50} minSize={30}>
              <ArtifactViewer
                sessionId={activeArtifactSession}
                onClose={() => setShowArtifactPanel(false)}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}

// Message Bubble Component
interface MessageBubbleProps {
  message: Message;
  onViewArtifact: (sessionId: string) => void;
}

function MessageBubble({ message, onViewArtifact }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg p-3 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>

        {message.artifactSessionId && (
          <Button
            variant="secondary"
            size="sm"
            className="mt-2 w-full"
            onClick={() => onViewArtifact(message.artifactSessionId!)}
          >
            <Code className="w-4 h-4 mr-2" />
            View Artifact
          </Button>
        )}

        <p
          className={`text-xs mt-1 ${
            isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'
          }`}
        >
          {message.timestamp.toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

export default ChatWithArtifacts;
