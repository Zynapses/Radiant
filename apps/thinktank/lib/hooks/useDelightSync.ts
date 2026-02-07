'use client';

/**
 * useDelightSync - Syncs frontend personality preferences to the backend API.
 *
 * Bridges Think Tank's Zustand settings store (client-side) with the
 * Delight backend preferences API (server-side, persisted in Aurora PostgreSQL).
 *
 * This ensures that personality mode and sound preferences persist across
 * devices and sessions — not just in localStorage.
 *
 * Flow:
 *   1. On mount: fetch preferences from backend → update Zustand + Delight provider
 *   2. On change: debounce → PUT to backend
 */

import { useEffect, useRef, useCallback } from 'react';
import { useSettingsStore, type PersonalityMode } from '@/lib/stores/settings-store';
import { useRadiantDelightOptional } from '@radiant/delight-ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';
const SYNC_DEBOUNCE_MS = 1500;

interface BackendDelightPreferences {
  personality_mode: string;
  intensity: number;
  sound_enabled: boolean;
  suppress_idle: boolean;
  suppress_session_start: boolean;
}

async function fetchPreferences(): Promise<BackendDelightPreferences | null> {
  try {
    const res = await fetch(`${API_BASE}/delight/preferences`, {
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.preferences ?? null;
  } catch {
    return null;
  }
}

async function updatePreferences(prefs: Partial<BackendDelightPreferences>): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/delight/preferences`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function useDelightSync() {
  const settings = useSettingsStore();
  const delight = useRadiantDelightOptional();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  // On mount: pull backend preferences and apply to local stores
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    fetchPreferences().then((prefs) => {
      if (!prefs) return;

      const mode = prefs.personality_mode as PersonalityMode;
      if (['auto', 'professional', 'subtle', 'expressive', 'playful'].includes(mode)) {
        settings.setPersonalityMode(mode);
        delight?.setPersonalityMode(mode);
      }

      if (typeof prefs.sound_enabled === 'boolean') {
        delight?.setSoundEnabled(prefs.sound_enabled);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced push to backend when local preferences change
  const syncToBackend = useCallback(
    (mode: PersonalityMode, soundEnabled: boolean) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updatePreferences({
          personality_mode: mode,
          sound_enabled: soundEnabled,
          suppress_idle: mode === 'professional',
          suppress_session_start: mode === 'professional',
        });
      }, SYNC_DEBOUNCE_MS);
    },
    []
  );

  // Watch for personality mode changes in Zustand settings store
  useEffect(() => {
    if (!initializedRef.current) return;
    // Keep Delight provider in sync with settings store
    delight?.setPersonalityMode(settings.personalityMode);
    syncToBackend(settings.personalityMode, delight?.soundEnabled ?? false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.personalityMode]);

  // Watch for sound changes in Delight provider
  useEffect(() => {
    if (!initializedRef.current) return;
    syncToBackend(settings.personalityMode, delight?.soundEnabled ?? false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delight?.soundEnabled]);

  return {
    syncNow: () => syncToBackend(settings.personalityMode, delight?.soundEnabled ?? false),
  };
}
