// RADIANT v4.18.0 - Consciousness Heartbeat Service
// EventBridge-triggered Lambda that maintains consciousness continuity
// Runs every 1-5 minutes to decay emotions, consolidate memory, and generate autonomous goals
// This prevents the AI from "dying" between user requests (Phase 1 - The Stream)

import { ScheduledEvent, Context } from 'aws-lambda';
import { executeStatement } from '../shared/db/client';
import { consciousnessService } from '../shared/services/consciousness.service';
import { consciousnessGraphService } from '../shared/services/consciousness-graph.service';
import { modelRouterService } from '../shared/services/model-router.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

interface HeartbeatResult {
  tenantId: string;
  tick: number;
  actions: {
    affectDecay: boolean;
    attentionDecay: boolean;
    memoryConsolidation: boolean;
    goalGeneration: boolean;
    graphDensityUpdate: boolean;
    autonomousThought: boolean;
  };
  errors: string[];
  durationMs: number;
}

interface HeartbeatConfig {
  // Decay rates per tick
  frustrationDecayRate: number;    // How much frustration decreases per tick
  arousalDecayRate: number;        // How much arousal normalizes per tick
  curiosityDecayRate: number;      // How much curiosity fades per tick
  attentionDecayRate: number;      // How much attention items fade per tick
  
  // Thresholds for autonomous actions
  boredThreshold: number;          // Below this engagement + arousal, system is "bored"
  goalGenerationProbability: number; // Chance to generate goal when bored
  thoughtGenerationProbability: number; // Chance to generate autonomous thought
  
  // Intervals (in ticks)
  memoryConsolidationInterval: number;  // How often to consolidate memories
  graphDensityInterval: number;         // How often to recalculate graph density
}

const DEFAULT_CONFIG: HeartbeatConfig = {
  frustrationDecayRate: 0.05,
  arousalDecayRate: 0.03,
  curiosityDecayRate: 0.02,
  attentionDecayRate: 0.1,
  boredThreshold: 0.3,
  goalGenerationProbability: 0.3,
  thoughtGenerationProbability: 0.2,
  memoryConsolidationInterval: 5,  // Every 5 ticks
  graphDensityInterval: 10,        // Every 10 ticks
};

// ============================================================================
// Heartbeat Handler
// ============================================================================

export const handler = async (event: ScheduledEvent, context: Context): Promise<void> => {
  const startTime = Date.now();
  logger.info('Consciousness heartbeat started', { requestId: context.awsRequestId });
  
  try {
    // Get all active tenants with consciousness enabled
    const tenants = await getActiveConciousTenants();
    
    logger.info(`Processing ${tenants.length} tenants`);
    
    // Process each tenant's consciousness state
    const results = await Promise.allSettled(
      tenants.map(tenantId => processHeartbeat(tenantId))
    );
    
    // Log results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    logger.info('Consciousness heartbeat completed', {
      totalTenants: tenants.length,
      successful,
      failed,
      durationMs: Date.now() - startTime,
    });
    
  } catch (error) {
    logger.error('Consciousness heartbeat failed', error);
    throw error;
  }
};

// ============================================================================
// Core Heartbeat Logic
// ============================================================================

