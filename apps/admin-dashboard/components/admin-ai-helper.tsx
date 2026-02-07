'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import {
  Bot, Send, X, Minimize2, Maximize2, Trash2, Sparkles,
  Loader2, ChevronDown, MessageSquare, AlertCircle,
} from 'lucide-react';

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  modelId?: string;
  latencyMs?: number;
  costCents?: number;
}

interface AIHelperResponse {
  message: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costCents: number;
}

const AI_HELPER_API = '/api/admin/ai-helper';

async function chatWithHelper(
  message: string,
  adminPage: string,
  conversationHistory: AIMessage[],
  pageContext?: Record<string, unknown>
): Promise<AIHelperResponse> {
  const res = await fetch(`${AI_HELPER_API}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      adminPage,
      pageContext,
      conversationHistory: conversationHistory.map(m => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function MarkdownContent({ content }: { content: string }) {
  // Simple markdown rendering for bold, code, headers, lists
  const lines = content.split('\n');
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) {
          return <h4 key={i} className="font-semibold text-white mt-2">{line.slice(4)}</h4>;
        }
        if (line.startsWith('## ')) {
          return <h3 key={i} className="font-bold text-white mt-3 text-base">{line.slice(3)}</h3>;
        }
        if (line.startsWith('# ')) {
          return <h2 key={i} className="font-bold text-white mt-3 text-lg">{line.slice(2)}</h2>;
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <li key={i} className="ml-4 list-disc">{renderInline(line.slice(2))}</li>;
        }
        if (line.startsWith('```')) {
          return null; // Skip code fence markers
        }
        if (line.trim() === '') {
          return <div key={i} className="h-1" />;
        }
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // Bold, inline code, and regular text
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Inline code
    const codeMatch = remaining.match(/`([^`]+)`/);

    let firstMatch: { index: number; length: number; node: React.ReactNode } | null = null;

    if (boldMatch && boldMatch.index !== undefined) {
      const candidate = { index: boldMatch.index, length: boldMatch[0].length, node: <strong key={key++} className="font-semibold text-white">{boldMatch[1]}</strong> };
      if (!firstMatch || candidate.index < firstMatch.index) firstMatch = candidate;
    }
    if (codeMatch && codeMatch.index !== undefined) {
      const candidate = { index: codeMatch.index, length: codeMatch[0].length, node: <code key={key++} className="bg-slate-700 px-1 py-0.5 rounded text-xs font-mono text-emerald-300">{codeMatch[1]}</code> };
      if (!firstMatch || candidate.index < firstMatch.index) firstMatch = candidate;
    }

    if (firstMatch) {
      if (firstMatch.index > 0) {
        parts.push(remaining.slice(0, firstMatch.index));
      }
      parts.push(firstMatch.node);
      remaining = remaining.slice(firstMatch.index + firstMatch.length);
    } else {
      parts.push(remaining);
      break;
    }
  }

  return <>{parts}</>;
}

/**
 * AdminAIHelper - Global AI assistant component.
 * Auto-injected into the dashboard layout. Available on every admin page.
 * Uses the current page path to provide contextual help.
 */
export default function AdminAIHelper() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  // Clear conversation when page changes
  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [pathname]);

  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || loading) return;

    setInput('');
    setError(null);

    const userMessage: AIMessage = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      // Collect page context from the DOM (data attributes on the main content area)
      let pageContext: Record<string, unknown> = {};
      try {
        const mainEl = document.querySelector('main');
        if (mainEl) {
          const contextEl = mainEl.querySelector('[data-ai-context]');
          if (contextEl) {
            pageContext = JSON.parse(contextEl.getAttribute('data-ai-context') || '{}');
          }
        }
      } catch { /* ignore context parsing errors */ }

      const response = await chatWithHelper(
        msg,
        pathname || 'unknown',
        messages,
        pageContext
      );

      const assistantMessage: AIMessage = {
        role: 'assistant',
        content: response.message,
        modelId: response.modelId,
        latencyMs: response.latencyMs,
        costCents: response.costCents,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, pathname]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setError(null);
    // Also clear on server
    fetch(`${AI_HELPER_API}/history?page=${encodeURIComponent(pathname || 'unknown')}`, { method: 'DELETE' }).catch(() => {});
  };

  const pageName = pathname?.split('/').filter(Boolean).pop() || 'Dashboard';

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-full p-4 shadow-2xl shadow-indigo-500/25 transition-all hover:scale-105 group"
        title="AI Assistant"
      >
        <Sparkles className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500" />
        </span>
      </button>
    );
  }

  // Minimized bar
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setIsMinimized(false)}>
        <Sparkles className="h-4 w-4 text-purple-400" />
        <span className="text-sm text-white font-medium">AI Assistant</span>
        {messages.length > 0 && (
          <span className="bg-indigo-600 text-white text-xs rounded-full px-2 py-0.5">{messages.length}</span>
        )}
        <Maximize2 className="h-4 w-4 text-slate-400 hover:text-white" />
      </div>
    );
  }

  // Full panel
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[600px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-400" />
          <div>
            <span className="text-sm font-semibold text-white">AI Assistant</span>
            <span className="text-xs text-slate-400 ml-2">{pageName}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleClear} className="p-1.5 hover:bg-slate-700/50 rounded-lg" title="Clear conversation">
            <Trash2 className="h-4 w-4 text-slate-400 hover:text-white" />
          </button>
          <button onClick={() => setIsMinimized(true)} className="p-1.5 hover:bg-slate-700/50 rounded-lg" title="Minimize">
            <Minimize2 className="h-4 w-4 text-slate-400 hover:text-white" />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-slate-700/50 rounded-lg" title="Close">
            <X className="h-4 w-4 text-slate-400 hover:text-white" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Bot className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Ask me anything about this page.</p>
            <p className="text-xs text-slate-500 mt-1">I can analyze data, recommend changes, and explain causal effects.</p>
            <div className="mt-4 space-y-2">
              {[
                'What should I optimize on this page?',
                'Explain the current metrics',
                'What are the risks of changing these settings?',
              ].map((suggestion, i) => (
                <button key={i} onClick={() => { setInput(suggestion); }}
                  className="block w-full text-left px-3 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg text-xs text-slate-300 transition-colors">
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-200 border border-slate-700/50'
            }`}>
              {msg.role === 'assistant' ? (
                <MarkdownContent content={msg.content} />
              ) : (
                <p className="text-sm">{msg.content}</p>
              )}
              {msg.role === 'assistant' && msg.latencyMs != null && (
                <div className="mt-2 pt-1 border-t border-slate-700/50 flex items-center gap-3 text-xs text-slate-500">
                  <span>{msg.modelId?.split('.').pop()}</span>
                  <span>{msg.latencyMs}ms</span>
                  {msg.costCents != null && <span>${(msg.costCents / 100).toFixed(4)}</span>}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700/50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span className="text-sm text-red-300">{error}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-700 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this page..."
            rows={1}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 max-h-24"
            style={{ minHeight: '38px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl p-2.5 transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
