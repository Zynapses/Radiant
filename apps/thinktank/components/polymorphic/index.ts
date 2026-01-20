/**
 * Polymorphic UI Components for Think Tank Consumer App
 * 
 * The UI physically transforms based on task complexity, domain hints, and mode.
 */

export { ViewRouter, ViewMorphTransition } from './view-router';
export type { 
  ViewType, 
  ExecutionMode, 
  DomainHint,
  ViewState, 
  ViewComponentProps,
  ViewRouterProps,
} from './view-router';
