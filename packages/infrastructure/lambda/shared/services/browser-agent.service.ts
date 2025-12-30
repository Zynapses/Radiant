// RADIANT v4.18.20 - Browser Agent Service
// "Go away and think for an hour" - Asynchronous Deep Research
//
// This exploits the "10-Second Gap" where chat interfaces force shallow answers.
// Radiant can dispatch research that runs for 30+ minutes.

import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// ============================================================================
// Types
// ============================================================================

export interface ResearchTask {
  taskId: string;
  tenantId: string;
  userId: string;
  query: string;
  taskType: ResearchTaskType;
  config: ResearchConfig;
  status: ResearchStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  report?: ResearchReport;
}

export type ResearchTaskType = 
  | 'competitive_analysis'
  | 'market_research'
  | 'technical_deep_dive'
  | 'news_synthesis'
  | 'academic_review'
  | 'product_comparison'
  | 'trend_analysis'
  | 'custom';

export type ResearchStatus = 
  | 'queued'
  | 'crawling'
  | 'analyzing'
  | 'synthesizing'
  | 'completed'
  | 'failed';

export interface ResearchConfig {
  maxDurationMs: number;       // Max time to spend (default: 30 min)
  maxSources: number;          // Max URLs to visit (default: 100)
  maxDepth: number;            // How deep to follow citations (default: 3)
  includePdfs: boolean;        // Parse PDF documents
  includeNews: boolean;        // Include news sources
  includeAcademic: boolean;    // Include academic papers
  focusDomains?: string[];     // Prioritize these domains
  excludeDomains?: string[];   // Skip these domains
  language?: string;           // Preferred language
  recencyBias?: 'recent' | 'any' | 'historical';
}

export interface ResearchReport {
  title: string;
  summary: string;
  sections: ReportSection[];
  sources: Source[];
  entities: ExtractedEntity[];
  timeline?: TimelineEvent[];
  insights: string[];
  limitations: string[];
  generatedAt: string;
  totalSourcesAnalyzed: number;
  researchDurationMs: number;
}

export interface ReportSection {
  title: string;
  content: string;
  citations: number[]; // Source indices
  confidence: number;
}

export interface Source {
  index: number;
  url: string;
  title: string;
  domain: string;
  publishedAt?: string;
  author?: string;
  relevanceScore: number;
  extractedText?: string;
  sourceType: 'webpage' | 'pdf' | 'news' | 'academic' | 'social';
}

export interface ExtractedEntity {
  name: string;
  type: 'person' | 'company' | 'product' | 'technology' | 'location' | 'event';
  mentions: number;
  context: string[];
  sentiment?: number;
}

export interface TimelineEvent {
  date: string;
  event: string;
  sourceIndex: number;
  importance: number;
}

export interface CrawlState {
  visited: Set<string>;
  queue: CrawlTarget[];
  sources: Source[];
  entities: Map<string, ExtractedEntity>;
  startTime: number;
}

export interface CrawlTarget {
  url: string;
  depth: number;
  priority: number;
  parentUrl?: string;
}

// ============================================================================
// Default Configurations
// ============================================================================

const DEFAULT_CONFIG: ResearchConfig = {
  maxDurationMs: 30 * 60 * 1000, // 30 minutes
  maxSources: 100,
  maxDepth: 3,
  includePdfs: true,
  includeNews: true,
  includeAcademic: true,
  recencyBias: 'any',
};

const TASK_TYPE_CONFIGS: Record<ResearchTaskType, Partial<ResearchConfig>> = {
  competitive_analysis: {
    maxSources: 150,
    includeNews: true,
    recencyBias: 'recent',
  },
  market_research: {
    maxSources: 200,
    includeNews: true,
    includeAcademic: false,
  },
  technical_deep_dive: {
    maxDepth: 4,
    includeAcademic: true,
    includePdfs: true,
  },
  news_synthesis: {
    maxSources: 50,
    includeNews: true,
    includeAcademic: false,
    recencyBias: 'recent',
  },
  academic_review: {
    maxDepth: 5,
    includeAcademic: true,
    includePdfs: true,
    recencyBias: 'any',
  },
  product_comparison: {
    maxSources: 75,
    includeNews: true,
  },
  trend_analysis: {
    maxSources: 150,
    recencyBias: 'recent',
  },
  custom: {},
};

// ============================================================================
// Browser Agent Service
// ============================================================================

