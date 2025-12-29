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

// ============================================================================
// GENERATIVE UI FEEDBACK & LEARNING SYSTEM
// Allows users to provide feedback and help AGI brain improve
// ============================================================================

/**
 * User feedback on a generated UI component
 */
export interface GenerativeUIFeedback {
  id: string;
  tenantId: string;
  userId: string;
  appId: string;
  componentId?: string; // Optional - feedback can be for whole app or specific component
  
  // Rating
  rating: 'thumbs_up' | 'thumbs_down' | 'star_1' | 'star_2' | 'star_3' | 'star_4' | 'star_5';
  
  // Feedback categories
  feedbackType: UIFeedbackType;
  
  // User's improvement suggestions
  improvementSuggestion?: string;
  expectedBehavior?: string;
  
  // What was wrong (for negative feedback)
  issues?: UIFeedbackIssue[];
  
  // Context
  originalPrompt: string;
  generatedOutput: string; // Snapshot of what was generated
  
  // For "improve before my eyes" feature
  requestedImprovement?: ImprovementRequest;
  
  // AGI processing
  agiProcessed: boolean;
  agiInsights?: AGIFeedbackInsights;
  
  createdAt: Date;
}

export type UIFeedbackType =
  | 'helpful'           // The UI was helpful
  | 'not_helpful'       // UI wasn't helpful
  | 'wrong_type'        // Wrong component type was chosen
  | 'missing_data'      // Data was incomplete
  | 'incorrect_data'    // Data was wrong
  | 'layout_issue'      // Layout/design problem
  | 'functionality'     // Something didn't work
  | 'improvement'       // General improvement suggestion
  | 'feature_request';  // Request new feature

export interface UIFeedbackIssue {
  category: 'accuracy' | 'completeness' | 'usability' | 'design' | 'performance' | 'functionality';
  description: string;
  severity: 'minor' | 'major' | 'critical';
  componentPath?: string; // e.g., "calculator.inputs.rate"
}

/**
 * User's request to improve the generated UI in real-time
 */
export interface ImprovementRequest {
  id: string;
  appId: string;
  
  // What to improve
  improvementType: ImprovementType;
  targetComponent?: string; // Which component to improve
  
  // User's instructions
  userInstructions: string;
  
  // Before/after snapshots
  beforeState: GeneratedUISnapshot;
  afterState?: GeneratedUISnapshot;
  
  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  // AGI analysis
  agiAnalysis?: AGIImprovementAnalysis;
  
  createdAt: Date;
  completedAt?: Date;
}

export type ImprovementType =
  | 'add_component'      // Add a new component
  | 'remove_component'   // Remove a component
  | 'modify_component'   // Change existing component
  | 'change_layout'      // Change the layout
  | 'fix_calculation'    // Fix a calculation/formula
  | 'add_data'           // Add more data
  | 'change_style'       // Change visual style
  | 'add_interactivity'  // Make more interactive
  | 'simplify'           // Make simpler
  | 'expand'             // Add more detail
  | 'regenerate';        // Completely regenerate

/**
 * Snapshot of a generated UI for before/after comparison
 */
export interface GeneratedUISnapshot {
  timestamp: Date;
  appId: string;
  components: UIComponentSchema[];
  state: Record<string, unknown>;
  layout: AppLayout;
  renderHash: string; // Hash of rendered output for comparison
}

/**
 * AGI Brain's analysis of user feedback - used for learning
 */
export interface AGIFeedbackInsights {
  // Pattern detection
  feedbackPattern: string; // What pattern does this feedback represent
  similarFeedbackCount: number; // How many similar feedbacks exist
  
  // Learning signals
  promptPatternLearned?: string; // Pattern in prompts that leads to this issue
  componentTypeMismatch?: boolean; // Was wrong component type chosen
  datExtractionIssue?: boolean; // Was data extraction wrong
  
  // Improvement recommendations
  recommendedChanges: AGIRecommendedChange[];
  
  // Model performance
  modelUsed: string;
  confidenceScore: number;
  shouldRetrain: boolean; // Should this be used for retraining
  
  processedAt: Date;
}

export interface AGIRecommendedChange {
  changeType: 'prompt_handling' | 'component_selection' | 'data_extraction' | 'layout' | 'formula' | 'style';
  description: string;
  priority: 'low' | 'medium' | 'high';
  autoApplicable: boolean; // Can this be auto-applied
}

/**
 * AGI's analysis for real-time improvement
 */
export interface AGIImprovementAnalysis {
  // What was understood from user's request
  interpretedIntent: string;
  
