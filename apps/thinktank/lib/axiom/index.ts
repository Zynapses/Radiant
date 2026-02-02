/**
 * AXIOM/CLARION Library Exports
 * 
 * Centralized exports for all AXIOM/CLARION related types,
 * hooks, and API functions.
 * 
 * @version 1.0.0
 * @since RADIANT v6.0.0
 */

// Types
export * from './types';

// API Functions
export {
  startSession,
  submitAnswer,
  skipQuestion,
  compilePrompt,
  abandonSession,
  submitFeedback,
  connectToSession,
  loadPreferences,
  savePreferences,
  loadAnswerHistory,
  saveAnswer,
  getCachedQuestions,
  cacheQuestions,
  clearQuestionCache,
  AxiomApiError,
} from './api';
export type { SSEConnection, SSEOptions, EventHandler } from './api';

// Hooks
export { useClarionPreferences } from './useClarionPreferences';
