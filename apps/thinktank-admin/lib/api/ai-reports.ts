/**
 * AI Reports API Client
 * Version: 5.42.0
 * 
 * Client for interacting with AI-powered report generation API.
 */

// Types
export interface SmartInsight {
  id: string;
  type: 'anomaly' | 'trend' | 'recommendation' | 'warning' | 'achievement';
  title: string;
  description: string;
  metric?: string;
  value?: string;
  change?: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
}

export interface BrandKit {
  id?: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  headerFont: string;
  companyName: string;
  tagline: string;
  isDefault?: boolean;
}

export interface ReportSection {
  id: string;
  type: 'heading' | 'paragraph' | 'metrics' | 'chart' | 'table' | 'quote' | 'list';
  content: string;
  level?: 1 | 2 | 3;
  items?: string[];
  metrics?: { label: string; value: string; change?: string; trend?: 'up' | 'down' | 'neutral' }[];
  chartConfig?: ChartConfig;
  tableConfig?: TableConfig;
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area';
  title: string;
  data: { label: string; value: number }[];
}

export interface TableConfig {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface GeneratedReport {
  id: string;
  title: string;
  subtitle?: string;
  executiveSummary?: string;
  sections: ReportSection[];
  charts?: ChartConfig[];
  tables?: TableConfig[];
  smartInsights?: SmartInsight[];
  style: 'executive' | 'detailed' | 'dashboard' | 'narrative';
  status: 'draft' | 'generating' | 'completed' | 'failed' | 'archived';
  confidenceScore?: number;
  version: number;
  exportCount: number;
  createdAt: string;
  updatedAt: string;
  metadata: {
    generatedAt: string;
    dataRange?: string;
    confidence: number;
  };
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  style: 'executive' | 'detailed' | 'dashboard' | 'narrative';
  isSystemTemplate: boolean;
  usageCount: number;
  createdAt: string;
}

export interface GenerateReportRequest {
  prompt: string;
  style: 'executive' | 'detailed' | 'dashboard' | 'narrative';
  templateId?: string;
  brandKitId?: string;
  dataRange?: { start: string; end: string };
}

export interface ExportRequest {
  format: 'pdf' | 'excel' | 'html' | 'json';
  brandKitId?: string;
}

export interface ExportResponse {
  exportId: string;
  fileName: string;
  format: string;
  downloadUrl: string;
  fileSize: number;
}

export interface ChatMessage {
  reportId: string;
  sessionId: string;
  message: string;
}

export interface InsightsDashboard {
  period: string;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  recentHighSeverity: SmartInsight[];
  pendingActionable: number;
}

// API Base URL
const API_BASE = '/api/admin/ai-reports';

// Helper for API calls
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }

  return response.json();
}

// =====================================================
// REPORTS API
// =====================================================

export async function listReports(params?: {
  limit?: number;
  offset?: number;
  status?: string;
  style?: string;
}): Promise<{ reports: GeneratedReport[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());
  if (params?.status) searchParams.set('status', params.status);
  if (params?.style) searchParams.set('style', params.style);

  const query = searchParams.toString();
  return apiCall(`${query ? `?${query}` : ''}`);
}

export async function getReport(reportId: string): Promise<GeneratedReport> {
  return apiCall(`/${reportId}`);
}

export async function generateReport(request: GenerateReportRequest): Promise<GeneratedReport> {
  return apiCall('/generate', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function updateReport(
  reportId: string,
  updates: Partial<{
    title: string;
    subtitle: string;
    executiveSummary: string;
    sections: ReportSection[];
    charts: ChartConfig[];
    tables: TableConfig[];
  }>
): Promise<GeneratedReport> {
  return apiCall(`/${reportId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteReport(reportId: string): Promise<{ success: boolean }> {
  return apiCall(`/${reportId}`, {
    method: 'DELETE',
  });
}

export async function exportReport(
  reportId: string,
  request: ExportRequest
): Promise<ExportResponse> {
  return apiCall(`/${reportId}/export`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// =====================================================
// TEMPLATES API
// =====================================================

export async function listTemplates(): Promise<{ templates: ReportTemplate[] }> {
  return apiCall('/templates');
}

export async function createTemplate(template: {
  name: string;
  description?: string;
  style: string;
  promptTemplate: string;
  sectionSchema?: unknown[];
}): Promise<ReportTemplate> {
  return apiCall('/templates', {
    method: 'POST',
    body: JSON.stringify(template),
  });
}

// =====================================================
// BRAND KITS API
// =====================================================

export async function listBrandKits(): Promise<{ brandKits: BrandKit[] }> {
  return apiCall('/brand-kits');
}

export async function createBrandKit(brandKit: Omit<BrandKit, 'id'>): Promise<BrandKit> {
  return apiCall('/brand-kits', {
    method: 'POST',
    body: JSON.stringify(brandKit),
  });
}

export async function updateBrandKit(
  brandKitId: string,
  updates: Partial<BrandKit>
): Promise<BrandKit> {
  return apiCall(`/brand-kits/${brandKitId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteBrandKit(brandKitId: string): Promise<{ success: boolean }> {
  return apiCall(`/brand-kits/${brandKitId}`, {
    method: 'DELETE',
  });
}

// =====================================================
// CHAT API
// =====================================================

export async function sendChatMessage(message: ChatMessage): Promise<GeneratedReport> {
  return apiCall('/chat', {
    method: 'POST',
    body: JSON.stringify(message),
  });
}

// =====================================================
// INSIGHTS API
// =====================================================

export async function getInsightsDashboard(days?: number): Promise<InsightsDashboard> {
  const query = days ? `?days=${days}` : '';
  return apiCall(`/insights${query}`);
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

export function downloadExport(downloadUrl: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export const DEFAULT_BRAND_KIT: BrandKit = {
  name: 'Default',
  logoUrl: null,
  primaryColor: '#3b82f6',
  secondaryColor: '#64748b',
  accentColor: '#10b981',
  fontFamily: 'Inter, system-ui, sans-serif',
  headerFont: 'Inter, system-ui, sans-serif',
  companyName: 'RADIANT',
  tagline: 'AI-Powered Insights',
};

export const CHART_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
];