  // Vision analysis (if applicable)
  visionAnalysis?: {
    currentUIDescription: string;
    identifiedIssues: string[];
    suggestedFixes: string[];
  };
  
  // Proposed changes
  proposedChanges: ProposedUIChange[];
  
  // Confidence
  confidence: number;
  
  // Alternative approaches
  alternatives?: {
    description: string;
    changes: ProposedUIChange[];
  }[];
}

export interface ProposedUIChange {
  targetPath: string; // e.g., "components[0].inputs[1]"
  changeType: 'add' | 'remove' | 'modify' | 'replace';
  beforeValue?: unknown;
  afterValue: unknown;
  explanation: string;
}

// ============================================================================
// REAL-TIME UI IMPROVEMENT ("Improve Before Your Eyes")
// ============================================================================

/**
 * A live improvement session where user collaborates with AGI to improve UI
 */
export interface UIImprovementSession {
  id: string;
  tenantId: string;
  userId: string;
  appId: string;
  
  // Session state
  status: 'active' | 'completed' | 'abandoned';
  
  // Improvement history
  iterations: UIImprovementIteration[];
  
  // Current state
  currentSnapshot: GeneratedUISnapshot;
  
  // Session metadata
  startedAt: Date;
  lastActivityAt: Date;
  completedAt?: Date;
}

export interface UIImprovementIteration {
  iterationNumber: number;
  
  // User's request
  userRequest: string;
  
  // AGI's response
  agiResponse: {
    understood: string; // What AGI understood
    changes: ProposedUIChange[];
    explanation: string;
  };
  
  // Result
  applied: boolean;
  userSatisfied?: boolean;
  feedback?: string;
  
  // Snapshots
  beforeSnapshot: GeneratedUISnapshot;
  afterSnapshot?: GeneratedUISnapshot;
  
  timestamp: Date;
}

// ============================================================================
// AGI LEARNING FROM UI FEEDBACK
// ============================================================================

/**
 * Aggregated learning from feedback for AGI improvement
 */
export interface UIFeedbackLearning {
  id: string;
  tenantId: string;
  
  // What was learned
  learningType: 'prompt_pattern' | 'component_preference' | 'data_format' | 'layout_preference' | 'calculation_fix';
  
  // The pattern/rule learned
  pattern: {
    trigger: string; // What triggers this pattern (regex or description)
    response: string; // How to respond
    confidence: number;
  };
  
  // Evidence
  feedbackIds: string[]; // Which feedbacks contributed to this learning
  exampleCount: number;
  
  // Application
  appliedCount: number;
  successRate: number;
  
  // Status
  status: 'proposed' | 'approved' | 'active' | 'deprecated';
  
  createdAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
}

/**
 * Configuration for the feedback and learning system
 */
export interface UIFeedbackConfig {
  // Feedback collection
  collectFeedback: boolean;
  feedbackPromptDelay: number; // ms to wait before showing feedback prompt
  showFeedbackOnEveryApp: boolean;
  
  // Improvement features
  enableRealTimeImprovement: boolean;
  maxImprovementIterations: number;
  autoApplyHighConfidenceChanges: boolean;
  autoApplyThreshold: number; // Confidence threshold for auto-apply
  
  // Learning
  enableAGILearning: boolean;
  learningApprovalRequired: boolean; // Require admin approval for learnings
  minFeedbackForLearning: number; // Min feedback count before learning
  
  // Vision analysis
  enableVisionAnalysis: boolean;
  visionModel: string;
}

export const DEFAULT_UI_FEEDBACK_CONFIG: UIFeedbackConfig = {
  collectFeedback: true,
  feedbackPromptDelay: 5000, // 5 seconds
  showFeedbackOnEveryApp: false,
  enableRealTimeImprovement: true,
  maxImprovementIterations: 5,
  autoApplyHighConfidenceChanges: false,
  autoApplyThreshold: 0.95,
  enableAGILearning: true,
  learningApprovalRequired: true,
  minFeedbackForLearning: 10,
  enableVisionAnalysis: true,
  visionModel: 'claude-3-5-sonnet',
};

// ============================================================================
// MULTI-PAGE GENERATIVE UI ("Web App Generator")
// Transforms Think Tank into a full web application generator
// "Claude can describe a todo app, but now it can BUILD the todo app"
// ============================================================================

/**
 * Multi-page application types supported
 */
export type MultiPageAppType =
  | 'web_app'           // Full interactive web application
  | 'dashboard'         // Multi-view analytics dashboard
  | 'wizard'            // Multi-step form/process
  | 'documentation'     // Documentation site with pages
  | 'portfolio'         // Personal/business portfolio
  | 'landing_page'      // Marketing landing page with sections
  | 'tutorial'          // Interactive step-by-step tutorial
  | 'report'            // Multi-section business report
  | 'admin_panel'       // Admin interface with CRUD
  | 'e_commerce'        // Product catalog with cart
  | 'blog';             // Blog with posts and categories

