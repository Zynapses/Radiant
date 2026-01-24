/**
 * AI Reports Handler Tests
 * Tests for the AI-powered report generation API endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
jest.mock('../lambda/shared/db/client', () => ({
  executeStatement: jest.fn(),
  stringParam: jest.fn((name: string, value: string | null) => ({ name, value: { stringValue: value } })),
}));

jest.mock('../lambda/shared/report-exporters', () => ({
  generatePdfReport: jest.fn().mockResolvedValue(Buffer.from('mock-pdf')),
  generateExcelReport: jest.fn().mockResolvedValue(Buffer.from('mock-excel')),
  generateHtmlReport: jest.fn().mockResolvedValue('<html>mock</html>'),
  GeneratedReport: {},
}));

jest.mock('../lambda/shared/s3-client', () => ({
  uploadToS3: jest.fn().mockResolvedValue(undefined),
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/signed-url'),
}));

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: '{"title": "Test Report", "sections": [], "created_at": "2024-01-01T00:00:00Z"}' }]
      }))
    })
  })),
  InvokeModelCommand: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid-1234'),
}));

describe('AI Reports Handler', () => {
  let handler: typeof import('../lambda/admin/ai-reports').handler;
  let executeStatement: ReturnType<typeof jest.fn>;

  beforeEach(async () => {
    jest.clearAllMocks();
    const dbClient = await import('../lambda/shared/db/client');
    executeStatement = dbClient.executeStatement as ReturnType<typeof jest.fn>;
    const aiReports = await import('../lambda/admin/ai-reports');
    handler = aiReports.handler;
  });

  const createMockEvent = (overrides: Record<string, unknown> = {}) => ({
    httpMethod: 'GET',
    path: '/admin/ai-reports',
    body: null,
    headers: {},
    multiValueHeaders: {},
    isBase64Encoded: false,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '',
    requestContext: {
      accountId: '123456789',
      apiId: 'api-id',
      authorizer: {
        tenantId: 'test-tenant',
        userId: 'test-user',
      },
      httpMethod: 'GET',
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      path: '/admin/ai-reports',
      protocol: 'HTTP/1.1',
      requestId: 'request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/admin/ai-reports',
      stage: 'test',
    },
    ...overrides,
  });

  describe('Authentication', () => {
    it('should return 400 if tenant ID is missing', async () => {
      const event = createMockEvent({
        requestContext: {
          authorizer: {},
        },
      });

      const result = await handler(event as any);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({ error: 'Tenant ID required' });
    });
  });

  describe('GET /admin/ai-reports', () => {
    it('should list reports for tenant', async () => {
      const mockReports = [
        { id: 'report-1', title: 'Test Report 1', status: 'complete' },
        { id: 'report-2', title: 'Test Report 2', status: 'draft' },
      ];

      executeStatement.mockResolvedValue({ rows: mockReports });

      const event = createMockEvent();
      const result = await handler(event as any);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.reports).toEqual(mockReports);
    });

    it('should return empty array when no reports exist', async () => {
      executeStatement.mockResolvedValue({ rows: [] });

      const event = createMockEvent();
      const result = await handler(event as any);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({ reports: [] });
    });
  });

  describe('GET /admin/ai-reports/:id', () => {
    it('should return 404 for non-existent report', async () => {
      executeStatement.mockResolvedValue({ rows: [] });

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/admin/ai-reports/non-existent',
      });

      const result = await handler(event as any);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body)).toEqual({ error: 'Report not found' });
    });
  });

  describe('POST /admin/ai-reports', () => {
    it('should return 400 if title is missing', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/admin/ai-reports',
        body: JSON.stringify({ prompt: 'Generate a report' }),
      });

      const result = await handler(event as any);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({ error: 'Title and prompt are required' });
    });

    it('should return 400 if prompt is missing', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/admin/ai-reports',
        body: JSON.stringify({ title: 'New Report' }),
      });

      const result = await handler(event as any);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({ error: 'Title and prompt are required' });
    });
  });

  describe('POST /admin/ai-reports/:id/export', () => {
    it('should return 400 for invalid format', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/admin/ai-reports/report-1/export',
        body: JSON.stringify({ format: 'invalid' }),
      });

      const result = await handler(event as any);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('Invalid format');
    });
  });

  describe('POST /admin/ai-reports/brand-kits', () => {
    it('should return 400 if name is missing', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/admin/ai-reports/brand-kits',
        body: JSON.stringify({ company_name: 'Test Company' }),
      });

      const result = await handler(event as any);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('Name and company_name are required');
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/admin/ai-reports/unknown/route/path',
      });

      const result = await handler(event as any);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body)).toEqual({ error: 'Not found' });
    });
  });
});
