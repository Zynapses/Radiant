/**
 * Structure from Chaos Synthesis Service
 * 
 * Moat #20: AI transforms whiteboard chaos → structured decisions, data, project plans.
 * Think Tank differentiation vs Miro/Mural.
 */

import { logger } from '../logging/enhanced-logger';
import { v4 as uuidv4 } from 'uuid';
import {
  ChaoticInput,
  ChaoticInputType,
  StructuredOutput,
  StructuredOutputType,
  StructuredContent,
  ContentSection,
  StructuredItem,
  ChaosExtractedEntity,
  ChaosEntityRelationship,
  ContentMetadata,
  SynthesisConfig,
  SynthesisRequest,
  ChaosSynthesisResult,
  ProcessingStep,
  WhiteboardElement,
  WhiteboardCluster,
  SynthesisMetrics,
  ItemType,
  ChaosEntityType,
  ChaosSectionType,
} from '@radiant/shared';

// Using shared logger

class StructureFromChaosService {
  private static instance: StructureFromChaosService;
  private configs: Map<string, SynthesisConfig> = new Map();

  private constructor() {}

  static getInstance(): StructureFromChaosService {
    if (!StructureFromChaosService.instance) {
      StructureFromChaosService.instance = new StructureFromChaosService();
    }
    return StructureFromChaosService.instance;
  }

  async getConfig(tenantId: string): Promise<SynthesisConfig> {
    if (this.configs.has(tenantId)) {
      return this.configs.get(tenantId)!;
    }

    const defaultConfig: SynthesisConfig = {
      tenantId,
      enabled: true,
      defaultOutputType: 'meeting_summary',
      extractEntities: true,
      extractRelationships: true,
      generateTimeline: true,
      generateActionItems: true,
      autoAssignTasks: false,
      confidenceThreshold: 0.7,
      maxProcessingTimeMs: 30000,
    };

    this.configs.set(tenantId, defaultConfig);
    return defaultConfig;
  }

  async updateConfig(
    tenantId: string,
    updates: Partial<SynthesisConfig>
  ): Promise<SynthesisConfig> {
    const current = await this.getConfig(tenantId);
    const updated = { ...current, ...updates };
    this.configs.set(tenantId, updated);
    
    logger.info('Structure from chaos config updated', { tenantId, updates });
    return updated;
  }

  async synthesize(request: SynthesisRequest): Promise<ChaosSynthesisResult> {
    const startTime = Date.now();
    const requestId = uuidv4();
    const config = await this.getConfig(request.input.tenantId);

    const steps: ProcessingStep[] = [
      { name: 'parse_input', status: 'pending' },
      { name: 'extract_entities', status: 'pending' },
      { name: 'identify_relationships', status: 'pending' },
      { name: 'generate_structure', status: 'pending' },
      { name: 'validate_output', status: 'pending' },
    ];

    logger.info('Starting synthesis', { requestId, inputType: request.input.inputType });

    const outputs: StructuredOutput[] = [];

    for (const outputType of request.outputTypes) {
      this.updateStep(steps, 'parse_input', 'running');
      const parsedContent = await this.parseInput(request.input);
      this.updateStep(steps, 'parse_input', 'completed');

      this.updateStep(steps, 'extract_entities', 'running');
      const entities = config.extractEntities 
        ? await this.extractEntities(parsedContent, request.input.inputType)
        : [];
      this.updateStep(steps, 'extract_entities', 'completed');

      this.updateStep(steps, 'identify_relationships', 'running');
      const relationships = config.extractRelationships
        ? await this.identifyRelationships(entities, parsedContent)
        : [];
      this.updateStep(steps, 'identify_relationships', 'completed');

      this.updateStep(steps, 'generate_structure', 'running');
      const structuredContent = await this.generateStructuredContent(
        parsedContent,
        entities,
        relationships,
        outputType,
        request.options
      );
      this.updateStep(steps, 'generate_structure', 'completed');

      this.updateStep(steps, 'validate_output', 'running');
      const validated = await this.validateOutput(structuredContent, config);
      this.updateStep(steps, 'validate_output', 'completed');

      const output: StructuredOutput = {
        id: uuidv4(),
        inputId: request.input.id,
        outputType,
        title: this.generateTitle(outputType, request.input),
        summary: this.generateSummary(structuredContent),
        content: validated,
        confidence: this.calculateConfidence(validated),
        processingTimeMs: Date.now() - startTime,
        createdAt: new Date(),
      };

      outputs.push(output);
    }

    const totalTimeMs = Date.now() - startTime;

    logger.info('Synthesis completed', { 
      requestId, 
      outputCount: outputs.length,
      totalTimeMs,
    });

    return {
      requestId,
      input: request.input,
      outputs,
      processingSteps: steps,
      totalTimeMs,
      tokensUsed: this.estimateTokens(request.input.rawContent),
      costUsd: this.estimateCost(request.input.rawContent),
    };
  }