/**
 * A complete multi-page generated application
 */
export interface GeneratedMultiPageApp {
  id: string;
  tenantId: string;
  userId: string;
  conversationId: string;
  
  // App metadata
  name: string;
  description: string;
  appType: MultiPageAppType;
  icon?: string;
  
  // Pages
  pages: GeneratedPage[];
  homePage: string; // Page ID of home/landing page
  
  // Navigation
  navigation: AppNavigation;
  
  // Global state (shared across pages)
  globalState: Record<string, unknown>;
  
  // Theme and styling
  theme: AppTheme;
  
  // Data sources
  dataSources: DataSource[];
  
  // Actions/API endpoints
  actions: AppAction[];
  
  // Generated assets
  assets: GeneratedAsset[];
  
  // Build info
  buildStatus: 'draft' | 'building' | 'ready' | 'deployed';
  previewUrl?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/**
 * A single page within a multi-page app
 */
export interface GeneratedPage {
  id: string;
  slug: string; // URL path e.g., "about", "settings/profile"
  title: string;
  description?: string;
  
  // Page type
  pageType: PageType;
  
  // Layout and components
  layout: PageLayout;
  sections: PageSection[];
  
  // Page-specific state
  localState: Record<string, unknown>;
  
  // SEO
  meta?: PageMeta;
  
  // Access control
  requiresAuth?: boolean;
  allowedRoles?: string[];
  
  // Navigation
  showInNav: boolean;
  navOrder?: number;
  navIcon?: string;
  parentPageId?: string; // For nested navigation
}

export type PageType =
  | 'home'              // Landing/home page
  | 'list'              // List view (e.g., products, posts)
  | 'detail'            // Detail view (single item)
  | 'form'              // Input form
  | 'dashboard'         // Analytics/metrics view
  | 'settings'          // Configuration page
  | 'profile'           // User profile
  | 'about'             // About/info page
  | 'contact'           // Contact form
  | 'search'            // Search results
  | 'error'             // Error page (404, 500)
  | 'auth'              // Login/register
  | 'custom';           // Custom page type

/**
 * Page layout configuration
 */
export interface PageLayout {
  type: 'full_width' | 'centered' | 'sidebar_left' | 'sidebar_right' | 'two_column' | 'three_column';
  maxWidth?: string;
  padding?: string;
  background?: string;
  
  // Header/footer for this page
  showHeader: boolean;
  showFooter: boolean;
  showBreadcrumbs: boolean;
}

/**
 * A section within a page
 */
export interface PageSection {
  id: string;
  title?: string;
  
  // Section type determines rendering
  sectionType: SectionType;
  
  // Components within this section
  components: UIComponentSchema[];
  
  // Section layout
  layout: 'stack' | 'grid' | 'flex' | 'masonry';
  columns?: number;
  gap?: string;
  
  // Styling
  background?: string;
  padding?: string;
  
  // Visibility conditions
  visibleIf?: string; // Expression to evaluate
}

export type SectionType =
  | 'hero'              // Large hero section
  | 'features'          // Feature grid/list
  | 'content'           // Text/rich content
  | 'gallery'           // Image gallery
  | 'testimonials'      // Customer testimonials
  | 'pricing'           // Pricing table
  | 'cta'               // Call to action
  | 'stats'             // Statistics/metrics
  | 'team'              // Team members
  | 'faq'               // FAQ accordion
  | 'contact'           // Contact form
  | 'data_table'        // Data table/grid
  | 'chart_grid'        // Multiple charts
  | 'form'              // Input form
  | 'custom';           // Custom section

/**
 * Application navigation structure
 */
export interface AppNavigation {
  type: 'top_bar' | 'sidebar' | 'bottom_tabs' | 'hamburger' | 'breadcrumb' | 'none';
  
  // Main navigation items
  items: NavItem[];
  
  // Secondary actions (e.g., user menu)
  secondaryItems?: NavItem[];
  
  // Logo/brand
  brand?: {
    text?: string;
    logo?: string;
    link?: string;
  };
  
  // Mobile behavior
  mobileBreakpoint?: number;
  mobileType?: 'hamburger' | 'bottom_tabs' | 'drawer';
}

export interface NavItem {
  id: string;
  label: string;
  icon?: string;
  
  // Link target
  pageId?: string;      // Internal page link
  href?: string;        // External link
  action?: string;      // Action to trigger
  
