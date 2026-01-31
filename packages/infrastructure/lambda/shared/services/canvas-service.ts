import { executeStatement, toSqlParams } from '../db/client';
import { s3ContentOffloadService } from './s3-content-offload.service';

export type ArtifactType = 'code' | 'markdown' | 'mermaid' | 'html' | 'svg' | 'json' | 'table';

export interface ArtifactCreate {
  type: ArtifactType;
  title?: string;
  content: string;
  language?: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface Canvas {
  id: string;
  tenantId: string;
  userId: string;
  chatId?: string;
  canvasName?: string;
  canvasType: string;
  content: Record<string, unknown>;
  version: number;
  isPublished: boolean;
  publishedUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  artifacts?: Artifact[];
}

export interface Artifact {
  id: string;
  canvasId: string;
  artifactType: ArtifactType;
  title?: string;
  content: string;
  language?: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  zIndex: number;
  isCollapsed: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArtifactVersion {
  id: string;
  artifactId: string;
  version: number;
  content: string;
  createdBy?: string;
  createdByEmail?: string;
  createdAt: Date;
}

export class CanvasService {
  async createCanvas(
    tenantId: string,
    userId: string,
    options?: { name?: string; chatId?: string; type?: string }
  ): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO canvases (tenant_id, user_id, canvas_name, chat_id, canvas_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'canvasName', value: options?.name ? { stringValue: options.name } : { isNull: true } },
        { name: 'chatId', value: options?.chatId ? { stringValue: options.chatId } : { isNull: true } },
        { name: 'canvasType', value: { stringValue: options?.type || 'general' } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>)?.id || '');
  }

  async addArtifact(canvasId: string, artifact: ArtifactCreate, createdBy?: string, tenantId?: string): Promise<string> {
    // Get tenantId from canvas if not provided
    let effectiveTenantId = tenantId;
    if (!effectiveTenantId) {
      const canvasResult = await executeStatement(
        `SELECT tenant_id FROM canvases WHERE id = $1`,
        [{ name: 'canvasId', value: { stringValue: canvasId } }]
      );
      effectiveTenantId = String((canvasResult.rows[0] as Record<string, unknown>)?.tenant_id || 'default');
    }

    // Offload large artifact content to S3
    let storedContent = artifact.content;
    let s3Key: string | null = null;
    
    if (artifact.content.length > 10000) {
      const tempId = `art_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const offloadResult = await s3ContentOffloadService.offloadContent(
        effectiveTenantId,
        'artifacts',
        tempId,
        artifact.content,
        artifact.type === 'code' ? 'text/plain' : 'text/html'
      );
      if (offloadResult) {
        s3Key = offloadResult.s3_key;
        storedContent = `[S3:${offloadResult.s3_key}]`; // Placeholder - actual content in S3
      }
    }

    const result = await executeStatement(
      `INSERT INTO artifacts (canvas_id, artifact_type, title, content, s3_key, language, position_x, position_y, width, height)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        { name: 'canvasId', value: { stringValue: canvasId } },
        { name: 'artifactType', value: { stringValue: artifact.type } },
        { name: 'title', value: artifact.title ? { stringValue: artifact.title } : { isNull: true } },
        { name: 'content', value: { stringValue: storedContent } },
        { name: 's3Key', value: s3Key ? { stringValue: s3Key } : { isNull: true } },
        { name: 'language', value: artifact.language ? { stringValue: artifact.language } : { isNull: true } },
        { name: 'positionX', value: { longValue: artifact.position?.x || 0 } },
        { name: 'positionY', value: { longValue: artifact.position?.y || 0 } },
        { name: 'width', value: { longValue: artifact.size?.width || 400 } },
        { name: 'height', value: { longValue: artifact.size?.height || 300 } },
      ]
    );

    const artifactId = String((result.rows[0] as Record<string, unknown>)?.id || '');

    // Store version with S3 reference if applicable
    await executeStatement(
      `INSERT INTO artifact_versions (artifact_id, version, content, s3_key, created_by)
       VALUES ($1, 1, $2, $3, $4)`,
      [
        { name: 'artifactId', value: { stringValue: artifactId } },
        { name: 'content', value: { stringValue: storedContent } },
        { name: 's3Key', value: s3Key ? { stringValue: s3Key } : { isNull: true } },
        { name: 'createdBy', value: createdBy ? { stringValue: createdBy } : { isNull: true } },
      ]
    );

