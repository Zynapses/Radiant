/**
 * RADIANT v4.18.0 - Revenue Analytics Service
 * Gross revenue, profit tracking, and accounting export
 */

import { executeStatement, stringParam, longParam } from '../db/client';
import { enhancedLogger } from '../logging/enhanced-logger';

import type {
  RevenuePeriod,
  RevenueSource,
  CostCategory,
  RevenueSummary,
  RevenueByTenant,
  RevenueByProduct,
  RevenueByModel,
  RevenueTrend,
  RevenueDashboard,
  RevenueEntry,
  CostEntry,
  ExportFormat,
  RevenueExportResponse,
  QuickBooksExportRow,
} from '@radiant/shared';

const logger = enhancedLogger;

class RevenueService {
  // ============================================================================
  // Dashboard & Summary
  // ============================================================================

  async getDashboard(
    periodStart: Date,
    periodEnd: Date,
    period: RevenuePeriod,
    tenantId?: string
  ): Promise<RevenueDashboard> {
    const summary = await this.getSummary(periodStart, periodEnd, tenantId);
    
    // Calculate previous period
    const periodDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const prevStart = new Date(periodStart);
    prevStart.setDate(prevStart.getDate() - periodDays);
    const prevEnd = new Date(periodStart);
    prevEnd.setDate(prevEnd.getDate() - 1);
    
    const previousPeriodSummary = await this.getSummary(prevStart, prevEnd, tenantId);
    
    const [trends, byTenant, byProduct, byModel] = await Promise.all([
      this.getTrends(periodStart, periodEnd, tenantId),
      this.getRevenueByTenant(periodStart, periodEnd),
      this.getRevenueByProduct(periodStart, periodEnd),
      this.getRevenueByModel(periodStart, periodEnd),
    ]);

    const revenueChange = previousPeriodSummary.totalGrossRevenue > 0
      ? ((summary.totalGrossRevenue - previousPeriodSummary.totalGrossRevenue) / previousPeriodSummary.totalGrossRevenue) * 100
      : 0;
    
    const profitChange = previousPeriodSummary.grossProfit > 0
      ? ((summary.grossProfit - previousPeriodSummary.grossProfit) / previousPeriodSummary.grossProfit) * 100
      : 0;

    const marginChange = summary.grossMargin - previousPeriodSummary.grossMargin;

    return {
      summary,
      previousPeriodSummary,
      trends,
      byTenant,
      byProduct,
      byModel,
      revenueChange,
      profitChange,
      marginChange,
    };
  }

