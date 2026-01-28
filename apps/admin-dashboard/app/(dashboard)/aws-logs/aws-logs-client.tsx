'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FileText, 
  RefreshCw,
  Search,
  Trash2,
  Download,
  ChevronRight,
  Clock,
  HardDrive,
  AlertCircle,
  Loader2,
  X,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiClient } from '@/lib/api';

interface LogGroup {
  name: string;
  arn?: string;
  storedBytes?: number;
  retentionDays?: number;
  createdAt?: number;
}

interface LogStream {
  name: string;
  firstEventTimestamp?: number;
  lastEventTimestamp?: number;
  lastIngestionTime?: number;
  storedBytes?: number;
}

interface LogEvent {
  timestamp: number;
  message: string;
  ingestionTime?: number;
  logStreamName?: string;
}

type ViewMode = 'groups' | 'streams' | 'events' | 'search';

export function AWSLogsClient() {
  const [viewMode, setViewMode] = useState<ViewMode>('groups');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedStream, setSelectedStream] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPattern, setFilterPattern] = useState('');
  const [timeRange, setTimeRange] = useState('1h');
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'group' | 'stream'; name: string } | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  
  const queryClient = useQueryClient();
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch log groups
  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ['log-groups'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: { logGroups: LogGroup[] } }>('/admin/logs/groups');
      return response.data.logGroups;
    },
  });

  // Fetch log streams for selected group
  const { data: streamsData, isLoading: streamsLoading } = useQuery({
    queryKey: ['log-streams', selectedGroup],
    queryFn: async () => {
      if (!selectedGroup) return [];
      const response = await apiClient.get<{ data: { logStreams: LogStream[] } }>(
        `/admin/logs/streams?logGroupName=${encodeURIComponent(selectedGroup)}`
      );
      return response.data.logStreams;
    },
    enabled: !!selectedGroup,
  });

  // Fetch log events for selected stream
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['log-events', selectedGroup, selectedStream, timeRange],
    queryFn: async () => {
      if (!selectedGroup || !selectedStream) return [];
      const now = Date.now();
      const timeRanges: Record<string, number> = {
        '15m': 15 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
      };
      const startTime = now - (timeRanges[timeRange] || timeRanges['1h']);
      
      const response = await apiClient.get<{ data: { events: LogEvent[] } }>(
        `/admin/logs/events?logGroupName=${encodeURIComponent(selectedGroup)}&logStreamName=${encodeURIComponent(selectedStream)}&startTime=${startTime}&endTime=${now}`
      );
      return response.data.events;
    },
    enabled: !!selectedGroup && !!selectedStream,
  });

  // Search/filter logs mutation
  const searchMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGroup) return [];
      const now = Date.now();
      const timeRanges: Record<string, number> = {
        '15m': 15 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
      };
      const startTime = now - (timeRanges[timeRange] || timeRanges['1h']);
      
      const response = await apiClient.post<{ data: { events: LogEvent[] } }>('/admin/logs/filter', {
        logGroupName: selectedGroup,
        filterPattern,
        startTime,
        endTime: now,
        limit: 500,
      });
      return response.data.events;
    },
  });

  // Delete log group mutation
  const deleteGroupMutation = useMutation({
    mutationFn: async (name: string) => {
      await apiClient.delete(`/admin/logs/groups/${encodeURIComponent(name)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['log-groups'] });
      setNotification({ type: 'success', message: 'Log group deleted successfully' });
      setDeleteTarget(null);
      if (selectedGroup === deleteTarget?.name) {
        setSelectedGroup(null);
        setViewMode('groups');
      }
    },
    onError: () => {
      setNotification({ type: 'error', message: 'Failed to delete log group' });
    },
  });

  // Delete log stream mutation
  const deleteStreamMutation = useMutation({
    mutationFn: async ({ group, stream }: { group: string; stream: string }) => {
      await apiClient.delete(`/admin/logs/streams?logGroupName=${encodeURIComponent(group)}&logStreamName=${encodeURIComponent(stream)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['log-streams', selectedGroup] });
      setNotification({ type: 'success', message: 'Log stream deleted successfully' });
      setDeleteTarget(null);
      if (selectedStream === deleteTarget?.name) {
        setSelectedStream(null);
        setViewMode('streams');
      }
    },
    onError: () => {
      setNotification({ type: 'error', message: 'Failed to delete log stream' });
    },
  });

  // Export logs mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGroup) return;
      const now = Date.now();
      const timeRanges: Record<string, number> = {
        '15m': 15 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
      };
      const startTime = now - (timeRanges[timeRange] || timeRanges['1h']);
      
      return apiClient.post('/admin/logs/export', {
        logGroupName: selectedGroup,
        startTime,
        endTime: now,
      });
    },
    onSuccess: () => {
      setNotification({ type: 'success', message: 'Export started. Logs are being exported to S3.' });
      setExportDialogOpen(false);
    },
    onError: () => {
      setNotification({ type: 'error', message: 'Failed to start export' });
    },
  });

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatTimestamp = (ts?: number) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString();
  };

  const handleGroupSelect = (name: string) => {
    setSelectedGroup(name);
    setSelectedStream(null);
    setViewMode('streams');
  };

  const handleStreamSelect = (name: string) => {
    setSelectedStream(name);
    setViewMode('events');
  };

  const handleBack = () => {
    if (viewMode === 'events') {
      setSelectedStream(null);
      setViewMode('streams');
    } else if (viewMode === 'streams' || viewMode === 'search') {
      setSelectedGroup(null);
      setViewMode('groups');
    }
  };

  const handleSearch = () => {
    if (selectedGroup && filterPattern) {
      setViewMode('search');
      searchMutation.mutate();
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'group') {
      deleteGroupMutation.mutate(deleteTarget.name);
    } else if (deleteTarget.type === 'stream' && selectedGroup) {
      deleteStreamMutation.mutate({ group: selectedGroup, stream: deleteTarget.name });
    }
  };

  const filteredGroups = groupsData?.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Notification Banner */}
      {notification && (
        <div className={`p-4 rounded-lg flex items-center justify-between ${
          notification.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'
        }`}>
          <span>{notification.message}</span>
          <Button variant="ghost" size="sm" onClick={() => setNotification(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {viewMode !== 'groups' && (
            <Button variant="ghost" size="sm" onClick={handleBack}>
              ← Back
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AWS Logs</h1>
            <p className="text-muted-foreground">
              {viewMode === 'groups' && 'View and manage CloudWatch log groups'}
              {viewMode === 'streams' && `Streams in ${selectedGroup}`}
              {viewMode === 'events' && `Events from ${selectedStream}`}
              {viewMode === 'search' && `Search results in ${selectedGroup}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['log-groups'] });
              queryClient.invalidateQueries({ queryKey: ['log-streams'] });
              queryClient.invalidateQueries({ queryKey: ['log-events'] });
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {selectedGroup && (
            <Button variant="outline" onClick={() => setExportDialogOpen(true)}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Log Groups</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groupsData?.length ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(groupsData?.reduce((acc, g) => acc + (g.storedBytes || 0), 0))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Streams</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{streamsData?.length ?? '-'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Log Events</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {viewMode === 'events' ? eventsData?.length ?? 0 : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={viewMode === 'groups' ? 'Search log groups...' : 'Filter pattern (e.g., ERROR, ?ERROR ?WARN)...'}
                value={viewMode === 'groups' ? searchQuery : filterPattern}
                onChange={(e) => viewMode === 'groups' ? setSearchQuery(e.target.value) : setFilterPattern(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15m">Last 15 min</SelectItem>
                <SelectItem value="1h">Last 1 hour</SelectItem>
                <SelectItem value="6h">Last 6 hours</SelectItem>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
              </SelectContent>
            </Select>
            {viewMode !== 'groups' && (
              <Button onClick={handleSearch} disabled={!filterPattern || searchMutation.isPending}>
                {searchMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Filter className="mr-2 h-4 w-4" />
                Search
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>
            {viewMode === 'groups' && 'Log Groups'}
            {viewMode === 'streams' && 'Log Streams'}
            {viewMode === 'events' && 'Log Events'}
            {viewMode === 'search' && 'Search Results'}
          </CardTitle>
          <CardDescription>
            {viewMode === 'groups' && 'Click a log group to view its streams'}
            {viewMode === 'streams' && 'Click a stream to view its events'}
            {viewMode === 'events' && 'Most recent events first'}
            {viewMode === 'search' && `Found ${searchMutation.data?.length ?? 0} matching events`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Log Groups View */}
          {viewMode === 'groups' && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Log Group</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Retention</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredGroups?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No log groups found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGroups?.map((group) => (
                    <TableRow 
                      key={group.name} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleGroupSelect(group.name)}
                    >
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {group.name}
                          <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                        </div>
                      </TableCell>
                      <TableCell>{formatBytes(group.storedBytes)}</TableCell>
                      <TableCell>
                        {group.retentionDays ? `${group.retentionDays} days` : 'Never expire'}
                      </TableCell>
                      <TableCell>{formatTimestamp(group.createdAt)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({ type: 'group', name: group.name });
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {/* Log Streams View */}
          {viewMode === 'streams' && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stream Name</TableHead>
                  <TableHead>Last Event</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {streamsLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : streamsData?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No log streams found
                    </TableCell>
                  </TableRow>
                ) : (
                  streamsData?.map((stream) => (
                    <TableRow 
                      key={stream.name}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleStreamSelect(stream.name)}
                    >
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          {stream.name}
                          <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                        </div>
                      </TableCell>
                      <TableCell>{formatTimestamp(stream.lastEventTimestamp)}</TableCell>
                      <TableCell>{formatBytes(stream.storedBytes)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({ type: 'stream', name: stream.name });
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {/* Log Events View */}
          {(viewMode === 'events' || viewMode === 'search') && (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {(eventsLoading || searchMutation.isPending) ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </div>
                ) : (viewMode === 'events' ? eventsData : searchMutation.data)?.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No log events found
                  </div>
                ) : (
                  (viewMode === 'events' ? eventsData : searchMutation.data)?.map((event, idx) => (
                    <div 
                      key={`${event.timestamp}-${idx}`}
                      className="p-3 rounded-lg bg-muted/50 font-mono text-sm"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {new Date(event.timestamp).toLocaleString()}
                        </Badge>
                        {event.logStreamName && (
                          <Badge variant="secondary" className="text-xs">
                            {event.logStreamName}
                          </Badge>
                        )}
                      </div>
                      <pre className="whitespace-pre-wrap break-all text-xs">
                        {event.message}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type === 'group' ? 'Log Group' : 'Log Stream'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> and all its logs.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {(deleteGroupMutation.isPending || deleteStreamMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Logs to S3</DialogTitle>
            <DialogDescription>
              Export logs from {selectedGroup} for the selected time range.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Time Range:</span>
              <Badge variant="secondary">{timeRange}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Logs will be exported to S3 in JSON format. This may take several minutes for large log groups.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
              {exportMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
