import { create } from 'zustand';
import type {
  RankTier,
  CentralTheme,
  TrainingSession,
  LessonBlock,
  SparringQuestion,
  SparringResult,
  MobotMessage,
  UserProgress,
  DojoLibrary,
  ScenarioSession,
  ScenarioBranch,
  DialecticSession,
  DialecticTurn,
  DecayDashboard,
  KnowledgePulse,
  MultimodalContent,
  CompetencyMesh,
  ArchytasConfig,
  ArchytasToolCall,
  ArchytasSuggestion,
} from './api';

// ─────────────────────────────────────────────────────────────────────────────
// Dojo App State
// ─────────────────────────────────────────────────────────────────────────────

interface DojoState {
  // Identity
  tenantId: string;
  userId: string;
  setIdentity: (tenantId: string, userId: string) => void;

  // Library selection
  activeLibrary: DojoLibrary | null;
  setActiveLibrary: (library: DojoLibrary | null) => void;

  // Theme selection
  selectedThemes: CentralTheme[];
  toggleTheme: (theme: CentralTheme) => void;
  clearThemes: () => void;

  // Active session
  activeSession: TrainingSession | null;
  setActiveSession: (session: TrainingSession | null) => void;

  // Lecture state
  lessonBlocks: LessonBlock[];
  addLessonBlock: (block: LessonBlock) => void;
  clearLessonBlocks: () => void;

  // Sparring state
  currentQuestion: SparringQuestion | null;
  sparringResults: SparringResult[];
  setCurrentQuestion: (q: SparringQuestion | null) => void;
  addSparringResult: (r: SparringResult) => void;
  clearSparring: () => void;

  // Mobot
  mobotOpen: boolean;
  mobotMessages: MobotMessage[];
  toggleMobot: () => void;
  addMobotMessage: (msg: MobotMessage) => void;
  clearMobotMessages: () => void;

  // Progress cache
  progress: UserProgress | null;
  setProgress: (p: UserProgress) => void;

  // Leapfrog: Scenario Synthesis
  activeScenario: ScenarioSession | null;
  setActiveScenario: (s: ScenarioSession | null) => void;

  // Leapfrog: Socratic Dialectic
  activeDialectic: DialecticSession | null;
  setActiveDialectic: (d: DialecticSession | null) => void;

  // Leapfrog: Decay Engine
  decayDashboard: DecayDashboard | null;
  setDecayDashboard: (d: DecayDashboard | null) => void;

  // Leapfrog: Knowledge Pulse
  knowledgePulse: KnowledgePulse | null;
  setKnowledgePulse: (p: KnowledgePulse | null) => void;

  // Leapfrog: Competency Mesh
  competencyMesh: CompetencyMesh | null;
  setCompetencyMesh: (m: CompetencyMesh | null) => void;

  // Leapfrog: Multimodal
  multimodalContent: MultimodalContent | null;
  setMultimodalContent: (c: MultimodalContent | null) => void;

  // Archytas — The Tool Master
  archytasConfig: ArchytasConfig | null;
  setArchytasConfig: (c: ArchytasConfig | null) => void;
  archytasToolCalls: ArchytasToolCall[];
  addArchytasToolCall: (tc: ArchytasToolCall) => void;
  updateArchytasToolCall: (id: string, tc: Partial<ArchytasToolCall>) => void;
  clearArchytasToolCalls: () => void;
  archytasSuggestions: ArchytasSuggestion[];
  setArchytasSuggestions: (s: ArchytasSuggestion[]) => void;

  // UI state
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useDojoStore = create<DojoState>((set) => ({
  // Identity
  tenantId: '',
  userId: '',
  setIdentity: (tenantId, userId) => set({ tenantId, userId }),

  // Library
  activeLibrary: null,
  setActiveLibrary: (library) => set({ activeLibrary: library, selectedThemes: [] }),

  // Themes
  selectedThemes: [],
  toggleTheme: (theme) =>
    set((state) => {
      const exists = state.selectedThemes.find((t) => t.id === theme.id);
      if (exists) {
        return { selectedThemes: state.selectedThemes.filter((t) => t.id !== theme.id) };
      }
      if (state.selectedThemes.length >= 3) return state;
      return { selectedThemes: [...state.selectedThemes, theme] };
    }),
  clearThemes: () => set({ selectedThemes: [] }),

  // Session
  activeSession: null,
  setActiveSession: (session) => set({ activeSession: session }),

  // Lecture
  lessonBlocks: [],
  addLessonBlock: (block) =>
    set((state) => ({ lessonBlocks: [...state.lessonBlocks, block] })),
  clearLessonBlocks: () => set({ lessonBlocks: [] }),

  // Sparring
  currentQuestion: null,
  sparringResults: [],
  setCurrentQuestion: (q) => set({ currentQuestion: q }),
  addSparringResult: (r) =>
    set((state) => ({ sparringResults: [...state.sparringResults, r] })),
  clearSparring: () => set({ currentQuestion: null, sparringResults: [] }),

  // Mobot
  mobotOpen: false,
  mobotMessages: [],
  toggleMobot: () => set((state) => ({ mobotOpen: !state.mobotOpen })),
  addMobotMessage: (msg) =>
    set((state) => ({ mobotMessages: [...state.mobotMessages, msg] })),
  clearMobotMessages: () => set({ mobotMessages: [] }),

  // Progress
  progress: null,
  setProgress: (p) => set({ progress: p }),

  // Leapfrog: Scenario
  activeScenario: null,
  setActiveScenario: (s) => set({ activeScenario: s }),

  // Leapfrog: Dialectic
  activeDialectic: null,
  setActiveDialectic: (d) => set({ activeDialectic: d }),

  // Leapfrog: Decay
  decayDashboard: null,
  setDecayDashboard: (d) => set({ decayDashboard: d }),

  // Leapfrog: Pulse
  knowledgePulse: null,
  setKnowledgePulse: (p) => set({ knowledgePulse: p }),

  // Leapfrog: Competency
  competencyMesh: null,
  setCompetencyMesh: (m) => set({ competencyMesh: m }),

  // Leapfrog: Multimodal
  multimodalContent: null,
  setMultimodalContent: (c) => set({ multimodalContent: c }),

  // Archytas
  archytasConfig: null,
  setArchytasConfig: (c) => set({ archytasConfig: c }),
  archytasToolCalls: [],
  addArchytasToolCall: (tc) =>
    set((state) => ({ archytasToolCalls: [...state.archytasToolCalls, tc] })),
  updateArchytasToolCall: (id, updates) =>
    set((state) => ({
      archytasToolCalls: state.archytasToolCalls.map((tc) =>
        tc.id === id ? { ...tc, ...updates } : tc
      ),
    })),
  clearArchytasToolCalls: () => set({ archytasToolCalls: [], archytasSuggestions: [] }),
  archytasSuggestions: [],
  setArchytasSuggestions: (s) => set({ archytasSuggestions: s }),

  // UI
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
