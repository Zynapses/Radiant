'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Clock,
  Gauge,
  Thermometer,
  Brain,
  Shield,
  CreditCard,
  GitBranch,
  Bell,
  Layout,
  Search,
  RotateCcw,
  Save,
  History,
  Info,
  AlertTriangle,
  Check,
  X,
  ChevronRight,
  Settings2,
  Loader2,
  ExternalLink,
} from 'lucide-react';

// Icon mapping
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  timeouts: <Clock className="h-5 w-5" />,
  rate_limits: <Gauge className="h-5 w-5" />,
  thermal: <Thermometer className="h-5 w-5" />,
  ai: <Brain className="h-5 w-5" />,
  security: <Shield className="h-5 w-5" />,
  billing: <CreditCard className="h-5 w-5" />,
  workflows: <GitBranch className="h-5 w-5" />,
  notifications: <Bell className="h-5 w-5" />,
  ui: <Layout className="h-5 w-5" />,
};

interface ConfigItem {
  key: string;
  value: number | string | boolean;
  defaultValue: number | string | boolean;
  type: 'number' | 'string' | 'boolean';
  name: string;
  description: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  allowOverride?: boolean;
}

interface ConfigCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  displayOrder: number;
}

interface ConfigData {
  categories: ConfigCategory[];
  config: Record<string, ConfigItem[]>;
}

