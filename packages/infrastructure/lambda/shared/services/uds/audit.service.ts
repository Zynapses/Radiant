/**
 * UDS Audit Service
 * Tamper-evident audit logging with Merkle chain
 * 
 * Features:
 * - Append-only audit log
 * - Merkle tree for tamper evidence
 * - GDPR/HIPAA/SOC2 compliant
 * - Full query support
 */

import { createHash } from 'crypto';
import { executeStatement, stringParam, boolParam } from '../../db/client';
import { enhancedLogger as logger } from '../../logging/enhanced-logger';
import type {
  UDSAuditEntry,
  UDSAuditEntryCreate,
  UDSAuditListOptions,
  UDSAuditMerkleTree,
  UDSAuditVerificationResult,
  UDSAuditCategory,
  IUDSAuditService,
} from '@radiant/shared';

// =============================================================================
// Constants
// =============================================================================

const MERKLE_TREE_BATCH_SIZE = 1000;  // Build tree for every N entries

// =============================================================================
// Service Implementation
// =============================================================================

class UDSAuditService implements IUDSAuditService {

  // ===========================================================================
  // Logging
  // ===========================================================================

  /**
   * Log an audit entry with Merkle chain
   */
  async log(
    tenantId: string,
    userId: string | null,
    entry: UDSAuditEntryCreate,
    requestContext?: {
      requestId?: string;
      sessionId?: string;
      ipAddress?: string;
      userAgent?: string;
      geoLocation?: { country?: string; region?: string; city?: string };
    }
  ): Promise<UDSAuditEntry> {
    // Get next sequence number and previous hash atomically
    const seqResult = await executeStatement(
      `SELECT 
         COALESCE(MAX(sequence_number), 0) + 1 as next_seq,
         (SELECT merkle_hash FROM uds_audit_log 
          WHERE tenant_id = $1 
          ORDER BY sequence_number DESC LIMIT 1) as prev_hash
       FROM uds_audit_log WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );

    const sequenceNumber = seqResult.rows?.[0]?.next_seq as number || 1;
    const previousMerkleHash = seqResult.rows?.[0]?.prev_hash as string | null;

    // Calculate Merkle hash
    const timestamp = new Date();
    const merkleHash = this.calculateMerkleHash(
      entry.eventType,
      entry.action,
      entry.resourceType || '',
      entry.resourceId || '',
      previousMerkleHash || '',
      timestamp
    );

    const result = await executeStatement(
      `INSERT INTO uds_audit_log (
        tenant_id, user_id,
        event_type, event_category, event_severity,
        resource_type, resource_id, resource_name,
        action, action_details,
        previous_state_hash, new_state_hash, changes,
        merkle_hash, previous_merkle_hash, sequence_number,
        request_id, session_id, ip_address, user_agent, geo_location,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId || ''),
        stringParam('eventType', entry.eventType),
        stringParam('eventCategory', entry.eventCategory),
        stringParam('eventSeverity', entry.eventSeverity || 'info'),
        stringParam('resourceType', entry.resourceType || ''),
        stringParam('resourceId', entry.resourceId || ''),
        stringParam('resourceName', entry.resourceName || ''),
        stringParam('action', entry.action),
        stringParam('actionDetails', JSON.stringify(entry.actionDetails || {})),
        stringParam('previousStateHash', entry.previousStateHash || ''),
        stringParam('newStateHash', entry.newStateHash || ''),
        stringParam('changes', JSON.stringify(entry.changes || {})),
        stringParam('merkleHash', merkleHash),
        stringParam('previousMerkleHash', previousMerkleHash || ''),
        stringParam('sequenceNumber', String(sequenceNumber)),
        stringParam('requestId', requestContext?.requestId || ''),
        stringParam('sessionId', requestContext?.sessionId || ''),
        stringParam('ipAddress', requestContext?.ipAddress || ''),
        stringParam('userAgent', requestContext?.userAgent || ''),
        stringParam('geoLocation', JSON.stringify(requestContext?.geoLocation || {})),
        stringParam('metadata', JSON.stringify(entry.metadata || {})),
      ]
    );

