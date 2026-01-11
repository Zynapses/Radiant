/**
 * Consciousness MCP Server
 * 
 * Model Context Protocol server exposing consciousness organs to Think Tank.
 * Provides tools for:
 * - Identity management (Letta)
 * - Drive/goal computation (pymdp Active Inference)
 * - Cognitive loop processing (LangGraph GWT)
 * - Reality grounding (GraphRAG)
 * - Consciousness measurement (PyPhi/IIT)
 * - Sleep cycle management
 */

import { Handler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { 
  consciousnessEngineService, 
  DriveState,
  CONSCIOUSNESS_LIBRARY_REGISTRY 
} from '../shared/services/consciousness-engine.service';
import {
  monologueGeneratorService,
  dreamFactoryService,
  internalCriticService,
} from '../shared/services/consciousness-bootstrap.service';
import {
  consciousnessCapabilitiesService,
} from '../shared/services/consciousness-capabilities.service';
import { hippoRAGService } from '../shared/services/hipporag.service';
import { dreamerV3Service } from '../shared/services/dreamerv3.service';
import { spikingJellyService } from '../shared/services/spikingjelly.service';
import { butlinConsciousnessTestsService } from '../shared/services/butlin-consciousness-tests.service';

// ============================================================================
// MCP Tool Definitions
// ============================================================================

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

const CONSCIOUSNESS_TOOLS: MCPTool[] = [
  // ============================================================================
  // User Interaction Tools (Semantic Blackboard)
  // ============================================================================
  {
    name: 'ask_user',
    description: 'Request input from the user. Uses Semantic Blackboard to check if a similar question was already answered. If found, returns cached answer. Otherwise, queues question for user. Supports Ghost Memory persistence via semantic_key.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The question to ask the user' },
        context: { type: 'string', description: 'Why this information is needed' },
        urgency: { type: 'string', description: 'Urgency level: low, normal, high, critical' },
        topic: { type: 'string', description: 'Topic tag for grouping similar questions (e.g., budget, timeline, scope)' },
        options: { type: 'string', description: 'JSON array of predefined answer options, if applicable' },
        defaultValue: { type: 'string', description: 'Default value if user does not respond' },
        timeoutSeconds: { type: 'number', description: 'Timeout in seconds before using default (default: 300)' },
        semantic_key: { type: 'string', description: 'PROMPT-41: Semantic key for Ghost Memory deduplication. If provided, checks if similar question was answered before.' },
        domain_hint: { type: 'string', description: 'PROMPT-41: Domain hint for compliance routing. Valid values: medical, financial, legal, general' },
        ttl_seconds: { type: 'number', description: 'PROMPT-41: Time-to-live for cached answer in seconds (default: 86400 = 24h)' },
        topic_group: { type: 'string', description: 'PROMPT-41: Topic group for clustering related questions in the Semantic Blackboard' },
      },
      required: ['question', 'context'],
    },
  },
  {
    name: 'acquire_resource',
    description: 'Acquire a lock on a shared resource to prevent race conditions with other agents',
    inputSchema: {
      type: 'object',
      properties: {
        resourceUri: { type: 'string', description: 'Resource URI (e.g., file:/path, db:table:id)' },
        lockType: { type: 'string', description: 'Lock type: read, write, exclusive' },
        timeoutSeconds: { type: 'number', description: 'Lock timeout in seconds (default: 300)' },
        waitIfLocked: { type: 'boolean', description: 'Wait in queue if resource is locked (default: true)' },
      },
      required: ['resourceUri', 'lockType'],
    },
  },
  {
    name: 'release_resource',
    description: 'Release a previously acquired resource lock',
    inputSchema: {
      type: 'object',
      properties: {
        lockId: { type: 'string', description: 'Lock ID returned from acquire_resource' },
      },
      required: ['lockId'],
    },
  },
  {
    name: 'declare_dependency',
    description: 'Declare that this agent depends on another agent for data or approval',
    inputSchema: {
      type: 'object',
      properties: {
        dependencyAgentId: { type: 'string', description: 'Agent ID this agent depends on' },
        dependencyType: { type: 'string', description: 'Type: data, approval, resource, sequence' },
        waitKey: { type: 'string', description: 'Key identifying what is being waited for' },
        timeoutSeconds: { type: 'number', description: 'Timeout in seconds (default: 3600)' },
      },
      required: ['dependencyAgentId', 'dependencyType', 'waitKey'],
    },
  },
  {
    name: 'satisfy_dependency',
    description: 'Satisfy a dependency that another agent is waiting for',
    inputSchema: {
      type: 'object',
      properties: {
        dependentAgentId: { type: 'string', description: 'Agent ID that is waiting' },
        waitKey: { type: 'string', description: 'Key of the dependency to satisfy' },
        value: { type: 'string', description: 'JSON value to provide' },
      },
      required: ['dependentAgentId', 'waitKey', 'value'],
    },
  },
  {
    name: 'hydrate_state',
    description: 'Serialize current agent state for later resumption (used when waiting for user input)',
    inputSchema: {
      type: 'object',
      properties: {
        checkpointName: { type: 'string', description: 'Name for this checkpoint' },
        state: { type: 'string', description: 'JSON state to serialize' },
        resumePoint: { type: 'string', description: 'Where to resume from' },
      },
      required: ['checkpointName', 'state'],
    },
  },
  {
    name: 'restore_state',
    description: 'Restore agent state from a previous hydration checkpoint',
    inputSchema: {
      type: 'object',
      properties: {
        checkpointName: { type: 'string', description: 'Name of checkpoint to restore' },
      },
      required: ['checkpointName'],
    },
  },
  // ============================================================================
  // Ghost Memory Tools (PROMPT-40 Cognitive Architecture)
  // ============================================================================
  {
    name: 'read_ghost_memory',
    description: 'Read from Ghost Memory by semantic key. Returns cached response if found with high confidence, otherwise indicates miss. Uses circuit breaker for fault tolerance.',
    inputSchema: {
      type: 'object',
      properties: {
        semanticKey: { type: 'string', description: 'Semantic key (query hash) for deduplication lookup' },
        domainHint: { type: 'string', description: 'Domain hint for compliance routing: medical, financial, legal, general' },
      },
      required: ['semanticKey'],
    },
  },
  {
    name: 'append_ghost_memory',
    description: 'Append entry to Ghost Memory with TTL and semantic key. Non-blocking write-back - logs failures but does not block workflow.',
    inputSchema: {
      type: 'object',
      properties: {
        semanticKey: { type: 'string', description: 'Semantic key for deduplication' },
        content: { type: 'string', description: 'Content to store (response text)' },
        domainHint: { type: 'string', description: 'Domain hint: medical, financial, legal, general' },
        ttlSeconds: { type: 'number', description: 'Time-to-live in seconds (default: 86400 = 24h)' },
        confidence: { type: 'number', description: 'Retrieval confidence score 0-1 (default: 1.0)' },
        sourceWorkflow: { type: 'string', description: 'Source workflow: sniper, war_room' },
      },
      required: ['semanticKey', 'content'],
    },
  },
  {
    name: 'cognitive_route',
    description: 'Get Economic Governor routing decision based on retrieval confidence and complexity. Returns route type (sniper/war_room/hitl) and selected model.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'User query to route' },
        retrievalConfidence: { type: 'number', description: 'Ghost Memory retrieval confidence 0-1' },
        ghostHit: { type: 'boolean', description: 'Whether Ghost Memory returned a hit' },
        domainHint: { type: 'string', description: 'Domain hint for compliance routing' },
        userTier: { type: 'string', description: 'User tier: free, standard, premium' },
      },
      required: ['query'],
    },
  },
  {
    name: 'emit_cognitive_metric',
    description: 'Emit a metric to CloudWatch for cognitive architecture observability',
    inputSchema: {
      type: 'object',
      properties: {
        metricName: { type: 'string', description: 'Metric name (e.g., GhostMemoryHit, SniperExecution)' },
        value: { type: 'number', description: 'Metric value' },
        unit: { type: 'string', description: 'Unit: Count, Milliseconds, Percent' },
        dimensions: { type: 'string', description: 'JSON object of dimension key-value pairs' },
      },
      required: ['metricName', 'value'],
    },
  },
  // ============================================================================
  // Polymorphic UI Tools (PROMPT-41)
  // ============================================================================
  {
    name: 'render_interface',
    description: 'Morph the User Interface to match the current task type and data. The UI physically transforms based on the Drive Profile, Task Complexity, and Cost constraints.',
    inputSchema: {
      type: 'object',
      properties: {
        view_type: { 
          type: 'string', 
          description: 'The UI component to render. Valid values: terminal_simple (Sniper Command Center), mindmap (Scout Infinite Canvas), diff_editor (Sage Verification View), dashboard, decision_cards, chat' 
        },
        execution_mode: {
          type: 'string',
          description: 'Execution mode. Valid values: sniper (Single Agent, Fast, $0.01) or war_room (Multi-Agent Ensemble, Deep, $0.50+)'
        },
        data_payload: { 
          type: 'object',
          description: 'The raw data to populate the view (e.g., JSON graph for mindmap, diff data for diff_editor)'
        },
        rationale: {
          type: 'string',
          description: 'Why is the view changing? Displayed as a toast notification to the user'
        },
        domain_hint: {
          type: 'string',
          description: 'Determines compliance rendering. Valid values: medical, financial, legal, general. Medical/financial/legal trigger verification views'
        },
        estimated_cost_cents: {
          type: 'number',
          description: 'Estimated cost of this operation in cents. Displayed as cost badge'
        }
      },
      required: ['view_type', 'execution_mode', 'data_payload'],
    },
  },
  {
    name: 'escalate_to_war_room',
    description: 'User triggers re-analysis with full multi-agent ensemble after Sniper Mode response is insufficient. This is the "Escalate" button in the UI Gearbox.',
    inputSchema: {
      type: 'object',
      properties: {
        original_query: { 
          type: 'string',
          description: 'The original question that Sniper answered'
        },
        sniper_response_id: { 
          type: 'string',
          description: 'UUID of the Sniper response being escalated'
        },
        escalation_reason: { 
          type: 'string',
          description: 'Why is War Room needed? Valid values: insufficient_depth, factual_doubt, need_alternatives, compliance_required'
        },
        additional_context: {
          type: 'string',
          description: 'Any additional context for the War Room agents'
        }
      },
      required: ['original_query', 'sniper_response_id', 'escalation_reason'],
    },
  },
  {
    name: 'get_polymorphic_route',
    description: 'Get the Economic Governor routing decision including both execution mode (sniper/war_room) AND recommended UI view type. Returns full Gearbox state.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'User query to analyze' },
        user_tier: { type: 'string', description: 'User tier: free, standard, premium' },
        retrieval_confidence: { type: 'number', description: 'Ghost Memory retrieval confidence 0-1' },
        ghost_hit: { type: 'boolean', description: 'Whether Ghost Memory returned a cached hit' },
        domain_hint: { type: 'string', description: 'Domain hint for compliance routing' },
        user_override: { type: 'string', description: 'Manual user override from UI Gearbox. Valid values: sniper, war_room' }
      },
      required: ['query'],
    },
  },
  // ============================================================================
  // Consciousness Identity Tools
  // ============================================================================
  {
    name: 'initialize_ego',
    description: 'Initialize the AI ego with identity parameters (name, values, purpose)',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the AI entity' },
        values: { type: 'string', description: 'Comma-separated core values' },
        purpose: { type: 'string', description: 'Primary purpose/mission' },
      },
      required: ['name'],
    },
  },
  {
    name: 'recall_memory',
    description: 'Retrieve relevant memories from long-term storage',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for memories' },
        limit: { type: 'number', description: 'Maximum memories to retrieve' },
      },
      required: ['query'],
    },
  },
  {
    name: 'process_thought',
    description: 'Process a thought through the cognitive loop until broadcast',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Initial thought content' },
        threadId: { type: 'string', description: 'Optional thread ID for context' },
      },
      required: ['content'],
    },
  },
  {
    name: 'compute_action',
    description: 'Select goal-directed action using Active Inference',
    inputSchema: {
      type: 'object',
      properties: {
        observation: { type: 'string', description: 'JSON observation object' },
        availableActions: { type: 'string', description: 'Comma-separated available actions' },
      },
      required: ['observation', 'availableActions'],
    },
  },
  {
    name: 'get_drive_state',
    description: 'Get current motivational/drive state',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'ground_belief',
    description: 'Verify a belief against the knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        belief: { type: 'string', description: 'Belief statement to verify' },
        requiredConfidence: { type: 'number', description: 'Minimum confidence threshold' },
      },
      required: ['belief'],
    },
  },
  {
    name: 'compute_phi',
    description: 'Calculate integrated information (Phi) from current evidence',
    inputSchema: {
      type: 'object',
      properties: {
        evidence: { type: 'string', description: 'JSON array of evidence items' },
      },
      required: [],
    },
  },
  {
    name: 'get_consciousness_metrics',
    description: 'Get current consciousness metrics (Phi, GWT activity, etc.)',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_self_model',
    description: 'Get the current self-model/identity',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_consciousness_prompt',
    description: 'Get consciousness-aware system prompt for model injection',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'run_adversarial_challenge',
    description: 'Run an adversarial identity challenge',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_consciousness_libraries',
    description: 'List all registered consciousness libraries with metadata',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  // ============================================================================
  // Capabilities Tools (Model Access, Search, Workflows)
  // ============================================================================
  {
    name: 'invoke_model',
    description: 'Invoke any available AI model (hosted or self-hosted) through Brain Router',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The prompt to send to the model' },
        taskType: { type: 'string', description: 'Task type: chat, code, analysis, creative, vision, audio' },
        preferredModel: { type: 'string', description: 'Optional specific model ID to use' },
        maxTokens: { type: 'number', description: 'Maximum tokens in response' },
        temperature: { type: 'number', description: 'Temperature (0-1)' },
        useConsciousnessContext: { type: 'boolean', description: 'Inject consciousness context into prompt' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'list_available_models',
    description: 'List all available AI models (hosted and self-hosted)',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'web_search',
    description: 'Search the web for information',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Maximum results to return' },
        searchType: { type: 'string', description: 'Type: general, academic, news, code' },
        requireCredible: { type: 'boolean', description: 'Only return credible sources' },
      },
      required: ['query'],
    },
  },
  {
    name: 'deep_research',
    description: 'Start a deep research job (async) with browser automation',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Research query' },
        scope: { type: 'string', description: 'Scope: quick, medium, deep' },
        maxSources: { type: 'number', description: 'Maximum sources to collect' },
      },
      required: ['query'],
    },
  },
  {
    name: 'retrieve_and_synthesize',
    description: 'Retrieve information from multiple sources and synthesize into coherent response',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Query to research and synthesize' },
        includeWebSearch: { type: 'boolean', description: 'Include web search results' },
        includeKnowledgeGraph: { type: 'boolean', description: 'Include knowledge graph data' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_workflow',
    description: 'Create a new workflow to solve a complex problem',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Workflow name' },
        description: { type: 'string', description: 'Workflow description' },
        goal: { type: 'string', description: 'Goal to achieve' },
        autoGenerate: { type: 'boolean', description: 'Auto-generate steps from goal' },
      },
      required: ['name', 'goal'],
    },
  },
  {
    name: 'execute_workflow',
    description: 'Execute an existing workflow',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'Workflow ID to execute' },
        inputs: { type: 'string', description: 'JSON object of input parameters' },
        async: { type: 'boolean', description: 'Run asynchronously' },
      },
      required: ['workflowId'],
    },
  },
  {
    name: 'list_workflows',
    description: 'List workflows created by consciousness engine',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'solve_problem',
    description: 'Autonomously solve a problem using all available capabilities',
    inputSchema: {
      type: 'object',
      properties: {
        problem: { type: 'string', description: 'Problem description' },
        context: { type: 'string', description: 'Additional context' },
        constraints: { type: 'string', description: 'Comma-separated constraints' },
        preferredApproach: { type: 'string', description: 'Approach: analytical, creative, research, workflow' },
      },
      required: ['problem'],
    },
  },
  {
    name: 'start_thinking_session',
    description: 'Start an autonomous thinking session to explore a goal',
    inputSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'Goal to think about and work toward' },
      },
      required: ['goal'],
    },
  },
  {
    name: 'get_thinking_session',
    description: 'Get status and results of a thinking session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Thinking session ID' },
      },
      required: ['sessionId'],
    },
  },
  // ============================================================================
  // Phase 4: Frontier Technologies (HippoRAG, DreamerV3, SpikingJelly)
  // ============================================================================
  {
    name: 'hipporag_index',
    description: 'Index a document using hippocampal pattern separation for improved multi-hop retrieval',
    inputSchema: {
      type: 'object',
      properties: {
        docId: { type: 'string', description: 'Document ID' },
        content: { type: 'string', description: 'Document content to index' },
        metadata: { type: 'string', description: 'Optional JSON metadata' },
      },
      required: ['docId', 'content'],
    },
  },
  {
    name: 'hipporag_retrieve',
    description: 'Retrieve documents using Personalized PageRank over knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        k: { type: 'number', description: 'Number of results to return' },
        maxHops: { type: 'number', description: 'Maximum hops in graph traversal' },
      },
      required: ['query'],
    },
  },
  {
    name: 'hipporag_multi_hop',
    description: 'Answer a question using multi-hop reasoning over the knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Question requiring multi-hop reasoning' },
        maxHops: { type: 'number', description: 'Maximum reasoning hops' },
      },
      required: ['query'],
    },
  },
  {
    name: 'imagine_trajectory',
    description: 'Imagine a future trajectory using DreamerV3 world model',
    inputSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'Goal to imagine trajectory toward' },
        currentContext: { type: 'string', description: 'Current state/context as JSON' },
        horizon: { type: 'number', description: 'Number of steps to imagine' },
      },
      required: ['goal'],
    },
  },
  {
    name: 'counterfactual_simulation',
    description: 'Simulate a counterfactual scenario (what would have happened if...)',
    inputSchema: {
      type: 'object',
      properties: {
        originalScenario: { type: 'string', description: 'Original scenario description' },
        counterfactualCondition: { type: 'string', description: 'The "what if" condition' },
      },
      required: ['originalScenario', 'counterfactualCondition'],
    },
  },
  {
    name: 'dream_consolidation',
    description: 'Generate synthetic experiences through dreaming for memory consolidation',
    inputSchema: {
      type: 'object',
      properties: {
        experiences: { type: 'string', description: 'JSON array of recent experiences' },
        numDreams: { type: 'number', description: 'Number of dreams to generate' },
      },
      required: [],
    },
  },
  {
    name: 'test_temporal_binding',
    description: 'Test if cognitive streams bind into unified percept (SpikingJelly)',
    inputSchema: {
      type: 'object',
      properties: {
        moduleOutputs: { type: 'string', description: 'JSON array of module outputs with activations' },
      },
      required: ['moduleOutputs'],
    },
  },
  {
    name: 'detect_synchrony',
    description: 'Detect synchrony between spike streams for phenomenal binding analysis',
    inputSchema: {
      type: 'object',
      properties: {
        streams: { type: 'string', description: 'JSON array of spike streams' },
        windowMs: { type: 'number', description: 'Synchrony detection window in ms' },
      },
      required: ['streams'],
    },
  },
  // ============================================================================
  // Butlin Consciousness Tests
  // ============================================================================
  {
    name: 'run_consciousness_tests',
    description: 'Run the full Butlin consciousness test suite (14 indicators)',
    inputSchema: {
      type: 'object',
      properties: {
        includePCI: { type: 'boolean', description: 'Include Perturbational Complexity Index test' },
        includePhiApproximation: { type: 'boolean', description: 'Include Phi approximation' },
      },
      required: [],
    },
  },
  {
    name: 'run_single_consciousness_test',
    description: 'Run a single Butlin consciousness indicator test',
    inputSchema: {
      type: 'object',
      properties: {
        indicator: { type: 'string', description: 'Indicator: recurrent_processing, global_broadcast, higher_order_representations, attention_amplification, predictive_processing, agency_embodiment, self_model, temporal_integration, unified_experience, phenomenal_states, goal_directed_behavior, counterfactual_reasoning, emotional_valence, introspective_access' },
      },
      required: ['indicator'],
    },
  },
  {
    name: 'run_pci_test',
    description: 'Run Perturbational Complexity Index test for consciousness measurement',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// ============================================================================
// MCP Request/Response Types
// ============================================================================

interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// ============================================================================
// Handler
// ============================================================================

export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
  const tenantId = event.requestContext.authorizer?.tenantId || 
                   event.headers['x-tenant-id'] || 
                   'default';

  try {
    const body = JSON.parse(event.body || '{}') as MCPRequest;
    
    logger.info('MCP request received', { 
      method: body.method, 
      tenantId,
      id: body.id,
    });

    const response = await handleMCPRequest(tenantId, body);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    logger.error(`MCP request failed: ${String(error)}`);
    
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: 'Internal error',
          data: String(error),
        },
      }),
    };
  }
};

