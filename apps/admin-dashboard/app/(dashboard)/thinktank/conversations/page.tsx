'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Search,
  MessageSquare,
  Eye,
  Trash2,
  Download,
  Clock,
  Share2,
  Copy,
  Check,
  Link,
  MoreHorizontal,
  Users,
  Zap,
  TrendingUp,
  Filter,
  RefreshCw,
  FileText,
  Bot,
  User,
  ChevronRight,
  Sparkles,
  Archive,
  ExternalLink,
} from 'lucide-react';
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
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharingConversation, setSharingConversation] = useState<Conversation | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const handleShareConversation = async (conv: Conversation) => {
    setSharingConversation(conv);
    setShareUrl(null);
    setCopied(false);
    setShareDialogOpen(true);
  };

  const createShareLink = async () => {
    if (!sharingConversation) return;
    
    try {
      const response = await fetch('/api/thinktank/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: sharingConversation.id,
          title: sharingConversation.title,
          isPublic: true,
          allowCopy: true,
        }),
      });
      
      const data = await response.json();
      if (data.shareUrl) {
        setShareUrl(data.shareUrl);
      }
    } catch (error) {
      console.error('Failed to create share link:', error);
    }
  };

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

      {/* Stats Cards - Enhanced with icons and trends */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Conversations</p>
                <p className="text-3xl font-bold tabular-nums">
                  {stats?.totalConversations?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +12% from last week
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Active Today</p>
                <p className="text-3xl font-bold tabular-nums">
                  {stats?.activeToday?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-muted-foreground">Currently engaged users</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <Users className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Messages</p>
                <p className="text-3xl font-bold tabular-nums">
                  {stats?.totalMessages?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +8% from last week
                </p>
              </div>
              <div className="p-3 rounded-xl bg-violet-100 dark:bg-violet-900/30">
                <FileText className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Tokens</p>
                <p className="text-3xl font-bold tabular-nums">
                  {((stats?.totalTokens || 0) / 1000000).toFixed(1)}M
                </p>
                <p className="text-xs text-muted-foreground">Across all conversations</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <Zap className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
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
                      <div className="flex gap-1">
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleShareConversation(conv)}
                          title="Share conversation"
                        >
                          <Share2 className="h-4 w-4" />
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

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Conversation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {sharingConversation?.title || 'Untitled conversation'}
              </p>
              <p className="text-xs text-muted-foreground">
                {sharingConversation?.messageCount} messages · {sharingConversation?.userEmail}
              </p>
            </div>

            {!shareUrl ? (
              <div className="space-y-4">
                <p className="text-sm">
                  Create a shareable link that allows anyone to view this conversation.
                </p>
                <Button onClick={createShareLink} className="w-full">
                  <Link className="h-4 w-4 mr-2" />
                  Generate Share Link
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyShareUrl}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Anyone with this link can view the conversation.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
