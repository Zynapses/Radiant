'use client';

import { useState, useEffect } from 'react';
import {
  Clock,
  Search,
  Filter,
  FileText,
  CheckCircle2,
  XCircle,
  PenTool,
  Upload,
  ChevronRight,
  Calendar,
  User,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ui/glass-card';

interface HistoryEvent {
  id: string;
  type: 'ingestion' | 'verification' | 'rejection' | 'override';
  title: string;
  description: string;
  timestamp: string;
  user?: string;
  metadata?: {
    documentName?: string;
    domain?: string;
    nodesAffected?: number;
  };
}

const typeConfig = {
  ingestion: { icon: Upload, color: 'text-curator-sapphire', bgColor: 'bg-curator-sapphire/10', label: 'Ingestion' },
  verification: { icon: CheckCircle2, color: 'text-curator-emerald', bgColor: 'bg-curator-emerald/10', label: 'Verification' },
  rejection: { icon: XCircle, color: 'text-destructive', bgColor: 'bg-destructive/10', label: 'Rejection' },
  override: { icon: PenTool, color: 'text-curator-gold', bgColor: 'bg-curator-gold/10', label: 'Override' },
};

export default function HistoryPage() {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<HistoryEvent | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch('/api/curator/audit');
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        }
      } catch (error) {
        console.error('Failed to fetch history:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  const filteredEvents = events.filter((event) => {
    if (filterType && event.type !== filterType) return false;
    if (searchQuery && !event.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !event.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const groupedEvents = filteredEvents.reduce((acc, event) => {
    const date = new Date(event.timestamp).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {} as Record<string, HistoryEvent[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-curator-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Activity History</h1>
          <p className="text-muted-foreground mt-1">
            Track all knowledge changes, verifications, and overrides.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 p-3 bg-card border rounded-lg">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-md bg-background"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={filterType || ''}
            onChange={(e) => setFilterType(e.target.value || null)}
            className="px-3 py-2 text-sm border rounded-md bg-background"
          >
            <option value="">All Types</option>
            <option value="ingestion">Ingestions</option>
            <option value="verification">Verifications</option>
            <option value="rejection">Rejections</option>
            <option value="override">Overrides</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {Object.keys(groupedEvents).length > 0 ? (
            Object.entries(groupedEvents).map(([date, dayEvents]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">{date}</span>
                </div>
                <div className="space-y-2">
                  {dayEvents.map((event) => {
                    const config = typeConfig[event.type];
                    return (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className={cn(
                          'w-full text-left rounded-lg border bg-card p-4 transition-all hover:shadow-md',
                          selectedEvent?.id === event.id && 'ring-2 ring-primary'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn('rounded-lg p-2', config.bgColor)}>
                            <config.icon className={cn('h-4 w-4', config.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium truncate">{event.title}</p>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                              {event.description}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <GlassCard variant="default" padding="lg" className="text-center">
              <Clock className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="font-semibold">No History Found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery || filterType ? 'Try adjusting your filters' : 'Activity will appear here as you use the system'}
              </p>
            </GlassCard>
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          {selectedEvent ? (
            <GlassCard variant="elevated" padding="md" className="space-y-4 sticky top-20">
              <div className="flex items-center gap-2">
                {(() => {
                  const config = typeConfig[selectedEvent.type];
                  return (
                    <>
                      <div className={cn('rounded-lg p-2', config.bgColor)}>
                        <config.icon className={cn('h-5 w-5', config.color)} />
                      </div>
                      <span className={cn('font-medium', config.color)}>{config.label}</span>
                    </>
                  );
                })()}
              </div>

              <div>
                <h3 className="font-semibold text-lg">{selectedEvent.title}</h3>
                <p className="text-sm text-muted-foreground mt-2">{selectedEvent.description}</p>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{new Date(selectedEvent.timestamp).toLocaleString()}</span>
                </div>
                {selectedEvent.user && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedEvent.user}</span>
                  </div>
                )}
                {selectedEvent.metadata?.documentName && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedEvent.metadata.documentName}</span>
                  </div>
                )}
                {selectedEvent.metadata?.nodesAffected !== undefined && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Nodes affected: </span>
                    <span className="font-medium">{selectedEvent.metadata.nodesAffected}</span>
                  </div>
                )}
              </div>
            </GlassCard>
          ) : (
            <GlassCard variant="default" padding="lg" className="flex flex-col items-center justify-center text-center h-[300px]">
              <Clock className="h-8 w-8 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                Select an event to view details
              </p>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
