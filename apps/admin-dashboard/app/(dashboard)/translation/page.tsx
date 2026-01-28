'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Languages, 
  Globe,
  Zap,
  Settings,
  RefreshCw,
  TestTube,
  Database,
} from 'lucide-react';

interface TranslationConfig {
  enabled: boolean;
  default_model: string;
  cache_enabled: boolean;
  cache_ttl_days: number;
  auto_detect_language: boolean;
  preserve_code_blocks: boolean;
  preserve_urls: boolean;
  preserve_mentions: boolean;
}

interface LanguageSupport {
  code: string;
  name: string;
  native_name: string;
  is_rtl: boolean;
  model_support: 'full' | 'partial' | 'translate';
}

interface TranslationStats {
  total_translations: number;
  cache_hit_rate: number;
  avg_latency_ms: number;
  cost_saved_percent: number;
}

const SUPPORTED_LANGUAGES: LanguageSupport[] = [
  { code: 'en', name: 'English', native_name: 'English', is_rtl: false, model_support: 'full' },
  { code: 'es', name: 'Spanish', native_name: 'Español', is_rtl: false, model_support: 'full' },
  { code: 'fr', name: 'French', native_name: 'Français', is_rtl: false, model_support: 'full' },
  { code: 'de', name: 'German', native_name: 'Deutsch', is_rtl: false, model_support: 'full' },
  { code: 'pt', name: 'Portuguese', native_name: 'Português', is_rtl: false, model_support: 'full' },
  { code: 'it', name: 'Italian', native_name: 'Italiano', is_rtl: false, model_support: 'full' },
  { code: 'nl', name: 'Dutch', native_name: 'Nederlands', is_rtl: false, model_support: 'partial' },
  { code: 'pl', name: 'Polish', native_name: 'Polski', is_rtl: false, model_support: 'partial' },
  { code: 'ru', name: 'Russian', native_name: 'Русский', is_rtl: false, model_support: 'partial' },
  { code: 'tr', name: 'Turkish', native_name: 'Türkçe', is_rtl: false, model_support: 'partial' },
  { code: 'ja', name: 'Japanese', native_name: '日本語', is_rtl: false, model_support: 'full' },
  { code: 'ko', name: 'Korean', native_name: '한국어', is_rtl: false, model_support: 'full' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', native_name: '简体中文', is_rtl: false, model_support: 'full' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', native_name: '繁體中文', is_rtl: false, model_support: 'partial' },
  { code: 'ar', name: 'Arabic', native_name: 'العربية', is_rtl: true, model_support: 'translate' },
  { code: 'hi', name: 'Hindi', native_name: 'हिन्दी', is_rtl: false, model_support: 'translate' },
  { code: 'th', name: 'Thai', native_name: 'ไทย', is_rtl: false, model_support: 'translate' },
  { code: 'vi', name: 'Vietnamese', native_name: 'Tiếng Việt', is_rtl: false, model_support: 'translate' },
];

async function fetchDashboard() {
  const res = await fetch('/api/admin/translation/dashboard');
  if (!res.ok) throw new Error('Failed to fetch dashboard');
  return res.json();
}

async function testTranslation(text: string, targetLang: string) {
  const res = await fetch('/api/admin/translation/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, target_language: targetLang }),
  });
  if (!res.ok) throw new Error('Translation failed');
  return res.json();
}

