/**
 * Reality Engine Service
 * 
 * The unified runtime powering Think Tank's supernatural capabilities:
 * - Morphic UI: Interface that shapeshifts to user intent
 * - Reality Scrubber: Time travel for logic and state
 * - Quantum Futures: Parallel reality branching
 * - Pre-Cognition: Speculative execution
 * 
 * @module reality-engine
 */

import { v4 as uuidv4 } from 'uuid';
import { executeStatement } from '../../db/client';
import { modelRouterService } from '../model-router.service';
import { enhancedLogger as logger } from '../../logging/enhanced-logger';
import {
  RealityEngineSession,
  RealityEngineConfig,
  RealityEngineMetrics,
  RealityEngineInitRequest,
  RealityEngineInitResponse,
  RealityEngineEvent,
  RealityEngineEventHandler,
  MorphicSession,
  MorphicMode,
  MorphicLayout,
  MorphicGhostState,
  MorphicIntent,
  MorphicMorphRequest,
  MorphicMorphResponse,
  RealitySnapshot,
  RealityChatContext,
  QuantumBranch,
  PreCognitionPrediction,
} from '@radiant/shared';
import { realityScrubberService } from './reality-scrubber.service';
import { quantumFuturesService } from './quantum-futures.service';
import { preCognitionService } from './pre-cognition.service';

// Fix type compatibility
type LooseParam = any;

const DEFAULT_CONFIG: RealityEngineConfig = {
  morphicUIEnabled: true,
  realityScrubberEnabled: true,
  quantumFuturesEnabled: true,
  preCognitionEnabled: true,
  autoSnapshotIntervalMs: 30000,
  maxSnapshotsPerSession: 100,
  maxBranchesPerSession: 8,
  codeCurtainDefault: true,  // Hide code by default - we're a Genie, not a Coder
  ephemeralByDefault: true,  // Apps dissolve when topic changes
  preCognition: {
    enabled: true,
    maxPredictions: 3,
    predictionTTLMs: 60000,
    computeBudgetMs: 5000,
    minConfidenceThreshold: 0.6,
    useGenesisModel: true,
    genesisModelId: 'llama-3-8b-instruct',
  },
};

class RealityEngineService {
  private eventHandlers: Map<string, RealityEngineEventHandler[]> = new Map();
  private activeSessions: Map<string, RealityEngineSession> = new Map();

  /**
   * Initialize a new Reality Engine session
   */
  async initialize(request: RealityEngineInitRequest): Promise<RealityEngineInitResponse> {
    const { tenantId, userId, conversationId, config } = request;
    const sessionId = uuidv4();
    const now = new Date();

    const fullConfig = { ...DEFAULT_CONFIG, ...config };

    // Create the main timeline
    const timeline = await realityScrubberService.createTimeline(
      tenantId,
      userId,
      sessionId,
      'Main Reality'
    );

    // Create the primary branch
    const primaryBranch = await quantumFuturesService.createBranch(
      tenantId,
      userId,
      sessionId,
      'Primary Reality',
      'The main timeline',
      '#3B82F6',
      '🌟'
    );

    // Initialize pre-cognition queue
    const preCognitionQueue = await preCognitionService.initializeQueue(
      sessionId,
      fullConfig.preCognition
    );

    // Create Morphic session
    const morphicSession: MorphicSession = {
      id: uuidv4(),
      tenantId,
      userId,
      conversationId,
      mode: 'dormant',
      activeLayout: null,
      ghostState: {
        values: {},
        lastUpdated: now,
        pendingAIReactions: [],
      },
      realityId: timeline.id,
      createdAt: now,
      updatedAt: now,
    };

    // Create the session
    const session: RealityEngineSession = {
      id: sessionId,
      tenantId,
      userId,
      conversationId,
      morphicSession,
      activeTimeline: timeline,
      activeBranch: primaryBranch,
      preCognitionQueue,
      config: fullConfig,
      metrics: this.createInitialMetrics(),
      createdAt: now,
      updatedAt: now,
    };

    // Store session
    await this.storeSession(session);
    this.activeSessions.set(sessionId, session);

    // Capture initial snapshot
    const initialSnapshot = await realityScrubberService.captureSnapshot(
      tenantId,
      userId,
      sessionId,
      timeline.id,
      'user_action',
      {
        ghostState: morphicSession.ghostState,
        chatContext: { messages: [], systemPrompt: '', activeToolCalls: [] },
        layoutState: null,
      },
      'Session Start'
    );

    return { session, initialSnapshot };
  }

