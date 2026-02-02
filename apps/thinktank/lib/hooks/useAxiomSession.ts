'use client';

/**
 * useAxiomSession - React hook for AXIOM/CLARION session management
 * 
 * Manages the full AXIOM session lifecycle:
 * - Session initialization
 * - Question/answer flow
 * - Model predictions
 * - Prompt compilation
 * - Feedback signal capture
 * - Question tree caching (offline support)
 * 
 * @version 2.1.0
 * @since RADIANT v6.0.0
 */

import { useState, useCallback, useEffect } from 'react';

// Types
type WorkflowStep = 'classify' | 'clarify' | 'compile' | 'route';
type StepStatus = 'pending' | 'active' | 'completed';
type SessionStatus = 'active' | 'ready_to_compile' | 'awaiting_clarification' | 'completed' | 'abandoned';
type QuestionType = 'choice' | 'multi_select' | 'text' | 'scale' | 'boolean';

interface Question {
  questionId: string;
  type: 'choice' | 'multi_select' | 'text' | 'scale' | 'boolean';
  text: { en: string; [locale: string]: string | undefined };
  options?: { en: string[]; [locale: string]: string[] | undefined };
  category: string;
}

interface ModelScore {
  modelId: string;
  modelName: string;
  provider: string;
  score: number;
  previousScore?: number;
  isLeading: boolean;
  reasons: string[];
}

interface WorkflowProgress {
  currentStep: WorkflowStep;
  steps: Array<{
    step: WorkflowStep;
    label: string;
    status: StepStatus;
  }>;
  overallProgress: number;
}

interface Domain {
  path: string[];
  name: string;
  confidence: number;
}

interface ModelPrediction {
  modelId: string;
  modelName: string;
  provider: string;
  score: number;
  reasons?: string[];
}

interface CompiledPrompt {
  systemPrompt: string;
  userPrompt: string;
  modelId: string;
  modelName: string;
  tokenCount: number;
}

interface AxiomSessionState {
  sessionId: string | null;
  status: SessionStatus;
  workflow: WorkflowProgress;
  domain: Domain | null;
  currentQuestion: Question | null;
  answeredCount: number;
  modelScores: ModelScore[];
  compiledPrompt: CompiledPrompt | null;
  isLoading: boolean;
  error: string | null;
}

const API_BASE = '/api/v2/axiom';

const initialWorkflow: WorkflowProgress = {
  currentStep: 'classify',
  steps: [
    { step: 'classify', label: 'Classify', status: 'active' },
    { step: 'clarify', label: 'Clarify', status: 'pending' },
    { step: 'compile', label: 'Compile', status: 'pending' },
    { step: 'route', label: 'Route', status: 'pending' },
  ],
  overallProgress: 0,
};

