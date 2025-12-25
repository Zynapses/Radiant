'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  Clock,
  History,
  GitBranch,
  RotateCcw,
  Eye,
  Download,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface Snapshot {
  id: string;
  sessionId: string;
  userId: string;
  userEmail: string;
  snapshotType: 'auto' | 'manual' | 'branch';
  label: string | null;
  messageCount: number;
  totalTokens: number;
  parentSnapshotId: string | null;
  createdAt: string;
}

interface SnapshotStats {
  totalSnapshots: number;
  autoSnapshots: number;
  manualSnapshots: number;
  branchSnapshots: number;
  storageUsedMb: number;
}

interface SnapshotContent {
  id: string;
  messages: {
    role: string;
    content: string;
    model: string | null;
    createdAt: string;
  }[];
  metadata: Record<string, unknown>;
}

export default function TimeMachinePage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);

  const { data: snapshots, isLoading } = useQuery<{ data: Snapshot[] }>({
    queryKey: ['time-machine-snapshots', search, typeFilter],
    queryFn: () =>
      fetch(
        `/api/admin/time-machine/snapshots?search=${search}&type=${typeFilter}`
      ).then((r) => r.json()),
  });

  const { data: stats } = useQuery<SnapshotStats>({
    queryKey: ['time-machine-stats'],
    queryFn: () =>
      fetch('/api/admin/time-machine/stats').then((r) => r.json()),
  });

  const { data: snapshotContent } = useQuery<SnapshotContent>({
    queryKey: ['snapshot-content', selectedSnapshot],
    queryFn: () =>
      fetch(`/api/admin/time-machine/snapshots/${selectedSnapshot}`).then((r) =>
        r.json()
      ),
    enabled: !!selectedSnapshot,
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Time Machine</h1>
          <p className="text-muted-foreground">
            Chat history versioning and snapshots management
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export All
          </Button>
          <Button variant="destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Purge Old
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Snapshots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalSnapshots?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Auto Snapshots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.autoSnapshots?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Manual Snapshots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.manualSnapshots?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Branches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.branchSnapshots?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Storage Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.storageUsedMb || 0).toFixed(1)} MB
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user or label..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="branch">Branch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (
                (snapshots?.data || []).map((snapshot) => (
                  <TableRow key={snapshot.id}>
                    <TableCell>
                      <div className="font-medium">{snapshot.userEmail}</div>
                      <div className="text-xs text-muted-foreground">
                        Session: {snapshot.sessionId.slice(0, 8)}...
                      </div>
                    </TableCell>
                    <TableCell>
                      {snapshot.label || (
                        <span className="text-muted-foreground italic">
                          Unlabeled
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          snapshot.snapshotType === 'auto'
                            ? 'secondary'
                            : snapshot.snapshotType === 'branch'
                            ? 'outline'
                            : 'default'
                        }
                      >
                        {snapshot.snapshotType === 'auto' && (
                          <Clock className="h-3 w-3 mr-1" />
                        )}
                        {snapshot.snapshotType === 'manual' && (
                          <History className="h-3 w-3 mr-1" />
                        )}
                        {snapshot.snapshotType === 'branch' && (
                          <GitBranch className="h-3 w-3 mr-1" />
                        )}
                        {snapshot.snapshotType}
                      </Badge>
                    </TableCell>
                    <TableCell>{snapshot.messageCount}</TableCell>
                    <TableCell>{snapshot.totalTokens.toLocaleString()}</TableCell>
                    <TableCell>
                      {snapshot.parentSnapshotId ? (
                        <span className="text-xs font-mono">
                          {snapshot.parentSnapshotId.slice(0, 8)}...
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDistanceToNow(new Date(snapshot.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedSnapshot(snapshot.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[80vh]">
                            <DialogHeader>
                              <DialogTitle>
                                Snapshot: {snapshot.label || snapshot.id.slice(0, 8)}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="text-sm text-muted-foreground mb-4">
                              User: {snapshot.userEmail} | Messages:{' '}
                              {snapshot.messageCount} | Created:{' '}
                              {format(new Date(snapshot.createdAt), 'PPpp')}
                            </div>
                            <ScrollArea className="h-[500px] pr-4">
                              <div className="space-y-4">
                                {(snapshotContent?.messages || []).map(
                                  (msg, idx) => (
                                    <div
                                      key={idx}
                                      className={`p-3 rounded-lg ${
                                        msg.role === 'user'
                                          ? 'bg-blue-50 dark:bg-blue-900/20 ml-8'
                                          : 'bg-gray-50 dark:bg-gray-800 mr-8'
                                      }`}
                                    >
                                      <div className="flex justify-between items-start mb-1">
                                        <Badge variant="outline" className="text-xs">
                                          {msg.role}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          {format(
                                            new Date(msg.createdAt),
                                            'HH:mm:ss'
                                          )}
                                        </span>
                                      </div>
                                      <div className="whitespace-pre-wrap text-sm">
                                        {msg.content}
                                      </div>
                                      {msg.model && (
                                        <div className="mt-2 text-xs text-muted-foreground">
                                          Model: {msg.model}
                                        </div>
                                      )}
                                    </div>
                                  )
                                )}
                              </div>
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                        <Button variant="ghost" size="sm">
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
