import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
  ConflictError,
  InternalError,
  ServiceUnavailableError,
  ProviderError,
  isOperationalError,
  toAppError,
} from '../errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should be abstract and extended by concrete errors', () => {
      const error = new ValidationError('Test error');
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.isOperational).toBe(true);
    });

    it('should serialize to JSON correctly', () => {
      const error = new ValidationError('Invalid input');
      const json = error.toJSON();
      
      expect(json.code).toBe('VALIDATION_ERROR');
      expect(json.message).toBe('Invalid input');
      expect(json.statusCode).toBe(400);
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with 400 status', () => {
      const error = new ValidationError('Invalid input');
      
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should include field details', () => {
      const error = new ValidationError('Invalid email', {
        email: ['Invalid format', 'Required field'],
      });
      
      expect(error.details).toEqual({ email: ['Invalid format', 'Required field'] });
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with 404 status', () => {
      const error = new NotFoundError('User');
      
      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should include resource name', () => {
      const error = new NotFoundError('Tenant');
      
      expect(error.resource).toBe('Tenant');
    });

    it('should have default message when no resource specified', () => {
      const error = new NotFoundError();
      
      expect(error.message).toBe('Resource not found');
    });
  });

  describe('UnauthorizedError', () => {
    it('should create unauthorized error with 401 status', () => {
      const error = new UnauthorizedError('Invalid token');
      
      expect(error.message).toBe('Invalid token');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('ForbiddenError', () => {
    it('should create forbidden error with 403 status', () => {
      const error = new ForbiddenError('Access denied');
      
      expect(error.message).toBe('Access denied');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error with 429 status', () => {
      const error = new RateLimitError();
      
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMITED');
    });

    it('should include retry after information', () => {
      const error = new RateLimitError(60);
      
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error with 409 status', () => {
      const error = new ConflictError('Resource already exists');
      
      expect(error.message).toBe('Resource already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });
  });

  describe('InternalError', () => {
    it('should create internal error with 500 status', () => {
      const error = new InternalError('Something went wrong');
      
      expect(error.message).toBe('Something went wrong');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should create service unavailable error with 503 status', () => {
      const error = new ServiceUnavailableError('Service temporarily unavailable');
      
      expect(error.message).toBe('Service temporarily unavailable');
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('ProviderError', () => {
    it('should create provider error with 502 status', () => {
      const error = new ProviderError('Upstream service error');
      
      expect(error.message).toBe('Upstream service error');
      expect(error.statusCode).toBe(502);
      expect(error.code).toBe('PROVIDER_ERROR');
    });

    it('should include provider name', () => {
      const error = new ProviderError('API failed', 'openai');
      
      expect(error.provider).toBe('openai');
    });
  });

  describe('isOperationalError', () => {
    it('should return true for AppError instances', () => {
      expect(isOperationalError(new ValidationError('test'))).toBe(true);
      expect(isOperationalError(new NotFoundError('test'))).toBe(true);
      expect(isOperationalError(new InternalError('test'))).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      expect(isOperationalError(new Error('test'))).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isOperationalError('string')).toBe(false);
      expect(isOperationalError(null)).toBe(false);
      expect(isOperationalError(undefined)).toBe(false);
    });
  });

  describe('toAppError', () => {
    it('should return AppError instances unchanged', () => {
      const error = new ValidationError('Invalid input');
      
      const result = toAppError(error);
      
      expect(result).toBe(error);
    });

    it('should convert regular Error to InternalError', () => {
      const error = new Error('Unexpected error');
      
      const result = toAppError(error);
      
      expect(result).toBeInstanceOf(InternalError);
      expect(result.message).toBe('Unexpected error');
    });

    it('should convert unknown values to InternalError', () => {
      const result = toAppError('string error');
      
      expect(result).toBeInstanceOf(InternalError);
      expect(result.message).toBe('Unknown error occurred');
    });
  });
});
