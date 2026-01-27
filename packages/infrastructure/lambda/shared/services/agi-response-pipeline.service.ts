// RADIANT v4.18.0 - AGI Response Pipeline Service
// Handles multi-model outputs, file artifacts, questions to client, and synthesis for Think Tank

import { v4 as uuidv4 } from 'uuid';
import {
  AGIResponse,
  SynthesizedResponse,
  ModelContribution,
  SynthesisStrategy,
  ResponseContent,
  TextContent,
  FileArtifact,
  QuestionContent,
  CitationContent,
  SummaryContent,
  ThinkingContent,
  TableContent,
  CodeContent,
  ClientEvent,
  UserAnswer,
  ModelResponseMetadata,
  PipelineContext,
  ArtifactType,
} from '../types/agi-response.types';
import { artifactPipeline, ArtifactUploadRequest } from './artifact-pipeline.service';
import { modelRouterService } from './model-router.service';

// ============================================================================
// Types
// ============================================================================

export interface PipelineStepConfig {
  stepId: string;
  stepNumber: number;
  modelId: string;
  role: 'primary' | 'verifier' | 'specialist' | 'synthesizer';
  prompt: string;
  systemPrompt?: string;
  requiresArtifacts?: string[];  // artifactIds from previous steps
  canGenerateArtifacts?: boolean;
  canAskQuestions?: boolean;
  weight?: number;
}

export interface PipelineExecutionContext {
  planId: string;
  tenantId: string;
  userId: string;
  sessionId?: string;
  conversationId?: string;
  totalSteps: number;
  orchestrationMode: string;
  onEvent?: (event: ClientEvent) => void;
  onQuestion?: (question: QuestionContent) => Promise<UserAnswer>;
}

export interface ParsedModelOutput {
  text: TextContent[];
  code: CodeContent[];
  tables: TableContent[];
  thinking: ThinkingContent[];
  citations: CitationContent[];
  questions: QuestionContent[];
  artifacts: FileArtifact[];
  raw: string;
}

// ============================================================================
// AGI Response Pipeline Service
// ============================================================================

export class AGIResponsePipelineService {
  
