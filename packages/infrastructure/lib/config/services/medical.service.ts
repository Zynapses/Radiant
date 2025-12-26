/**
 * Medical Imaging Service - HIPAA-compliant medical analysis
 */

import { MidLevelServiceConfig } from './index';

export const MEDICAL_SERVICE: MidLevelServiceConfig = {
  id: 'medical',
  name: 'medical',
  displayName: 'Medical Imaging Service',
  description: 'HIPAA-compliant medical image segmentation and analysis',
  requiredModels: ['medsam'],
  optionalModels: ['nnunet', 'whisper-large-v3'],
  defaultState: 'DISABLED',
  gracefulDegradation: true,
  pricing: { perImage: 0.15, perMinuteAudio: 0.08, markup: 0.40 },
  minTier: 4,
  endpoints: [
    {
      path: '/medical/segment',
      method: 'POST',
      description: 'Segment anatomical structures',
      requiredModels: ['medsam'],
      inputFormats: ['application/dicom', 'application/nifti'],
      outputFormats: ['application/nifti', 'application/json'],
    },
    {
      path: '/medical/segment/3d',
      method: 'POST',
      description: 'Volumetric 3D segmentation',
      requiredModels: ['nnunet'],
      inputFormats: ['application/dicom', 'application/nifti'],
      outputFormats: ['application/nifti'],
    },
    {
      path: '/medical/segment/interactive',
      method: 'POST',
      description: 'Interactive point-based segmentation',
      requiredModels: ['medsam'],
      inputFormats: ['application/dicom', 'image/png'],
      outputFormats: ['image/png', 'application/json'],
    },
    {
      path: '/medical/transcribe',
      method: 'POST',
      description: 'Transcribe medical dictation',
      requiredModels: ['whisper-large-v3'],
      inputFormats: ['audio/wav'],
      outputFormats: ['application/json'],
    },
    {
      path: '/medical/analyze',
      method: 'POST',
      description: 'Full medical image analysis',
      requiredModels: ['medsam'],
      inputFormats: ['application/dicom'],
      outputFormats: ['application/json'],
    },
  ],
};
