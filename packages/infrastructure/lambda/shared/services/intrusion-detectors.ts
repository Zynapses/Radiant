/**
 * RADIANT v4.18.0 — Intrusion Detectors (14 MITRE-Mapped)
 *
 * Each detector implements the ThreatDetector interface and analyzes
 * RequestSignals against sliding windows to detect specific attack patterns.
 *
 * Standards mapping per detector noted in comments.
 */

import {
  ThreatDetector,
  DetectionResult,
  RequestSignal,
  SlidingWindowStore,
  IntrusionSeverity,
  ResponseAction,
  threatDetectionEngine,
} from './intrusion-detection.service';

// ============================================================================
// Helper: distance between two lat/lon points (Haversine formula)
// ============================================================================

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================================
// 1. Brute Force Authentication
// MITRE: T1110.001 | NIST 800-94 §4.3, OWASP OAT-007, CIS 13.3
// ============================================================================

class BruteForceAuthDetector implements ThreatDetector {
  id = 'brute_force_auth';
  mitreTechnique = 'T1110.001';
  standardRefs = ['NIST-800-94-4.3', 'OWASP-OAT-007', 'CIS-13.3'];

  analyze(signal: RequestSignal, windows: SlidingWindowStore): DetectionResult | null {
    if (signal.authSuccess !== false) return null;

    const config = threatDetectionEngine.getThresholdConfig(this.id);
    const maxFailures = (config.max_failures as number) || 5;
    const windowSeconds = (config.window_seconds as number) || 300;

    const failCount = windows.countInWindow(
      `ip:${signal.sourceIp}:auth_failures`,
      windowSeconds * 1000
    );

    if (failCount < maxFailures) return null;

    const confidence = Math.min(0.5 + (failCount - maxFailures) * 0.1, 0.95);
    const severity: IntrusionSeverity = failCount >= maxFailures * 3 ? 'high' : 'medium';

    return {
      detected: true,
      detectorId: this.id,
      mitreTechnique: this.mitreTechnique,
      severity,
      confidence,
      title: 'Brute Force Authentication',
      message: `${failCount} authentication failures from ${signal.sourceIp} in ${windowSeconds}s`,
      details: { failCount, threshold: maxFailures, windowSeconds, ip: signal.sourceIp },
      recommendedActions: ['rate_limit', 'alert_admin'],
    };
  }
}

// ============================================================================
// 2. Credential Stuffing
// MITRE: T1110.004 | OWASP OAT-008, NIST CSF DE.CM-01, SOC2 CC7.2
// ============================================================================

class CredentialStuffingDetector implements ThreatDetector {
  id = 'credential_stuffing';
  mitreTechnique = 'T1110.004';
  standardRefs = ['OWASP-OAT-008', 'NIST-CSF-DE.CM-01', 'SOC2-CC7.2'];

  analyze(signal: RequestSignal, windows: SlidingWindowStore): DetectionResult | null {
    if (signal.authSuccess !== false) return null;

    const config = threatDetectionEngine.getThresholdConfig(this.id);
    const maxUniqueUsers = (config.max_unique_users as number) || 10;
    const windowSeconds = (config.window_seconds as number) || 60;
    const minFailureRate = (config.min_failure_rate as number) || 0.8;

    const windowMs = windowSeconds * 1000;
    const uniqueUsers = windows.uniqueValues(
      `ip:${signal.sourceIp}:auth_failures`,
      windowMs,
      'userId'
    );

    if (uniqueUsers.size < maxUniqueUsers) return null;

    const totalRequests = windows.countInWindow(`ip:${signal.sourceIp}:requests`, windowMs);
    const failCount = windows.countInWindow(`ip:${signal.sourceIp}:auth_failures`, windowMs);
    const failureRate = totalRequests > 0 ? failCount / totalRequests : 0;

    if (failureRate < minFailureRate) return null;

    return {
      detected: true,
      detectorId: this.id,
      mitreTechnique: this.mitreTechnique,
      severity: 'high',
      confidence: Math.min(0.7 + (uniqueUsers.size / maxUniqueUsers) * 0.1, 0.95),
      title: 'Credential Stuffing Attack',
      message: `${uniqueUsers.size} unique usernames attempted from ${signal.sourceIp} with ${(failureRate * 100).toFixed(0)}% failure rate`,
      details: {
        uniqueUsers: uniqueUsers.size,
        failureRate,
        totalRequests,
        failCount,
        ip: signal.sourceIp,
      },
      recommendedActions: ['ban_ip', 'alert_admin'],
    };
  }
}

