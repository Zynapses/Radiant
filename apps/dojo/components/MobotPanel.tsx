'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Send,
  Bot,
  User,
  Loader2,
  FileText,
  X,
  Sparkles,
} from 'lucide-react';
import { useDojoStore } from '@/lib/dojo-store';
import { sendMobotMessage, type MobotMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

export function MobotPanel() {
  const {
    activeSession,
    selectedThemes,
    mobotMessages,
    addMobotMessage,
    toggleMobot,
  } = useDojoStore();

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMutation = useMutation({
    mutationFn: (message: string) =>
      sendMobotMessage(
        activeSession?.id || 'global',
        message,
        { theme_ids: selectedThemes.map((t) => t.id) }
      ),
    onMutate: (message) => {
      const userMsg: MobotMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        citations: [],
        timestamp: new Date().toISOString(),
      };
      addMobotMessage(userMsg);
    },
    onSuccess: (data) => {
      addMobotMessage(data.message);
    },
  });

  const handleSend = () => {
    const msg = input.trim();
    if (!msg || sendMutation.isPending) return;
    setInput('');
    sendMutation.mutate(msg);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [mobotMessages.length]);

  return (
    <div className="w-80 flex flex-col border-l border-dojo-900/20 bg-[#0a0806]/90 backdrop-blur-md">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-dojo-900/20">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-dojo-400" />
          <span className="text-sm font-semibold text-white">Mobot</span>
          <span className="text-[10px] text-dojo-500/60 font-mono">Knowledge Agent</span>
        </div>
        <button
          onClick={toggleMobot}
          className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {mobotMessages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles className="w-8 h-8 text-dojo-500/20 mx-auto mb-3" />
            <p className="text-xs text-white/30">
              Ask Mobot anything about your training topics. Answers are grounded in your library with citations.
            </p>
          </div>
        )}

        {mobotMessages.map((msg) => (
          <div key={msg.id} className={cn('max-w-[95%]', msg.role === 'user' ? 'ml-auto' : '')}>
            {/* Role indicator */}
            <div className={cn(
              'flex items-center gap-1.5 mb-1',
              msg.role === 'user' ? 'justify-end' : ''
            )}>
              {msg.role === 'mobot' ? (
                <Bot className="w-3 h-3 text-dojo-400" />
              ) : (
                <User className="w-3 h-3 text-omega-400" />
              )}
              <span className="text-[10px] text-white/20">
                {msg.role === 'mobot' ? 'Mobot' : 'You'}
              </span>
            </div>

            {/* Bubble */}
            <div className={msg.role === 'mobot' ? 'mobot-bubble p-3' : 'user-bubble p-3'}>
              <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                {msg.content}
              </p>

              {/* Citations */}
              {msg.citations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-1.5">
                  {msg.citations.slice(0, 3).map((c, i) => (
                    <div
                      key={`${c.chunk_id}-${i}`}
                      className="flex items-start gap-1.5 text-[10px] text-white/30"
                    >
                      <FileText className="w-2.5 h-2.5 text-omega-400 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">
                        <span className="text-omega-300">{c.document_name}</span>
                        {c.page && <span> p.{c.page}</span>}
                        {' — '}
                        <span className="italic">{c.excerpt.slice(0, 80)}...</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {sendMutation.isPending && (
          <div className="flex items-center gap-2 text-xs text-dojo-400/60">
            <Loader2 className="w-3 h-3 animate-spin" />
            Mobot is thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-dojo-900/20">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Mobot..."
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:border-dojo-500/40 focus:outline-none transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            className="p-2 rounded-lg bg-dojo-600 hover:bg-dojo-500 disabled:opacity-30 text-white transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
