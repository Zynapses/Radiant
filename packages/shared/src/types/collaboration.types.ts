// RADIANT v4.18.0 - Real-Time Collaboration Types
// Google Docs-style collaborative session types

// ============================================================================
// Session Types
// ============================================================================

export type AccessType = 'invite' | 'link' | 'public';
export type Permission = 'owner' | 'editor' | 'commenter' | 'viewer';
export type ParticipantStatus = 'pending' | 'active' | 'declined' | 'removed' | 'left';
export type MessageStatus = 'typing' | 'sent' | 'delivered' | 'edited' | 'deleted';

export interface CollaborativeSession {
  id: string;
  tenantId: string;
  conversationId: string;
  ownerId: string;
  name: string | null;
  description: string | null;
  color: string;
  accessType: AccessType;
  linkToken: string | null;
  defaultPermission: Permission;
  isActive: boolean;
  maxParticipants: number;
  allowAnonymous: boolean;
  requireApproval: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
}

export interface SessionParticipant {
  id: string;
  sessionId: string;
  userId: string | null;
  anonymousId: string | null;
  anonymousName: string | null;
  permission: Permission;
  invitedBy: string | null;
  invitedAt: Date;
  joinedAt: Date | null;
  status: ParticipantStatus;
  isOnline: boolean;
  lastSeenAt: Date | null;
  cursorPosition: CursorPosition | null;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CursorPosition {
  messageId: string;
  offset: number;
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  conversationMessageId: string | null;
  participantId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string | null;
  isTyping: boolean;
  typingContent: string | null;
  parentMessageId: string | null;
  threadCount: number;
  reactions: Record<string, string[]>; // emoji -> userIds
  tokensUsed: number | null;
  cost: number | null;
  latencyMs: number | null;
  status: MessageStatus;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionComment {
  id: string;
  sessionId: string;
  messageId: string;
  participantId: string;
  content: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  selectedText: string | null;
  parentCommentId: string | null;
  isResolved: boolean;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionActivity {
  id: string;
  sessionId: string;
  participantId: string | null;
  activityType: ActivityType;
  activityData: Record<string, unknown>;
  createdAt: Date;
}

export type ActivityType =
  | 'session_created'
  | 'participant_joined'
  | 'participant_left'
  | 'participant_invited'
  | 'participant_removed'
  | 'message_sent'
  | 'message_edited'
  | 'message_deleted'
  | 'comment_added'
  | 'comment_resolved'
  | 'reaction_added'
  | 'reaction_removed'
  | 'permission_changed'
  | 'settings_changed';

// ============================================================================
// WebSocket Event Types
// ============================================================================

export type WebSocketEventType =
  | 'connect'
  | 'disconnect'
  | 'join_session'
  | 'leave_session'
  | 'presence_update'
  | 'cursor_move'
  | 'typing_start'
  | 'typing_stop'
  | 'message_send'
  | 'message_edit'
  | 'message_delete'
  | 'message_react'
  | 'comment_add'
  | 'comment_resolve'
  | 'participant_invite'
  | 'participant_remove'
  | 'permission_update'
  | 'ai_response_start'
  | 'ai_response_stream'
  | 'ai_response_end'
  | 'error';

export interface WebSocketMessage<T = unknown> {
  type: WebSocketEventType;
  sessionId: string;
  participantId?: string;
  payload: T;
  timestamp: number;
  requestId?: string;
}

// Specific payload types
export interface JoinSessionPayload {
  linkToken?: string;
  anonymousName?: string;
}

export interface PresenceUpdatePayload {
  participants: ParticipantPresence[];
}

export interface ParticipantPresence {
  id: string;
  userId: string | null;
  name: string;
  avatarUrl: string | null;
  color: string;
  isOnline: boolean;
  lastSeenAt: Date | null;
  cursorPosition: CursorPosition | null;
  isTyping: boolean;
}

export interface CursorMovePayload {
  messageId: string;
  offset: number;
}

export interface TypingPayload {
  content?: string;
}

export interface MessageSendPayload {
  content: string;
  parentMessageId?: string;
  model?: string;
}

export interface MessageEditPayload {
  messageId: string;
  content: string;
}

export interface MessageDeletePayload {
  messageId: string;
}

export interface MessageReactPayload {
  messageId: string;
  emoji: string;
  action: 'add' | 'remove';
}

export interface CommentAddPayload {
  messageId: string;
  content: string;
  selectionStart?: number;
  selectionEnd?: number;
  selectedText?: string;
  parentCommentId?: string;
}

export interface CommentResolvePayload {
  commentId: string;
}

export interface ParticipantInvitePayload {
  email?: string;
  userId?: string;
  permission: Permission;
}

export interface ParticipantRemovePayload {
  participantId: string;
}

export interface PermissionUpdatePayload {
  participantId: string;
  permission: Permission;
}

export interface AIResponseStreamPayload {
  messageId: string;
  content: string;
  isComplete: boolean;
  tokensUsed?: number;
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateSessionRequest {
  conversationId: string;
  name?: string;
  description?: string;
  accessType?: AccessType;
  defaultPermission?: Permission;
  maxParticipants?: number;
  allowAnonymous?: boolean;
  requireApproval?: boolean;
}

export interface CreateSessionResponse {
  session: CollaborativeSession;
  shareLink: string;
  participant: SessionParticipant;
}

export interface JoinSessionRequest {
  linkToken: string;
  anonymousName?: string;
}

export interface JoinSessionResponse {
  session: CollaborativeSession;
  participant: SessionParticipant;
  participants: ParticipantPresence[];
  messages: SessionMessage[];
  websocketUrl: string;
}

export interface UpdateSessionRequest {
  name?: string;
  description?: string;
  accessType?: AccessType;
  defaultPermission?: Permission;
  maxParticipants?: number;
  allowAnonymous?: boolean;
  requireApproval?: boolean;
  isActive?: boolean;
}

export interface InviteParticipantsRequest {
  invites: Array<{
    email?: string;
    userId?: string;
    permission: Permission;
  }>;
}

export interface SessionSummary {
  id: string;
  name: string | null;
  conversationTitle: string | null;
  participantCount: number;
  onlineCount: number;
  messageCount: number;
  lastActivityAt: Date;
  myPermission: Permission;
  isOwner: boolean;
}

// ============================================================================
// UI State Types
// ============================================================================

export interface CollaborationState {
  session: CollaborativeSession | null;
  participants: ParticipantPresence[];
  messages: SessionMessage[];
  comments: SessionComment[];
  myParticipant: SessionParticipant | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  typingParticipants: Map<string, string>; // participantId -> content
  unreadComments: number;
}

export interface CollaborationUIConfig {
  showPresenceAvatars: boolean;
  showTypingIndicators: boolean;
  showCursors: boolean;
  showComments: boolean;
  enableReactions: boolean;
  enableThreads: boolean;
  compactMode: boolean;
  theme: 'light' | 'dark' | 'system';
}

// Permission checks
export const canEdit = (permission: Permission): boolean =>
  permission === 'owner' || permission === 'editor';

export const canComment = (permission: Permission): boolean =>
  permission === 'owner' || permission === 'editor' || permission === 'commenter';

export const canView = (permission: Permission): boolean => true;

export const canManageParticipants = (permission: Permission): boolean =>
  permission === 'owner';

export const canChangeSettings = (permission: Permission): boolean =>
  permission === 'owner';

// Presence colors
export const PRESENCE_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
] as const;

export const getPresenceColor = (index: number): string =>
  PRESENCE_COLORS[index % PRESENCE_COLORS.length];
