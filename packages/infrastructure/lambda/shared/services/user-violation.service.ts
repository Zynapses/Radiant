/**
 * RADIANT v5.19.0 - User Violation Enforcement Service
 * 
 * Comprehensive service for tracking, escalating, and enforcing
 * regulatory and policy violations by users.
 */

import { logger } from '../logging/enhanced-logger';
import { executeStatement } from '../db/client';
import { v4 as uuidv4 } from 'uuid';
import {
  UserViolation,
  ViolationCategory,
  UserViolationType,
  ViolationSeverity,
  ViolationStatus,
  EnforcementAction,
  ViolationEvidence,
  ViolationAppeal,
  AppealStatus,
  EscalationPolicy,
  EscalationRule,
  UserViolationSummary,
  UserViolationConfig,
  ReportViolationRequest,
  UpdateViolationRequest,
  SubmitAppealRequest,
  ReviewAppealRequest,
  ViolationSearchFilters,
  ViolationMetrics,
} from '@radiant/shared';

// Using shared logger

// ============================================================================
// User Violation Service
// ============================================================================

class UserViolationService {
  private static instance: UserViolationService;
  
  // In-memory stores (would be DB in production)
  private violations: Map<string, UserViolation> = new Map();
  private appeals: Map<string, ViolationAppeal> = new Map();
  private policies: Map<string, EscalationPolicy> = new Map();
  private configs: Map<string, UserViolationConfig> = new Map();
  private summaries: Map<string, UserViolationSummary> = new Map();

  private constructor() {}

  static getInstance(): UserViolationService {
    if (!UserViolationService.instance) {
      UserViolationService.instance = new UserViolationService();
    }
    return UserViolationService.instance;
  }

  // ==========================================================================
  // Configuration
  // ==========================================================================

