// RADIANT v4.18.0 - Liquid Interface Service
// "Don't Build the Tool. BE the Tool."
// The chat interface morphs into the tool the user needs

import { executeStatement, stringParam, longParam, boolParam } from '../../db/client';
import { enhancedLogger as logger } from '../../logging/enhanced-logger';
import { COMPONENT_REGISTRY, suggestComponents, getComponent } from './component-registry';
import {
  LiquidSchema,
  LiquidSession,
  LiquidMode,
  LiquidIntent,
  IntentCategory,
  LayoutNode,
  GhostBinding,
  AIOverlayConfig,
  MorphRequest,
  MorphResponse,
  MorphTransition,
  GhostEvent,
  GhostEventRequest,
  GhostEventResponse,
  AIReaction,
  AISuggestion,
} from '@radiant/shared';

// ============================================================================
// Intent Detection Patterns
// ============================================================================

const INTENT_PATTERNS: Array<{ pattern: RegExp; category: IntentCategory; confidence: number }> = [
  // Data Analysis
  { pattern: /spreadsheet|excel|csv|data.*table|analyze.*data|columns?.*rows?/i, category: 'data_analysis', confidence: 0.9 },
  { pattern: /pivot|aggregate|group\s+by|sum\s+of|average|statistics/i, category: 'data_analysis', confidence: 0.85 },
  
  // Tracking
  { pattern: /track.*invoice|invoice.*track|freelance.*bill|client.*payment/i, category: 'tracking', confidence: 0.95 },
  { pattern: /expense.*track|track.*expense|budget.*track|spending/i, category: 'tracking', confidence: 0.9 },
  { pattern: /todo|task.*list|checklist|track.*progress/i, category: 'tracking', confidence: 0.85 },
  
  // Visualization
  { pattern: /chart|graph|visualize|plot|show.*data|display.*metrics/i, category: 'visualization', confidence: 0.9 },
  { pattern: /dashboard|metrics|kpi|analytics/i, category: 'visualization', confidence: 0.85 },
  { pattern: /map|location|geographic|coordinates/i, category: 'visualization', confidence: 0.8 },
  
  // Planning
  { pattern: /project.*plan|plan.*project|timeline|milestone|gantt/i, category: 'planning', confidence: 0.9 },
  { pattern: /kanban|board|workflow|sprint/i, category: 'planning', confidence: 0.85 },
  { pattern: /schedule|calendar|event|meeting/i, category: 'planning', confidence: 0.8 },
  
  // Calculation
  { pattern: /calculate|compute|formula|equation|math/i, category: 'calculation', confidence: 0.9 },
  { pattern: /convert.*currency|currency.*convert|exchange.*rate/i, category: 'calculation', confidence: 0.85 },
  
  // Design
  { pattern: /design|wireframe|mockup|prototype|layout/i, category: 'design', confidence: 0.85 },
  { pattern: /whiteboard|draw|sketch|brainstorm|mindmap/i, category: 'design', confidence: 0.8 },
  
  // Coding
  { pattern: /code|program|script|function|api|debug/i, category: 'coding', confidence: 0.85 },
  { pattern: /terminal|console|command|shell/i, category: 'coding', confidence: 0.9 },
  { pattern: /json|xml|regex|format/i, category: 'coding', confidence: 0.75 },
  
  // Writing
  { pattern: /write|draft|compose|document|note/i, category: 'writing', confidence: 0.7 },
];

// ============================================================================
// Layout Templates
// ============================================================================

