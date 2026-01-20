import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PersonalityMode = 'auto' | 'professional' | 'subtle' | 'expressive' | 'playful';

interface SettingsState {
  personalityMode: PersonalityMode;
  voiceEnabled: boolean;
  notificationsEnabled: boolean;
  keyboardShortcutsEnabled: boolean;
  showTokenCount: boolean;
  showCostEstimate: boolean;
  compactMode: boolean;
  
  setPersonalityMode: (mode: PersonalityMode) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setKeyboardShortcutsEnabled: (enabled: boolean) => void;
  setShowTokenCount: (show: boolean) => void;
  setShowCostEstimate: (show: boolean) => void;
  setCompactMode: (compact: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      personalityMode: 'auto',
      voiceEnabled: false,
      notificationsEnabled: true,
      keyboardShortcutsEnabled: true,
      showTokenCount: false,
      showCostEstimate: false,
      compactMode: false,

      setPersonalityMode: (mode) => set({ personalityMode: mode }),
      setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      setKeyboardShortcutsEnabled: (enabled) => set({ keyboardShortcutsEnabled: enabled }),
      setShowTokenCount: (show) => set({ showTokenCount: show }),
      setShowCostEstimate: (show) => set({ showCostEstimate: show }),
      setCompactMode: (compact) => set({ compactMode: compact }),
    }),
    {
      name: 'thinktank-settings-storage',
    }
  )
);
