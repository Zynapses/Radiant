// RADIANT v4.18.0 - Multi-Page App Factory Service
// Transforms Think Tank into a full web application generator
// "Claude can describe a todo app, but now it can BUILD the todo app"

import { executeStatement, stringParam } from '../db/client';
import crypto from 'crypto';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

type MultiPageAppType =
  | 'web_app' | 'dashboard' | 'wizard' | 'documentation' | 'portfolio'
  | 'landing_page' | 'tutorial' | 'report' | 'admin_panel' | 'e_commerce' | 'blog';

type PageType =
  | 'home' | 'list' | 'detail' | 'form' | 'dashboard' | 'settings'
  | 'profile' | 'about' | 'contact' | 'search' | 'error' | 'auth' | 'custom';

type SectionType =
  | 'hero' | 'features' | 'content' | 'gallery' | 'testimonials'
  | 'pricing' | 'cta' | 'stats' | 'team' | 'faq' | 'contact'
  | 'data_table' | 'chart_grid' | 'form' | 'custom';

interface PageLayout {
  type: 'full_width' | 'centered' | 'sidebar_left' | 'sidebar_right' | 'two_column' | 'three_column';
  maxWidth?: string;
  padding?: string;
  background?: string;
  showHeader: boolean;
  showFooter: boolean;
  showBreadcrumbs: boolean;
}

interface PageSection {
  id: string;
  title?: string;
  sectionType: SectionType;
  components: unknown[];
  layout: 'stack' | 'grid' | 'flex' | 'masonry';
  columns?: number;
  gap?: string;
  background?: string;
  padding?: string;
  visibleIf?: string;
}

interface GeneratedPage {
  id: string;
  slug: string;
  title: string;
  description?: string;
  pageType: PageType;
  layout: PageLayout;
  sections: PageSection[];
  localState: Record<string, unknown>;
  meta?: Record<string, unknown>;
  requiresAuth?: boolean;
  allowedRoles?: string[];
  showInNav: boolean;
  navOrder?: number;
  navIcon?: string;
  parentPageId?: string;
}

interface AppNavigation {
  type: 'top_bar' | 'sidebar' | 'bottom_tabs' | 'hamburger' | 'breadcrumb' | 'none';
  items: NavItem[];
  secondaryItems?: NavItem[];
  brand?: { text?: string; logo?: string; link?: string };
  mobileBreakpoint?: number;
  mobileType?: 'hamburger' | 'bottom_tabs' | 'drawer';
}

interface NavItem {
  id: string;
  label: string;
  icon?: string;
  pageId?: string;
  href?: string;
  action?: string;
  children?: NavItem[];
  requiresAuth?: boolean;
  visibleIf?: string;
}

interface AppTheme {
  mode: 'light' | 'dark' | 'system';
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
  fonts: { heading: string; body: string; mono: string };
  borderRadius: 'none' | 'small' | 'medium' | 'large' | 'full';
  spacing: 'compact' | 'normal' | 'comfortable';
  customCss?: string;
}

