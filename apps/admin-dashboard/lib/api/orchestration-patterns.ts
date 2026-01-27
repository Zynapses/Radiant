/**
 * RADIANT Admin Dashboard - Orchestration Patterns API
 * Fetches patterns, workflows, and categories from the backend
 */

import { apiClient } from './client';

// ============================================================================
// Types
// ============================================================================

export interface PatternCategory {
  code: string;
  name: string;
  count: number;
  color: string;
  description?: string;
}

export interface OrchestrationPattern {
  id: string;
  code: string;
  common: string;
  formal: string;
  category: string;
  num: number;
  latency: 'low' | 'medium' | 'high' | 'very_high' | 'variable';
  cost: 'low' | 'medium' | 'high' | 'very_high';
  models: number;
  improvement: string;
  description?: string;
  bestFor?: string[];
  isEnabled?: boolean;
}

export interface OrchestrationMethod {
  code: string;
  name: string;
  category: string;
  role: string;
  description?: string;
}

export interface WorkflowCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  workflowCount: number;
}

export interface Workflow {
  id: string;
  code: string;
  commonName: string;
  formalName: string;
  category: string;
  description?: string;
  qualityImprovement?: string;
  typicalLatency?: string;
  typicalCost?: string;
  minModelsRequired?: number;
  isEnabled?: boolean;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get all pattern categories
 */
export async function getPatternCategories(): Promise<PatternCategory[]> {
  const response = await apiClient.get<{ data: { categories: PatternCategory[] } }>('/api/orchestration/pattern-categories');
  return response.data.categories;
}

/**
 * Get all workflow categories
 */
export async function getWorkflowCategories(): Promise<WorkflowCategory[]> {
  const response = await apiClient.get<{ data: { categories: WorkflowCategory[] } }>('/api/orchestration/workflow-categories');
  return response.data.categories;
}

/**
 * Get patterns by category
 */
export async function getPatternsByCategory(categoryId: string): Promise<OrchestrationPattern[]> {
  const response = await apiClient.get<{ data: { patterns: OrchestrationPattern[] } }>(`/api/orchestration/patterns/${categoryId}`);
  return response.data.patterns;
}

/**
 * Get all patterns
 */
export async function getAllPatterns(): Promise<OrchestrationPattern[]> {
  const categories = await getPatternCategories();
  const allPatterns: OrchestrationPattern[] = [];
  
  for (const category of categories) {
    const patterns = await getPatternsByCategory(category.code);
    allPatterns.push(...patterns);
  }
  
  return allPatterns.sort((a, b) => a.num - b.num);
}

/**
 * Get workflows by category
 */
export async function getWorkflowsByCategory(categoryId: string): Promise<Workflow[]> {
  const response = await apiClient.get<{ data: { workflows: Workflow[] } }>(`/api/orchestration/workflows/${categoryId}`);
  return response.data.workflows;
}

/**
 * Find matching patterns for a query
 */
export async function matchPatterns(
  query: string,
  limit: number = 5,
  minSimilarity: number = 0.7
): Promise<OrchestrationPattern[]> {
  const response = await apiClient.post<{ data: { patterns: OrchestrationPattern[] } }>('/api/orchestration/match-patterns', {
    query,
    limit,
    minSimilarity,
  });
  return response.data.patterns;
}

/**
 * Find matching workflows for a query
 */
export async function matchWorkflows(
  query: string,
  limit: number = 5,
  minSimilarity: number = 0.7
): Promise<Workflow[]> {
  const response = await apiClient.post<{ data: { workflows: Workflow[] } }>('/api/orchestration/match-workflows', {
    query,
    limit,
    minSimilarity,
  });
  return response.data.workflows;
}

/**
 * Record pattern usage
 */
export async function recordPatternUsage(
  patternId: string,
  satisfactionScore?: number
): Promise<void> {
  await apiClient.post('/api/orchestration/record-pattern-usage', {
    patternId,
    satisfactionScore,
  });
}

/**
 * Record workflow usage
 */
export async function recordWorkflowUsage(
  workflowId: string,
  qualityScore?: number
): Promise<void> {
  await apiClient.post('/api/orchestration/record-workflow-usage', {
    workflowId,
    qualityScore,
  });
}

/**
 * Get orchestration methods
 */
export async function getOrchestrationMethods(): Promise<OrchestrationMethod[]> {
  const response = await apiClient.get<{ data: { methods: OrchestrationMethod[] } }>('/api/admin/orchestration/methods');
  return response.data.methods;
}
