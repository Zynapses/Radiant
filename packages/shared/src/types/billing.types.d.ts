/**
 * RADIANT v4.18.0 - Billing/Metering Types
 * SINGLE SOURCE OF TRUTH
 */
export interface UsageEvent {
    id: string;
    tenantId: string;
    appId: string;
    userId?: string;
    modelId: string;
    providerId: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    margin: number;
    billedAmount: number;
    requestType: RequestType;
    responseTime: number;
    status: UsageStatus;
    timestamp: Date;
    metadata?: Record<string, unknown>;
}
export type RequestType = 'chat' | 'completion' | 'embedding' | 'image' | 'audio' | 'video';
export type UsageStatus = 'success' | 'error' | 'rate_limited' | 'timeout';
export interface TenantBilling {
    tenantId: string;
    appId: string;
    stripeCustomerId?: string;
    billingEmail: string;
    plan: BillingPlan;
    margin: number;
    creditBalance: number;
    lastInvoiceDate?: Date;
    nextInvoiceDate?: Date;
}
export type BillingPlan = 'free' | 'starter' | 'professional' | 'enterprise';
export interface Invoice {
    id: string;
    tenantId: string;
    appId: string;
    stripeInvoiceId?: string;
    periodStart: Date;
    periodEnd: Date;
    subtotal: number;
    margin: number;
    tax: number;
    total: number;
    status: InvoiceStatus;
    paidAt?: Date;
    createdAt: Date;
}
export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'failed' | 'void';
export interface BillingBreakdown {
    period: {
        start: Date;
        end: Date;
    };
    usage: {
        totalRequests: number;
        totalTokens: number;
        byModel: ModelUsageSummary[];
        byProvider: ProviderUsageSummary[];
    };
    costs: {
        baseCost: number;
        margin: number;
        total: number;
    };
}
export interface ModelUsageSummary {
    modelId: string;
    modelName: string;
    requests: number;
    tokens: number;
    cost: number;
}
export interface ProviderUsageSummary {
    providerId: string;
    providerName: string;
    requests: number;
    tokens: number;
    cost: number;
}
export interface PricingConfig {
    defaultMargin: number;
    minimumCharge: number;
    currencyCode: string;
    tierDiscounts: TierDiscount[];
}
export interface TierDiscount {
    minTokens: number;
    discountPercent: number;
}
export declare const DEFAULT_PRICING: PricingConfig;
//# sourceMappingURL=billing.types.d.ts.map