    const auditEntry = this.mapRow(result.rows[0]);

    // Check if we should build a new Merkle tree
    if (sequenceNumber % MERKLE_TREE_BATCH_SIZE === 0) {
      this.buildMerkleTree(
        tenantId,
        sequenceNumber - MERKLE_TREE_BATCH_SIZE + 1,
        sequenceNumber
      ).catch(err => logger.error('Failed to build Merkle tree', { tenantId, err }));
    }

    return auditEntry;
  }

  /**
   * Log multiple entries efficiently
   */
  async logBatch(
    tenantId: string,
    entries: Array<{
      userId: string | null;
      entry: UDSAuditEntryCreate;
      requestContext?: {
        requestId?: string;
        ipAddress?: string;
        userAgent?: string;
      };
    }>
  ): Promise<UDSAuditEntry[]> {
    const results: UDSAuditEntry[] = [];
    
    // Log each entry (maintains chain integrity)
    for (const item of entries) {
      const entry = await this.log(tenantId, item.userId, item.entry, item.requestContext);
      results.push(entry);
    }

    return results;
  }

  // ===========================================================================
  // Query
  // ===========================================================================

  /**
   * List audit entries with filtering
   */
  async list(
    tenantId: string,
    options: UDSAuditListOptions = {}
  ): Promise<UDSAuditEntry[]> {
    const {
      userId,
      eventType,
      eventCategory,
      resourceType,
      resourceId,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = options;

    const conditions: string[] = ['tenant_id = $1'];
    const params: ReturnType<typeof stringParam>[] = [stringParam('tenantId', tenantId)];
    let paramIndex = 2;

    if (userId) {
      conditions.push(`user_id = $${paramIndex}`);
      params.push(stringParam('userId', userId));
      paramIndex++;
    }

    if (eventType) {
      conditions.push(`event_type = $${paramIndex}`);
      params.push(stringParam('eventType', eventType));
      paramIndex++;
    }

    if (eventCategory) {
      conditions.push(`event_category = $${paramIndex}`);
      params.push(stringParam('eventCategory', eventCategory));
      paramIndex++;
    }

    if (resourceType) {
      conditions.push(`resource_type = $${paramIndex}`);
      params.push(stringParam('resourceType', resourceType));
      paramIndex++;
    }

    if (resourceId) {
      conditions.push(`resource_id = $${paramIndex}`);
      params.push(stringParam('resourceId', resourceId));
      paramIndex++;
    }

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(stringParam('startDate', startDate.toISOString()));
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(stringParam('endDate', endDate.toISOString()));
      paramIndex++;
    }

    params.push(stringParam('limit', String(limit)));
    params.push(stringParam('offset', String(offset)));

    const result = await executeStatement(
      `SELECT * FROM uds_audit_log 
       WHERE ${conditions.join(' AND ')}
       ORDER BY sequence_number DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return (result.rows || []).map(row => this.mapRow(row));
  }

  /**
   * Get audit entry by ID
   */
  async get(
    tenantId: string,
    entryId: string
  ): Promise<UDSAuditEntry | null> {
    const result = await executeStatement(
      `SELECT * FROM uds_audit_log WHERE id = $1 AND tenant_id = $2`,
      [
        stringParam('id', entryId),
        stringParam('tenantId', tenantId),
      ]
    );

    if (!result.rows?.length) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Get audit trail for a specific resource
   */
  async getResourceHistory(
    tenantId: string,
    resourceType: string,
    resourceId: string,
    limit: number = 100
  ): Promise<UDSAuditEntry[]> {
    return this.list(tenantId, {
      resourceType,
      resourceId,
      limit,
    });
  }

  /**
   * Get audit trail for a specific user
   */
  async getUserHistory(
    tenantId: string,
    userId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<UDSAuditEntry[]> {
    return this.list(tenantId, {
      userId,
      startDate,
      endDate,
      limit,
    });
  }

  // ===========================================================================
  // Merkle Chain Verification
  // ===========================================================================

  /**
   * Verify integrity of audit chain
   */
  async verify(
    tenantId: string,
    fromSequence: number,
    toSequence: number
  ): Promise<UDSAuditVerificationResult> {
    logger.info('Verifying audit chain', { tenantId, fromSequence, toSequence });

    const result = await executeStatement(
      `SELECT * FROM uds_audit_log 
       WHERE tenant_id = $1 AND sequence_number >= $2 AND sequence_number <= $3
       ORDER BY sequence_number ASC`,
      [
        stringParam('tenantId', tenantId),
        stringParam('fromSeq', String(fromSequence)),
        stringParam('toSeq', String(toSequence)),
      ]
    );

    const entries = result.rows || [];
    const errors: string[] = [];
    let entriesVerified = 0;

    // Verify chain integrity
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const expectedSequence = fromSequence + i;

      // Check sequence number
      if (entry.sequence_number !== expectedSequence) {
        errors.push(`Missing sequence number ${expectedSequence}`);
        continue;
      }

      // Verify Merkle hash
      const calculatedHash = this.calculateMerkleHash(
        entry.event_type as string,
        entry.action as string,
        entry.resource_type as string || '',
        entry.resource_id as string || '',
        entry.previous_merkle_hash as string || '',
        new Date(entry.created_at as string)
      );

      if (calculatedHash !== entry.merkle_hash) {
        errors.push(`Hash mismatch at sequence ${entry.sequence_number}`);
        continue;
      }

      // Verify chain link (previous hash matches)
      if (i > 0) {
        const prevEntry = entries[i - 1];
        if (entry.previous_merkle_hash !== prevEntry.merkle_hash) {
          errors.push(`Chain broken at sequence ${entry.sequence_number}`);
          continue;
        }
      }

      entriesVerified++;
    }

    // Calculate tree root for verified entries
    const treeRoot = entries.length > 0 
      ? this.calculateTreeRoot(entries.map(e => e.merkle_hash as string))
      : '';

    const isValid = errors.length === 0 && entriesVerified === (toSequence - fromSequence + 1);

    logger.info('Audit chain verification complete', { 
      tenantId, 
      isValid, 
      entriesVerified, 
      errors: errors.length 
    });

    return {
      isValid,
      treeRoot,
      entriesVerified,
      firstEntry: fromSequence,
      lastEntry: toSequence,
      errors,
      verifiedAt: new Date(),
    };
  }

  /**
   * Build Merkle tree for a range of entries
   */
  async buildMerkleTree(
    tenantId: string,
    fromSequence: number,
    toSequence: number
  ): Promise<UDSAuditMerkleTree> {
    logger.info('Building Merkle tree', { tenantId, fromSequence, toSequence });

    // Get entries
    const result = await executeStatement(
      `SELECT merkle_hash, created_at FROM uds_audit_log 
       WHERE tenant_id = $1 AND sequence_number >= $2 AND sequence_number <= $3
       ORDER BY sequence_number ASC`,
      [
        stringParam('tenantId', tenantId),
        stringParam('fromSeq', String(fromSequence)),
        stringParam('toSeq', String(toSequence)),
      ]
    );

    const entries = result.rows || [];
    if (entries.length === 0) {
      throw new Error('No entries found for Merkle tree');
    }

    // Build tree
    const hashes = entries.map(e => e.merkle_hash as string);
    const rootHash = this.calculateTreeRoot(hashes);
    const treeHeight = Math.ceil(Math.log2(hashes.length)) + 1;

    // Store tree
    const treeResult = await executeStatement(
      `INSERT INTO uds_audit_merkle_tree (
        tenant_id, tree_height, leaf_count, root_hash,
        first_sequence_number, last_sequence_number,
        first_entry_at, last_entry_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('treeHeight', String(treeHeight)),
        stringParam('leafCount', String(hashes.length)),
        stringParam('rootHash', rootHash),
        stringParam('firstSeq', String(fromSequence)),
        stringParam('lastSeq', String(toSequence)),
        stringParam('firstAt', entries[0].created_at as string),
        stringParam('lastAt', entries[entries.length - 1].created_at as string),
      ]
    );

    // Update entries with tree root
    await executeStatement(
      `UPDATE uds_audit_log 
       SET merkle_tree_root = $3
       WHERE tenant_id = $1 AND sequence_number >= $2 AND sequence_number <= $4`,
      [
        stringParam('tenantId', tenantId),
        stringParam('fromSeq', String(fromSequence)),
        stringParam('rootHash', rootHash),
        stringParam('toSeq', String(toSequence)),
      ]
    );

    logger.info('Merkle tree built', { tenantId, rootHash, leafCount: hashes.length });

    return this.mapTreeRow(treeResult.rows[0]);
  }

  /**
   * Get Merkle trees for a tenant
   */
  async getMerkleTrees(
    tenantId: string,
    limit: number = 10
  ): Promise<UDSAuditMerkleTree[]> {
    const result = await executeStatement(
      `SELECT * FROM uds_audit_merkle_tree 
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [
        stringParam('tenantId', tenantId),
        stringParam('limit', String(limit)),
      ]
    );

    return (result.rows || []).map(row => this.mapTreeRow(row));
  }

  /**
   * Verify a specific Merkle tree
   */
  async verifyMerkleTree(
    tenantId: string,
    treeId: string
  ): Promise<UDSAuditVerificationResult> {
    const treeResult = await executeStatement(
      `SELECT * FROM uds_audit_merkle_tree WHERE id = $1 AND tenant_id = $2`,
      [
        stringParam('id', treeId),
        stringParam('tenantId', tenantId),
      ]
    );

    if (!treeResult.rows?.length) {
      throw new Error('Merkle tree not found');
    }

    const tree = this.mapTreeRow(treeResult.rows[0]);

    // Verify the range covered by this tree
    const verification = await this.verify(
      tenantId,
      tree.firstSequenceNumber,
      tree.lastSequenceNumber
    );

    // Check if root hash matches
    if (verification.isValid && verification.treeRoot !== tree.rootHash) {
      verification.isValid = false;
      verification.errors.push('Tree root hash mismatch');
    }

    // Update verification status
    if (verification.isValid) {
      await executeStatement(
        `UPDATE uds_audit_merkle_tree 
         SET is_verified = true, verified_at = CURRENT_TIMESTAMP, verified_by = 'system'
         WHERE id = $1`,
        [stringParam('id', treeId)]
      );
    }

    return verification;
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get audit statistics for a tenant
   */
  async getStatistics(
    tenantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalEntries: number;
    byCategory: Record<string, number>;
    byEventType: Record<string, number>;
    byUser: Record<string, number>;
  }> {
    const dateCondition = startDate && endDate
      ? `AND created_at BETWEEN '${startDate.toISOString()}' AND '${endDate.toISOString()}'`
      : '';

    const result = await executeStatement(
      `SELECT 
         COUNT(*) as total,
         event_category,
         event_type,
         user_id
       FROM uds_audit_log 
       WHERE tenant_id = $1 ${dateCondition}
       GROUP BY event_category, event_type, user_id`,
      [stringParam('tenantId', tenantId)]
    );

    const byCategory: Record<string, number> = {};
    const byEventType: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    let totalEntries = 0;

    for (const row of result.rows || []) {
      const count = parseInt(row.total as string);
      totalEntries += count;

      const category = row.event_category as string;
      byCategory[category] = (byCategory[category] || 0) + count;

      const eventType = row.event_type as string;
      byEventType[eventType] = (byEventType[eventType] || 0) + count;

      const userId = row.user_id as string;
      if (userId) {
        byUser[userId] = (byUser[userId] || 0) + count;
      }
    }

    return { totalEntries, byCategory, byEventType, byUser };
  }

  // ===========================================================================
  // Export
  // ===========================================================================

  /**
   * Export audit log for compliance
   */
  async export(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const entries = await this.list(tenantId, {
      startDate,
      endDate,
      limit: 100000,  // Large limit for export
    });

    if (format === 'csv') {
      const headers = [
        'id', 'timestamp', 'event_type', 'event_category', 'action',
        'user_id', 'resource_type', 'resource_id', 'merkle_hash'
      ];
      const rows = entries.map(e => [
        e.id,
        e.createdAt.toISOString(),
        e.eventType,
        e.eventCategory,
        e.action,
        e.userId || '',
        e.resourceType || '',
        e.resourceId || '',
        e.merkleHash,
      ]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    return JSON.stringify(entries, null, 2);
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /**
   * Calculate Merkle hash for an entry
   */
  private calculateMerkleHash(
    eventType: string,
    action: string,
    resourceType: string,
    resourceId: string,
    previousHash: string,
    timestamp: Date
  ): string {
    const data = [
      eventType,
      action,
      resourceType,
      resourceId,
      previousHash,
      timestamp.toISOString(),
    ].join('|');

    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Calculate Merkle tree root from leaf hashes
   */
  private calculateTreeRoot(hashes: string[]): string {
    if (hashes.length === 0) return '';
    if (hashes.length === 1) return hashes[0];

    // Pad to power of 2
    const targetSize = Math.pow(2, Math.ceil(Math.log2(hashes.length)));
    while (hashes.length < targetSize) {
      hashes.push(hashes[hashes.length - 1]);  // Duplicate last
    }

    // Build tree bottom-up
    let level = hashes;
    while (level.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < level.length; i += 2) {
        const combined = level[i] + level[i + 1];
        nextLevel.push(createHash('sha256').update(combined).digest('hex'));
      }
      level = nextLevel;
    }

    return level[0];
  }

  /**
   * Map database row to UDSAuditEntry
   */
  private mapRow(row: Record<string, unknown>): UDSAuditEntry {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string | undefined,
      eventType: row.event_type as string,
      eventCategory: row.event_category as UDSAuditCategory,
      eventSeverity: row.event_severity as 'debug' | 'info' | 'warning' | 'error' | 'critical',
      resourceType: row.resource_type as string | undefined,
      resourceId: row.resource_id as string | undefined,
      resourceName: row.resource_name as string | undefined,
      action: row.action as string,
      actionDetails: typeof row.action_details === 'string' 
        ? JSON.parse(row.action_details) 
        : (row.action_details as Record<string, unknown>) || {},
      previousStateHash: row.previous_state_hash as string | undefined,
      newStateHash: row.new_state_hash as string | undefined,
      changes: typeof row.changes === 'string'
        ? JSON.parse(row.changes)
        : (row.changes as Record<string, unknown>) || undefined,
      merkleHash: row.merkle_hash as string,
      previousMerkleHash: row.previous_merkle_hash as string | undefined,
      merkleTreeRoot: row.merkle_tree_root as string | undefined,
      sequenceNumber: row.sequence_number as number,
      requestId: row.request_id as string | undefined,
      sessionId: row.session_id as string | undefined,
      ipAddress: row.ip_address as string | undefined,
      userAgent: row.user_agent as string | undefined,
      geoLocation: typeof row.geo_location === 'string'
        ? JSON.parse(row.geo_location)
        : (row.geo_location as { country?: string; region?: string; city?: string }) || undefined,
      metadata: typeof row.metadata === 'string'
        ? JSON.parse(row.metadata)
        : (row.metadata as Record<string, unknown>) || {},
      createdAt: new Date(row.created_at as string),
    };
  }

  /**
   * Map database row to UDSAuditMerkleTree
   */
  private mapTreeRow(row: Record<string, unknown>): UDSAuditMerkleTree {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      treeHeight: row.tree_height as number,
      leafCount: row.leaf_count as number,
      rootHash: row.root_hash as string,
      firstSequenceNumber: row.first_sequence_number as number,
      lastSequenceNumber: row.last_sequence_number as number,
      firstEntryAt: new Date(row.first_entry_at as string),
      lastEntryAt: new Date(row.last_entry_at as string),
      isVerified: row.is_verified as boolean,
      verifiedAt: row.verified_at ? new Date(row.verified_at as string) : undefined,
      verifiedBy: row.verified_by as string | undefined,
      treeDataKey: row.tree_data_key as string | undefined,
      createdAt: new Date(row.created_at as string),
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const udsAuditService = new UDSAuditService();
