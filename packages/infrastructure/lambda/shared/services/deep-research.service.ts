// Deep Research Agents Service
// Asynchronous background research with browser automation

import { executeStatement, stringParam } from '../db/client';
import type {
  ResearchJob,
  ResearchSource,
  DeepResearchConfig,
  ResearchJobStatus,
} from '@radiant/shared';
import crypto from 'crypto';

const DEFAULT_CONFIG: DeepResearchConfig = {
  enabled: true,
  maxSources: 50,
  maxDepth: 2,
  maxDurationMs: 1800000,
  allowedSourceTypes: ['web', 'pdf', 'api'],
  requireCredibleSources: true,
  minSourceCredibility: 0.6,
  browserAgent: 'playwright',
  parallelRequests: 5,
  respectRobotsTxt: true,
  outputFormat: 'markdown',
};

class DeepResearchService {
  /**
   * Dispatch a new research job (fire-and-forget)
   */
  async dispatchResearchJob(
    tenantId: string,
    userId: string,
    query: string,
    options: {
      researchType?: ResearchJob['researchType'];
      scope?: ResearchJob['scope'];
      notificationChannel?: ResearchJob['notificationChannel'];
      config?: Partial<DeepResearchConfig>;
    } = {}
  ): Promise<ResearchJob> {
    const mergedConfig = { ...DEFAULT_CONFIG, ...options.config };
    
    const job: ResearchJob = {
      id: crypto.randomUUID(),
      tenantId,
      userId,
      query,
      researchType: options.researchType || 'general',
      scope: options.scope || 'medium',
      config: mergedConfig,
      status: 'queued',
      progress: 0,
      currentPhase: 'planning',
      sourcesFound: 0,
      sourcesProcessed: 0,
      sources: [],
      estimatedCompletionMs: this.estimateCompletionTime(query, options.scope || 'medium'),
      queuedAt: new Date(),
      notificationSent: false,
      notificationChannel: options.notificationChannel || 'in_app',
    };

    await this.saveJob(job);
    
    // Queue the job for async processing
    await this.enqueueJob(job.id);

    return job;
  }

  /**
   * Execute a research job (called by worker)
   */
  async executeJob(jobId: string): Promise<ResearchJob> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    job.status = 'running';
    job.startedAt = new Date();
    await this.saveJob(job);

    try {
      // Phase 1: Planning
      job.currentPhase = 'planning';
      job.progress = 5;
      await this.saveJob(job);
      
      const searchPlan = await this.createSearchPlan(job);

      // Phase 2: Gathering
      job.currentPhase = 'gathering';
      job.progress = 10;
      await this.saveJob(job);

      const sources = await this.gatherSources(job, searchPlan);
      job.sources = sources;
      job.sourcesFound = sources.length;

      // Phase 3: Analyzing
      job.currentPhase = 'analyzing';
      job.progress = 50;
      await this.saveJob(job);

      const analyzedSources = await this.analyzeSources(job, sources);
      job.sourcesProcessed = analyzedSources.length;

      // Phase 4: Synthesizing
      job.currentPhase = 'synthesizing';
      job.progress = 80;
      await this.saveJob(job);

      const synthesis = await this.synthesizeFindings(job, analyzedSources);
      job.briefingDocument = synthesis.document;
      job.executiveSummary = synthesis.summary;
      job.keyFindings = synthesis.findings;
      job.recommendations = synthesis.recommendations;

      // Phase 5: Reviewing
      job.currentPhase = 'reviewing';
      job.progress = 95;
      await this.saveJob(job);

      // Final review and quality check
      await this.reviewOutput(job);

      // Complete
      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date();
      job.actualDurationMs = job.completedAt.getTime() - job.startedAt!.getTime();

      // Send notification
      await this.sendNotification(job);
      job.notificationSent = true;

    } catch (error) {
      job.status = 'failed';
      console.error(`Research job ${jobId} failed:`, error);
    }

