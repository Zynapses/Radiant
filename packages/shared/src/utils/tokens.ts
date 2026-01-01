/**
 * RADIANT v6.0.4 - Token Counting Utilities
 * Accurate token estimation for context budgeting
 * 
 * These utilities are used by the Dynamic Budget Calculator
 * to ensure the 1000-token response reserve is maintained.
 */

// =============================================================================
// Token Estimation
// =============================================================================

/**
 * Estimate token count for text
 * Uses a heuristic approach: ~4 characters per token on average
 * with adjustments for special content
 * 
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  
  // Base estimate: ~4 characters per token
  const baseEstimate = Math.ceil(text.length / 4);
  
  // Code blocks tend to have more tokens per character
  const codeBlockMatches = text.match(/```[\s\S]*?```/g) || [];
  const codeBlockAdjustment = codeBlockMatches.length * 10;
  
  // Inline code also has overhead
  const inlineCodeMatches = text.match(/`[^`]+`/g) || [];
  const inlineCodeAdjustment = inlineCodeMatches.length * 2;
  
  // URLs are typically tokenized inefficiently
  const urlMatches = text.match(/https?:\/\/[^\s]+/g) || [];
  const urlAdjustment = urlMatches.length * 5;
  
  // JSON/structured data has more tokens
  const jsonMatches = text.match(/\{[\s\S]*?\}/g) || [];
  const jsonAdjustment = jsonMatches.length * 3;
  
  // Numbers and special characters
  const numberMatches = text.match(/\d+/g) || [];
  const numberAdjustment = Math.ceil(numberMatches.length * 0.5);
  
  return baseEstimate + codeBlockAdjustment + inlineCodeAdjustment + 
         urlAdjustment + jsonAdjustment + numberAdjustment;
}

/**
 * More accurate token estimation using character-level analysis
 * Slower but more precise for budget-critical operations
 * 
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokensPrecise(text: string): number {
  if (!text) return 0;
  
  let tokens = 0;
  let currentWord = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    // Whitespace ends current word
    if (/\s/.test(char)) {
      if (currentWord) {
        tokens += estimateWordTokens(currentWord);
        currentWord = '';
      }
      // Whitespace is usually part of previous token
      continue;
    }
    
    // Punctuation often creates new tokens
    if (/[.,!?;:'"()\[\]{}]/.test(char)) {
      if (currentWord) {
        tokens += estimateWordTokens(currentWord);
        currentWord = '';
      }
      tokens += 1; // Punctuation is typically 1 token
      continue;
    }
    
    currentWord += char;
  }
  
  // Handle remaining word
  if (currentWord) {
    tokens += estimateWordTokens(currentWord);
  }
  
  return tokens;
}

/**
 * Estimate tokens for a single word
 * @param word - Word to estimate
 * @returns Estimated token count
 */
function estimateWordTokens(word: string): number {
  const length = word.length;
  
  // Short common words are usually 1 token
  if (length <= 4) return 1;
  
  // Medium words might be 1-2 tokens
  if (length <= 8) return Math.ceil(length / 5);
  
  // Longer words are split into subword tokens
  // Roughly 1 token per 4-5 characters
  return Math.ceil(length / 4);
}

// =============================================================================
// Token Truncation
// =============================================================================

/**
 * Truncate text to fit within token budget
 * Attempts to preserve semantic boundaries (sentences, words)
 * 
 * @param text - Text to truncate
 * @param maxTokens - Maximum allowed tokens
 * @returns Truncated text with ellipsis if needed
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  if (!text) return '';
  
  const currentTokens = estimateTokens(text);
  if (currentTokens <= maxTokens) return text;
  
  // Calculate approximate character limit
  const ratio = maxTokens / currentTokens;
  const targetChars = Math.floor(text.length * ratio * 0.9); // 10% safety margin
  
  // Try to break at sentence boundary
  const truncated = text.substring(0, targetChars);
  const lastSentence = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? ')
  );
  
  if (lastSentence > targetChars * 0.7) {
    return truncated.substring(0, lastSentence + 1) + '...';
  }
  
  // Fall back to word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > targetChars * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  // Last resort: hard cut
  return truncated + '...';
}

/**
 * Truncate text from the beginning (keep end)
 * Useful for conversation history truncation
 * 
 * @param text - Text to truncate
 * @param maxTokens - Maximum allowed tokens
 * @returns Truncated text with ellipsis at start if needed
 */
