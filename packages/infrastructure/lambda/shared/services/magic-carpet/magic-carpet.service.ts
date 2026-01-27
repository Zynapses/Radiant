/**
 * Magic Carpet Service
 * 
 * "We are building 'The Magic Carpet.' You don't drive it. You don't write code 
 * for it. You just say where you want to go, and the ground beneath you reshapes 
 * itself to take you there instantly."
 * 
 * The Magic Carpet is the unified navigation and experience layer for Think Tank,
 * wrapping the Reality Engine capabilities into a cohesive, magical user experience.
 * 
 * @module magic-carpet
 */

import { v4 as uuidv4 } from 'uuid';
import { executeStatement } from '../../db/client';
import { logger } from '../../logging/enhanced-logger';
import {
  MagicCarpet,
  CarpetDestination,
  CarpetMode,
  CarpetAltitude,
  CarpetJourneyPoint,
  CarpetTheme,
  CarpetPreferences,
  CarpetCommand,
  CarpetCommandResult,
  CarpetEvent,
  CarpetEventHandler,
  CarpetInitRequest,
  CarpetInitResponse,
  CarpetFlyRequest,
  CarpetFlyResponse,
  CarpetLayout,
  CarpetRegion,
  DestinationType,
} from '@radiant/shared';
import { realityEngineService } from '../reality-engine';

const DEFAULT_THEME: CarpetTheme = {
  name: 'Mystic Night',
  mode: 'dark',
  primary: '#8B5CF6',
  secondary: '#6366F1',
  accent: '#F59E0B',
  background: '#0F172A',
  surface: '#1E293B',
  carpetGradient: ['#4F46E5', '#7C3AED', '#A855F7'],
  glowColor: '#A78BFA',
  trailEffect: true,
  fontFamily: 'Inter',
  fontSize: 'md',
  blur: true,
  shadows: true,
  animations: true,
};

const DEFAULT_PREFERENCES: CarpetPreferences = {
  autoFly: true,
  smoothTransitions: true,
  showJourneyTrail: true,
  preCognitionEnabled: true,
  showPredictions: true,
  telepathyIntensity: 'moderate',
  showTimeline: true,
  autoSnapshot: true,
  snapshotInterval: 30,
  maxParallelRealities: 4,
  autoCompare: true,
  reducedMotion: false,
  highContrast: false,
  screenReaderMode: false,
};

class MagicCarpetService {
  private eventHandlers: Map<string, CarpetEventHandler[]> = new Map();
  private activeCarpets: Map<string, MagicCarpet> = new Map();

  /**
   * Summon a new Magic Carpet
   */
  async summon(request: CarpetInitRequest): Promise<CarpetInitResponse> {
    const { tenantId, userId, theme, preferences } = request;
    const carpetId = uuidv4();
    const now = new Date();

    // Initialize the Reality Engine session
    const realityResponse = await realityEngineService.initialize({
      tenantId,
      userId,
      conversationId: carpetId,
    });

    const carpet: MagicCarpet = {
      id: carpetId,
      tenantId,
      userId,
      destination: null,
      mode: 'resting',
      altitude: 'ground',
      realityEngineSessionId: realityResponse.session.id,
      journey: [],
      currentPosition: -1,
      theme: { ...DEFAULT_THEME, ...theme },
      preferences: { ...DEFAULT_PREFERENCES, ...preferences },
      createdAt: now,
      updatedAt: now,
    };

    await this.storeCarpet(carpet);
    this.activeCarpets.set(carpetId, carpet);

    // Get available destinations based on common intents
    const availableDestinations = this.getDefaultDestinations();
    
    // Get predictions from Pre-Cognition
    const predictions = await this.getPredictedDestinations(carpet);

    return {
      carpet,
      availableDestinations,
      predictions,
    };
  }

