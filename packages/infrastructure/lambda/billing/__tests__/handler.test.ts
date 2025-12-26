import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';

// Mock dependencies
vi.mock('../../shared/services', () => ({
  billingService: {
    getSubscriptionTiers: vi.fn(),
    getSubscription: vi.fn(),
    createSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
    getCreditBalance: vi.fn(),
    purchaseCredits: vi.fn(),
    useCredits: vi.fn(),
    getTransactionHistory: vi.fn(),
  },
}));

vi.mock('../../shared/auth', () => ({
  extractAuthContext: vi.fn(),
}));

vi.mock('../../shared/response', () => ({
  success: vi.fn((data, statusCode = 200) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })),
  handleError: vi.fn((error) => ({
    statusCode: (error as Error & { statusCode?: number }).statusCode || 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: error.message }),
  })),
}));

import { handler } from '../handler';
import { billingService } from '../../shared/services';
import { extractAuthContext } from '../../shared/auth';

function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/billing/tiers',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    },
    queryStringParameters: null,
    pathParameters: null,
    body: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    isBase64Encoded: false,
    stageVariables: null,
    requestContext: {
      requestId: 'test-request-id',
      accountId: '123456789',
      apiId: 'test-api',
      authorizer: null,
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      path: '/billing/tiers',
      stage: 'test',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/billing/tiers',
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        user: null,
        userArn: null,
      },
    },
    resource: '/billing/tiers',
    ...overrides,
  };
}

describe('Billing Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (extractAuthContext as ReturnType<typeof vi.fn>).mockReturnValue({
      userId: 'test-user-id',
      tenantId: 'test-tenant-id',
    });
  });

  describe('Subscription Tiers', () => {
    it('should return subscription tiers', async () => {
      const mockTiers = [
        { id: 'free', name: 'Free', priceMonthly: 0, credits: 100 },
        { id: 'pro', name: 'Professional', priceMonthly: 2900, credits: 5000 },
        { id: 'enterprise', name: 'Enterprise', priceMonthly: 9900, credits: 25000 },
      ];
      (billingService.getSubscriptionTiers as ReturnType<typeof vi.fn>).mockResolvedValue(mockTiers);

      const event = createMockEvent({
        path: '/billing/tiers',
        httpMethod: 'GET',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.tiers).toHaveLength(3);
      expect(body.tiers[0].id).toBe('free');
    });
  });

  describe('Subscription Management', () => {
    it('should get current subscription', async () => {
      const mockSubscription = {
        id: 'sub-123',
        tierId: 'pro',
        status: 'active',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
      };
      (billingService.getSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubscription);

      const event = createMockEvent({
        path: '/billing/subscription',
        httpMethod: 'GET',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.subscription.tierId).toBe('pro');
    });

    it('should create a new subscription', async () => {
      (billingService.createSubscription as ReturnType<typeof vi.fn>).mockResolvedValue('sub-new-123');

      const event = createMockEvent({
        path: '/billing/subscription',
        httpMethod: 'POST',
        body: JSON.stringify({
          tierId: 'pro',
          billingCycle: 'monthly',
          seats: 5,
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.subscriptionId).toBe('sub-new-123');
      expect(billingService.createSubscription).toHaveBeenCalledWith(
        'test-tenant-id',
        'pro',
        'monthly',
        5,
        undefined,
        undefined
      );
    });

    it('should return validation error for missing required fields', async () => {
      const event = createMockEvent({
        path: '/billing/subscription',
        httpMethod: 'POST',
        body: JSON.stringify({ tierId: 'pro' }), // Missing billingCycle
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should cancel subscription', async () => {
      (billingService.cancelSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const event = createMockEvent({
        path: '/billing/subscription/sub-123',
        httpMethod: 'DELETE',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.cancelled).toBe(true);
    });
  });

  describe('Credit Management', () => {
    it('should get credit balance', async () => {
      const mockBalance = {
        balance: 5000,
        reservedCredits: 100,
        availableCredits: 4900,
      };
      (billingService.getCreditBalance as ReturnType<typeof vi.fn>).mockResolvedValue(mockBalance);

      const event = createMockEvent({
        path: '/billing/credits',
        httpMethod: 'GET',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.balance).toBe(5000);
      expect(body.availableCredits).toBe(4900);
    });

    it('should purchase credits', async () => {
      (billingService.purchaseCredits as ReturnType<typeof vi.fn>).mockResolvedValue('purchase-123');

      const event = createMockEvent({
        path: '/billing/credits/purchase',
        httpMethod: 'POST',
        body: JSON.stringify({
          creditsAmount: 1000,
          priceCents: 999,
          stripePaymentIntentId: 'pi_123',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.purchaseId).toBe('purchase-123');
    });

    it('should use credits', async () => {
      const mockResult = { success: true, remainingBalance: 4000 };
      (billingService.useCredits as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const event = createMockEvent({
        path: '/billing/credits/use',
        httpMethod: 'POST',
        body: JSON.stringify({
          amount: 100,
          description: 'API call to gpt-4o',
          referenceId: 'req-123',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.remainingBalance).toBe(4000);
    });

    it('should return validation error for missing amount', async () => {
      const event = createMockEvent({
        path: '/billing/credits/use',
        httpMethod: 'POST',
        body: JSON.stringify({}),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('Transaction History', () => {
    it('should get transaction history', async () => {
      const mockTransactions = [
        { id: 'txn-1', type: 'credit', amount: 1000, createdAt: '2024-01-15T10:00:00Z' },
        { id: 'txn-2', type: 'debit', amount: -50, createdAt: '2024-01-15T11:00:00Z' },
      ];
      (billingService.getTransactionHistory as ReturnType<typeof vi.fn>).mockResolvedValue(mockTransactions);

      const event = createMockEvent({
        path: '/billing/transactions',
        httpMethod: 'GET',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.transactions).toHaveLength(2);
    });

    it('should respect limit parameter', async () => {
      (billingService.getTransactionHistory as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const event = createMockEvent({
        path: '/billing/transactions',
        httpMethod: 'GET',
        queryStringParameters: { limit: '10' },
      });

      await handler(event);

      expect(billingService.getTransactionHistory).toHaveBeenCalledWith('test-tenant-id', 10);
    });
  });

  describe('Error Handling', () => {
    it('should return error for unknown routes', async () => {
      const event = createMockEvent({
        path: '/billing/unknown',
        httpMethod: 'GET',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });
  });
});
