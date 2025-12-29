# Revenue Analytics System

**Version**: 4.18.3  
**Last Updated**: 2024-12-28

## Overview

The Revenue Analytics system tracks gross revenue, cost of goods sold (COGS), and gross profit across all RADIANT products. It provides visibility into subscription billing, AI provider markup, self-hosted model revenue, and associated AWS/infrastructure costs.

**Important**: This system tracks **gross revenue and COGS only**. Marketing, sales, G&A, and other operating expenses must be subtracted separately in your accounting system to calculate net profit.

---

## Admin Dashboard Location

**Path**: Admin Dashboard → Revenue Analytics  
**URL**: `/revenue`

---

## Revenue Sources

| Source | Description | Example |
|--------|-------------|---------|
| `subscription` | Monthly/annual subscription fees | Tier 3 Pro @ $99/month |
| `credit_purchase` | One-time credit purchases | 10,000 credits @ $50 |
| `ai_markup_external` | Markup on external AI provider usage | OpenAI, Anthropic, etc. (typically 20-35% markup) |
| `ai_markup_self_hosted` | Markup on self-hosted model usage | SageMaker models (typically 75% markup on AWS cost) |
| `overage` | Usage beyond subscription limits | Additional API calls beyond tier limit |
| `storage` | Storage fees | User file storage, vector embeddings |
| `other` | Miscellaneous revenue | Custom integrations, support fees |

---

## Cost Categories (COGS)

| Category | Description | AWS Services |
|----------|-------------|--------------|
| `aws_compute` | Compute infrastructure | EC2, SageMaker, Lambda |
| `aws_storage` | Storage services | S3, EBS, EFS |
| `aws_network` | Network and data transfer | Data Transfer, API Gateway, CloudFront |
| `aws_database` | Database services | Aurora PostgreSQL, DynamoDB |
| `external_ai` | External AI provider costs | OpenAI API, Anthropic API, etc. |
| `infrastructure` | Other cloud costs | Secrets Manager, CloudWatch, etc. |
| `platform_fees` | Payment processing | Stripe fees (~2.9% + $0.30) |

---

## Dashboard Features

### Summary Cards

- **Gross Revenue**: Total revenue from all sources
- **Total COGS**: Sum of all cost categories
- **Gross Profit**: Revenue minus COGS
- **Gross Margin**: (Profit / Revenue) × 100%

### Time Period Selection

| Period | Description |
|--------|-------------|
| 7d | Last 7 days |
| 30d | Last 30 days (default) |
| 90d | Last 90 days |
| YTD | Year to date |
| 12m | Last 12 months |

### Tabs

1. **Revenue Breakdown**: Revenue by source with visual progress bars
2. **Cost Breakdown**: AWS costs and external provider costs
3. **By Model**: Per-model revenue with provider cost vs customer charge
4. **By Tenant**: Top tenants by total revenue

---

## Export Formats

### Available Formats

| Format | File Extension | Use Case |
|--------|---------------|----------|
| CSV | `.csv` | Summary for spreadsheets (Excel, Google Sheets) |
| JSON | `.json` | Full details for custom integrations |
| QuickBooks IIF | `.iif` | Direct import to QuickBooks Desktop |
| Xero CSV | `.csv` | Import to Xero accounting |
| Sage CSV | `.csv` | Import to Sage accounting |

### Export Contents

**CSV Summary Export:**
```csv
Period Start,2024-12-01
Period End,2024-12-28

REVENUE,
Subscription Revenue,15000.00
Credit Purchase Revenue,2500.00
AI Markup (External),8750.00
AI Markup (Self-Hosted),3200.00
...
TOTAL GROSS REVENUE,29450.00

COSTS (COGS),
AWS Compute,4500.00
External AI Providers,7000.00
...
TOTAL COST,12500.00

GROSS PROFIT,16950.00
GROSS MARGIN,57.5%
```

**QuickBooks IIF Export:**
- Creates General Journal entries
- Revenue accounts: Subscription Revenue, Credit Sales Revenue, AI Markup Revenue
- Expense accounts: AWS Compute Expense, External AI Provider Expense
- Includes CLASS for categorization

---

## API Endpoints

### GET /api/admin/revenue/dashboard

Returns the revenue dashboard data.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| periodStart | ISO Date | Yes | Start of period |
| periodEnd | ISO Date | Yes | End of period |
| period | string | Yes | `day`, `week`, `month`, `quarter`, `year` |
| tenantId | UUID | No | Filter to specific tenant |

**Response:**
```json
{
  "summary": {
    "periodStart": "2024-12-01T00:00:00Z",
    "periodEnd": "2024-12-28T23:59:59Z",
    "subscriptionRevenue": 15000.00,
    "creditPurchaseRevenue": 2500.00,
    "aiMarkupExternalRevenue": 8750.00,
    "aiMarkupSelfHostedRevenue": 3200.00,
    "overageRevenue": 0,
    "storageRevenue": 0,
    "otherRevenue": 0,
    "totalGrossRevenue": 29450.00,
    "awsComputeCost": 4500.00,
    "awsStorageCost": 500.00,
    "awsNetworkCost": 200.00,
    "awsDatabaseCost": 800.00,
    "externalAiCost": 7000.00,
    "infrastructureCost": 300.00,
    "platformFeesCost": 850.00,
    "totalCost": 14150.00,
    "grossProfit": 15300.00,
    "grossMargin": 51.95
  },
  "previousPeriodSummary": { ... },
  "trends": [
    { "date": "2024-12-01", "grossRevenue": 1050.00, "totalCost": 450.00, ... }
  ],
  "byTenant": [
    { "tenantId": "uuid", "tenantName": "Acme Corp", "totalRevenue": 5000.00, ... }
  ],
  "byModel": [
    { "modelId": "gpt-4o", "hostingType": "external", "providerCost": 500.00, "customerCharge": 650.00, ... }
  ],
  "revenueChange": 12.5,
  "profitChange": 15.2,
  "marginChange": 2.1
}
```

