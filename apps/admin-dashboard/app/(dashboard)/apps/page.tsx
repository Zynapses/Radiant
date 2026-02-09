'use client';

import { useState, useEffect } from 'react';
import {
  ExternalLink,
  Settings2,
  Brain,
  BookOpen,
  Flame,
  Shield,
  Dna,
  Hammer,
  Globe,
  Activity,
  Server,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';

interface AppInfo {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  urlKey: string;
  tier: string;
  techStack: string;
  defaultSubdomain: string;
}

const platformApps: AppInfo[] = [
  {
    id: 'thinktank',
    name: 'Think Tank',
    shortName: 'Think Tank',
    description: 'Consumer AI interface with chat, artifacts, collaboration, and compliance features.',
    icon: <Brain className="w-6 h-6" />,
    color: 'text-green-500',
    urlKey: 'thinkTankUrl',
    tier: 'Core',
    techStack: 'Next.js 14 + TypeScript',
    defaultSubdomain: 'app',
  },
  {
    id: 'curator',
    name: 'Curator',
    shortName: 'Curator',
    description: 'Knowledge graph curation, fact verification, conflict resolution, and domain management.',
    icon: <BookOpen className="w-6 h-6" />,
    color: 'text-orange-500',
    urlKey: 'curatorUrl',
    tier: 'Growth+',
    techStack: 'Next.js 14 + TypeScript',
    defaultSubdomain: 'curator',
  },
  {
    id: 'dojo',
    name: 'Aurelius Dojo',
    shortName: 'Dojo',
    description: 'Thematic mastery training with spaced repetition, scenario synthesis, and competency mapping.',
    icon: <Flame className="w-6 h-6" />,
    color: 'text-amber-500',
    urlKey: 'dojoUrl',
    tier: 'Growth+',
    techStack: 'Next.js 14 + TypeScript',
    defaultSubdomain: 'dojo',
  },
  {
    id: 'cato-trainer',
    name: 'Cato Trainer',
    shortName: 'Cato',
    description: 'AI-powered knowledge base with grounded Q&A, semantic search, multi-doc digest, and citation-backed responses.',
    icon: <Shield className="w-6 h-6" />,
    color: 'text-teal-500',
    urlKey: 'catoTrainerUrl',
    tier: 'Growth+',
    techStack: 'Next.js 14 + TypeScript',
    defaultSubdomain: 'cato',
  },
  {
    id: 'genesis-lab',
    name: 'Genesis Lab',
    shortName: 'Genesis',
    description: 'OMEGA brain monitoring dashboard with thermal visualization, coherence metrics, and Cortex Explorer.',
    icon: <Activity className="w-6 h-6" />,
    color: 'text-pink-500',
    urlKey: 'genesisLabUrl',
    tier: 'Scale+',
    techStack: 'Next.js 14 + Three.js',
    defaultSubdomain: 'genesis',
  },
  {
    id: 'genesis-forge',
    name: 'Genesis Forge',
    shortName: 'Forge',
    description: 'OMEGA firmware creation tool for .bio files with Helix rules, ambition settings, and personality traits.',
    icon: <Hammer className="w-6 h-6" />,
    color: 'text-red-500',
    urlKey: 'genesisForgeUrl',
    tier: 'Scale+',
    techStack: 'Next.js 14 + TypeScript',
    defaultSubdomain: 'forge',
  },
  {
    id: 'omega-api',
    name: 'OMEGA API',
    shortName: 'OMEGA',
    description: 'Bio-mimetic AI inference API with Time Warp, shadow mode, and brain management.',
    icon: <Dna className="w-6 h-6" />,
    color: 'text-indigo-500',
    urlKey: 'omegaApiUrl',
    tier: 'Scale+',
    techStack: 'AWS Lambda + Python 3.11',
    defaultSubdomain: 'omega',
  },
  {
    id: 'radiant-admin',
    name: 'RADIANT Admin',
    shortName: 'Admin',
    description: 'Platform administration dashboard for managing tenants, AI models, billing, and system configuration.',
    icon: <Settings2 className="w-6 h-6" />,
    color: 'text-blue-500',
    urlKey: 'adminDashboardUrl',
    tier: 'Core',
    techStack: 'Next.js 14 + TypeScript',
    defaultSubdomain: 'admin',
  },
  {
    id: 'api',
    name: 'External API',
    shortName: 'API',
    description: 'External REST and GraphQL API for integrations and third-party access.',
    icon: <Server className="w-6 h-6" />,
    color: 'text-cyan-500',
    urlKey: 'apiBaseUrl',
    tier: 'Core',
    techStack: 'AWS Lambda + API Gateway',
    defaultSubdomain: 'api',
  },
];

interface URLConfig {
  [key: string]: string;
}

export default function ApplicationsPage() {
  const [urls, setUrls] = useState<URLConfig>({});
  const [loading, setLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState<Record<string, 'healthy' | 'unhealthy' | 'unknown'>>({});

  useEffect(() => {
    loadUrls();
  }, []);

  const loadUrls = async () => {
    try {
      const response = await fetch('/api/admin/settings/urls');
      if (response.ok) {
        const data = await response.json();
        setUrls(data);
      }
    } catch (err) {
      console.error('Failed to load URLs:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkHealth = async (appId: string, url: string) => {
    if (!url) return;
    setHealthStatus(prev => ({ ...prev, [appId]: 'unknown' }));
    try {
      const healthUrl = appId === 'api' ? `${url}/health` : `${url}/_health`;
      const response = await fetch(healthUrl, { mode: 'no-cors', signal: AbortSignal.timeout(5000) });
      setHealthStatus(prev => ({ ...prev, [appId]: response.ok || response.type === 'opaque' ? 'healthy' : 'unhealthy' }));
    } catch {
      setHealthStatus(prev => ({ ...prev, [appId]: 'unhealthy' }));
    }
  };

  const getAppUrl = (app: AppInfo): string => {
    return urls[app.urlKey] || '';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Applications</h1>
          <p className="text-gray-500 dark:text-gray-400">
            All RADIANT platform applications and their deployment status. Configure URLs in{' '}
            <a href="/settings/urls" className="text-indigo-500 hover:underline">Settings &gt; URLs</a>.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {platformApps.map((app) => {
            const url = getAppUrl(app);
            const health = healthStatus[app.id];

            return (
              <div
                key={app.id}
                className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-5 flex flex-col"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={app.color}>{app.icon}</div>
                    <div>
                      <h3 className="font-semibold">{app.name}</h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                        {app.tier}
                      </span>
                    </div>
                  </div>
                  {health === 'healthy' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                  {health === 'unhealthy' && <XCircle className="w-5 h-5 text-red-500" />}
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 flex-1">
                  {app.description}
                </p>

                <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  <span className="font-medium">Stack:</span> {app.techStack}
                </div>

                {url ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center gap-2 px-3 py-2 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{url.replace(/^https?:\/\//, '')}</span>
                    </a>
                    <button
                      onClick={() => checkHealth(app.id, url)}
                      className="px-2 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      title="Check health"
                    >
                      <Globe className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <Globe className="w-4 h-4" />
                    <span>Not configured</span>
                    <a
                      href="/settings/urls"
                      className="ml-auto text-indigo-500 hover:underline text-xs"
                    >
                      Configure
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
