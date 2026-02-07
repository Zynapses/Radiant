'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Send,
  Loader2,
  Shield,
  FileText,
  ExternalLink,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BookOpen,
  Plus,
  MessageSquare,
} from 'lucide-react';
import { useCatoTrainerStore } from '@/lib/cato-trainer-store';
import {
  sendMessage,
  createChatSession,
  type ChatMessage,
  type Citation,
} from '@/lib/api';
import { cn, confidenceColor, confidenceLabel } from '@/lib/utils';

export function ChatPanel() {
  const {
    tenantId,
    activeChatSession,
    setActiveChatSession,
    addChatMessage,
    isChatLoading,
    setIsChatLoading,
    activeLibrary,
    activeSpace,
    selectedDocumentIds,
  } = useCatoTrainerStore();

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeChatSession?.messages]);

  const startSessionMutation = useMutation({
    mutationFn: () =>
      createChatSession(tenantId, {
        library_id: activeLibrary?.id,
        space_id: activeSpace?.id,
        scope_document_ids: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
      }),
    onSuccess: (data) => setActiveChatSession(data.session),
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => {
      setIsChatLoading(true);
      return sendMessage(activeChatSession!.id, content);
    },
    onSuccess: (data) => {
      addChatMessage(data.message);
      setIsChatLoading(false);
    },
    onError: () => setIsChatLoading(false),
  });

  const handleSend = () => {
    if (!input.trim() || isChatLoading) return;
    const content = input.trim();
    setInput('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      citations: [],
      created_at: new Date().toISOString(),
      confidence_score: null,
      grounded: false,
      thinking_steps: [],
    };
    addChatMessage(userMsg);
    sendMutation.mutate(content);
  };

  // No active session — prompt to start
  if (!activeChatSession) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cato-500 to-cato-700 flex items-center justify-center cato-glow mb-6">
          <Shield className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Ask Cato</h2>
        <p className="text-sm text-white/40 text-center max-w-md mb-2">
          The Grounding Engine. Get instant, citable answers drawn exclusively from your document library.
          Every response is backed by verifiable sources.
        </p>
        <p className="text-xs text-white/25 text-center max-w-sm mb-8">
          {activeLibrary ? `Scoped to: ${activeLibrary.name}` : 'Select a library first, or ask across all documents'}
          {selectedDocumentIds.length > 0 && ` · ${selectedDocumentIds.length} document${selectedDocumentIds.length > 1 ? 's' : ''} selected`}
        </p>

        <button
          onClick={() => startSessionMutation.mutate()}
          disabled={startSessionMutation.isPending}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-cato-600 hover:bg-cato-500 text-white text-sm font-medium transition-colors disabled:opacity-40"
        >
          {startSessionMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Start Conversation
        </button>

        {/* Suggested prompts */}
        <div className="mt-10 space-y-2 w-full max-w-lg">
          <p className="text-[10px] uppercase tracking-wider text-white/15 mb-3">Try asking</p>
          {[
            'What are the key findings across all uploaded reports?',
            'Summarize the main policies in this library',
            'Are there any contradictions between these documents?',
            'What does the data say about quarterly performance?',
          ].map((prompt) => (
            <button
              key={prompt}
              onClick={() => {
                if (!activeChatSession) startSessionMutation.mutate();
                setInput(prompt);
              }}
              className="w-full text-left px-4 py-3 rounded-lg bg-white/[0.02] border border-white/[0.04] text-sm text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
            >
              <Sparkles className="w-3 h-3 inline mr-2 text-cato-500/50" />
              {prompt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Active chat session
  const messages = activeChatSession.messages;

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-cato-400" />
          <span className="text-sm font-medium text-white/70">{activeChatSession.title || 'New Conversation'}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/20">
          {activeLibrary && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.03]">
              <BookOpen className="w-3 h-3" /> {activeLibrary.name}
            </span>
          )}
          <span>{messages.length} message{messages.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isChatLoading && (
          <div className="flex items-start gap-3 max-w-[85%]">
            <div className="w-7 h-7 rounded-lg bg-cato-500/10 flex items-center justify-center flex-shrink-0">
              <Shield className="w-3.5 h-3.5 text-cato-400" />
            </div>
            <div className="cato-bubble px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-cato-400/60 typing-dot" />
                <div className="w-2 h-2 rounded-full bg-cato-400/60 typing-dot" />
                <div className="w-2 h-2 rounded-full bg-cato-400/60 typing-dot" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-white/[0.04]">
        <div className="flex items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask Cato anything about your documents..."
            rows={1}
            className="flex-1 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 placeholder:text-white/15 resize-none focus:border-cato-500/30 focus:outline-none min-h-[44px] max-h-32"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isChatLoading}
            className="w-10 h-10 rounded-xl bg-cato-600 hover:bg-cato-500 flex items-center justify-center text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-white/10 mt-2">
          Cato grounds every answer in your document library. All responses include verifiable citations.
        </p>
      </div>
    </div>
  );
}

// ── Message Bubble ──────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const [showCitations, setShowCitations] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex items-start gap-3', isUser ? 'flex-row-reverse' : '')}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-cato-500/10 flex items-center justify-center flex-shrink-0">
          <Shield className="w-3.5 h-3.5 text-cato-400" />
        </div>
      )}

      {/* Bubble */}
      <div className={cn('max-w-[80%]', isUser ? 'ml-auto' : '')}>
        <div className={cn(
          'px-4 py-3 rounded-xl',
          isUser ? 'user-bubble' : 'cato-bubble'
        )}>
          <div className={cn('text-sm leading-relaxed cato-prose', isUser ? 'text-white/80' : 'text-white/70')}>
            {message.content}
          </div>
        </div>

        {/* Citations bar */}
        {!isUser && message.citations.length > 0 && (
          <div className="mt-1.5">
            <button
              onClick={() => setShowCitations(!showCitations)}
              className="flex items-center gap-1.5 text-[10px] text-ground-400/60 hover:text-ground-400 transition-colors"
            >
              <CheckCircle2 className="w-3 h-3" />
              {message.citations.length} source{message.citations.length !== 1 ? 's' : ''}
              {message.confidence_score !== null && (
                <span className={cn('ml-1', confidenceColor(message.confidence_score))}>
                  · {confidenceLabel(message.confidence_score)}
                </span>
              )}
              {showCitations ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showCitations && (
              <div className="mt-2 space-y-2">
                {message.citations.map((cite) => (
                  <CitationCard key={cite.id} citation={cite} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Citation Card ───────────────────────────────────────────────────────────

function CitationCard({ citation }: { citation: Citation }) {
  return (
    <div className="citation-highlight rounded-lg py-2 pr-3 card-reveal">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <FileText className="w-3 h-3 text-white/20" />
          <span className="text-[10px] font-medium text-white/40 truncate max-w-[200px]">
            {citation.document_title}
          </span>
          {citation.page_number && (
            <span className="text-[10px] text-white/15">p.{citation.page_number}</span>
          )}
        </div>
        <span className={cn('text-[10px]', confidenceColor(citation.relevance_score))}>
          {Math.round(citation.relevance_score * 100)}%
        </span>
      </div>
      <p className="text-[11px] text-white/50 leading-relaxed italic">
        &ldquo;{citation.exact_quote}&rdquo;
      </p>
      {citation.section_title && (
        <p className="text-[10px] text-white/15 mt-1">§ {citation.section_title}</p>
      )}
    </div>
  );
}
