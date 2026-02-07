const API_BASE = process.env.OMEGA_API_URL || 'http://localhost:3001/api/admin/omega';

export interface DashboardData {
  success: boolean;
  timestamp: string;
  summary: {
    total_brains: number;
    thermal: {
      warm: number;
      cooling: number;
      cold: number;
      frozen: number;
    };
    health: {
      high_entropy: number;
      low_coherence: number;
      avg_coherence: number;
      avg_entropy: number;
    };
    usage: {
      total_cycles: number;
      total_storage_mb: number;
    };
  };
}

export interface BrainInfo {
  tenant_id: string;
  thermal_status: 'warm' | 'cooling' | 'cold' | 'frozen';
  age_seconds: number;
  entropy_level: number;
  coherence_score: number;
  neural_density_mb: number;
  firmware_name: string;
  firmware_version: string;
  total_cycles: number;
  version: number;
  last_awake: string;
  created_at: string;
  s3_backup_key: string | null;
}

export interface BrainListResponse {
  success: boolean;
  count: number;
  brains: BrainInfo[];
}

export interface BrainDetailResponse {
  success: boolean;
  tenant_id: string;
  thermal_status: string;
  metadata: {
    entropy_level: number;
    coherence_score: number;
    neural_density_mb: number;
    firmware_name: string;
    firmware_version: string;
    total_cycles: number;
    version: number;
    last_awake: string;
    created_at: string;
    s3_backup_key: string | null;
  };
  ambition_state: {
    dopamine: number;
    entropy: number;
    curiosity: number;
    arousal: number;
    total_dreams: number;
    total_rewards: number;
    consecutive_idle_ticks: number;
  } | null;
  visualization: {
    phase_distribution: number[] | null;
    magnitude_distribution: number[] | null;
  };
}

export interface FirmwareVersion {
  id: string;
  burned_at: string;           // ISO timestamp — primary identifier
  label: string | null;        // Optional human-readable name
  description: string;
  author: string;
  has_signature: boolean;
  directive_count: number;     // Total instincts + morals + fears + boundaries
  drive_hash: string;          // Hash of ambition/personality config for integrity
}

export interface FirmwareListResponse {
  success: boolean;
  tenant_id: string;
  active_id: string | null;
  count: number;
  firmware: FirmwareVersion[];
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function fetchDashboard(): Promise<DashboardData> {
  return fetchAPI('/dashboard');
}

export async function fetchBrains(): Promise<BrainListResponse> {
  return fetchAPI('/cortex/list');
}

export async function fetchBrain(tenantId: string): Promise<BrainDetailResponse> {
  return fetchAPI(`/cortex/${tenantId}`);
}

export async function createSnapshot(tenantId: string): Promise<{ success: boolean; s3_key: string }> {
  return fetchAPI(`/cortex/${tenantId}/snapshot`, { method: 'POST' });
}

export async function listSnapshots(
  tenantId: string
): Promise<{ success: boolean; snapshots: Array<{ key: string; size_mb: number; last_modified: string }> }> {
  return fetchAPI(`/cortex/${tenantId}/snapshots`);
}

export async function restoreBrain(
  tenantId: string,
  s3Key: string
): Promise<{ success: boolean; restored_from: string }> {
  return fetchAPI(`/cortex/${tenantId}/restore`, {
    method: 'POST',
    body: JSON.stringify({ s3_key: s3Key }),
  });
}

export async function lobotomizeBrain(tenantId: string): Promise<{ success: boolean; new_version: number }> {
  return fetchAPI(`/cortex/${tenantId}/lobotomy`, { method: 'POST' });
}

export async function fetchFirmwareList(tenantId: string): Promise<FirmwareListResponse> {
  return fetchAPI(`/firmware/${tenantId}`);
}

export interface BurnFirmwarePayload {
  label: string | null;        // Optional version label
  description: string;
  author: string;
  directives: Array<{
    kind: 'instinct' | 'fear' | 'moral' | 'ambition' | 'boundary';
    directive: string;         // The actual behavioral instruction
    weight: number;            // 1-10, enforcement strength
  }>;
  drives: {
    entropy_threshold: number;
    dopamine_decay_rate: number;
    curiosity_bias: number;
    plasticity: number;
    caution: number;
  };
  personality: {
    warmth: number;
    assertiveness: number;
    creativity: number;
    formality: number;
    humor: number;
    empathy: number;
  };
}

export async function burnFirmware(
  tenantId: string,
  payload: BurnFirmwarePayload
): Promise<{ success: boolean; firmware_id: string; burned_at: string }> {
  return fetchAPI(`/firmware/${tenantId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** @deprecated Use burnFirmware instead */
export async function createFirmware(
  tenantId: string,
  firmware: {
    name: string;
    description: string;
    author: string;
    helix_rules: Array<{
      type: string;
      category: string;
      description: string;
      priority: number;
    }>;
    ambition_settings: Record<string, number>;
    personality: Record<string, number>;
  }
): Promise<{ success: boolean; firmware_id: string }> {
  return fetchAPI(`/firmware/${tenantId}`, {
    method: 'POST',
    body: JSON.stringify(firmware),
  });
}

export async function activateFirmware(
  tenantId: string,
  firmwareId: string
): Promise<{ success: boolean; activated: boolean }> {
  return fetchAPI(`/firmware/${tenantId}/${firmwareId}/activate`, { method: 'POST' });
}

export async function generateKeypair(): Promise<{
  success: boolean;
  private_key: string;
  public_key: string;
}> {
  return fetchAPI('/keypair', { method: 'POST' });
}