  /**
   * Morph the interface based on user intent
   */
  async morph(request: MorphicMorphRequest): Promise<MorphicMorphResponse> {
    const { sessionId, intent, prompt, targetComponents, preserveState } = request;
    const startTime = Date.now();

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Check for pre-cognized solution (instant delivery!)
    let wasPreCognized = false;
    let layout: MorphicLayout | null = null;

    if (session.config.preCognitionEnabled && (intent || prompt)) {
      const prediction = await preCognitionService.matchPrediction(
        sessionId,
        prompt || '',
        intent
      );

      if (prediction?.solution.morphLayout) {
        layout = prediction.solution.morphLayout;
        wasPreCognized = true;
        
        await preCognitionService.recordPredictionHit(
          prediction.id,
          Date.now() - startTime
        );

        this.emit(sessionId, {
          type: 'precognition_used',
          predictionId: prediction.id,
          latencyMs: Date.now() - startTime,
        });
      }
    }

    // If no pre-cognized solution, generate layout
    if (!layout) {
      layout = await this.generateLayout(intent, prompt, targetComponents);
      
      if (intent) {
        await preCognitionService.recordPredictionMiss(sessionId, intent, prompt || '');
      }
    }

    // Update session mode
    await this.updateMorphicMode(sessionId, 'morphing');
    this.emit(sessionId, { type: 'morph_started', layout });

    // Apply the morph
    const updatedSession = await this.applyLayout(sessionId, layout, preserveState);

    // Capture snapshot
    await realityScrubberService.captureSnapshot(
      session.tenantId,
      session.userId,
      sessionId,
      session.activeTimeline.id,
      'morph_transition',
      {
        ghostState: updatedSession.morphicSession.ghostState,
        chatContext: { messages: [], systemPrompt: '', activeToolCalls: [] },
        layoutState: layout,
      }
    );

    // Update mode to active
    await this.updateMorphicMode(sessionId, 'active');

    const transitionDurationMs = Date.now() - startTime;
    this.emit(sessionId, { type: 'morph_completed', layout, durationMs: transitionDurationMs });

    // Update metrics
    await this.updateMetrics(sessionId, {
      totalMorphs: session.metrics.totalMorphs + 1,
      avgMorphTimeMs: (session.metrics.avgMorphTimeMs + transitionDurationMs) / 2,
      preCognitionHits: session.metrics.preCognitionHits + (wasPreCognized ? 1 : 0),
      preCognitionMisses: session.metrics.preCognitionMisses + (wasPreCognized ? 0 : 1),
    });

    // Trigger background pre-cognition for next moves
    this.triggerPreCognition(session, layout).catch(err => 
      logger.error('Pre-cognition trigger failed', { error: err, sessionId })
    );

    return {
      success: true,
      layout,
      transitionDurationMs,
      ghostBindingsCreated: layout.components.reduce(
        (sum, c) => sum + c.ghostBindings.length, 0
      ),
      wasPreCognized,
    };
  }

  /**
   * Handle a Ghost State update from the UI
   */
  async handleGhostUpdate(
    sessionId: string,
    key: string,
    value: unknown
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    // Update ghost state
    const newGhostState = {
      ...session.morphicSession.ghostState,
      values: {
        ...session.morphicSession.ghostState.values,
        [key]: value,
      },
      lastUpdated: new Date(),
    };

    await this.updateGhostState(sessionId, newGhostState);
    this.emit(sessionId, { type: 'ghost_update', key, value });

    // Check if this triggers an AI reaction
    await this.evaluateAIReactions(sessionId, key, value);
  }