  async getSummary(periodStart: Date, periodEnd: Date, tenantId?: string): Promise<RevenueSummary> {
    const tenantFilter = tenantId ? 'AND tenant_id = :tenant_id' : '';
    const params = [
      stringParam('period_start', periodStart.toISOString()),
      stringParam('period_end', periodEnd.toISOString()),
    ];
    if (tenantId) {
      params.push(stringParam('tenant_id', tenantId));
    }

    // Get revenue breakdown
    const revenueResult = await executeStatement<Record<string, number>>(`
      SELECT 
        COALESCE(SUM(CASE WHEN source = 'subscription' THEN amount ELSE 0 END), 0) as subscription_revenue,
        COALESCE(SUM(CASE WHEN source = 'credit_purchase' THEN amount ELSE 0 END), 0) as credit_purchase_revenue,
        COALESCE(SUM(CASE WHEN source = 'ai_markup_external' THEN amount ELSE 0 END), 0) as ai_markup_external_revenue,
        COALESCE(SUM(CASE WHEN source = 'ai_markup_self_hosted' THEN amount ELSE 0 END), 0) as ai_markup_self_hosted_revenue,
        COALESCE(SUM(CASE WHEN source = 'overage' THEN amount ELSE 0 END), 0) as overage_revenue,
        COALESCE(SUM(CASE WHEN source = 'storage' THEN amount ELSE 0 END), 0) as storage_revenue,
        COALESCE(SUM(CASE WHEN source = 'other' THEN amount ELSE 0 END), 0) as other_revenue,
        COALESCE(SUM(amount), 0) as total_gross_revenue
      FROM revenue_entries
      WHERE period_start >= :period_start AND period_end <= :period_end ${tenantFilter}
    `, params);

    // Get cost breakdown
    const costResult = await executeStatement<Record<string, number>>(`
      SELECT 
        COALESCE(SUM(CASE WHEN category = 'aws_compute' THEN amount ELSE 0 END), 0) as aws_compute_cost,
        COALESCE(SUM(CASE WHEN category = 'aws_storage' THEN amount ELSE 0 END), 0) as aws_storage_cost,
        COALESCE(SUM(CASE WHEN category = 'aws_network' THEN amount ELSE 0 END), 0) as aws_network_cost,
        COALESCE(SUM(CASE WHEN category = 'aws_database' THEN amount ELSE 0 END), 0) as aws_database_cost,
        COALESCE(SUM(CASE WHEN category = 'external_ai' THEN amount ELSE 0 END), 0) as external_ai_cost,
        COALESCE(SUM(CASE WHEN category = 'infrastructure' THEN amount ELSE 0 END), 0) as infrastructure_cost,
        COALESCE(SUM(CASE WHEN category = 'platform_fees' THEN amount ELSE 0 END), 0) as platform_fees_cost,
        COALESCE(SUM(amount), 0) as total_cost
      FROM cost_entries
      WHERE period_start >= :period_start AND period_end <= :period_end 
        ${tenantId ? 'AND (tenant_id = :tenant_id OR tenant_id IS NULL)' : ''}
    `, params);

    const revenue = revenueResult.rows[0] || {};
    const costs = costResult.rows[0] || {};

    const totalGrossRevenue = Number(revenue.total_gross_revenue) || 0;
    const totalCost = Number(costs.total_cost) || 0;
    const grossProfit = totalGrossRevenue - totalCost;
    const grossMargin = totalGrossRevenue > 0 ? (grossProfit / totalGrossRevenue) * 100 : 0;

    return {
      periodStart,
      periodEnd,
      period: 'day',
      subscriptionRevenue: Number(revenue.subscription_revenue) || 0,
      creditPurchaseRevenue: Number(revenue.credit_purchase_revenue) || 0,
      aiMarkupExternalRevenue: Number(revenue.ai_markup_external_revenue) || 0,
      aiMarkupSelfHostedRevenue: Number(revenue.ai_markup_self_hosted_revenue) || 0,
      overageRevenue: Number(revenue.overage_revenue) || 0,
      storageRevenue: Number(revenue.storage_revenue) || 0,
      otherRevenue: Number(revenue.other_revenue) || 0,
      totalGrossRevenue,
      awsComputeCost: Number(costs.aws_compute_cost) || 0,
      awsStorageCost: Number(costs.aws_storage_cost) || 0,
      awsNetworkCost: Number(costs.aws_network_cost) || 0,
      awsDatabaseCost: Number(costs.aws_database_cost) || 0,
      externalAiCost: Number(costs.external_ai_cost) || 0,
      infrastructureCost: Number(costs.infrastructure_cost) || 0,
      platformFeesCost: Number(costs.platform_fees_cost) || 0,
      totalCost,
      grossProfit,
      grossMargin,
    };
  }

  async getTrends(periodStart: Date, periodEnd: Date, tenantId?: string): Promise<RevenueTrend[]> {
    const tenantFilter = tenantId ? 'AND (tenant_id = :tenant_id OR tenant_id IS NULL)' : '';
    const params = [
      stringParam('period_start', periodStart.toISOString().split('T')[0]),
      stringParam('period_end', periodEnd.toISOString().split('T')[0]),
    ];
    if (tenantId) {
      params.push(stringParam('tenant_id', tenantId));
    }

    const result = await executeStatement<Record<string, unknown>>(`
      SELECT 
        aggregate_date as date,
        total_gross_revenue as gross_revenue,
        total_cost,
        gross_profit,
        subscription_revenue,
        (ai_markup_external_revenue + ai_markup_self_hosted_revenue + overage_revenue + storage_revenue) as usage_revenue
      FROM revenue_daily_aggregates
      WHERE aggregate_date >= :period_start AND aggregate_date <= :period_end ${tenantFilter}
      ORDER BY aggregate_date ASC
    `, params);

    return result.rows.map(row => ({
      date: String(row.date),
      grossRevenue: Number(row.gross_revenue) || 0,
      totalCost: Number(row.total_cost) || 0,
      grossProfit: Number(row.gross_profit) || 0,
      subscriptionRevenue: Number(row.subscription_revenue) || 0,
      usageRevenue: Number(row.usage_revenue) || 0,
    }));
  }

