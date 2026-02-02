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
  requiresApiKey: boolean;
}

/**
 * Required environment variables for providers that need API keys.
 * Validated at startup to fail fast rather than silently on requests.
 */
export const REQUIRED_ENV_VARS: Record<string, string[]> = {
  openai: ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
  azure: ['AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_ENDPOINT'],
  google: ['GOOGLE_API_KEY'],
  bedrock: [], // Uses IAM roles, no API key needed
};

/**
 * Validate that required environment variables are set.
 * Called at startup to fail fast with clear error messages.
 */
export function validateProviderEnvVars(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const [provider, vars] of Object.entries(REQUIRED_ENV_VARS)) {
    for (const varName of vars) {
      if (!process.env[varName]) {
        errors.push(`Missing ${varName} for ${provider} provider`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get list of providers that are properly configured.
 */
export function getConfiguredProviders(): string[] {
  const configured: string[] = [];
  
  for (const [provider, vars] of Object.entries(REQUIRED_ENV_VARS)) {
    const allVarsSet = vars.every(v => !!process.env[v]);
    if (allVarsSet || vars.length === 0) {
      configured.push(provider);
    }
  }
  
  return configured;
}

export const providerConfigs: Record<string, ProviderConfig> = {
  openai: {
    baseUrl: 'https://api.openai.com',
    maxConnections: 50,
    maxStreamsPerConnection: 100,
    requiresApiKey: true,
    defaultHeaders: {
      'authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
      'content-type': 'application/json',
    },
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    maxConnections: 50,
    maxStreamsPerConnection: 100,
    requiresApiKey: true,
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
    requiresApiKey: true,
    defaultHeaders: {
      'content-type': 'application/json',
    },
  },
  azure: {
    baseUrl: process.env.AZURE_OPENAI_ENDPOINT || 'https://your-resource.openai.azure.com',
    maxConnections: 50,
    maxStreamsPerConnection: 100,
    requiresApiKey: true,
    defaultHeaders: {
      'api-key': process.env.AZURE_OPENAI_API_KEY || '',
      'content-type': 'application/json',
    },
  },
  bedrock: {
    baseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com',
    maxConnections: 50,
    maxStreamsPerConnection: 100,
    requiresApiKey: false, // Uses IAM roles
    defaultHeaders: {
      'content-type': 'application/json',
    },
  },
};
