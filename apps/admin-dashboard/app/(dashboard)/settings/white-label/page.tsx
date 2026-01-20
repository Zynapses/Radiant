'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Palette,
  Globe,
  Eye,
  EyeOff,
  Mail,
  Shield,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Upload,
  Activity
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface WhiteLabelConfig {
  id: string;
  enabled: boolean;
  branding: {
    companyName: string;
    productName: string;
    tagline: string;
    logo: {
      primary: string;
      light: string;
      dark: string;
      icon: string;
    };
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      foreground: string;
    };
    fonts: {
      primary: string;
      secondary: string;
      mono: string;
    };
  };
  domains: Array<{
    id: string;
    domain: string;
    type: string;
    verified: boolean;
    sslEnabled: boolean;
  }>;
  features: {
    hideRadiantBranding: boolean;
    hidePoweredBy: boolean;
    hideModelNames: boolean;
    hideModelProviders: boolean;
    hideCostMetrics: boolean;
    hideUsageMetrics: boolean;
  };
  legal: {
    companyLegalName: string;
    termsOfServiceUrl: string;
    privacyPolicyUrl: string;
    supportEmail: string;
    copyrightNotice: string;
  };
  emails: {
    fromName: string;
    fromEmail: string;
  };
}

interface WhiteLabelMetrics {
  activeUsers: number;
  apiCalls: number;
  customDomainHits: number;
  emailsSent: number;
  brandingViews: number;
}

const defaultConfig: WhiteLabelConfig = {
  id: '',
  enabled: false,
  branding: {
    companyName: '',
    productName: '',
    tagline: '',
    logo: { primary: '', light: '', dark: '', icon: '' },
    colors: {
      primary: '#3B82F6',
      secondary: '#6366F1',
      accent: '#8B5CF6',
      background: '#FFFFFF',
      foreground: '#1F2937',
    },
    fonts: { primary: 'Inter', secondary: 'Inter', mono: 'JetBrains Mono' },
  },
  domains: [],
  features: {
    hideRadiantBranding: true,
    hidePoweredBy: true,
    hideModelNames: false,
    hideModelProviders: false,
    hideCostMetrics: false,
    hideUsageMetrics: false,
  },
  legal: {
    companyLegalName: '',
    termsOfServiceUrl: '',
    privacyPolicyUrl: '',
    supportEmail: '',
    copyrightNotice: '',
  },
  emails: { fromName: '', fromEmail: '' },
};