// ============================================================================
// 3. Impossible Travel
// MITRE: T1078.004 | NIST CSF DE.AE-03, ISO 27001 A.8.16
// ============================================================================

class ImpossibleTravelDetector implements ThreatDetector {
  id = 'impossible_travel';
  mitreTechnique = 'T1078.004';
  standardRefs = ['NIST-CSF-DE.AE-03', 'ISO27001-A.8.16'];

  analyze(signal: RequestSignal, windows: SlidingWindowStore): DetectionResult | null {
    if (signal.authSuccess !== true || !signal.userId) return null;
    if (!signal.geoLat || !signal.geoLon) return null;

    const config = threatDetectionEngine.getThresholdConfig(this.id);
    const minDistanceKm = (config.min_distance_km as number) || 500;
    const maxTimeMinutes = (config.max_time_minutes as number) || 60;

    const lastAuth = windows.getLast(`user:${signal.userId}:auth_success`);
    if (!lastAuth) return null;

    const prevLat = lastAuth.data.geoLat as number;
    const prevLon = lastAuth.data.geoLon as number;
    if (!prevLat || !prevLon) return null;

    const distance = haversineKm(prevLat, prevLon, signal.geoLat, signal.geoLon);
    const timeDiffMinutes = (Date.now() - lastAuth.timestamp) / 60000;

    if (distance < minDistanceKm || timeDiffMinutes > maxTimeMinutes) return null;

    // Calculate required speed (km/h) — commercial flight is ~900 km/h
    const requiredSpeedKph = (distance / timeDiffMinutes) * 60;
    const isPhysicallyImpossible = requiredSpeedKph > 1200;

    return {
      detected: true,
      detectorId: this.id,
      mitreTechnique: this.mitreTechnique,
      severity: isPhysicallyImpossible ? 'high' : 'medium',
      confidence: Math.min(0.5 + (requiredSpeedKph / 2000) * 0.4, 0.95),
      title: 'Impossible Travel Detected',
      message: `Authentication from ${signal.geoCountry || 'unknown'} (${signal.geoCity || '?'}) after previous auth from ${lastAuth.data.geoCountry || 'unknown'} — ${distance.toFixed(0)}km in ${timeDiffMinutes.toFixed(0)}min (${requiredSpeedKph.toFixed(0)} km/h required)`,
      details: {
        distance: Math.round(distance),
        timeDiffMinutes: Math.round(timeDiffMinutes),
        requiredSpeedKph: Math.round(requiredSpeedKph),
        currentLocation: { country: signal.geoCountry, city: signal.geoCity },
        previousLocation: { country: lastAuth.data.geoCountry, city: lastAuth.data.geoCity },
      },
      recommendedActions: ['challenge', 'alert_admin'],
    };
  }
}

// ============================================================================
// 4. Session Hijacking
// MITRE: T1550.004 | OWASP ASVS 3.7, NIST 800-94 §4.3
// ============================================================================

class SessionHijackDetector implements ThreatDetector {
  id = 'session_hijack';
  mitreTechnique = 'T1550.004';
  standardRefs = ['OWASP-ASVS-3.7', 'NIST-800-94-4.3'];

