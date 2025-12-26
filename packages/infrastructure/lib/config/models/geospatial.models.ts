/**
 * Geospatial Analysis Models - Satellite imagery and earth observation
 */

import { SageMakerModelConfig } from './index';

export const GEOSPATIAL_MODELS: SageMakerModelConfig[] = [
  {
    id: 'prithvi-100m',
    name: 'prithvi-100m',
    displayName: 'Prithvi 100M',
    description: 'NASA/IBM geospatial foundation model (100M parameters)',
    category: 'geospatial',
    specialty: 'satellite_analysis',
    image: 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04',
    instanceType: 'ml.g5.xlarge',
    environment: { HF_MODEL_ID: 'ibm-nasa-geospatial/Prithvi-100M' },
    parameters: 100_000_000,
    capabilities: ['satellite_analysis', 'land_use', 'flood_detection', 'crop_mapping'],
    inputFormats: ['image/tiff', 'image/geotiff', 'image/png'],
    outputFormats: ['application/json', 'image/geotiff'],
    thermal: { defaultState: 'OFF', scaleToZeroAfterMinutes: 10, warmupTimeSeconds: 90, minInstances: 0, maxInstances: 2 },
    license: 'Apache-2.0',
    pricing: { hourlyRate: 2.47, perImage: 0.05, markup: 0.75 },
    minTier: 4, requiresGPU: true, gpuMemoryGB: 10, status: 'active',
  },
  {
    id: 'prithvi-600m',
    name: 'prithvi-600m',
    displayName: 'Prithvi 600M',
    description: 'NASA/IBM geospatial foundation model (600M parameters)',
    category: 'geospatial',
    specialty: 'satellite_analysis',
    image: 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04',
    instanceType: 'ml.g5.4xlarge',
    environment: { HF_MODEL_ID: 'ibm-nasa-geospatial/Prithvi-EO-2.0-600M' },
    parameters: 600_000_000,
    capabilities: ['satellite_analysis', 'land_use', 'flood_detection', 'crop_mapping', 'change_detection'],
    inputFormats: ['image/tiff', 'image/geotiff', 'image/png'],
    outputFormats: ['application/json', 'image/geotiff'],
    thermal: { defaultState: 'OFF', scaleToZeroAfterMinutes: 10, warmupTimeSeconds: 120, minInstances: 0, maxInstances: 2 },
    license: 'Apache-2.0',
    pricing: { hourlyRate: 3.55, perImage: 0.10, markup: 0.75 },
    minTier: 4, requiresGPU: true, gpuMemoryGB: 20, status: 'active',
  },
];
