'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Paperclip, Mic, Sparkles, Zap, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/lib/stores/ui-store';
import { ModelSelector } from './ModelSelector';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  selectedModel?: string;
  onModelSelect?: (modelId: string) => void;
  onAttachFile?: () => void;
  onVoiceInput?: () => void;
}

export function ChatInput({ 
  onSend, 
  isLoading, 
  placeholder = 'Message Cato...',
  selectedModel = 'auto',
  onModelSelect,
  onAttachFile,
  onVoiceInput,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { advancedMode } = useUIStore();
  
  const handleModelSelect = (modelId: string) => {
    onModelSelect?.(modelId);
    setIsModelSelectorOpen(false);
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-slate-800/50 p-4 bg-[#0d0d14]/80 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto">
        {advancedMode && selectedModel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-2 flex items-center gap-2"
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-slate-400 hover:text-slate-200"
              onClick={() => setIsModelSelectorOpen(true)}
            >
              <Zap className="h-3 w-3 mr-1" />
              {selectedModel === 'auto' ? 'Auto Mode' : selectedModel}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </motion.div>
        )}

        <div className={cn(
          'relative flex items-end gap-2 rounded-2xl p-2 border transition-all duration-200',
          'bg-slate-800/60 border-slate-700/50',
          'focus-within:border-violet-500/50 focus-within:ring-1 focus-within:ring-violet-500/20'
        )}>
          <Button 
            variant="ghost" 
            size="icon-sm"
            className="text-slate-400 hover:text-slate-200 shrink-0"
            onClick={onAttachFile}
            title="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            className={cn(
              'flex-1 min-h-[44px] max-h-[200px] resize-none bg-transparent',
              'text-white placeholder:text-slate-500 focus:outline-none text-sm py-2',
              'disabled:opacity-50'
            )}
            rows={1}
          />

          <Button 
            variant="ghost" 
            size="icon-sm"
            className="text-slate-400 hover:text-slate-200 shrink-0"
            onClick={onVoiceInput}
            title="Voice input"
          >
            <Mic className="h-5 w-5" />
          </Button>

          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={cn(
              'shrink-0 rounded-xl transition-all duration-200',
              input.trim() && !isLoading
                ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-500/25'
                : 'bg-slate-700 opacity-50'
            )}
            size="icon-sm"
          >
            <Send className="h-4 w-4 text-white" />
          </Button>
        </div>

        <div className="mt-2 flex items-center justify-center gap-2">
          <Sparkles className="h-3 w-3 text-violet-400" />
          <p className="text-xs text-slate-500">
            {advancedMode 
              ? 'Advanced Mode • Select your model and settings'
              : 'Auto Mode • Cato optimizes everything for you'}
          </p>
        </div>
      </div>
      
      {/* Model Selector Dialog */}
      <ModelSelector
        isOpen={isModelSelectorOpen}
        onClose={() => setIsModelSelectorOpen(false)}
        selectedModel={selectedModel}
        onSelectModel={handleModelSelect}
      />
    </div>
  );
}