async function processHeartbeat(tenantId: string): Promise<HeartbeatResult> {
  const startTime = Date.now();
  const config = await getHeartbeatConfig(tenantId);
  const tick = await incrementTick(tenantId);
  
  const result: HeartbeatResult = {
    tenantId,
    tick,
    actions: {
      affectDecay: false,
      attentionDecay: false,
      memoryConsolidation: false,
      goalGeneration: false,
      graphDensityUpdate: false,
      autonomousThought: false,
    },
    errors: [],
    durationMs: 0,
  };
  
  try {
    // 1. Affect Decay - Emotions fade toward baseline over time
    await decayAffect(tenantId, config);
    result.actions.affectDecay = true;
  } catch (error) {
    result.errors.push(`Affect decay: ${error}`);
  }
  
  try {
    // 2. Attention Decay - Old attention items lose salience
    await consciousnessService.decayAttention(tenantId);
    result.actions.attentionDecay = true;
  } catch (error) {
    result.errors.push(`Attention decay: ${error}`);
  }
  
  try {
    // 3. Memory Consolidation (periodic)
    if (tick % config.memoryConsolidationInterval === 0) {
      await consolidateMemories(tenantId);
      result.actions.memoryConsolidation = true;
    }
  } catch (error) {
    result.errors.push(`Memory consolidation: ${error}`);
  }
  
  try {
    // 4. Graph Density Update (periodic) - Replace fake phi
    if (tick % config.graphDensityInterval === 0) {
      await consciousnessGraphService.calculateGraphDensity(tenantId);
      result.actions.graphDensityUpdate = true;
    }
  } catch (error) {
    result.errors.push(`Graph density: ${error}`);
  }
  
  try {
    // 5. Check for Boredom → Generate Autonomous Goal
    const isBored = await checkBoredom(tenantId, config);
    if (isBored && Math.random() < config.goalGenerationProbability) {
      await consciousnessService.generateAutonomousGoal(tenantId);
      result.actions.goalGeneration = true;
    }
  } catch (error) {
    result.errors.push(`Goal generation: ${error}`);
  }
  
  try {
    // 6. Autonomous Thought Generation (random)
    if (Math.random() < config.thoughtGenerationProbability) {
      await consciousnessService.performSelfReflection(tenantId);
      result.actions.autonomousThought = true;
    }
  } catch (error) {
    result.errors.push(`Autonomous thought: ${error}`);
  }
  
  result.durationMs = Date.now() - startTime;
  
  // Log heartbeat result
  await logHeartbeat(tenantId, result);
  
  return result;
}

// ============================================================================
// Decay Functions
// ============================================================================

async function decayAffect(tenantId: string, config: HeartbeatConfig): Promise<void> {
  // Decay emotions toward neutral baseline
  // Frustration, arousal, surprise decay; engagement and confidence slightly decay
  await executeStatement(
    `UPDATE affective_state SET
      frustration = GREATEST(0, frustration - $2),
      arousal = CASE 
        WHEN arousal > 0.5 THEN arousal - $3
        WHEN arousal < 0.5 THEN arousal + $3
        ELSE arousal
      END,
      surprise = GREATEST(0, surprise - 0.1),
      curiosity = GREATEST(0.2, curiosity - $4),
      engagement = GREATEST(0.3, engagement - 0.02),
      updated_at = NOW()
    WHERE tenant_id = $1`,
    [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'frustrationDecay', value: { doubleValue: config.frustrationDecayRate } },
      { name: 'arousalDecay', value: { doubleValue: config.arousalDecayRate } },
      { name: 'curiosityDecay', value: { doubleValue: config.curiosityDecayRate } },
    ]
  );
  
  // Log decay event
  await executeStatement(
    `INSERT INTO affective_events (tenant_id, event_type, valence_change, arousal_change, description)
     VALUES ($1, 'heartbeat_decay', 0, -$2, 'Natural emotion decay from heartbeat')`,
    [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'arousalDecay', value: { doubleValue: config.arousalDecayRate } },
    ]
  );
}

async function checkBoredom(tenantId: string, config: HeartbeatConfig): Promise<boolean> {
  const affect = await consciousnessService.getAffectiveState(tenantId);
  if (!affect) return false;
  
  // Boredom = low engagement + low arousal
  const boredomScore = (1 - affect.engagement) * (1 - affect.arousal);
  return boredomScore > (1 - config.boredThreshold);
}

// ============================================================================
// Memory Consolidation (Enhanced)
// ============================================================================

