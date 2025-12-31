/**
 * Self-Audit Service
 * 
 * Executes compliance checks against the Radiant platform and stores
 * timestamped results for regulatory reporting.
 */

import { PoolClient } from 'pg';
import { getPoolClient } from '../db/centralized-pool';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

export type AuditFramework = 'soc2' | 'hipaa' | 'gdpr' | 'iso27001' | 'pci-dss' | 'all';
export type AuditRunType = 'manual' | 'scheduled' | 'triggered';
export type AuditStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export type CheckStatus = 'passed' | 'failed' | 'skipped' | 'error';
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface AuditRun {
  id: string;
  tenantId: string | null;
  framework: string;
  runType: AuditRunType;
  status: AuditStatus;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  skippedChecks: number;
  score: number;
  durationMs: number | null;
  triggeredBy: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface AuditResult {
  id: string;
  runId: string;
  checkCode: string;
  checkName: string;
  category: string;
  controlType: string | null;
  isRequired: boolean;
  status: CheckStatus;
  details: string | null;
  evidence: Record<string, unknown> | null;
  remediation: string | null;
  durationMs: number | null;
  executedAt: string;
}

export interface AuditCheck {
  checkCode: string;
  checkName: string;
  description: string | null;
  category: string;
  framework: string;
  controlType: string | null;
  isRequired: boolean;
  isAutomated: boolean;
  checkQuery: string | null;
  remediationSteps: string | null;
  severity: Severity;
}

export interface RunAuditOptions {
  tenantId?: string;
  framework: AuditFramework;
  runType?: AuditRunType;
  triggeredBy?: string;
}

export interface AuditSummary {
  run: AuditRun;
  results: AuditResult[];
  byCategory: Record<string, { passed: number; failed: number; total: number }>;
  bySeverity: Record<Severity, { passed: number; failed: number; total: number }>;
  criticalFailures: AuditResult[];
}

class SelfAuditService {
  /**
   * Run a compliance audit for specified framework
   */
  async runAudit(options: RunAuditOptions): Promise<AuditSummary> {
    const { tenantId, framework, runType = 'manual', triggeredBy } = options;
    let client: PoolClient | null = null;
    const startTime = Date.now();

    try {
      client = await getPoolClient();
      
      // Get frameworks to audit
      const frameworks = framework === 'all' 
        ? ['soc2', 'hipaa', 'gdpr', 'iso27001', 'pci-dss']
        : [framework];

      // Create audit run record
      const runResult = await client.query(`
        INSERT INTO compliance_audit_runs (tenant_id, framework, run_type, status, triggered_by, started_at)
        VALUES ($1, $2, $3, 'running', $4, NOW())
        RETURNING *
      `, [tenantId || null, framework, runType, triggeredBy || null]);

      const runId = runResult.rows[0].id;
      const results: AuditResult[] = [];
      let totalPassed = 0;
      let totalFailed = 0;
      let totalSkipped = 0;

      // Execute checks for each framework
      for (const fw of frameworks) {
        const checksResult = await client.query(`
          SELECT * FROM system_audit_checks 
          WHERE framework = $1 AND is_active = true
          ORDER BY severity DESC, check_code
        `, [fw]);

        for (const check of checksResult.rows) {
          const checkStart = Date.now();
          let status: CheckStatus = 'skipped';
          let details: string | null = null;
          let evidence: Record<string, unknown> | null = null;

          if (check.is_automated && check.check_query) {
            try {
              const queryResult = await client.query(check.check_query);
              const passed = queryResult.rows[0]?.passed === true;
              status = passed ? 'passed' : 'failed';
              details = passed 
                ? 'Check passed successfully' 
                : check.remediation_steps || 'Check failed - remediation required';
              
              // Capture evidence
              evidence = {
                queryExecuted: check.check_query,
                rawResult: queryResult.rows[0],
                executedAt: new Date().toISOString(),
              };

              if (passed) totalPassed++;
              else totalFailed++;
            } catch (error) {
              status = 'error';
              details = `Error executing check: ${error instanceof Error ? error.message : String(error)}`;
              totalFailed++;
              logger.error('Audit check error', { checkCode: check.check_code, error });
            }
          } else {
            // Manual check - mark as skipped
            status = 'skipped';
            details = 'Manual verification required';
            totalSkipped++;
          }

          const checkDuration = Date.now() - checkStart;

          // Store result
          const resultInsert = await client.query(`
            INSERT INTO compliance_audit_results (
              run_id, check_code, check_name, category, control_type, is_required,
              status, details, evidence, remediation, duration_ms
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
          `, [
            runId,
            check.check_code,
            check.check_name,
            check.category,
            check.control_type,
            check.is_required,
            status,
            details,
            evidence ? JSON.stringify(evidence) : null,
            status === 'failed' ? check.remediation_steps : null,
            checkDuration,
          ]);

          results.push(this.mapResultRow(resultInsert.rows[0]));
        }
      }

      const totalChecks = totalPassed + totalFailed + totalSkipped;
      const score = totalChecks > 0 
        ? Math.round((totalPassed / (totalPassed + totalFailed)) * 100) 
        : 0;
      const duration = Date.now() - startTime;

      // Update run record
      const updatedRun = await client.query(`
        UPDATE compliance_audit_runs SET
          status = 'completed',
          total_checks = $2,
          passed_checks = $3,
          failed_checks = $4,
          skipped_checks = $5,
          score = $6,
          duration_ms = $7,
          completed_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [runId, totalChecks, totalPassed, totalFailed, totalSkipped, score, duration]);

      const run = this.mapRunRow(updatedRun.rows[0]);

      // Build summary
      const byCategory: Record<string, { passed: number; failed: number; total: number }> = {};
      const bySeverity: Record<Severity, { passed: number; failed: number; total: number }> = {
        critical: { passed: 0, failed: 0, total: 0 },
        high: { passed: 0, failed: 0, total: 0 },
        medium: { passed: 0, failed: 0, total: 0 },
        low: { passed: 0, failed: 0, total: 0 },
      };
      const criticalFailures: AuditResult[] = [];

      for (const result of results) {
        // By category
        if (!byCategory[result.category]) {
          byCategory[result.category] = { passed: 0, failed: 0, total: 0 };
        }
        byCategory[result.category].total++;
        if (result.status === 'passed') byCategory[result.category].passed++;
        else if (result.status === 'failed') byCategory[result.category].failed++;

        // Get severity from check
        const checkSeverity = await this.getCheckSeverity(client, result.checkCode);
        bySeverity[checkSeverity].total++;
        if (result.status === 'passed') bySeverity[checkSeverity].passed++;
        else if (result.status === 'failed') {
          bySeverity[checkSeverity].failed++;
          if (checkSeverity === 'critical') criticalFailures.push(result);
        }
      }

      logger.info('Audit completed', { 
        runId, 
        framework, 
        score, 
        totalChecks, 
        passed: totalPassed, 
        failed: totalFailed 
      });

      return { run, results, byCategory, bySeverity, criticalFailures };

    } catch (error) {
      logger.error('Audit run failed', { error, options });
      throw error;
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Get audit run history
   */
  async getAuditHistory(options: {
    tenantId?: string;
    framework?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ runs: AuditRun[]; total: number }> {
    let client: PoolClient | null = null;
    try {
      client = await getPoolClient();
      
      let query = `SELECT * FROM compliance_audit_runs WHERE 1=1`;
      let countQuery = `SELECT COUNT(*) FROM compliance_audit_runs WHERE 1=1`;
      const params: (string | number)[] = [];
      let paramIndex = 1;

      if (options.tenantId) {
        query += ` AND tenant_id = $${paramIndex}`;
        countQuery += ` AND tenant_id = $${paramIndex}`;
        params.push(options.tenantId);
        paramIndex++;
      }

      if (options.framework) {
        query += ` AND framework = $${paramIndex}`;
        countQuery += ` AND framework = $${paramIndex}`;
        params.push(options.framework);
        paramIndex++;
      }

      query += ` ORDER BY started_at DESC`;
      
      if (options.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(options.limit);
        paramIndex++;
      }

      if (options.offset) {
        query += ` OFFSET $${paramIndex}`;
        params.push(options.offset);
      }

      const [runsResult, countResult] = await Promise.all([
        client.query(query, params.slice(0, options.offset ? params.length : params.length - (options.offset ? 0 : 1))),
        client.query(countQuery, params.slice(0, options.framework ? 2 : options.tenantId ? 1 : 0)),
      ]);

      return {
        runs: runsResult.rows.map(this.mapRunRow),
        total: parseInt(countResult.rows[0].count, 10),
      };
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Get results for a specific audit run
   */
  async getAuditResults(runId: string): Promise<AuditResult[]> {
    let client: PoolClient | null = null;
    try {
      client = await getPoolClient();
      const result = await client.query(`
        SELECT * FROM compliance_audit_results
        WHERE run_id = $1
        ORDER BY executed_at
      `, [runId]);

      return result.rows.map(this.mapResultRow);
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Get audit run with full results
   */
  async getAuditRun(runId: string): Promise<AuditSummary | null> {
    let client: PoolClient | null = null;
    try {
      client = await getPoolClient();
      
      const runResult = await client.query(`
        SELECT * FROM compliance_audit_runs WHERE id = $1
      `, [runId]);

      if (runResult.rows.length === 0) return null;

      const run = this.mapRunRow(runResult.rows[0]);
      const results = await this.getAuditResults(runId);

      // Build summaries
      const byCategory: Record<string, { passed: number; failed: number; total: number }> = {};
      const bySeverity: Record<Severity, { passed: number; failed: number; total: number }> = {
        critical: { passed: 0, failed: 0, total: 0 },
        high: { passed: 0, failed: 0, total: 0 },
        medium: { passed: 0, failed: 0, total: 0 },
        low: { passed: 0, failed: 0, total: 0 },
      };
      const criticalFailures: AuditResult[] = [];

      for (const result of results) {
        if (!byCategory[result.category]) {
          byCategory[result.category] = { passed: 0, failed: 0, total: 0 };
        }
        byCategory[result.category].total++;
        if (result.status === 'passed') byCategory[result.category].passed++;
        else if (result.status === 'failed') byCategory[result.category].failed++;

        const checkSeverity = await this.getCheckSeverity(client, result.checkCode);
        bySeverity[checkSeverity].total++;
        if (result.status === 'passed') bySeverity[checkSeverity].passed++;
        else if (result.status === 'failed') {
          bySeverity[checkSeverity].failed++;
          if (checkSeverity === 'critical') criticalFailures.push(result);
        }
      }

      return { run, results, byCategory, bySeverity, criticalFailures };
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Get all registered audit checks
   */
  async getAuditChecks(framework?: string): Promise<AuditCheck[]> {
    let client: PoolClient | null = null;
    try {
      client = await getPoolClient();
      
      let query = `SELECT * FROM system_audit_checks WHERE is_active = true`;
      const params: string[] = [];

      if (framework) {
        query += ` AND framework = $1`;
        params.push(framework);
      }

      query += ` ORDER BY framework, severity DESC, check_code`;

      const result = await client.query(query, params);
      return result.rows.map(this.mapCheckRow);
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Get audit dashboard summary
   */
  async getDashboard(tenantId?: string): Promise<{
    recentRuns: AuditRun[];
    frameworkScores: Record<string, { latestScore: number; latestRun: string; trend: number }>;
    criticalIssues: number;
    totalChecks: number;
    passRate: number;
  }> {
    let client: PoolClient | null = null;
    try {
      client = await getPoolClient();

      // Recent runs
      const recentResult = await client.query(`
        SELECT * FROM compliance_audit_runs
        WHERE ($1::uuid IS NULL OR tenant_id = $1)
        ORDER BY started_at DESC
        LIMIT 10
      `, [tenantId || null]);

      // Latest scores per framework
      const scoresResult = await client.query(`
        SELECT DISTINCT ON (framework)
          framework, score, started_at, failed_checks
        FROM compliance_audit_runs
        WHERE status = 'completed' AND ($1::uuid IS NULL OR tenant_id = $1)
        ORDER BY framework, started_at DESC
      `, [tenantId || null]);

      // Previous scores for trend
      const previousResult = await client.query(`
        SELECT framework, score
        FROM (
          SELECT framework, score, started_at,
                 ROW_NUMBER() OVER (PARTITION BY framework ORDER BY started_at DESC) as rn
          FROM compliance_audit_runs
          WHERE status = 'completed' AND ($1::uuid IS NULL OR tenant_id = $1)
        ) sub
        WHERE rn = 2
      `, [tenantId || null]);

      const previousScores: Record<string, number> = {};
      for (const row of previousResult.rows) {
        previousScores[row.framework] = row.score;
      }

      const frameworkScores: Record<string, { latestScore: number; latestRun: string; trend: number }> = {};
      let totalCritical = 0;
      
      for (const row of scoresResult.rows) {
        const prev = previousScores[row.framework] ?? row.score;
        frameworkScores[row.framework] = {
          latestScore: row.score,
          latestRun: row.started_at,
          trend: row.score - prev,
        };
        // Count critical from most recent failed
        totalCritical += row.failed_checks || 0;
      }

      // Total checks and pass rate
      const statsResult = await client.query(`
        SELECT 
          COUNT(*) as total_checks,
          COUNT(*) FILTER (WHERE is_required = true) as required_checks
        FROM system_audit_checks WHERE is_active = true
      `);

      const { total_checks } = statsResult.rows[0];

      // Calculate overall pass rate from recent runs
      const passRateResult = await client.query(`
        SELECT 
          AVG(score) as avg_score
        FROM compliance_audit_runs
        WHERE status = 'completed' 
          AND started_at > NOW() - INTERVAL '30 days'
          AND ($1::uuid IS NULL OR tenant_id = $1)
      `, [tenantId || null]);

      return {
        recentRuns: recentResult.rows.map(this.mapRunRow),
        frameworkScores,
        criticalIssues: totalCritical,
        totalChecks: parseInt(total_checks, 10),
        passRate: Math.round(parseFloat(passRateResult.rows[0]?.avg_score || '0')),
      };
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Generate compliance report from audit run
   */
  async generateReport(runId: string): Promise<{
    run: AuditRun;
    executive_summary: string;
    findings: Array<{
      checkCode: string;
      checkName: string;
      category: string;
      severity: Severity;
      status: CheckStatus;
      details: string;
      remediation: string | null;
    }>;
    recommendations: string[];
    certification_ready: boolean;
  }> {
    const summary = await this.getAuditRun(runId);
    if (!summary) throw new Error('Audit run not found');

    let client: PoolClient | null = null;
    try {
      client = await getPoolClient();

      const findings: Array<{
        checkCode: string;
        checkName: string;
        category: string;
        severity: Severity;
        status: CheckStatus;
        details: string;
        remediation: string | null;
      }> = [];

      for (const result of summary.results) {
        const severity = await this.getCheckSeverity(client, result.checkCode);
        findings.push({
          checkCode: result.checkCode,
          checkName: result.checkName,
          category: result.category,
          severity,
          status: result.status,
          details: result.details || '',
          remediation: result.remediation,
        });
      }

      // Sort by severity
      const severityOrder: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      const recommendations: string[] = [];
      const criticalFailed = findings.filter(f => f.severity === 'critical' && f.status === 'failed');
      const highFailed = findings.filter(f => f.severity === 'high' && f.status === 'failed');

      if (criticalFailed.length > 0) {
        recommendations.push(`Address ${criticalFailed.length} critical issue(s) immediately`);
        for (const f of criticalFailed.slice(0, 3)) {
          if (f.remediation) recommendations.push(`- ${f.checkName}: ${f.remediation}`);
        }
      }

      if (highFailed.length > 0) {
        recommendations.push(`Resolve ${highFailed.length} high-priority finding(s) within 30 days`);
      }

      const certificationReady = criticalFailed.length === 0 && summary.run.score >= 80;

      const executiveSummary = `
Compliance Audit Report - ${summary.run.framework.toUpperCase()}
Generated: ${new Date().toISOString()}

Overall Score: ${summary.run.score}%
Status: ${certificationReady ? 'CERTIFICATION READY' : 'REMEDIATION REQUIRED'}

Checks Executed: ${summary.run.totalChecks}
- Passed: ${summary.run.passedChecks}
- Failed: ${summary.run.failedChecks}
- Skipped: ${summary.run.skippedChecks}

Critical Issues: ${summary.bySeverity.critical.failed}
High Issues: ${summary.bySeverity.high.failed}
Medium Issues: ${summary.bySeverity.medium.failed}
Low Issues: ${summary.bySeverity.low.failed}
      `.trim();

      return {
        run: summary.run,
        executive_summary: executiveSummary,
        findings,
        recommendations,
        certification_ready: certificationReady,
      };
    } finally {
      if (client) client.release();
    }
  }

  // Helper: Get check severity
  private async getCheckSeverity(client: PoolClient, checkCode: string): Promise<Severity> {
    const result = await client.query(
      `SELECT severity FROM system_audit_checks WHERE check_code = $1`,
      [checkCode]
    );
    return (result.rows[0]?.severity as Severity) || 'medium';
  }

  // Mapper functions
  private mapRunRow(row: Record<string, unknown>): AuditRun {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string | null,
      framework: row.framework as string,
      runType: row.run_type as AuditRunType,
      status: row.status as AuditStatus,
      totalChecks: parseInt(row.total_checks as string, 10) || 0,
      passedChecks: parseInt(row.passed_checks as string, 10) || 0,
      failedChecks: parseInt(row.failed_checks as string, 10) || 0,
      skippedChecks: parseInt(row.skipped_checks as string, 10) || 0,
      score: parseInt(row.score as string, 10) || 0,
      durationMs: row.duration_ms ? parseInt(row.duration_ms as string, 10) : null,
      triggeredBy: row.triggered_by as string | null,
      errorMessage: row.error_message as string | null,
      startedAt: (row.started_at as Date).toISOString(),
      completedAt: row.completed_at ? (row.completed_at as Date).toISOString() : null,
    };
  }

  private mapResultRow(row: Record<string, unknown>): AuditResult {
    return {
      id: row.id as string,
      runId: row.run_id as string,
      checkCode: row.check_code as string,
      checkName: row.check_name as string,
      category: row.category as string,
      controlType: row.control_type as string | null,
      isRequired: Boolean(row.is_required),
      status: row.status as CheckStatus,
      details: row.details as string | null,
      evidence: row.evidence as Record<string, unknown> | null,
      remediation: row.remediation as string | null,
      durationMs: row.duration_ms ? parseInt(row.duration_ms as string, 10) : null,
      executedAt: (row.executed_at as Date).toISOString(),
    };
  }

  private mapCheckRow(row: Record<string, unknown>): AuditCheck {
    return {
      checkCode: row.check_code as string,
      checkName: row.check_name as string,
      description: row.description as string | null,
      category: row.category as string,
      framework: row.framework as string,
      controlType: row.control_type as string | null,
      isRequired: Boolean(row.is_required),
      isAutomated: Boolean(row.is_automated),
      checkQuery: row.check_query as string | null,
      remediationSteps: row.remediation_steps as string | null,
      severity: row.severity as Severity,
    };
  }
}

export const selfAuditService = new SelfAuditService();