class BrowserAgentService {
  private sqs: SQSClient;
  private s3: S3Client;
  private researchQueueUrl: string;
  private reportBucket: string;

  constructor() {
    this.sqs = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
    this.researchQueueUrl = process.env.RESEARCH_QUEUE_URL || '';
    this.reportBucket = process.env.RESEARCH_BUCKET || 'radiant-research-reports';
  }

  // ==========================================================================
  // Task Management
  // ==========================================================================

  /**
   * Dispatch a deep research task
   * Returns immediately with task ID - research runs asynchronously
   */
  async dispatchResearch(
    tenantId: string,
    userId: string,
    query: string,
    taskType: ResearchTaskType = 'custom',
    configOverrides?: Partial<ResearchConfig>
  ): Promise<ResearchTask> {
    const taskId = `research-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Merge configs
    const config: ResearchConfig = {
      ...DEFAULT_CONFIG,
      ...TASK_TYPE_CONFIGS[taskType],
      ...configOverrides,
    };

    const task: ResearchTask = {
      taskId,
      tenantId,
      userId,
      query,
      taskType,
      config,
      status: 'queued',
      createdAt: new Date().toISOString(),
    };

    // Store task in database
    await this.saveTask(task);

    // Queue for processing
    await this.sqs.send(new SendMessageCommand({
      QueueUrl: this.researchQueueUrl,
      MessageBody: JSON.stringify({
        taskId,
        tenantId,
        userId,
        query,
        taskType,
        config,
      }),
      MessageGroupId: tenantId,
      MessageDeduplicationId: taskId,
    }));

    logger.info('Research task dispatched', {
      taskId,
      tenantId,
      taskType,
      maxDurationMs: config.maxDurationMs,
      maxSources: config.maxSources,
    });

    return task;
  }

  /**
   * Get task status
   */
  async getTaskStatus(tenantId: string, taskId: string): Promise<ResearchTask | null> {
    const result = await executeStatement(
      `SELECT * FROM research_tasks WHERE tenant_id = $1 AND task_id = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'taskId', value: { stringValue: taskId } },
      ]
    );

    if (result.rows.length === 0) return null;
    return this.mapTask(result.rows[0] as Record<string, unknown>);
  }

  /**
   * Get user's research tasks
   */
  async getUserTasks(
    tenantId: string,
    userId: string,
    limit: number = 20
  ): Promise<ResearchTask[]> {
    const result = await executeStatement(
      `SELECT * FROM research_tasks 
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows.map(row => this.mapTask(row as Record<string, unknown>));
  }

  /**
   * Get completed report
   */
  async getReport(tenantId: string, taskId: string): Promise<ResearchReport | null> {
    try {
      const response = await this.s3.send(new GetObjectCommand({
        Bucket: this.reportBucket,
        Key: `reports/${tenantId}/${taskId}/report.json`,
      }));

      const body = await response.Body?.transformToString();
      return body ? JSON.parse(body) : null;
    } catch (error) {
      logger.warn('Failed to get report', { error, taskId });
      return null;
    }
  }

  // ==========================================================================
  // Research Execution (Called by Step Functions)
  // ==========================================================================

  /**
   * Execute crawling phase
   * This is called by the Step Functions workflow
   */
  async executeCrawl(task: ResearchTask): Promise<Source[]> {
    const state: CrawlState = {
      visited: new Set(),
      queue: [],
      sources: [],
      entities: new Map(),
      startTime: Date.now(),
    };

    // Update status
    await this.updateTaskStatus(task.tenantId, task.taskId, 'crawling');

    // Generate initial search URLs
    const seedUrls = await this.generateSeedUrls(task.query, task.config);
    for (const url of seedUrls) {
      state.queue.push({ url, depth: 0, priority: 1 });
    }

    // Crawl loop
    while (
      state.queue.length > 0 &&
      state.sources.length < task.config.maxSources &&
      Date.now() - state.startTime < task.config.maxDurationMs
    ) {
      // Sort by priority
      state.queue.sort((a, b) => b.priority - a.priority);
      const target = state.queue.shift()!;

      if (state.visited.has(target.url)) continue;
      state.visited.add(target.url);

      try {
        const source = await this.crawlUrl(target, task.config);
        if (source) {
          state.sources.push(source);

          // Extract citations and queue them
          if (target.depth < task.config.maxDepth) {
            const citations = this.extractCitations(source.extractedText || '');
            for (const citation of citations) {
              if (!state.visited.has(citation) && this.shouldCrawl(citation, task.config)) {
                state.queue.push({
                  url: citation,
                  depth: target.depth + 1,
                  priority: this.calculatePriority(citation, task.query),
                  parentUrl: target.url,
                });
              }
            }
          }

          // Extract entities
          const entities = this.extractEntities(source.extractedText || '');
          for (const entity of entities) {
            const existing = state.entities.get(entity.name);
            if (existing) {
              existing.mentions++;
              existing.context.push(...entity.context);
            } else {
              state.entities.set(entity.name, entity);
            }
          }
        }
      } catch (error) {
        logger.warn('Failed to crawl URL', { url: target.url, error });
      }
    }

    logger.info('Crawl phase completed', {
      taskId: task.taskId,
      sourcesCollected: state.sources.length,
      urlsVisited: state.visited.size,
      durationMs: Date.now() - state.startTime,
    });

    return state.sources;
  }

  /**
   * Execute synthesis phase
   */
  async executeSynthesis(
    task: ResearchTask,
    sources: Source[],
    synthesisCallback: (prompt: string) => Promise<string>
  ): Promise<ResearchReport> {
    await this.updateTaskStatus(task.tenantId, task.taskId, 'synthesizing');

    const startTime = Date.now();

    // Build synthesis prompt
    const synthesisPrompt = this.buildSynthesisPrompt(task.query, sources, task.taskType);

    // Call LLM for synthesis
    const synthesizedContent = await synthesisCallback(synthesisPrompt);

    // Parse structured report from synthesis
    const report = this.parseReport(synthesizedContent, sources, task, startTime);

    // Save report to S3
    await this.saveReport(task.tenantId, task.taskId, report);

    // Update task status
    await this.updateTaskStatus(task.tenantId, task.taskId, 'completed', report);

    logger.info('Research completed', {
      taskId: task.taskId,
      totalSources: sources.length,
      reportSections: report.sections.length,
      durationMs: Date.now() - startTime,
    });

    return report;
  }

  // ==========================================================================
  // Crawling Helpers
  // ==========================================================================

  private async generateSeedUrls(query: string, config: ResearchConfig): Promise<string[]> {
    const urls: string[] = [];
    
    // Try real search APIs first
    const searchResults = await this.callSearchApi(query, config);
    if (searchResults.length > 0) {
      urls.push(...searchResults);
    }
    
    // Fallback to search engine URLs if no API results
    if (urls.length === 0) {
      const encodedQuery = encodeURIComponent(query);
      
      urls.push(`https://www.google.com/search?q=${encodedQuery}`);

      if (config.includeNews) {
        urls.push(`https://news.google.com/search?q=${encodedQuery}`);
      }

      if (config.includeAcademic) {
        urls.push(`https://scholar.google.com/scholar?q=${encodedQuery}`);
      }

      if (config.focusDomains) {
        for (const domain of config.focusDomains) {
          urls.push(`https://www.google.com/search?q=${encodedQuery}+site:${domain}`);
        }
      }
    }

    return urls;
  }
  
  private async callSearchApi(query: string, config: ResearchConfig): Promise<string[]> {
    const urls: string[] = [];
    
    // Try Bing Search API
    const bingKey = process.env.BING_SEARCH_API_KEY;
    if (bingKey) {
      try {
        const bingUrls = await this.searchWithBing(query, bingKey, config);
        urls.push(...bingUrls);
        return urls;
      } catch (error) {
        logger.debug('Bing search failed', { error: String(error) });
      }
    }
    
    // Try Google Custom Search API
    const googleKey = process.env.GOOGLE_SEARCH_API_KEY;
    const googleCx = process.env.GOOGLE_SEARCH_CX;
    if (googleKey && googleCx) {
      try {
        const googleUrls = await this.searchWithGoogle(query, googleKey, googleCx, config);
        urls.push(...googleUrls);
        return urls;
      } catch (error) {
        logger.debug('Google search failed', { error: String(error) });
      }
    }
    
    // Try SerpAPI as fallback
    const serpKey = process.env.SERPAPI_KEY;
    if (serpKey) {
      try {
        const serpUrls = await this.searchWithSerpApi(query, serpKey, config);
        urls.push(...serpUrls);
        return urls;
      } catch (error) {
        logger.debug('SerpAPI search failed', { error: String(error) });
      }
    }
    
    return urls;
  }
  
  private async searchWithBing(query: string, apiKey: string, config: ResearchConfig): Promise<string[]> {
    const count = config.maxSources || 10;
    const endpoint = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${count}`;
    
    const response = await fetch(endpoint, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
    });
    
    if (!response.ok) throw new Error(`Bing API error: ${response.status}`);
    
    const data = await response.json() as {
      webPages?: { value: Array<{ url: string }> };
      news?: { value: Array<{ url: string }> };
    };
    
    const urls: string[] = [];
    
    if (data.webPages?.value) {
      urls.push(...data.webPages.value.map(r => r.url));
    }
    
    if (config.includeNews && data.news?.value) {
      urls.push(...data.news.value.map(r => r.url));
    }
    
    return urls;
  }
  
  private async searchWithGoogle(query: string, apiKey: string, cx: string, config: ResearchConfig): Promise<string[]> {
    const num = Math.min(config.maxSources || 10, 10);
    const endpoint = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=${num}`;
    
    const response = await fetch(endpoint);
    
    if (!response.ok) throw new Error(`Google API error: ${response.status}`);
    
    const data = await response.json() as {
      items?: Array<{ link: string }>;
    };
    
    return data.items?.map(r => r.link) || [];
  }
  
  private async searchWithSerpApi(query: string, apiKey: string, config: ResearchConfig): Promise<string[]> {
    const num = config.maxSources || 10;
    const endpoint = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${apiKey}&num=${num}`;
    
    const response = await fetch(endpoint);
    
    if (!response.ok) throw new Error(`SerpAPI error: ${response.status}`);
    
    const data = await response.json() as {
      organic_results?: Array<{ link: string }>;
    };
    
    return data.organic_results?.map(r => r.link) || [];
  }

  private async crawlUrl(target: CrawlTarget, config: ResearchConfig): Promise<Source | null> {
    try {
      // First, try basic fetch for simple HTML pages
      const response = await fetch(target.url, {
        headers: {
          'User-Agent': 'RadiantResearchBot/1.0 (+https://radiant.ai/bot)',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return null;

      const contentType = response.headers.get('content-type') || '';
      
      // Handle PDFs using pdf-parse
      if (contentType.includes('pdf') && config.includePdfs) {
        try {
          const pdfBuffer = await response.arrayBuffer();
          const pdfText = await this.extractPdfText(Buffer.from(pdfBuffer));
          
          if (pdfText) {
            return {
              index: 0,
              url: target.url,
              title: this.extractPdfTitle(pdfText) || target.url,
              domain: new URL(target.url).hostname,
              extractedText: pdfText.substring(0, 50000),
              relevanceScore: 0.6,
              sourceType: 'academic',
            };
          }
        } catch (pdfError) {
          logger.warn('PDF extraction failed', { url: target.url, error: String(pdfError) });
        }
        return null;
      }

      // Handle HTML - check if JavaScript rendering is needed
      if (contentType.includes('html')) {
        const html = await response.text();
        
        // Check if page requires JavaScript (common SPA indicators)
        const needsJs = this.detectJavaScriptRequired(html);
        
        if (needsJs && config.enableJsRendering !== false) {
          // Use Playwright for JavaScript-heavy pages
          const jsRendered = await this.crawlWithPlaywright(target.url, config);
          if (jsRendered) return jsRendered;
        }
        
        // Fall back to basic extraction
        const extracted = this.extractFromHtml(html, target.url);
        
        return {
          index: 0,
          url: target.url,
          title: extracted.title,
          domain: new URL(target.url).hostname,
          extractedText: extracted.text,
          relevanceScore: 0.5,
          sourceType: this.classifySourceType(target.url),
        };
      }

      return null;
    } catch (error) {
      logger.debug('Crawl failed', { url: target.url, error });
      return null;
    }
  }

  /**
   * Extract text from PDF using pdf-parse
   */
  private async extractPdfText(pdfBuffer: Buffer): Promise<string | null> {
    try {
      // Dynamic import of pdf-parse
      const pdfParse = await import('pdf-parse').then(m => m.default);
      const data = await pdfParse(pdfBuffer);
      return data.text;
    } catch (error) {
      logger.warn('pdf-parse not available, skipping PDF extraction', { error: String(error) });
      return null;
    }
  }

  private extractPdfTitle(text: string): string | null {
    // Try to extract title from first lines of PDF
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      if (firstLine.length > 5 && firstLine.length < 200) {
        return firstLine;
      }
    }
    return null;
  }

  private detectJavaScriptRequired(html: string): boolean {
    // Check for common SPA framework indicators
    const spaIndicators = [
      'id="root"',
      'id="app"',
      'id="__next"',
      'ng-app',
      'data-reactroot',
      'data-v-',
      '__NUXT__',
      '__NEXT_DATA__',
    ];
    
    for (const indicator of spaIndicators) {
      if (html.includes(indicator)) {
        // Check if the content is actually empty (hydration needed)
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
          const bodyContent = bodyMatch[1]
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, '')
            .trim();
          
          // If body is mostly empty, JS rendering is needed
          if (bodyContent.length < 500) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Crawl URL using Playwright for JavaScript rendering
   */
  private async crawlWithPlaywright(url: string, config: ResearchConfig): Promise<Source | null> {
    try {
      // Dynamic import of Playwright
      const { chromium } = await import('playwright');
      
      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      
      try {
        const context = await browser.newContext({
          userAgent: 'RadiantResearchBot/1.0 (+https://radiant.ai/bot)',
        });
        
        const page = await context.newPage();
        await page.goto(url, { 
          waitUntil: 'networkidle',
          timeout: 30000,
        });
        
        // Wait for content to load
        await page.waitForLoadState('domcontentloaded');
        
        // Extract content
        const title = await page.title();
        const text = await page.evaluate(() => {
          // Remove scripts, styles, nav, footer
          const elementsToRemove = document.querySelectorAll('script, style, nav, footer, header, aside');
          elementsToRemove.forEach(el => el.remove());
          
          return document.body?.innerText || '';
        });
        
        await browser.close();
        
        return {
          index: 0,
          url,
          title,
          domain: new URL(url).hostname,
          extractedText: text.substring(0, 50000),
          relevanceScore: 0.7, // Higher score for JS-rendered content
          sourceType: this.classifySourceType(url),
        };
      } finally {
        await browser.close();
      }
    } catch (error) {
      logger.warn('Playwright crawl failed', { url, error: String(error) });
      return null;
    }
  }

  private extractFromHtml(html: string, url: string): { title: string; text: string } {
    // Simple extraction - in production use a proper HTML parser
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;

    // Remove scripts, styles, nav, footer
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Limit text length
    text = text.substring(0, 10000);

    return { title, text };
  }

  private extractCitations(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
    const matches = text.match(urlRegex) || [];
    return [...new Set(matches)].slice(0, 50);
  }

  private async extractEntitiesWithNER(text: string): Promise<ExtractedEntity[]> {
    // Try LLM-based NER first
    try {
      const { modelRouterService } = await import('./model-router.service');
      
      const response = await modelRouterService.invoke({
        modelId: 'anthropic/claude-3-haiku',
        messages: [
          { 
            role: 'system', 
            content: `Extract named entities from the text. Return JSON array:
[{"name": "Entity Name", "type": "person|company|organization|location|product|technology|event", "mentions": 1}]
Extract up to 20 entities. Focus on important entities mentioned multiple times.` 
          },
          { role: 'user', content: `Extract entities from:\n${text.substring(0, 3000)}` }
        ],
        temperature: 0,
        maxTokens: 1024,
      });
      
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Array<{
          name: string;
          type: string;
          mentions?: number;
        }>;
        
        return parsed.map(e => ({
          name: e.name,
          type: e.type as ExtractedEntity['type'],
          mentions: e.mentions || 1,
          context: [],
        })).slice(0, 50);
      }
    } catch (error) {
      logger.debug('LLM NER failed, using pattern-based extraction', { error: String(error) });
    }
    
    // Fallback to pattern-based extraction
    return this.extractEntitiesPatternBased(text);
  }
  
  private extractEntitiesPatternBased(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const entityCounts = new Map<string, { type: string; count: number }>();
    
    // Extract capitalized phrases (potential names/companies)
    const phraseRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g;
    let match;
    while ((match = phraseRegex.exec(text)) !== null) {
      const name = match[1];
      if (name.length > 2) {
        const existing = entityCounts.get(name);
        if (existing) {
          existing.count++;
        } else {
          entityCounts.set(name, { type: this.classifyEntityType(name, text), count: 1 });
        }
      }
    }
    
    // Convert to array and sort by mentions
    for (const [name, data] of entityCounts.entries()) {
      entities.push({
        name,
        type: data.type as ExtractedEntity['type'],
        mentions: data.count,
        context: [],
      });
    }
    
    return entities.sort((a, b) => b.mentions - a.mentions).slice(0, 50);
  }
  
  private classifyEntityType(name: string, context: string): string {
    const lowerName = name.toLowerCase();
    const lowerContext = context.toLowerCase();
    
    // Person indicators
    if (/\b(mr|mrs|ms|dr|prof|ceo|cfo|president|director)\b/i.test(context.substring(context.indexOf(name) - 50, context.indexOf(name) + 50))) {
      return 'person';
    }
    
    // Company indicators
    if (/\b(inc|corp|llc|ltd|company|corporation)\b/i.test(lowerName) ||
        /\b(announced|reported|shares|stock|revenue)\b/i.test(lowerContext)) {
      return 'company';
    }
    
    // Location indicators
    if (/\b(city|country|state|nation|capital)\b/i.test(lowerContext)) {
      return 'location';
    }
    
    // Technology indicators
    if (/\b(api|sdk|platform|software|hardware|ai|ml)\b/i.test(lowerContext)) {
      return 'technology';
    }
    
    return 'organization'; // Default
  }
  
  private extractEntities(text: string): ExtractedEntity[] {
    // Sync wrapper - use pattern-based for sync contexts
    return this.extractEntitiesPatternBased(text);
  }

  private shouldCrawl(url: string, config: ResearchConfig): boolean {
    try {
      const parsed = new URL(url);
      
      // Check exclude list
      if (config.excludeDomains?.some(d => parsed.hostname.includes(d))) {
        return false;
      }

      // Skip certain file types
      const skipExtensions = ['.jpg', '.png', '.gif', '.mp4', '.zip', '.exe'];
      if (skipExtensions.some(ext => parsed.pathname.toLowerCase().endsWith(ext))) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private calculatePriority(url: string, query: string): number {
    let priority = 0.5;
    
    // Boost if URL contains query terms
    const queryTerms = query.toLowerCase().split(/\s+/);
    for (const term of queryTerms) {
      if (url.toLowerCase().includes(term)) {
        priority += 0.1;
      }
    }

    // Boost authoritative domains
    const authoritativeDomains = ['wikipedia.org', 'gov', 'edu', 'reuters.com', 'bloomberg.com'];
    if (authoritativeDomains.some(d => url.includes(d))) {
      priority += 0.2;
    }

    return Math.min(1, priority);
  }

  private classifySourceType(url: string): Source['sourceType'] {
    const domain = new URL(url).hostname.toLowerCase();
    
    if (domain.includes('news') || domain.includes('bbc') || domain.includes('cnn')) {
      return 'news';
    }
    if (domain.includes('scholar') || domain.includes('arxiv') || domain.includes('edu')) {
      return 'academic';
    }
    if (domain.includes('twitter') || domain.includes('linkedin') || domain.includes('reddit')) {
      return 'social';
    }
    if (url.endsWith('.pdf')) {
      return 'pdf';
    }
    return 'webpage';
  }

  // ==========================================================================
  // Synthesis Helpers
  // ==========================================================================

  private buildSynthesisPrompt(
    query: string,
    sources: Source[],
    taskType: ResearchTaskType
  ): string {
    const sourcesSummary = sources
      .slice(0, 30) // Limit for context window
      .map((s, i) => `[${i + 1}] ${s.title}\n${s.url}\n${(s.extractedText || '').substring(0, 500)}...`)
      .join('\n\n---\n\n');

    return `You are a research analyst. Generate a comprehensive report.

RESEARCH QUERY: ${query}
TASK TYPE: ${taskType}
SOURCES ANALYZED: ${sources.length}

SOURCE EXCERPTS:
${sourcesSummary}

Generate a structured report with:
1. Executive Summary (2-3 paragraphs)
2. Key Findings (3-5 sections with citations [1], [2], etc.)
3. Timeline of Events (if applicable)
4. Key Entities & Players
5. Insights & Recommendations
6. Limitations of this research

Use citations in the format [1], [2], etc. to reference sources.
Be comprehensive but concise. Focus on actionable insights.`;
  }

  private parseReport(
    content: string,
    sources: Source[],
    task: ResearchTask,
    startTime: number
  ): ResearchReport {
    // Index sources
    const indexedSources = sources.map((s, i) => ({ ...s, index: i + 1 }));

    // Simple parsing - in production use structured output from LLM
    const sections: ReportSection[] = [];
    const sectionRegex = /##\s*(.+?)\n([\s\S]+?)(?=##|$)/g;
    let match;

    while ((match = sectionRegex.exec(content)) !== null) {
      sections.push({
        title: match[1].trim(),
        content: match[2].trim(),
        citations: this.extractCitationIndices(match[2]),
        confidence: 0.8,
      });
    }

    // If no sections found, create single section
    if (sections.length === 0) {
      sections.push({
        title: 'Research Findings',
        content,
        citations: this.extractCitationIndices(content),
        confidence: 0.7,
      });
    }

    return {
      title: `Research Report: ${task.query}`,
      summary: content.substring(0, 500),
      sections,
      sources: indexedSources,
      entities: [], // Would be populated from crawl state
      insights: this.extractInsights(content),
      limitations: this.extractLimitations(content),
      generatedAt: new Date().toISOString(),
      totalSourcesAnalyzed: sources.length,
      researchDurationMs: Date.now() - startTime,
    };
  }

  private extractCitationIndices(text: string): number[] {
    const matches = text.match(/\[(\d+)\]/g) || [];
    return [...new Set(matches.map(m => parseInt(m.replace(/[\[\]]/g, ''), 10)))];
  }

  private extractInsights(content: string): string[] {
    // Extract bullet points as insights
    const bullets = content.match(/[-•]\s*(.+)/g) || [];
    return bullets.slice(0, 10).map(b => b.replace(/^[-•]\s*/, ''));
  }

  private extractLimitations(content: string): string[] {
    const limitationSection = content.match(/limitation[s]?:?\s*([\s\S]+?)(?=##|$)/i);
    if (limitationSection) {
      return this.extractInsights(limitationSection[1]);
    }
    return ['Research limited to publicly available sources', 'Time-bounded analysis'];
  }

  // ==========================================================================
  // Storage
  // ==========================================================================

  private async saveTask(task: ResearchTask): Promise<void> {
    await executeStatement(
      `INSERT INTO research_tasks (
         task_id, tenant_id, user_id, query, task_type, config, status, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        { name: 'taskId', value: { stringValue: task.taskId } },
        { name: 'tenantId', value: { stringValue: task.tenantId } },
        { name: 'userId', value: { stringValue: task.userId } },
        { name: 'query', value: { stringValue: task.query } },
        { name: 'taskType', value: { stringValue: task.taskType } },
        { name: 'config', value: { stringValue: JSON.stringify(task.config) } },
        { name: 'status', value: { stringValue: task.status } },
        { name: 'createdAt', value: { stringValue: task.createdAt } },
      ]
    );
  }

  private async updateTaskStatus(
    tenantId: string,
    taskId: string,
    status: ResearchStatus,
    report?: ResearchReport
  ): Promise<void> {
    const updates = ['status = $3'];
    const params = [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'taskId', value: { stringValue: taskId } },
      { name: 'status', value: { stringValue: status } },
    ];

    if (status === 'crawling') {
      updates.push('started_at = NOW()');
    }

    if (status === 'completed' || status === 'failed') {
      updates.push('completed_at = NOW()');
    }

    await executeStatement(
      `UPDATE research_tasks SET ${updates.join(', ')} 
       WHERE tenant_id = $1 AND task_id = $2`,
      params
    );
  }

  private async saveReport(tenantId: string, taskId: string, report: ResearchReport): Promise<void> {
    await this.s3.send(new PutObjectCommand({
      Bucket: this.reportBucket,
      Key: `reports/${tenantId}/${taskId}/report.json`,
      Body: JSON.stringify(report),
      ContentType: 'application/json',
    }));
  }

  private mapTask(row: Record<string, unknown>): ResearchTask {
    return {
      taskId: String(row.task_id || ''),
      tenantId: String(row.tenant_id || ''),
      userId: String(row.user_id || ''),
      query: String(row.query || ''),
      taskType: (row.task_type as ResearchTaskType) || 'custom',
      config: typeof row.config === 'string' ? JSON.parse(row.config) : (row.config as ResearchConfig),
      status: (row.status as ResearchStatus) || 'queued',
      createdAt: String(row.created_at || ''),
      startedAt: row.started_at ? String(row.started_at) : undefined,
      completedAt: row.completed_at ? String(row.completed_at) : undefined,
    };
  }
}

export const browserAgentService = new BrowserAgentService();
