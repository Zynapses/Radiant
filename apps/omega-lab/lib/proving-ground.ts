/**
 * OMEGA Proving Ground API Client
 * Talks directly to the local OMEGA server at localhost:11435
 */

const PG_BASE = process.env.NEXT_PUBLIC_OMEGA_PG_URL || 'http://localhost:11435';

export interface BrainState {
  booted: boolean;
  boot_time?: number;
  uptime_seconds?: number;
  inference_count?: number;
  config?: {
    input_dim: number;
    hidden_dim: number;
    dt: number;
    decay_rate: number;
  };
  cortex?: {
    coherence: number;
    state_norm: number;
    magnitude_mean: number;
    magnitude_std: number;
    magnitude_max: number;
    magnitude_min: number;
    phase_mean: number;
    phase_std: number;
    phase_histogram: number[];
    magnitude_histogram: number[];
  };
  ambition?: {
    dopamine: number;
    entropy: number;
    curiosity: number;
    arousal: number;
    total_dreams: number;
    total_rewards: number;
    consecutive_idle_ticks: number;
  };
  helix?: { rules_count: number };
  firmware?: { loaded: boolean; name: string | null; version: string | null };
  transducer?: { params: number; omega_dim: number; llm_dim: number; num_soft_tokens: number };
  recent_inferences?: any[];
}

export interface TrainStatus {
  loaded: boolean;
  trained: boolean;
  epoch: number;
  best_accuracy: number;
  examples_count: number;
  behaviors_count: number;
  history: TrainEpoch[];
}

export interface TrainEpoch {
  epoch: number;
  total_loss: number;
  avg_loss: number;
  behavior_accuracy: number;
  examples_trained: number;
  learning_rate: number;
  elapsed_ms: number;
  per_behavior_accuracy: Record<string, number>;
}

export interface TrainResult {
  success: boolean;
  epochs_run: number;
  final_accuracy: number;
  history: TrainEpoch[];
}

export interface CortexTelemetry {
  coherence: number;
  state_norm: number;
  output_magnitude_mean: number;
  output_magnitude_std: number;
  output_magnitude_max: number;
  output_phase_mean: number;
  output_phase_std: number;
  output_sparsity: number;
  hidden_dim: number;
}

export interface InferResult {
  response: string;
  omega: {
    behavior: string;
    confidence: number;
    top_behaviors: Array<[string, number]>;
    target_data: Record<string, unknown>;
    processing_ms: number;
  };
  cortex?: CortexTelemetry;
  llama: {
    instruction: string;
    processing_ms: number;
    model: string | null;
  };
  total_ms: number;
  is_trained: boolean;
}

export interface CompareResult {
  omega_response: string;
  raw_response: string;
  omega: {
    behavior: string;
    confidence: number;
    top_behaviors: Array<[string, number]>;
    target_data: Record<string, unknown>;
    processing_ms: number;
  };
  comparison: {
    omega_ms: number;
    raw_ms: number;
  };
}

export interface EvalResult {
  input: string;
  expected_behavior: string;
  decoded_behavior: string;
  confidence: number;
  correct: boolean;
  top_3: Array<[string, number]>;
  target_action: string;
  target_data: Record<string, unknown>;
}

export interface LoadTrainingResult {
  loaded: boolean;
  training_examples: number;
  behavior_types: number;
  knowledge_base_categories: string[];
  codebook_size: number;
  llama_available: boolean;
  llama_model: string;
}

export interface TrainRunResult {
  completed: boolean;
  epochs_run: number;
  final_accuracy: number;
  final_loss: number;
  best_accuracy: number;
  history: TrainEpoch[];
}

export interface ThinkResult {
  inference_id: number;
  latency_ms: number;
  pre_coherence: number;
  post_coherence: number;
  coherence_delta: number;
  is_safe: boolean;
  max_helix_alignment: number;
  output_magnitude_mean: number;
  output_magnitude_std: number;
  output_phase_mean: number;
  output_phase_std: number;
  state_norm: number;
}

async function pgFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${PG_BASE}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PG ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getHealth(): Promise<{ status: string; device: string; brain_booted: boolean }> {
  return pgFetch('/health');
}

export async function getState(): Promise<BrainState> {
  return pgFetch('/state');
}

export async function think(text: string): Promise<ThinkResult> {
  return pgFetch('/think', { method: 'POST', body: JSON.stringify({ text }) });
}

export async function dream(): Promise<{ pre_coherence: number; post_coherence: number }> {
  return pgFetch('/dream', { method: 'POST' });
}

export async function bootBrain(config?: { input_dim?: number; hidden_dim?: number }): Promise<BrainState> {
  return pgFetch('/boot', { method: 'POST', body: JSON.stringify(config || {}) });
}

export async function loadTraining(model?: string): Promise<LoadTrainingResult> {
  return pgFetch('/train/load', { method: 'POST', body: JSON.stringify({ model: model || 'llama3.2:1b' }) });
}

export async function runTraining(epochs: number = 50, targetAccuracy: number = 0.95, lr?: number): Promise<TrainRunResult> {
  return pgFetch('/train/run', {
    method: 'POST',
    body: JSON.stringify({ epochs, target_accuracy: targetAccuracy, learning_rate: lr }),
  });
}

