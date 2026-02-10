// RADIANT Autonomous Organism - Service Index
// Central export for all organism services
// Version: 1.0.0

export { mcpServerManager, MCPServerManagerService, MCPServerConfig } from './mcp-server-manager.service';
export { neuralSchemaRegistry, NeuralSchemaRegistryService, ToolSchema } from './neural-schema-registry.service';
export { toolForge, ToolForgeService } from './genesis-auto-tool.service';
export { liquidCompute, LiquidComputeService } from './liquid-compute.service';
export { ghostSimulation, GhostSimulationService } from './ghost-simulation.service';
export { tensorLink, TensorLinkService } from './tensor-link.service';
export { economicCortex, EconomicCortexService } from './economic-cortex.service';
export { organismIntegration, OrganismIntegrationService } from './organism-integration.service';

// Types are defined locally in each service to avoid import path issues
// See autonomous-organism.types.ts in packages/shared/src/types/ for full type definitions
