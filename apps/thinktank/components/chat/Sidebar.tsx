'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, MessageSquare, Star, Clock, Settings, Search, 
  Sparkles, Trash2, BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, groupConversationsByDate } from '@/lib/utils';
import type { Conversation } from '@/lib/api/types';

interface SidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  isLoading?: boolean;
  user?: { name?: string; email?: string } | null;
  isAuthenticated?: boolean;
}

export function Sidebar({
  conversations,
  currentConversationId,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  isLoading,
  user,
  isAuthenticated
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filteredConversations = searchQuery
    ? conversations.filter(c => 
        c.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  const grouped = groupConversationsByDate(filteredConversations);

  return (
    <div className="flex flex-col h-full bg-[#0d0d14]">
      {/* Logo */}
      <div className="p-4 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-white text-lg">Think Tank</span>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <Button 
          onClick={onNewConversation}
          className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-500/20"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles className="h-5 w-5 text-violet-400" />
            </motion.div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            {searchQuery ? 'No matching conversations' : 
              isAuthenticated ? 'No conversations yet' : 'Sign in to save conversations'}
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.today.length > 0 && (
              <ConversationGroup
                title="Today"
                conversations={grouped.today}
                currentId={currentConversationId}
                hoveredId={hoveredId}
                onSelect={onSelectConversation}
                onDelete={onDeleteConversation}
                onHover={setHoveredId}
              />
            )}
            {grouped.yesterday.length > 0 && (
              <ConversationGroup
                title="Yesterday"
                conversations={grouped.yesterday}
                currentId={currentConversationId}
                hoveredId={hoveredId}
                onSelect={onSelectConversation}
                onDelete={onDeleteConversation}
                onHover={setHoveredId}
              />
            )}
            {grouped.lastWeek.length > 0 && (
              <ConversationGroup
                title="Last 7 Days"
                conversations={grouped.lastWeek}
                currentId={currentConversationId}
                hoveredId={hoveredId}
                onSelect={onSelectConversation}
                onDelete={onDeleteConversation}
                onHover={setHoveredId}
              />
            )}
            {grouped.older.length > 0 && (
              <ConversationGroup
                title="Older"
                conversations={grouped.older}
                currentId={currentConversationId}
                hoveredId={hoveredId}
                onSelect={onSelectConversation}
                onDelete={onDeleteConversation}
                onHover={setHoveredId}
              />
            )}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="p-3 border-t border-slate-800/50 space-y-1">
        <Link href="/rules" className="flex items-center gap-2 text-slate-400 hover:bg-slate-800/50 rounded-lg px-2 py-2 transition-colors">
          <BookOpen className="h-4 w-4" />
          <span className="text-sm">My Rules</span>
        </Link>
        <Link href="/history" className="flex items-center gap-2 text-slate-400 hover:bg-slate-800/50 rounded-lg px-2 py-2 transition-colors">
          <Clock className="h-4 w-4" />
          <span className="text-sm">History</span>
        </Link>
        <Link href="/settings" className="flex items-center gap-2 text-slate-400 hover:bg-slate-800/50 rounded-lg px-2 py-2 transition-colors">
          <Settings className="h-4 w-4" />
          <span className="text-sm">Settings</span>
        </Link>
      </div>

      {/* User Profile */}
      <div className="p-3 border-t border-slate-800/50">
        {isAuthenticated && user ? (
          <Link href="/profile" className="flex items-center gap-3 hover:bg-slate-800/50 rounded-lg p-2 transition-colors">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-medium shadow-lg shadow-blue-500/20">
              {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{user.name || user.email}</div>
              <div className="text-xs text-slate-500">Free Plan</div>
            </div>
          </Link>
        ) : (
          <Link 
            href="/login" 
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg py-2 px-4 transition-colors text-sm"
          >
            Sign In
          </Link>
        )}
      </div>
    </div>
  );
}

function ConversationGroup({
  title,
  conversations,
  currentId,
  hoveredId,
  onSelect,
  onDelete,
  onHover
}: {
  title: string;
  conversations: Conversation[];
  currentId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500 px-2 py-2">{title}</div>
      <div className="space-y-1">
        {conversations.map((conv) => (
          <motion.button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            onMouseEnter={() => onHover(conv.id)}
            onMouseLeave={() => onHover(null)}
            className={cn(
              'w-full text-left flex items-center gap-2 rounded-lg px-2 py-2 transition-all group',
              currentId === conv.id
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'text-slate-400 hover:bg-slate-800/50 border border-transparent'
            )}
            whileHover={{ x: 2 }}
            transition={{ duration: 0.1 }}
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span className="truncate text-sm flex-1">{conv.title}</span>
            {conv.isFavorite && (
              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
            )}
            <AnimatePresence>
              {hoveredId === conv.id && onDelete && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                  className="text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </motion.button>
              )}
            </AnimatePresence>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