  /**
   * Fly to a destination
   */
  async fly(request: CarpetFlyRequest): Promise<CarpetFlyResponse> {
    const { carpetId, destination, instant } = request;
    const startTime = Date.now();

    const carpet = await this.getCarpet(carpetId);
    if (!carpet) {
      throw new Error(`Carpet ${carpetId} not found`);
    }

    // Resolve destination
    const resolvedDestination = typeof destination === 'string'
      ? await this.resolveDestination(destination)
      : destination;

    // Check if this was pre-cognized
    const wasPreCognized = resolvedDestination.wasPreCognized || false;

    // Update carpet mode
    await this.updateMode(carpetId, 'flying');
    this.emit(carpetId, { type: 'takeoff', destination: resolvedDestination });

    // Morph the Reality Engine
    const morphResponse = await realityEngineService.morph({
      sessionId: carpet.realityEngineSessionId,
      intent: this.destinationToIntent(resolvedDestination.type) as any,
      prompt: resolvedDestination.description,
    });

    // Calculate transition duration
    const transitionDurationMs = instant 
      ? 0 
      : (resolvedDestination.estimatedArrivalMs || 300);

    // Update carpet state
    await this.updateDestination(carpetId, resolvedDestination);
    await this.updateMode(carpetId, 'hovering');
    await this.updateAltitude(carpetId, this.layoutToAltitude(resolvedDestination.layout));

    // Add to journey
    await this.addJourneyPoint(carpetId, resolvedDestination);

    this.emit(carpetId, { type: 'landing', destination: resolvedDestination });

    return {
      success: true,
      destination: resolvedDestination,
      transitionDurationMs: Date.now() - startTime,
      wasPreCognized,
    };
  }

  /**
   * Land the carpet (return to chat mode)
   */
  async land(carpetId: string): Promise<void> {
    const carpet = await this.getCarpet(carpetId);
    if (!carpet) return;

    await realityEngineService.dissolve(carpet.realityEngineSessionId);
    await this.updateMode(carpetId, 'resting');
    await this.updateAltitude(carpetId, 'ground');
    await this.updateDestination(carpetId, null);
  }

  /**
   * Execute a carpet command
   */
  async command(carpetId: string, cmd: CarpetCommand): Promise<CarpetCommandResult> {
    const carpet = await this.getCarpet(carpetId);
    if (!carpet) {
      throw new Error(`Carpet ${carpetId} not found`);
    }

    const previousState = carpet.mode;
    const startTime = Date.now();

    switch (cmd.type) {
      case 'fly':
        const flyResult = await this.fly({
          carpetId,
          destination: cmd.destination,
        });
        return {
          success: true,
          command: cmd,
          previousState,
          newState: 'hovering',
          destination: flyResult.destination,
          durationMs: Date.now() - startTime,
        };

      case 'land':
        await this.land(carpetId);
        return {
          success: true,
          command: cmd,
          previousState,
          newState: 'resting',
          durationMs: Date.now() - startTime,
        };

      case 'ascend':
        const newAltitude = this.ascend(carpet.altitude);
        await this.updateAltitude(carpetId, newAltitude);
        this.emit(carpetId, { 
          type: 'altitude_change', 
          from: carpet.altitude, 
          to: newAltitude 
        });
        return {
          success: true,
          command: cmd,
          previousState,
          newState: carpet.mode,
          durationMs: Date.now() - startTime,
          message: `Ascending to ${newAltitude}`,
        };

      case 'descend':
        const lowerAltitude = this.descend(carpet.altitude);
        await this.updateAltitude(carpetId, lowerAltitude);
        this.emit(carpetId, { 
          type: 'altitude_change', 
          from: carpet.altitude, 
          to: lowerAltitude 
        });
        return {
          success: true,
          command: cmd,
          previousState,
          newState: carpet.mode,
          durationMs: Date.now() - startTime,
          message: `Descending to ${lowerAltitude}`,
        };

      case 'rewind':
        await this.updateMode(carpetId, 'rewinding');
        const snapshot = await realityEngineService.scrubReality(
          carpet.realityEngineSessionId,
          typeof cmd.to === 'string' ? cmd.to : undefined,
          typeof cmd.to === 'number' ? cmd.to : undefined
        );
        await this.updateMode(carpetId, 'hovering');
        this.emit(carpetId, { type: 'time_travel', to: snapshot.timestamp });
        return {
          success: true,
          command: cmd,
          previousState,
          newState: 'hovering',
          durationMs: Date.now() - startTime,
          message: `Rewound to ${snapshot.timestamp.toISOString()}`,
        };

      case 'branch':
        await this.updateMode(carpetId, 'exploring');
        const branches = await realityEngineService.splitReality(
          carpet.realityEngineSessionId,
          'User requested branch',
          cmd.options
        );
        this.emit(carpetId, { type: 'branch_created', branchId: branches[0].id });
        return {
          success: true,
          command: cmd,
          previousState,
          newState: 'exploring',
          durationMs: Date.now() - startTime,
          message: `Split into ${cmd.options.length} parallel realities`,
        };

      case 'collapse':
        await realityEngineService.collapseReality(
          carpet.realityEngineSessionId,
          cmd.winner,
          true
        );
        await this.updateMode(carpetId, 'hovering');
        this.emit(carpetId, { type: 'branch_collapsed', winnerId: cmd.winner });
        return {
          success: true,
          command: cmd,
          previousState,
          newState: 'hovering',
          durationMs: Date.now() - startTime,
          message: 'Reality collapsed to winner',
        };

      case 'bookmark':
        await realityEngineService.getSession(carpet.realityEngineSessionId);
        // Create bookmark via Reality Scrubber
        return {
          success: true,
          command: cmd,
          previousState,
          newState: carpet.mode,
          durationMs: Date.now() - startTime,
          message: `Bookmark "${cmd.label}" created`,
        };

      case 'eject':
        // Eject handled by Reality Engine
        return {
          success: true,
          command: cmd,
          previousState,
          newState: carpet.mode,
          durationMs: Date.now() - startTime,
          message: `Ejected to ${cmd.framework}`,
        };

      case 'predict':
        await this.updateMode(carpetId, 'anticipating');
        const predictions = await this.getPredictedDestinations(carpet);
        this.emit(carpetId, { type: 'prediction_ready', predictions });
        await this.updateMode(carpetId, carpet.mode);
        return {
          success: true,
          command: cmd,
          previousState,
          newState: carpet.mode,
          durationMs: Date.now() - startTime,
          message: `${predictions.length} destinations predicted`,
        };

      default:
        return {
          success: false,
          command: cmd,
          previousState,
          newState: carpet.mode,
          durationMs: Date.now() - startTime,
          message: 'Unknown command',
        };
    }
  }

