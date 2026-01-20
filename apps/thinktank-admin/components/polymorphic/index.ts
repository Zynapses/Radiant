/**
 * Polymorphic UI Components (PROMPT-41)
 * 
 * Think Tank's Polymorphic UI system - the UI physically transforms
 * based on task complexity, domain hints, and drive profile.
 * 
 * "Flowise outputs Text. RADIANT outputs Applications."
 */

export { ViewRouter } from './view-router';
export type { 
  ViewState, 
  PolymorphicRouteDecision,
  ViewRouterProps,
  ViewComponentProps,
  ViewType,
  ExecutionMode,
  DomainHint,
} from './view-router';

export { TerminalView } from './views/terminal-view';
export { MindMapView } from './views/mindmap-view';
export { DiffEditorView } from './views/diff-editor-view';
export { DashboardView } from './views/dashboard-view';
export { DecisionCardsView } from './views/decision-cards-view';
export { ChatView } from './views/chat-view';
