/**
 * CLI Configuration Management
 */

import Conf from 'conf';

interface RadiantConfig {
  apiKey?: string;
  baseUrl: string;
  defaultModel: string;
  outputFormat: 'text' | 'json' | 'table';
}

const config = new Conf<RadiantConfig>({
  projectName: 'radiant-cli',
  defaults: {
    baseUrl: process.env.RADIANT_API_URL || '',
    defaultModel: 'gpt-4o',
    outputFormat: 'text',
  },
});

export function getConfig(): RadiantConfig {
  return {
    apiKey: config.get('apiKey'),
    baseUrl: config.get('baseUrl'),
    defaultModel: config.get('defaultModel'),
    outputFormat: config.get('outputFormat'),
  };
}

export function setConfig<K extends keyof RadiantConfig>(
  key: K,
  value: RadiantConfig[K]
): void {
  config.set(key, value);
}

export function getApiKey(): string | undefined {
  return process.env.RADIANT_API_KEY || config.get('apiKey');
}

export function getBaseUrl(): string {
  return process.env.RADIANT_BASE_URL || config.get('baseUrl');
}

export function requireApiKey(): string {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new ConfigurationError(
      'API key not configured. Run "radiant auth login" or set RADIANT_API_KEY environment variable.'
    );
  }
  return apiKey;
}

// Import at runtime to avoid circular dependency
import { ConfigurationError } from './errors';

export { config };