interface GeneratedMultiPageApp {
  id: string;
  tenantId: string;
  userId: string;
  conversationId: string;
  name: string;
  description: string;
  appType: MultiPageAppType;
  icon?: string;
  pages: GeneratedPage[];
  homePage: string;
  navigation: AppNavigation;
  globalState: Record<string, unknown>;
  theme: AppTheme;
  dataSources: unknown[];
  actions: unknown[];
  assets: unknown[];
  buildStatus: 'draft' | 'building' | 'ready' | 'deployed';
  previewUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

interface MultiPageDetectionResult {
  shouldGenerate: boolean;
  confidence: number;
  suggestedType: MultiPageAppType;
  suggestedPages: string[];
  reason: string;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedBuildTime: number;
}

// ============================================================================
// Constants
// ============================================================================

const MULTI_PAGE_TRIGGERS: Record<MultiPageAppType, string[]> = {
  web_app: ['build me', 'create app', 'make an app', 'web application', 'interactive app', 'build an app'],
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

const DEFAULT_PAGES_BY_TYPE: Record<MultiPageAppType, { slug: string; title: string; pageType: PageType }[]> = {
  web_app: [
    { slug: '', title: 'Home', pageType: 'home' },
    { slug: 'features', title: 'Features', pageType: 'list' },
    { slug: 'about', title: 'About', pageType: 'about' },
    { slug: 'contact', title: 'Contact', pageType: 'contact' },
  ],
  dashboard: [
    { slug: '', title: 'Overview', pageType: 'dashboard' },
    { slug: 'analytics', title: 'Analytics', pageType: 'dashboard' },
    { slug: 'reports', title: 'Reports', pageType: 'list' },
    { slug: 'settings', title: 'Settings', pageType: 'settings' },
  ],
  wizard: [
    { slug: '', title: 'Start', pageType: 'form' },
    { slug: 'step-2', title: 'Step 2', pageType: 'form' },
    { slug: 'step-3', title: 'Step 3', pageType: 'form' },
    { slug: 'complete', title: 'Complete', pageType: 'custom' },
  ],
  documentation: [
    { slug: '', title: 'Introduction', pageType: 'home' },
    { slug: 'getting-started', title: 'Getting Started', pageType: 'custom' },
    { slug: 'api-reference', title: 'API Reference', pageType: 'list' },
    { slug: 'examples', title: 'Examples', pageType: 'list' },
  ],
  portfolio: [
    { slug: '', title: 'Home', pageType: 'home' },
    { slug: 'about', title: 'About', pageType: 'about' },
    { slug: 'projects', title: 'Projects', pageType: 'list' },
    { slug: 'contact', title: 'Contact', pageType: 'contact' },
  ],
  landing_page: [
    { slug: '', title: 'Home', pageType: 'home' },
  ],
  tutorial: [
    { slug: '', title: 'Introduction', pageType: 'home' },
    { slug: 'lesson-1', title: 'Lesson 1', pageType: 'custom' },
    { slug: 'lesson-2', title: 'Lesson 2', pageType: 'custom' },
    { slug: 'quiz', title: 'Quiz', pageType: 'form' },
  ],
  report: [
    { slug: '', title: 'Executive Summary', pageType: 'home' },
    { slug: 'analysis', title: 'Analysis', pageType: 'dashboard' },
    { slug: 'findings', title: 'Findings', pageType: 'list' },
    { slug: 'recommendations', title: 'Recommendations', pageType: 'custom' },
  ],
  admin_panel: [
    { slug: '', title: 'Dashboard', pageType: 'dashboard' },
    { slug: 'users', title: 'Users', pageType: 'list' },
    { slug: 'content', title: 'Content', pageType: 'list' },
    { slug: 'settings', title: 'Settings', pageType: 'settings' },
  ],
  e_commerce: [
    { slug: '', title: 'Home', pageType: 'home' },
    { slug: 'products', title: 'Products', pageType: 'list' },
    { slug: 'cart', title: 'Cart', pageType: 'custom' },
    { slug: 'checkout', title: 'Checkout', pageType: 'form' },
  ],
  blog: [
    { slug: '', title: 'Home', pageType: 'home' },
    { slug: 'posts', title: 'All Posts', pageType: 'list' },
    { slug: 'categories', title: 'Categories', pageType: 'list' },
    { slug: 'about', title: 'About', pageType: 'about' },
  ],
};

const DEFAULT_THEME: AppTheme = {
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

// ============================================================================
// Multi-Page App Factory Service
// ============================================================================

class MultiPageAppFactoryService {
  // =========================================================================
  // DETECTION
  // =========================================================================

  /**
   * Detect if a prompt should generate a multi-page app
   */
  detectMultiPageOpportunity(prompt: string): MultiPageDetectionResult {
    const lowerPrompt = prompt.toLowerCase();
    let bestMatch: { type: MultiPageAppType; score: number; triggers: string[] } | null = null;

    // Check each app type for triggers
    for (const [appType, triggers] of Object.entries(MULTI_PAGE_TRIGGERS)) {
      let matchScore = 0;
      const matchedTriggers: string[] = [];

      for (const trigger of triggers) {
        if (lowerPrompt.includes(trigger)) {
          matchScore += trigger.split(' ').length; // Longer phrases score higher
          matchedTriggers.push(trigger);
        }
      }

      if (matchScore > 0 && (!bestMatch || matchScore > bestMatch.score)) {
        bestMatch = { type: appType as MultiPageAppType, score: matchScore, triggers: matchedTriggers };
      }
    }

    if (!bestMatch) {
      return {
        shouldGenerate: false,
        confidence: 0,
        suggestedType: 'web_app',
        suggestedPages: [],
        reason: 'No multi-page app triggers detected',
        complexity: 'simple',
        estimatedBuildTime: 0,
      };
    }

    // Calculate confidence based on match strength
    const confidence = Math.min(0.95, 0.5 + (bestMatch.score * 0.1));

    // Get suggested pages for this app type
    const suggestedPages = DEFAULT_PAGES_BY_TYPE[bestMatch.type].map(p => p.title);

    // Estimate complexity
    const complexity = this.estimateComplexity(prompt, bestMatch.type);
    const estimatedBuildTime = complexity === 'simple' ? 5 : complexity === 'moderate' ? 15 : 30;

    return {
      shouldGenerate: confidence > 0.6,
      confidence,
      suggestedType: bestMatch.type,
      suggestedPages,
      reason: `Detected "${bestMatch.triggers.join(', ')}" suggesting a ${bestMatch.type.replace('_', ' ')}`,
      complexity,
      estimatedBuildTime,
    };
  }

  /**
   * Estimate complexity of the requested app
   */
  private estimateComplexity(prompt: string, appType: MultiPageAppType): 'simple' | 'moderate' | 'complex' {
    const complexIndicators = [
      'authentication', 'login', 'database', 'api', 'real-time',
      'payments', 'checkout', 'cart', 'user management', 'roles',
      'permissions', 'analytics', 'charts', 'reports', 'export',
    ];

    let complexityScore = 0;
    const lowerPrompt = prompt.toLowerCase();

    for (const indicator of complexIndicators) {
      if (lowerPrompt.includes(indicator)) {
        complexityScore++;
      }
    }

    // Some app types are inherently more complex
    if (['e_commerce', 'admin_panel', 'dashboard'].includes(appType)) {
      complexityScore += 2;
    }

    if (complexityScore <= 1) return 'simple';
    if (complexityScore <= 4) return 'moderate';
    return 'complex';
  }

  // =========================================================================
  // GENERATION
  // =========================================================================

  /**
   * Generate a complete multi-page app
   */
  async generateApp(params: {
    tenantId: string;
    userId: string;
    conversationId?: string;
    prompt: string;
    appType?: MultiPageAppType;
    requestedPages?: string[];
    theme?: Partial<AppTheme>;
    includeExampleData?: boolean;
  }): Promise<GeneratedMultiPageApp> {
    const startTime = Date.now();

    // Detect app type if not specified
    const detection = this.detectMultiPageOpportunity(params.prompt);
    const appType = params.appType || detection.suggestedType;

    // Create app record
    const appId = crypto.randomUUID();
    const appName = this.extractAppName(params.prompt, appType);

    // Generate pages based on type
    const pages = await this.generatePages(appType, params.prompt, params.includeExampleData);

    // Generate navigation
    const navigation = this.generateNavigation(appType, pages);

    // Apply theme
    const theme = { ...DEFAULT_THEME, ...params.theme };

    // Build the app object
    const app: GeneratedMultiPageApp = {
      id: appId,
      tenantId: params.tenantId,
      userId: params.userId,
      conversationId: params.conversationId || '',
      name: appName,
      description: this.generateDescription(appType, params.prompt),
      appType,
      pages,
      homePage: pages[0]?.id || '',
      navigation,
      globalState: {},
      theme,
      dataSources: [],
      actions: [],
      assets: [],
      buildStatus: 'ready',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };

    // Save to database
    await this.saveApp(app);

    logger.info('Generated multi-page app', { appType, pageCount: pages.length, durationMs: Date.now() - startTime });

    return app;
  }

  /**
   * Generate pages for an app type
   */
  private async generatePages(
    appType: MultiPageAppType,
    prompt: string,
    includeExampleData?: boolean
  ): Promise<GeneratedPage[]> {
    const pageConfigs = DEFAULT_PAGES_BY_TYPE[appType];
    const pages: GeneratedPage[] = [];

    for (let i = 0; i < pageConfigs.length; i++) {
      const config = pageConfigs[i];
      const pageId = crypto.randomUUID();

      const page: GeneratedPage = {
        id: pageId,
        slug: config.slug,
        title: config.title,
        pageType: config.pageType,
        layout: {
          type: config.pageType === 'dashboard' ? 'full_width' : 'centered',
          maxWidth: '1200px',
          padding: '2rem',
          showHeader: true,
          showFooter: config.slug === '' || config.pageType === 'about',
          showBreadcrumbs: config.slug !== '',
        },
        sections: this.generateSections(config.pageType, appType, includeExampleData),
        localState: {},
        showInNav: true,
        navOrder: i,
        navIcon: this.getPageIcon(config.pageType),
      };

      pages.push(page);
    }

    return pages;
  }

  /**
   * Generate sections for a page type
   */
  private generateSections(
    pageType: PageType,
    appType: MultiPageAppType,
    includeExampleData?: boolean
  ): PageSection[] {
    const sections: PageSection[] = [];

    switch (pageType) {
      case 'home':
        sections.push(
          this.createSection('hero', 'hero'),
          this.createSection('features', 'features'),
        );
        if (['landing_page', 'portfolio', 'e_commerce'].includes(appType)) {
          sections.push(this.createSection('cta', 'cta'));
        }
        break;

      case 'dashboard':
        sections.push(
          this.createSection('stats', 'stats'),
          this.createSection('charts', 'chart_grid'),
        );
        break;

      case 'list':
        sections.push(this.createSection('data', 'data_table'));
        break;

      case 'detail':
        sections.push(this.createSection('content', 'content'));
        break;

      case 'form':
        sections.push(this.createSection('form', 'form'));
        break;

      case 'about':
        sections.push(
          this.createSection('content', 'content'),
          this.createSection('team', 'team'),
        );
        break;

      case 'contact':
        sections.push(this.createSection('contact', 'contact'));
        break;

      case 'settings':
        sections.push(this.createSection('settings', 'form'));
        break;

      default:
        sections.push(this.createSection('content', 'content'));
    }

    return sections;
  }

  /**
   * Create a section with default configuration
   */
  private createSection(title: string, sectionType: SectionType): PageSection {
    return {
      id: crypto.randomUUID(),
      title,
      sectionType,
      components: [],
      layout: sectionType === 'chart_grid' ? 'grid' : 'stack',
      columns: sectionType === 'chart_grid' ? 2 : undefined,
      gap: '1.5rem',
    };
  }

  /**
   * Generate navigation for the app
   */
  private generateNavigation(appType: MultiPageAppType, pages: GeneratedPage[]): AppNavigation {
    const navType = ['dashboard', 'admin_panel', 'documentation'].includes(appType) 
      ? 'sidebar' 
      : 'top_bar';

    const items: NavItem[] = pages
      .filter(p => p.showInNav)
      .map(p => ({
        id: p.id,
        label: p.title,
        pageId: p.id,
        icon: p.navIcon,
      }));

    return {
      type: navType,
      items,
      brand: {
        text: 'Generated App',
        link: '/',
      },
      mobileBreakpoint: 768,
      mobileType: 'hamburger',
    };
  }

  /**
   * Extract app name from prompt
   */
  private extractAppName(prompt: string, appType: MultiPageAppType): string {
    // Try to extract a specific name from the prompt
    const namePatterns = [
      /(?:called?|named?)\s+["']?([^"'\n,]+)["']?/i,
      /(?:for|about)\s+["']?([^"'\n,]+)["']?/i,
      /["']([^"'\n]+)["']/,
    ];

    for (const pattern of namePatterns) {
      const match = prompt.match(pattern);
      if (match && match[1] && match[1].length < 50) {
        return match[1].trim();
      }
    }

    // Default names by type
    const defaultNames: Record<MultiPageAppType, string> = {
      web_app: 'My Web App',
      dashboard: 'Analytics Dashboard',
      wizard: 'Setup Wizard',
      documentation: 'Documentation',
      portfolio: 'My Portfolio',
      landing_page: 'Product Landing',
      tutorial: 'Interactive Tutorial',
      report: 'Business Report',
      admin_panel: 'Admin Panel',
      e_commerce: 'Online Store',
      blog: 'My Blog',
    };

    return defaultNames[appType];
  }

  /**
   * Generate description from prompt and type
   */
  private generateDescription(appType: MultiPageAppType, prompt: string): string {
    const typeDescriptions: Record<MultiPageAppType, string> = {
      web_app: 'A custom web application',
      dashboard: 'An analytics dashboard with real-time metrics and visualizations',
      wizard: 'A multi-step guided process',
      documentation: 'Technical documentation with navigation and search',
      portfolio: 'A professional portfolio showcasing work and skills',
      landing_page: 'A marketing landing page designed to convert visitors',
      tutorial: 'An interactive tutorial with step-by-step lessons',
      report: 'A comprehensive business report with analysis and findings',
      admin_panel: 'An administration interface for managing content and users',
      e_commerce: 'An online store with products, cart, and checkout',
      blog: 'A content site with articles and categories',
    };

    return typeDescriptions[appType];
  }

  /**
   * Get icon for a page type
   */
  private getPageIcon(pageType: PageType): string {
    const icons: Record<PageType, string> = {
      home: 'home',
      list: 'list',
      detail: 'file-text',
      form: 'edit',
      dashboard: 'bar-chart-2',
      settings: 'settings',
      profile: 'user',
      about: 'info',
      contact: 'mail',
      search: 'search',
      error: 'alert-circle',
      auth: 'lock',
      custom: 'box',
    };
    return icons[pageType] || 'file';
  }

  // =========================================================================
  // PERSISTENCE
  // =========================================================================

  /**
   * Save app to database
   */
  private async saveApp(app: GeneratedMultiPageApp): Promise<void> {
    // Insert app
    await executeStatement(
      `INSERT INTO generated_multipage_apps (
        id, tenant_id, user_id, conversation_id, name, description, app_type,
        navigation, global_state, theme, data_sources, actions, assets, build_status, version
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7,
        $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14, $15
      )`,
      [
        stringParam('id', app.id),
        stringParam('tenantId', app.tenantId),
        stringParam('userId', app.userId),
        stringParam('conversationId', app.conversationId || ''),
        stringParam('name', app.name),
        stringParam('description', app.description),
        stringParam('appType', app.appType),
        stringParam('navigation', JSON.stringify(app.navigation)),
        stringParam('globalState', JSON.stringify(app.globalState)),
        stringParam('theme', JSON.stringify(app.theme)),
        stringParam('dataSources', JSON.stringify(app.dataSources)),
        stringParam('actions', JSON.stringify(app.actions)),
        stringParam('assets', JSON.stringify(app.assets)),
        stringParam('buildStatus', app.buildStatus),
        stringParam('version', String(app.version)),
      ]
    );

    // Insert pages
    for (const page of app.pages) {
      await executeStatement(
        `INSERT INTO app_pages (
          id, app_id, slug, title, description, page_type, layout, sections,
          local_state, meta, requires_auth, show_in_nav, nav_order, nav_icon
        ) VALUES (
          $1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, $8::jsonb,
          $9::jsonb, $10::jsonb, $11, $12, $13, $14
        )`,
        [
          stringParam('id', page.id),
          stringParam('appId', app.id),
          stringParam('slug', page.slug),
          stringParam('title', page.title),
          stringParam('description', page.description || ''),
          stringParam('pageType', page.pageType),
          stringParam('layout', JSON.stringify(page.layout)),
          stringParam('sections', JSON.stringify(page.sections)),
          stringParam('localState', JSON.stringify(page.localState)),
          stringParam('meta', JSON.stringify(page.meta || {})),
          stringParam('requiresAuth', String(page.requiresAuth || false)),
          stringParam('showInNav', String(page.showInNav)),
          stringParam('navOrder', String(page.navOrder || 0)),
          stringParam('navIcon', page.navIcon || ''),
        ]
      );
    }

    // Update home page reference
    if (app.pages.length > 0) {
      await executeStatement(
        `UPDATE generated_multipage_apps SET home_page_id = $2::uuid WHERE id = $1::uuid`,
        [stringParam('id', app.id), stringParam('homePageId', app.pages[0].id)]
      );
    }
  }

  /**
   * Get app by ID
   */
  async getApp(appId: string): Promise<GeneratedMultiPageApp | null> {
    const appResult = await executeStatement(
      `SELECT * FROM generated_multipage_apps WHERE id = $1::uuid`,
      [stringParam('appId', appId)]
    );

    if (!appResult.rows?.length) return null;

    const appRow = appResult.rows[0] as Record<string, unknown>;

    const pagesResult = await executeStatement(
      `SELECT * FROM app_pages WHERE app_id = $1::uuid ORDER BY nav_order`,
      [stringParam('appId', appId)]
    );

    const pages = (pagesResult.rows || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      slug: row.slug as string,
      title: row.title as string,
      description: row.description as string,
      pageType: row.page_type as PageType,
      layout: row.layout as PageLayout,
      sections: row.sections as PageSection[],
      localState: row.local_state as Record<string, unknown>,
      meta: row.meta as Record<string, unknown>,
      requiresAuth: row.requires_auth as boolean,
      showInNav: row.show_in_nav as boolean,
      navOrder: row.nav_order as number,
      navIcon: row.nav_icon as string,
    }));

    return {
      id: appRow.id as string,
      tenantId: appRow.tenant_id as string,
      userId: appRow.user_id as string,
      conversationId: appRow.conversation_id as string,
      name: appRow.name as string,
      description: appRow.description as string,
      appType: appRow.app_type as MultiPageAppType,
      icon: appRow.icon as string,
      pages,
      homePage: appRow.home_page_id as string,
      navigation: appRow.navigation as AppNavigation,
      globalState: appRow.global_state as Record<string, unknown>,
      theme: appRow.theme as AppTheme,
      dataSources: appRow.data_sources as unknown[],
      actions: appRow.actions as unknown[],
      assets: appRow.assets as unknown[],
      buildStatus: appRow.build_status as 'draft' | 'building' | 'ready' | 'deployed',
      previewUrl: appRow.preview_url as string,
      createdAt: new Date(appRow.created_at as string),
      updatedAt: new Date(appRow.updated_at as string),
      version: appRow.version as number,
    };
  }

  /**
   * Get apps for a user
   */
  async getUserApps(tenantId: string, userId: string): Promise<GeneratedMultiPageApp[]> {
    const result = await executeStatement(
      `SELECT id FROM generated_multipage_apps 
       WHERE tenant_id = $1::uuid AND user_id = $2::uuid
       ORDER BY updated_at DESC
       LIMIT 50`,
      [stringParam('tenantId', tenantId), stringParam('userId', userId)]
    );

    const apps: GeneratedMultiPageApp[] = [];
    for (const row of result.rows || []) {
      const app = await this.getApp((row as Record<string, unknown>).id as string);
      if (app) apps.push(app);
    }

    return apps;
  }

  /**
   * Update an app
   */
  async updateApp(appId: string, updates: Partial<GeneratedMultiPageApp>): Promise<void> {
    const fields: string[] = [];
    const params: { name: string; value: string }[] = [stringParam('id', appId)];
    let paramIndex = 2;

    if (updates.name) {
      fields.push(`name = $${paramIndex}`);
      params.push(stringParam('name', updates.name));
      paramIndex++;
    }

    if (updates.description) {
      fields.push(`description = $${paramIndex}`);
      params.push(stringParam('description', updates.description));
      paramIndex++;
    }

    if (updates.navigation) {
      fields.push(`navigation = $${paramIndex}::jsonb`);
      params.push(stringParam('navigation', JSON.stringify(updates.navigation)));
      paramIndex++;
    }

    if (updates.theme) {
      fields.push(`theme = $${paramIndex}::jsonb`);
      params.push(stringParam('theme', JSON.stringify(updates.theme)));
      paramIndex++;
    }

    if (updates.buildStatus) {
      fields.push(`build_status = $${paramIndex}`);
      params.push(stringParam('buildStatus', updates.buildStatus));
      paramIndex++;
    }

    if (fields.length > 0) {
      await executeStatement(
        `UPDATE generated_multipage_apps SET ${fields.join(', ')}, updated_at = NOW(), version = version + 1 WHERE id = $1::uuid`,
        params
      );
    }
  }

  /**
   * Delete an app
   */
  async deleteApp(appId: string): Promise<void> {
    await executeStatement(
      `DELETE FROM generated_multipage_apps WHERE id = $1::uuid`,
      [stringParam('appId', appId)]
    );
  }

  // =========================================================================
  // TEMPLATES
  // =========================================================================

  /**
   * Get available templates
   */
  async getTemplates(appType?: MultiPageAppType): Promise<unknown[]> {
    let sql = `SELECT * FROM multipage_app_templates WHERE is_active = true`;
    const params: { name: string; value: string }[] = [];

    if (appType) {
      sql += ` AND app_type = $1`;
      params.push(stringParam('appType', appType));
    }

    sql += ` ORDER BY is_featured DESC, usage_count DESC`;

    const result = await executeStatement(sql, params);
    return result.rows || [];
  }

  /**
   * Create app from template
   */
  async createFromTemplate(
    templateId: string,
    tenantId: string,
    userId: string,
    customizations?: { name?: string; theme?: Partial<AppTheme> }
  ): Promise<GeneratedMultiPageApp> {
    const templateResult = await executeStatement(
      `SELECT * FROM multipage_app_templates WHERE id = $1::uuid`,
      [stringParam('templateId', templateId)]
    );

    if (!templateResult.rows?.length) {
      throw new Error('Template not found');
    }

    const template = templateResult.rows[0] as Record<string, unknown>;

    // Increment usage count
    await executeStatement(
      `UPDATE multipage_app_templates SET usage_count = usage_count + 1 WHERE id = $1::uuid`,
      [stringParam('templateId', templateId)]
    );

    // Generate app from template
    return this.generateApp({
      tenantId,
      userId,
      prompt: `Create a ${template.app_type} app`,
      appType: template.app_type as MultiPageAppType,
      theme: { ...(template.theme as Partial<AppTheme>), ...customizations?.theme },
    });
  }
}

export const multiPageAppFactoryService = new MultiPageAppFactoryService();