  analyze(signal: RequestSignal, windows: SlidingWindowStore): DetectionResult | null {
    if (!signal.userId || !signal.sessionId) return null;

    const config = threatDetectionEngine.getThresholdConfig(this.id);
    const detectIpChange = (config.detect_ip_change as boolean) ?? true;
    const detectUaChange = (config.detect_ua_change as boolean) ?? true;
    const detectCountryChange = (config.detect_country_change as boolean) ?? true;

    const lastAuth = windows.getLast(`user:${signal.userId}:auth_success`);
    if (!lastAuth) return null;

    // Only check if same session ID
    if (lastAuth.data.sessionId !== signal.sessionId) return null;

    const anomalies: string[] = [];

    if (detectIpChange && lastAuth.data.ip && lastAuth.data.ip !== signal.sourceIp) {
      anomalies.push(`IP changed: ${lastAuth.data.ip} → ${signal.sourceIp}`);
    }

    if (detectUaChange && lastAuth.data.userAgent && lastAuth.data.userAgent !== signal.userAgent) {
      anomalies.push(`User-Agent changed mid-session`);
    }

    if (detectCountryChange && lastAuth.data.geoCountry && signal.geoCountry &&
        lastAuth.data.geoCountry !== signal.geoCountry) {
      anomalies.push(`Country changed: ${lastAuth.data.geoCountry} → ${signal.geoCountry}`);
    }

    if (anomalies.length === 0) return null;

    return {
      detected: true,
      detectorId: this.id,
      mitreTechnique: this.mitreTechnique,
      severity: anomalies.length >= 2 ? 'high' : 'medium',
      confidence: Math.min(0.6 + anomalies.length * 0.15, 0.95),
      title: 'Session Hijack Suspected',
      message: `Session ${signal.sessionId?.substring(0, 8)}... shows ${anomalies.length} anomalies: ${anomalies.join('; ')}`,
      details: { anomalies, sessionId: signal.sessionId, userId: signal.userId },
      recommendedActions: ['kill_session', 'alert_admin'],
    };
  }
}

// ============================================================================
// 5. Cross-Tenant Probe
// MITRE: T1078 | SOC2 CC6.6, NIST CSF DE.CM-05
// ============================================================================

class CrossTenantProbeDetector implements ThreatDetector {
  id = 'cross_tenant_probe';
  mitreTechnique = 'T1078';
  standardRefs = ['SOC2-CC6.6', 'NIST-CSF-DE.CM-05'];

  // Common UUID v4 pattern
  private uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

  analyze(signal: RequestSignal, windows: SlidingWindowStore): DetectionResult | null {
    if (!signal.tenantId) return null;

    const config = threatDetectionEngine.getThresholdConfig(this.id);
    const maxCrossTenantRefs = (config.max_cross_tenant_refs as number) || 3;
    const windowSeconds = (config.window_seconds as number) || 300;

    // Check path and body for UUIDs that don't match the authenticated tenant
    const pathUuids = signal.path.match(this.uuidPattern) || [];
    const bodyUuids = signal.body ? (signal.body.match(this.uuidPattern) || []) : [];
    const allUuids = [...pathUuids, ...bodyUuids];

    // Filter to UUIDs that are clearly not the authenticated tenant's ID
    const foreignUuids = allUuids.filter(
      id => id.toLowerCase() !== signal.tenantId!.toLowerCase()
    );

    if (foreignUuids.length === 0) return null;

    // Track cross-tenant references per IP
    windows.push(`ip:${signal.sourceIp}:cross_tenant`, {
      foreignUuids,
      path: signal.path,
      tenantId: signal.tenantId,
    });

    const recentProbes = windows.countInWindow(
      `ip:${signal.sourceIp}:cross_tenant`,
      windowSeconds * 1000
    );

    if (recentProbes < maxCrossTenantRefs) return null;

    return {
      detected: true,
      detectorId: this.id,
      mitreTechnique: this.mitreTechnique,
      severity: 'critical',
      confidence: 0.85,
      title: 'Cross-Tenant Data Probe',
      message: `${recentProbes} requests referencing foreign tenant IDs from ${signal.sourceIp}`,
      details: {
        probeCount: recentProbes,
        authenticatedTenant: signal.tenantId,
        foreignUuidCount: foreignUuids.length,
        path: signal.path,
      },
      recommendedActions: ['block_request', 'ban_ip', 'escalate_sentinel'],
    };
  }
}

// ============================================================================
// 6. API Enumeration
// MITRE: T1087.004 | CIS 13.3, NIST CSF DE.CM-01
// ============================================================================

