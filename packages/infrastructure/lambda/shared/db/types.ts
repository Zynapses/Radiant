/**
 * Database types for Aurora PostgreSQL
 */

export interface Tenant {
  id: string;
  name: string;
  display_name: string;
  domain?: string;
  settings: TenantSettings;
  status: 'active' | 'suspended' | 'pending';
  created_at: string;
  updated_at: string;
}

export interface TenantSettings {
  branding?: {
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
  };
  features?: {
    self_hosted_models?: boolean;
    phi_sanitization?: boolean;
    advanced_analytics?: boolean;
  };
  limits?: {
    max_users?: number;
    max_requests_per_month?: number;
    max_storage_gb?: number;
  };
}

export interface User {
  id: string;
  tenant_id: string;
  cognito_user_id: string;
  email: string;
  display_name?: string;
  role: 'user' | 'power_user' | 'admin';
  status: 'active' | 'suspended' | 'pending';
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Administrator {
  id: string;
  cognito_user_id: string;
  email: string;
  display_name: string;
  role: 'super_admin' | 'admin' | 'operator' | 'auditor';
  permissions: string[];
  mfa_enabled: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
  invited_by?: string;
}

export interface Provider {
  id: string;
  name: string;
  display_name: string;
  type: 'external' | 'self_hosted';
  category: 'text' | 'image' | 'video' | 'audio' | 'embedding' | 'search' | '3d';
  base_url: string;
  api_key_secret_arn?: string;
  status: 'active' | 'inactive' | 'maintenance';
  health_status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  config: ProviderConfig;
  created_at: string;
  updated_at: string;
}

export interface ProviderConfig {
  timeout_ms?: number;
  max_retries?: number;
  rate_limit_rpm?: number;
  rate_limit_tpm?: number;
  headers?: Record<string, string>;
}

export interface Model {
  id: string;
  provider_id: string;
  name: string;
  display_name: string;
  category: 'text' | 'image' | 'video' | 'audio' | 'embedding' | 'search' | '3d';
  capabilities: string[];
  context_window?: number;
  max_output_tokens?: number;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
  status: 'active' | 'inactive' | 'deprecated';
  config: ModelConfig;
  created_at: string;
  updated_at: string;
}

export interface ModelConfig {
  litellm_model_name?: string;
  supports_streaming?: boolean;
  supports_function_calling?: boolean;
  supports_vision?: boolean;
  max_batch_size?: number;
}

export interface UsageEvent {
  id: string;
  tenant_id: string;
  user_id: string;
  model_id: string;
  provider_id: string;
  request_id: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_cost: number;
  output_cost: number;
  total_cost: number;
  latency_ms: number;
  status: 'success' | 'error' | 'timeout';
  error_message?: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  currency: string;
  status: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';
  line_items: InvoiceLineItem[];
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  model_id?: string;
}

export interface AuditLog {
  id: string;
  tenant_id?: string;
  actor_id: string;
  actor_type: 'user' | 'admin' | 'system';
  action: string;
  resource_type: string;
  resource_id?: string;
  details: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: 'super_admin' | 'admin' | 'operator' | 'auditor';
  invited_by: string;
  token_hash: string;
  expires_at: string;
  accepted_at?: string;
  created_at: string;
}

export interface ApprovalRequest {
  id: string;
  requester_id: string;
  action_type: string;
  resource_type: string;
  resource_id?: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  required_approvals: number;
  approvals: Approval[];
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface Approval {
  approver_id: string;
  decision: 'approved' | 'rejected';
  comment?: string;
  created_at: string;
}

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}
