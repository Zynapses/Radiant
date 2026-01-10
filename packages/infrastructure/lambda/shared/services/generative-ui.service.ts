// Generative UI Service
// AI-generated interactive components (The "App" Factory)

import { executeStatement, stringParam } from '../db/client';
import type {
  UIComponentSchema,
  UIComponentType,
  UIInput,
  UIOutput,
  GeneratedUI,
  GenerativeUIConfig,
} from '@radiant/shared';
import crypto from 'crypto';

const DEFAULT_CONFIG: GenerativeUIConfig = {
  enabled: true,
  generationModel: 'gpt-4o',
  allowedComponentTypes: ['chart', 'table', 'calculator', 'comparison', 'timeline'],
  maxComponentsPerResponse: 3,
  autoDetectOpportunities: true,
  autoDetectTriggers: ['compare', 'calculate', 'visualize', 'chart', 'table', 'timeline'],
  defaultTheme: 'auto',
};

// Component templates for common use cases
const COMPONENT_TEMPLATES: Record<string, Partial<UIComponentSchema>> = {
  pricing_calculator: {
    type: 'calculator',
    title: 'Pricing Calculator',
    interactive: true,
    inputs: [
      { id: 'input_tokens', label: 'Input Tokens', type: 'slider', defaultValue: 1000, min: 0, max: 100000, step: 100 },
      { id: 'output_tokens', label: 'Output Tokens', type: 'slider', defaultValue: 1000, min: 0, max: 100000, step: 100 },
    ],
    outputs: [
      { id: 'total_cost', label: 'Total Cost', type: 'number', format: 'currency' },
    ],
  },
  comparison_table: {
    type: 'comparison',
    title: 'Comparison',
    interactive: true,
    width: 'full',
  },
  timeline: {
    type: 'timeline',
    title: 'Timeline',
    interactive: false,
    width: 'full',
  },
  bar_chart: {
    type: 'chart',
    title: 'Chart',
    interactive: true,
    config: { chartType: 'bar' },
  },
  pie_chart: {
    type: 'chart',
    title: 'Distribution',
    interactive: true,
    config: { chartType: 'pie' },
  },
};

class GenerativeUIService {
  /**
   * Detect if a response should include generated UI
   */
  async detectUIOpportunity(
    prompt: string,
    response: string,
    config?: Partial<GenerativeUIConfig>
  ): Promise<{ shouldGenerate: boolean; suggestedTypes: UIComponentType[]; reason: string }> {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    
    if (!mergedConfig.autoDetectOpportunities) {
      return { shouldGenerate: false, suggestedTypes: [], reason: 'Auto-detect disabled' };
    }

    const combinedText = `${prompt} ${response}`.toLowerCase();
    const suggestedTypes: UIComponentType[] = [];
    const reasons: string[] = [];

    // Check for trigger patterns
    for (const trigger of mergedConfig.autoDetectTriggers) {
      if (combinedText.includes(trigger)) {
        const componentType = this.mapTriggerToComponent(trigger);
        if (componentType && !suggestedTypes.includes(componentType)) {
          suggestedTypes.push(componentType);
          reasons.push(`Contains "${trigger}"`);
        }
      }
    }

    // Check for data patterns
    if (this.containsTabularData(response)) {
      if (!suggestedTypes.includes('table')) {
        suggestedTypes.push('table');
        reasons.push('Contains tabular data');
      }
    }

    if (this.containsNumericalComparison(response)) {
      if (!suggestedTypes.includes('chart')) {
        suggestedTypes.push('chart');
        reasons.push('Contains numerical comparison');
      }
    }

    if (this.containsTimeline(response)) {
      if (!suggestedTypes.includes('timeline')) {
        suggestedTypes.push('timeline');
        reasons.push('Contains chronological data');
      }
    }

    // Filter to allowed types
    const allowedTypes = suggestedTypes.filter(t => 
      mergedConfig.allowedComponentTypes.includes(t)
    );

    return {
      shouldGenerate: allowedTypes.length > 0,
      suggestedTypes: allowedTypes.slice(0, mergedConfig.maxComponentsPerResponse),
      reason: reasons.join('; '),
    };
  }

