/**
 * RADIANT SDK Types
 */

export interface RadiantConfig {
  /** API key for authentication */
  apiKey: string;
  
  /** Base URL for the API (set via RADIANT_API_URL env var or config) */
  baseUrl?: string;
  
  /** API version (default: v2) */
  version?: string;
  
  /** Request timeout in milliseconds (default: 60000) */
  timeout?: number;
  
  /** Maximum number of retries (default: 3) */
  maxRetries?: number;
  
  /** Custom headers to include in requests */
  headers?: Record<string, string>;
  
  /** Enable debug logging */
  debug?: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface ChatCompletionRequest {
  /** Model ID to use */
  model: string;
  
  /** Messages for the conversation */
  messages: ChatMessage[];
  
  /** Maximum tokens to generate */
  max_tokens?: number;
  
  /** Temperature for sampling (0-2) */
  temperature?: number;
  
  /** Top-p sampling */
  top_p?: number;
  
  /** Number of completions to generate */
  n?: number;
  
  /** Enable streaming */
  stream?: boolean;
  
  /** Stop sequences */
  stop?: string | string[];
  
  /** Presence penalty (-2 to 2) */
  presence_penalty?: number;
  
  /** Frequency penalty (-2 to 2) */
  frequency_penalty?: number;
  
  /** User identifier for abuse tracking */
  user?: string;
  
  /** Function definitions */
  functions?: FunctionDefinition[];
  
  /** Function call control */
  function_call?: 'auto' | 'none' | { name: string };
}

export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatChoice[];
  usage: Usage;
}

export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'length' | 'function_call' | 'content_filter';
}

export interface StreamingChatCompletionResponse {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: StreamingChoice[];
}

export interface StreamingChoice {
  index: number;
  delta: Partial<ChatMessage>;
  finish_reason: 'stop' | 'length' | 'function_call' | 'content_filter' | null;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface Model {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
  display_name: string;
  description?: string;
  category: string;
  context_window: number;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
  capabilities: string[];
}

export interface ModelList {
  object: 'list';
  data: Model[];
}

export interface CreditBalance {
  available: number;
  reserved: number;
  currency: string;
  updated_at: string;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    request_id: string;
    timestamp: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
}
