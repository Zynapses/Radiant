/**
 * Perception Service - Unified computer vision pipeline
 */

import { MidLevelServiceConfig } from './index';

export const PERCEPTION_SERVICE: MidLevelServiceConfig = {
  id: 'perception',
  name: 'perception',
  displayName: 'Perception Service',
  description: 'Unified computer vision pipeline for detection, segmentation, and classification',
  requiredModels: ['yolov8m', 'mobilesam'],
  optionalModels: ['yolov8x', 'yolov11x', 'sam-vit-h', 'sam2', 'clip-vit-l14', 'grounding-dino', 'efficientnetv2-l'],
  defaultState: 'DISABLED',
  gracefulDegradation: true,
  pricing: { perImage: 0.02, perMinuteVideo: 0.50, markup: 0.40 },
  minTier: 3,
  endpoints: [
    {
      path: '/perception/detect',
      method: 'POST',
      description: 'Detect objects in images',
      requiredModels: ['yolov8m'],
      inputFormats: ['image/jpeg', 'image/png'],
      outputFormats: ['application/json'],
    },
    {
      path: '/perception/segment',
      method: 'POST',
      description: 'Segment objects or regions',
      requiredModels: ['mobilesam'],
      inputFormats: ['image/jpeg', 'image/png'],
      outputFormats: ['application/json', 'image/png'],
    },
    {
      path: '/perception/classify',
      method: 'POST',
      description: 'Classify images',
      requiredModels: ['efficientnetv2-l'],
      inputFormats: ['image/jpeg', 'image/png'],
      outputFormats: ['application/json'],
    },
    {
      path: '/perception/analyze',
      method: 'POST',
      description: 'Full perception pipeline',
      requiredModels: ['yolov8m', 'mobilesam'],
      inputFormats: ['image/jpeg', 'image/png'],
      outputFormats: ['application/json'],
    },
    {
      path: '/perception/detect/text',
      method: 'POST',
      description: 'Text-prompted object detection',
      requiredModels: ['grounding-dino'],
      inputFormats: ['image/jpeg', 'image/png'],
      outputFormats: ['application/json'],
    },
    {
      path: '/perception/video/track',
      method: 'POST',
      description: 'Object tracking in video',
      requiredModels: ['yolov8m', 'sam2'],
      inputFormats: ['video/mp4'],
      outputFormats: ['application/json', 'video/mp4'],
    },
  ],
};
