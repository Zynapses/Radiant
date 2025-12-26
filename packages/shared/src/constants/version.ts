/**
 * RADIANT Version Constants
 * SINGLE SOURCE OF TRUTH for version numbers
 */

export const RADIANT_VERSION = '4.18.0';

export const VERSION = {
  major: 4,
  minor: 18,
  patch: 0,
  full: '4.18.0',
  build: process.env.BUILD_NUMBER || 'local',
  date: '2024-12',
} as const;

export const MIN_VERSIONS = {
  node: '20.0.0',
  npm: '10.0.0',
  cdk: '2.120.0',
  postgres: '15.0',
  swift: '5.9',
  macos: '13.0',
  xcode: '15.0',
} as const;

export const DOMAIN_PLACEHOLDER = 'YOUR_DOMAIN.com';

export function isDomainConfigured(domain: string): boolean {
  return !domain.includes(DOMAIN_PLACEHOLDER);
}