  /**
   * Generate UI components for a response
   */
  async generateUI(
    tenantId: string,
    userId: string,
    prompt: string,
    response: string,
    options: {
      conversationId?: string;
      messageId?: string;
      requestedTypes?: UIComponentType[];
      config?: Partial<GenerativeUIConfig>;
    } = {}
  ): Promise<GeneratedUI> {
    const mergedConfig = { ...DEFAULT_CONFIG, ...options.config };
    const startTime = Date.now();

    // Determine what components to generate
    let componentTypes = options.requestedTypes;
    if (!componentTypes || componentTypes.length === 0) {
      const detection = await this.detectUIOpportunity(prompt, response, mergedConfig);
      componentTypes = detection.suggestedTypes;
    }

    // Generate each component
    const components: UIComponentSchema[] = [];
    for (const type of componentTypes.slice(0, mergedConfig.maxComponentsPerResponse)) {
      const component = await this.generateComponent(type, prompt, response, mergedConfig);
      if (component) {
        components.push(component);
      }
    }

    const generatedUI: GeneratedUI = {
      id: crypto.randomUUID(),
      tenantId,
      userId,
      conversationId: options.conversationId,
      messageId: options.messageId,
      prompt,
      generatedFrom: options.requestedTypes ? 'explicit_request' : 'auto_detected',
      components,
      layout: components.length > 1 ? 'grid' : 'single',
      generationModel: mergedConfig.generationModel,
      generationTimeMs: Date.now() - startTime,
      interactionCount: 0,
      createdAt: new Date(),
    };

    // Save to database
    await this.saveGeneratedUI(generatedUI);

    return generatedUI;
  }

  /**
   * Generate a specific component type
   */
  private async generateComponent(
    type: UIComponentType,
    prompt: string,
    response: string,
    config: GenerativeUIConfig
  ): Promise<UIComponentSchema | null> {
    switch (type) {
      case 'calculator':
        return this.generateCalculator(prompt, response);
      case 'table':
        return this.generateTable(response);
      case 'chart':
        return this.generateChart(response);
      case 'comparison':
        return this.generateComparison(response);
      case 'timeline':
        return this.generateTimeline(response);
      case 'form':
        return this.generateForm(prompt);
      default:
        return null;
    }
  }

  /**
   * Generate a calculator component
   */
  private async generateCalculator(prompt: string, response: string): Promise<UIComponentSchema> {
    // Extract numerical values and formulas from response
    const numbers = response.match(/\$?[\d,]+\.?\d*/g) || [];
    const hasPercentage = response.includes('%');
    const hasCurrency = response.includes('$') || response.toLowerCase().includes('cost') || response.toLowerCase().includes('price');

    const inputs: UIInput[] = [
      {
        id: 'value1',
        label: 'Value 1',
        type: 'number',
        defaultValue: numbers[0] ? parseFloat(numbers[0].replace(/[$,]/g, '')) : 100,
      },
      {
        id: 'value2',
        label: 'Value 2',
        type: 'number',
        defaultValue: numbers[1] ? parseFloat(numbers[1].replace(/[$,]/g, '')) : 100,
      },
    ];

    if (hasPercentage) {
      inputs.push({
        id: 'percentage',
        label: 'Percentage',
        type: 'slider',
        defaultValue: 10,
        min: 0,
        max: 100,
        step: 1,
      });
    }

    const outputs: UIOutput[] = [
      {
        id: 'result',
        label: 'Result',
        type: 'number',
        format: hasCurrency ? 'currency' : undefined,
      },
    ];

    return {
      id: crypto.randomUUID(),
      type: 'calculator',
      title: this.extractTitle(prompt, 'Calculator'),
      description: 'Interactive calculator based on the response',
      data: { numbers },
      interactive: true,
      inputs,
      outputs,
      width: 'medium',
      config: {
        formula: hasPercentage ? '(value1 + value2) * (percentage / 100)' : 'value1 + value2',
      },
    };
  }

  /**
   * Generate a table component
   */
  private async generateTable(response: string): Promise<UIComponentSchema> {
    // Extract table-like data from response
    const lines = response.split('\n').filter(l => l.includes('|') || l.includes('\t'));
    const rows: Record<string, unknown>[] = [];
    let headers: string[] = [];

    for (const line of lines) {
      const cells = line.split(/[|\t]/).map(c => c.trim()).filter(Boolean);
      if (cells.length === 0) continue;

      if (headers.length === 0) {
        headers = cells;
      } else if (!line.includes('---')) {
        const row: Record<string, unknown> = {};
        cells.forEach((cell, i) => {
          row[headers[i] || `col${i}`] = cell;
        });
        rows.push(row);
      }
    }

    // If no markdown table found, try to extract from text
    if (rows.length === 0) {
      // Simple heuristic: look for repeated patterns
      const patterns = response.match(/([A-Z][a-z]+):\s*([^\n]+)/g) || [];
      headers = ['Property', 'Value'];
      for (const pattern of patterns.slice(0, 10)) {
        const [key, value] = pattern.split(':').map(s => s.trim());
        rows.push({ Property: key, Value: value });
      }
    }

    return {
      id: crypto.randomUUID(),
      type: 'table',
      title: 'Data Table',
      data: { headers, rows },
      interactive: true,
      width: 'full',
      config: {
        sortable: true,
        filterable: rows.length > 5,
        pagination: rows.length > 10,
      },
    };
  }

