'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles,
  MessageSquare,
  Trophy,
  Egg,
  Volume2,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  RefreshCw,
  Loader2,
  ArrowLeft,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

// Types
interface OverviewStats {
  totalMessagesShown: number;
  totalAchievementsUnlocked: number;
  totalEasterEggsDiscovered: number;
  totalSoundsPlayed: number;
  totalActiveUsers: number;
  firstActivityDate: string | null;
  lastActivityDate: string | null;
  daysWithActivity: number;
}

interface DailyStats {
  date: string;
  messagesShown: number;
  achievementsUnlocked: number;
  easterEggsDiscovered: number;
  soundsPlayed: number;
  activeUsers: number;
  messagesByCategory: Record<string, number>;
  messagesByInjectionPoint: Record<string, number>;
  usersByPersonalityMode: Record<string, number>;
}

interface MessageStats {
  messageId: number;
  messageText: string;
  categoryId: string;
  injectionPoint: string;
  triggerType: string;
  displayStyle: string;
  totalShown: number;
  totalUniqueUsers: number;
  shownToday: number;
  shownThisWeek: number;
  shownThisMonth: number;
  firstShownAt: string | null;
  lastShownAt: string | null;
}

interface AchievementStats {
  achievementId: string;
  name: string;
  description: string | null;
  achievementType: string;
  rarity: string;
  points: number;
  totalUnlocked: number;
  totalInProgress: number;
  unlockedToday: number;
  unlockedThisWeek: number;
  unlockedThisMonth: number;
  averageDaysToUnlock: number;
  firstUnlockedAt: string | null;
  lastUnlockedAt: string | null;
}

interface EasterEggStats {
  easterEggId: string;
  name: string;
  description: string | null;
  triggerType: string;
  effectType: string;
  totalDiscoveries: number;
  totalActivations: number;
  discoveredToday: number;
  discoveredThisWeek: number;
  discoveredThisMonth: number;
  firstDiscoveredAt: string | null;
  lastDiscoveredAt: string | null;
}

interface WeeklyTrend {
  weekStart: string;
  messagesShown: number;
  achievementsUnlocked: number;
  easterEggsDiscovered: number;
  activeUsers: number;
}

interface DelightStatistics {
  overview: OverviewStats;
  dailyStats: DailyStats[];
  topMessages: MessageStats[];
  achievementStats: AchievementStats[];
  easterEggStats: EasterEggStats[];
  weeklyTrends: WeeklyTrend[];
}

async function fetchStatistics(): Promise<DelightStatistics> {
  const res = await fetch('/api/admin/delight/statistics');
  if (!res.ok) throw new Error('Failed to fetch statistics');
  return res.json();
}

const rarityColors: Record<string, string> = {
  common: 'bg-gray-100 text-gray-800',
  uncommon: 'bg-green-100 text-green-800',
  rare: 'bg-blue-100 text-blue-800',
  epic: 'bg-purple-100 text-purple-800',
  legendary: 'bg-yellow-100 text-yellow-800',
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString();
}

function calculateTrend(current: number, previous: number): { value: number; isPositive: boolean } {
  if (previous === 0) return { value: 0, isPositive: true };
  const change = ((current - previous) / previous) * 100;
  return { value: Math.abs(change), isPositive: change >= 0 };
}