export async function getTrainStatus(): Promise<{
  is_trained: boolean;
  trainer_initialized: boolean;
  training_examples: number;
  total_epochs: number;
  best_accuracy: number;
  history_length: number;
  llama_available: boolean;
}> {
  return pgFetch('/train/status');
}

export async function evaluate(): Promise<{ accuracy: number; correct: number; total: number; results: EvalResult[] }> {
  return pgFetch('/train/evaluate', { method: 'POST' });
}

export async function infer(text: string, conversationHistory?: Array<{role: string; text: string}>): Promise<InferResult> {
  return pgFetch('/infer', {
    method: 'POST',
    body: JSON.stringify({ text, conversation_history: conversationHistory || [] }),
  });
}

export async function ttsSpeak(text: string): Promise<ArrayBuffer> {
  const res = await fetch(`${PG_BASE}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    throw new Error(`TTS failed: ${res.status}`);
  }
  return res.arrayBuffer();
}

export async function compare(text: string): Promise<CompareResult> {
  return pgFetch('/compare', { method: 'POST', body: JSON.stringify({ text }) });
}

export async function saveCheckpoint(): Promise<{ saved: boolean; path: string; epoch: number; best_accuracy: number }> {
  return pgFetch('/train/save', { method: 'POST' });
}

export async function loadCheckpoint(): Promise<{ loaded: boolean; epoch: number; best_accuracy: number; is_trained: boolean }> {
  return pgFetch('/train/load-checkpoint', { method: 'POST' });
}

export async function resetBrain(): Promise<{ reset: boolean }> {
  return pgFetch('/reset', { method: 'POST' });
}

// ============================================================================
// McDonald's Real API
// ============================================================================

export interface McMenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  calories: number;
  image?: string;
  category: string;
}

export interface McMenuCategory {
  name: string;
  items: McMenuItem[];
}

export interface McMenuResult {
  success: boolean;
  source: 'mcdonalds_api' | 'local_fallback';
  store_id?: string;
  timestamp: string;
  categories: McMenuCategory[];
  total_items: number;
}

export interface McNutrition {
  calories: number;
  total_fat_g: number;
  saturated_fat_g: number;
  trans_fat_g: number;
  cholesterol_mg: number;
  sodium_mg: number;
  total_carbs_g: number;
  dietary_fiber_g: number;
  sugars_g: number;
  protein_g: number;
}

export interface McNutritionResult {
  success: boolean;
  source: string;
  product_id: string;
  name: string;
  description: string;
  nutrition: McNutrition;
  allergens: string[];
  ingredients: string;
}

export interface McStore {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  open_24h: boolean;
  drive_thru: boolean;
  hours: Record<string, unknown>;
  distance_miles: number;
}

export interface McStoresResult {
  success: boolean;
  source: string;
  query: { lat: string; lng: string; radius: string };
  count: number;
  stores: McStore[];
}

export interface McOffer {
  id: string;
  name: string;
  description: string;
  image: string;
  valid_from: string;
  valid_to: string;
}

export interface McDealsResult {
  success: boolean;
  source: string;
  store_id: string;
  count: number;
  offers: McOffer[];
}

export async function getMcMenu(storeId?: string): Promise<McMenuResult> {
  const params = storeId ? `?storeId=${storeId}` : '';
  return pgFetch(`/mcdonalds/menu${params}`);
}

export async function getMcNutrition(productId: string, storeId?: string): Promise<McNutritionResult> {
  const params = storeId ? `?storeId=${storeId}` : '';
  return pgFetch(`/mcdonalds/nutrition/${productId}${params}`);
}

export async function getMcStores(lat?: string, lng?: string, radius?: string): Promise<McStoresResult> {
  const params = new URLSearchParams();
  if (lat) params.set('lat', lat);
  if (lng) params.set('lng', lng);
  if (radius) params.set('radius', radius);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return pgFetch(`/mcdonalds/stores${qs}`);
}

export async function getMcDeals(storeId?: string): Promise<McDealsResult> {
  const params = storeId ? `?storeId=${storeId}` : '';
  return pgFetch(`/mcdonalds/deals${params}`);
}

// ============================================================================
// Proving Ground App Management
// ============================================================================

export interface PGAppDataset {
  name: string;
  size_mb: number;
}

export interface PGApp {
  name: string;
  datasets: PGAppDataset[];
  dataset_count: number;
  image_count: number;
  readme: string;
  has_datasets: boolean;
  has_images: boolean;
}

export interface PGAppListResult {
  success: boolean;
  apps: PGApp[];
}

export async function listApps(): Promise<PGAppListResult> {
  return pgFetch('/apps');
}

export async function getApp(name: string): Promise<{ success: boolean } & PGApp> {
  return pgFetch(`/apps/${encodeURIComponent(name)}`);
}

export async function createApp(name: string): Promise<{ success: boolean; name: string; path: string }> {
  return pgFetch('/apps', { method: 'POST', body: JSON.stringify({ name }) });
}

export async function renameApp(oldName: string, newName: string): Promise<{ success: boolean; old_name: string; new_name: string }> {
  return pgFetch(`/apps/${encodeURIComponent(oldName)}`, { method: 'PUT', body: JSON.stringify({ name: newName }) });
}

export async function deleteApp(name: string): Promise<{ success: boolean; archived_as: string }> {
  return pgFetch(`/apps/${encodeURIComponent(name)}`, { method: 'DELETE' });
}