  /**
   * Generate a chart component
   */
  private async generateChart(response: string): Promise<UIComponentSchema> {
    // Extract numerical data for charting
    const dataPoints: { label: string; value: number }[] = [];
    
    // Look for patterns like "X: 123" or "X - 123"
    const patterns = response.match(/([A-Za-z\s]+)[:\-]\s*\$?([\d,]+\.?\d*)/g) || [];
    
    for (const pattern of patterns.slice(0, 10)) {
      const match = pattern.match(/([A-Za-z\s]+)[:\-]\s*\$?([\d,]+\.?\d*)/);
      if (match) {
        dataPoints.push({
          label: match[1].trim(),
          value: parseFloat(match[2].replace(/,/g, '')),
        });
      }
    }

    // Determine chart type
    const chartType = dataPoints.length <= 5 ? 'pie' : 'bar';

    return {
      id: crypto.randomUUID(),
      type: 'chart',
      title: 'Data Visualization',
      data: { dataPoints },
      interactive: true,
      width: 'medium',
      config: {
        chartType,
        showLegend: true,
        showValues: true,
        colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
      },
    };
  }

  /**
   * Generate a comparison component
   */
  private async generateComparison(response: string): Promise<UIComponentSchema> {
    // Extract items being compared
    const items: Record<string, Record<string, unknown>>[] = [];
    const features: string[] = [];

    // Look for comparison patterns
    const sections = response.split(/\n(?=[A-Z])/);
    
    for (const section of sections.slice(0, 5)) {
      const lines = section.split('\n');
      if (lines.length > 0) {
        const itemName = lines[0].replace(/[:#*]/g, '').trim();
        const item: Record<string, unknown> = { name: itemName };
        
        for (const line of lines.slice(1)) {
          const match = line.match(/[-*]\s*([^:]+):\s*(.+)/);
          if (match) {
            const feature = match[1].trim();
            const value = match[2].trim();
            item[feature] = value;
            if (!features.includes(feature)) {
              features.push(feature);
            }
          }
        }
        
        if (Object.keys(item).length > 1) {
          items.push(item as Record<string, Record<string, unknown>>);
        }
      }
    }

    return {
      id: crypto.randomUUID(),
      type: 'comparison',
      title: 'Comparison',
      data: { items, features },
      interactive: true,
      width: 'full',
      config: {
        highlightBest: true,
        showDifferences: true,
      },
    };
  }

  /**
   * Generate a timeline component
   */
  private async generateTimeline(response: string): Promise<UIComponentSchema> {
    const events: { date: string; title: string; description: string }[] = [];

    // Look for date patterns
    const datePatterns = response.match(/(\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Z][a-z]+ \d{1,2},? \d{4})[:\-]?\s*([^\n]+)/g) || [];
    
    for (const pattern of datePatterns) {
      const match = pattern.match(/(\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Z][a-z]+ \d{1,2},? \d{4})[:\-]?\s*(.+)/);
      if (match) {
        events.push({
          date: match[1],
          title: match[2].slice(0, 50),
          description: match[2],
        });
      }
    }

    return {
      id: crypto.randomUUID(),
      type: 'timeline',
      title: 'Timeline',
      data: { events },
      interactive: false,
      width: 'full',
      config: {
        orientation: 'vertical',
        showConnectors: true,
      },
    };
  }

  /**
   * Generate a form component
   */
  private async generateForm(prompt: string): Promise<UIComponentSchema> {
    const inputs: UIInput[] = [];

    // Extract potential form fields from prompt
    const fieldPatterns = prompt.match(/(?:enter|input|provide|specify|select)\s+(?:your\s+)?([a-z\s]+)/gi) || [];
    
    for (const pattern of fieldPatterns.slice(0, 5)) {
      const match = pattern.match(/(?:enter|input|provide|specify|select)\s+(?:your\s+)?([a-z\s]+)/i);
      if (match) {
        const fieldName = match[1].trim();
        inputs.push({
          id: fieldName.replace(/\s+/g, '_').toLowerCase(),
          label: fieldName.charAt(0).toUpperCase() + fieldName.slice(1),
          type: this.inferInputType(fieldName),
          required: true,
        });
      }
    }

    // Add default fields if none detected
    if (inputs.length === 0) {
      inputs.push(
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
      );
    }

    return {
      id: crypto.randomUUID(),
      type: 'form',
      title: 'Input Form',
      data: {},
      interactive: true,
      inputs,
      width: 'medium',
      config: {
        submitLabel: 'Submit',
      },
    };
  }

