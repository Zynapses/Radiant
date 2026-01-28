'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Globe,
  Languages,
  Search,
  Shield,
  Edit,
  RefreshCw,
  CheckCircle,
  Info,
  Lock,
  Unlock,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api/client';

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', flag: '🇨🇳' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', flag: '🇹🇼' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'th', name: 'Thai', flag: '🇹🇭' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
];

const APP_IDS = [
  { value: 'common', label: 'Common (All Apps)' },
  { value: 'radiant_admin', label: 'Radiant Admin' },
  { value: 'thinktank_admin', label: 'Think Tank Admin' },
  { value: 'thinktank', label: 'Think Tank' },
  { value: 'curator', label: 'Curator' },
];

interface RegistryEntry {
  id: number;
  key: string;
  default_text: string;
  context?: string;
  category: string;
  app_id: string;
  placeholders?: string[];
  is_active: boolean;
}

interface TranslationOverride {
  id: string;
  registry_id: number;
  key: string;
  default_text: string;
  category: string;
  app_id: string;
  language_code: string;
  override_text: string;
  is_protected: boolean;
  created_by?: string;
  updated_at: string;
}

interface LocalizationStats {
  totalEntries: number;
  byApp: { app_id: string; count: string }[];
  byCategory: { category: string; count: string }[];
  languageCoverage: { language_code: string; translated_count: string; coverage_percent: string }[];
  tenantOverrides: number;
  protectedOverrides: number;
}

