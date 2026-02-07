const API_BASE = process.env.CATO_TRAINER_API_URL || 'http://localhost:3001/api/admin/cato-trainer';

// ─────────────────────────────────────────────────────────────────────────────
// Fetch Helper
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `API error: ${res.status}`);
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Types — Libraries & Documents
// ─────────────────────────────────────────────────────────────────────────────

export interface Library {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  document_count: number;
  chunk_count: number;
  total_size_bytes: number;
  embedding_model: string;
  status: 'pending' | 'ingesting' | 'indexing' | 'ready' | 'error';
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  library_id: string;
  filename: string;
  title: string;
  mime_type: string;
  size_bytes: number;
  chunk_count: number;
  page_count: number | null;
  summary: string | null;
  auto_tags: string[];
  status: 'pending' | 'processing' | 'chunked' | 'embedded' | 'error';
  uploaded_at: string;
  processed_at: string | null;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  page_number: number | null;
  section_title: string | null;
  embedding_vector_id: string;
  token_count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Spaces & Collections (Fabric-style organization)
// ─────────────────────────────────────────────────────────────────────────────

export interface Space {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  document_ids: string[];
  document_count: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Search — Semantic + Full-Text
// ─────────────────────────────────────────────────────────────────────────────

export type SearchMode = 'semantic' | 'fulltext' | 'hybrid';

export interface SearchQuery {
  query: string;
  mode: SearchMode;
  library_id?: string;
  space_id?: string;
  document_ids?: string[];
  filters?: SearchFilters;
  limit?: number;
}

export interface SearchFilters {
  mime_types?: string[];
  tags?: string[];
  date_from?: string;
  date_to?: string;
}

export interface SearchResult {
  id: string;
  document: Document;
  chunk: DocumentChunk;
  relevance_score: number;
  highlight: string;
  matched_terms: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  total_count: number;
  query_time_ms: number;
  mode_used: SearchMode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat — Grounded Q&A with Citations
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: Citation[];
  created_at: string;
  confidence_score: number | null;
  grounded: boolean;
  thinking_steps: string[];
}

export interface Citation {
  id: string;
  document_id: string;
  document_title: string;
  chunk_id: string;
  chunk_content: string;
  page_number: number | null;
  section_title: string | null;
  relevance_score: number;
  exact_quote: string;
}

export interface ChatSession {
  id: string;
  tenant_id: string;
  title: string;
  library_id: string | null;
  space_id: string | null;
  scope_document_ids: string[];
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Digest — Multi-document synthesis
// ─────────────────────────────────────────────────────────────────────────────

export type DigestType = 'summary' | 'comparison' | 'contradiction' | 'timeline' | 'key_facts' | 'action_items';

export interface DigestRequest {
  document_ids: string[];
  digest_type: DigestType;
  custom_prompt?: string;
}

export interface DigestResult {
  id: string;
  digest_type: DigestType;
  title: string;
  content: string;
  citations: Citation[];
  document_count: number;
  generated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Smart Links — Auto-discovered relationships
// ─────────────────────────────────────────────────────────────────────────────

export interface SmartLink {
  id: string;
  source_document_id: string;
  target_document_id: string;
  relationship: 'references' | 'contradicts' | 'extends' | 'summarizes' | 'related';
  confidence: number;
  shared_concepts: string[];
  discovered_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface CatoTrainerConfig {
  tenant_id: string;
  enabled: boolean;
  ai_model: string;
  embedding_model: string;
  max_documents_per_library: number;
  max_file_size_mb: number;
  auto_tagging_enabled: boolean;
  smart_linking_enabled: boolean;
  digest_enabled: boolean;
  default_search_mode: SearchMode;
  citation_threshold: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Endpoints — Libraries
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchLibraries(
  tenantId: string
): Promise<{ success: boolean; libraries: Library[] }> {
  return fetchAPI(`/libraries/${tenantId}`);
}

export async function fetchLibrary(
  libraryId: string
): Promise<{ success: boolean; library: Library }> {
  return fetchAPI(`/libraries/detail/${libraryId}`);
}

export async function createLibrary(
  tenantId: string,
  payload: { name: string; description: string }
): Promise<{ success: boolean; library: Library }> {
  return fetchAPI(`/libraries/${tenantId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// API Endpoints — Documents
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchDocuments(
  libraryId: string
): Promise<{ success: boolean; documents: Document[] }> {
  return fetchAPI(`/documents/${libraryId}`);
}

export async function fetchDocument(
  documentId: string
): Promise<{ success: boolean; document: Document; chunks: DocumentChunk[] }> {
  return fetchAPI(`/documents/detail/${documentId}`);
}

export async function uploadDocument(
  libraryId: string,
  file: File
): Promise<{ success: boolean; document: Document }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/documents/${libraryId}/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
  return res.json();
}

export async function deleteDocument(
  documentId: string
): Promise<{ success: boolean }> {
  return fetchAPI(`/documents/${documentId}`, { method: 'DELETE' });
}

// ─────────────────────────────────────────────────────────────────────────────
// API Endpoints — Spaces
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchSpaces(
  tenantId: string
): Promise<{ success: boolean; spaces: Space[] }> {
  return fetchAPI(`/spaces/${tenantId}`);
}

export async function createSpace(
  tenantId: string,
  payload: { name: string; description: string; icon: string; color: string; document_ids: string[] }
): Promise<{ success: boolean; space: Space }> {
  return fetchAPI(`/spaces/${tenantId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateSpace(
  spaceId: string,
  payload: Partial<Space>
): Promise<{ success: boolean; space: Space }> {
  return fetchAPI(`/spaces/${spaceId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteSpace(
  spaceId: string
): Promise<{ success: boolean }> {
  return fetchAPI(`/spaces/${spaceId}`, { method: 'DELETE' });
}

// ─────────────────────────────────────────────────────────────────────────────
// API Endpoints — Search
// ─────────────────────────────────────────────────────────────────────────────

export async function searchDocuments(
  tenantId: string,
  query: SearchQuery
): Promise<{ success: boolean; response: SearchResponse }> {
  return fetchAPI(`/search/${tenantId}`, {
    method: 'POST',
    body: JSON.stringify(query),
  });
}

export async function fetchSmartLinks(
  documentId: string
): Promise<{ success: boolean; links: SmartLink[] }> {
  return fetchAPI(`/links/${documentId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// API Endpoints — Chat (Grounded Q&A)
// ─────────────────────────────────────────────────────────────────────────────

export async function createChatSession(
  tenantId: string,
  payload: { library_id?: string; space_id?: string; scope_document_ids?: string[] }
): Promise<{ success: boolean; session: ChatSession }> {
  return fetchAPI(`/chat/${tenantId}/session`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchChatSessions(
  tenantId: string
): Promise<{ success: boolean; sessions: ChatSession[] }> {
  return fetchAPI(`/chat/${tenantId}/sessions`);
}

export async function fetchChatSession(
  sessionId: string
): Promise<{ success: boolean; session: ChatSession }> {
  return fetchAPI(`/chat/session/${sessionId}`);
}

export async function sendMessage(
  sessionId: string,
  content: string
): Promise<{ success: boolean; message: ChatMessage }> {
  return fetchAPI(`/chat/${sessionId}/message`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function deleteChatSession(
  sessionId: string
): Promise<{ success: boolean }> {
  return fetchAPI(`/chat/session/${sessionId}`, { method: 'DELETE' });
}

// ─────────────────────────────────────────────────────────────────────────────
// API Endpoints — Digest
// ─────────────────────────────────────────────────────────────────────────────

export async function generateDigest(
  tenantId: string,
  request: DigestRequest
): Promise<{ success: boolean; digest: DigestResult }> {
  return fetchAPI(`/digest/${tenantId}`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function fetchDigestHistory(
  tenantId: string
): Promise<{ success: boolean; digests: DigestResult[] }> {
  return fetchAPI(`/digest/${tenantId}/history`);
}

// ─────────────────────────────────────────────────────────────────────────────
// API Endpoints — Configuration
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchConfig(
  tenantId: string
): Promise<{ success: boolean; config: CatoTrainerConfig }> {
  return fetchAPI(`/config/${tenantId}`);
}

export async function updateConfig(
  tenantId: string,
  config: Partial<CatoTrainerConfig>
): Promise<{ success: boolean; config: CatoTrainerConfig }> {
  return fetchAPI(`/config/${tenantId}`, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}
