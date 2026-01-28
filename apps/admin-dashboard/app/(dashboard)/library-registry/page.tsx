'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { 
  Library, 
  Search,
  Star,
  Code,
  RefreshCw,
  ExternalLink,
  Package,
  Cpu,
  Brain,
} from 'lucide-react';

interface LibraryInfo {
  id: string;
  name: string;
  display_name: string;
  category: string;
  description: string;
  version: string;
  stars: number;
  repo_url: string;
  is_enabled: boolean;
  usage_count: number;
  avg_latency_ms: number;
  success_rate: number;
  domains: string[];
  features: string[];
}

async function fetchLibraries(): Promise<LibraryInfo[]> {
  const res = await fetch('/api/admin/library-registry/libraries');
  if (!res.ok) throw new Error('Failed to fetch libraries');
  const data = await res.json();
  return data.libraries || [];
}

export default function LibraryRegistryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data: libraries = [], isLoading } = useQuery({
    queryKey: ['library-registry'],
    queryFn: fetchLibraries,
  });

  const categories = Array.from(new Set(libraries.map(l => l.category)));

  const filteredLibraries = libraries.filter(lib => {
    const matchesSearch = 
      lib.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lib.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || lib.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const enabledCount = libraries.filter(l => l.is_enabled).length;
  const totalUsage = libraries.reduce((sum, l) => sum + l.usage_count, 0);

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'formal_reasoning': return <Brain className="h-4 w-4" />;
      case 'neural_symbolic': return <Cpu className="h-4 w-4" />;
      case 'knowledge_graph': return <Library className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
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
          <Library className="h-8 w-8" />
          Library Registry
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage integrated libraries for formal reasoning, knowledge graphs, and more
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Libraries</CardDescription>
            <CardTitle className="text-3xl">{libraries.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Enabled</CardDescription>
            <CardTitle className="text-3xl text-green-500">{enabledCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Categories</CardDescription>
            <CardTitle className="text-3xl">{categories.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Invocations</CardDescription>
            <CardTitle className="text-3xl">{totalUsage.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Available Libraries</CardTitle>
              <CardDescription>Browse and manage library integrations</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search libraries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <div className="flex gap-1">
                <Button
                  variant={categoryFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCategoryFilter('all')}
                >
                  All
                </Button>
                {categories.slice(0, 4).map((cat) => (
                  <Button
                    key={cat}
                    variant={categoryFilter === cat ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCategoryFilter(cat)}
                    className="capitalize"
                  >
                    {cat.replace('_', ' ')}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Library</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Stars</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Success Rate</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLibraries.map((lib) => (
                <TableRow key={lib.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <Code className="h-4 w-4 text-muted-foreground" />
                        {lib.display_name}
                      </div>
                      <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {lib.description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {getCategoryIcon(lib.category)}
                      <span className="ml-1">{lib.category.replace('_', ' ')}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{lib.version}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500" />
                      {lib.stars?.toLocaleString() || 0}
                    </div>
                  </TableCell>
                  <TableCell>
                    {lib.is_enabled ? (
                      <Badge className="bg-green-500">Enabled</Badge>
                    ) : (
                      <Badge variant="secondary">Disabled</Badge>
                    )}
                  </TableCell>
                  <TableCell>{lib.usage_count.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={lib.success_rate * 100} className="w-16 h-2" />
                      <span className="text-sm">{(lib.success_rate * 100).toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lib.avg_latency_ms}ms
                  </TableCell>
                  <TableCell>
                    {lib.repo_url && (
                      <Button variant="ghost" size="icon" asChild>
                        <a href={lib.repo_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
