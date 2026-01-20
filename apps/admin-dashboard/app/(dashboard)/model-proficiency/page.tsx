'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Trophy, 
  Search,
  TrendingUp,
  Cpu,
  RefreshCw,
  Star,
  Target,
} from 'lucide-react';

interface ModelProficiency {
  model_id: string;
  model_name: string;
  provider: string;
  domain: string;
  subspecialty: string;
  proficiency_score: number;
  accuracy: number;
  latency_ms: number;
  cost_efficiency: number;
  sample_count: number;
  rank: number;
  trend: 'up' | 'down' | 'stable';
}

interface DomainLeaderboard {
  domain: string;
  models: ModelProficiency[];
}

async function fetchProficiencies(): Promise<DomainLeaderboard[]> {
  const res = await fetch('/api/admin/model-proficiency/rankings');
  if (!res.ok) throw new Error('Failed to fetch proficiencies');
  const data = await res.json();
  return data.leaderboards || [];
}

export default function ModelProficiencyPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');

  const { data: leaderboards = [], isLoading } = useQuery({
    queryKey: ['model-proficiency'],
    queryFn: fetchProficiencies,
  });

  const allModels = leaderboards.flatMap(lb => lb.models);
  const domains = leaderboards.map(lb => lb.domain);

  const filteredModels = allModels.filter(model => {
    const matchesSearch = model.model_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDomain = selectedDomain === 'all' || model.domain === selectedDomain;
    return matchesSearch && matchesDomain;
  });

  const topModels = [...allModels].sort((a, b) => b.proficiency_score - a.proficiency_score).slice(0, 5);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down': return <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />;
      default: return <span className="h-4 w-4 text-muted-foreground">→</span>;
    }
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1: return <Badge className="bg-yellow-500">🥇 1st</Badge>;
      case 2: return <Badge className="bg-gray-400">🥈 2nd</Badge>;
      case 3: return <Badge className="bg-orange-600">🥉 3rd</Badge>;
      default: return <Badge variant="outline">#{rank}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Trophy className="h-8 w-8" />
          Model Proficiency Rankings
        </h1>
        <p className="text-muted-foreground mt-1">
          Domain-specific model performance rankings and proficiency scores
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Models Ranked</CardDescription>
            <CardTitle className="text-3xl">{allModels.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Domains Covered</CardDescription>
            <CardTitle className="text-3xl">{domains.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Proficiency</CardDescription>
            <CardTitle className="text-3xl text-green-500">
              {allModels.length > 0
                ? ((allModels.reduce((s, m) => s + m.proficiency_score, 0) / allModels.length) * 100).toFixed(1)
                : 0}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Top Performer</CardDescription>
            <CardTitle className="text-xl truncate">
              {topModels[0]?.model_name || 'N/A'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="rankings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rankings">All Rankings</TabsTrigger>
          <TabsTrigger value="leaderboard">Top 5 Leaderboard</TabsTrigger>
          <TabsTrigger value="by-domain">By Domain</TabsTrigger>
        </TabsList>

        <TabsContent value="rankings" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Model Proficiency Rankings</CardTitle>
                  <CardDescription>Performance scores across all domains</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search models..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="All Domains" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Domains</SelectItem>
                      {domains.map((domain) => (
                        <SelectItem key={domain} value={domain}>{domain}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Proficiency</TableHead>
                    <TableHead>Accuracy</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead>Samples</TableHead>
                    <TableHead>Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredModels.slice(0, 20).map((model) => (
                    <TableRow key={`${model.model_id}-${model.domain}`}>
                      <TableCell>{getRankBadge(model.rank)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{model.model_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{model.provider}</Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{model.domain}</div>
                          {model.subspecialty && (
                            <div className="text-xs text-muted-foreground">{model.subspecialty}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={model.proficiency_score * 100} className="w-16 h-2" />
                          <span className="font-medium">{(model.proficiency_score * 100).toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{(model.accuracy * 100).toFixed(1)}%</TableCell>
                      <TableCell className="text-muted-foreground">{model.latency_ms}ms</TableCell>
                      <TableCell className="text-muted-foreground">{model.sample_count.toLocaleString()}</TableCell>
                      <TableCell>{getTrendIcon(model.trend)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Top 5 Models Overall
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topModels.map((model, i) => (
                  <div key={model.model_id} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="text-3xl font-bold text-muted-foreground w-8">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-lg">{model.model_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {model.provider} • {model.domain}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-500">
                        {(model.proficiency_score * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">proficiency</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-domain" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {leaderboards.map((lb) => (
              <Card key={lb.domain}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    {lb.domain}
                  </CardTitle>
                  <CardDescription>{lb.models.length} models ranked</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {lb.models.slice(0, 3).map((model) => (
                      <div key={model.model_id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getRankBadge(model.rank)}
                          <span className="font-medium">{model.model_name}</span>
                        </div>
                        <span className="text-green-500 font-medium">
                          {(model.proficiency_score * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
