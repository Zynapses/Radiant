/**
 * RADIANT v4.18.0 - Log Tamper-Evident Verification Service
 *
 * Maintains a Merkle hash chain over immutable log archives.
 * Each new log_index entry for an immutable category gets a chain entry
 * linking its SHA-256 hash to the previous entry's hash → running Merkle root.
 *
 * Verification:
 *  - Single entry: re-hash the S3 object, compare to chain entry
 *  - Chain segment: verify sequential hash linkage
 *  - Full chain: verify entire chain from genesis to tip
 *
 * Used by compliance officers to prove logs have not been tampered with.
 */

import { Pool } from 'pg';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { LogCategory } from './log-retention-policy.service';

const REGION = process.env.AWS_REGION || 'us-east-1';
const s3Client = new S3Client({ region: REGION });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VerificationStatus = 'unverified' | 'valid' | 'tampered' | 'missing';

export interface MerkleChainEntry {
  id: string;
  logIndexId: string;
  sequenceNumber: number;
  entryHash: string;
  previousHash: string | null;
  merkleRoot: string;
  chainLength: number;
  category: LogCategory;
  windowStart: string;
  windowEnd: string;
  sourceId: string;
  byteSize: number;
  lastVerifiedAt: string | null;
  verifiedBy: string | null;
  verificationStatus: VerificationStatus;
  createdAt: string;
}