    await this.saveJob(job);
    return job;
  }

  /**
   * Create search plan based on query
   */
  private async createSearchPlan(job: ResearchJob): Promise<SearchPlan> {
    // Analyze query to determine search strategy
    const plan: SearchPlan = {
      queries: this.generateSearchQueries(job.query, job.researchType),
      domains: this.getRelevantDomains(job.researchType),
      depth: job.scope === 'broad' ? 3 : job.scope === 'medium' ? 2 : 1,
      maxSources: job.config.maxSources,
    };

    return plan;
  }

  /**
   * Generate search queries from main query
   */
  private generateSearchQueries(query: string, type: ResearchJob['researchType']): string[] {
    const queries = [query];

    // Add type-specific variations
    switch (type) {
      case 'competitive_analysis':
        queries.push(
          `${query} competitors`,
          `${query} market share`,
          `${query} vs alternatives`,
          `${query} industry analysis`
        );
        break;
      case 'market_research':
        queries.push(
          `${query} market size`,
          `${query} trends 2024`,
          `${query} growth forecast`,
          `${query} consumer analysis`
        );
        break;
      case 'technical_review':
        queries.push(
          `${query} technical specification`,
          `${query} architecture`,
          `${query} implementation guide`,
          `${query} best practices`
        );
        break;
      case 'literature_review':
        queries.push(
          `${query} research papers`,
          `${query} academic study`,
          `${query} systematic review`,
          `${query} meta analysis`
        );
        break;
      case 'fact_check':
        queries.push(
          `${query} verification`,
          `${query} sources`,
          `${query} evidence`,
          `${query} fact check`
        );
        break;
    }

    return queries;
  }

  /**
   * Get relevant domains for research type
   */
  private getRelevantDomains(type: ResearchJob['researchType']): string[] {
    const commonDomains = ['google.com', 'wikipedia.org'];

    switch (type) {
      case 'competitive_analysis':
        return [...commonDomains, 'crunchbase.com', 'linkedin.com', 'glassdoor.com'];
      case 'market_research':
        return [...commonDomains, 'statista.com', 'bloomberg.com', 'reuters.com'];
      case 'technical_review':
        return [...commonDomains, 'github.com', 'stackoverflow.com', 'arxiv.org'];
      case 'literature_review':
        return [...commonDomains, 'scholar.google.com', 'pubmed.ncbi.nlm.nih.gov', 'arxiv.org'];
      case 'fact_check':
        return [...commonDomains, 'snopes.com', 'factcheck.org', 'politifact.com'];
      default:
        return commonDomains;
    }
  }

  /**
   * Gather sources from the web
   */
  private async gatherSources(
    job: ResearchJob,
    plan: SearchPlan
  ): Promise<ResearchSource[]> {
    const sources: ResearchSource[] = [];
    const visitedUrls = new Set<string>();

    for (const query of plan.queries) {
      if (sources.length >= plan.maxSources) break;

      // Search and get URLs (placeholder - would use search API)
      const searchResults = await this.searchWeb(query, 10);

      for (const result of searchResults) {
        if (visitedUrls.has(result.url) || sources.length >= plan.maxSources) continue;
        visitedUrls.add(result.url);

        // Fetch and extract content
        const content = await this.fetchContent(result.url, job.config);
        if (!content) continue;

        const source: ResearchSource = {
          id: crypto.randomUUID(),
          type: this.detectSourceType(result.url),
          url: result.url,
          title: result.title,
          content: content.text,
          relevanceScore: this.scoreRelevance(content.text, job.query),
          credibilityScore: this.scoreCredibility(result.url),
          extractedAt: new Date(),
          metadata: {
            wordCount: content.text.split(/\s+/).length,
            hasImages: content.hasImages,
            publishDate: content.publishDate,
          },
        };

        if (source.credibilityScore >= job.config.minSourceCredibility) {
          sources.push(source);
        }

        // Update progress
        job.sourcesFound = sources.length;
        job.progress = 10 + Math.min(40, (sources.length / plan.maxSources) * 40);
        await this.saveJob(job);
      }
    }

    return sources;
  }

  /**
   * Analyze gathered sources
   */
  private async analyzeSources(
    job: ResearchJob,
    sources: ResearchSource[]
  ): Promise<ResearchSource[]> {
    const analyzed: ResearchSource[] = [];

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];

      // Generate summary for each source
      source.summary = await this.summarizeSource(source, job.query);

      analyzed.push(source);

      // Update progress
      job.sourcesProcessed = analyzed.length;
      job.progress = 50 + Math.min(30, (i / sources.length) * 30);
      await this.saveJob(job);
    }

    return analyzed.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Synthesize findings into briefing document
   */
  private async synthesizeFindings(
    job: ResearchJob,
    sources: ResearchSource[]
  ): Promise<{
    document: string;
    summary: string;
    findings: string[];
    recommendations: string[];
  }> {
    // Build briefing document
    const topSources = sources.slice(0, 20);

    const findings: string[] = [];
    const recommendations: string[] = [];

    // Extract key findings from sources
    for (const source of topSources.slice(0, 5)) {
      if (source.summary) {
        findings.push(source.summary);
      }
    }

    // Generate recommendations based on research type
    switch (job.researchType) {
      case 'competitive_analysis':
        recommendations.push(
          'Conduct deeper analysis of top 3 competitors',
          'Monitor pricing changes quarterly',
          'Track feature releases from key players'
        );
        break;
      case 'market_research':
        recommendations.push(
          'Validate findings with primary research',
          'Monitor market trends monthly',
          'Consider regional variations'
        );
        break;
      default:
        recommendations.push(
          'Verify key claims with additional sources',
          'Update research periodically',
          'Cross-reference findings'
        );
    }

    const summary = `Research completed on "${job.query}". Analyzed ${sources.length} sources across ${job.config.allowedSourceTypes.join(', ')}. Found ${findings.length} key insights.`;

    const document = this.formatBriefingDocument(job, sources, findings, recommendations);

    return { document, summary, findings, recommendations };
  }

  /**
   * Format briefing document
   */
  private formatBriefingDocument(
    job: ResearchJob,
    sources: ResearchSource[],
    findings: string[],
    recommendations: string[]
  ): string {
    const sections = [
      `# Research Briefing: ${job.query}`,
      ``,
      `**Research Type:** ${job.researchType}`,
      `**Scope:** ${job.scope}`,
      `**Sources Analyzed:** ${sources.length}`,
      `**Completed:** ${new Date().toISOString()}`,
      ``,
      `## Executive Summary`,
      ``,
      findings.slice(0, 3).join('\n\n'),
      ``,
      `## Key Findings`,
      ``,
      ...findings.map((f, i) => `${i + 1}. ${f}`),
      ``,
      `## Recommendations`,
      ``,
      ...recommendations.map((r, i) => `${i + 1}. ${r}`),
      ``,
      `## Sources`,
      ``,
      ...sources.slice(0, 10).map(s => `- [${s.title}](${s.url}) (Relevance: ${(s.relevanceScore * 100).toFixed(0)}%)`),
    ];

    return sections.join('\n');
  }

  /**
   * Review output quality
   */
  private async reviewOutput(job: ResearchJob): Promise<void> {
    // Quality checks
    if (!job.briefingDocument || job.briefingDocument.length < 500) {
      console.warn(`Job ${job.id}: Briefing document may be too short`);
    }

    if (job.sourcesProcessed < 5) {
      console.warn(`Job ${job.id}: Few sources processed (${job.sourcesProcessed})`);
    }
  }

  /**
   * Send notification to user
   */
  private async sendNotification(job: ResearchJob): Promise<void> {
    // Would integrate with notification service
    await executeStatement({
      sql: `
        INSERT INTO notifications (
          id, tenant_id, user_id, type, title, message,
          action_url, created_at
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, 'research_complete',
          $4, $5, $6, NOW()
        )
      `,
      parameters: [
        stringParam('id', crypto.randomUUID()),
        stringParam('tenantId', job.tenantId),
        stringParam('userId', job.userId),
        stringParam('title', `Research Complete: ${job.query.slice(0, 50)}...`),
        stringParam('message', job.executiveSummary || 'Your research is ready'),
        stringParam('actionUrl', `/research/${job.id}`),
      ],
    });
  }

  /**
   * Search web (placeholder)
   */
  private async searchWeb(
    query: string,
    limit: number
  ): Promise<{ url: string; title: string }[]> {
    // Would integrate with search API (Google, Bing, etc.)
    return [
      { url: `https://example.com/search?q=${encodeURIComponent(query)}`, title: `Results for ${query}` },
    ];
  }

  /**
   * Fetch content from URL
   */
  private async fetchContent(
    url: string,
    config: DeepResearchConfig
  ): Promise<{ text: string; hasImages: boolean; publishDate?: string } | null> {
    // Would use Playwright/Puppeteer
    // Placeholder
    return {
      text: `Content from ${url}`,
      hasImages: false,
    };
  }

  /**
   * Detect source type from URL
   */
  private detectSourceType(url: string): ResearchSource['type'] {
    if (url.endsWith('.pdf')) return 'pdf';
    if (url.includes('/api/') || url.includes('/v1/')) return 'api';
    return 'web';
  }

  /**
   * Score relevance of content to query
   */
  private scoreRelevance(content: string, query: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    
    let matches = 0;
    for (const term of queryTerms) {
      if (contentLower.includes(term)) matches++;
    }
    
    return matches / queryTerms.length;
  }

  /**
   * Score credibility of source
   */
  private scoreCredibility(url: string): number {
    const credibleDomains = [
      'gov', 'edu', 'wikipedia.org', 'reuters.com', 'bbc.com',
      'nytimes.com', 'nature.com', 'science.org', 'arxiv.org',
    ];

    for (const domain of credibleDomains) {
      if (url.includes(domain)) return 0.9;
    }

    return 0.6;
  }

  /**
   * Summarize source content
   */
  private async summarizeSource(source: ResearchSource, query: string): Promise<string> {
    // Would call LLM for summarization
    return `Summary of "${source.title}" relevant to "${query}"`;
  }

  /**
   * Estimate completion time
   */
  private estimateCompletionTime(query: string, scope: ResearchJob['scope']): number {
    const baseTime = 5 * 60 * 1000; // 5 minutes
    const scopeMultiplier = scope === 'broad' ? 3 : scope === 'medium' ? 2 : 1;
    return baseTime * scopeMultiplier;
  }

  /**
   * Enqueue job for async processing
   */
  private async enqueueJob(jobId: string): Promise<void> {
    // Would send to SQS/Redis queue
    await executeStatement({
      sql: `
        INSERT INTO job_queue (id, job_type, job_id, status, created_at)
        VALUES ($1::uuid, 'research', $2::uuid, 'pending', NOW())
      `,
      parameters: [
        stringParam('id', crypto.randomUUID()),
        stringParam('jobId', jobId),
      ],
    });
  }

  /**
   * Save job to database
   */
  private async saveJob(job: ResearchJob): Promise<void> {
    await executeStatement({
      sql: `
        INSERT INTO research_jobs (
          id, tenant_id, user_id, query, research_type, scope,
          config, status, progress, current_phase,
          sources_found, sources_processed, sources,
          briefing_document, executive_summary, key_findings, recommendations,
          estimated_completion_ms, actual_duration_ms,
          queued_at, started_at, completed_at,
          notification_sent, notification_channel
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4, $5, $6,
          $7::jsonb, $8, $9, $10,
          $11, $12, $13::jsonb,
          $14, $15, $16::text[], $17::text[],
          $18, $19,
          $20, $21, $22,
          $23, $24
        )
        ON CONFLICT (id) DO UPDATE SET
          status = $8, progress = $9, current_phase = $10,
          sources_found = $11, sources_processed = $12, sources = $13::jsonb,
          briefing_document = $14, executive_summary = $15,
          key_findings = $16::text[], recommendations = $17::text[],
          actual_duration_ms = $19, completed_at = $22,
          notification_sent = $23
      `,
      parameters: [
        stringParam('id', job.id),
        stringParam('tenantId', job.tenantId),
        stringParam('userId', job.userId),
        stringParam('query', job.query),
        stringParam('researchType', job.researchType),
        stringParam('scope', job.scope),
        stringParam('config', JSON.stringify(job.config)),
        stringParam('status', job.status),
        stringParam('progress', String(job.progress)),
        stringParam('currentPhase', job.currentPhase),
        stringParam('sourcesFound', String(job.sourcesFound)),
        stringParam('sourcesProcessed', String(job.sourcesProcessed)),
        stringParam('sources', JSON.stringify(job.sources)),
        stringParam('briefingDocument', job.briefingDocument || ''),
        stringParam('executiveSummary', job.executiveSummary || ''),
        stringParam('keyFindings', job.keyFindings ? `{${job.keyFindings.map(f => `"${f.replace(/"/g, '\\"')}"`).join(',')}}` : '{}'),
        stringParam('recommendations', job.recommendations ? `{${job.recommendations.map(r => `"${r.replace(/"/g, '\\"')}"`).join(',')}}` : '{}'),
        stringParam('estimatedCompletionMs', String(job.estimatedCompletionMs)),
        stringParam('actualDurationMs', job.actualDurationMs ? String(job.actualDurationMs) : ''),
        stringParam('queuedAt', job.queuedAt.toISOString()),
        stringParam('startedAt', job.startedAt?.toISOString() || ''),
        stringParam('completedAt', job.completedAt?.toISOString() || ''),
        stringParam('notificationSent', String(job.notificationSent)),
        stringParam('notificationChannel', job.notificationChannel),
      ],
    });
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<ResearchJob | null> {
    const result = await executeStatement({
      sql: `SELECT * FROM research_jobs WHERE id = $1::uuid`,
      parameters: [stringParam('id', jobId)],
    });

    if (!result.rows?.length) return null;

    const row = result.rows[0];
    return this.mapRowToJob(row);
  }

  /**
   * Get jobs for user
   */
  async getUserJobs(
    tenantId: string,
    userId: string,
    limit: number = 10
  ): Promise<ResearchJob[]> {
    const result = await executeStatement({
      sql: `
        SELECT * FROM research_jobs
        WHERE tenant_id = $1::uuid AND user_id = $2::uuid
        ORDER BY queued_at DESC
        LIMIT $3
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('limit', String(limit)),
      ],
    });

    return (result.rows || []).map(row => this.mapRowToJob(row));
  }

  /**
   * Map database row to job
   */
  private mapRowToJob(row: Record<string, unknown>): ResearchJob {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string,
      query: row.query as string,
      researchType: row.research_type as ResearchJob['researchType'],
      scope: row.scope as ResearchJob['scope'],
      config: row.config as DeepResearchConfig,
      status: row.status as ResearchJobStatus,
      progress: parseInt(row.progress as string),
      currentPhase: row.current_phase as ResearchJob['currentPhase'],
      sourcesFound: parseInt(row.sources_found as string),
      sourcesProcessed: parseInt(row.sources_processed as string),
      sources: (row.sources || []) as ResearchSource[],
      briefingDocument: row.briefing_document as string,
      executiveSummary: row.executive_summary as string,
      keyFindings: row.key_findings as string[],
      recommendations: row.recommendations as string[],
      estimatedCompletionMs: parseInt(row.estimated_completion_ms as string),
      actualDurationMs: row.actual_duration_ms ? parseInt(row.actual_duration_ms as string) : undefined,
      queuedAt: new Date(row.queued_at as string),
      startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      notificationSent: row.notification_sent as boolean,
      notificationChannel: row.notification_channel as ResearchJob['notificationChannel'],
    };
  }

  /**
   * Get configuration
   */
  async getConfig(tenantId: string): Promise<DeepResearchConfig> {
    const result = await executeStatement({
      sql: `SELECT deep_research FROM cognitive_architecture_config WHERE tenant_id = $1::uuid`,
      parameters: [stringParam('tenantId', tenantId)],
    });

    if (result.rows?.length && result.rows[0].deep_research) {
      return result.rows[0].deep_research as DeepResearchConfig;
    }

    return DEFAULT_CONFIG;
  }
}

interface SearchPlan {
  queries: string[];
  domains: string[];
  depth: number;
  maxSources: number;
}

export const deepResearchService = new DeepResearchService();
