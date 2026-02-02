/**
 * RNIR (Radiant Neural Intermediate Representation) Service
 * 
 * Model-agnostic cognitive source code compilation service.
 * Compiles RNIR to LoRA weights, system prompts, or RAG chunks.
 * 
 * @version 1.0.0
 * @since v6.2.0
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { executeStatement } from '../db/client';
import { logger } from '../logging/enhanced-logger';
import crypto from 'crypto';

import type {
  RNIRDocument,
  RNIRExample,
  RNIRCompilationTarget,
  RNIRModelFamily,
  RNIRCompilationRequest,
  RNIRCompilationJob,
  RNIRCompiledArtifact,
  RNIRCompilationStatus,
  RNIRDashboard,
  RNIRDocumentPreview,
  GenerateRNIRRequest,
  GenerateRNIRResult,
  LoRACompilationSettings,
  SystemPromptCompilationSettings,
} from '@radiant/shared';

const s3Client = new S3Client({});
const RNIR_BUCKET = process.env.RNIR_BUCKET || process.env.ARTIFACTS_BUCKET || 'radiant-rnir';

export class CartridgeRNIRService {
  /**
   * Generate RNIR from Curator knowledge
   */
  async generateFromCurator(
    tenantId: string,
    request: GenerateRNIRRequest
  ): Promise<GenerateRNIRResult> {
    logger.info('Generating RNIR from Curator', { tenantId, cartridgeId: request.cartridgeId });

    // Fetch golden rules from Curator
    const rulesResult = await executeStatement(
      `SELECT domain, rule_text, example_input, example_output, quality_score
       FROM curator_golden_rules
       WHERE tenant_id = $1 AND cartridge_id = $2 AND is_active = true
       ${request.minQuality ? 'AND quality_score >= $3' : ''}
       ORDER BY domain, quality_score DESC`,
      request.minQuality ? [tenantId, request.cartridgeId, request.minQuality] : [tenantId, request.cartridgeId]
    );

    const examplesByDomain: Record<string, RNIRExample[]> = {};
    const warnings: string[] = [];

    for (const row of rulesResult.rows) {
      const r = row as Record<string, unknown>;
      const domain = (r.domain as string) || 'general';
      
      if (!examplesByDomain[domain]) {
        examplesByDomain[domain] = [];
      }

      if (request.maxExamplesPerDomain && examplesByDomain[domain].length >= request.maxExamplesPerDomain) {
        continue;
      }

      if (r.example_input && r.example_output) {
        examplesByDomain[domain].push({
          user: r.example_input as string,
          assistant: r.example_output as string,
          system: r.rule_text as string,
          domain,
          quality: r.quality_score as number,
          source: 'curator',
        });
      }
    }

    // Store RNIR documents per domain
    let totalExamples = 0;
    const exampleCounts: Record<string, number> = {};

    for (const [domain, examples] of Object.entries(examplesByDomain)) {
      if (examples.length === 0) continue;

      const document: RNIRDocument = {
        version: '1.0',
        cartridgeId: request.cartridgeId,
        domain,
        examples,
        exampleCount: examples.length,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        generatedBy: 'curator-extraction-v1',
      };

      // Store in S3 as JSONL
      const jsonl = examples.map(e => JSON.stringify(e)).join('\n');
      const s3Path = `${tenantId}/${request.cartridgeId}/rnir/${domain}.jsonl`;
      
      await s3Client.send(new PutObjectCommand({
        Bucket: RNIR_BUCKET,
        Key: s3Path,
        Body: jsonl,
        ContentType: 'application/x-ndjson',
      }));

      // Store in database
      await executeStatement(
        `INSERT INTO rnir_documents (cartridge_id, tenant_id, domain, example_count, s3_path, size_bytes, checksum, generated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (cartridge_id, domain) DO UPDATE SET
           example_count = $4, s3_path = $5, size_bytes = $6, checksum = $7, modified_at = NOW()`,
        [
          request.cartridgeId,
          tenantId,
          domain,
          examples.length,
          s3Path,
          Buffer.byteLength(jsonl),
          crypto.createHash('sha256').update(jsonl).digest('hex'),
          'curator-extraction-v1',
        ]
      );

      // Store individual examples for search
      for (const example of examples) {
        await executeStatement(
          `INSERT INTO rnir_examples (document_id, tenant_id, user_input, assistant_response, system_context, domain, quality, source, user_tokens, assistant_tokens)
           SELECT d.id, $1, $2, $3, $4, $5, $6, $7, $8, $9
           FROM rnir_documents d WHERE d.cartridge_id = $10 AND d.domain = $5`,
          [
            tenantId,
            example.user,
            example.assistant,
            example.system || null,
            domain,
            example.quality || null,
            example.source || 'curator',
            Math.ceil(example.user.length / 4), // Approximate token count
            Math.ceil(example.assistant.length / 4),
            request.cartridgeId,
          ]
        );
      }

      totalExamples += examples.length;
      exampleCounts[domain] = examples.length;
    }

    if (totalExamples === 0) {
      warnings.push('No examples found in Curator. Ensure golden rules have example_input and example_output.');
    }

    return {
      success: totalExamples > 0,
      cartridgeId: request.cartridgeId,
      examplesGenerated: totalExamples,
      examplesByDomain: exampleCounts,
      warnings,
      rnirPath: `s3://${RNIR_BUCKET}/${tenantId}/${request.cartridgeId}/rnir/`,
    };
  }

  /**
   * Start a compilation job
   */
  async startCompilation(
    tenantId: string,
    request: RNIRCompilationRequest
  ): Promise<RNIRCompilationJob> {
    const result = await executeStatement(
      `INSERT INTO rnir_compilation_jobs (
        tenant_id, cartridge_id, target, model_family, model_id,
        lora_settings, prompt_settings, priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, tenant_id, cartridge_id, target, model_family, model_id,
        lora_settings, prompt_settings, status, progress, current_step,
        priority, started_at, completed_at, error, created_at, updated_at`,
      [
        tenantId,
        request.cartridgeId,
        request.target,
        request.modelFamily,
        request.loraSettings?.modelId || request.systemPromptSettings?.modelFamily || null,
        request.loraSettings ? JSON.stringify(request.loraSettings) : null,
        request.systemPromptSettings ? JSON.stringify(request.systemPromptSettings) : null,
        request.priority || 5,
      ]
    );

    const job = this.mapJob(result.rows[0]);
    
    // Queue for async processing
    logger.info('RNIR compilation job queued', { jobId: job.id, target: request.target });

    return job;
  }

  /**
   * Process a compilation job (called by worker)
   */
  async processCompilation(jobId: string): Promise<RNIRCompiledArtifact[]> {
    // Update status to compiling
    await executeStatement(
      `UPDATE rnir_compilation_jobs SET status = 'compiling', started_at = NOW() WHERE id = $1`,
      [jobId]
    );

    const jobResult = await executeStatement(
      `SELECT * FROM rnir_compilation_jobs WHERE id = $1`,
      [jobId]
    );

    if (jobResult.rows.length === 0) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const job = this.mapJob(jobResult.rows[0]);
    const artifacts: RNIRCompiledArtifact[] = [];

    try {
      // Fetch RNIR documents
      const docsResult = await executeStatement(
        `SELECT * FROM rnir_documents WHERE cartridge_id = $1 AND tenant_id = $2`,
        [job.request.cartridgeId, job.tenantId]
      );

      if (docsResult.rows.length === 0) {
        throw new Error('No RNIR documents found for cartridge');
      }

      // Compile based on target
      if (job.request.target === 'system_prompt' || job.request.target === 'all') {
        const promptArtifact = await this.compileToSystemPrompt(job, docsResult.rows);
        artifacts.push(promptArtifact);
      }

      if (job.request.target === 'few_shot' || job.request.target === 'all') {
        const fewShotArtifact = await this.compileToFewShot(job, docsResult.rows);
        artifacts.push(fewShotArtifact);
      }

      if (job.request.target === 'lora' || job.request.target === 'all') {
        // LoRA compilation would invoke SageMaker training job
        // For now, create a placeholder that indicates training is needed
        const loraArtifact = await this.queueLoRATraining(job, docsResult.rows);
        artifacts.push(loraArtifact);
      }

      // Update job as completed
      await executeStatement(
        `UPDATE rnir_compilation_jobs SET status = 'completed', progress = 100, completed_at = NOW() WHERE id = $1`,
        [jobId]
      );

    } catch (error) {
      await executeStatement(
        `UPDATE rnir_compilation_jobs SET status = 'failed', error = $2, completed_at = NOW() WHERE id = $1`,
        [jobId, String(error)]
      );
      throw error;
    }

    return artifacts;
  }

  /**
   * Compile RNIR to system prompt
   */
  private async compileToSystemPrompt(
    job: RNIRCompilationJob,
    docs: Record<string, unknown>[]
  ): Promise<RNIRCompiledArtifact> {
    const settings = job.request.systemPromptSettings || {
      modelFamily: job.request.modelFamily,
      maxLength: 4000,
      includeFewShot: true,
      fewShotCount: 3,
      templateStyle: 'structured' as const,
    };

    // Fetch examples
    const examplesResult = await executeStatement(
      `SELECT user_input, assistant_response, system_context, domain, quality
       FROM rnir_examples
       WHERE document_id = ANY($1)
       ORDER BY quality DESC NULLS LAST
       LIMIT $2`,
      [docs.map(d => (d as Record<string, unknown>).id), settings.fewShotCount * 10] as unknown[]
    );

    // Build system prompt
    let prompt = '# Expert Knowledge\n\n';
    
    // Group by domain
    const byDomain: Record<string, { context: string; examples: Array<{ user: string; assistant: string }> }> = {};
    
    for (const row of examplesResult.rows) {
      const r = row as Record<string, unknown>;
      const domain = (r.domain as string) || 'general';
      
      if (!byDomain[domain]) {
        byDomain[domain] = { context: '', examples: [] };
      }
      
      if (r.system_context && !byDomain[domain].context) {
        byDomain[domain].context = r.system_context as string;
      }
      
      if (byDomain[domain].examples.length < settings.fewShotCount) {
        byDomain[domain].examples.push({
          user: r.user_input as string,
          assistant: r.assistant_response as string,
        });
      }
    }

    // Format prompt
    for (const [domain, data] of Object.entries(byDomain)) {
      prompt += `## ${domain.charAt(0).toUpperCase() + domain.slice(1)}\n\n`;
      
      if (data.context) {
        prompt += `${data.context}\n\n`;
      }
      
      if (settings.includeFewShot && data.examples.length > 0) {
        prompt += '### Examples\n\n';
        for (const ex of data.examples) {
          prompt += `**User**: ${ex.user}\n**Assistant**: ${ex.assistant}\n\n`;
        }
      }
    }

    // Truncate if too long
    if (prompt.length > settings.maxLength) {
      prompt = prompt.substring(0, settings.maxLength - 3) + '...';
    }

    // Store artifact
    const s3Path = `${job.tenantId}/${job.request.cartridgeId}/compiled/${job.request.modelFamily}/system-prompt.txt`;
    await s3Client.send(new PutObjectCommand({
      Bucket: RNIR_BUCKET,
      Key: s3Path,
      Body: prompt,
      ContentType: 'text/plain',
    }));

    const checksum = crypto.createHash('sha256').update(prompt).digest('hex');

    const artifactResult = await executeStatement(
      `INSERT INTO rnir_compiled_artifacts (
        job_id, cartridge_id, tenant_id, target, model_family, artifact_path,
        size_bytes, checksum, status, examples_processed, compilation_time_seconds, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', $9, $10, NOW())
      RETURNING *`,
      [
        job.id,
        job.request.cartridgeId,
        job.tenantId,
        'system_prompt',
        job.request.modelFamily,
        s3Path,
        Buffer.byteLength(prompt),
        checksum,
        examplesResult.rows.length,
        1,
      ]
    );

    return this.mapArtifact(artifactResult.rows[0]);
  }

  /**
   * Compile RNIR to few-shot examples
   */
  private async compileToFewShot(
    job: RNIRCompilationJob,
    docs: Record<string, unknown>[]
  ): Promise<RNIRCompiledArtifact> {
    const examplesResult = await executeStatement(
      `SELECT user_input, assistant_response, domain, quality
       FROM rnir_examples
       WHERE document_id = ANY($1)
       ORDER BY quality DESC NULLS LAST`,
      docs.map(d => (d as Record<string, unknown>).id) as unknown[]
    );

    const fewShotData = examplesResult.rows.map(row => {
      const r = row as Record<string, unknown>;
      return {
        messages: [
          { role: 'user', content: r.user_input },
          { role: 'assistant', content: r.assistant_response },
        ],
        domain: r.domain,
        quality: r.quality,
      };
    });

    const jsonContent = JSON.stringify(fewShotData, null, 2);
    const s3Path = `${job.tenantId}/${job.request.cartridgeId}/compiled/${job.request.modelFamily}/few-shot.json`;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: RNIR_BUCKET,
      Key: s3Path,
      Body: jsonContent,
      ContentType: 'application/json',
    }));

    const checksum = crypto.createHash('sha256').update(jsonContent).digest('hex');

    const artifactResult = await executeStatement(
      `INSERT INTO rnir_compiled_artifacts (
        job_id, cartridge_id, tenant_id, target, model_family, artifact_path,
        size_bytes, checksum, status, examples_processed, compilation_time_seconds, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', $9, $10, NOW())
      RETURNING *`,
      [
        job.id,
        job.request.cartridgeId,
        job.tenantId,
        'few_shot',
        job.request.modelFamily,
        s3Path,
        Buffer.byteLength(jsonContent),
        checksum,
        fewShotData.length,
        1,
      ]
    );

    return this.mapArtifact(artifactResult.rows[0]);
  }

  /**
   * Queue LoRA training job
   */
  private async queueLoRATraining(
    job: RNIRCompilationJob,
    docs: Record<string, unknown>[]
  ): Promise<RNIRCompiledArtifact> {
    // In production, this would invoke SageMaker training
    // For now, create a pending artifact
    const s3Path = `${job.tenantId}/${job.request.cartridgeId}/compiled/${job.request.modelFamily}/lora-adapter/`;

    const artifactResult = await executeStatement(
      `INSERT INTO rnir_compiled_artifacts (
        job_id, cartridge_id, tenant_id, target, model_family, model_id, artifact_path,
        size_bytes, checksum, status, started_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW())
      RETURNING *`,
      [
        job.id,
        job.request.cartridgeId,
        job.tenantId,
        'lora',
        job.request.modelFamily,
        job.request.loraSettings?.modelId || null,
        s3Path,
        0,
        'pending',
      ]
    );

    logger.info('LoRA training queued', { 
      artifactId: artifactResult.rows[0].id,
      modelFamily: job.request.modelFamily,
    });

    return this.mapArtifact(artifactResult.rows[0]);
  }

  /**
   * Get compilation job status
   */
  async getJob(jobId: string): Promise<RNIRCompilationJob | null> {
    const result = await executeStatement(
      `SELECT * FROM rnir_compilation_jobs WHERE id = $1`,
      [jobId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const job = this.mapJob(result.rows[0]);

    // Fetch artifacts
    const artifactsResult = await executeStatement(
      `SELECT * FROM rnir_compiled_artifacts WHERE job_id = $1`,
      [jobId]
    );

    job.artifacts = artifactsResult.rows.map(row => this.mapArtifact(row));

    return job;
  }

  /**
   * List compilation jobs for a tenant
   */
  async listJobs(tenantId: string, limit = 20): Promise<RNIRCompilationJob[]> {
    const result = await executeStatement(
      `SELECT * FROM rnir_compilation_jobs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit]
    );

    return result.rows.map(row => this.mapJob(row));
  }

  /**
   * Get RNIR dashboard
   */
  async getDashboard(tenantId: string): Promise<RNIRDashboard> {
    const [docStats, jobStats, artifactStats, recentJobs] = await Promise.all([
      executeStatement(
        `SELECT COUNT(*) as total_docs, SUM(example_count) as total_examples,
           jsonb_object_agg(domain, example_count) as by_domain,
           SUM(size_bytes) as storage_used
         FROM rnir_documents WHERE tenant_id = $1`,
        [tenantId]
      ),
      executeStatement(
        `SELECT 
           COUNT(*) FILTER (WHERE status = 'pending') as pending,
           COUNT(*) FILTER (WHERE status IN ('queued', 'compiling')) as in_progress,
           COUNT(*) FILTER (WHERE status = 'completed') as completed,
           COUNT(*) FILTER (WHERE status = 'failed') as failed
         FROM rnir_compilation_jobs WHERE tenant_id = $1`,
        [tenantId]
      ),
      executeStatement(
        `SELECT target, COUNT(*) as count
         FROM rnir_compiled_artifacts WHERE tenant_id = $1 AND status = 'completed'
         GROUP BY target`,
        [tenantId]
      ),
      executeStatement(
        `SELECT * FROM rnir_compilation_jobs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [tenantId]
      ),
    ]);

    const docRow = docStats.rows[0] as Record<string, unknown>;
    const jobRow = jobStats.rows[0] as Record<string, unknown>;

    const artifactsByTarget: Record<RNIRCompilationTarget, number> = {
      lora: 0,
      system_prompt: 0,
      few_shot: 0,
      rag_chunks: 0,
      all: 0,
    };

    for (const row of artifactStats.rows) {
      const r = row as Record<string, unknown>;
      artifactsByTarget[r.target as RNIRCompilationTarget] = Number(r.count);
    }

    return {
      totalDocuments: Number(docRow.total_docs) || 0,
      totalExamples: Number(docRow.total_examples) || 0,
      byDomain: (docRow.by_domain as Record<string, number>) || {},
      compilationStats: {
        pending: Number(jobRow.pending) || 0,
        inProgress: Number(jobRow.in_progress) || 0,
        completed: Number(jobRow.completed) || 0,
        failed: Number(jobRow.failed) || 0,
      },
      recentCompilations: recentJobs.rows.map(row => this.mapJob(row)),
      artifactsByTarget,
      storageUsedBytes: Number(docRow.storage_used) || 0,
    };
  }

  /**
   * Get document previews for a cartridge
   */
  async getDocumentPreviews(tenantId: string, cartridgeId: string): Promise<RNIRDocumentPreview[]> {
    const result = await executeStatement(
      `SELECT d.*, c.name as cartridge_name,
         EXISTS(SELECT 1 FROM rnir_compiled_artifacts a WHERE a.cartridge_id = d.cartridge_id AND a.target = 'lora' AND a.status = 'completed') as has_lora,
         EXISTS(SELECT 1 FROM rnir_compiled_artifacts a WHERE a.cartridge_id = d.cartridge_id AND a.target = 'system_prompt' AND a.status = 'completed') as has_prompt,
         (SELECT MAX(completed_at) FROM rnir_compiled_artifacts a WHERE a.cartridge_id = d.cartridge_id) as last_compiled
       FROM rnir_documents d
       LEFT JOIN cartridges c ON c.id = d.cartridge_id
       WHERE d.tenant_id = $1 AND d.cartridge_id = $2`,
      [tenantId, cartridgeId]
    );

    const previews: RNIRDocumentPreview[] = [];

    for (const row of result.rows) {
      const r = row as Record<string, unknown>;
      
      // Fetch sample examples
      const examplesResult = await executeStatement(
        `SELECT user_input as user, assistant_response as assistant, domain, quality, source
         FROM rnir_examples WHERE document_id = $1 ORDER BY quality DESC LIMIT 3`,
        [r.id]
      );

      previews.push({
        cartridgeId: r.cartridge_id as string,
        cartridgeName: (r.cartridge_name as string) || 'Unknown',
        domain: r.domain as string,
        exampleCount: r.example_count as number,
        sampleExamples: examplesResult.rows.map(e => e as unknown as RNIRExample),
        hasLoraArtifact: r.has_lora as boolean,
        hasPromptArtifact: r.has_prompt as boolean,
        lastCompiled: r.last_compiled ? (r.last_compiled as Date).toISOString() : undefined,
      });
    }

    return previews;
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  private mapJob(row: Record<string, unknown>): RNIRCompilationJob {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      request: {
        cartridgeId: row.cartridge_id as string,
        target: row.target as RNIRCompilationTarget,
        modelFamily: row.model_family as RNIRModelFamily,
        loraSettings: row.lora_settings as LoRACompilationSettings | undefined,
        systemPromptSettings: row.prompt_settings as SystemPromptCompilationSettings | undefined,
        priority: row.priority as number,
      },
      status: row.status as RNIRCompilationStatus,
      progress: row.progress as number,
      currentStep: row.current_step as string | undefined,
      artifacts: [],
      startedAt: row.started_at ? (row.started_at as Date).toISOString() : undefined,
      completedAt: row.completed_at ? (row.completed_at as Date).toISOString() : undefined,
      error: row.error as string | undefined,
      createdAt: (row.created_at as Date).toISOString(),
    };
  }

  private mapArtifact(row: Record<string, unknown>): RNIRCompiledArtifact {
    return {
      id: row.id as string,
      cartridgeId: row.cartridge_id as string,
      target: row.target as RNIRCompilationTarget,
      modelFamily: row.model_family as RNIRModelFamily,
      modelId: row.model_id as string | undefined,
      artifactPath: row.artifact_path as string,
      sizeBytes: Number(row.size_bytes),
      checksum: row.checksum as string,
      status: row.status as RNIRCompilationStatus,
      startedAt: row.started_at ? (row.started_at as Date).toISOString() : undefined,
      completedAt: row.completed_at ? (row.completed_at as Date).toISOString() : undefined,
      errorMessage: row.error_message as string | undefined,
      metrics: row.training_loss ? {
        trainingLoss: Number(row.training_loss),
        validationLoss: row.validation_loss ? Number(row.validation_loss) : undefined,
        examplesProcessed: Number(row.examples_processed),
        compilationTimeSeconds: Number(row.compilation_time_seconds),
      } : undefined,
      createdAt: (row.created_at as Date).toISOString(),
    };
  }
}

export const cartridgeRNIRService = new CartridgeRNIRService();
