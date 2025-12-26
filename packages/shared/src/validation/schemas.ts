/**
 * Request Validation Schemas
 * 
 * JSON Schema definitions for API request validation
 */

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

// ============================================================================
// Chat Completion Schema
// ============================================================================

export const ChatCompletionSchema = {
  type: 'object',
  required: ['model', 'messages'],
  properties: {
    model: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Model ID to use for completion',
    },
    messages: {
      type: 'array',
      minItems: 1,
      maxItems: 100,
      items: {
        type: 'object',
        required: ['role', 'content'],
        properties: {
          role: {
            type: 'string',
            enum: ['system', 'user', 'assistant', 'function'],
          },
          content: {
            type: 'string',
            maxLength: 100000,
          },
          name: {
            type: 'string',
            maxLength: 100,
          },
          function_call: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              arguments: { type: 'string' },
            },
          },
        },
      },
    },
    max_tokens: {
      type: 'integer',
      minimum: 1,
      maximum: 128000,
    },
    temperature: {
      type: 'number',
      minimum: 0,
      maximum: 2,
    },
    top_p: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
    n: {
      type: 'integer',
      minimum: 1,
      maximum: 10,
    },
    stream: {
      type: 'boolean',
    },
    stop: {
      oneOf: [
        { type: 'string' },
        { type: 'array', items: { type: 'string' }, maxItems: 4 },
      ],
    },
    presence_penalty: {
      type: 'number',
      minimum: -2,
      maximum: 2,
    },
    frequency_penalty: {
      type: 'number',
      minimum: -2,
      maximum: 2,
    },
    user: {
      type: 'string',
      maxLength: 100,
    },
    functions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'parameters'],
        properties: {
          name: { type: 'string', maxLength: 64 },
          description: { type: 'string', maxLength: 1000 },
          parameters: { type: 'object' },
        },
      },
    },
    function_call: {
      oneOf: [
        { type: 'string', enum: ['auto', 'none'] },
        { type: 'object', properties: { name: { type: 'string' } } },
      ],
    },
  },
  additionalProperties: false,
};

// ============================================================================
// Embeddings Schema
// ============================================================================

export const EmbeddingsSchema = {
  type: 'object',
  required: ['model', 'input'],
  properties: {
    model: {
      type: 'string',
      minLength: 1,
    },
    input: {
      oneOf: [
        { type: 'string', maxLength: 50000 },
        { type: 'array', items: { type: 'string' }, maxItems: 100 },
      ],
    },
    encoding_format: {
      type: 'string',
      enum: ['float', 'base64'],
    },
  },
  additionalProperties: false,
};

// ============================================================================
// Webhook Schema
// ============================================================================

export const WebhookSchema = {
  type: 'object',
  required: ['url', 'event_types'],
  properties: {
    url: {
      type: 'string',
      format: 'uri',
      maxLength: 500,
    },
    event_types: {
      type: 'array',
      minItems: 1,
      maxItems: 20,
      items: {
        type: 'string',
        enum: [
          'billing.low_balance',
          'billing.payment_received',
          'billing.subscription_changed',
          'usage.quota_reached',
          'usage.rate_limited',
          'usage.threshold_reached',
          'models.added',
          'models.deprecated',
          'models.updated',
          'admin.config_changed',
          'admin.user_added',
          'admin.api_key_created',
        ],
      },
    },
    description: {
      type: 'string',
      maxLength: 500,
    },
  },
  additionalProperties: false,
};

// ============================================================================
// Batch Job Schema
// ============================================================================

