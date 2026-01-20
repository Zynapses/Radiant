/**
 * RADIANT Egress Proxy - Provider Configurations
 * 
 * HTTP/2 connection pool settings for each AI provider.
 * These pools run on long-lived Fargate compute (NOT Lambda).
 */

export interface ProviderConfig {
  baseUrl: string;
  maxConnections: number;
  maxStreamsPerConnection: number;
  defaultHeaders: Record<string, string>;
}

export const providerConfigs: Record<string, ProviderConfig> = {
  openai: {
    baseUrl: 'https://api.openai.com',
    maxConnections: 50,
    maxStreamsPerConnection: 100,
    defaultHeaders: {
      'authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
      'content-type': 'application/json',
    },
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    maxConnections: 50,
    maxStreamsPerConnection: 100,
    defaultHeaders: {
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2024-01-01',
      'content-type': 'application/json',
    },
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com',
    maxConnections: 50,
    maxStreamsPerConnection: 100,
    defaultHeaders: {
      'content-type': 'application/json',
    },
  },
  azure: {
    baseUrl: process.env.AZURE_OPENAI_ENDPOINT || 'https://your-resource.openai.azure.com',
    maxConnections: 50,
    maxStreamsPerConnection: 100,
    defaultHeaders: {
      'api-key': process.env.AZURE_OPENAI_API_KEY || '',
      'content-type': 'application/json',
    },
  },
  bedrock: {
    baseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com',
    maxConnections: 50,
    maxStreamsPerConnection: 100,
    defaultHeaders: {
      'content-type': 'application/json',
    },
  },
};