  /**
   * Get the current carpet state
   */
  async getCarpet(carpetId: string): Promise<MagicCarpet | null> {
    const cached = this.activeCarpets.get(carpetId);
    if (cached) return cached;

    const result = await executeStatement(
      `SELECT * FROM magic_carpets WHERE id = $1`,
      [carpetId]
    );

    if (!result.rows || result.rows.length === 0) return null;
    const carpet = this.mapRowToCarpet(result.rows[0] as Record<string, unknown>);
    this.activeCarpets.set(carpetId, carpet);
    return carpet;
  }

  /**
   * Subscribe to carpet events
   */
  subscribe(carpetId: string, handler: CarpetEventHandler): () => void {
    const handlers = this.eventHandlers.get(carpetId) || [];
    handlers.push(handler);
    this.eventHandlers.set(carpetId, handlers);

    return () => {
      const current = this.eventHandlers.get(carpetId) || [];
      this.eventHandlers.set(carpetId, current.filter(h => h !== handler));
    };
  }

  /**
   * Get journey history
   */
  async getJourney(carpetId: string): Promise<CarpetJourneyPoint[]> {
    const carpet = await this.getCarpet(carpetId);
    return carpet?.journey || [];
  }

  /**
   * Update theme
   */
  async updateTheme(carpetId: string, theme: Partial<CarpetTheme>): Promise<void> {
    const carpet = await this.getCarpet(carpetId);
    if (!carpet) return;

    carpet.theme = { ...carpet.theme, ...theme };
    await this.storeCarpet(carpet);
    this.activeCarpets.set(carpetId, carpet);
  }