  async getRevenueByTenant(periodStart: Date, periodEnd: Date): Promise<RevenueByTenant[]> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT 
        r.tenant_id,
        t.name as tenant_name,
        SUM(CASE WHEN r.source = 'subscription' THEN r.amount ELSE 0 END) as subscription_revenue,
        SUM(CASE WHEN r.source != 'subscription' THEN r.amount ELSE 0 END) as usage_revenue,
        SUM(r.amount) as total_revenue
      FROM revenue_entries r
      LEFT JOIN tenants t ON r.tenant_id = t.id
      WHERE r.period_start >= :period_start AND r.period_end <= :period_end
      GROUP BY r.tenant_id, t.name
      ORDER BY total_revenue DESC
      LIMIT 50
    `, [
      stringParam('period_start', periodStart.toISOString()),
      stringParam('period_end', periodEnd.toISOString()),
    ]);

    return result.rows.map(row => ({
      tenantId: String(row.tenant_id),
      tenantName: String(row.tenant_name || 'Unknown'),
      subscriptionRevenue: Number(row.subscription_revenue) || 0,
      usageRevenue: Number(row.usage_revenue) || 0,
      totalRevenue: Number(row.total_revenue) || 0,
      associatedCost: 0, // Would need tenant-specific cost tracking
      profit: Number(row.total_revenue) || 0,
      margin: 100,
    }));
  }

  async getRevenueByProduct(periodStart: Date, periodEnd: Date): Promise<RevenueByProduct[]> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT 
        product,
        SUM(CASE WHEN source = 'subscription' THEN amount ELSE 0 END) as subscription_revenue,
        SUM(CASE WHEN source != 'subscription' THEN amount ELSE 0 END) as usage_revenue,
        SUM(amount) as total_revenue
      FROM revenue_entries
      WHERE period_start >= :period_start AND period_end <= :period_end
      GROUP BY product
    `, [
      stringParam('period_start', periodStart.toISOString()),
      stringParam('period_end', periodEnd.toISOString()),
    ]);

    return result.rows.map(row => ({
      product: (row.product as 'radiant' | 'think_tank' | 'combined') || 'combined',
      subscriptionRevenue: Number(row.subscription_revenue) || 0,
      usageRevenue: Number(row.usage_revenue) || 0,
      totalRevenue: Number(row.total_revenue) || 0,
      associatedCost: 0,
      profit: Number(row.total_revenue) || 0,
      margin: 100,
    }));
  }

  async getRevenueByModel(periodStart: Date, periodEnd: Date): Promise<RevenueByModel[]> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT 
        model_id,
        model_name,
        hosting_type,
        SUM(provider_cost) as provider_cost,
        SUM(customer_charge) as customer_charge,
        SUM(markup) as markup,
        AVG(markup_percent) as markup_percent,
        SUM(request_count) as request_count
      FROM model_revenue_tracking
      WHERE tracking_date >= :period_start AND tracking_date <= :period_end
      GROUP BY model_id, model_name, hosting_type
      ORDER BY customer_charge DESC
      LIMIT 50
    `, [
      stringParam('period_start', periodStart.toISOString().split('T')[0]),
      stringParam('period_end', periodEnd.toISOString().split('T')[0]),
    ]);

    return result.rows.map(row => ({
      modelId: String(row.model_id),
      modelName: String(row.model_name || row.model_id),
      hostingType: (row.hosting_type as 'external' | 'self_hosted') || 'external',
      providerCost: Number(row.provider_cost) || 0,
      customerCharge: Number(row.customer_charge) || 0,
      markup: Number(row.markup) || 0,
      markupPercent: Number(row.markup_percent) || 0,
      requestCount: Number(row.request_count) || 0,
    }));
  }

  // ============================================================================
  // Export Functions
  // ============================================================================

  async exportRevenue(
    format: ExportFormat,
    periodStart: Date,
    periodEnd: Date,
    includeDetails: boolean,
    tenantId?: string,
    exportedBy: string = 'system'
  ): Promise<RevenueExportResponse> {
    let data: string;
    let filename: string;
    let mimeType: string;
    let recordCount: number;

    switch (format) {
      case 'csv':
        ({ data, recordCount } = await this.exportToCsv(periodStart, periodEnd, includeDetails, tenantId));
        filename = `revenue_${periodStart.toISOString().split('T')[0]}_${periodEnd.toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
        break;
      case 'json':
        ({ data, recordCount } = await this.exportToJson(periodStart, periodEnd, includeDetails, tenantId));
        filename = `revenue_${periodStart.toISOString().split('T')[0]}_${periodEnd.toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
        break;
      case 'quickbooks_iif':
        ({ data, recordCount } = await this.exportToQuickBooksIIF(periodStart, periodEnd, tenantId));
        filename = `revenue_${periodStart.toISOString().split('T')[0]}_${periodEnd.toISOString().split('T')[0]}.iif`;
        mimeType = 'text/plain';
        break;
      case 'xero_csv':
        ({ data, recordCount } = await this.exportToXeroCsv(periodStart, periodEnd, tenantId));
        filename = `revenue_xero_${periodStart.toISOString().split('T')[0]}_${periodEnd.toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
        break;
      case 'sage_csv':
        ({ data, recordCount } = await this.exportToSageCsv(periodStart, periodEnd, tenantId));
        filename = `revenue_sage_${periodStart.toISOString().split('T')[0]}_${periodEnd.toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    // Log export
    await this.logExport(format, periodStart, periodEnd, recordCount, exportedBy, tenantId);

    return {
      filename,
      mimeType,
      data: Buffer.from(data).toString('base64'),
      recordCount,
      periodStart,
      periodEnd,
    };
  }

  private async exportToCsv(
    periodStart: Date,
    periodEnd: Date,
    includeDetails: boolean,
    tenantId?: string
  ): Promise<{ data: string; recordCount: number }> {
    if (includeDetails) {
      const entries = await this.getRevenueEntries(periodStart, periodEnd, tenantId);
      const headers = ['Date', 'Source', 'Amount', 'Currency', 'Description', 'Tenant', 'Product', 'Reference'];
      const rows = entries.map(e => [
        e.periodStart.toISOString().split('T')[0],
        e.source,
        e.amount.toFixed(4),
        e.currency,
        `"${(e.description || '').replace(/"/g, '""')}"`,
        e.tenantId,
        e.referenceType || '',
        e.referenceId || '',
      ]);
      return {
        data: [headers.join(','), ...rows.map(r => r.join(','))].join('\n'),
        recordCount: entries.length,
      };
    } else {
      const summary = await this.getSummary(periodStart, periodEnd, tenantId);
      const rows = [
        ['Period Start', periodStart.toISOString().split('T')[0]],
        ['Period End', periodEnd.toISOString().split('T')[0]],
        ['', ''],
        ['REVENUE', ''],
        ['Subscription Revenue', summary.subscriptionRevenue.toFixed(2)],
        ['Credit Purchase Revenue', summary.creditPurchaseRevenue.toFixed(2)],
        ['AI Markup (External)', summary.aiMarkupExternalRevenue.toFixed(2)],
        ['AI Markup (Self-Hosted)', summary.aiMarkupSelfHostedRevenue.toFixed(2)],
        ['Overage Revenue', summary.overageRevenue.toFixed(2)],
        ['Storage Revenue', summary.storageRevenue.toFixed(2)],
        ['Other Revenue', summary.otherRevenue.toFixed(2)],
        ['TOTAL GROSS REVENUE', summary.totalGrossRevenue.toFixed(2)],
        ['', ''],
        ['COSTS (COGS)', ''],
        ['AWS Compute', summary.awsComputeCost.toFixed(2)],
        ['AWS Storage', summary.awsStorageCost.toFixed(2)],
        ['AWS Network', summary.awsNetworkCost.toFixed(2)],
        ['AWS Database', summary.awsDatabaseCost.toFixed(2)],
        ['External AI Providers', summary.externalAiCost.toFixed(2)],
        ['Infrastructure', summary.infrastructureCost.toFixed(2)],
        ['Platform Fees', summary.platformFeesCost.toFixed(2)],
        ['TOTAL COST', summary.totalCost.toFixed(2)],
        ['', ''],
        ['GROSS PROFIT', summary.grossProfit.toFixed(2)],
        ['GROSS MARGIN', `${summary.grossMargin.toFixed(1)}%`],
      ];
      return {
        data: rows.map(r => r.join(',')).join('\n'),
        recordCount: 1,
      };
    }
  }

  private async exportToJson(
    periodStart: Date,
    periodEnd: Date,
    includeDetails: boolean,
    tenantId?: string
  ): Promise<{ data: string; recordCount: number }> {
    const summary = await this.getSummary(periodStart, periodEnd, tenantId);
    let entries: RevenueEntry[] = [];
    
    if (includeDetails) {
      entries = await this.getRevenueEntries(periodStart, periodEnd, tenantId);
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      summary,
      ...(includeDetails && { entries }),
    };

    return {
      data: JSON.stringify(exportData, null, 2),
      recordCount: includeDetails ? entries.length : 1,
    };
  }

  private async exportToQuickBooksIIF(
    periodStart: Date,
    periodEnd: Date,
    tenantId?: string
  ): Promise<{ data: string; recordCount: number }> {
    const summary = await this.getSummary(periodStart, periodEnd, tenantId);
    const dateStr = periodEnd.toLocaleDateString('en-US'); // MM/DD/YYYY

    // IIF format header
    const lines: string[] = [
      '!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\tCLASS',
      '!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\tCLASS',
      '!ENDTRNS',
    ];

    // Revenue entries
    const revenueItems = [
      { account: 'Subscription Revenue', amount: summary.subscriptionRevenue, class: 'Subscriptions' },
      { account: 'Credit Sales Revenue', amount: summary.creditPurchaseRevenue, class: 'Credits' },
      { account: 'AI Markup Revenue - External', amount: summary.aiMarkupExternalRevenue, class: 'AI Usage' },
      { account: 'AI Markup Revenue - Self Hosted', amount: summary.aiMarkupSelfHostedRevenue, class: 'AI Usage' },
      { account: 'Overage Revenue', amount: summary.overageRevenue, class: 'Overages' },
      { account: 'Storage Revenue', amount: summary.storageRevenue, class: 'Storage' },
      { account: 'Other Revenue', amount: summary.otherRevenue, class: 'Other' },
    ];

    let recordCount = 0;
    for (const item of revenueItems) {
      if (item.amount > 0) {
        lines.push(`TRNS\tGENERAL JOURNAL\t${dateStr}\t${item.account}\t\t${item.amount.toFixed(2)}\tRevenue for period\t${item.class}`);
        lines.push(`SPL\tGENERAL JOURNAL\t${dateStr}\tAccounts Receivable\t\t${(-item.amount).toFixed(2)}\t\t${item.class}`);
        lines.push('ENDTRNS');
        recordCount++;
      }
    }

    // Cost entries
    const costItems = [
      { account: 'AWS Compute Expense', amount: summary.awsComputeCost },
      { account: 'AWS Storage Expense', amount: summary.awsStorageCost },
      { account: 'AWS Network Expense', amount: summary.awsNetworkCost },
      { account: 'AWS Database Expense', amount: summary.awsDatabaseCost },
      { account: 'External AI Provider Expense', amount: summary.externalAiCost },
      { account: 'Infrastructure Expense', amount: summary.infrastructureCost },
      { account: 'Platform Fees Expense', amount: summary.platformFeesCost },
    ];

    for (const item of costItems) {
      if (item.amount > 0) {
        lines.push(`TRNS\tGENERAL JOURNAL\t${dateStr}\t${item.account}\t\t${item.amount.toFixed(2)}\tCOGS for period\tCOGS`);
        lines.push(`SPL\tGENERAL JOURNAL\t${dateStr}\tAccounts Payable\t\t${(-item.amount).toFixed(2)}\t\tCOGS`);
        lines.push('ENDTRNS');
        recordCount++;
      }
    }

    return { data: lines.join('\n'), recordCount };
  }

  private async exportToXeroCsv(
    periodStart: Date,
    periodEnd: Date,
    tenantId?: string
  ): Promise<{ data: string; recordCount: number }> {
    const summary = await this.getSummary(periodStart, periodEnd, tenantId);
    const dateStr = periodEnd.toISOString().split('T')[0];

    const headers = ['*ContactName', '*InvoiceNumber', '*InvoiceDate', '*DueDate', 'Description', '*Quantity', '*UnitAmount', '*AccountCode', 'TaxType'];
    const rows: string[][] = [headers];

    let invoiceNum = 1;
    const revenueItems = [
      { desc: 'Subscription Revenue', amount: summary.subscriptionRevenue, account: '4000' },
      { desc: 'Credit Purchase Revenue', amount: summary.creditPurchaseRevenue, account: '4010' },
      { desc: 'AI Markup Revenue', amount: summary.aiMarkupExternalRevenue + summary.aiMarkupSelfHostedRevenue, account: '4020' },
      { desc: 'Other Revenue', amount: summary.overageRevenue + summary.storageRevenue + summary.otherRevenue, account: '4030' },
    ];

    for (const item of revenueItems) {
      if (item.amount > 0) {
        rows.push([
          'Platform Revenue',
          `REV-${dateStr}-${invoiceNum++}`,
          dateStr,
          dateStr,
          item.desc,
          '1',
          item.amount.toFixed(2),
          item.account,
          'Tax Exempt',
        ]);
      }
    }

    return {
      data: rows.map(r => r.join(',')).join('\n'),
      recordCount: rows.length - 1,
    };
  }

  private async exportToSageCsv(
    periodStart: Date,
    periodEnd: Date,
    tenantId?: string
  ): Promise<{ data: string; recordCount: number }> {
    const summary = await this.getSummary(periodStart, periodEnd, tenantId);
    const dateStr = periodEnd.toISOString().split('T')[0];

    const headers = ['Type', 'Date', 'Nominal', 'Reference', 'Details', 'Net Amount', 'Tax Code', 'Tax Amount'];
    const rows: string[][] = [headers];

    const items = [
      { nominal: '4000', desc: 'Subscription Revenue', amount: summary.subscriptionRevenue },
      { nominal: '4010', desc: 'Credit Revenue', amount: summary.creditPurchaseRevenue },
      { nominal: '4020', desc: 'AI Usage Revenue', amount: summary.aiMarkupExternalRevenue + summary.aiMarkupSelfHostedRevenue },
      { nominal: '5000', desc: 'AWS Compute', amount: -summary.awsComputeCost },
      { nominal: '5010', desc: 'AWS Storage', amount: -summary.awsStorageCost },
      { nominal: '5020', desc: 'External AI', amount: -summary.externalAiCost },
    ];

    for (const item of items) {
      if (Math.abs(item.amount) > 0) {
        rows.push([
          'JC',
          dateStr,
          item.nominal,
          `RADIANT-${dateStr}`,
          item.desc,
          item.amount.toFixed(2),
          'T0',
          '0.00',
        ]);
      }
    }

    return {
      data: rows.map(r => r.join(',')).join('\n'),
      recordCount: rows.length - 1,
    };
  }

  // ============================================================================
  // Data Access
  // ============================================================================

  private async getRevenueEntries(
    periodStart: Date,
    periodEnd: Date,
    tenantId?: string
  ): Promise<RevenueEntry[]> {
    const tenantFilter = tenantId ? 'AND tenant_id = :tenant_id' : '';
    const params = [
      stringParam('period_start', periodStart.toISOString()),
      stringParam('period_end', periodEnd.toISOString()),
    ];
    if (tenantId) {
      params.push(stringParam('tenant_id', tenantId));
    }

    const result = await executeStatement<Record<string, unknown>>(`
      SELECT id, tenant_id, source, amount, currency, description, 
             reference_id, reference_type, metadata, period_start, period_end, created_at
      FROM revenue_entries
      WHERE period_start >= :period_start AND period_end <= :period_end ${tenantFilter}
      ORDER BY period_start DESC
    `, params);

    return result.rows.map(row => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      source: row.source as RevenueSource,
      amount: Number(row.amount),
      currency: String(row.currency),
      description: String(row.description || ''),
      referenceId: row.reference_id ? String(row.reference_id) : undefined,
      referenceType: row.reference_type ? String(row.reference_type) : undefined,
      metadata: row.metadata as Record<string, unknown>,
      periodStart: new Date(row.period_start as string),
      periodEnd: new Date(row.period_end as string),
      createdAt: new Date(row.created_at as string),
    }));
  }

  private async logExport(
    format: ExportFormat,
    periodStart: Date,
    periodEnd: Date,
    recordCount: number,
    exportedBy: string,
    tenantId?: string
  ): Promise<void> {
    try {
      await executeStatement(`
        INSERT INTO revenue_export_log (export_format, period_start, period_end, record_count, filters, exported_by)
        VALUES (:format, :period_start, :period_end, :record_count, :filters, :exported_by)
      `, [
        stringParam('format', format),
        stringParam('period_start', periodStart.toISOString().split('T')[0]),
        stringParam('period_end', periodEnd.toISOString().split('T')[0]),
        longParam('record_count', recordCount),
        stringParam('filters', JSON.stringify({ tenantId })),
        stringParam('exported_by', exportedBy),
      ]);
    } catch (error) {
      logger.error('Failed to log revenue export', { error });
    }
  }

  // ============================================================================
  // Recording Revenue
  // ============================================================================

  async recordRevenue(entry: Omit<RevenueEntry, 'id' | 'createdAt'>): Promise<string> {
    const result = await executeStatement<{ id: string }>(`
      INSERT INTO revenue_entries (
        tenant_id, source, amount, currency, description, reference_id, reference_type,
        product, model_id, provider_id, metadata, period_start, period_end
      ) VALUES (
        :tenant_id, :source, :amount, :currency, :description, :reference_id, :reference_type,
        :product, :model_id, :provider_id, :metadata, :period_start, :period_end
      ) RETURNING id
    `, [
      stringParam('tenant_id', entry.tenantId),
      stringParam('source', entry.source),
      stringParam('amount', entry.amount.toString()),
      stringParam('currency', entry.currency),
      stringParam('description', entry.description || ''),
      stringParam('reference_id', entry.referenceId || ''),
      stringParam('reference_type', entry.referenceType || ''),
      stringParam('product', 'combined'),
      stringParam('model_id', ''),
      stringParam('provider_id', ''),
      stringParam('metadata', JSON.stringify(entry.metadata || {})),
      stringParam('period_start', entry.periodStart.toISOString()),
      stringParam('period_end', entry.periodEnd.toISOString()),
    ]);

    return result.rows[0].id;
  }

  async recordCost(entry: Omit<CostEntry, 'id' | 'createdAt'>): Promise<string> {
    const result = await executeStatement<{ id: string }>(`
      INSERT INTO cost_entries (
        tenant_id, category, amount, currency, description, aws_service_name, resource_id,
        provider_id, model_id, metadata, period_start, period_end
      ) VALUES (
        :tenant_id, :category, :amount, :currency, :description, :aws_service_name, :resource_id,
        :provider_id, :model_id, :metadata, :period_start, :period_end
      ) RETURNING id
    `, [
      stringParam('tenant_id', entry.tenantId || ''),
      stringParam('category', entry.category),
      stringParam('amount', entry.amount.toString()),
      stringParam('currency', entry.currency),
      stringParam('description', entry.description || ''),
      stringParam('aws_service_name', entry.awsServiceName || ''),
      stringParam('resource_id', entry.resourceId || ''),
      stringParam('provider_id', entry.providerI || ''),
      stringParam('model_id', entry.modelId || ''),
      stringParam('metadata', JSON.stringify(entry.metadata || {})),
      stringParam('period_start', entry.periodStart.toISOString()),
      stringParam('period_end', entry.periodEnd.toISOString()),
    ]);

    return result.rows[0].id;
  }
}

export const revenueService = new RevenueService();