  /**
   * Record user interaction with generated UI
   */
  async recordInteraction(
    uiId: string,
    interactionType: 'view' | 'interact' | 'rate',
    rating?: number
  ): Promise<void> {
    await executeStatement(
      `UPDATE generated_ui
       SET interaction_count = interaction_count + 1,
           last_interacted_at = NOW(),
           user_rating = COALESCE($1, user_rating)
       WHERE id = $2::uuid`,
      [
        stringParam('rating', rating ? String(rating) : ''),
        stringParam('id', uiId),
      ]
    );
  }

  /**
   * Get generated UI by ID
   */
  async getGeneratedUI(uiId: string): Promise<GeneratedUI | null> {
    const result = await executeStatement(
      `SELECT * FROM generated_ui WHERE id = $1::uuid`,
      [stringParam('id', uiId)]
    );

    if (!result.rows?.length) return null;
    return this.mapRowToGeneratedUI(result.rows[0]);
  }

  /**
   * Save generated UI to database
   */
  private async saveGeneratedUI(ui: GeneratedUI): Promise<void> {
    await executeStatement(
      `INSERT INTO generated_ui (
        id, tenant_id, user_id, conversation_id, message_id,
        prompt, generated_from, components, layout,
        generation_model, generation_time_ms,
        interaction_count, created_at
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
        $6, $7, $8::jsonb, $9,
        $10, $11,
        $12, $13
      )`,
      [
        stringParam('id', ui.id),
        stringParam('tenantId', ui.tenantId),
        stringParam('userId', ui.userId),
        stringParam('conversationId', ui.conversationId || ''),
        stringParam('messageId', ui.messageId || ''),
        stringParam('prompt', ui.prompt),
        stringParam('generatedFrom', ui.generatedFrom),
        stringParam('components', JSON.stringify(ui.components)),
        stringParam('layout', ui.layout),
        stringParam('generationModel', ui.generationModel),
        stringParam('generationTimeMs', String(ui.generationTimeMs)),
        stringParam('interactionCount', String(ui.interactionCount)),
        stringParam('createdAt', ui.createdAt.toISOString()),
      ]
    );
  }

  // Helper methods
  private mapTriggerToComponent(trigger: string): UIComponentType | null {
    const mapping: Record<string, UIComponentType> = {
      'compare': 'comparison',
      'calculate': 'calculator',
      'visualize': 'chart',
      'chart': 'chart',
      'table': 'table',
      'timeline': 'timeline',
      'graph': 'chart',
      'diagram': 'diagram',
    };
    return mapping[trigger.toLowerCase()] || null;
  }

  private containsTabularData(text: string): boolean {
    return text.includes('|') || (text.match(/\t/g) || []).length > 3;
  }

  private containsNumericalComparison(text: string): boolean {
    const numbers = text.match(/\d+/g) || [];
    return numbers.length >= 3;
  }

  private containsTimeline(text: string): boolean {
    const datePatterns = text.match(/\d{4}|January|February|March|April|May|June|July|August|September|October|November|December/gi) || [];
    return datePatterns.length >= 2;
  }

  private extractTitle(prompt: string, defaultTitle: string): string {
    const words = prompt.split(/\s+/).slice(0, 5);
    if (words.length > 2) {
      return words.join(' ').slice(0, 40);
    }
    return defaultTitle;
  }

  private inferInputType(fieldName: string): UIInput['type'] {
    const lower = fieldName.toLowerCase();
    if (lower.includes('date')) return 'date';
    if (lower.includes('number') || lower.includes('amount') || lower.includes('quantity')) return 'number';
    if (lower.includes('select') || lower.includes('choose')) return 'select';
    if (lower.includes('check') || lower.includes('agree')) return 'checkbox';
    return 'text';
  }

  private mapRowToGeneratedUI(row: Record<string, unknown>): GeneratedUI {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string,
      conversationId: row.conversation_id as string,
      messageId: row.message_id as string,
      prompt: row.prompt as string,
      generatedFrom: row.generated_from as GeneratedUI['generatedFrom'],
      components: row.components as UIComponentSchema[],
      layout: row.layout as GeneratedUI['layout'],
      generationModel: row.generation_model as string,
      generationTimeMs: parseInt(row.generation_time_ms as string),
      interactionCount: parseInt(row.interaction_count as string),
      lastInteractedAt: row.last_interacted_at ? new Date(row.last_interacted_at as string) : undefined,
      userRating: row.user_rating ? parseInt(row.user_rating as string) : undefined,
      createdAt: new Date(row.created_at as string),
    };
  }

  /**
   * Get configuration
   */
  async getConfig(tenantId: string): Promise<GenerativeUIConfig> {
    const result = await executeStatement(
      `SELECT generative_ui FROM cognitive_architecture_config WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );

    if (result.rows?.length && result.rows[0].generative_ui) {
      return result.rows[0].generative_ui as GenerativeUIConfig;
    }

    return DEFAULT_CONFIG;
  }
}

export const generativeUIService = new GenerativeUIService();
