'use client';

/**
 * useClarionPreferences - User Preferences Hook for CLARION
 * 
 * Manages user preferences for the CLARION questioning system:
 * - Clarification mode (always/auto/never)
 * - Max questions per session
 * - Display preferences
 * - Learning settings
 * 
 * Persists to localStorage and syncs with server when available.
 * 
 * @version 1.0.0
 * @since RADIANT v6.0.0
 */

import { useState, useEffect, useCallback } from 'react';
import type { ClarionPreferences } from './types';
import { DEFAULT_CLARION_PREFERENCES } from './types';
import { loadPreferences, savePreferences } from './api';

const STORAGE_KEY = 'clarion_preferences';

interface UseClarionPreferencesReturn {
  preferences: ClarionPreferences;
  isLoading: boolean;
  updatePreference: <K extends keyof ClarionPreferences>(
    key: K,
    value: ClarionPreferences[K]
  ) => void;
  updatePreferences: (updates: Partial<ClarionPreferences>) => void;
  resetPreferences: () => void;
  saveToServer: () => Promise<void>;
}

function loadFromStorage(): ClarionPreferences | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_CLARION_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveToStorage(preferences: ClarionPreferences): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Ignore storage errors
  }
}

export function useClarionPreferences(): UseClarionPreferencesReturn {
  const [preferences, setPreferences] = useState<ClarionPreferences>(
    DEFAULT_CLARION_PREFERENCES
  );
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences on mount
  useEffect(() => {
    async function load() {
      // First try localStorage for immediate response
      const localPrefs = loadFromStorage();
      if (localPrefs) {
        setPreferences(localPrefs);
      }

      // Then try server for latest
      try {
        const serverPrefs = await loadPreferences();
        if (serverPrefs) {
          const merged = { 
            ...DEFAULT_CLARION_PREFERENCES, 
            ...serverPrefs 
          } as ClarionPreferences;
          setPreferences(merged);
          saveToStorage(merged);
        }
      } catch {
        // Use local preferences if server fails
      }

      setIsLoading(false);
    }

    load();
  }, []);

  const updatePreference = useCallback(<K extends keyof ClarionPreferences>(
    key: K,
    value: ClarionPreferences[K]
  ) => {
    setPreferences(prev => {
      const updated = { ...prev, [key]: value };
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const updatePreferences = useCallback((updates: Partial<ClarionPreferences>) => {
    setPreferences(prev => {
      const updated = { ...prev, ...updates };
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_CLARION_PREFERENCES);
    saveToStorage(DEFAULT_CLARION_PREFERENCES);
  }, []);

  const saveToServer = useCallback(async () => {
    try {
      await savePreferences(preferences as unknown as Record<string, unknown>);
    } catch (error) {
      console.error('Failed to save preferences to server:', error);
      throw error;
    }
  }, [preferences]);

  return {
    preferences,
    isLoading,
    updatePreference,
    updatePreferences,
    resetPreferences,
    saveToServer,
  };
}

export default useClarionPreferences;
