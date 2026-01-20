/**
 * Structure from Chaos Synthesis Types
 * 
 * Moat #20: AI transforms whiteboard chaos → structured decisions, data, project plans.
 * Think Tank differentiation vs Miro/Mural.
 */

export interface ChaoticInput {
  id: string;
  tenantId: string;
  userId: string;
  sessionId: string;
  inputType: ChaoticInputType;
  rawContent: string;
  attachments?: ChaoticAttachment[];
  context?: string;
  createdAt: Date;
}

export type ChaoticInputType =
  | 'whiteboard'
  | 'brainstorm'
  | 'meeting_notes'
  | 'voice_transcript'
  | 'chat_history'
  | 'document_dump'
  | 'mixed';

export interface ChaoticAttachment {
  id: string;
  type: 'image' | 'document' | 'audio' | 'link';
  url: string;
  extractedText?: string;
  metadata?: Record<string, unknown>;
}

export interface StructuredOutput {
  id: string;
  inputId: string;
  outputType: StructuredOutputType;
  title: string;
  summary: string;
  content: StructuredContent;
  confidence: number;
  processingTimeMs: number;
  createdAt: Date;
}

export type StructuredOutputType =
  | 'decisions'
  | 'action_items'
  | 'project_plan'
  | 'meeting_summary'
  | 'knowledge_base'
  | 'data_table'
  | 'timeline'
  | 'hierarchy'
  | 'comparison';

export interface StructuredContent {
  sections: ContentSection[];
  entities: ChaosExtractedEntity[];
  relationships: ChaosEntityRelationship[];
  metadata: ContentMetadata;
}

export interface ContentSection {
  id: string;
  title: string;
  type: ChaosSectionType;
  content: string;
  items?: StructuredItem[];
  subsections?: ContentSection[];
  order: number;
}

export type ChaosSectionType =
  | 'header'
  | 'paragraph'
  | 'list'
  | 'table'
  | 'timeline'
  | 'decision'
  | 'action'
  | 'question'
  | 'insight';

export interface StructuredItem {
  id: string;
  type: ItemType;
  content: string;
  assignee?: string;
  dueDate?: Date;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'pending' | 'in_progress' | 'completed' | 'blocked';
  tags?: string[];
  dependencies?: string[];
}

export type ItemType =
  | 'decision'
  | 'action_item'
  | 'question'
  | 'insight'
  | 'risk'
  | 'opportunity'
  | 'milestone'
  | 'blocker';

export interface ChaosExtractedEntity {
  id: string;
  type: ChaosEntityType;
  name: string;
  mentions: EntityMention[];
  attributes: Record<string, unknown>;
  confidence: number;
}

export type ChaosEntityType =
  | 'person'
  | 'organization'
  | 'project'
  | 'product'
  | 'date'
  | 'location'
  | 'concept'
  | 'metric'
  | 'resource';

export interface EntityMention {
  start: number;
  end: number;
  text: string;
  context: string;
}

export interface ChaosEntityRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: ChaosRelationshipType;
  strength: number;
  evidence: string;
}

export type ChaosRelationshipType =
  | 'owns'
  | 'assigned_to'
  | 'depends_on'
  | 'blocks'
  | 'related_to'
  | 'parent_of'
  | 'precedes'
  | 'contradicts'
  | 'supports';

export interface ContentMetadata {
  wordCount: number;
  entityCount: number;
  actionItemCount: number;
  decisionCount: number;
  questionCount: number;
  insightCount: number;
  keyTopics: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface SynthesisConfig {
  tenantId: string;
  enabled: boolean;
  defaultOutputType: StructuredOutputType;
  extractEntities: boolean;
  extractRelationships: boolean;
  generateTimeline: boolean;
  generateActionItems: boolean;
  autoAssignTasks: boolean;
  confidenceThreshold: number;
  maxProcessingTimeMs: number;
}

export interface SynthesisRequest {
  input: ChaoticInput;
  outputTypes: StructuredOutputType[];
  options?: {
    focusAreas?: string[];
    excludeTypes?: ItemType[];
    assigneeHints?: Record<string, string>;
    projectContext?: string;
  };
}

export interface ChaosSynthesisResult {
  requestId: string;
  input: ChaoticInput;
  outputs: StructuredOutput[];
  processingSteps: ProcessingStep[];
  totalTimeMs: number;
  tokensUsed: number;
  costUsd: number;
}

export interface ProcessingStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  details?: string;
}

export interface WhiteboardElement {
  id: string;
  type: 'sticky' | 'shape' | 'connector' | 'text' | 'image' | 'frame';
  content: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  color?: string;
  connectedTo?: string[];
  groupId?: string;
}

export interface WhiteboardCluster {
  id: string;
  elements: WhiteboardElement[];
  theme: string;
  centroid: { x: number; y: number };
  significance: number;
}

export interface SynthesisMetrics {
  tenantId: string;
  period: string;
  totalSyntheses: number;
  byInputType: Record<ChaoticInputType, number>;
  byOutputType: Record<StructuredOutputType, number>;
  averageProcessingMs: number;
  averageConfidence: number;
  totalActionItemsGenerated: number;
  totalDecisionsExtracted: number;
  totalEntitiesFound: number;
}
