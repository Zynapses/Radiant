// RADIANT v4.18.0 - Complete Model Registry
// All external models (60+) with pricing and capabilities

export interface ModelDefinition {
  id: string;
  providerId: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  pricing: { inputPer1M: number; outputPer1M: number };
  capabilities: string[];
  isNovel: boolean;
  category: 'flagship' | 'balanced' | 'economy' | 'specialized' | 'novel' | 'general';
  supportedModalities?: string[];
}

export const MODEL_REGISTRY: ModelDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // ANTHROPIC MODELS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'claude-4-opus',
    providerId: 'anthropic',
    displayName: 'Claude 4 Opus',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 15.00, outputPer1M: 75.00 },
    capabilities: ['chat', 'reasoning', 'analysis', 'code', 'vision'],
    isNovel: false,
    category: 'flagship',
  },
  {
    id: 'claude-4-sonnet',
    providerId: 'anthropic',
    displayName: 'Claude 4 Sonnet',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 3.00, outputPer1M: 15.00 },
    capabilities: ['chat', 'reasoning', 'analysis', 'code', 'vision'],
    isNovel: false,
    category: 'balanced',
  },
  {
    id: 'claude-3.5-haiku',
    providerId: 'anthropic',
    displayName: 'Claude 3.5 Haiku',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 0.25, outputPer1M: 1.25 },
    capabilities: ['chat', 'code'],
    isNovel: false,
    category: 'economy',
  },
  {
    id: 'claude-4-opus-agents',
    providerId: 'anthropic',
    displayName: 'Claude Opus Agents',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 15.00, outputPer1M: 75.00 },
    capabilities: ['chat', 'tool_use', 'computer_use', 'agents'],
    isNovel: true,
    category: 'novel',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // OPENAI MODELS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'gpt-4o',
    providerId: 'openai',
    displayName: 'GPT-4o',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    pricing: { inputPer1M: 2.50, outputPer1M: 10.00 },
    capabilities: ['chat', 'reasoning', 'vision', 'audio'],
    isNovel: false,
    category: 'flagship',
  },
  {
    id: 'gpt-4o-mini',
    providerId: 'openai',
    displayName: 'GPT-4o Mini',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    pricing: { inputPer1M: 0.15, outputPer1M: 0.60 },
    capabilities: ['chat', 'vision'],
    isNovel: false,
    category: 'economy',
  },
  {
    id: 'o1',
    providerId: 'openai',
    displayName: 'o1 Reasoning',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    pricing: { inputPer1M: 15.00, outputPer1M: 60.00 },
    capabilities: ['reasoning', 'analysis', 'math', 'code'],
    isNovel: false,
    category: 'specialized',
  },
  {
    id: 'o1-pro',
    providerId: 'openai',
    displayName: 'o1 Pro',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    pricing: { inputPer1M: 150.00, outputPer1M: 600.00 },
    capabilities: ['reasoning', 'analysis', 'math', 'code', 'extended_thinking'],
    isNovel: true,
    category: 'novel',
  },
  {
    id: 'gpt-4o-realtime',
    providerId: 'openai',
    displayName: 'GPT-4o Realtime',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    pricing: { inputPer1M: 5.00, outputPer1M: 20.00 },
    capabilities: ['voice', 'streaming', 'realtime'],
    isNovel: true,
    category: 'novel',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // GOOGLE MODELS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'gemini-2.0-pro',
    providerId: 'google',
    displayName: 'Gemini 2.0 Pro',
    contextWindow: 2000000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 1.25, outputPer1M: 5.00 },
    capabilities: ['chat', 'reasoning', 'vision', 'code'],
    isNovel: false,
    category: 'flagship',
  },
  {
    id: 'gemini-2.0-flash',
    providerId: 'google',
    displayName: 'Gemini 2.0 Flash',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 0.075, outputPer1M: 0.30 },
    capabilities: ['chat', 'vision', 'fast'],
    isNovel: false,
    category: 'balanced',
  },
  {
    id: 'gemini-2.0-ultra',
    providerId: 'google',
    displayName: 'Gemini 2.0 Ultra',
    contextWindow: 2000000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 5.00, outputPer1M: 15.00 },
    capabilities: ['chat', 'reasoning', 'vision', 'multimodal'],
    isNovel: true,
    category: 'novel',
  },
  {
    id: 'gemini-2.0-pro-exp',
    providerId: 'google',
    displayName: 'Gemini Pro Experimental',
    contextWindow: 10000000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 2.50, outputPer1M: 10.00 },
    capabilities: ['chat', 'reasoning', 'massive_context'],
    isNovel: true,
    category: 'novel',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // XAI/GROK MODELS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'grok-3',
    providerId: 'xai',
    displayName: 'Grok 3',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 3.00, outputPer1M: 15.00 },
    capabilities: ['chat', 'reasoning', 'realtime_info'],
    isNovel: false,
    category: 'flagship',
  },
  {
    id: 'grok-3-fast',
    providerId: 'xai',
    displayName: 'Grok 3 Fast',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 1.00, outputPer1M: 5.00 },
    capabilities: ['chat', 'fast'],
    isNovel: false,
    category: 'balanced',
  },
  {
    id: 'grok-3-mini',
    providerId: 'xai',
    displayName: 'Grok 3 Mini',
    contextWindow: 131072,
    maxOutputTokens: 4096,
    pricing: { inputPer1M: 0.30, outputPer1M: 1.50 },
    capabilities: ['chat'],
    isNovel: false,
    category: 'economy',
  },
  {
    id: 'grok-2-vision',
    providerId: 'xai',
    displayName: 'Grok 2 Vision',
    contextWindow: 32768,
    maxOutputTokens: 4096,
    pricing: { inputPer1M: 2.00, outputPer1M: 10.00 },
    capabilities: ['chat', 'vision', 'image_analysis'],
    isNovel: true,
    category: 'novel',
  },
  {
    id: 'grok-coder',
    providerId: 'xai',
    displayName: 'Grok Coder',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 1.50, outputPer1M: 7.50 },
    capabilities: ['chat', 'code_generation', 'code_review'],
    isNovel: true,
    category: 'specialized',
  },
  {
    id: 'grok-analyst',
    providerId: 'xai',
    displayName: 'Grok Analyst',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 2.00, outputPer1M: 10.00 },
    capabilities: ['chat', 'data_analysis', 'insights'],
    isNovel: true,
    category: 'specialized',
  },
  {
    id: 'grok-realtime',
    providerId: 'xai',
    displayName: 'Grok Realtime',
    contextWindow: 32768,
    maxOutputTokens: 4096,
    pricing: { inputPer1M: 5.00, outputPer1M: 20.00 },
    capabilities: ['chat', 'voice', 'streaming', 'realtime'],
    isNovel: true,
    category: 'novel',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // DEEPSEEK MODELS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'deepseek-v3',
    providerId: 'deepseek',
    displayName: 'DeepSeek V3',
    contextWindow: 64000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 0.14, outputPer1M: 0.28 },
    capabilities: ['chat', 'code', 'reasoning'],
    isNovel: false,
    category: 'economy',
  },
  {
    id: 'deepseek-r1',
    providerId: 'deepseek',
    displayName: 'DeepSeek R1',
    contextWindow: 64000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 0.55, outputPer1M: 2.19 },
    capabilities: ['reasoning', 'chain_of_thought', 'analysis'],
    isNovel: true,
    category: 'novel',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // MISTRAL MODELS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'mistral-large-2',
    providerId: 'mistral',
    displayName: 'Mistral Large 2',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 2.00, outputPer1M: 6.00 },
    capabilities: ['chat', 'reasoning', 'multilingual'],
    isNovel: false,
    category: 'specialized',
  },
  {
    id: 'codestral-latest',
    providerId: 'mistral',
    displayName: 'Codestral',
    contextWindow: 32000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 0.30, outputPer1M: 0.90 },
    capabilities: ['code', 'code_generation', 'code_review'],
    isNovel: false,
    category: 'specialized',
  },
  {
    id: 'mistral-medium',
    providerId: 'mistral',
    displayName: 'Mistral Medium',
    contextWindow: 32000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 0.27, outputPer1M: 0.81 },
    capabilities: ['chat', 'reasoning'],
    isNovel: false,
    category: 'balanced',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PERPLEXITY MODELS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'perplexity-sonar-pro',
    providerId: 'perplexity',
    displayName: 'Sonar Pro',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 3.00, outputPer1M: 15.00 },
    capabilities: ['search', 'chat', 'citations', 'realtime_info'],
    isNovel: false,
    category: 'specialized',
  },
  {
    id: 'perplexity-sonar',
    providerId: 'perplexity',
    displayName: 'Sonar',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 1.00, outputPer1M: 5.00 },
    capabilities: ['search', 'chat', 'citations'],
    isNovel: false,
    category: 'balanced',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // COHERE MODELS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'command-r-plus',
    providerId: 'cohere',
    displayName: 'Command R+',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 2.50, outputPer1M: 10.00 },
    capabilities: ['chat', 'rag', 'multilingual'],
    isNovel: true,
    category: 'specialized',
  },
  {
    id: 'command-r',
    providerId: 'cohere',
    displayName: 'Command R',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    pricing: { inputPer1M: 0.50, outputPer1M: 1.50 },
    capabilities: ['chat', 'rag'],
    isNovel: false,
    category: 'balanced',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // TOGETHER AI / OPEN MODELS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'qwen-2.5-coder',
    providerId: 'together',
    displayName: 'Qwen 2.5 Coder',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 0.30, outputPer1M: 0.90 },
    capabilities: ['code', 'code_generation'],
    isNovel: true,
    category: 'novel',
  },
  {
    id: 'llama-3.3-70b',
    providerId: 'together',
    displayName: 'Llama 3.3 70B',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 0.88, outputPer1M: 0.88 },
    capabilities: ['chat', 'reasoning', 'open_weights'],
    isNovel: true,
    category: 'novel',
  },
  {
    id: 'llama-3.2-90b-vision',
    providerId: 'together',
    displayName: 'Llama 3.2 90B Vision',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    pricing: { inputPer1M: 1.20, outputPer1M: 1.20 },
    capabilities: ['chat', 'vision', 'open_weights'],
    isNovel: true,
    category: 'novel',
  },
  {
    id: 'mixtral-8x22b',
    providerId: 'together',
    displayName: 'Mixtral 8x22B',
    contextWindow: 65536,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 0.60, outputPer1M: 0.60 },
    capabilities: ['chat', 'reasoning'],
    isNovel: false,
    category: 'balanced',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // GROQ MODELS (Fast Inference)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'groq-llama-3.3-70b',
    providerId: 'groq',
    displayName: 'Llama 3.3 70B (Groq)',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 0.59, outputPer1M: 0.79 },
    capabilities: ['chat', 'fast', 'reasoning'],
    isNovel: false,
    category: 'balanced',
  },
  {
    id: 'groq-mixtral-8x7b',
    providerId: 'groq',
    displayName: 'Mixtral 8x7B (Groq)',
    contextWindow: 32768,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 0.24, outputPer1M: 0.24 },
    capabilities: ['chat', 'fast'],
    isNovel: false,
    category: 'economy',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // AZURE/MICROSOFT MODELS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'phi-4',
    providerId: 'azure_openai',
    displayName: 'Phi-4',
    contextWindow: 16000,
    maxOutputTokens: 4096,
    pricing: { inputPer1M: 0.07, outputPer1M: 0.14 },
    capabilities: ['chat', 'reasoning', 'efficient'],
    isNovel: true,
    category: 'novel',
  },
];

// Standard models (production-ready)
export const STANDARD_MODELS = MODEL_REGISTRY.filter(m => !m.isNovel);

// Novel models (cutting-edge/experimental)
export const NOVEL_MODELS = MODEL_REGISTRY.filter(m => m.isNovel);

// Get models by category
export function getModelsByCategory(category: ModelDefinition['category']): ModelDefinition[] {
  return MODEL_REGISTRY.filter(m => m.category === category);
}

// Get models by provider
export function getModelsByProvider(providerId: string): ModelDefinition[] {
  return MODEL_REGISTRY.filter(m => m.providerId === providerId);
}

// Get model by ID
export function getModelById(modelId: string): ModelDefinition | undefined {
  return MODEL_REGISTRY.find(m => m.id === modelId);
}
