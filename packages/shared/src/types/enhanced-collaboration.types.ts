/**
 * RADIANT v4.18.0 - Enhanced Collaboration Types
 * Novel collaboration: Cross-tenant guests, AI Facilitator, Branch/Merge,
 * Time-Shifted Playback, AI Roundtable, Shared Knowledge Graph
 */

// ============================================================================
// CROSS-TENANT GUEST ACCESS
// ============================================================================

export type InviteType = 'email' | 'link' | 'qr';
export type GuestPermission = 'viewer' | 'commenter' | 'editor';

export interface GuestInvite {
  id: string;
  sessionId: string;
  inviteToken: string;
  inviteType: InviteType;
  guestEmail?: string;
  guestName?: string;
  permission: GuestPermission;
  expiresAt?: Date;
  maxUses: number;
  currentUses: number;
  createdBy: string;
  createdAt: Date;
  lastUsedAt?: Date;
  referralCode: string;
  signupsFromInvite: number;
}

export interface CollaborationGuest {
  id: string;
  inviteId: string;
  sessionId: string;
  guestToken: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  linkedUserId?: string;
  linkedTenantId?: string;
  permission: GuestPermission;
  isOnline: boolean;
  lastSeenAt?: Date;
  color: string;
  joinedAt: Date;
  leftAt?: Date;
}

export interface CreateGuestInviteRequest {
  sessionId: string;
  inviteType: InviteType;
  guestEmail?: string;
  guestName?: string;
  permission?: GuestPermission;
  expiresAt?: Date;
  maxUses?: number;
}

export interface JoinAsGuestRequest {
  inviteToken: string;
  displayName: string;
  email?: string;
}

// ============================================================================
// AI FACILITATOR MODE
// ============================================================================

export type FacilitatorPersona = 'professional' | 'casual' | 'academic' | 'creative' | 'socratic' | 'coach';

export type InterventionType =
  | 'welcome'
  | 'summarize'
  | 'prompt_participation'
  | 'redirect_topic'
  | 'mediate_conflict'
  | 'suggest_break'
  | 'time_check'
  | 'action_items'
  | 'synthesize_viewpoints'
  | 'ask_clarification'
  | 'encourage'
  | 'wrap_up';

export interface FacilitatorConfig {
  id: string;
  sessionId: string;
  isEnabled: boolean;
  facilitatorModel: string;
  facilitatorPersona: FacilitatorPersona;
  autoSummarize: boolean;
  autoActionItems: boolean;
  ensureParticipation: boolean;
  keepOnTopic: boolean;
  timeBoxEnabled: boolean;
  timeBoxMinutes?: number;
  silenceThresholdSeconds: number;
  tangentDetectionEnabled: boolean;
  conflictMediationEnabled: boolean;
  sessionObjective?: string;
  sessionAgenda: AgendaItem[];
}

export interface AgendaItem {
  id: string;
  title: string;
  description?: string;
  durationMinutes?: number;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  completedAt?: Date;
}

export interface FacilitatorIntervention {
  id: string;
  sessionId: string;
  facilitatorId: string;
  interventionType: InterventionType;
  messageContent: string;
  targetParticipants: string[];
  triggerReason?: string;
  triggerData: Record<string, unknown>;
  wasHelpful?: boolean;
  participantReactions: Record<string, string[]>;
  createdAt: Date;
}

export interface EnableFacilitatorRequest {
  sessionId: string;
  persona?: FacilitatorPersona;
  model?: string;
  objective?: string;
  agenda?: Omit<AgendaItem, 'id' | 'status'>[];
  settings?: Partial<Pick<FacilitatorConfig, 
    'autoSummarize' | 'autoActionItems' | 'ensureParticipation' | 
    'keepOnTopic' | 'timeBoxEnabled' | 'timeBoxMinutes' |
    'silenceThresholdSeconds' | 'tangentDetectionEnabled' | 'conflictMediationEnabled'
  >>;
}

// ============================================================================
// BRANCH & MERGE CONVERSATIONS
// ============================================================================

export type BranchStatus = 'active' | 'merged' | 'abandoned' | 'archived';
export type MergeRequestStatus = 'pending' | 'approved' | 'rejected' | 'merged';

export interface ConversationBranch {
  id: string;
  sessionId: string;
  branchName: string;
  branchDescription?: string;
  branchColor: string;
  parentBranchId?: string;
  forkPointMessageId?: string;
  createdBy: string;
  status: BranchStatus;
  mergedIntoId?: string;
  mergedAt?: Date;
  mergedBy?: string;
  explorationHypothesis?: string;
  explorationConclusion?: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount?: number;
  participants?: string[];
}

