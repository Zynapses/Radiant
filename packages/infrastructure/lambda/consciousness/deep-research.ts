/**
 * Deep Research Lambda
 * 
 * Browser-automated research using Playwright for comprehensive information gathering.
 * Triggered by SQS queue for async processing.
 */

import { Handler, SQSEvent } from 'aws-lambda';
import { executeStatement } from '../shared/db/client';
import { logger } from '../shared/logger';
import { ModelRouterService, ModelRequest, ModelResponse } from '../shared/services/model-router.service';

const modelRouter = new ModelRouterService();

interface DeepResearchJob {
  jobId: string;
  tenantId: string;
  userId: string;
  query: string;
  scope: 'quick' | 'medium' | 'deep';
  maxSources: number;
}

interface ResearchSource {
  url: string;
  title: string;
  content: string;
  relevance: number;
  credibility: number;
  extractedAt: string;
}

interface ResearchFinding {
  claim: string;
  evidence: string[];
  confidence: number;
  sources: string[];
}

export const handler: Handler<SQSEvent> = async (event) => {
  for (const record of event.Records) {
    const job: DeepResearchJob = JSON.parse(record.body);
    
    logger.info('Starting deep research job', { 
      jobId: job.jobId, 
      query: job.query,
      scope: job.scope,
    });

    try {
      // Update job status to running
      await updateJobStatus(job.jobId, job.tenantId, 'running', 0);

      // Perform research based on scope
      const results = await performDeepResearch(job);

      // Update job with results
      await updateJobResults(job.jobId, job.tenantId, results);

      logger.info('Deep research job completed', { jobId: job.jobId });
    } catch (error) {
      logger.error(`Deep research job failed: ${String(error)}`);
      await updateJobStatus(job.jobId, job.tenantId, 'failed', 0, String(error));
    }
  }

  return { processed: event.Records.length };
};

async function performDeepResearch(job: DeepResearchJob): Promise<{
  summary: string;
  findings: ResearchFinding[];
  sources: ResearchSource[];
}> {
  const sources: ResearchSource[] = [];
  const findings: ResearchFinding[] = [];

  // Determine search depth based on scope
  const searchConfig = {
    quick: { searches: 3, pagesPerSearch: 3, maxDepth: 1 },
    medium: { searches: 5, pagesPerSearch: 5, maxDepth: 2 },
    deep: { searches: 10, pagesPerSearch: 10, maxDepth: 3 },
  }[job.scope];

  // Update progress
  await updateJobStatus(job.jobId, job.tenantId, 'running', 10);

  // Step 1: Initial search queries
  const searchQueries = await generateSearchQueries(job.query, searchConfig.searches);
  
  // Update progress
  await updateJobStatus(job.jobId, job.tenantId, 'running', 20);

  // Step 2: Perform searches and collect URLs
  const allUrls: string[] = [];
  for (const query of searchQueries) {
    const urls = await searchForUrls(query, searchConfig.pagesPerSearch);
    allUrls.push(...urls);
  }

  // Deduplicate URLs
  const uniqueUrls = [...new Set(allUrls)].slice(0, job.maxSources);

  // Update progress
  await updateJobStatus(job.jobId, job.tenantId, 'running', 40);

  // Step 3: Fetch and extract content from pages
  for (let i = 0; i < uniqueUrls.length; i++) {
    try {
      const source = await extractPageContent(uniqueUrls[i], job.query);
      if (source) {
        sources.push(source);
      }
      
      // Update progress
      const progress = 40 + Math.floor((i / uniqueUrls.length) * 40);
      await updateJobStatus(job.jobId, job.tenantId, 'running', progress);
    } catch (error) {
      logger.warn(`Failed to extract content from ${uniqueUrls[i]}: ${String(error)}`);
    }
  }

  // Update progress
  await updateJobStatus(job.jobId, job.tenantId, 'running', 80);

  // Step 4: Synthesize findings
  const synthesizedFindings = await synthesizeFindings(job.query, sources);
  findings.push(...synthesizedFindings);

  // Update progress
  await updateJobStatus(job.jobId, job.tenantId, 'running', 90);

  // Step 5: Generate summary
  const summary = await generateResearchSummary(job.query, findings, sources);

  return { summary, findings, sources };
}

async function generateSearchQueries(query: string, count: number): Promise<string[]> {
  // Generate variations of the search query for comprehensive coverage
  const queries = [query];
  
  // Add variations
  const variations = [
    `${query} research`,
    `${query} studies`,
    `${query} analysis`,
    `${query} latest findings`,
    `"${query}" academic`,
    `${query} statistics`,
    `${query} expert opinion`,
    `${query} review`,
    `${query} comparison`,
    `${query} trends`,
  ];

  // Select a subset based on count
  for (let i = 0; i < count - 1 && i < variations.length; i++) {
    queries.push(variations[i]);
  }

  return queries;
}

