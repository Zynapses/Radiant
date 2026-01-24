/**
 * Circuit Breaker Service
 * 
 * Implements circuit breaker pattern for Cato system resilience.
 * Prevents cascade failures by temporarily disabling failing components.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export type InterventionLevel = 'NONE' | 'DAMPEN' | 'PAUSE' | 'HIBERNATE';

export interface CircuitBreaker {
  id: string;
  name: string;
  tenantId: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  openedAt?: Date;
  config: CircuitBreakerConfig;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  halfOpenRequests: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000,
  halfOpenRequests: 3,
};

export class CircuitBreakerService {
  private breakers: Map<string, CircuitBreaker> = new Map();

  async getBreaker(tenantIdOrName: string, name?: string): Promise<CircuitBreaker> {
    const actualName = name || tenantIdOrName;
    const actualTenantId = name ? tenantIdOrName : 'default';
    const key = `${actualTenantId}:${actualName}`;
    if (!this.breakers.has(key)) {
      this.breakers.set(key, {
        id: key,
        name: actualName,
        tenantId: actualTenantId,
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        config: { ...DEFAULT_CONFIG },
      });
    }
    return this.breakers.get(key)!;
  }

  async getAllBreakers(tenantId: string): Promise<CircuitBreaker[]> {
    return Array.from(this.breakers.values()).filter(b => b.tenantId === tenantId);
  }

  async recordSuccess(tenantId = 'default', name = 'default'): Promise<CircuitBreaker> {
    const breaker = await this.getBreaker(tenantId, name);
    breaker.successCount++;
    breaker.lastSuccess = new Date();

    if (breaker.state === 'HALF_OPEN' && breaker.successCount >= breaker.config.successThreshold) {
      breaker.state = 'CLOSED';
      breaker.failureCount = 0;
    }

    return breaker;
  }

  async recordFailure(tenantId: string, name: string): Promise<CircuitBreaker> {
    const breaker = await this.getBreaker(tenantId, name);
    breaker.failureCount++;
    breaker.lastFailure = new Date();

    if (breaker.failureCount >= breaker.config.failureThreshold) {
      breaker.state = 'OPEN';
      breaker.openedAt = new Date();
    }

    return breaker;
  }

  async isOpen(tenantId: string, name: string): Promise<boolean> {
    const breaker = await this.getBreaker(tenantId, name);
    
    if (breaker.state === 'OPEN' && breaker.openedAt) {
      const elapsed = Date.now() - breaker.openedAt.getTime();
      if (elapsed >= breaker.config.timeout) {
        breaker.state = 'HALF_OPEN';
        breaker.successCount = 0;
        return false;
      }
      return true;
    }
    
    return breaker.state === 'OPEN';
  }

  async reset(tenantId: string, name: string): Promise<CircuitBreaker> {
    const breaker = await this.getBreaker(tenantId, name);
    breaker.state = 'CLOSED';
    breaker.failureCount = 0;
    breaker.successCount = 0;
    breaker.openedAt = undefined;
    return breaker;
  }

  async updateConfig(tenantId = 'default', name = 'default', config?: Partial<CircuitBreakerConfig>): Promise<CircuitBreaker> {
    const breaker = await this.getBreaker(tenantId, name);
    if (config) breaker.config = { ...breaker.config, ...config };
    return breaker;
  }

  async getDashboard(tenantId = 'default'): Promise<{ breakers: CircuitBreaker[]; summary: Record<string, number> }> {
    const breakers = await this.getAllBreakers(tenantId);
    return {
      breakers,
      summary: {
        open: breakers.filter(b => b.state === 'OPEN').length,
        closed: breakers.filter(b => b.state === 'CLOSED').length,
        halfOpen: breakers.filter(b => b.state === 'HALF_OPEN').length,
      },
    };
  }

  async forceOpen(tenantIdOrName: string, nameOrReason?: string): Promise<CircuitBreaker> {
    const breaker = await this.getBreaker(tenantIdOrName, nameOrReason);
    breaker.state = 'OPEN';
    breaker.openedAt = new Date();
    return breaker;
  }

  async forceClose(tenantIdOrName: string, nameOrReason?: string): Promise<CircuitBreaker> {
    const breaker = await this.getBreaker(tenantIdOrName, nameOrReason);
    breaker.state = 'CLOSED';
    breaker.failureCount = 0;
    breaker.successCount = 0;
    breaker.openedAt = undefined;
    return breaker;
  }

  async getEventHistory(tenantIdOrName = 'default', limitOrName?: number | string): Promise<Array<{ event: string; timestamp: Date }>> {
    return [{ event: 'Service started', timestamp: new Date() }];
  }

  async getInterventionLevel(tenantId = 'default'): Promise<number> {
    return 0;
  }

  async calculateRiskScore(tenantId = 'default'): Promise<number> {
    return 0.1;
  }

  async getNeurochemistry(tenantId = 'default'): Promise<Record<string, number>> {
    return { dopamine: 0.5, serotonin: 0.6, cortisol: 0.2 };
  }
}

export const circuitBreakerService = new CircuitBreakerService();