export interface VerificationResult {
  status: 'valid' | 'tampered' | 'error';
  entriesChecked: number;
  entriesValid: number;
  entriesTampered: number;
  entriesMissing: number;
  chainIntegrity: boolean;
  details: {
    sequenceNumber: number;
    logIndexId: string;
    status: VerificationStatus;
    expectedHash: string;
    actualHash: string | null;
    issue?: string;
  }[];
  verifiedAt: string;
  verifiedBy: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class LogTamperVerificationService {
  constructor(private pool: Pool) {}

  // =========================================================================
  // ADD ENTRY TO CHAIN (called by LogIndexerService after archiving)
  // =========================================================================

  async addToChain(logIndexId: string, sha256Hash: string): Promise<MerkleChainEntry> {
    // Get the log_index entry
    const indexResult = await this.pool.query(
      `SELECT * FROM log_index WHERE id = $1`, [logIndexId]
    );
    if (indexResult.rows.length === 0) throw new Error(`log_index entry ${logIndexId} not found`);
    const entry = indexResult.rows[0];

    // Get the latest chain entry (for previous hash and sequence)
    const latestResult = await this.pool.query(
      `SELECT * FROM log_merkle_chain ORDER BY sequence_number DESC LIMIT 1`
    );
    const latest = latestResult.rows[0];
    const previousHash = latest ? latest.merkle_root as string : null;
    const nextSequence = latest ? (latest.sequence_number as number) + 1 : 1;
    const chainLength = latest ? (latest.chain_length as number) + 1 : 1;

    // Compute Merkle root: SHA-256(previousRoot || entryHash)
    const merkleInput = previousHash ? `${previousHash}${sha256Hash}` : sha256Hash;
    const merkleRoot = createHash('sha256').update(merkleInput).digest('hex');

    const insertResult = await this.pool.query(
      `INSERT INTO log_merkle_chain (
        log_index_id, sequence_number, entry_hash, previous_hash, merkle_root,
        chain_length, category, window_start, window_end, source_id, byte_size
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::log_category, $8, $9, $10, $11)
      RETURNING *`,
      [
        logIndexId, nextSequence, sha256Hash, previousHash, merkleRoot,
        chainLength, entry.category, entry.window_start, entry.window_end,
        entry.source_id, entry.byte_size,
      ]
    );

    return this.mapEntry(insertResult.rows[0]);
  }

  // =========================================================================
  // VERIFY SINGLE ENTRY
  // =========================================================================

  async verifySingleEntry(logIndexId: string, verifiedBy: string): Promise<VerificationResult> {
    const chainEntry = await this.pool.query(
      `SELECT * FROM log_merkle_chain WHERE log_index_id = $1`, [logIndexId]
    );
    if (chainEntry.rows.length === 0) {
      return {
        status: 'error', entriesChecked: 0, entriesValid: 0, entriesTampered: 0,
        entriesMissing: 1, chainIntegrity: false, details: [{
          sequenceNumber: 0, logIndexId, status: 'missing',
          expectedHash: '', actualHash: null, issue: 'No Merkle chain entry for this log index',
        }],
        verifiedAt: new Date().toISOString(), verifiedBy,
      };
    }

    const entry = chainEntry.rows[0];
    const indexResult = await this.pool.query(
      `SELECT * FROM log_index WHERE id = $1`, [logIndexId]
    );
    const logEntry = indexResult.rows[0];

    let actualHash: string | null = null;
    let status: VerificationStatus = 'unverified';

    if (logEntry.s3_bucket && logEntry.s3_key) {
      try {
        const obj = await s3Client.send(new GetObjectCommand({
          Bucket: logEntry.s3_bucket as string,
          Key: logEntry.s3_key as string,
        }));
        if (obj.Body) {
          const bodyBytes = await obj.Body.transformToByteArray();
          actualHash = createHash('sha256').update(bodyBytes).digest('hex');
          status = actualHash === entry.entry_hash ? 'valid' : 'tampered';
        }
      } catch {
        status = 'missing';
      }
    } else {
      status = 'missing';
    }

    // Update chain entry
    await this.pool.query(
      `UPDATE log_merkle_chain SET
        last_verified_at = NOW(), verified_by = $1, verification_status = $2
      WHERE id = $3`,
      [verifiedBy, status, entry.id]
    );

    return {
      status: status === 'valid' ? 'valid' : 'tampered',
      entriesChecked: 1,
      entriesValid: status === 'valid' ? 1 : 0,
      entriesTampered: status === 'tampered' ? 1 : 0,
      entriesMissing: status === 'missing' ? 1 : 0,
      chainIntegrity: status === 'valid',
      details: [{
        sequenceNumber: entry.sequence_number as number,
        logIndexId,
        status,
        expectedHash: entry.entry_hash as string,
        actualHash,
        issue: status === 'tampered' ? 'Hash mismatch — archive has been modified' :
               status === 'missing' ? 'Archive not accessible for verification' : undefined,
      }],
      verifiedAt: new Date().toISOString(),
      verifiedBy,
    };
  }

  // =========================================================================
  // VERIFY CHAIN SEGMENT
  // =========================================================================

  async verifyChainSegment(
    startSequence: number,
    endSequence: number,
    verifiedBy: string
  ): Promise<VerificationResult> {
    const entries = await this.pool.query(
      `SELECT * FROM log_merkle_chain
       WHERE sequence_number >= $1 AND sequence_number <= $2
       ORDER BY sequence_number ASC`,
      [startSequence, endSequence]
    );

    const details: VerificationResult['details'] = [];
    let chainValid = true;
    let valid = 0;
    let tampered = 0;
    let missing = 0;

    for (let i = 0; i < entries.rows.length; i++) {
      const entry = entries.rows[i];
      const prevEntry = i > 0 ? entries.rows[i - 1] : null;

      // Verify hash linkage
      let linkageValid = true;
      if (prevEntry) {
        if (entry.previous_hash !== prevEntry.merkle_root) {
          linkageValid = false;
          chainValid = false;
        }
      } else if (entry.sequence_number > 1 && startSequence > 1) {
        // Need to check against the entry before our segment
        const prevFromDb = await this.pool.query(
          `SELECT merkle_root FROM log_merkle_chain WHERE sequence_number = $1`,
          [entry.sequence_number - 1]
        );
        if (prevFromDb.rows.length > 0 && entry.previous_hash !== prevFromDb.rows[0].merkle_root) {
          linkageValid = false;
          chainValid = false;
        }
      }

      // Verify Merkle root computation
      const expectedInput = entry.previous_hash
        ? `${entry.previous_hash}${entry.entry_hash}`
        : entry.entry_hash as string;
      const expectedRoot = createHash('sha256').update(expectedInput).digest('hex');
      const rootValid = expectedRoot === entry.merkle_root;

      if (!rootValid) {
        chainValid = false;
      }

      const entryStatus: VerificationStatus = (!linkageValid || !rootValid) ? 'tampered' : 'valid';

      if (entryStatus === 'valid') valid++;
      else tampered++;

      // Update chain entry
      await this.pool.query(
        `UPDATE log_merkle_chain SET
          last_verified_at = NOW(), verified_by = $1, verification_status = $2
        WHERE id = $3`,
        [verifiedBy, entryStatus, entry.id]
      );

      details.push({
        sequenceNumber: entry.sequence_number as number,
        logIndexId: entry.log_index_id as string,
        status: entryStatus,
        expectedHash: entry.entry_hash as string,
        actualHash: entry.entry_hash as string,
        issue: !linkageValid ? 'Hash chain linkage broken' :
               !rootValid ? 'Merkle root computation mismatch' : undefined,
      });
    }

    return {
      status: chainValid ? 'valid' : 'tampered',
      entriesChecked: entries.rows.length,
      entriesValid: valid,
      entriesTampered: tampered,
      entriesMissing: missing,
      chainIntegrity: chainValid,
      details,
      verifiedAt: new Date().toISOString(),
      verifiedBy,
    };
  }

  // =========================================================================
  // VERIFY FULL CHAIN
  // =========================================================================

  async verifyFullChain(verifiedBy: string): Promise<VerificationResult> {
    const tipResult = await this.pool.query(
      `SELECT MAX(sequence_number) as max_seq FROM log_merkle_chain`
    );
    const maxSeq = tipResult.rows[0]?.max_seq as number || 0;
    if (maxSeq === 0) {
      return {
        status: 'valid', entriesChecked: 0, entriesValid: 0, entriesTampered: 0,
        entriesMissing: 0, chainIntegrity: true, details: [],
        verifiedAt: new Date().toISOString(), verifiedBy,
      };
    }
    return this.verifyChainSegment(1, maxSeq, verifiedBy);
  }

  // =========================================================================
  // GET CHAIN STATUS
  // =========================================================================

  async getChainStatus(): Promise<{
    chainLength: number;
    latestSequence: number;
    latestMerkleRoot: string | null;
    oldestEntry: string | null;
    newestEntry: string | null;
    unverifiedCount: number;
    tamperedCount: number;
    validCount: number;
    byCategory: Record<string, number>;
  }> {
    const stats = await this.pool.query(`
      SELECT
        COUNT(*) as chain_length,
        MAX(sequence_number) as latest_sequence,
        MIN(window_start) as oldest_entry,
        MAX(window_end) as newest_entry,
        SUM(CASE WHEN verification_status = 'unverified' THEN 1 ELSE 0 END) as unverified_count,
        SUM(CASE WHEN verification_status = 'tampered' THEN 1 ELSE 0 END) as tampered_count,
        SUM(CASE WHEN verification_status = 'valid' THEN 1 ELSE 0 END) as valid_count
      FROM log_merkle_chain
    `);

    const latest = await this.pool.query(
      `SELECT merkle_root FROM log_merkle_chain ORDER BY sequence_number DESC LIMIT 1`
    );

    const byCat = await this.pool.query(
      `SELECT category, COUNT(*) as cnt FROM log_merkle_chain GROUP BY category`
    );
    const byCategory: Record<string, number> = {};
    for (const r of byCat.rows) byCategory[r.category as string] = parseInt(r.cnt as string);

    const s = stats.rows[0];
    return {
      chainLength: parseInt(s.chain_length as string) || 0,
      latestSequence: parseInt(s.latest_sequence as string) || 0,
      latestMerkleRoot: latest.rows[0]?.merkle_root as string || null,
      oldestEntry: s.oldest_entry ? (s.oldest_entry as Date).toISOString() : null,
      newestEntry: s.newest_entry ? (s.newest_entry as Date).toISOString() : null,
      unverifiedCount: parseInt(s.unverified_count as string) || 0,
      tamperedCount: parseInt(s.tampered_count as string) || 0,
      validCount: parseInt(s.valid_count as string) || 0,
      byCategory,
    };
  }

  // =========================================================================
  // MAPPER
  // =========================================================================

  private mapEntry(row: Record<string, unknown>): MerkleChainEntry {
    return {
      id: row.id as string,
      logIndexId: row.log_index_id as string,
      sequenceNumber: row.sequence_number as number,
      entryHash: row.entry_hash as string,
      previousHash: row.previous_hash as string | null,
      merkleRoot: row.merkle_root as string,
      chainLength: row.chain_length as number,
      category: row.category as LogCategory,
      windowStart: (row.window_start as Date).toISOString(),
      windowEnd: (row.window_end as Date).toISOString(),
      sourceId: row.source_id as string,
      byteSize: parseInt(row.byte_size as string) || 0,
      lastVerifiedAt: row.last_verified_at ? (row.last_verified_at as Date).toISOString() : null,
      verifiedBy: row.verified_by as string | null,
      verificationStatus: row.verification_status as VerificationStatus,
      createdAt: (row.created_at as Date).toISOString(),
    };
  }
}
