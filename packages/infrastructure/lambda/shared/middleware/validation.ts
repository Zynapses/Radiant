/**
 * Validation Middleware
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { Middleware, MiddlewareHandler } from './index';
import { ValidationError } from './error';

type Schema = Record<string, unknown>;

interface ValidationOptions {
  body?: Schema;
  query?: Schema;
  params?: Schema;
}

/**
 * Request validation middleware
 */
export function validationMiddleware(options: ValidationOptions): Middleware {
  return (next: MiddlewareHandler): MiddlewareHandler => {
    return async (event: APIGatewayProxyEvent, context: Context) => {
      const errors: Array<{ path: string; message: string }> = [];

      // Validate body
      if (options.body && event.body) {
        try {
          const body = JSON.parse(event.body);
          const bodyErrors = validateObject(body, options.body, 'body');
          errors.push(...bodyErrors);
        } catch (error) {
          errors.push({ path: 'body', message: 'Invalid JSON body' });
        }
      }

      // Validate query parameters
      if (options.query && event.queryStringParameters) {
        const queryErrors = validateObject(
          event.queryStringParameters,
          options.query,
          'query'
        );
        errors.push(...queryErrors);
      }

      // Validate path parameters
      if (options.params && event.pathParameters) {
        const paramErrors = validateObject(
          event.pathParameters,
          options.params,
          'params'
        );
        errors.push(...paramErrors);
      }

      if (errors.length > 0) {
        throw new ValidationError(errors);
      }

      return next(event, context);
    };
  };
}

function validateObject(
  data: Record<string, unknown>,
  schema: Schema,
  prefix: string
): Array<{ path: string; message: string }> {
  const errors: Array<{ path: string; message: string }> = [];
  
  // Check required fields
  const required = schema.required as string[] || [];
  for (const field of required) {
    if (data[field] === undefined || data[field] === null) {
      errors.push({
        path: `${prefix}.${field}`,
        message: `${field} is required`,
      });
    }
  }

  // Check field types
  const properties = schema.properties as Record<string, { type?: string; minLength?: number; maxLength?: number; minimum?: number; maximum?: number; enum?: unknown[] }> || {};
  for (const [field, rules] of Object.entries(properties)) {
    const value = data[field];
    if (value === undefined) continue;

    const fieldPath = `${prefix}.${field}`;

    // Type check
    if (rules.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (rules.type !== actualType) {
        errors.push({
          path: fieldPath,
          message: `Expected ${rules.type}, got ${actualType}`,
        });
        continue;
      }
    }

    // String validations
    if (typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push({
          path: fieldPath,
          message: `Must be at least ${rules.minLength} characters`,
        });
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push({
          path: fieldPath,
          message: `Must be at most ${rules.maxLength} characters`,
        });
      }
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push({
          path: fieldPath,
          message: `Must be one of: ${rules.enum.join(', ')}`,
        });
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (rules.minimum !== undefined && value < rules.minimum) {
        errors.push({
          path: fieldPath,
          message: `Must be at least ${rules.minimum}`,
        });
      }
      if (rules.maximum !== undefined && value > rules.maximum) {
        errors.push({
          path: fieldPath,
          message: `Must be at most ${rules.maximum}`,
        });
      }
    }
  }

  return errors;
}

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  pagination: {
    properties: {
      page: { type: 'string' },
      limit: { type: 'string' },
    },
  },
  
  idParam: {
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 1 },
    },
  },

  dateRange: {
    properties: {
      start_date: { type: 'string' },
      end_date: { type: 'string' },
    },
  },
};