export interface BranchMergeRequest {
  id: string;
  sessionId: string;
  sourceBranchId: string;
  targetBranchId: string;
  title: string;
  description?: string;
  keyInsights: string[];
  status: MergeRequestStatus;
  reviewers: string[];
  approvals: string[];
  aiMergeSummary?: string;
  aiConflictAnalysis?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  sourceBranch?: ConversationBranch;
  targetBranch?: ConversationBranch;
}

export interface CreateBranchRequest {
  sessionId: string;
  branchName: string;
  branchDescription?: string;
  branchColor?: string;
  parentBranchId?: string;
  forkPointMessageId?: string;
  explorationHypothesis?: string;
}

export interface CreateMergeRequestRequest {
  sessionId: string;
  sourceBranchId: string;
  targetBranchId: string;
  title: string;
  description?: string;
  keyInsights?: string[];
}

// ============================================================================
// TIME-SHIFTED PLAYBACK
// ============================================================================

export type RecordingType = 'full' | 'highlights' | 'summary';
export type MediaType = 'voice' | 'video' | 'screen';
export type TranscriptionStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type AnnotationType = 'agree' | 'disagree' | 'question' | 'insight' | 'action_item' | 'bookmark';

export interface SessionRecording {
  id: string;
  sessionId: string;
  recordingType: RecordingType;
  title?: string;
  startTime: Date;
  endTime?: Date;
  durationSeconds?: number;
  events: RecordingEvent[];
  aiSummary?: string;
  aiKeyMoments: KeyMoment[];
  playbackSpeedOptions: number[];
  createdAt: Date;
}

export interface RecordingEvent {
  timestamp: Date;
  type: 'message' | 'join' | 'leave' | 'reaction' | 'branch' | 'intervention';
  participantId?: string;
  participantName?: string;
  data: Record<string, unknown>;
}

export interface KeyMoment {
  timestamp: Date;
  title: string;
  description?: string;
  importance: number;
  type: 'insight' | 'decision' | 'conflict' | 'breakthrough' | 'action_item';
}

export interface SessionMediaNote {
  id: string;
  sessionId: string;
  messageId?: string;
  participantId: string;
  mediaType: MediaType;
  s3Bucket: string;
  s3Key: string;
  s3Region: string;
  fileSizeBytes: number;
  durationSeconds?: number;
  transcription?: string;
  transcriptionStatus: TranscriptionStatus;
  thumbnailS3Key?: string;
  waveformData?: number[];
  createdAt: Date;
  presignedUrl?: string;
  thumbnailUrl?: string;
}

export interface AsyncAnnotation {
  id: string;
  sessionId: string;
  targetType: 'message' | 'branch' | 'recording' | 'summary';
  targetId: string;
  annotationType: AnnotationType;
  content?: string;
  participantId?: string;
  guestId?: string;
  createdAt: Date;
  authorName?: string;
  authorColor?: string;
}

export interface CreateMediaNoteRequest {
  sessionId: string;
  messageId?: string;
  mediaType: MediaType;
  file: File | Blob;
}

// ============================================================================
// AI ROUNDTABLE (Multi-Model Debate)
// ============================================================================

export type DebateStyle = 'collaborative' | 'adversarial' | 'socratic' | 'brainstorm' | 'devils_advocate';
export type RoundtableStatus = 'setup' | 'active' | 'paused' | 'completed';

export interface ModelParticipant {
  modelId: string;
  persona: string;
  role: string;
  color: string;
  avatar?: string;
  systemPrompt?: string;
}

