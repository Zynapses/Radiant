// Think Tank App Factory Service
// Transforms Think Tank from a "chatbot" into a "dynamic software generator"
// "Gemini 3 can write the code for a calculator, but it cannot become the calculator."

import { executeStatement, stringParam } from '../db/client';
import { generativeUIService } from './generative-ui.service';
// Types from cognitive-architecture.types.ts
type UIComponentType = 
  | 'chart' | 'table' | 'calculator' | 'form' | 'timeline'
  | 'comparison' | 'diagram' | 'map' | 'kanban' | 'calendar'
  | 'code_editor' | 'markdown_viewer' | 'image_gallery' | 'custom';

interface UIInput {
  id: string;
  label: string;
  type: 'text' | 'number' | 'slider' | 'select' | 'checkbox' | 'date' | 'color';
  defaultValue?: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: unknown }[];
  required?: boolean;
}

interface UIOutput {
  id: string;
  label: string;
  type: 'text' | 'number' | 'chart' | 'table';
  format?: string;
  computeFrom?: string;
}

interface UIComponentSchema {
  id: string;
  type: UIComponentType;
  title: string;
  description?: string;
  data: unknown;
  dataSchema?: Record<string, unknown>;
  interactive: boolean;
  inputs?: UIInput[];
  outputs?: UIOutput[];
  width?: 'small' | 'medium' | 'large' | 'full';
  height?: 'auto' | 'small' | 'medium' | 'large';
  theme?: 'light' | 'dark' | 'auto';
  config: Record<string, unknown>;
}

interface GenerativeUIConfig {
  enabled: boolean;
  generationModel: string;
  allowedComponentTypes: UIComponentType[];
  maxComponentsPerResponse: number;
  autoDetectOpportunities: boolean;
  autoDetectTriggers: string[];
  defaultTheme: 'light' | 'dark' | 'auto';
}
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface AppFactoryResponse {
  // The text response (always present)
  textResponse: string;
  
  // The generated "app" (when applicable)
  hasApp: boolean;
  app?: GeneratedApp;
  
  // Detection info
  appDetection: {
    detected: boolean;
    confidence: number;
    reason: string;
    suggestedTypes: UIComponentType[];
  };
  
  // View recommendation
  recommendedView: 'text' | 'app' | 'split';
  
  // Metadata
  generationTimeMs: number;
}

export interface GeneratedApp {
  id: string;
  title: string;
  description: string;
  
  // Components
  components: UIComponentSchema[];
  layout: 'single' | 'grid' | 'tabs' | 'stack';
  
  // State
  initialState: Record<string, unknown>;
  computeLogic: ComputeLogic[];
  
  // Interactivity
  isInteractive: boolean;
  
  // Persistence
  conversationId?: string;
  messageId?: string;
  
  createdAt: Date;
}

export interface ComputeLogic {
  outputId: string;
  formula: string; // JavaScript expression
  dependencies: string[]; // Input IDs this depends on
}