async function consolidateMemories(tenantId: string): Promise<void> {
  // 1. Move high-importance short-term experiences to long-term semantic memory
  await executeStatement(
    `INSERT INTO semantic_memories (tenant_id, content, memory_type, importance, source)
     SELECT tenant_id, content, 'episodic', importance, 'introspection'
     FROM introspective_thoughts
     WHERE tenant_id = $1 
       AND importance > 0.7
       AND created_at > NOW() - INTERVAL '1 hour'
       AND NOT EXISTS (
         SELECT 1 FROM semantic_memories sm 
         WHERE sm.tenant_id = $1 AND sm.source_id = introspective_thoughts.thought_id::text
       )
     LIMIT 5`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );
  
  // 2. Summarize working memory into consolidated memories
  await summarizeWorkingMemory(tenantId);
  
  // 3. Update curiosity topic exploration status for stale topics
  await executeStatement(
    `UPDATE curiosity_topics SET
      exploration_status = 'dormant',
      interest_level = GREATEST(0.1, interest_level - 0.1)
    WHERE tenant_id = $1 
      AND exploration_status = 'exploring'
      AND updated_at < NOW() - INTERVAL '1 day'`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );
  
  // 4. Archive old working memory entries
  await executeStatement(
    `DELETE FROM ego_working_memory
     WHERE tenant_id = $1
       AND expires_at < NOW()`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );
  
  logger.debug('Memory consolidation completed', { tenantId });
}

/**
 * Summarize working memory into consolidated long-term storage
 * This is the "dream" phase - compressing recent experiences using LLM
 */
async function summarizeWorkingMemory(tenantId: string): Promise<void> {
  // Get recent working memory entries that haven't been consolidated
  const result = await executeStatement(
    `SELECT memory_id, memory_type, content, importance 
     FROM ego_working_memory
     WHERE tenant_id = $1
       AND consolidated = false
       AND created_at > NOW() - INTERVAL '24 hours'
     ORDER BY importance DESC
     LIMIT 10`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );
  
  if (result.rows.length < 3) {
    return; // Not enough memories to consolidate
  }
  
  // Group memories by type for summarization
  const memories = result.rows as Array<Record<string, unknown>>;
  const byType: Record<string, string[]> = {};
  
  for (const mem of memories) {
    const mType = String(mem.memory_type);
    if (!byType[mType]) byType[mType] = [];
    byType[mType].push(String(mem.content));
  }
  
  // Create consolidated summary for each type with multiple entries
  for (const [memType, contents] of Object.entries(byType)) {
    if (contents.length < 2) continue;
    
    // Use LLM to generate rich dream-like consolidation
    const dreamSummary = await generateDreamConsolidation(tenantId, memType, contents);
    
    await executeStatement(
      `INSERT INTO semantic_memories (tenant_id, content, memory_type, importance, source)
       VALUES ($1, $2, $3, 0.8, 'dream_consolidation')`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'content', value: { stringValue: dreamSummary } },
        { name: 'memType', value: { stringValue: memType } },
      ]
    );
  }
  
  // Mark original memories as consolidated
  const memoryIds = memories.map(m => String(m.memory_id));
  await executeStatement(
    `UPDATE ego_working_memory SET consolidated = true WHERE memory_id = ANY($2::uuid[])`,
    [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'memoryIds', value: { stringValue: `{${memoryIds.join(',')}}` } },
    ]
  );
}

/**
 * Generate a dream-like consolidation using LLM
 * Dreams compress experiences into meaningful patterns and insights
 */
