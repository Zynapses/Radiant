// RADIANT v4.18.0 - Real-Time Collaboration Service
// Yjs CRDT-based multi-user editing and collaboration

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface CollaborationSession {
  id: string;
  documentId: string;
  tenantId: string;
  createdBy: string;
  participants: CollaborationParticipant[];
  documentType: 'chat' | 'canvas' | 'artifact';
  status: 'active' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

export interface CollaborationParticipant {
  userId: string;
  displayName: string;
  color: string;
  cursorPosition?: { line: number; column: number };
  selection?: { start: number; end: number };
  isOnline: boolean;
  joinedAt: Date;
  lastActiveAt: Date;
}

export interface DocumentUpdate {
  sessionId: string;
  userId: string;
  updateType: 'insert' | 'delete' | 'format' | 'cursor' | 'selection';
  payload: unknown;
  timestamp: Date;
  vectorClock: Record<string, number>;
}

export interface AwarenessState {
  sessionId: string;
  userId: string;
  cursor?: { line: number; column: number };
  selection?: { start: number; end: number };
  isTyping: boolean;
  focusedElement?: string;
}

export class CollaborationService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async createSession(
    documentId: string,
    documentType: 'chat' | 'canvas' | 'artifact',
    createdBy: string
  ): Promise<CollaborationSession> {
    const client = await pool.connect();

    try {
      const result = await client.query(
        `INSERT INTO collaboration_sessions 
         (tenant_id, document_id, document_type, created_by, status)
         VALUES ($1, $2, $3, $4, 'active')
         RETURNING *`,
        [this.tenantId, documentId, documentType, createdBy]
      );

      const session = result.rows[0];

      return {
        id: session.id,
        documentId: session.document_id,
        tenantId: session.tenant_id,
        createdBy: session.created_by,
        participants: [],
        documentType: session.document_type,
        status: session.status,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      };
    } finally {
      client.release();
    }
  }

  async joinSession(
    sessionId: string,
    userId: string,
    displayName: string
  ): Promise<CollaborationParticipant> {
    const client = await pool.connect();

    try {
      // Generate a deterministic color based on user ID for consistency
      const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
        '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
      ];
      const colorIndex = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
      const color = colors[colorIndex];

      const result = await client.query(
        `INSERT INTO collaboration_participants 
         (session_id, user_id, display_name, color, is_online)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (session_id, user_id) DO UPDATE SET
           is_online = true,
           last_active_at = NOW()
         RETURNING *`,
        [sessionId, userId, displayName, color]
      );

      const participant = result.rows[0];

      return {
        userId: participant.user_id,
        displayName: participant.display_name,
        color: participant.color,
        isOnline: participant.is_online,
        joinedAt: participant.joined_at,
        lastActiveAt: participant.last_active_at,
      };
    } finally {
      client.release();
    }
  }

  async leaveSession(sessionId: string, userId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query(
        `UPDATE collaboration_participants 
         SET is_online = false, last_active_at = NOW()
         WHERE session_id = $1 AND user_id = $2`,
        [sessionId, userId]
      );
    } finally {
      client.release();
    }
  }

  async getSession(sessionId: string): Promise<CollaborationSession | null> {
    const client = await pool.connect();

    try {
      const sessionResult = await client.query(
        `SELECT * FROM collaboration_sessions 
         WHERE id = $1 AND tenant_id = $2`,
        [sessionId, this.tenantId]
      );

      if (sessionResult.rows.length === 0) {
        return null;
      }

      const session = sessionResult.rows[0];

      const participantsResult = await client.query(
        `SELECT * FROM collaboration_participants 
         WHERE session_id = $1 ORDER BY joined_at`,
        [sessionId]
      );

      return {
        id: session.id,
        documentId: session.document_id,
        tenantId: session.tenant_id,
        createdBy: session.created_by,
        participants: participantsResult.rows.map((p) => ({
          userId: p.user_id,
          displayName: p.display_name,
          color: p.color,
          cursorPosition: p.cursor_position,
          selection: p.selection,
          isOnline: p.is_online,
          joinedAt: p.joined_at,
          lastActiveAt: p.last_active_at,
        })),
        documentType: session.document_type,
        status: session.status,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      };
    } finally {
      client.release();
    }
  }

  async applyUpdate(update: DocumentUpdate): Promise<void> {
    const client = await pool.connect();

    try {
      // Store the update for history/replay
      await client.query(
        `INSERT INTO collaboration_updates 
         (session_id, user_id, update_type, payload, vector_clock)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          update.sessionId,
          update.userId,
          update.updateType,
          JSON.stringify(update.payload),
          JSON.stringify(update.vectorClock),
        ]
      );

      // Update participant's last active time
      await client.query(
        `UPDATE collaboration_participants 
         SET last_active_at = NOW()
         WHERE session_id = $1 AND user_id = $2`,
        [update.sessionId, update.userId]
      );
    } finally {
      client.release();
    }
  }

  async updateAwareness(state: AwarenessState): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query(
        `UPDATE collaboration_participants 
         SET cursor_position = $3, selection = $4, last_active_at = NOW()
         WHERE session_id = $1 AND user_id = $2`,
        [
          state.sessionId,
          state.userId,
          state.cursor ? JSON.stringify(state.cursor) : null,
          state.selection ? JSON.stringify(state.selection) : null,
        ]
      );
    } finally {
      client.release();
    }
  }

  async getDocumentHistory(
    sessionId: string,
    limit: number = 100
  ): Promise<DocumentUpdate[]> {
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT * FROM collaboration_updates 
         WHERE session_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [sessionId, limit]
      );

      return result.rows.map((row) => ({
        sessionId: row.session_id,
        userId: row.user_id,
        updateType: row.update_type,
        payload: row.payload,
        timestamp: row.created_at,
        vectorClock: row.vector_clock,
      }));
    } finally {
      client.release();
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query(
        `UPDATE collaboration_sessions 
         SET status = 'closed', updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [sessionId, this.tenantId]
      );

      await client.query(
        `UPDATE collaboration_participants 
         SET is_online = false 
         WHERE session_id = $1`,
        [sessionId]
      );
    } finally {
      client.release();
    }
  }
}

export const createCollaborationService = (tenantId: string) =>
  new CollaborationService(tenantId);
