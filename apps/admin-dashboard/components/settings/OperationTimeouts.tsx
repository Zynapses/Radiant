'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Clock,
  Save,
  Download,
  RotateCcw,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface OperationTimeout {
  id: string;
  category: string;
  operation: string;
  defaultTimeout: number;
  currentTimeout: number;
  minTimeout: number;
  maxTimeout: number;
  description: string;
}

const TIMEOUT_CATEGORIES = [
  { id: 'snapshot', label: 'Snapshot Operations', icon: '📸' },
  { id: 'infrastructure', label: 'Infrastructure', icon: '🏗️' },
  { id: 'migration', label: 'Migrations', icon: '🔄' },
  { id: 'health', label: 'Health Checks', icon: '❤️' },
  { id: 'lock', label: 'Deployment Lock', icon: '🔒' },
  { id: 'ai', label: 'AI Operations', icon: '🤖' },
];

const DEFAULT_TIMEOUTS: OperationTimeout[] = [
  {
    id: 'snapshot_aurora',
    category: 'snapshot',
    operation: 'Aurora Snapshot',
    defaultTimeout: 300,
    currentTimeout: 300,
    minTimeout: 60,
    maxTimeout: 900,
    description: 'Time to create Aurora database snapshot',
  },
  {
    id: 'snapshot_dynamodb',
    category: 'snapshot',
    operation: 'DynamoDB Backup',
    defaultTimeout: 180,
    currentTimeout: 180,
    minTimeout: 30,
    maxTimeout: 600,
    description: 'Time to create DynamoDB on-demand backup',
  },
  {
    id: 'snapshot_s3',
    category: 'snapshot',
    operation: 'S3 Versioning',
    defaultTimeout: 120,
    currentTimeout: 120,
    minTimeout: 30,
    maxTimeout: 300,
    description: 'Time to verify S3 versioning state',
  },
  {
    id: 'infrastructure_cloudformation',
    category: 'infrastructure',
    operation: 'CloudFormation Deploy',
    defaultTimeout: 900,
    currentTimeout: 900,
    minTimeout: 300,
    maxTimeout: 3600,
    description: 'Time for CDK/CloudFormation stack deployment',
  },
  {
    id: 'infrastructure_lambda',
    category: 'infrastructure',
    operation: 'Lambda Deploy',
    defaultTimeout: 300,
    currentTimeout: 300,
    minTimeout: 60,
    maxTimeout: 600,
    description: 'Time to deploy Lambda functions',
  },
  {
    id: 'migration_step',
    category: 'migration',
    operation: 'Migration Step',
    defaultTimeout: 300,
    currentTimeout: 300,
    minTimeout: 30,
    maxTimeout: 1800,
    description: 'Time for single migration step',
  },
  {
    id: 'migration_total',
    category: 'migration',
    operation: 'Migration Total',
    defaultTimeout: 1800,
    currentTimeout: 1800,
    minTimeout: 300,
    maxTimeout: 7200,
    description: 'Total time for all migrations',
  },
  {
    id: 'health_endpoint',
    category: 'health',
    operation: 'Endpoint Check',
    defaultTimeout: 10,
    currentTimeout: 10,
    minTimeout: 5,
    maxTimeout: 60,
    description: 'Time for single health check request',
  },
  {
    id: 'health_total',
    category: 'health',
    operation: 'Health Check Total',
    defaultTimeout: 120,
    currentTimeout: 120,
    minTimeout: 30,
    maxTimeout: 300,
    description: 'Total time for all health checks',
  },
  {
    id: 'lock_ttl',
    category: 'lock',
    operation: 'Lock TTL',
    defaultTimeout: 300,
    currentTimeout: 300,
    minTimeout: 60,
    maxTimeout: 900,
    description: 'Deployment lock time-to-live',
  },
  {
    id: 'lock_heartbeat',
    category: 'lock',
    operation: 'Lock Heartbeat',
    defaultTimeout: 60,
    currentTimeout: 60,
    minTimeout: 15,
    maxTimeout: 120,
    description: 'Lock heartbeat interval',
  },
  {
    id: 'ai_claude',
    category: 'ai',
    operation: 'Claude API',
    defaultTimeout: 30,
    currentTimeout: 30,
    minTimeout: 10,
    maxTimeout: 120,
    description: 'Claude AI API request timeout',
  },
  {
    id: 'ai_connection_check',
    category: 'ai',
    operation: 'Connection Check',
    defaultTimeout: 60,
    currentTimeout: 60,
    minTimeout: 30,
    maxTimeout: 300,
    description: 'AI service connection check interval',
  },
];