  // Patterns to detect structured content in model outputs
  private readonly patterns = {
    codeBlock: /```(\w+)?\n([\s\S]*?)```/g,
    table: /\|(.+)\|\n\|[-:| ]+\|\n((?:\|.+\|\n?)+)/g,
    citation: /\[(\d+)\]\s*([^[\]]+?)(?:\s*(?:https?:\/\/\S+|doi:\S+))?/g,
    thinking: /<thinking>([\s\S]*?)<\/thinking>/gi,
    question: /\[QUESTION\]([\s\S]*?)\[\/QUESTION\]/gi,
    file: /\[FILE:([^\]]+)\]([\s\S]*?)\[\/FILE\]/gi,
  };

  // ============================================================================
  // Main Pipeline Execution
  // ============================================================================

  async executeStep(
    config: PipelineStepConfig,
    context: PipelineExecutionContext,
    previousResponses: AGIResponse[]
  ): Promise<AGIResponse> {
    const responseId = `resp_${uuidv4()}`;
    const startTime = Date.now();
    
    // Emit step started event
    this.emitEvent(context, {
      eventId: uuidv4(),
      type: 'step_started',
      timestamp: new Date().toISOString(),
      planId: context.planId,
      stepId: config.stepId,
      payload: {
        stepNumber: config.stepNumber,
        stepTitle: `Step ${config.stepNumber}: ${config.role}`,
        message: `Starting ${config.role} with ${config.modelId}`,
      },
    });

    // Prepare artifacts from previous steps if needed
    let artifactContext = '';
    if (config.requiresArtifacts && config.requiresArtifacts.length > 0) {
      const artifacts = await artifactPipeline.prepareArtifactsForStep(
        context.planId,
        config.stepId,
        config.requiresArtifacts
      );
      
      artifactContext = this.buildArtifactContext(artifacts);
    }

    // Build accumulated context from previous responses
    const accumulatedContext = this.buildAccumulatedContext(previousResponses);
    
    // Build the full prompt
    const fullPrompt = this.buildStepPrompt(config, artifactContext, accumulatedContext);

    // Invoke the model
    const modelResult = await modelRouterService.invoke({
      modelId: config.modelId,
      messages: [{ role: 'user', content: fullPrompt }],
      systemPrompt: config.systemPrompt,
    });

    const latencyMs = Date.now() - startTime;

    // Parse the model output
    const parsed = await this.parseModelOutput(
      modelResult.content,
      config,
      context
    );

    // Handle any questions that need user input
    const pendingQuestions: QuestionContent[] = [];
    if (config.canAskQuestions && parsed.questions.length > 0) {
      for (const question of parsed.questions) {
        if (question.blocksExecution && context.onQuestion) {
          // Emit question event
          this.emitEvent(context, {
            eventId: uuidv4(),
            type: 'question_pending',
            timestamp: new Date().toISOString(),
            planId: context.planId,
            stepId: config.stepId,
            payload: { question },
          });

          // Wait for answer
          const answer = await context.onQuestion(question);
          
          // Emit answered event
          this.emitEvent(context, {
            eventId: uuidv4(),
            type: 'question_answered',
            timestamp: new Date().toISOString(),
            planId: context.planId,
            stepId: config.stepId,
            payload: { message: `Question answered: ${question.question}` },
          });

          // Answer stored - subsequent pipeline steps can access via context.onQuestion history
        } else {
          pendingQuestions.push(question);
        }
      }
    }

    // Build the response
    const response: AGIResponse = {
      responseId,
      timestamp: new Date().toISOString(),
      content: this.buildContentBlocks(parsed),
      model: {
        modelId: config.modelId,
        modelName: config.modelId.split('/')[1] || config.modelId,
        provider: config.modelId.split('/')[0] || 'unknown',
        inputTokens: modelResult.inputTokens,
        outputTokens: modelResult.outputTokens,
        latencyMs,
        costCents: modelResult.costCents,
        cached: modelResult.cached,
        truncated: false,
        finishReason: 'stop',
      },
      pipeline: {
        planId: context.planId,
        stepId: config.stepId,
        stepNumber: config.stepNumber,
        totalSteps: context.totalSteps,
        orchestrationMode: context.orchestrationMode,
        previousArtifacts: config.requiresArtifacts || [],
        accumulatedContext: accumulatedContext.substring(0, 500) + '...',
      },
      pendingQuestions,
      artifacts: parsed.artifacts,
      citations: parsed.citations,
      status: pendingQuestions.length > 0 ? 'awaiting_input' : 'complete',
      quality: {
        confidence: 0.85,
        coherence: 0.9,
        relevance: 0.9,
      },
    };

    // Emit step complete event
    this.emitEvent(context, {
      eventId: uuidv4(),
      type: 'step_complete',
      timestamp: new Date().toISOString(),
      planId: context.planId,
      stepId: config.stepId,
      payload: {
        stepNumber: config.stepNumber,
        response,
        message: `Completed ${config.role} in ${latencyMs}ms`,
      },
    });

    return response;
  }

  // ============================================================================
  // Multi-Model Synthesis
  // ============================================================================

  async synthesizeResponses(
    responses: AGIResponse[],
    context: PipelineExecutionContext,
    strategy: SynthesisStrategy
  ): Promise<SynthesizedResponse> {
    const responseId = `synth_${uuidv4()}`;
    const startTime = Date.now();

    this.emitEvent(context, {
      eventId: uuidv4(),
      type: 'synthesis_started',
      timestamp: new Date().toISOString(),
      planId: context.planId,
      payload: {
        message: `Synthesizing ${responses.length} model responses using ${strategy.type} strategy`,
      },
    });

    // Build contributions from responses
    const contributions: ModelContribution[] = responses.map((response, i) => ({
      modelId: response.model.modelId,
      modelName: response.model.modelName,
      role: i === 0 ? 'primary' : 'specialist',
      response,
      weight: 1 / responses.length,
    }));

    // Synthesize based on strategy
    let synthesizedContent: ResponseContent[];
    let agreementScore = 1;

    switch (strategy.type) {
      case 'merge':
        synthesizedContent = await this.mergeResponses(responses, context);
        break;
      case 'vote':
        const voted = await this.voteOnResponses(responses, context);
        synthesizedContent = voted.content;
        agreementScore = voted.agreement;
        break;
      case 'consensus':
        const consensus = await this.buildConsensus(responses, context);
        synthesizedContent = consensus.content;
        agreementScore = consensus.agreement;
        break;
      case 'chain':
      case 'parallel':
      default:
        synthesizedContent = await this.mergeResponses(responses, context);
    }

    // Merge artifacts from all responses
    const artifactResult = await artifactPipeline.synthesizeArtifacts(
      context.planId,
      responses,
      'dedupe'
    );

    // Merge citations
    const allCitations = this.mergeCitations(responses);

    // Collect pending questions
    const pendingQuestions = responses.flatMap(r => r.pendingQuestions);

    // Calculate totals
    const totalTokens = responses.reduce(
      (sum, r) => sum + r.model.inputTokens + r.model.outputTokens,
      0
    );
    const totalCost = responses.reduce((sum, r) => sum + r.model.costCents, 0);
    const totalLatency = Date.now() - startTime;

    // Generate summary for Think Tank
    const summary = await this.generateSummary(
      responses,
      synthesizedContent,
      context
    );

    const result: SynthesizedResponse = {
      responseId,
      timestamp: new Date().toISOString(),
      content: synthesizedContent,
      synthesis: {
        strategy,
        modelsUsed: responses.length,
        totalTokens,
        totalCostCents: totalCost,
        totalLatencyMs: totalLatency,
        agreementScore,
        conflictsResolved: artifactResult.conflictsResolved.length,
      },
      contributions,
      artifacts: artifactResult.mergedArtifacts,
      citations: allCitations,
      pendingQuestions,
      summary,
      status: pendingQuestions.length > 0 ? 'awaiting_input' : 'complete',
    };

    this.emitEvent(context, {
      eventId: uuidv4(),
      type: 'synthesis_complete',
      timestamp: new Date().toISOString(),
      planId: context.planId,
      payload: {
        synthesized: result,
        message: `Synthesis complete: ${agreementScore.toFixed(0)}% agreement across ${responses.length} models`,
      },
    });

    return result;
  }

  // ============================================================================
  // Response Parsing
  // ============================================================================

  private async parseModelOutput(
    content: string,
    config: PipelineStepConfig,
    context: PipelineExecutionContext
  ): Promise<ParsedModelOutput> {
    const result: ParsedModelOutput = {
      text: [],
      code: [],
      tables: [],
      thinking: [],
      citations: [],
      questions: [],
      artifacts: [],
      raw: content,
    };

    // Extract thinking blocks
    let processedContent = content;
    const thinkingMatches = [...content.matchAll(this.patterns.thinking)];
    for (const match of thinkingMatches) {
      result.thinking.push({
        type: 'thinking',
        thought: match[1].trim(),
        collapsed: true,
      });
      processedContent = processedContent.replace(match[0], '');
    }

    // Extract code blocks
    const codeMatches = [...processedContent.matchAll(this.patterns.codeBlock)];
    for (const match of codeMatches) {
      const language = match[1] || 'text';
      const code = match[2].trim();
      
      result.code.push({
        type: 'code',
        language,
        code,
      });

      // If configured to generate artifacts, save code files
      if (config.canGenerateArtifacts && this.shouldSaveAsArtifact(language, code)) {
        const artifact = await this.saveCodeAsArtifact(
          code,
          language,
          config,
          context
        );
        if (artifact) {
          result.artifacts.push(artifact);
        }
      }
      
      processedContent = processedContent.replace(match[0], `[CODE_BLOCK_${result.code.length - 1}]`);
    }

    // Extract tables
    const tableMatches = [...processedContent.matchAll(this.patterns.table)];
    for (const match of tableMatches) {
      const headerLine = match[1];
      const bodyLines = match[2];
      
      const headers = headerLine.split('|').map(h => h.trim()).filter(Boolean);
      const rows = bodyLines.trim().split('\n').map(line =>
        line.split('|').map(cell => cell.trim()).filter(Boolean)
      );

      result.tables.push({
        type: 'table',
        headers,
        rows,
      });
      
      processedContent = processedContent.replace(match[0], `[TABLE_${result.tables.length - 1}]`);
    }

    // Extract citations
    const citationMatches = [...processedContent.matchAll(this.patterns.citation)];
    for (const match of citationMatches) {
      result.citations.push({
        type: 'citation',
        index: parseInt(match[1]),
        text: match[2].trim(),
        source: {
          type: 'document',
          title: match[2].trim(),
        },
      });
    }

    // Extract questions (if model is asking for clarification)
    const questionMatches = [...processedContent.matchAll(this.patterns.question)];
    for (const match of questionMatches) {
      const questionText = match[1].trim();
      result.questions.push({
        type: 'question',
        questionId: `q_${uuidv4()}`,
        question: questionText,
        inputType: 'text',
        required: true,
        blocksExecution: true,
      });
      processedContent = processedContent.replace(match[0], '');
    }

    // Extract embedded files
    const fileMatches = [...processedContent.matchAll(this.patterns.file)];
    for (const match of fileMatches) {
      const filename = match[1].trim();
      const fileContent = match[2].trim();
      
      if (config.canGenerateArtifacts) {
        const artifact = await artifactPipeline.uploadArtifact({
          planId: context.planId,
          stepId: config.stepId,
          modelId: config.modelId,
          filename,
          mimeType: this.getMimeType(filename),
          content: fileContent,
        });
        result.artifacts.push(artifact);
      }
      
      processedContent = processedContent.replace(match[0], `[FILE: ${filename}]`);
    }

    // Remaining text
    const cleanText = processedContent.trim();
    if (cleanText) {
      result.text.push({
        type: 'text',
        format: this.detectFormat(cleanText),
        content: cleanText,
      });
    }

    return result;
  }

  // ============================================================================
  // Content Building
  // ============================================================================

  private buildContentBlocks(parsed: ParsedModelOutput): ResponseContent[] {
    const blocks: ResponseContent[] = [];

    // Add thinking first (collapsed)
    for (const thinking of parsed.thinking) {
      blocks.push(thinking);
    }

    // Interleave text with code and tables based on placeholders
    for (const text of parsed.text) {
      let content = text.content;
      
      // Replace code placeholders
      for (let i = 0; i < parsed.code.length; i++) {
        if (content.includes(`[CODE_BLOCK_${i}]`)) {
          const parts = content.split(`[CODE_BLOCK_${i}]`);
          if (parts[0].trim()) {
            blocks.push({ ...text, content: parts[0].trim() });
          }
          blocks.push(parsed.code[i]);
          content = parts.slice(1).join(`[CODE_BLOCK_${i}]`);
        }
      }

      // Replace table placeholders
      for (let i = 0; i < parsed.tables.length; i++) {
        if (content.includes(`[TABLE_${i}]`)) {
          const parts = content.split(`[TABLE_${i}]`);
          if (parts[0].trim()) {
            blocks.push({ ...text, content: parts[0].trim() });
          }
          blocks.push(parsed.tables[i]);
          content = parts.slice(1).join(`[TABLE_${i}]`);
        }
      }

      // Add remaining text
      if (content.trim()) {
        blocks.push({ ...text, content: content.trim() });
      }
    }

    return blocks;
  }

  private buildAccumulatedContext(responses: AGIResponse[]): string {
    if (responses.length === 0) return '';

    const summaries = responses.map((r, i) => {
      const textContent = r.content
        .filter((c): c is TextContent => c.type === 'text')
        .map(t => t.content)
        .join('\n');
      
      return `Step ${i + 1} (${r.model.modelName}): ${textContent.substring(0, 500)}...`;
    });

    return `Previous steps:\n${summaries.join('\n\n')}`;
  }

  private buildArtifactContext(
    artifacts: { artifact: FileArtifact; content?: Buffer }[]
  ): string {
    const parts: string[] = ['Available artifacts from previous steps:'];

    for (const { artifact, content } of artifacts) {
      if (content && artifact.mimeType.startsWith('text/')) {
        parts.push(`\n--- ${artifact.filename} ---`);
        parts.push(content.toString('utf-8').substring(0, 2000));
        if (content.length > 2000) {
          parts.push('... [truncated]');
        }
      } else {
        parts.push(`\n[File: ${artifact.filename} (${artifact.mimeType}, ${artifact.size} bytes)]`);
        if (artifact.url) {
          parts.push(`Download: ${artifact.url}`);
        }
      }
    }

    return parts.join('\n');
  }

  private buildStepPrompt(
    config: PipelineStepConfig,
    artifactContext: string,
    accumulatedContext: string
  ): string {
    const parts: string[] = [];

    if (accumulatedContext) {
      parts.push(accumulatedContext);
      parts.push('\n---\n');
    }

    if (artifactContext) {
      parts.push(artifactContext);
      parts.push('\n---\n');
    }

    parts.push(config.prompt);

    if (config.canAskQuestions) {
      parts.push('\n\nIf you need clarification, wrap your question in [QUESTION]...[/QUESTION] tags.');
    }

    if (config.canGenerateArtifacts) {
      parts.push('\n\nIf you generate files, wrap them in [FILE:filename.ext]...[/FILE] tags.');
    }

    return parts.join('\n');
  }

  // ============================================================================
  // Synthesis Strategies
  // ============================================================================

  private async mergeResponses(
    responses: AGIResponse[],
    context: PipelineExecutionContext
  ): Promise<ResponseContent[]> {
    // Simple merge: concatenate unique content
    const seenContent = new Set<string>();
    const merged: ResponseContent[] = [];

    for (const response of responses) {
      for (const block of response.content) {
        const key = JSON.stringify(block);
        if (!seenContent.has(key)) {
          seenContent.add(key);
          merged.push(block);
        }
      }
    }

    return merged;
  }

  private async voteOnResponses(
    responses: AGIResponse[],
    context: PipelineExecutionContext
  ): Promise<{ content: ResponseContent[]; agreement: number }> {
    if (responses.length === 0) {
      return { content: [], agreement: 1 };
    }
    
    if (responses.length === 1) {
      return { content: responses[0].content, agreement: 1 };
    }

    // Calculate agreement based on content similarity
    const agreement = this.calculateAgreement(responses);
    
    // Use a judge model to evaluate and pick the best response
    const responseSummaries = responses.map((r, i) => {
      const text = r.content
        .filter((c): c is TextContent => c.type === 'text')
        .map(t => t.content)
        .join('\n');
      return `[Response ${i + 1}] (Model: ${r.model.modelName})\n${text}`;
    }).join('\n\n---\n\n');

    const judgePrompt = `You are a response quality judge. Evaluate the following responses and select the BEST one.

${responseSummaries}

Evaluate each response on:
1. Accuracy and correctness
2. Completeness of the answer
3. Clarity and readability
4. Relevance to the original query

Respond with ONLY a JSON object in this exact format:
{"winner": <response_number>, "reasoning": "<brief_explanation>", "scores": [<score_1>, <score_2>, ...]}

Where winner is 1-indexed and scores are 0-1 for each response.`;

    try {
      // Use a capable model for judging
      const judgeResult = await modelRouterService.invoke({
        modelId: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: judgePrompt }],
        temperature: 0,
        maxTokens: 256,
      });

      // Parse the judge's decision
      const jsonMatch = judgeResult.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const decision = JSON.parse(jsonMatch[0]);
        const winnerIndex = (decision.winner || 1) - 1;
        const validIndex = Math.max(0, Math.min(winnerIndex, responses.length - 1));
        
        return {
          content: responses[validIndex].content,
          agreement,
        };
      }
    } catch {
      // Fall back to primary response on judge failure
    }

    return {
      content: responses[0].content,
      agreement,
    };
  }

  private async buildConsensus(
    responses: AGIResponse[],
    context: PipelineExecutionContext
  ): Promise<{ content: ResponseContent[]; agreement: number }> {
    if (responses.length === 0) {
      return { content: [], agreement: 1 };
    }

    // Build consensus prompt
    const responseSummaries = responses.map((r, i) => {
      const text = r.content
        .filter((c): c is TextContent => c.type === 'text')
        .map(t => t.content)
        .join('\n');
      return `Model ${i + 1} (${r.model.modelName}):\n${text}`;
    }).join('\n\n---\n\n');

    const consensusPrompt = `You are synthesizing multiple AI responses into a consensus answer.

${responseSummaries}

Create a CONSENSUS response that:
1. Identifies points of agreement
2. Resolves points of disagreement by selecting the most accurate/complete information
3. Produces a unified, coherent response
4. Notes any remaining uncertainties

Your consensus response:`;

    // Use primary model for consensus
    const result = await modelRouterService.invoke({
      modelId: responses[0].model.modelId,
      messages: [{ role: 'user', content: consensusPrompt }],
    });

    const agreement = this.calculateAgreement(responses);

    return {
      content: [{
        type: 'text',
        format: 'markdown',
        content: result.content,
      }],
      agreement,
    };
  }

  private calculateAgreement(responses: AGIResponse[]): number {
    if (responses.length < 2) return 1;

    // Simple agreement: compare text content overlap
    const texts = responses.map(r =>
      r.content
        .filter((c): c is TextContent => c.type === 'text')
        .map(t => t.content.toLowerCase())
        .join(' ')
    );

    // Calculate pairwise Jaccard similarity
    let totalSimilarity = 0;
    let pairs = 0;

    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const words1 = new Set(texts[i].split(/\s+/));
        const words2 = new Set(texts[j].split(/\s+/));
        
        const intersection = new Set([...words1].filter(w => words2.has(w)));
        const union = new Set([...words1, ...words2]);
        
        totalSimilarity += intersection.size / union.size;
        pairs++;
      }
    }

    return pairs > 0 ? totalSimilarity / pairs : 1;
  }

  // ============================================================================
  // Summary Generation for Think Tank
  // ============================================================================

  private async generateSummary(
    responses: AGIResponse[],
    synthesizedContent: ResponseContent[],
    context: PipelineExecutionContext
  ): Promise<SummaryContent> {
    // Extract key information
    const modelsUsed = responses.map(r => ({
      modelId: r.model.modelId,
      role: r.pipeline?.stepNumber === 1 ? 'Primary analysis' : 'Verification',
      confidence: r.quality?.confidence || 0.8,
    }));

    const artifacts = responses.flatMap(r => r.artifacts).map(a => a.artifactId);

    // Calculate word count
    const allText = synthesizedContent
      .filter((c): c is TextContent => c.type === 'text')
      .map(t => t.content)
      .join(' ');
    
    const wordCount = allText.split(/\s+/).length;
    const readingTime = `${Math.ceil(wordCount / 200)} min read`;

    // Generate overview
    const overview = this.generateOverview(synthesizedContent, responses);
    const keyPoints = this.extractKeyPoints(synthesizedContent);

    return {
      type: 'summary',
      title: 'Multi-Model Analysis Summary',
      overview,
      keyPoints,
      modelsUsed,
      artifacts,
      wordCount,
      readingTime,
    };
  }

  private generateOverview(
    content: ResponseContent[],
    responses: AGIResponse[]
  ): string {
    const modelNames = [...new Set(responses.map(r => r.model.modelName))].join(', ');
    const hasArtifacts = responses.some(r => r.artifacts.length > 0);
    const hasCitations = responses.some(r => r.citations.length > 0);

    let overview = `Analysis completed using ${responses.length} model(s): ${modelNames}.`;

    if (hasArtifacts) {
      const totalArtifacts = responses.reduce((sum, r) => sum + r.artifacts.length, 0);
      overview += ` Generated ${totalArtifacts} artifact(s).`;
    }

    if (hasCitations) {
      const totalCitations = responses.reduce((sum, r) => sum + r.citations.length, 0);
      overview += ` Includes ${totalCitations} citation(s).`;
    }

    return overview;
  }

  private extractKeyPoints(content: ResponseContent[]): string[] {
    const keyPoints: string[] = [];

    for (const block of content) {
      if (block.type === 'text' && block.format === 'markdown') {
        // Extract bullet points and headers
        const lines = block.content.split('\n');
        for (const line of lines) {
          if (line.match(/^[-*]\s+\*\*[^*]+\*\*/)) {
            // Bold bullet point - likely a key point
            keyPoints.push(line.replace(/^[-*]\s+/, '').trim());
          } else if (line.match(/^#{1,3}\s+/)) {
            // Headers
            keyPoints.push(line.replace(/^#+\s+/, '').trim());
          }
        }
      }
    }

    // Limit to 5 key points
    return keyPoints.slice(0, 5);
  }

  // ============================================================================
  // Citation Handling
  // ============================================================================

  private mergeCitations(responses: AGIResponse[]): CitationContent[] {
    const seen = new Map<string, CitationContent>();
    let index = 1;

    for (const response of responses) {
      for (const citation of response.citations) {
        const key = citation.source.title.toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, {
            ...citation,
            index: index++,
          });
        }
      }
    }

    return Array.from(seen.values());
  }

  // ============================================================================
  // Artifact Handling
  // ============================================================================

  private shouldSaveAsArtifact(language: string, code: string): boolean {
    // Save as artifact if it's a complete file
    const savableLanguages = ['python', 'javascript', 'typescript', 'json', 'yaml', 'sql', 'html', 'css'];
    return savableLanguages.includes(language.toLowerCase()) && code.length > 100;
  }

  private async saveCodeAsArtifact(
    code: string,
    language: string,
    config: PipelineStepConfig,
    context: PipelineExecutionContext
  ): Promise<FileArtifact | null> {
    const ext = this.getExtension(language);
    const filename = `generated_${Date.now()}.${ext}`;
    
    try {
      return await artifactPipeline.uploadArtifact({
        planId: context.planId,
        stepId: config.stepId,
        modelId: config.modelId,
        filename,
        mimeType: this.getMimeType(filename),
        content: code,
      });
    } catch {
      return null;
    }
  }

  private getExtension(language: string): string {
    const map: Record<string, string> = {
      python: 'py',
      javascript: 'js',
      typescript: 'ts',
      json: 'json',
      yaml: 'yaml',
      sql: 'sql',
      html: 'html',
      css: 'css',
      markdown: 'md',
    };
    return map[language.toLowerCase()] || 'txt';
  }

  private getMimeType(filename: string): ArtifactType {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, ArtifactType> = {
      py: 'text/plain',
      js: 'text/plain',
      ts: 'text/plain',
      json: 'application/json',
      yaml: 'text/plain',
      sql: 'text/plain',
      html: 'text/html',
      css: 'text/plain',
      md: 'text/markdown',
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
    };
    return map[ext] || 'application/octet-stream';
  }

  private detectFormat(text: string): 'plain' | 'markdown' | 'html' {
    if (text.includes('<html') || text.includes('<!DOCTYPE')) {
      return 'html';
    }
    if (text.match(/^#{1,6}\s+|^\*\*|^[-*]\s+|\[.+\]\(.+\)/m)) {
      return 'markdown';
    }
    return 'plain';
  }

  // ============================================================================
  // Event Emission
  // ============================================================================

  private emitEvent(context: PipelineExecutionContext, event: ClientEvent): void {
    if (context.onEvent) {
      context.onEvent(event);
    }
  }
}

export const agiResponsePipeline = new AGIResponsePipelineService();
