/**
 * RADIANT TMS - Scheduled Job Handlers
 * EventBridge-triggered Lambda functions for:
 * - Hard delete processing
 * - Deletion notifications
 * - Orphan user cleanup
 * - Compliance reporting
 */

import { ScheduledEvent } from 'aws-lambda';
import { tenantService } from '../services/tenant.service';
import { notificationService } from '../services/notification.service';
import { logger } from '../utils/logger';
import { executeStatement, executeStatementSingle, param, uuidParam } from '../utils/db';
import { HardDeleteResult, OrphanCheckResult, ComplianceReportResult } from '../types/tenant.types';

// ============================================================================
// HARD DELETE JOB (Daily 3:00 AM UTC)
// ============================================================================

export const hardDeleteJobHandler = async (event: ScheduledEvent) => {

  logger.info({ eventTime: event.time }, 'Starting hard delete job');

  const results: HardDeleteResult[] = [];
  const errors: Array<{ tenantId: string; error: string }> = [];

  try {
    // Get tenants ready for hard deletion
    const tenantsToDelete = await executeStatement<{
      id: string;
      name: string;
      displayName: string;
      kmsKeyArn: string | null;
    }>(
      `SELECT id, name, display_name as "displayName", kms_key_arn as "kmsKeyArn"
       FROM tenants
       WHERE status = 'pending_deletion'
       AND deletion_scheduled_at < NOW()
       ORDER BY deletion_scheduled_at ASC
       LIMIT 10`
    );

    if (tenantsToDelete.length === 0) {
      logger.info('No tenants ready for hard deletion');
      return { processed: 0, results: [], errors: [] };
    }

    logger.info({ count: tenantsToDelete.length }, 'Found tenants for hard deletion');

    for (const tenant of tenantsToDelete) {
      try {
        // Get user emails for notification before deletion
        const users = await executeStatement<{ email: string; displayName: string }>(
          `SELECT u.email, u.display_name as "displayName"
           FROM users u
           JOIN tenant_user_memberships m ON u.id = m.user_id
           WHERE m.tenant_id = $1::uuid`,
          [uuidParam('1', tenant.id)]
        );

        // Perform hard delete
        const result = await tenantService.hardDeleteTenant(tenant.id, {
          isSuperAdmin: true,
          traceId: event.id,
        });

        results.push(result);

        // Send deletion confirmation emails
        if (users.length > 0) {
          await notificationService.sendDeletionConfirmation(
            tenant.displayName,
            users.map(u => ({ email: u.email, name: u.displayName }))
          );
        }

        // Record deletion notification
        await executeStatement(
          `INSERT INTO tms_deletion_notifications (tenant_id, notification_type, sent_to, delivery_status)
           VALUES ($1::uuid, 'deleted', $2::jsonb, 'sent')`,
          [
            uuidParam('1', tenant.id),
            { name: '2', value: { stringValue: JSON.stringify(users.map(u => u.email)) } },
          ]
        );

        logger.info({ tenantId: tenant.id, tenantName: tenant.displayName }, 'Tenant hard deleted');

      } catch (error) {
        const err = error as Error;
        logger.error({ tenantId: tenant.id, error: err.message }, 'Error hard deleting tenant');
        errors.push({ tenantId: tenant.id, error: err.message });
      }
    }

    logger.info({
      processed: results.length,
      errors: errors.length,
    }, 'Hard delete job completed');

    return { processed: results.length, results, errors };

  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Hard delete job failed');
    throw error;
  }
};

// ============================================================================
// DELETION NOTIFICATION JOB (Daily 9:00 AM UTC)
// ============================================================================

