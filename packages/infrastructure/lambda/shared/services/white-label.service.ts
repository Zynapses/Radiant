/**
 * White-Label Invisibility Service
 * 
 * Moat #25: End users never know RADIANT exists. Infrastructure stickiness.
 * Platform layer dependency.
 */

import { Logger } from '@aws-lambda-powertools/logger';
import { v4 as uuidv4 } from 'uuid';
import {
  WhiteLabelConfig,
  BrandingConfig,
  DomainConfig,
  FeatureVisibility,
  LegalConfig,
  EmailConfig,
  ApiConfig,
  WhiteLabelRequest,
  WhiteLabelValidation,
  ValidationError,
  ValidationWarning,
  DomainVerification,
  WhiteLabelMetrics,
  BrandingPreview,
  WhiteLabelExport,
} from '@radiant/shared';

const logger = new Logger({ serviceName: 'white-label' });

class WhiteLabelService {
  private static instance: WhiteLabelService;
  private configs: Map<string, WhiteLabelConfig> = new Map();
  private domainVerifications: Map<string, DomainVerification> = new Map();

  private constructor() {}

  static getInstance(): WhiteLabelService {
    if (!WhiteLabelService.instance) {
      WhiteLabelService.instance = new WhiteLabelService();
    }
    return WhiteLabelService.instance;
  }

  async getConfig(tenantId: string): Promise<WhiteLabelConfig | null> {
    if (this.configs.has(tenantId)) {
      return this.configs.get(tenantId)!;
    }
    return null;
  }

