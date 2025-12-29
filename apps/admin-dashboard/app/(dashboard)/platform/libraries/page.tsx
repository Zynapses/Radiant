'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { 
  Library, 
  Settings, 
  Search, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  Star,
  Code,
  Brain,
  Activity,
  Clock,
  Filter,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';

interface LibraryConfig {
  configId: string;
  libraryAssistEnabled: boolean;
  autoSuggestLibraries: boolean;
  maxLibrariesPerRequest: number;
  autoUpdateEnabled: boolean;
  updateFrequency: 'hourly' | 'daily' | 'weekly' | 'manual';
  updateTimeUtc: string;
  lastUpdateAt: string | null;
  nextUpdateAt: string | null;
  minProficiencyMatch: number;
  disabledLibraries: string[];
}

interface LibraryItem {
  libraryId: string;
  name: string;
  category: string;
  license: string;
  repo: string;
  description: string;
  beats: string[];
  stars: number;
  languages: string[];
  domains: string[];
  proficiencies: {
    reasoning_depth: number;
    mathematical_quantitative: number;
    code_generation: number;
    creative_generative: number;
    research_synthesis: number;
    factual_recall_precision: number;
    multi_step_problem_solving: number;
    domain_terminology_handling: number;
  };
}

interface UsageStats {
  libraryId: string;
  totalInvocations: number;
  successRate: number;
  avgExecutionTimeMs: number;
  lastUsedAt: string | null;
}

interface Dashboard {
  config: LibraryConfig;
  stats: {
    totalLibraries: number;
    enabledLibraries: number;
    totalInvocations: number;
    successRate: number;
    lastUpdateAt: string | null;
  };
  topLibraries: UsageStats[];
  categoryBreakdown: Array<{ category: string; count: number; enabled: number }>;
}

const PROFICIENCY_LABELS: Record<string, string> = {
  reasoning_depth: 'Reasoning',
  mathematical_quantitative: 'Math',
  code_generation: 'Code',
  creative_generative: 'Creative',
  research_synthesis: 'Research',
  factual_recall_precision: 'Accuracy',
  multi_step_problem_solving: 'Problem Solving',
  domain_terminology_handling: 'Domain Terms',
};