export function truncateFromStart(text: string, maxTokens: number): string {
  if (!text) return '';
  
  const currentTokens = estimateTokens(text);
  if (currentTokens <= maxTokens) return text;
  
  const ratio = maxTokens / currentTokens;
  const keepChars = Math.floor(text.length * ratio * 0.9);
  const startIndex = text.length - keepChars;
  
  // Try to break at sentence boundary
  const truncated = text.substring(startIndex);
  const firstSentence = Math.min(
    truncated.indexOf('. ') >= 0 ? truncated.indexOf('. ') : Infinity,
    truncated.indexOf('! ') >= 0 ? truncated.indexOf('! ') : Infinity,
    truncated.indexOf('? ') >= 0 ? truncated.indexOf('? ') : Infinity
  );
  
  if (firstSentence < keepChars * 0.3 && firstSentence !== Infinity) {
    return '...' + truncated.substring(firstSentence + 2);
  }
  
  // Fall back to word boundary
  const firstSpace = truncated.indexOf(' ');
  if (firstSpace > 0 && firstSpace < keepChars * 0.2) {
    return '...' + truncated.substring(firstSpace + 1);
  }
  
  return '...' + truncated;
}

/**
 * Truncate from middle (keep start and end)
 * Useful for long documents where context at both ends matters
 * 
 * @param text - Text to truncate
 * @param maxTokens - Maximum allowed tokens
 * @param keepStartRatio - Ratio of tokens to keep from start (default: 0.6)
 * @returns Truncated text with ellipsis in middle if needed
 */
export function truncateMiddle(
  text: string, 
  maxTokens: number, 
  keepStartRatio: number = 0.6
): string {
  if (!text) return '';
  
  const currentTokens = estimateTokens(text);
  if (currentTokens <= maxTokens) return text;
  
  const startTokens = Math.floor(maxTokens * keepStartRatio);
  const endTokens = maxTokens - startTokens - 10; // Reserve for ellipsis
  
  const startPart = truncateToTokens(text, startTokens).replace(/\.\.\.$/, '');
  const endPart = truncateFromStart(text, endTokens).replace(/^\.\.\./, '');
  
  return startPart + '\n\n[...content truncated...]\n\n' + endPart;
}

// =============================================================================
// Token Budget Helpers
// =============================================================================

/**
 * Calculate if content fits within budget
 * @param content - Content to check
 * @param budget - Token budget
 * @returns True if content fits
 */
export function fitsInBudget(content: string, budget: number): boolean {
  return estimateTokens(content) <= budget;
}

/**
 * Calculate remaining budget after content
 * @param content - Content to account for
 * @param totalBudget - Total available budget
 * @returns Remaining tokens
 */
export function remainingBudget(content: string, totalBudget: number): number {
  return Math.max(0, totalBudget - estimateTokens(content));
}

/**
 * Split content to fit multiple budgets
 * Useful for paginating long content
 * 
 * @param content - Content to split
 * @param budgetPerPart - Token budget per part
 * @returns Array of content parts
 */
export function splitToBudget(content: string, budgetPerPart: number): string[] {
  if (!content) return [];
  
  const totalTokens = estimateTokens(content);
  if (totalTokens <= budgetPerPart) return [content];
  
  const parts: string[] = [];
  const paragraphs = content.split(/\n\n+/);
  let currentPart = '';
  let currentTokens = 0;
  
  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);
    
    if (currentTokens + paraTokens <= budgetPerPart) {
      currentPart += (currentPart ? '\n\n' : '') + para;
      currentTokens += paraTokens;
    } else {
      if (currentPart) {
        parts.push(currentPart);
      }
      
      // Handle paragraphs larger than budget
      if (paraTokens > budgetPerPart) {
        const truncated = truncateToTokens(para, budgetPerPart);
        parts.push(truncated);
        currentPart = '';
        currentTokens = 0;
      } else {
        currentPart = para;
        currentTokens = paraTokens;
      }
    }
  }
  
  if (currentPart) {
    parts.push(currentPart);
  }
  
  return parts;
}

// =============================================================================
// Token Statistics
// =============================================================================

/**
 * Get detailed token statistics for content
 * @param content - Content to analyze
 * @returns Token statistics
 */
export function getTokenStats(content: string): {
  total: number;
  words: number;
  sentences: number;
  paragraphs: number;
  codeBlocks: number;
  averageTokensPerSentence: number;
} {
  if (!content) {
    return {
      total: 0,
      words: 0,
      sentences: 0,
      paragraphs: 0,
      codeBlocks: 0,
      averageTokensPerSentence: 0,
    };
  }
  
  const total = estimateTokens(content);
  const words = content.split(/\s+/).filter(w => w.length > 0).length;
  const sentences = (content.match(/[.!?]+/g) || []).length || 1;
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0).length;
  const codeBlocks = (content.match(/```[\s\S]*?```/g) || []).length;
  
  return {
    total,
    words,
    sentences,
    paragraphs,
    codeBlocks,
    averageTokensPerSentence: Math.round(total / sentences),
  };
}