// Comprehensive trigger patterns for app detection
const APP_TRIGGERS: Record<string, { types: UIComponentType[]; confidence: number }> = {
  // Calculator triggers
  'calculate': { types: ['calculator'], confidence: 0.9 },
  'compute': { types: ['calculator'], confidence: 0.85 },
  'how much': { types: ['calculator'], confidence: 0.8 },
  'what is the total': { types: ['calculator'], confidence: 0.85 },
  'cost of': { types: ['calculator'], confidence: 0.8 },
  'price of': { types: ['calculator'], confidence: 0.8 },
  'mortgage': { types: ['calculator'], confidence: 0.9 },
  'loan': { types: ['calculator'], confidence: 0.85 },
  'interest': { types: ['calculator'], confidence: 0.8 },
  'compound': { types: ['calculator'], confidence: 0.85 },
  'roi': { types: ['calculator'], confidence: 0.9 },
  'percentage': { types: ['calculator'], confidence: 0.75 },
  'convert': { types: ['calculator'], confidence: 0.7 },
  'exchange rate': { types: ['calculator'], confidence: 0.85 },
  'bmi': { types: ['calculator'], confidence: 0.9 },
  'calorie': { types: ['calculator'], confidence: 0.85 },
  'tip': { types: ['calculator'], confidence: 0.85 },
  'discount': { types: ['calculator'], confidence: 0.8 },
  
  // Comparison triggers
  'compare': { types: ['comparison'], confidence: 0.9 },
  'versus': { types: ['comparison'], confidence: 0.85 },
  'vs': { types: ['comparison'], confidence: 0.85 },
  'difference between': { types: ['comparison'], confidence: 0.85 },
  'which is better': { types: ['comparison'], confidence: 0.8 },
  'pros and cons': { types: ['comparison'], confidence: 0.9 },
  
  // Chart triggers
  'chart': { types: ['chart'], confidence: 0.9 },
  'graph': { types: ['chart'], confidence: 0.9 },
  'visualize': { types: ['chart'], confidence: 0.85 },
  'plot': { types: ['chart'], confidence: 0.85 },
  'distribution': { types: ['chart'], confidence: 0.8 },
  'trend': { types: ['chart'], confidence: 0.75 },
  'statistics': { types: ['chart', 'table'], confidence: 0.8 },
  
  // Table triggers
  'table': { types: ['table'], confidence: 0.9 },
  'list': { types: ['table'], confidence: 0.7 },
  'breakdown': { types: ['table'], confidence: 0.75 },
  'summary': { types: ['table'], confidence: 0.7 },
  
  // Timeline triggers
  'timeline': { types: ['timeline'], confidence: 0.9 },
  'history': { types: ['timeline'], confidence: 0.75 },
  'chronological': { types: ['timeline'], confidence: 0.85 },
  'sequence': { types: ['timeline'], confidence: 0.7 },
  'evolution': { types: ['timeline'], confidence: 0.75 },
  
  // Form triggers
  'form': { types: ['form'], confidence: 0.9 },
  'input': { types: ['form'], confidence: 0.7 },
  'fill in': { types: ['form'], confidence: 0.8 },
  'submit': { types: ['form'], confidence: 0.75 },
};

