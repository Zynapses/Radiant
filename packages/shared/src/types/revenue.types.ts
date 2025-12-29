/**
 * RADIANT v4.18.0 - Revenue Analytics Types
 * Gross revenue, profit tracking, and accounting export formats
 */

// ============================================================================
// Time Period Types
// ============================================================================

export type RevenuePeriod = 'day' | 'week' | 'month' | 'quarter' | 'year';

export type ExportFormat = 'csv' | 'json' | 'quickbooks_iif' | 'xero_csv' | 'sage_csv';

// ============================================================================
// Revenue Source Types
// ============================================================================

export type RevenueSource = 
  | 'subscription'           // Monthly/annual subscription fees
  | 'credit_purchase'        // One-time credit purchases
  | 'ai_markup_external'     // Markup on external AI provider usage
  | 'ai_markup_self_hosted'  // Markup on self-hosted model usage
  | 'overage'                // Usage beyond subscription limits
  | 'storage'                // Storage fees
  | 'other';

export type CostCategory =
  | 'aws_compute'            // EC2, SageMaker, Lambda
  | 'aws_storage'            // S3, EBS
  | 'aws_network'            // Data transfer, API Gateway
  | 'aws_database'           // Aurora, DynamoDB
  | 'external_ai'            // OpenAI, Anthropic, etc.
  | 'infrastructure'         // Other cloud costs
  | 'platform_fees';         // Payment processing, etc.

// ============================================================================
// Revenue Data Structures
// ============================================================================

export interface RevenueEntry {
  id: string;
  tenantId: string;
  source: RevenueSource;
  amount: number;
  currency: string;
  description: string;
  referenceId?: string;       // subscription_id, transaction_id, etc.
  referenceType?: string;     // 'subscription', 'credit_transaction', etc.
  metadata?: Record<string, unknown>;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
}

export interface CostEntry {
  id: string;
  tenantId?: string;          // null for shared infrastructure
  category: CostCategory;
  amount: number;
  currency: string;
  description: string;
  awsServiceName?: string;    // e.g., 'SageMaker', 'Aurora'
  resourceId?: string;
  metadata?: Record<string, unknown>;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
}

export interface RevenueSummary {
  periodStart: Date;
  periodEnd: Date;
  period: RevenuePeriod;
  
  // Revenue Breakdown
  subscriptionRevenue: number;
  creditPurchaseRevenue: number;
  aiMarkupExternalRevenue: number;
  aiMarkupSelfHostedRevenue: number;
  overageRevenue: number;
  storageRevenue: number;
  otherRevenue: number;
  totalGrossRevenue: number;
  
  // Cost Breakdown
  awsComputeCost: number;
  awsStorageCost: number;
  awsNetworkCost: number;
  awsDatabaseCost: number;
  externalAiCost: number;
  infrastructureCost: number;
  platformFeesCost: number;
  totalCost: number;
  
  // Profit Metrics
  grossProfit: number;
  grossMargin: number;          // (grossRevenue - totalCost) / grossRevenue * 100
  
  // Note: Marketing, sales, etc. costs are NOT included
  // These are COGS-level profits, not net profits
}

export interface RevenueByTenant {
  tenantId: string;
  tenantName: string;
  subscriptionRevenue: number;
  usageRevenue: number;
  totalRevenue: number;
  associatedCost: number;
  profit: number;
  margin: number;
}

export interface RevenueByProduct {
  product: 'radiant' | 'think_tank' | 'combined';
  subscriptionRevenue: number;
  usageRevenue: number;
  totalRevenue: number;
  associatedCost: number;
  profit: number;
  margin: number;
}

export interface RevenueByModel {
  modelId: string;
  modelName: string;
  hostingType: 'external' | 'self_hosted';
  providerCost: number;
  customerCharge: number;
  markup: number;
  markupPercent: number;
  requestCount: number;
}

export interface RevenueTrend {
  date: string;               // ISO date string
  grossRevenue: number;
  totalCost: number;
  grossProfit: number;
  subscriptionRevenue: number;
  usageRevenue: number;
}

// ============================================================================
// Dashboard & Analytics Types
// ============================================================================

export interface RevenueDashboard {
  summary: RevenueSummary;
  previousPeriodSummary: RevenueSummary;
  trends: RevenueTrend[];
  byTenant: RevenueByTenant[];
  byProduct: RevenueByProduct[];
  byModel: RevenueByModel[];
  
  // Comparison metrics
  revenueChange: number;      // Percentage change from previous period
  profitChange: number;
  marginChange: number;
}

export interface RevenueFilters {
  periodStart: Date;
  periodEnd: Date;
  period: RevenuePeriod;
  tenantId?: string;
  product?: 'radiant' | 'think_tank' | 'combined';
  source?: RevenueSource;
}

// ============================================================================
// Export Types
// ============================================================================

export interface RevenueExportRequest {
  format: ExportFormat;
  periodStart: Date;
  periodEnd: Date;
  includeDetails: boolean;    // Include line items vs just summary
  tenantId?: string;          // Filter to specific tenant
}

export interface RevenueExportResponse {
  filename: string;
  mimeType: string;
  data: string;               // Base64 encoded file data
  recordCount: number;
  periodStart: Date;
  periodEnd: Date;
}

// QuickBooks IIF format specifics
export interface QuickBooksExportRow {
  TRNSTYPE: 'INVOICE' | 'PAYMENT' | 'BILL' | 'GENERAL JOURNAL';
  DATE: string;               // MM/DD/YYYY
  ACCNT: string;              // Account name
  NAME?: string;              // Customer/vendor name
  AMOUNT: number;
  MEMO?: string;
  CLASS?: string;             // Revenue classification
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface GetRevenueDashboardRequest {
  periodStart: string;        // ISO date
  periodEnd: string;
  period: RevenuePeriod;
  tenantId?: string;
}

export interface GetRevenueDashboardResponse {
  dashboard: RevenueDashboard;
}

export interface GetRevenueDetailsRequest {
  periodStart: string;
  periodEnd: string;
  source?: RevenueSource;
  tenantId?: string;
  page?: number;
  pageSize?: number;
}

export interface GetRevenueDetailsResponse {
  entries: RevenueEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GetCostDetailsRequest {
  periodStart: string;
  periodEnd: string;
  category?: CostCategory;
  tenantId?: string;
  page?: number;
  pageSize?: number;
}

export interface GetCostDetailsResponse {
  entries: CostEntry[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================================================
// Accounting Period Types
// ============================================================================

export interface AccountingPeriod {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  status: 'open' | 'closed' | 'reconciled';
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  closedAt?: Date;
  closedBy?: string;
  notes?: string;
}

export interface ReconciliationEntry {
  id: string;
  periodId: string;
  entryType: 'adjustment' | 'correction' | 'write_off';
  category: RevenueSource | CostCategory;
  amount: number;
  reason: string;
  createdBy: string;
  createdAt: Date;
}
