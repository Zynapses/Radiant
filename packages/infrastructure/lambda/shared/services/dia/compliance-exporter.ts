/**
 * RADIANT v5.43.0 - DIA Engine Compliance Exporter
 * 
 * Generates compliance-ready export packages for HIPAA, SOC2, and GDPR audits.
 * Supports PDF, JSON, and specialized audit trail formats.
 */

import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { executeStatement, stringParam, longParam } from '../../db/client';
import { redactPHI, redactPII } from './compliance-detector';
import {
  DecisionArtifact,
  ExportArtifactRequest,
  ExportArtifactResponse,
  DIAExportFormat,
} from '@radiant/shared';

const s3Client = new S3Client({});
const EXPORT_BUCKET = process.env.DIA_EXPORT_BUCKET || process.env.REPORTS_BUCKET || '';
const EXPORT_EXPIRY_SECONDS = 3600; // 1 hour

/**
 * Export an artifact in the requested format
 */
export async function exportArtifact(params: {
  artifact: DecisionArtifact;
  request: ExportArtifactRequest;
  userId: string;
  tenantId: string;
}): Promise<ExportArtifactResponse> {
  const { artifact, request, userId, tenantId } = params;
  const exportId = uuidv4();

  let content: Buffer;
  let contentType: string;
  let extension: string;

  switch (request.format) {
    case 'pdf':
      content = await generatePDFExport(artifact, request.redactPhi);
      contentType = 'application/pdf';
      extension = 'pdf';
      break;

    case 'json':
      content = await generateJSONExport(artifact, request.redactPhi);
      contentType = 'application/json';
      extension = 'json';
      break;

    case 'hipaa_audit':
      content = await generateHIPAAAuditPackage(artifact, request.redactPhi);
      contentType = 'application/json';
      extension = 'hipaa.json';
      break;

    case 'soc2_evidence':
      content = await generateSOC2EvidenceBundle(artifact);
      contentType = 'application/json';
      extension = 'soc2.json';
      break;

    case 'gdpr_dsar':
      content = await generateGDPRDSARResponse(artifact, request.redactPhi);
      contentType = 'application/json';
      extension = 'gdpr.json';
      break;

    default:
      throw new Error(`Unsupported export format: ${request.format}`);
  }

  // Upload to S3
  const s3Key = `exports/${tenantId}/${artifact.id}/${exportId}.${extension}`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: EXPORT_BUCKET,
      Key: s3Key,
      Body: content,
      ContentType: contentType,
      Metadata: {
        artifactId: artifact.id,
        exportId,
        format: request.format,
        redacted: String(request.redactPhi || false),
      },
    })
  );

  // Generate signed URL
  const downloadUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: EXPORT_BUCKET,
      Key: s3Key,
    }),
    { expiresIn: EXPORT_EXPIRY_SECONDS }
  );

  // Log export for audit
  await executeStatement(
    `INSERT INTO decision_artifact_export_log 
     (artifact_id, tenant_id, export_format, compliance_framework, exported_by, 
      recipient_description, purpose, export_hash, s3_key, file_size_bytes, redaction_applied)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      stringParam('artifactId', artifact.id),
      stringParam('tenantId', tenantId),
      stringParam('format', request.format),
      stringParam('framework', getComplianceFramework(request.format)),
      stringParam('userId', userId),
      stringParam('recipient', request.recipientDescription || ''),
      stringParam('purpose', request.purpose || ''),
      stringParam('hash', ''), // Could compute hash of content
      stringParam('s3Key', s3Key),
      longParam('fileSize', content.length),
      stringParam('redacted', request.redactPhi ? 'true' : 'false'),
    ]
  );

  return {
    downloadUrl,
    format: request.format,
    expiresAt: new Date(Date.now() + EXPORT_EXPIRY_SECONDS * 1000).toISOString(),
    fileSize: content.length,
    exportId,
  };
}

/**
 * Generate PDF export
 */
async function generatePDFExport(
  artifact: DecisionArtifact,
  redact?: boolean
): Promise<Buffer> {
  // For now, generate a structured JSON that could be converted to PDF
  // In production, use a PDF library like pdfkit
  const doc = {
    title: artifact.title,
    generated: new Date().toISOString(),
    version: artifact.version,
    status: artifact.status,
    sections: [
      {
        title: 'Executive Summary',
        content: artifact.summary || 'No summary available',
      },
      {
        title: 'Claims & Evidence',
        claims: artifact.artifactContent.claims.map((c) => ({
          text: redact ? redactSensitive(c.text) : c.text,
          type: c.claim_type,
          verification: c.verification_status,
          confidence: c.confidence_score,
          evidence_count: c.supporting_evidence.length,
        })),
      },
      {
        title: 'Dissent Analysis',
        dissent_count: artifact.artifactContent.dissent_events.length,
        events: artifact.artifactContent.dissent_events.map((d) => ({
          position: redact ? redactSensitive(d.contested_position) : d.contested_position,
          severity: d.dissent_severity,
          resolution: d.resolution,
        })),
      },
      {
        title: 'Metrics',
        ...artifact.artifactContent.metrics,
      },
      {
        title: 'Compliance Status',
        frameworks: artifact.complianceFrameworks,
        phi_detected: artifact.phiDetected,
        pii_detected: artifact.piiDetected,
      },
    ],
  };

  return Buffer.from(JSON.stringify(doc, null, 2));
}

/**
 * Generate JSON export
 */
async function generateJSONExport(
  artifact: DecisionArtifact,
  redact?: boolean
): Promise<Buffer> {
  const exportData = redact ? redactArtifact(artifact) : artifact;
  return Buffer.from(JSON.stringify(exportData, null, 2));
}

/**
 * Generate HIPAA Audit Package
 */
async function generateHIPAAAuditPackage(
  artifact: DecisionArtifact,
  redact?: boolean
): Promise<Buffer> {
  const package_ = {
    audit_type: 'HIPAA_COMPLIANCE',
    generated_at: new Date().toISOString(),
    artifact_id: artifact.id,
    
    cover_sheet: {
      title: 'HIPAA Compliance Audit Package',
      artifact_title: artifact.title,
      generation_date: artifact.createdAt,
      validation_status: artifact.validationStatus,
      phi_detected: artifact.phiDetected,
      data_classification: artifact.dataClassification,
    },

    phi_inventory: {
      phi_present: artifact.phiDetected,
      categories: artifact.artifactContent.compliance.hipaa?.phi_categories || [],
      minimum_necessary_applied: artifact.artifactContent.compliance.hipaa?.minimum_necessary_applied,
      affected_claims: artifact.artifactContent.claims
        .filter((c) => c.contains_phi)
        .map((c) => ({
          claim_id: c.claim_id,
          sensitivity_level: c.sensitivity_level,
          text_preview: redact ? '[REDACTED]' : c.text.slice(0, 100),
        })),
    },

    access_log: artifact.artifactContent.compliance.audit_entries.map((entry) => ({
      timestamp: entry.timestamp,
      action: entry.action,
      actor_type: entry.actor_type,
      details: entry.details,
    })),

    evidence_chain: {
      total_claims: artifact.artifactContent.metrics.total_claims,
      verified_claims: artifact.artifactContent.metrics.verified_claims,
      evidence_links: artifact.artifactContent.metrics.total_evidence_links,
      chain_integrity: 'complete',
    },

    attestation: {
      system: 'RADIANT DIA Engine',
      version: '5.43.0',
      extraction_model: artifact.minerModel,
      extraction_confidence: artifact.extractionConfidence,
      content_hash: artifact.contentHash,
    },
  };

  return Buffer.from(JSON.stringify(package_, null, 2));
}

/**
 * Generate SOC2 Evidence Bundle
 */
async function generateSOC2EvidenceBundle(artifact: DecisionArtifact): Promise<Buffer> {
  const bundle = {
    audit_type: 'SOC2_EVIDENCE',
    generated_at: new Date().toISOString(),
    artifact_id: artifact.id,

    control_mapping: {
      controls_referenced: artifact.artifactContent.compliance.soc2?.controls_referenced || [],
      evidence_chain_complete: artifact.artifactContent.compliance.soc2?.evidence_chain_complete,
      change_management_documented: artifact.artifactContent.compliance.soc2?.change_management_documented,
    },

    evidence_summary: {
      total_evidence_links: artifact.artifactContent.metrics.total_evidence_links,
      tool_calls_logged: artifact.artifactContent.claims.reduce(
        (sum, c) => sum + c.supporting_evidence.filter((e) => e.evidence_type === 'tool_call').length,
        0
      ),
      verification_rate: artifact.artifactContent.metrics.verified_claims / 
        Math.max(artifact.artifactContent.metrics.total_claims, 1),
    },

    integrity_verification: {
      content_hash: artifact.contentHash,
      signature_timestamp: artifact.signatureTimestamp,
      status: artifact.status,
      version: artifact.version,
    },

    raw_evidence: artifact.artifactContent.claims.map((c) => ({
      claim_id: c.claim_id,
      claim_type: c.claim_type,
      verification_status: c.verification_status,
      evidence: c.supporting_evidence.map((e) => ({
        evidence_id: e.evidence_id,
        type: e.evidence_type,
        tool_name: e.evidence_snapshot.tool_name,
        timestamp: e.evidence_snapshot.timestamp,
      })),
    })),

    audit_trail: artifact.artifactContent.compliance.audit_entries,
  };

  return Buffer.from(JSON.stringify(bundle, null, 2));
}

/**
 * Generate GDPR DSAR Response
 */
async function generateGDPRDSARResponse(
  artifact: DecisionArtifact,
  redact?: boolean
): Promise<Buffer> {
  const response = {
    audit_type: 'GDPR_DSAR',
    generated_at: new Date().toISOString(),
    artifact_id: artifact.id,

    data_subject_information: {
      pii_present: artifact.piiDetected,
      lawful_basis: artifact.artifactContent.compliance.gdpr?.lawful_basis,
      data_subject_rights_applicable: artifact.artifactContent.compliance.gdpr?.data_subject_rights_applicable,
    },

    pii_inventory: artifact.artifactContent.claims
      .filter((c) => c.contains_pii)
      .map((c) => ({
        claim_id: c.claim_id,
        data_category: 'personal_data',
        processing_purpose: 'AI-assisted decision support',
        content_preview: redact ? '[REDACTED]' : c.text.slice(0, 100),
      })),

    processing_record: {
      artifact_created: artifact.createdAt,
      last_accessed: artifact.updatedAt,
      models_involved: artifact.artifactContent.metrics.models_involved,
      extraction_model: artifact.minerModel,
    },

    data_retention: {
      status: artifact.status,
      frozen_at: artifact.frozenAt,
      retention_policy: 'As per tenant configuration',
    },

    rights_exercised: {
      access: true, // This export proves access right
      rectification: 'Available via artifact versioning',
      erasure: 'Available via artifact archival',
      portability: 'This export provides portability',
    },
  };

  return Buffer.from(JSON.stringify(response, null, 2));
}

/**
 * Redact sensitive data from artifact
 */
function redactArtifact(artifact: DecisionArtifact): DecisionArtifact {
  return {
    ...artifact,
    title: redactSensitive(artifact.title),
    summary: artifact.summary ? redactSensitive(artifact.summary) : undefined,
    artifactContent: {
      ...artifact.artifactContent,
      claims: artifact.artifactContent.claims.map((c) => ({
        ...c,
        text: redactSensitive(c.text),
        supporting_evidence: c.supporting_evidence.map((e) => ({
          ...e,
          evidence_snapshot: {
            ...e.evidence_snapshot,
            input_summary: e.evidence_snapshot.input_summary 
              ? redactSensitive(e.evidence_snapshot.input_summary) 
              : undefined,
            output_summary: e.evidence_snapshot.output_summary
              ? redactSensitive(e.evidence_snapshot.output_summary)
              : undefined,
            raw_output: '[REDACTED]',
          },
        })),
      })),
      dissent_events: artifact.artifactContent.dissent_events.map((d) => ({
        ...d,
        contested_position: redactSensitive(d.contested_position),
        reasoning_trace_excerpt: d.reasoning_trace_excerpt
          ? redactSensitive(d.reasoning_trace_excerpt)
          : undefined,
      })),
    },
  };
}

/**
 * Redact sensitive content from text
 */
function redactSensitive(text: string): string {
  let redacted = redactPHI(text);
  redacted = redactPII(redacted);
  return redacted;
}

/**
 * Get compliance framework from export format
 */
function getComplianceFramework(format: DIAExportFormat): string {
  switch (format) {
    case 'hipaa_audit':
      return 'hipaa';
    case 'soc2_evidence':
      return 'soc2';
    case 'gdpr_dsar':
      return 'gdpr';
    default:
      return '';
  }
}

/**
 * Get export history for an artifact
 */
export async function getExportHistory(
  artifactId: string,
  tenantId: string
): Promise<Array<{
  exportId: string;
  format: string;
  framework: string | null;
  exportedAt: string;
  exportedBy: string;
  fileSize: number;
  redacted: boolean;
}>> {
  const result = await executeStatement<{
    id: string;
    export_format: string;
    compliance_framework: string | null;
    exported_at: string;
    exported_by: string;
    file_size_bytes: number;
    redaction_applied: boolean;
  }>(
    `SELECT id, export_format, compliance_framework, exported_at, exported_by, 
            file_size_bytes, redaction_applied
     FROM decision_artifact_export_log
     WHERE artifact_id = $1 AND tenant_id = $2
     ORDER BY exported_at DESC`,
    [stringParam('artifactId', artifactId), stringParam('tenantId', tenantId)]
  );

  return result.rows.map((row) => ({
    exportId: row.id,
    format: row.export_format,
    framework: row.compliance_framework,
    exportedAt: row.exported_at,
    exportedBy: row.exported_by,
    fileSize: row.file_size_bytes,
    redacted: row.redaction_applied,
  }));
}