// Calculator templates for common use cases
const CALCULATOR_TEMPLATES: Record<string, (response: string) => UIComponentSchema> = {
  mortgage: (response) => ({
    id: crypto.randomUUID(),
    type: 'calculator',
    title: 'Mortgage Calculator',
    description: 'Calculate your monthly mortgage payment',
    data: {},
    interactive: true,
    inputs: [
      { id: 'principal', label: 'Loan Amount', type: 'number', defaultValue: 300000, min: 0, max: 10000000, step: 1000 },
      { id: 'rate', label: 'Interest Rate (%)', type: 'slider', defaultValue: 6.5, min: 0, max: 15, step: 0.125 },
      { id: 'years', label: 'Loan Term (Years)', type: 'select', defaultValue: 30, options: [
        { label: '15 Years', value: 15 },
        { label: '20 Years', value: 20 },
        { label: '30 Years', value: 30 },
      ]},
    ],
    outputs: [
      { id: 'monthly', label: 'Monthly Payment', type: 'number', format: 'currency' },
      { id: 'total', label: 'Total Payment', type: 'number', format: 'currency' },
      { id: 'interest', label: 'Total Interest', type: 'number', format: 'currency' },
    ],
    width: 'medium',
    config: {
      formula: 'mortgage',
      showBreakdown: true,
    },
  }),
  
  tip: (response) => ({
    id: crypto.randomUUID(),
    type: 'calculator',
    title: 'Tip Calculator',
    description: 'Calculate tip and split the bill',
    data: {},
    interactive: true,
    inputs: [
      { id: 'bill', label: 'Bill Amount', type: 'number', defaultValue: 50, min: 0, max: 10000, step: 0.01 },
      { id: 'tipPercent', label: 'Tip Percentage', type: 'slider', defaultValue: 18, min: 0, max: 30, step: 1 },
      { id: 'people', label: 'Split Between', type: 'number', defaultValue: 1, min: 1, max: 20, step: 1 },
    ],
    outputs: [
      { id: 'tip', label: 'Tip Amount', type: 'number', format: 'currency' },
      { id: 'total', label: 'Total with Tip', type: 'number', format: 'currency' },
      { id: 'perPerson', label: 'Per Person', type: 'number', format: 'currency' },
    ],
    width: 'small',
    config: {
      formula: 'tip',
    },
  }),
  
  bmi: (response) => ({
    id: crypto.randomUUID(),
    type: 'calculator',
    title: 'BMI Calculator',
    description: 'Calculate your Body Mass Index',
    data: {},
    interactive: true,
    inputs: [
      { id: 'weight', label: 'Weight (lbs)', type: 'number', defaultValue: 150, min: 50, max: 500, step: 1 },
      { id: 'feet', label: 'Height (feet)', type: 'number', defaultValue: 5, min: 3, max: 8, step: 1 },
      { id: 'inches', label: 'Height (inches)', type: 'number', defaultValue: 8, min: 0, max: 11, step: 1 },
    ],
    outputs: [
      { id: 'bmi', label: 'BMI', type: 'number', format: 'number' },
      { id: 'category', label: 'Category', type: 'text' },
    ],
    width: 'small',
    config: {
      formula: 'bmi',
    },
  }),
  
  percentage: (response) => ({
    id: crypto.randomUUID(),
    type: 'calculator',
    title: 'Percentage Calculator',
    description: 'Calculate percentages easily',
    data: {},
    interactive: true,
    inputs: [
      { id: 'value', label: 'Value', type: 'number', defaultValue: 100, min: 0, max: 1000000 },
      { id: 'percentage', label: 'Percentage', type: 'slider', defaultValue: 25, min: 0, max: 100, step: 1 },
    ],
    outputs: [
      { id: 'result', label: 'Result', type: 'number', format: 'number' },
      { id: 'remaining', label: 'Remaining', type: 'number', format: 'number' },
    ],
    width: 'small',
    config: {
      formula: 'percentage',
    },
  }),
  
  compound: (response) => ({
    id: crypto.randomUUID(),
    type: 'calculator',
    title: 'Compound Interest Calculator',
    description: 'Calculate compound interest growth',
    data: {},
    interactive: true,
    inputs: [
      { id: 'principal', label: 'Initial Investment', type: 'number', defaultValue: 10000, min: 0, max: 10000000 },
      { id: 'rate', label: 'Annual Rate (%)', type: 'slider', defaultValue: 7, min: 0, max: 20, step: 0.5 },
      { id: 'years', label: 'Years', type: 'slider', defaultValue: 10, min: 1, max: 50, step: 1 },
      { id: 'compound', label: 'Compound Frequency', type: 'select', defaultValue: 12, options: [
        { label: 'Monthly', value: 12 },
        { label: 'Quarterly', value: 4 },
        { label: 'Annually', value: 1 },
      ]},
    ],
    outputs: [
      { id: 'future', label: 'Future Value', type: 'number', format: 'currency' },
      { id: 'earnings', label: 'Total Interest', type: 'number', format: 'currency' },
    ],
    width: 'medium',
    config: {
      formula: 'compound',
    },
  }),
  
  roi: (response) => ({
    id: crypto.randomUUID(),
    type: 'calculator',
    title: 'ROI Calculator',
    description: 'Calculate Return on Investment',
    data: {},
    interactive: true,
    inputs: [
      { id: 'initial', label: 'Initial Investment', type: 'number', defaultValue: 1000, min: 0, max: 10000000 },
      { id: 'final', label: 'Final Value', type: 'number', defaultValue: 1500, min: 0, max: 10000000 },
    ],
    outputs: [
      { id: 'roi', label: 'ROI', type: 'number', format: 'percentage' },
      { id: 'gain', label: 'Gain/Loss', type: 'number', format: 'currency' },
    ],
    width: 'small',
    config: {
      formula: 'roi',
    },
  }),
  
  discount: (response) => ({
    id: crypto.randomUUID(),
    type: 'calculator',
    title: 'Discount Calculator',
    description: 'Calculate sale prices and savings',
    data: {},
    interactive: true,
    inputs: [
      { id: 'original', label: 'Original Price', type: 'number', defaultValue: 100, min: 0, max: 100000 },
      { id: 'discount', label: 'Discount (%)', type: 'slider', defaultValue: 20, min: 0, max: 100, step: 5 },
    ],
    outputs: [
      { id: 'sale', label: 'Sale Price', type: 'number', format: 'currency' },
      { id: 'savings', label: 'You Save', type: 'number', format: 'currency' },
    ],
    width: 'small',
    config: {
      formula: 'discount',
    },
  }),
};

// ============================================================================
// App Factory Service
// ============================================================================

