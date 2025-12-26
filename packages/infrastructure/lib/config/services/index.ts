/**
 * Mid-Level Service Definitions
 * Services that orchestrate multiple AI models for domain-specific tasks
 */

export * from './perception.service';
export * from './scientific.service';
export * from './medical.service';
export * from './geospatial.service';
export * from './reconstruction.service';

export type ServiceState = 'RUNNING' | 'DEGRADED' | 'DISABLED' | 'OFFLINE';

export interface MidLevelServiceConfig {
  id: string;
  name: string;
  displayName: string;
  description: string;
  requiredModels: string[];
  optionalModels: string[];
  defaultState: ServiceState;
  gracefulDegradation: boolean;
  pricing: ServicePricing;
  minTier: number;
  endpoints: ServiceEndpoint[];
}

export interface ServicePricing {
  perRequest?: number;
  perMinuteAudio?: number;
  perMinuteVideo?: number;
  perImage?: number;
  per3DModel?: number;
  markup: number;
}

export interface ServiceEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  description: string;
  requiredModels: string[];
  inputFormats: string[];
  outputFormats: string[];
}

export const SERVICE_STATE_COLORS: Record<ServiceState, string> = {
  RUNNING: '#22c55e',    // green
  DEGRADED: '#f59e0b',   // yellow
  DISABLED: '#6b7280',   // gray
  OFFLINE: '#ef4444',    // red
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getAllServices(): MidLevelServiceConfig[] {
  const { PERCEPTION_SERVICE } = require('./perception.service');
  const { SCIENTIFIC_SERVICE } = require('./scientific.service');
  const { MEDICAL_SERVICE } = require('./medical.service');
  const { GEOSPATIAL_SERVICE } = require('./geospatial.service');
  const { RECONSTRUCTION_SERVICE } = require('./reconstruction.service');
  
  return [
    PERCEPTION_SERVICE,
    SCIENTIFIC_SERVICE,
    MEDICAL_SERVICE,
    GEOSPATIAL_SERVICE,
    RECONSTRUCTION_SERVICE,
  ];
}

export function getServiceById(id: string): MidLevelServiceConfig | undefined {
  return getAllServices().find(s => s.id === id);
}

export function getServicesByTier(tier: number): MidLevelServiceConfig[] {
  return getAllServices().filter(s => s.minTier <= tier);
}
