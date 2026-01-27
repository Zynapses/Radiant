/**
 * Cortex Stub Nodes Service
 * Zero-copy pointers to external data lake content
 */

import { S3Client, GetObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
// @ts-ignore - parquetjs has no type declarations
import * as parquet from 'parquetjs';
import { XMLParser } from 'fast-xml-parser';
import AdmZip from 'adm-zip';
import { enhancedLogger as logger } from '../../logging/enhanced-logger';
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
    const files: Array<{ uri: string; label: string; sizeBytes: number; lastModified: Date }> = [];
    
    // Parse mount connection string for bucket and prefix
    const connectionConfig = mount.connectionConfig as { bucket: string; prefix?: string; region?: string };
    const bucket = connectionConfig.bucket;
    const prefix = connectionConfig.prefix || '';
    
    let continuationToken: string | undefined;
    
    do {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });
      
      const response = await this.s3Client.send(command);
      
      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key && obj.Size !== undefined) {
            // Skip directories (keys ending with /)
            if (obj.Key.endsWith('/')) continue;
            
            const uri = `s3://${bucket}/${obj.Key}`;
            const label = obj.Key.split('/').pop() || obj.Key;
            
            files.push({
              uri,
              label,
              sizeBytes: obj.Size,
              lastModified: obj.LastModified || new Date(),
            });
          }
        }
      }
      
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
    
    return files;
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

  /**
   * Extract column names from CSV or Parquet files by reading the header
   */
  private async extractTableColumns(stubNode: StubNode): Promise<string[]> {
    const { uri, format } = stubNode.externalSource;
    
    if (format === 'csv') {
      // Fetch first 4KB of CSV to get header row
      const headContent = await this.fetchPartialContent(uri, 0, 4096);
      if (!headContent) return [];
      
      // Parse first line as header
      const firstNewline = headContent.indexOf('\n');
      const headerLine = firstNewline > 0 ? headContent.substring(0, firstNewline) : headContent;
      
      // Handle quoted CSV columns
      const columns: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of headerLine) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          columns.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      if (current) {
        columns.push(current.trim().replace(/^"|"$/g, '').replace(/\r$/, ''));
      }
      
      return columns;
    }
    
    if (format === 'parquet') {
      // Check cached metadata first
      const metadata = stubNode.extractedMetadata;
      if (metadata.columns) return metadata.columns;
      
      // Extract schema using parquetjs
      try {
        const fullContent = await this.fetchFullContent(stubNode.externalSource.uri);
        if (fullContent) {
          const reader = await parquet.ParquetReader.openBuffer(Buffer.from(fullContent));
          const schema = reader.getSchema();
          const columns = schema.fields.map((f: { name: string }) => f.name);
          await reader.close();
          return columns;
        }
      } catch (error) {
        logger.warn('Parquet schema extraction failed', { error });
      }
      return [];
    }
    
    return [];
  }

  /**
   * Estimate row count based on file size and format
   */
  private async estimateRowCount(stubNode: StubNode): Promise<number> {
    const { format, sizeBytes } = stubNode.externalSource;
    
    if (format === 'csv') {
      // Sample first 64KB to estimate average row size
      const sampleSize = Math.min(65536, sizeBytes);
      const sample = await this.fetchPartialContent(stubNode.externalSource.uri, 0, sampleSize);
      if (!sample) return 0;
      
      // Count newlines in sample
      const newlineCount = (sample.match(/\n/g) || []).length;
      if (newlineCount === 0) return 1;
      
      // Subtract 1 for header row, then extrapolate
      const avgRowSize = sampleSize / newlineCount;
      const estimatedRows = Math.floor(sizeBytes / avgRowSize) - 1; // -1 for header
      
      return Math.max(0, estimatedRows);
    }
    
    if (format === 'json') {
      // For JSONL, count newlines; for JSON arrays, parse structure
      const sample = await this.fetchPartialContent(stubNode.externalSource.uri, 0, 1024);
      if (!sample) return 0;
      
      // Check if it's JSONL (newline-delimited)
      if (sample.includes('\n') && sample.trim().startsWith('{')) {
        const newlineCount = (sample.match(/\n/g) || []).length;
        const avgRowSize = 1024 / newlineCount;
        return Math.floor(sizeBytes / avgRowSize);
      }
      
      // JSON array - would need full parse
      return 0;
    }
    
    if (format === 'parquet') {
      // Parquet stores row count in metadata footer
      // Average compressed row is ~100-500 bytes
      return Math.floor(sizeBytes / 200);
    }
    
    return 0;
  }

  /**
   * Extract page count from PDF or DOCX documents
   */
  private async extractPageCount(stubNode: StubNode): Promise<number> {
    const { uri, format, sizeBytes } = stubNode.externalSource;
    
    if (format === 'pdf') {
      // PDF page count is in the trailer - fetch last 1KB for /Count entry
      const tailContent = await this.fetchPartialContent(uri, Math.max(0, sizeBytes - 1024), 1024);
      if (!tailContent) return 0;
      
      // Look for /Count N pattern in PDF trailer
      const countMatch = tailContent.match(/\/Count\s+(\d+)/i);
      if (countMatch) {
        return parseInt(countMatch[1], 10);
      }
      
      // Fallback: estimate based on file size (avg PDF page ~50-100KB)
      return Math.max(1, Math.floor(sizeBytes / 75000));
    }
    
    if (format === 'docx') {
      // DOCX is a ZIP - page count is in docProps/app.xml
      try {
        const fullContent = await this.fetchFullContent(uri);
        if (fullContent) {
          const zip = new AdmZip(Buffer.from(fullContent));
          const appXmlEntry = zip.getEntry('docProps/app.xml');
          if (appXmlEntry) {
            const appXml = appXmlEntry.getData().toString('utf-8');
            const parser = new XMLParser();
            const parsed = parser.parse(appXml) as { Properties?: { Pages?: number } };
            if (parsed.Properties?.Pages) {
              return parsed.Properties.Pages;
            }
          }
        }
      } catch (error) {
        logger.warn('DOCX page extraction failed', { error });
      }
      // Fallback: estimate based on file size (avg DOCX page ~10-30KB)
      return Math.max(1, Math.floor(sizeBytes / 20000));
    }
    
    return 0;
  }

  /**
   * Extract named entities from document content using pattern matching
   */
  private async extractEntities(stubNode: StubNode): Promise<string[]> {
    const { uri, format } = stubNode.externalSource;
    const entities: Set<string> = new Set();
    
    // Fetch a sample of text content (first 32KB)
    let textContent = '';
    
    if (format === 'txt' || format === 'html' || format === 'csv' || format === 'json') {
      const content = await this.fetchPartialContent(uri, 0, 32768);
      textContent = content || '';
      
      // Strip HTML tags if HTML
      if (format === 'html') {
        textContent = textContent.replace(/<[^>]*>/g, ' ');
      }
    }
    
    if (!textContent) return [];
    
    // Extract email addresses
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = textContent.match(emailPattern) || [];
    emails.forEach(e => entities.add(`EMAIL:${e}`));
    
    // Extract URLs
    const urlPattern = /https?:\/\/[^\s<>"']+/g;
    const urls = textContent.match(urlPattern) || [];
    urls.slice(0, 10).forEach(u => entities.add(`URL:${u}`));
    
    // Extract phone numbers
    const phonePattern = /(?:\+?1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}/g;
    const phones = textContent.match(phonePattern) || [];
    phones.forEach(p => entities.add(`PHONE:${p}`));
    
    // Extract dates
    const datePattern = /\b(?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi;
    const dates = textContent.match(datePattern) || [];
    dates.slice(0, 20).forEach(d => entities.add(`DATE:${d}`));
    
    // Extract capitalized proper nouns (potential names/organizations)
    const properNounPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;
    const properNouns = textContent.match(properNounPattern) || [];
    properNouns.slice(0, 30).forEach(n => entities.add(`ENTITY:${n}`));
    
    return Array.from(entities).slice(0, 100);
  }

  /**
   * Extract keywords from document content using TF-IDF-like scoring
   */
  private async extractKeywords(stubNode: StubNode): Promise<string[]> {
    const { uri, format } = stubNode.externalSource;
    
    // Fetch content sample
    let textContent = '';
    if (format === 'txt' || format === 'html' || format === 'csv' || format === 'json') {
      const content = await this.fetchPartialContent(uri, 0, 65536);
      textContent = content || '';
      
      if (format === 'html') {
        textContent = textContent.replace(/<[^>]*>/g, ' ');
      }
    }
    
    if (!textContent) return [];
    
    // Tokenize and count word frequencies
    const words = textContent.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && w.length < 30);
    
    // Common stop words to filter out
    const stopWords = new Set([
      'that', 'this', 'with', 'from', 'have', 'been', 'were', 'they', 'will',
      'would', 'could', 'should', 'their', 'there', 'about', 'which', 'when',
      'what', 'where', 'than', 'then', 'these', 'those', 'other', 'some',
      'into', 'only', 'over', 'such', 'also', 'just', 'more', 'most', 'very'
    ]);
    
    // Count frequencies
    const freq: Map<string, number> = new Map();
    for (const word of words) {
      if (!stopWords.has(word)) {
        freq.set(word, (freq.get(word) || 0) + 1);
      }
    }
    
    // Sort by frequency and return top keywords
    const sorted = Array.from(freq.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([word]) => word);
    
    return sorted;
  }

  /**
   * Fetch full content from S3 (for small files that need complete parsing)
   */
  private async fetchFullContent(uri: string): Promise<Uint8Array | null> {
    const match = uri.match(/^s3:\/\/([^/]+)\/(.+)$/);
    if (!match) return null;
    
    const [, bucket, key] = match;
    
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      
      const response = await this.s3Client.send(command);
      if (!response.Body) return null;
      
      const chunks: Uint8Array[] = [];
      const reader = response.Body.transformToWebStream().getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      
      return combined;
    } catch (error) {
      logger.error('Failed to fetch full content', { uri, error });
      return null;
    }
  }

  /**
   * Fetch partial content from S3 using byte range
   */
  private async fetchPartialContent(uri: string, start: number, length: number): Promise<string | null> {
    const match = uri.match(/^s3:\/\/([^/]+)\/(.+)$/);
    if (!match) return null;
    
    const [, bucket, key] = match;
    
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        Range: `bytes=${start}-${start + length - 1}`,
      });
      
      const response = await this.s3Client.send(command);
      if (!response.Body) return null;
      
      // Convert stream to string
      const chunks: Uint8Array[] = [];
      const reader = response.Body.transformToWebStream().getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      
      return new TextDecoder().decode(combined);
    } catch (error) {
      logger.error('Failed to fetch partial content', { uri, error });
      return null;
    }
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