  // Children for dropdowns
  children?: NavItem[];
  
  // Visibility
  requiresAuth?: boolean;
  visibleIf?: string;
}

/**
 * Application theme
 */
export interface AppTheme {
  mode: 'light' | 'dark' | 'system';
  
  // Colors
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    warning: string;
    success: string;
    info: string;
  };
  
  // Typography
  fonts: {
    heading: string;
    body: string;
    mono: string;
  };
  
  // Spacing and sizing
  borderRadius: 'none' | 'small' | 'medium' | 'large' | 'full';
  spacing: 'compact' | 'normal' | 'comfortable';
  
  // Custom CSS
  customCss?: string;
}

/**
 * Data source for the application
 */
export interface DataSource {
  id: string;
  name: string;
  type: 'static' | 'api' | 'database' | 'file' | 'computed';
  
  // For static data
  data?: unknown;
  
  // For API data
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  
  // Transform/mapping
  transform?: string; // JavaScript expression to transform data
  
  // Caching
  cacheDuration?: number; // seconds
  
  // Refresh
  autoRefresh?: boolean;
  refreshInterval?: number;
}

/**
 * Application action (like an API endpoint)
 */
export interface AppAction {
  id: string;
  name: string;
  description?: string;
  
  // Trigger
  trigger: 'button_click' | 'form_submit' | 'page_load' | 'interval' | 'event';
  
  // Action type
  type: 'navigate' | 'api_call' | 'update_state' | 'show_modal' | 'download' | 'share' | 'custom';
  
  // Action configuration
  config: Record<string, unknown>;
  
  // Feedback
  successMessage?: string;
  errorMessage?: string;
}

/**
 * Generated asset (images, icons, etc.)
 */
export interface GeneratedAsset {
  id: string;
  type: 'image' | 'icon' | 'illustration' | 'logo' | 'favicon';
  name: string;
  url?: string;
  base64?: string;
  prompt?: string; // AI generation prompt used
}

/**
 * Page SEO metadata
 */
export interface PageMeta {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  canonical?: string;
}

// ============================================================================
// SPECIFIC MULTI-PAGE APP TEMPLATES
// ============================================================================

/**
 * Dashboard app configuration
 */
export interface DashboardAppConfig {
  appType: 'dashboard';
  
  // Dashboard-specific
  refreshInterval?: number;
  
  pages: {
    overview: boolean;
    analytics: boolean;
    reports: boolean;
    settings: boolean;
  };
  
  // Widgets available
  widgets: DashboardWidget[];
  
  // Data sources
  metrics: MetricDefinition[];
}

export interface DashboardWidget {
  id: string;
  type: 'metric_card' | 'line_chart' | 'bar_chart' | 'pie_chart' | 'table' | 'list' | 'map' | 'calendar';
  title: string;
  dataSource: string;
  size: 'small' | 'medium' | 'large' | 'full';
  refreshable: boolean;
}

export interface MetricDefinition {
  id: string;
  name: string;
  formula: string;
  format: 'number' | 'currency' | 'percentage' | 'duration';
  trend?: 'up_good' | 'down_good' | 'neutral';
}

/**
 * Wizard/multi-step form configuration
 */
export interface WizardAppConfig {
  appType: 'wizard';
  
  // Steps
  steps: WizardStep[];
  
  // Navigation
  allowSkip: boolean;
  allowBack: boolean;
  showProgress: boolean;
  progressStyle: 'bar' | 'steps' | 'dots';
  
  // Completion
  onComplete: 'submit' | 'navigate' | 'download' | 'custom';
  completionPage?: string;
  
  // Validation
  validateOnStep: boolean;
  validateOnComplete: boolean;
}

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  
  // Fields in this step
  fields: FormField[];
  
  // Validation
  validationRules?: Record<string, string>;
  
  // Conditional logic
  skipIf?: string; // Expression to evaluate
}

/**
 * Documentation site configuration
 */
export interface DocumentationAppConfig {
  appType: 'documentation';
  
  // Structure
  sections: DocSection[];
  
  // Features
  search: boolean;
  tableOfContents: boolean;
  codeHighlighting: boolean;
  copyCode: boolean;
  
  // Navigation
  showPrevNext: boolean;
  showBreadcrumbs: boolean;
  
  // Theme
  syntaxTheme: 'github' | 'dracula' | 'monokai' | 'vs';
}

export interface DocSection {
  id: string;
  title: string;
  icon?: string;
  
  pages: DocPage[];
}

export interface DocPage {
  id: string;
  slug: string;
  title: string;
  content: string; // Markdown content
  order: number;
}

/**
 * E-commerce app configuration
 */
