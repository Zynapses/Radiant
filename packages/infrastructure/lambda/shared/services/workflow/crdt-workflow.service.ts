/**
 * CRDT Workflow Service
 * RADIANT v5.53.0
 * 
 * Foundation for real-time collaborative workflow editing using CRDTs.
 * 
 * Implements Gemini's recommendation for multiplayer workflow editing:
 * 1. Y.js-inspired CRDT types for workflow nodes and edges
 * 2. Operational transformation for concurrent edits
 * 3. Presence awareness (who's editing what)
 * 4. Conflict-free merge semantics
 * 
 * SCOPE: Foundation layer only. Full Y.js integration would be Phase 2.
 * This provides the data structures and merge logic needed for collaborative editing.
 */

import { v4 as uuidv4 } from 'uuid';
import { createRegisteredLogger } from '../logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'workflow/crdt-workflow',
  category: 'infrastructure',
  sourceType: 'application',
});

// =============================================================================
// CRDT Types
// =============================================================================

export type CRDTOperationType = 
  | 'insert_node'
  | 'delete_node'
  | 'update_node'
  | 'insert_edge'
  | 'delete_edge'
  | 'move_node'
  | 'update_metadata';

export interface VectorClock {
  [clientId: string]: number;
}

export interface CRDTOperation {
  operationId: string;
  type: CRDTOperationType;
  clientId: string;
  timestamp: number;
  vectorClock: VectorClock;
  targetId: string;         // Node or edge ID
  payload: unknown;
  tombstone?: boolean;      // For deletion tracking
}

export interface WorkflowNode {
  nodeId: string;
  type: 'method' | 'condition' | 'start' | 'end' | 'parallel' | 'merge';
  label: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  deleted?: boolean;
}

export interface WorkflowEdge {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  condition?: string;
  label?: string;
  createdAt: string;
  deleted?: boolean;
}

export interface CollaboratorPresence {
  clientId: string;
  userId: string;
  userName: string;
  color: string;
  cursor?: { x: number; y: number };
  selectedNodeIds: string[];
  lastSeen: string;
}

export interface CRDTWorkflowState {
  workflowId: string;
  version: number;
  vectorClock: VectorClock;
  nodes: Map<string, WorkflowNode>;
  edges: Map<string, WorkflowEdge>;
  metadata: Record<string, unknown>;
  operationLog: CRDTOperation[];
  presence: Map<string, CollaboratorPresence>;
}

// =============================================================================
// CRDT Workflow Service
// =============================================================================

class CRDTWorkflowService {
  private workflows = new Map<string, CRDTWorkflowState>();
  private pendingOperations = new Map<string, CRDTOperation[]>();
  
