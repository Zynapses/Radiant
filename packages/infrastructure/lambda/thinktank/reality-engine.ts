/**
 * Reality Engine API Handler
 * 
 * The Reality Engine powers Think Tank's supernatural capabilities:
 * - Morphic UI: Interface that shapeshifts to user intent
 * - Reality Scrubber: Time travel for logic and state
 * - Quantum Futures: Parallel reality branching
 * - Pre-Cognition: Speculative execution
 * 
 * @module api/thinktank/reality-engine
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  realityEngineService,
  realityScrubberService,
  quantumFuturesService,
  preCognitionService,
} from '../shared/services/reality-engine';

interface RequestContext {
  tenantId: string;
  userId: string;
}

function getContext(event: APIGatewayProxyEvent): RequestContext {
  const tenantId = event.requestContext.authorizer?.tenantId || 
    event.headers['x-tenant-id'] || '';
  const userId = event.requestContext.authorizer?.userId || 
    event.headers['x-user-id'] || '';
  return { tenantId, userId };
}

function success(data: unknown): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}

function error(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message }),
  };
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { httpMethod, path, body } = event;
  const context = getContext(event);
  const parsedBody = body ? JSON.parse(body) : {};

  try {
    // =========================================================================
    // SESSION MANAGEMENT
    // =========================================================================

    // POST /reality-engine/session - Initialize a new Reality Engine session
    if (httpMethod === 'POST' && path.endsWith('/session')) {
      const { conversationId, config } = parsedBody;
      
      const response = await realityEngineService.initialize({
        tenantId: context.tenantId,
        userId: context.userId,
        conversationId,
        config,
      });

      return success({
        success: true,
        session: response.session,
        initialSnapshot: response.initialSnapshot,
        message: 'Reality Engine initialized. The Morphic Surface awaits.',
      });
    }

    // GET /reality-engine/session/:sessionId - Get session state
    if (httpMethod === 'GET' && path.includes('/session/')) {
      const sessionId = path.split('/session/')[1];
      const session = await realityEngineService.getSession(sessionId);
      
      if (!session) {
        return error(404, 'Session not found');
      }

      return success({ session });
    }

    // =========================================================================
    // MORPHIC UI
    // "Stop hunting for the right tool. Radiant is a Morphic Surface that shapeshifts instantly."
    // =========================================================================

    // POST /reality-engine/morph - Morph the interface
    if (httpMethod === 'POST' && path.endsWith('/morph')) {
      const { sessionId, intent, prompt, targetComponents, preserveState } = parsedBody;
      
      const response = await realityEngineService.morph({
        sessionId,
        intent,
        prompt,
        targetComponents,
        preserveState,
      });

      return success({
        ...response,
        message: response.wasPreCognized 
          ? '✨ Pre-Cognition: This was ready before you asked.'
          : `🔄 Morphed to ${response.layout.type} layout in ${response.transitionDurationMs}ms`,
      });
    }

    // POST /reality-engine/dissolve - Dissolve morphed interface
    if (httpMethod === 'POST' && path.endsWith('/dissolve')) {
      const { sessionId } = parsedBody;
      await realityEngineService.dissolve(sessionId);
      
      return success({
        success: true,
        message: 'Interface dissolved. Ready for the next transformation.',
      });
    }

    // POST /reality-engine/ghost - Handle Ghost State update
    if (httpMethod === 'POST' && path.endsWith('/ghost')) {
      const { sessionId, key, value } = parsedBody;
      await realityEngineService.handleGhostUpdate(sessionId, key, value);
      
      return success({
        success: true,
        message: 'Ghost State updated. AI context synchronized.',
      });
    }

    // =========================================================================
    // REALITY SCRUBBER
    // "We replaced 'Undo' with Time Travel."
    // =========================================================================

    // POST /reality-engine/scrub - Scrub reality to a point in time
    if (httpMethod === 'POST' && path.endsWith('/scrub')) {
      const { sessionId, targetSnapshotId, targetPosition, targetTimestamp } = parsedBody;
      
      const snapshot = await realityEngineService.scrubReality(
        sessionId,
        targetSnapshotId,
        targetPosition
      );

      return success({
        success: true,
        snapshot,
        message: `⏪ Reality scrubbed to ${snapshot.timestamp.toISOString()}`,
      });
    }

    // POST /reality-engine/bookmark - Create a bookmark
    if (httpMethod === 'POST' && path.endsWith('/bookmark')) {
      const { sessionId, label } = parsedBody;
      const snapshot = await realityScrubberService.createBookmark(sessionId, label);
      
      return success({
        success: true,
        snapshot,
        message: `🔖 Bookmark "${label}" created at ${snapshot.timestamp.toISOString()}`,
      });
    }

    // GET /reality-engine/timeline/:sessionId - Get timeline visualization
    if (httpMethod === 'GET' && path.includes('/timeline/')) {
      const sessionId = path.split('/timeline/')[1];
      const visualization = await realityEngineService.getTimelineVisualization(sessionId);
      
      return success({
        timeline: visualization.timeline,
        branches: visualization.branches,
        thumbnails: Object.fromEntries(visualization.thumbnails),
      });
    }

    // GET /reality-engine/bookmarks/:sessionId - Get all bookmarks
    if (httpMethod === 'GET' && path.includes('/bookmarks/')) {
      const sessionId = path.split('/bookmarks/')[1];
      const bookmarks = await realityScrubberService.getBookmarks(sessionId);
      
      return success({ bookmarks });
    }

    // =========================================================================
    // QUANTUM FUTURES
    // "Why choose one strategy? Split the timeline."
    // =========================================================================

    // POST /reality-engine/split - Split reality into parallel branches
    if (httpMethod === 'POST' && path.endsWith('/split')) {
      const { sessionId, prompt, branchNames, branchDescriptions, autoCompare } = parsedBody;
      
      const response = await quantumFuturesService.createSplit({
        sessionId,
        prompt,
        branchNames,
        branchDescriptions,
        autoCompare,
      });

      return success({
        ...response,
        message: `🔀 Reality split into ${response.branches.length} parallel futures: ${branchNames.join(' vs ')}`,
      });
    }

    // GET /reality-engine/branches/:sessionId - Get all branches
    if (httpMethod === 'GET' && path.includes('/branches/')) {
      const sessionId = path.split('/branches/')[1];
      const branches = await realityEngineService.getBranches(sessionId);
      
      return success({ branches });
    }

    // POST /reality-engine/compare - Compare two branches
    if (httpMethod === 'POST' && path.endsWith('/compare')) {
      const { leftBranchId, rightBranchId } = parsedBody;
      const comparison = await quantumFuturesService.compareBranches(
        leftBranchId,
        rightBranchId
      );
      
      return success({
        comparison,
        message: `📊 Comparing ${comparison.diffHighlights.length} differences between realities`,
      });
    }

    // POST /reality-engine/collapse - Collapse into winning reality
    if (httpMethod === 'POST' && path.endsWith('/collapse')) {
      const { sessionId, winningBranchId, archiveToMemory } = parsedBody;
      
      await realityEngineService.collapseReality(
        sessionId,
        winningBranchId,
        archiveToMemory
      );

      return success({
        success: true,
        message: '🎯 Reality collapsed. The winning timeline is now your primary reality.',
      });
    }

    // POST /reality-engine/branch/interaction - Record branch interaction
    if (httpMethod === 'POST' && path.endsWith('/branch/interaction')) {
      const { branchId } = parsedBody;
      await quantumFuturesService.recordInteraction(branchId);
      
      return success({ success: true });
    }

    // PUT /reality-engine/view-mode - Set comparison view mode
    if (httpMethod === 'PUT' && path.endsWith('/view-mode')) {
      const { sessionId, viewMode } = parsedBody;
      await quantumFuturesService.setViewMode(sessionId, viewMode);
      
      return success({
        success: true,
        message: `View mode set to ${viewMode}`,
      });
    }

    // =========================================================================
    // PRE-COGNITION
    // "Radiant answers before you ask."
    // =========================================================================

    // GET /reality-engine/precognition/:sessionId - Get pre-cognition analytics
    if (httpMethod === 'GET' && path.includes('/precognition/')) {
      const sessionId = path.split('/precognition/')[1];
      const analytics = await realityEngineService.getPreCognitionAnalytics(sessionId);
      
      return success({
        analytics,
        telepathyScore: `${Math.round(analytics.hitRate * 100)}%`,
        message: analytics.hitRate > 0.5 
          ? '🔮 Pre-Cognition is reading your mind effectively!'
          : '🧠 Pre-Cognition is learning your patterns...',
      });
    }

    // POST /reality-engine/precognition/cleanup - Clean up expired predictions
    if (httpMethod === 'POST' && path.endsWith('/precognition/cleanup')) {
      const { sessionId } = parsedBody;
      const deletedCount = await preCognitionService.cleanupExpired(sessionId);
      
      return success({
        success: true,
        deletedCount,
        message: `Cleaned up ${deletedCount} expired predictions`,
      });
    }

    // =========================================================================
    // EJECT
    // "Zero-risk prototyping → Production-ready application"
    // =========================================================================

    // POST /reality-engine/eject - Eject to standalone app
    if (httpMethod === 'POST' && path.endsWith('/eject')) {
      const { sessionId, branchId, framework, options } = parsedBody;
      
      // Import the eject service from liquid-interface (it handles code generation)
      const { ejectService } = await import('../shared/services/liquid-interface/index.js');
      
      // Get current session and layout
      const session = await realityEngineService.getSession(sessionId);
      if (!session) {
        return error(404, 'Session not found');
      }

      // Use the liquid interface eject service
      const response = await ejectService.eject({
        sessionId,
        options: {
          projectName: options?.projectName || 'my-morphic-app',
          includeDatabase: options?.includeDatabase ?? true,
          includeAI: options?.includeAI ?? true,
          deployTarget: options?.deployTarget,
        },
      } as any);

      return success({
        ...response,
        message: `🚀 Ejected to ${framework || 'Next.js'} project with ${(response as any).totalFiles || 0} files`,
      });
    }

    // =========================================================================
    // METRICS
    // =========================================================================

    // GET /reality-engine/metrics/:sessionId - Get session metrics
    if (httpMethod === 'GET' && path.includes('/metrics/')) {
      const sessionId = path.split('/metrics/')[1];
      const session = await realityEngineService.getSession(sessionId);
      
      if (!session) {
        return error(404, 'Session not found');
      }

      return success({
        metrics: session.metrics,
        summary: {
          totalTransformations: session.metrics.totalMorphs,
          timeTravel: {
            scrubs: session.metrics.totalScrubs,
            avgTime: `${session.metrics.avgScrubTimeMs}ms`,
          },
          quantumFutures: {
            branches: session.metrics.totalBranches,
          },
          preCognition: {
            hits: session.metrics.preCognitionHits,
            misses: session.metrics.preCognitionMisses,
            accuracy: session.metrics.preCognitionHits + session.metrics.preCognitionMisses > 0
              ? `${Math.round(session.metrics.preCognitionHits / (session.metrics.preCognitionHits + session.metrics.preCognitionMisses) * 100)}%`
              : 'N/A',
          },
        },
      });
    }

    // Unknown route
    return error(404, `Unknown Reality Engine endpoint: ${httpMethod} ${path}`);

  } catch (err) {
    console.error('Reality Engine error:', err);
    return error(500, err instanceof Error ? err.message : 'Internal server error');
  }
}
