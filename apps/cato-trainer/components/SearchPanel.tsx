'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Search,
  Loader2,
  FileText,
  Clock,
  Zap,
  Filter,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import { useCatoTrainerStore } from '@/lib/cato-trainer-store';
import { searchDocuments, type SearchResult, type SearchMode } from '@/lib/api';
import { cn, confidenceColor, formatRelativeTime, truncate } from '@/lib/utils';

const MODE_META: Record<SearchMode, { label: string; description: string }> = {
  semantic: { label: 'Semantic', description: 'Meaning-based — finds conceptually similar content' },
  fulltext: { label: 'Full-Text', description: 'Keyword matching with stemming and fuzzy' },
  hybrid:   { label: 'Hybrid', description: 'Best of both — semantic + keyword scoring' },
};

export function SearchPanel() {
  const {
    tenantId,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    searchMode,
    setSearchMode,
    isSearching,
    setIsSearching,
    activeLibrary,
    setSelectedDocument,
  } = useCatoTrainerStore();

  const [showFilters, setShowFilters] = useState(false);
  const [queryTimeMs, setQueryTimeMs] = useState<number | null>(null);

  const searchMutation = useMutation({
    mutationFn: () => {
      setIsSearching(true);
      return searchDocuments(tenantId, {
        query: searchQuery,
        mode: searchMode,
        library_id: activeLibrary?.id,
      });
    },
    onSuccess: (data) => {
      setSearchResults(data.response.results);
      setQueryTimeMs(data.response.query_time_ms);
      setIsSearching(false);
    },
    onError: () => setIsSearching(false),
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    searchMutation.mutate();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Search Header */}
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Search</h2>
        <p className="text-xs text-white/30">
          Find anything across your documents — by meaning, keyword, or both
        </p>
      </div>

      {/* Search Bar */}
      <div className="glass-panel rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-cato-400 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by concept, keyword, or question..."
            className="flex-1 bg-transparent text-sm text-white/80 placeholder:text-white/15 focus:outline-none"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'p-2 rounded-lg transition-colors',
              showFilters ? 'bg-cato-500/10 text-cato-400' : 'text-white/20 hover:text-white/40'
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <button
            onClick={handleSearch}
            disabled={!searchQuery.trim() || isSearching}
            className="px-4 py-2 rounded-lg bg-cato-600 hover:bg-cato-500 text-white text-sm font-medium disabled:opacity-30 transition-colors"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </button>
        </div>

        {/* Mode selector */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-white/[0.04]">
            <p className="text-[10px] uppercase tracking-wider text-white/15 mb-2">Search Mode</p>
            <div className="flex gap-2">
              {(Object.entries(MODE_META) as [SearchMode, typeof MODE_META[SearchMode]][]).map(
                ([mode, meta]) => (
                  <button
                    key={mode}
                    onClick={() => setSearchMode(mode)}
                    className={cn(
                      'flex-1 px-3 py-2 rounded-lg text-xs text-center border transition-colors',
                      searchMode === mode
                        ? 'border-cato-500/30 bg-cato-500/10 text-cato-300'
                        : 'border-white/[0.04] text-white/30 hover:text-white/50'
                    )}
                  >
                    <span className="font-medium">{meta.label}</span>
                    <p className="text-[10px] text-white/20 mt-0.5">{meta.description}</p>
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Results meta */}
      {searchResults.length > 0 && (
        <div className="flex items-center justify-between text-xs text-white/20">
          <span>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
          {queryTimeMs !== null && (
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" /> {queryTimeMs}ms
            </span>
          )}
        </div>
      )}

      {/* Results */}
      {searchResults.length > 0 ? (
        <div className="space-y-3">
          {searchResults.map((result, idx) => (
            <SearchResultCard
              key={result.id}
              result={result}
              rank={idx + 1}
              onClick={() => setSelectedDocument(result.document)}
            />
          ))}
        </div>
      ) : !isSearching && searchQuery && searchResults.length === 0 && queryTimeMs !== null ? (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-white/5 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white/30">No results found</h3>
          <p className="text-sm text-white/15 mt-1">Try adjusting your query or search mode</p>
        </div>
      ) : null}

      {/* Empty state */}
      {!searchQuery && searchResults.length === 0 && (
        <div className="text-center py-16">
          <Search className="w-16 h-16 text-white/[0.03] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white/20">Superhuman Search</h3>
          <p className="text-sm text-white/10 max-w-md mx-auto mt-2">
            Find any document by meaning, not just keywords. Ask &ldquo;something about marketing from last quarter&rdquo; and Cato will find it.
          </p>
        </div>
      )}
    </div>
  );
}

function SearchResultCard({ result, rank, onClick }: { result: SearchResult; rank: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left glass-panel rounded-xl p-4 hover:bg-white/[0.03] transition-colors card-reveal"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/[0.03] flex items-center justify-center">
          <span className="text-[10px] font-mono text-white/20">#{rank}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-3.5 h-3.5 text-white/20" />
            <span className="text-sm font-medium text-white/70 truncate">{result.document.title || result.document.filename}</span>
            <span className={cn('text-[10px] ml-auto flex-shrink-0', confidenceColor(result.relevance_score))}>
              {Math.round(result.relevance_score * 100)}% match
            </span>
          </div>
          <p className="text-xs text-white/40 leading-relaxed line-clamp-2 search-highlight" dangerouslySetInnerHTML={{ __html: result.highlight }} />
          <div className="flex items-center gap-3 mt-2 text-[10px] text-white/15">
            {result.chunk.page_number && <span>Page {result.chunk.page_number}</span>}
            {result.chunk.section_title && <span>§ {result.chunk.section_title}</span>}
            {result.matched_terms.length > 0 && (
              <span className="flex items-center gap-1">
                <Filter className="w-2.5 h-2.5" /> {result.matched_terms.slice(0, 3).join(', ')}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
