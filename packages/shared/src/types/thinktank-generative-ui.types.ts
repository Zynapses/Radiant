// Think Tank Generative UI Types
// Enables the "App Factory" - transforming responses into interactive applications
// "It transforms Think Tank from a chatbot into a dynamic software generator.
//  Gemini 3 can write the code for a calculator, but it cannot become the calculator."

import type { UIComponentSchema, UIComponentType, GeneratedUI } from './cognitive-architecture.types';

// ============================================================================
// THINK TANK RESPONSE WITH GENERATIVE UI
// ============================================================================

/**
 * Extended Think Tank response that includes both text AND generated UI
 * Users can switch between "Response" view and "App" view
 */
export interface ThinkTankEnhancedResponse {
  // Standard response
  messageId: string;
  conversationId: string;
  textResponse: string;
  
  // Generated UI (the "App")
  hasGeneratedUI: boolean;
  generatedUI?: GeneratedUI;
  
  // View state
  defaultView: 'response' | 'app' | 'split';
  availableViews: ('response' | 'app' | 'split')[];
  
  // Metadata
  generationReason?: string; // Why UI was generated
  uiGenerationTimeMs?: number;
  
  // User preference for this message
  preferredView?: 'response' | 'app' | 'split';
}

/**
 * Think Tank message with switchable views
 */
export interface ThinkTankSwitchableMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  
  // Content options
  content: {
    text: string;
    app?: GeneratedUIApp;
  };
  
  // Current active view
  activeView: 'text' | 'app' | 'split';
  
  // UI generation metadata
  appGeneration?: {
    detected: boolean;
    reason: string;
    componentTypes: UIComponentType[];
    generatedAt: Date;
    interactionCount: number;
  };
  
  timestamp: Date;
}

/**
 * A generated "App" - the interactive UI that replaces/supplements text
 */
export interface GeneratedUIApp {
  id: string;
  title: string;
  description: string;
  
  // Components that make up the app
  components: UIComponentSchema[];
  layout: AppLayout;
  
  // State management
  state: Record<string, unknown>;
  computedValues: Record<string, unknown>;
  
  // Interactivity
  isInteractive: boolean;
  lastInteraction?: Date;
  interactionHistory: AppInteraction[];
  
  // Theme
  theme: 'light' | 'dark' | 'auto';
}

export type AppLayout = 
  | { type: 'single' }
  | { type: 'stack'; direction: 'vertical' | 'horizontal'; gap: number }
  | { type: 'grid'; columns: number; gap: number }
  | { type: 'tabs'; defaultTab: number }
  | { type: 'split'; ratio: [number, number] };

export interface AppInteraction {
  timestamp: Date;
  componentId: string;
  inputId: string;
  previousValue: unknown;
  newValue: unknown;
  computedOutputs: Record<string, unknown>;
}

// ============================================================================
// VIEW TOGGLE CONFIGURATION
// ============================================================================

export interface ViewToggleConfig {
  // Default view preference
  defaultView: 'response' | 'app' | 'split' | 'auto';
  
  // Auto-switch behavior
  autoSwitchToApp: boolean; // Automatically show app view when UI is generated
  autoSwitchThreshold: number; // Min confidence to auto-switch (0-1)
  
  // Animation
  transitionDuration: number; // ms
  transitionType: 'fade' | 'slide' | 'none';
  
  // Split view
  splitRatio: [number, number]; // e.g., [1, 1] for 50/50
  splitDirection: 'horizontal' | 'vertical';
  
  // Persistence
  rememberPreference: boolean;
}

export const DEFAULT_VIEW_TOGGLE_CONFIG: ViewToggleConfig = {
  defaultView: 'auto',
  autoSwitchToApp: true,
  autoSwitchThreshold: 0.7,
  transitionDuration: 300,
  transitionType: 'fade',
  splitRatio: [1, 1],
  splitDirection: 'horizontal',
  rememberPreference: true,
};

// ============================================================================
// CALCULATOR COMPONENT (Example of "becoming the calculator")
// ============================================================================

export interface CalculatorComponentState {
  inputs: Record<string, number | string>;
  formula: string;
  result: number | string | null;
  error?: string;
}

export interface CalculatorConfig {
  title: string;
  description?: string;
  inputs: CalculatorInput[];
  formula: string; // JavaScript expression using input IDs
  outputFormat: 'number' | 'currency' | 'percentage' | 'custom';
  outputLabel: string;
  customFormatter?: string; // Custom format function
  showFormula: boolean;
  allowFormulaEdit: boolean;
}

