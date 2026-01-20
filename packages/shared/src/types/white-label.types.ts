/**
 * White-Label Invisibility Types
 * 
 * Moat #25: End users never know RADIANT exists. Infrastructure stickiness.
 * Platform layer dependency.
 */

export interface WhiteLabelConfig {
  id: string;
  tenantId: string;
  enabled: boolean;
  branding: BrandingConfig;
  domains: DomainConfig[];
  features: FeatureVisibility;
  legal: LegalConfig;
  emails: EmailConfig;
  api: ApiConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrandingConfig {
  companyName: string;
  productName: string;
  tagline?: string;
  logo: LogoConfig;
  colors: ColorConfig;
  fonts: FontConfig;
  favicon?: string;
  socialImage?: string;
}

export interface LogoConfig {
  primary: string;
  light: string;
  dark: string;
  icon: string;
  width?: number;
  height?: number;
}

export interface ColorConfig {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  muted: string;
  border: string;
  error: string;
  warning: string;
  success: string;
  info: string;
}

export interface FontConfig {
  primary: string;
  secondary: string;
  mono: string;
  customFonts?: CustomFont[];
}

export interface CustomFont {
  name: string;
  url: string;
  weight: number;
  style: 'normal' | 'italic';
}

export interface DomainConfig {
  id: string;
  domain: string;
  type: 'primary' | 'alias' | 'api';
  verified: boolean;
  sslEnabled: boolean;
  sslCertificateArn?: string;
  cloudFrontDistributionId?: string;
  createdAt: Date;
}

export interface FeatureVisibility {
  hideRadiantBranding: boolean;
  hidePoweredBy: boolean;
  hideModelNames: boolean;
  hideModelProviders: boolean;
  hideCostMetrics: boolean;
  hideUsageMetrics: boolean;
  customTerminology: TerminologyConfig;
  disabledFeatures: string[];
}

export interface TerminologyConfig {
  aiAssistant: string;
  conversation: string;
  session: string;
  artifact: string;
  workspace: string;
  team: string;
  customTerms: Record<string, string>;
}

export interface LegalConfig {
  companyLegalName: string;
  termsOfServiceUrl?: string;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
  supportEmail: string;
  supportUrl?: string;
  copyrightNotice: string;
  customFooterHtml?: string;
}

export interface EmailConfig {
  fromName: string;
  fromEmail: string;
  replyToEmail?: string;
  logoUrl?: string;
  footerHtml?: string;
  templates: EmailTemplateOverrides;
}

export interface EmailTemplateOverrides {
  welcome?: EmailTemplateConfig;
  passwordReset?: EmailTemplateConfig;
  invitation?: EmailTemplateConfig;
  notification?: EmailTemplateConfig;
  billing?: EmailTemplateConfig;
}

export interface EmailTemplateConfig {
  subject: string;
  htmlTemplate?: string;
  textTemplate?: string;
}

export interface ApiConfig {
  customBaseUrl?: string;
  hideVersionHeader: boolean;
  customHeaders: Record<string, string>;
  corsOrigins: string[];
  rateLimitOverrides?: RateLimitOverride[];
}

export interface RateLimitOverride {
  endpoint: string;
  requestsPerMinute: number;
  burstLimit: number;
}

export interface WhiteLabelRequest {
  tenantId: string;
  config: Partial<WhiteLabelConfig>;
}

export interface WhiteLabelValidation {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  recommendation: string;
}

export interface DomainVerification {
  domain: string;
  method: 'dns_txt' | 'dns_cname' | 'http_file';
  verificationToken: string;
  verificationValue: string;
  verified: boolean;
  verifiedAt?: Date;
  expiresAt: Date;
}

export interface WhiteLabelMetrics {
  tenantId: string;
  period: string;
  activeUsers: number;
  apiCalls: number;
  customDomainHits: number;
  emailsSent: number;
  brandingViews: number;
}

export interface BrandingPreview {
  html: string;
  css: string;
  screenshots: {
    desktop: string;
    mobile: string;
    email: string;
  };
}

export interface WhiteLabelExport {
  config: WhiteLabelConfig;
  assets: ExportedAsset[];
  exportedAt: Date;
  version: string;
}

export interface ExportedAsset {
  type: 'logo' | 'favicon' | 'font' | 'image';
  name: string;
  url: string;
  base64?: string;
}