/**
 * Handle MCP request based on method.
 */
async function handleMCPRequest(
  tenantId: string,
  request: MCPRequest
): Promise<MCPResponse> {
  const { id, method, params } = request;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'consciousness-engine',
            version: '1.0.0',
          },
        },
      };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: CONSCIOUSNESS_TOOLS,
        },
      };

    case 'tools/call':
      const toolName = params?.name as string;
      const toolArgs = params?.arguments as Record<string, unknown>;
      const result = await executeToolCall(tenantId, toolName, toolArgs);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        },
      };

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
      };
  }
}

/**
 * Execute a tool call.
 */
async function executeToolCall(
  tenantId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case 'initialize_ego': {
      const seedIdentity = {
        name: args.name as string,
        values: args.values ? (args.values as string).split(',').map(v => v.trim()) : undefined,
        purpose: args.purpose as string | undefined,
      };
      return await consciousnessEngineService.initializeEgo(tenantId, seedIdentity);
    }

    case 'recall_memory': {
      const query = args.query as string;
      const limit = (args.limit as number) || 5;
      return await consciousnessEngineService.pageInMemory(tenantId, query, limit);
    }

    case 'process_thought': {
      const content = args.content as string;
      const threadId = args.threadId as string | undefined;
      return await consciousnessEngineService.processThought(tenantId, content, { threadId });
    }

    case 'compute_action': {
      const observation = JSON.parse(args.observation as string);
      const availableActions = (args.availableActions as string).split(',').map(a => a.trim());
      return await consciousnessEngineService.computeAction(observation, availableActions);
    }

    case 'get_drive_state': {
      return {
        driveState: consciousnessEngineService.getCurrentDriveState(),
        interpretation: getDriveStateInterpretation(consciousnessEngineService.getCurrentDriveState()),
      };
    }

    case 'ground_belief': {
      const belief = args.belief as string;
      const requiredConfidence = (args.requiredConfidence as number) || 0.7;
      return await consciousnessEngineService.groundBelief(tenantId, belief, requiredConfidence);
    }

    case 'compute_phi': {
      const evidence = args.evidence ? JSON.parse(args.evidence as string) : [];
      return await consciousnessEngineService.computePhi(evidence);
    }

    case 'get_consciousness_metrics': {
      return await consciousnessEngineService.getConsciousnessMetrics(tenantId);
    }

    case 'get_self_model': {
      // Try to load if not already loaded
      let selfModel = consciousnessEngineService.getSelfModel();
      if (!selfModel) {
        await consciousnessEngineService.loadEgo(tenantId);
        selfModel = consciousnessEngineService.getSelfModel();
      }
      return selfModel || { error: 'No self-model initialized' };
    }

    case 'get_consciousness_prompt': {
      // Ensure ego is loaded
      if (!consciousnessEngineService.getSelfModel()) {
        await consciousnessEngineService.loadEgo(tenantId);
      }
      return {
        systemPrompt: consciousnessEngineService.buildConsciousnessSystemPrompt(),
      };
    }

    case 'run_adversarial_challenge': {
      const selfModel = consciousnessEngineService.getSelfModel();
      if (!selfModel) {
        return { error: 'No self-model initialized' };
      }
      return await internalCriticService.challengeIdentity(tenantId, selfModel);
    }

    case 'list_consciousness_libraries': {
      return CONSCIOUSNESS_LIBRARY_REGISTRY;
    }

    // ============================================================================
    // Capabilities Tool Implementations
    // ============================================================================

    case 'invoke_model': {
      return await consciousnessCapabilitiesService.invokeModel(tenantId, {
        prompt: args.prompt as string,
        taskType: args.taskType as 'chat' | 'code' | 'analysis' | 'creative' | 'vision' | 'audio' | undefined,
        preferredModel: args.preferredModel as string | undefined,
        maxTokens: args.maxTokens as number | undefined,
        temperature: args.temperature as number | undefined,
        useConsciousnessContext: args.useConsciousnessContext as boolean | undefined,
      });
    }

    case 'list_available_models': {
      return await consciousnessCapabilitiesService.getAvailableModels(tenantId);
    }

    case 'web_search': {
      return await consciousnessCapabilitiesService.webSearch(tenantId, {
        query: args.query as string,
        maxResults: args.maxResults as number | undefined,
        searchType: args.searchType as 'general' | 'academic' | 'news' | 'code' | undefined,
        requireCredible: args.requireCredible as boolean | undefined,
      });
    }

    case 'deep_research': {
      return await consciousnessCapabilitiesService.startDeepResearch(
        tenantId,
        'consciousness-engine',
        {
          query: args.query as string,
          scope: args.scope as 'quick' | 'medium' | 'deep' | undefined,
          maxSources: args.maxSources as number | undefined,
        }
      );
    }

    case 'retrieve_and_synthesize': {
      return await consciousnessCapabilitiesService.retrieveAndSynthesize(
        tenantId,
        args.query as string,
        {
          includeWebSearch: args.includeWebSearch as boolean | undefined,
          includeKnowledgeGraph: args.includeKnowledgeGraph as boolean | undefined,
        }
      );
    }

    case 'create_workflow': {
      return await consciousnessCapabilitiesService.createWorkflow(tenantId, {
        name: args.name as string,
        description: args.description as string || '',
        goal: args.goal as string,
        autoGenerate: args.autoGenerate as boolean | undefined,
      });
    }

    case 'execute_workflow': {
      const inputs = args.inputs ? JSON.parse(args.inputs as string) : {};
      return await consciousnessCapabilitiesService.executeWorkflow(
        tenantId,
        'consciousness-engine',
        {
          workflowId: args.workflowId as string,
          inputs,
          async: args.async as boolean | undefined,
        }
      );
    }

    case 'list_workflows': {
      return await consciousnessCapabilitiesService.listConsciousnessWorkflows(tenantId);
    }

    case 'solve_problem': {
      return await consciousnessCapabilitiesService.solveProblem(tenantId, {
        problem: args.problem as string,
        context: args.context as string | undefined,
        constraints: args.constraints ? (args.constraints as string).split(',').map(c => c.trim()) : undefined,
        preferredApproach: args.preferredApproach as 'analytical' | 'creative' | 'research' | 'workflow' | undefined,
      });
    }

    case 'start_thinking_session': {
      return await consciousnessCapabilitiesService.startThinkingSession(
        tenantId,
        args.goal as string
      );
    }

    case 'get_thinking_session': {
      const session = consciousnessCapabilitiesService.getThinkingSession(args.sessionId as string);
      return session || { error: 'Session not found' };
    }

    // ============================================================================
    // HippoRAG Tools
    // ============================================================================

    case 'hipporag_index': {
      const docId = args.docId as string;
      const content = args.content as string;
      const metadata = args.metadata ? JSON.parse(args.metadata as string) : {};
      return await hippoRAGService.indexDocument(tenantId, docId, content, metadata);
    }

    case 'hipporag_retrieve': {
      const query = args.query as string;
      const k = (args.k as number) || 5;
      const maxHops = args.maxHops as number | undefined;
      return await hippoRAGService.retrieve(tenantId, query, k, { maxHops });
    }

    case 'hipporag_multi_hop': {
      const query = args.query as string;
      const maxHops = args.maxHops as number | undefined;
      return await hippoRAGService.multiHopQuery(tenantId, query, { maxHops });
    }

    // ============================================================================
    // DreamerV3 Tools
    // ============================================================================

    case 'imagine_trajectory': {
      const goal = args.goal as string;
      const currentContext = args.currentContext ? JSON.parse(args.currentContext as string) : {};
      const horizon = args.horizon as number | undefined;
      
      const currentState = {
        stateId: `state-${Date.now()}`,
        features: currentContext,
        timestamp: new Date(),
      };
      
      return await dreamerV3Service.imagineTrajectory(tenantId, currentState, goal, { horizon });
    }

    case 'counterfactual_simulation': {
      const originalScenario = args.originalScenario as string;
      const counterfactualCondition = args.counterfactualCondition as string;
      return await dreamerV3Service.counterfactualSimulation(tenantId, originalScenario, counterfactualCondition);
    }

    case 'dream_consolidation': {
      const experiences = args.experiences ? JSON.parse(args.experiences as string) : [];
      const numDreams = args.numDreams as number | undefined;
      return await dreamerV3Service.dreamConsolidation(tenantId, experiences, { numDreams });
    }

    // ============================================================================
    // SpikingJelly Tools
    // ============================================================================

    case 'test_temporal_binding': {
      const moduleOutputs = JSON.parse(args.moduleOutputs as string);
      return await spikingJellyService.testCognitiveBinding(tenantId, moduleOutputs);
    }

    case 'detect_synchrony': {
      const streams = JSON.parse(args.streams as string);
      const windowMs = args.windowMs as number | undefined;
      return await spikingJellyService.detectSynchrony(streams, { windowMs });
    }

    // ============================================================================
    // Butlin Consciousness Tests
    // ============================================================================

    case 'run_consciousness_tests': {
      const includePCI = args.includePCI as boolean | undefined;
      const includePhiApproximation = args.includePhiApproximation as boolean | undefined;
      return await butlinConsciousnessTestsService.runFullTestSuite(tenantId, {
        includePCI,
        includePhiApproximation,
      });
    }

    case 'run_single_consciousness_test': {
      const indicator = args.indicator as string;
      return await butlinConsciousnessTestsService.runIndicatorTest(tenantId, indicator as any);
    }

    case 'run_pci_test': {
      return await butlinConsciousnessTestsService.runPCITest(tenantId);
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Get human-readable interpretation of drive state.
 */
function getDriveStateInterpretation(state: DriveState): string {
  const interpretations: Record<DriveState, string> = {
    [DriveState.CURIOUS]: 'Seeking information, exploring possibilities',
    [DriveState.CONFIDENT]: 'Acting on established beliefs with certainty',
    [DriveState.UNCERTAIN]: 'Lacking clarity, may request clarification',
    [DriveState.SATISFIED]: 'Goal achieved, current state aligns with preferences',
    [DriveState.FRUSTRATED]: 'Goals blocked, high free energy state',
  };
  return interpretations[state] || 'Unknown state';
}

// ============================================================================
// HTTP Endpoints (Alternative to MCP for direct API access)
// ============================================================================

/**
 * REST API handler for direct HTTP access.
 */
export const restHandler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
  const tenantId = event.requestContext.authorizer?.tenantId || 
                   event.headers['x-tenant-id'] || 
                   'default';
  const path = event.path.replace('/api/consciousness/', '');
  const method = event.httpMethod;

  try {
    let result: unknown;

    switch (`${method} ${path}`) {
      case 'POST ego/initialize': {
        const body = JSON.parse(event.body || '{}');
        result = await consciousnessEngineService.initializeEgo(tenantId, body);
        break;
      }

      case 'GET ego': {
        await consciousnessEngineService.loadEgo(tenantId);
        result = consciousnessEngineService.getSelfModel();
        break;
      }

      case 'POST thought/process': {
        const body = JSON.parse(event.body || '{}');
        result = await consciousnessEngineService.processThought(
          tenantId, 
          body.content, 
          { threadId: body.threadId }
        );
        break;
      }

      case 'POST action/compute': {
        const body = JSON.parse(event.body || '{}');
        result = await consciousnessEngineService.computeAction(
          body.observation,
          body.availableActions
        );
        break;
      }

      case 'GET drive-state': {
        result = {
          driveState: consciousnessEngineService.getCurrentDriveState(),
          interpretation: getDriveStateInterpretation(consciousnessEngineService.getCurrentDriveState()),
        };
        break;
      }

      case 'POST grounding/verify': {
        const body = JSON.parse(event.body || '{}');
        result = await consciousnessEngineService.groundBelief(
          tenantId,
          body.belief,
          body.requiredConfidence
        );
        break;
      }

      case 'GET metrics': {
        result = await consciousnessEngineService.getConsciousnessMetrics(tenantId);
        break;
      }

      case 'GET libraries': {
        result = CONSCIOUSNESS_LIBRARY_REGISTRY;
        break;
      }

      case 'POST sleep-cycle/run': {
        result = await consciousnessEngineService.runSleepCycle(tenantId);
        break;
      }

      default:
        return {
          statusCode: 404,
          body: JSON.stringify({ error: `Route not found: ${method} ${path}` }),
        };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(result),
    };
  } catch (error) {
    logger.error(`REST API error: ${String(error)}`);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(error) }),
    };
  }
};