class ApiEnumerationDetector implements ThreatDetector {
  id = 'api_enumeration';
  mitreTechnique = 'T1087.004';
  standardRefs = ['CIS-13.3', 'NIST-CSF-DE.CM-01'];

  analyze(signal: RequestSignal, windows: SlidingWindowStore): DetectionResult | null {
    if (signal.statusCode !== 404 && signal.statusCode !== 403) return null;

    const config = threatDetectionEngine.getThresholdConfig(this.id);
    const max404s = (config.max_404s as number) || 20;
    const windowSeconds = (config.window_seconds as number) || 60;

    const errorCount = windows.countMatching(
      `ip:${signal.sourceIp}:errors`,
      windowSeconds * 1000,
      (data) => data.statusCode === 404 || data.statusCode === 403
    );

    if (errorCount < max404s) return null;

    // Check for sequential ID pattern in paths
    const recentPaths = windows.getWindow(`ip:${signal.sourceIp}:errors`, windowSeconds * 1000)
      .map(e => String(e.data.path));
    const hasSequentialPattern = this.detectSequentialIds(recentPaths);

    return {
      detected: true,
      detectorId: this.id,
      mitreTechnique: this.mitreTechnique,
      severity: hasSequentialPattern ? 'high' : 'medium',
      confidence: hasSequentialPattern ? 0.85 : 0.65,
      title: 'API Enumeration Attack',
      message: `${errorCount} 404/403 errors from ${signal.sourceIp} in ${windowSeconds}s${hasSequentialPattern ? ' (sequential ID pattern detected)' : ''}`,
      details: { errorCount, threshold: max404s, sequentialPattern: hasSequentialPattern },
      recommendedActions: ['rate_limit', 'alert_admin'],
    };
  }