export interface AIRoundtable {
  id: string;
  sessionId: string;
  topic: string;
  context?: string;
  models: ModelParticipant[];
  moderatorModel?: string;
  debateStyle: DebateStyle;
  maxRounds: number;
  currentRound: number;
  status: RoundtableStatus;
  synthesis?: string;
  consensusPoints: string[];
  disagreementPoints: string[];
  actionRecommendations: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoundtableContribution {
  id: string;
  roundtableId: string;
  sessionId: string;
  modelId: string;
  modelPersona?: string;
  modelRole?: string;
  roundNumber: number;
  content: string;
  respondingToId?: string;
  tokensUsed?: number;
  latencyMs?: number;
  humanReactions: Record<string, string[]>;
  humanVotes: number;
  createdAt: Date;
}

export interface CreateRoundtableRequest {
  sessionId: string;
  topic: string;
  context?: string;
  models: Omit<ModelParticipant, 'color'>[];
  moderatorModel?: string;
  debateStyle?: DebateStyle;
  maxRounds?: number;
}

// ============================================================================
// SHARED KNOWLEDGE GRAPH
// ============================================================================

export type NodeType = 'concept' | 'fact' | 'question' | 'decision' | 'action_item' | 'person' | 'resource';
export type RelationshipType = 
  | 'relates_to' | 'causes' | 'depends_on' | 'contradicts' | 'supports'
  | 'part_of' | 'leads_to' | 'answers' | 'blocks' | 'enables';
export type EdgeStyle = 'solid' | 'dashed' | 'dotted';
export type LayoutType = 'force' | 'hierarchical' | 'radial' | 'timeline';

export interface KnowledgeGraph {
  id: string;
  sessionId: string;
  title: string;
  description?: string;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  layoutType: LayoutType;
  layoutConfig: Record<string, unknown>;
  aiGaps: KnowledgeGap[];
  aiSuggestions: string[];
  aiSummary?: string;
  version: number;
  lastUpdatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeNode {
  id: string;
  graphId: string;
  sessionId: string;
  nodeType: NodeType;
  label: string;
  description?: string;
  color?: string;
  icon?: string;
  size: number;
  x?: number;
  y?: number;
  sourceMessageId?: string;
  sourceBranchId?: string;
  confidence: number;
  importance: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeEdge {
  id: string;
  graphId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType: RelationshipType;
  label?: string;
  weight: number;
  color?: string;
  style: EdgeStyle;
  createdBy?: string;
  createdAt: Date;
}

export interface KnowledgeGap {
  topic: string;
  reason: string;
  suggestedQuestions: string[];
  relatedNodes: string[];
}

export interface CreateNodeRequest {
  graphId: string;
  nodeType: NodeType;
  label: string;
  description?: string;
  sourceMessageId?: string;
  x?: number;
  y?: number;
}

export interface CreateEdgeRequest {
  graphId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType: RelationshipType;
  label?: string;
}

// ============================================================================
// COLLABORATION ATTACHMENTS
// ============================================================================

export type ProcessingStatus = 'uploading' | 'uploaded' | 'processing' | 'ready' | 'failed';

export interface CollaborationAttachment {
  id: string;
  sessionId: string;
  messageId?: string;
  participantId?: string;
  guestId?: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  s3Bucket: string;
  s3Key: string;
  s3Region: string;
  thumbnailS3Key?: string;
  processingStatus: ProcessingStatus;
  processingMetadata: Record<string, unknown>;
  downloadCount: number;
  lastAccessedAt?: Date;
  createdAt: Date;
  presignedUrl?: string;
  thumbnailUrl?: string;
}

export interface UploadAttachmentRequest {
  sessionId: string;
  messageId?: string;
  file: File;
}

// ============================================================================
// ENHANCED SESSION WITH ALL FEATURES
// ============================================================================

export interface EnhancedCollaborativeSession {
  id: string;
  tenantId: string;
  conversationId: string;
  ownerId: string;
  name?: string;
  description?: string;
  color: string;
  accessType: 'invite' | 'link' | 'public';
  linkToken?: string;
  defaultPermission: GuestPermission;
  isActive: boolean;
  maxParticipants: number;
  allowAnonymous: boolean;
  requireApproval: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  
  // Enhanced features
  facilitator?: FacilitatorConfig;
  branches: ConversationBranch[];
  activeBranchId?: string;
  roundtables: AIRoundtable[];
  activeRoundtableId?: string;
  knowledgeGraph?: KnowledgeGraph;
  recordings: SessionRecording[];
  
  // Participants
  participants: SessionParticipant[];
  guests: CollaborationGuest[];
  onlineCount: number;
}

export interface SessionParticipant {
  id: string;
  sessionId: string;
  userId?: string;
  anonymousId?: string;
  anonymousName?: string;
  permission: 'owner' | 'editor' | 'commenter' | 'viewer';
  invitedBy?: string;
  invitedAt: Date;
  joinedAt?: Date;
  status: 'pending' | 'active' | 'declined' | 'removed' | 'left';
  isOnline: boolean;
  lastSeenAt?: Date;
  cursorPosition?: { messageId: string; offset: number };
  color: string;
  isTyping?: boolean;
  name?: string;
  avatarUrl?: string;
}
