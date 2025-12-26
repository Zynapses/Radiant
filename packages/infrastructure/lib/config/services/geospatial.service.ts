/**
 * Geospatial Analysis Service - Satellite imagery analysis
 */

import { MidLevelServiceConfig } from './index';

export const GEOSPATIAL_SERVICE: MidLevelServiceConfig = {
  id: 'geospatial',
  name: 'geospatial',
  displayName: 'Geospatial Analysis Service',
  description: 'Satellite imagery analysis for land use, flood detection, and crop mapping',
  requiredModels: ['prithvi-100m'],
  optionalModels: ['prithvi-600m', 'mobilesam'],
  defaultState: 'DISABLED',
  gracefulDegradation: true,
  pricing: { perImage: 0.08, markup: 0.40 },
  minTier: 4,
  endpoints: [
    {
      path: '/geospatial/classify',
      method: 'POST',
      description: 'Classify land use',
      requiredModels: ['prithvi-100m'],
      inputFormats: ['image/geotiff'],
      outputFormats: ['application/json'],
    },
    {
      path: '/geospatial/detect/floods',
      method: 'POST',
      description: 'Detect flood extent',
      requiredModels: ['prithvi-100m'],
      inputFormats: ['image/geotiff'],
      outputFormats: ['application/json'],
    },
    {
      path: '/geospatial/change',
      method: 'POST',
      description: 'Detect changes between images',
      requiredModels: ['prithvi-600m'],
      inputFormats: ['image/geotiff'],
      outputFormats: ['application/json'],
    },
    {
      path: '/geospatial/segment',
      method: 'POST',
      description: 'Segment regions in satellite imagery',
      requiredModels: ['prithvi-100m', 'mobilesam'],
      inputFormats: ['image/geotiff'],
      outputFormats: ['application/json', 'image/geotiff'],
    },
    {
      path: '/geospatial/crops',
      method: 'POST',
      description: 'Crop type classification',
      requiredModels: ['prithvi-100m'],
      inputFormats: ['image/geotiff'],
      outputFormats: ['application/json'],
    },
  ],
};
