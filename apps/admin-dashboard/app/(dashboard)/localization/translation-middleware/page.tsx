'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Languages, 
  RefreshCw, 
  Settings,
  BarChart3,
  Database,
  Trash2,
  TestTube,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface TranslationConfig {
  enabled: boolean;
  translation_model: string;
  cache_enabled: boolean;
  cache_ttl_hours: number;
  max_cache_size: number;
  confidence_threshold: number;
  max_input_length: number;
  preserve_code_blocks: boolean;
  preserve_urls: boolean;
  preserve_mentions: boolean;
  fallback_to_english: boolean;
  cost_limit_per_day_cents: number;
}

interface DashboardData {
  config: TranslationConfig;
  metrics: {
    totalTranslations: number;
    cacheHits: number;
    cacheMisses: number;
    avgLatency: number;
    costToday: number;
    languageBreakdown: Record<string, number>;
  };
  languages: Array<{
    code: string;
    name: string;
    nativeName: string;
    scriptType: string;
  }>;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', scriptType: 'latin' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', scriptType: 'latin' },
  { code: 'fr', name: 'French', nativeName: 'Français', scriptType: 'latin' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', scriptType: 'latin' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', scriptType: 'latin' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', scriptType: 'latin' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', scriptType: 'latin' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', scriptType: 'latin' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', scriptType: 'cyrillic' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', scriptType: 'latin' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', scriptType: 'cjk' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', scriptType: 'cjk' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', scriptType: 'cjk' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文', scriptType: 'cjk' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', scriptType: 'arabic' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', scriptType: 'devanagari' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', scriptType: 'thai' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', scriptType: 'latin' },
];

