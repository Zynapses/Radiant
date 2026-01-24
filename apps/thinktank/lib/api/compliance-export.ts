/**
 * RADIANT v5.52.15 - Compliance Export API Client
 * 
 * Client-side functions for generating Decision Records and compliance exports.
 */

import { api } from './client';

export type ExportFormat = 'decision_record' | 'hipaa_audit' | 'soc2_evidence' | 'gdpr_dsar' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  redactPhi?: boolean;
  title?: string;
}

export interface ExportResult {
  success: boolean;
  artifactId?: string;
  downloadUrl?: string;
  error?: string;
}

export interface DecisionArtifactSummary {
  id: string;
  conversationId: string;
  title: string;
  status: 'active' | 'frozen' | 'archived' | 'invalidated';
  validationStatus: 'fresh' | 'stale' | 'verified' | 'invalidated';
  version: number;
  phiDetected: boolean;
  piiDetected: boolean;
  primaryDomain?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Export a conversation as a Decision Record or compliance format
 */
export async function exportConversation(
  conversationId: string,
  options: ExportOptions
): Promise<ExportResult> {
  try {
    const response = await api.post<ExportResult>(
      `/api/conversations/${conversationId}/export`,
      {
        format: options.format,
        redactPhi: options.redactPhi ?? true,
        title: options.title,
      }
    );

    return response;
  } catch (error) {
    console.error('Export failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    };
  }
}

/**
 * Get existing Decision Records for a conversation
 */
export async function getConversationArtifacts(
  conversationId: string
): Promise<DecisionArtifactSummary[]> {
  try {
    const response = await api.get<{ success: boolean; artifacts: DecisionArtifactSummary[] }>(
      `/api/conversations/${conversationId}/export`
    );
    return response.artifacts || [];
  } catch (error) {
    console.error('Failed to fetch artifacts:', error);
    return [];
  }
}

/**
 * Format names for display
 */
export const FORMAT_LABELS: Record<ExportFormat, string> = {
  decision_record: 'Decision Record',
  hipaa_audit: 'HIPAA Audit Package',
  soc2_evidence: 'SOC2 Evidence Bundle',
  gdpr_dsar: 'GDPR DSAR Response',
  pdf: 'PDF Export',
};

/**
 * Format descriptions
 */
export const FORMAT_DESCRIPTIONS: Record<ExportFormat, string> = {
  decision_record: 'Generate a Decision Intelligence Artifact with claims, evidence, and dissent',
  hipaa_audit: 'Export for HIPAA compliance audits with PHI redaction',
  soc2_evidence: 'Export for SOC2 Type II evidence collection',
  gdpr_dsar: 'Export for GDPR Data Subject Access Requests',
  pdf: 'Standard PDF export of the conversation',
};
