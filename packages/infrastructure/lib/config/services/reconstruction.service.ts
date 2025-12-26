/**
 * 3D Reconstruction Service - NeRF and 3D Gaussian Splatting
 */

import { MidLevelServiceConfig } from './index';

export const RECONSTRUCTION_SERVICE: MidLevelServiceConfig = {
  id: 'reconstruction',
  name: 'reconstruction',
  displayName: '3D Reconstruction Service',
  description: 'Generate 3D models from images and videos using neural radiance fields',
  requiredModels: ['nerfstudio'],
  optionalModels: ['3d-gaussian-splatting'],
  defaultState: 'DISABLED',
  gracefulDegradation: true,
  pricing: { per3DModel: 8.00, markup: 0.40 },
  minTier: 4,
  endpoints: [
    {
      path: '/reconstruction/nerf',
      method: 'POST',
      description: 'Create 3D model using NeRF',
      requiredModels: ['nerfstudio'],
      inputFormats: ['video/mp4', 'image/jpeg'],
      outputFormats: ['model/gltf+json', 'model/obj'],
    },
    {
      path: '/reconstruction/gaussian',
      method: 'POST',
      description: 'Fast 3D using Gaussian splatting',
      requiredModels: ['3d-gaussian-splatting'],
      inputFormats: ['video/mp4'],
      outputFormats: ['model/ply'],
    },
    {
      path: '/reconstruction/render',
      method: 'POST',
      description: 'Render novel views',
      requiredModels: ['nerfstudio'],
      inputFormats: ['application/json'],
      outputFormats: ['image/png', 'video/mp4'],
    },
    {
      path: '/reconstruction/export',
      method: 'POST',
      description: 'Export 3D model in various formats',
      requiredModels: ['nerfstudio'],
      inputFormats: ['application/json'],
      outputFormats: ['model/gltf+json', 'model/obj', 'model/ply'],
    },
    {
      path: '/reconstruction/status',
      method: 'GET',
      description: 'Check reconstruction job status',
      requiredModels: [],
      inputFormats: [],
      outputFormats: ['application/json'],
    },
  ],
};
