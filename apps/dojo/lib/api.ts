const API_BASE = process.env.DOJO_API_URL || 'http://localhost:3001/api/admin/dojo';

// ─────────────────────────────────────────────────────────────────────────────
// Core Types
// ─────────────────────────────────────────────────────────────────────────────

export type RankTier = 'novice' | 'initiate' | 'adept' | 'master' | 'radiant';

export interface DojoLibrary {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  document_count: number;
  chunk_count: number;
  theme_count: number;
  status: 'pending' | 'ingesting' | 'analyzing' | 'ready' | 'error';
  created_at: string;
  updated_at: string;
}

export interface DojoDocument {
  id: string;
  library_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  chunk_count: number;
  status: 'pending' | 'chunked' | 'embedded' | 'error';
  uploaded_at: string;
}

export interface CentralTheme {
  id: string;
  library_id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  chunk_count: number;
  difficulty_tier: 'fundamental' | 'intermediate' | 'advanced' | 'expert';
  prerequisites: string[];
  unlock_rank: RankTier;
}

export interface ThemeDiscoveryResponse {
  success: boolean;
  library_id: string;
  themes: CentralTheme[];
  discovery_model: string;
  analyzed_chunks: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Training Session Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TrainingSession {
  id: string;
  user_id: string;
  library_id: string;
  theme_ids: string[];
  mode: 'lecture' | 'sparring' | 'review';
  status: 'active' | 'paused' | 'completed';
  started_at: string;
  completed_at: string | null;
  xp_earned: number;
  questions_asked: number;
  questions_correct: number;
}

export interface LessonBlock {
  id: string;
  session_id: string;
  theme_id: string;
  title: string;
  content: string;
  source_citations: SourceCitation[];
  difficulty: number;
  sequence: number;
}

export interface SourceCitation {
  chunk_id: string;
  document_id: string;
  document_name: string;
  excerpt: string;
  page: number | null;
  relevance_score: number;
}

export interface SparringQuestion {
  id: string;
  session_id: string;
  theme_id: string;
  question_type: 'multiple_choice' | 'scenario' | 'open_ended' | 'true_false';
  question: string;
  context: string | null;
  options: string[] | null;
  difficulty: number;
  source_citations: SourceCitation[];
  time_limit_seconds: number | null;
}

export interface SparringAnswer {
  question_id: string;
  answer: string;
  time_taken_seconds: number;
}

export interface SparringResult {
  question_id: string;
  correct: boolean;
  partial_credit: number;
  correct_answer: string;
  explanation: string;
  reasoning_analysis: string;
  source_citations: SourceCitation[];
  xp_awarded: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress & Rank Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UserProgress {
  user_id: string;
  overall_rank: RankTier;
  overall_xp: number;
  xp_to_next_rank: number;
  total_sessions: number;
  total_time_minutes: number;
  streak_days: number;
  theme_progress: ThemeProgress[];
  recent_sessions: TrainingSession[];
  certifications: Certification[];
}

export interface ThemeProgress {
  theme_id: string;
  theme_name: string;
  rank: RankTier;
  xp: number;
  xp_to_next: number;
  mastery_percentage: number;
  questions_attempted: number;
  questions_correct: number;
  accuracy: number;
  last_session_at: string | null;
  weaknesses: string[];
  strengths: string[];
}

export interface Certification {
  id: string;
  theme_id: string;
  theme_name: string;
  rank_achieved: RankTier;
  score: number;
  max_score: number;
  passed: boolean;
  issued_at: string;
  proctored: boolean;
  exam_duration_minutes: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobot Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MobotMessage {
  id: string;
  role: 'user' | 'mobot';
  content: string;
  citations: SourceCitation[];
  timestamp: string;
}

export interface MobotResponse {
  success: boolean;
  message: MobotMessage;
  suggested_actions: Array<{
    label: string;
    action: string;
    payload: Record<string, string>;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dojo Config (Admin)
// ─────────────────────────────────────────────────────────────────────────────

export interface DojoConfig {
  tenant_id: string;
  enabled: boolean;
  ai_model: string;
  embedding_model: string;
  max_themes_per_library: number;
  sparring_difficulty_scaling: boolean;
  certification_enabled: boolean;
  min_sessions_for_cert: number;
  rank_thresholds: Record<RankTier, number>;
  archytas_enabled: boolean;
  archytas_config: ArchytasConfig | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Archytas — The Tool Master
// Specialized agent giving LLMs access to technical tools during sessions.
// Allows the Dojo to execute code, run simulations, or perform external research.
// ─────────────────────────────────────────────────────────────────────────────

export type ArchytasToolType =
  | 'code_execution'
  | 'simulation'
  | 'web_research'
  | 'data_analysis'
  | 'api_call'
  | 'file_generation';

export interface ArchytasConfig {
  enabled: boolean;
  allowed_tools: ArchytasToolType[];
  sandbox_mode: 'strict' | 'standard' | 'permissive';
  max_execution_time_seconds: number;
  max_tool_calls_per_session: number;
  auto_suggest: boolean;
  languages: string[];
  research_domains: string[];
}

export interface ArchytasToolCall {
  id: string;
  session_id: string;
  tool_type: ArchytasToolType;
  input: string;
  output: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  started_at: string;
  completed_at: string | null;
  execution_time_ms: number | null;
  error: string | null;
  sandbox_id: string;
}

export interface ArchytasSessionSummary {
  session_id: string;
  total_tool_calls: number;
  successful: number;
  failed: number;
  tools_used: ArchytasToolType[];
  total_execution_time_ms: number;
  tool_calls: ArchytasToolCall[];
}

export interface ArchytasSuggestion {
  id: string;
  tool_type: ArchytasToolType;
  description: string;
  suggested_input: string;
  relevance_score: number;
  context: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEAPFROG FEATURE 1: Ebbinghaus Decay Engine
// Per-concept neural decay model — NOT simple flashcard scheduling
// ─────────────────────────────────────────────────────────────────────────────

export interface KnowledgeAtom {
  id: string;
  theme_id: string;
  concept: string;
  description: string;
  source_citations: SourceCitation[];
  difficulty: number;
}

export interface DecayCurve {
  atom_id: string;
  user_id: string;
  half_life_hours: number;
  stability: number;
  last_reviewed_at: string;
  next_review_at: string;
  review_count: number;
  retention_probability: number;
  streak: number;
  lapse_count: number;
}

export interface ReinforcementSession {
  id: string;
  user_id: string;
  atoms: Array<{
    atom: KnowledgeAtom;
    decay: DecayCurve;
    question: SparringQuestion;
  }>;
  status: 'pending' | 'active' | 'completed';
  triggered_by: 'scheduled' | 'manual' | 'pre_session';
  created_at: string;
}

export interface DecayDashboard {
  total_atoms: number;
  atoms_at_risk: number;
  atoms_stable: number;
  atoms_decayed: number;
  average_retention: number;
  next_reinforcement_at: string;
  decay_by_theme: Array<{
    theme_id: string;
    theme_name: string;
    avg_retention: number;
    at_risk_count: number;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEAPFROG FEATURE 2: Adversarial Scenario Synthesis
// Digital twin sparring with branching consequence trees
// ─────────────────────────────────────────────────────────────────────────────

export type PersonaArchetype =
  | 'confused_customer'
  | 'angry_customer'
  | 'detail_oriented'
  | 'time_pressured'
  | 'price_sensitive'
  | 'vip_escalation'
  | 'compliance_auditor'
  | 'new_employee'
  | 'hostile_negotiator';

export interface ScenarioPersona {
  id: string;
  archetype: PersonaArchetype;
  name: string;
  backstory: string;
  emotional_state: 'calm' | 'frustrated' | 'anxious' | 'hostile' | 'confused' | 'neutral';
  communication_style: 'formal' | 'casual' | 'aggressive' | 'passive' | 'analytical';
  hidden_objectives: string[];
}

export interface ScenarioBranch {
  id: string;
  parent_id: string | null;
  turn_number: number;
  persona_message: string;
  learner_response: string | null;
  consequence: string | null;
  emotional_shift: string | null;
  branch_quality: 'optimal' | 'acceptable' | 'suboptimal' | 'critical_error';
  available_actions: string[];
}

export interface ScenarioSession {
  id: string;
  session_id: string;
  persona: ScenarioPersona;
  theme_ids: string[];
  situation: string;
  objective: string;
  branches: ScenarioBranch[];
  status: 'active' | 'completed' | 'failed';
  emotional_intelligence_score: number;
  policy_adherence_score: number;
  resolution_score: number;
  total_score: number;
  debrief: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEAPFROG FEATURE 3: Predictive Competency Mesh
// Auto-extracted competency graph + predictive gap analysis
// ─────────────────────────────────────────────────────────────────────────────

export interface Competency {
  id: string;
  library_id: string;
  name: string;
  description: string;
  category: string;
  related_themes: string[];
  prerequisite_competencies: string[];
  proficiency_levels: Array<{
    level: number;
    label: string;
    description: string;
    indicators: string[];
  }>;
}

export interface UserCompetencyScore {
  competency_id: string;
  competency_name: string;
  category: string;
  current_level: number;
  max_level: number;
  confidence: number;
  evidence_count: number;
  last_assessed_at: string;
  trend: 'improving' | 'stable' | 'declining';
  gap_to_target: number;
}

export interface CompetencyMesh {
  user_id: string;
  library_id: string;
  competencies: UserCompetencyScore[];
  readiness_scores: Array<{
    role: string;
    score: number;
    missing_competencies: string[];
    estimated_time_to_ready_hours: number;
  }>;
  recommended_path: Array<{
    competency_id: string;
    competency_name: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    recommended_themes: string[];
    estimated_sessions: number;
  }>;
  team_gaps?: Array<{
    competency_name: string;
    team_avg_level: number;
    target_level: number;
    members_below_target: number;
    total_members: number;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEAPFROG FEATURE 4: Socratic Dialectic Engine
// Multi-agent thesis/antithesis/synthesis — forces critical thinking
// ─────────────────────────────────────────────────────────────────────────────

export type DialecticRole = 'thesis' | 'antithesis' | 'synthesis' | 'moderator';

export interface DialecticTurn {
  id: string;
  role: DialecticRole | 'learner';
  content: string;
  reasoning_type: 'claim' | 'evidence' | 'rebuttal' | 'concession' | 'synthesis' | 'question';
  citations: SourceCitation[];
  quality_score: number | null;
  timestamp: string;
}

export interface DialecticSession {
  id: string;
  session_id: string;
  theme_id: string;
  proposition: string;
  context: string;
  turns: DialecticTurn[];
  status: 'active' | 'concluded';
  learner_position: string | null;
  reasoning_chain_score: number;
  argument_quality_score: number;
  evidence_usage_score: number;
  critical_thinking_score: number;
  logical_fallacies_detected: string[];
  synthesis_quality: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEAPFROG FEATURE 5: Multimodal Lesson Synthesis
// Auto-generated audio, diagrams, glossary, interactive timelines
// ─────────────────────────────────────────────────────────────────────────────

export interface MultimodalContent {
  lesson_id: string;
  audio_url: string | null;
  audio_duration_seconds: number | null;
  diagrams: Array<{
    id: string;
    type: 'flowchart' | 'mindmap' | 'timeline' | 'comparison' | 'hierarchy' | 'process';
    title: string;
    mermaid_code: string;
    description: string;
  }>;
  glossary: Array<{
    term: string;
    definition: string;
    related_terms: string[];
    first_seen_in: string;
  }>;
  key_takeaways: string[];
  learning_style_adaptations: {
    visual: string;
    auditory: string;
    kinesthetic: string;
    reading_writing: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LEAPFROG FEATURE 6: Organizational Knowledge Pulse
// Real-time org-wide knowledge health dashboard
// ─────────────────────────────────────────────────────────────────────────────

export interface KnowledgePulse {
  tenant_id: string;
  snapshot_at: string;
  overall_health: number;
  total_users: number;
  active_users_30d: number;
  department_health: Array<{
    department: string;
    health_score: number;
    users: number;
    avg_rank: RankTier;
    avg_accuracy: number;
    training_hours_30d: number;
    at_risk_count: number;
  }>;
  theme_coverage: Array<{
    theme_id: string;
    theme_name: string;
    users_trained: number;
    avg_mastery: number;
    decay_risk: number;
    last_reinforcement: string | null;
    compliance_required: boolean;
    compliance_met: boolean;
  }>;
  decay_alerts: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    affected_users: number;
    theme_name: string;
    recommended_action: string;
  }>;
  trends: {
    knowledge_health_7d: number[];
    knowledge_health_30d: number[];
    training_hours_7d: number[];
    new_certifications_7d: number;
    avg_session_score_trend: 'up' | 'flat' | 'down';
  };
  roi_metrics: {
    estimated_cost_savings_monthly: number;
    avg_time_to_competency_days: number;
    certification_pass_rate: number;
    knowledge_retention_rate: number;
    training_hours_saved_vs_traditional: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// API Client — ALL communication goes through service layer
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Dojo API error ${response.status}: ${body || response.statusText}`);
  }

  return response.json();
}

// ── Library Management ──────────────────────────────────────────────────────

export async function fetchLibraries(tenantId: string): Promise<{ success: boolean; libraries: DojoLibrary[] }> {
  return fetchAPI(`/libraries/${tenantId}`);
}

export async function createLibrary(
  tenantId: string,
  payload: { name: string; description: string }
): Promise<{ success: boolean; library: DojoLibrary }> {
  return fetchAPI(`/libraries/${tenantId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadDocument(
  libraryId: string,
  file: File
): Promise<{ success: boolean; document: DojoDocument }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/libraries/${libraryId}/documents`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  return response.json();
}

export async function fetchDocuments(
  libraryId: string
): Promise<{ success: boolean; documents: DojoDocument[] }> {
  return fetchAPI(`/libraries/${libraryId}/documents`);
}

export async function deleteDocument(
  libraryId: string,
  documentId: string
): Promise<{ success: boolean }> {
  return fetchAPI(`/libraries/${libraryId}/documents/${documentId}`, { method: 'DELETE' });
}

// ── Theme Discovery ─────────────────────────────────────────────────────────

export async function discoverThemes(libraryId: string): Promise<ThemeDiscoveryResponse> {
  return fetchAPI(`/libraries/${libraryId}/discover-themes`, { method: 'POST' });
}

export async function fetchThemes(libraryId: string): Promise<{ success: boolean; themes: CentralTheme[] }> {
  return fetchAPI(`/libraries/${libraryId}/themes`);
}

// ── Training Sessions ───────────────────────────────────────────────────────

export async function startSession(
  tenantId: string,
  payload: { library_id: string; theme_ids: string[]; mode: 'lecture' | 'sparring' }
): Promise<{ success: boolean; session: TrainingSession }> {
  return fetchAPI(`/sessions/${tenantId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchSession(sessionId: string): Promise<{ success: boolean; session: TrainingSession }> {
  return fetchAPI(`/sessions/${sessionId}`);
}

export async function fetchLessonBlocks(
  sessionId: string
): Promise<{ success: boolean; blocks: LessonBlock[] }> {
  return fetchAPI(`/sessions/${sessionId}/lesson`);
}

export async function requestNextLesson(
  sessionId: string
): Promise<{ success: boolean; block: LessonBlock }> {
  return fetchAPI(`/sessions/${sessionId}/lesson/next`, { method: 'POST' });
}

export async function fetchSparringQuestion(
  sessionId: string
): Promise<{ success: boolean; question: SparringQuestion }> {
  return fetchAPI(`/sessions/${sessionId}/spar`);
}

export async function submitSparringAnswer(
  sessionId: string,
  answer: SparringAnswer
): Promise<{ success: boolean; result: SparringResult }> {
  return fetchAPI(`/sessions/${sessionId}/spar/answer`, {
    method: 'POST',
    body: JSON.stringify(answer),
  });
}

export async function completeSession(
  sessionId: string
): Promise<{ success: boolean; session: TrainingSession; xp_summary: { total: number; breakdown: Record<string, number> } }> {
  return fetchAPI(`/sessions/${sessionId}/complete`, { method: 'POST' });
}

// ── Progress & Rank ─────────────────────────────────────────────────────────

export async function fetchProgress(
  tenantId: string,
  userId: string
): Promise<{ success: boolean; progress: UserProgress }> {
  return fetchAPI(`/progress/${tenantId}/${userId}`);
}

export async function fetchThemeProgress(
  tenantId: string,
  userId: string,
  themeId: string
): Promise<{ success: boolean; progress: ThemeProgress }> {
  return fetchAPI(`/progress/${tenantId}/${userId}/themes/${themeId}`);
}

// ── Certification ───────────────────────────────────────────────────────────

export async function startCertExam(
  tenantId: string,
  payload: { theme_id: string; user_id: string }
): Promise<{ success: boolean; session_id: string; question_count: number; time_limit_minutes: number }> {
  return fetchAPI(`/certifications/${tenantId}/start`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchCertifications(
  tenantId: string,
  userId: string
): Promise<{ success: boolean; certifications: Certification[] }> {
  return fetchAPI(`/certifications/${tenantId}/${userId}`);
}

// ── Mobot ───────────────────────────────────────────────────────────────────

export async function sendMobotMessage(
  sessionId: string,
  message: string,
  context?: { theme_ids?: string[]; current_lesson_id?: string }
): Promise<MobotResponse> {
  return fetchAPI(`/mobot/${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({ message, context }),
  });
}

export async function fetchMobotHistory(
  sessionId: string
): Promise<{ success: boolean; messages: MobotMessage[] }> {
  return fetchAPI(`/mobot/${sessionId}/history`);
}

// ── Config (Admin) ──────────────────────────────────────────────────────────

export async function fetchDojoConfig(tenantId: string): Promise<{ success: boolean; config: DojoConfig }> {
  return fetchAPI(`/config/${tenantId}`);
}

export async function updateDojoConfig(
  tenantId: string,
  config: Partial<DojoConfig>
): Promise<{ success: boolean; config: DojoConfig }> {
  return fetchAPI(`/config/${tenantId}`, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

// ── Leapfrog 1: Ebbinghaus Decay Engine ─────────────────────────────────────

export async function fetchDecayDashboard(
  tenantId: string,
  userId: string
): Promise<{ success: boolean; dashboard: DecayDashboard }> {
  return fetchAPI(`/decay/${tenantId}/${userId}/dashboard`);
}

export async function fetchDecayCurves(
  tenantId: string,
  userId: string,
  themeId?: string
): Promise<{ success: boolean; curves: DecayCurve[]; atoms: KnowledgeAtom[] }> {
  const query = themeId ? `?theme_id=${themeId}` : '';
  return fetchAPI(`/decay/${tenantId}/${userId}/curves${query}`);
}

export async function triggerReinforcement(
  tenantId: string,
  userId: string,
  mode: 'scheduled' | 'manual' | 'pre_session'
): Promise<{ success: boolean; session: ReinforcementSession }> {
  return fetchAPI(`/decay/${tenantId}/${userId}/reinforce`, {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}

export async function submitReinforcementAnswer(
  reinforcementId: string,
  atomId: string,
  answer: SparringAnswer
): Promise<{ success: boolean; result: SparringResult; updated_curve: DecayCurve }> {
  return fetchAPI(`/decay/reinforce/${reinforcementId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ atom_id: atomId, answer }),
  });
}

// ── Leapfrog 2: Adversarial Scenario Synthesis ──────────────────────────────

export async function startScenario(
  sessionId: string,
  payload: { theme_ids: string[]; archetype?: PersonaArchetype; difficulty?: number }
): Promise<{ success: boolean; scenario: ScenarioSession }> {
  return fetchAPI(`/scenarios/${sessionId}/start`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function respondToScenario(
  scenarioId: string,
  response: string
): Promise<{ success: boolean; branch: ScenarioBranch; scenario: ScenarioSession }> {
  return fetchAPI(`/scenarios/${scenarioId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ response }),
  });
}

export async function concludeScenario(
  scenarioId: string
): Promise<{ success: boolean; scenario: ScenarioSession }> {
  return fetchAPI(`/scenarios/${scenarioId}/conclude`, { method: 'POST' });
}

// ── Leapfrog 3: Predictive Competency Mesh ──────────────────────────────────

export async function extractCompetencies(
  libraryId: string
): Promise<{ success: boolean; competencies: Competency[] }> {
  return fetchAPI(`/competencies/${libraryId}/extract`, { method: 'POST' });
}

export async function fetchCompetencyMesh(
  tenantId: string,
  userId: string,
  libraryId: string
): Promise<{ success: boolean; mesh: CompetencyMesh }> {
  return fetchAPI(`/competencies/${tenantId}/${userId}/${libraryId}/mesh`);
}

export async function fetchTeamCompetencyGaps(
  tenantId: string,
  libraryId: string,
  department?: string
): Promise<{ success: boolean; mesh: CompetencyMesh }> {
  const query = department ? `?department=${encodeURIComponent(department)}` : '';
  return fetchAPI(`/competencies/${tenantId}/${libraryId}/team${query}`);
}

// ── Leapfrog 4: Socratic Dialectic Engine ───────────────────────────────────

export async function startDialectic(
  sessionId: string,
  payload: { theme_id: string; proposition?: string }
): Promise<{ success: boolean; dialectic: DialecticSession }> {
  return fetchAPI(`/dialectic/${sessionId}/start`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function submitDialecticResponse(
  dialecticId: string,
  content: string,
  reasoningType: 'claim' | 'evidence' | 'rebuttal' | 'concession' | 'synthesis'
): Promise<{ success: boolean; turns: DialecticTurn[]; dialectic: DialecticSession }> {
  return fetchAPI(`/dialectic/${dialecticId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ content, reasoning_type: reasoningType }),
  });
}

export async function concludeDialectic(
  dialecticId: string
): Promise<{ success: boolean; dialectic: DialecticSession }> {
  return fetchAPI(`/dialectic/${dialecticId}/conclude`, { method: 'POST' });
}

// ── Leapfrog 5: Multimodal Lesson Synthesis ─────────────────────────────────

export async function fetchMultimodalContent(
  lessonId: string
): Promise<{ success: boolean; content: MultimodalContent }> {
  return fetchAPI(`/multimodal/${lessonId}`);
}

export async function generateMultimodal(
  lessonId: string,
  types: Array<'audio' | 'diagrams' | 'glossary' | 'takeaways' | 'adaptations'>
): Promise<{ success: boolean; content: MultimodalContent }> {
  return fetchAPI(`/multimodal/${lessonId}/generate`, {
    method: 'POST',
    body: JSON.stringify({ types }),
  });
}

// ── Leapfrog 6: Organizational Knowledge Pulse ──────────────────────────────

export async function fetchKnowledgePulse(
  tenantId: string
): Promise<{ success: boolean; pulse: KnowledgePulse }> {
  return fetchAPI(`/pulse/${tenantId}`);
}

export async function fetchPulseHistory(
  tenantId: string,
  days: number
): Promise<{ success: boolean; snapshots: KnowledgePulse[] }> {
  return fetchAPI(`/pulse/${tenantId}/history?days=${days}`);
}

// ── Archytas — The Tool Master ──────────────────────────────────────────────

export async function fetchArchytasConfig(
  tenantId: string
): Promise<{ success: boolean; config: ArchytasConfig }> {
  return fetchAPI(`/archytas/${tenantId}/config`);
}

export async function updateArchytasConfig(
  tenantId: string,
  config: Partial<ArchytasConfig>
): Promise<{ success: boolean; config: ArchytasConfig }> {
  return fetchAPI(`/archytas/${tenantId}/config`, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

export async function invokeArchytasTool(
  sessionId: string,
  toolType: ArchytasToolType,
  input: string
): Promise<{ success: boolean; tool_call: ArchytasToolCall }> {
  return fetchAPI(`/archytas/${sessionId}/invoke`, {
    method: 'POST',
    body: JSON.stringify({ tool_type: toolType, input }),
  });
}

export async function fetchArchytasSuggestions(
  sessionId: string,
  context: string
): Promise<{ success: boolean; suggestions: ArchytasSuggestion[] }> {
  return fetchAPI(`/archytas/${sessionId}/suggest`, {
    method: 'POST',
    body: JSON.stringify({ context }),
  });
}

export async function fetchArchytasSessionSummary(
  sessionId: string
): Promise<{ success: boolean; summary: ArchytasSessionSummary }> {
  return fetchAPI(`/archytas/${sessionId}/summary`);
}