  private detectSequentialIds(paths: string[]): boolean {
    const numericIds = paths
      .map(p => {
        const match = p.match(/\/(\d+)(?:\/|$)/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((n): n is number => n !== null);

    if (numericIds.length < 3) return false;

    let sequential = 0;
    for (let i = 1; i < numericIds.length; i++) {
      if (Math.abs(numericIds[i] - numericIds[i - 1]) <= 2) sequential++;
    }
    return sequential >= numericIds.length * 0.5;
  }
}

// ============================================================================
// 7. SQL/NoSQL Injection
// MITRE: T1190 | OWASP ASVS 5.3, NIST 800-94 §4.1
// ============================================================================

class SqlInjectionDetector implements ThreatDetector {
  id = 'sql_injection';
  mitreTechnique = 'T1190';
  standardRefs = ['OWASP-ASVS-5.3', 'NIST-800-94-4.1'];

  private defaultPatterns = [
    /union\s+select/i,
    /or\s+1\s*=\s*1/i,
    /'\s*or\s+'/i,
    /drop\s+table/i,
    /exec\s*\(/i,
    /xp_cmdshell/i,
    /;\s*delete\s+from/i,
    /;\s*update\s+.*\s+set/i,
    /'\s*;\s*--/i,
    /\$where\s*:/i,  // NoSQL
    /\$gt\s*:/i,     // NoSQL
    /\$ne\s*:/i,     // NoSQL
  ];

  analyze(signal: RequestSignal, windows: SlidingWindowStore): DetectionResult | null {
    const targets = [signal.path, signal.body || ''].join(' ');
    if (!targets || targets.length < 5) return null;

    // Also check query string params embedded in path
    const decoded = decodeURIComponent(targets).toLowerCase();

    const matchedPatterns: string[] = [];
    for (const pattern of this.defaultPatterns) {
      if (pattern.test(decoded)) {
        matchedPatterns.push(pattern.source);
      }
    }

    if (matchedPatterns.length === 0) return null;

    return {
      detected: true,
      detectorId: this.id,
      mitreTechnique: this.mitreTechnique,
      severity: 'critical',
      confidence: Math.min(0.7 + matchedPatterns.length * 0.1, 0.95),
      title: 'SQL/NoSQL Injection Attempt',
      message: `${matchedPatterns.length} injection pattern(s) detected from ${signal.sourceIp} on ${signal.path}`,
      details: {
        matchedPatterns,
        path: signal.path,
        ip: signal.sourceIp,
      },
      recommendedActions: ['block_request', 'ban_ip', 'alert_admin'],
    };
  }
}

// ============================================================================
// 8. Excessive Error Rate
// MITRE: T1190 | NIST 800-94 §4.1, CIS 13.3
// ============================================================================

class ExcessiveErrorRateDetector implements ThreatDetector {
  id = 'excessive_error_rate';
  mitreTechnique = 'T1190';
  standardRefs = ['NIST-800-94-4.1', 'CIS-13.3'];

  analyze(signal: RequestSignal, windows: SlidingWindowStore): DetectionResult | null {
    const config = threatDetectionEngine.getThresholdConfig(this.id);
    const maxErrorRate = (config.max_error_rate as number) || 0.5;
    const minRequests = (config.min_requests as number) || 20;
    const windowSeconds = (config.window_seconds as number) || 60;
    const windowMs = windowSeconds * 1000;

    const totalRequests = windows.countInWindow(`ip:${signal.sourceIp}:requests`, windowMs);
    if (totalRequests < minRequests) return null;

    const errorCount = windows.countInWindow(`ip:${signal.sourceIp}:errors`, windowMs);
    const errorRate = errorCount / totalRequests;

    if (errorRate < maxErrorRate) return null;

    return {
      detected: true,
      detectorId: this.id,
      mitreTechnique: this.mitreTechnique,
      severity: errorRate > 0.8 ? 'high' : 'medium',
      confidence: Math.min(0.5 + errorRate * 0.4, 0.9),
      title: 'Excessive Error Rate',
      message: `${(errorRate * 100).toFixed(0)}% error rate from ${signal.sourceIp} (${errorCount}/${totalRequests} in ${windowSeconds}s)`,
      details: { errorRate, errorCount, totalRequests, windowSeconds },
      recommendedActions: ['rate_limit', 'alert_admin'],
    };
  }
}

// ============================================================================
// 9. Data Exfiltration
// MITRE: T1530 | NIST CSF DE.CM-05, SOC2 CC7.2, ISO 27001 A.8.16
// ============================================================================

class DataExfiltrationDetector implements ThreatDetector {
  id = 'data_exfiltration';
  mitreTechnique = 'T1530';
  standardRefs = ['NIST-CSF-DE.CM-05', 'SOC2-CC7.2', 'ISO27001-A.8.16'];

  analyze(signal: RequestSignal, windows: SlidingWindowStore): DetectionResult | null {
    if (!signal.userId) return null;

    const config = threatDetectionEngine.getThresholdConfig(this.id);
    const maxResponseMb = (config.max_response_mb as number) || 50;
    const windowSeconds = (config.window_seconds as number) || 300;
    const windowMs = windowSeconds * 1000;

    // Check total response bytes from this user in the window
    const recentRequests = windows.getWindow(`user:${signal.userId}:requests`, windowMs);
    const totalBytes = recentRequests.reduce(
      (sum, e) => sum + ((e.data.responseBytes as number) || 0),
      0
    );
    const totalMb = totalBytes / (1024 * 1024);

    if (totalMb < maxResponseMb) return null;

    // Check for bulk export patterns (list endpoints with large responses)
    const listEndpoints = recentRequests.filter(
      e => (e.data.method === 'GET') && ((e.data.responseBytes as number) || 0) > 100000
    ).length;

    return {
      detected: true,
      detectorId: this.id,
      mitreTechnique: this.mitreTechnique,
      severity: totalMb > maxResponseMb * 2 ? 'critical' : 'high',
      confidence: Math.min(0.6 + (totalMb / maxResponseMb) * 0.2, 0.9),
      title: 'Potential Data Exfiltration',
      message: `User ${signal.userId?.substring(0, 8)} downloaded ${totalMb.toFixed(1)}MB in ${windowSeconds}s (${listEndpoints} large GET responses)`,
      details: {
        totalMb: Math.round(totalMb * 10) / 10,
        threshold: maxResponseMb,
        requestCount: recentRequests.length,
        largeGetCount: listEndpoints,
      },
      recommendedActions: ['block_request', 'alert_admin', 'escalate_sentinel'],
    };
  }
}

// ============================================================================
// 10. Privilege Escalation
// MITRE: T1548 | CIS 8.5, SOC2 CC6.1, NIST CSF DE.AE-05
// ============================================================================

class PrivilegeEscalationDetector implements ThreatDetector {
  id = 'privilege_escalation';
  mitreTechnique = 'T1548';
  standardRefs = ['CIS-8.5', 'SOC2-CC6.1', 'NIST-CSF-DE.AE-05'];

  private adminPaths = [
    '/admin/', '/system/', '/config/', '/settings/', '/roles/',
    '/permissions/', '/users/', '/tenants/', '/billing/',
  ];

  analyze(signal: RequestSignal, windows: SlidingWindowStore): DetectionResult | null {
    if (!signal.userId) return null;

    const config = threatDetectionEngine.getThresholdConfig(this.id);
    const windowSeconds = (config.suspicious_api_window_seconds as number) || 300;
    const windowMs = windowSeconds * 1000;

    // Check if this user had a recent role change event
    const roleChanges = windows.countMatching(
      `user:${signal.userId}:requests`,
      windowMs,
      (data) => {
        const path = String(data.path || '');
        return (path.includes('/roles') || path.includes('/permissions')) &&
               (data.method === 'PUT' || data.method === 'POST' || data.method === 'PATCH');
      }
    );

    if (roleChanges === 0) return null;

    // Check if user is now accessing admin-level endpoints they didn't before
    const adminAccess = windows.countMatching(
      `user:${signal.userId}:requests`,
      windowMs,
      (data) => {
        const path = String(data.path || '');
        return this.adminPaths.some(ap => path.startsWith(ap));
      }
    );

    if (adminAccess < 3) return null;

    return {
      detected: true,
      detectorId: this.id,
      mitreTechnique: this.mitreTechnique,
      severity: 'high',
      confidence: Math.min(0.6 + (adminAccess * 0.05), 0.9),
      title: 'Potential Privilege Escalation',
      message: `User ${signal.userId?.substring(0, 8)} performed ${roleChanges} role changes then accessed ${adminAccess} admin endpoints`,
      details: { roleChanges, adminAccessCount: adminAccess, userId: signal.userId },
      recommendedActions: ['alert_admin', 'escalate_sentinel'],
    };
  }
}

// ============================================================================
// 11. Prompt Injection Surge
// AI-specific | OWASP LLM01, RADIANT CATO
// ============================================================================

class PromptInjectionSurgeDetector implements ThreatDetector {
  id = 'prompt_injection_surge';
  mitreTechnique = undefined;
  standardRefs = ['OWASP-LLM01', 'RADIANT-CATO'];

  analyze(signal: RequestSignal, windows: SlidingWindowStore): DetectionResult | null {
    // Look for CATO safety blocks indicated by specific error codes or paths
    const isCatoBlock = signal.errorCode === 'SAFETY_BLOCK' ||
                        signal.errorCode === 'CONTENT_FILTERED' ||
                        (signal.statusCode === 403 && signal.path.includes('/chat'));

    if (!isCatoBlock) return null;

    // Track CATO blocks per source
    const key = signal.userId ? `user:${signal.userId}:cato_blocks` : `ip:${signal.sourceIp}:cato_blocks`;
    windows.push(key, { path: signal.path, errorCode: signal.errorCode });

    const config = threatDetectionEngine.getThresholdConfig(this.id);
    const maxBlocks = (config.max_cato_blocks as number) || 10;
    const windowSeconds = (config.window_seconds as number) || 300;

    const blockCount = windows.countInWindow(key, windowSeconds * 1000);

    if (blockCount < maxBlocks) return null;

    return {
      detected: true,
      detectorId: this.id,
      severity: 'high',
      confidence: Math.min(0.6 + (blockCount / maxBlocks) * 0.2, 0.9),
      title: 'Prompt Injection Surge',
      message: `${blockCount} CATO safety blocks from ${signal.userId || signal.sourceIp} in ${windowSeconds}s — possible automated prompt injection attack`,
      details: { blockCount, threshold: maxBlocks, source: signal.userId || signal.sourceIp },
      recommendedActions: ['rate_limit', 'alert_admin'],
    };
  }
}

// ============================================================================
// 12. Model Cost Anomaly
// AI-specific | RADIANT Spend Governor, NIST CSF DE.AE-03
// ============================================================================

class ModelCostAnomalyDetector implements ThreatDetector {
  id = 'model_cost_anomaly';
  mitreTechnique = undefined;
  standardRefs = ['RADIANT-SpendGovernor', 'NIST-CSF-DE.AE-03'];

  analyze(signal: RequestSignal, windows: SlidingWindowStore): DetectionResult | null {
    if (!signal.userId || !signal.tenantId) return null;

    // Only analyze AI model invocation endpoints
    const isModelCall = signal.path.includes('/chat') ||
                        signal.path.includes('/completions') ||
                        signal.path.includes('/invoke');
    if (!isModelCall) return null;

    const config = threatDetectionEngine.getThresholdConfig(this.id);
    const sigmaThreshold = (config.sigma_threshold as number) || 3.0;

    // Count model calls per user in last 5 minutes
    const windowMs = 5 * 60 * 1000;
    const userCalls = windows.countMatching(
      `user:${signal.userId}:requests`,
      windowMs,
      (data) => {
        const path = String(data.path || '');
        return path.includes('/chat') || path.includes('/completions') || path.includes('/invoke');
      }
    );

    // Simple anomaly: if user is making more than 60 model calls per 5 minutes
    // (In production this would compare against the user's baseline from user_access_baselines)
    const hardThreshold = 60;
    if (userCalls < hardThreshold) return null;

    return {
      detected: true,
      detectorId: this.id,
      severity: userCalls > hardThreshold * 3 ? 'high' : 'medium',
      confidence: Math.min(0.5 + (userCalls / hardThreshold) * 0.15, 0.85),
      title: 'Model Cost Anomaly',
      message: `User ${signal.userId?.substring(0, 8)} made ${userCalls} model calls in 5min (threshold: ${hardThreshold})`,
      details: { userCalls, threshold: hardThreshold, userId: signal.userId, tenantId: signal.tenantId },
      recommendedActions: ['rate_limit', 'alert_admin'],
    };
  }
}

// ============================================================================
// 13. Unusual Access Pattern (UEBA)
// MITRE: T1078 | NIST CSF DE.AE-05, ISO 27001 A.8.16, SOC2 CC7.3
// ============================================================================

class UnusualAccessPatternDetector implements ThreatDetector {
  id = 'unusual_access_pattern';
  mitreTechnique = 'T1078';
  standardRefs = ['NIST-CSF-DE.AE-05', 'ISO27001-A.8.16', 'SOC2-CC7.3'];

  analyze(signal: RequestSignal, windows: SlidingWindowStore): DetectionResult | null {
    if (!signal.userId) return null;

    // Simple heuristic: flag if user accesses an endpoint they've never accessed before
    // AND they're coming from a new IP AND it's outside business hours
    const hour = new Date().getUTCHours();
    const isOffHours = hour < 6 || hour > 22;

    if (!isOffHours) return null;

    // Check if this IP is new for this user in the current window
    const recentIps = windows.uniqueValues(`user:${signal.userId}:requests`, 3600000, 'ip');
    const recentPaths = windows.uniqueValues(`user:${signal.userId}:requests`, 3600000, 'path');

    // Need enough baseline data
    if (recentPaths.size < 5) return null;

    // Flag if: off-hours + new IP + admin endpoint
    const isNewIp = !recentIps.has(signal.sourceIp);
    const isAdminPath = signal.path.startsWith('/admin/') || signal.path.startsWith('/system/');

    if (!isNewIp || !isAdminPath) return null;

    return {
      detected: true,
      detectorId: this.id,
      mitreTechnique: this.mitreTechnique,
      severity: 'medium',
      confidence: 0.6,
      title: 'Unusual Access Pattern',
      message: `User ${signal.userId?.substring(0, 8)} accessing admin endpoints from new IP ${signal.sourceIp} during off-hours (${hour}:00 UTC)`,
      details: {
        userId: signal.userId,
        ip: signal.sourceIp,
        hour,
        path: signal.path,
        isNewIp,
        knownIpCount: recentIps.size,
      },
      recommendedActions: ['challenge', 'alert_admin'],
    };
  }
}

// ============================================================================
// 14. Account Takeover
// MITRE: T1078.001 | OWASP OAT-019, NIST CSF DE.AE-04, SOC2 CC7.2
// ============================================================================

class AccountTakeoverDetector implements ThreatDetector {
  id = 'account_takeover';
  mitreTechnique = 'T1078.001';
  standardRefs = ['OWASP-OAT-019', 'NIST-CSF-DE.AE-04', 'SOC2-CC7.2'];

  private atoSignalPaths = [
    { pattern: '/password', weight: 1 },
    { pattern: '/email', weight: 1 },
    { pattern: '/profile', weight: 0.5 },
    { pattern: '/api-key', weight: 1 },
    { pattern: '/mfa', weight: 1 },
    { pattern: '/recovery', weight: 1 },
    { pattern: '/session', weight: 0.5 },
  ];

  analyze(signal: RequestSignal, windows: SlidingWindowStore): DetectionResult | null {
    if (!signal.userId) return null;
    if (signal.method !== 'PUT' && signal.method !== 'POST' && signal.method !== 'PATCH' && signal.method !== 'DELETE') {
      return null;
    }

    const config = threatDetectionEngine.getThresholdConfig(this.id);
    const windowSeconds = (config.sequence_window_seconds as number) || 600;
    const requiredSignals = (config.required_signals as number) || 3;
    const windowMs = windowSeconds * 1000;

    // Count ATO-indicative actions in the window
    const recentRequests = windows.getWindow(`user:${signal.userId}:requests`, windowMs);

    let score = 0;
    const matchedActions: string[] = [];

    for (const req of recentRequests) {
      const path = String(req.data.path || '');
      const method = String(req.data.method || '');
      if (method !== 'PUT' && method !== 'POST' && method !== 'PATCH' && method !== 'DELETE') continue;

      for (const sp of this.atoSignalPaths) {
        if (path.includes(sp.pattern)) {
          score += sp.weight;
          matchedActions.push(`${method} ...${sp.pattern}`);
          break;
        }
      }
    }

    if (score < requiredSignals) return null;

    return {
      detected: true,
      detectorId: this.id,
      mitreTechnique: this.mitreTechnique,
      severity: 'critical',
      confidence: Math.min(0.7 + (score / requiredSignals) * 0.1, 0.95),
      title: 'Account Takeover Sequence',
      message: `User ${signal.userId?.substring(0, 8)} performed ${matchedActions.length} account-modifying actions in ${windowSeconds}s: ${matchedActions.join(', ')}`,
      details: {
        score,
        requiredSignals,
        matchedActions,
        userId: signal.userId,
      },
      recommendedActions: ['lock_account', 'alert_admin', 'escalate_sentinel'],
    };
  }
}

// ============================================================================
// Registration — register all 14 detectors with the engine
// ============================================================================

export function registerAllDetectors(): void {
  const detectors: ThreatDetector[] = [
    new BruteForceAuthDetector(),
    new CredentialStuffingDetector(),
    new ImpossibleTravelDetector(),
    new SessionHijackDetector(),
    new CrossTenantProbeDetector(),
    new ApiEnumerationDetector(),
    new SqlInjectionDetector(),
    new ExcessiveErrorRateDetector(),
    new DataExfiltrationDetector(),
    new PrivilegeEscalationDetector(),
    new PromptInjectionSurgeDetector(),
    new ModelCostAnomalyDetector(),
    new UnusualAccessPatternDetector(),
    new AccountTakeoverDetector(),
  ];

  for (const detector of detectors) {
    threatDetectionEngine.registerDetector(detector);
  }
}
