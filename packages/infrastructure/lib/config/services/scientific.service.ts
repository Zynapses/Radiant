/**
 * Scientific Computing Service - Protein analysis and math reasoning
 */

import { MidLevelServiceConfig } from './index';

export const SCIENTIFIC_SERVICE: MidLevelServiceConfig = {
  id: 'scientific',
  name: 'scientific',
  displayName: 'Scientific Computing Service',
  description: 'Protein folding, embeddings, and computational biology pipelines',
  requiredModels: ['esm2-3b'],
  optionalModels: ['alphafold2', 'alphageometry', 'protenix'],
  defaultState: 'DISABLED',
  gracefulDegradation: true,
  pricing: { perRequest: 0.50, markup: 0.40 },
  minTier: 4,
  endpoints: [
    {
      path: '/scientific/protein/embed',
      method: 'POST',
      description: 'Generate protein embeddings',
      requiredModels: ['esm2-3b'],
      inputFormats: ['text/fasta'],
      outputFormats: ['application/json'],
    },
    {
      path: '/scientific/protein/fold',
      method: 'POST',
      description: 'Predict protein 3D structure',
      requiredModels: ['alphafold2'],
      inputFormats: ['text/fasta'],
      outputFormats: ['application/pdb', 'application/mmcif'],
    },
    {
      path: '/scientific/protein/fold-multi',
      method: 'POST',
      description: 'Predict multi-chain protein structure',
      requiredModels: ['protenix'],
      inputFormats: ['text/fasta', 'application/json'],
      outputFormats: ['application/pdb', 'application/mmcif'],
    },
    {
      path: '/scientific/geometry/solve',
      method: 'POST',
      description: 'Solve geometry problems',
      requiredModels: ['alphageometry'],
      inputFormats: ['application/json'],
      outputFormats: ['application/json'],
    },
    {
      path: '/scientific/protein/analyze',
      method: 'POST',
      description: 'Full protein analysis pipeline',
      requiredModels: ['esm2-3b'],
      inputFormats: ['text/fasta'],
      outputFormats: ['application/json'],
    },
  ],
};
