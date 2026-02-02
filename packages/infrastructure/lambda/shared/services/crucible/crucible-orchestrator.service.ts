/**
 * The Crucible - Orchestrator Service
 * 
 * Manages the full lifecycle of a Crucible deliberation session,
 * coordinating between participants and integrating with Cato pipeline.
 * 
 * @version 1.0.0
 * @since v6.4.0
 */

import { Pool } from 'pg';
import {
  CrucibleSession,
  CrucibleQuestion,
  CrucibleAnswer,
  CrucibleFinalReport,
  CruciblePrePrompt,
  CrucibleModelType,
  QuestionType,
  SubmitQuestionRequest,
  SubmitAnswerRequest,
  SubmitFinalReportRequest,
} from '@radiant/shared';
import { CrucibleService } from './crucible.service';

export interface LLMInvoker {
  invoke(
    modelId: string,
    systemPrompt: string,
    userPrompt: string,
    options?: { timeout?: number }
  ): Promise<{ content: string; tokenCount: number; latencyMs: number }>;
}

export interface ModelInfoProvider {
  getModelInfo(modelId: string): Promise<{
    modelName: string;
    provider: string;
    modelType: CrucibleModelType;
    modelMode?: string;
    strengths?: string[];
  }>;
}

export interface CrucibleOrchestratorConfig {
  llmInvoker: LLMInvoker;
  modelInfoProvider: ModelInfoProvider;
}

export class CrucibleOrchestratorService {
  private crucibleService: CrucibleService;

  constructor(
    private pool: Pool,
    private config: CrucibleOrchestratorConfig
  ) {
    this.crucibleService = new CrucibleService(pool);
  }

