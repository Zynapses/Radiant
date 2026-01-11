'use client';

/**
 * Terminal View (Sniper Mode - Command Center)
 * 
 * PROMPT-41 Polymorphic UI
 * 
 * Fast execution view for quick commands and lookups.
 * Shows output in terminal-style format with execution feedback.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Zap, Send, Copy, Check, Clock, Terminal, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ViewComponentProps } from '../view-router';

interface TerminalEntry {
  id: string;
  type: 'command' | 'output' | 'error' | 'info';
  content: string;
  timestamp: Date;
  executionMs?: number;
  costCents?: number;
}

export function TerminalView({ 
  data, 
  projectId, 
  sessionId,
  mode, 
  onUpdateView,
  onEscalate 
}: ViewComponentProps) {
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize with data payload entries
  useEffect(() => {
    if (data.entries && Array.isArray(data.entries)) {
      setEntries(data.entries as TerminalEntry[]);
    }
    if (data.output) {
      setEntries(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'output',
        content: String(data.output),
        timestamp: new Date(),
      }]);
    }
  }, [data]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    const command = inputValue.trim();
    setInputValue('');
    setIsProcessing(true);

    // Add command entry
    const commandEntry: TerminalEntry = {
      id: crypto.randomUUID(),
      type: 'command',
      content: command,
      timestamp: new Date(),
    };
    setEntries(prev => [...prev, commandEntry]);

    // Simulate Sniper execution (in real implementation, this calls the API)
    const startTime = Date.now();
    
    try {
      // In production, this would call the Think Tank API
      // For now, we simulate a fast response
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
      
      const executionMs = Date.now() - startTime;
      
      // Add output entry
      const outputEntry: TerminalEntry = {
        id: crypto.randomUUID(),
        type: 'output',
        content: `[Sniper] Processing: ${command}\n\nExecuting with Ghost Memory context hydration...\nResponse generated in ${executionMs}ms.\n\n> Ready for next command.`,
        timestamp: new Date(),
        executionMs,
        costCents: 1,
      };
      setEntries(prev => [...prev, outputEntry]);
      
    } catch (error) {
      const errorEntry: TerminalEntry = {
        id: crypto.randomUUID(),
        type: 'error',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setEntries(prev => [...prev, errorEntry]);
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  };

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleEscalateEntry = (entry: TerminalEntry) => {
    onEscalate('insufficient_depth', `Original query: ${entry.content}`);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 font-mono text-sm">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-green-500" />
          <span className="text-xs text-zinc-400">sniper@radiant</span>
          <Badge variant="outline" className="h-5 text-[10px] bg-green-500/10 text-green-400 border-green-500/30">
            <Zap className="w-2.5 h-2.5 mr-1" />
            SNIPER MODE
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>Project: {projectId.slice(0, 8)}...</span>
        </div>
      </div>

      {/* Terminal Output */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-3">
          {/* Welcome message */}
          {entries.length === 0 && (
            <div className="text-zinc-500">
              <p className="text-green-500 mb-2">{'>'} RADIANT Sniper Mode v5.5.0</p>
              <p>Ghost Memory hydrated. Ready for fast execution.</p>
              <p className="mt-2 text-zinc-600">Type a command or query below. Press Enter to execute.</p>
              <p className="text-zinc-600">Use the Escalate button if you need deeper analysis.</p>
            </div>
          )}

          {/* Command/Output entries */}
          {entries.map((entry) => (
            <div 
              key={entry.id}
              className={cn(
                "group",
                entry.type === 'error' && 'text-red-400',
                entry.type === 'info' && 'text-blue-400',
              )}
            >
              {/* Command line */}
              {entry.type === 'command' && (
                <div className="flex items-start gap-2">
                  <span className="text-green-500 shrink-0">{'>'}</span>
                  <span className="text-zinc-100">{entry.content}</span>
                </div>
              )}

              {/* Output block */}
              {entry.type === 'output' && (
                <div className="pl-4 border-l-2 border-zinc-800 mt-1">
                  <pre className="whitespace-pre-wrap text-zinc-300">{entry.content}</pre>
                  
                  {/* Metadata and actions */}
                  <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {entry.executionMs && (
                      <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {entry.executionMs}ms
                      </span>
                    )}
                    {entry.costCents && (
                      <span className="text-[10px] text-zinc-600">
                        ${(entry.costCents / 100).toFixed(2)}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[10px] text-zinc-500 hover:text-zinc-300"
                      onClick={() => handleCopy(entry.content, entry.id)}
                    >
                      {copiedId === entry.id ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[10px] text-purple-500 hover:text-purple-400"
                      onClick={() => handleEscalateEntry(entry)}
                    >
                      <ArrowUp className="w-3 h-3 mr-1" />
                      Escalate
                    </Button>
                  </div>
                </div>
              )}

              {/* Error block */}
              {entry.type === 'error' && (
                <div className="pl-4 border-l-2 border-red-800 mt-1">
                  <pre className="whitespace-pre-wrap">{entry.content}</pre>
                </div>
              )}
            </div>
          ))}

          {/* Processing indicator */}
          {isProcessing && (
            <div className="flex items-center gap-2 text-zinc-500">
              <span className="text-green-500">{'>'}</span>
              <span className="animate-pulse">Processing...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="border-t border-zinc-800 p-3 bg-zinc-900/30">
        <div className="flex items-center gap-2">
          <span className="text-green-500 shrink-0">{'>'}</span>
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter command or query..."
            disabled={isProcessing}
            className="flex-1 bg-transparent border-none text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:ring-offset-0 font-mono"
          />
          <Button 
            type="submit" 
            size="sm"
            disabled={!inputValue.trim() || isProcessing}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
