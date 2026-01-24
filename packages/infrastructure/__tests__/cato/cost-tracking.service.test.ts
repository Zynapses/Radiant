/**
 * Unit Tests for Cost Tracking Service
 * 
 * Tests for real-time cost estimation, daily/MTD costs, and budget tracking.
 */

// Jest globals are automatically available via ts-jest

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-cost-explorer', () => ({
  CostExplorerClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  GetCostAndUsageCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-budgets', () => ({
  BudgetsClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  DescribeBudgetCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  GetMetricStatisticsCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-pricing', () => ({
  PricingClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  GetProductsCommand: jest.fn(),
}));

jest.mock('../../lambda/shared/db/client', () => ({
  executeStatement: jest.fn(),
  stringParam: jest.fn((name, value) => ({ name, value })),
  longParam: jest.fn((name, value) => ({ name, value })),
}));

import { executeStatement } from '../../lambda/shared/db/client';
import { 
  CostTrackingService,
  RealtimeCostEstimate,
  DailyCost,
  MtdCost 
} from '../../lambda/shared/services/cato/cost-tracking.service';

describe('CostTrackingService', () => {
  let service: CostTrackingService;
  const mockExecuteStatement = executeStatement as ReturnType<typeof jest.fn>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CostTrackingService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getRealtimeEstimate', () => {
    it('should return zero estimate when no metrics', async () => {
      // Mock CloudWatch returning empty
      const result = await service.getRealtimeEstimate();

      expect(result.estimatedCostUsd).toBeGreaterThanOrEqual(0);
      expect(result.breakdown).toBeDefined();
      expect(result.invocations).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should include all cost breakdown categories', async () => {
      const result = await service.getRealtimeEstimate();

      expect(result.breakdown).toHaveProperty('bedrock');
      expect(result.breakdown).toHaveProperty('sagemaker');
      expect(result.breakdown).toHaveProperty('dynamodb');
      expect(result.breakdown).toHaveProperty('other');
    });

    it('should include invocation counts', async () => {
      const result = await service.getRealtimeEstimate();

      expect(result.invocations).toHaveProperty('bedrock');
      expect(result.invocations).toHaveProperty('inputTokens');
      expect(result.invocations).toHaveProperty('outputTokens');
    });
  });

  describe('getDailyCost', () => {
    it('should return cost for specific date', async () => {
      const result = await service.getDailyCost('2025-01-15');

      expect(result.date).toBe('2025-01-15');
      expect(result.totalCostUsd).toBeGreaterThanOrEqual(0);
      expect(result.breakdown).toBeDefined();
    });

    it('should use today if no date provided', async () => {
      const result = await service.getDailyCost();

      expect(result.date).toBeDefined();
      expect(result.totalCostUsd).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getMtdCost', () => {
    it('should return month-to-date cost with projection', async () => {
      const result = await service.getMtdCost();

      expect(result.totalCostUsd).toBeGreaterThanOrEqual(0);
      expect(result.projectedMonthlyUsd).toBeGreaterThanOrEqual(0);
      expect(result.daysElapsed).toBeGreaterThan(0);
      expect(result.daysRemaining).toBeGreaterThanOrEqual(0);
      expect(result.dailyAverageUsd).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getBudgetStatus', () => {
    it('should return budget status', async () => {
      const result = await service.getBudgetStatus();

      expect(result.budgetName).toBeDefined();
      expect(result.limitUsd).toBeGreaterThanOrEqual(0);
      expect(result.actualUsd).toBeGreaterThanOrEqual(0);
      expect(result.onTrack).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });
  });

  describe('estimateSettingsCost', () => {
    it('should estimate cost for different cognitive intervals', async () => {
      const result300s = await service.estimateSettingsCost(300);
      const result600s = await service.estimateSettingsCost(600);

      expect(result300s.estimatedDailyUsd).toBeGreaterThan(0);
      expect(result300s.estimatedMonthlyUsd).toBeGreaterThan(0);
      expect(result300s.ticksPerDay).toBeGreaterThan(result600s.ticksPerDay);
    });

    it('should handle emergency mode intervals', async () => {
      const result = await service.estimateSettingsCost(3600);

      expect(result.ticksPerDay).toBe(24);
      expect(result.estimatedDailyUsd).toBeGreaterThan(0);
    });
  });

  describe('getPricingTable', () => {
    it('should return pricing for all services', async () => {
      const result = await service.getPricingTable();

      expect(result.bedrockModels).toBeDefined();
      expect(result.sagemakerEndpoints).toBeDefined();
      expect(result.infrastructure).toBeDefined();
      expect(result.lastRefreshed).toBeDefined();
      expect(result.source).toBeDefined();
    });

    it('should include pricing source', async () => {
      const result = await service.getPricingTable();

      expect(result.source).toBeDefined();
      expect(typeof result.source).toBe('string');
    });
  });

  describe('estimateSettingsCost - additional', () => {
    it('should include confidence level', async () => {
      const result = await service.estimateSettingsCost(300);

      expect(result.confidence).toBeDefined();
      expect(['actual', 'estimate', 'pricing_table']).toContain(result.confidence);
    });

    it('should include cost per tick', async () => {
      const result = await service.estimateSettingsCost(300);

      expect(result.costPerTickUsd).toBeGreaterThanOrEqual(0);
    });
  });
});