export const deletionNotificationJobHandler = async (event: ScheduledEvent) => {

  logger.info({ eventTime: event.time }, 'Starting deletion notification job');

  const notificationsSent: Array<{ tenantId: string; type: string; recipients: number }> = [];
  const errors: Array<{ tenantId: string; error: string }> = [];

  try {
    // Get notification schedule from settings
    const notificationDays = [7, 3, 1]; // Default if setting not found

    for (const daysRemaining of notificationDays) {
      const notificationType = `${daysRemaining}_day` as '7_day' | '3_day' | '1_day';

      // Find tenants that need notification
      const tenantsToNotify = await executeStatement<{
        id: string;
        displayName: string;
        deletionScheduledAt: string;
      }>(
        `SELECT t.id, t.display_name as "displayName", t.deletion_scheduled_at as "deletionScheduledAt"
         FROM tenants t
         WHERE t.status = 'pending_deletion'
         AND t.deletion_scheduled_at::date = (NOW() + interval '${daysRemaining} days')::date
         AND NOT EXISTS (
           SELECT 1 FROM tms_deletion_notifications n
           WHERE n.tenant_id = t.id AND n.notification_type = $1
         )`,
        [param('1', notificationType)]
      );

      for (const tenant of tenantsToNotify) {
        try {
          // Get users to notify
          const users = await executeStatement<{ email: string; displayName: string }>(
            `SELECT u.email, u.display_name as "displayName"
             FROM users u
             JOIN tenant_user_memberships m ON u.id = m.user_id
             WHERE m.tenant_id = $1::uuid AND m.status = 'active'`,
            [uuidParam('1', tenant.id)]
          );

          if (users.length > 0) {
            await notificationService.sendDeletionWarning(
              tenant.id,
              tenant.displayName,
              users.map(u => ({ email: u.email, name: u.displayName })),
              daysRemaining,
              notificationType
            );

            notificationsSent.push({
              tenantId: tenant.id,
              type: notificationType,
              recipients: users.length,
            });

            logger.info({
              tenantId: tenant.id,
              type: notificationType,
              recipients: users.length,
            }, 'Deletion notification sent');
          }

        } catch (error) {
          const err = error as Error;
          logger.error({
            tenantId: tenant.id,
            type: notificationType,
            error: err.message,
          }, 'Error sending deletion notification');
          errors.push({ tenantId: tenant.id, error: err.message });
        }
      }
    }

    logger.info({
      notificationsSent: notificationsSent.length,
      errors: errors.length,
    }, 'Deletion notification job completed');

    return { notificationsSent, errors };

  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Deletion notification job failed');
    throw error;
  }
};

// ============================================================================
// ORPHAN USER CHECK JOB (Weekly Sunday 2:00 AM UTC)
// ============================================================================

export const orphanCheckJobHandler = async (event: ScheduledEvent): Promise<OrphanCheckResult> => {

  logger.info({ eventTime: event.time }, 'Starting orphan user check job');

  try {
    // Find users with no active memberships (shouldn't exist if triggers work correctly)
    const orphanUsers = await executeStatement<{
      id: string;
      email: string;
      displayName: string;
      lastMembershipRemovedAt: string;
    }>(
      `SELECT u.id, u.email, u.display_name as "displayName", u.updated_at as "lastMembershipRemovedAt"
       FROM users u
       WHERE u.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM tenant_user_memberships m
         WHERE m.user_id = u.id AND m.status IN ('active', 'invited')
       )`
    );

    const deletedOrphans: Array<{ userId: string; email: string; deletedAt: string }> = [];

    for (const orphan of orphanUsers) {
      logger.warn({ userId: orphan.id, email: orphan.email }, 'Found orphan user - this should not happen');

      // Mark user as deleted
      await executeStatement(
        `UPDATE users SET status = 'deleted', updated_at = NOW() WHERE id = $1::uuid`,
        [uuidParam('1', orphan.id)]
      );

      // Log in audit
      await executeStatement(
        `INSERT INTO tms_audit_log (user_id, action, resource_type, resource_id, new_value)
         VALUES ($1::uuid, 'orphan_user_cleanup', 'user', $1, $2::jsonb)`,
        [
          uuidParam('1', orphan.id),
          { name: '2', value: { stringValue: JSON.stringify({ email: orphan.email, reason: 'scheduled_cleanup' }) } },
        ]
      );

      deletedOrphans.push({
        userId: orphan.id,
        email: orphan.email,
        deletedAt: new Date().toISOString(),
      });
    }

    const result: OrphanCheckResult = {
      orphansFound: orphanUsers.length,
      orphansDeleted: deletedOrphans.length,
      orphanUsers: deletedOrphans,
    };

    if (orphanUsers.length > 0) {
      // Notify security team of unexpected orphans
      await notificationService.notifySecurityEvent('orphan_users_found', {
        orphansFound: orphanUsers.length,
        orphansDeleted: deletedOrphans.length,
        message: 'Orphan users detected and cleaned up. This may indicate a trigger failure.',
      });
    }

    logger.info(result, 'Orphan check job completed');

    return result;

  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Orphan check job failed');
    throw error;
  }
};