  /**
   * Run a full Crucible deliberation session
   */
  async runDeliberation(
    tenantId: string,
    pipelineExecutionId: string,
    methodInvocationId: string,
    methodName: string,
    participantModelIds: string[],
    taskPrompt: string,
    options?: {
      costMode?: 'economy' | 'balanced' | 'thorough';
      maxQuestions?: number;
      skipInterrogation?: boolean;
    }
  ): Promise<{
    session: CrucibleSession;
    finalReports: CrucibleFinalReport[];
    winnerReport: CrucibleFinalReport | null;
  }> {
    // Phase 1: Create session
    const session = await this.crucibleService.createSession(
      tenantId,
      {
        pipelineExecutionId,
        methodInvocationId,
        methodName,
        participantModelIds,
        costMode: options?.costMode,
        maxQuestions: options?.maxQuestions,
      },
      async (modelId) => this.config.modelInfoProvider.getModelInfo(modelId)
    );

    try {
      // Phase 2: Generate and distribute pre-prompts
      const prePrompt = await this.crucibleService.generatePrePrompt(session.sessionId);
      
      // Phase 3: Get initial responses from all LLM participants
      const initialResponses = await this.getInitialResponses(
        session,
        prePrompt,
        taskPrompt
      );

      // Phase 4: Start deliberation
      await this.crucibleService.updateSessionStatus(session.sessionId, 'deliberating');

      // Phase 5: Run deliberation rounds
      await this.runDeliberationRounds(session, initialResponses, taskPrompt);

      // Phase 6: Collect final reports
      const finalReports = await this.collectFinalReports(
        session,
        initialResponses,
        taskPrompt
      );

      // Phase 7: Complete session and get winner
      const summary = await this.crucibleService.completeSession(session.sessionId);
      
      const completedSession = await this.crucibleService.getSession(session.sessionId);
      
      const winnerReport = finalReports.find(r => r.participantId === summary.winnerId) || null;

      return {
        session: completedSession!,
        finalReports,
        winnerReport,
      };
    } catch (error) {
      await this.crucibleService.updateSessionStatus(
        session.sessionId,
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  /**
   * Get initial responses from all LLM participants
   */
  private async getInitialResponses(
    session: CrucibleSession,
    prePrompt: CruciblePrePrompt,
    taskPrompt: string
  ): Promise<Map<string, string>> {
    const responses = new Map<string, string>();

    const llmParticipants = session.participants.filter(p => p.canDeliberate);

    await Promise.all(
      llmParticipants.map(async (participant) => {
        const systemPrompt = `${prePrompt.promptText}\n\nYou are participant ${participant.participantId} (${participant.modelName}).`;
        
        const userPrompt = `## Task\n\n${taskPrompt}\n\n## Instructions\n\nProvide your initial response to this task. After this, you will enter the deliberation phase where you can ask questions to other participants.`;

        try {
          const response = await this.config.llmInvoker.invoke(
            participant.modelId,
            systemPrompt,
            userPrompt,
            { timeout: session.config.sessionTimeoutSeconds * 1000 }
          );

          responses.set(participant.participantId, response.content);
        } catch (error) {
          responses.set(
            participant.participantId,
            `[Error getting initial response: ${error instanceof Error ? error.message : 'Unknown error'}]`
          );
        }
      })
    );

    return responses;
  }

  /**
   * Run deliberation rounds where participants ask questions
   */
  private async runDeliberationRounds(
    session: CrucibleSession,
    initialResponses: Map<string, string>,
    taskPrompt: string
  ): Promise<void> {
    let questionsRemaining = session.config.maxQuestions;
    const llmParticipants = session.participants.filter(p => p.canDeliberate);
    
    // Keep track of conversation history for each participant
    const conversationHistory = new Map<string, string[]>();
    for (const participant of llmParticipants) {
      conversationHistory.set(participant.participantId, []);
    }

    // Round-robin questioning until questions exhausted
    let roundNumber = 0;
    while (questionsRemaining > 0 && roundNumber < 10) {
      roundNumber++;
      
      for (const asker of llmParticipants) {
        if (questionsRemaining <= 0) break;

        // Ask LLM if they want to ask a question
        const questionDecision = await this.decideQuestion(
          session,
          asker,
          llmParticipants,
          initialResponses,
          conversationHistory,
          taskPrompt,
          questionsRemaining
        );

        if (!questionDecision.wantsToAsk) {
          continue;
        }

        // Submit the question
        const question = await this.crucibleService.submitQuestion({
          sessionId: session.sessionId,
          askerId: asker.participantId,
          targetId: questionDecision.targetId,
          questionText: questionDecision.questionText,
          questionType: questionDecision.questionType,
          previousQuestionId: questionDecision.previousQuestionId,
        });

        questionsRemaining--;

        // Get answer from target
        const target = llmParticipants.find(p => p.participantId === questionDecision.targetId)!;
        const answer = await this.getAnswer(
          session,
          target,
          question,
          initialResponses,
          conversationHistory,
          taskPrompt
        );

        // Update conversation history
        const historyEntry = `Q${question.questionNumber}: ${asker.modelName} asked ${target.modelName}: "${question.questionText}"\nA: "${answer.answerText}"`;
        
        for (const participant of llmParticipants) {
          conversationHistory.get(participant.participantId)!.push(historyEntry);
        }

        // Score question quality
        const quality = this.assessQuestionQuality(question.questionText, answer.answerText);
        await this.crucibleService.scoreQuestion(question.questionId, quality);
      }
    }
  }

  /**
   * Ask an LLM if they want to ask a question
   */
  private async decideQuestion(
    session: CrucibleSession,
    asker: { participantId: string; modelId: string; modelName: string },
    allParticipants: { participantId: string; modelName: string }[],
    initialResponses: Map<string, string>,
    conversationHistory: Map<string, string[]>,
    taskPrompt: string,
    questionsRemaining: number
  ): Promise<{
    wantsToAsk: boolean;
    targetId: string;
    questionText: string;
    questionType: QuestionType;
    previousQuestionId?: string;
  }> {
    const otherParticipants = allParticipants.filter(p => p.participantId !== asker.participantId);
    
    const participantResponses = otherParticipants.map(p => 
      `**${p.modelName} (${p.participantId})**: ${initialResponses.get(p.participantId) || '[No response]'}`
    ).join('\n\n');

    const history = conversationHistory.get(asker.participantId) || [];
    const historyText = history.length > 0 
      ? `\n\n## Deliberation History\n${history.join('\n\n')}`
      : '';

    const systemPrompt = `You are ${asker.modelName} participating in a competitive deliberation. You may ask up to ${questionsRemaining} more questions to improve your answer.

Remember:
- Questions are FREE - no penalty for asking
- You're in COMPETITION, not consensus
- Pick the participant most likely to have information you need
- Avoid circular reasoning - don't cite answers that cite you`;

    const userPrompt = `## Original Task
${taskPrompt}

## Other Participants' Initial Responses
${participantResponses}
${historyText}

## Your Decision
You have ${questionsRemaining} question(s) remaining. Do you want to ask a question to any participant?

If YES, respond in this exact format:
TARGET: [participant_id]
TYPE: [clarification|challenge|evidence|reasoning|edge_case|contradiction]
QUESTION: [your question]

If NO, respond with:
PASS

Choose wisely - you want to improve your competitive position.`;

    try {
      const response = await this.config.llmInvoker.invoke(
        asker.modelId,
        systemPrompt,
        userPrompt,
        { timeout: session.config.questionTimeoutSeconds * 1000 }
      );

      const content = response.content.trim();

      if (content.toUpperCase().startsWith('PASS')) {
        return { wantsToAsk: false, targetId: '', questionText: '', questionType: 'clarification' };
      }

      // Parse the response
      const targetMatch = content.match(/TARGET:\s*(\S+)/i);
      const typeMatch = content.match(/TYPE:\s*(\S+)/i);
      const questionMatch = content.match(/QUESTION:\s*(.+)/is);

      if (targetMatch && questionMatch) {
        const targetId = targetMatch[1];
        const questionType = (typeMatch?.[1]?.toLowerCase() || 'clarification') as QuestionType;
        const questionText = questionMatch[1].trim();

        // Validate target exists
        if (otherParticipants.some(p => p.participantId === targetId)) {
          return {
            wantsToAsk: true,
            targetId,
            questionText,
            questionType,
          };
        }
      }

      return { wantsToAsk: false, targetId: '', questionText: '', questionType: 'clarification' };
    } catch {
      return { wantsToAsk: false, targetId: '', questionText: '', questionType: 'clarification' };
    }
  }

  /**
   * Get an answer from a participant
   */
  private async getAnswer(
    session: CrucibleSession,
    target: { participantId: string; modelId: string; modelName: string },
    question: CrucibleQuestion,
    initialResponses: Map<string, string>,
    conversationHistory: Map<string, string[]>,
    taskPrompt: string
  ): Promise<CrucibleAnswer> {
    const myInitialResponse = initialResponses.get(target.participantId) || '';
    const history = conversationHistory.get(target.participantId) || [];

    const systemPrompt = `You are ${target.modelName} in a competitive deliberation. You're being asked a question by another participant. Answer honestly and accurately - remember that circular citations (citing answers that cite you) will be penalized.`;

    const userPrompt = `## Original Task
${taskPrompt}

## Your Initial Response
${myInitialResponse}

## Previous Deliberation
${history.length > 0 ? history.join('\n\n') : 'None yet.'}

## Question from ${question.askerId}
Type: ${question.questionType}
Question: ${question.questionText}

## Instructions
Provide a clear, honest answer. If you cite other participants' responses, note which participant you're citing. Avoid circular reasoning.`;

    try {
      const startTime = Date.now();
      const response = await this.config.llmInvoker.invoke(
        target.modelId,
        systemPrompt,
        userPrompt,
        { timeout: session.config.questionTimeoutSeconds * 1000 }
      );

      const answer = await this.crucibleService.submitAnswer({
        questionId: question.questionId,
        answerText: response.content,
        citations: this.extractCitations(response.content, session.participants),
      });

      return answer;
    } catch (error) {
      // Submit error as answer
      return await this.crucibleService.submitAnswer({
        questionId: question.questionId,
        answerText: `[Error: ${error instanceof Error ? error.message : 'Failed to generate answer'}]`,
      });
    }
  }

  /**
   * Extract citations from answer text
   */
  private extractCitations(
    answerText: string,
    participants: { participantId: string; modelName: string }[]
  ): { sourceType: 'self' | 'other_participant' | 'external' | 'unknown'; sourceParticipantId?: string; citationText: string }[] {
    const citations: { sourceType: 'self' | 'other_participant' | 'external' | 'unknown'; sourceParticipantId?: string; citationText: string }[] = [];

    // Look for references to other participants
    for (const participant of participants) {
      const patterns = [
        new RegExp(`${participant.modelName}\\s+(said|mentioned|stated|claimed|argued)`, 'gi'),
        new RegExp(`according to\\s+${participant.modelName}`, 'gi'),
        new RegExp(`${participant.participantId}\\s+(said|mentioned|stated)`, 'gi'),
      ];

      for (const pattern of patterns) {
        const matches = answerText.match(pattern);
        if (matches) {
          for (const match of matches) {
            citations.push({
              sourceType: 'other_participant',
              sourceParticipantId: participant.participantId,
              citationText: match,
            });
          }
        }
      }
    }

    return citations;
  }

  /**
   * Assess question quality
   */
  private assessQuestionQuality(
    questionText: string,
    answerText: string
  ): 'low' | 'medium' | 'high' | 'exceptional' {
    const questionLength = questionText.length;
    const answerLength = answerText.length;

    // Simple heuristics - would use more sophisticated analysis in production
    const hasSpecificTarget = /specific|exactly|precisely|detail/i.test(questionText);
    const challengesAssertion = /but|however|contradiction|disagree|wrong/i.test(questionText);
    const requestsEvidence = /evidence|source|proof|example|data/i.test(questionText);
    const substantiveAnswer = answerLength > 200;

    let score = 0;
    if (questionLength > 50) score++;
    if (hasSpecificTarget) score++;
    if (challengesAssertion) score++;
    if (requestsEvidence) score++;
    if (substantiveAnswer) score++;

    if (score >= 4) return 'exceptional';
    if (score >= 3) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  /**
   * Collect final reports from all participants
   */
  private async collectFinalReports(
    session: CrucibleSession,
    initialResponses: Map<string, string>,
    taskPrompt: string
  ): Promise<CrucibleFinalReport[]> {
    const llmParticipants = session.participants.filter(p => p.canDeliberate);
    const questions = await this.crucibleService.getSessionQuestions(session.sessionId);
    const finalReports: CrucibleFinalReport[] = [];

    await this.crucibleService.updateSessionStatus(session.sessionId, 'finalizing');

    for (const participant of llmParticipants) {
      const myInitialResponse = initialResponses.get(participant.participantId) || '';
      
      // Build deliberation summary for this participant
      const relevantQuestions = questions.filter(
        q => q.askerId === participant.participantId || q.targetId === participant.participantId
      );

      const deliberationSummary = relevantQuestions.map(q => {
        const role = q.askerId === participant.participantId ? 'Asked' : 'Answered';
        return `${role}: ${q.questionText}${q.answer ? `\nAnswer: ${q.answer.answerText}` : ''}`;
      }).join('\n\n');

      const systemPrompt = `You are ${participant.modelName}. The deliberation phase is complete. Based on the questions and answers exchanged, provide your final refined answer.`;

      const userPrompt = `## Original Task
${taskPrompt}

## Your Initial Response
${myInitialResponse}

## Deliberation Summary
${deliberationSummary || 'No deliberation occurred.'}

## Instructions
Provide your FINAL answer, incorporating any insights from the deliberation. Also provide:
1. Your confidence level (0-1)
2. Key insights you gained from deliberation
3. Any weaknesses you identified in your own answer

Format your response as:
FINAL_ANSWER: [your refined answer]
CONFIDENCE: [0.0-1.0]
INSIGHTS: [comma-separated list of insights]
WEAKNESSES: [comma-separated list of weaknesses]
REFINEMENT_NOTES: [what you changed and why]`;

      try {
        const response = await this.config.llmInvoker.invoke(
          participant.modelId,
          systemPrompt,
          userPrompt,
          { timeout: session.config.sessionTimeoutSeconds * 1000 }
        );

        const content = response.content;

        // Parse the response
        const finalAnswerMatch = content.match(/FINAL_ANSWER:\s*(.+?)(?=CONFIDENCE:|$)/is);
        const confidenceMatch = content.match(/CONFIDENCE:\s*([\d.]+)/i);
        const insightsMatch = content.match(/INSIGHTS:\s*(.+?)(?=WEAKNESSES:|$)/is);
        const weaknessesMatch = content.match(/WEAKNESSES:\s*(.+?)(?=REFINEMENT_NOTES:|$)/is);
        const notesMatch = content.match(/REFINEMENT_NOTES:\s*(.+)/is);

        const report = await this.crucibleService.submitFinalReport({
          sessionId: session.sessionId,
          participantId: participant.participantId,
          refinedOutput: finalAnswerMatch?.[1]?.trim() || content,
          refinementNotes: notesMatch?.[1]?.trim(),
          confidence: parseFloat(confidenceMatch?.[1] || '0.7'),
          selfAssessedAccuracy: parseFloat(confidenceMatch?.[1] || '0.7'),
          keyInsights: insightsMatch?.[1]?.split(',').map(s => s.trim()).filter(Boolean) || [],
          identifiedWeaknesses: weaknessesMatch?.[1]?.split(',').map(s => s.trim()).filter(Boolean) || [],
        });

        finalReports.push(report);
      } catch (error) {
        // Submit error report
        const report = await this.crucibleService.submitFinalReport({
          sessionId: session.sessionId,
          participantId: participant.participantId,
          refinedOutput: myInitialResponse || `[Error: ${error instanceof Error ? error.message : 'Failed to generate final report'}]`,
          confidence: 0.3,
          selfAssessedAccuracy: 0.3,
          keyInsights: [],
          identifiedWeaknesses: ['Failed to complete deliberation'],
        });

        finalReports.push(report);
      }
    }

    return finalReports;
  }
}
