/**
 * RADIANT v4.18.0 - AI/Model Types
 * SINGLE SOURCE OF TRUTH
 */
export interface AIProvider {
    id: string;
    name: string;
    apiKeyEnvVar: string;
    baseUrl: string;
    hipaaCompliant: boolean;
    capabilities: ProviderCapability[];
    status: ProviderStatus;
    models?: AIModel[];
}
export type ProviderCapability = 'text_generation' | 'chat_completion' | 'embeddings' | 'image_generation' | 'image_analysis' | 'video_generation' | 'audio_transcription' | 'audio_generation' | 'code_generation' | 'reasoning' | 'search' | 'function_calling' | '3d_generation';
export type ProviderStatus = 'active' | 'degraded' | 'maintenance' | 'disabled';
export interface AIModel {
    id: string;
    providerId: string;
    name: string;
    displayName: string;
    description?: string;
    specialty: ModelSpecialty;
    category: ModelCategory;
    capabilities: ProviderCapability[];
    contextWindow: number;
    maxOutputTokens: number;
    pricing: ModelPricing;
    status: ModelStatus;
    isHosted: boolean;
    thermalState?: ThermalState;
    sagemakerEndpoint?: string;
    metadata?: Record<string, unknown>;
}
export type ModelSpecialty = 'text_generation' | 'reasoning' | 'coding' | 'image_generation' | 'image_analysis' | 'video_generation' | 'audio_transcription' | 'audio_generation' | 'embeddings' | 'search' | '3d_generation' | 'scientific';
export type ModelCategory = 'llm' | 'vision' | 'audio' | 'multimodal' | 'embedding' | 'specialized';
export type ModelStatus = 'active' | 'disabled' | 'deprecated' | 'coming_soon';
export interface ModelPricing {
    inputPricePerMillion: number;
    outputPricePerMillion: number;
    imagePrice?: number;
    audioMinutePrice?: number;
    currency: 'USD';
}
export type ThermalState = 'OFF' | 'COLD' | 'WARM' | 'HOT' | 'AUTOMATIC';
export interface ThermalConfig {
    modelId: string;
    state: ThermalState;
    targetState?: ThermalState;
    lastStateChange?: Date;
    coldStartTime: number;
    warmupTime: number;
    idleTimeout: number;
    minInstances: number;
    maxInstances: number;
}
export type ServiceState = 'RUNNING' | 'DEGRADED' | 'DISABLED' | 'OFFLINE';
export interface MidLevelService {
    id: string;
    name: string;
    description: string;
    state: ServiceState;
    dependencies: string[];
    healthEndpoint: string;
    lastHealthCheck?: Date;
    metrics?: ServiceMetrics;
}
export interface ServiceMetrics {
    requestsPerMinute: number;
    averageLatencyMs: number;
    errorRate: number;
    lastUpdated: Date;
}
//# sourceMappingURL=ai.types.d.ts.map