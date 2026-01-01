/**
 * RADIANT v4.18.0 - Model Services Barrel Export
 * 
 * AI model routing, selection, and management services.
 */

// Model Routing
export { ModelRouterService, modelRouterService } from '../model-router.service';
export { BrainRouter, brainRouter, type TaskType } from '../cognitive-router.service';
export { ModelSelectionService, modelSelectionService } from '../model-selection-service';

// Model Registry
export { UnifiedModelRegistry, unifiedModelRegistry } from '../unified-model-registry';
export { ModelMetadataService, modelMetadataService } from '../model-metadata.service';
export { ProviderRegistry, providerRegistry } from '../provider-registry';

// ML & Training
export { MLTrainingService, mlTrainingService } from '../ml-training.service';
export { ReasoningEngine, reasoningEngine } from '../reasoning-engine';
export { PreferenceEngine, preferenceEngine } from '../preference-engine.service';
// Backward compatibility aliases
export { PreferenceEngine as NeuralEngine, preferenceEngine as neuralEngine } from '../preference-engine.service';
export { NeuralOrchestrationService, neuralOrchestrationService } from '../neural-orchestration';

// Thermal Management
export { ThermalStateService, thermalStateService, type ThermalState } from '../thermal-state';
