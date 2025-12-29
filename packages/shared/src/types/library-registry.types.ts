/**
 * RADIANT v4.18.0 - Open Source Library Registry Types
 * AI capability extensions through open-source tools with proficiency matching
 * 
 * Libraries are NOT AI models - they are tools that extend AI capabilities
 * AI models/modes decide if libraries are helpful for solving problems
 */

import { ProficiencyScores, ProficiencyDimension } from './domain-taxonomy.types';

// ============================================================================
// License Types (Commercially-Free Only)
// ============================================================================

export type AllowedLicense = 
  | 'MIT'
  | 'Apache-2.0'
  | 'BSD-2-Clause'
  | 'BSD-3-Clause'
  | 'PostgreSQL'
  | 'ISC'
  | 'Public-Domain'
  | 'MPL-2.0'
  | 'Unlicense'
  | 'BSD-like';

export type ExcludedLicense = 
  | 'GPL-2.0'
  | 'GPL-3.0'
  | 'AGPL-3.0'
  | 'LGPL'
  | 'SSPL'
  | 'CreativeML'
  | 'Llama-License'
  | 'CC-BY-NC';

// ============================================================================
// Library Categories
// ============================================================================

export type LibraryCategory =
  | 'Data Processing'
  | 'Databases'
  | 'Vector Databases'
  | 'Search'
  | 'ML Frameworks'
  | 'AutoML'
  | 'LLMs'
  | 'LLM Inference'
  | 'LLM Orchestration'
  | 'NLP'
  | 'Computer Vision'
  | 'Speech & Audio'
  | 'Document Processing'
  | 'Image Processing'
  | 'Scientific Computing'
  | 'Statistics & Forecasting'
  | 'API Frameworks'
  | 'Messaging'
  | 'Workflow Orchestration'
  | 'MLOps'
  | 'Medical Imaging'
  | 'Genomics'
  | 'Bioinformatics'
  | 'Chemistry'
  | 'Engineering CFD'
  | 'Robotics'
  | 'Business Intelligence'
  | 'Observability'
  | 'Infrastructure'
  | 'Real-time Communication'
  | 'Formal Methods'
  | 'Optimization';

// ============================================================================
// Domain Mappings (consistent with domain-taxonomy)
// ============================================================================

export type LibraryDomain =
  | 'artificial_intelligence'
  | 'computer_science'
  | 'business'
  | 'sciences'
  | 'engineering'
  | 'medicine_healthcare'
  | 'mathematics'
  | 'humanities'
  | 'law'
  | 'social_sciences'
  | 'arts_design'
  | 'media_communication'
  | 'sports_recreation'
  | 'all';

// ============================================================================
// Library Definition
// ============================================================================

export interface OpenSourceLibrary {
  id: string;
  name: string;
  category: LibraryCategory;
  license: AllowedLicense;
  licenseNote?: string;
  repo: string;
  description: string;
  beats: string[];
  stars: number;
  languages: string[];
  domains: LibraryDomain[];
  proficiencies: ProficiencyScores;
  
  // Runtime state (from database)
  enabled?: boolean;
  version?: string;
  lastUpdated?: string;
  usageCount?: number;
  successRate?: number;
}

// ============================================================================
// Library Registry Metadata
// ============================================================================

export interface LibraryRegistryMetadata {
  version: string;
  generatedAt: string;
  description: string;
  totalTools: number;
  licenseTypesIncluded: AllowedLicense[];
  licenseTypesExcluded: ExcludedLicense[];
  proficiencyScale: {
    min: number;
    max: number;
    description: string;
  };
  proficiencyDimensions: ProficiencyDimension[];
}

// ============================================================================
// Library Registry Configuration (per-tenant)
// ============================================================================

export interface LibraryRegistryConfig {
  configId: string;
  tenantId: string;
  
  // Feature toggles
  libraryAssistEnabled: boolean;
  autoSuggestLibraries: boolean;
  maxLibrariesPerRequest: number;
  
  // Update settings
  autoUpdateEnabled: boolean;
  updateFrequency: 'hourly' | 'daily' | 'weekly' | 'manual';
  updateTimeUtc: string; // HH:MM format
  lastUpdateAt: string | null;
  nextUpdateAt: string | null;
  
  // Proficiency matching
  minProficiencyMatch: number; // 0-1, minimum match score to suggest
  proficiencyWeights: Partial<ProficiencyScores>; // Custom weights per dimension
  
  // Category preferences
  enabledCategories: LibraryCategory[];
  disabledLibraries: string[]; // Library IDs to exclude
  