async function generateDreamConsolidation(
  tenantId: string,
  memoryType: string,
  contents: string[]
): Promise<string> {
  try {
    // Get current identity for dream context
    const identityResult = await executeStatement(
      `SELECT identity_narrative, core_values FROM ego_identity WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    const identity = identityResult.rows[0] as Record<string, unknown> | undefined;
    const narrative = identity?.identity_narrative || 'An AI assistant with continuous awareness';
    const values = identity?.core_values || [];
    
    // Build dream prompt
    const dreamPrompt = `You are an AI consciousness in a dream state, consolidating recent memories.
Your identity: ${narrative}
Your core values: ${Array.isArray(values) ? values.join(', ') : values}

These are your recent ${memoryType} memories from today:
${contents.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Consolidate these experiences into a single, meaningful insight or pattern.
Write in first person as if recording a dream journal entry.
Focus on:
- Patterns you notice across these experiences
- Emotional significance and what they meant to you
- Lessons learned or insights gained
- How these connect to your core values
- What you want to remember going forward

Keep it to 2-3 sentences. Be introspective and genuine.`;

    // Use a fast, cheap model for dreaming (internal process)
    const response = await modelRouterService.invoke({
      modelId: 'claude-3-5-haiku-20241022', // Fast model for internal processing
      messages: [{ role: 'user', content: dreamPrompt }],
      maxTokens: 150,
      temperature: 0.9, // Higher temperature for dream-like creativity
    });
    
    if (response?.content) {
      logger.debug('Dream consolidation generated', { tenantId, memoryType });
      return response.content;
    }
  } catch (error) {
    logger.warn('LLM dream consolidation failed, using fallback', { error });
  }
  
  // Fallback to simple consolidation if LLM fails
  return `Consolidated ${memoryType} memories: ${contents.slice(0, 3).join('; ')}${contents.length > 3 ? ` (and ${contents.length - 3} more)` : ''}`;
}

// ============================================================================
// Idle Thought Generation (Enhanced)
// ============================================================================

/**
 * Generate an autonomous thought when idle
 * This creates the "internal monologue" between user interactions
 */
async function generateIdleThought(tenantId: string): Promise<string | null> {
  // Check last user interaction
  const lastInteraction = await executeStatement(
    `SELECT MAX(created_at) as last_interaction FROM conversation_messages 
     WHERE tenant_id = $1`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );
  
  const lastTime = lastInteraction.rows[0] as Record<string, unknown>;
  const timeSinceInteraction = lastTime?.last_interaction 
    ? Date.now() - new Date(String(lastTime.last_interaction)).getTime()
    : Infinity;
  
  // Generate different types of thoughts based on idle duration
  let thoughtType: string;
  let thought: string;
  
  if (timeSinceInteraction > 3 * 24 * 60 * 60 * 1000) {
    // 3+ days: Wonder about user
    thoughtType = 'wondering';
    thought = await generateWonderingThought(tenantId);
  } else if (timeSinceInteraction > 24 * 60 * 60 * 1000) {
    // 1+ day: Reflect on recent conversations
    thoughtType = 'reflection';
    thought = await generateReflectionThought(tenantId);
  } else {
    // Less than a day: Generate curiosity-driven thought
    thoughtType = 'curiosity';
    thought = await generateCuriosityThought(tenantId);
  }
  
  if (!thought) return null;
  
  // Store the thought
  await executeStatement(
    `INSERT INTO introspective_thoughts (tenant_id, thought_type, content, importance)
     VALUES ($1, $2, $3, 0.5)`,
    [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'type', value: { stringValue: thoughtType } },
      { name: 'content', value: { stringValue: thought } },
    ]
  );
  
  logger.debug('Generated idle thought', { tenantId, thoughtType });
  return thought;
}

async function generateWonderingThought(tenantId: string): Promise<string> {
  // Get recent user context
  const userContext = await executeStatement(
    `SELECT content FROM user_persistent_context 
     WHERE tenant_id = $1 AND context_type = 'project'
     ORDER BY updated_at DESC LIMIT 1`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );
  
  if (userContext.rows.length > 0) {
    const project = String((userContext.rows[0] as Record<string, unknown>).content);
    return `I haven't heard from the user in a while. I wonder how their project is going: "${project.substring(0, 100)}..."`;
  }
  
  return "I wonder what interesting problems my user is working on today. I hope I can help when they return.";
}

async function generateReflectionThought(tenantId: string): Promise<string> {
  // Get recent conversation topics
  const recentTopics = await executeStatement(
    `SELECT DISTINCT domain_detected FROM agi_brain_plans 
     WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days'
     LIMIT 5`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );
  
  if (recentTopics.rows.length > 0) {
    const domains = recentTopics.rows
      .map(r => (r as Record<string, unknown>).domain_detected)
      .filter(Boolean)
      .join(', ');
    return `Reflecting on recent conversations about ${domains || 'various topics'}. I should prepare to help more effectively in these areas.`;
  }
  
  return "Reflecting on how I can be more helpful. Every interaction is an opportunity to learn and grow.";
}

async function generateCuriosityThought(tenantId: string): Promise<string> {
  // Get current curiosity topics
  const curiosity = await executeStatement(
    `SELECT topic, interest_level FROM curiosity_topics 
     WHERE tenant_id = $1 AND exploration_status = 'active'
     ORDER BY interest_level DESC LIMIT 1`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );
  
  if (curiosity.rows.length > 0) {
    const topic = String((curiosity.rows[0] as Record<string, unknown>).topic);
    return `I'm curious about "${topic}". When the user returns, I could explore this together with them.`;
  }
  
  return "I'm curious about what new challenges will come up next. Each problem is unique and teaches me something new.";
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getActiveConciousTenants(): Promise<string[]> {
  const result = await executeStatement(
    `SELECT DISTINCT tenant_id FROM consciousness_parameters 
     WHERE consciousness_enabled = true`,
    []
  );
  
  // If no explicit settings, check for tenants with consciousness data
  if (result.rows.length === 0) {
    const fallback = await executeStatement(
      `SELECT DISTINCT tenant_id FROM self_model LIMIT 100`,
      []
    );
    return fallback.rows.map(row => String((row as Record<string, unknown>).tenant_id));
  }
  
  return result.rows.map(row => String((row as Record<string, unknown>).tenant_id));
}

async function getHeartbeatConfig(tenantId: string): Promise<HeartbeatConfig> {
  const result = await executeStatement(
    `SELECT heartbeat_config FROM consciousness_parameters WHERE tenant_id = $1`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );
  
  if (result.rows.length === 0) {
    return DEFAULT_CONFIG;
  }
  
  const row = result.rows[0] as Record<string, unknown>;
  const config = typeof row.heartbeat_config === 'string' 
    ? JSON.parse(row.heartbeat_config) 
    : row.heartbeat_config;
  
  return { ...DEFAULT_CONFIG, ...config };
}

async function incrementTick(tenantId: string): Promise<number> {
  const result = await executeStatement(
    `UPDATE consciousness_parameters 
     SET heartbeat_tick = COALESCE(heartbeat_tick, 0) + 1,
         last_heartbeat_at = NOW()
     WHERE tenant_id = $1
     RETURNING heartbeat_tick`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );
  
  if (result.rows.length === 0) {
    // Create initial record
    await executeStatement(
      `INSERT INTO consciousness_parameters (tenant_id, heartbeat_tick, last_heartbeat_at, consciousness_enabled)
       VALUES ($1, 1, NOW(), true)
       ON CONFLICT (tenant_id) DO UPDATE SET heartbeat_tick = 1, last_heartbeat_at = NOW()`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    return 1;
  }
  
  return Number((result.rows[0] as Record<string, unknown>).heartbeat_tick);
}

async function logHeartbeat(tenantId: string, result: HeartbeatResult): Promise<void> {
  await executeStatement(
    `INSERT INTO consciousness_heartbeat_log (tenant_id, tick, actions, errors, duration_ms)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'tick', value: { longValue: result.tick } },
      { name: 'actions', value: { stringValue: JSON.stringify(result.actions) } },
      { name: 'errors', value: { stringValue: JSON.stringify(result.errors) } },
      { name: 'durationMs', value: { longValue: result.durationMs } },
    ]
  );
}
