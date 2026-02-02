'use client';

/**
 * CompiledPromptPreview - Shows the compiled optimized prompt
 * 
 * Displays the system prompt and user prompt with editing capability,
 * token count, and selected model information.
 * 
 * @version 2.0.0
 * @since RADIANT v6.0.0
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  CheckCircle2, 
  Edit3, 
  Copy, 
  Check,
  Cpu,
  FileText,
  Sparkles 
} from 'lucide-react';

interface CompiledPromptPreviewProps {
  systemPrompt: string;
  userPrompt: string;
  modelId: string;
  modelName: string;
  tokenCount?: number;
  onEdit?: (systemPrompt: string, userPrompt: string) => void;
  className?: string;
}

export function CompiledPromptPreview({
  systemPrompt,
  userPrompt,
  modelId,
  modelName,
  tokenCount,
  onEdit,
  className,
}: CompiledPromptPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSystem, setEditedSystem] = useState(systemPrompt);
  const [editedUser, setEditedUser] = useState(userPrompt);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const fullPrompt = `System:\n${systemPrompt}\n\nUser:\n${userPrompt}`;
    await navigator.clipboard.writeText(fullPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (onEdit) {
      onEdit(editedSystem, editedUser);
    }
    setIsEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl bg-gradient-to-b from-green-500/10 to-emerald-500/5',
        'border border-green-500/20 overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="px-5 py-3 bg-black/20 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-green-500/20">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-white">Optimized Prompt</h4>
            <p className="text-xs text-white/50">Ready to execute</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Model & Stats */}
      <div className="px-5 py-3 bg-white/5 border-b border-white/10 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-indigo-400" />
          <span className="text-sm text-white/80">{modelName}</span>
        </div>
        {tokenCount && (
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-white/60">{tokenCount.toLocaleString()} tokens</span>
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-white/50">AXIOM optimized</span>
        </div>
      </div>

      {/* Prompt Content */}
      <div className="p-5 space-y-4">
        {/* System Prompt */}
        <div>
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2 block">
            System Prompt
          </label>
          {isEditing ? (
            <textarea
              value={editedSystem}
              onChange={(e) => setEditedSystem(e.target.value)}
              className={cn(
                'w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10',
                'text-sm text-white/90 font-mono resize-none',
                'focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20'
              )}
              rows={6}
            />
          ) : (
            <div className={cn(
              'px-4 py-3 rounded-lg bg-white/5 border border-white/10',
              'text-sm text-white/80 font-mono whitespace-pre-wrap',
              'max-h-48 overflow-y-auto'
            )}>
              {systemPrompt}
            </div>
          )}
        </div>

        {/* User Prompt */}
        <div>
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2 block">
            User Prompt
          </label>
          {isEditing ? (
            <textarea
              value={editedUser}
              onChange={(e) => setEditedUser(e.target.value)}
              className={cn(
                'w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10',
                'text-sm text-white/90 font-mono resize-none',
                'focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20'
              )}
              rows={4}
            />
          ) : (
            <div className={cn(
              'px-4 py-3 rounded-lg bg-white/5 border border-white/10',
              'text-sm text-white/80 font-mono whitespace-pre-wrap',
              'max-h-32 overflow-y-auto'
            )}>
              {userPrompt}
            </div>
          )}
        </div>

        {/* Edit Actions */}
        {isEditing && (
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setEditedSystem(systemPrompt);
                setEditedUser(userPrompt);
                setIsEditing(false);
              }}
              className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 hover:bg-indigo-400 text-white transition-colors"
            >
              Save Changes
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
