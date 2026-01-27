/**
 * API Validation Utilities
 * 
 * Provides Zod-based validation for API route handlers with
 * standardized error responses and type inference.
 */

import { z, ZodError, ZodSchema } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult<T> {
  success: true;
  data: T;
}

export interface ValidationError {
  success: false;
  error: {
    code: 'VALIDATION_ERROR';
    message: string;
    details: z.ZodIssue[];
  };
}

export type ValidatedResult<T> = ValidationResult<T> | ValidationError;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate request body against a Zod schema
 */
export async function validateBody<T extends ZodSchema>(
  request: NextRequest,
  schema: T
): Promise<ValidatedResult<z.infer<T>>> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    
    if (!result.success) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: formatZodError(result.error),
          details: result.error.issues,
        },
      };
    }
    
    return { success: true, data: result.data };
  } catch {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid JSON body',
        details: [],
      },
    };
  }
}

/**
 * Validate URL search params against a Zod schema
 */
export function validateParams<T extends ZodSchema>(
  params: URLSearchParams | Record<string, string>,
  schema: T
): ValidatedResult<z.infer<T>> {
  const obj = params instanceof URLSearchParams 
    ? Object.fromEntries(params.entries())
    : params;
    
  const result = schema.safeParse(obj);
  
  if (!result.success) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: formatZodError(result.error),
        details: result.error.issues,
      },
    };
  }
  
  return { success: true, data: result.data };
}

/**
 * Create a validation error response
 */
export function validationErrorResponse(error: ValidationError['error']): NextResponse {
  return NextResponse.json(
    { error: error.message, details: error.details },
    { status: 400 }
  );
}

/**
 * Format Zod errors into a readable string
 */
function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * Common pagination params schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().optional(),
});

/**
 * Common ID param schema (UUID)
 */
export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

/**
 * Common search params schema
 */
export const searchParamsSchema = z.object({
  q: z.string().min(1).max(200).optional(),
  search: z.string().min(1).max(200).optional(),
});

/**
 * Common date range schema
 */
export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  { message: 'startDate must be before endDate' }
);

/**
 * Common sort params schema
 */
export const sortParamsSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================================================
// Type Helpers
// ============================================================================

export type PaginationParams = z.infer<typeof paginationSchema>;
export type IdParam = z.infer<typeof idParamSchema>;
export type SearchParams = z.infer<typeof searchParamsSchema>;
export type DateRangeParams = z.infer<typeof dateRangeSchema>;
export type SortParams = z.infer<typeof sortParamsSchema>;
