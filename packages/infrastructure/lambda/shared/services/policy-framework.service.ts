// RADIANT v4.18.0 - Policy Framework Service
// Strategic Intelligence & Regulatory Stance Configuration
// Novel UI: "Stance Compass" - radial selector for policy positions

import { executeStatement, stringParam, longParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface PolicyStance {
  id: string;
  tenantId: string;
  domain: PolicyDomain;
  position: StancePosition;
  strength: number;
  rationale: string;
  sources: PolicySource[];
  implications: string[];
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type PolicyDomain =
  | 'ai_safety' | 'data_privacy' | 'content_moderation' | 'accessibility'
  | 'sustainability' | 'security' | 'transparency' | 'ethics' | 'compliance' | 'innovation';

export type StancePosition = 'restrictive' | 'cautious' | 'balanced' | 'permissive' | 'adaptive';

export interface PolicySource {
  name: string;
  type: 'regulation' | 'standard' | 'guideline' | 'research' | 'internal' | 'advisory';
  url?: string;
  citation?: string;
  weight: number;
}

export interface PolicyProfile {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  stances: Record<PolicyDomain, { position: StancePosition; strength: number }>;
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompassView {
  center: { x: number; y: number };
  domains: CompassDomain[];
  overallPosition: { angle: number; magnitude: number };
  profileName: string;
}

export interface CompassDomain {
  domain: PolicyDomain;
  angle: number;
  radius: number;
  position: StancePosition;
  color: string;
  icon: string;
}

export interface PolicyRecommendation {
  domain: PolicyDomain;
  currentPosition: StancePosition;
  recommendedPosition: StancePosition;
  reason: string;
  sources: PolicySource[];
  urgency: 'low' | 'medium' | 'high';
}

export interface ComplianceStatus {
  domain: PolicyDomain;
  status: 'compliant' | 'partial' | 'non_compliant' | 'unknown';
  requirements: ComplianceRequirement[];
  lastChecked: string;
}

export interface ComplianceRequirement {
  id: string;
  name: string;
  description: string;
  status: 'met' | 'partial' | 'unmet';
  source: PolicySource;
}

export type PresetProfileType = 'conservative' | 'balanced' | 'innovative';

// ============================================================================
// Policy Framework Service
// ============================================================================

class PolicyFrameworkService {
  private readonly DEFAULT_STANCES: Record<PolicyDomain, { position: StancePosition; strength: number }> = {
    ai_safety: { position: 'cautious', strength: 80 },
    data_privacy: { position: 'restrictive', strength: 90 },
    content_moderation: { position: 'balanced', strength: 70 },
    accessibility: { position: 'cautious', strength: 85 },
    sustainability: { position: 'balanced', strength: 60 },
    security: { position: 'restrictive', strength: 95 },
    transparency: { position: 'cautious', strength: 75 },
    ethics: { position: 'cautious', strength: 80 },
    compliance: { position: 'restrictive', strength: 90 },
    innovation: { position: 'balanced', strength: 65 },
  };

  // --------------------------------------------------------------------------
  // Stance Management
  // --------------------------------------------------------------------------

  async createStance(
    tenantId: string,
    stance: Omit<PolicyStance, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
  ): Promise<PolicyStance> {
    try {
      const id = `stance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await executeStatement(
        `INSERT INTO policy_stances (id, tenant_id, domain, position, strength, rationale, sources, implications, enabled, created_by, created_at, updated_at)
          VALUES (:id, :tenantId, :domain, :position, :strength, :rationale, :sources, :implications, :enabled, :createdBy, NOW(), NOW())`,
        [
          stringParam('id', id),
          stringParam('tenantId', tenantId),
          stringParam('domain', stance.domain),
          stringParam('position', stance.position),
          longParam('strength', stance.strength),
          stringParam('rationale', stance.rationale),
          stringParam('sources', JSON.stringify(stance.sources || [])),
          stringParam('implications', JSON.stringify(stance.implications || [])),
          boolParam('enabled', stance.enabled !== false),
          stringParam('createdBy', stance.createdBy),
        ]
      );

      logger.info('Created policy stance', { tenantId, id, domain: stance.domain });

      return {
        id,
        tenantId,
        ...stance,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to create policy stance', { tenantId, error });
      throw error;
    }
  }

  async getStance(tenantId: string, domain: PolicyDomain): Promise<PolicyStance | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM policy_stances WHERE tenant_id = :tenantId AND domain = :domain AND enabled = true ORDER BY updated_at DESC LIMIT 1`,
        [stringParam('tenantId', tenantId), stringParam('domain', domain)]
      );

      if (result.rows && result.rows.length > 0) {
        return this.parseStance(result.rows[0] as Record<string, unknown>);
      }
      return null;
    } catch (error) {
      logger.error('Failed to get policy stance', { tenantId, domain, error });
      throw error;
    }
  }

  async listStances(tenantId: string): Promise<PolicyStance[]> {
    try {
      const result = await executeStatement(
        `SELECT * FROM policy_stances WHERE tenant_id = :tenantId AND enabled = true ORDER BY domain ASC`,
        [stringParam('tenantId', tenantId)]
      );

      return (result.rows || []).map(row => this.parseStance(row as Record<string, unknown>));
    } catch (error) {
      logger.error('Failed to list policy stances', { tenantId, error });
      throw error;
    }
  }

  async updateStance(tenantId: string, stanceId: string, updates: Partial<PolicyStance>): Promise<PolicyStance | null> {
    try {
      const existing = await this.getStanceById(tenantId, stanceId);
      if (!existing) return null;

      const merged = { ...existing, ...updates };

      await executeStatement(
        `UPDATE policy_stances SET position = :position, strength = :strength, rationale = :rationale, sources = :sources, implications = :implications, enabled = :enabled, updated_at = NOW()
          WHERE tenant_id = :tenantId AND id = :stanceId`,
        [
          stringParam('position', merged.position),
          longParam('strength', merged.strength),
          stringParam('rationale', merged.rationale),
          stringParam('sources', JSON.stringify(merged.sources)),
          stringParam('implications', JSON.stringify(merged.implications)),
          boolParam('enabled', merged.enabled),
          stringParam('tenantId', tenantId),
          stringParam('stanceId', stanceId),
        ]
      );

      return { ...merged, updatedAt: new Date().toISOString() };
    } catch (error) {
      logger.error('Failed to update policy stance', { tenantId, stanceId, error });
      throw error;
    }
  }

  private async getStanceById(tenantId: string, stanceId: string): Promise<PolicyStance | null> {
    const result = await executeStatement(
      `SELECT * FROM policy_stances WHERE tenant_id = :tenantId AND id = :stanceId`,
      [stringParam('tenantId', tenantId), stringParam('stanceId', stanceId)]
    );

    if (result.rows && result.rows.length > 0) {
      return this.parseStance(result.rows[0] as Record<string, unknown>);
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // Policy Profiles
  // --------------------------------------------------------------------------

  async createProfile(
    tenantId: string,
    profile: Omit<PolicyProfile, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
  ): Promise<PolicyProfile> {
    try {
      const id = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await executeStatement(
        `INSERT INTO policy_profiles (id, tenant_id, name, description, stances, is_default, created_by, created_at, updated_at)
          VALUES (:id, :tenantId, :name, :description, :stances, :isDefault, :createdBy, NOW(), NOW())`,
        [
          stringParam('id', id),
          stringParam('tenantId', tenantId),
          stringParam('name', profile.name),
          stringParam('description', profile.description || ''),
          stringParam('stances', JSON.stringify(profile.stances)),
          boolParam('isDefault', profile.isDefault),
          stringParam('createdBy', profile.createdBy),
        ]
      );

      return {
        id,
        tenantId,
        ...profile,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to create policy profile', { tenantId, error });
      throw error;
    }
  }

  async getActiveProfile(tenantId: string): Promise<PolicyProfile | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM policy_profiles WHERE tenant_id = :tenantId AND is_default = true LIMIT 1`,
        [stringParam('tenantId', tenantId)]
      );

      if (result.rows && result.rows.length > 0) {
        return this.parseProfile(result.rows[0] as Record<string, unknown>);
      }

      // Return default profile
      return {
        id: 'default',
        tenantId,
        name: 'Default Profile',
        description: 'Standard policy configuration',
        stances: this.DEFAULT_STANCES,
        isDefault: true,
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to get active profile', { tenantId, error });
      throw error;
    }
  }

  async listProfiles(tenantId: string): Promise<PolicyProfile[]> {
    try {
      const result = await executeStatement(
        `SELECT * FROM policy_profiles WHERE tenant_id = :tenantId ORDER BY is_default DESC, name ASC`,
        [stringParam('tenantId', tenantId)]
      );

      return (result.rows || []).map(row => this.parseProfile(row as Record<string, unknown>));
    } catch (error) {
      logger.error('Failed to list policy profiles', { tenantId, error });
      throw error;
    }
  }

  async setDefaultProfile(tenantId: string, profileId: string): Promise<void> {
    try {
      // Clear existing default
      await executeStatement(
        `UPDATE policy_profiles SET is_default = false WHERE tenant_id = :tenantId`,
        [stringParam('tenantId', tenantId)]
      );

      // Set new default
      await executeStatement(
        `UPDATE policy_profiles SET is_default = true, updated_at = NOW() WHERE tenant_id = :tenantId AND id = :profileId`,
        [stringParam('tenantId', tenantId), stringParam('profileId', profileId)]
      );
    } catch (error) {
      logger.error('Failed to set default profile', { tenantId, profileId, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Compass View (UI)
  // --------------------------------------------------------------------------

  async getCompassView(tenantId: string): Promise<CompassView> {
    try {
      const profile = await this.getActiveProfile(tenantId);
      const domains = Object.keys(this.DEFAULT_STANCES) as PolicyDomain[];

      const compassDomains: CompassDomain[] = domains.map((domain, index) => {
        const stance = profile?.stances[domain] || this.DEFAULT_STANCES[domain];
        const angle = (index / domains.length) * 360;

        return {
          domain,
          angle,
          radius: stance.strength,
          position: stance.position,
          color: this.getDomainColor(domain),
          icon: this.getDomainIcon(domain),
        };
      });

      const avgAngle = compassDomains.reduce((sum, d) => sum + d.angle * (d.radius / 100), 0) /
        compassDomains.reduce((sum, d) => sum + d.radius / 100, 0);
      const avgMagnitude = compassDomains.reduce((sum, d) => sum + d.radius, 0) / compassDomains.length;

      return {
        center: { x: 50, y: 50 },
        domains: compassDomains,
        overallPosition: { angle: avgAngle, magnitude: avgMagnitude },
        profileName: profile?.name || 'Default Profile',
      };
    } catch (error) {
      logger.error('Failed to get compass view', { tenantId, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Recommendations & Compliance
  // --------------------------------------------------------------------------

  async getRecommendations(tenantId: string): Promise<PolicyRecommendation[]> {
    try {
      const profile = await this.getActiveProfile(tenantId);
      const recommendations: PolicyRecommendation[] = [];
      const domains = Object.keys(this.DEFAULT_STANCES) as PolicyDomain[];

      for (const domain of domains) {
        const stance = profile?.stances[domain] || this.DEFAULT_STANCES[domain];

        if (domain === 'security' && stance.strength < 90) {
          recommendations.push({
            domain,
            currentPosition: stance.position,
            recommendedPosition: 'restrictive',
            reason: 'Security stance should be at maximum strength to protect against cyber threats',
            sources: [{ name: 'NIST Cybersecurity Framework', type: 'standard', weight: 1 }],
            urgency: 'high',
          });
        }

        if (domain === 'data_privacy' && stance.position !== 'restrictive') {
          recommendations.push({
            domain,
            currentPosition: stance.position,
            recommendedPosition: 'restrictive',
            reason: 'GDPR and other regulations require strong data privacy measures',
            sources: [{ name: 'GDPR', type: 'regulation', weight: 1 }],
            urgency: 'medium',
          });
        }
      }

      return recommendations;
    } catch (error) {
      logger.error('Failed to get recommendations', { tenantId, error });
      throw error;
    }
  }

  async checkCompliance(tenantId: string): Promise<ComplianceStatus[]> {
    try {
      const profile = await this.getActiveProfile(tenantId);
      const statuses: ComplianceStatus[] = [];
      const domains = Object.keys(this.DEFAULT_STANCES) as PolicyDomain[];

      for (const domain of domains) {
        const stance = profile?.stances[domain] || this.DEFAULT_STANCES[domain];
        const requirements = this.getRequirementsForDomain(domain, stance);

        const metCount = requirements.filter(r => r.status === 'met').length;
        const totalCount = requirements.length;

        let status: 'compliant' | 'partial' | 'non_compliant' | 'unknown' = 'unknown';
        if (totalCount === 0) status = 'unknown';
        else if (metCount === totalCount) status = 'compliant';
        else if (metCount > 0) status = 'partial';
        else status = 'non_compliant';

        statuses.push({
          domain,
          status,
          requirements,
          lastChecked: new Date().toISOString(),
        });
      }

      return statuses;
    } catch (error) {
      logger.error('Failed to check compliance', { tenantId, error });
      throw error;
    }
  }

  private getRequirementsForDomain(
    domain: PolicyDomain,
    stance: { position: StancePosition; strength: number }
  ): ComplianceRequirement[] {
    const requirements: ComplianceRequirement[] = [];

    if (domain === 'data_privacy') {
      requirements.push({
        id: 'gdpr_consent',
        name: 'GDPR Consent Management',
        description: 'User consent for data processing',
        status: stance.position === 'restrictive' || stance.position === 'cautious' ? 'met' : 'partial',
        source: { name: 'GDPR Article 7', type: 'regulation', weight: 1 },
      });
    }

    if (domain === 'security') {
      requirements.push({
        id: 'encryption',
        name: 'Data Encryption',
        description: 'Encryption at rest and in transit',
        status: stance.strength >= 90 ? 'met' : stance.strength >= 70 ? 'partial' : 'unmet',
        source: { name: 'SOC 2', type: 'standard', weight: 1 },
      });
    }

    return requirements;
  }

  // --------------------------------------------------------------------------
  // Preset Profiles
  // --------------------------------------------------------------------------

  async createPresetProfile(tenantId: string, preset: PresetProfileType, createdBy: string): Promise<PolicyProfile> {
    const presets: Record<PresetProfileType, { name: string; description: string; stances: Record<PolicyDomain, { position: StancePosition; strength: number }> }> = {
      conservative: {
        name: 'Conservative',
        description: 'Maximum safety and compliance, minimal risk tolerance',
        stances: {
          ai_safety: { position: 'restrictive', strength: 95 },
          data_privacy: { position: 'restrictive', strength: 95 },
          content_moderation: { position: 'restrictive', strength: 90 },
          accessibility: { position: 'restrictive', strength: 90 },
          sustainability: { position: 'cautious', strength: 80 },
          security: { position: 'restrictive', strength: 100 },
          transparency: { position: 'cautious', strength: 85 },
          ethics: { position: 'restrictive', strength: 90 },
          compliance: { position: 'restrictive', strength: 100 },
          innovation: { position: 'cautious', strength: 50 },
        },
      },
      balanced: {
        name: 'Balanced',
        description: 'Balanced approach between safety and innovation',
        stances: this.DEFAULT_STANCES,
      },
      innovative: {
        name: 'Innovative',
        description: 'Emphasis on innovation while maintaining core safety',
        stances: {
          ai_safety: { position: 'balanced', strength: 70 },
          data_privacy: { position: 'cautious', strength: 80 },
          content_moderation: { position: 'balanced', strength: 65 },
          accessibility: { position: 'balanced', strength: 75 },
          sustainability: { position: 'balanced', strength: 60 },
          security: { position: 'cautious', strength: 85 },
          transparency: { position: 'balanced', strength: 70 },
          ethics: { position: 'balanced', strength: 70 },
          compliance: { position: 'cautious', strength: 85 },
          innovation: { position: 'permissive', strength: 90 },
        },
      },
    };

    const config = presets[preset];
    return this.createProfile(tenantId, {
      name: config.name,
      description: config.description,
      stances: config.stances,
      isDefault: false,
      createdBy,
    });
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private getDomainColor(domain: PolicyDomain): string {
    const colors: Record<PolicyDomain, string> = {
      ai_safety: '#EF4444', data_privacy: '#8B5CF6', content_moderation: '#F59E0B', accessibility: '#10B981',
      sustainability: '#22C55E', security: '#DC2626', transparency: '#3B82F6', ethics: '#EC4899',
      compliance: '#6366F1', innovation: '#06B6D4',
    };
    return colors[domain] || '#6B7280';
  }

  private getDomainIcon(domain: PolicyDomain): string {
    const icons: Record<PolicyDomain, string> = {
      ai_safety: '🤖', data_privacy: '🔒', content_moderation: '📝', accessibility: '♿',
      sustainability: '🌱', security: '🛡️', transparency: '👁️', ethics: '⚖️',
      compliance: '📋', innovation: '💡',
    };
    return icons[domain] || '📌';
  }

  private parseStance(row: Record<string, unknown>): PolicyStance {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      domain: String(row.domain || 'ai_safety') as PolicyDomain,
      position: String(row.position || 'balanced') as StancePosition,
      strength: Number(row.strength) || 50,
      rationale: String(row.rationale || ''),
      sources: this.parseJson(row.sources) || [],
      implications: this.parseJson(row.implications) || [],
      enabled: Boolean(row.enabled),
      createdBy: String(row.created_by || ''),
      createdAt: String(row.created_at || ''),
      updatedAt: String(row.updated_at || ''),
    };
  }

  private parseProfile(row: Record<string, unknown>): PolicyProfile {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      name: String(row.name || ''),
      description: String(row.description || ''),
      stances: this.parseJson(row.stances) || this.DEFAULT_STANCES,
      isDefault: Boolean(row.is_default),
      createdBy: String(row.created_by || ''),
      createdAt: String(row.created_at || ''),
      updatedAt: String(row.updated_at || ''),
    };
  }

  private parseJson<T>(value: unknown): T | null {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return null; }
    }
    return value as T;
  }
}

export const policyFrameworkService = new PolicyFrameworkService();
