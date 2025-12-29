# SaaS Metrics Dashboard

**Version**: 4.18.3  
**Last Updated**: 2024-12-28

## Overview

The SaaS Metrics Dashboard provides comprehensive visibility into key business metrics including revenue, costs, customer health, and model profitability. It integrates data from the Revenue Analytics system and Cost Analytics to present a unified view of business performance.

## Admin Dashboard Location

**Path**: Admin Dashboard → SaaS Metrics  
**URL**: `/saas-metrics`

---

## Key Metrics

### Revenue Metrics

| Metric | Description | Formula |
|--------|-------------|---------|
| **MRR** | Monthly Recurring Revenue | Sum of all monthly subscription fees |
| **ARR** | Annual Recurring Revenue | MRR × 12 |
| **Total Revenue** | All revenue in period | Subscriptions + Credits + AI Markup + Storage |
| **ARPU** | Average Revenue Per User | Total Revenue / Active Customers |
| **LTV** | Lifetime Value | ARPU × Average Customer Lifespan |

### Cost Metrics

| Metric | Description | Source |
|--------|-------------|--------|
| **Total COGS** | Cost of Goods Sold | AWS + External AI + Platform Fees |
| **Gross Profit** | Revenue - COGS | Calculated |
| **Gross Margin** | (Gross Profit / Revenue) × 100 | Percentage |
| **CAC** | Customer Acquisition Cost | Marketing + Sales / New Customers |

### Customer Metrics

| Metric | Description |
|--------|-------------|
| **Total Customers** | Active paying tenants |
| **New Customers** | Customers acquired in period |
| **Churned Customers** | Customers lost in period |
| **Churn Rate** | (Churned / Total) × 100 |
| **Net Revenue Retention** | (Starting MRR + Expansion - Churn) / Starting MRR |

### Unit Economics

| Metric | Healthy Range | Description |
|--------|---------------|-------------|
| **LTV:CAC Ratio** | > 3:1 | Lifetime value vs acquisition cost |
| **Payback Period** | < 12 months | Time to recover CAC |
| **Gross Margin** | > 50% | COGS efficiency |

---

## Dashboard Tabs

### Overview Tab
- Revenue, Cost & Profit trend chart (daily)
- Revenue by Source pie chart
- Revenue by Tier bar chart
- Cost breakdown with progress bars
- Top 5 tenants by revenue table

### Revenue Tab
- MRR movement chart (New, Expansion, Churned)
- Revenue by Product breakdown
- ARPU and LTV metrics
- Revenue growth trends

### Costs Tab
- Cost distribution pie chart
- Cost breakdown table by category
- Gross margin trends
- CAC metrics

### Customers Tab
- Customer growth trend chart
- New vs Churned visualization
- Usage metrics (requests, active users)
- Churn rate tracking

### Models Tab
- Model performance table (requests, revenue, cost, profit, margin)
- Model revenue vs cost horizontal bar chart
- Self-hosted vs External identification

---

## Charts & Visualizations

### Chart Types Used

| Chart | Purpose |
|-------|---------|
| **Area Chart** | Revenue and cost trends over time |
| **Composed Chart** | Multi-metric comparisons |
| **Bar Chart** | Revenue by tier, model comparisons |
| **Pie Chart** | Revenue/cost distribution |
| **Line Chart** | Usage trends |

### Color Palette

```typescript
const CHART_COLORS = {
  primary: '#3b82f6',    // Blue - Revenue
  secondary: '#8b5cf6',  // Purple - Secondary metrics
  success: '#22c55e',    // Green - Profit, positive
  warning: '#f59e0b',    // Amber - Warnings
  danger: '#ef4444',     // Red - Costs, negative
  info: '#06b6d4',       // Cyan - Info
};
```

---

## Export Functionality

### Available Formats

