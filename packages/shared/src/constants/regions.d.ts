/**
 * RADIANT v4.18.0 - AWS Region Configuration
 * SINGLE SOURCE OF TRUTH
 */
import type { RegionConfig } from '../types';
export declare const REGIONS: Record<string, RegionConfig>;
export declare const PRIMARY_REGION = "us-east-1";
export declare const MULTI_REGION_CONFIG: {
    readonly primary: "us-east-1";
    readonly europe: "eu-west-1";
    readonly asia: "ap-northeast-1";
};
export declare function getMultiRegionDeployment(primaryRegion: string): string[];
export declare function isValidRegion(region: string): boolean;
export declare function getAvailableRegions(): RegionConfig[];
export declare function getGlobalRegions(): RegionConfig[];
//# sourceMappingURL=regions.d.ts.map