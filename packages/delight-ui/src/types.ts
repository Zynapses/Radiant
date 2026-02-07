/**
 * @radiant/delight-ui - Shared Delight UX Types
 *
 * Types for the cross-app Delight system. These complement the backend
 * types in @radiant/shared with frontend-specific concerns.
 */

export type PersonalityMode = 'auto' | 'professional' | 'subtle' | 'expressive' | 'playful';

export type InjectionPoint =
  | 'pre_execution'
  | 'during_execution'
  | 'post_execution'
  | 'error_recovery'
  | 'idle'
  | 'milestone'
  | 'onboarding'
  | 'page_load'
  | 'action_complete'
  | 'session_start'
  | 'session_end';

export type DisplayStyle = 'toast' | 'banner' | 'inline' | 'celebration' | 'subtle';

export interface DelightMessage {
  id: string;
  text: string;
  icon?: string;
  displayStyle: DisplayStyle;
  duration?: number;
  sound?: string;
}

export interface DelightToastData {
  id: number;
  message: string;
  icon: string;
  style: DisplayStyle;
}

export interface AppDelightConfig {
  /** Unique app identifier */
  appId: string;
  /** Display name for the app */
  appName: string;
  /** Base API URL for the delight backend */
  apiBaseUrl?: string;
  /** Default personality mode */
  defaultPersonalityMode?: PersonalityMode;
  /** Whether sound effects are enabled by default */
  defaultSoundEnabled?: boolean;
  /**
   * Tenant-level master toggle. When false, ALL delight output
   * (toasts, sounds, animations, narration) is suppressed.
   * Set by the tenant admin in Organization Settings.
   */
  tenantDelightEnabled?: boolean;
  /**
   * Tenant-enforced personality mode. When set alongside
   * tenantAllowUserOverride=false, users cannot change their mode.
   */
  tenantDefaultMode?: PersonalityMode;
  /**
   * Whether individual users can override the tenant default mode.
   * When false, all users are locked to tenantDefaultMode.
   */
  tenantAllowUserOverride?: boolean;
  /** App-specific progress messages for pre-execution */
  preExecutionMessages?: string[];
  /** App-specific progress messages during execution */
  duringExecutionMessages?: string[];
  /** App-specific messages for post-execution (success) */
  postExecutionMessages?: string[];
  /** App-specific messages for error recovery */
  errorRecoveryMessages?: string[];
  /** App-specific messages for page load / session start */
  greetingMessages?: string[];
  /** App-specific milestone messages */
  milestoneMessages?: string[];
  /** Custom injection point handlers */
  customInjectionPoints?: Record<string, string[]>;
}

export interface RadiantDelightContextValue {
  /** Current personality mode */
  personalityMode: PersonalityMode;
  /** Set personality mode */
  setPersonalityMode: (mode: PersonalityMode) => void;
  /** Whether sound is enabled */
  soundEnabled: boolean;
  /** Toggle sound */
  setSoundEnabled: (enabled: boolean) => void;
  /** Show a delight message at an injection point */
  triggerDelight: (injectionPoint: InjectionPoint, metadata?: Record<string, unknown>) => void;
  /** Show a custom delight toast */
  showDelightToast: (message: string, icon?: string, style?: DisplayStyle) => void;
  /** Play a sound effect */
  playSound: (type: 'success' | 'error' | 'milestone' | 'subtle') => void;
  /** The app configuration */
  config: AppDelightConfig;
}