class ThinkTankAppFactoryService {
  /**
   * Process a Think Tank response and potentially generate an app
   * This is the main entry point for the "App Factory"
   */
  async processResponse(
    tenantId: string,
    userId: string,
    conversationId: string,
    messageId: string,
    prompt: string,
    textResponse: string,
    config?: Partial<GenerativeUIConfig>
  ): Promise<AppFactoryResponse> {
    const startTime = Date.now();
    
    // 1. Detect if we should generate an app
    const detection = await this.detectAppOpportunity(prompt, textResponse);
    
    if (!detection.detected || detection.confidence < 0.6) {
      return {
        textResponse,
        hasApp: false,
        appDetection: detection,
        recommendedView: 'text',
        generationTimeMs: Date.now() - startTime,
      };
    }
    
    // 2. Generate the app
    const app = await this.generateApp(
      tenantId,
      userId,
      conversationId,
      messageId,
      prompt,
      textResponse,
      detection.suggestedTypes
    );
    
    if (!app) {
      return {
        textResponse,
        hasApp: false,
        appDetection: detection,
        recommendedView: 'text',
        generationTimeMs: Date.now() - startTime,
      };
    }
    
    // 3. Determine recommended view
    const recommendedView = this.determineRecommendedView(detection, app);
    
    return {
      textResponse,
      hasApp: true,
      app,
      appDetection: detection,
      recommendedView,
      generationTimeMs: Date.now() - startTime,
    };
  }
  
  /**
   * Detect if the prompt/response warrants generating an interactive app
   */
  async detectAppOpportunity(
    prompt: string,
    response: string
  ): Promise<{
    detected: boolean;
    confidence: number;
    reason: string;
    suggestedTypes: UIComponentType[];
  }> {
    const combinedText = `${prompt} ${response}`.toLowerCase();
    const suggestedTypes: UIComponentType[] = [];
    const reasons: string[] = [];
    let maxConfidence = 0;
    
    // Check trigger patterns
    for (const [trigger, config] of Object.entries(APP_TRIGGERS)) {
      if (combinedText.includes(trigger.toLowerCase())) {
        for (const type of config.types) {
          if (!suggestedTypes.includes(type)) {
            suggestedTypes.push(type);
          }
        }
        reasons.push(`Contains "${trigger}"`);
        maxConfidence = Math.max(maxConfidence, config.confidence);
      }
    }
    
    // Check for numerical data that could be visualized
    const numbers = response.match(/\$?[\d,]+\.?\d*/g) || [];
    if (numbers.length >= 3 && !suggestedTypes.includes('chart')) {
      suggestedTypes.push('chart');
      reasons.push('Contains numerical data');
      maxConfidence = Math.max(maxConfidence, 0.7);
    }
    
    // Check for tabular data
    if ((response.includes('|') && response.split('|').length > 4) || 
        response.match(/\t/g)?.length && response.match(/\t/g)!.length > 3) {
      if (!suggestedTypes.includes('table')) {
        suggestedTypes.push('table');
        reasons.push('Contains tabular data');
        maxConfidence = Math.max(maxConfidence, 0.8);
      }
    }
    
    // Check for comparison patterns
    if ((response.match(/vs\.?|versus/gi) || []).length > 0 ||
        (response.match(/compared to|in comparison/gi) || []).length > 0) {
      if (!suggestedTypes.includes('comparison')) {
        suggestedTypes.push('comparison');
        reasons.push('Contains comparison');
        maxConfidence = Math.max(maxConfidence, 0.8);
      }
    }
    
    // Check for timeline/chronological data
    const dateMatches = response.match(/\d{4}|January|February|March|April|May|June|July|August|September|October|November|December/gi) || [];
    if (dateMatches.length >= 3) {
      if (!suggestedTypes.includes('timeline')) {
        suggestedTypes.push('timeline');
        reasons.push('Contains chronological data');
        maxConfidence = Math.max(maxConfidence, 0.75);
      }
    }
    
    return {
      detected: suggestedTypes.length > 0,
      confidence: maxConfidence,
      reason: reasons.join('; ') || 'No app opportunity detected',
      suggestedTypes,
    };
  }
  
