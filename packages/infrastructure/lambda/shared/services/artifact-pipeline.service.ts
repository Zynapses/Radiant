// RADIANT v4.18.0 - Artifact Pipeline Service
// Manages file artifacts flowing through AGI execution pipeline

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { 
  FileArtifact, 
  ArtifactType,
  AGIResponse,
  SynthesizedResponse 
} from '../types/agi-response.types';

// ============================================================================
// Types
// ============================================================================

export interface ArtifactUploadRequest {
  planId: string;
  stepId: string;
  modelId: string;
  filename: string;
  mimeType: ArtifactType;
  content: Buffer | string;
  metadata?: Record<string, string>;
}

export interface ArtifactReference {
  artifactId: string;
  planId: string;
  stepId: string;
  filename: string;
  mimeType: ArtifactType;
  size: number;
  s3Key: string;
  checksum: string;
  createdAt: string;
  expiresAt: string;
}

export interface PipelineArtifacts {
  planId: string;
  artifacts: Map<string, ArtifactReference>;
  byStep: Map<string, string[]>;  // stepId -> artifactIds
  byType: Map<ArtifactType, string[]>;
}

export interface ArtifactSynthesisResult {
  mergedArtifacts: FileArtifact[];
  duplicatesRemoved: number;
  conflictsResolved: {
    artifactId: string;
    resolution: 'kept_primary' | 'kept_latest' | 'merged' | 'user_choice';
  }[];
}

// ============================================================================
// Artifact Pipeline Service
// ============================================================================

export class ArtifactPipelineService {
  private s3: S3Client;
  private bucketName: string;
  private urlExpirationSeconds: number;
  
  // In-memory cache for active pipelines (would be Redis in production)
  private activePipelines: Map<string, PipelineArtifacts> = new Map();

  constructor() {
    this.s3 = new S3Client({});
    this.bucketName = process.env.ARTIFACTS_BUCKET || 'radiant-artifacts';
    this.urlExpirationSeconds = parseInt(process.env.ARTIFACT_URL_EXPIRATION || '3600', 10);
  }

  // ============================================================================
  // Artifact Storage
  // ============================================================================