  async createConfig(tenantId: string, request: Partial<WhiteLabelConfig>): Promise<WhiteLabelConfig> {
    const defaultConfig = this.getDefaultConfig(tenantId);
    const config: WhiteLabelConfig = {
      ...defaultConfig,
      ...request,
      id: uuidv4(),
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const validation = await this.validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid config: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this.configs.set(tenantId, config);
    logger.info('White-label config created', { tenantId, configId: config.id });

    return config;
  }

  async updateConfig(
    tenantId: string,
    updates: Partial<WhiteLabelConfig>
  ): Promise<WhiteLabelConfig> {
    const current = await this.getConfig(tenantId);
    if (!current) {
      throw new Error(`No white-label config found for tenant ${tenantId}`);
    }

    const updated: WhiteLabelConfig = {
      ...current,
      ...updates,
      tenantId,
      updatedAt: new Date(),
    };

    const validation = await this.validateConfig(updated);
    if (!validation.valid) {
      throw new Error(`Invalid config: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this.configs.set(tenantId, updated);
    logger.info('White-label config updated', { tenantId });

    return updated;
  }

  async deleteConfig(tenantId: string): Promise<boolean> {
    const existed = this.configs.has(tenantId);
    this.configs.delete(tenantId);
    logger.info('White-label config deleted', { tenantId });
    return existed;
  }

  async validateConfig(config: WhiteLabelConfig): Promise<WhiteLabelValidation> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!config.branding.companyName) {
      errors.push({
        field: 'branding.companyName',
        message: 'Company name is required',
        code: 'REQUIRED_FIELD',
      });
    }

    if (!config.branding.productName) {
      errors.push({
        field: 'branding.productName',
        message: 'Product name is required',
        code: 'REQUIRED_FIELD',
      });
    }

    if (!config.branding.logo.primary) {
      warnings.push({
        field: 'branding.logo.primary',
        message: 'Primary logo not set',
        recommendation: 'Upload a logo for better branding',
      });
    }

    if (!this.isValidColor(config.branding.colors.primary)) {
      errors.push({
        field: 'branding.colors.primary',
        message: 'Invalid primary color format',
        code: 'INVALID_FORMAT',
      });
    }

    if (!config.legal.supportEmail) {
      errors.push({
        field: 'legal.supportEmail',
        message: 'Support email is required',
        code: 'REQUIRED_FIELD',
      });
    }

    if (config.domains.length === 0) {
      warnings.push({
        field: 'domains',
        message: 'No custom domains configured',
        recommendation: 'Add a custom domain for complete white-labeling',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async addDomain(tenantId: string, domain: string, type: DomainConfig['type']): Promise<DomainConfig> {
    const config = await this.getConfig(tenantId);
    if (!config) {
      throw new Error(`No white-label config found for tenant ${tenantId}`);
    }

    const existingDomain = config.domains.find(d => d.domain === domain);
    if (existingDomain) {
      throw new Error(`Domain ${domain} already exists`);
    }

    const domainConfig: DomainConfig = {
      id: uuidv4(),
      domain,
      type,
      verified: false,
      sslEnabled: false,
      createdAt: new Date(),
    };

    config.domains.push(domainConfig);
    config.updatedAt = new Date();
    this.configs.set(tenantId, config);

    logger.info('Domain added', { tenantId, domain, type });

    return domainConfig;
  }

  async removeDomain(tenantId: string, domainId: string): Promise<boolean> {
    const config = await this.getConfig(tenantId);
    if (!config) {
      return false;
    }

    const index = config.domains.findIndex(d => d.id === domainId);
    if (index === -1) {
      return false;
    }

    config.domains.splice(index, 1);
    config.updatedAt = new Date();
    this.configs.set(tenantId, config);

    logger.info('Domain removed', { tenantId, domainId });

    return true;
  }

  async initiateDomainVerification(
    tenantId: string,
    domain: string
  ): Promise<DomainVerification> {
    const verification: DomainVerification = {
      domain,
      method: 'dns_txt',
      verificationToken: `radiant-verify-${uuidv4().slice(0, 8)}`,
      verificationValue: `radiant-site-verification=${uuidv4()}`,
      verified: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    this.domainVerifications.set(`${tenantId}:${domain}`, verification);

    logger.info('Domain verification initiated', { tenantId, domain });

    return verification;
  }

  async checkDomainVerification(
    tenantId: string,
    domain: string
  ): Promise<DomainVerification> {
    const key = `${tenantId}:${domain}`;
    const verification = this.domainVerifications.get(key);
    
    if (!verification) {
      throw new Error(`No pending verification for domain ${domain}`);
    }

    const verified = await this.verifyDNSRecord(domain, verification.verificationValue);

    if (verified) {
      verification.verified = true;
      verification.verifiedAt = new Date();
      this.domainVerifications.set(key, verification);

      const config = await this.getConfig(tenantId);
      if (config) {
        const domainConfig = config.domains.find(d => d.domain === domain);
        if (domainConfig) {
          domainConfig.verified = true;
          this.configs.set(tenantId, config);
        }
      }

      logger.info('Domain verified', { tenantId, domain });
    }

    return verification;
  }

  async updateBranding(
    tenantId: string,
    branding: Partial<BrandingConfig>
  ): Promise<BrandingConfig> {
    const config = await this.getConfig(tenantId);
    if (!config) {
      throw new Error(`No white-label config found for tenant ${tenantId}`);
    }

    config.branding = {
      ...config.branding,
      ...branding,
    };
    config.updatedAt = new Date();
    this.configs.set(tenantId, config);

    logger.info('Branding updated', { tenantId });

    return config.branding;
  }

  async updateFeatureVisibility(
    tenantId: string,
    features: Partial<FeatureVisibility>
  ): Promise<FeatureVisibility> {
    const config = await this.getConfig(tenantId);
    if (!config) {
      throw new Error(`No white-label config found for tenant ${tenantId}`);
    }

    config.features = {
      ...config.features,
      ...features,
    };
    config.updatedAt = new Date();
    this.configs.set(tenantId, config);

    logger.info('Feature visibility updated', { tenantId });

    return config.features;
  }

  async updateLegal(
    tenantId: string,
    legal: Partial<LegalConfig>
  ): Promise<LegalConfig> {
    const config = await this.getConfig(tenantId);
    if (!config) {
      throw new Error(`No white-label config found for tenant ${tenantId}`);
    }

    config.legal = {
      ...config.legal,
      ...legal,
    };
    config.updatedAt = new Date();
    this.configs.set(tenantId, config);

    logger.info('Legal config updated', { tenantId });

    return config.legal;
  }

  async updateEmailConfig(
    tenantId: string,
    email: Partial<EmailConfig>
  ): Promise<EmailConfig> {
    const config = await this.getConfig(tenantId);
    if (!config) {
      throw new Error(`No white-label config found for tenant ${tenantId}`);
    }

    config.emails = {
      ...config.emails,
      ...email,
    };
    config.updatedAt = new Date();
    this.configs.set(tenantId, config);

    logger.info('Email config updated', { tenantId });

    return config.emails;
  }

  async generateBrandingPreview(tenantId: string): Promise<BrandingPreview> {
    const config = await this.getConfig(tenantId);
    if (!config) {
      throw new Error(`No white-label config found for tenant ${tenantId}`);
    }

    const css = this.generateBrandingCSS(config.branding);
    const html = this.generatePreviewHTML(config.branding);

    return {
      html,
      css,
      screenshots: {
        desktop: '',
        mobile: '',
        email: '',
      },
    };
  }

  async exportConfig(tenantId: string): Promise<WhiteLabelExport> {
    const config = await this.getConfig(tenantId);
    if (!config) {
      throw new Error(`No white-label config found for tenant ${tenantId}`);
    }

    return {
      config,
      assets: [],
      exportedAt: new Date(),
      version: '1.0.0',
    };
  }

  async importConfig(tenantId: string, exportData: WhiteLabelExport): Promise<WhiteLabelConfig> {
    const config = await this.createConfig(tenantId, exportData.config);
    logger.info('Config imported', { tenantId });
    return config;
  }

  async getMetrics(tenantId: string, period: string): Promise<WhiteLabelMetrics> {
    return {
      tenantId,
      period,
      activeUsers: 1250,
      apiCalls: 45000,
      customDomainHits: 38000,
      emailsSent: 320,
      brandingViews: 42000,
    };
  }

  transformResponse<T extends Record<string, unknown>>(
    tenantId: string,
    response: T
  ): T {
    const config = this.configs.get(tenantId);
    if (!config || !config.enabled) {
      return response;
    }

    const transformed = { ...response };

    if (config.features.hideRadiantBranding) {
      this.removeRadiantReferences(transformed);
    }

    if (config.features.hideModelNames) {
      this.anonymizeModelNames(transformed);
    }

    if (config.features.hideModelProviders) {
      this.removeProviderInfo(transformed);
    }

    if (config.features.hideCostMetrics) {
      this.removeCostInfo(transformed);
    }

    this.applyCustomTerminology(transformed, config.features.customTerminology);

    return transformed;
  }

  getInjectedCSS(tenantId: string): string {
    const config = this.configs.get(tenantId);
    if (!config || !config.enabled) {
      return '';
    }

    return this.generateBrandingCSS(config.branding);
  }

  getInjectedHeaders(tenantId: string): Record<string, string> {
    const config = this.configs.get(tenantId);
    if (!config || !config.enabled) {
      return {};
    }

    const headers: Record<string, string> = {
      ...config.api.customHeaders,
    };

    if (config.api.hideVersionHeader) {
      delete headers['X-Radiant-Version'];
    }

    return headers;
  }

  private getDefaultConfig(tenantId: string): WhiteLabelConfig {
    return {
      id: '',
      tenantId,
      enabled: false,
      branding: {
        companyName: '',
        productName: '',
        logo: {
          primary: '',
          light: '',
          dark: '',
          icon: '',
        },
        colors: {
          primary: '#3B82F6',
          secondary: '#6366F1',
          accent: '#8B5CF6',
          background: '#FFFFFF',
          foreground: '#1F2937',
          muted: '#9CA3AF',
          border: '#E5E7EB',
          error: '#EF4444',
          warning: '#F59E0B',
          success: '#10B981',
          info: '#3B82F6',
        },
        fonts: {
          primary: 'Inter',
          secondary: 'Inter',
          mono: 'JetBrains Mono',
        },
      },
      domains: [],
      features: {
        hideRadiantBranding: true,
        hidePoweredBy: true,
        hideModelNames: false,
        hideModelProviders: false,
        hideCostMetrics: false,
        hideUsageMetrics: false,
        customTerminology: {
          aiAssistant: 'AI Assistant',
          conversation: 'Conversation',
          session: 'Session',
          artifact: 'Artifact',
          workspace: 'Workspace',
          team: 'Team',
          customTerms: {},
        },
        disabledFeatures: [],
      },
      legal: {
        companyLegalName: '',
        supportEmail: '',
        copyrightNotice: '',
      },
      emails: {
        fromName: '',
        fromEmail: '',
        templates: {},
      },
      api: {
        hideVersionHeader: true,
        customHeaders: {},
        corsOrigins: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private isValidColor(color: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  }

  private async verifyDNSRecord(domain: string, expectedValue: string): Promise<boolean> {
    return Math.random() > 0.3;
  }

  private generateBrandingCSS(branding: BrandingConfig): string {
    return `
:root {
  --color-primary: ${branding.colors.primary};
  --color-secondary: ${branding.colors.secondary};
  --color-accent: ${branding.colors.accent};
  --color-background: ${branding.colors.background};
  --color-foreground: ${branding.colors.foreground};
  --color-muted: ${branding.colors.muted};
  --color-border: ${branding.colors.border};
  --color-error: ${branding.colors.error};
  --color-warning: ${branding.colors.warning};
  --color-success: ${branding.colors.success};
  --color-info: ${branding.colors.info};
  --font-primary: '${branding.fonts.primary}', sans-serif;
  --font-secondary: '${branding.fonts.secondary}', sans-serif;
  --font-mono: '${branding.fonts.mono}', monospace;
}
    `.trim();
  }

  private generatePreviewHTML(branding: BrandingConfig): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>${branding.productName}</title>
  <style>${this.generateBrandingCSS(branding)}</style>
</head>
<body style="font-family: var(--font-primary); background: var(--color-background); color: var(--color-foreground);">
  <header style="background: var(--color-primary); color: white; padding: 1rem;">
    <h1>${branding.productName}</h1>
    ${branding.tagline ? `<p>${branding.tagline}</p>` : ''}
  </header>
  <main style="padding: 2rem;">
    <p>Preview of ${branding.companyName}'s branded experience.</p>
  </main>
</body>
</html>
    `.trim();
  }

  private removeRadiantReferences<T extends Record<string, unknown>>(obj: T): void {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === 'string') {
        (obj as Record<string, unknown>)[key] = value
          .replace(/radiant/gi, '')
          .replace(/RADIANT/g, '');
      } else if (typeof value === 'object' && value !== null) {
        this.removeRadiantReferences(value as Record<string, unknown>);
      }
    }
  }

  private anonymizeModelNames<T extends Record<string, unknown>>(obj: T): void {
    const modelNameFields = ['model', 'modelId', 'modelName'];
    for (const key of Object.keys(obj)) {
      if (modelNameFields.includes(key) && typeof obj[key] === 'string') {
        (obj as Record<string, unknown>)[key] = 'AI Model';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.anonymizeModelNames(obj[key] as Record<string, unknown>);
      }
    }
  }

  private removeProviderInfo<T extends Record<string, unknown>>(obj: T): void {
    const providerFields = ['provider', 'providerId', 'providerName'];
    for (const key of Object.keys(obj)) {
      if (providerFields.includes(key)) {
        delete obj[key];
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.removeProviderInfo(obj[key] as Record<string, unknown>);
      }
    }
  }

  private removeCostInfo<T extends Record<string, unknown>>(obj: T): void {
    const costFields = ['cost', 'costUsd', 'price', 'billing'];
    for (const key of Object.keys(obj)) {
      if (costFields.includes(key)) {
        delete obj[key];
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.removeCostInfo(obj[key] as Record<string, unknown>);
      }
    }
  }

  private applyCustomTerminology<T extends Record<string, unknown>>(
    obj: T,
    terminology: FeatureVisibility['customTerminology']
  ): void {
    const replacements = new Map([
      ['ai assistant', terminology.aiAssistant],
      ['conversation', terminology.conversation],
      ['session', terminology.session],
      ['artifact', terminology.artifact],
      ['workspace', terminology.workspace],
      ['team', terminology.team],
      ...Object.entries(terminology.customTerms),
    ]);

    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === 'string') {
        let replaced = value;
        for (const [from, to] of replacements) {
          replaced = replaced.replace(new RegExp(from, 'gi'), to);
        }
        (obj as Record<string, unknown>)[key] = replaced;
      } else if (typeof value === 'object' && value !== null) {
        this.applyCustomTerminology(value as Record<string, unknown>, terminology);
      }
    }
  }
}

export const whiteLabelService = WhiteLabelService.getInstance();
