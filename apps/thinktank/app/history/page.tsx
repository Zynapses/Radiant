'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, Search, MessageSquare, Star, Trash2, Clock, Filter, Calendar,
  Sparkles, LayoutGrid, List, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GlassCard, GlassPanel } from '@/components/ui/glass-card';
import { InteractiveTimeline, HorizontalTimeline, type TimelineItem } from '@/components/ui/timeline';
import { chatService } from '@/lib/api/chat';
import { cn, formatRelativeTime } from '@/lib/utils';
import { useTranslation, T } from '@/lib/i18n';
import { useRouter } from 'next/navigation';

type FilterPeriod = 'all' | 'today' | 'week' | 'month' | 'year';
type SortBy = 'recent' | 'oldest' | 'messages' | 'favorites';

export default function HistoryPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'timeline' | 'grid' | 'list'>('timeline');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations-history'],
    queryFn: () => chatService.listConversations(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => chatService.deleteConversation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations-history'] }),
  });

  const filteredConversations = conversations
    .filter((conv) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return conv.title.toLowerCase().includes(query) || 
               conv.lastMessage?.toLowerCase().includes(query);
      }
      return true;
    })
    .filter((conv) => {
      if (filterPeriod === 'all') return true;
      const date = new Date(conv.updatedAt);
      const now = new Date();
      switch (filterPeriod) {
        case 'today':
          return date.toDateString() === now.toDateString();
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return date >= weekAgo;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return date >= monthAgo;
        case 'year':
          return date.getFullYear() === now.getFullYear();
        default:
          return true;
      }
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'oldest':
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case 'messages':
          return (b.messageCount || 0) - (a.messageCount || 0);
        case 'favorites':
          return (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0);
        default:
          return 0;
      }
    });

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} conversation(s)?`)) return;
    for (const id of selectedIds) {
      await deleteMutation.mutateAsync(id);
    }
    setSelectedIds(new Set());
  };

  // Convert conversations to timeline items
  const timelineItems: TimelineItem[] = filteredConversations.map((conv) => ({
    id: conv.id,
    title: conv.title,
    preview: conv.lastMessage,
    timestamp: new Date(conv.updatedAt),
    type: 'conversation',
    isFavorite: conv.isFavorite,
    messageCount: conv.messageCount,
    mode: conv.domainMode ? 'advanced' : 'auto',
    domainHint: conv.domainMode,
  }));

  const handleTimelineSelect = (item: TimelineItem) => {
    setSelectedConversation(item.id);
    router.push(`/?conversation=${item.id}`);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <header className="sticky top-0 z-10 h-14 border-b border-slate-800/50 flex items-center px-4 bg-[#0d0d14]/80 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm">{t(T.common.back)}</span>
        </Link>
        <h1 className="flex-1 text-center font-semibold text-white">{t(T.history.title)}</h1>
        
        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('timeline')}
            className={cn("h-7 w-7 p-0", viewMode === 'timeline' && "bg-violet-500/20 text-violet-400")}
          >
            <Sparkles className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('grid')}
            className={cn("h-7 w-7 p-0", viewMode === 'grid' && "bg-violet-500/20 text-violet-400")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('list')}
            className={cn("h-7 w-7 p-0", viewMode === 'list' && "bg-violet-500/20 text-violet-400")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Search and Filters */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder={t(T.history.searchHistory)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'border-violet-500/50' : ''}
          >
            <Filter className="h-4 w-4 mr-2" />
            {t(T.history.filters)}
          </Button>
          {selectedIds.size > 0 && (
            <Button variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete ({selectedIds.size})
            </Button>
          )}
        </div>

        {/* Filter Options */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700/50"
          >
            <div className="space-y-2">
              <label className="text-xs text-slate-400">{t(T.history.timePeriod)}</label>
              <div className="flex gap-2">
                {(['all', 'today', 'week', 'month', 'year'] as FilterPeriod[]).map((period) => (
                  <Button
                    key={period}
                    variant={filterPeriod === period ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setFilterPeriod(period)}
                    className={filterPeriod === period ? 'bg-violet-600' : ''}
                  >
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400">{t(T.history.sortBy)}</label>
              <div className="flex gap-2">
                {(['recent', 'oldest', 'messages', 'favorites'] as SortBy[]).map((sort) => (
                  <Button
                    key={sort}
                    variant={sortBy === sort ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setSortBy(sort)}
                    className={sortBy === sort ? 'bg-violet-600' : ''}
                  >
                    {sort.charAt(0).toUpperCase() + sort.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-violet-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{conversations.length}</p>
                  <p className="text-xs text-slate-400">{t(T.history.totalConversations)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Star className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold text-white">
                    {conversations.filter((c) => c.isFavorite).length}
                  </p>
                  <p className="text-xs text-slate-400">{t(T.sidebar.favorites)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-blue-400" />
                <div>
                  <p className="text-2xl font-bold text-white">
                    {conversations.filter((c) => {
                      const date = new Date(c.updatedAt);
                      const now = new Date();
                      return date.toDateString() === now.toDateString();
                    }).length}
                  </p>
                  <p className="text-xs text-slate-400">Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-green-400" />
                <div>
                  <p className="text-2xl font-bold text-white">
                    {conversations.reduce((sum, c) => sum + (c.messageCount || 0), 0)}
                  </p>
                  <p className="text-xs text-slate-400">{t(T.history.totalMessages)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Horizontal Timeline Preview */}
        {viewMode === 'timeline' && timelineItems.length > 0 && (
          <GlassPanel className="overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <Zap className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-medium text-white">Recent Activity</span>
            </div>
            <HorizontalTimeline
              items={timelineItems.slice(0, 10)}
              onSelect={handleTimelineSelect}
              selectedId={selectedConversation || undefined}
            />
          </GlassPanel>
        )}

        {/* Conversations View */}
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-2"
          >
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <GlassCard variant="default" padding="lg" hoverEffect={false}>
                <div className="py-8 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-slate-600 mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No conversations found</h3>
                  <p className="text-slate-400">
                    {searchQuery ? 'Try a different search term' : 'Start a new conversation to see it here'}
                  </p>
                </div>
              </GlassCard>
            ) : viewMode === 'timeline' ? (
              <GlassPanel className="p-4">
                <InteractiveTimeline
                  items={timelineItems}
                  onSelect={handleTimelineSelect}
                  selectedId={selectedConversation || undefined}
                />
              </GlassPanel>
            ) : (
              filteredConversations.map((conv) => (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <GlassCard 
                    variant={selectedIds.has(conv.id) ? 'glow' : 'default'}
                    glowColor={selectedIds.has(conv.id) ? 'violet' : 'none'}
                    hoverEffect
                    padding="none"
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(conv.id)}
                          onChange={() => toggleSelect(conv.id)}
                          className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-800 text-violet-600 focus:ring-violet-500"
                        />
                        <Link href={`/?conversation=${conv.id}`} className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-white truncate">{conv.title}</h3>
                            {conv.isFavorite && (
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            )}
                            {conv.domainMode && (
                              <Badge variant="outline" className="text-xs">{conv.domainMode}</Badge>
                            )}
                          </div>
                          {conv.lastMessage && (
                            <p className="text-sm text-slate-400 truncate">{conv.lastMessage}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <span>{formatRelativeTime(new Date(conv.updatedAt))}</span>
                            <span>{conv.messageCount || 0} messages</span>
                          </div>
                        </Link>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              if (confirm('Delete this conversation?')) {
                                deleteMutation.mutate(conv.id);
                              }
                            }}
                            className="text-slate-500 hover:text-red-400 h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