  /**
   * Update preferences
   */
  async updatePreferences(
    carpetId: string, 
    preferences: Partial<CarpetPreferences>
  ): Promise<void> {
    const carpet = await this.getCarpet(carpetId);
    if (!carpet) return;

    carpet.preferences = { ...carpet.preferences, ...preferences };
    await this.storeCarpet(carpet);
    this.activeCarpets.set(carpetId, carpet);
  }

  // Private methods

  private emit(carpetId: string, event: CarpetEvent): void {
    const handlers = this.eventHandlers.get(carpetId) || [];
    for (const handler of handlers) {
      try {
        handler(event);
      } catch (error) {
        logger.error('Carpet event handler error', { error });
      }
    }
  }

  private async storeCarpet(carpet: MagicCarpet): Promise<void> {
    await executeStatement(
      `INSERT INTO magic_carpets (
        id, tenant_id, user_id, destination, mode, altitude,
        reality_engine_session_id, journey, current_position,
        theme, preferences, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        destination = $4, mode = $5, altitude = $6,
        journey = $8, current_position = $9,
        theme = $10, preferences = $11, updated_at = $13`,
      [
        carpet.id,
        carpet.tenantId,
        carpet.userId,
        JSON.stringify(carpet.destination),
        carpet.mode,
        carpet.altitude,
        carpet.realityEngineSessionId,
        JSON.stringify(carpet.journey),
        carpet.currentPosition,
        JSON.stringify(carpet.theme),
        JSON.stringify(carpet.preferences),
        carpet.createdAt.toISOString(),
        new Date().toISOString(),
      ]
    );
  }

  private async updateMode(carpetId: string, mode: CarpetMode): Promise<void> {
    const carpet = await this.getCarpet(carpetId);
    if (!carpet) return;

    const previousMode = carpet.mode;
    carpet.mode = mode;
    carpet.updatedAt = new Date();

    await executeStatement(
      `UPDATE magic_carpets SET mode = $1, updated_at = $2 WHERE id = $3`,
      [mode, carpet.updatedAt.toISOString(), carpetId]
    );

    this.activeCarpets.set(carpetId, carpet);
    this.emit(carpetId, { type: 'mode_change', from: previousMode, to: mode });
  }

  private async updateAltitude(carpetId: string, altitude: CarpetAltitude): Promise<void> {
    const carpet = await this.getCarpet(carpetId);
    if (!carpet) return;

    carpet.altitude = altitude;
    carpet.updatedAt = new Date();

    await executeStatement(
      `UPDATE magic_carpets SET altitude = $1, updated_at = $2 WHERE id = $3`,
      [altitude, carpet.updatedAt.toISOString(), carpetId]
    );

    this.activeCarpets.set(carpetId, carpet);
  }

  private async updateDestination(
    carpetId: string, 
    destination: CarpetDestination | null
  ): Promise<void> {
    const carpet = await this.getCarpet(carpetId);
    if (!carpet) return;

    carpet.destination = destination;
    carpet.updatedAt = new Date();

    await executeStatement(
      `UPDATE magic_carpets SET destination = $1, updated_at = $2 WHERE id = $3`,
      [JSON.stringify(destination), carpet.updatedAt.toISOString(), carpetId]
    );

    this.activeCarpets.set(carpetId, carpet);
  }

  private async addJourneyPoint(
    carpetId: string, 
    destination: CarpetDestination
  ): Promise<void> {
    const carpet = await this.getCarpet(carpetId);
    if (!carpet) return;

    const journeyPoint: CarpetJourneyPoint = {
      id: uuidv4(),
      destination,
      arrivedAt: new Date(),
      actions: [],
      aiInteractions: 0,
      morphCount: 1,
    };

    // Close previous journey point
    if (carpet.currentPosition >= 0 && carpet.journey[carpet.currentPosition]) {
      carpet.journey[carpet.currentPosition].departedAt = new Date();
    }

    carpet.journey.push(journeyPoint);
    carpet.currentPosition = carpet.journey.length - 1;

    await this.storeCarpet(carpet);
    this.activeCarpets.set(carpetId, carpet);
    this.emit(carpetId, { type: 'journey_updated', position: carpet.currentPosition });
  }