  async uploadArtifact(request: ArtifactUploadRequest): Promise<FileArtifact> {
    const artifactId = `art_${uuidv4()}`;
    const timestamp = new Date().toISOString();
    
    // Convert string content to Buffer if needed
    const buffer = typeof request.content === 'string' 
      ? Buffer.from(request.content, 'utf-8')
      : request.content;
    
    // Calculate checksum
    const checksum = createHash('sha256').update(buffer).digest('hex');
    
    // S3 key structure: tenant/plan/step/artifactId/filename
    const s3Key = `artifacts/${request.planId}/${request.stepId}/${artifactId}/${request.filename}`;
    
    // Upload to S3
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: request.mimeType,
      Metadata: {
        artifactId,
        planId: request.planId,
        stepId: request.stepId,
        modelId: request.modelId,
        checksum,
        ...request.metadata,
      },
    }));
    
    // Generate signed URL
    const url = await this.getSignedUrl(s3Key);
    const expiresAt = new Date(Date.now() + this.urlExpirationSeconds * 1000).toISOString();
    
    const artifact: FileArtifact = {
      type: 'file',
      artifactId,
      filename: request.filename,
      mimeType: request.mimeType,
      size: buffer.length,
      url,
      s3Key,
      checksum,
      metadata: request.metadata,
      generatedBy: {
        stepId: request.stepId,
        modelId: request.modelId,
        timestamp,
      },
      expiresAt,
    };
    
    // Track in pipeline
    this.trackArtifact(request.planId, request.stepId, artifact);
    
    return artifact;
  }

  async getArtifact(artifactId: string, planId: string): Promise<FileArtifact | null> {
    const pipeline = this.activePipelines.get(planId);
    if (!pipeline) return null;
    
    const ref = pipeline.artifacts.get(artifactId);
    if (!ref) return null;
    
    // Refresh signed URL if needed
    const url = await this.getSignedUrl(ref.s3Key);
    const expiresAt = new Date(Date.now() + this.urlExpirationSeconds * 1000).toISOString();
    
    return {
      type: 'file',
      artifactId: ref.artifactId,
      filename: ref.filename,
      mimeType: ref.mimeType,
      size: ref.size,
      url,
      s3Key: ref.s3Key,
      checksum: ref.checksum,
      generatedBy: {
        stepId: ref.stepId,
        modelId: '',  // Would need to fetch from metadata
        timestamp: ref.createdAt,
      },
      expiresAt,
    };
  }

  async downloadArtifactContent(artifactId: string, planId: string): Promise<Buffer | null> {
    const pipeline = this.activePipelines.get(planId);
    if (!pipeline) return null;
    
    const ref = pipeline.artifacts.get(artifactId);
    if (!ref) return null;
    
    const response = await this.s3.send(new GetObjectCommand({
      Bucket: this.bucketName,
      Key: ref.s3Key,
    }));
    
    if (!response.Body) return null;
    
    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async deleteArtifact(artifactId: string, planId: string): Promise<void> {
    const pipeline = this.activePipelines.get(planId);
    if (!pipeline) return;
    
    const ref = pipeline.artifacts.get(artifactId);
    if (!ref) return;
    
    await this.s3.send(new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: ref.s3Key,
    }));
    
    // Remove from tracking
    pipeline.artifacts.delete(artifactId);
    
    const stepArtifacts = pipeline.byStep.get(ref.stepId);
    if (stepArtifacts) {
      const index = stepArtifacts.indexOf(artifactId);
      if (index > -1) stepArtifacts.splice(index, 1);
    }
    
    const typeArtifacts = pipeline.byType.get(ref.mimeType);
    if (typeArtifacts) {
      const index = typeArtifacts.indexOf(artifactId);
      if (index > -1) typeArtifacts.splice(index, 1);
    }
  }

  // ============================================================================
  // Pipeline Management
  // ============================================================================

  initializePipeline(planId: string): void {
    this.activePipelines.set(planId, {
      planId,
      artifacts: new Map(),
      byStep: new Map(),
      byType: new Map(),
    });
  }

  private trackArtifact(planId: string, stepId: string, artifact: FileArtifact): void {
    let pipeline = this.activePipelines.get(planId);
    if (!pipeline) {
      this.initializePipeline(planId);
      pipeline = this.activePipelines.get(planId)!;
    }
    
    const ref: ArtifactReference = {
      artifactId: artifact.artifactId,
      planId,
      stepId,
      filename: artifact.filename,
      mimeType: artifact.mimeType,
      size: artifact.size,
      s3Key: artifact.s3Key || '',
      checksum: artifact.checksum || '',
      createdAt: artifact.generatedBy.timestamp,
      expiresAt: artifact.expiresAt || '',
    };
    
    pipeline.artifacts.set(artifact.artifactId, ref);
    
    // Track by step
    if (!pipeline.byStep.has(stepId)) {
      pipeline.byStep.set(stepId, []);
    }
    pipeline.byStep.get(stepId)!.push(artifact.artifactId);
    
    // Track by type
    if (!pipeline.byType.has(artifact.mimeType)) {
      pipeline.byType.set(artifact.mimeType, []);
    }
    pipeline.byType.get(artifact.mimeType)!.push(artifact.artifactId);
  }

  getStepArtifacts(planId: string, stepId: string): string[] {
    const pipeline = this.activePipelines.get(planId);
    if (!pipeline) return [];
    return pipeline.byStep.get(stepId) || [];
  }

  getPreviousStepArtifacts(planId: string, currentStepNumber: number, steps: { stepId: string; stepNumber: number }[]): string[] {
    const pipeline = this.activePipelines.get(planId);
    if (!pipeline) return [];
    
    const artifactIds: string[] = [];
    for (const step of steps) {
      if (step.stepNumber < currentStepNumber) {
        const stepArtifacts = pipeline.byStep.get(step.stepId) || [];
        artifactIds.push(...stepArtifacts);
      }
    }
    return artifactIds;
  }

  getAllArtifacts(planId: string): FileArtifact[] {
    const pipeline = this.activePipelines.get(planId);
    if (!pipeline) return [];
    
    return Array.from(pipeline.artifacts.values()).map(ref => ({
      type: 'file' as const,
      artifactId: ref.artifactId,
      filename: ref.filename,
      mimeType: ref.mimeType,
      size: ref.size,
      s3Key: ref.s3Key,
      checksum: ref.checksum,
      generatedBy: {
        stepId: ref.stepId,
        modelId: '',
        timestamp: ref.createdAt,
      },
      expiresAt: ref.expiresAt,
    }));
  }

  // ============================================================================
  // Artifact Synthesis (Multi-Model)
  // ============================================================================

  async synthesizeArtifacts(
    planId: string,
    responses: AGIResponse[],
    strategy: 'merge_all' | 'dedupe' | 'latest_wins' | 'primary_wins'
  ): Promise<ArtifactSynthesisResult> {
    const result: ArtifactSynthesisResult = {
      mergedArtifacts: [],
      duplicatesRemoved: 0,
      conflictsResolved: [],
    };
    
    // Collect all artifacts from all responses
    const allArtifacts: FileArtifact[] = [];
    for (const response of responses) {
      allArtifacts.push(...response.artifacts);
    }
    
    if (allArtifacts.length === 0) {
      return result;
    }
    
    // Group by filename to detect duplicates/conflicts
    const byFilename = new Map<string, FileArtifact[]>();
    for (const artifact of allArtifacts) {
      const existing = byFilename.get(artifact.filename) || [];
      existing.push(artifact);
      byFilename.set(artifact.filename, existing);
    }
    
    // Resolve each group
    for (const [filename, artifacts] of byFilename) {
      if (artifacts.length === 1) {
        // No conflict
        result.mergedArtifacts.push(artifacts[0]);
      } else {
        // Conflict - resolve based on strategy
        const resolved = this.resolveArtifactConflict(artifacts, strategy);
        result.mergedArtifacts.push(resolved.artifact);
        result.duplicatesRemoved += artifacts.length - 1;
        result.conflictsResolved.push({
          artifactId: resolved.artifact.artifactId,
          resolution: resolved.resolution,
        });
      }
    }
    
    return result;
  }

  private resolveArtifactConflict(
    artifacts: FileArtifact[],
    strategy: 'merge_all' | 'dedupe' | 'latest_wins' | 'primary_wins'
  ): { artifact: FileArtifact; resolution: 'kept_primary' | 'kept_latest' | 'merged' | 'user_choice' } {
    switch (strategy) {
      case 'primary_wins':
        // First artifact wins (from primary model)
        return { artifact: artifacts[0], resolution: 'kept_primary' };
        
      case 'latest_wins':
        // Most recent artifact wins
        const sorted = [...artifacts].sort((a, b) => 
          new Date(b.generatedBy.timestamp).getTime() - new Date(a.generatedBy.timestamp).getTime()
        );
        return { artifact: sorted[0], resolution: 'kept_latest' };
        
      case 'dedupe':
        // Keep artifact with unique checksum (first occurrence)
        const seen = new Set<string>();
        for (const artifact of artifacts) {
          if (!seen.has(artifact.checksum || '')) {
            seen.add(artifact.checksum || '');
            return { artifact, resolution: 'merged' };
          }
        }
        return { artifact: artifacts[0], resolution: 'kept_primary' };
        
      case 'merge_all':
      default:
        // For merge_all, we'd need to actually merge content
        // For now, keep primary
        return { artifact: artifacts[0], resolution: 'kept_primary' };
    }
  }

  // ============================================================================
  // Artifact Handoff Between Steps
  // ============================================================================

  async prepareArtifactsForStep(
    planId: string,
    stepId: string,
    requiredArtifactIds: string[]
  ): Promise<{ artifact: FileArtifact; content?: Buffer }[]> {
    const results: { artifact: FileArtifact; content?: Buffer }[] = [];
    
    for (const artifactId of requiredArtifactIds) {
      const artifact = await this.getArtifact(artifactId, planId);
      if (artifact) {
        // For small artifacts, include content directly
        if (artifact.size < 1024 * 1024) { // < 1MB
          const content = await this.downloadArtifactContent(artifactId, planId);
          results.push({ artifact, content: content || undefined });
        } else {
          // For large artifacts, just provide URL
          results.push({ artifact });
        }
      }
    }
    
    return results;
  }

  generateArtifactSummary(planId: string): string {
    const pipeline = this.activePipelines.get(planId);
    if (!pipeline || pipeline.artifacts.size === 0) {
      return 'No artifacts generated.';
    }
    
    const byType: Record<string, number> = {};
    let totalSize = 0;
    
    for (const ref of pipeline.artifacts.values()) {
      const category = ref.mimeType.split('/')[0];
      byType[category] = (byType[category] || 0) + 1;
      totalSize += ref.size;
    }
    
    const parts = [`${pipeline.artifacts.size} artifact(s) generated`];
    for (const [type, count] of Object.entries(byType)) {
      parts.push(`${count} ${type}`);
    }
    parts.push(`Total size: ${this.formatSize(totalSize)}`);
    
    return parts.join(' | ');
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async cleanupPipeline(planId: string): Promise<void> {
    const pipeline = this.activePipelines.get(planId);
    if (!pipeline) return;
    
    // Delete all artifacts from S3
    for (const ref of pipeline.artifacts.values()) {
      try {
        await this.s3.send(new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: ref.s3Key,
        }));
      } catch {
        // Ignore cleanup errors
      }
    }
    
    // Remove from memory
    this.activePipelines.delete(planId);
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private async getSignedUrl(s3Key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });
    return getSignedUrl(this.s3, command, { expiresIn: this.urlExpirationSeconds });
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}

// Singleton instance
export const artifactPipeline = new ArtifactPipelineService();
