import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../db/client', () => ({
  executeStatement: vi.fn(),
  stringParam: vi.fn((name: string, value: string) => ({ name, value: { stringValue: value } })),
  longParam: vi.fn((name: string, value: number) => ({ name, value: { longValue: value } })),
}));

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

describe('DelightService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolvePersonalityMode', () => {
    it('should return the mode directly if not auto', async () => {
      const { delightService } = await import('../delight.service');

      const result = delightService.resolvePersonalityMode('professional');
      expect(result).toBe('professional');
    });

    it('should return subtle for morning context in auto mode', async () => {
      const { delightService } = await import('../delight.service');

      const result = delightService.resolvePersonalityMode('auto', {
        timeOfDay: 'morning',
      });
      expect(result).toBe('subtle');
    });

    it('should return playful for evening context in auto mode', async () => {
      const { delightService } = await import('../delight.service');

      const result = delightService.resolvePersonalityMode('auto', {
        timeOfDay: 'evening',
      });
      expect(result).toBe('playful');
    });

    it('should return playful for weekend in auto mode', async () => {
      const { delightService } = await import('../delight.service');

      const result = delightService.resolvePersonalityMode('auto', {
        timeOfDay: 'weekend',
      });
      expect(result).toBe('playful');
    });

    it('should return professional for business domain in auto mode', async () => {
      const { delightService } = await import('../delight.service');

      const result = delightService.resolvePersonalityMode('auto', {
        domainFamily: 'business-management',
      });
      expect(result).toBe('professional');
    });

    it('should return expressive for creative domain in auto mode', async () => {
      const { delightService } = await import('../delight.service');

      const result = delightService.resolvePersonalityMode('auto', {
        domainFamily: 'creative-arts',
      });
      expect(result).toBe('expressive');
    });

    it('should adjust for long sessions', async () => {
      const { delightService } = await import('../delight.service');

      const result = delightService.resolvePersonalityMode('auto', {
        timeOfDay: 'morning',
        sessionDurationMinutes: 90,
      });
      // Morning (subtle) + long session = should stay subtle or become expressive
      expect(['subtle', 'expressive']).toContain(result);
    });
  });

  describe('getUserPreferences', () => {
    it('should return default preferences when no user prefs exist', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const { delightService } = await import('../delight.service');

      const prefs = await delightService.getUserPreferences('user-123', 'tenant-456');

      expect(prefs).toBeDefined();
      expect(prefs.personalityMode).toBe('auto');
      expect(prefs.intensityLevel).toBe(5);
      expect(prefs.enableAchievements).toBe(true);
    });

    it('should return stored preferences when they exist', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          user_id: 'user-123',
          tenant_id: 'tenant-456',
          personality_mode: 'playful',
          intensity_level: 8,
          enable_domain_messages: true,
          enable_model_personality: true,
          enable_time_awareness: true,
          enable_achievements: true,
          enable_wellbeing_nudges: false,
          enable_easter_eggs: true,
          enable_sounds: true,
          sound_theme: 'mission_control',
          sound_volume: 75,
        }],
      });

      const { delightService } = await import('../delight.service');

      const prefs = await delightService.getUserPreferences('user-123', 'tenant-456');

      expect(prefs.personalityMode).toBe('playful');
      expect(prefs.intensityLevel).toBe(8);
      expect(prefs.enableWellbeingNudges).toBe(false);
      expect(prefs.soundTheme).toBe('mission_control');
    });
  });

  describe('updateUserPreferences', () => {
    it('should update preferences and return updated values', async () => {
      // Mock the upsert
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          user_id: 'user-123',
          tenant_id: 'tenant-456',
          personality_mode: 'expressive',
          intensity_level: 7,
          enable_domain_messages: true,
          enable_model_personality: true,
          enable_time_awareness: true,
          enable_achievements: true,
          enable_wellbeing_nudges: true,
          enable_easter_eggs: true,
          enable_sounds: false,
          sound_theme: 'default',
          sound_volume: 50,
        }],
      });

      const { delightService } = await import('../delight.service');

      const updated = await delightService.updateUserPreferences('user-123', 'tenant-456', {
        personalityMode: 'expressive',
        intensityLevel: 7,
      });

      expect(updated.personalityMode).toBe('expressive');
      expect(updated.intensityLevel).toBe(7);
    });
  });

  describe('getEffectivePersonalityMode', () => {
    it('should resolve auto mode with context', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          user_id: 'user-123',
          tenant_id: 'tenant-456',
          personality_mode: 'auto',
          intensity_level: 5,
          enable_domain_messages: true,
          enable_model_personality: true,
          enable_time_awareness: true,
          enable_achievements: true,
          enable_wellbeing_nudges: true,
          enable_easter_eggs: true,
          enable_sounds: false,
          sound_theme: 'default',
          sound_volume: 50,
        }],
      });

      const { delightService } = await import('../delight.service');

      const mode = await delightService.getEffectivePersonalityMode('user-123', 'tenant-456', {
        timeOfDay: 'evening',
      });

      expect(mode).toBe('playful');
    });
  });
});
