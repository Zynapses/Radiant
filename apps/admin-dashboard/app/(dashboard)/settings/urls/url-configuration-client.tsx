'use client';

import { useState, useEffect } from 'react';
import { 
  Globe, 
  Server, 
  Brain, 
  Settings2, 
  Link2, 
  Cloud, 
  HardDrive,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Save,
  RefreshCw,
  ExternalLink,
  Activity,
  Hammer,
  Dna,
  Flame,
  Shield,
} from 'lucide-react';

interface URLConfiguration {
  statusPageUrl: string;
  thinkTankUrl: string;
  adminDashboardUrl: string;
  apiBaseUrl: string;
  websocketUrl: string;
  cloudfrontUrl: string;
  s3AssetsUrl: string;
  primaryDomain: string;
  useCustomDomain: boolean;
  customDomain?: string;
  // v7.5.0 - OMEGA URLs
  omegaLabUrl: string;
  omegaForgeUrl: string;
  omegaApiUrl: string;
  // v7.17.0 - Aurelius Dojo
  dojoUrl: string;
  // v7.18.0 - Cato Trainer
  catoTrainerUrl: string;
}

interface ValidationResult {
  field: string;
  valid: boolean;
  message?: string;
}

export default function URLConfigurationClient() {
  const [config, setConfig] = useState<URLConfiguration>({
    statusPageUrl: '',
    thinkTankUrl: '',
    adminDashboardUrl: '',
    apiBaseUrl: '',
    websocketUrl: '',
    cloudfrontUrl: '',
    s3AssetsUrl: '',
    primaryDomain: '',
    useCustomDomain: false,
    customDomain: '',
    // v7.5.0 - OMEGA URLs
    omegaLabUrl: '',
    omegaForgeUrl: '',
    omegaApiUrl: '',
    // v7.17.0 - Aurelius Dojo
    dojoUrl: '',
    // v7.18.0 - Cato Trainer
    catoTrainerUrl: '',
  });

  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      const response = await fetch('/api/admin/settings/urls');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (err) {
      console.error('Failed to load URL configuration:', err);
    }
  };

  const validateUrl = (url: string): { valid: boolean; message?: string } => {
    if (!url) return { valid: true }; // Empty is OK
    
    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:', 'wss:'].includes(urlObj.protocol)) {
        return { valid: false, message: 'Must use HTTP, HTTPS, or WSS protocol' };
      }
      if (urlObj.protocol === 'http:' && !url.includes('localhost')) {
        return { valid: false, message: 'Production URLs should use HTTPS' };
      }
      return { valid: true };
    } catch {
      return { valid: false, message: 'Invalid URL format' };
    }
  };

  const validateConfiguration = async () => {
    setIsValidating(true);
    const results: ValidationResult[] = [];

    // Validate each URL
    const urlFields = [
      { key: 'statusPageUrl', label: 'Status Page URL' },
      { key: 'thinkTankUrl', label: 'Think Tank URL' },
      { key: 'adminDashboardUrl', label: 'Admin Dashboard URL' },
      { key: 'apiBaseUrl', label: 'API Base URL' },
      { key: 'websocketUrl', label: 'WebSocket URL' },
      { key: 'cloudfrontUrl', label: 'CloudFront URL' },
      { key: 's3AssetsUrl', label: 'S3 Assets URL' },
      { key: 'omegaLabUrl', label: 'OMEGA Lab URL' },
      { key: 'omegaForgeUrl', label: 'OMEGA Forge URL' },
      { key: 'omegaApiUrl', label: 'OMEGA API URL' },
      { key: 'dojoUrl', label: 'Aurelius Dojo URL' },
      { key: 'catoTrainerUrl', label: 'Cato Trainer URL' },
    ];

    for (const field of urlFields) {
      const url = config[field.key as keyof URLConfiguration] as string;
      const validation = validateUrl(url);
      results.push({
        field: field.label,
        valid: validation.valid,
        message: validation.message,
      });
    }

    // Check domain consistency
    if (config.primaryDomain) {
      const urls = [config.statusPageUrl, config.thinkTankUrl, config.adminDashboardUrl, config.apiBaseUrl];
      const inconsistent = urls.filter(url => url && !url.includes(config.primaryDomain));
      if (inconsistent.length > 0) {
        results.push({
          field: 'Domain Consistency',
          valid: false,
          message: `Some URLs don't match primary domain '${config.primaryDomain}'`,
        });
      }
    }

    setValidationResults(results);
    setIsValidating(false);
  };

  const saveConfiguration = async () => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch('/api/admin/settings/urls', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        throw new Error('Failed to save configuration');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof URLConfiguration, value: string | boolean) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">URL Configuration</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Configure platform URLs for Status Page, Think Tank, Admin Dashboard, and API endpoints
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={validateConfiguration}
            disabled={isValidating}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
            Validate
          </button>
          <button
            onClick={saveConfiguration}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {saveSuccess && (
        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-200">
          <CheckCircle2 className="w-5 h-5" />
          Configuration saved successfully
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          <XCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Validation Results */}
      {validationResults.length > 0 && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="font-medium mb-3">Validation Results</h3>
          <div className="space-y-2">
            {validationResults.map((result, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                {result.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className={result.valid ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                  {result.field}: {result.valid ? 'Valid' : result.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Platform URLs */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-indigo-500" />
          Platform URLs
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          These URLs define where your RADIANT platform components are accessible.
        </p>

        <div className="space-y-4">
          <URLInputField
            label="Status Page URL"
            placeholder="https://status.example.com"
            value={config.statusPageUrl}
            onChange={(v) => updateField('statusPageUrl', v)}
            helpText="Public read-only system health status page"
            icon={<Globe className="w-4 h-4" />}
          />

          <URLInputField
            label="Think Tank URL"
            placeholder="https://thinktank.example.com"
            value={config.thinkTankUrl}
            onChange={(v) => updateField('thinkTankUrl', v)}
            helpText="Collaborative AI workspace"
            icon={<Brain className="w-4 h-4" />}
          />

          <URLInputField
            label="Admin Dashboard URL"
            placeholder="https://admin.example.com"
            value={config.adminDashboardUrl}
            onChange={(v) => updateField('adminDashboardUrl', v)}
            helpText="Administrative interface"
            icon={<Settings2 className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* API Configuration */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-indigo-500" />
          API Configuration
        </h2>

        <div className="space-y-4">
          <URLInputField
            label="API Base URL"
            placeholder="https://api.example.com"
            value={config.apiBaseUrl}
            onChange={(v) => updateField('apiBaseUrl', v)}
            helpText="RADIANT Service API endpoint"
            icon={<Server className="w-4 h-4" />}
          />

          <URLInputField
            label="WebSocket URL"
            placeholder="wss://ws.example.com"
            value={config.websocketUrl}
            onChange={(v) => updateField('websocketUrl', v)}
            helpText="Real-time communication endpoint"
            icon={<Link2 className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Aurelius Dojo - v7.17.0 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Flame className="w-5 h-5 text-amber-500" />
          Aurelius Dojo
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Thematic mastery training platform with spaced repetition, scenario synthesis, and competency mapping (Growth tier and above).
        </p>

        <div className="space-y-4">
          <URLInputField
            label="Aurelius Dojo URL"
            placeholder="https://dojo.example.com"
            value={config.dojoUrl}
            onChange={(v) => updateField('dojoUrl', v)}
            helpText="Training platform with Ebbinghaus decay engine, adversarial scenarios, Socratic dialectic, and competency mesh"
            icon={<Flame className="w-4 h-4" />}
          />

          <URLInputField
            label="Cato Trainer URL"
            placeholder="https://cato.example.com"
            value={config.catoTrainerUrl}
            onChange={(v) => updateField('catoTrainerUrl', v)}
            helpText="AI-powered knowledge base with grounded Q&A, semantic search, multi-doc digest, and citation-backed responses"
            icon={<Shield className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* OMEGA URLs - v7.5.0 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Dna className="w-5 h-5 text-pink-500" />
          OMEGA
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Bio-mimetic AI organism monitoring and firmware management (Scale tier and above).
        </p>

        <div className="space-y-4">
          <URLInputField
            label="OMEGA Lab URL"
            placeholder="https://omega-lab.example.com"
            value={config.omegaLabUrl}
            onChange={(v) => updateField('omegaLabUrl', v)}
            helpText="OMEGA brain monitoring dashboard with thermal visualization and Cortex Explorer"
            icon={<Activity className="w-4 h-4" />}
          />

          <URLInputField
            label="OMEGA Forge URL"
            placeholder="https://omega-forge.example.com"
            value={config.omegaForgeUrl}
            onChange={(v) => updateField('omegaForgeUrl', v)}
            helpText="OMEGA firmware creation tool for .bio files with Helix rules and personality traits"
            icon={<Hammer className="w-4 h-4" />}
          />

          <URLInputField
            label="OMEGA API URL"
            placeholder="https://omega.example.com"
            value={config.omegaApiUrl}
            onChange={(v) => updateField('omegaApiUrl', v)}
            helpText="Bio-mimetic AI inference API with Time Warp and shadow mode"
            icon={<Dna className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* CDN & Storage */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Cloud className="w-5 h-5 text-indigo-500" />
          CDN & Storage
        </h2>

        <div className="space-y-4">
          <URLInputField
            label="CloudFront Distribution"
            placeholder="https://d123456789.cloudfront.net"
            value={config.cloudfrontUrl}
            onChange={(v) => updateField('cloudfrontUrl', v)}
            helpText="CDN distribution for static assets"
            icon={<Cloud className="w-4 h-4" />}
          />

          <URLInputField
            label="S3 Assets Bucket URL"
            placeholder="https://assets.s3.amazonaws.com"
            value={config.s3AssetsUrl}
            onChange={(v) => updateField('s3AssetsUrl', v)}
            helpText="Static asset storage"
            icon={<HardDrive className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Domain Configuration */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Link2 className="w-5 h-5 text-indigo-500" />
          Domain Configuration
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Primary Domain</label>
            <input
              type="text"
              placeholder="example.com"
              value={config.primaryDomain}
              onChange={(e) => updateField('primaryDomain', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            />
            <p className="text-xs text-gray-500 mt-1">
              Your primary domain for the RADIANT platform
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useCustomDomain"
              checked={config.useCustomDomain}
              onChange={(e) => updateField('useCustomDomain', e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="useCustomDomain" className="text-sm font-medium">
              Use Custom Domain
            </label>
          </div>

          {config.useCustomDomain && (
            <URLInputField
              label="Custom Domain"
              placeholder="custom.example.com"
              value={config.customDomain || ''}
              onChange={(v) => updateField('customDomain', v)}
              helpText="Custom domain for platform access"
              icon={<Link2 className="w-4 h-4" />}
            />
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Links</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {config.statusPageUrl && (
            <QuickLink label="Status Page" url={config.statusPageUrl} />
          )}
          {config.thinkTankUrl && (
            <QuickLink label="Think Tank" url={config.thinkTankUrl} />
          )}
          {config.adminDashboardUrl && (
            <QuickLink label="Admin Dashboard" url={config.adminDashboardUrl} />
          )}
          {config.apiBaseUrl && (
            <QuickLink label="API Docs" url={`${config.apiBaseUrl}/docs`} />
          )}
          {config.omegaLabUrl && (
            <QuickLink label="OMEGA Lab" url={config.omegaLabUrl} />
          )}
          {config.omegaForgeUrl && (
            <QuickLink label="OMEGA Forge" url={config.omegaForgeUrl} />
          )}
          {config.omegaApiUrl && (
            <QuickLink label="OMEGA API" url={config.omegaApiUrl} />
          )}
          {config.dojoUrl && (
            <QuickLink label="Aurelius Dojo" url={config.dojoUrl} />
          )}
          {config.catoTrainerUrl && (
            <QuickLink label="Cato Trainer" url={config.catoTrainerUrl} />
          )}
        </div>
      </div>
    </div>
  );
}

// URL Input Field Component
function URLInputField({
  label,
  placeholder,
  value,
  onChange,
  helpText,
  icon,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  helpText: string;
  icon: React.ReactNode;
}) {
  const [isValid, setIsValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (!value) {
      setIsValid(null);
      return;
    }
    try {
      new URL(value);
      setIsValid(true);
    } catch {
      setIsValid(false);
    }
  }, [value]);

  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium mb-1">
        <span className="text-gray-500">{icon}</span>
        {label}
        {isValid !== null && (
          isValid ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500" />
          )
        )}
      </label>
      <input
        type="url"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 ${
          isValid === false
            ? 'border-red-300 dark:border-red-600'
            : 'border-gray-300 dark:border-gray-600'
        }`}
      />
      <p className="text-xs text-gray-500 mt-1">{helpText}</p>
    </div>
  );
}

// Quick Link Component
function QuickLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
    >
      <ExternalLink className="w-4 h-4 text-gray-500" />
      <span className="text-sm font-medium">{label}</span>
    </a>
  );
}