export default function DelightStatisticsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('30');

  const { data: stats, isLoading, error, refetch } = useQuery({
    queryKey: ['delight-statistics', timeRange],
    queryFn: fetchStatistics,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">Failed to load statistics</p>
        <Button onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  // Calculate week-over-week trends
  const thisWeek = stats.weeklyTrends[0] || { messagesShown: 0, achievementsUnlocked: 0, easterEggsDiscovered: 0, activeUsers: 0 };
  const lastWeek = stats.weeklyTrends[1] || { messagesShown: 0, achievementsUnlocked: 0, easterEggsDiscovered: 0, activeUsers: 0 };
  
  const messageTrend = calculateTrend(thisWeek.messagesShown, lastWeek.messagesShown);
  const achievementTrend = calculateTrend(thisWeek.achievementsUnlocked, lastWeek.achievementsUnlocked);
  const easterEggTrend = calculateTrend(thisWeek.easterEggsDiscovered, lastWeek.easterEggsDiscovered);
  const userTrend = calculateTrend(thisWeek.activeUsers, lastWeek.activeUsers);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/thinktank/delight">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-blue-500" />
              Delight System Statistics
            </h1>
            <p className="text-muted-foreground mt-1">
              Persistent usage analytics and engagement metrics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Messages Shown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.overview.totalMessagesShown)}</div>
            <div className="flex items-center text-xs mt-1">
              {messageTrend.isPositive ? (
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={messageTrend.isPositive ? 'text-green-500' : 'text-red-500'}>
                {messageTrend.value.toFixed(1)}%
              </span>
              <span className="text-muted-foreground ml-1">vs last week</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Achievements Unlocked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.overview.totalAchievementsUnlocked)}</div>
            <div className="flex items-center text-xs mt-1">
              {achievementTrend.isPositive ? (
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={achievementTrend.isPositive ? 'text-green-500' : 'text-red-500'}>
                {achievementTrend.value.toFixed(1)}%
              </span>
              <span className="text-muted-foreground ml-1">vs last week</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Egg className="h-4 w-4" />
              Easter Eggs Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.overview.totalEasterEggsDiscovered)}</div>
            <div className="flex items-center text-xs mt-1">
              {easterEggTrend.isPositive ? (
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={easterEggTrend.isPositive ? 'text-green-500' : 'text-red-500'}>
                {easterEggTrend.value.toFixed(1)}%
              </span>
              <span className="text-muted-foreground ml-1">vs last week</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.overview.totalActiveUsers)}</div>
            <div className="flex items-center text-xs mt-1">
              {userTrend.isPositive ? (
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={userTrend.isPositive ? 'text-green-500' : 'text-red-500'}>
                {userTrend.value.toFixed(1)}%
              </span>
              <span className="text-muted-foreground ml-1">vs last week</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              First Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{formatDate(stats.overview.firstActivityDate)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Last Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{formatDate(stats.overview.lastActivityDate)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Days Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{stats.overview.daysWithActivity} days</div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Weekly Trends</TabsTrigger>
          <TabsTrigger value="messages">Top Messages</TabsTrigger>
          <TabsTrigger value="achievements">Achievement Stats</TabsTrigger>
          <TabsTrigger value="easter-eggs">Easter Egg Stats</TabsTrigger>
        </TabsList>

        {/* Weekly Trends Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Activity Trends</CardTitle>
              <CardDescription>12-week history of delight system engagement</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Week Starting</TableHead>
                    <TableHead className="text-right">Messages</TableHead>
                    <TableHead className="text-right">Achievements</TableHead>
                    <TableHead className="text-right">Easter Eggs</TableHead>
                    <TableHead className="text-right">Active Users</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.weeklyTrends.map((week, index) => (
                    <TableRow key={week.weekStart}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {formatDate(week.weekStart)}
                          {index === 0 && <Badge variant="secondary">Current</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(week.messagesShown)}</TableCell>
                      <TableCell className="text-right font-mono">{week.achievementsUnlocked}</TableCell>
                      <TableCell className="text-right font-mono">{week.easterEggsDiscovered}</TableCell>
                      <TableCell className="text-right font-mono">{week.activeUsers}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Messages Tab */}
        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Most Shown Messages</CardTitle>
              <CardDescription>Top 20 messages by total displays</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Message</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Today</TableHead>
                    <TableHead className="text-right">This Week</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.topMessages.map((msg) => (
                    <TableRow key={msg.messageId}>
                      <TableCell className="max-w-md">
                        <p className="truncate text-sm">{msg.messageText}</p>
                        <p className="text-xs text-muted-foreground">{msg.injectionPoint} / {msg.triggerType}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{msg.categoryId}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">{formatNumber(msg.totalShown)}</TableCell>
                      <TableCell className="text-right font-mono">{msg.shownToday}</TableCell>
                      <TableCell className="text-right font-mono">{msg.shownThisWeek}</TableCell>
                      <TableCell className="text-right font-mono">{msg.totalUniqueUsers}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Achievement Stats Tab */}
        <TabsContent value="achievements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Achievement Unlock Statistics</CardTitle>
              <CardDescription>How users are progressing through achievements</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Achievement</TableHead>
                    <TableHead>Rarity</TableHead>
                    <TableHead className="text-right">Unlocked</TableHead>
                    <TableHead className="text-right">In Progress</TableHead>
                    <TableHead className="text-right">This Week</TableHead>
                    <TableHead className="text-right">Avg Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.achievementStats.map((ach) => (
                    <TableRow key={ach.achievementId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4" />
                          <div>
                            <p className="font-medium">{ach.name}</p>
                            <p className="text-xs text-muted-foreground">{ach.description}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={rarityColors[ach.rarity]}>{ach.rarity}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">{ach.totalUnlocked}</TableCell>
                      <TableCell className="text-right font-mono">{ach.totalInProgress}</TableCell>
                      <TableCell className="text-right font-mono">{ach.unlockedThisWeek}</TableCell>
                      <TableCell className="text-right font-mono">{ach.averageDaysToUnlock.toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Easter Egg Stats Tab */}
        <TabsContent value="easter-eggs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Easter Egg Discovery Statistics</CardTitle>
              <CardDescription>How users are finding hidden features</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Easter Egg</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead className="text-right">Discoveries</TableHead>
                    <TableHead className="text-right">Activations</TableHead>
                    <TableHead className="text-right">This Week</TableHead>
                    <TableHead>First Found</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.easterEggStats.map((egg) => (
                    <TableRow key={egg.easterEggId}>
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
                        <Badge variant="outline">{egg.triggerType}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">{egg.totalDiscoveries}</TableCell>
                      <TableCell className="text-right font-mono">{egg.totalActivations}</TableCell>
                      <TableCell className="text-right font-mono">{egg.discoveredThisWeek}</TableCell>
                      <TableCell className="text-sm">{formatDate(egg.firstDiscoveredAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
