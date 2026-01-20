'use client';

/**
 * Modern Chat Interface - 2026+ Design
 * 
 * Features:
 * - Glassmorphism styling
 * - Aurora gradient backgrounds
 * - Smooth morphing transitions
 * - Advanced mode toggle reveals power features
 * - Reactive micro-interactions
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Sparkles, Zap, Settings, Menu, MoreVertical, 
  Brain, Mic, Paperclip, Code, ChevronDown,
  Star, Copy, ThumbsUp, ThumbsDown, RotateCcw
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlassCard, GlassPanel } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/lib/stores/ui-store';
import { useTranslation, T } from '@/lib/i18n';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  metadata?: {
    modelUsed?: string;
    tokensUsed?: number;
    latencyMs?: number;
    costEstimate?: number;
    orchestrationMode?: string;
    domainDetected?: string;
  };
}

interface ModernChatInterfaceProps {
  messages: ChatMessage[];
  onSend: (message: string, attachments?: File[]) => void;
  onRate?: (messageId: string, positive: boolean) => void;
  onRegenerate?: (messageId: string) => void;
  isTyping?: boolean;
  selectedModel?: string;
  onModelSelect?: () => void;
  className?: string;
}

export function ModernChatInterface({
  messages,
  onSend,
  onRate,
  onRegenerate,
  isTyping = false,
  selectedModel,
  onModelSelect,
  className,
}: ModernChatInterfaceProps) {
  const { t } = useTranslation();
  const { advancedMode, sidebarOpen, setSidebarOpen } = useUIStore();
  const [input, setInput] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;
    onSend(input.trim());
    setInput('');
    setShowActions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-[#0a0a0f]", className)}>
      {/* Header */}
      <header className="h-14 border-b border-white/[0.06] flex items-center justify-between px-4 bg-white/[0.02] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-400 hover:text-white hover:bg-white/[0.06] h-8 w-8"
          >
            <Menu className="h-4 w-4" />
          </Button>
          
          {/* Cato Avatar with Glow */}
          <div className="flex items-center gap-2.5">
            <motion.div 
              className="relative"
              animate={{ scale: isTyping ? [1, 1.05, 1] : 1 }}
              transition={{ duration: 1.5, repeat: isTyping ? Infinity : 0 }}
            >
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              {isTyping && (
                <motion.div 
                  className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 blur-md opacity-50"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.2, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </motion.div>
            <div>
              <span className="font-semibold text-white text-sm">Cato</span>
              {advancedMode && selectedModel && selectedModel !== 'auto' && (
                <span className="text-[10px] text-slate-500 block -mt-0.5">
                  {selectedModel}
                </span>
              )}
            </div>
          </div>

          {/* Mode Badge */}
          <motion.div layout>
            <Badge 
              variant="outline" 
              className={cn(
                "text-[10px] gap-1 transition-all duration-300",
                advancedMode 
                  ? "bg-violet-500/10 text-violet-400 border-violet-500/30" 
                  : "bg-white/[0.04] text-slate-400 border-white/[0.08]"
              )}
            >
              {advancedMode ? (
                <><Zap className="h-2.5 w-2.5" /> Advanced</>
              ) : (
                <><Sparkles className="h-2.5 w-2.5" /> Auto</>
              )}
            </Badge>
          </motion.div>
        </div>

        <div className="flex items-center gap-1.5">
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-white/[0.06] h-8 w-8">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onMouseEnter={() => setHoveredMessageId(message.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
              >
                {message.role === 'user' ? (
                  <UserMessage message={message} />
                ) : (
                  <AssistantMessage 
                    message={message}
                    showMetadata={advancedMode}
                    isHovered={hoveredMessageId === message.id}
                    onRate={onRate}
                    onRegenerate={onRegenerate}
                  />
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing Indicator */}
          {isTyping && !messages[messages.length - 1]?.isStreaming && (
            <TypingIndicator />
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-white/[0.06] p-4 bg-white/[0.02] backdrop-blur-xl">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit}>
            <GlassPanel className="relative">
              {/* Advanced Actions - Only visible in advanced mode */}
              <AnimatePresence>
                {advancedMode && showActions && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-b border-white/[0.06] overflow-hidden"
                  >
                    <div className="p-3 flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5 text-xs text-slate-400 hover:text-white">
                        <Code className="h-3.5 w-3.5" /> Upload
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5 text-xs text-slate-400 hover:text-white">
                        <Code className="h-3.5 w-3.5" /> Code
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5 text-xs text-slate-400 hover:text-white">
                        <Paperclip className="h-3.5 w-3.5" /> File
                      </Button>
                      <div className="flex-1" />
                      {selectedModel && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={onModelSelect}
                          className="h-7 px-2 gap-1.5 text-xs text-violet-400 hover:text-violet-300"
                        >
                          <Brain className="h-3.5 w-3.5" /> 
                          {selectedModel === 'auto' ? 'Auto Select' : selectedModel}
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main Input */}
              <div className="flex items-end gap-2 p-3">
                {advancedMode && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowActions(!showActions)}
                    className={cn(
                      "h-8 w-8 shrink-0 text-slate-500 hover:text-white transition-colors",
                      showActions && "text-violet-400"
                    )}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                )}

                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t(T.chat.placeholder)}
                  rows={1}
                  className={cn(
                    "flex-1 bg-transparent text-white placeholder:text-slate-500 resize-none",
                    "text-sm leading-relaxed outline-none",
                    "min-h-[24px] max-h-[120px]"
                  )}
                  style={{
                    height: 'auto',
                    overflow: 'hidden',
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                  }}
                />

                <div className="flex items-center gap-1.5 shrink-0">
                  {advancedMode && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-white"
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                  )}

                  <Button
                    type="submit"
                    disabled={!input.trim() || isTyping}
                    className={cn(
                      "h-8 w-8 rounded-lg transition-all duration-200",
                      input.trim() 
                        ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 shadow-lg shadow-violet-500/25" 
                        : "bg-slate-800 text-slate-500"
                    )}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </GlassPanel>

            {/* Keyboard Hint */}
            <p className="text-[10px] text-slate-600 text-center mt-2">
              {t(T.chat.keyboardHint)}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-end">
      <motion.div
        className="max-w-[85%] bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 rounded-2xl rounded-br-md px-4 py-3"
        whileHover={{ scale: 1.01 }}
      >
        <p className="text-sm text-white whitespace-pre-wrap">{message.content}</p>
        <span className="text-[10px] text-slate-500 mt-1 block">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </motion.div>
    </div>
  );
}

