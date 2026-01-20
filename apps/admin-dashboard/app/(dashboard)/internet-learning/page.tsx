'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  Globe, 
  Search,
  Database,
  Shield,
  RefreshCw,
  Save,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';

interface InternetLearningConfig {
  enabled: boolean;
  max_sources_per_query: number;
  max_crawl_depth: number;
  rate_limit_per_minute: number;
  cache_duration_hours: number;
  require_source_verification: boolean;
  blocked_domains: string[];
  allowed_content_types: string[];
  safety_filter_level: 'strict' | 'moderate' | 'permissive';
}

interface LearningStats {
  total_queries: number;
  sources_indexed: number;
  facts_learned: number;
  cache_hit_rate: number;
  avg_query_time_ms: number;
}

interface RecentQuery {
  id: string;
  query: string;
  sources_found: number;
  facts_extracted: number;
  status: 'completed' | 'failed' | 'pending';
  created_at: string;
}

async function fetchDashboard() {
  const res = await fetch('/api/admin/internet-learning/dashboard');
  if (!res.ok) throw new Error('Failed to fetch dashboard');
  return res.json();
}

async function updateConfig(config: Partial<InternetLearningConfig>) {
  const res = await fetch('/api/admin/internet-learning/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to update config');
}

export default function InternetLearningPage() {
  const queryClient = useQueryClient();
  const [editedConfig, setEditedConfig] = useState<Partial<InternetLearningConfig>>({});

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['internet-learning-dashboard'],
    queryFn: fetchDashboard,
  });

  const updateMutation = useMutation({
    mutationFn: updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internet-learning-dashboard'] });
      toast.success('Configuration saved');
    },
    onError: () => toast.error('Failed to save configuration'),
  });

  const config: InternetLearningConfig = dashboard?.config || {};
  const stats: LearningStats = dashboard?.stats || {};
  const recentQueries: RecentQuery[] = dashboard?.recent_queries || [];

  const getValue = <K extends keyof InternetLearningConfig>(key: K): InternetLearningConfig[K] => {
    return (editedConfig[key] ?? config[key]) as InternetLearningConfig[K];
  };

  const setValue = <K extends keyof InternetLearningConfig>(key: K, value: InternetLearningConfig[K]) => {
    setEditedConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    updateMutation.mutate({ ...config, ...editedConfig });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Globe className="h-8 w-8" />
            Internet Learning
          </h1>
          <p className="text-muted-foreground mt-1">
            Web-based knowledge acquisition and fact extraction
          </p>
        </div>
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Queries</CardDescription>
            <CardTitle className="text-3xl">{stats.total_queries?.toLocaleString() || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sources Indexed</CardDescription>
            <CardTitle className="text-3xl text-blue-500">{stats.sources_indexed?.toLocaleString() || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Facts Learned</CardDescription>
            <CardTitle className="text-3xl text-green-500">{stats.facts_learned?.toLocaleString() || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cache Hit Rate</CardDescription>
            <CardTitle className="text-3xl">{((stats.cache_hit_rate || 0) * 100).toFixed(1)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={(stats.cache_hit_rate || 0) * 100} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Query Time</CardDescription>
            <CardTitle className="text-3xl">{stats.avg_query_time_ms || 0}ms</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="queries">Recent Queries</TabsTrigger>
          <TabsTrigger value="safety">Safety Controls</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Query Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Internet Learning</Label>
                    <p className="text-sm text-muted-foreground">Allow web-based knowledge acquisition</p>
                  </div>
                  <Switch
                    checked={getValue('enabled')}
                    onCheckedChange={(v) => setValue('enabled', v)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Sources per Query</Label>
                  <Input
                    type="number"
                    value={getValue('max_sources_per_query') || 10}
                    onChange={(e) => setValue('max_sources_per_query', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Crawl Depth</Label>
                  <Input
                    type="number"
                    value={getValue('max_crawl_depth') || 2}
                    onChange={(e) => setValue('max_crawl_depth', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rate Limit (per minute)</Label>
                  <Input
                    type="number"
                    value={getValue('rate_limit_per_minute') || 60}
                    onChange={(e) => setValue('rate_limit_per_minute', parseInt(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Cache Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Cache Duration (hours)</Label>
                  <Input
                    type="number"
                    value={getValue('cache_duration_hours') || 24}
                    onChange={(e) => setValue('cache_duration_hours', parseInt(e.target.value))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Require Source Verification</Label>
                    <p className="text-sm text-muted-foreground">Validate sources before indexing</p>
                  </div>
                  <Switch
                    checked={getValue('require_source_verification')}
                    onCheckedChange={(v) => setValue('require_source_verification', v)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="queries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Queries</CardTitle>
              <CardDescription>Latest internet learning queries</CardDescription>
            </CardHeader>
            <CardContent>
              {recentQueries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recent queries</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Query</TableHead>
                      <TableHead>Sources</TableHead>
                      <TableHead>Facts</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentQueries.map((query) => (
                      <TableRow key={query.id}>
                        <TableCell className="max-w-[300px] truncate">{query.query}</TableCell>
                        <TableCell>{query.sources_found}</TableCell>
                        <TableCell>{query.facts_extracted}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(query.status)}
                            <span className="capitalize">{query.status}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(query.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="safety" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Safety Controls
              </CardTitle>
              <CardDescription>Configure content safety and domain filtering</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Safety Filter Level</Label>
                <div className="flex gap-2">
                  {['strict', 'moderate', 'permissive'].map((level) => (
                    <Button
                      key={level}
                      variant={getValue('safety_filter_level') === level ? 'default' : 'outline'}
                      onClick={() => setValue('safety_filter_level', level as 'strict' | 'moderate' | 'permissive')}
                      className="capitalize"
                    >
                      {level}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Blocked Domains</Label>
                <div className="flex flex-wrap gap-2">
                  {(getValue('blocked_domains') || []).map((domain, i) => (
                    <Badge key={i} variant="destructive">{domain}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
