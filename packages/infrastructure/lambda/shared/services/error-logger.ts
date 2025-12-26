import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { executeStatement } from '../db/client';

type ErrorSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

interface ErrorContext {
  tenantId?: string;
  userId?: string;
  requestId?: string;
  sourceService: string;
  sourceFunction: string;
  additionalContext?: Record<string, unknown>;
}

export class ErrorLogger {
  private sns: SNSClient;
  private alertTopicArn: string;

  constructor(alertTopicArn?: string) {
    this.sns = new SNSClient({});
    this.alertTopicArn = alertTopicArn || process.env.ALERT_TOPIC_ARN || '';
  }

  async log(
    error: Error,
    context: ErrorContext,
    severity: ErrorSeverity = 'error'
  ): Promise<string> {
    const errorCode = this.extractErrorCode(error);
    const errorType = error.constructor.name;

    const result = await executeStatement(
      `INSERT INTO error_logs (
        tenant_id, user_id, error_code, error_type, error_message,
        stack_trace, request_id, source_service, source_function,
        context, severity
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        { name: 'tenantId', value: context.tenantId ? { stringValue: context.tenantId } : { isNull: true } },
        { name: 'userId', value: context.userId ? { stringValue: context.userId } : { isNull: true } },
        { name: 'errorCode', value: { stringValue: errorCode } },
        { name: 'errorType', value: { stringValue: errorType } },
        { name: 'errorMessage', value: { stringValue: error.message } },
        { name: 'stackTrace', value: error.stack ? { stringValue: error.stack } : { isNull: true } },
        { name: 'requestId', value: context.requestId ? { stringValue: context.requestId } : { isNull: true } },
        { name: 'sourceService', value: { stringValue: context.sourceService } },
        { name: 'sourceFunction', value: { stringValue: context.sourceFunction } },
        { name: 'context', value: { stringValue: JSON.stringify(context.additionalContext || {}) } },
        { name: 'severity', value: { stringValue: severity } },
      ]
    );

    const errorId = String((result.rows[0] as Record<string, unknown>)?.id || '');

    await this.checkPatterns(errorCode, error.message);

    if (severity === 'critical') {
      await this.sendAlert(errorId, error, context);
    }

    return errorId;
  }

  async getUnresolvedErrors(tenantId?: string, limit: number = 50): Promise<unknown[]> {
    const sql = tenantId
      ? `SELECT * FROM error_logs WHERE resolved = false AND tenant_id = $2 
         ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'error' THEN 2 WHEN 'warning' THEN 3 ELSE 4 END,
         created_at DESC LIMIT $1`
      : `SELECT * FROM error_logs WHERE resolved = false 
         ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'error' THEN 2 WHEN 'warning' THEN 3 ELSE 4 END,
         created_at DESC LIMIT $1`;

    const params: import('@aws-sdk/client-rds-data').SqlParameter[] = tenantId
      ? [
          { name: 'limit', value: { longValue: limit } },
          { name: 'tenantId', value: { stringValue: tenantId } },
        ]
      : [{ name: 'limit', value: { longValue: limit } }];

    const result = await executeStatement(sql, params);
    return result.rows;
  }

  async resolve(errorId: string, resolvedBy: string, notes: string): Promise<void> {
    await executeStatement(
      `UPDATE error_logs
       SET resolved = true, resolved_at = NOW(), resolved_by = $2, resolution_notes = $3
       WHERE id = $1`,
      [
        { name: 'errorId', value: { stringValue: errorId } },
        { name: 'resolvedBy', value: { stringValue: resolvedBy } },
        { name: 'notes', value: { stringValue: notes } },
      ]
    );
  }

  async getErrorStats(tenantId?: string): Promise<{
    total: number;
    unresolved: number;
    bySeverity: Record<string, number>;
  }> {
    const whereClause = tenantId ? 'WHERE tenant_id = $1' : '';
    const params = tenantId ? [{ name: 'tenantId', value: { stringValue: tenantId } }] : [];

    const result = await executeStatement(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE resolved = false) as unresolved,
         COUNT(*) FILTER (WHERE severity = 'critical') as critical,
         COUNT(*) FILTER (WHERE severity = 'error') as errors,
         COUNT(*) FILTER (WHERE severity = 'warning') as warnings
       FROM error_logs ${whereClause}
       AND created_at > NOW() - INTERVAL '7 days'`,
      params
    );

    const row = result.rows[0] as Record<string, unknown>;
    return {
      total: parseInt(String(row?.total ?? 0), 10),
      unresolved: parseInt(String(row?.unresolved ?? 0), 10),
      bySeverity: {
        critical: parseInt(String(row?.critical ?? 0), 10),
        error: parseInt(String(row?.errors ?? 0), 10),
        warning: parseInt(String(row?.warnings ?? 0), 10),
      },
    };
  }

  private extractErrorCode(error: Error): string {
    if ('code' in error) return String((error as Error & { code: string }).code);
    if (error.message.includes('ECONNREFUSED')) return 'CONN_REFUSED';
    if (error.message.includes('timeout')) return 'TIMEOUT';
    if (error.message.includes('rate limit')) return 'RATE_LIMIT';
    if (error.message.includes('unauthorized')) return 'UNAUTHORIZED';
    if (error.message.includes('forbidden')) return 'FORBIDDEN';
    if (error.message.includes('not found')) return 'NOT_FOUND';
    return 'UNKNOWN';
  }

  private async checkPatterns(errorCode: string, message: string): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO error_patterns (pattern_name, error_code_pattern, message_pattern)
         VALUES ($1, $2, $3)
         ON CONFLICT (pattern_name) DO UPDATE SET
           occurrence_count = error_patterns.occurrence_count + 1,
           last_seen = NOW()`,
        [
          { name: 'patternName', value: { stringValue: `pattern_${errorCode}` } },
          { name: 'errorCodePattern', value: { stringValue: errorCode } },
          { name: 'messagePattern', value: { stringValue: message.substring(0, 100) } },
        ]
      );
    } catch (e) {
      console.error('Failed to update error patterns:', e);
    }
  }

  private async sendAlert(errorId: string, error: Error, context: ErrorContext): Promise<void> {
    if (!this.alertTopicArn) return;

    try {
      await this.sns.send(
        new PublishCommand({
          TopicArn: this.alertTopicArn,
          Subject: `[RADIANT CRITICAL] ${error.message.substring(0, 50)}`,
          Message: JSON.stringify({
            errorId,
            message: error.message,
            service: context.sourceService,
            function: context.sourceFunction,
            tenantId: context.tenantId,
            timestamp: new Date().toISOString(),
          }),
        })
      );
    } catch (e) {
      console.error('Failed to send alert:', e);
    }
  }
}

export const errorLogger = new ErrorLogger();