function AssistantMessage({ 
  message, 
  showMetadata,
  isHovered,
  onRate,
  onRegenerate,
}: { 
  message: ChatMessage; 
  showMetadata: boolean;
  isHovered: boolean;
  onRate?: (messageId: string, positive: boolean) => void;
  onRegenerate?: (messageId: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="shrink-0">
        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <GlassCard 
          variant="default" 
          padding="none" 
          hoverEffect={false}
          className="overflow-hidden"
        >
          <div className="px-4 py-3">
            <p className={cn(
              "text-sm text-slate-200 whitespace-pre-wrap",
              message.isStreaming && "animate-pulse"
            )}>
              {message.content}
              {message.isStreaming && (
                <motion.span
                  className="inline-block w-2 h-4 bg-violet-400 ml-0.5"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
              )}
            </p>
          </div>

          {/* Metadata - Advanced Mode Only */}
          <AnimatePresence>
            {showMetadata && message.metadata && !message.isStreaming && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-white/[0.06] px-4 py-2 bg-white/[0.02]"
              >
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  {message.metadata.modelUsed && (
                    <span className="flex items-center gap-1">
                      <Brain className="h-3 w-3" />
                      {message.metadata.modelUsed}
                    </span>
                  )}
                  {message.metadata.tokensUsed && (
                    <span>{message.metadata.tokensUsed} tokens</span>
                  )}
                  {message.metadata.latencyMs && (
                    <span>{message.metadata.latencyMs}ms</span>
                  )}
                  {message.metadata.orchestrationMode && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                      {message.metadata.orchestrationMode}
                    </Badge>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions - Show on hover */}
          <AnimatePresence>
            {isHovered && !message.isStreaming && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-white/[0.06] px-3 py-1.5 flex items-center gap-1"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-slate-500 hover:text-white"
                  onClick={handleCopy}
                >
                  {copied ? <Star className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                </Button>
                {onRate && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-slate-500 hover:text-green-400"
                      onClick={() => onRate(message.id, true)}
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-slate-500 hover:text-red-400"
                      onClick={() => onRate(message.id, false)}
                    >
                      <ThumbsDown className="h-3 w-3" />
                    </Button>
                  </>
                )}
                {onRegenerate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-slate-500 hover:text-violet-400"
                    onClick={() => onRegenerate(message.id)}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>

        {/* Timestamp */}
        <span className="text-[10px] text-slate-600 mt-1 block">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
        <Sparkles className="h-4 w-4 text-white" />
      </div>
      <GlassCard variant="default" padding="sm" hoverEffect={false}>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 bg-violet-400 rounded-full"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      </GlassCard>
    </motion.div>
  );
}
