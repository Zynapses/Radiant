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
import { Search, MessageSquare, Eye, Trash2, Download, Clock } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface Conversation {
  id: string;
  userId: string;
  userEmail: string;
  title: string | null;
  messageCount: number;
  totalTokens: number;
  totalCost: number;
  primaryModel: string | null;
  domainMode: string | null;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'archived' | 'deleted';
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string | null;
  tokensUsed: number | null;
  createdAt: string;
}

interface ConversationStats {
  totalConversations: number;
  activeToday: number;
  totalMessages: number;
  totalTokens: number;
}

export default function ConversationsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  const { data: conversations, isLoading } = useQuery<{ data: Conversation[] }>({
    queryKey: ['thinktank-conversations', search, statusFilter],
    queryFn: () =>
      fetch(
        `/api/admin/thinktank/conversations?search=${search}&status=${statusFilter}`
      ).then((r) => r.json()),
  });

  const { data: stats } = useQuery<ConversationStats>({
    queryKey: ['thinktank-conversation-stats'],
    queryFn: () =>
      fetch('/api/admin/thinktank/conversations/stats').then((r) => r.json()),
  });

  const { data: messages } = useQuery<{ data: ConversationMessage[] }>({
    queryKey: ['conversation-messages', selectedConversation],
    queryFn: () =>
      fetch(`/api/admin/thinktank/conversations/${selectedConversation}/messages`).then(
        (r) => r.json()
      ),
    enabled: !!selectedConversation,
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Think Tank Conversations</h1>
          <p className="text-muted-foreground">
            View and manage user conversations
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalConversations?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.activeToday?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalMessages?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tokens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((stats?.totalTokens || 0) / 1000000).toFixed(1)}M
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
                placeholder="Search by user email or title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="deleted">Deleted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (
                (conversations?.data || []).map((conv) => (
                  <TableRow key={conv.id}>
                    <TableCell>
                      <div className="font-medium">{conv.userEmail}</div>
                      <div className="text-xs text-muted-foreground">
                        ID: {conv.id.slice(0, 8)}...
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {conv.title || 'Untitled'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        {conv.messageCount}
                      </div>
                    </TableCell>
                    <TableCell>{conv.totalTokens.toLocaleString()}</TableCell>
                    <TableCell>${conv.totalCost.toFixed(4)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {conv.primaryModel || 'auto'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {conv.domainMode && (
                        <Badge variant="secondary">{conv.domainMode}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(conv.updatedAt), {
                          addSuffix: true,
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          conv.status === 'active'
                            ? 'default'
                            : conv.status === 'archived'
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {conv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedConversation(conv.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[80vh]">
                          <DialogHeader>
                            <DialogTitle>
                              Conversation: {conv.title || 'Untitled'}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="text-sm text-muted-foreground mb-4">
                            User: {conv.userEmail} | Messages: {conv.messageCount} |
                            Created: {format(new Date(conv.createdAt), 'PPpp')}
                          </div>
                          <ScrollArea className="h-[500px] pr-4">
                            <div className="space-y-4">
                              {(messages?.data || []).map((msg) => (
                                <div
                                  key={msg.id}
                                  className={`p-3 rounded-lg ${
                                    msg.role === 'user'
                                      ? 'bg-blue-50 dark:bg-blue-900/20 ml-8'
                                      : msg.role === 'assistant'
                                      ? 'bg-gray-50 dark:bg-gray-800 mr-8'
                                      : 'bg-yellow-50 dark:bg-yellow-900/20 text-sm'
                                  }`}
                                >
                                  <div className="flex justify-between items-start mb-1">
                                    <Badge variant="outline" className="text-xs">
                                      {msg.role}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(msg.createdAt), 'HH:mm:ss')}
                                    </span>
                                  </div>
                                  <div className="whitespace-pre-wrap text-sm">
                                    {msg.content}
                                  </div>
                                  {msg.model && (
                                    <div className="mt-2 text-xs text-muted-foreground">
                                      Model: {msg.model} | Tokens:{' '}
                                      {msg.tokensUsed?.toLocaleString() || 'N/A'}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
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