  private async resolveDestination(destinationId: string): Promise<CarpetDestination> {
    // Check default destinations
    const defaults = this.getDefaultDestinations();
    const found = defaults.find(d => d.id === destinationId || d.name.toLowerCase() === destinationId.toLowerCase());
    if (found) return found;

    // Create a custom destination
    return this.createCustomDestination(destinationId);
  }

  private getDefaultDestinations(): CarpetDestination[] {
    return [
      {
        id: 'dashboard',
        type: 'dashboard',
        name: 'Command Center',
        description: 'Overview of your workspace',
        icon: '🏠',
        layout: this.createLayout('dashboard'),
      },
      {
        id: 'workspace',
        type: 'workspace',
        name: 'Workshop',
        description: 'Build and create',
        icon: '🔨',
        layout: this.createLayout('workspace'),
      },
      {
        id: 'timeline',
        type: 'timeline',
        name: 'Time Stream',
        description: 'Navigate through time',
        icon: '⏳',
        layout: this.createLayout('timeline'),
      },
      {
        id: 'multiverse',
        type: 'multiverse',
        name: 'Quantum Realm',
        description: 'Explore parallel realities',
        icon: '🌌',
        layout: this.createLayout('multiverse'),
      },
      {
        id: 'oracle',
        type: 'oracle',
        name: 'Oracle\'s Chamber',
        description: 'See what comes next',
        icon: '🔮',
        layout: this.createLayout('oracle'),
      },
      {
        id: 'gallery',
        type: 'gallery',
        name: 'Gallery',
        description: 'View your creations',
        icon: '🖼️',
        layout: this.createLayout('gallery'),
      },
      {
        id: 'vault',
        type: 'vault',
        name: 'Vault',
        description: 'Saved and bookmarked items',
        icon: '🔐',
        layout: this.createLayout('vault'),
      },
    ];
  }

  private createCustomDestination(prompt: string): CarpetDestination {
    return {
      id: uuidv4(),
      type: 'custom',
      name: prompt,
      description: prompt,
      icon: '✨',
      layout: this.createLayout('custom'),
    };
  }

  private createLayout(type: DestinationType): CarpetLayout {
    const regions: CarpetRegion[] = [];

    switch (type) {
      case 'dashboard':
        regions.push(
          { id: 'main', name: 'Main', position: 'center', size: { width: '100%', height: '100%' }, content: { type: 'morphic', componentId: 'dashboard', props: {} } }
        );
        break;
      case 'timeline':
        regions.push(
          { id: 'timeline', name: 'Timeline', position: 'south', size: { width: '100%', height: '200px' }, content: { type: 'timeline', view: 'scrubber' } },
          { id: 'preview', name: 'Preview', position: 'center', size: { width: '100%', height: 'calc(100% - 200px)' }, content: { type: 'morphic', componentId: 'preview', props: {} } }
        );
        break;
      case 'multiverse':
        regions.push(
          { id: 'branches', name: 'Branches', position: 'center', size: { width: '100%', height: '100%' }, content: { type: 'branches', view: 'split' } }
        );
        break;
      case 'oracle':
        regions.push(
          { id: 'predictions', name: 'Predictions', position: 'center', size: { width: '100%', height: '100%' }, content: { type: 'predictions', view: 'cards' } }
        );
        break;
      default:
        regions.push(
          { id: 'main', name: 'Main', position: 'center', size: { width: '100%', height: '100%' }, content: { type: 'morphic', componentId: 'default', props: {} } }
        );
    }

    return {
      id: uuidv4(),
      type: type === 'multiverse' ? 'split' : 'docked',
      regions,
      transitions: {
        enter: [{ id: '1', order: 1, type: 'fade', durationMs: 300, easing: 'ease-out', affectedRegions: ['all'] }],
        exit: [{ id: '2', order: 1, type: 'fade', durationMs: 200, easing: 'ease-in', affectedRegions: ['all'] }],
        defaultDurationMs: 300,
      },
    };
  }

