/**
 * RADIANT Prompt Templates Library
 * 
 * Pre-built, tested prompt templates for common use cases
 */

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  template: string;
  variables: TemplateVariable[];
  examples: TemplateExample[];
  recommendedModels: string[];
}

export interface TemplateVariable {
  name: string;
  description: string;
  type: 'string' | 'number' | 'array' | 'object';
  required: boolean;
  default?: unknown;
}

export interface TemplateExample {
  variables: Record<string, unknown>;
  expectedOutput?: string;
}

/**
 * Apply variables to a template
 */
export function applyTemplate(
  template: string,
  variables: Record<string, unknown>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    const stringValue = typeof value === 'string' 
      ? value 
      : JSON.stringify(value);
    result = result.replace(placeholder, stringValue);
  }
  
  return result;
}

/**
 * Validate template variables
 */
export function validateVariables(
  template: PromptTemplate,
  variables: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const varDef of template.variables) {
    const value = variables[varDef.name];
    
    if (varDef.required && value === undefined) {
      errors.push(`Missing required variable: ${varDef.name}`);
      continue;
    }
    
    if (value !== undefined) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== varDef.type) {
        errors.push(`Invalid type for ${varDef.name}: expected ${varDef.type}, got ${actualType}`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Built-in Templates
// ============================================================================

export const TEMPLATES: PromptTemplate[] = [
  // Summarization
  {
    id: 'summarize-text',
    name: 'Text Summarization',
    description: 'Summarize a piece of text into key points',
    category: 'summarization',
    template: `Summarize the following text in {{style}} style, focusing on the main points.
Keep the summary to approximately {{length}} words.

Text to summarize:
{{text}}

Summary:`,
    variables: [
      { name: 'text', description: 'Text to summarize', type: 'string', required: true },
      { name: 'style', description: 'Summary style (brief, detailed, bullet-points)', type: 'string', required: false, default: 'brief' },
      { name: 'length', description: 'Approximate word count', type: 'number', required: false, default: 100 },
    ],
    examples: [
      {
        variables: {
          text: 'Long article text here...',
          style: 'bullet-points',
          length: 50,
        },
      },
    ],
    recommendedModels: ['gpt-4o', 'claude-3-sonnet', 'gpt-3.5-turbo'],
  },

  // Code Generation
  {
    id: 'generate-code',
    name: 'Code Generation',
    description: 'Generate code based on a description',
    category: 'coding',
    template: `Generate {{language}} code that accomplishes the following:

Task: {{task}}

Requirements:
{{requirements}}

Please provide clean, well-commented code that follows best practices for {{language}}.`,
    variables: [
      { name: 'language', description: 'Programming language', type: 'string', required: true },
      { name: 'task', description: 'What the code should do', type: 'string', required: true },
      { name: 'requirements', description: 'Additional requirements', type: 'string', required: false, default: 'None specified' },
    ],
    examples: [
      {
        variables: {
          language: 'TypeScript',
          task: 'Create a function that validates email addresses',
          requirements: '- Use regex\n- Return boolean\n- Handle edge cases',
        },
      },
    ],
    recommendedModels: ['gpt-4o', 'claude-3-opus', 'codellama-70b'],
  },

  // Translation
  {
    id: 'translate-text',
    name: 'Text Translation',
    description: 'Translate text between languages',
    category: 'translation',
    template: `Translate the following text from {{source_language}} to {{target_language}}.
Maintain the original tone and style.

Text:
{{text}}

Translation:`,
    variables: [
      { name: 'text', description: 'Text to translate', type: 'string', required: true },
      { name: 'source_language', description: 'Source language', type: 'string', required: true },
      { name: 'target_language', description: 'Target language', type: 'string', required: true },
    ],
    examples: [
      {
        variables: {
          text: 'Hello, how are you?',
          source_language: 'English',
          target_language: 'Spanish',
        },
        expectedOutput: 'Hola, ¿cómo estás?',
      },
    ],
    recommendedModels: ['gpt-4o', 'claude-3-sonnet', 'gemini-pro'],
  },

  // Data Extraction
  {
    id: 'extract-data',
    name: 'Data Extraction',
    description: 'Extract structured data from unstructured text',
    category: 'extraction',
    template: `Extract the following information from the text below and return it as JSON:

Fields to extract: {{fields}}

Text:
{{text}}

Return only valid JSON with the extracted fields. Use null for missing information.`,
    variables: [
      { name: 'text', description: 'Text to extract from', type: 'string', required: true },
      { name: 'fields', description: 'Fields to extract (comma-separated)', type: 'string', required: true },
    ],
    examples: [
      {
        variables: {
          text: 'John Smith, age 35, works at Acme Corp as a Software Engineer. Contact: john@acme.com',
          fields: 'name, age, company, role, email',
        },
        expectedOutput: '{"name": "John Smith", "age": 35, "company": "Acme Corp", "role": "Software Engineer", "email": "john@acme.com"}',
      },
    ],
    recommendedModels: ['gpt-4o', 'claude-3-opus', 'gpt-3.5-turbo'],
  },

  // Sentiment Analysis
  {
    id: 'analyze-sentiment',
    name: 'Sentiment Analysis',
    description: 'Analyze the sentiment of text',
    category: 'analysis',
    template: `Analyze the sentiment of the following text.

Text:
{{text}}

Provide your analysis in the following JSON format:
{
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "confidence": 0.0 to 1.0,
  "emotions": ["list", "of", "detected", "emotions"],
  "summary": "brief explanation"
}`,
    variables: [
      { name: 'text', description: 'Text to analyze', type: 'string', required: true },
    ],
    examples: [
      {
        variables: {
          text: 'I absolutely love this product! It exceeded all my expectations.',
        },
      },
    ],
    recommendedModels: ['gpt-4o', 'claude-3-sonnet', 'gpt-3.5-turbo'],
  },

  // Q&A
  {
    id: 'question-answer',
    name: 'Question Answering',
    description: 'Answer questions based on provided context',
    category: 'qa',
    template: `Answer the question based only on the provided context. If the answer cannot be found in the context, say "I cannot find this information in the provided context."

Context:
{{context}}

Question: {{question}}

Answer:`,
    variables: [
      { name: 'context', description: 'Context to search for answer', type: 'string', required: true },
      { name: 'question', description: 'Question to answer', type: 'string', required: true },
    ],
    examples: [
      {
        variables: {
          context: 'The Eiffel Tower was built in 1889 and is 330 meters tall.',
          question: 'How tall is the Eiffel Tower?',
        },
        expectedOutput: 'The Eiffel Tower is 330 meters tall.',
      },
    ],
    recommendedModels: ['gpt-4o', 'claude-3-sonnet', 'gemini-pro'],
  },

  // Content Generation
  {
    id: 'generate-content',
    name: 'Content Generation',
    description: 'Generate various types of content',
    category: 'content',
    template: `Generate {{content_type}} about {{topic}}.

Tone: {{tone}}
Length: {{length}}
Target audience: {{audience}}

Additional instructions: {{instructions}}`,
    variables: [
      { name: 'content_type', description: 'Type of content (blog post, email, social media post, etc.)', type: 'string', required: true },
      { name: 'topic', description: 'Topic to write about', type: 'string', required: true },
      { name: 'tone', description: 'Writing tone', type: 'string', required: false, default: 'professional' },
      { name: 'length', description: 'Desired length', type: 'string', required: false, default: 'medium' },
      { name: 'audience', description: 'Target audience', type: 'string', required: false, default: 'general' },
      { name: 'instructions', description: 'Additional instructions', type: 'string', required: false, default: 'None' },
    ],
    examples: [
      {
        variables: {
          content_type: 'blog post',
          topic: 'AI in healthcare',
          tone: 'informative',
          length: '500 words',
          audience: 'healthcare professionals',
        },
      },
    ],
    recommendedModels: ['gpt-4o', 'claude-3-opus', 'claude-3-sonnet'],
  },

  // Classification
  {
    id: 'classify-text',
    name: 'Text Classification',
    description: 'Classify text into categories',
    category: 'classification',
    template: `Classify the following text into one of these categories: {{categories}}

Text:
{{text}}

Return your answer as JSON:
{
  "category": "selected category",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation"
}`,
    variables: [
      { name: 'text', description: 'Text to classify', type: 'string', required: true },
      { name: 'categories', description: 'Comma-separated list of categories', type: 'string', required: true },
    ],
    examples: [
      {
        variables: {
          text: 'My package arrived damaged and customer service was unhelpful.',
          categories: 'complaint, inquiry, feedback, praise',
        },
      },
    ],
    recommendedModels: ['gpt-4o', 'gpt-3.5-turbo', 'claude-3-haiku'],
  },
];

/**
 * Get all templates
 */
export function getAllTemplates(): PromptTemplate[] {
  return TEMPLATES;
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): PromptTemplate | undefined {
  return TEMPLATES.find(t => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): PromptTemplate[] {
  return TEMPLATES.filter(t => t.category === category);
}

/**
 * Search templates
 */
export function searchTemplates(query: string): PromptTemplate[] {
  const lowerQuery = query.toLowerCase();
  return TEMPLATES.filter(t => 
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.category.toLowerCase().includes(lowerQuery)
  );
}
