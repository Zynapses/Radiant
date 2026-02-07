/**
 * Sandboxed Expression Engine
 * RADIANT v5.53.0
 * 
 * Secure expression evaluation for workflow conditions.
 * Replaces unsafe `new Function()` with a sandboxed AST-based evaluator.
 * 
 * Implements Gemini's recommendation:
 * - No eval() or new Function()
 * - AST-based parsing with allowlisted operations
 * - Safe helper functions injected into context
 * - Prevents prototype pollution and code injection
 * 
 * Supports:
 * - Comparisons: >, <, >=, <=, ==, !=, ===, !==
 * - Logical: &&, ||, !
 * - Arithmetic: +, -, *, /, %
 * - Property access: output.confidence, output['key']
 * - Method calls: contains(), hasField(), length(), getField()
 * - Literals: numbers, strings, booleans, null
 */

import { createRegisteredLogger } from '../logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'workflow/sandboxed-expression',
  category: 'infrastructure',
  sourceType: 'application',
});

// =============================================================================
// Types
// =============================================================================

type ASTNode = 
  | LiteralNode
  | IdentifierNode
  | MemberExpressionNode
  | BinaryExpressionNode
  | UnaryExpressionNode
  | LogicalExpressionNode
  | CallExpressionNode
  | ConditionalExpressionNode;

interface LiteralNode {
  type: 'Literal';
  value: unknown;
}

interface IdentifierNode {
  type: 'Identifier';
  name: string;
}

interface MemberExpressionNode {
  type: 'MemberExpression';
  object: ASTNode;
  property: ASTNode;
  computed: boolean; // obj['key'] vs obj.key
}

