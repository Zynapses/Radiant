import { api } from './client';
import type { UserRule, PresetCategory, ApiResponse } from './types';

class RulesService {
  async listRules(): Promise<UserRule[]> {
    const response = await api.get<ApiResponse<UserRule[]>>('/api/thinktank/my-rules');
    return response.data || [];
  }

  async createRule(data: {
    ruleText: string;
    ruleSummary?: string;
    ruleType: string;
  }): Promise<UserRule> {
    return api.post('/api/thinktank/my-rules', data);
  }

  async updateRule(ruleId: string, updates: Partial<UserRule>): Promise<UserRule> {
    return api.patch(`/api/thinktank/my-rules/${ruleId}`, updates);
  }

  async toggleRule(ruleId: string, isActive: boolean): Promise<void> {
    await api.patch(`/api/thinktank/my-rules/${ruleId}/toggle`, { isActive });
  }

  async deleteRule(ruleId: string): Promise<void> {
    await api.delete(`/api/thinktank/my-rules/${ruleId}`);
  }

  async listPresets(): Promise<PresetCategory[]> {
    const response = await api.get<ApiResponse<PresetCategory[]>>('/api/thinktank/my-rules/presets');
    return response.data || [];
  }

  async addPreset(presetId: string): Promise<UserRule> {
    return api.post('/api/thinktank/my-rules/add-preset', { presetId });
  }
}

export const rulesService = new RulesService();