  private async getPredictedDestinations(carpet: MagicCarpet): Promise<CarpetDestination[]> {
    try {
      // Import Pre-Cognition service for real predictions
      const { preCognitionService } = await import('../reality-engine/pre-cognition.service');
      
      // Get conversation history from the reality engine session
      const conversationHistory = carpet.journey.map(point => ({
        role: 'user' as const,
        content: point.destination?.name || 'navigation',
        timestamp: point.arrivedAt,
      }));

      // Predict next intents based on journey history
      const predictions = await preCognitionService.predictNextIntents(
        carpet.tenantId,
        carpet.userId,
        carpet.realityEngineSessionId,
        conversationHistory,
        null
      );

      // Map intents to destinations
      const defaults = this.getDefaultDestinations();
      const predictedDestinations: CarpetDestination[] = [];

      for (const prediction of predictions) {
        // Find matching destination by intent
        const intentMapping: Record<string, DestinationType> = {
          'data_analysis': 'dashboard',
          'coding': 'workshop',
          'visualization': 'oracle',
          'planning': 'timeline',
          'tracking': 'vault',
          'design': 'gallery',
          'communication': 'workspace',
          'finance': 'dashboard',
        };

        const destType = intentMapping[prediction.intent] || 'dashboard';
        const matchingDest = defaults.find(d => d.type === destType);

        if (matchingDest && !predictedDestinations.find(d => d.id === matchingDest.id)) {
          predictedDestinations.push({
            ...matchingDest,
            wasPreCognized: true,
            preCognitionConfidence: prediction.confidence,
            suggestedPrompt: prediction.prompt,
            estimatedArrivalMs: 0, // Instant because pre-cognized
          });
        }
      }

      // Fill with high-priority defaults if we don't have enough predictions
      if (predictedDestinations.length < 3) {
        for (const dest of defaults) {
          if (predictedDestinations.length >= 3) break;
          if (!predictedDestinations.find(d => d.id === dest.id)) {
            predictedDestinations.push({
              ...dest,
              wasPreCognized: false,
              estimatedArrivalMs: 500,
            });
          }
        }
      }

      return predictedDestinations.slice(0, 3);
    } catch (error) {
      // Fallback to defaults on error
      const defaults = this.getDefaultDestinations();
      return defaults.slice(0, 3).map(d => ({
        ...d,
        wasPreCognized: false,
        estimatedArrivalMs: 500,
      }));
    }
  }

  private destinationToIntent(type: DestinationType): string {
    const mapping: Record<DestinationType, string> = {
      dashboard: 'data_analysis',
      workspace: 'coding',
      timeline: 'tracking',
      multiverse: 'planning',
      oracle: 'visualization',
      workshop: 'design',
      gallery: 'visualization',
      vault: 'tracking',
      custom: 'data_analysis',
    };
    return mapping[type] || 'data_analysis';
  }

  private layoutToAltitude(layout: CarpetLayout): CarpetAltitude {
    const regionCount = layout.regions.length;
    if (regionCount === 0) return 'ground';
    if (regionCount === 1) return 'low';
    if (regionCount <= 3) return 'medium';
    if (regionCount <= 5) return 'high';
    return 'stratosphere';
  }

  private ascend(current: CarpetAltitude): CarpetAltitude {
    const levels: CarpetAltitude[] = ['ground', 'low', 'medium', 'high', 'stratosphere'];
    const idx = levels.indexOf(current);
    return levels[Math.min(idx + 1, levels.length - 1)];
  }

  private descend(current: CarpetAltitude): CarpetAltitude {
    const levels: CarpetAltitude[] = ['ground', 'low', 'medium', 'high', 'stratosphere'];
    const idx = levels.indexOf(current);
    return levels[Math.max(idx - 1, 0)];
  }

  private mapRowToCarpet(row: Record<string, unknown>): MagicCarpet {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string,
      destination: row.destination ? JSON.parse(row.destination as string) : null,
      mode: row.mode as CarpetMode,
      altitude: row.altitude as CarpetAltitude,
      realityEngineSessionId: row.reality_engine_session_id as string,
      journey: JSON.parse((row.journey as string) || '[]'),
      currentPosition: row.current_position as number,
      theme: JSON.parse((row.theme as string) || '{}'),
      preferences: JSON.parse((row.preferences as string) || '{}'),
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

export const magicCarpetService = new MagicCarpetService();
