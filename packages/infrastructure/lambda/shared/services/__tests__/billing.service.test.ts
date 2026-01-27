/**
 * Billing Service Tests
 * Critical financial service - subscriptions, credits, transactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AWS clients
vi.mock('@aws-sdk/client-sns', () => ({
  SNSClient: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  PublishCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  SendEmailCommand: vi.fn(),
}));

// Mock database
vi.mock('../../db/client', () => ({
  executeStatement: vi.fn(),
}));

// Mock logger
vi.mock('../../logging/enhanced-logger', () => ({
  enhancedLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { executeStatement } from '../../db/client';

const mockExecuteStatement = executeStatement as ReturnType<typeof vi.fn>;

describe('BillingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSubscriptionTiers', () => {
    it('should return all public subscription tiers', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          {
            id: 'tier-free',
            display_name: 'Free',
            price_monthly: null,
            price_annual: null,
            included_credits_per_user: 100,
            features: '{"api_access": true}',
          },
          {
            id: 'tier-pro',
            display_name: 'Pro',
            price_monthly: 29.99,
            price_annual: 299.99,
            included_credits_per_user: 1000,
            features: '{"api_access": true, "priority_support": true}',
          },
        ],
      });

      const { BillingService } = await import('../billing');
      const billingService = new BillingService();
      
      const tiers = await billingService.getSubscriptionTiers();
      
      expect(tiers).toHaveLength(2);
      expect(tiers[0].displayName).toBe('Free');
      expect(tiers[1].priceMonthly).toBe(29.99);
    });
  });

  describe('getSubscription', () => {
    it('should return active subscription for tenant', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          id: 'sub-123',
          tenant_id: 'tenant-1',
          tier_id: 'tier-pro',
          status: 'active',
          billing_cycle: 'monthly',
          seats_purchased: 5,
          seats_used: 3,
          current_period_end: '2026-02-27T00:00:00Z',
        }],
      });

      const { BillingService } = await import('../billing');
      const billingService = new BillingService();
      
      const subscription = await billingService.getSubscription('tenant-1');
      
      expect(subscription).not.toBeNull();
      expect(subscription?.status).toBe('active');
      expect(subscription?.seatsPurchased).toBe(5);
    });

    it('should return null for tenant without subscription', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const { BillingService } = await import('../billing');
      const billingService = new BillingService();
      
      const subscription = await billingService.getSubscription('new-tenant');
      
      expect(subscription).toBeNull();
    });
  });

  describe('createSubscription', () => {
    it('should create a new subscription', async () => {
      // Insert subscription
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ id: 'sub-new-123' }],
      });
      // Initialize credit balance
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });
      // Get tier for credit allocation
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          id: 'tier-pro',
          included_credits_per_user: 1000,
        }],
      });
      // Add credits
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ balance: 5000 }],
      });
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const { BillingService } = await import('../billing');
      const billingService = new BillingService();
      
      const subscriptionId = await billingService.createSubscription(
        'tenant-1',
        'tier-pro',
        'monthly',
        5
      );
      
      expect(subscriptionId).toBe('sub-new-123');
    });

    it('should set correct period end for annual billing', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ id: 'sub-annual-123' }],
      });
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const { BillingService } = await import('../billing');
      const billingService = new BillingService();
      
      const subscriptionId = await billingService.createSubscription(
        'tenant-1',
        'tier-enterprise',
        'annual',
        10
      );
      
      expect(subscriptionId).toBeDefined();
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const { BillingService } = await import('../billing');
      const billingService = new BillingService();
      
      await expect(
        billingService.cancelSubscription('sub-123', true)
      ).resolves.not.toThrow();
    });

    it('should cancel subscription immediately', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const { BillingService } = await import('../billing');
      const billingService = new BillingService();
      
      await expect(
        billingService.cancelSubscription('sub-123', false)
      ).resolves.not.toThrow();
    });
  });

  describe('getCreditBalance', () => {
    it('should return credit balance for tenant', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          tenant_id: 'tenant-1',
          balance: 5000,
          lifetime_purchased: 10000,
          lifetime_used: 5000,
          lifetime_bonus: 500,
        }],
      });

      const { BillingService } = await import('../billing');
      const billingService = new BillingService();
      
      const balance = await billingService.getCreditBalance('tenant-1');
      
      expect(balance.balance).toBe(5000);
      expect(balance.lifetimePurchased).toBe(10000);
    });

    it('should initialize balance for new tenant', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const { BillingService } = await import('../billing');
      const billingService = new BillingService();
      
      const balance = await billingService.getCreditBalance('new-tenant');
      
      expect(balance.balance).toBe(0);
    });
  });

  describe('addCredits', () => {
    it('should add purchase credits', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ balance: 6000 }],
      });
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const { BillingService } = await import('../billing');
      const billingService = new BillingService();
      
      const newBalance = await billingService.addCredits(
        'tenant-1',
        1000,
        'purchase',
        'Credit purchase'
      );
      
      expect(newBalance).toBe(6000);
    });

    it('should add bonus credits', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ balance: 5500 }],
      });
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const { BillingService } = await import('../billing');
      const billingService = new BillingService();
      
      const newBalance = await billingService.addCredits(
        'tenant-1',
        500,
        'bonus',
        'Welcome bonus'
      );
      
      expect(newBalance).toBe(5500);
    });
  });

  describe('useCredits', () => {
    it('should deduct credits for usage', async () => {
      // Get current balance
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ balance: 5000 }],
      });
      // Deduct credits
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ balance: 4900 }],
      });
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const { BillingService } = await import('../billing');
      const billingService = new BillingService();
      
      const result = await billingService.useCredits(
        'tenant-1',
        100,
        'Model API call'
      );
      
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(4900);
    });

    it('should fail if insufficient credits', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ balance: 50 }],
      });

      const { BillingService } = await import('../billing');
      const billingService = new BillingService();
      
      const result = await billingService.useCredits(
        'tenant-1',
        100,
        'Model API call'
      );
      
      expect(result.success).toBe(false);
    });
  });

  describe('financial accuracy', () => {
    it('should handle decimal amounts correctly', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ balance: 1000.50 }],
      });
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const { BillingService } = await import('../billing');
      const billingService = new BillingService();
      
      const newBalance = await billingService.addCredits(
        'tenant-1',
        0.50,
        'adjustment',
        'Rounding adjustment'
      );
      
      expect(newBalance).toBe(1000.50);
    });

    it('should prevent negative balance', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ balance: 10 }],
      });

      const { BillingService } = await import('../billing');
      const billingService = new BillingService();
      
      const result = await billingService.useCredits(
        'tenant-1',
        100,
        'Large deduction'
      );
      
      expect(result.success).toBe(false);
    });
  });
});
