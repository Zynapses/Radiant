/**
 * Medical Imaging Models - HIPAA-compliant medical image analysis
 */

import { SageMakerModelConfig } from './index';

export const MEDICAL_MODELS: SageMakerModelConfig[] = [
  {
    id: 'nnunet',
    name: 'nnunet',
    displayName: 'nnU-Net',
    description: 'Self-configuring medical image segmentation',
    category: 'medical_imaging',
    specialty: 'medical_segmentation',
    image: 'pytorch-inference:2.1-gpu-py310-cu121-ubuntu22.04',
    instanceType: 'ml.g5.2xlarge',
    environment: { MODEL_NAME: 'nnunet', NNUNET_DATASET: 'generic' },
    parameters: 31_000_000,
    accuracy: 'State-of-the-art on 23/23 Medical Segmentation Decathlon tasks',
    capabilities: ['medical_segmentation', 'tumor_detection', 'organ_segmentation', '3d_imaging'],
    inputFormats: ['application/dicom', 'application/nifti', 'image/png'],
    outputFormats: ['application/nifti', 'application/json', 'image/png'],
    thermal: { defaultState: 'OFF', scaleToZeroAfterMinutes: 10, warmupTimeSeconds: 120, minInstances: 0, maxInstances: 2 },
    license: 'Apache-2.0',
    commercialUseNotes: 'HIPAA compliant when deployed in compliant AWS environment',
    pricing: { hourlyRate: 2.66, perImage: 0.10, markup: 0.75 },
    minTier: 4, requiresGPU: true, gpuMemoryGB: 16, status: 'active',
  },
  {
    id: 'medsam',
    name: 'medsam',
    displayName: 'MedSAM',
    description: 'Segment Anything Model fine-tuned for medical images',
    category: 'medical_imaging',
    specialty: 'medical_segmentation',
    image: 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04',
    instanceType: 'ml.g5.2xlarge',
    environment: { HF_MODEL_ID: 'wanglab/medsam-vit-base', HF_TASK: 'mask-generation' },
    parameters: 93_000_000,
    capabilities: ['medical_segmentation', 'interactive', 'multi_modality'],
    inputFormats: ['application/dicom', 'application/nifti', 'image/png', 'image/jpeg'],
    outputFormats: ['application/json', 'image/png'],
    thermal: { defaultState: 'OFF', scaleToZeroAfterMinutes: 10, warmupTimeSeconds: 90, minInstances: 0, maxInstances: 2 },
    license: 'Apache-2.0',
    commercialUseNotes: 'HIPAA compliant when deployed in compliant AWS environment',
    pricing: { hourlyRate: 2.66, perImage: 0.08, markup: 0.75 },
    minTier: 4, requiresGPU: true, gpuMemoryGB: 12, status: 'active',
  },
];
