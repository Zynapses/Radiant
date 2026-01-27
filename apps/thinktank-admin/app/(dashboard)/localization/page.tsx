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

interface RegistryEntry {
  id: number;
  key: string;
  default_text: string;
  context?: string;
  category: string;
  app_id: string;
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
}

interface LocalizationStats {
  totalEntries: number;
  byApp: { app_id: string; count: string }[];
  languageCoverage: { language_code: string; coverage_percent: string }[];
  tenantOverrides: number;
  protectedOverrides: number;
}

interface RegistryResponse {
  data: {
    entries: RegistryEntry[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
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

interface ConfigResponse {
  data: {
    default_language: string;
    enabled_languages: string[];
  };
}

export default function LocalizationPage() {
  const [activeTab, setActiveTab] = useState('overrides');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<RegistryEntry | null>(null);
  const [overrideText, setOverrideText] = useState('');
  const [isProtected, setIsProtected] = useState(true);
  const [page, setPage] = useState(1);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch registry entries (filtered for Think Tank)
  const { data: registryData, isLoading: registryLoading } = useQuery<RegistryResponse>({
    queryKey: ['localization', 'registry', 'thinktank', searchQuery, page],
    queryFn: () => {
      const params: Record<string, string | number | boolean | undefined> = {
        app_id: 'thinktank',
        page,
        limit: 50,
      };
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

  // Fetch tenant config
  const { data: configData } = useQuery<ConfigResponse>({
    queryKey: ['localization', 'config'],
    queryFn: () => api.get<ConfigResponse>('/api/admin/localization/config'),
  });

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: (data: { default_language: string; enabled_languages: string[] }) =>
      api.put('/api/admin/localization/config', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localization', 'config'] });
      toast({ title: 'Configuration saved' });
    },
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
      toast({ title: 'Override saved', description: 'Translation override has been saved.' });
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
      });
    },
  });

  const handleOpenOverrideDialog = (entry: RegistryEntry) => {
    setSelectedEntry(entry);
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
  const overrides: TranslationOverride[] = overridesData?.data?.overrides || [];
  const config = configData?.data;
  const pagination = registryData?.data?.pagination;

  // Filter overrides to Think Tank only
  const thinkTankOverrides = overrides.filter(
    (o) => o.app_id === 'thinktank' || o.app_id === 'common'
  );

  if (statsLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-32" /></CardContent>
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
            Localization Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Customize Think Tank text and messages for your organization
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
        <AlertTitle>Customize Your Think Tank Experience</AlertTitle>
        <AlertDescription>
          Override any system text with your organization&apos;s preferred wording. Protected overrides won&apos;t 
          be changed by automatic translation updates. Toggle protection off to allow system updates.
        </AlertDescription>
      </Alert>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Your Overrides</CardTitle>
            <div className="p-2 bg-green-500/10 rounded-full">
              <Edit className="w-4 h-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.tenantOverrides || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Custom translations</p>
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
            <p className="text-xs text-muted-foreground mt-1">Won&apos;t auto-update</p>
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
          <TabsTrigger value="overrides">Your Overrides</TabsTrigger>
          <TabsTrigger value="browse">Browse Strings</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        {/* Overrides Tab */}
        <TabsContent value="overrides" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-green-500" />
                Your Translation Overrides
              </CardTitle>
              <CardDescription>
                Custom translations for {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage)?.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {overridesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : thinkTankOverrides.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Languages className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No overrides yet</p>
                  <p className="text-sm mt-1">Browse strings to create custom translations</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[250px]">Key</TableHead>
                      <TableHead>Override Text</TableHead>
                      <TableHead className="w-[100px]">Protected</TableHead>
                      <TableHead className="w-[100px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {thinkTankOverrides.map((override) => (
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
                              <TooltipContent>Revert to system</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Browse Tab */}
        <TabsContent value="browse" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Languages className="w-5 h-5 text-blue-500" />
                    Think Tank Strings
                  </CardTitle>
                  <CardDescription>Browse and customize UI text</CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search strings..."
                    className="pl-9 w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {registryLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[250px]">Key</TableHead>
                        <TableHead>Text</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead className="w-[80px] text-right">Edit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry) => {
                        const hasOverride = thinkTankOverrides.some(
                          (o) => o.registry_id === entry.id && o.language_code === selectedLanguage
                        );
                        const override = thinkTankOverrides.find(
                          (o) => o.registry_id === entry.id && o.language_code === selectedLanguage
                        );
                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="font-mono text-xs">{entry.key}</TableCell>
                            <TableCell className="max-w-[300px] truncate">
                              {override?.override_text || entry.default_text}
                            </TableCell>
                            <TableCell>
                              {hasOverride ? (
                                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                                  {override?.is_protected ? <Lock className="w-3 h-3 mr-1" /> : <Unlock className="w-3 h-3 mr-1" />}
                                  Override
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">System</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => handleOpenOverrideDialog(entry)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Page {pagination.page} of {pagination.totalPages}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                          Previous
                        </Button>
                        <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>
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

        {/* Config Tab */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Language Configuration</CardTitle>
              <CardDescription>Configure default language and enabled languages for your organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Default Language</Label>
                <Select
                  value={config?.default_language || 'en'}
                  onValueChange={(value) => updateConfigMutation.mutate({
                    default_language: value,
                    enabled_languages: config?.enabled_languages || ['en'],
                  })}
                >
                  <SelectTrigger className="w-[300px]">
                    <SelectValue />
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
                <p className="text-sm text-muted-foreground">Language shown to users by default</p>
              </div>

              <div className="space-y-3">
                <Label>Enabled Languages</Label>
                <p className="text-sm text-muted-foreground mb-2">Languages available to users</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const enabled = config?.enabled_languages?.includes(lang.code);
                    return (
                      <div
                        key={lang.code}
                        className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                          enabled ? 'bg-primary/10 border-primary' : 'border-muted hover:border-primary/50'
                        }`}
                        onClick={() => {
                          const current = config?.enabled_languages || ['en'];
                          const updated = enabled
                            ? current.filter((c: string) => c !== lang.code)
                            : [...current, lang.code];
                          if (updated.length > 0) {
                            updateConfigMutation.mutate({
                              default_language: config?.default_language || 'en',
                              enabled_languages: updated,
                            });
                          }
                        }}
                      >
                        <span className="text-xl">{lang.flag}</span>
                        <span className="font-medium">{lang.name}</span>
                        {enabled && <CheckCircle className="w-4 h-4 text-primary ml-auto" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Override Dialog */}
      <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Customize Translation
            </DialogTitle>
            <DialogDescription>
              Create a custom translation for {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage)?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Key</Label>
                <p className="font-mono text-sm bg-muted p-2 rounded mt-1">{selectedEntry.key}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Default Text</Label>
                <p className="text-sm bg-muted p-2 rounded mt-1">{selectedEntry.default_text}</p>
              </div>

              <div>
                <Label htmlFor="override-text">Your Custom Text</Label>
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
                    Keep your custom text even when system translations update
                  </p>
                </div>
                <Switch id="protection" checked={isProtected} onCheckedChange={setIsProtected} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOverrideDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveOverride} disabled={upsertOverrideMutation.isPending || !overrideText.trim()}>
              {upsertOverrideMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