interface RegistryResponse {
  data: {
    entries: RegistryEntry[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
    categories: string[];
  };
}

interface OverridesResponse {
  data: {
    overrides: TranslationOverride[];
  };
}

interface StatsResponse {
  data: LocalizationStats;
}

export default function TranslationRegistryPage() {
  const [activeTab, setActiveTab] = useState('registry');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<RegistryEntry | null>(null);
  const [overrideText, setOverrideText] = useState('');
  const [isProtected, setIsProtected] = useState(true);
  const [page, setPage] = useState(1);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch registry entries
  const { data: registryData, isLoading: registryLoading } = useQuery<RegistryResponse>({
    queryKey: ['localization', 'registry', selectedAppId, selectedCategory, searchQuery, page],
    queryFn: () => {
      const params: Record<string, string | number | boolean | undefined> = {
        page,
        limit: 50,
      };
      if (selectedAppId) params.app_id = selectedAppId;
      if (selectedCategory) params.category = selectedCategory;
      if (searchQuery) params.search = searchQuery;
      
      return api.get<RegistryResponse>('/api/admin/localization/registry', params);
    },
  });

  // Fetch tenant overrides
  const { data: overridesData, isLoading: overridesLoading } = useQuery<OverridesResponse>({
    queryKey: ['localization', 'overrides', selectedLanguage],
    queryFn: () => {
      const params: Record<string, string | number | boolean | undefined> = {};
      if (selectedLanguage) params.language_code = selectedLanguage;
      
      return api.get<OverridesResponse>('/api/admin/localization/overrides', params);
    },
  });

  // Fetch stats
  const { data: statsData, isLoading: statsLoading } = useQuery<StatsResponse>({
    queryKey: ['localization', 'stats'],
    queryFn: () => api.get<StatsResponse>('/api/admin/localization/stats'),
  });

  // Create/Update override mutation
  const upsertOverrideMutation = useMutation({
    mutationFn: (data: { registry_id: number; language_code: string; override_text: string; is_protected: boolean }) => 
      api.post('/api/admin/localization/overrides', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localization'] });
      setShowOverrideDialog(false);
      setSelectedEntry(null);
      setOverrideText('');
      toast({ title: 'Override saved', description: 'Translation override has been saved successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save override.', variant: 'destructive' });
    },
  });

  // Delete override mutation
  const deleteOverrideMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/localization/overrides/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localization'] });
      toast({ title: 'Override removed', description: 'Reverted to system translation.' });
    },
  });

  // Toggle protection mutation
  const toggleProtectionMutation = useMutation({
    mutationFn: ({ id, is_protected }: { id: string; is_protected: boolean }) => 
      api.patch(`/api/admin/localization/overrides/${id}/protection`, { is_protected }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['localization'] });
      toast({
        title: variables.is_protected ? 'Override protected' : 'Protection removed',
        description: variables.is_protected
          ? 'This override will not be updated by automatic translation.'
          : 'This override may be updated by automatic translation.',
      });
    },
  });

  const handleOpenOverrideDialog = (entry: RegistryEntry) => {
    setSelectedEntry(entry);
    // Check if there's an existing override for this entry
    const existingOverride = overridesData?.data?.overrides?.find(
      (o: TranslationOverride) => o.registry_id === entry.id && o.language_code === selectedLanguage
    );
    if (existingOverride) {
      setOverrideText(existingOverride.override_text);
      setIsProtected(existingOverride.is_protected);
    } else {
      setOverrideText(entry.default_text);
      setIsProtected(true);
    }
    setShowOverrideDialog(true);
  };

  const handleSaveOverride = () => {
    if (!selectedEntry) return;
    upsertOverrideMutation.mutate({
      registry_id: selectedEntry.id,
      language_code: selectedLanguage,
      override_text: overrideText,
      is_protected: isProtected,
    });
  };

  const stats: LocalizationStats | undefined = statsData?.data;
  const entries: RegistryEntry[] = registryData?.data?.entries || [];
  const categories: string[] = registryData?.data?.categories || [];
  const overrides: TranslationOverride[] = overridesData?.data?.overrides || [];
  const pagination = registryData?.data?.pagination;

  if (statsLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Globe className="w-6 h-6 text-primary" />
            </div>
            Translation Registry
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage UI strings across all applications with tenant-specific overrides
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  <span className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['localization'] })}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Translation Override System</AlertTitle>
        <AlertDescription>
          Override any system translation with custom text. Protected overrides won&apos;t be updated by automatic 
          translation processes. Toggle protection off to allow system updates, or delete the override to revert 
          to the system translation.
        </AlertDescription>
      </Alert>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Strings</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-full">
              <Languages className="w-4 h-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalEntries || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {stats?.byApp?.length || 0} apps
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Your Overrides</CardTitle>
            <div className="p-2 bg-green-500/10 rounded-full">
              <Edit className="w-4 h-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.tenantOverrides || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Custom translations
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Protected</CardTitle>
            <div className="p-2 bg-yellow-500/10 rounded-full">
              <Shield className="w-4 h-4 text-yellow-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.protectedOverrides || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Won&apos;t auto-update
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage)?.name} Coverage
            </CardTitle>
            <div className="p-2 bg-purple-500/10 rounded-full">
              <CheckCircle className="w-4 h-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.languageCoverage?.find((c) => c.language_code === selectedLanguage)?.coverage_percent || 0}%
            </div>
            <Progress
              value={Number(stats?.languageCoverage?.find((c) => c.language_code === selectedLanguage)?.coverage_percent || 0)}
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full max-w-md bg-muted/50">
          <TabsTrigger value="registry">Registry</TabsTrigger>
          <TabsTrigger value="overrides">Your Overrides</TabsTrigger>
          <TabsTrigger value="coverage">Coverage</TabsTrigger>
        </TabsList>

        {/* Registry Tab */}
        <TabsContent value="registry" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Languages className="w-5 h-5 text-blue-500" />
                    String Registry
                  </CardTitle>
                  <CardDescription>
                    Browse all UI strings and create overrides for your tenant
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search strings..."
                      className="pl-9 w-64"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Select value={selectedAppId} onValueChange={setSelectedAppId}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All apps" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All apps</SelectItem>
                      {APP_IDS.map((app) => (
                        <SelectItem key={app.value} value={app.value}>
                          {app.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All categories</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {registryLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[250px]">Key</TableHead>
                        <TableHead>Default Text</TableHead>
                        <TableHead className="w-[100px]">App</TableHead>
                        <TableHead className="w-[100px]">Category</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead className="w-[80px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry) => {
                        const hasOverride = overrides.some(
                          (o) => o.registry_id === entry.id && o.language_code === selectedLanguage
                        );
                        const override = overrides.find(
                          (o) => o.registry_id === entry.id && o.language_code === selectedLanguage
                        );
                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="font-mono text-xs">{entry.key}</TableCell>
                            <TableCell className="max-w-[300px] truncate">
                              {override?.override_text || entry.default_text}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{entry.app_id}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{entry.category}</Badge>
                            </TableCell>
                            <TableCell>
                              {hasOverride ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                                        {override?.is_protected ? (
                                          <Lock className="w-3 h-3 mr-1" />
                                        ) : (
                                          <Unlock className="w-3 h-3 mr-1" />
                                        )}
                                        Override
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {override?.is_protected
                                        ? 'Protected from auto-updates'
                                        : 'May be auto-updated'}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  System
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenOverrideDialog(entry)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {pagination && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                        {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page === 1}
                          onClick={() => setPage(page - 1)}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page >= pagination.totalPages}
                          onClick={() => setPage(page + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Overrides Tab */}
        <TabsContent value="overrides" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-green-500" />
                Your Translation Overrides
              </CardTitle>
              <CardDescription>
                Custom translations that override system defaults. Protected overrides won&apos;t be changed by automatic translation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {overridesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : overrides.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Languages className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No overrides for {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage)?.name}</p>
                  <p className="text-sm mt-1">Go to the Registry tab to create overrides</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[250px]">Key</TableHead>
                      <TableHead>Override Text</TableHead>
                      <TableHead className="w-[100px]">Protected</TableHead>
                      <TableHead className="w-[120px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overrides.map((override) => (
                      <TableRow key={override.id}>
                        <TableCell className="font-mono text-xs">{override.key}</TableCell>
                        <TableCell className="max-w-[400px] truncate">{override.override_text}</TableCell>
                        <TableCell>
                          <Switch
                            checked={override.is_protected}
                            onCheckedChange={(checked) =>
                              toggleProtectionMutation.mutate({ id: override.id, is_protected: checked })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const entry = entries.find((e) => e.id === override.registry_id);
                                      if (entry) handleOpenOverrideDialog(entry);
                                    }}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit override</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteOverrideMutation.mutate(override.id)}
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Revert to system translation</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coverage Tab */}
        <TabsContent value="coverage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-purple-500" />
                Translation Coverage by Language
              </CardTitle>
              <CardDescription>
                Percentage of strings translated for each supported language
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const coverage = stats?.languageCoverage?.find((c) => c.language_code === lang.code);
                  const percent = Number(coverage?.coverage_percent || 0);
                  return (
                    <div key={lang.code} className="flex items-center gap-4">
                      <div className="w-[200px] flex items-center gap-2">
                        <span className="text-lg">{lang.flag}</span>
                        <span className="font-medium">{lang.name}</span>
                      </div>
                      <div className="flex-1">
                        <Progress value={percent} className="h-3" />
                      </div>
                      <div className="w-[80px] text-right">
                        <span className={percent >= 90 ? 'text-green-500' : percent >= 50 ? 'text-yellow-500' : 'text-red-500'}>
                          {percent}%
                        </span>
                      </div>
                      <div className="w-[100px] text-right text-sm text-muted-foreground">
                        {coverage?.translated_count || 0} / {stats?.totalEntries || 0}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Strings by App</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats?.byApp?.map((app) => (
                    <div key={app.app_id} className="flex items-center justify-between">
                      <span>{APP_IDS.find((a) => a.value === app.app_id)?.label || app.app_id}</span>
                      <Badge variant="secondary">{app.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Strings by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {stats?.byCategory?.map((cat) => (
                    <div key={cat.category} className="flex items-center justify-between">
                      <span className="capitalize">{cat.category}</span>
                      <Badge variant="secondary">{cat.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Override Dialog */}
      <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              {selectedEntry ? 'Edit Translation Override' : 'Create Translation Override'}
            </DialogTitle>
            <DialogDescription>
              Customize this string for {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage)?.name}.
              Protected overrides won&apos;t be changed by automatic translation updates.
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Key</Label>
                <p className="font-mono text-sm bg-muted p-2 rounded mt-1">{selectedEntry.key}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Default Text (English)</Label>
                <p className="text-sm bg-muted p-2 rounded mt-1">{selectedEntry.default_text}</p>
              </div>

              {selectedEntry.context && (
                <div>
                  <Label className="text-muted-foreground">Context</Label>
                  <p className="text-sm text-muted-foreground mt-1">{selectedEntry.context}</p>
                </div>
              )}

              <div>
                <Label htmlFor="override-text">
                  Override Text ({SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage)?.name})
                </Label>
                <Textarea
                  id="override-text"
                  value={overrideText}
                  onChange={(e) => setOverrideText(e.target.value)}
                  rows={3}
                  className="mt-1"
                  placeholder="Enter custom translation..."
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <Label htmlFor="protection" className="font-medium">
                    Protect from automatic updates
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    When protected, this override won&apos;t be changed by translation automation
                  </p>
                </div>
                <Switch
                  id="protection"
                  checked={isProtected}
                  onCheckedChange={setIsProtected}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOverrideDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveOverride}
              disabled={upsertOverrideMutation.isPending || !overrideText.trim()}
            >
              {upsertOverrideMutation.isPending ? 'Saving...' : 'Save Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
