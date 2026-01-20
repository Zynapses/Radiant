'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, Code, FileText, Image as ImageIcon, BarChart3, Download, 
  Copy, Check, ExternalLink, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/ui/glass-card';
import { AuroraBackground } from '@/components/ui/aurora-background';
import { api } from '@/lib/api/client';
import { cn, formatRelativeTime } from '@/lib/utils';
import { useTranslation, T } from '@/lib/i18n';
import type { Artifact } from '@/lib/api/types';

const TYPE_CONFIG = {
  code: { icon: Code, color: 'text-green-400', bg: 'bg-green-500/20' },
  document: { icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  image: { icon: ImageIcon, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  chart: { icon: BarChart3, color: 'text-orange-400', bg: 'bg-orange-500/20' },
};

export default function ArtifactsPage() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: artifacts = [], isLoading } = useQuery({
    queryKey: ['artifacts'],
    queryFn: async () => {
      const response = await api.get<{ data: Artifact[] }>('/api/thinktank/artifacts');
      return response.data || [];
    },
  });

  const filteredArtifacts = artifacts
    .filter((a) => {
      if (searchQuery) {
        return a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
               a.content.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    })
    .filter((a) => !filterType || a.type === filterType);

  const handleCopy = async (artifact: Artifact) => {
    await navigator.clipboard.writeText(artifact.content);
    setCopiedId(artifact.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (artifact: Artifact) => {
    const extension = artifact.type === 'code' ? (artifact.language || 'txt') : 
                      artifact.type === 'document' ? 'md' : 'txt';
    const blob = new Blob([artifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = {
    total: artifacts.length,
    code: artifacts.filter((a) => a.type === 'code').length,
    documents: artifacts.filter((a) => a.type === 'document').length,
    images: artifacts.filter((a) => a.type === 'image').length,
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative">
      <AuroraBackground colors="mixed" intensity="subtle" className="fixed inset-0 pointer-events-none" />
      <header className="sticky top-0 z-10 h-14 border-b border-slate-800/50 flex items-center px-4 bg-[#0d0d14]/80 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm">{t(T.common.back)}</span>
        </Link>
        <h1 className="flex-1 text-center font-semibold text-white">{t(T.artifacts.title)}</h1>
        <div className="w-24" />
      </header>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <GlassCard variant="default" hoverEffect padding="sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/20">
                <Code className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-xs text-slate-400">{t(T.artifacts.totalArtifacts)}</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard variant="default" hoverEffect padding="sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Code className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.code}</p>
                <p className="text-xs text-slate-400">Code Snippets</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard variant="default" hoverEffect padding="sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.documents}</p>
                <p className="text-xs text-slate-400">Documents</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard variant="default" hoverEffect padding="sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <ImageIcon className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.images}</p>
                <p className="text-xs text-slate-400">Images</p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search artifacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <div className="flex gap-2">
            {(['code', 'document', 'image', 'chart'] as const).map((type) => {
              const config = TYPE_CONFIG[type];
              const Icon = config.icon;
              return (
                <Button
                  key={type}
                  variant={filterType === type ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterType(filterType === type ? null : type)}
                  className={filterType === type ? 'bg-violet-600' : ''}
                >
                  <Icon className={cn('h-4 w-4', filterType !== type && config.color)} />
                </Button>
              );
            })}
          </div>
        </div>

        {/* Artifacts Grid */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredArtifacts.length === 0 ? (
          <GlassCard variant="default" hoverEffect={false} padding="none">
            <CardContent className="py-12 text-center">
              <Code className="h-12 w-12 mx-auto text-slate-600 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No artifacts yet</h3>
              <p className="text-slate-400">
                Artifacts generated during conversations will appear here
              </p>
            </CardContent>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredArtifacts.map((artifact) => {
              const config = TYPE_CONFIG[artifact.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.code;
              const Icon = config.icon;
              return (
                <motion.div
                  key={artifact.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <GlassCard variant="default" hoverEffect padding="none">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn('p-2 rounded-lg', config.bg)}>
                            <Icon className={cn('h-4 w-4', config.color)} />
                          </div>
                          <div>
                            <CardTitle className="text-base text-white">{artifact.title}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">{artifact.type}</Badge>
                              {artifact.language && (
                                <Badge variant="secondary" className="text-xs">{artifact.language}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleCopy(artifact)}
                            className="text-slate-400 hover:text-white"
                          >
                            {copiedId === artifact.id ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDownload(artifact)}
                            className="text-slate-400 hover:text-white"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-xs text-slate-400 bg-slate-800/50 rounded-lg p-3 overflow-hidden max-h-32">
                        <code>{artifact.content.slice(0, 300)}{artifact.content.length > 300 && '...'}</code>
                      </pre>
                      <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                        <span>{formatRelativeTime(new Date(artifact.createdAt))}</span>
                        <Link 
                          href={`/?conversation=${artifact.conversationId}`}
                          className="flex items-center gap-1 hover:text-violet-400 transition-colors"
                        >
                          View conversation
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </CardContent>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