export interface ECommerceAppConfig {
  appType: 'e_commerce';
  
  // Product configuration
  products: ProductConfig[];
  categories: CategoryConfig[];
  
  // Features
  cart: boolean;
  wishlist: boolean;
  search: boolean;
  filters: boolean;
  reviews: boolean;
  
  // Checkout
  checkoutSteps: ('cart' | 'shipping' | 'payment' | 'confirmation')[];
  
  // Currency
  currency: string;
  currencySymbol: string;
}

export interface ProductConfig {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category: string;
  variants?: ProductVariant[];
  inStock: boolean;
}

export interface ProductVariant {
  id: string;
  name: string;
  options: string[];
  priceModifier?: number;
}

export interface CategoryConfig {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  image?: string;
}

/**
 * Blog app configuration
 */
export interface BlogAppConfig {
  appType: 'blog';
  
  // Posts
  posts: BlogPost[];
  categories: string[];
  tags: string[];
  
  // Features
  comments: boolean;
  search: boolean;
  archives: boolean;
  relatedPosts: boolean;
  socialShare: boolean;
  
  // Layout
  listLayout: 'cards' | 'list' | 'magazine';
  postsPerPage: number;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string; // Markdown
  author: string;
  publishedAt: Date;
  category: string;
  tags: string[];
  featuredImage?: string;
}

// ============================================================================
// MULTI-PAGE APP DETECTION
// ============================================================================

/**
 * Detection result for multi-page app opportunity
 */
export interface MultiPageDetectionResult {
  shouldGenerate: boolean;
  confidence: number;
  suggestedType: MultiPageAppType;
  suggestedPages: string[];
  reason: string;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedBuildTime: number; // seconds
}

/**
 * Keywords that trigger multi-page app generation
 */
export const MULTI_PAGE_TRIGGERS: Record<MultiPageAppType, string[]> = {
  web_app: ['build me', 'create app', 'make an app', 'web application', 'interactive app'],
  dashboard: ['dashboard', 'analytics dashboard', 'admin dashboard', 'metrics dashboard', 'monitoring'],
  wizard: ['wizard', 'multi-step', 'step by step form', 'onboarding flow', 'registration flow'],
  documentation: ['documentation', 'docs site', 'api docs', 'help center', 'knowledge base'],
  portfolio: ['portfolio', 'personal website', 'showcase', 'my website', 'professional site'],
  landing_page: ['landing page', 'marketing page', 'product page', 'homepage', 'sales page'],
  tutorial: ['tutorial', 'course', 'learning path', 'how-to guide', 'interactive lesson'],
  report: ['report', 'business report', 'analysis report', 'quarterly report', 'annual report'],
  admin_panel: ['admin panel', 'admin interface', 'management system', 'cms', 'back office'],
  e_commerce: ['e-commerce', 'online store', 'shop', 'product catalog', 'storefront'],
  blog: ['blog', 'news site', 'magazine', 'articles', 'content site'],
};

// ============================================================================
// MULTI-PAGE APP GENERATION
// ============================================================================

export interface MultiPageGenerationRequest {
  tenantId: string;
  userId: string;
  conversationId: string;
  messageId: string;
  
  // User's request
  prompt: string;
  
  // Optional specifics
  appType?: MultiPageAppType;
  requestedPages?: string[];
  theme?: Partial<AppTheme>;
  
  // Generation options
  includeExampleData: boolean;
  generateAssets: boolean;
  targetComplexity: 'minimal' | 'standard' | 'full';
}

export interface MultiPageGenerationResult {
  success: boolean;
  app?: GeneratedMultiPageApp;
  error?: string;
  
  // Generation stats
  pagesGenerated: number;
  componentsGenerated: number;
  generationTimeMs: number;
  tokensUsed: number;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

export const DEFAULT_APP_THEME: AppTheme = {
  mode: 'light',
  colors: {
    primary: '#3b82f6',
    secondary: '#6366f1',
    accent: '#f59e0b',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#1e293b',
    textSecondary: '#64748b',
    border: '#e2e8f0',
    error: '#ef4444',
    warning: '#f59e0b',
    success: '#22c55e',
    info: '#3b82f6',
  },
  fonts: {
    heading: 'Inter, system-ui, sans-serif',
    body: 'Inter, system-ui, sans-serif',
    mono: 'JetBrains Mono, monospace',
  },
  borderRadius: 'medium',
  spacing: 'normal',
};

export const DEFAULT_PAGE_LAYOUT: PageLayout = {
  type: 'centered',
  maxWidth: '1200px',
  padding: '2rem',
  showHeader: true,
  showFooter: true,
  showBreadcrumbs: true,
};
