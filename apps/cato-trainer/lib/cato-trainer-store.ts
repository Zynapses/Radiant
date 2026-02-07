import { create } from 'zustand';
import type {
  Library,
  Document,
  DocumentChunk,
  Space,
  SearchResult,
  SearchMode,
  ChatSession,
  ChatMessage,
  DigestResult,
  SmartLink,
} from './api';

// ─────────────────────────────────────────────────────────────────────────────
// Cato Trainer App State
// ─────────────────────────────────────────────────────────────────────────────

interface CatoTrainerState {
  // Identity
  tenantId: string;
  userId: string;
  setIdentity: (tenantId: string, userId: string) => void;

  // Libraries
  libraries: Library[];
  setLibraries: (libs: Library[]) => void;
  activeLibrary: Library | null;
  setActiveLibrary: (lib: Library | null) => void;

  // Documents
  documents: Document[];
  setDocuments: (docs: Document[]) => void;
  selectedDocument: Document | null;
  setSelectedDocument: (doc: Document | null) => void;
  selectedDocumentChunks: DocumentChunk[];
  setSelectedDocumentChunks: (chunks: DocumentChunk[]) => void;

  // Spaces
  spaces: Space[];
  setSpaces: (spaces: Space[]) => void;
  activeSpace: Space | null;
  setActiveSpace: (space: Space | null) => void;

  // Search
  searchResults: SearchResult[];
  setSearchResults: (results: SearchResult[]) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchMode: SearchMode;
  setSearchMode: (mode: SearchMode) => void;
  isSearching: boolean;
  setIsSearching: (v: boolean) => void;

  // Chat
  chatSessions: ChatSession[];
  setChatSessions: (sessions: ChatSession[]) => void;
  activeChatSession: ChatSession | null;
  setActiveChatSession: (session: ChatSession | null) => void;
  addChatMessage: (msg: ChatMessage) => void;
  isChatLoading: boolean;
  setIsChatLoading: (v: boolean) => void;

  // Digest
  digests: DigestResult[];
  setDigests: (digests: DigestResult[]) => void;
  activeDigest: DigestResult | null;
  setActiveDigest: (d: DigestResult | null) => void;

  // Smart Links
  smartLinks: SmartLink[];
  setSmartLinks: (links: SmartLink[]) => void;

  // UI State
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  inspectorOpen: boolean;
  toggleInspector: () => void;
  selectedDocumentIds: string[];
  toggleDocumentSelection: (docId: string) => void;
  clearDocumentSelection: () => void;
}

export const useCatoTrainerStore = create<CatoTrainerState>((set) => ({
  // Identity
  tenantId: '',
  userId: '',
  setIdentity: (tenantId, userId) => set({ tenantId, userId }),

  // Libraries
  libraries: [],
  setLibraries: (libraries) => set({ libraries }),
  activeLibrary: null,
  setActiveLibrary: (lib) => set({ activeLibrary: lib, documents: [], selectedDocument: null }),

  // Documents
  documents: [],
  setDocuments: (documents) => set({ documents }),
  selectedDocument: null,
  setSelectedDocument: (doc) => set({ selectedDocument: doc, selectedDocumentChunks: [] }),
  selectedDocumentChunks: [],
  setSelectedDocumentChunks: (chunks) => set({ selectedDocumentChunks: chunks }),

  // Spaces
  spaces: [],
  setSpaces: (spaces) => set({ spaces }),
  activeSpace: null,
  setActiveSpace: (space) => set({ activeSpace: space }),

  // Search
  searchResults: [],
  setSearchResults: (results) => set({ searchResults: results }),
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
  searchMode: 'hybrid',
  setSearchMode: (mode) => set({ searchMode: mode }),
  isSearching: false,
  setIsSearching: (v) => set({ isSearching: v }),

  // Chat
  chatSessions: [],
  setChatSessions: (sessions) => set({ chatSessions: sessions }),
  activeChatSession: null,
  setActiveChatSession: (session) => set({ activeChatSession: session }),
  addChatMessage: (msg) =>
    set((state) => {
      if (!state.activeChatSession) return state;
      return {
        activeChatSession: {
          ...state.activeChatSession,
          messages: [...state.activeChatSession.messages, msg],
        },
      };
    }),
  isChatLoading: false,
  setIsChatLoading: (v) => set({ isChatLoading: v }),

  // Digest
  digests: [],
  setDigests: (digests) => set({ digests }),
  activeDigest: null,
  setActiveDigest: (d) => set({ activeDigest: d }),

  // Smart Links
  smartLinks: [],
  setSmartLinks: (links) => set({ smartLinks: links }),

  // UI State
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  inspectorOpen: false,
  toggleInspector: () => set((state) => ({ inspectorOpen: !state.inspectorOpen })),
  selectedDocumentIds: [],
  toggleDocumentSelection: (docId) =>
    set((state) => {
      const exists = state.selectedDocumentIds.includes(docId);
      return {
        selectedDocumentIds: exists
          ? state.selectedDocumentIds.filter((id) => id !== docId)
          : [...state.selectedDocumentIds, docId],
      };
    }),
  clearDocumentSelection: () => set({ selectedDocumentIds: [] }),
}));
