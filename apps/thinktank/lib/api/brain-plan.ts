import { api } from './client';
import type { BrainPlan } from './types';

class BrainPlanService {
  async generatePlan(prompt: string, options?: {
    forceMode?: string;
    forceModel?: string;
  }): Promise<BrainPlan> {
    return api.post<BrainPlan>('/api/thinktank/brain-plan/generate', {
      prompt,
      ...options,
    });
  }

  async getPlan(planId: string): Promise<BrainPlan> {
    return api.get<BrainPlan>(`/api/thinktank/brain-plan/${planId}`);
  }

  async executePlan(planId: string): Promise<void> {
    await api.post(`/api/thinktank/brain-plan/${planId}/execute`);
  }

  async getRecentPlans(limit = 10): Promise<BrainPlan[]> {
    const response = await api.get<{ plans: BrainPlan[] }>(`/api/thinktank/brain-plan/recent?limit=${limit}`);
    return response.plans || [];
  }

  async cancelPlan(planId: string): Promise<void> {
    await api.post(`/api/thinktank/brain-plan/${planId}/cancel`);
  }
}

export const brainPlanService = new BrainPlanService();
