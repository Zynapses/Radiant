'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, ThumbsUp, ThumbsDown, MoreHorizontal, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Message } from '@/lib/api/types';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  showMetadata?: boolean;
  onCopy?: () => void;
  onRate?: (positive: boolean) => void;
}

export function MessageBubble({ 
  message, 
  isStreaming, 
  showMetadata,
  onCopy,
  onRate 
}: MessageBubbleProps) {
  const [copied, setCopied] = React.useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('flex gap-3', isUser ? 'justify-end' : '')}
    >
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/20">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
      )}
      
      <div className={cn('max-w-[80%] group', isUser ? 'order-first' : '')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 transition-all',
            isUser
              ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/20'
              : 'bg-slate-800/80 text-slate-100 border border-slate-700/50'
          )}
        >
          <div className="text-sm whitespace-pre-wrap leading-relaxed">
            {message.content}
            {isStreaming && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="inline-block w-2 h-4 bg-violet-400 ml-1 rounded-sm"
              />
            )}
          </div>
        </div>

        {showMetadata && message.metadata && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-2 flex items-center gap-2 text-xs text-slate-500"
          >
            {message.metadata.modelUsed && (
              <Badge variant="outline" className="text-xs">
                {message.metadata.modelUsed}
              </Badge>
            )}
            {message.metadata.tokensUsed && (
              <span>{message.metadata.tokensUsed} tokens</span>
            )}
            {message.metadata.latencyMs && (
              <span>{message.metadata.latencyMs}ms</span>
            )}
            {message.metadata.costEstimate && (
              <span>${message.metadata.costEstimate.toFixed(4)}</span>
            )}
          </motion.div>
        )}

        {!isUser && !isStreaming && (
          <div className="mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-slate-500 hover:text-slate-300"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-slate-500 hover:text-green-500"
              onClick={() => onRate?.(true)}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-slate-500 hover:text-red-500"
              onClick={() => onRate?.(false)}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-slate-500 hover:text-slate-300"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {isUser && (
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0 text-white text-sm font-medium shadow-lg shadow-blue-500/20">
          U
        </div>
      )}
    </motion.div>
  );
}
