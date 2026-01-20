import { api } from './client';
import type { GovernorStatus, GovernorDecision } from './types';

class GovernorService {
  async getStatus(): Promise<GovernorStatus> {
    return api.get<GovernorStatus>('/api/thinktank/economic-governor/status');
  }

  async getRecentDecisions(limit = 10): Promise<GovernorDecision[]> {
    const response = await api.get<{ decisions: GovernorDecision[] }>(
      `/api/thinktank/economic-governor/recent?limit=${limit}`
    );
    return response.decisions || [];
  }

  async getSavingsHistory(days = 30): Promise<Array<{ date: string; savings: number }>> {
    const response = await api.get<{ history: Array<{ date: string; savings: number }> }>(
      `/api/thinktank/economic-governor/savings?days=${days}`
    );
    return response.history || [];
  }
}

export const governorService = new GovernorService();