  /**
   * Generate an interactive app from the response
   */
  async generateApp(
    tenantId: string,
    userId: string,
    conversationId: string,
    messageId: string,
    prompt: string,
    response: string,
    suggestedTypes: UIComponentType[]
  ): Promise<GeneratedApp | null> {
    const components: UIComponentSchema[] = [];
    const computeLogic: ComputeLogic[] = [];
    
    // Generate components based on suggested types
    for (const type of suggestedTypes.slice(0, 3)) {
      const component = await this.generateComponent(type, prompt, response);
      if (component) {
        components.push(component);
        
        // Add compute logic for calculators
        if (type === 'calculator' && component.outputs) {
          for (const output of component.outputs) {
            computeLogic.push({
              outputId: output.id,
              formula: this.getFormulaForCalculator(component),
              dependencies: (component.inputs || []).map((i: { id: string }) => i.id),
            });
          }
        }
      }
    }
    
    if (components.length === 0) {
      return null;
    }
    
    // Build initial state from component inputs
    const initialState: Record<string, unknown> = {};
    for (const component of components) {
      if (component.inputs) {
        for (const input of component.inputs) {
          initialState[`${component.id}_${input.id}`] = input.defaultValue;
        }
      }
    }
    
    const app: GeneratedApp = {
      id: crypto.randomUUID(),
      title: this.generateAppTitle(prompt, suggestedTypes),
      description: `Interactive ${suggestedTypes[0]} generated from your query`,
      components,
      layout: components.length === 1 ? 'single' : 'stack',
      initialState,
      computeLogic,
      isInteractive: components.some(c => c.interactive),
      conversationId,
      messageId,
      createdAt: new Date(),
    };
    
    // Save to database
    await this.saveApp(tenantId, userId, app);
    
    return app;
  }
  
