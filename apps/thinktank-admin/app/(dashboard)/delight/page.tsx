'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sparkles,
  MessageSquare,
  Trophy,
  Egg,
  Volume2,
  BarChart3,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  Check,
  X,
  Clock,
  Brain,
  Heart,
  Users,
  Zap,
} from 'lucide-react';

// Types
interface DelightCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isEnabled: boolean;
}

interface DelightMessage {
  id: number;
  categoryId: string;
  injectionPoint: 'pre_execution' | 'during_execution' | 'post_execution';
  triggerType: string;
  messageText: string;
  messageAltTexts: string[];
  domainFamilies: string[];
  displayStyle: 'subtle' | 'moderate' | 'expressive';
  priority: number;
  isEnabled: boolean;
  requiresOptIn: boolean;
}

interface DelightAchievement {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  achievementType: string;
  thresholdValue: number;
  celebrationMessage: string | null;
  rarity: string;
  points: number;
  isHidden: boolean;
  isEnabled: boolean;
}

interface DelightEasterEgg {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  triggerValue: string;
  effectType: string;
  activationMessage: string | null;
  effectDurationSeconds: number;
  isEnabled: boolean;
  discoveryCount: number;
}

interface DelightSound {
  id: string;
  name: string;
  soundCategory: string;
  soundTheme: string;
  volumeDefault: number;
  isEnabled: boolean;
}

interface DelightDashboard {
  categories: DelightCategory[];
  messages: DelightMessage[];
  achievements: DelightAchievement[];
  easterEggs: DelightEasterEgg[];
  sounds: DelightSound[];
  analytics: {
    totalMessagesShown: number;
    achievementsUnlocked: number;
    easterEggsDiscovered: number;
    engagementByMode: Record<string, number>;
  };
  summary: {
    totalMessages: number;
    enabledMessages: number;
    totalAchievements: number;
    totalEasterEggs: number;
    totalSounds: number;
  };
}

// Icon mapping
const categoryIcons: Record<string, React.ReactNode> = {
  domain_loading: <Brain className="h-4 w-4" />,
  domain_transition: <Zap className="h-4 w-4" />,
  time_awareness: <Clock className="h-4 w-4" />,
  model_dynamics: <Users className="h-4 w-4" />,
  complexity_signals: <Brain className="h-4 w-4" />,
  synthesis_quality: <Sparkles className="h-4 w-4" />,
  achievements: <Trophy className="h-4 w-4" />,
  wellbeing: <Heart className="h-4 w-4" />,
  easter_eggs: <Egg className="h-4 w-4" />,
  sounds: <Volume2 className="h-4 w-4" />,
};

const rarityColors: Record<string, string> = {
  common: 'bg-gray-100 text-gray-800',
  uncommon: 'bg-green-100 text-green-800',
  rare: 'bg-blue-100 text-blue-800',
  epic: 'bg-purple-100 text-purple-800',
  legendary: 'bg-yellow-100 text-yellow-800',
};