  // Audit
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Library Match Result
// ============================================================================

export interface LibraryMatchResult {
  library: OpenSourceLibrary;
  matchScore: number; // 0-1, overall match
  proficiencyMatch: number; // 0-1, proficiency alignment
  domainMatch: number; // 0-1, domain relevance
  matchedDimensions: {
    dimension: ProficiencyDimension;
    libraryScore: number;
    requiredScore: number;
    contribution: number;
  }[];
  reason: string; // Human-readable explanation
}

// ============================================================================
// Library Invocation (how AI uses a library)
// ============================================================================

export type LibraryInvocationType = 
  | 'code_generation'    // Generate code using the library
  | 'data_processing'    // Process data through the library
  | 'analysis'           // Analyze with the library
  | 'transformation'     // Transform data/content
  | 'search'             // Search/query operation
  | 'inference'          // ML inference
  | 'optimization'       // Optimization problem
  | 'simulation';        // Simulation/modeling

export interface LibraryInvocationRequest {
  libraryId: string;
  invocationType: LibraryInvocationType;
  input: unknown;
  parameters?: Record<string, unknown>;
  context?: {
    tenantId: string;
    userId: string;
    conversationId?: string;
    requestId: string;
  };
}

export interface LibraryInvocationResult {
  success: boolean;
  libraryId: string;
  invocationType: LibraryInvocationType;
  output?: unknown;
  error?: string;
  executionTimeMs: number;
  metadata?: {
    codeGenerated?: string;
    resourcesUsed?: string[];
    warnings?: string[];
  };
}

// ============================================================================
// Library Usage Tracking
// ============================================================================

export interface LibraryUsageEvent {
  eventId: string;
  tenantId: string;
  userId: string;
  libraryId: string;
  invocationType: LibraryInvocationType;
  success: boolean;
  executionTimeMs: number;
  requestContext?: {
    conversationId?: string;
    requestId?: string;
    promptDomain?: string;
  };
  createdAt: string;
}

export interface LibraryUsageStats {
  libraryId: string;
  totalInvocations: number;
  successfulInvocations: number;
  failedInvocations: number;
  averageExecutionTimeMs: number;
  successRate: number;
  invocationsByType: Record<LibraryInvocationType, number>;
  lastUsedAt: string | null;
}

// ============================================================================
// Library Update Service
// ============================================================================

export interface LibraryUpdateJob {
  jobId: string;
  tenantId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string | null;
  completedAt: string | null;
  librariesChecked: number;
  librariesUpdated: number;
  newLibrariesAdded: number;
  errors: string[];
}

export interface LibraryVersionCheck {
  libraryId: string;
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseNotes?: string;
  breakingChanges?: boolean;
}

// ============================================================================
// Admin Dashboard Types
// ============================================================================

export interface LibraryDashboard {
  config: LibraryRegistryConfig;
  stats: {
    totalLibraries: number;
    enabledLibraries: number;
    totalInvocations: number;
    successRate: number;
    lastUpdateAt: string | null;
  };
  topLibraries: LibraryUsageStats[];
  recentInvocations: LibraryUsageEvent[];
  categoryBreakdown: {
    category: LibraryCategory;
    count: number;
    enabled: number;
  }[];
  updateStatus: LibraryUpdateJob | null;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface SuggestLibrariesRequest {
  prompt: string;
  domain?: LibraryDomain;
  requiredProficiencies?: Partial<ProficiencyScores>;
  categories?: LibraryCategory[];
  maxResults?: number;
}

export interface SuggestLibrariesResponse {
  suggestions: LibraryMatchResult[];
  totalMatched: number;
  processingTimeMs: number;
}

export interface InvokeLibraryRequest extends LibraryInvocationRequest {}

export interface InvokeLibraryResponse extends LibraryInvocationResult {}

// ============================================================================
// Seed Data Structure
// ============================================================================

export interface LibrarySeedData {
  metadata: LibraryRegistryMetadata;
  tools: OpenSourceLibrary[];
}

// ============================================================================
// Constants
// ============================================================================

export const LIBRARY_CATEGORIES: LibraryCategory[] = [
  'Data Processing',
  'Databases',
  'Vector Databases',
  'Search',
  'ML Frameworks',
  'AutoML',
  'LLMs',
  'LLM Inference',
  'LLM Orchestration',
  'NLP',
  'Computer Vision',
  'Speech & Audio',
  'Document Processing',
  'Image Processing',
  'Scientific Computing',
  'Statistics & Forecasting',
  'API Frameworks',
  'Messaging',
  'Workflow Orchestration',
  'MLOps',
  'Medical Imaging',
  'Genomics',
  'Bioinformatics',
  'Chemistry',
  'Engineering CFD',
  'Robotics',
  'Business Intelligence',
  'Observability',
  'Infrastructure',
  'Real-time Communication',
  'Formal Methods',
  'Optimization',
];

export const ALLOWED_LICENSES: AllowedLicense[] = [
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'PostgreSQL',
  'ISC',
  'Public-Domain',
  'MPL-2.0',
  'Unlicense',
  'BSD-like',
];

export const LIBRARY_DOMAINS: LibraryDomain[] = [
  'artificial_intelligence',
  'computer_science',
  'business',
  'sciences',
  'engineering',
  'medicine_healthcare',
  'mathematics',
  'humanities',
  'law',
  'social_sciences',
  'arts_design',
  'media_communication',
  'sports_recreation',
  'all',
];

export const DEFAULT_LIBRARY_CONFIG: Omit<LibraryRegistryConfig, 'configId' | 'tenantId' | 'createdAt' | 'updatedAt'> = {
  libraryAssistEnabled: true,
  autoSuggestLibraries: true,
  maxLibrariesPerRequest: 5,
  autoUpdateEnabled: true,
  updateFrequency: 'daily',
  updateTimeUtc: '03:00',
  lastUpdateAt: null,
  nextUpdateAt: null,
  minProficiencyMatch: 0.5,
  proficiencyWeights: {},
  enabledCategories: LIBRARY_CATEGORIES,
  disabledLibraries: [],
};