  /**
   * Generate a specific component type
   */
  private async generateComponent(
    type: UIComponentType,
    prompt: string,
    response: string
  ): Promise<UIComponentSchema | null> {
    const lowerPrompt = prompt.toLowerCase();
    const lowerResponse = response.toLowerCase();
    
    switch (type) {
      case 'calculator':
        // Check for specific calculator templates
        if (lowerPrompt.includes('mortgage') || lowerResponse.includes('mortgage')) {
          return CALCULATOR_TEMPLATES.mortgage(response);
        }
        if (lowerPrompt.includes('tip') || lowerResponse.includes('tip')) {
          return CALCULATOR_TEMPLATES.tip(response);
        }
        if (lowerPrompt.includes('bmi') || lowerResponse.includes('body mass')) {
          return CALCULATOR_TEMPLATES.bmi(response);
        }
        if (lowerPrompt.includes('compound') || lowerResponse.includes('compound interest')) {
          return CALCULATOR_TEMPLATES.compound(response);
        }
        if (lowerPrompt.includes('roi') || lowerResponse.includes('return on investment')) {
          return CALCULATOR_TEMPLATES.roi(response);
        }
        if (lowerPrompt.includes('discount') || lowerResponse.includes('sale')) {
          return CALCULATOR_TEMPLATES.discount(response);
        }
        if (lowerPrompt.includes('percentage') || lowerResponse.includes('percent')) {
          return CALCULATOR_TEMPLATES.percentage(response);
        }
        // Generic calculator
        return this.generateGenericCalculator(prompt, response);
        
      case 'chart':
        return this.generateChart(response);
        
      case 'table':
        return this.generateTable(response);
        
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
   * Generate a generic calculator based on context
   */
  private generateGenericCalculator(prompt: string, response: string): UIComponentSchema {
    const numbers = response.match(/\$?[\d,]+\.?\d*/g) || [];
    const hasCurrency = response.includes('$') || prompt.toLowerCase().includes('cost') || prompt.toLowerCase().includes('price');
    
    return {
      id: crypto.randomUUID(),
      type: 'calculator',
      title: 'Calculator',
      description: 'Interactive calculator',
      data: {},
      interactive: true,
      inputs: [
        { id: 'value1', label: 'Value 1', type: 'number', defaultValue: numbers[0] ? parseFloat(numbers[0].replace(/[$,]/g, '')) : 100 },
        { id: 'value2', label: 'Value 2', type: 'number', defaultValue: numbers[1] ? parseFloat(numbers[1].replace(/[$,]/g, '')) : 100 },
        { id: 'operation', label: 'Operation', type: 'select', defaultValue: 'add', options: [
          { label: 'Add (+)', value: 'add' },
          { label: 'Subtract (-)', value: 'subtract' },
          { label: 'Multiply (×)', value: 'multiply' },
          { label: 'Divide (÷)', value: 'divide' },
        ]},
      ],
      outputs: [
        { id: 'result', label: 'Result', type: 'number', format: hasCurrency ? 'currency' : 'number' },
      ],
      width: 'small',
      config: { formula: 'generic' },
    };
  }
  
  /**
   * Generate a chart component
   */
  private generateChart(response: string): UIComponentSchema {
    const dataPoints: { label: string; value: number }[] = [];
    const patterns = response.match(/([A-Za-z\s]+)[:\-]\s*\$?([\d,]+\.?\d*)/g) || [];
    
    for (const pattern of patterns.slice(0, 8)) {
      const match = pattern.match(/([A-Za-z\s]+)[:\-]\s*\$?([\d,]+\.?\d*)/);
      if (match) {
        dataPoints.push({
          label: match[1].trim(),
          value: parseFloat(match[2].replace(/,/g, '')),
        });
      }
    }
    
    return {
      id: crypto.randomUUID(),
      type: 'chart',
      title: 'Data Visualization',
      data: { dataPoints },
      interactive: true,
      width: 'medium',
      config: {
        chartType: dataPoints.length <= 5 ? 'pie' : 'bar',
        showLegend: true,
        showValues: true,
        colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'],
      },
    };
  }
  
  /**
   * Generate a table component
   */
  private generateTable(response: string): UIComponentSchema {
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
    
    if (rows.length === 0) {
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
        pageSize: 10,
      },
    };
  }
  
  /**
   * Generate a comparison component
   */
  private generateComparison(response: string): UIComponentSchema {
    const items: Record<string, unknown>[] = [];
    const features: string[] = [];
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
          items.push(item);
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
  private generateTimeline(response: string): UIComponentSchema {
    const events: { date: string; title: string; description: string }[] = [];
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
  private generateForm(prompt: string): UIComponentSchema {
    const fields: { id: string; label: string; type: string; required: boolean }[] = [];
    const fieldPatterns = prompt.match(/(?:enter|input|provide|specify|select)\s+(?:your\s+)?([a-z\s]+)/gi) || [];
    
    for (const pattern of fieldPatterns.slice(0, 5)) {
      const match = pattern.match(/(?:enter|input|provide|specify|select)\s+(?:your\s+)?([a-z\s]+)/i);
      if (match) {
        const fieldName = match[1].trim();
        fields.push({
          id: fieldName.replace(/\s+/g, '_').toLowerCase(),
          label: fieldName.charAt(0).toUpperCase() + fieldName.slice(1),
          type: 'text',
          required: true,
        });
      }
    }
    
    if (fields.length === 0) {
      fields.push(
        { id: 'input', label: 'Input', type: 'text', required: true },
      );
    }
    
    return {
      id: crypto.randomUUID(),
      type: 'form',
      title: 'Input Form',
      data: {},
      interactive: true,
      inputs: fields.map(f => ({ id: f.id, label: f.label, type: f.type as any, required: f.required })),
      width: 'medium',
      config: { submitLabel: 'Submit' },
    };
  }
  
  /**
   * Get the compute formula for a calculator
   */
  private getFormulaForCalculator(component: UIComponentSchema): string {
    const formulaType = (component.config as Record<string, unknown>)?.formula;
    
    switch (formulaType) {
      case 'mortgage':
        return `
          const monthlyRate = rate / 100 / 12;
          const numPayments = years * 12;
          const monthly = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
          const total = monthly * numPayments;
          const interest = total - principal;
          return { monthly, total, interest };
        `;
      case 'tip':
        return `
          const tip = bill * (tipPercent / 100);
          const total = bill + tip;
          const perPerson = total / people;
          return { tip, total, perPerson };
        `;
      case 'bmi':
        return `
          const heightInches = (feet * 12) + inches;
          const bmi = (weight / (heightInches * heightInches)) * 703;
          let category = 'Normal';
          if (bmi < 18.5) category = 'Underweight';
          else if (bmi >= 25 && bmi < 30) category = 'Overweight';
          else if (bmi >= 30) category = 'Obese';
          return { bmi: bmi.toFixed(1), category };
        `;
      case 'compound':
        return `
          const future = principal * Math.pow((1 + (rate / 100 / compound)), compound * years);
          const earnings = future - principal;
          return { future, earnings };
        `;
      case 'roi':
        return `
          const gain = final - initial;
          const roi = ((final - initial) / initial) * 100;
          return { roi, gain };
        `;
      case 'discount':
        return `
          const savings = original * (discount / 100);
          const sale = original - savings;
          return { sale, savings };
        `;
      case 'percentage':
        return `
          const result = value * (percentage / 100);
          const remaining = value - result;
          return { result, remaining };
        `;
      default:
        return `
          let result = value1;
          if (operation === 'add') result = value1 + value2;
          if (operation === 'subtract') result = value1 - value2;
          if (operation === 'multiply') result = value1 * value2;
          if (operation === 'divide') result = value2 !== 0 ? value1 / value2 : 0;
          return { result };
        `;
    }
  }
  
  /**
   * Generate app title from prompt
   */
  private generateAppTitle(prompt: string, types: UIComponentType[]): string {
    const typeNames: Record<UIComponentType, string> = {
      calculator: 'Calculator',
      chart: 'Chart',
      table: 'Data Table',
      comparison: 'Comparison',
      timeline: 'Timeline',
      form: 'Form',
      diagram: 'Diagram',
      map: 'Map',
      kanban: 'Board',
      calendar: 'Calendar',
      code_editor: 'Code Editor',
      markdown_viewer: 'Document',
      image_gallery: 'Gallery',
      custom: 'App',
    };
    
    const mainType = types[0] || 'custom';
    const words = prompt.split(/\s+/).slice(0, 4).join(' ');
    
    if (words.length > 3) {
      return `${words.charAt(0).toUpperCase() + words.slice(1)} ${typeNames[mainType]}`;
    }
    
    return `Interactive ${typeNames[mainType]}`;
  }
  
  /**
   * Determine recommended view
   */
  private determineRecommendedView(
    detection: { confidence: number; suggestedTypes: UIComponentType[] },
    app: GeneratedApp
  ): 'text' | 'app' | 'split' {
    // High confidence and interactive = show app
    if (detection.confidence >= 0.85 && app.isInteractive) {
      return 'app';
    }
    
    // Calculator specifically should default to app view
    if (detection.suggestedTypes.includes('calculator')) {
      return 'app';
    }
    
    // Medium confidence = split view
    if (detection.confidence >= 0.7) {
      return 'split';
    }
    
    return 'text';
  }
  
  /**
   * Save app to database
   */
  private async saveApp(tenantId: string, userId: string, app: GeneratedApp): Promise<void> {
    await executeStatement(
      `INSERT INTO generated_apps (
        id, tenant_id, user_id, conversation_id, message_id,
        title, description, components, layout,
        initial_state, compute_logic, is_interactive, created_at
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
        $6, $7, $8::jsonb, $9,
        $10::jsonb, $11::jsonb, $12, $13
      )`,
      [
        stringParam('id', app.id),
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('conversationId', app.conversationId || ''),
        stringParam('messageId', app.messageId || ''),
        stringParam('title', app.title),
        stringParam('description', app.description),
        stringParam('components', JSON.stringify(app.components)),
        stringParam('layout', app.layout),
        stringParam('initialState', JSON.stringify(app.initialState)),
        stringParam('computeLogic', JSON.stringify(app.computeLogic)),
        stringParam('isInteractive', String(app.isInteractive)),
        stringParam('createdAt', app.createdAt.toISOString()),
      ]
    );
  }
  
  /**
   * Get app by ID
   */
  async getApp(appId: string): Promise<GeneratedApp | null> {
    const result = await executeStatement(
      `SELECT * FROM generated_apps WHERE id = $1::uuid`,
      [stringParam('id', appId)]
    );
    
    if (!result.rows?.length) return null;
    
    const row = result.rows[0] as Record<string, unknown>;
    return {
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      components: row.components as UIComponentSchema[],
      layout: row.layout as GeneratedApp['layout'],
      initialState: row.initial_state as Record<string, unknown>,
      computeLogic: row.compute_logic as ComputeLogic[],
      isInteractive: Boolean(row.is_interactive),
      conversationId: row.conversation_id as string,
      messageId: row.message_id as string,
      createdAt: new Date(row.created_at as string),
    };
  }
  
  /**
   * Compute outputs based on inputs
   */
  computeOutputs(
    app: GeneratedApp,
    inputs: Record<string, unknown>
  ): Record<string, unknown> {
    const outputs: Record<string, unknown> = {};
    
    for (const logic of app.computeLogic) {
      try {
        // Create a function from the formula
        const fn = new Function(...Object.keys(inputs), logic.formula);
        const result = fn(...Object.values(inputs));
        
        if (typeof result === 'object') {
          Object.assign(outputs, result);
        } else {
          outputs[logic.outputId] = result;
        }
      } catch (error) {
        outputs[logic.outputId] = 'Error';
      }
    }
    
    return outputs;
  }
}

export const thinkTankAppFactoryService = new ThinkTankAppFactoryService();
