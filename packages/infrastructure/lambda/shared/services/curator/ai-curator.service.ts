/**
 * RADIANT AI Curator Service
 * 
 * AI-powered knowledge curation with UEP v2.0 integration.
 * Provides intelligent document extraction, question generation,
 * and answer verification for the Entrance Exam system.
 * 
 * UEP INTEGRATION:
 * All AI operations are wrapped in UEP envelopes for:
 * - Complete traceability and audit
 * - Compliance framework tagging
 * - Storage in UDS tiered storage
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { enhancedLogger as logger } from '../../logging/enhanced-logger';
import { modelRouterService } from '../model-router.service';
import { uepIntegrationService } from '../uep/index.js';
import { persistenceGuard } from '../persistence-guard.service';
import type { UEPEnvelope } from '../uep/integration.service';

// =============================================================================
// Types
// =============================================================================

export interface CuratorAIContext {
  tenantId: string;
  userId?: string;
  domainId?: string;
  domainPath?: string;
  traceId?: string;
  complianceFrameworks?: string[];
}

export interface DocumentExtractionRequest {
  documentId: string;
  documentContent: string;
  documentType: 'pdf' | 'docx' | 'txt' | 'csv' | 'html';
  domainId?: string;
  extractTypes: ('facts' | 'procedures' | 'entities' | 'concepts' | 'relationships')[];
}

export interface ExtractedKnowledge {
  id: string;
  type: 'fact' | 'procedure' | 'entity' | 'concept' | 'relationship';
  label: string;
  content: string;
  confidence: number;
  sourcePage?: number;
  sourceLocation?: string;
  relatedEntities?: string[];
  aiReasoning: string;
}

export interface DocumentExtractionResult {
  documentId: string;
  extractedItems: ExtractedKnowledge[];
  totalExtracted: number;
  processingTimeMs: number;
  envelope: {
    envelopeId: string;
    traceId: string;
    stored: boolean;
  };
}

export interface ExamQuestionGenerationRequest {
  knowledgeNodes: Array<{
    id: string;
    label: string;
    content: string;
    type: string;
    confidence: number;
  }>;
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  includeAmbiguity?: boolean;
  includeLogicChecks?: boolean;
}

export interface GeneratedExamQuestion {
  id: string;
  type: 'fact_check' | 'logic_check' | 'ambiguity';
  statement: string;
  correctAnswer?: boolean | 'A' | 'B';
  optionA?: string;
  optionB?: string;
  sourceNodeId: string;
  confidence: number;
  aiReasoning: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface ExamQuestionGenerationResult {
  questions: GeneratedExamQuestion[];
  totalGenerated: number;
  processingTimeMs: number;
  envelope: {
    envelopeId: string;
    traceId: string;
    stored: boolean;
  };
}

export interface AnswerVerificationRequest {
  questionId: string;
  questionType: 'fact_check' | 'logic_check' | 'ambiguity';
  statement: string;
  userAnswer: boolean | 'A' | 'B' | string;
  expectedAnswer?: boolean | 'A' | 'B';
  sourceContent: string;
  userCorrection?: string;
}

export interface AnswerVerificationResult {
  questionId: string;
  isCorrect: boolean;
  confidence: number;
  aiAssessment: string;
  suggestedCorrection?: string;
  shouldCreateGoldenRule: boolean;
  goldenRuleReason?: string;
  envelope: {
    envelopeId: string;
    traceId: string;
    stored: boolean;
  };
}

// =============================================================================
// Constants
// =============================================================================

const EXTRACTION_MODEL = 'anthropic/claude-3-5-sonnet-20241022';
const QUESTION_GEN_MODEL = 'anthropic/claude-3-5-sonnet-20241022';
const VERIFICATION_MODEL = 'groq/llama-3.1-70b-versatile';
const RADIANT_VERSION = process.env.RADIANT_VERSION || '5.52.58';

// =============================================================================
// AI Curator Service
// =============================================================================

class AICuratorService {
  /**
   * Extract knowledge from document content using AI
   * Returns structured facts, procedures, entities, and relationships
   */
  async extractKnowledge(
    request: DocumentExtractionRequest,
    context: CuratorAIContext
  ): Promise<DocumentExtractionResult> {
    const startTime = Date.now();
    const traceId = context.traceId || uuidv4();
    const spanId = uuidv4().replace(/-/g, '').substring(0, 16);

    logger.info('Starting AI document extraction', {
      documentId: request.documentId,
      documentType: request.documentType,
      extractTypes: request.extractTypes,
      tenantId: context.tenantId,
    });

    // Build extraction prompt
    const extractionPrompt = this.buildExtractionPrompt(request);

    try {
      const response = await modelRouterService.invoke({
        modelId: EXTRACTION_MODEL,
        messages: [{ role: 'user', content: extractionPrompt }],
        systemPrompt: this.getExtractionSystemPrompt(request.extractTypes),
        maxTokens: 4000,
        temperature: 0.2,
        tenantId: context.tenantId,
        // responseFormat: { type: 'json_object' }, // Not supported by ModelRequest type
      });

      // Parse extracted knowledge
      const extractedItems = this.parseExtractionResponse(response.content, request.documentId);

      const processingTimeMs = Date.now() - startTime;

      // Create UEP envelope
      const envelope = this.createCuratorEnvelope(
        context.tenantId,
        'curator.extraction',
        {
          documentId: request.documentId,
          documentType: request.documentType,
          extractTypes: request.extractTypes,
        },
        {
          extractedItems,
          totalExtracted: extractedItems.length,
          modelUsed: response.modelUsed,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          costCents: response.costCents,
        },
        {
          traceId,
          spanId,
          durationMs: processingTimeMs,
          complianceFrameworks: context.complianceFrameworks,
        }
      );

      // Store envelope asynchronously
      let stored = false;
      try {
        await uepIntegrationService.storeEnvelope(envelope);
        stored = true;
      } catch (error) {
        logger.warn('Failed to store extraction envelope', { error });
      }

      logger.info('Document extraction complete', {
        documentId: request.documentId,
        totalExtracted: extractedItems.length,
        processingTimeMs,
      });

      return {
        documentId: request.documentId,
        extractedItems,
        totalExtracted: extractedItems.length,
        processingTimeMs,
        envelope: {
          envelopeId: envelope.envelopeId,
          traceId,
          stored,
        },
      };
    } catch (error) {
      logger.error('Document extraction failed', { documentId: request.documentId, error });
      throw error;
    }
  }

  /**
   * Generate entrance exam questions from knowledge nodes
   */
  async generateExamQuestions(
    request: ExamQuestionGenerationRequest,
    context: CuratorAIContext
  ): Promise<ExamQuestionGenerationResult> {
    const startTime = Date.now();
    const traceId = context.traceId || uuidv4();
    const spanId = uuidv4().replace(/-/g, '').substring(0, 16);

    logger.info('Starting exam question generation', {
      nodeCount: request.knowledgeNodes.length,
      questionCount: request.questionCount,
      difficulty: request.difficulty,
      tenantId: context.tenantId,
    });

    const prompt = this.buildQuestionGenerationPrompt(request);

    try {
      const response = await modelRouterService.invoke({
        modelId: QUESTION_GEN_MODEL,
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: this.getQuestionGenerationSystemPrompt(request.difficulty),
        maxTokens: 4000,
        temperature: 0.4,
        tenantId: context.tenantId,
        // responseFormat: { type: 'json_object' }, // Not supported by ModelRequest type
      });

      const questions = this.parseQuestionGenerationResponse(response.content, request);
      const processingTimeMs = Date.now() - startTime;

      // Create UEP envelope
      const envelope = this.createCuratorEnvelope(
        context.tenantId,
        'curator.question_generation',
        {
          nodeCount: request.knowledgeNodes.length,
          questionCount: request.questionCount,
          difficulty: request.difficulty,
        },
        {
          questions,
          totalGenerated: questions.length,
          modelUsed: response.modelUsed,
          costCents: response.costCents,
        },
        {
          traceId,
          spanId,
          durationMs: processingTimeMs,
          complianceFrameworks: context.complianceFrameworks,
        }
      );

      // Store envelope
      let stored = false;
      try {
        await uepIntegrationService.storeEnvelope(envelope);
        stored = true;
      } catch (error) {
        logger.warn('Failed to store question generation envelope', { error });
      }

      logger.info('Exam question generation complete', {
        totalGenerated: questions.length,
        processingTimeMs,
      });

      return {
        questions,
        totalGenerated: questions.length,
        processingTimeMs,
        envelope: {
          envelopeId: envelope.envelopeId,
          traceId,
          stored,
        },
      };
    } catch (error) {
      logger.error('Question generation failed', { error });
      throw error;
    }
  }

  /**
   * Verify user answer to an exam question using AI
   */
  async verifyAnswer(
    request: AnswerVerificationRequest,
    context: CuratorAIContext
  ): Promise<AnswerVerificationResult> {
    const startTime = Date.now();
    const traceId = context.traceId || uuidv4();
    const spanId = uuidv4().replace(/-/g, '').substring(0, 16);

    logger.info('Starting answer verification', {
      questionId: request.questionId,
      questionType: request.questionType,
      tenantId: context.tenantId,
    });

    const prompt = this.buildVerificationPrompt(request);

    try {
      const response = await modelRouterService.invoke({
        modelId: VERIFICATION_MODEL,
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: this.getVerificationSystemPrompt(),
        maxTokens: 1000,
        temperature: 0.1,
        tenantId: context.tenantId,
        // responseFormat: { type: 'json_object' }, // Not supported by ModelRequest type
      });

      const result = this.parseVerificationResponse(response.content, request);
      const processingTimeMs = Date.now() - startTime;

      // Create UEP envelope
      const envelope = this.createCuratorEnvelope(
        context.tenantId,
        'curator.answer_verification',
        {
          questionId: request.questionId,
          questionType: request.questionType,
          userAnswer: request.userAnswer,
        },
        {
          ...result,
          modelUsed: response.modelUsed,
          costCents: response.costCents,
        },
        {
          traceId,
          spanId,
          durationMs: processingTimeMs,
          complianceFrameworks: context.complianceFrameworks,
        }
      );

      // Store envelope
      let stored = false;
      try {
        await uepIntegrationService.storeEnvelope(envelope);
        stored = true;
      } catch (error) {
        logger.warn('Failed to store verification envelope', { error });
      }

      logger.info('Answer verification complete', {
        questionId: request.questionId,
        isCorrect: result.isCorrect,
        confidence: result.confidence,
      });

      return {
        ...result,
        envelope: {
          envelopeId: envelope.envelopeId,
          traceId,
          stored,
        },
      };
    } catch (error) {
      logger.error('Answer verification failed', { questionId: request.questionId, error });
      throw error;
    }
  }

  // ===========================================================================
  // Prompt Builders
  // ===========================================================================

  private buildExtractionPrompt(request: DocumentExtractionRequest): string {
    return `Extract structured knowledge from the following document content.

DOCUMENT TYPE: ${request.documentType}
EXTRACT TYPES: ${request.extractTypes.join(', ')}

DOCUMENT CONTENT:
---
${request.documentContent.substring(0, 15000)}
---

For each piece of knowledge extracted, provide:
1. type: One of [${request.extractTypes.join(', ')}]
2. label: A short descriptive label (max 100 chars)
3. content: The full content/description
4. confidence: Your confidence score (0.0-1.0)
5. sourceLocation: Where in the document this was found
6. relatedEntities: Array of related entity labels if applicable
7. reasoning: Brief explanation of why this was extracted

Return JSON format:
{
  "items": [
    {
      "type": "fact",
      "label": "...",
      "content": "...",
      "confidence": 0.95,
      "sourceLocation": "Page 1, paragraph 2",
      "relatedEntities": ["Entity A", "Entity B"],
      "reasoning": "..."
    }
  ]
}`;
  }

  private getExtractionSystemPrompt(extractTypes: string[]): string {
    return `You are RADIANT Curator's AI extraction engine. Your role is to accurately extract structured knowledge from documents.

EXTRACTION GUIDELINES:
- Extract ONLY ${extractTypes.join(', ')} as requested
- Be precise - only extract what is explicitly stated or strongly implied
- Assign confidence scores honestly (0.7+ for explicit, 0.5-0.7 for implied)
- For FACTS: Extract verifiable statements
- For PROCEDURES: Extract step-by-step processes
- For ENTITIES: Extract named things (people, organizations, products, etc.)
- For CONCEPTS: Extract abstract ideas or definitions
- For RELATIONSHIPS: Extract connections between entities

QUALITY STANDARDS:
- Avoid speculation or hallucination
- Cite source location for traceability
- Use clear, professional language
- Identify related entities when possible

Return ONLY valid JSON. No markdown or explanations outside the JSON.`;
  }

  private buildQuestionGenerationPrompt(request: ExamQuestionGenerationRequest): string {
    const nodesJson = JSON.stringify(request.knowledgeNodes.slice(0, 20), null, 2);
    
    const questionTypes = ['fact_check'];
    if (request.includeLogicChecks) questionTypes.push('logic_check');
    if (request.includeAmbiguity) questionTypes.push('ambiguity');

    return `Generate ${request.questionCount} exam questions to verify understanding of the following knowledge.

KNOWLEDGE NODES:
${nodesJson}

QUESTION TYPES TO GENERATE: ${questionTypes.join(', ')}
DIFFICULTY: ${request.difficulty}

For each question:
1. type: One of [${questionTypes.join(', ')}]
2. statement: The question/statement to verify
3. correctAnswer: true/false for fact_check, "A"/"B" for ambiguity
4. optionA/optionB: Only for ambiguity type
5. sourceNodeId: ID of the knowledge node this tests
6. confidence: How clear-cut the answer is (0.0-1.0)
7. reasoning: Why this tests the knowledge well
8. difficulty: ${request.difficulty}

Return JSON format:
{
  "questions": [
    {
      "type": "fact_check",
      "statement": "The sky is blue.",
      "correctAnswer": true,
      "sourceNodeId": "node-123",
      "confidence": 0.95,
      "reasoning": "Tests basic fact from node",
      "difficulty": "${request.difficulty}"
    }
  ]
}`;
  }

  private getQuestionGenerationSystemPrompt(difficulty: string): string {
    const difficultyGuidelines = {
      easy: 'Questions should be straightforward with clear answers directly from the source.',
      medium: 'Questions should require some inference or connection between concepts.',
      hard: 'Questions should test nuanced understanding, edge cases, or require synthesis of multiple facts.',
    };

    return `You are RADIANT Curator's exam question generator. Generate high-quality verification questions.

DIFFICULTY LEVEL: ${difficulty}
${difficultyGuidelines[difficulty as keyof typeof difficultyGuidelines]}

QUESTION TYPE GUIDELINES:
- fact_check: Statement that is either TRUE or FALSE based on the knowledge
- logic_check: Tests understanding of relationships or logical implications
- ambiguity: Present two plausible interpretations, user must choose correct one

QUALITY STANDARDS:
- Questions must be answerable from the provided knowledge
- Avoid trick questions or ambiguous wording (except for ambiguity type)
- Cover different aspects of the knowledge
- Ensure correct answers are unambiguous

Return ONLY valid JSON. No markdown or explanations outside the JSON.`;
  }

  private buildVerificationPrompt(request: AnswerVerificationRequest): string {
    return `Verify if the user's answer is correct based on the source knowledge.

QUESTION TYPE: ${request.questionType}
STATEMENT: ${request.statement}
USER ANSWER: ${JSON.stringify(request.userAnswer)}
${request.expectedAnswer ? `EXPECTED ANSWER: ${JSON.stringify(request.expectedAnswer)}` : ''}
${request.userCorrection ? `USER'S CORRECTION: ${request.userCorrection}` : ''}

SOURCE CONTENT:
---
${request.sourceContent}
---

Evaluate the answer and respond with JSON:
{
  "isCorrect": true/false,
  "confidence": 0.0-1.0,
  "assessment": "Explanation of why the answer is correct/incorrect",
  "suggestedCorrection": "Only if user provided a correction, evaluate if it should be accepted",
  "shouldCreateGoldenRule": true/false,
  "goldenRuleReason": "Only if shouldCreateGoldenRule is true, explain why"
}

A Golden Rule should be created when:
1. User provides a valid correction that improves the knowledge
2. The original extracted knowledge was incorrect or incomplete
3. There's important nuance the system should remember`;
  }

  private getVerificationSystemPrompt(): string {
    return `You are RADIANT Curator's answer verification engine. Evaluate user answers fairly and accurately.

EVALUATION CRITERIA:
- Compare user's answer against the source content
- Be strict but fair - minor phrasing differences are acceptable
- If user provides a correction, evaluate if it's valid and should become a Golden Rule
- Golden Rules are human overrides that supersede AI learning

CONFIDENCE SCORING:
- 1.0: Absolutely certain
- 0.8-0.9: Very confident
- 0.6-0.8: Moderately confident
- Below 0.6: Uncertain, may need human review

Return ONLY valid JSON. No markdown or explanations outside the JSON.`;
  }

  // ===========================================================================
  // Response Parsers
  // ===========================================================================

  private parseExtractionResponse(content: string, documentId: string): ExtractedKnowledge[] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('No JSON found in extraction response');
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const items = parsed.items || [];

      return items.map((item: Record<string, unknown>, index: number) => ({
        id: `${documentId}-${index}-${Date.now()}`,
        type: item.type as ExtractedKnowledge['type'],
        label: String(item.label || '').substring(0, 100),
        content: String(item.content || ''),
        confidence: Number(item.confidence) || 0.5,
        sourceLocation: item.sourceLocation as string | undefined,
        relatedEntities: item.relatedEntities as string[] | undefined,
        aiReasoning: String(item.reasoning || ''),
      }));
    } catch (error) {
      logger.error('Failed to parse extraction response', { error });
      return [];
    }
  }

  private parseQuestionGenerationResponse(
    content: string,
    request: ExamQuestionGenerationRequest
  ): GeneratedExamQuestion[] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('No JSON found in question generation response');
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const questions = parsed.questions || [];

      return questions.map((q: Record<string, unknown>, index: number) => ({
        id: uuidv4(),
        type: q.type as GeneratedExamQuestion['type'],
        statement: String(q.statement || ''),
        correctAnswer: q.correctAnswer as GeneratedExamQuestion['correctAnswer'],
        optionA: q.optionA as string | undefined,
        optionB: q.optionB as string | undefined,
        sourceNodeId: String(q.sourceNodeId || request.knowledgeNodes[index % request.knowledgeNodes.length]?.id || ''),
        confidence: Number(q.confidence) || 0.8,
        aiReasoning: String(q.reasoning || ''),
        difficulty: (q.difficulty as GeneratedExamQuestion['difficulty']) || request.difficulty,
      }));
    } catch (error) {
      logger.error('Failed to parse question generation response', { error });
      return [];
    }
  }

  private parseVerificationResponse(
    content: string,
    request: AnswerVerificationRequest
  ): Omit<AnswerVerificationResult, 'envelope'> {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('No JSON found in verification response');
        return {
          questionId: request.questionId,
          isCorrect: false,
          confidence: 0,
          aiAssessment: 'Failed to parse AI response',
          shouldCreateGoldenRule: false,
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        questionId: request.questionId,
        isCorrect: Boolean(parsed.isCorrect),
        confidence: Number(parsed.confidence) || 0.5,
        aiAssessment: String(parsed.assessment || ''),
        suggestedCorrection: parsed.suggestedCorrection as string | undefined,
        shouldCreateGoldenRule: Boolean(parsed.shouldCreateGoldenRule),
        goldenRuleReason: parsed.goldenRuleReason as string | undefined,
      };
    } catch (error) {
      logger.error('Failed to parse verification response', { error });
      return {
        questionId: request.questionId,
        isCorrect: false,
        confidence: 0,
        aiAssessment: 'Failed to parse AI response',
        shouldCreateGoldenRule: false,
      };
    }
  }

  // ===========================================================================
  // UEP Envelope Creation
  // ===========================================================================

  private createCuratorEnvelope(
    tenantId: string,
    operationType: string,
    input: Record<string, unknown>,
    output: Record<string, unknown>,
    options: {
      traceId: string;
      spanId: string;
      durationMs: number;
      complianceFrameworks?: string[];
    }
  ): UEPEnvelope {
    return {
      envelopeId: uuidv4(),
      specversion: '2.0',
      type: operationType,
      source: {
        system: 'RADIANT',
        component: 'curator-ai',
        version: RADIANT_VERSION,
        tenantId,
      },
      payload: {
        input: {
          type: 'structured',
          content: input,
        },
        output: {
          type: 'structured',
          content: output,
          finishReason: 'completed',
        },
        metadata: {
          operationType,
        },
      },
      tracing: {
        traceId: options.traceId,
        spanId: options.spanId,
        timestamp: new Date().toISOString(),
        durationMs: options.durationMs,
      },
      compliance: {
        frameworks: options.complianceFrameworks || [],
        dataClassification: 'internal',
        containsPHI: false,
        containsPII: false,
        retentionDays: 90,
        auditRequired: true,
      },
    };
  }
}

// =============================================================================
// Export Singleton
// =============================================================================

export const aiCuratorService = new AICuratorService();
export { AICuratorService };
export default aiCuratorService;