    return artifactId;
  }

  async updateArtifact(artifactId: string, content: string, updatedBy?: string): Promise<void> {
    const current = await executeStatement(
      `SELECT COALESCE(MAX(version), 0) as max_version FROM artifact_versions WHERE artifact_id = $1`,
      [{ name: 'artifactId', value: { stringValue: artifactId } }]
    );
    const newVersion = Number((current.rows[0] as Record<string, unknown>)?.max_version || 0) + 1;

    await executeStatement(
      `UPDATE artifacts SET content = $2, updated_at = NOW() WHERE id = $1`,
      [
        { name: 'artifactId', value: { stringValue: artifactId } },
        { name: 'content', value: { stringValue: content } },
      ]
    );

    await executeStatement(
      `INSERT INTO artifact_versions (artifact_id, version, content, created_by)
       VALUES ($1, $2, $3, $4)`,
      [
        { name: 'artifactId', value: { stringValue: artifactId } },
        { name: 'version', value: { longValue: newVersion } },
        { name: 'content', value: { stringValue: content } },
        { name: 'createdBy', value: updatedBy ? { stringValue: updatedBy } : { isNull: true } },
      ]
    );
  }

  async getCanvas(canvasId: string): Promise<Canvas | null> {
    const canvasResult = await executeStatement(
      `SELECT * FROM canvases WHERE id = $1`,
      [{ name: 'canvasId', value: { stringValue: canvasId } }]
    );

    if (canvasResult.rows.length === 0) return null;

    const artifactsResult = await executeStatement(
      `SELECT * FROM artifacts WHERE canvas_id = $1 ORDER BY z_index`,
      [{ name: 'canvasId', value: { stringValue: canvasId } }]
    );

    const canvas = canvasResult.rows[0] as unknown as Canvas;
    canvas.artifacts = artifactsResult.rows as unknown as Artifact[];

    return canvas;
  }

  async getUserCanvases(tenantId: string, userId: string, limit: number = 50): Promise<Canvas[]> {
    const result = await executeStatement(
      `SELECT c.*, 
              (SELECT COUNT(*) FROM artifacts WHERE canvas_id = c.id) as artifact_count
       FROM canvases c
       WHERE c.tenant_id = $1 AND c.user_id = $2
       ORDER BY c.updated_at DESC
       LIMIT $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows as unknown as Canvas[];
  }

  async getArtifactVersions(artifactId: string): Promise<ArtifactVersion[]> {
    const result = await executeStatement(
      `SELECT av.*, u.email as created_by_email
       FROM artifact_versions av
       LEFT JOIN users u ON av.created_by = u.id
       WHERE av.artifact_id = $1
       ORDER BY av.version DESC`,
      [{ name: 'artifactId', value: { stringValue: artifactId } }]
    );

    return result.rows as unknown as ArtifactVersion[];
  }

  async moveArtifact(artifactId: string, x: number, y: number): Promise<void> {
    await executeStatement(
      `UPDATE artifacts SET position_x = $2, position_y = $3, updated_at = NOW() WHERE id = $1`,
      [
        { name: 'artifactId', value: { stringValue: artifactId } },
        { name: 'x', value: { longValue: x } },
        { name: 'y', value: { longValue: y } },
      ]
    );
  }

  async resizeArtifact(artifactId: string, width: number, height: number): Promise<void> {
    await executeStatement(
      `UPDATE artifacts SET width = $2, height = $3, updated_at = NOW() WHERE id = $1`,
      [
        { name: 'artifactId', value: { stringValue: artifactId } },
        { name: 'width', value: { longValue: width } },
        { name: 'height', value: { longValue: height } },
      ]
    );
  }

  async updateArtifactZIndex(artifactId: string, zIndex: number): Promise<void> {
    await executeStatement(
      `UPDATE artifacts SET z_index = $2, updated_at = NOW() WHERE id = $1`,
      [
        { name: 'artifactId', value: { stringValue: artifactId } },
        { name: 'zIndex', value: { longValue: zIndex } },
      ]
    );
  }

  async toggleArtifactCollapse(artifactId: string, isCollapsed: boolean): Promise<void> {
    await executeStatement(
      `UPDATE artifacts SET is_collapsed = $2, updated_at = NOW() WHERE id = $1`,
      [
        { name: 'artifactId', value: { stringValue: artifactId } },
        { name: 'isCollapsed', value: { booleanValue: isCollapsed } },
      ]
    );
  }

  async deleteArtifact(artifactId: string): Promise<void> {
    await executeStatement(`DELETE FROM artifacts WHERE id = $1`, [
      { name: 'artifactId', value: { stringValue: artifactId } },
    ]);
  }

  async deleteCanvas(canvasId: string): Promise<void> {
    await executeStatement(`DELETE FROM canvases WHERE id = $1`, [
      { name: 'canvasId', value: { stringValue: canvasId } },
    ]);
  }

  async publishCanvas(canvasId: string): Promise<string> {
    const publishedUrl = `https://canvas.radiant.ai/${canvasId}`;

    await executeStatement(
      `UPDATE canvases SET is_published = true, published_url = $2, updated_at = NOW() WHERE id = $1`,
      [
        { name: 'canvasId', value: { stringValue: canvasId } },
        { name: 'publishedUrl', value: { stringValue: publishedUrl } },
      ]
    );

    return publishedUrl;
  }

  async unpublishCanvas(canvasId: string): Promise<void> {
    await executeStatement(
      `UPDATE canvases SET is_published = false, published_url = NULL, updated_at = NOW() WHERE id = $1`,
      [{ name: 'canvasId', value: { stringValue: canvasId } }]
    );
  }

  async duplicateCanvas(canvasId: string, newUserId: string): Promise<string> {
    const original = await this.getCanvas(canvasId);
    if (!original) throw new Error('Canvas not found');

    const newCanvasId = await this.createCanvas(original.tenantId, newUserId, {
      name: `${original.canvasName || 'Untitled'} (Copy)`,
      type: original.canvasType,
    });

    if (original.artifacts) {
      for (const artifact of original.artifacts) {
        await this.addArtifact(newCanvasId, {
          type: artifact.artifactType,
          title: artifact.title,
          content: artifact.content,
          language: artifact.language || undefined,
          position: { x: artifact.positionX, y: artifact.positionY },
          size: { width: artifact.width, height: artifact.height },
        });
      }
    }

    return newCanvasId;
  }
}

export const canvasService = new CanvasService();
