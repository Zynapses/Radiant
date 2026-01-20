import { api } from './client';
import type { UserSettings } from './types';

class SettingsService {
  async getSettings(): Promise<UserSettings> {
    return api.get<UserSettings>('/api/thinktank/settings');
  }

  async updateSettings(updates: Partial<UserSettings>): Promise<UserSettings> {
    return api.patch<UserSettings>('/api/thinktank/settings', updates);
  }

  async getPersonalityMode(): Promise<string> {
    const response = await api.get<{ mode: string }>('/api/thinktank/settings/personality');
    return response.mode;
  }

  async setPersonalityMode(mode: string): Promise<void> {
    await api.put('/api/thinktank/settings/personality', { mode });
  }

  async exportData(): Promise<Blob> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/thinktank/settings/export`, {
      method: 'GET',
      credentials: 'include',
    });
    return response.blob();
  }

  async deleteAccount(): Promise<void> {
    await api.delete('/api/thinktank/settings/account');
  }
}

export const settingsService = new SettingsService();