// Cache constants (moved outside hook for stable references)
const CACHE_KEY = 'axiom_question_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function useAxiomSession() {
  const [state, setState] = useState<AxiomSessionState>({
    sessionId: null,
    status: 'active',
    workflow: initialWorkflow,
    domain: null,
    currentQuestion: null,
    answeredCount: 0,
    modelScores: [],
    compiledPrompt: null,
    isLoading: false,
    error: null,
  });

  /**
   * Start a new AXIOM session
   */
  const startSession = useCallback(async (query: string, locale?: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`${API_BASE}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, locale }),
      });

      if (!response.ok) {
        throw new Error('Failed to start session');
      }

      const data = await response.json();

      // Update workflow progress
      const workflow: WorkflowProgress = {
        currentStep: 'clarify',
        steps: [
          { step: 'classify', label: 'Classify', status: 'completed' },
          { step: 'clarify', label: 'Clarify', status: 'active' },
          { step: 'compile', label: 'Compile', status: 'pending' },
          { step: 'route', label: 'Route', status: 'pending' },
        ],
        overallProgress: 25,
      };

      // Parse model predictions into scores
      const modelScores: ModelScore[] = (data.modelPredictions || []).map(
        (p: ModelPrediction, idx: number) => ({
          modelId: p.modelId,
          modelName: p.modelName,
          provider: p.provider,
          score: Math.round(p.score * 100),
          isLeading: idx === 0,
          reasons: p.reasons || [],
        })
      );

      setState(prev => ({
        ...prev,
        sessionId: data.sessionId,
        status: data.status,
        workflow,
        domain: {
          path: data.domain.split('.'),
          name: data.domain,
          confidence: data.domainConfidence,
        },
        currentQuestion: data.currentQuestion,
        modelScores,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);

  /**
   * Submit an answer to the current question
   */
  const submitAnswer = useCallback(async (
    questionId: string,
    answer: string | string[] | number | boolean
  ) => {
    if (!state.sessionId) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch(`${API_BASE}/session/${state.sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, answer }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit answer');
      }

      const data = await response.json();

      // Update model scores with previous values for animation
      const modelScores: ModelScore[] = (data.modelPredictions || []).map(
        (p: ModelPrediction, idx: number) => {
          const prev = state.modelScores.find(m => m.modelId === p.modelId);
          return {
            modelId: p.modelId,
            modelName: p.modelName,
            provider: p.provider,
            score: Math.round(p.score * 100),
            previousScore: prev?.score,
            isLeading: idx === 0,
            reasons: p.reasons || [],
          };
        }
      );

      // Update workflow progress
      const progress = 25 + ((state.answeredCount + 1) / 5) * 25;
      const workflow: WorkflowProgress = {
        currentStep: data.readyToCompile ? 'compile' : 'clarify',
        steps: [
          { step: 'classify', label: 'Classify', status: 'completed' },
          { step: 'clarify', label: 'Clarify', status: data.readyToCompile ? 'completed' : 'active' },
          { step: 'compile', label: 'Compile', status: data.readyToCompile ? 'active' : 'pending' },
          { step: 'route', label: 'Route', status: 'pending' },
        ],
        overallProgress: Math.min(progress, 50),
      };

      setState(prev => ({
        ...prev,
        status: data.status,
        workflow,
        currentQuestion: data.nextQuestion,
        answeredCount: prev.answeredCount + 1,
        modelScores,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [state.sessionId, state.modelScores, state.answeredCount]);

  /**
   * Skip the current question
   */
  const skipQuestion = useCallback(async (questionId: string, reason?: string) => {
    if (!state.sessionId) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch(`${API_BASE}/session/${state.sessionId}/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, reason }),
      });

      if (!response.ok) {
        throw new Error('Failed to skip question');
      }

      const data = await response.json();

      setState(prev => ({
        ...prev,
        status: data.status,
        currentQuestion: data.nextQuestion,
        answeredCount: prev.answeredCount + 1,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [state.sessionId]);

  /**
   * Compile the optimized prompt
   */
  const compile = useCallback(async (forceCompile?: boolean) => {
    if (!state.sessionId) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch(`${API_BASE}/session/${state.sessionId}/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceCompile }),
      });

      if (!response.ok) {
        throw new Error('Failed to compile prompt');
      }

      const data = await response.json();

      if (data.status === 'ready' && data.compiledPrompt) {
        const prompt = data.compiledPrompt.prompt;
        const model = data.compiledPrompt.model;

        // Update workflow to completed
        const workflow: WorkflowProgress = {
          currentStep: 'route',
          steps: [
            { step: 'classify', label: 'Classify', status: 'completed' },
            { step: 'clarify', label: 'Clarify', status: 'completed' },
            { step: 'compile', label: 'Compile', status: 'completed' },
            { step: 'route', label: 'Route', status: 'completed' },
          ],
          overallProgress: 100,
        };

        setState(prev => ({
          ...prev,
          status: 'completed',
          workflow,
          compiledPrompt: {
            systemPrompt: prompt.systemPrompt,
            userPrompt: prompt.userPrompt,
            modelId: model.modelId,
            modelName: model.modelName,
            tokenCount: data.compiledPrompt.metadata?.tokenCount || 0,
          },
          isLoading: false,
        }));
      } else if (data.clarificationNeeded) {
        // Handle clarification request
        setState(prev => ({
          ...prev,
          status: 'awaiting_clarification',
          isLoading: false,
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [state.sessionId]);

  /**
   * Reset the session
   */
  const reset = useCallback(() => {
    setState({
      sessionId: null,
      status: 'active',
      workflow: initialWorkflow,
      domain: null,
      currentQuestion: null,
      answeredCount: 0,
      modelScores: [],
      compiledPrompt: null,
      isLoading: false,
      error: null,
    });
  }, []);

  // ===========================================================================
  // Feedback Signal Capture
  // ===========================================================================

  /**
   * Submit feedback on a session (rating, thumbs up/down)
   */
  const submitFeedback = useCallback(async (params: {
    feedbackType: 'rating' | 'thumbs' | 'correction' | 'skip_reason';
    targetType: 'session' | 'question' | 'model' | 'prompt';
    targetId: string;
    value: Record<string, unknown>;
  }) => {
    if (!state.sessionId) return;

    try {
      await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId,
          ...params,
        }),
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  }, [state.sessionId]);

  /**
   * Rate the overall session quality (1-5)
   */
  const rateSession = useCallback(async (rating: number) => {
    if (!state.sessionId) return;
    await submitFeedback({
      feedbackType: 'rating',
      targetType: 'session',
      targetId: state.sessionId,
      value: { rating },
    });
  }, [state.sessionId, submitFeedback]);

  /**
   * Thumbs up/down on compiled prompt
   */
  const ratePrompt = useCallback(async (thumbsUp: boolean) => {
    if (!state.sessionId || !state.compiledPrompt) return;
    await submitFeedback({
      feedbackType: 'thumbs',
      targetType: 'prompt',
      targetId: state.sessionId,
      value: { thumbs: thumbsUp ? 'up' : 'down' },
    });
  }, [state.sessionId, state.compiledPrompt, submitFeedback]);

  /**
   * Submit a correction to the compiled prompt
   */
  const submitCorrection = useCallback(async (correction: string) => {
    if (!state.sessionId) return;
    await submitFeedback({
      feedbackType: 'correction',
      targetType: 'prompt',
      targetId: state.sessionId,
      value: { correction },
    });
  }, [state.sessionId, submitFeedback]);

  // ===========================================================================
  // Question Tree Caching (Offline Support)
  // ===========================================================================

  /**
   * Cache question tree for a domain (for offline use)
   */
  const cacheQuestionTree = useCallback((domainId: string, questions: Question[]) => {
    try {
      const cache = getQuestionCache();
      cache[domainId] = {
        questions,
        cachedAt: Date.now(),
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Failed to cache questions:', error);
    }
  }, []);

  /**
   * Get cached questions for a domain
   */
  const getCachedQuestions = useCallback((domainId: string): Question[] | null => {
    try {
      const cache = getQuestionCache();
      const entry = cache[domainId];
      if (entry && entry.expiresAt > Date.now()) {
        return entry.questions;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  /**
   * Clear expired cache entries
   */
  const cleanQuestionCache = useCallback(() => {
    try {
      const cache = getQuestionCache();
      const now = Date.now();
      let cleaned = false;
      for (const domainId of Object.keys(cache)) {
        if (cache[domainId].expiresAt < now) {
          delete cache[domainId];
          cleaned = true;
        }
      }
      if (cleaned) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      }
    } catch (error) {
      console.error('Failed to clean cache:', error);
    }
  }, []);

  // Clean cache on mount
  useEffect(() => {
    cleanQuestionCache();
  }, [cleanQuestionCache]);

  // ===========================================================================
  // SSE Connection for Real-Time Updates (UEP)
  // ===========================================================================

  /**
   * Connect to SSE stream for real-time session updates
   */
  const connectToStream = useCallback((sessionId: string) => {
    const eventSource = new EventSource(`${API_BASE}/stream?sessionId=${sessionId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'connected':
          case 'session_started':
            // Initial connection - state already set from startSession
            break;

          case 'model_scores_update':
            setState(prev => {
              const newScores = (data.data.scores || []).map(
                (s: ModelScore, idx: number) => {
                  const prevScore = prev.modelScores.find(m => m.modelId === s.modelId);
                  return {
                    ...s,
                    previousScore: prevScore?.score,
                    isLeading: idx === 0,
                  };
                }
              );
              return { ...prev, modelScores: newScores };
            });
            break;

          case 'confidence_update':
            setState(prev => ({
              ...prev,
              domain: prev.domain ? {
                ...prev.domain,
                confidence: data.data.confidence,
              } : null,
            }));
            break;

          case 'question_selected':
            setState(prev => ({
              ...prev,
              currentQuestion: {
                questionId: data.data.questionId,
                type: data.data.type as QuestionType,
                text: { en: data.data.text },
                options: data.data.options ? { en: data.data.options } : undefined,
                category: data.data.category,
                priority: 0,
              },
            }));
            break;

          case 'clarification_complete':
            setState(prev => ({
              ...prev,
              status: 'ready_to_compile',
              currentQuestion: null,
              workflow: {
                ...prev.workflow,
                currentStep: 'compile',
                steps: prev.workflow.steps.map(s => ({
                  ...s,
                  status: s.step === 'classify' || s.step === 'clarify' ? 'completed' : 
                          s.step === 'compile' ? 'active' : 'pending',
                })),
                overallProgress: 50,
              },
            }));
            break;

          case 'compilation_complete':
            if (data.data.status === 'success' && data.data.prompt) {
              setState(prev => ({
                ...prev,
                status: 'completed',
                compiledPrompt: {
                  systemPrompt: data.data.prompt.systemPrompt,
                  userPrompt: data.data.prompt.userPrompt,
                  modelId: data.data.selectedModel?.modelId || '',
                  modelName: data.data.selectedModel?.modelName || '',
                  tokenCount: 0,
                },
                workflow: {
                  ...prev.workflow,
                  currentStep: 'route',
                  steps: prev.workflow.steps.map(s => ({ ...s, status: 'completed' })),
                  overallProgress: 100,
                },
              }));
            }
            break;

          case 'session_error':
            setState(prev => ({
              ...prev,
              error: data.data.message || 'Session error',
              isLoading: false,
            }));
            break;

          case 'heartbeat':
            // Keep-alive, no state change needed
            break;
        }
      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
      eventSource.close();
    };

    return () => eventSource.close();
  }, []);

  // Connect to SSE when session starts
  useEffect(() => {
    if (state.sessionId && state.status === 'active') {
      const cleanup = connectToStream(state.sessionId);
      return cleanup;
    }
  }, [state.sessionId, state.status, connectToStream]);

  return {
    ...state,
    startSession,
    submitAnswer,
    skipQuestion,
    compile,
    reset,
    // Feedback
    submitFeedback,
    rateSession,
    ratePrompt,
    submitCorrection,
    // Caching
    cacheQuestionTree,
    getCachedQuestions,
    cleanQuestionCache,
    // SSE
    connectToStream,
  };
}

// Helper to get question cache from localStorage
function getQuestionCache(): Record<string, { questions: Question[]; cachedAt: number; expiresAt: number }> {
  try {
    const cached = localStorage.getItem('axiom_question_cache');
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
}

// Re-export Question type for consumers
export type { Question };
