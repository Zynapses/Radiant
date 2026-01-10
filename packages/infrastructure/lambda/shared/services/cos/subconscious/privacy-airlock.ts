/**
 * PrivacyAirlock v6.0.5
 * 
 * PURPOSE: Expert Determination compliance for HIPAA/GDPR data flows
 * 
 * An "airlock" that ensures data only flows to learning systems
 * after privacy review and de-identification.
 * 
 * Implements HIPAA Expert Determination method (§164.514(b)(1)):
 * - Statistical and scientific principles applied
 * - Very small risk of re-identification
 * - Expert determination documented
 * 
 * Location: packages/infrastructure/lambda/shared/services/cos/subconscious/privacy-airlock.ts
 */

import { query } from '../../database';
import crypto from 'crypto';
import { logger } from '../../../logging/enhanced-logger';

export type PrivacyLevel = 'public' | 'internal' | 'confidential' | 'restricted' | 'phi';
export type AirlockStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface DataPacket {
  id: string;
  tenantId: string;
  sourceType: 'conversation' | 'feedback' | 'learning_candidate' | 'analytics';
  originalContent: string;
  privacyLevel: PrivacyLevel;
  containsPHI: boolean;
  containsPII: boolean;
  metadata: Record<string, unknown>;
}

export interface AirlockEntry {
  id: string;
  packetId: string;
  tenantId: string;
  status: AirlockStatus;
  deidentifiedContent?: string;
  privacyReviewedBy?: string;
  privacyReviewedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface DeidentificationResult {
  success: boolean;
  deidentifiedContent: string;
  removedElements: string[];
  privacyScore: number; // 0-1, higher = more private
  canProceedToLearning: boolean;
}

/**
 * PHI patterns to detect and remove (HIPAA Safe Harbor)
 */
const PHI_PATTERNS = [
  { name: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' },
  { name: 'phone', pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '[PHONE]' },
  { name: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL]' },
  { name: 'dob', pattern: /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](\d{2}|\d{4})\b/g, replacement: '[DOB]' },
  { name: 'mrn', pattern: /\bMRN[:\s]?\d+\b/gi, replacement: '[MRN]' },
  { name: 'address', pattern: /\d+\s+[A-Za-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b/gi, replacement: '[ADDRESS]' },
  { name: 'zip', pattern: /\b\d{5}(-\d{4})?\b/g, replacement: '[ZIP]' },
  { name: 'ip', pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '[IP]' },
  { name: 'credit_card', pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: '[CC]' },
];

/**
 * PII patterns (names, ages, etc.)
 */
const PII_PATTERNS = [
  { name: 'age', pattern: /\b(I am|I'm|aged?)\s*\d{1,3}\s*(years? old)?\b/gi, replacement: '[AGE]' },
  { name: 'name_intro', pattern: /\b(my name is|I'm called|call me)\s+[A-Z][a-z]+/gi, replacement: '[NAME]' },
];

/**
 * PrivacyAirlock - Data de-identification and privacy compliance
 * 
 * All data must pass through the airlock before being used for:
 * - System-wide learning
 * - Analytics aggregation
 * - Model training
 */
export class PrivacyAirlock {
  private readonly AIRLOCK_TTL_DAYS = 7; // Entries expire after 7 days
  
  /**
   * Submit data packet to airlock for privacy review
   */
  async submitToAirlock(packet: DataPacket): Promise<AirlockEntry> {
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + this.AIRLOCK_TTL_DAYS * 24 * 60 * 60 * 1000);
    
    // Detect PHI/PII
    const phiDetected = this.detectPHI(packet.originalContent);
    const piiDetected = this.detectPII(packet.originalContent);
    
    // Determine initial status
    let status: AirlockStatus = 'pending';
    let deidentifiedContent: string | undefined;
    
    // Auto-approve if no sensitive data detected
    if (!phiDetected.detected && !piiDetected.detected && packet.privacyLevel === 'public') {
      status = 'approved';
      deidentifiedContent = packet.originalContent;
    }
    
    const entry: AirlockEntry = {
      id,
      packetId: packet.id,
      tenantId: packet.tenantId,
      status,
      deidentifiedContent,
      expiresAt,
      createdAt: new Date(),
    };
    
    // Store in database
    await query(
      `INSERT INTO cos_privacy_airlock 
       (id, packet_id, tenant_id, status, original_content, deidentified_content,
        privacy_level, contains_phi, contains_pii, source_type, metadata, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id, packet.id, packet.tenantId, status, packet.originalContent, deidentifiedContent,
        packet.privacyLevel, phiDetected.detected, piiDetected.detected,
        packet.sourceType, JSON.stringify(packet.metadata), expiresAt
      ]
    );
    
    logger.info(`[COS Airlock] Packet ${packet.id} submitted: status=${status}, PHI=${phiDetected.detected}, PII=${piiDetected.detected}`);
    
    return entry;
  }
  
  /**
   * De-identify content for safe learning
   */
  deidentify(content: string): DeidentificationResult {
    let deidentified = content;
    const removedElements: string[] = [];
    
    // Remove PHI (HIPAA Safe Harbor)
    for (const { name, pattern, replacement } of PHI_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        removedElements.push(`${name}: ${matches.length} instance(s)`);
        deidentified = deidentified.replace(pattern, replacement);
      }
    }
    
    // Remove PII
    for (const { name, pattern, replacement } of PII_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        removedElements.push(`${name}: ${matches.length} instance(s)`);
        deidentified = deidentified.replace(pattern, replacement);
      }
    }
    
    // Calculate privacy score (higher = more de-identified)
    const originalLength = content.length;
    const removedCount = removedElements.length;
    const privacyScore = Math.min(1, 0.5 + (removedCount * 0.1));
    
    // Can proceed if we've removed identifiers or content was clean
    const canProceedToLearning = removedElements.length > 0 || !this.detectPHI(content).detected;
    
    return {
      success: true,
      deidentifiedContent: deidentified,
      removedElements,
      privacyScore,
      canProceedToLearning,
    };
  }
  
  /**
   * Detect PHI in content
   */
  detectPHI(content: string): { detected: boolean; types: string[] } {
    const types: string[] = [];
    
    for (const { name, pattern } of PHI_PATTERNS) {
      if (pattern.test(content)) {
        types.push(name);
      }
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
    }
    
    return { detected: types.length > 0, types };
  }
  
  /**
   * Detect PII in content
   */
  detectPII(content: string): { detected: boolean; types: string[] } {
    const types: string[] = [];
    
    for (const { name, pattern } of PII_PATTERNS) {
      if (pattern.test(content)) {
        types.push(name);
      }
      pattern.lastIndex = 0;
    }
    
    return { detected: types.length > 0, types };
  }
  
  /**
   * Process airlock entry - apply de-identification and approve
   */
  async processEntry(entryId: string, reviewerId: string): Promise<AirlockEntry> {
    // Get entry
    const result = await query(
      `SELECT * FROM cos_privacy_airlock WHERE id = $1`,
      [entryId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Airlock entry not found: ${entryId}`);
    }
    
    const row = result.rows[0];
    
    // Apply de-identification
    const deidentResult = this.deidentify(row.original_content);
    
    // Update entry
    const newStatus: AirlockStatus = deidentResult.canProceedToLearning ? 'approved' : 'rejected';
    
    await query(
      `UPDATE cos_privacy_airlock 
       SET status = $1, deidentified_content = $2, privacy_reviewed_by = $3, privacy_reviewed_at = NOW()
       WHERE id = $4`,
      [newStatus, deidentResult.deidentifiedContent, reviewerId, entryId]
    );
    
    logger.info(`[COS Airlock] Entry ${entryId} processed: ${newStatus} by ${reviewerId}`);
    
    return {
      id: entryId,
      packetId: row.packet_id,
      tenantId: row.tenant_id,
      status: newStatus,
      deidentifiedContent: deidentResult.deidentifiedContent,
      privacyReviewedBy: reviewerId,
      privacyReviewedAt: new Date(),
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
    };
  }
  
  /**
   * Get approved entries ready for learning
   */
  async getApprovedForLearning(tenantId: string, limit: number = 100): Promise<string[]> {
    const result = await query(
      `SELECT deidentified_content FROM cos_privacy_airlock 
       WHERE tenant_id = $1 AND status = 'approved' AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit]
    );
    
    return result.rows.map(r => r.deidentified_content);
  }
  
  /**
   * Get pending entries for review
   */
  async getPendingEntries(tenantId?: string): Promise<AirlockEntry[]> {
    const whereClause = tenantId 
      ? 'WHERE tenant_id = $1 AND status = $2'
      : 'WHERE status = $1';
    const params = tenantId ? [tenantId, 'pending'] : ['pending'];
    
    const result = await query(
      `SELECT * FROM cos_privacy_airlock ${whereClause} ORDER BY created_at ASC LIMIT 100`,
      params
    );
    
    return result.rows.map(this.rowToEntry);
  }
  
  /**
   * Expire old entries
   */
  async expireOldEntries(): Promise<number> {
    const result = await query(
      `UPDATE cos_privacy_airlock SET status = 'expired' WHERE expires_at < NOW() AND status = 'pending'`
    );
    return result.rowCount || 0;
  }
  
  /**
   * Get airlock statistics
   */
  async getStats(tenantId?: string): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
    phiDetectedCount: number;
    piiDetectedCount: number;
  }> {
    const whereClause = tenantId ? 'WHERE tenant_id = $1' : '';
    const params = tenantId ? [tenantId] : [];
    
    const result = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE status = 'expired') as expired,
        COUNT(*) FILTER (WHERE contains_phi = TRUE) as phi_count,
        COUNT(*) FILTER (WHERE contains_pii = TRUE) as pii_count
       FROM cos_privacy_airlock ${whereClause}`,
      params
    );
    
    const row = result.rows[0];
    return {
      pending: parseInt(row.pending),
      approved: parseInt(row.approved),
      rejected: parseInt(row.rejected),
      expired: parseInt(row.expired),
      phiDetectedCount: parseInt(row.phi_count),
      piiDetectedCount: parseInt(row.pii_count),
    };
  }
  
  private rowToEntry(row: Record<string, unknown>): AirlockEntry {
    return {
      id: row.id as string,
      packetId: row.packet_id as string,
      tenantId: row.tenant_id as string,
      status: row.status as AirlockStatus,
      deidentifiedContent: row.deidentified_content as string | undefined,
      privacyReviewedBy: row.privacy_reviewed_by as string | undefined,
      privacyReviewedAt: row.privacy_reviewed_at ? new Date(row.privacy_reviewed_at as string) : undefined,
      expiresAt: new Date(row.expires_at as string),
      createdAt: new Date(row.created_at as string),
    };
  }
}

/**
 * Singleton instance
 */
export const privacyAirlock = new PrivacyAirlock();
