/**
 * RADIANT v4.18.0 - AI Provider Configuration
 * SINGLE SOURCE OF TRUTH
 */
import type { AIProvider } from '../types';
export declare const AI_PROVIDERS: AIProvider[];
export declare function getProviderById(id: string): AIProvider | undefined;
export declare function getHipaaCompliantProviders(): AIProvider[];
export declare function getActiveProviders(): AIProvider[];
//# sourceMappingURL=providers.d.ts.map