export default function TranslationPage() {
  const _queryClient = useQueryClient();
  void _queryClient; // Reserved for query invalidation
  const [testText, setTestText] = useState('');
  const [testLang, setTestLang] = useState('es');
  const [testResult, setTestResult] = useState('');

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['translation-dashboard'],
    queryFn: fetchDashboard,
  });

  const testMutation = useMutation({
    mutationFn: () => testTranslation(testText, testLang),
    onSuccess: (data) => {
      setTestResult(data.translated_text);
      toast.success('Translation complete');
    },
    onError: () => toast.error('Translation failed'),
  });

  const config: TranslationConfig = dashboard?.config || {};
  const stats: TranslationStats = dashboard?.stats || {};

  const getSupportBadge = (support: string) => {
    switch (support) {
      case 'full': return <Badge className="bg-green-500">Native</Badge>;
      case 'partial': return <Badge className="bg-yellow-500">Partial</Badge>;
      default: return <Badge variant="secondary">Translate</Badge>;
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
          <Languages className="h-8 w-8" />
          Translation Middleware
        </h1>
        <p className="text-muted-foreground mt-1">
          Automatic translation layer for multilingual AI model support (18 languages)
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Translations</CardDescription>
            <CardTitle className="text-3xl">{stats.total_translations?.toLocaleString() || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cache Hit Rate</CardDescription>
            <CardTitle className="text-3xl text-green-500">
              {((stats.cache_hit_rate || 0) * 100).toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={(stats.cache_hit_rate || 0) * 100} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Latency</CardDescription>
            <CardTitle className="text-3xl">{stats.avg_latency_ms || 0}ms</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cost Saved</CardDescription>
            <CardTitle className="text-3xl text-blue-500">
              {((stats.cost_saved_percent || 0) * 100).toFixed(0)}%
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="languages" className="space-y-4">
        <TabsList>
          <TabsTrigger value="languages">Languages</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="test">Test Translation</TabsTrigger>
        </TabsList>

        <TabsContent value="languages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Supported Languages (18)
              </CardTitle>
              <CardDescription>
                Language support levels across AI models
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Native Name</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Model Support</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <TableRow key={lang.code}>
                      <TableCell className="font-mono">{lang.code}</TableCell>
                      <TableCell className="font-medium">{lang.name}</TableCell>
                      <TableCell>{lang.native_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{lang.is_rtl ? 'RTL' : 'LTR'}</Badge>
                      </TableCell>
                      <TableCell>{getSupportBadge(lang.model_support)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  General Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Translation</Label>
                    <p className="text-sm text-muted-foreground">Activate automatic translation</p>
                  </div>
                  <Switch checked={config.enabled} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-Detect Language</Label>
                    <p className="text-sm text-muted-foreground">Automatically detect input language</p>
                  </div>
                  <Switch checked={config.auto_detect_language} />
                </div>
                <div className="space-y-2">
                  <Label>Translation Model</Label>
                  <Select defaultValue={config.default_model || 'qwen2.5-7b-instruct'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="qwen2.5-7b-instruct">Qwen 2.5 7B Instruct</SelectItem>
                      <SelectItem value="llama-3.2-3b">Llama 3.2 3B</SelectItem>
                    </SelectContent>
                  </Select>
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
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Cache</Label>
                    <p className="text-sm text-muted-foreground">Cache translation results</p>
                  </div>
                  <Switch checked={config.cache_enabled} />
                </div>
                <div className="space-y-2">
                  <Label>Cache TTL (days)</Label>
                  <Input type="number" defaultValue={config.cache_ttl_days || 7} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Preserve Code Blocks</Label>
                    <p className="text-sm text-muted-foreground">Skip translation for code</p>
                  </div>
                  <Switch checked={config.preserve_code_blocks} />
                </div>
                <Button variant="destructive" size="sm">
                  Clear Cache
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Test Translation
              </CardTitle>
              <CardDescription>
                Test the translation middleware with sample text
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Input Text</Label>
                  <Textarea
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    placeholder="Enter text to translate..."
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Translation Result</Label>
                  <Textarea
                    value={testResult}
                    readOnly
                    placeholder="Translation will appear here..."
                    rows={4}
                    className="bg-muted"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Select value={testLang} onValueChange={setTestLang}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.filter(l => l.code !== 'en').map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name} ({lang.native_name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => testMutation.mutate()}
                  disabled={!testText || testMutation.isPending}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Translate
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
