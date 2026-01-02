/**
 * RADIANT Genesis Cato Merkle Audit Service
 * Provides append-only, cryptographically verified audit trail
 *
 * CRITICAL: Audit trail is IMMUTABLE
 * - No UPDATE allowed
 * - No DELETE allowed
 * - All entries have cryptographic chain
 */

import * as crypto from 'crypto';
import { query } from '../database';
import { AuditEntry, AuditTile, CATO_INVARIANTS } from '@radiant/shared';

const TILE_SIZE = 1000; // Entries per tile

export class MerkleAuditService {
  private tileSize = TILE_SIZE;

  /**
   * Load tenant-specific configuration
   */
  async loadConfig(tenantId: string): Promise<void> {
    try {
      const result = await query(
        `SELECT tile_size FROM cato_tenant_config WHERE tenant_id = $1`,
        [tenantId]
      );

      if (result.rows.length > 0 && result.rows[0].tile_size) {
        this.tileSize = result.rows[0].tile_size;
      }
    } catch (error) {
      console.warn('[CATO Audit] Failed to load config, using defaults:', error);
    }
  }

  /**
   * Record an audit entry
   */
  async recordEntry(params: {
    tenantId: string;
    type: string;
    data: Record<string, unknown>;
    embedding?: number[];
  }): Promise<{ entryId: string; merkleHash: string }> {
    const { tenantId, type, data, embedding } = params;

    // Get the previous hash for chain integrity
    const previousHash = await this.getPreviousHash(tenantId);

    // Compute merkle hash
    const entryContent = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };
    const merkleHash = this.computeHash(previousHash, entryContent);

    // Get or create current tile
    const tile = await this.getOrCreateCurrentTile(tenantId);

    // Insert entry (APPEND ONLY - no update/delete allowed by database policy)
    const result = await query(
      `INSERT INTO cato_audit_trail (
        tenant_id, tile_id, entry_type, entry_content, 
        previous_hash, merkle_hash, embedding
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id`,
      [
        tenantId,
        tile.id,
        type,
        JSON.stringify(entryContent),
        previousHash,
        merkleHash,
        embedding ? JSON.stringify(embedding) : null,
      ]
    );

    // Update tile entry count
    await query(
      `UPDATE cato_audit_tiles 
       SET entry_count = entry_count + 1, 
           last_sequence = (SELECT MAX(sequence_number) FROM cato_audit_trail WHERE tile_id = $1)
       WHERE id = $1`,
      [tile.id]
    );

    // Check if tile should be finalized
    await this.checkTileFinalization(tile.id);