  // Presence colors for collaborators
  private readonly PRESENCE_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  ];
  
  // ==========================================================================
  // Workflow State Management
  // ==========================================================================
  
  /**
   * Initialize or get a workflow's CRDT state
   */
  getOrCreateWorkflow(workflowId: string): CRDTWorkflowState {
    if (!this.workflows.has(workflowId)) {
      const state: CRDTWorkflowState = {
        workflowId,
        version: 0,
        vectorClock: {},
        nodes: new Map(),
        edges: new Map(),
        metadata: {},
        operationLog: [],
        presence: new Map(),
      };
      this.workflows.set(workflowId, state);
    }
    return this.workflows.get(workflowId)!;
  }
  
  /**
   * Get current workflow state (for syncing to new clients)
   */
  getWorkflowState(workflowId: string): {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    metadata: Record<string, unknown>;
    version: number;
    presence: CollaboratorPresence[];
  } | null {
    const state = this.workflows.get(workflowId);
    if (!state) return null;
    
    return {
      nodes: Array.from(state.nodes.values()).filter(n => !n.deleted),
      edges: Array.from(state.edges.values()).filter(e => !e.deleted),
      metadata: state.metadata,
      version: state.version,
      presence: Array.from(state.presence.values()),
    };
  }
  
  // ==========================================================================
  // CRDT Operations
  // ==========================================================================
  
  /**
   * Apply a local operation and generate CRDT operation
   */
  applyLocalOperation(
    workflowId: string,
    clientId: string,
    type: CRDTOperationType,
    targetId: string,
    payload: unknown
  ): CRDTOperation {
    const state = this.getOrCreateWorkflow(workflowId);
    
    // Increment vector clock for this client
    state.vectorClock[clientId] = (state.vectorClock[clientId] || 0) + 1;
    
    const operation: CRDTOperation = {
      operationId: uuidv4(),
      type,
      clientId,
      timestamp: Date.now(),
      vectorClock: { ...state.vectorClock },
      targetId,
      payload,
    };
    
    // Apply operation to state
    this.applyOperation(state, operation);
    
    // Add to operation log
    state.operationLog.push(operation);
    state.version++;
    
    // Keep only last 1000 operations
    if (state.operationLog.length > 1000) {
      state.operationLog = state.operationLog.slice(-1000);
    }
    
    logger.debug('Local operation applied', {
      workflowId,
      operationType: type,
      targetId,
      version: state.version,
    });
    
    return operation;
  }
  
  /**
   * Apply a remote operation received from another client
   */
  applyRemoteOperation(
    workflowId: string,
    operation: CRDTOperation
  ): { applied: boolean; conflicts: string[] } {
    const state = this.getOrCreateWorkflow(workflowId);
    const conflicts: string[] = [];
    
    // Check if operation is already applied (duplicate)
    const existingOp = state.operationLog.find(op => op.operationId === operation.operationId);
    if (existingOp) {
      return { applied: false, conflicts: ['Duplicate operation'] };
    }
    
    // Check causality - operation should have seen all our operations
    const isCausallyReady = this.isCausallyReady(state.vectorClock, operation.vectorClock, operation.clientId);
    
    if (!isCausallyReady) {
      // Buffer operation for later
      if (!this.pendingOperations.has(workflowId)) {
        this.pendingOperations.set(workflowId, []);
      }
      this.pendingOperations.get(workflowId)!.push(operation);
      return { applied: false, conflicts: ['Causality not satisfied - buffered'] };
    }
    
    // Check for conflicts
    const conflict = this.detectConflict(state, operation);
    if (conflict) {
      conflicts.push(conflict);
      // Resolve conflict using Last-Writer-Wins with client ID tiebreaker
      if (!this.shouldApply(state, operation)) {
        return { applied: false, conflicts };
      }
    }
    
    // Apply operation
    this.applyOperation(state, operation);
    
    // Update vector clock
    for (const [client, clock] of Object.entries(operation.vectorClock)) {
      state.vectorClock[client] = Math.max(state.vectorClock[client] || 0, clock);
    }
    
    state.operationLog.push(operation);
    state.version++;
    
    // Try to apply any buffered operations
    this.tryApplyPending(workflowId);
    
    return { applied: true, conflicts };
  }
  
  /**
   * Apply operation to state (internal)
   */
  private applyOperation(state: CRDTWorkflowState, operation: CRDTOperation): void {
    const { type, targetId, payload } = operation;
    
    switch (type) {
      case 'insert_node': {
        const node = payload as WorkflowNode;
        state.nodes.set(targetId, {
          ...node,
          nodeId: targetId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        break;
      }
      
      case 'delete_node': {
        const node = state.nodes.get(targetId);
        if (node) {
          node.deleted = true;
          node.updatedAt = new Date().toISOString();
        }
        // Also delete connected edges
        for (const edge of state.edges.values()) {
          if (edge.sourceNodeId === targetId || edge.targetNodeId === targetId) {
            edge.deleted = true;
          }
        }
        break;
      }
      
      case 'update_node': {
        const node = state.nodes.get(targetId);
        if (node && !node.deleted) {
          Object.assign(node, payload as Partial<WorkflowNode>);
          node.updatedAt = new Date().toISOString();
        }
        break;
      }
      
      case 'move_node': {
        const node = state.nodes.get(targetId);
        if (node && !node.deleted) {
          const position = payload as { x: number; y: number };
          node.position = position;
          node.updatedAt = new Date().toISOString();
        }
        break;
      }
      
      case 'insert_edge': {
        const edge = payload as WorkflowEdge;
        state.edges.set(targetId, {
          ...edge,
          edgeId: targetId,
          createdAt: new Date().toISOString(),
        });
        break;
      }
      
      case 'delete_edge': {
        const edge = state.edges.get(targetId);
        if (edge) {
          edge.deleted = true;
        }
        break;
      }
      
      case 'update_metadata': {
        Object.assign(state.metadata, payload as Record<string, unknown>);
        break;
      }
    }
  }
  
  // ==========================================================================
  // Conflict Resolution
  // ==========================================================================
  
  /**
   * Detect if operation conflicts with current state
   */
  private detectConflict(state: CRDTWorkflowState, operation: CRDTOperation): string | null {
    const { type, targetId } = operation;
    
    switch (type) {
      case 'update_node':
      case 'move_node':
      case 'delete_node': {
        const node = state.nodes.get(targetId);
        if (!node) return null;
        
        // Check if another recent operation touched this node
        const recentOps = state.operationLog.slice(-10);
        const conflictOp = recentOps.find(op => 
          op.targetId === targetId && 
          op.clientId !== operation.clientId &&
          op.timestamp > operation.timestamp - 5000 // Within 5 seconds
        );
        
        if (conflictOp) {
          return `Concurrent edit on node ${targetId} by ${conflictOp.clientId}`;
        }
        break;
      }
    }
    
    return null;
  }
  
  /**
   * Determine if operation should be applied (LWW with client ID tiebreaker)
   */
  private shouldApply(state: CRDTWorkflowState, operation: CRDTOperation): boolean {
    const recentOps = state.operationLog.filter(op => 
      op.targetId === operation.targetId && op.type === operation.type
    ).slice(-5);
    
    if (recentOps.length === 0) return true;
    
    const latestOp = recentOps[recentOps.length - 1];
    
    // Last-Writer-Wins: later timestamp wins
    if (operation.timestamp > latestOp.timestamp) return true;
    if (operation.timestamp < latestOp.timestamp) return false;
    
    // Tiebreaker: higher client ID wins (deterministic)
    return operation.clientId > latestOp.clientId;
  }
  
  /**
   * Check if operation is causally ready
   */
  private isCausallyReady(
    localClock: VectorClock,
    opClock: VectorClock,
    opClientId: string
  ): boolean {
    for (const [client, clock] of Object.entries(opClock)) {
      if (client === opClientId) {
        // For sender, their clock should be exactly one more than we've seen
        if (clock > (localClock[client] || 0) + 1) return false;
      } else {
        // For others, their clock should be <= what we've seen
        if (clock > (localClock[client] || 0)) return false;
      }
    }
    return true;
  }
  
  /**
   * Try to apply pending operations
   */
  private tryApplyPending(workflowId: string): void {
    const pending = this.pendingOperations.get(workflowId);
    if (!pending || pending.length === 0) return;
    
    const state = this.workflows.get(workflowId);
    if (!state) return;
    
    let applied = true;
    while (applied && pending.length > 0) {
      applied = false;
      
      for (let i = pending.length - 1; i >= 0; i--) {
        const op = pending[i];
        if (this.isCausallyReady(state.vectorClock, op.vectorClock, op.clientId)) {
          pending.splice(i, 1);
          this.applyRemoteOperation(workflowId, op);
          applied = true;
        }
      }
    }
  }
  
  // ==========================================================================
  // Presence Management
  // ==========================================================================
  
  /**
   * Update collaborator presence
   */
  updatePresence(
    workflowId: string,
    clientId: string,
    presence: Partial<CollaboratorPresence>
  ): void {
    const state = this.getOrCreateWorkflow(workflowId);
    
    const existing = state.presence.get(clientId);
    const colorIndex = Array.from(state.presence.keys()).indexOf(clientId);
    const color = this.PRESENCE_COLORS[colorIndex % this.PRESENCE_COLORS.length];
    
    state.presence.set(clientId, {
      clientId,
      userId: presence.userId || existing?.userId || clientId,
      userName: presence.userName || existing?.userName || 'Anonymous',
      color: existing?.color || color,
      cursor: presence.cursor ?? existing?.cursor,
      selectedNodeIds: presence.selectedNodeIds ?? existing?.selectedNodeIds ?? [],
      lastSeen: new Date().toISOString(),
    });
  }
  
  /**
   * Remove stale presence (clients not seen in 30 seconds)
   */
  cleanupPresence(workflowId: string): string[] {
    const state = this.workflows.get(workflowId);
    if (!state) return [];
    
    const staleThreshold = Date.now() - 30000;
    const removed: string[] = [];
    
    for (const [clientId, presence] of state.presence) {
      if (new Date(presence.lastSeen).getTime() < staleThreshold) {
        state.presence.delete(clientId);
        removed.push(clientId);
      }
    }
    
    return removed;
  }
  
  /**
   * Get all active collaborators
   */
  getCollaborators(workflowId: string): CollaboratorPresence[] {
    const state = this.workflows.get(workflowId);
    if (!state) return [];
    
    return Array.from(state.presence.values());
  }
  
  // ==========================================================================
  // Sync & Merge
  // ==========================================================================
  
  /**
   * Get operations since a specific version (for sync)
   */
  getOperationsSince(workflowId: string, sinceVersion: number): CRDTOperation[] {
    const state = this.workflows.get(workflowId);
    if (!state) return [];
    
    // Find operations after the given version
    const startIndex = Math.max(0, sinceVersion);
    return state.operationLog.slice(startIndex);
  }
  
  /**
   * Merge another workflow state (for offline sync)
   */
  mergeState(
    workflowId: string,
    remoteOperations: CRDTOperation[]
  ): { merged: number; conflicts: number } {
    let merged = 0;
    let conflicts = 0;
    
    // Sort operations by timestamp and vector clock
    const sorted = [...remoteOperations].sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return a.clientId.localeCompare(b.clientId);
    });
    
    for (const operation of sorted) {
      const result = this.applyRemoteOperation(workflowId, operation);
      if (result.applied) merged++;
      if (result.conflicts.length > 0) conflicts++;
    }
    
    return { merged, conflicts };
  }
  
  // ==========================================================================
  // Convenience Methods
  // ==========================================================================
  
  /**
   * Add a node (convenience wrapper)
   */
  addNode(
    workflowId: string,
    clientId: string,
    node: Omit<WorkflowNode, 'nodeId' | 'createdAt' | 'updatedAt'>
  ): CRDTOperation {
    const nodeId = uuidv4();
    return this.applyLocalOperation(workflowId, clientId, 'insert_node', nodeId, {
      ...node,
      nodeId,
      createdBy: clientId,
    });
  }
  
  /**
   * Delete a node (convenience wrapper)
   */
  deleteNode(workflowId: string, clientId: string, nodeId: string): CRDTOperation {
    return this.applyLocalOperation(workflowId, clientId, 'delete_node', nodeId, {});
  }
  
  /**
   * Move a node (convenience wrapper)
   */
  moveNode(
    workflowId: string,
    clientId: string,
    nodeId: string,
    position: { x: number; y: number }
  ): CRDTOperation {
    return this.applyLocalOperation(workflowId, clientId, 'move_node', nodeId, position);
  }
  
  /**
   * Add an edge (convenience wrapper)
   */
  addEdge(
    workflowId: string,
    clientId: string,
    sourceNodeId: string,
    targetNodeId: string,
    condition?: string
  ): CRDTOperation {
    const edgeId = uuidv4();
    return this.applyLocalOperation(workflowId, clientId, 'insert_edge', edgeId, {
      edgeId,
      sourceNodeId,
      targetNodeId,
      condition,
    });
  }
  
  /**
   * Delete an edge (convenience wrapper)
   */
  deleteEdge(workflowId: string, clientId: string, edgeId: string): CRDTOperation {
    return this.applyLocalOperation(workflowId, clientId, 'delete_edge', edgeId, {});
  }
}

// Singleton export
export const crdtWorkflowService = new CRDTWorkflowService();

export default crdtWorkflowService;
