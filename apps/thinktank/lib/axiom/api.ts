/**
 * AXIOM/CLARION API Client
 * 
 * Provides API functions for AXIOM session management with SSE support
 * for real-time updates during the clarification flow.
 * 
 * @version 1.0.0
 * @since RADIANT v6.0.0
 */

import type {
  StartSessionRequest,
  StartSessionResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  SkipQuestionRequest,
  SkipQuestionResponse,
  CompilePromptRequest,
  CompilePromptResponse,
  FeedbackData,
  AxiomEvent,
  AxiomEventType,
} from './types';

const API_BASE = '/api/v2/axiom';

// =============================================================================
// Error Handling
// =============================================================================

export class AxiomApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AxiomApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new AxiomApiError(
      errorData.message || `Request failed with status ${response.status}`,
      errorData.code || 'UNKNOWN_ERROR',
      response.status,
      response.status >= 500 || response.status === 429
    );
  }
  return response.json();
}

// =============================================================================
// REST API Functions
// =============================================================================

export async function startSession(
  request: StartSessionRequest
): Promise<StartSessionResponse> {
  const response = await fetch(`${API_BASE}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return handleResponse<StartSessionResponse>(response);
}

export async function submitAnswer(
  sessionId: string,
  request: SubmitAnswerRequest
): Promise<SubmitAnswerResponse> {
  const response = await fetch(`${API_BASE}/session/${sessionId}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return handleResponse<SubmitAnswerResponse>(response);
}

export async function skipQuestion(
  sessionId: string,
  request: SkipQuestionRequest
): Promise<SkipQuestionResponse> {
  const response = await fetch(`${API_BASE}/session/${sessionId}/skip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return handleResponse<SkipQuestionResponse>(response);
}

export async function compilePrompt(
  sessionId: string,
  request?: CompilePromptRequest
): Promise<CompilePromptResponse> {
  const response = await fetch(`${API_BASE}/session/${sessionId}/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request || {}),
  });
  return handleResponse<CompilePromptResponse>(response);
}

export async function abandonSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/session/${sessionId}/abandon`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new AxiomApiError(
      'Failed to abandon session',
      'ABANDON_FAILED',
      response.status
    );
  }
}

export async function submitFeedback(
  sessionId: string,
  feedback: FeedbackData
): Promise<void> {
  const response = await fetch(`${API_BASE}/session/${sessionId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(feedback),
  });
  if (!response.ok) {
    console.error('Failed to submit feedback:', response.status);
  }
}

// =============================================================================
// SSE Stream Connection
// =============================================================================

export type EventHandler<T = unknown> = (event: AxiomEvent<T>) => void;

export interface SSEConnection {
  close: () => void;
  isConnected: () => boolean;
}

export interface SSEOptions {
  onOpen?: () => void;
  onError?: (error: Error) => void;
  onReconnect?: (attempt: number) => void;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
}

export function connectToSession(
  sessionId: string,
  handlers: Partial<Record<AxiomEventType, EventHandler>>,
  options: SSEOptions = {}
): SSEConnection {
  const {
    onOpen,
    onError,
    onReconnect,
    maxReconnectAttempts = 3,
    reconnectDelay = 1000,
  } = options;

  let eventSource: EventSource | null = null;
  let reconnectAttempts = 0;
  let isClosing = false;

  function connect() {
    if (isClosing) return;

    eventSource = new EventSource(`${API_BASE}/stream?sessionId=${sessionId}`);

    eventSource.onopen = () => {
      reconnectAttempts = 0;
      onOpen?.();
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as AxiomEvent;
        const handler = handlers[data.type];
        if (handler) {
          handler(data);
        }
      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    };

    eventSource.onerror = () => {
      if (isClosing) return;

      eventSource?.close();

      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        onReconnect?.(reconnectAttempts);
        setTimeout(connect, reconnectDelay * reconnectAttempts);
      } else {
        onError?.(new Error('SSE connection failed after max retries'));
      }
    };
  }

  connect();

  return {
    close: () => {
      isClosing = true;
      eventSource?.close();
      eventSource = null;
    },
    isConnected: () => eventSource?.readyState === EventSource.OPEN,
  };
}

// =============================================================================
// Preferences API
// =============================================================================

export async function loadPreferences(): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch('/api/user/preferences/clarion');
    if (response.ok) {
      return response.json();
    }
    return null;
  } catch {
    return null;
  }
}

export async function savePreferences(
  preferences: Record<string, unknown>
): Promise<void> {
  await fetch('/api/user/preferences/clarion', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences),
  });
}

// =============================================================================
// Answer History API
// =============================================================================

export async function loadAnswerHistory(): Promise<Record<string, unknown>[]> {
  try {
    const response = await fetch('/api/user/axiom/history');
    if (response.ok) {
      return response.json();
    }
    return [];
  } catch {
    return [];
  }
}

export async function saveAnswer(
  questionId: string,
  answer: string | string[] | number | boolean
): Promise<void> {
  try {
    await fetch('/api/user/axiom/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, answer }),
    });
  } catch {
    // Silently fail - history is non-critical
  }
}

// =============================================================================
// Question Cache API
// =============================================================================

const CACHE_KEY = 'axiom_question_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getCachedQuestions(domainId: string): unknown[] | null {
  try {
    const cacheStr = localStorage.getItem(CACHE_KEY);
    if (!cacheStr) return null;

    const cache = JSON.parse(cacheStr);
    const entry = cache[domainId];
    
    if (entry && entry.expiresAt > Date.now()) {
      return entry.questions;
    }
    return null;
  } catch {
    return null;
  }
}

export function cacheQuestions(domainId: string, questions: unknown[]): void {
  try {
    const cacheStr = localStorage.getItem(CACHE_KEY);
    const cache = cacheStr ? JSON.parse(cacheStr) : {};
    
    cache[domainId] = {
      questions,
      cachedAt: Date.now(),
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Silently fail - caching is non-critical
  }
}

export function clearQuestionCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Silently fail
  }
}