// Config item editor component
function ConfigItemEditor({
  item,
  value,
  onChange,
  isModified,
  onReset,
}: {
  item: ConfigItem;
  value: number | string | boolean;
  onChange: (value: number | string | boolean) => void;
  isModified: boolean;
  onReset: () => void;
}) {
  const renderInput = () => {
    switch (item.type) {
      case 'boolean':
        return (
          <div className="flex items-center gap-3">
            <Switch
              checked={value as boolean}
              onCheckedChange={onChange}
            />
            <span className="text-sm text-muted-foreground">
              {value ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        );

      case 'string':
        if (item.options) {
          return (
            <Select value={value as string} onValueChange={onChange}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {item.options.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }
        return (
          <Input
            type="text"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            className="w-48"
          />
        );

      case 'number':
        const numValue = value as number;
        const showSlider = item.min !== undefined && item.max !== undefined && (item.max - item.min) <= 100;
        
        return (
          <div className="flex items-center gap-4">
            {showSlider ? (
              <div className="flex items-center gap-4 w-64">
                <Slider
                  value={[numValue]}
                  onValueChange={([v]) => onChange(v)}
                  min={item.min}
                  max={item.max}
                  step={item.step || 1}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-16 text-right">
                  {numValue}{item.unit ? ` ${item.unit}` : ''}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={numValue}
                  onChange={(e) => onChange(Number(e.target.value))}
                  min={item.min}
                  max={item.max}
                  step={item.step || 1}
                  className="w-32 font-mono"
                />
                {item.unit && (
                  <span className="text-sm text-muted-foreground">{item.unit}</span>
                )}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={cn(
      'group relative p-4 rounded-lg border transition-all',
      isModified ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' : 'border-transparent hover:border-border hover:bg-muted/30'
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Label className="font-medium">{item.name}</Label>
            {item.allowOverride && (
              <Badge variant="outline" className="text-xs">
                Tenant Override
              </Badge>
            )}
            {isModified && (
              <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                Modified
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
          {renderInput()}
          {item.min !== undefined && item.max !== undefined && item.type === 'number' && (
            <p className="text-xs text-muted-foreground mt-2">
              Range: {item.min} - {item.max} {item.unit || ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {isModified && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onReset}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset to default</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="font-medium mb-1">Default: {String(item.defaultValue)}</p>
                <p className="text-xs">Key: {item.key}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}

export default function SystemConfigurationPage() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>('timeouts');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, number | string | boolean>>>({});
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  // Fetch configuration
  const { data, isLoading } = useQuery<ConfigData>({
    queryKey: ['system-config'],
    queryFn: () => fetch('/api/config').then(r => r.json()),
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (changes: { category: string; key: string; value: unknown }[]) => {
      const results = await Promise.all(
        changes.map(change =>
          fetch('/api/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(change),
          }).then(r => r.json())
        )
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
      setPendingChanges({});
      setShowSaveDialog(false);
    },
  });

  // Calculate modified items
  const modifiedCount = useMemo(() => {
    return Object.values(pendingChanges).reduce(
      (acc, cat) => acc + Object.keys(cat).length,
      0
    );
  }, [pendingChanges]);

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!data?.config[selectedCategory]) return [];
    if (!searchQuery) return data.config[selectedCategory];
    
    const query = searchQuery.toLowerCase();
    return data.config[selectedCategory].filter(
      item =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.key.toLowerCase().includes(query)
    );
  }, [data, selectedCategory, searchQuery]);

  const handleValueChange = (key: string, value: number | string | boolean) => {
    setPendingChanges(prev => ({
      ...prev,
      [selectedCategory]: {
        ...(prev[selectedCategory] || {}),
        [key]: value,
      },
    }));
  };

  const handleReset = (key: string) => {
    setPendingChanges(prev => {
      const newChanges = { ...prev };
      if (newChanges[selectedCategory]) {
        delete newChanges[selectedCategory][key];
        if (Object.keys(newChanges[selectedCategory]).length === 0) {
          delete newChanges[selectedCategory];
        }
      }
      return newChanges;
    });
  };

  const handleSave = () => {
    const changes: { category: string; key: string; value: unknown }[] = [];
    Object.entries(pendingChanges).forEach(([category, items]) => {
      Object.entries(items).forEach(([key, value]) => {
        changes.push({ category, key, value });
      });
    });
    saveMutation.mutate(changes);
  };

  const getValue = (item: ConfigItem) => {
    return pendingChanges[selectedCategory]?.[item.key] ?? item.value;
  };

  const isModified = (key: string) => {
    return pendingChanges[selectedCategory]?.[key] !== undefined;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings2 className="h-6 w-6" />
            System Configuration
          </h1>
          <p className="text-muted-foreground">
            Manage platform-wide settings and parameters
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowHistoryDialog(true)}>
            <History className="h-4 w-4 mr-2" />
            History
          </Button>
          <Button
            onClick={() => setShowSaveDialog(true)}
            disabled={modifiedCount === 0}
            className={cn(modifiedCount > 0 && 'animate-pulse')}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Changes
            {modifiedCount > 0 && (
              <Badge variant="secondary" className="ml-2 bg-white/20">
                {modifiedCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Unsaved changes warning */}
      {modifiedCount > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span className="text-sm">
              You have <strong>{modifiedCount}</strong> unsaved change{modifiedCount !== 1 ? 's' : ''}.
              Remember to save before leaving this page.
            </span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => setPendingChanges({})}
            >
              Discard All
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Category Sidebar */}
        <div className="col-span-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-20rem)]">
                <div className="space-y-1 p-2">
                  {data?.categories.map((category) => {
                    const hasChanges = Object.keys(pendingChanges[category.id] || {}).length > 0;
                    return (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                          selectedCategory === category.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        )}
                      >
                        <div className={cn(
                          'flex-shrink-0',
                          selectedCategory === category.id ? 'text-primary-foreground' : 'text-muted-foreground'
                        )}>
                          {CATEGORY_ICONS[category.id]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{category.name}</span>
                            {hasChanges && (
                              <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                            )}
                          </div>
                          <p className={cn(
                            'text-xs truncate',
                            selectedCategory === category.id
                              ? 'text-primary-foreground/70'
                              : 'text-muted-foreground'
                          )}>
                            {data?.config[category.id]?.length || 0} settings
                          </p>
                        </div>
                        <ChevronRight className={cn(
                          'h-4 w-4 flex-shrink-0',
                          selectedCategory === category.id
                            ? 'text-primary-foreground'
                            : 'text-muted-foreground'
                        )} />
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Config Items */}
        <div className="col-span-9">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {CATEGORY_ICONS[selectedCategory]}
                    {data?.categories.find(c => c.id === selectedCategory)?.name}
                  </CardTitle>
                  <CardDescription>
                    {data?.categories.find(c => c.id === selectedCategory)?.description}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search settings..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-22rem)]">
                <div className="space-y-2">
                  {filteredItems.map((item) => (
                    <ConfigItemEditor
                      key={item.key}
                      item={item}
                      value={getValue(item)}
                      onChange={(value) => handleValueChange(item.key, value)}
                      isModified={isModified(item.key)}
                      onReset={() => handleReset(item.key)}
                    />
                  ))}
                  {filteredItems.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
                      <p>No settings found matching your search</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Save Confirmation Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Configuration Changes</DialogTitle>
            <DialogDescription>
              You are about to save {modifiedCount} configuration change{modifiedCount !== 1 ? 's' : ''}.
              Some changes may require a service restart to take effect.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <ScrollArea className="max-h-64">
              {Object.entries(pendingChanges).map(([category, items]) => (
                <div key={category} className="mb-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    {CATEGORY_ICONS[category]}
                    {data?.categories.find(c => c.id === category)?.name}
                  </h4>
                  <div className="space-y-2 pl-7">
                    {Object.entries(items).map(([key, value]) => {
                      const item = data?.config[category]?.find(i => i.key === key);
                      return (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{item?.name || key}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground line-through">
                              {String(item?.value)}
                            </span>
                            <ChevronRight className="h-3 w-3" />
                            <span className="font-medium">{String(value)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirm & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configuration History</DialogTitle>
            <DialogDescription>
              Recent configuration changes across all categories
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {[
                { user: 'admin@example.com', action: 'Updated ai.default_temperature', from: '0.7', to: '0.8', time: '2 hours ago' },
                { user: 'admin@example.com', action: 'Updated rate_limits.enterprise_tier_requests', from: '15000', to: '20000', time: '1 day ago' },
                { user: 'system', action: 'Reset thermal.warm_duration_minutes to default', from: '45', to: '30', time: '3 days ago' },
              ].map((entry, i) => (
                <div key={i} className="flex items-start gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="flex-1">
                    <p className="font-medium">{entry.action}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <span>{entry.from}</span>
                      <ChevronRight className="h-3 w-3" />
                      <span className="font-medium text-foreground">{entry.to}</span>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">{entry.user}</p>
                    <p className="text-xs text-muted-foreground">{entry.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
