import { api } from './client';
import type { UserAnalytics, Achievement } from './types';

class AnalyticsService {
  async getAnalytics(period: 'week' | 'month' | 'year' = 'month'): Promise<UserAnalytics> {
    return api.get<UserAnalytics>(`/api/thinktank/analytics?period=${period}`);
  }

  async getAchievements(): Promise<Achievement[]> {
    const response = await api.get<{ achievements: Achievement[] }>('/api/thinktank/analytics/achievements');
    return response.achievements || [];
  }

  async getUsageStats(): Promise<{
    tokensUsed: number;
    tokensRemaining: number;
    costThisMonth: number;
    messagesThisMonth: number;
  }> {
    return api.get('/api/thinktank/analytics/usage');
  }

  async getActivityHeatmap(year: number): Promise<Array<{ date: string; count: number }>> {
    const response = await api.get<{ activity: Array<{ date: string; count: number }> }>(
      `/api/thinktank/analytics/activity?year=${year}`
    );
    return response.activity || [];
  }
}

export const analyticsService = new AnalyticsService();