  async getConfig(tenantId: string): Promise<UserViolationConfig> {
    if (this.configs.has(tenantId)) {
      return this.configs.get(tenantId)!;
    }

    const defaultConfig: UserViolationConfig = {
      tenantId,
      enabled: true,
      autoDetectionEnabled: true,
      autoEnforcementEnabled: false,
      notifyUserOnViolation: true,
      notifyUserOnAction: true,
      notifyAdminOnCritical: true,
      adminNotificationEmails: [],
      retentionDays: 2555,
      allowAppeals: true,
      appealWindowDays: 30,
      maxAppealsPerViolation: 2,
      requireEvidenceRedaction: true,
      auditAllActions: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.configs.set(tenantId, defaultConfig);
    return defaultConfig;
  }

  async updateConfig(
    tenantId: string,
    updates: Partial<UserViolationConfig>
  ): Promise<UserViolationConfig> {
    const current = await this.getConfig(tenantId);
    const updated = { ...current, ...updates, updatedAt: new Date() };
    this.configs.set(tenantId, updated);
    
    logger.info('Violation config updated', { tenantId });
    return updated;
  }

  // ==========================================================================
  // Violations
  // ==========================================================================

  async reportViolation(
    tenantId: string,
    reportedBy: string,
    request: ReportViolationRequest
  ): Promise<UserViolation> {
    const config = await this.getConfig(tenantId);
    
    if (!config.enabled) {
      throw new Error('Violation tracking is disabled for this tenant');
    }

    const violation: UserViolation = {
      id: uuidv4(),
      tenantId,
      userId: request.userId,
      category: request.category,
      type: request.type,
      severity: request.severity,
      status: 'reported',
      title: request.title,
      description: request.description,
      evidence: request.evidence?.map(e => ({
        ...e,
        id: uuidv4(),
        collectedAt: new Date(),
        collectedBy: reportedBy,
      })),
      detectionMethod: 'manual_report',
      relatedResourceType: request.relatedResourceType,
      relatedResourceId: request.relatedResourceId,
      occurredAt: request.occurredAt || new Date(),
      reportedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.violations.set(violation.id, violation);
    await this.updateUserSummary(tenantId, request.userId);
    
    logger.info('Violation reported', {
      tenantId,
      violationId: violation.id,
      userId: request.userId,
      category: request.category,
      severity: request.severity,
    });

    // Check for auto-escalation
    if (config.autoEnforcementEnabled) {
      await this.checkAndApplyEscalation(tenantId, request.userId, violation);
    }

    // Audit log
    await this.auditAction(tenantId, violation.id, reportedBy, 'admin', 'violation_reported', {
      category: request.category,
      severity: request.severity,
    });

    return violation;
  }

  async getViolation(tenantId: string, violationId: string): Promise<UserViolation | null> {
    const violation = this.violations.get(violationId);
    if (violation && violation.tenantId === tenantId) {
      return violation;
    }
    return null;
  }

  async updateViolation(
    tenantId: string,
    violationId: string,
    updates: UpdateViolationRequest,
    updatedBy: string
  ): Promise<UserViolation> {
    const violation = await this.getViolation(tenantId, violationId);
    if (!violation) {
      throw new Error('Violation not found');
    }

    const updated: UserViolation = {
      ...violation,
      ...updates,
      updatedAt: new Date(),
    };

    if (updates.actionTaken) {
      updated.actionTakenAt = new Date();
      updated.actionTakenBy = updatedBy;
    }

    if (updates.status === 'resolved') {
      updated.resolvedAt = new Date();
    }

    this.violations.set(violationId, updated);
    await this.updateUserSummary(tenantId, violation.userId);

    logger.info('Violation updated', {
      tenantId,
      violationId,
      updates: Object.keys(updates),
    });

    await this.auditAction(tenantId, violationId, updatedBy, 'admin', 'violation_updated', updates as any);

    return updated;
  }

  async searchViolations(
    tenantId: string,
    filters: ViolationSearchFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ violations: UserViolation[]; total: number }> {
    let results = Array.from(this.violations.values())
      .filter(v => v.tenantId === tenantId);

    if (filters.userId) {
      results = results.filter(v => v.userId === filters.userId);
    }
    if (filters.category) {
      results = results.filter(v => v.category === filters.category);
    }
    if (filters.type) {
      results = results.filter(v => v.type === filters.type);
    }
    if (filters.severity) {
      results = results.filter(v => v.severity === filters.severity);
    }
    if (filters.status) {
      results = results.filter(v => v.status === filters.status);
    }
    if (filters.dateFrom) {
      results = results.filter(v => v.occurredAt >= filters.dateFrom!);
    }
    if (filters.dateTo) {
      results = results.filter(v => v.occurredAt <= filters.dateTo!);
    }
    if (filters.hasActiveEnforcement) {
      results = results.filter(v => v.actionTaken && !v.resolvedAt);
    }

    // Sort by occurred date descending
    results.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    const total = results.length;
    const violations = results.slice(offset, offset + limit);

    return { violations, total };
  }

  async getUserViolations(
    tenantId: string,
    userId: string
  ): Promise<UserViolation[]> {
    const { violations } = await this.searchViolations(tenantId, { userId }, 100, 0);
    return violations;
  }

  // ==========================================================================
  // Appeals
  // ==========================================================================

  async submitAppeal(
    tenantId: string,
    userId: string,
    request: SubmitAppealRequest
  ): Promise<ViolationAppeal> {
    const config = await this.getConfig(tenantId);
    
    if (!config.allowAppeals) {
      throw new Error('Appeals are not allowed for this tenant');
    }

    const violation = await this.getViolation(tenantId, request.violationId);
    if (!violation) {
      throw new Error('Violation not found');
    }

    if (violation.userId !== userId) {
      throw new Error('Cannot appeal violations for other users');
    }

    // Check appeal window
    const appealDeadline = new Date(violation.reportedAt);
    appealDeadline.setDate(appealDeadline.getDate() + config.appealWindowDays);
    if (new Date() > appealDeadline) {
      throw new Error('Appeal window has expired');
    }

    // Check max appeals
    const existingAppeals = Array.from(this.appeals.values())
      .filter(a => a.violationId === request.violationId);
    if (existingAppeals.length >= config.maxAppealsPerViolation) {
      throw new Error('Maximum number of appeals reached for this violation');
    }

    const appeal: ViolationAppeal = {
      id: uuidv4(),
      violationId: request.violationId,
      tenantId,
      userId,
      reason: request.reason,
      explanation: request.explanation,
      supportingEvidence: request.supportingEvidence,
      status: 'pending',
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.appeals.set(appeal.id, appeal);

    // Update violation status
    await this.updateViolation(tenantId, request.violationId, { status: 'appealed' }, userId);

    logger.info('Appeal submitted', {
      tenantId,
      appealId: appeal.id,
      violationId: request.violationId,
    });

    await this.auditAction(tenantId, request.violationId, userId, 'user', 'appeal_submitted', {
      appealId: appeal.id,
    });

    return appeal;
  }

  async reviewAppeal(
    tenantId: string,
    appealId: string,
    reviewerId: string,
    request: ReviewAppealRequest
  ): Promise<ViolationAppeal> {
    const appeal = this.appeals.get(appealId);
    if (!appeal || appeal.tenantId !== tenantId) {
      throw new Error('Appeal not found');
    }

    const updated: ViolationAppeal = {
      ...appeal,
      status: request.decision === 'overturned' ? 'approved' : 'denied',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewNotes: request.reviewNotes,
      decision: request.decision,
      updatedAt: new Date(),
    };

    this.appeals.set(appealId, updated);

    // Update violation based on decision
    const violation = await this.getViolation(tenantId, appeal.violationId);
    if (violation) {
      if (request.decision === 'overturned') {
        await this.updateViolation(tenantId, appeal.violationId, {
          status: 'dismissed',
          actionTaken: 'no_action',
        }, reviewerId);
      } else if (request.decision === 'reduced' && request.newAction) {
        await this.updateViolation(tenantId, appeal.violationId, {
          status: 'resolved',
          actionTaken: request.newAction,
        }, reviewerId);
      } else {
        await this.updateViolation(tenantId, appeal.violationId, {
          status: 'confirmed',
        }, reviewerId);
      }
    }

    logger.info('Appeal reviewed', {
      tenantId,
      appealId,
      decision: request.decision,
    });

    await this.auditAction(tenantId, appeal.violationId, reviewerId, 'admin', 'appeal_reviewed', {
      appealId,
      decision: request.decision,
    });

    return updated;
  }

  async getAppeal(tenantId: string, appealId: string): Promise<ViolationAppeal | null> {
    const appeal = this.appeals.get(appealId);
    if (appeal && appeal.tenantId === tenantId) {
      return appeal;
    }
    return null;
  }

  async getPendingAppeals(tenantId: string): Promise<ViolationAppeal[]> {
    return Array.from(this.appeals.values())
      .filter(a => a.tenantId === tenantId && (a.status === 'pending' || a.status === 'under_review'))
      .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
  }

  // ==========================================================================
  // Enforcement Actions
  // ==========================================================================

  async takeAction(
    tenantId: string,
    violationId: string,
    action: EnforcementAction,
    actionBy: string,
    notes?: string,
    expiresAt?: Date
  ): Promise<UserViolation> {
    const violation = await this.getViolation(tenantId, violationId);
    if (!violation) {
      throw new Error('Violation not found');
    }

    const updated = await this.updateViolation(tenantId, violationId, {
      status: 'resolved',
      actionTaken: action,
      actionExpiresAt: expiresAt,
      actionNotes: notes,
    }, actionBy);

    // Update user summary with enforcement action
    await this.applyEnforcementToUser(tenantId, violation.userId, action, expiresAt);

    logger.warn('Enforcement action taken', {
      tenantId,
      violationId,
      userId: violation.userId,
      action,
    });

    return updated;
  }

  async suspendUser(
    tenantId: string,
    userId: string,
    reason: string,
    duration?: number // days
  ): Promise<void> {
    const expiresAt = duration 
      ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000)
      : undefined;

    await this.applyEnforcementToUser(
      tenantId, 
      userId, 
      duration ? 'temporarily_suspended' : 'permanently_suspended',
      expiresAt
    );

    logger.warn('User suspended', { tenantId, userId, duration, reason });
  }

  async reinstateUser(
    tenantId: string,
    userId: string,
    reinstatedBy: string,
    reason: string
  ): Promise<void> {
    const summary = await this.getUserSummary(tenantId, userId);
    if (summary) {
      summary.currentEnforcementAction = undefined;
      summary.enforcementExpiresAt = undefined;
      (summary as any).updated_at = new Date();
      this.summaries.set(`${tenantId}:${userId}`, summary);
    }

    logger.info('User reinstated', { tenantId, userId, reinstatedBy, reason });

    await this.auditAction(tenantId, undefined, reinstatedBy, 'admin', 'user_reinstated', {
      userId,
      reason,
    });
  }

  // ==========================================================================
  // User Summary
  // ==========================================================================

  async getUserSummary(tenantId: string, userId: string): Promise<UserViolationSummary | null> {
    const key = `${tenantId}:${userId}`;
    return this.summaries.get(key) || null;
  }

  private async updateUserSummary(tenantId: string, userId: string): Promise<void> {
    const violations = await this.getUserViolations(tenantId, userId);
    const appeals = Array.from(this.appeals.values())
      .filter(a => a.tenantId === tenantId && a.userId === userId);

    const activeViolations = violations.filter(v => 
      !['resolved', 'dismissed'].includes(v.status)
    );

    const categoryCount: Record<ViolationCategory, number> = {
      hipaa: 0, gdpr: 0, soc2: 0, terms_of_service: 0, acceptable_use: 0,
      content_policy: 0, security: 0, billing: 0, abuse: 0, other: 0,
    };
    violations.forEach(v => {
      categoryCount[v.category] = (categoryCount[v.category] || 0) + 1;
    });

    const riskScore = Math.min(100, activeViolations.reduce((sum, v) => {
      const scores: Record<ViolationSeverity, number> = {
        critical: 40, major: 20, minor: 10, warning: 5,
      };
      return sum + (scores[v.severity] || 0);
    }, 0));

    let riskLevel: 'low' | 'moderate' | 'elevated' | 'high' | 'critical' = 'low';
    if (activeViolations.some(v => v.severity === 'critical')) {
      riskLevel = 'critical';
    } else if (activeViolations.filter(v => v.severity === 'major').length >= 2) {
      riskLevel = 'high';
    } else if (activeViolations.length >= 5) {
      riskLevel = 'elevated';
    } else if (activeViolations.length >= 2) {
      riskLevel = 'moderate';
    }

    const existing = this.summaries.get(`${tenantId}:${userId}`);

    const summary: UserViolationSummary = {
      userId,
      tenantId,
      totalViolations: violations.length,
      activeViolations: activeViolations.length,
      resolvedViolations: violations.filter(v => v.status === 'resolved').length,
      warningCount: violations.filter(v => v.severity === 'warning').length,
      minorCount: violations.filter(v => v.severity === 'minor').length,
      majorCount: violations.filter(v => v.severity === 'major').length,
      criticalCount: violations.filter(v => v.severity === 'critical').length,
      violationsByCategory: categoryCount,
      currentEnforcementAction: existing?.currentEnforcementAction,
      enforcementExpiresAt: existing?.enforcementExpiresAt,
      riskLevel,
      riskScore,
      firstViolationAt: violations.length > 0 
        ? new Date(Math.min(...violations.map(v => v.occurredAt.getTime())))
        : undefined,
      lastViolationAt: violations.length > 0
        ? new Date(Math.max(...violations.map(v => v.occurredAt.getTime())))
        : undefined,
      lastActionTakenAt: violations.find(v => v.actionTakenAt)?.actionTakenAt,
      pendingAppeals: appeals.filter(a => a.status === 'pending').length,
      appealSuccessRate: appeals.length > 0
        ? appeals.filter(a => a.status === 'approved').length / appeals.length
        : undefined,
    };

    this.summaries.set(`${tenantId}:${userId}`, summary);
  }

  private async applyEnforcementToUser(
    tenantId: string,
    userId: string,
    action: EnforcementAction,
    expiresAt?: Date
  ): Promise<void> {
    await this.updateUserSummary(tenantId, userId);
    const summary = await this.getUserSummary(tenantId, userId);
    if (summary) {
      summary.currentEnforcementAction = action;
      summary.enforcementExpiresAt = expiresAt;
      summary.lastActionTakenAt = new Date();
      this.summaries.set(`${tenantId}:${userId}`, summary);
    }
  }

  // ==========================================================================
  // Escalation Policies
  // ==========================================================================

  async getEscalationPolicy(tenantId: string, policyId?: string): Promise<EscalationPolicy | null> {
    if (policyId) {
      const policy = this.policies.get(policyId);
      if (policy && policy.tenantId === tenantId) {
        return policy;
      }
    }
    
    // Get default policy
    return Array.from(this.policies.values())
      .find(p => p.tenantId === tenantId && p.enabled) || null;
  }

  async createEscalationPolicy(
    tenantId: string,
    name: string,
    description: string,
    rules: Omit<EscalationRule, 'id'>[]
  ): Promise<EscalationPolicy> {
    const policy: EscalationPolicy = {
      id: uuidv4(),
      tenantId,
      name,
      description,
      enabled: true,
      rules: rules.map((r, i) => ({ ...r, id: uuidv4(), order: i })),
      notifyUserOnViolation: true,
      notifyUserOnAction: true,
      notifyAdminOnCritical: true,
      adminNotificationEmails: [],
      violationWindowDays: 90,
      cooldownPeriodDays: 365,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.policies.set(policy.id, policy);
    logger.info('Escalation policy created', { tenantId, policyId: policy.id });

    return policy;
  }

  private async checkAndApplyEscalation(
    tenantId: string,
    userId: string,
    newViolation: UserViolation
  ): Promise<void> {
    const policy = await this.getEscalationPolicy(tenantId);
    if (!policy) return;

    const violations = await this.getUserViolations(tenantId, userId);
    const windowDate = new Date();
    windowDate.setDate(windowDate.getDate() - policy.violationWindowDays);
    
    const recentViolations = violations.filter(v => v.occurredAt >= windowDate);

    for (const rule of policy.rules.sort((a, b) => a.order - b.order)) {
      let triggered = false;

      if (rule.triggerType === 'count' && rule.violationCount) {
        triggered = recentViolations.length >= rule.violationCount;
      } else if (rule.triggerType === 'severity' && rule.severityThreshold) {
        const severityOrder: ViolationSeverity[] = ['warning', 'minor', 'major', 'critical'];
        const thresholdIndex = severityOrder.indexOf(rule.severityThreshold);
        triggered = newViolation.severity && 
          severityOrder.indexOf(newViolation.severity) >= thresholdIndex;
      } else if (rule.triggerType === 'category' && rule.categories?.length) {
        triggered = rule.categories.includes(newViolation.category);
      }

      if (triggered) {
        if (rule.requiresManualReview) {
          await this.updateViolation(tenantId, newViolation.id, {
            status: 'investigating',
          }, 'system');
        } else {
          const expiresAt = rule.actionDurationDays
            ? new Date(Date.now() + rule.actionDurationDays * 24 * 60 * 60 * 1000)
            : undefined;
          
          await this.takeAction(
            tenantId,
            newViolation.id,
            rule.action,
            'system',
            `Auto-escalated by policy: ${policy.name}`,
            expiresAt
          );
        }
        break;
      }
    }
  }

  // ==========================================================================
  // Metrics
  // ==========================================================================

  async getMetrics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ViolationMetrics> {
    const violations = Array.from(this.violations.values())
      .filter(v => v.tenantId === tenantId && v.occurredAt >= startDate && v.occurredAt <= endDate);
    
    const appeals = Array.from(this.appeals.values())
      .filter(a => a.tenantId === tenantId && a.submittedAt >= startDate && a.submittedAt <= endDate);

    const byCategory: Record<ViolationCategory, number> = {
      hipaa: 0, gdpr: 0, soc2: 0, terms_of_service: 0, acceptable_use: 0,
      content_policy: 0, security: 0, billing: 0, abuse: 0, other: 0,
    };
    const bySeverity: Record<ViolationSeverity, number> = {
      warning: 0, minor: 0, major: 0, critical: 0,
    };
    const byStatus: Record<ViolationStatus, number> = {
      reported: 0, investigating: 0, confirmed: 0, dismissed: 0,
      appealed: 0, resolved: 0, escalated: 0,
    };
    const actionsTaken: Record<EnforcementAction, number> = {
      warning_issued: 0, feature_restricted: 0, rate_limited: 0,
      temporarily_suspended: 0, permanently_suspended: 0,
      account_terminated: 0, reported_to_authorities: 0, no_action: 0,
    };

    violations.forEach(v => {
      byCategory[v.category]++;
      bySeverity[v.severity]++;
      byStatus[v.status]++;
      if (v.actionTaken) {
        actionsTaken[v.actionTaken]++;
      }
    });

    // Calculate trend (compare to previous period)
    const periodLength = endDate.getTime() - startDate.getTime();
    const prevStart = new Date(startDate.getTime() - periodLength);
    const prevViolations = Array.from(this.violations.values())
      .filter(v => v.tenantId === tenantId && v.occurredAt >= prevStart && v.occurredAt < startDate);
    
    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (violations.length > prevViolations.length * 1.1) {
      trend = 'increasing';
    } else if (violations.length < prevViolations.length * 0.9) {
      trend = 'decreasing';
    }

    // Average resolution time
    const resolvedViolations = violations.filter(v => v.resolvedAt);
    const avgResolutionMs = resolvedViolations.length > 0
      ? resolvedViolations.reduce((sum, v) => 
          sum + (v.resolvedAt!.getTime() - v.reportedAt.getTime()), 0
        ) / resolvedViolations.length
      : 0;

    return {
      tenantId,
      period: { start: startDate, end: endDate },
      totalViolations: violations.length,
      newViolations: violations.filter(v => v.status === 'reported').length,
      resolvedViolations: resolvedViolations.length,
      byCategory,
      bySeverity,
      byStatus,
      actionsTaken,
      totalAppeals: appeals.length,
      appealsApproved: appeals.filter(a => a.status === 'approved').length,
      appealsDenied: appeals.filter(a => a.status === 'denied').length,
      violationTrend: trend,
      averageResolutionTimeHours: avgResolutionMs / (1000 * 60 * 60),
    };
  }

  // ==========================================================================
  // Audit
  // ==========================================================================

  private async auditAction(
    tenantId: string,
    violationId: string | undefined,
    actorId: string,
    actorType: 'system' | 'admin' | 'user',
    action: string,
    details: Record<string, unknown>
  ): Promise<void> {
    // Write to violation_audit_log table for compliance tracking
    try {
      await executeStatement(
        `INSERT INTO violation_audit_log (
          tenant_id, violation_id, actor_id, actor_type, action, details, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'violationId', value: violationId ? { stringValue: violationId } : { isNull: true } },
          { name: 'actorId', value: { stringValue: actorId } },
          { name: 'actorType', value: { stringValue: actorType } },
          { name: 'action', value: { stringValue: action } },
          { name: 'details', value: { stringValue: JSON.stringify(details) } },
        ]
      );
    } catch (dbError) {
      // Log but don't fail the main operation if audit logging fails
      logger.warn('Failed to write violation audit log', { 
        tenantId, violationId, action, error: dbError 
      });
    }
    
    // Also log for immediate visibility
    logger.info('Violation audit', {
      tenantId,
      violationId,
      actorId,
      actorType,
      action,
      details,
    });
  }

  // ==========================================================================
  // Dashboard Data
  // ==========================================================================

  async getDashboardData(tenantId: string): Promise<{
    config: UserViolationConfig;
    recentViolations: UserViolation[];
    pendingAppeals: ViolationAppeal[];
    metrics: ViolationMetrics;
    highRiskUsers: UserViolationSummary[];
  }> {
    const config = await this.getConfig(tenantId);
    
    const { violations: recentViolations } = await this.searchViolations(
      tenantId, {}, 10, 0
    );
    
    const pendingAppeals = await this.getPendingAppeals(tenantId);
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const metrics = await this.getMetrics(tenantId, thirtyDaysAgo, now);
    
    const highRiskUsers = Array.from(this.summaries.values())
      .filter(s => s.tenantId === tenantId && ['elevated', 'high', 'critical'].includes(s.riskLevel))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10);

    return {
      config,
      recentViolations,
      pendingAppeals,
      metrics,
      highRiskUsers,
    };
  }
}

// Export singleton
export const userViolationService = UserViolationService.getInstance();
