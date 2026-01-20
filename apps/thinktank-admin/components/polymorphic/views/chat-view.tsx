'use client';

/**
 * Chat View - Default Conversation Interface
 * 
 * PROMPT-41 Polymorphic UI
 * 
 * Standard multi-agent conversation interface.
 * Default view when no specific morph is triggered.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare, Send, Bot, User, Zap, Users, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewComponentProps } from '../view-router';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  mode?: 'sniper' | 'war_room';
  persona?: string;
  costCents?: number;
}

export function ChatView({ 
  data, 
  mode, 
}: ViewComponentProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (data.messages && Array.isArray(data.messages)) {
      setMessages(data.messages as ChatMessage[]);
    }
  }, [data]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `Processing your request in ${mode === 'sniper' ? 'Sniper' : 'War Room'} mode...\n\nThis is a demonstration of the Polymorphic UI chat interface. In production, this would route through the Economic Governor for intelligent model selection.`,
      timestamp: new Date(),
      mode,
      persona: mode === 'sniper' ? 'Sniper' : 'Sage',
      costCents: mode === 'sniper' ? 1 : 50,
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium">Conversation</span>
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs",
              mode === 'sniper' ? 'bg-green-500/10 text-green-600' : 'bg-purple-500/10 text-purple-600'
            )}
          >
            {mode === 'sniper' ? <Zap className="w-3 h-3 mr-1" /> : <Users className="w-3 h-3 mr-1" />}
            {mode === 'sniper' ? 'Sniper' : 'War Room'}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {messages.length} messages
        </span>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4 max-w-3xl mx-auto">
          {messages.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Start a conversation</p>
              <p className="text-xs mt-1">
                {mode === 'sniper' 
                  ? 'Sniper mode for quick, efficient responses' 
                  : 'War Room mode for deep, multi-agent analysis'}
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === 'user' && "flex-row-reverse"
              )}
            >
              <Avatar className={cn(
                "w-8 h-8",
                message.role === 'user' && "bg-primary"
              )}>
                <AvatarFallback className={cn(
                  message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}>
                  {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </AvatarFallback>
              </Avatar>

              <div className={cn(
                "flex-1 max-w-[80%]",
                message.role === 'user' && "flex flex-col items-end"
              )}>
                <div className={cn(
                  "rounded-lg px-4 py-2",
                  message.role === 'user' 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted"
                )}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>

                <div className={cn(
                  "flex items-center gap-2 mt-1 text-[10px] text-muted-foreground",
                  message.role === 'user' && "flex-row-reverse"
                )}>
                  <span>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {message.mode && (
                    <>
                      <span>•</span>
                      <Badge variant="outline" className="h-4 text-[10px] px-1">
                        {message.mode === 'sniper' ? <Zap className="w-2 h-2 mr-0.5" /> : <Users className="w-2 h-2 mr-0.5" />}
                        {message.persona || message.mode}
                      </Badge>
                    </>
                  )}
                  {message.costCents !== undefined && (
                    <>
                      <span>•</span>
                      <span>${(message.costCents / 100).toFixed(2)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-muted">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-lg px-4 py-2">
                <p className="text-sm text-muted-foreground">Thinking...</p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-4 bg-background">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={mode === 'sniper' ? 'Quick question...' : 'Ask the War Room...'}
              className="min-h-[60px] max-h-[200px] pr-12 resize-none"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 bottom-2"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
}