// ============================================================================
// COMPLIANCE REPORT JOB (Monthly 1st 4:00 AM UTC)
// ============================================================================

export const complianceReportJobHandler = async (event: ScheduledEvent): Promise<ComplianceReportResult> => {

  logger.info({ eventTime: event.time }, 'Starting compliance report job');

  try {
    // Get tenant compliance breakdown
    const complianceStats = await executeStatementSingle<{
      totalTenants: number;
      hipaaCount: number;
      soc2Count: number;
      gdprCount: number;
      noneCount: number;
    }>(
      `SELECT 
         COUNT(*)::integer as "totalTenants",
         COUNT(*) FILTER (WHERE compliance_mode @> '["hipaa"]')::integer as "hipaaCount",
         COUNT(*) FILTER (WHERE compliance_mode @> '["soc2"]')::integer as "soc2Count",
         COUNT(*) FILTER (WHERE compliance_mode @> '["gdpr"]')::integer as "gdprCount",
         COUNT(*) FILTER (WHERE compliance_mode = '[]'::jsonb)::integer as "noneCount"
       FROM tenants
       WHERE status NOT IN ('deleted')`
    );

    // Get risk acceptance stats
    const riskStats = await executeStatementSingle<{
      pendingCount: number;
      approvedCount: number;
      expiredCount: number;
    }>(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'pending')::integer as "pendingCount",
         COUNT(*) FILTER (WHERE status = 'approved')::integer as "approvedCount",
         COUNT(*) FILTER (WHERE status = 'expired')::integer as "expiredCount"
       FROM tms_risk_acceptances`
    );

    // Get retention compliance
    const retentionStats = await executeStatementSingle<{
      compliantCount: number;
      nonCompliantCount: number;
    }>(
      `SELECT 
         COUNT(*) FILTER (
           WHERE (NOT compliance_mode @> '["hipaa"]' OR retention_days >= 90)
         )::integer as "compliantCount",
         COUNT(*) FILTER (
           WHERE compliance_mode @> '["hipaa"]' AND retention_days < 90
         )::integer as "nonCompliantCount"
       FROM tenants
       WHERE status NOT IN ('deleted')`
    );

    const report: ComplianceReportResult = {
      generatedAt: new Date().toISOString(),
      totalTenants: complianceStats?.totalTenants || 0,
      complianceBreakdown: {
        hipaa: complianceStats?.hipaaCount || 0,
        soc2: complianceStats?.soc2Count || 0,
        gdpr: complianceStats?.gdprCount || 0,
        none: complianceStats?.noneCount || 0,
      },
      riskAcceptances: {
        pending: riskStats?.pendingCount || 0,
        approved: riskStats?.approvedCount || 0,
        expired: riskStats?.expiredCount || 0,
      },
      retentionCompliance: {
        compliant: retentionStats?.compliantCount || 0,
        nonCompliant: retentionStats?.nonCompliantCount || 0,
      },
    };

    // Store report in audit log
    await executeStatement(
      `INSERT INTO tms_audit_log (action, resource_type, new_value)
       VALUES ('compliance_report_generated', 'report', $1::jsonb)`,
      [{ name: '1', value: { stringValue: JSON.stringify(report) } }]
    );

    // Alert if there are non-compliant tenants
    if ((retentionStats?.nonCompliantCount || 0) > 0 || (riskStats?.expiredCount || 0) > 0) {
      await notificationService.notifySecurityEvent('compliance_issues_detected', {
        report,
        message: 'Compliance issues detected in monthly report',
      });
    }

    logger.info(report, 'Compliance report job completed');

    return report;

  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Compliance report job failed');
    throw error;
  }
};
