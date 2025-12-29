// Tree of Thoughts Service
// System 2 Reasoning with Monte Carlo Tree Search / Beam Search

import { executeStatement, stringParam } from '../db/client';
import type {
  ThoughtNode,
  ReasoningTree,
  TreeOfThoughtsConfig,
  DEFAULT_TOT_CONFIG,
} from '@radiant/shared';
import crypto from 'crypto';

interface ThoughtGenerationResult {
  thoughts: string[];
  reasoning: string[];
}

interface ThoughtScore {
  score: number;
  confidence: number;
  reasoning: string;
}

class TreeOfThoughtsService {
  private defaultConfig: TreeOfThoughtsConfig = {
    enabled: true,
    maxDepth: 5,
    branchingFactor: 3,
    pruneThreshold: 0.3,
    selectionStrategy: 'beam',
    beamWidth: 2,
    mctsIterations: 100,
    scoringModel: 'gpt-4o-mini',
    generationModel: 'gpt-4o',
    defaultThinkingTimeMs: 30000,
    maxThinkingTimeMs: 300000,
    problemTypes: ['math', 'logic', 'planning', 'code', 'analysis'],
  };

  /**
   * Start a Tree of Thoughts reasoning session
   */
  async startReasoning(
    tenantId: string,
    userId: string,
    prompt: string,
    thinkingTimeMs: number = 30000,
    config?: Partial<TreeOfThoughtsConfig>
  ): Promise<ReasoningTree> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    const problemType = this.detectProblemType(prompt);
    
    const treeId = crypto.randomUUID();
    const rootNode: ThoughtNode = {
      id: crypto.randomUUID(),
      parentId: null,
      depth: 0,
      thought: prompt,
      score: 1.0,
      confidence: 1.0,
      reasoning: 'Root node - original problem',
      children: [],
      status: 'selected',
      tokenCount: this.estimateTokens(prompt),
      createdAt: new Date(),
    };

    const tree: ReasoningTree = {
      id: treeId,
      tenantId,
      userId,
      originalPrompt: prompt,
      problemType,
      rootNode,
      totalNodes: 1,
      maxDepth: 0,
      branchingFactor: mergedConfig.branchingFactor,
      config: mergedConfig,
      currentBestPath: [rootNode.id],
      currentBestScore: 1.0,
      exploredPaths: 0,
      prunedPaths: 0,
      thinkingTimeMs,
      elapsedTimeMs: 0,
      status: 'thinking',
      startedAt: new Date(),
    };

    // Save initial tree
    await this.saveTree(tree);

