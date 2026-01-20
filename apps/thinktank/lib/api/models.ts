import { api } from './client';
import type { Model, ModelCategory, ApiResponse } from './types';

class ModelsService {
  async listModels(): Promise<Model[]> {
    const response = await api.get<ApiResponse<Model[]>>('/api/thinktank/models');
    return response.data || [];
  }

  async getModel(modelId: string): Promise<Model> {
    return api.get<Model>(`/api/thinktank/models/${modelId}`);
  }

  async listCategories(): Promise<ModelCategory[]> {
    const response = await api.get<ApiResponse<ModelCategory[]>>('/api/thinktank/model-categories');
    return response.data || [];
  }

  async getRecommendedModel(prompt: string, domain?: string): Promise<{
    model: Model;
    reason: string;
    alternatives: Model[];
  }> {
    return api.post('/api/thinktank/models/recommend', { prompt, domain });
  }

  async getModelProficiencies(modelId: string): Promise<Record<string, number>> {
    return api.get(`/api/thinktank/models/${modelId}/proficiencies`);
  }
}

export const modelsService = new ModelsService();