export default function WhiteLabelPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<WhiteLabelConfig>(defaultConfig);
  const [metrics, setMetrics] = useState<WhiteLabelMetrics | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [verifyingDomain, setVerifyingDomain] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
    loadMetrics();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/admin/white-label/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    try {
      const response = await fetch('/api/admin/white-label/metrics?period=day');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const method = config.id ? 'PUT' : 'POST';
      const response = await fetch('/api/admin/white-label/config', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        toast({
          title: 'Configuration saved',
          description: 'White-label settings have been updated.',
        });
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save configuration.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const addDomain = async () => {
    if (!newDomain) return;
    try {
      const response = await fetch('/api/admin/white-label/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain, type: 'primary' }),
      });
      if (response.ok) {
        const domain = await response.json();
        setConfig({
          ...config,
          domains: [...config.domains, domain],
        });
        setNewDomain('');
        toast({ title: 'Domain added', description: 'Verify ownership to activate.' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add domain.', variant: 'destructive' });
    }
  };

  const removeDomain = async (domainId: string) => {
    try {
      await fetch(`/api/admin/white-label/domains/${domainId}`, { method: 'DELETE' });
      setConfig({
        ...config,
        domains: config.domains.filter((d) => d.id !== domainId),
      });
      toast({ title: 'Domain removed' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to remove domain.', variant: 'destructive' });
    }
  };

  const verifyDomain = async (domain: string) => {
    setVerifyingDomain(domain);
    try {
      const response = await fetch(`/api/admin/white-label/domains/${encodeURIComponent(domain)}/verify`, {
        method: 'GET',
      });
      if (response.ok) {
        const result = await response.json();
        if (result.verified) {
          setConfig({
            ...config,
            domains: config.domains.map((d) =>
              d.domain === domain ? { ...d, verified: true } : d
            ),
          });
          toast({ title: 'Domain verified!' });
        } else {
          toast({ title: 'Not verified yet', description: 'DNS records not found.' });
        }
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to verify domain.', variant: 'destructive' });
    } finally {
      setVerifyingDomain(null);
    }
  };

  const updateBranding = (field: string, value: string) => {
    const keys = field.split('.');
    if (keys.length === 1) {
      setConfig({
        ...config,
        branding: { ...config.branding, [field]: value },
      });
    } else if (keys[0] === 'colors') {
      setConfig({
        ...config,
        branding: {
          ...config.branding,
          colors: { ...config.branding.colors, [keys[1]]: value },
        },
      });
    } else if (keys[0] === 'logo') {
      setConfig({
        ...config,
        branding: {
          ...config.branding,
          logo: { ...config.branding.logo, [keys[1]]: value },
        },
      });
    } else if (keys[0] === 'fonts') {
      setConfig({
        ...config,
        branding: {
          ...config.branding,
          fonts: { ...config.branding.fonts, [keys[1]]: value },
        },
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">White-Label Configuration</h1>
          <p className="text-muted-foreground">
            Complete branding customization - your users never see RADIANT
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={config.enabled ? 'default' : 'secondary'}>
            {config.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
          <Badge variant="outline">Moat #25</Badge>
        </div>
      </div>

      <Tabs defaultValue="branding">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="branding">
            <Palette className="h-4 w-4 mr-2" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="domains">
            <Globe className="h-4 w-4 mr-2" />
            Domains
          </TabsTrigger>
          <TabsTrigger value="visibility">
            <Eye className="h-4 w-4 mr-2" />
            Visibility
          </TabsTrigger>
          <TabsTrigger value="legal">
            <Shield className="h-4 w-4 mr-2" />
            Legal
          </TabsTrigger>
          <TabsTrigger value="emails">
            <Mail className="h-4 w-4 mr-2" />
            Emails
          </TabsTrigger>
          <TabsTrigger value="metrics">
            <Activity className="h-4 w-4 mr-2" />
            Metrics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Enable White-Label</CardTitle>
              <CardDescription>
                Turn on white-labeling to hide all RADIANT branding
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable White-Label Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    When enabled, your branding replaces RADIANT everywhere
                  </p>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(enabled) => setConfig({ ...config, enabled })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Company & Product</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    value={config.branding.companyName}
                    onChange={(e) => updateBranding('companyName', e.target.value)}
                    placeholder="Your Company"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Product Name</Label>
                  <Input
                    value={config.branding.productName}
                    onChange={(e) => updateBranding('productName', e.target.value)}
                    placeholder="Your AI Product"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tagline</Label>
                <Input
                  value={config.branding.tagline}
                  onChange={(e) => updateBranding('tagline', e.target.value)}
                  placeholder="Your AI-powered assistant"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Logos</CardTitle>
              <CardDescription>Upload your logo variations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                {(['primary', 'light', 'dark', 'icon'] as const).map((variant) => (
                  <div key={variant} className="space-y-2">
                    <Label className="capitalize">{variant} Logo</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      {config.branding.logo[variant] ? (
                        <Image
                          src={config.branding.logo[variant]}
                          alt={`${variant} logo`}
                          width={48}
                          height={48}
                          className="h-12 w-auto mx-auto object-contain"
                          unoptimized
                        />
                      ) : (
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      )}
                    </div>
                    <Input
                      value={config.branding.logo[variant]}
                      onChange={(e) => updateBranding(`logo.${variant}`, e.target.value)}
                      placeholder="Logo URL"
                      className="text-xs"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Brand Colors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4">
                {Object.entries(config.branding.colors).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <Label className="capitalize">{key}</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={value}
                        onChange={(e) => updateBranding(`colors.${key}`, e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <Input
                        value={value}
                        onChange={(e) => updateBranding(`colors.${key}`, e.target.value)}
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fonts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(config.branding.fonts).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <Label className="capitalize">{key} Font</Label>
                    <Input
                      value={value}
                      onChange={(e) => updateBranding(`fonts.${key}`, e.target.value)}
                      placeholder="Font family"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="domains" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Custom Domains</CardTitle>
              <CardDescription>
                Add your own domains for a fully branded experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="ai.yourdomain.com"
                  className="flex-1"
                />
                <Button onClick={addDomain}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Domain
                </Button>
              </div>

              {config.domains.length > 0 && (
                <div className="space-y-2 mt-4">
                  {config.domains.map((domain) => (
                    <div
                      key={domain.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {domain.verified ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-yellow-500" />
                        )}
                        <div>
                          <div className="font-medium">{domain.domain}</div>
                          <div className="text-sm text-muted-foreground">
                            {domain.verified ? 'Verified' : 'Pending verification'} •{' '}
                            {domain.type}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!domain.verified && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => verifyDomain(domain.domain)}
                            disabled={verifyingDomain === domain.domain}
                          >
                            {verifyingDomain === domain.domain ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              'Verify'
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDomain(domain.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visibility" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Feature Visibility</CardTitle>
              <CardDescription>
                Control what your end users can see
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'hideRadiantBranding', label: 'Hide RADIANT Branding', desc: 'Remove all RADIANT references' },
                { key: 'hidePoweredBy', label: 'Hide "Powered By"', desc: 'Remove powered by footer' },
                { key: 'hideModelNames', label: 'Hide Model Names', desc: 'Show generic "AI Model" instead' },
                { key: 'hideModelProviders', label: 'Hide Model Providers', desc: 'Remove Anthropic, OpenAI references' },
                { key: 'hideCostMetrics', label: 'Hide Cost Metrics', desc: 'Don\'t show token/cost info' },
                { key: 'hideUsageMetrics', label: 'Hide Usage Metrics', desc: 'Don\'t show usage statistics' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <Label className="flex items-center gap-2">
                      <EyeOff className="h-4 w-4" />
                      {label}
                    </Label>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={config.features[key as keyof typeof config.features]}
                    onCheckedChange={(value) =>
                      setConfig({
                        ...config,
                        features: { ...config.features, [key]: value },
                      })
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="legal" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Legal Configuration</CardTitle>
              <CardDescription>
                Legal entity and compliance information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Legal Name</Label>
                  <Input
                    value={config.legal.companyLegalName}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        legal: { ...config.legal, companyLegalName: e.target.value },
                      })
                    }
                    placeholder="Your Company, Inc."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Support Email</Label>
                  <Input
                    value={config.legal.supportEmail}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        legal: { ...config.legal, supportEmail: e.target.value },
                      })
                    }
                    placeholder="support@yourcompany.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Terms of Service URL</Label>
                  <Input
                    value={config.legal.termsOfServiceUrl}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        legal: { ...config.legal, termsOfServiceUrl: e.target.value },
                      })
                    }
                    placeholder="https://yourcompany.com/terms"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Privacy Policy URL</Label>
                  <Input
                    value={config.legal.privacyPolicyUrl}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        legal: { ...config.legal, privacyPolicyUrl: e.target.value },
                      })
                    }
                    placeholder="https://yourcompany.com/privacy"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Copyright Notice</Label>
                <Input
                  value={config.legal.copyrightNotice}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      legal: { ...config.legal, copyrightNotice: e.target.value },
                    })
                  }
                  placeholder="© 2026 Your Company. All rights reserved."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emails" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Configuration</CardTitle>
              <CardDescription>
                Customize outbound email sender information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Name</Label>
                  <Input
                    value={config.emails.fromName}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        emails: { ...config.emails, fromName: e.target.value },
                      })
                    }
                    placeholder="Your Product"
                  />
                </div>
                <div className="space-y-2">
                  <Label>From Email</Label>
                  <Input
                    value={config.emails.fromEmail}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        emails: { ...config.emails, fromEmail: e.target.value },
                      })
                    }
                    placeholder="noreply@yourcompany.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          {metrics && (
            <div className="grid grid-cols-5 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Active Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.activeUsers}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    API Calls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.apiCalls.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Domain Hits
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.customDomainHits.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Emails Sent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.emailsSent}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Branding Views
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.brandingViews.toLocaleString()}</div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={saveConfig} disabled={saving} size="lg">
          {saving ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save All Changes
        </Button>
      </div>
    </div>
  );
}
