// RADIANT v4.18.0 - Security Types
// Type definitions for security monitoring and anomaly detection

export type AnomalyType = 
  | 'geographic'
  | 'session_hijack'
  | 'brute_force'
  | 'rate_limit'
  | 'credential_stuffing';

export type AnomalySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SecurityAnomaly {
  id: string;
  tenantId: string;
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  userId: string | null;
  ipAddress: string;
  details: Record<string, unknown>;
  isResolved: boolean;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  detectedAt: Date;
}

export interface SecurityMetrics {
  totalAnomalies24h: number;
  criticalCount: number;
  highCount: number;
  blockedIps: number;
  suspiciousLogins: number;
  activeThreats: number;
}

export interface IpBlocklistEntry {
  id: string;
  tenantId: string | null;
  ipAddress: string;
  reason: string | null;
  blockedBy: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface AuthEvent {
  id: string;
  tenantId: string;
  userId: string | null;
  email: string | null;
  eventType: AuthEventType;
  ipAddress: string | null;
  userAgent: string | null;
  geoLocation: string | null;
  sessionId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export type AuthEventType = 
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'password_reset'
  | 'mfa_enabled'
  | 'mfa_disabled';

export interface SecurityComplianceFinding {
  id: string;
  severity: AnomalySeverity;
  category: string;
  description: string;
  recommendation: string;
  status: 'open' | 'in_progress' | 'resolved';
}

export interface SecurityComplianceStats {
  overallScore: number;
  soc2Score: number;
  hipaaScore: number;
  gdprScore: number;
  iso27001Score: number;
  openFindings: number;
  lastAuditDate: Date | null;
}
