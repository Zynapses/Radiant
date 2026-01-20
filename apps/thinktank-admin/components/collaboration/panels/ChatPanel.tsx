'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Send, Sparkles, Paperclip, Mic, AtSign, Hash, Smile } from 'lucide-react';
import { api } from '@/lib/api/client';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ChatPanelProps {
  session: any;
  currentUserId: string;
}

export function ChatPanel({ session, currentUserId }: ChatPanelProps) {
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await api.post(`/api/thinktank/collaboration/sessions/${session.id}/messages`, { content });
      return response;
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['enhanced-session', session.id] });
    },
  });

  const handleSend = () => {
    if (message.trim()) sendMutation.mutate(message);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="h-full flex flex-col"
    >
      {session.facilitator?.isEnabled && (
        <div className="px-4 py-2 bg-violet-50 dark:bg-violet-950/30 border-b flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <span className="text-sm">
            <strong>AI Facilitator:</strong> {session.facilitator.sessionObjective || 'Guiding discussion'}
          </span>
        </div>
      )}

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {session.messages?.map((msg: any) => (
            <div key={msg.id} className="flex gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                style={{ backgroundColor: msg.participant?.color || '#6366f1' }}
              >
                {(msg.participant?.name || 'U').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{msg.participant?.name || 'Unknown'}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm">{msg.content}</p>
              </div>
            </div>
          ))}

          {(!session.messages || session.messages.length === 0) && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No messages yet</p>
              <p className="text-sm mt-1">Start the conversation!</p>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-muted/20">
        <div className="flex gap-2 mb-2">
          <Textarea
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
          />
          <Button onClick={handleSend} disabled={!message.trim() || sendMutation.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Paperclip className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Attach file</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Mic className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Voice message</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <AtSign className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mention participant</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Hash className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add topic tag</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Smile className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add emoji</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </motion.div>
  );
}
