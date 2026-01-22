/**
 * Cato Merkle Chain Service
 * 
 * Maintains audit integrity through cryptographic hash chains.
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { CatoMerkleEntry } from '@radiant/shared';

export class CatoMerkleService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async addEntry(
    tenantId: string,
    recordType: string,
    recordId: string,
    recordData: Record<string, unknown>,
    pipelineId?: string
  ): Promise<CatoMerkleEntry> {
    const id = uuidv4();
    const recordHash = this.hashRecord(recordData);

    // Get the previous hash
    const prevResult = await this.pool.query(
      `SELECT merkle_root FROM cato_merkle_entries
       WHERE tenant_id = $1
       ORDER BY sequence_number DESC LIMIT 1`,
      [tenantId]
    );

    const previousHash = prevResult.rows.length > 0 
      ? prevResult.rows[0].merkle_root 
      : '0'.repeat(64);

    // Calculate new merkle root
    const merkleRoot = this.calculateMerkleRoot(previousHash, recordHash);

    const result = await this.pool.query(
      `INSERT INTO cato_merkle_entries (
        id, tenant_id, pipeline_id, record_type, record_id,
        record_hash, previous_hash, merkle_root
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [id, tenantId, pipelineId, recordType, recordId, recordHash, previousHash, merkleRoot]
    );

    return this.mapRowToEntry(result.rows[0]);
  }

  async verifyChain(tenantId: string, fromSequence?: number, toSequence?: number): Promise<{ valid: boolean; brokenAt?: number; error?: string }> {
    const conditions = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIdx = 2;

    if (fromSequence !== undefined) {
      conditions.push(`sequence_number >= $${paramIdx++}`);
      params.push(fromSequence);
    }
    if (toSequence !== undefined) {
      conditions.push(`sequence_number <= $${paramIdx++}`);
      params.push(toSequence);
    }

    const result = await this.pool.query(
      `SELECT * FROM cato_merkle_entries
       WHERE ${conditions.join(' AND ')}
       ORDER BY sequence_number ASC`,
      params
    );

    if (result.rows.length === 0) {
      return { valid: true };
    }

    for (let i = 1; i < result.rows.length; i++) {
      const current = result.rows[i];
      const previous = result.rows[i - 1];

      // Verify the chain linkage
      if (current.previous_hash !== previous.merkle_root) {
        return {
          valid: false,
          brokenAt: current.sequence_number,
          error: `Chain broken at sequence ${current.sequence_number}: previous_hash mismatch`,
        };
      }

      // Verify merkle root calculation
      const expectedRoot = this.calculateMerkleRoot(current.previous_hash, current.record_hash);
      if (current.merkle_root !== expectedRoot) {
        return {
          valid: false,
          brokenAt: current.sequence_number,
          error: `Chain broken at sequence ${current.sequence_number}: merkle_root mismatch`,
        };
      }
    }

    // Mark entries as verified
    await this.pool.query(
      `UPDATE cato_merkle_entries SET verified = true, verified_at = NOW()
       WHERE tenant_id = $1 AND sequence_number >= $2 AND sequence_number <= $3`,
      [tenantId, result.rows[0].sequence_number, result.rows[result.rows.length - 1].sequence_number]
    );

    return { valid: true };
  }

  async getEntry(tenantId: string, sequenceNumber: number): Promise<CatoMerkleEntry | null> {
    const result = await this.pool.query(
      `SELECT * FROM cato_merkle_entries WHERE tenant_id = $1 AND sequence_number = $2`,
      [tenantId, sequenceNumber]
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntry(result.rows[0]);
  }

  async getEntriesByRecord(tenantId: string, recordType: string, recordId: string): Promise<CatoMerkleEntry[]> {
    const result = await this.pool.query(
      `SELECT * FROM cato_merkle_entries
       WHERE tenant_id = $1 AND record_type = $2 AND record_id = $3
       ORDER BY sequence_number ASC`,
      [tenantId, recordType, recordId]
    );
    return result.rows.map(row => this.mapRowToEntry(row));
  }

  async getLatestEntry(tenantId: string): Promise<CatoMerkleEntry | null> {
    const result = await this.pool.query(
      `SELECT * FROM cato_merkle_entries
       WHERE tenant_id = $1
       ORDER BY sequence_number DESC LIMIT 1`,
      [tenantId]
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntry(result.rows[0]);
  }

  async generateProof(tenantId: string, sequenceNumber: number): Promise<{ path: string[]; root: string } | null> {
    const entry = await this.getEntry(tenantId, sequenceNumber);
    if (!entry) return null;

    // For a linear chain, the proof is the path of hashes from the entry to the current root
    const result = await this.pool.query(
      `SELECT merkle_root FROM cato_merkle_entries
       WHERE tenant_id = $1 AND sequence_number >= $2
       ORDER BY sequence_number ASC`,
      [tenantId, sequenceNumber]
    );

    const path = result.rows.map(r => r.merkle_root);
    const root = path[path.length - 1];

    return { path, root };
  }

  private hashRecord(data: Record<string, unknown>): string {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  private calculateMerkleRoot(previousHash: string, recordHash: string): string {
    return crypto.createHash('sha256').update(previousHash + recordHash).digest('hex');
  }

  private mapRowToEntry(row: Record<string, unknown>): CatoMerkleEntry {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      pipelineId: row.pipeline_id as string | undefined,
      sequenceNumber: row.sequence_number as number,
      recordType: row.record_type as string,
      recordId: row.record_id as string,
      recordHash: row.record_hash as string,
      previousHash: row.previous_hash as string,
      merkleRoot: row.merkle_root as string,
      verified: row.verified as boolean,
      verifiedAt: row.verified_at ? new Date(row.verified_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
    };
  }
}

export const createCatoMerkleService = (pool: Pool): CatoMerkleService => new CatoMerkleService(pool);