export default function TranslationMiddlewarePage() {
  const [config, setConfig] = useState<TranslationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<{ detected: string; translated: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [metrics, setMetrics] = useState<DashboardData['metrics'] | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      const res = await fetch('/api/admin/translation/dashboard');
      const data = await res.json();
      setConfig(data.config);
      setMetrics(data.metrics);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      // Use defaults
      setConfig({
        enabled: true,
        translation_model: 'qwen2.5-7b-instruct',
        cache_enabled: true,
        cache_ttl_hours: 168,
        max_cache_size: 10000,
        confidence_threshold: 0.70,
        max_input_length: 50000,
        preserve_code_blocks: true,
        preserve_urls: true,
        preserve_mentions: true,
        fallback_to_english: true,
        cost_limit_per_day_cents: 1000,
      });
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/translation/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        toast.success('Configuration saved');
      } else {
        toast.error('Failed to save configuration');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function clearCache() {
    try {
      const res = await fetch('/api/admin/translation/cache', { method: 'DELETE' });
      if (res.ok) {
        toast.success('Translation cache cleared');
        fetchDashboard();
      } else {
        toast.error('Failed to clear cache');
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
      toast.error('Failed to clear cache');
    }
  }

  async function testTranslation() {
    if (!testText.trim()) return;
    setTesting(true);
    try {
      const detectRes = await fetch('/api/admin/translation/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testText }),
      });
      const detectData = await detectRes.json();

      if (detectData.language !== 'en') {
        const translateRes = await fetch('/api/admin/translation/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: testText, targetLanguage: 'en' }),
        });
        const translateData = await translateRes.json();
        setTestResult({
          detected: detectData.language,
          translated: translateData.translation,
        });
      } else {
        setTestResult({
          detected: 'en',
          translated: '(Already English - no translation needed)',
        });
      }
    } catch (error) {
      console.error('Translation test failed:', error);
      toast.error('Translation test failed');
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cacheHitRate = metrics && (metrics.cacheHits + metrics.cacheMisses) > 0
    ? ((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Translation Middleware</h1>
          <p className="text-muted-foreground">
            Automatic translation for multilingual AI model support (18 languages)
          </p>
        </div>
        <Button variant="outline" onClick={fetchDashboard}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Translations</CardTitle>
            <Languages className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalTranslations || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cacheHitRate}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.cacheHits || 0} hits / {metrics?.cacheMisses || 0} misses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.avgLatency || 0}ms</div>
            <p className="text-xs text-muted-foreground">Per translation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost Today</CardTitle>
            <Languages className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${((metrics?.costToday || 0) / 100).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Limit: ${(config?.cost_limit_per_day_cents || 0) / 100}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="languages">
            <Languages className="h-4 w-4 mr-2" />
            Languages
          </TabsTrigger>
          <TabsTrigger value="test">
            <TestTube className="h-4 w-4 mr-2" />
            Test
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Translation Settings</CardTitle>
              <CardDescription>
                Configure automatic translation for non-English inputs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {config && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Translation</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically translate non-English inputs
                      </p>
                    </div>
                    <Switch
                      checked={config.enabled}
                      onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Translation Model</Label>
                    <Select
                      value={config.translation_model}
                      onValueChange={(v) => setConfig({ ...config, translation_model: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="qwen2.5-7b-instruct">Qwen 2.5 7B (Recommended)</SelectItem>
                        <SelectItem value="qwen2.5-72b-instruct">Qwen 2.5 72B</SelectItem>
                        <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                        <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="cacheTtl">Cache TTL (hours)</Label>
                      <Input
                        id="cacheTtl"
                        type="number"
                        value={config.cache_ttl_hours}
                        onChange={(e) => setConfig({ ...config, cache_ttl_hours: parseInt(e.target.value) || 168 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxCache">Max Cache Size</Label>
                      <Input
                        id="maxCache"
                        type="number"
                        value={config.max_cache_size}
                        onChange={(e) => setConfig({ ...config, max_cache_size: parseInt(e.target.value) || 10000 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confidence">Confidence Threshold</Label>
                      <Input
                        id="confidence"
                        type="number"
                        step="0.01"
                        value={config.confidence_threshold}
                        onChange={(e) => setConfig({ ...config, confidence_threshold: parseFloat(e.target.value) || 0.7 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="costLimit">Daily Cost Limit (cents)</Label>
                      <Input
                        id="costLimit"
                        type="number"
                        value={config.cost_limit_per_day_cents}
                        onChange={(e) => setConfig({ ...config, cost_limit_per_day_cents: parseInt(e.target.value) || 1000 })}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Cache Enabled</Label>
                        <p className="text-sm text-muted-foreground">Cache translations for reuse</p>
                      </div>
                      <Switch
                        checked={config.cache_enabled}
                        onCheckedChange={(v) => setConfig({ ...config, cache_enabled: v })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Preserve Code Blocks</Label>
                        <p className="text-sm text-muted-foreground">Don&apos;t translate code</p>
                      </div>
                      <Switch
                        checked={config.preserve_code_blocks}
                        onCheckedChange={(v) => setConfig({ ...config, preserve_code_blocks: v })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Preserve URLs</Label>
                        <p className="text-sm text-muted-foreground">Don&apos;t translate URLs</p>
                      </div>
                      <Switch
                        checked={config.preserve_urls}
                        onCheckedChange={(v) => setConfig({ ...config, preserve_urls: v })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Fallback to English</Label>
                        <p className="text-sm text-muted-foreground">
                          Use original if translation fails
                        </p>
                      </div>
                      <Switch
                        checked={config.fallback_to_english}
                        onCheckedChange={(v) => setConfig({ ...config, fallback_to_english: v })}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={saveConfig} disabled={saving}>
                      {saving ? 'Saving...' : 'Save Configuration'}
                    </Button>
                    <Button variant="outline" onClick={clearCache}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear Cache
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="languages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Supported Languages</CardTitle>
              <CardDescription>
                18 languages supported for automatic translation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <div
                    key={lang.code}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{lang.name}</div>
                      <div className="text-sm text-muted-foreground">{lang.nativeName}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{lang.code}</Badge>
                      <Badge variant="secondary">{lang.scriptType}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Translation</CardTitle>
              <CardDescription>
                Enter text to detect language and translate to English
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="testText">Input Text</Label>
                <Input
                  id="testText"
                  placeholder="Enter text in any language..."
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                />
              </div>
              <Button onClick={testTranslation} disabled={testing || !testText.trim()}>
                {testing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <TestTube className="h-4 w-4 mr-2" />
                    Detect & Translate
                  </>
                )}
              </Button>

              {testResult && (
                <div className="mt-4 space-y-3 p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Detected Language:</span>
                    <Badge>
                      {SUPPORTED_LANGUAGES.find((l) => l.code === testResult.detected)?.name || testResult.detected}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">Translation:</span>
                    <p className="mt-1 p-3 bg-muted rounded">{testResult.translated}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