const LAYOUT_TEMPLATES: Record<IntentCategory, (components: string[], data: Record<string, unknown>) => LayoutNode> = {
  data_analysis: (components, data) => ({
    type: 'split',
    id: 'root',
    direction: 'horizontal',
    sizes: [75, 25],
    children: [
      { type: 'component', id: 'main', component: components[0] || 'data-grid', props: data },
      { type: 'component', id: 'chat', component: 'ai-chat', props: { mode: 'sidebar', contextAware: true } },
    ],
  }),
  
  tracking: (components, data) => ({
    type: 'split',
    id: 'root',
    direction: 'vertical',
    sizes: [70, 30],
    children: [
      {
        type: 'split',
        id: 'top',
        direction: 'horizontal',
        sizes: [70, 30],
        children: [
          { type: 'component', id: 'main', component: components[0] || 'invoice', props: data },
          { type: 'stack', id: 'sidebar', children: [
            { type: 'component', id: 'summary', component: 'data-card', props: { title: 'Total', value: '$0' } },
            { type: 'component', id: 'chat', component: 'ai-chat', props: { mode: 'compact' } },
          ]},
        ],
      },
      { type: 'component', id: 'table', component: 'data-grid', props: { ...data, compact: true } },
    ],
  }),
  
  visualization: (components, data) => ({
    type: 'split',
    id: 'root',
    direction: 'horizontal',
    sizes: [80, 20],
    children: [
      {
        type: 'stack',
        id: 'charts',
        children: components.slice(0, 4).map((c, i) => ({
          type: 'component',
          id: `chart-${i}`,
          component: c,
          props: data,
        })),
      },
      { type: 'component', id: 'chat', component: 'ai-chat', props: { mode: 'sidebar' } },
    ],
  }),
  
  planning: (components, data) => ({
    type: 'split',
    id: 'root',
    direction: 'horizontal',
    sizes: [75, 25],
    children: [
      { type: 'component', id: 'main', component: components[0] || 'kanban', props: data },
      {
        type: 'stack',
        id: 'sidebar',
        children: [
          { type: 'component', id: 'timeline', component: 'timeline', props: {} },
          { type: 'component', id: 'chat', component: 'ai-chat', props: { mode: 'compact' } },
        ],
      },
    ],
  }),
  
  calculation: (components, data) => ({
    type: 'split',
    id: 'root',
    direction: 'horizontal',
    sizes: [40, 60],
    children: [
      { type: 'component', id: 'calc', component: components[0] || 'calculator', props: data },
      { type: 'component', id: 'chat', component: 'ai-chat', props: { mode: 'integrated', showSuggestions: true } },
    ],
  }),
  
  design: (components, data) => ({
    type: 'overlay',
    id: 'root',
    children: [
      { type: 'component', id: 'canvas', component: components[0] || 'whiteboard', props: { ...data, fullscreen: true } },
      { type: 'component', id: 'chat', component: 'ai-chat', props: { mode: 'floating' as any as any, position: 'bottom-right' } },
    ],
  }),
  
  coding: (components, data) => ({
    type: 'split',
    id: 'root',
    direction: 'vertical',
    sizes: [70, 30],
    children: [
      { type: 'component', id: 'editor', component: components[0] || 'code-editor', props: data },
      {
        type: 'tabs',
        id: 'bottom',
        children: [
          { type: 'component', id: 'terminal', component: 'terminal', props: {} },
          { type: 'component', id: 'chat', component: 'ai-chat', props: { mode: 'tab' } },
        ],
      },
    ],
  }),
  
  writing: (components, data) => ({
    type: 'split',
    id: 'root',
    direction: 'horizontal',
    sizes: [70, 30],
    children: [
      { type: 'component', id: 'editor', component: components[0] || 'notes', props: data },
      {
        type: 'stack',
        id: 'assistant',
        children: [
          { type: 'component', id: 'suggestions', component: 'suggestion-panel', props: {} },
          { type: 'component', id: 'chat', component: 'ai-chat', props: { mode: 'compact' } },
        ],
      },
    ],
  }),
  
  general: (_components, _data) => ({
    type: 'component',
    id: 'root',
    component: 'ai-chat',
    props: { mode: 'fullscreen' },
  }),
};

// ============================================================================
// Liquid Interface Service
// ============================================================================

class LiquidInterfaceService {
  // --------------------------------------------------------------------------
  // Session Management
  // --------------------------------------------------------------------------