export default function DelightDashboardPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<DelightMessage | null>(null);
  
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading, error, refetch } = useQuery({
    queryKey: ['delight-dashboard'],
    queryFn: () => api.get<DelightDashboard>('/api/admin/delight/dashboard'),
    refetchInterval: 30000,
  });

  const toggleCategoryMutation = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      api.patch(`/api/admin/delight/categories/${id}`, { isEnabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['delight-dashboard'] }),
  });

  const createMessageMutation = useMutation({
    mutationFn: (message: Partial<DelightMessage>) =>
      api.post('/api/admin/delight/messages', message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delight-dashboard'] });
      setIsCreateDialogOpen(false);
    },
  });

  const updateMessageMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<DelightMessage> }) =>
      api.put(`/api/admin/delight/messages/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delight-dashboard'] });
      setEditingMessage(null);
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/delight/messages/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['delight-dashboard'] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">Failed to load delight dashboard</p>
        <Button onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  const filteredMessages = selectedCategory
    ? dashboard.messages.filter(m => m.categoryId === selectedCategory)
    : dashboard.messages;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-yellow-500" />
            Think Tank Delight System
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage personality, messages, achievements, and easter eggs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/delight/statistics">
            <Button variant="outline">
              <BarChart3 className="mr-2 h-4 w-4" />
              View Statistics
            </Button>
          </Link>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.summary.enabledMessages}</div>
            <p className="text-xs text-muted-foreground">of {dashboard.summary.totalMessages} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.summary.totalAchievements}</div>
            <p className="text-xs text-muted-foreground">{dashboard.analytics.achievementsUnlocked} unlocked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Egg className="h-4 w-4" />
              Easter Eggs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.summary.totalEasterEggs}</div>
            <p className="text-xs text-muted-foreground">{dashboard.analytics.easterEggsDiscovered} discovered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Sounds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.summary.totalSounds}</div>
            <p className="text-xs text-muted-foreground">sound effects</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Shown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.analytics.totalMessagesShown.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">total messages shown</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          <TabsTrigger value="easter-eggs">Easter Eggs</TabsTrigger>
          <TabsTrigger value="sounds">Sounds</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Categories</CardTitle>
              <CardDescription>Toggle categories on/off to control what users see</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dashboard.categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {categoryIcons[category.id] || <Sparkles className="h-4 w-4" />}
                      <div>
                        <p className="font-medium">{category.name}</p>
                        <p className="text-sm text-muted-foreground">{category.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={category.isEnabled}
                      onCheckedChange={(checked) => toggleCategoryMutation.mutate({ id: category.id, isEnabled: checked })}
                      disabled={toggleCategoryMutation.isPending}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>User Engagement by Mode</CardTitle>
              <CardDescription>How users have configured their personality preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                {Object.entries(dashboard.analytics.engagementByMode).map(([mode, count]) => (
                  <div key={mode} className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-sm text-muted-foreground capitalize">{mode}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Select value={selectedCategory || 'all'} onValueChange={(v) => setSelectedCategory(v === 'all' ? null : v)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {dashboard.categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Message
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Message</DialogTitle>
                  <DialogDescription>Add a new delight message to the system</DialogDescription>
                </DialogHeader>
                <MessageForm
                  categories={dashboard.categories}
                  onSubmit={(msg) => createMessageMutation.mutate(msg)}
                  isLoading={createMessageMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Message</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Injection</TableHead>
                    <TableHead>Style</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMessages.map((message) => (
                    <TableRow key={message.id}>
                      <TableCell className="max-w-md">
                        <p className="truncate">{message.messageText}</p>
                        {message.messageAltTexts.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            +{message.messageAltTexts.length} alternatives
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{message.categoryId}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{message.injectionPoint}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={message.displayStyle === 'expressive' ? 'default' : 'outline'}>
                          {message.displayStyle}
                        </Badge>
                      </TableCell>
                      <TableCell>{message.priority}</TableCell>
                      <TableCell>
                        {message.isEnabled ? (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingMessage(message)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('Delete this message?')) {
                                deleteMessageMutation.mutate(message.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Achievements Tab */}
        <TabsContent value="achievements" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Achievement</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Rarity</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.achievements.map((achievement) => (
                    <TableRow key={achievement.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4" />
                          <div>
                            <p className="font-medium">{achievement.name}</p>
                            <p className="text-xs text-muted-foreground">{achievement.description}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{achievement.achievementType}</Badge>
                      </TableCell>
                      <TableCell>{achievement.thresholdValue}</TableCell>
                      <TableCell>
                        <Badge className={rarityColors[achievement.rarity]}>
                          {achievement.rarity}
                        </Badge>
                      </TableCell>
                      <TableCell>{achievement.points} pts</TableCell>
                      <TableCell>
                        {achievement.isEnabled ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Easter Eggs Tab */}
        <TabsContent value="easter-eggs" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Easter Egg</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Effect</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Discoveries</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.easterEggs.map((egg) => (
                    <TableRow key={egg.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Egg className="h-4 w-4" />
                          <div>
                            <p className="font-medium">{egg.name}</p>
                            <p className="text-xs text-muted-foreground">{egg.description}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <Badge variant="outline">{egg.triggerType}</Badge>
                          <p className="text-xs text-muted-foreground mt-1 font-mono">
                            {egg.triggerValue.length > 30 ? egg.triggerValue.substring(0, 30) + '...' : egg.triggerValue}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{egg.effectType}</Badge>
                      </TableCell>
                      <TableCell>
                        {egg.effectDurationSeconds === 0 ? 'Permanent' : `${egg.effectDurationSeconds}s`}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{egg.discoveryCount} found</Badge>
                      </TableCell>
                      <TableCell>
                        {egg.isEnabled ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sounds Tab */}
        <TabsContent value="sounds" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sound</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Theme</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.sounds.map((sound) => (
                    <TableRow key={sound.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Volume2 className="h-4 w-4" />
                          <span className="font-medium">{sound.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{sound.soundCategory}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{sound.soundTheme}</Badge>
                      </TableCell>
                      <TableCell>{sound.volumeDefault}%</TableCell>
                      <TableCell>
                        {sound.isEnabled ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Message Dialog */}
      {editingMessage && (
        <Dialog open={!!editingMessage} onOpenChange={() => setEditingMessage(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Message</DialogTitle>
              <DialogDescription>Update the delight message</DialogDescription>
            </DialogHeader>
            <MessageForm
              categories={dashboard.categories}
              initialData={editingMessage}
              onSubmit={(updates) => updateMessageMutation.mutate({ id: editingMessage.id, updates })}
              isLoading={updateMessageMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Message Form Component
function MessageForm({
  categories,
  initialData,
  onSubmit,
  isLoading,
}: {
  categories: DelightCategory[];
  initialData?: DelightMessage;
  onSubmit: (data: Partial<DelightMessage>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    categoryId: initialData?.categoryId || categories[0]?.id || '',
    injectionPoint: initialData?.injectionPoint || 'pre_execution',
    triggerType: initialData?.triggerType || 'domain_loading',
    messageText: initialData?.messageText || '',
    displayStyle: initialData?.displayStyle || 'subtle',
    priority: initialData?.priority || 50,
    isEnabled: initialData?.isEnabled ?? true,
    requiresOptIn: initialData?.requiresOptIn ?? false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="categoryId">Category</Label>
          <Select value={formData.categoryId} onValueChange={(v) => setFormData(prev => ({ ...prev, categoryId: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="injectionPoint">Injection Point</Label>
          <Select value={formData.injectionPoint} onValueChange={(v) => setFormData(prev => ({ ...prev, injectionPoint: v as 'pre_execution' | 'during_execution' | 'post_execution' }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select injection point" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pre_execution">Pre-Execution</SelectItem>
              <SelectItem value="during_execution">During Execution</SelectItem>
              <SelectItem value="post_execution">Post-Execution</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="triggerType">Trigger Type</Label>
          <Select value={formData.triggerType} onValueChange={(v) => setFormData(prev => ({ ...prev, triggerType: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select trigger type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="domain_loading">Domain Loading</SelectItem>
              <SelectItem value="domain_transition">Domain Transition</SelectItem>
              <SelectItem value="time_aware">Time Awareness</SelectItem>
              <SelectItem value="model_dynamics">Model Dynamics</SelectItem>
              <SelectItem value="complexity_signals">Complexity Signals</SelectItem>
              <SelectItem value="synthesis_quality">Synthesis Quality</SelectItem>
              <SelectItem value="wellbeing">Wellbeing</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayStyle">Display Style</Label>
          <Select value={formData.displayStyle} onValueChange={(v) => setFormData(prev => ({ ...prev, displayStyle: v as 'subtle' | 'moderate' | 'expressive' }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select display style" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="subtle">Subtle</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="expressive">Expressive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="messageText">Message Text</Label>
        <Textarea
          id="messageText"
          value={formData.messageText}
          onChange={(e) => setFormData(prev => ({ ...prev, messageText: e.target.value }))}
          placeholder="Enter the message text..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priority">Priority (1-100)</Label>
          <Input
            id="priority"
            type="number"
            min={1}
            max={100}
            value={formData.priority}
            onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 50 }))}
          />
        </div>

        <div className="flex items-center gap-2 pt-8">
          <Switch
            id="isEnabled"
            checked={formData.isEnabled}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isEnabled: checked }))}
          />
          <Label htmlFor="isEnabled">Enabled</Label>
        </div>

        <div className="flex items-center gap-2 pt-8">
          <Switch
            id="requiresOptIn"
            checked={formData.requiresOptIn}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, requiresOptIn: checked }))}
          />
          <Label htmlFor="requiresOptIn">Requires Opt-in</Label>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading || !formData.messageText}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initialData ? 'Update Message' : 'Create Message'}
        </Button>
      </DialogFooter>
    </form>
  );
}