async function searchForUrls(query: string, maxResults: number): Promise<string[]> {
  const urls: string[] = [];

  // Try Brave Search first
  try {
    const braveKey = process.env.BRAVE_SEARCH_API_KEY;
    if (braveKey) {
      const params = new URLSearchParams({
        q: query,
        count: String(maxResults),
      });

      const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': braveKey,
        },
      });

      if (response.ok) {
        const data = await response.json() as {
          web?: { results?: Array<{ url: string }> };
        };
        urls.push(...(data.web?.results || []).map(r => r.url));
      }
    }
  } catch (error) {
    logger.warn(`Brave search failed: ${String(error)}`);
  }

  // Fallback to Bing if needed
  if (urls.length < maxResults) {
    try {
      const bingKey = process.env.BING_SEARCH_API_KEY;
      if (bingKey) {
        const params = new URLSearchParams({
          q: query,
          count: String(maxResults - urls.length),
        });

        const response = await fetch(`https://api.bing.microsoft.com/v7.0/search?${params}`, {
          headers: { 'Ocp-Apim-Subscription-Key': bingKey },
        });

        if (response.ok) {
          const data = await response.json() as {
            webPages?: { value?: Array<{ url: string }> };
          };
          urls.push(...(data.webPages?.value || []).map(r => r.url));
        }
      }
    } catch (error) {
      logger.warn(`Bing search failed: ${String(error)}`);
    }
  }

  return urls;
}

