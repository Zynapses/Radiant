// RADIANT v4.18.0 - Experiment Types
// Type definitions for A/B testing framework

export interface Experiment {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  hypothesis: string | null;
  variants: ExperimentVariant[];
  targetAudience: ExperimentTargetAudience;
  metrics: string[];
  status: ExperimentStatus;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';

export interface ExperimentVariant {
  id: string;
  name: string;
  weight: number;
  config: Record<string, unknown>;
}

export interface ExperimentTargetAudience {
  percentage: number;
  filters?: Record<string, unknown>;
}

export interface ExperimentAssignment {
  id: string;
  experimentId: string;
  userId: string;
  variantId: string;
  assignedAt: Date;
}

export interface ExperimentMetric {
  id: string;
  experimentId: string;
  variantId: string;
  userId: string;
  metricName: string;
  value: number;
  createdAt: Date;
}

export interface ExperimentResult {
  variantId: string;
  isSignificant: boolean;
  pValue: number;
  confidenceLevel: number;
  uplift: number;
  controlMean: number;
  treatmentMean: number;
  sampleSize: number;
  recommendation: string;
}

export interface ExperimentStats {
  totalExperiments: number;
  runningExperiments: number;
  completedExperiments: number;
  averageUplift: number;
}