export interface CalculatorInput {
  id: string;
  label: string;
  type: 'number' | 'slider' | 'select';
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: number }[];
  unit?: string;
  helpText?: string;
}

// ============================================================================
// CHART COMPONENT
// ============================================================================

export interface ChartComponentConfig {
  chartType: 'bar' | 'line' | 'pie' | 'doughnut' | 'area' | 'scatter';
  title: string;
  data: ChartData;
  options: ChartOptions;
  interactive: boolean;
  allowTypeSwitch: boolean;
  allowDataExport: boolean;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
  }[];
}

export interface ChartOptions {
  showLegend: boolean;
  showValues: boolean;
  showGrid: boolean;
  aspectRatio?: number;
  colors: string[];
}

// ============================================================================
// COMPARISON COMPONENT
// ============================================================================

export interface ComparisonComponentConfig {
  title: string;
  items: ComparisonItem[];
  features: ComparisonFeature[];
  highlightBest: boolean;
  showDifferences: boolean;
  allowFiltering: boolean;
  allowSorting: boolean;
}

export interface ComparisonItem {
  id: string;
  name: string;
  description?: string;
  image?: string;
  values: Record<string, unknown>;
  highlighted?: boolean;
}

export interface ComparisonFeature {
  id: string;
  name: string;
  type: 'text' | 'number' | 'boolean' | 'rating';
  sortable: boolean;
  higherIsBetter?: boolean;
  format?: string;
}

// ============================================================================
// TABLE COMPONENT (Interactive Data Grid)
// ============================================================================

export interface TableComponentConfig {
  title: string;
  columns: TableColumn[];
  rows: Record<string, unknown>[];
  sortable: boolean;
  filterable: boolean;
  pagination: boolean;
  pageSize: number;
  selectable: boolean;
  exportable: boolean;
  editable: boolean;
}

export interface TableColumn {
  id: string;
  header: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'currency' | 'link';
  width?: number | 'auto';
  sortable?: boolean;
  filterable?: boolean;
  editable?: boolean;
  format?: string;
}

// ============================================================================
// FORM COMPONENT (Interactive Input)
// ============================================================================

export interface FormComponentConfig {
  title: string;
  description?: string;
  fields: FormField[];
  submitLabel: string;
  onSubmitAction: 'generate_response' | 'calculate' | 'search' | 'custom';
  validation: boolean;
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'file';
  placeholder?: string;
  defaultValue?: unknown;
  required: boolean;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    custom?: string; // Custom validation function
  };
  options?: { label: string; value: unknown }[];
  helpText?: string;
}

// ============================================================================
// TIMELINE COMPONENT
// ============================================================================

export interface TimelineComponentConfig {
  title: string;
  events: TimelineEvent[];
  orientation: 'horizontal' | 'vertical';
  showConnectors: boolean;
  interactive: boolean;
  collapsible: boolean;
}

export interface TimelineEvent {
  id: string;
  date: string | Date;
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// APP DETECTION AND GENERATION
// ============================================================================

export interface AppDetectionResult {
  shouldGenerateApp: boolean;
  confidence: number;
  suggestedComponents: UIComponentType[];
  reason: string;
  extractedData?: Record<string, unknown>;
}

export interface AppGenerationRequest {
  tenantId: string;
  userId: string;
  conversationId: string;
  messageId: string;
  prompt: string;
  response: string;
  requestedComponents?: UIComponentType[];
  forceGenerate?: boolean;
}

export interface AppGenerationResult {
  success: boolean;
  app?: GeneratedUIApp;
  error?: string;
  generationTimeMs: number;
  tokensUsed: number;
}

// ============================================================================
// REAL-TIME APP STATE
// ============================================================================

export interface AppStateUpdate {
  appId: string;
  componentId: string;
  inputId: string;
  value: unknown;
  timestamp: Date;
}

export interface AppComputeResult {
  outputs: Record<string, unknown>;
  error?: string;
}

// ============================================================================
// USER PREFERENCES
// ============================================================================

export interface UserGenerativeUIPreferences {
  userId: string;
  
  // View preferences
  defaultView: 'response' | 'app' | 'split';
  autoShowApp: boolean;
  
  // Per-component preferences
  componentPreferences: Record<UIComponentType, {
    enabled: boolean;
    defaultExpanded: boolean;
    preferredSize: 'small' | 'medium' | 'large' | 'full';
  }>;
  
  // Theme
  preferredTheme: 'light' | 'dark' | 'auto';
  
  // Animation
  enableAnimations: boolean;
  
  updatedAt: Date;
}
