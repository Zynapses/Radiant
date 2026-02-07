/**
 * RADIANT v4.18.0 - AWS Region Configuration
 * SINGLE SOURCE OF TRUTH
 */

import type { RegionConfig } from '../types';

export const REGIONS: Record<string, RegionConfig> = {
  'us-east-1': { code: 'us-east-1', name: 'US East (N. Virginia)', available: true, isGlobal: true },
  'us-west-2': { code: 'us-west-2', name: 'US West (Oregon)', available: true, isGlobal: false },
  'eu-west-1': { code: 'eu-west-1', name: 'Europe (Ireland)', available: true, isGlobal: true },
  'eu-central-1': { code: 'eu-central-1', name: 'Europe (Frankfurt)', available: true, isGlobal: false },
  'ap-northeast-1': { code: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)', available: true, isGlobal: true },
  'ap-southeast-1': { code: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', available: true, isGlobal: false },
  'ap-south-1': { code: 'ap-south-1', name: 'Asia Pacific (Mumbai)', available: true, isGlobal: false },
};

export const PRIMARY_REGION = 'us-east-1';

export const MULTI_REGION_CONFIG = {
  primary: 'us-east-1',
  europe: 'eu-west-1',
  asia: 'ap-northeast-1',
} as const;

export function getMultiRegionDeployment(primaryRegion: string): string[] {
  if (primaryRegion === 'us-east-1') {
    return ['us-east-1', 'eu-west-1', 'ap-northeast-1'];
  }
  if (primaryRegion.startsWith('eu-')) {
    return ['eu-west-1', 'us-east-1', 'ap-northeast-1'];
  }
  if (primaryRegion.startsWith('ap-')) {
    return ['ap-northeast-1', 'us-east-1', 'eu-west-1'];
  }
  return [primaryRegion];
}

export function isValidRegion(region: string): boolean {
  return region in REGIONS;
}

export function getAvailableRegions(): RegionConfig[] {
  return Object.values(REGIONS).filter(r => r.available);
}

export function getGlobalRegions(): RegionConfig[] {
  return Object.values(REGIONS).filter(r => r.isGlobal);
}

// =============================================================================
// Datacenter Groupings for Health Monitoring
// =============================================================================

export interface DatacenterGroup {
  id: string;
  name: string;
  displayName: string;
  regions: string[];
  primaryRegion: string;
}

export const DATACENTER_GROUPS: DatacenterGroup[] = [
  {
    id: 'americas',
    name: 'Americas',
    displayName: 'Americas (US)',
    regions: ['us-east-1', 'us-west-2'],
    primaryRegion: 'us-east-1',
  },
  {
    id: 'europe',
    name: 'Europe',
    displayName: 'Europe (EU)',
    regions: ['eu-west-1', 'eu-central-1'],
    primaryRegion: 'eu-west-1',
  },
  {
    id: 'asia',
    name: 'Asia Pacific',
    displayName: 'Asia Pacific',
    regions: ['ap-northeast-1', 'ap-southeast-1', 'ap-south-1'],
    primaryRegion: 'ap-northeast-1',
  },
];

export function getDatacenterForRegion(region: string): DatacenterGroup | undefined {
  return DATACENTER_GROUPS.find(dc => dc.regions.includes(region));
}

export function getDatacenterById(id: string): DatacenterGroup | undefined {
  return DATACENTER_GROUPS.find(dc => dc.id === id);
}