  async createSession(tenantId: string, userId: string, conversationId: string): Promise<LiquidSession> {
    const id = `liquid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session: LiquidSession = {
      id,
      tenantId,
      userId,
      mode: 'chat',
      ghostState: {},
      eventHistory: [],
      reactionHistory: [],
      conversationId,
      messageCount: 0,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };

    await executeStatement(
      `INSERT INTO liquid_sessions (id, tenant_id, user_id, conversation_id, mode, ghost_state, created_at, last_activity_at)
        VALUES (:id, :tenantId, :userId, :conversationId, 'chat', '{}', NOW(), NOW())`,
      [
        stringParam('id', id),
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('conversationId', conversationId),
      ]
    );

    logger.info('Created liquid session', { tenantId, sessionId: id });
    return session;
  }

  async getSession(tenantId: string, sessionId: string): Promise<LiquidSession | null> {
    const result = await executeStatement(
      `SELECT * FROM liquid_sessions WHERE tenant_id = :tenantId AND id = :sessionId`,
      [stringParam('tenantId', tenantId), stringParam('sessionId', sessionId)]
    );

    if (result.rows && result.rows.length > 0) {
      return this.parseSession(result.rows[0] as Record<string, unknown>);
    }
    return null;
  }

  async updateSession(sessionId: string, updates: Partial<LiquidSession>): Promise<void> {
    const setClauses: string[] = ['last_activity_at = NOW()'];
    const params = [stringParam('sessionId', sessionId)];

    if (updates.mode) {
      setClauses.push('mode = :mode');
      params.push(stringParam('mode', updates.mode));
    }
    if (updates.currentSchema) {
      setClauses.push('current_schema = :schema');
      params.push(stringParam('schema', JSON.stringify(updates.currentSchema)));
    }
    if (updates.ghostState) {
      setClauses.push('ghost_state = :ghostState');
      params.push(stringParam('ghostState', JSON.stringify(updates.ghostState)));
    }
    if (updates.morphedAt) {
      setClauses.push('morphed_at = :morphedAt');
      params.push(stringParam('morphedAt', updates.morphedAt));
    }

    await executeStatement(
      `UPDATE liquid_sessions SET ${setClauses.join(', ')} WHERE id = :sessionId`,
      params
    );
  }

  // --------------------------------------------------------------------------
  // Intent Detection
  // --------------------------------------------------------------------------

  detectIntent(message: string): LiquidIntent {
    let bestMatch: { category: IntentCategory; confidence: number } = { category: 'general', confidence: 0.5 };

    for (const { pattern, category, confidence } of INTENT_PATTERNS) {
      if (pattern.test(message)) {
        if (confidence > bestMatch.confidence) {
          bestMatch = { category, confidence };
        }
      }
    }

    // Extract entities from message
    const entities: Record<string, string> = {};
    
    // Extract numbers
    const numbers = message.match(/\$?[\d,]+\.?\d*/g);
    if (numbers) entities.numbers = numbers.join(', ');
    
    // Extract dates
    const dates = message.match(/\d{1,2}\/\d{1,2}\/\d{2,4}|\w+\s+\d{1,2},?\s+\d{4}/g);
    if (dates) entities.dates = dates.join(', ');

    // Get suggested components
    const suggestedComponents = suggestComponents(bestMatch.category).map(c => c.id);

    return {
      category: bestMatch.category,
      action: this.inferAction(message, bestMatch.category),
      confidence: bestMatch.confidence,
      entities,
      suggestedComponents,
    };
  }

  private inferAction(message: string, category: IntentCategory): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('create') || lowerMessage.includes('make') || lowerMessage.includes('new')) {
      return 'create';
    }
    if (lowerMessage.includes('track') || lowerMessage.includes('manage')) {
      return 'track';
    }
    if (lowerMessage.includes('analyze') || lowerMessage.includes('show') || lowerMessage.includes('view')) {
      return 'analyze';
    }
    if (lowerMessage.includes('edit') || lowerMessage.includes('update') || lowerMessage.includes('change')) {
      return 'edit';
    }
    if (lowerMessage.includes('help') || lowerMessage.includes('how')) {
      return 'assist';
    }

    return 'interact';
  }

  // --------------------------------------------------------------------------
  // Morph Decision & Schema Generation
  // --------------------------------------------------------------------------

  async processMorphRequest(request: MorphRequest): Promise<MorphResponse> {
    const { tenantId, userId, sessionId, message, currentState } = request;

    // Get or create session
    let session: LiquidSession | null = null;
    if (sessionId) {
      session = await this.getSession(tenantId, sessionId);
    }
    if (!session) {
      session = await this.createSession(tenantId, userId, `conv_${Date.now()}`);
    }

    // Detect intent
    const intent = this.detectIntent(message);

    // Decide if we should morph
    const shouldMorph = this.shouldMorph(intent, session, message);

    if (!shouldMorph) {
      return {
        sessionId: session.id,
        shouldMorph: false,
        intent,
        aiMessage: undefined, // Let the regular chat handle it
      };
    }

    // Generate schema
    const schema = this.generateSchema(intent, currentState || {});

    // Generate transition animation
    const transition = this.generateTransition(session.mode, 'morphed');

    // Update session
    await this.updateSession(session.id, {
      mode: 'morphed',
      currentSchema: schema,
      morphedAt: new Date().toISOString(),
    });

    // Generate AI message
    const aiMessage = this.generateMorphMessage(intent, schema);

    // Generate suggestions
    const suggestions = this.generateSuggestions(intent, schema);

    logger.info('Morphing interface', {
      tenantId,
      sessionId: session.id,
      intent: intent.category,
      confidence: intent.confidence,
    });

    return {
      sessionId: session.id,
      shouldMorph: true,
      intent,
      schema,
      transition,
      aiMessage,
      suggestions,
    };
  }

  private shouldMorph(intent: LiquidIntent, session: LiquidSession, message: string): boolean {
    // High confidence intent should morph
    if (intent.confidence >= 0.85 && intent.category !== 'general') {
      return true;
    }

    // Explicit trigger phrases
    const triggerPhrases = [
      /help me (?:with|track|manage|create|build)/i,
      /(?:create|build|make) (?:me |a |an )/i,
      /(?:show|display|visualize) (?:my |the |a )/i,
      /(?:track|manage|organize) (?:my |the )/i,
    ];

    for (const phrase of triggerPhrases) {
      if (phrase.test(message)) {
        return true;
      }
    }

    // Already morphed - continue in morphed mode
    if (session.mode === 'morphed') {
      return true;
    }

    return false;
  }

  private generateSchema(intent: LiquidIntent, initialData: Record<string, unknown>): LiquidSchema {
    const id = `schema_${Date.now()}`;
    const components = intent.suggestedComponents;
    
    // Get layout template for this intent
    const layoutFn = LAYOUT_TEMPLATES[intent.category] || LAYOUT_TEMPLATES.general;
    const layout = layoutFn(components, initialData);

    // Generate ghost bindings
    const bindings = this.generateBindings(layout, intent);

    // Configure AI overlay
    const aiOverlay = this.configureAIOverlay(intent.category);

    return {
      version: '1.0',
      id,
      intent,
      layout,
      initialData,
      bindings,
      aiOverlay,
    };
  }

  private generateBindings(layout: LayoutNode, intent: LiquidIntent): GhostBinding[] {
    const bindings: GhostBinding[] = [];
    
    // Recursively find components and create bindings
    const processNode = (node: LayoutNode) => {
      if (node.type === 'component' && node.component) {
        const comp = getComponent(node.component);
        if (comp?.supportsAIContext) {
          // Create binding for main data prop
          bindings.push({
            id: `binding_${node.id}`,
            sourceComponent: node.id,
            sourceProperty: 'data',
            contextKey: `${node.id}_data`,
            direction: 'bidirectional',
            debounceMs: 300,
            triggerReaction: true,
          });

          // Create binding for selection
          if (comp.supportsInteraction) {
            bindings.push({
              id: `binding_${node.id}_selection`,
              sourceComponent: node.id,
              sourceProperty: 'selection',
              contextKey: `${node.id}_selection`,
              direction: 'ui_to_ai',
              triggerReaction: true,
              reactionPrompt: `User selected item in ${comp.name}. Respond helpfully.`,
            });
          }
        }
      }

      // Process children
      if (node.children) {
        for (const child of node.children) {
          processNode(child);
        }
      }
    };

    processNode(layout);
    return bindings;
  }

  private configureAIOverlay(category: IntentCategory): AIOverlayConfig {
    const configs: Record<IntentCategory, AIOverlayConfig> = {
      data_analysis: { mode: 'sidebar', position: 'right', width: '25%', autoHide: false, showOnHover: false, showSuggestions: true, voiceEnabled: false, autoSpeak: false },
      tracking: { mode: 'sidebar', position: 'right', width: '300px', autoHide: false, showOnHover: false, showSuggestions: true, voiceEnabled: false, autoSpeak: false },
      visualization: { mode: 'minimal', position: 'right', autoHide: true, showOnHover: true, showSuggestions: true, voiceEnabled: false, autoSpeak: false },
      planning: { mode: 'sidebar', position: 'right', width: '25%', autoHide: false, showOnHover: false, showSuggestions: true, voiceEnabled: false, autoSpeak: false },
      calculation: { mode: 'integrated', autoHide: false, showOnHover: false, showSuggestions: true, voiceEnabled: false, autoSpeak: false },
      design: { mode: 'floating' as any as any, position: 'right', autoHide: true, showOnHover: true, showSuggestions: false, voiceEnabled: false, autoSpeak: false },
      coding: { mode: 'sidebar', position: 'bottom', height: '30%', autoHide: false, showOnHover: false, showSuggestions: true, voiceEnabled: false, autoSpeak: false },
      writing: { mode: 'sidebar', position: 'right', width: '30%', autoHide: false, showOnHover: false, showSuggestions: true, voiceEnabled: false, autoSpeak: false },
      general: { mode: 'integrated', autoHide: false, showOnHover: false, showSuggestions: true, voiceEnabled: false, autoSpeak: false },
    };

    return configs[category] || configs.general;
  }

  private generateTransition(fromMode: LiquidMode, toMode: LiquidMode): MorphTransition {
    if (fromMode === 'chat' && toMode === 'morphed') {
      return {
        type: 'expand',
        duration: 400,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        staggerChildren: true,
      };
    }
    if (fromMode === 'morphed' && toMode === 'chat') {
      return {
        type: 'dissolve',
        duration: 300,
        easing: 'ease-out',
        staggerChildren: false,
      };
    }
    return {
      type: 'morph',
      duration: 350,
      easing: 'ease-in-out',
      staggerChildren: true,
    };
  }

  private generateMorphMessage(intent: LiquidIntent, schema: LiquidSchema): string {
    const messages: Record<IntentCategory, string> = {
      data_analysis: "I've set up a spreadsheet for you. Click any cell to edit, and I'll help you analyze the data.",
      tracking: "I've created a tracking dashboard for you. Add items and I'll help you stay organized.",
      visualization: "Here's your visualization dashboard. Let me know if you'd like different chart types or data views.",
      planning: "I've set up a planning board for you. Drag items between columns and I'll help you manage your workflow.",
      calculation: "Calculator ready! Enter your calculations and I'll help with formulas and conversions.",
      design: "Canvas is ready. Draw, sketch, or brainstorm - I'll watch and offer suggestions.",
      coding: "Code editor is live. I'll help with syntax, debugging, and suggestions as you type.",
      writing: "Writing space is ready. Start typing and I'll offer suggestions and help with your content.",
      general: "How can I help you today?",
    };

    return messages[intent.category] || messages.general;
  }

  private generateSuggestions(intent: LiquidIntent, schema: LiquidSchema): AISuggestion[] {
    const suggestionsByCategory: Record<IntentCategory, Array<{ text: string; action: string }>> = {
      data_analysis: [
        { text: 'Add a new column', action: 'add_column' },
        { text: 'Sort by this column', action: 'sort' },
        { text: 'Create a chart from this data', action: 'visualize' },
        { text: 'Import data from CSV', action: 'import' },
      ],
      tracking: [
        { text: 'Add new invoice', action: 'add_invoice' },
        { text: 'Show overdue items', action: 'filter_overdue' },
        { text: 'Generate report', action: 'report' },
        { text: 'Send reminder', action: 'send_reminder' },
      ],
      visualization: [
        { text: 'Change chart type', action: 'change_chart' },
        { text: 'Add trend line', action: 'add_trendline' },
        { text: 'Export as image', action: 'export' },
      ],
      planning: [
        { text: 'Add new task', action: 'add_task' },
        { text: 'Set due date', action: 'set_date' },
        { text: 'Assign to someone', action: 'assign' },
      ],
      calculation: [
        { text: 'Show history', action: 'show_history' },
        { text: 'Convert units', action: 'convert' },
        { text: 'Save result', action: 'save' },
      ],
      design: [
        { text: 'Add shape', action: 'add_shape' },
        { text: 'Add text', action: 'add_text' },
        { text: 'Clear canvas', action: 'clear' },
      ],
      coding: [
        { text: 'Run code', action: 'run' },
        { text: 'Format code', action: 'format' },
        { text: 'Explain this code', action: 'explain' },
      ],
      writing: [
        { text: 'Improve clarity', action: 'improve' },
        { text: 'Make shorter', action: 'shorten' },
        { text: 'Add examples', action: 'examples' },
      ],
      general: [],
    };

    const suggestions = suggestionsByCategory[intent.category] || [];
    return suggestions.map((s, i) => ({
      id: `sug_${i}`,
      text: s.text,
      action: s.action,
      confidence: 0.8 - i * 0.1,
    }));
  }

  // --------------------------------------------------------------------------
  // Ghost Event Processing
  // --------------------------------------------------------------------------

  async processGhostEvent(request: GhostEventRequest): Promise<GhostEventResponse> {
    const { sessionId, event } = request;

    // Store event
    await executeStatement(
      `INSERT INTO liquid_ghost_events (id, session_id, component_id, component_type, action, payload, current_state, created_at)
        VALUES (:id, :sessionId, :componentId, :componentType, :action, :payload, :currentState, NOW())`,
      [
        stringParam('id', event.id),
        stringParam('sessionId', sessionId),
        stringParam('componentId', event.componentId),
        stringParam('componentType', event.componentType),
        stringParam('action', event.action),
        stringParam('payload', JSON.stringify(event.payload)),
        stringParam('currentState', JSON.stringify(event.currentState)),
      ]
    );

    // Generate AI reaction
    const reaction = this.generateReaction(event);

    // Store reaction
    await executeStatement(
      `INSERT INTO liquid_ai_reactions (id, event_id, session_id, type, message, state_updates, created_at)
        VALUES (:id, :eventId, :sessionId, :type, :message, :stateUpdates, NOW())`,
      [
        stringParam('id', reaction.id),
        stringParam('eventId', event.id),
        stringParam('sessionId', sessionId),
        stringParam('type', reaction.type),
        stringParam('message', reaction.message || ''),
        stringParam('stateUpdates', JSON.stringify(reaction.stateUpdates || {})),
      ]
    );

    return {
      reaction,
      stateUpdates: reaction.stateUpdates,
    };
  }

  private generateReaction(event: GhostEvent): AIReaction {
    const id = `reaction_${Date.now()}`;

    // Generate contextual response based on event
    if (event.action === 'select' || event.action === 'click') {
      const itemName = event.payload.name || event.payload.id || 'item';
      return {
        id,
        eventId: event.id,
        type: 'speak',
        message: `I see you selected ${itemName}. Would you like me to help you with this?`,
        suggestions: [
          { id: 'sug_1', text: 'Edit this item', action: 'edit', confidence: 0.9 },
          { id: 'sug_2', text: 'Show details', action: 'details', confidence: 0.8 },
          { id: 'sug_3', text: 'Delete this', action: 'delete', confidence: 0.6 },
        ],
      };
    }

    if (event.action === 'change') {
      return {
        id,
        eventId: event.id,
        type: 'update',
        stateUpdates: { lastModified: new Date().toISOString() },
      };
    }

    if (event.action === 'drag') {
      return {
        id,
        eventId: event.id,
        type: 'speak',
        message: 'Got it! I\'ve updated the order.',
      };
    }

    // Default reaction
    return {
      id,
      eventId: event.id,
      type: 'update',
      stateUpdates: {},
    };
  }

  // --------------------------------------------------------------------------
  // Revert to Chat
  // --------------------------------------------------------------------------

  async revertToChat(tenantId: string, sessionId: string): Promise<MorphTransition> {
    await this.updateSession(sessionId, { mode: 'chat' });

    logger.info('Reverted to chat', { tenantId, sessionId });

    return {
      type: 'dissolve',
      duration: 300,
      easing: 'ease-out',
      staggerChildren: false,
    };
  }

  // --------------------------------------------------------------------------
  // Component Registry Access
  // --------------------------------------------------------------------------

  getRegistry() {
    return COMPONENT_REGISTRY;
  }

  // --------------------------------------------------------------------------
  // Parse Helpers
  // --------------------------------------------------------------------------

  private parseSession(row: Record<string, unknown>): LiquidSession {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      userId: String(row.user_id || ''),
      mode: String(row.mode || 'chat') as LiquidMode,
      currentSchema: this.parseJson(row.current_schema) ?? undefined,
      ghostState: this.parseJson(row.ghost_state) || {},
      eventHistory: [],
      reactionHistory: [],
      conversationId: String(row.conversation_id || ''),
      messageCount: Number(row.message_count) || 0,
      createdAt: String(row.created_at || ''),
      lastActivityAt: String(row.last_activity_at || ''),
      morphedAt: row.morphed_at ? String(row.morphed_at) : undefined,
    };
  }

  private parseJson<T>(value: unknown): T | null {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return null; }
    }
    return value as T;
  }
}

export const liquidInterfaceService = new LiquidInterfaceService();
