/**
 * RADIANT v5.12.5 - Report Generator Service
 * 
 * Generates reports in multiple formats (PDF, Excel, CSV, JSON)
 * with data from various sources (usage, cost, security, etc.)
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';
import PDFDocument from 'pdfkit';
import { executeStatement, stringParam, longParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface ReportConfig {
  id: string;
  tenant_id: string;
  name: string;
  report_type: 'usage' | 'cost' | 'security' | 'performance' | 'compliance' | 'code_quality' | 'custom';
  format: 'pdf' | 'csv' | 'json' | 'excel';
  parameters: ReportParameters;
  recipients: string[];
  template_id?: string;
}

export interface ReportParameters {
  date_range?: {
    start: string;
    end: string;
  };
  group_by?: string[];
  filters?: Record<string, unknown>;
  include_charts?: boolean;
  include_summary?: boolean;
}

export interface ReportData {
  title: string;
  subtitle?: string;
  generated_at: string;
  date_range?: { start: string; end: string };
  summary?: Record<string, unknown>;
  sections: ReportSection[];
  metadata: Record<string, unknown>;
}

export interface ReportSection {
  title: string;
  type: 'table' | 'chart' | 'text' | 'metric';
  data: unknown;
  columns?: { key: string; label: string; format?: string }[];
}

export interface GenerationResult {
  success: boolean;
  execution_id: string;
  s3_key?: string;
  s3_bucket?: string;
  size_bytes?: number;
  checksum?: string;
  download_url?: string;
  error?: string;
}

// ============================================================================
// Report Generator Service
// ============================================================================

class ReportGeneratorService {
  private s3Client: S3Client;
  private bucket: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.bucket = process.env.RADIANT_REPORTS_BUCKET || 'radiant-reports';
  }

  /**
   * Generate a report and store in S3
   */
  async generateReport(config: ReportConfig, executionId: string): Promise<GenerationResult> {
    const startTime = Date.now();

    try {
      // Update execution status to running
      await this.updateExecutionStatus(executionId, 'running');

      // Fetch report data based on type
      const data = await this.fetchReportData(config);

      // Generate output in requested format
      const output = await this.formatReport(data, config.format);

      // Calculate checksum
      const checksum = createHash('sha256').update(output).digest('hex');

      // Upload to S3
      const s3Key = this.generateS3Key(config);
      await this.uploadToS3(s3Key, output, config.format);

      // Generate download URL
      const downloadUrl = await this.getDownloadUrl(s3Key);

      // Update execution with success
      await this.updateExecutionSuccess(executionId, {
        s3_key: s3Key,
        s3_bucket: this.bucket,
        size_bytes: output.length,
        checksum,
        duration_ms: Date.now() - startTime,
      });

      logger.info('Report generated successfully', {
        reportId: config.id,
        executionId,
        format: config.format,
        sizeBytes: output.length,
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        execution_id: executionId,
        s3_key: s3Key,
        s3_bucket: this.bucket,
        size_bytes: output.length,
        checksum,
        download_url: downloadUrl,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.updateExecutionFailure(executionId, errorMessage);

      logger.error('Report generation failed', {
        reportId: config.id,
        executionId,
        error: errorMessage,
      });

      return {
        success: false,
        execution_id: executionId,
        error: errorMessage,
      };
    }
  }

  /**
   * Fetch data for report based on type
   */
  private async fetchReportData(config: ReportConfig): Promise<ReportData> {
    const dateRange = config.parameters.date_range || this.getDefaultDateRange();

    switch (config.report_type) {
      case 'usage':
        return this.fetchUsageData(config.tenant_id, dateRange, config.parameters);
      case 'cost':
        return this.fetchCostData(config.tenant_id, dateRange, config.parameters);
      case 'security':
        return this.fetchSecurityData(config.tenant_id, dateRange, config.parameters);
      case 'performance':
        return this.fetchPerformanceData(config.tenant_id, dateRange, config.parameters);
      case 'compliance':
        return this.fetchComplianceData(config.tenant_id, dateRange, config.parameters);
      case 'code_quality':
        return this.fetchCodeQualityData(config.tenant_id, dateRange, config.parameters);
      default:
        return this.fetchCustomData(config.tenant_id, dateRange, config.parameters);
    }
  }

  /**
   * Fetch usage report data
   */
  private async fetchUsageData(
    tenantId: string,
    dateRange: { start: string; end: string },
    params: ReportParameters
  ): Promise<ReportData> {
    // Fetch API usage stats
    const usageResult = await executeStatement(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as api_calls,
        SUM(tokens_input + tokens_output) as total_tokens,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT session_id) as sessions
      FROM api_usage_logs
      WHERE tenant_id = $1
      AND created_at BETWEEN $2 AND $3
      GROUP BY DATE(created_at)
      ORDER BY date`,
      [
        stringParam('tenantId', tenantId),
        stringParam('startDate', dateRange.start),
        stringParam('endDate', dateRange.end),
      ]
    );

    // Fetch model breakdown
    const modelResult = await executeStatement(
      `SELECT 
        model_id,
        COUNT(*) as requests,
        SUM(tokens_input + tokens_output) as tokens
      FROM api_usage_logs
      WHERE tenant_id = $1
      AND created_at BETWEEN $2 AND $3
      GROUP BY model_id
      ORDER BY requests DESC
      LIMIT 10`,
      [
        stringParam('tenantId', tenantId),
        stringParam('startDate', dateRange.start),
        stringParam('endDate', dateRange.end),
      ]
    );

    // Calculate summary
    const dailyData = (usageResult.rows || []) as Array<{
      date: string;
      api_calls: string;
      total_tokens: string;
      unique_users: string;
      sessions: string;
    }>;

    const totalCalls = dailyData.reduce((sum, d) => sum + parseInt(d.api_calls, 10), 0);
    const totalTokens = dailyData.reduce((sum, d) => sum + parseInt(d.total_tokens || '0', 10), 0);
    const avgDailyUsers = dailyData.length > 0
      ? dailyData.reduce((sum, d) => sum + parseInt(d.unique_users, 10), 0) / dailyData.length
      : 0;

    return {
      title: 'Usage Summary Report',
      subtitle: `${dateRange.start} to ${dateRange.end}`,
      generated_at: new Date().toISOString(),
      date_range: dateRange,
      summary: {
        total_api_calls: totalCalls,
        total_tokens: totalTokens,
        average_daily_users: Math.round(avgDailyUsers),
        reporting_days: dailyData.length,
      },
      sections: [
        {
          title: 'Daily Usage',
          type: 'table',
          columns: [
            { key: 'date', label: 'Date', format: 'date' },
            { key: 'api_calls', label: 'API Calls', format: 'number' },
            { key: 'total_tokens', label: 'Tokens', format: 'number' },
            { key: 'unique_users', label: 'Users', format: 'number' },
            { key: 'sessions', label: 'Sessions', format: 'number' },
          ],
          data: dailyData,
        },
        {
          title: 'Usage by Model',
          type: 'table',
          columns: [
            { key: 'model_id', label: 'Model' },
            { key: 'requests', label: 'Requests', format: 'number' },
            { key: 'tokens', label: 'Tokens', format: 'number' },
          ],
          data: modelResult.rows || [],
        },
      ],
      metadata: {
        tenant_id: tenantId,
        report_type: 'usage',
        parameters: params,
      },
    };
  }

  /**
   * Fetch cost report data
   */
  private async fetchCostData(
    tenantId: string,
    dateRange: { start: string; end: string },
    params: ReportParameters
  ): Promise<ReportData> {
    // Fetch daily costs
    const costResult = await executeStatement(
      `SELECT 
        DATE(created_at) as date,
        SUM(cost_cents) / 100.0 as cost_usd,
        SUM(tokens_input) as input_tokens,
        SUM(tokens_output) as output_tokens
      FROM api_usage_logs
      WHERE tenant_id = $1
      AND created_at BETWEEN $2 AND $3
      GROUP BY DATE(created_at)
      ORDER BY date`,
      [
        stringParam('tenantId', tenantId),
        stringParam('startDate', dateRange.start),
        stringParam('endDate', dateRange.end),
      ]
    );

    // Fetch cost by model
    const modelCostResult = await executeStatement(
      `SELECT 
        model_id,
        SUM(cost_cents) / 100.0 as cost_usd,
        COUNT(*) as requests
      FROM api_usage_logs
      WHERE tenant_id = $1
      AND created_at BETWEEN $2 AND $3
      GROUP BY model_id
      ORDER BY cost_usd DESC`,
      [
        stringParam('tenantId', tenantId),
        stringParam('startDate', dateRange.start),
        stringParam('endDate', dateRange.end),
      ]
    );

    const dailyData = (costResult.rows || []) as Array<{ date: string; cost_usd: string }>;
    const totalCost = dailyData.reduce((sum, d) => sum + parseFloat(d.cost_usd || '0'), 0);

    return {
      title: 'Cost Breakdown Report',
      subtitle: `${dateRange.start} to ${dateRange.end}`,
      generated_at: new Date().toISOString(),
      date_range: dateRange,
      summary: {
        total_cost_usd: totalCost.toFixed(2),
        average_daily_cost: (totalCost / Math.max(dailyData.length, 1)).toFixed(2),
        reporting_days: dailyData.length,
      },
      sections: [
        {
          title: 'Daily Cost',
          type: 'table',
          columns: [
            { key: 'date', label: 'Date', format: 'date' },
            { key: 'cost_usd', label: 'Cost (USD)', format: 'currency' },
            { key: 'input_tokens', label: 'Input Tokens', format: 'number' },
            { key: 'output_tokens', label: 'Output Tokens', format: 'number' },
          ],
          data: dailyData,
        },
        {
          title: 'Cost by Model',
          type: 'table',
          columns: [
            { key: 'model_id', label: 'Model' },
            { key: 'cost_usd', label: 'Cost (USD)', format: 'currency' },
            { key: 'requests', label: 'Requests', format: 'number' },
          ],
          data: modelCostResult.rows || [],
        },
      ],
      metadata: {
        tenant_id: tenantId,
        report_type: 'cost',
        parameters: params,
      },
    };
  }

  /**
   * Fetch security report data
   */
  private async fetchSecurityData(
    tenantId: string,
    dateRange: { start: string; end: string },
    params: ReportParameters
  ): Promise<ReportData> {
    // Fetch login attempts
    const loginResult = await executeStatement(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE success = true) as successful,
        COUNT(*) FILTER (WHERE success = false) as failed
      FROM auth_events
      WHERE tenant_id = $1
      AND created_at BETWEEN $2 AND $3
      GROUP BY DATE(created_at)
      ORDER BY date`,
      [
        stringParam('tenantId', tenantId),
        stringParam('startDate', dateRange.start),
        stringParam('endDate', dateRange.end),
      ]
    );

    // Fetch anomalies
    const anomalyResult = await executeStatement(
      `SELECT 
        anomaly_type,
        severity,
        COUNT(*) as count
      FROM security_anomalies
      WHERE tenant_id = $1
      AND detected_at BETWEEN $2 AND $3
      GROUP BY anomaly_type, severity
      ORDER BY count DESC`,
      [
        stringParam('tenantId', tenantId),
        stringParam('startDate', dateRange.start),
        stringParam('endDate', dateRange.end),
      ]
    );

    const loginData = (loginResult.rows || []) as Array<{ date: string; successful: string; failed: string }>;
    const totalFailed = loginData.reduce((sum, d) => sum + parseInt(d.failed || '0', 10), 0);

    return {
      title: 'Security Audit Report',
      subtitle: `${dateRange.start} to ${dateRange.end}`,
      generated_at: new Date().toISOString(),
      date_range: dateRange,
      summary: {
        failed_logins: totalFailed,
        anomalies_detected: (anomalyResult.rows || []).length,
        security_score: totalFailed < 10 ? 'Good' : totalFailed < 50 ? 'Fair' : 'Needs Attention',
      },
      sections: [
        {
          title: 'Login Activity',
          type: 'table',
          columns: [
            { key: 'date', label: 'Date', format: 'date' },
            { key: 'successful', label: 'Successful', format: 'number' },
            { key: 'failed', label: 'Failed', format: 'number' },
          ],
          data: loginData,
        },
        {
          title: 'Security Anomalies',
          type: 'table',
          columns: [
            { key: 'anomaly_type', label: 'Type' },
            { key: 'severity', label: 'Severity' },
            { key: 'count', label: 'Count', format: 'number' },
          ],
          data: anomalyResult.rows || [],
        },
      ],
      metadata: {
        tenant_id: tenantId,
        report_type: 'security',
        parameters: params,
      },
    };
  }

  /**
   * Fetch performance report data
   */
  private async fetchPerformanceData(
    tenantId: string,
    dateRange: { start: string; end: string },
    params: ReportParameters
  ): Promise<ReportData> {
    // Fetch latency metrics
    const latencyResult = await executeStatement(
      `SELECT 
        DATE(created_at) as date,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms) as p50,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99,
        AVG(latency_ms) as avg_latency,
        COUNT(*) as requests
      FROM api_usage_logs
      WHERE tenant_id = $1
      AND created_at BETWEEN $2 AND $3
      GROUP BY DATE(created_at)
      ORDER BY date`,
      [
        stringParam('tenantId', tenantId),
        stringParam('startDate', dateRange.start),
        stringParam('endDate', dateRange.end),
      ]
    );

    // Fetch error rates
    const errorResult = await executeStatement(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status_code >= 400) as errors
      FROM api_usage_logs
      WHERE tenant_id = $1
      AND created_at BETWEEN $2 AND $3
      GROUP BY DATE(created_at)
      ORDER BY date`,
      [
        stringParam('tenantId', tenantId),
        stringParam('startDate', dateRange.start),
        stringParam('endDate', dateRange.end),
      ]
    );

    const latencyData = (latencyResult.rows || []) as Array<{ 
      date: string; p50: string; p95: string; p99: string; avg_latency: string; requests: string 
    }>;
    const avgP50 = latencyData.length > 0
      ? latencyData.reduce((sum, d) => sum + parseFloat(d.p50 || '0'), 0) / latencyData.length
      : 0;

    return {
      title: 'Performance Metrics Report',
      subtitle: `${dateRange.start} to ${dateRange.end}`,
      generated_at: new Date().toISOString(),
      date_range: dateRange,
      summary: {
        average_p50_latency_ms: Math.round(avgP50),
        total_requests: latencyData.reduce((sum, d) => sum + parseInt(d.requests, 10), 0),
        uptime_percent: '99.9', // Would calculate from health checks
      },
      sections: [
        {
          title: 'Latency Metrics',
          type: 'table',
          columns: [
            { key: 'date', label: 'Date', format: 'date' },
            { key: 'p50', label: 'P50 (ms)', format: 'number' },
            { key: 'p95', label: 'P95 (ms)', format: 'number' },
            { key: 'p99', label: 'P99 (ms)', format: 'number' },
            { key: 'requests', label: 'Requests', format: 'number' },
          ],
          data: latencyData,
        },
        {
          title: 'Error Rates',
          type: 'table',
          columns: [
            { key: 'date', label: 'Date', format: 'date' },
            { key: 'total', label: 'Total', format: 'number' },
            { key: 'errors', label: 'Errors', format: 'number' },
          ],
          data: errorResult.rows || [],
        },
      ],
      metadata: {
        tenant_id: tenantId,
        report_type: 'performance',
        parameters: params,
      },
    };
  }

  /**
   * Fetch compliance report data
   */
  private async fetchComplianceData(
    tenantId: string,
    dateRange: { start: string; end: string },
    params: ReportParameters
  ): Promise<ReportData> {
    // Fetch compliance status
    const complianceResult = await executeStatement(
      `SELECT 
        framework,
        control_id,
        control_name,
        status,
        last_checked_at
      FROM compliance_controls
      WHERE tenant_id = $1
      ORDER BY framework, control_id`,
      [stringParam('tenantId', tenantId)]
    );

    const controls = (complianceResult.rows || []) as Array<{
      framework: string;
      control_id: string;
      control_name: string;
      status: string;
      last_checked_at: string;
    }>;

    const passing = controls.filter(c => c.status === 'passing').length;
    const total = controls.length;

    return {
      title: 'Compliance Report',
      subtitle: `As of ${new Date().toISOString().split('T')[0]}`,
      generated_at: new Date().toISOString(),
      date_range: dateRange,
      summary: {
        compliance_score: total > 0 ? Math.round((passing / total) * 100) : 0,
        controls_passing: passing,
        controls_total: total,
        controls_failing: total - passing,
      },
      sections: [
        {
          title: 'Compliance Controls',
          type: 'table',
          columns: [
            { key: 'framework', label: 'Framework' },
            { key: 'control_id', label: 'Control ID' },
            { key: 'control_name', label: 'Control' },
            { key: 'status', label: 'Status' },
            { key: 'last_checked_at', label: 'Last Checked', format: 'date' },
          ],
          data: controls,
        },
      ],
      metadata: {
        tenant_id: tenantId,
        report_type: 'compliance',
        parameters: params,
      },
    };
  }

  /**
   * Fetch code quality report data
   */
  private async fetchCodeQualityData(
    tenantId: string,
    dateRange: { start: string; end: string },
    params: ReportParameters
  ): Promise<ReportData> {
    // Fetch latest coverage by component
    const coverageResult = await executeStatement(
      `SELECT DISTINCT ON (component)
        component,
        line_coverage,
        function_coverage,
        branch_coverage,
        overall_coverage,
        total_files,
        files_with_tests,
        captured_at
      FROM code_quality_snapshots
      WHERE snapshot_type = 'test_coverage'
        AND ($1::UUID IS NULL OR tenant_id IS NULL OR tenant_id = $1::UUID)
      ORDER BY component, captured_at DESC`,
      [stringParam('tenantId', tenantId)]
    );

    // Fetch technical debt summary
    const debtResult = await executeStatement(
      `SELECT 
        debt_id,
        title,
        category,
        priority,
        status,
        component,
        estimated_hours
      FROM technical_debt_items
      WHERE status IN ('open', 'in_progress')
        AND ($1::UUID IS NULL OR tenant_id IS NULL OR tenant_id = $1::UUID)
      ORDER BY 
        CASE priority WHEN 'p0_critical' THEN 1 WHEN 'p1_high' THEN 2 WHEN 'p2_medium' THEN 3 ELSE 4 END`,
      [stringParam('tenantId', tenantId)]
    );

    // Fetch JSON safety progress
    const jsonResult = await executeStatement(
      `SELECT 
        component,
        SUM(CASE WHEN is_migrated THEN 1 ELSE 0 END) AS migrated,
        COUNT(*) AS total
      FROM json_parse_locations
      WHERE $1::UUID IS NULL OR tenant_id IS NULL OR tenant_id = $1::UUID
      GROUP BY component`,
      [stringParam('tenantId', tenantId)]
    );

    const coverageData = (coverageResult.rows || []) as Array<{
      component: string;
      line_coverage: string;
      function_coverage: string;
      branch_coverage: string;
      overall_coverage: string;
      total_files: string;
      files_with_tests: string;
    }>;

    const debtData = (debtResult.rows || []) as Array<{
      debt_id: string;
      title: string;
      category: string;
      priority: string;
      status: string;
      estimated_hours: string;
    }>;

    const jsonData = (jsonResult.rows || []) as Array<{
      component: string;
      migrated: string;
      total: string;
    }>;

    // Calculate averages
    const avgCoverage = coverageData.length > 0
      ? coverageData.reduce((sum, c) => sum + parseFloat(c.overall_coverage || '0'), 0) / coverageData.length
      : 0;

    const totalDebtHours = debtData.reduce((sum, d) => sum + parseInt(d.estimated_hours || '0', 10), 0);
    const criticalDebt = debtData.filter(d => d.priority === 'p0_critical').length;
    const highDebt = debtData.filter(d => d.priority === 'p1_high').length;

    const totalJsonLocations = jsonData.reduce((sum, j) => sum + parseInt(j.total || '0', 10), 0);
    const migratedJsonLocations = jsonData.reduce((sum, j) => sum + parseInt(j.migrated || '0', 10), 0);
    const jsonSafetyPercent = totalJsonLocations > 0
      ? Math.round((migratedJsonLocations / totalJsonLocations) * 100)
      : 100;

    return {
      title: 'Code Quality Report',
      subtitle: `As of ${new Date().toISOString().split('T')[0]}`,
      generated_at: new Date().toISOString(),
      date_range: dateRange,
      summary: {
        overall_coverage_percent: Math.round(avgCoverage * 10) / 10,
        components_tested: coverageData.filter(c => parseFloat(c.overall_coverage || '0') > 0).length,
        total_components: coverageData.length,
        open_debt_items: debtData.length,
        critical_debt_items: criticalDebt,
        high_priority_debt_items: highDebt,
        estimated_debt_hours: totalDebtHours,
        json_safety_progress_percent: jsonSafetyPercent,
      },
      sections: [
        {
          title: 'Test Coverage by Component',
          type: 'table',
          columns: [
            { key: 'component', label: 'Component' },
            { key: 'overall_coverage', label: 'Overall %', format: 'percent' },
            { key: 'line_coverage', label: 'Lines %', format: 'percent' },
            { key: 'function_coverage', label: 'Functions %', format: 'percent' },
            { key: 'branch_coverage', label: 'Branches %', format: 'percent' },
            { key: 'files_with_tests', label: 'Files Tested', format: 'number' },
          ],
          data: coverageData,
        },
        {
          title: 'Technical Debt Items',
          type: 'table',
          columns: [
            { key: 'debt_id', label: 'ID' },
            { key: 'title', label: 'Title' },
            { key: 'category', label: 'Category' },
            { key: 'priority', label: 'Priority' },
            { key: 'status', label: 'Status' },
            { key: 'estimated_hours', label: 'Est. Hours', format: 'number' },
          ],
          data: debtData,
        },
        {
          title: 'JSON Safety Migration',
          type: 'table',
          columns: [
            { key: 'component', label: 'Component' },
            { key: 'migrated', label: 'Migrated', format: 'number' },
            { key: 'total', label: 'Total', format: 'number' },
          ],
          data: jsonData,
        },
      ],
      metadata: {
        tenant_id: tenantId,
        report_type: 'code_quality',
        parameters: params,
      },
    };
  }

  /**
   * Fetch custom report data (placeholder)
   */
  private async fetchCustomData(
    tenantId: string,
    dateRange: { start: string; end: string },
    params: ReportParameters
  ): Promise<ReportData> {
    return {
      title: 'Custom Report',
      subtitle: `${dateRange.start} to ${dateRange.end}`,
      generated_at: new Date().toISOString(),
      date_range: dateRange,
      summary: {},
      sections: [],
      metadata: {
        tenant_id: tenantId,
        report_type: 'custom',
        parameters: params,
      },
    };
  }

  /**
   * Format report data into requested format
   */
  private async formatReport(data: ReportData, format: string): Promise<Buffer> {
    switch (format) {
      case 'json':
        return Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
      case 'csv':
        return this.formatAsCSV(data);
      case 'excel':
        return this.formatAsExcel(data);
      case 'pdf':
      default:
        return this.formatAsPDF(data);
    }
  }

  /**
   * Format as CSV
   */
  private formatAsCSV(data: ReportData): Buffer {
    const lines: string[] = [];

    // Header
    lines.push(`"${data.title}"`);
    if (data.subtitle) lines.push(`"${data.subtitle}"`);
    lines.push(`"Generated: ${data.generated_at}"`);
    lines.push('');

    // Summary
    if (data.summary && Object.keys(data.summary).length > 0) {
      lines.push('"Summary"');
      for (const [key, value] of Object.entries(data.summary)) {
        lines.push(`"${key}","${value}"`);
      }
      lines.push('');
    }

    // Sections
    for (const section of data.sections) {
      lines.push(`"${section.title}"`);

      if (section.type === 'table' && section.columns && Array.isArray(section.data)) {
        // Column headers
        lines.push(section.columns.map(c => `"${c.label}"`).join(','));

        // Data rows
        for (const row of section.data as Record<string, unknown>[]) {
          const values = section.columns.map(c => {
            const val = row[c.key];
            return `"${val ?? ''}"`;
          });
          lines.push(values.join(','));
        }
      }

      lines.push('');
    }

    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  /**
   * Format as Excel (simplified - outputs TSV that Excel can open)
   */
  private formatAsExcel(data: ReportData): Buffer {
    // For a real implementation, use a library like exceljs
    // This outputs TSV which Excel can open
    const lines: string[] = [];

    lines.push(data.title);
    if (data.subtitle) lines.push(data.subtitle);
    lines.push(`Generated: ${data.generated_at}`);
    lines.push('');

    for (const section of data.sections) {
      lines.push(section.title);

      if (section.type === 'table' && section.columns && Array.isArray(section.data)) {
        lines.push(section.columns.map(c => c.label).join('\t'));

        for (const row of section.data as Record<string, unknown>[]) {
          const values = section.columns.map(c => String(row[c.key] ?? ''));
          lines.push(values.join('\t'));
        }
      }

      lines.push('');
    }

    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  /**
   * Format as PDF using PDFKit
   */
  private formatAsPDF(data: ReportData): Buffer {
    return this.generatePDFWithPDFKit(PDFDocument, data);
  }

  /**
   * Generate PDF using PDFKit library
   */
  private generatePDFWithPDFKit(PDFDocument: any, data: ReportData): Buffer {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: data.title,
        Author: 'RADIANT Platform',
        Subject: data.subtitle || 'Generated Report',
        CreationDate: new Date(data.generated_at),
      },
    });

    // Collect PDF chunks
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    // Colors
    const primaryColor = '#1e40af'; // Blue
    const textColor = '#1f2937';
    const headerBgColor = '#f3f4f6';

    // Title
    doc.fontSize(24)
       .fillColor(primaryColor)
       .text(data.title, { align: 'center' });
    
    if (data.subtitle) {
      doc.fontSize(12)
         .fillColor(textColor)
         .text(data.subtitle, { align: 'center' });
    }

    doc.moveDown();
    doc.fontSize(10)
       .fillColor('#6b7280')
       .text(`Generated: ${new Date(data.generated_at).toLocaleString()}`, { align: 'center' });

    doc.moveDown(2);

    // Summary Section
    if (data.summary && Object.keys(data.summary).length > 0) {
      doc.fontSize(16)
         .fillColor(primaryColor)
         .text('Summary');
      
      doc.moveTo(50, doc.y)
         .lineTo(545, doc.y)
         .strokeColor(primaryColor)
         .stroke();
      
      doc.moveDown(0.5);

      // Summary metrics in a grid
      const summaryEntries = Object.entries(data.summary);
      const colWidth = 160;
      let col = 0;
      const startX = 50;
      let startY = doc.y;

      for (const [key, value] of summaryEntries) {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const x = startX + (col * colWidth);
        
        doc.fontSize(10)
           .fillColor('#6b7280')
           .text(label, x, startY, { width: colWidth - 10, continued: false });
        
        doc.fontSize(14)
           .fillColor(textColor)
           .text(String(value), x, doc.y, { width: colWidth - 10 });

        col++;
        if (col >= 3) {
          col = 0;
          startY = doc.y + 10;
        }
      }

      doc.moveDown(2);
    }

    // Data Sections
    for (const section of data.sections) {
      // Check if we need a new page
      if (doc.y > 700) {
        doc.addPage();
      }

      // Section Title
      doc.fontSize(14)
         .fillColor(primaryColor)
         .text(section.title);
      
      doc.moveTo(50, doc.y)
         .lineTo(545, doc.y)
         .strokeColor('#e5e7eb')
         .stroke();
      
      doc.moveDown(0.5);

      if (section.type === 'table' && section.columns && Array.isArray(section.data)) {
        this.drawPDFTable(doc, section.columns, section.data as Record<string, unknown>[]);
      } else if (section.type === 'metric') {
        doc.fontSize(11)
           .fillColor(textColor)
           .text(JSON.stringify(section.data, null, 2));
      } else if (section.type === 'text') {
        doc.fontSize(11)
           .fillColor(textColor)
           .text(String(section.data));
      }

      doc.moveDown(1.5);
    }

    // Footer on each page
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8)
         .fillColor('#9ca3af')
         .text(
           `Page ${i + 1} of ${pageCount} | RADIANT Platform Report`,
           50,
           doc.page.height - 40,
           { align: 'center', width: doc.page.width - 100 }
         );
    }

    doc.end();

    // Return concatenated buffer
    return Buffer.concat(chunks);
  }

  /**
   * Draw a table in the PDF
   */
  private drawPDFTable(
    doc: any,
    columns: { key: string; label: string; format?: string }[],
    data: Record<string, unknown>[]
  ): void {
    const tableTop = doc.y;
    const tableLeft = 50;
    const rowHeight = 20;
    const colWidth = (545 - tableLeft) / columns.length;

    // Draw header row
    doc.rect(tableLeft, tableTop, 545 - tableLeft, rowHeight)
       .fillColor('#f3f4f6')
       .fill();

    doc.fillColor('#374151');
    columns.forEach((col, i) => {
      doc.fontSize(9)
         .text(col.label, tableLeft + (i * colWidth) + 5, tableTop + 5, {
           width: colWidth - 10,
           align: 'left',
         });
    });

    // Draw data rows
    let y = tableTop + rowHeight;
    const maxRows = Math.min(data.length, 50); // Limit rows per page section

    for (let rowIdx = 0; rowIdx < maxRows; rowIdx++) {
      const row = data[rowIdx];
      
      // Alternate row background
      if (rowIdx % 2 === 1) {
        doc.rect(tableLeft, y, 545 - tableLeft, rowHeight)
           .fillColor('#fafafa')
           .fill();
      }

      doc.fillColor('#1f2937');
      columns.forEach((col, i) => {
        let value = row[col.key];
        
        // Format value based on column format
        if (col.format === 'number' && typeof value === 'string') {
          value = parseInt(value, 10).toLocaleString();
        } else if (col.format === 'currency' && typeof value === 'string') {
          value = `$${parseFloat(value).toFixed(2)}`;
        } else if (col.format === 'percent' && typeof value === 'string') {
          value = `${parseFloat(value).toFixed(1)}%`;
        } else if (col.format === 'date' && value) {
          value = new Date(String(value)).toLocaleDateString();
        }

        doc.fontSize(8)
           .text(String(value ?? ''), tableLeft + (i * colWidth) + 5, y + 5, {
             width: colWidth - 10,
             align: 'left',
           });
      });

      y += rowHeight;

      // Check for page break
      if (y > 750) {
        doc.addPage();
        y = 50;
      }
    }

    if (data.length > maxRows) {
      doc.fontSize(8)
         .fillColor('#6b7280')
         .text(`... and ${data.length - maxRows} more rows`, tableLeft, y + 5);
    }

    doc.y = y + 10;
  }

  /**
   * Generate HTML-based PDF as fallback (outputs HTML that can be converted)
   */
  private generateHTMLBasedPDF(data: ReportData): Buffer {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${data.title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #1f2937; }
    h1 { color: #1e40af; text-align: center; margin-bottom: 5px; }
    .subtitle { text-align: center; color: #6b7280; margin-bottom: 20px; }
    .generated { text-align: center; color: #9ca3af; font-size: 12px; margin-bottom: 30px; }
    .summary { background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .summary h2 { color: #1e40af; margin-top: 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
    .metric { }
    .metric-label { color: #6b7280; font-size: 12px; }
    .metric-value { font-size: 18px; font-weight: bold; color: #1f2937; }
    .section { margin-bottom: 30px; }
    .section h2 { color: #1e40af; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f3f4f6; padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; }
    td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) { background: #fafafa; }
  </style>
</head>
<body>
  <h1>${data.title}</h1>
  ${data.subtitle ? `<p class="subtitle">${data.subtitle}</p>` : ''}
  <p class="generated">Generated: ${new Date(data.generated_at).toLocaleString()}</p>
  
  ${data.summary && Object.keys(data.summary).length > 0 ? `
  <div class="summary">
    <h2>Summary</h2>
    <div class="summary-grid">
      ${Object.entries(data.summary).map(([key, value]) => `
        <div class="metric">
          <div class="metric-label">${key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>
          <div class="metric-value">${value}</div>
        </div>
      `).join('')}
    </div>
  </div>
  ` : ''}

  ${data.sections.map(section => `
  <div class="section">
    <h2>${section.title}</h2>
    ${section.type === 'table' && section.columns ? `
    <table>
      <thead>
        <tr>
          ${section.columns.map(col => `<th>${col.label}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${(section.data as Record<string, unknown>[]).slice(0, 100).map(row => `
          <tr>
            ${section.columns!.map(col => `<td>${row[col.key] ?? ''}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : `<p>${JSON.stringify(section.data)}</p>`}
  </div>
  `).join('')}
</body>
</html>`;

    return Buffer.from(html, 'utf-8');
  }

  /**
   * Upload report to S3
   */
  private async uploadToS3(key: string, data: Buffer, format: string): Promise<void> {
    const contentType = this.getContentType(format);

    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
      Metadata: {
        'report-format': format,
        'generated-at': new Date().toISOString(),
      },
    }));
  }

  /**
   * Get presigned download URL
   */
  async getDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Generate S3 key for report
   */
  private generateS3Key(config: ReportConfig): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const timestamp = date.getTime();
    const ext = this.getFileExtension(config.format);

    return `reports/${config.tenant_id}/${year}/${month}/${day}/${config.id}_${timestamp}.${ext}`;
  }

  /**
   * Get file extension for format
   */
  private getFileExtension(format: string): string {
    switch (format) {
      case 'csv': return 'csv';
      case 'json': return 'json';
      case 'excel': return 'xlsx';
      case 'pdf': return 'pdf';
      default: return 'txt';
    }
  }

  /**
   * Get content type for format
   */
  private getContentType(format: string): string {
    switch (format) {
      case 'csv': return 'text/csv';
      case 'json': return 'application/json';
      case 'excel': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'pdf': return 'application/pdf';
      default: return 'text/plain';
    }
  }

  /**
   * Get default date range (last 30 days)
   */
  private getDefaultDateRange(): { start: string; end: string } {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  }

  /**
   * Update execution status
   */
  private async updateExecutionStatus(executionId: string, status: string): Promise<void> {
    await executeStatement(
      `UPDATE report_executions SET status = $2, started_at = NOW() WHERE id = $1`,
      [stringParam('id', executionId), stringParam('status', status)]
    );
  }

  /**
   * Update execution on success
   */
  private async updateExecutionSuccess(executionId: string, result: {
    s3_key: string;
    s3_bucket: string;
    size_bytes: number;
    checksum: string;
    duration_ms: number;
  }): Promise<void> {
    await executeStatement(
      `UPDATE report_executions SET 
        status = 'success',
        completed_at = NOW(),
        duration_ms = $2,
        output_s3_key = $3,
        output_s3_bucket = $4,
        output_size_bytes = $5,
        output_checksum = $6
      WHERE id = $1`,
      [
        stringParam('id', executionId),
        longParam('durationMs', result.duration_ms),
        stringParam('s3Key', result.s3_key),
        stringParam('s3Bucket', result.s3_bucket),
        longParam('sizeBytes', result.size_bytes),
        stringParam('checksum', result.checksum),
      ]
    );
  }

  /**
   * Update execution on failure
   */
  private async updateExecutionFailure(executionId: string, error: string): Promise<void> {
    await executeStatement(
      `UPDATE report_executions SET 
        status = 'failed',
        completed_at = NOW(),
        error_message = $2
      WHERE id = $1`,
      [stringParam('id', executionId), stringParam('error', error)]
    );
  }
}

// Export singleton
export const reportGeneratorService = new ReportGeneratorService();