    // Start the reasoning process
    return this.executeReasoning(tree);
  }

  /**
   * Execute the reasoning process based on strategy
   */
  private async executeReasoning(tree: ReasoningTree): Promise<ReasoningTree> {
    const startTime = Date.now();
    const deadline = startTime + tree.thinkingTimeMs;

    try {
      switch (tree.config.selectionStrategy) {
        case 'beam':
          await this.beamSearch(tree, deadline);
          break;
        case 'mcts':
          await this.mctsSearch(tree, deadline);
          break;
        case 'greedy':
          await this.greedySearch(tree, deadline);
          break;
      }

      tree.elapsedTimeMs = Date.now() - startTime;
      tree.status = 'complete';

      // Extract final answer from best path
      tree.finalAnswer = await this.synthesizeFinalAnswer(tree);
      tree.finalConfidence = tree.currentBestScore;
      tree.completedAt = new Date();

    } catch (error) {
      tree.status = 'error';
      tree.elapsedTimeMs = Date.now() - startTime;
    }

    await this.saveTree(tree);
    return tree;
  }

  /**
   * Beam Search - keep top K paths at each depth
   */
  private async beamSearch(tree: ReasoningTree, deadline: number): Promise<void> {
    let currentBeam: ThoughtNode[] = [tree.rootNode];
    let depth = 0;

    while (depth < tree.config.maxDepth && Date.now() < deadline) {
      const nextBeam: ThoughtNode[] = [];

      for (const node of currentBeam) {
        if (Date.now() >= deadline) break;

        // Generate child thoughts
        const children = await this.expandNode(tree, node);
        
        // Score each child
        for (const child of children) {
          const score = await this.scoreThought(tree, child);
          child.score = score.score;
          child.confidence = score.confidence;
          child.evaluationModel = tree.config.scoringModel;
          
          if (child.score >= tree.config.pruneThreshold) {
            nextBeam.push(child);
            node.children.push(child);
            tree.totalNodes++;
          } else {
            child.status = 'pruned';
            tree.prunedPaths++;
          }
        }
      }

      if (nextBeam.length === 0) break;

      // Keep top K
      nextBeam.sort((a, b) => b.score - a.score);
      currentBeam = nextBeam.slice(0, tree.config.beamWidth);
      
      // Mark selected nodes
      for (const node of currentBeam) {
        node.status = 'selected';
      }

      depth++;
      tree.maxDepth = Math.max(tree.maxDepth, depth);
      tree.exploredPaths++;

      // Update best path
      if (currentBeam[0] && currentBeam[0].score > tree.currentBestScore) {
        tree.currentBestScore = currentBeam[0].score;
        tree.currentBestPath = this.getPathToNode(tree.rootNode, currentBeam[0].id);
      }
    }
  }

  /**
   * Monte Carlo Tree Search
   */
  private async mctsSearch(tree: ReasoningTree, deadline: number): Promise<void> {
    for (let i = 0; i < tree.config.mctsIterations && Date.now() < deadline; i++) {
      // Selection - find promising unexpanded node
      const selectedNode = this.selectNode(tree.rootNode);
      
      // Expansion - add children
      if (selectedNode.depth < tree.config.maxDepth) {
        const children = await this.expandNode(tree, selectedNode);
        selectedNode.children = children;
        tree.totalNodes += children.length;
        
        // Simulation - score a random child
        if (children.length > 0) {
          const randomChild = children[Math.floor(Math.random() * children.length)];
          const score = await this.scoreThought(tree, randomChild);
          randomChild.score = score.score;
          
          // Backpropagation
          this.backpropagate(tree.rootNode, randomChild.id, score.score);
        }
      }
      
      tree.exploredPaths++;
    }

    // Find best leaf
    const bestLeaf = this.findBestLeaf(tree.rootNode);
    if (bestLeaf) {
      tree.currentBestPath = this.getPathToNode(tree.rootNode, bestLeaf.id);
      tree.currentBestScore = bestLeaf.score;
    }
  }

  /**
   * Greedy Search - always pick best at each level
   */
  private async greedySearch(tree: ReasoningTree, deadline: number): Promise<void> {
    let currentNode = tree.rootNode;

    while (currentNode.depth < tree.config.maxDepth && Date.now() < deadline) {
      const children = await this.expandNode(tree, currentNode);
      
      if (children.length === 0) break;

      // Score all children
      let bestChild: ThoughtNode | null = null;
      let bestScore = -1;

      for (const child of children) {
        const score = await this.scoreThought(tree, child);
        child.score = score.score;
        child.confidence = score.confidence;
        
        if (score.score > bestScore) {
          bestScore = score.score;
          bestChild = child;
        }
        
        tree.totalNodes++;
      }

      if (!bestChild || bestScore < tree.config.pruneThreshold) break;

      bestChild.status = 'selected';
      currentNode.children = children;
      currentNode = bestChild;
      tree.maxDepth = currentNode.depth;
      tree.exploredPaths++;
    }

    tree.currentBestPath = this.getPathToNode(tree.rootNode, currentNode.id);
    tree.currentBestScore = currentNode.score;
  }

  /**
   * Generate child thoughts for a node
   */
  private async expandNode(tree: ReasoningTree, node: ThoughtNode): Promise<ThoughtNode[]> {
    const thoughts = await this.generateThoughts(tree, node);
    
    return thoughts.thoughts.map((thought, i) => ({
      id: crypto.randomUUID(),
      parentId: node.id,
      depth: node.depth + 1,
      thought,
      score: 0,
      confidence: 0,
      reasoning: thoughts.reasoning[i] || '',
      children: [],
      status: 'pending' as const,
      tokenCount: this.estimateTokens(thought),
      createdAt: new Date(),
    }));
  }

  /**
   * Generate multiple thought branches
   */
  private async generateThoughts(
    tree: ReasoningTree,
    node: ThoughtNode
  ): Promise<ThoughtGenerationResult> {
    // Build context from path to this node
    const path = this.getPathToNode(tree.rootNode, node.id);
    const context = path.map(id => this.findNode(tree.rootNode, id)?.thought).filter(Boolean);

    const prompt = `You are a strategic reasoning assistant. Given a problem and the reasoning path so far, generate ${tree.config.branchingFactor} distinct next steps or approaches.

Problem: ${tree.originalPrompt}

Reasoning path so far:
${context.map((t, i) => `Step ${i}: ${t}`).join('\n')}

Generate ${tree.config.branchingFactor} different next reasoning steps. Each should be a distinct approach or continuation. Format as JSON:
{
  "thoughts": ["thought 1", "thought 2", "thought 3"],
  "reasoning": ["why thought 1", "why thought 2", "why thought 3"]
}`;

    // This would call the actual LLM - placeholder for structure
    const thoughts: string[] = [];
    const reasoning: string[] = [];

    for (let i = 0; i < tree.config.branchingFactor; i++) {
      thoughts.push(`Approach ${i + 1}: Continue reasoning from "${node.thought.slice(0, 50)}..."`);
      reasoning.push(`Generated approach ${i + 1} for problem type ${tree.problemType}`);
    }

    return { thoughts, reasoning };
  }

  /**
   * Score a thought node
   */
  private async scoreThought(tree: ReasoningTree, node: ThoughtNode): Promise<ThoughtScore> {
    const prompt = `Rate this reasoning step for solving the problem. Score from 0.0 to 1.0.

Problem: ${tree.originalPrompt}
Problem Type: ${tree.problemType}

Reasoning Step: ${node.thought}

Evaluate:
1. Relevance to problem (0-1)
2. Logical soundness (0-1)
3. Progress toward solution (0-1)

Return JSON: { "score": 0.X, "confidence": 0.X, "reasoning": "why" }`;

    // Placeholder scoring - would call scoring model
    const score = 0.5 + Math.random() * 0.4;
    return {
      score,
      confidence: 0.8,
      reasoning: `Evaluated step for ${tree.problemType} problem`,
    };
  }

  /**
   * Synthesize final answer from best path
   */
  private async synthesizeFinalAnswer(tree: ReasoningTree): Promise<string> {
    const pathNodes = tree.currentBestPath
      .map(id => this.findNode(tree.rootNode, id))
      .filter(Boolean);

    const reasoningChain = pathNodes
      .map((n, i) => `Step ${i}: ${n?.thought}`)
      .join('\n');

    return `Based on ${tree.exploredPaths} explored reasoning paths (${tree.prunedPaths} pruned), the best solution approach:\n\n${reasoningChain}\n\nFinal confidence: ${(tree.currentBestScore * 100).toFixed(1)}%`;
  }

  /**
   * UCB1 selection for MCTS
   */
  private selectNode(node: ThoughtNode, explorationWeight: number = 1.41): ThoughtNode {
    if (node.children.length === 0) return node;

    let bestChild = node.children[0];
    let bestUCB = -Infinity;

    for (const child of node.children) {
      const exploitation = child.score;
      const exploration = explorationWeight * Math.sqrt(
        Math.log(node.children.length) / (child.children.length + 1)
      );
      const ucb = exploitation + exploration;

      if (ucb > bestUCB) {
        bestUCB = ucb;
        bestChild = child;
      }
    }

    return this.selectNode(bestChild, explorationWeight);
  }

  /**
   * Backpropagate score up the tree
   */
  private backpropagate(root: ThoughtNode, leafId: string, score: number): void {
    const path = this.getPathToNode(root, leafId);
    for (const nodeId of path) {
      const node = this.findNode(root, nodeId);
      if (node) {
        node.score = (node.score + score) / 2; // Running average
      }
    }
  }

  /**
   * Find the best leaf node
   */
  private findBestLeaf(node: ThoughtNode): ThoughtNode | null {
    if (node.children.length === 0) return node;

    let best: ThoughtNode | null = null;
    let bestScore = -Infinity;

    for (const child of node.children) {
      const leaf = this.findBestLeaf(child);
      if (leaf && leaf.score > bestScore) {
        bestScore = leaf.score;
        best = leaf;
      }
    }

    return best;
  }

  /**
   * Get path from root to a node
   */
  private getPathToNode(root: ThoughtNode, targetId: string): string[] {
    if (root.id === targetId) return [root.id];

    for (const child of root.children) {
      const path = this.getPathToNode(child, targetId);
      if (path.length > 0) {
        return [root.id, ...path];
      }
    }

    return [];
  }

  /**
   * Find a node by ID
   */
  private findNode(root: ThoughtNode, id: string): ThoughtNode | null {
    if (root.id === id) return root;

    for (const child of root.children) {
      const found = this.findNode(child, id);
      if (found) return found;
    }

    return null;
  }

  /**
   * Detect problem type from prompt
   */
  private detectProblemType(prompt: string): ReasoningTree['problemType'] {
    const lower = prompt.toLowerCase();
    
    if (/\b(calculate|compute|solve|equation|math|sum|product|integral)\b/.test(lower)) {
      return 'math';
    }
    if (/\b(if.+then|therefore|implies|prove|logic|valid|invalid)\b/.test(lower)) {
      return 'logic';
    }
    if (/\b(plan|schedule|organize|steps|strategy|approach)\b/.test(lower)) {
      return 'planning';
    }
    if (/\b(code|program|function|algorithm|implement|debug)\b/.test(lower)) {
      return 'code';
    }
    if (/\b(analyze|evaluate|compare|assess|review)\b/.test(lower)) {
      return 'analysis';
    }
    
    return 'general';
  }

  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Save tree to database
   */
  private async saveTree(tree: ReasoningTree): Promise<void> {
    await executeStatement({
      sql: `
        INSERT INTO reasoning_trees (
          id, tenant_id, user_id, plan_id,
          original_prompt, problem_type, tree_data, config,
          total_nodes, max_depth, branching_factor,
          current_best_score, explored_paths, pruned_paths,
          thinking_time_ms, elapsed_time_ms,
          final_answer, final_confidence,
          status, started_at, completed_at
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4::uuid,
          $5, $6, $7::jsonb, $8::jsonb,
          $9, $10, $11,
          $12, $13, $14,
          $15, $16,
          $17, $18,
          $19, $20, $21
        )
        ON CONFLICT (id) DO UPDATE SET
          tree_data = $7::jsonb,
          total_nodes = $9,
          max_depth = $10,
          current_best_score = $12,
          explored_paths = $13,
          pruned_paths = $14,
          elapsed_time_ms = $16,
          final_answer = $17,
          final_confidence = $18,
          status = $19,
          completed_at = $21
      `,
      parameters: [
        stringParam('id', tree.id),
        stringParam('tenantId', tree.tenantId),
        stringParam('userId', tree.userId),
        stringParam('planId', tree.planId || ''),
        stringParam('originalPrompt', tree.originalPrompt),
        stringParam('problemType', tree.problemType),
        stringParam('treeData', JSON.stringify(tree.rootNode)),
        stringParam('config', JSON.stringify(tree.config)),
        stringParam('totalNodes', String(tree.totalNodes)),
        stringParam('maxDepth', String(tree.maxDepth)),
        stringParam('branchingFactor', String(tree.branchingFactor)),
        stringParam('currentBestScore', String(tree.currentBestScore)),
        stringParam('exploredPaths', String(tree.exploredPaths)),
        stringParam('prunedPaths', String(tree.prunedPaths)),
        stringParam('thinkingTimeMs', String(tree.thinkingTimeMs)),
        stringParam('elapsedTimeMs', String(tree.elapsedTimeMs)),
        stringParam('finalAnswer', tree.finalAnswer || ''),
        stringParam('finalConfidence', tree.finalConfidence ? String(tree.finalConfidence) : ''),
        stringParam('status', tree.status),
        stringParam('startedAt', tree.startedAt.toISOString()),
        stringParam('completedAt', tree.completedAt?.toISOString() || ''),
      ],
    });
  }

  /**
   * Get tree by ID
   */
  async getTree(treeId: string): Promise<ReasoningTree | null> {
    const result = await executeStatement({
      sql: `SELECT * FROM reasoning_trees WHERE id = $1::uuid`,
      parameters: [stringParam('id', treeId)],
    });

    if (!result.rows?.length) return null;

    const row = result.rows[0];
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string,
      planId: row.plan_id as string,
      originalPrompt: row.original_prompt as string,
      problemType: row.problem_type as ReasoningTree['problemType'],
      rootNode: row.tree_data as ThoughtNode,
      totalNodes: parseInt(row.total_nodes as string),
      maxDepth: parseInt(row.max_depth as string),
      branchingFactor: parseInt(row.branching_factor as string),
      config: row.config as TreeOfThoughtsConfig,
      currentBestPath: [],
      currentBestScore: parseFloat(row.current_best_score as string),
      exploredPaths: parseInt(row.explored_paths as string),
      prunedPaths: parseInt(row.pruned_paths as string),
      thinkingTimeMs: parseInt(row.thinking_time_ms as string),
      elapsedTimeMs: parseInt(row.elapsed_time_ms as string),
      finalAnswer: row.final_answer as string,
      finalConfidence: parseFloat(row.final_confidence as string),
      status: row.status as ReasoningTree['status'],
      startedAt: new Date(row.started_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    };
  }

  /**
   * Get configuration for tenant
   */
  async getConfig(tenantId: string): Promise<TreeOfThoughtsConfig> {
    const result = await executeStatement({
      sql: `SELECT tree_of_thoughts FROM cognitive_architecture_config WHERE tenant_id = $1::uuid`,
      parameters: [stringParam('tenantId', tenantId)],
    });

    if (result.rows?.length && result.rows[0].tree_of_thoughts) {
      return result.rows[0].tree_of_thoughts as TreeOfThoughtsConfig;
    }

    return this.defaultConfig;
  }
}

export const treeOfThoughtsService = new TreeOfThoughtsService();
