'use client';

import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { MessageSquare, Mic, Lightbulb, ListTodo, GitBranch, Sparkles, Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface ChatPanelProps {
  session: any;
  currentUserId: string;
}

export function ChatPanel({ session, currentUserId }: ChatPanelProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`${API_BASE}/api/thinktank/collaborate/sessions/${session.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, role: 'user' }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate(message);
    setMessage('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="h-full flex flex-col"
    >
      {/* Facilitator Banner */}
      {session.facilitator?.isEnabled && (
        <div className="px-4 py-2 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-b flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <span className="text-sm">
            <strong>AI Facilitator</strong> is guiding this session
            {session.facilitator.sessionObjective && (
              <span className="text-muted-foreground"> • Goal: {session.facilitator.sessionObjective}</span>
            )}
          </span>
        </div>
      )}

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          <div className="text-center text-muted-foreground py-12">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Start the conversation</p>
            <p className="text-sm mt-1">Messages will appear here in real-time</p>
          </div>
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t bg-muted/20">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="min-h-[80px] pr-12 resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <div className="absolute bottom-2 right-2 flex gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setIsRecording(!isRecording)}
                    >
                      <Mic className={cn('h-4 w-4', isRecording && 'text-red-500 animate-pulse')} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Voice Note</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <Button onClick={handleSend} disabled={!message.trim() || sendMutation.isPending}>
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 mt-2">
          <Button variant="ghost" size="sm" className="text-xs gap-1">
            <Lightbulb className="h-3 w-3" />
            Suggest Topic
          </Button>
          <Button variant="ghost" size="sm" className="text-xs gap-1">
            <ListTodo className="h-3 w-3" />
            Action Item
          </Button>
          <Button variant="ghost" size="sm" className="text-xs gap-1">
            <GitBranch className="h-3 w-3" />
            Create Branch
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
