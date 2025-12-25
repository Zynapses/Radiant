'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Sparkles, Zap, RefreshCw, Search, GripVertical } from 'lucide-react';

interface Model {
  id: string;
  displayName: string;
  providerId: string;
  providerName: string;
  isNovel: boolean;
  category: string;
  thinktankEnabled: boolean;
  thinktankDisplayOrder: number;
  contextWindow: number;
  pricing: {
    inputPer1M: number;
    outputPer1M: number;
  };
}

export default function ModelCategoriesPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'standard' | 'novel'>('all');
  const queryClient = useQueryClient();

  const { data: models, isLoading } = useQuery<Model[]>({
    queryKey: ['thinktank-model-categories'],
    queryFn: () =>
      fetch('/api/admin/thinktank/model-categories').then((r) => r.json()),
  });

  const toggleMutation = useMutation({
    mutationFn: ({
      modelId,
      enabled,
    }: {
      modelId: string;
      enabled: boolean;
    }) =>
      fetch(`/api/admin/thinktank/model-categories/${modelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thinktankEnabled: enabled }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinktank-model-categories'] });
      toast.success('Model visibility updated');
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({
      modelId,
      isNovel,
    }: {
      modelId: string;
      isNovel: boolean;
    }) =>
      fetch(`/api/admin/thinktank/model-categories/${modelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isNovel }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinktank-model-categories'] });
      toast.success('Model category updated');
    },
  });

  const filteredModels = (models || []).filter((model) => {
    const matchesSearch =
      model.displayName.toLowerCase().includes(search.toLowerCase()) ||
      model.providerId.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all' ||
      (filter === 'novel' && model.isNovel) ||
      (filter === 'standard' && !model.isNovel);
    return matchesSearch && matchesFilter;
  });

  const standardCount = (models || []).filter((m) => !m.isNovel).length;
  const novelCount = (models || []).filter((m) => m.isNovel).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Model Categories</h1>
          <p className="text-muted-foreground">
            Configure which models appear in Think Tank and their categorization
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            queryClient.invalidateQueries({
              queryKey: ['thinktank-model-categories'],
            })
          }
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className={`cursor-pointer ${filter === 'all' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setFilter('all')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              All Models
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(models || []).length}</div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer ${filter === 'standard' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setFilter('standard')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-500" />
              Standard Models
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{standardCount}</div>
            <p className="text-xs text-muted-foreground">Production-ready</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer ${filter === 'novel' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setFilter('novel')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Novel Models
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{novelCount}</div>
            <p className="text-xs text-muted-foreground">Cutting-edge/Experimental</p>
          </CardContent>
        </Card>
      </div>

      {/* Models Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search models..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Context</TableHead>
                <TableHead className="text-right">Input $/1M</TableHead>
                <TableHead className="text-right">Output $/1M</TableHead>
                <TableHead>Visible</TableHead>
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
                filteredModels.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {model.isNovel ? (
                          <Sparkles className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Zap className="h-4 w-4 text-blue-500" />
                        )}
                        <div>
                          <div className="font-medium">{model.displayName}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {model.id}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{model.providerName || model.providerId}</TableCell>
                    <TableCell>
                      <Badge
                        variant={model.isNovel ? 'secondary' : 'outline'}
                        className="cursor-pointer"
                        onClick={() =>
                          updateCategoryMutation.mutate({
                            modelId: model.id,
                            isNovel: !model.isNovel,
                          })
                        }
                      >
                        {model.isNovel ? 'Novel' : 'Standard'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {(model.contextWindow / 1000).toFixed(0)}K
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${model.pricing?.inputPer1M?.toFixed(2) || '0.00'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${model.pricing?.outputPer1M?.toFixed(2) || '0.00'}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={model.thinktankEnabled}
                        onCheckedChange={(enabled) =>
                          toggleMutation.mutate({ modelId: model.id, enabled })
                        }
                      />
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