### POST /api/admin/revenue/export

Exports revenue data in the specified format.

**Request Body:**
```json
{
  "format": "quickbooks_iif",
  "periodStart": "2024-12-01T00:00:00Z",
  "periodEnd": "2024-12-28T23:59:59Z",
  "includeDetails": false,
  "tenantId": null
}
```

**Response:**
```json
{
  "filename": "revenue_2024-12-01_2024-12-28.iif",
  "mimeType": "text/plain",
  "data": "base64-encoded-file-content",
  "recordCount": 14,
  "periodStart": "2024-12-01T00:00:00Z",
  "periodEnd": "2024-12-28T23:59:59Z"
}
```

---

## Database Schema

### revenue_entries

Individual revenue events.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tenant_id | UUID | FK to tenants |
| source | VARCHAR(30) | Revenue source type |
| amount | DECIMAL(15,4) | Revenue amount |
| currency | VARCHAR(3) | Currency code (default: USD) |
| description | TEXT | Description |
| reference_id | VARCHAR(255) | Related subscription/transaction ID |
| reference_type | VARCHAR(50) | Type of reference |
| product | VARCHAR(20) | `radiant`, `think_tank`, or `combined` |
| model_id | VARCHAR(100) | For AI markup revenue |
| period_start | TIMESTAMPTZ | Period this revenue applies to |
| period_end | TIMESTAMPTZ | Period end |

### cost_entries

Infrastructure and provider costs.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tenant_id | UUID | FK to tenants (NULL for shared infra) |
| category | VARCHAR(30) | Cost category |
| amount | DECIMAL(15,4) | Cost amount |
| aws_service_name | VARCHAR(100) | e.g., 'SageMaker', 'Aurora' |
| resource_id | VARCHAR(255) | AWS resource identifier |
| provider_id | VARCHAR(50) | For external AI costs |
| period_start | TIMESTAMPTZ | Period start |
| period_end | TIMESTAMPTZ | Period end |

### revenue_daily_aggregates

Pre-computed daily summaries for fast queries.

| Column | Type | Description |
|--------|------|-------------|
| aggregate_date | DATE | The date |
| tenant_id | UUID | NULL for platform totals |
| subscription_revenue | DECIMAL | Daily subscription revenue |
| ai_markup_external_revenue | DECIMAL | Daily external AI markup |
| ai_markup_self_hosted_revenue | DECIMAL | Daily self-hosted markup |
| total_gross_revenue | DECIMAL | Total for the day |
| total_cost | DECIMAL | Total COGS for the day |
| gross_profit | DECIMAL | Revenue - Cost |
| gross_margin | DECIMAL | Percentage margin |

### model_revenue_tracking

Per-model revenue breakdown for markup analysis.

| Column | Type | Description |
|--------|------|-------------|
| tracking_date | DATE | The date |
| model_id | VARCHAR(100) | Model identifier |
| hosting_type | VARCHAR(20) | `external` or `self_hosted` |
| provider_cost | DECIMAL | What we pay |
| customer_charge | DECIMAL | What customer pays |
| markup | DECIMAL | customer_charge - provider_cost |
| markup_percent | DECIMAL | Percentage markup |
| request_count | INTEGER | Number of requests |

---

## Markup Calculations

### External AI Providers

Default markup: **20-35%** on provider cost

```
Customer Price = Provider Cost × (1 + Markup Rate)
Markup Revenue = Customer Price - Provider Cost
```

### Self-Hosted Models

Default markup: **75%** on AWS SageMaker cost

```
Hourly Customer Rate = AWS Hourly Cost × 1.75
Per-Request Rate = AWS Cost + (AWS Cost × 0.75)
```

---

## Accounting Integration Notes

### QuickBooks
- Import the `.iif` file via File → Utilities → Import → IIF Files
- Creates General Journal entries with appropriate accounts
- Requires accounts to exist: Subscription Revenue, AWS Compute Expense, etc.

### Xero
- Import via Invoices → Import
- Maps to account codes (4000-series for revenue, 5000-series for expenses)

### Sage
- Import via Transactions → Import
- Uses nominal codes matching Sage's structure

---

## Permissions

Revenue Analytics is visible only to:
- **Platform Admins**: Full access to all tenant data
- **Tenant Admins**: Access to their tenant's revenue only (filtered view)

---

## Related Documentation

- [Billing & Credits](./BILLING-CREDITS.md)
- [Cost Analytics](./COST-ANALYTICS.md)
- [Model Pricing](./sections/SECTION-31-MODEL-SELECTION-PRICING.md)
- [Unified Model Registry](./sections/SECTION-36-UNIFIED-MODEL-REGISTRY.md)
