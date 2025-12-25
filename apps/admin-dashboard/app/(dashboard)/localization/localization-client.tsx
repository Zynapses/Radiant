'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Globe, 
  Languages, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Search,
  Plus,
  Wand2,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
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
import { apiClient } from '@/lib/api';

interface Language {
  code: string;
  name: string;
  native_name: string;
  is_rtl: boolean;
  is_active: boolean;
}

interface TranslationStats {
  totalStrings: number;
  byLanguage: Record<string, { approved: number; pending: number; aiTranslated: number }>;
}

export function LocalizationClient() {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newString, setNewString] = useState({ key: '', defaultText: '', category: '', context: '' });
  const queryClient = useQueryClient();

  const { data: languages } = useQuery<Language[]>({
    queryKey: ['localization', 'languages'],
    queryFn: async () => {
      const res = await apiClient.get<{ languages: Language[] }>('/localization/languages');
      return res.languages;
    },
  });

  const { data: stats } = useQuery<TranslationStats>({
    queryKey: ['localization', 'stats'],
    queryFn: async () => {
      return apiClient.get<TranslationStats>('/localization/stats');
    },
  });

  const { data: bundle } = useQuery<Record<string, string>>({
    queryKey: ['localization', 'bundle', selectedLanguage],
    queryFn: async () => {
      const res = await apiClient.get<{ bundle: Record<string, string> }>(`/localization/bundle?language=${selectedLanguage}`);
      return res.bundle;
    },
  });

  const registerString = useMutation({
    mutationFn: async (data: typeof newString) => {
      await apiClient.post('/localization/register', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localization'] });
      setShowAddDialog(false);
      setNewString({ key: '', defaultText: '', category: '', context: '' });
    },
  });

  const translateWithAI = useMutation({
    mutationFn: async ({ key, targetLanguages }: { key: string; targetLanguages: string[] }) => {
      await apiClient.post('/localization/translate-ai', { key, targetLanguages });
    },
  });

  const getLanguageStats = (langCode: string) => {
    if (!stats?.byLanguage[langCode] || !stats.totalStrings) {
      return { approved: 0, pending: 0, aiTranslated: 0, coverage: 0 };
    }
    const langStats = stats.byLanguage[langCode];
    const coverage = ((langStats.approved + langStats.aiTranslated) / stats.totalStrings) * 100;
    return { ...langStats, coverage };
  };

  const filteredBundle = bundle
    ? Object.entries(bundle).filter(([key, value]) =>
        key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        value.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Localization</h1>
          <p className="text-muted-foreground">
            Manage translations and internationalization
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['localization'] })}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add String
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Strings</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalStrings ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Languages</CardTitle>
            <Languages className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{languages?.filter(l => l.is_active).length ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(stats?.byLanguage ?? {}).reduce((sum, l) => sum + l.approved, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Translated</CardTitle>
            <Wand2 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(stats?.byLanguage ?? {}).reduce((sum, l) => sum + l.aiTranslated, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="strings">
        <TabsList>
          <TabsTrigger value="strings">Strings</TabsTrigger>
          <TabsTrigger value="languages">Languages</TabsTrigger>
        </TabsList>

        <TabsContent value="strings" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Translation Strings</CardTitle>
                  <CardDescription>Browse and edit translations</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languages?.filter(l => l.is_active).map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.native_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Translation</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBundle.slice(0, 50).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">{key}</code>
                      </TableCell>
                      <TableCell>{value}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => translateWithAI.mutate({
                            key,
                            targetLanguages: languages?.filter(l => l.code !== 'en' && l.is_active).map(l => l.code) ?? []
                          })}
                        >
                          <Wand2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredBundle.length > 50 && (
                <p className="text-sm text-muted-foreground text-center mt-4">
                  Showing 50 of {filteredBundle.length} results
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="languages" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {languages?.map((lang) => {
              const langStats = getLanguageStats(lang.code);
              return (
                <Card key={lang.code}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{lang.native_name}</span>
                      {lang.is_rtl && <Badge variant="outline">RTL</Badge>}
                    </CardTitle>
                    <CardDescription>{lang.name} ({lang.code})</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Coverage</span>
                        <span>{langStats.coverage.toFixed(0)}%</span>
                      </div>
                      <Progress value={langStats.coverage} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div>
                        <p className="text-green-600 font-medium">{langStats.approved}</p>
                        <p className="text-muted-foreground text-xs">Approved</p>
                      </div>
                      <div>
                        <p className="text-purple-600 font-medium">{langStats.aiTranslated}</p>
                        <p className="text-muted-foreground text-xs">AI</p>
                      </div>
                      <div>
                        <p className="text-yellow-600 font-medium">{langStats.pending}</p>
                        <p className="text-muted-foreground text-xs">Pending</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New String</DialogTitle>
            <DialogDescription>
              Register a new localizable string
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Key</Label>
              <Input
                placeholder="e.g., button.submit"
                value={newString.key}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewString({ ...newString, key: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Default Text (English)</Label>
              <Textarea
                placeholder="The default English text"
                value={newString.defaultText}
                onChange={(e) => setNewString({ ...newString, defaultText: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input
                placeholder="e.g., ui.buttons"
                value={newString.category}
                onChange={(e) => setNewString({ ...newString, category: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Context (optional)</Label>
              <Input
                placeholder="Additional context for translators"
                value={newString.context}
                onChange={(e) => setNewString({ ...newString, context: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button 
              onClick={() => registerString.mutate(newString)}
              disabled={!newString.key || !newString.defaultText || !newString.category}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add String
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