export default function LibraryRegistryPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [libraries, setLibraries] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedLibrary, setExpandedLibrary] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/libraries/dashboard');
      const data = await response.json();
      if (data.success) {
        setDashboard(data.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
  }, []);

  const fetchLibraries = useCallback(async () => {
    try {
      const url = selectedCategory === 'all' 
        ? '/api/admin/libraries'
        : `/api/admin/libraries?category=${encodeURIComponent(selectedCategory)}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setLibraries(data.data);
      }
    } catch (error) {
      console.error('Error fetching libraries:', error);
    }
  }, [selectedCategory]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchDashboard(), fetchLibraries()]);
      setLoading(false);
    };
    loadData();
  }, [fetchDashboard, fetchLibraries]);

  const updateConfig = async (updates: Partial<LibraryConfig>) => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/libraries/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await response.json();
      if (data.success && dashboard) {
        setDashboard({ ...dashboard, config: data.data });
      }
    } catch (error) {
      console.error('Error updating config:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleLibrary = async (libraryId: string, enabled: boolean) => {
    try {
      const endpoint = enabled 
        ? `/api/admin/libraries/enable/${libraryId}`
        : `/api/admin/libraries/disable/${libraryId}`;
      await fetch(endpoint, { method: 'POST' });
      await fetchDashboard();
    } catch (error) {
      console.error('Error toggling library:', error);
    }
  };

  const triggerUpdate = async () => {
    try {
      await fetch('/api/admin/libraries/seed', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraries: [] }), // Will use bundled seed data
      });
      await fetchDashboard();
    } catch (error) {
      console.error('Error triggering update:', error);
    }
  };

  const filteredLibraries = libraries.filter(lib => 
    lib.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lib.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lib.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isDisabled = (libraryId: string) => 
    dashboard?.config.disabledLibraries.includes(libraryId) ?? false;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Open Source Library Registry</h1>
          <p className="text-muted-foreground">
            AI capability extensions through open-source tools
          </p>
        </div>
        <Button onClick={triggerUpdate} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync Libraries
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Libraries</CardTitle>
            <Library className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.stats.totalLibraries ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.stats.enabledLibraries ?? 0} enabled
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invocations</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.stats.totalInvocations ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {((dashboard?.stats.successRate ?? 0) * 100).toFixed(1)}% success rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.categoryBreakdown.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Across all domains
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Update</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.stats.lastUpdateAt 
                ? new Date(dashboard.stats.lastUpdateAt).toLocaleDateString() 
                : 'Never'}
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.config.updateFrequency} updates
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="libraries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="libraries">Libraries</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="usage">Usage Analytics</TabsTrigger>
        </TabsList>

        {/* Libraries Tab */}
        <TabsContent value="libraries" className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search libraries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {dashboard?.categoryBreakdown.map(cat => (
                  <SelectItem key={cat.category} value={cat.category}>
                    {cat.category} ({cat.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4">
            {filteredLibraries.map(lib => (
              <Card key={lib.libraryId} className={isDisabled(lib.libraryId) ? 'opacity-60' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{lib.name}</CardTitle>
                        <Badge variant="outline">{lib.category}</Badge>
                        <Badge variant="secondary">{lib.license}</Badge>
                        <div className="flex items-center text-muted-foreground text-sm">
                          <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                          {lib.stars.toLocaleString()}
                        </div>
                      </div>
                      <CardDescription className="mt-1">{lib.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={!isDisabled(lib.libraryId)}
                        onCheckedChange={(checked) => toggleLibrary(lib.libraryId, checked)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedLibrary(
                          expandedLibrary === lib.libraryId ? null : lib.libraryId
                        )}
                      >
                        {expandedLibrary === lib.libraryId ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                {expandedLibrary === lib.libraryId && (
                  <CardContent className="pt-0">
                    <div className="grid gap-4 md:grid-cols-2 mt-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Proficiency Scores</h4>
                        <div className="space-y-2">
                          {Object.entries(lib.proficiencies).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-24">
                                {PROFICIENCY_LABELS[key] || key}
                              </span>
                              <div className="flex-1 bg-secondary rounded-full h-2">
                                <div 
                                  className="bg-primary rounded-full h-2" 
                                  style={{ width: `${value * 10}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium w-6">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-medium mb-2">Languages</h4>
                          <div className="flex flex-wrap gap-1">
                            {lib.languages.map(lang => (
                              <Badge key={lang} variant="outline" className="text-xs">
                                {lang}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium mb-2">Beats</h4>
                          <div className="flex flex-wrap gap-1">
                            {lib.beats.map(beat => (
                              <Badge key={beat} variant="secondary" className="text-xs">
                                {beat}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium mb-2">Domains</h4>
                          <div className="flex flex-wrap gap-1">
                            {lib.domains.map(domain => (
                              <Badge key={domain} className="text-xs">
                                {domain.replace(/_/g, ' ')}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <a 
                          href={`https://${lib.repo}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Repository
                        </a>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Library Assist Settings
              </CardTitle>
              <CardDescription>
                Configure how AI uses open-source libraries to solve problems
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable Library Assist</p>
                  <p className="text-sm text-muted-foreground">
                    Allow AI to suggest and use libraries
                  </p>
                </div>
                <Switch
                  checked={dashboard?.config.libraryAssistEnabled ?? false}
                  onCheckedChange={(checked) => updateConfig({ libraryAssistEnabled: checked })}
                  disabled={saving}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-Suggest Libraries</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically suggest relevant libraries for tasks
                  </p>
                </div>
                <Switch
                  checked={dashboard?.config.autoSuggestLibraries ?? false}
                  onCheckedChange={(checked) => updateConfig({ autoSuggestLibraries: checked })}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Max Libraries Per Request</p>
                  <span className="text-sm font-medium">
                    {dashboard?.config.maxLibrariesPerRequest ?? 5}
                  </span>
                </div>
                <Slider
                  value={[dashboard?.config.maxLibrariesPerRequest ?? 5]}
                  min={1}
                  max={10}
                  step={1}
                  onValueChange={([value]) => updateConfig({ maxLibrariesPerRequest: value })}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Minimum Proficiency Match</p>
                  <span className="text-sm font-medium">
                    {((dashboard?.config.minProficiencyMatch ?? 0.5) * 100).toFixed(0)}%
                  </span>
                </div>
                <Slider
                  value={[(dashboard?.config.minProficiencyMatch ?? 0.5) * 100]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([value]) => updateConfig({ minProficiencyMatch: value / 100 })}
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  Only suggest libraries with proficiency match above this threshold
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Update Settings
              </CardTitle>
              <CardDescription>
                Configure automatic library registry updates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto Update</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically check for library updates
                  </p>
                </div>
                <Switch
                  checked={dashboard?.config.autoUpdateEnabled ?? false}
                  onCheckedChange={(checked) => updateConfig({ autoUpdateEnabled: checked })}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <p className="font-medium">Update Frequency</p>
                <Select
                  value={dashboard?.config.updateFrequency ?? 'daily'}
                  onValueChange={(value: 'hourly' | 'daily' | 'weekly' | 'manual') => 
                    updateConfig({ updateFrequency: value })
                  }
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="manual">Manual Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="font-medium">Update Time (UTC)</p>
                <Input
                  type="time"
                  value={dashboard?.config.updateTimeUtc ?? '03:00'}
                  onChange={(e) => updateConfig({ updateTimeUtc: e.target.value })}
                  disabled={saving}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usage Analytics Tab */}
        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Top Libraries by Usage
              </CardTitle>
              <CardDescription>
                Most frequently used libraries by AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard?.topLibraries && dashboard.topLibraries.length > 0 ? (
                <div className="space-y-4">
                  {dashboard.topLibraries.map((stat, index) => (
                    <div key={stat.libraryId} className="flex items-center gap-4">
                      <span className="text-2xl font-bold text-muted-foreground w-8">
                        #{index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium">{stat.libraryId}</p>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <span>{stat.totalInvocations} invocations</span>
                          <span>{(stat.successRate * 100).toFixed(1)}% success</span>
                          <span>{stat.avgExecutionTimeMs.toFixed(0)}ms avg</span>
                        </div>
                      </div>
                      {stat.successRate >= 0.9 ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : stat.successRate >= 0.7 ? (
                        <Activity className="h-5 w-5 text-yellow-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No usage data yet</p>
                  <p className="text-sm">Libraries will appear here once AI starts using them</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Category Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {dashboard?.categoryBreakdown.map(cat => (
                  <div key={cat.category} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                    <span className="font-medium">{cat.category}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{cat.count}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {cat.enabled} enabled
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