async function extractPageContent(url: string, query: string): Promise<ResearchSource | null> {
  try {
    // Use a headless browser service or simple fetch for content extraction
    // In production, this would use Playwright or a browser automation service
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RadiantResearchBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    
    // Extract text content (simplified - production would use proper DOM parsing)
    const textContent = extractTextFromHtml(html);
    const title = extractTitle(html);

    // Calculate relevance based on query term presence
    const queryTerms = query.toLowerCase().split(' ').filter(t => t.length > 2);
    const contentLower = textContent.toLowerCase();
    const matchCount = queryTerms.filter(term => contentLower.includes(term)).length;
    const relevance = matchCount / queryTerms.length;

    // Calculate credibility based on URL
    const credibility = calculateCredibility(url);

    return {
      url,
      title,
      content: textContent.substring(0, 5000), // Limit content size
      relevance,
      credibility,
      extractedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.warn(`Failed to extract from ${url}: ${String(error)}`);
    return null;
  }
}

function extractTextFromHtml(html: string): string {
  // Remove script and style elements
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : 'Untitled';
}

function calculateCredibility(url: string): number {
  const urlLower = url.toLowerCase();
  
  // High credibility domains
  if (urlLower.includes('.gov') || urlLower.includes('.edu')) return 0.95;
  if (urlLower.includes('nature.com') || urlLower.includes('science.org')) return 0.95;
  if (urlLower.includes('arxiv.org') || urlLower.includes('pubmed')) return 0.9;
  if (urlLower.includes('ieee.org') || urlLower.includes('acm.org')) return 0.9;
  if (urlLower.includes('springer.com') || urlLower.includes('wiley.com')) return 0.85;
  if (urlLower.includes('wikipedia.org')) return 0.7;
  if (urlLower.includes('.org')) return 0.7;
  
  // Medium credibility
  if (urlLower.includes('medium.com') || urlLower.includes('substack.com')) return 0.5;
  
  // Default
  return 0.4;
}

async function synthesizeFindings(
  query: string,
  sources: ResearchSource[]
): Promise<ResearchFinding[]> {
  if (sources.length === 0) {
    return [];
  }

  // Prepare source content for LLM analysis
  const sourcesSummary = sources.slice(0, 10).map((s, i) => {
    const hostname = new URL(s.url).hostname;
    return `Source ${i + 1} (${hostname}, credibility: ${(s.credibility * 100).toFixed(0)}%):\n${s.content.substring(0, 800)}`;
  }).join('\n\n---\n\n');

  const prompt = `Analyze these research sources and extract key findings for the query: "${query}"

Sources:
${sourcesSummary}

Extract 3-5 distinct findings. For each finding, provide:
1. A clear, specific claim
2. The evidence supporting it
3. Your confidence level (0.0-1.0)
4. Which source URLs support this finding

Format your response as JSON:
{
  "findings": [
    {
      "claim": "...",
      "evidence": ["evidence point 1", "evidence point 2"],
      "confidence": 0.85,
      "sources": ["url1", "url2"]
    }
  ]
}`;

  try {
    const request: ModelRequest = {
      modelId: 'groq/llama-3.1-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2000,
      temperature: 0.2,
    };

    const response: ModelResponse = await modelRouter.invoke(request);
    const content = response.content;

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*"findings"[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { findings: ResearchFinding[] };
      return parsed.findings.map(f => ({
        claim: f.claim,
        evidence: Array.isArray(f.evidence) ? f.evidence : [String(f.evidence)],
        confidence: typeof f.confidence === 'number' ? f.confidence : 0.7,
        sources: Array.isArray(f.sources) ? f.sources : sources.slice(0, 3).map(s => s.url),
      }));
    }
  } catch (error) {
    logger.warn(`LLM synthesis failed, using fallback: ${String(error)}`);
  }

  // Fallback: Create findings based on source grouping
  const findings: ResearchFinding[] = [];
  const highCredSources = sources.filter(s => s.credibility >= 0.7);
  const medCredSources = sources.filter(s => s.credibility >= 0.4 && s.credibility < 0.7);

  if (highCredSources.length > 0) {
    findings.push({
      claim: `Primary findings from ${highCredSources.length} high-credibility sources`,
      evidence: highCredSources.slice(0, 3).map(s => s.content.substring(0, 300)),
      confidence: 0.85,
      sources: highCredSources.map(s => s.url),
    });
  }

  if (medCredSources.length > 0) {
    findings.push({
      claim: `Supporting information from ${medCredSources.length} additional sources`,
      evidence: medCredSources.slice(0, 3).map(s => s.content.substring(0, 300)),
      confidence: 0.6,
      sources: medCredSources.map(s => s.url),
    });
  }

  return findings;
}

async function generateResearchSummary(
  query: string,
  findings: ResearchFinding[],
  sources: ResearchSource[]
): Promise<string> {
  const totalSources = sources.length;
  const highCredCount = sources.filter(s => s.credibility >= 0.7).length;
  const avgRelevance = sources.reduce((sum, s) => sum + s.relevance, 0) / totalSources || 0;

  // Prepare context for LLM
  const findingsSummary = findings.map((f, i) => 
    `Finding ${i + 1}: ${f.claim}\nEvidence: ${f.evidence.slice(0, 2).join('; ')}\nConfidence: ${(f.confidence * 100).toFixed(0)}%`
  ).join('\n\n');

  const topSourcesList = sources.slice(0, 5).map(s => {
    const hostname = new URL(s.url).hostname;
    return `- ${s.title} (${hostname}, credibility: ${(s.credibility * 100).toFixed(0)}%)`;
  }).join('\n');

  const prompt = `Write a comprehensive research summary for the query: "${query}"

Research Statistics:
- Total sources analyzed: ${totalSources}
- High-credibility sources: ${highCredCount}
- Average relevance: ${(avgRelevance * 100).toFixed(1)}%

Key Findings:
${findingsSummary}

Top Sources:
${topSourcesList}

Write a well-structured summary that:
1. Opens with an executive summary (2-3 sentences)
2. Synthesizes the key findings into a coherent narrative
3. Notes any conflicting information or gaps
4. Provides actionable conclusions
5. Lists limitations and areas for further research

Be thorough but concise. Use professional tone.`;

  try {
    const request: ModelRequest = {
      modelId: 'anthropic/claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2000,
      temperature: 0.3,
    };

    const response: ModelResponse = await modelRouter.invoke(request);
    
    return `${response.content}\n\n---\nSources Analyzed: ${totalSources} | High-Credibility: ${highCredCount} | Avg Relevance: ${(avgRelevance * 100).toFixed(1)}%`;
  } catch (error) {
    logger.warn(`LLM summary generation failed, using fallback: ${String(error)}`);
    
    // Fallback to basic summary
    return `
Research Summary for: "${query}"

Sources Analyzed: ${totalSources}
High-Credibility Sources: ${highCredCount}
Average Relevance: ${(avgRelevance * 100).toFixed(1)}%

Key Findings:
${findings.map((f, i) => `${i + 1}. ${f.claim} (Confidence: ${(f.confidence * 100).toFixed(0)}%)`).join('\n')}

Top Sources:
${sources.slice(0, 5).map(s => `- ${s.title} (${s.url})`).join('\n')}
    `.trim();
  }
}

async function updateJobStatus(
  jobId: string,
  tenantId: string,
  status: string,
  progress: number,
  error?: string
): Promise<void> {
  await executeStatement(
    `UPDATE consciousness_research_jobs 
     SET status = $3, progress = $4, error_message = $5, updated_at = NOW()
     ${status === 'running' && progress === 0 ? ', started_at = NOW()' : ''}
     WHERE id = $1 AND tenant_id = $2`,
    [
      { name: 'jobId', value: { stringValue: jobId } },
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'status', value: { stringValue: status } },
      { name: 'progress', value: { longValue: progress } },
      { name: 'error', value: error ? { stringValue: error } : { isNull: true } },
    ]
  );
}

async function updateJobResults(
  jobId: string,
  tenantId: string,
  results: { summary: string; findings: ResearchFinding[]; sources: ResearchSource[] }
): Promise<void> {
  await executeStatement(
    `UPDATE consciousness_research_jobs 
     SET status = 'completed', progress = 100, 
         summary = $3, findings = $4::jsonb, sources = $5::jsonb,
         completed_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2`,
    [
      { name: 'jobId', value: { stringValue: jobId } },
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'summary', value: { stringValue: results.summary } },
      { name: 'findings', value: { stringValue: JSON.stringify(results.findings) } },
      { name: 'sources', value: { stringValue: JSON.stringify(results.sources) } },
    ]
  );
}