export function OperationTimeouts() {
  const queryClient = useQueryClient();
  const [timeouts, setTimeouts] = useState<OperationTimeout[]>(DEFAULT_TIMEOUTS);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: savedTimeouts, isLoading } = useQuery<OperationTimeout[]>({
    queryKey: ['operation-timeouts'],
    queryFn: async () => {
      const response = await fetch('/api/admin/settings/timeouts');
      if (!response.ok) return DEFAULT_TIMEOUTS;
      return response.json();
    },
  });

  useEffect(() => {
    if (savedTimeouts) {
      setTimeouts(savedTimeouts);
    }
  }, [savedTimeouts]);

  const saveMutation = useMutation({
    mutationFn: async (newTimeouts: OperationTimeout[]) => {
      const response = await fetch('/api/admin/settings/timeouts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTimeouts),
      });
      if (!response.ok) throw new Error('Failed to save timeouts');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operation-timeouts'] });
      setHasChanges(false);
    },
  });

  const updateTimeout = (id: string, value: number) => {
    setTimeouts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, currentTimeout: value } : t))
    );
    setHasChanges(true);
  };

  const resetToDefaults = () => {
    setTimeouts(DEFAULT_TIMEOUTS);
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(timeouts);
  };

  const exportAsJson = () => {
    const data = timeouts.reduce((acc, t) => {
      acc[t.id] = t.currentTimeout;
      return acc;
    }, {} as Record<string, number>);

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'radiant-timeouts.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredTimeouts = selectedCategory
    ? timeouts.filter((t) => t.category === selectedCategory)
    : timeouts;

  const hasInvalidValues = timeouts.some(
    (t) => t.currentTimeout < t.minTimeout || t.currentTimeout > t.maxTimeout
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Operation Timeouts
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure timeouts for deployment operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportAsJson}>
            <Download className="h-4 w-4 mr-1" />
            Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={resetToDefaults}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset Defaults
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge
          variant={selectedCategory === null ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setSelectedCategory(null)}
        >
          All
        </Badge>
        {TIMEOUT_CATEGORIES.map((cat) => (
          <Badge
            key={cat.id}
            variant={selectedCategory === cat.id ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.icon} {cat.label}
          </Badge>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operation</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Default (s)</TableHead>
                <TableHead className="text-right">Current (s)</TableHead>
                <TableHead className="text-right">Range</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTimeouts.map((timeout) => {
                const isInvalid =
                  timeout.currentTimeout < timeout.minTimeout ||
                  timeout.currentTimeout > timeout.maxTimeout;
                const isModified = timeout.currentTimeout !== timeout.defaultTimeout;

                return (
                  <TableRow key={timeout.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {timeout.operation}
                        {isModified && (
                          <Badge variant="secondary" className="text-xs">
                            Modified
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {timeout.description}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {timeout.defaultTimeout}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isInvalid && (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <Input
                          type="number"
                          min={timeout.minTimeout}
                          max={timeout.maxTimeout}
                          value={timeout.currentTimeout}
                          onChange={(e) =>
                            updateTimeout(timeout.id, parseInt(e.target.value) || 0)
                          }
                          className={`w-24 text-right ${isInvalid ? 'border-red-500' : ''}`}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {timeout.minTimeout} - {timeout.maxTimeout}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {hasInvalidValues && (
        <div className="flex items-center gap-2 text-red-500 text-sm">
          <AlertCircle className="h-4 w-4" />
          Some values are outside the allowed range
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            if (savedTimeouts) {
              setTimeouts(savedTimeouts);
              setHasChanges(false);
            }
          }}
          disabled={!hasChanges}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || hasInvalidValues || saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