export const BatchJobSchema = {
  type: 'object',
  required: ['type', 'model', 'input_file'],
  properties: {
    type: {
      type: 'string',
      enum: ['embeddings', 'completions', 'moderation', 'translation', 'extraction', 'classification'],
    },
    model: {
      type: 'string',
      minLength: 1,
    },
    input_file: {
      type: 'string',
      description: 'S3 key of input file',
    },
    options: {
      type: 'object',
      properties: {
        system_prompt: { type: 'string' },
        max_tokens: { type: 'integer' },
        target_language: { type: 'string' },
        schema: { type: 'string' },
        categories: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  additionalProperties: false,
};

// ============================================================================
// Configuration Schema
// ============================================================================

export const ConfigurationSchema = {
  type: 'object',
  required: ['key', 'value'],
  properties: {
    key: {
      type: 'string',
      pattern: '^[a-z][a-z0-9_]*$',
      maxLength: 100,
    },
    value: {
      oneOf: [
        { type: 'string' },
        { type: 'number' },
        { type: 'boolean' },
        { type: 'object' },
        { type: 'array' },
      ],
    },
    description: {
      type: 'string',
      maxLength: 500,
    },
  },
  additionalProperties: false,
};

// ============================================================================
// Validator Function
// ============================================================================

type Schema = {
  type: string;
  required?: string[];
  properties?: Record<string, unknown>;
  additionalProperties?: boolean;
  items?: unknown;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  enum?: unknown[];
  pattern?: string;
  format?: string;
  oneOf?: unknown[];
};

export function validate(data: unknown, schema: Schema): ValidationResult {
  const errors: ValidationError[] = [];
  
  validateValue(data, schema, '', errors);
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateValue(
  value: unknown,
  schema: Schema,
  path: string,
  errors: ValidationError[]
): void {
  if (schema.oneOf) {
    const validOptions = schema.oneOf.filter((option) => {
      const tempErrors: ValidationError[] = [];
      validateValue(value, option as Schema, path, tempErrors);
      return tempErrors.length === 0;
    });
    
    if (validOptions.length === 0) {
      errors.push({
        path,
        message: 'Value does not match any allowed type',
        code: 'invalid_type',
      });
    }
    return;
  }

  // Type check
  if (schema.type) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (schema.type !== actualType) {
      errors.push({
        path,
        message: `Expected ${schema.type}, got ${actualType}`,
        code: 'invalid_type',
      });
      return;
    }
  }

  // String validations
  if (typeof value === 'string') {
    if (schema.minLength && value.length < schema.minLength) {
      errors.push({
        path,
        message: `String must be at least ${schema.minLength} characters`,
        code: 'string_too_short',
      });
    }
    if (schema.maxLength && value.length > schema.maxLength) {
      errors.push({
        path,
        message: `String must be at most ${schema.maxLength} characters`,
        code: 'string_too_long',
      });
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push({
        path,
        message: `String does not match pattern ${schema.pattern}`,
        code: 'pattern_mismatch',
      });
    }
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({
        path,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        code: 'invalid_enum',
      });
    }
  }

  // Number validations
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        path,
        message: `Number must be at least ${schema.minimum}`,
        code: 'number_too_small',
      });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        path,
        message: `Number must be at most ${schema.maximum}`,
        code: 'number_too_large',
      });
    }
  }

  // Array validations
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) {
      errors.push({
        path,
        message: `Array must have at least ${schema.minItems} items`,
        code: 'array_too_short',
      });
    }
    if (schema.maxItems && value.length > schema.maxItems) {
      errors.push({
        path,
        message: `Array must have at most ${schema.maxItems} items`,
        code: 'array_too_long',
      });
    }
    if (schema.items) {
      value.forEach((item, index) => {
        validateValue(item, schema.items as Schema, `${path}[${index}]`, errors);
      });
    }
  }

  // Object validations
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    
    // Required properties
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in obj)) {
          errors.push({
            path: path ? `${path}.${key}` : key,
            message: `Missing required property: ${key}`,
            code: 'missing_required',
          });
        }
      }
    }

    // Validate properties
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          validateValue(
            obj[key],
            propSchema as Schema,
            path ? `${path}.${key}` : key,
            errors
          );
        }
      }
    }

    // Additional properties check
    if (schema.additionalProperties === false && schema.properties) {
      const allowedKeys = Object.keys(schema.properties);
      for (const key of Object.keys(obj)) {
        if (!allowedKeys.includes(key)) {
          errors.push({
            path: path ? `${path}.${key}` : key,
            message: `Unknown property: ${key}`,
            code: 'unknown_property',
          });
        }
      }
    }
  }
}