interface BinaryExpressionNode {
  type: 'BinaryExpression';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

interface UnaryExpressionNode {
  type: 'UnaryExpression';
  operator: string;
  argument: ASTNode;
}

interface LogicalExpressionNode {
  type: 'LogicalExpression';
  operator: '&&' | '||';
  left: ASTNode;
  right: ASTNode;
}

interface CallExpressionNode {
  type: 'CallExpression';
  callee: ASTNode;
  arguments: ASTNode[];
}

interface ConditionalExpressionNode {
  type: 'ConditionalExpression';
  test: ASTNode;
  consequent: ASTNode;
  alternate: ASTNode;
}

export interface EvaluationContext {
  output?: unknown;
  content?: unknown;
  confidence?: number;
  streams?: unknown[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface EvaluationResult {
  success: boolean;
  value: unknown;
  error?: string;
  executionTimeMs: number;
}

// =============================================================================
// Allowlisted Operations
// =============================================================================

const ALLOWED_BINARY_OPERATORS = new Set([
  '+', '-', '*', '/', '%',
  '>', '<', '>=', '<=', '==', '!=', '===', '!==',
  'in',
]);

const ALLOWED_UNARY_OPERATORS = new Set(['!', '-', '+', 'typeof']);

const ALLOWED_IDENTIFIERS = new Set([
  'output', 'content', 'confidence', 'streams', 'metadata',
  'true', 'false', 'null', 'undefined',
  'Math', 'String', 'Number', 'Boolean', 'Array', 'Object',
]);

const ALLOWED_FUNCTIONS = new Set([
  'contains', 'hasField', 'getField', 'length', 'isEmpty',
  'startsWith', 'endsWith', 'matches', 'toLowerCase', 'toUpperCase',
  'includes', 'indexOf', 'slice', 'substring', 'trim',
  'min', 'max', 'abs', 'round', 'floor', 'ceil',
  'keys', 'values', 'entries', 'isArray', 'isObject', 'isString', 'isNumber',
]);

const BLOCKED_PROPERTIES = new Set([
  '__proto__', 'prototype', 'constructor',
  '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__',
  'eval', 'Function', 'require', 'import', 'process', 'global', 'window',
]);

// =============================================================================
// Safe Helper Functions
// =============================================================================

function createSafeHelpers(context: EvaluationContext) {
  const getContent = (): string => {
    if (typeof context.output === 'string') return context.output;
    if (typeof context.content === 'string') return context.content;
    if (context.output && typeof context.output === 'object') {
      const obj = context.output as Record<string, unknown>;
      if (typeof obj.content === 'string') return obj.content;
      if (typeof obj.text === 'string') return obj.text;
      return JSON.stringify(context.output);
    }
    return String(context.output || context.content || '');
  };

  return {
    // String operations
    contains: (text: string): boolean => {
      const content = getContent();
      return content.toLowerCase().includes(String(text).toLowerCase());
    },
    
    startsWith: (prefix: string): boolean => {
      return getContent().toLowerCase().startsWith(String(prefix).toLowerCase());
    },
    
    endsWith: (suffix: string): boolean => {
      return getContent().toLowerCase().endsWith(String(suffix).toLowerCase());
    },
    
    matches: (pattern: string): boolean => {
      try {
        const regex = new RegExp(pattern, 'i');
        return regex.test(getContent());
      } catch {
        return false;
      }
    },
    
    length: (): number => {
      const content = getContent();
      return content.length;
    },
    
    isEmpty: (): boolean => {
      const content = getContent();
      return !content || content.trim().length === 0;
    },
    
    // Object operations
    hasField: (field: string): boolean => {
      if (!context.output || typeof context.output !== 'object') return false;
      return field in (context.output as Record<string, unknown>);
    },
    
    getField: (field: string, defaultValue?: unknown): unknown => {
      if (!context.output || typeof context.output !== 'object') return defaultValue;
      const value = (context.output as Record<string, unknown>)[field];
      return value !== undefined ? value : defaultValue;
    },
    
    keys: (obj?: unknown): string[] => {
      const target = obj || context.output;
      if (!target || typeof target !== 'object') return [];
      return Object.keys(target as object);
    },
    
    values: (obj?: unknown): unknown[] => {
      const target = obj || context.output;
      if (!target || typeof target !== 'object') return [];
      return Object.values(target as object);
    },
    
    // Type checking
    isArray: (value?: unknown): boolean => {
      return Array.isArray(value !== undefined ? value : context.output);
    },
    
    isObject: (value?: unknown): boolean => {
      const v = value !== undefined ? value : context.output;
      return v !== null && typeof v === 'object' && !Array.isArray(v);
    },
    
    isString: (value?: unknown): boolean => {
      return typeof (value !== undefined ? value : context.output) === 'string';
    },
    
    isNumber: (value?: unknown): boolean => {
      return typeof (value !== undefined ? value : context.output) === 'number';
    },
    
    // Math operations
    min: Math.min,
    max: Math.max,
    abs: Math.abs,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
  };
}

// =============================================================================
// Tokenizer
// =============================================================================

interface Token {
  type: string;
  value: string;
  start: number;
  end: number;
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  
  while (i < expression.length) {
    // Skip whitespace
    if (/\s/.test(expression[i])) {
      i++;
      continue;
    }
    
    // Numbers
    if (/[0-9]/.test(expression[i]) || 
        (expression[i] === '.' && /[0-9]/.test(expression[i + 1]))) {
      const start = i;
      while (i < expression.length && /[0-9.]/.test(expression[i])) i++;
      tokens.push({ type: 'Number', value: expression.slice(start, i), start, end: i });
      continue;
    }
    
    // Strings
    if (expression[i] === '"' || expression[i] === "'") {
      const quote = expression[i];
      const start = i;
      i++;
      while (i < expression.length && expression[i] !== quote) {
        if (expression[i] === '\\') i++; // Skip escaped chars
        i++;
      }
      i++; // Skip closing quote
      tokens.push({ 
        type: 'String', 
        value: expression.slice(start + 1, i - 1).replace(/\\(.)/g, '$1'), 
        start, 
        end: i 
      });
      continue;
    }
    
    // Identifiers and keywords
    if (/[a-zA-Z_$]/.test(expression[i])) {
      const start = i;
      while (i < expression.length && /[a-zA-Z0-9_$]/.test(expression[i])) i++;
      const value = expression.slice(start, i);
      
      // Check for boolean/null literals
      if (value === 'true' || value === 'false') {
        tokens.push({ type: 'Boolean', value, start, end: i });
      } else if (value === 'null') {
        tokens.push({ type: 'Null', value, start, end: i });
      } else if (value === 'undefined') {
        tokens.push({ type: 'Undefined', value, start, end: i });
      } else {
        tokens.push({ type: 'Identifier', value, start, end: i });
      }
      continue;
    }
    
    // Multi-character operators
    const twoChar = expression.slice(i, i + 2);
    const threeChar = expression.slice(i, i + 3);
    
    if (threeChar === '===' || threeChar === '!==') {
      tokens.push({ type: 'Operator', value: threeChar, start: i, end: i + 3 });
      i += 3;
      continue;
    }
    
    if (['==', '!=', '<=', '>=', '&&', '||'].includes(twoChar)) {
      tokens.push({ type: 'Operator', value: twoChar, start: i, end: i + 2 });
      i += 2;
      continue;
    }
    
    // Single character operators and punctuation
    if (/[+\-*/%<>!=?:.,()[\]{}]/.test(expression[i])) {
      tokens.push({ type: 'Operator', value: expression[i], start: i, end: i + 1 });
      i++;
      continue;
    }
    
    throw new Error(`Unexpected character at position ${i}: ${expression[i]}`);
  }
  
  return tokens;
}

// =============================================================================
// Parser
// =============================================================================

class Parser {
  private tokens: Token[];
  private pos: number = 0;
  
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }
  
  parse(): ASTNode {
    const result = this.parseExpression();
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected token: ${this.tokens[this.pos].value}`);
    }
    return result;
  }
  
  private current(): Token | undefined {
    return this.tokens[this.pos];
  }
  
  private advance(): Token {
    return this.tokens[this.pos++];
  }
  
  private expect(value: string): Token {
    const token = this.advance();
    if (!token || token.value !== value) {
      throw new Error(`Expected '${value}' but got '${token?.value || 'EOF'}'`);
    }
    return token;
  }
  
  private parseExpression(): ASTNode {
    return this.parseTernary();
  }
  
  private parseTernary(): ASTNode {
    let node = this.parseLogicalOr();
    
    if (this.current()?.value === '?') {
      this.advance();
      const consequent = this.parseExpression();
      this.expect(':');
      const alternate = this.parseExpression();
      node = {
        type: 'ConditionalExpression',
        test: node,
        consequent,
        alternate,
      };
    }
    
    return node;
  }
  
  private parseLogicalOr(): ASTNode {
    let left = this.parseLogicalAnd();
    
    while (this.current()?.value === '||') {
      this.advance();
      const right = this.parseLogicalAnd();
      left = { type: 'LogicalExpression', operator: '||', left, right };
    }
    
    return left;
  }
  
  private parseLogicalAnd(): ASTNode {
    let left = this.parseEquality();
    
    while (this.current()?.value === '&&') {
      this.advance();
      const right = this.parseEquality();
      left = { type: 'LogicalExpression', operator: '&&', left, right };
    }
    
    return left;
  }
  
  private parseEquality(): ASTNode {
    let left = this.parseComparison();
    
    while (['==', '!=', '===', '!=='].includes(this.current()?.value || '')) {
      const operator = this.advance().value;
      const right = this.parseComparison();
      left = { type: 'BinaryExpression', operator, left, right };
    }
    
    return left;
  }
  
  private parseComparison(): ASTNode {
    let left = this.parseAdditive();
    
    while (['<', '>', '<=', '>=', 'in'].includes(this.current()?.value || '')) {
      const operator = this.advance().value;
      const right = this.parseAdditive();
      left = { type: 'BinaryExpression', operator, left, right };
    }
    
    return left;
  }
  
  private parseAdditive(): ASTNode {
    let left = this.parseMultiplicative();
    
    while (['+', '-'].includes(this.current()?.value || '')) {
      const operator = this.advance().value;
      const right = this.parseMultiplicative();
      left = { type: 'BinaryExpression', operator, left, right };
    }
    
    return left;
  }
  
  private parseMultiplicative(): ASTNode {
    let left = this.parseUnary();
    
    while (['*', '/', '%'].includes(this.current()?.value || '')) {
      const operator = this.advance().value;
      const right = this.parseUnary();
      left = { type: 'BinaryExpression', operator, left, right };
    }
    
    return left;
  }
  
  private parseUnary(): ASTNode {
    if (['!', '-', '+', 'typeof'].includes(this.current()?.value || '')) {
      const operator = this.advance().value;
      const argument = this.parseUnary();
      return { type: 'UnaryExpression', operator, argument };
    }
    
    return this.parseCallMember();
  }
  
  private parseCallMember(): ASTNode {
    let node = this.parsePrimary();
    
    while (true) {
      if (this.current()?.value === '.') {
        this.advance();
        const property = this.parsePrimary();
        if (property.type !== 'Identifier') {
          throw new Error('Expected identifier after .');
        }
        node = { type: 'MemberExpression', object: node, property, computed: false };
      } else if (this.current()?.value === '[') {
        this.advance();
        const property = this.parseExpression();
        this.expect(']');
        node = { type: 'MemberExpression', object: node, property, computed: true };
      } else if (this.current()?.value === '(') {
        this.advance();
        const args: ASTNode[] = [];
        while (this.current()?.value !== ')') {
          args.push(this.parseExpression());
          if (this.current()?.value === ',') this.advance();
        }
        this.expect(')');
        node = { type: 'CallExpression', callee: node, arguments: args };
      } else {
        break;
      }
    }
    
    return node;
  }
  
  private parsePrimary(): ASTNode {
    const token = this.current();
    
    if (!token) {
      throw new Error('Unexpected end of expression');
    }
    
    switch (token.type) {
      case 'Number':
        this.advance();
        return { type: 'Literal', value: parseFloat(token.value) };
        
      case 'String':
        this.advance();
        return { type: 'Literal', value: token.value };
        
      case 'Boolean':
        this.advance();
        return { type: 'Literal', value: token.value === 'true' };
        
      case 'Null':
        this.advance();
        return { type: 'Literal', value: null };
        
      case 'Undefined':
        this.advance();
        return { type: 'Literal', value: undefined };
        
      case 'Identifier':
        this.advance();
        return { type: 'Identifier', name: token.value };
        
      case 'Operator':
        if (token.value === '(') {
          this.advance();
          const expr = this.parseExpression();
          this.expect(')');
          return expr;
        }
        if (token.value === '[') {
          this.advance();
          const elements: ASTNode[] = [];
          while (this.current()?.value !== ']') {
            elements.push(this.parseExpression());
            if (this.current()?.value === ',') this.advance();
          }
          this.expect(']');
          return { type: 'Literal', value: elements.map(e => (e as LiteralNode).value) };
        }
        break;
    }
    
    throw new Error(`Unexpected token: ${token.value}`);
  }
}

// =============================================================================
// Evaluator
// =============================================================================

class Evaluator {
  private context: EvaluationContext;
  private helpers: ReturnType<typeof createSafeHelpers>;
  
  constructor(context: EvaluationContext) {
    this.context = context;
    this.helpers = createSafeHelpers(context);
  }
  
  evaluate(node: ASTNode): unknown {
    switch (node.type) {
      case 'Literal':
        return node.value;
        
      case 'Identifier':
        return this.resolveIdentifier(node.name);
        
      case 'MemberExpression':
        return this.evaluateMemberExpression(node);
        
      case 'BinaryExpression':
        return this.evaluateBinaryExpression(node);
        
      case 'UnaryExpression':
        return this.evaluateUnaryExpression(node);
        
      case 'LogicalExpression':
        return this.evaluateLogicalExpression(node);
        
      case 'CallExpression':
        return this.evaluateCallExpression(node);
        
      case 'ConditionalExpression':
        return this.evaluate(node.test) ? 
               this.evaluate(node.consequent) : 
               this.evaluate(node.alternate);
        
      default:
        throw new Error(`Unknown node type: ${(node as ASTNode).type}`);
    }
  }
  
  private resolveIdentifier(name: string): unknown {
    // Check helpers first
    if (name in this.helpers) {
      return (this.helpers as Record<string, unknown>)[name];
    }
    
    // Check context
    if (name in this.context) {
      return this.context[name];
    }
    
    // Built-in constants
    if (name === 'Math') return Math;
    if (name === 'true') return true;
    if (name === 'false') return false;
    if (name === 'null') return null;
    if (name === 'undefined') return undefined;
    
    return undefined;
  }
  
  private evaluateMemberExpression(node: MemberExpressionNode): unknown {
    const object = this.evaluate(node.object);
    
    if (object === null || object === undefined) {
      return undefined;
    }
    
    let propertyName: string;
    if (node.computed) {
      propertyName = String(this.evaluate(node.property));
    } else {
      propertyName = (node.property as IdentifierNode).name;
    }
    
    // Security check
    if (BLOCKED_PROPERTIES.has(propertyName)) {
      throw new Error(`Access to '${propertyName}' is not allowed`);
    }
    
    if (typeof object === 'object' && propertyName in object) {
      return (object as Record<string, unknown>)[propertyName];
    }
    
    return undefined;
  }
  
  private evaluateBinaryExpression(node: BinaryExpressionNode): unknown {
    const { operator, left, right } = node;
    
    if (!ALLOWED_BINARY_OPERATORS.has(operator)) {
      throw new Error(`Operator '${operator}' is not allowed`);
    }
    
    const leftVal = this.evaluate(left);
    const rightVal = this.evaluate(right);
    
    switch (operator) {
      case '+': return (leftVal as number) + (rightVal as number);
      case '-': return (leftVal as number) - (rightVal as number);
      case '*': return (leftVal as number) * (rightVal as number);
      case '/': return (leftVal as number) / (rightVal as number);
      case '%': return (leftVal as number) % (rightVal as number);
      case '>': return (leftVal as number) > (rightVal as number);
      case '<': return (leftVal as number) < (rightVal as number);
      case '>=': return (leftVal as number) >= (rightVal as number);
      case '<=': return (leftVal as number) <= (rightVal as number);
      case '==': return leftVal == rightVal;
      case '!=': return leftVal != rightVal;
      case '===': return leftVal === rightVal;
      case '!==': return leftVal !== rightVal;
      case 'in': return String(leftVal) in (rightVal as object);
      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  }
  
  private evaluateUnaryExpression(node: UnaryExpressionNode): unknown {
    const { operator, argument } = node;
    
    if (!ALLOWED_UNARY_OPERATORS.has(operator)) {
      throw new Error(`Operator '${operator}' is not allowed`);
    }
    
    const value = this.evaluate(argument);
    
    switch (operator) {
      case '!': return !value;
      case '-': return -(value as number);
      case '+': return +(value as number);
      case 'typeof': return typeof value;
      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  }
  
  private evaluateLogicalExpression(node: LogicalExpressionNode): unknown {
    const leftVal = this.evaluate(node.left);
    
    // Short-circuit evaluation
    if (node.operator === '&&') {
      return leftVal ? this.evaluate(node.right) : leftVal;
    } else {
      return leftVal ? leftVal : this.evaluate(node.right);
    }
  }
  
  private evaluateCallExpression(node: CallExpressionNode): unknown {
    let func: unknown;
    let thisArg: unknown = undefined;
    
    if (node.callee.type === 'Identifier') {
      const name = (node.callee as IdentifierNode).name;
      if (!ALLOWED_FUNCTIONS.has(name)) {
        throw new Error(`Function '${name}' is not allowed`);
      }
      func = this.resolveIdentifier(name);
    } else if (node.callee.type === 'MemberExpression') {
      const memberNode = node.callee as MemberExpressionNode;
      thisArg = this.evaluate(memberNode.object);
      const methodName = memberNode.computed 
        ? String(this.evaluate(memberNode.property))
        : (memberNode.property as IdentifierNode).name;
      
      if (BLOCKED_PROPERTIES.has(methodName)) {
        throw new Error(`Method '${methodName}' is not allowed`);
      }
      
      if (thisArg && typeof thisArg === 'object') {
        func = (thisArg as Record<string, unknown>)[methodName];
      }
    }
    
    if (typeof func !== 'function') {
      throw new Error('Not a function');
    }
    
    const args = node.arguments.map(arg => this.evaluate(arg));
    return (func as Function).apply(thisArg, args);
  }
}

// =============================================================================
// Public API
// =============================================================================

class SandboxedExpressionService {
  /**
   * Safely evaluate an expression against a context
   */
  evaluate(expression: string, context: EvaluationContext): EvaluationResult {
    const startTime = Date.now();
    
    try {
      // Validate expression length
      if (expression.length > 1000) {
        throw new Error('Expression too long (max 1000 characters)');
      }
      
      // Tokenize
      const tokens = tokenize(expression);
      
      // Parse
      const parser = new Parser(tokens);
      const ast = parser.parse();
      
      // Evaluate
      const evaluator = new Evaluator(context);
      const value = evaluator.evaluate(ast);
      
      return {
        success: true,
        value,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.warn('Expression evaluation failed', { 
        expression: expression.substring(0, 100),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return {
        success: false,
        value: false,
        error: error instanceof Error ? error.message : 'Evaluation failed',
        executionTimeMs: Date.now() - startTime,
      };
    }
  }
  
  /**
   * Validate an expression without executing it
   */
  validate(expression: string): { valid: boolean; error?: string } {
    try {
      if (expression.length > 1000) {
        return { valid: false, error: 'Expression too long' };
      }
      
      const tokens = tokenize(expression);
      const parser = new Parser(tokens);
      parser.parse();
      
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Invalid expression' 
      };
    }
  }
  
  /**
   * Evaluate as boolean (for conditions)
   */
  evaluateAsBoolean(expression: string, context: EvaluationContext): boolean {
    const result = this.evaluate(expression, context);
    return result.success && Boolean(result.value);
  }
}

export const sandboxedExpressionService = new SandboxedExpressionService();

export default sandboxedExpressionService;