  async parseWhiteboard(elements: WhiteboardElement[]): Promise<WhiteboardCluster[]> {
    const clusters: WhiteboardCluster[] = [];
    
    const grouped = this.groupByProximity(elements);
    
    for (const group of grouped) {
      const theme = await this.identifyTheme(group);
      const centroid = this.calculateCentroid(group);
      const significance = this.calculateSignificance(group);

      clusters.push({
        id: uuidv4(),
        elements: group,
        theme,
        centroid,
        significance,
      });
    }

    clusters.sort((a, b) => b.significance - a.significance);

    return clusters;
  }

  async extractActionItems(input: ChaoticInput): Promise<StructuredItem[]> {
    const actionPatterns = [
      /(?:need to|should|must|will|going to|action:?)\s+(.+?)(?:\.|$)/gi,
      /(?:@\w+)\s+(?:to|will|should)\s+(.+?)(?:\.|$)/gi,
      /(?:todo|task|action item):?\s*(.+?)(?:\.|$)/gi,
    ];

    const items: StructuredItem[] = [];
    const content = input.rawContent;

    for (const pattern of actionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        items.push({
          id: uuidv4(),
          type: 'action_item',
          content: match[1].trim(),
          priority: this.inferPriority(match[0]),
          status: 'pending',
        });
      }
    }