    return {
      entryId: result.rows[0].id,
      merkleHash,
    };
  }

  /**
   * Get the previous hash for chain integrity
   */
  private async getPreviousHash(tenantId: string): Promise<string> {
    const result = await query(
      `SELECT merkle_hash FROM cato_audit_trail 
       WHERE tenant_id = $1 
       ORDER BY sequence_number DESC LIMIT 1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      // Genesis hash for first entry
      return crypto.createHash('sha256').update(`genesis:${tenantId}`).digest('hex');
    }

    return result.rows[0].merkle_hash;
  }

  /**
   * Compute merkle hash
   */
  private computeHash(previousHash: string, content: Record<string, unknown>): string {
    const data = `${previousHash}:${JSON.stringify(content)}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get or create current tile
   */
  private async getOrCreateCurrentTile(tenantId: string): Promise<AuditTile> {
    // Get current unfilled tile
    const result = await query(
      `SELECT * FROM cato_audit_tiles 
       WHERE tenant_id = $1 AND is_finalized = FALSE
       ORDER BY tile_number DESC LIMIT 1`,
      [tenantId]
    );

    if (result.rows.length > 0 && result.rows[0].entry_count < this.tileSize) {
      return this.mapRowToTile(result.rows[0]);
    }

    // Create new tile
    const nextTileNumber = result.rows.length > 0 ? result.rows[0].tile_number + 1 : 0;
    const previousTileRoot =
      result.rows.length > 0 ? result.rows[0].tile_root_hash : null;

    const newTile = await query(
      `INSERT INTO cato_audit_tiles (tenant_id, tile_number, previous_tile_root)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [tenantId, nextTileNumber, previousTileRoot]
    );

    return this.mapRowToTile(newTile.rows[0]);
  }

  /**
   * Check if tile should be finalized
   */
  private async checkTileFinalization(tileId: string): Promise<void> {
    const result = await query(
      `SELECT * FROM cato_audit_tiles WHERE id = $1`,
      [tileId]
    );

    if (result.rows.length === 0 || result.rows[0].entry_count < this.tileSize) {
      return;
    }

    // Compute tile root hash
    const entries = await query(
      `SELECT merkle_hash FROM cato_audit_trail 
       WHERE tile_id = $1 ORDER BY sequence_number`,
      [tileId]
    );

    const tileRootHash = this.computeTileRoot(
      entries.rows.map((r: Record<string, unknown>) => r.merkle_hash as string)
    );

    // Finalize tile
    await query(
      `UPDATE cato_audit_tiles 
       SET is_finalized = TRUE, finalized_at = NOW(), tile_root_hash = $1
       WHERE id = $2`,
      [tileRootHash, tileId]
    );
  }

  /**
   * Compute merkle root for a tile
   */
  private computeTileRoot(hashes: string[]): string {
    if (hashes.length === 0) {
      return '';
    }
    if (hashes.length === 1) {
      return hashes[0];
    }

    // Build merkle tree
    let level = hashes;
    while (level.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] || left; // Duplicate last if odd
        nextLevel.push(
          crypto.createHash('sha256').update(`${left}:${right}`).digest('hex')
        );
      }
      level = nextLevel;
    }

    return level[0];
  }

  /**
   * Verify chain integrity
   */
  async verifyChain(tenantId: string, fromSequence?: number): Promise<{
    isValid: boolean;
    lastValidSequence: number;
    errors: string[];
  }> {
    const result = await query(
      `SELECT * FROM cato_audit_trail 
       WHERE tenant_id = $1 ${fromSequence ? 'AND sequence_number >= $2' : ''}
       ORDER BY sequence_number`,
      fromSequence ? [tenantId, fromSequence] : [tenantId]
    );

    const errors: string[] = [];
    let lastValidSequence = 0;

    for (let i = 0; i < result.rows.length; i++) {
      const entry = result.rows[i];
      const expectedPrevious =
        i === 0
          ? await this.getPreviousHash(tenantId)
          : result.rows[i - 1].merkle_hash;

      // Verify previous hash matches
      if (entry.previous_hash !== expectedPrevious) {
        errors.push(
          `Sequence ${entry.sequence_number}: Previous hash mismatch`
        );
        break;
      }

      // Verify merkle hash
      const computedHash = this.computeHash(
        entry.previous_hash,
        JSON.parse(entry.entry_content)
      );
      if (computedHash !== entry.merkle_hash) {
        errors.push(`Sequence ${entry.sequence_number}: Merkle hash mismatch`);
        break;
      }

      lastValidSequence = entry.sequence_number;
    }

    return {
      isValid: errors.length === 0,
      lastValidSequence,
      errors,
    };
  }

  /**
   * Get audit entries by type
   */
  async getEntriesByType(
    tenantId: string,
    entryType: string,
    limit = 50,
    offset = 0
  ): Promise<AuditEntry[]> {
    const result = await query(
      `SELECT * FROM cato_audit_trail 
       WHERE tenant_id = $1 AND entry_type = $2
       ORDER BY sequence_number DESC
       LIMIT $3 OFFSET $4`,
      [tenantId, entryType, limit, offset]
    );

    return result.rows.map((row: Record<string, unknown>) => this.mapRowToEntry(row));
  }

  /**
   * Search entries by content
   */
  async searchEntries(
    tenantId: string,
    searchQuery: string,
    limit = 50
  ): Promise<AuditEntry[]> {
    const result = await query(
      `SELECT * FROM cato_audit_trail 
       WHERE tenant_id = $1 AND entry_content::text ILIKE $2
       ORDER BY timestamp DESC
       LIMIT $3`,
      [tenantId, `%${searchQuery}%`, limit]
    );

    return result.rows.map((row: Record<string, unknown>) => this.mapRowToEntry(row));
  }

  /**
   * Map database row to AuditEntry
   */
  private mapRowToEntry(row: Record<string, unknown>): AuditEntry {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      tileId: row.tile_id as string | undefined,
      sequenceNumber: parseInt(row.sequence_number as string),
      entryType: row.entry_type as string,
      entryContent:
        typeof row.entry_content === 'string'
          ? JSON.parse(row.entry_content)
          : row.entry_content as Record<string, unknown>,
      previousHash: row.previous_hash as string,
      merkleHash: row.merkle_hash as string,
      agentSignature: row.agent_signature as string | undefined,
      embedding: row.embedding as number[] | undefined,
      timestamp: row.timestamp as Date,
    };
  }

  /**
   * Map database row to AuditTile
   */
  private mapRowToTile(row: Record<string, unknown>): AuditTile {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      tileNumber: parseInt(row.tile_number as string),
      entryCount: row.entry_count as number,
      firstSequence: row.first_sequence as number | undefined,
      lastSequence: row.last_sequence as number | undefined,
      tileRootHash: row.tile_root_hash as string | undefined,
      previousTileRoot: row.previous_tile_root as string | undefined,
      isFinalized: row.is_finalized as boolean,
      finalizedAt: row.finalized_at as Date | undefined,
      createdAt: row.created_at as Date,
    };
  }
}

export const merkleAuditService = new MerkleAuditService();
