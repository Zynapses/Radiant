import { S3Client, CopyObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { executeStatement } from '../db/client';
import { createHash } from 'crypto';

type SnapshotTrigger = 
  | 'message_sent' | 'message_received' | 'message_edited' | 'message_deleted'
  | 'file_uploaded' | 'file_generated' | 'file_deleted'
  | 'chat_renamed' | 'restore_performed' | 'manual_snapshot';

type RestoreScope = 'full_chat' | 'single_message' | 'single_file' | 'message_range' | 'files_only';

interface SnapshotDetails {
  messageId?: string;
  fileId?: string;
  description?: string;
}

interface RestoreOptions {
  scope: RestoreScope;
  messageIds?: string[];
  fileIds?: string[];
}

export class TimeMachineService {
  private s3: S3Client;

  constructor() {
    this.s3 = new S3Client({});
  }

  async createSnapshot(
    chatId: string,
    tenantId: string,
    trigger: SnapshotTrigger,
    details?: SnapshotDetails
  ): Promise<string> {
    // Get current version
    const versionResult = await executeStatement(
      `SELECT COALESCE(MAX(version), 0) + 1 as next_version, 
              (SELECT id FROM time_machine_snapshots WHERE chat_id = $1 ORDER BY version DESC LIMIT 1) as previous_id
       FROM time_machine_snapshots WHERE chat_id = $1`,
      [{ name: 'chatId', value: { stringValue: chatId } }]
    );

    const row = versionResult.rows[0] as Record<string, unknown>;
    const nextVersion = parseInt(String(row?.next_version ?? 1), 10);
    const previousId = row?.previous_id as string | null;

    // Count current state
    const countResult = await executeStatement(
      `SELECT 
         (SELECT COUNT(*) FROM message_versions WHERE snapshot_id IN 
           (SELECT id FROM time_machine_snapshots WHERE chat_id = $1) AND is_active = true) as message_count,
         (SELECT COUNT(*) FROM media_vault WHERE chat_id = $1 AND status = 'active') as file_count`,
      [{ name: 'chatId', value: { stringValue: chatId } }]
    );

    const counts = countResult.rows[0] as Record<string, unknown>;
    const messageCount = parseInt(String(counts?.message_count ?? 0), 10);
    const fileCount = parseInt(String(counts?.file_count ?? 0), 10);

    // Generate checksum
    const checksum = createHash('sha256')
      .update(`${chatId}-${nextVersion}-${Date.now()}`)
      .digest('hex');

    const result = await executeStatement(
      `INSERT INTO time_machine_snapshots 
       (chat_id, tenant_id, version, trigger, trigger_details, message_count, file_count, previous_snapshot_id, checksum)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        { name: 'chatId', value: { stringValue: chatId } },
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'version', value: { longValue: nextVersion } },
        { name: 'trigger', value: { stringValue: trigger } },
        { name: 'triggerDetails', value: { stringValue: JSON.stringify(details || {}) } },
        { name: 'messageCount', value: { longValue: messageCount } },
        { name: 'fileCount', value: { longValue: fileCount } },
        { name: 'previousId', value: previousId ? { stringValue: previousId } : { isNull: true } },
        { name: 'checksum', value: { stringValue: checksum } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>)?.id || '');
  }

  async getSnapshots(
    chatId: string,
    limit: number = 50,
    before?: Date
  ): Promise<unknown[]> {
    let sql = `SELECT * FROM time_machine_snapshots WHERE chat_id = $1`;
    const params = [{ name: 'chatId', value: { stringValue: chatId } }];

    if (before) {
      sql += ` AND timestamp < $2`;
      params.push({ name: 'before', value: { stringValue: before.toISOString() } });
    }

    sql += ` ORDER BY version DESC LIMIT ${limit}`;

    const result = await executeStatement(sql, params);
    return result.rows;
  }

  async getSnapshotsByDate(chatId: string, date: Date): Promise<unknown[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await executeStatement(
      `SELECT * FROM time_machine_snapshots 
       WHERE chat_id = $1 AND timestamp >= $2 AND timestamp <= $3
       ORDER BY version DESC`,
      [
        { name: 'chatId', value: { stringValue: chatId } },
        { name: 'startOfDay', value: { stringValue: startOfDay.toISOString() } },
        { name: 'endOfDay', value: { stringValue: endOfDay.toISOString() } },
      ]
    );

    return result.rows;
  }

  async saveMessageVersion(
    messageId: string,
    tenantId: string,
    snapshotId: string,
    content: string,
    role: 'user' | 'assistant' | 'system',
    modelId?: string
  ): Promise<string> {
    // Get next version for this message
    const versionResult = await executeStatement(
      `SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM message_versions WHERE message_id = $1`,
      [{ name: 'messageId', value: { stringValue: messageId } }]
    );

    const nextVersion = parseInt(String((versionResult.rows[0] as Record<string, unknown>)?.next_version ?? 1), 10);

    // Deactivate previous versions
    await executeStatement(
      `UPDATE message_versions SET is_active = false, superseded_at = NOW() WHERE message_id = $1 AND is_active = true`,
      [{ name: 'messageId', value: { stringValue: messageId } }]
    );

    const result = await executeStatement(
      `INSERT INTO message_versions 
       (message_id, tenant_id, snapshot_id, content, role, model_id, version, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING id`,
      [
        { name: 'messageId', value: { stringValue: messageId } },
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'snapshotId', value: { stringValue: snapshotId } },
        { name: 'content', value: { stringValue: content } },
        { name: 'role', value: { stringValue: role } },
        { name: 'modelId', value: modelId ? { stringValue: modelId } : { isNull: true } },
        { name: 'version', value: { longValue: nextVersion } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>)?.id || '');
  }

  async getMessageHistory(messageId: string): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT * FROM message_versions WHERE message_id = $1 ORDER BY version DESC`,
      [{ name: 'messageId', value: { stringValue: messageId } }]
    );
    return result.rows;
  }

  async restoreToSnapshot(
    chatId: string,
    tenantId: string,
    userId: string,
    snapshotId: string,
    options: RestoreOptions
  ): Promise<string> {
    // Create a new snapshot to mark the restore
    const newSnapshotId = await this.createSnapshot(chatId, tenantId, 'restore_performed', {
      description: `Restored to snapshot ${snapshotId}`,
    });

    // Log the restore
    await executeStatement(
      `INSERT INTO restore_log (tenant_id, user_id, chat_id, source_snapshot_id, target_snapshot_id, restore_scope, restore_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'chatId', value: { stringValue: chatId } },
        { name: 'sourceSnapshotId', value: { stringValue: snapshotId } },
        { name: 'targetSnapshotId', value: { stringValue: newSnapshotId } },
        { name: 'restoreScope', value: { stringValue: options.scope } },
        { name: 'restoreDetails', value: { stringValue: JSON.stringify(options) } },
      ]
    );

    if (options.scope === 'full_chat') {
      // Restore all messages from the target snapshot
      await executeStatement(
        `UPDATE message_versions SET is_active = false WHERE message_id IN (
           SELECT DISTINCT message_id FROM message_versions 
           WHERE snapshot_id IN (SELECT id FROM time_machine_snapshots WHERE chat_id = $1)
         )`,
        [{ name: 'chatId', value: { stringValue: chatId } }]
      );

      await executeStatement(
        `UPDATE message_versions SET is_active = true 
         WHERE snapshot_id = $1 AND is_soft_deleted = false`,
        [{ name: 'snapshotId', value: { stringValue: snapshotId } }]
      );
    }

    return newSnapshotId;
  }

  async saveFile(
    chatId: string,
    tenantId: string,
    snapshotId: string,
    file: {
      originalName: string;
      displayName: string;
      s3Bucket: string;
      s3Key: string;
      s3VersionId?: string;
      mimeType: string;
      sizeBytes: number;
      checksumSha256: string;
      source: 'user_upload' | 'ai_generated' | 'system';
      messageId?: string;
    }
  ): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO media_vault 
       (chat_id, tenant_id, snapshot_id, message_id, original_name, display_name, 
        s3_bucket, s3_key, s3_version_id, mime_type, size_bytes, checksum_sha256, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        { name: 'chatId', value: { stringValue: chatId } },
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'snapshotId', value: { stringValue: snapshotId } },
        { name: 'messageId', value: file.messageId ? { stringValue: file.messageId } : { isNull: true } },
        { name: 'originalName', value: { stringValue: file.originalName } },
        { name: 'displayName', value: { stringValue: file.displayName } },
        { name: 's3Bucket', value: { stringValue: file.s3Bucket } },
        { name: 's3Key', value: { stringValue: file.s3Key } },
        { name: 's3VersionId', value: file.s3VersionId ? { stringValue: file.s3VersionId } : { isNull: true } },
        { name: 'mimeType', value: { stringValue: file.mimeType } },
        { name: 'sizeBytes', value: { longValue: file.sizeBytes } },
        { name: 'checksumSha256', value: { stringValue: file.checksumSha256 } },
        { name: 'source', value: { stringValue: file.source } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>)?.id || '');
  }

  async getFiles(chatId: string, includeDeleted: boolean = false): Promise<unknown[]> {
    const statusFilter = includeDeleted ? '' : `AND status = 'active'`;

    const result = await executeStatement(
      `SELECT * FROM media_vault WHERE chat_id = $1 ${statusFilter} ORDER BY created_at DESC`,
      [{ name: 'chatId', value: { stringValue: chatId } }]
    );

    return result.rows;
  }

  async softDeleteFile(fileId: string): Promise<void> {
    await executeStatement(
      `UPDATE media_vault SET status = 'soft_deleted' WHERE id = $1`,
      [{ name: 'fileId', value: { stringValue: fileId } }]
    );
  }

  async getRestoreHistory(chatId: string): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT rl.*, 
              ss.version as source_version, ss.timestamp as source_timestamp,
              ts.version as target_version, ts.timestamp as target_timestamp
       FROM restore_log rl
       JOIN time_machine_snapshots ss ON rl.source_snapshot_id = ss.id
       JOIN time_machine_snapshots ts ON rl.target_snapshot_id = ts.id
       WHERE rl.chat_id = $1
       ORDER BY rl.created_at DESC`,
      [{ name: 'chatId', value: { stringValue: chatId } }]
    );

    return result.rows;
  }
}

export const timeMachineService = new TimeMachineService();
