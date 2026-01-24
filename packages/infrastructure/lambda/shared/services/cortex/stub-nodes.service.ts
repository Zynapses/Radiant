/**
 * Cortex Stub Nodes Service
 * Zero-copy pointers to external data lake content
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  StubNode,
  StubNodeExternalSource,
  StubNodeMetadata,
  StubNodeFormat,
  StubNodeFetchRequest,
  StubNodeFetchResponse,
  ContentRange,
  ZeroCopyMount,
} from '@radiant/shared';

interface DbClient {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
}

interface StubNodeCreateRequest {
  tenantId: string;
  mountId: string;
  label: string;
  description?: string;
  uri: string;
  format: StubNodeFormat;
  sizeBytes: number;
  lastModified?: Date;
  checksum?: string;
}

export class StubNodesService {
  private s3Client: S3Client;

  constructor(private db: DbClient) {
    this.s3Client = new S3Client({});
  }

  /**
   * Create a stub node pointing to external content
   */
  async createStubNode(request: StubNodeCreateRequest): Promise<StubNode> {
    const result = await this.db.query(
      `INSERT INTO cortex_stub_nodes (
        tenant_id, mount_id, label, description, uri, format, size_bytes, 
        last_modified, checksum, scan_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
      RETURNING *`,
      [
        request.tenantId,
        request.mountId,
        request.label,
        request.description || null,
        request.uri,
        request.format,
        request.sizeBytes,
        request.lastModified || null,
        request.checksum || null,
      ]
    );

    return this.mapRowToStubNode(result.rows[0]);
  }

  /**
   * Scan external storage and create stub nodes for all files
   */
  async scanMount(mountId: string, tenantId: string): Promise<{ created: number; updated: number; errors: string[] }> {
    const mountResult = await this.db.query(
      `SELECT * FROM cortex_zero_copy_mounts WHERE id = $1 AND tenant_id = $2`,
      [mountId, tenantId]
    );

    if (mountResult.rows.length === 0) {
      throw new Error(`Mount not found: ${mountId}`);
    }

    const mount = mountResult.rows[0] as ZeroCopyMount;
    const stats = { created: 0, updated: 0, errors: [] as string[] };

    try {
      // For S3 mounts, list and create stub nodes
      if (mount.sourceType === 's3') {
        const files = await this.listS3Files(mount);
        
        for (const file of files) {
          try {
            // Check if stub node already exists
            const existing = await this.db.query(
              `SELECT id FROM cortex_stub_nodes WHERE mount_id = $1 AND uri = $2`,
              [mountId, file.uri]
            );

            if (existing.rows.length > 0) {
              // Update existing
              await this.db.query(
                `UPDATE cortex_stub_nodes SET size_bytes = $1, last_modified = $2, updated_at = NOW()
                 WHERE id = $3`,
                [file.sizeBytes, file.lastModified, (existing.rows[0] as { id: string }).id]
              );
              stats.updated++;
            } else {
              // Create new
              await this.createStubNode({
                tenantId,
                mountId,
                label: file.label,
                uri: file.uri,
                format: this.detectFormat(file.uri),
                sizeBytes: file.sizeBytes,
                lastModified: file.lastModified,
              });
              stats.created++;
            }
          } catch (err) {
            stats.errors.push(`Error processing ${file.uri}: ${(err as Error).message}`);
          }
        }
      }

      // Update mount last sync time
      await this.db.query(
        `UPDATE cortex_zero_copy_mounts SET last_sync = NOW() WHERE id = $1`,
        [mountId]
      );
    } catch (err) {
      stats.errors.push(`Mount scan error: ${(err as Error).message}`);
    }

    return stats;
  }

  /**
   * Extract metadata from stub node content
   */
  async extractMetadata(stubNodeId: string, tenantId: string): Promise<StubNodeMetadata> {
    const stubNode = await this.getStubNode(stubNodeId, tenantId);
    if (!stubNode) {
      throw new Error(`Stub node not found: ${stubNodeId}`);
    }

    await this.db.query(
      `UPDATE cortex_stub_nodes SET scan_status = 'scanning' WHERE id = $1`,
      [stubNodeId]
    );

    try {
      const metadata: StubNodeMetadata = {};

      // Extract metadata based on format
      switch (stubNode.externalSource.format) {
        case 'csv':
        case 'parquet':
          // For tabular data, extract column names and row count
          metadata.columns = await this.extractTableColumns(stubNode);
          metadata.rowCount = await this.estimateRowCount(stubNode);
          break;
        case 'pdf':
        case 'docx':
          // For documents, extract page count and entity mentions
          metadata.pageCount = await this.extractPageCount(stubNode);
          metadata.entityMentions = await this.extractEntities(stubNode);
          break;
        default:
          // Basic metadata for other formats
          metadata.keywords = await this.extractKeywords(stubNode);
      }

      // Update stub node with extracted metadata
      await this.db.query(
        `UPDATE cortex_stub_nodes 
         SET extracted_metadata = $1, scan_status = 'complete', last_scanned_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(metadata), stubNodeId]
      );

      return metadata;
    } catch (err) {
      await this.db.query(
        `UPDATE cortex_stub_nodes SET scan_status = 'error', scan_error = $1 WHERE id = $2`,
        [(err as Error).message, stubNodeId]
      );
      throw err;
    }
  }

  /**
   * Generate signed URL for fetching specific content range
   */
  async fetchContent(request: StubNodeFetchRequest): Promise<StubNodeFetchResponse> {
    const stubNode = await this.getStubNode(request.stubNodeId, request.tenantId);
    if (!stubNode) {
      throw new Error(`Stub node not found: ${request.stubNodeId}`);
    }

    const mount = await this.getMount(stubNode.externalSource.mountId, request.tenantId);
    if (!mount) {
      throw new Error(`Mount not found: ${stubNode.externalSource.mountId}`);
    }

    // Generate signed URL based on mount type
    const ttl = request.ttlSeconds || 3600; // Default 1 hour
    let signedUrl: string;

    if (mount.sourceType === 's3') {
      signedUrl = await this.generateS3SignedUrl(
        stubNode.externalSource.uri,
        mount,
        ttl,
        request.range
      );
    } else {
      // For other sources, return direct URI (handled by application layer)
      signedUrl = stubNode.externalSource.uri;
    }

    const expiresAt = new Date(Date.now() + ttl * 1000);

    return {
      stubNodeId: request.stubNodeId,
      signedUrl,
      expiresAt,
      contentType: this.getContentType(stubNode.externalSource.format),
      range: request.range,
    };
  }

  /**
   * Connect stub node to warm tier graph nodes
   */
  async connectToGraphNodes(
    stubNodeId: string,
    graphNodeIds: string[],
    tenantId: string
  ): Promise<void> {
    await this.db.query(
      `UPDATE cortex_stub_nodes 
       SET connected_to = array_cat(connected_to, $1::uuid[]), updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [graphNodeIds, stubNodeId, tenantId]
    );
  }

  /**
   * Get stub node by ID
   */
  async getStubNode(stubNodeId: string, tenantId: string): Promise<StubNode | null> {
    const result = await this.db.query(
      `SELECT * FROM cortex_stub_nodes WHERE id = $1 AND tenant_id = $2`,
      [stubNodeId, tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToStubNode(result.rows[0]);
  }

  /**
   * List stub nodes for a mount
   */
  async listStubNodes(
    tenantId: string,
    options: { mountId?: string; format?: StubNodeFormat; limit?: number; offset?: number } = {}
  ): Promise<StubNode[]> {
    let sql = `SELECT * FROM cortex_stub_nodes WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];

    if (options.mountId) {
      params.push(options.mountId);
      sql += ` AND mount_id = $${params.length}`;
    }
    if (options.format) {
      params.push(options.format);
      sql += ` AND format = $${params.length}`;
    }

    sql += ` ORDER BY created_at DESC`;

    if (options.limit) {
      params.push(options.limit);
      sql += ` LIMIT $${params.length}`;
    }
    if (options.offset) {
      params.push(options.offset);
      sql += ` OFFSET $${params.length}`;
    }

    const result = await this.db.query(sql, params);
    return result.rows.map((row) => this.mapRowToStubNode(row));
  }

  /**
   * Find stub nodes connected to a graph node
   */
  async findConnectedStubNodes(graphNodeId: string, tenantId: string): Promise<StubNode[]> {
    const result = await this.db.query(
      `SELECT * FROM cortex_stub_nodes 
       WHERE tenant_id = $1 AND $2 = ANY(connected_to)
       ORDER BY created_at DESC`,
      [tenantId, graphNodeId]
    );

    return result.rows.map((row) => this.mapRowToStubNode(row));
  }

  // Private helper methods

  private async getMount(mountId: string, tenantId: string): Promise<ZeroCopyMount | null> {
    const result = await this.db.query(
      `SELECT * FROM cortex_zero_copy_mounts WHERE id = $1 AND tenant_id = $2`,
      [mountId, tenantId]
    );
    return result.rows.length > 0 ? (result.rows[0] as ZeroCopyMount) : null;
  }

  private async listS3Files(mount: ZeroCopyMount): Promise<Array<{ uri: string; label: string; sizeBytes: number; lastModified: Date }>> {
    // Implementation would use S3 ListObjectsV2
    // Simplified for now - actual implementation would paginate
    return [];
  }

  private async generateS3SignedUrl(
    uri: string,
    mount: ZeroCopyMount,
    ttl: number,
    range?: ContentRange
  ): Promise<string> {
    // Parse S3 URI
    const match = uri.match(/^s3:\/\/([^/]+)\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid S3 URI: ${uri}`);
    }

    const [, bucket, key] = match;

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: range ? `bytes=${range.start}-${range.end}` : undefined,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: ttl });
  }

  private detectFormat(uri: string): StubNodeFormat {
    const ext = uri.split('.').pop()?.toLowerCase();
    const formatMap: Record<string, StubNodeFormat> = {
      csv: 'csv',
      json: 'json',
      parquet: 'parquet',
      pdf: 'pdf',
      docx: 'docx',
      doc: 'docx',
      xlsx: 'xlsx',
      xls: 'xlsx',
      txt: 'txt',
      html: 'html',
      htm: 'html',
    };
    return formatMap[ext || ''] || 'txt';
  }

  private getContentType(format: StubNodeFormat): string {
    const contentTypes: Record<StubNodeFormat, string> = {
      csv: 'text/csv',
      json: 'application/json',
      parquet: 'application/octet-stream',
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      txt: 'text/plain',
      html: 'text/html',
    };
    return contentTypes[format];
  }

  // Placeholder methods for metadata extraction
  private async extractTableColumns(_stubNode: StubNode): Promise<string[]> {
    return []; // Would parse CSV header or Parquet schema
  }

  private async estimateRowCount(_stubNode: StubNode): Promise<number> {
    return 0; // Would estimate from file size
  }

  private async extractPageCount(_stubNode: StubNode): Promise<number> {
    return 0; // Would use PDF parser
  }

  private async extractEntities(_stubNode: StubNode): Promise<string[]> {
    return []; // Would use NLP entity extraction
  }

  private async extractKeywords(_stubNode: StubNode): Promise<string[]> {
    return []; // Would use keyword extraction
  }

  private mapRowToStubNode(row: unknown): StubNode {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      tenantId: r.tenant_id as string,
      nodeType: 'stub',
      label: r.label as string,
      description: r.description as string | undefined,
      externalSource: {
        mountId: r.mount_id as string,
        uri: r.uri as string,
        format: r.format as StubNodeFormat,
        sizeBytes: Number(r.size_bytes),
        lastModified: r.last_modified ? new Date(r.last_modified as string) : new Date(),
        checksum: r.checksum as string | undefined,
      },
      extractedMetadata: (r.extracted_metadata as StubNodeMetadata) || {},
      connectedTo: (r.connected_to as string[]) || [],
      lastScannedAt: r.last_scanned_at ? new Date(r.last_scanned_at as string) : new Date(),
      scanStatus: r.scan_status as StubNode['scanStatus'],
      scanError: r.scan_error as string | undefined,
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
    };
  }
}