| Format | Extension | Use Case |
|--------|-----------|----------|
| **Excel (CSV)** | `.csv` | Spreadsheet analysis, Excel/Google Sheets |
| **JSON** | `.json` | Custom integrations, data processing |

### Export Contents

The export includes all metrics organized in sections:

1. **Report Header**: Period, generation timestamp
2. **Revenue Summary**: MRR, ARR, Total Revenue, Gross Profit, Margin
3. **Cost Breakdown**: By category with amounts and percentages
4. **Customer Metrics**: Totals, new, churned, churn rate
5. **Unit Economics**: ARPU, LTV, CAC, LTV:CAC ratio
6. **Revenue by Source**: Subscriptions, Credits, AI Markup, etc.
7. **Revenue by Tier**: Enterprise, Business, Pro, Starter
8. **Top Tenants**: Name, revenue, users, requests, tier
9. **Model Performance**: Per-model revenue, cost, profit, margin
10. **Daily Revenue Trend**: Date, revenue, cost, profit

### Export Example (CSV)

```csv
RADIANT SaaS Metrics Report
Period: 30d
Generated: 2024-12-28T22:57:00Z

=== REVENUE SUMMARY ===
Metric,Value,Growth
MRR,$89500.00,12.5%
ARR,$1074000.00,15.2%
Total Revenue,$89500.00,18.3%
Gross Profit,$47500.00,
Gross Margin,53.1%,

=== COST BREAKDOWN ===
Category,Amount,Percentage
External AI Providers,$18500.00,44.0%
AWS Compute,$12800.00,30.5%
...

=== MODEL PERFORMANCE ===
Model,Requests,Revenue,Cost,Profit,Margin
GPT-4o,425000,$12750.00,$8500.00,$4250.00,33.3%
Claude 3.5 Sonnet,312000,$9360.00,$6240.00,$3120.00,33.3%
```

---

## Period Selection

| Period | Description | Data Points |
|--------|-------------|-------------|
| **7d** | Last 7 days | Daily granularity |
| **30d** | Last 30 days | Daily granularity |
| **90d** | Last 90 days | Daily granularity |
| **12m** | Last 12 months | Monthly granularity |

---

## API Integration

### Data Sources

The SaaS Metrics dashboard aggregates data from:

1. **Revenue Analytics** (`/api/admin/revenue/dashboard`)
   - Revenue entries
   - Daily aggregates
   - Revenue by source

2. **Cost Analytics** (`/api/admin/cost/summary`)
   - Cost entries
   - AWS costs
   - External AI costs

3. **Billing System** (`/api/admin/billing`)
   - Subscriptions
   - Credit transactions
   - Tier information

4. **Analytics** (`/api/admin/analytics`)
   - Usage metrics
   - Model performance
   - Request counts

### API Endpoint

```
GET /api/admin/saas-metrics?period={7d|30d|90d|12m}
```

**Response:**
```json
{
  "mrr": 89500,
  "mrrGrowth": 12.5,
  "arr": 1074000,
  "totalRevenue": 89500,
  "totalCost": 42000,
  "grossProfit": 47500,
  "grossMargin": 53.1,
  "totalCustomers": 342,
  "churnRate": 2.3,
  "arpu": 261.70,
  "ltv": 3140.40,
  "cac": 450,
  "ltvCacRatio": 6.98,
  "revenueBySource": [...],
  "costByCategory": [...],
  "revenueTrend": [...],
  "topTenants": [...],
  "modelMetrics": [...]
}
```

---

## Permissions

The SaaS Metrics Dashboard requires:
- **Admin** role or higher
- Access to billing data
- Access to usage analytics

---

## Related Documentation

- [Revenue Analytics](./REVENUE-ANALYTICS.md)
- [Cost Analytics](./COST-ANALYTICS.md)
- [Billing & Credits](./BILLING-CREDITS.md)
- [Admin Guide - Revenue Analytics](./RADIANT-ADMIN-GUIDE.md#15-revenue-analytics)
