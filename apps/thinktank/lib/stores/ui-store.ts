import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarOpen: boolean;
  advancedMode: boolean;
  focusMode: boolean;
  soundEnabled: boolean;
  
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setAdvancedMode: (enabled: boolean) => void;
  toggleAdvancedMode: () => void;
  setFocusMode: (enabled: boolean) => void;
  toggleFocusMode: () => void;
  setSoundEnabled: (enabled: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      advancedMode: false,
      focusMode: false,
      soundEnabled: true,

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setAdvancedMode: (enabled) => set({ advancedMode: enabled }),
      toggleAdvancedMode: () => set((state) => ({ advancedMode: !state.advancedMode })),
      setFocusMode: (enabled) => set({ focusMode: enabled }),
      toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
    }),
    {
      name: 'thinktank-ui-storage',
      partialize: (state) => ({
        advancedMode: state.advancedMode,
        soundEnabled: state.soundEnabled,
      }),
    }
  )
);