  /**
   * Scrub reality to a previous point
   */
  async scrubReality(
    sessionId: string,
    targetSnapshotId?: string,
    targetPosition?: number
  ): Promise<RealitySnapshot> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!session.config.realityScrubberEnabled) {
      throw new Error('Reality Scrubber is disabled for this session');
    }

    const response = await realityScrubberService.scrubTo({
      sessionId,
      targetSnapshotId,
      targetPosition,
    });

    this.emit(sessionId, { type: 'scrub_completed', response });

    // Update metrics
    await this.updateMetrics(sessionId, {
      totalScrubs: session.metrics.totalScrubs + 1,
      avgScrubTimeMs: (session.metrics.avgScrubTimeMs + response.scrubDurationMs) / 2,
    });

    // Apply restored state
    if (response.restoredSnapshot.layoutState) {
      await this.applyLayout(sessionId, response.restoredSnapshot.layoutState, false);
    }
    await this.updateGhostState(sessionId, response.restoredSnapshot.ghostState);

    return response.restoredSnapshot;
  }

  /**
   * Split reality into parallel branches (Quantum Futures)
   */
  async splitReality(
    sessionId: string,
    prompt: string,
    branchNames: string[]
  ): Promise<QuantumBranch[]> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!session.config.quantumFuturesEnabled) {
      throw new Error('Quantum Futures is disabled for this session');
    }

    const response = await quantumFuturesService.createSplit({
      sessionId,
      prompt,
      branchNames,
      autoCompare: true,
    });

    for (const branch of response.branches) {
      this.emit(sessionId, { type: 'branch_created', branch });
    }

    // Update metrics
    await this.updateMetrics(sessionId, {
      totalBranches: session.metrics.totalBranches + response.branches.length,
    });

    return response.branches;
  }

  /**
   * Collapse quantum branches into a single reality
   */
  async collapseReality(
    sessionId: string,
    winningBranchId: string,
    archiveToMemory: boolean = true
  ): Promise<void> {
    const branches = await quantumFuturesService.getBranchesForSession(sessionId);
    const losingBranchIds = branches
      .filter(b => b.id !== winningBranchId)
      .map(b => b.id);

    const response = await quantumFuturesService.collapseReality({
      sessionId,
      winningBranchId,
      losingBranchIds,
      archiveToMemory,
    });

    this.emit(sessionId, {
      type: 'branch_collapsed',
      winnerId: winningBranchId,
      losers: losingBranchIds,
    });
  }

  /**
   * Dissolve the current morphed interface (return to chat)
   */
  async dissolve(sessionId: string): Promise<void> {
    await this.updateMorphicMode(sessionId, 'dissolving');
    
    const session = await this.getSession(sessionId);
    if (session) {
      // Capture final snapshot before dissolving
      await realityScrubberService.captureSnapshot(
        session.tenantId,
        session.userId,
        sessionId,
        session.activeTimeline.id,
        'user_action',
        {
          ghostState: session.morphicSession.ghostState,
          chatContext: { messages: [], systemPrompt: '', activeToolCalls: [] },
          layoutState: null,
        },
        'Interface Dissolved'
      );
    }

    await this.updateMorphicMode(sessionId, 'dormant');
    await this.clearLayout(sessionId);
  }

  /**
   * Subscribe to Reality Engine events
   */
  subscribe(sessionId: string, handler: RealityEngineEventHandler): () => void {
    const handlers = this.eventHandlers.get(sessionId) || [];
    handlers.push(handler);
    this.eventHandlers.set(sessionId, handlers);

    return () => {
      const current = this.eventHandlers.get(sessionId) || [];
      this.eventHandlers.set(sessionId, current.filter(h => h !== handler));
    };
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<RealityEngineSession | null> {
    // Check in-memory cache first
    const cached = this.activeSessions.get(sessionId);
    if (cached) return cached;

    // Load from database
    const result = await executeStatement(
      `SELECT * FROM reality_engine_sessions WHERE id = $1`,
      [sessionId]
    );

    if (!result.rows || result.rows.length === 0) return null;
    
    const session = this.mapRowToSession(result.rows[0] as Record<string, unknown>);
    this.activeSessions.set(sessionId, session);
    return session;
  }

  /**
   * Get the current timeline visualization data
   */
  async getTimelineVisualization(sessionId: string) {
    return realityScrubberService.getTimelineVisualization(sessionId);
  }

  /**
   * Get all branches for the session
   */
  async getBranches(sessionId: string): Promise<QuantumBranch[]> {
    return quantumFuturesService.getBranchesForSession(sessionId);
  }

  /**
   * Get pre-cognition analytics
   */
  async getPreCognitionAnalytics(sessionId: string) {
    return preCognitionService.getAnalytics(sessionId);
  }

  // Private methods

  private emit(sessionId: string, event: RealityEngineEvent): void {
    const handlers = this.eventHandlers.get(sessionId) || [];
    for (const handler of handlers) {
      try {
        handler(event);
      } catch (error) {
        logger.error('Reality engine event handler error', { error });
      }
    }
  }

  private createInitialMetrics(): RealityEngineMetrics {
    return {
      totalScrubs: 0,
      totalBranches: 0,
      totalMorphs: 0,
      preCognitionHits: 0,
      preCognitionMisses: 0,
      avgScrubTimeMs: 0,
      avgMorphTimeMs: 0,
      avgPredictionAccuracy: 0,
      snapshotStorageBytes: 0,
      computeTimeMs: 0,
      estimatedCostCents: 0,
    };
  }

  private async storeSession(session: RealityEngineSession): Promise<void> {
    await executeStatement(
      `INSERT INTO reality_engine_sessions (
        id, tenant_id, user_id, conversation_id, morphic_session,
        active_timeline_id, active_branch_id, config, metrics,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        session.id,
        session.tenantId,
        session.userId,
        session.conversationId,
        JSON.stringify(session.morphicSession),
        session.activeTimeline.id,
        session.activeBranch.id,
        JSON.stringify(session.config),
        JSON.stringify(session.metrics),
        session.createdAt.toISOString(),
        session.updatedAt.toISOString(),
      ]
    );
  }

  private async updateMorphicMode(sessionId: string, mode: MorphicMode): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    session.morphicSession.mode = mode;
    session.morphicSession.updatedAt = new Date();

    await executeStatement(
      `UPDATE reality_engine_sessions SET morphic_session = $1, updated_at = $2 WHERE id = $3`,
      [JSON.stringify(session.morphicSession), new Date().toISOString(), sessionId]
    );

    this.activeSessions.set(sessionId, session);
  }

  private async applyLayout(
    sessionId: string,
    layout: MorphicLayout,
    preserveState?: boolean
  ): Promise<RealityEngineSession> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    if (!preserveState) {
      session.morphicSession.ghostState = {
        values: {},
        lastUpdated: new Date(),
        pendingAIReactions: [],
      };
    }

    session.morphicSession.activeLayout = layout;
    session.morphicSession.updatedAt = new Date();

    await executeStatement(
      `UPDATE reality_engine_sessions SET morphic_session = $1, updated_at = $2 WHERE id = $3`,
      [JSON.stringify(session.morphicSession), new Date().toISOString(), sessionId]
    );

    this.activeSessions.set(sessionId, session);
    return session;
  }

  private async clearLayout(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    session.morphicSession.activeLayout = null;
    session.morphicSession.updatedAt = new Date();

    await executeStatement(
      `UPDATE reality_engine_sessions SET morphic_session = $1, updated_at = $2 WHERE id = $3`,
      [JSON.stringify(session.morphicSession), new Date().toISOString(), sessionId]
    );

    this.activeSessions.set(sessionId, session);
  }

  private async updateGhostState(
    sessionId: string,
    ghostState: MorphicGhostState
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    session.morphicSession.ghostState = ghostState;
    session.morphicSession.updatedAt = new Date();

    await executeStatement(
      `UPDATE reality_engine_sessions SET morphic_session = $1, updated_at = $2 WHERE id = $3`,
      [JSON.stringify(session.morphicSession), new Date().toISOString(), sessionId]
    );

    this.activeSessions.set(sessionId, session);
  }

  private async updateMetrics(
    sessionId: string,
    updates: Partial<RealityEngineMetrics>
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    session.metrics = { ...session.metrics, ...updates };

    await executeStatement(
      `UPDATE reality_engine_sessions SET metrics = $1, updated_at = $2 WHERE id = $3`,
      [JSON.stringify(session.metrics), new Date().toISOString(), sessionId]
    );

    this.activeSessions.set(sessionId, session);
  }

  private async generateLayout(
    intent?: MorphicIntent,
    prompt?: string,
    targetComponents?: string[],
    tenantId?: string
  ): Promise<MorphicLayout> {
    const layoutId = uuidv4();

    // Try AI-powered layout generation if we have a prompt
    if (prompt && tenantId) {
      try {
        const aiLayout = await this.generateAILayout(tenantId, prompt, intent, targetComponents);
        if (aiLayout) return { ...aiLayout, id: layoutId };
      } catch (error) {
        logger.warn('AI layout generation failed, falling back to templates', { error });
      }
    }

    // Fallback to template-based layout
    const components = [];

    if (intent === 'data_analysis' || intent === 'tracking') {
      components.push({
        id: uuidv4(),
        componentId: 'data-grid',
        componentType: 'DataGrid',
        props: { columns: [], data: [] },
        position: { x: 0, y: 0, w: 12, h: 8 },
        ghostBindings: [
          { componentProp: 'selectedRow', contextKey: 'user_focus', direction: 'ui_to_ai' as const },
          { componentProp: 'data', contextKey: 'grid_data', direction: 'bidirectional' as const },
        ],
      });
    }

    if (intent === 'visualization') {
      components.push({
        id: uuidv4(),
        componentId: 'line-chart',
        componentType: 'LineChart',
        props: { data: [], xKey: 'x', yKey: 'y' },
        position: { x: 0, y: 0, w: 12, h: 8 },
        ghostBindings: [
          { componentProp: 'data', contextKey: 'chart_data', direction: 'ai_to_ui' as const },
        ],
      });
    }

    if (intent === 'planning') {
      components.push({
        id: uuidv4(),
        componentId: 'kanban-board',
        componentType: 'KanbanBoard',
        props: { columns: ['To Do', 'In Progress', 'Done'], items: [] },
        position: { x: 0, y: 0, w: 12, h: 10 },
        ghostBindings: [
          { componentProp: 'items', contextKey: 'tasks', direction: 'bidirectional' as const },
        ],
      });
    }

    if (intent === 'finance') {
      components.push({
        id: uuidv4(),
        componentId: 'ledger',
        componentType: 'Ledger',
        props: { entries: [], currency: 'USD' },
        position: { x: 0, y: 0, w: 12, h: 10 },
        ghostBindings: [
          { componentProp: 'entries', contextKey: 'transactions', direction: 'bidirectional' as const },
          { componentProp: 'total', contextKey: 'balance', direction: 'ui_to_ai' as const },
        ],
      });
    }

    if (intent === 'design') {
      components.push({
        id: uuidv4(),
        componentId: 'whiteboard',
        componentType: 'Whiteboard',
        props: { elements: [] },
        position: { x: 0, y: 0, w: 12, h: 10 },
        ghostBindings: [
          { componentProp: 'elements', contextKey: 'canvas_state', direction: 'bidirectional' as const },
        ],
      });
    }

    // Default to a simple chat enhancement
    if (components.length === 0) {
      components.push({
        id: uuidv4(),
        componentId: 'ai-chat',
        componentType: 'ChatPanel',
        props: {},
        position: { x: 0, y: 0, w: 12, h: 10 },
        ghostBindings: [],
      });
    }

    return {
      id: layoutId,
      type: components.length > 1 ? 'split' : 'single',
      components,
    };
  }

  private async generateAILayout(
    tenantId: string,
    prompt: string,
    intent?: MorphicIntent,
    targetComponents?: string[]
  ): Promise<Omit<MorphicLayout, 'id'> | null> {
    const systemPrompt = `You are a UI layout generator for a Morphic interface system.
Generate a JSON layout based on the user's request. Available component types:
- DataGrid: For tabular data (props: columns, data)
- LineChart/BarChart/PieChart: For visualizations (props: data, xKey, yKey)
- KanbanBoard: For task management (props: columns, items)
- Ledger: For financial data (props: entries, currency)
- Whiteboard: For design/drawing (props: elements)
- ChatPanel: For AI conversation (props: {})
- MarkdownViewer: For documents (props: content)
- CodeEditor: For code (props: language, value)

Respond ONLY with valid JSON in this format:
{"type": "single|split|grid", "components": [{"componentId": "unique-id", "componentType": "TypeName", "props": {}, "position": {"x": 0, "y": 0, "w": 12, "h": 8}}]}`;

    try {
      const response = await modelRouterService.invoke({
        modelId: 'groq/llama-3.1-8b-instant',
        tenantId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Intent: ${intent || 'general'}\nRequest: ${prompt}\nPreferred components: ${targetComponents?.join(', ') || 'any'}` },
        ],
        maxTokens: 500,
        temperature: 0.3,
      });

      const jsonMatch = response.content?.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const layout = JSON.parse(jsonMatch[0]);
      
      // Add ghost bindings and IDs to components
      layout.components = layout.components.map((c: Record<string, unknown>) => ({
        ...c,
        id: uuidv4(),
        ghostBindings: this.inferGhostBindings(c.componentType as string),
      }));

      return layout;
    } catch (error) {
      logger.warn('Failed to parse AI-generated layout', { error });
      return null;
    }
  }

  private inferGhostBindings(componentType: string): Array<{ componentProp: string; contextKey: string; direction: 'ai_to_ui' | 'ui_to_ai' | 'bidirectional' }> {
    const bindings: Record<string, Array<{ componentProp: string; contextKey: string; direction: 'ai_to_ui' | 'ui_to_ai' | 'bidirectional' }>> = {
      DataGrid: [{ componentProp: 'data', contextKey: 'grid_data', direction: 'bidirectional' }],
      LineChart: [{ componentProp: 'data', contextKey: 'chart_data', direction: 'ai_to_ui' }],
      BarChart: [{ componentProp: 'data', contextKey: 'chart_data', direction: 'ai_to_ui' }],
      KanbanBoard: [{ componentProp: 'items', contextKey: 'tasks', direction: 'bidirectional' }],
      Ledger: [{ componentProp: 'entries', contextKey: 'transactions', direction: 'bidirectional' }],
      Whiteboard: [{ componentProp: 'elements', contextKey: 'canvas_state', direction: 'bidirectional' }],
    };
    return bindings[componentType] || [];
  }

  private async evaluateAIReactions(
    sessionId: string,
    key: string,
    value: unknown
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    // Get tenant ID for AI calls
    const tenantId = session.tenantId;

    // AI-powered reaction evaluation for significant state changes
    if (key === 'user_focus' && typeof value === 'object' && tenantId) {
      try {
        const response = await modelRouterService.invoke({
          modelId: 'groq/llama-3.1-8b-instant',
          tenantId,
          messages: [
            { role: 'system', content: 'You are an AI assistant in a Morphic UI. Briefly suggest (max 20 words) how you can help with the selected item, or respond with "none" if no help needed.' },
            { role: 'user', content: `User focused on: ${JSON.stringify(value)}` },
          ],
          maxTokens: 50,
          temperature: 0.5,
        });

        const suggestion = response.content?.trim();
        if (suggestion && suggestion.toLowerCase() !== 'none') {
          this.emit(sessionId, {
            type: 'ai_reaction',
            reaction: {
              id: uuidv4(),
              type: 'suggest',
              payload: { message: suggestion },
              priority: 'low',
            },
          });
        }
      } catch (error) {
        // Fallback to basic suggestion
        this.emit(sessionId, {
          type: 'ai_reaction',
          reaction: {
            id: uuidv4(),
            type: 'suggest',
            payload: { message: 'I can help analyze this item.' },
            priority: 'low',
          },
        });
      }
    }
  }

  private async triggerPreCognition(
    session: RealityEngineSession,
    currentLayout: MorphicLayout | null
  ): Promise<void> {
    if (!session.config.preCognitionEnabled) return;

    const predictions = await preCognitionService.predictNextIntents(
      session.tenantId,
      session.userId,
      session.id,
      [], // Would pass actual conversation history
      currentLayout
    );

    await preCognitionService.preComputeSolutions(
      session.tenantId,
      session.userId,
      session.id,
      predictions
    );
  }

  private mapRowToSession(row: Record<string, unknown>): RealityEngineSession {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string,
      conversationId: row.conversation_id as string,
      morphicSession: JSON.parse((row.morphic_session as string) || '{}'),
      activeTimeline: { id: row.active_timeline_id as string } as any,
      activeBranch: { id: row.active_branch_id as string } as any,
      preCognitionQueue: { sessionId: row.id as string, predictions: [], maxSize: 3, computeBudgetMs: 5000, lastRefresh: new Date() },
      config: JSON.parse((row.config as string) || '{}'),
      metrics: JSON.parse((row.metrics as string) || '{}'),
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

export const realityEngineService = new RealityEngineService();