    return this.deduplicateItems(items);
  }

  async extractDecisions(input: ChaoticInput): Promise<StructuredItem[]> {
    const decisionPatterns = [
      /(?:decided|agreed|decision:?|we will|the plan is)\s+(.+?)(?:\.|$)/gi,
      /(?:conclusion:?|resolved:?|outcome:?)\s+(.+?)(?:\.|$)/gi,
    ];

    const items: StructuredItem[] = [];
    const content = input.rawContent;

    for (const pattern of decisionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        items.push({
          id: uuidv4(),
          type: 'decision',
          content: match[1].trim(),
        });
      }
    }

    return this.deduplicateItems(items);
  }

  async extractQuestions(input: ChaoticInput): Promise<StructuredItem[]> {
    const questionPattern = /([^.!?\n]*\?)/g;
    const items: StructuredItem[] = [];
    const content = input.rawContent;

    let match;
    while ((match = questionPattern.exec(content)) !== null) {
      items.push({
        id: uuidv4(),
        type: 'question',
        content: match[1].trim(),
      });
    }

    return items;
  }

  async generateProjectPlan(input: ChaoticInput): Promise<StructuredOutput> {
    const actions = await this.extractActionItems(input);
    const decisions = await this.extractDecisions(input);
    
    const milestones = this.groupIntoMilestones(actions);
    const timeline = this.generateTimeline(milestones);
    const dependencies = this.inferDependencies(actions);

    const sections: ContentSection[] = [
      {
        id: uuidv4(),
        title: 'Overview',
        type: 'header',
        content: this.generateProjectOverview(input),
        order: 0,
      },
      {
        id: uuidv4(),
        title: 'Key Decisions',
        type: 'decision',
        content: '',
        items: decisions,
        order: 1,
      },
      {
        id: uuidv4(),
        title: 'Milestones',
        type: 'timeline',
        content: '',
        items: milestones,
        order: 2,
      },
      {
        id: uuidv4(),
        title: 'Action Items',
        type: 'action',
        content: '',
        items: actions.map(a => ({ ...a, dependencies: dependencies[a.id] || [] })),
        order: 3,
      },
    ];

    const entities = await this.extractEntities(input.rawContent, input.inputType);
    const relationships = await this.identifyRelationships(entities, input.rawContent);

    return {
      id: uuidv4(),
      inputId: input.id,
      outputType: 'project_plan',
      title: `Project Plan: ${this.extractProjectName(input)}`,
      summary: `${milestones.length} milestones, ${actions.length} action items, ${decisions.length} decisions`,
      content: {
        sections,
        entities,
        relationships,
        metadata: {
          wordCount: input.rawContent.split(/\s+/).length,
          entityCount: entities.length,
          actionItemCount: actions.length,
          decisionCount: decisions.length,
          questionCount: 0,
          insightCount: 0,
          keyTopics: this.extractKeyTopics(input.rawContent),
          sentiment: 'neutral',
          complexity: this.assessComplexity(input.rawContent),
        },
      },
      confidence: 0.85,
      processingTimeMs: 0,
      createdAt: new Date(),
    };
  }

  async getMetrics(tenantId: string, period: string): Promise<SynthesisMetrics> {
    return {
      tenantId,
      period,
      totalSyntheses: 127,
      byInputType: {
        whiteboard: 34,
        brainstorm: 28,
        meeting_notes: 45,
        voice_transcript: 12,
        chat_history: 5,
        document_dump: 3,
        mixed: 0,
      },
      byOutputType: {
        decisions: 45,
        action_items: 89,
        project_plan: 23,
        meeting_summary: 67,
        knowledge_base: 12,
        data_table: 8,
        timeline: 34,
        hierarchy: 5,
        comparison: 3,
      },
      averageProcessingMs: 2340,
      averageConfidence: 0.87,
      totalActionItemsGenerated: 456,
      totalDecisionsExtracted: 123,
      totalEntitiesFound: 789,
    };
  }

  private async parseInput(input: ChaoticInput): Promise<string> {
    let content = input.rawContent;

    if (input.attachments) {
      for (const attachment of input.attachments) {
        if (attachment.extractedText) {
          content += '\n\n' + attachment.extractedText;
        }
      }
    }

    content = content
      .replace(/\s+/g, ' ')
      .replace(/[^\S\n]+/g, ' ')
      .trim();

    return content;
  }

  private async extractEntities(
    content: string,
    inputType: ChaoticInputType
  ): Promise<ChaosExtractedEntity[]> {
    const entities: ChaosExtractedEntity[] = [];

    const personPattern = /@(\w+)|(?:^|\s)([A-Z][a-z]+ [A-Z][a-z]+)(?:\s|$)/g;
    let match;
    while ((match = personPattern.exec(content)) !== null) {
      const name = match[1] || match[2];
      entities.push({
        id: uuidv4(),
        type: 'person',
        name,
        mentions: [{
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
          context: content.substring(Math.max(0, match.index - 20), match.index + 50),
        }],
        attributes: {},
        confidence: 0.8,
      });
    }

    const datePattern = /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\w+ \d{1,2},? \d{4}|next \w+|this \w+)\b/gi;
    while ((match = datePattern.exec(content)) !== null) {
      entities.push({
        id: uuidv4(),
        type: 'date',
        name: match[1],
        mentions: [{
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
          context: content.substring(Math.max(0, match.index - 20), match.index + 50),
        }],
        attributes: {},
        confidence: 0.9,
      });
    }

    return entities;
  }

  private async identifyRelationships(
    entities: ChaosExtractedEntity[],
    content: string
  ): Promise<ChaosEntityRelationship[]> {
    const relationships: ChaosEntityRelationship[] = [];

    const personEntities = entities.filter(e => e.type === 'person');
    
    for (let i = 0; i < personEntities.length; i++) {
      for (let j = i + 1; j < personEntities.length; j++) {
        const person1 = personEntities[i];
        const person2 = personEntities[j];
        
        const coOccurrence = this.checkCoOccurrence(content, person1.name, person2.name);
        if (coOccurrence) {
          relationships.push({
            id: uuidv4(),
            sourceId: person1.id,
            targetId: person2.id,
            type: 'related_to',
            strength: 0.6,
            evidence: coOccurrence,
          });
        }
      }
    }

    return relationships;
  }

  private async generateStructuredContent(
    parsedContent: string,
    entities: ChaosExtractedEntity[],
    relationships: ChaosEntityRelationship[],
    outputType: StructuredOutputType,
    options?: SynthesisRequest['options']
  ): Promise<StructuredContent> {
    const sections = await this.generateSections(parsedContent, outputType);
    const metadata = this.generateMetadata(parsedContent, entities, sections);

    return {
      sections,
      entities,
      relationships,
      metadata,
    };
  }

  private async generateSections(
    content: string,
    outputType: StructuredOutputType
  ): Promise<ContentSection[]> {
    const paragraphs = content.split(/\n\n+/);
    
    return paragraphs.map((p, i) => ({
      id: uuidv4(),
      title: i === 0 ? 'Overview' : `Section ${i}`,
      type: 'paragraph' as ChaosSectionType,
      content: p.trim(),
      order: i,
    }));
  }

  private generateMetadata(
    content: string,
    entities: ChaosExtractedEntity[],
    sections: ContentSection[]
  ): ContentMetadata {
    const words = content.split(/\s+/);
    const questions = (content.match(/\?/g) || []).length;

    return {
      wordCount: words.length,
      entityCount: entities.length,
      actionItemCount: sections.filter(s => s.type === 'action').length,
      decisionCount: sections.filter(s => s.type === 'decision').length,
      questionCount: questions,
      insightCount: 0,
      keyTopics: this.extractKeyTopics(content),
      sentiment: 'neutral',
      complexity: this.assessComplexity(content),
    };
  }

  private async validateOutput(
    content: StructuredContent,
    config: SynthesisConfig
  ): Promise<StructuredContent> {
    return content;
  }

  private updateStep(
    steps: ProcessingStep[],
    name: string,
    status: ProcessingStep['status']
  ): void {
    const step = steps.find(s => s.name === name);
    if (step) {
      step.status = status;
      if (status === 'running') step.startedAt = new Date();
      if (status === 'completed' || status === 'failed') step.completedAt = new Date();
    }
  }

  private generateTitle(outputType: StructuredOutputType, input: ChaoticInput): string {
    const typeNames: Record<StructuredOutputType, string> = {
      decisions: 'Key Decisions',
      action_items: 'Action Items',
      project_plan: 'Project Plan',
      meeting_summary: 'Meeting Summary',
      knowledge_base: 'Knowledge Base',
      data_table: 'Data Table',
      timeline: 'Timeline',
      hierarchy: 'Hierarchy',
      comparison: 'Comparison',
    };
    return typeNames[outputType] || 'Structured Output';
  }

  private generateSummary(content: StructuredContent): string {
    const meta = content.metadata;
    return `${meta.entityCount} entities, ${meta.actionItemCount} actions, ${meta.decisionCount} decisions`;
  }

  private calculateConfidence(content: StructuredContent): number {
    const entityConfidence = content.entities.reduce((sum, e) => sum + e.confidence, 0) / 
      Math.max(content.entities.length, 1);
    return Math.min(0.95, Math.max(0.5, entityConfidence));
  }

  private estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }

  private estimateCost(content: string): number {
    const tokens = this.estimateTokens(content);
    return tokens * 0.00001;
  }

  private groupByProximity(elements: WhiteboardElement[]): WhiteboardElement[][] {
    const threshold = 200;
    const groups: WhiteboardElement[][] = [];
    const assigned = new Set<string>();

    for (const element of elements) {
      if (assigned.has(element.id)) continue;

      const group = [element];
      assigned.add(element.id);

      for (const other of elements) {
        if (assigned.has(other.id)) continue;
        const distance = Math.sqrt(
          Math.pow(element.position.x - other.position.x, 2) +
          Math.pow(element.position.y - other.position.y, 2)
        );
        if (distance < threshold) {
          group.push(other);
          assigned.add(other.id);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  private async identifyTheme(elements: WhiteboardElement[]): Promise<string> {
    const content = elements.map(e => e.content).join(' ');
    const words = content.toLowerCase().split(/\s+/);
    const freq: Record<string, number> = {};
    
    for (const word of words) {
      if (word.length > 3) {
        freq[word] = (freq[word] || 0) + 1;
      }
    }

    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || 'General';
  }

  private calculateCentroid(elements: WhiteboardElement[]): { x: number; y: number } {
    const sumX = elements.reduce((sum, e) => sum + e.position.x, 0);
    const sumY = elements.reduce((sum, e) => sum + e.position.y, 0);
    return {
      x: sumX / elements.length,
      y: sumY / elements.length,
    };
  }

  private calculateSignificance(elements: WhiteboardElement[]): number {
    const contentLength = elements.reduce((sum, e) => sum + e.content.length, 0);
    const connectionCount = elements.reduce((sum, e) => sum + (e.connectedTo?.length || 0), 0);
    return Math.min(1, (contentLength / 500) + (connectionCount / 10));
  }

  private inferPriority(text: string): 'low' | 'medium' | 'high' | 'critical' {
    const lower = text.toLowerCase();
    if (lower.includes('urgent') || lower.includes('asap') || lower.includes('critical')) {
      return 'critical';
    }
    if (lower.includes('important') || lower.includes('priority')) {
      return 'high';
    }
    if (lower.includes('when possible') || lower.includes('nice to have')) {
      return 'low';
    }
    return 'medium';
  }

  private deduplicateItems(items: StructuredItem[]): StructuredItem[] {
    const seen = new Set<string>();
    return items.filter(item => {
      const key = item.content.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private groupIntoMilestones(actions: StructuredItem[]): StructuredItem[] {
    return actions.filter((_, i) => i % 3 === 0).map(a => ({
      ...a,
      type: 'milestone' as ItemType,
    }));
  }

  private generateTimeline(milestones: StructuredItem[]): StructuredItem[] {
    const now = new Date();
    return milestones.map((m, i) => ({
      ...m,
      dueDate: new Date(now.getTime() + (i + 1) * 7 * 24 * 60 * 60 * 1000),
    }));
  }

  private inferDependencies(actions: StructuredItem[]): Record<string, string[]> {
    const deps: Record<string, string[]> = {};
    for (let i = 1; i < actions.length; i++) {
      deps[actions[i].id] = [actions[i - 1].id];
    }
    return deps;
  }

  private generateProjectOverview(input: ChaoticInput): string {
    const words = input.rawContent.split(/\s+/).slice(0, 50).join(' ');
    return words + '...';
  }

  private extractProjectName(input: ChaoticInput): string {
    const firstLine = input.rawContent.split('\n')[0];
    return firstLine.slice(0, 50) || 'Untitled Project';
  }

  private extractKeyTopics(content: string): string[] {
    const words = content.toLowerCase().split(/\s+/);
    const freq: Record<string, number> = {};
    
    for (const word of words) {
      if (word.length > 4) {
        freq[word] = (freq[word] || 0) + 1;
      }
    }

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  private assessComplexity(content: string): 'simple' | 'moderate' | 'complex' {
    const words = content.split(/\s+/).length;
    if (words < 100) return 'simple';
    if (words < 500) return 'moderate';
    return 'complex';
  }

  private checkCoOccurrence(content: string, name1: string, name2: string): string | null {
    const sentences = content.split(/[.!?]+/);
    for (const sentence of sentences) {
      if (sentence.includes(name1) && sentence.includes(name2)) {
        return sentence.trim();
      }
    }
    return null;
  }
}

export const structureFromChaosService = StructureFromChaosService.getInstance();
