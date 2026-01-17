/**
 * RADIANT Environment Configuration
 * ═══════════════════════════════════════════════════════════════════════════
 * Single AWS Account — Environment separation via resource naming and tags
 * 
 * ⚠️  CRITICAL SAFETY RULE — NEVER IGNORE ⚠️
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 *   cdk watch --hotswap is ONLY allowed in DEV environment.
 *   
 *   STAGING and PROD require:
 *     1. Explicit approval gates
 *     2. Full cdk deploy (no hotswap)
 *     3. Swift Deployer or manual CLI with --require-approval
 * 
 *   This rule exists because hotswap bypasses CloudFormation safety checks,
 *   skips rollback capabilities, and can leave infrastructure in inconsistent
 *   states. In production, this could cause outages.
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type Environment = 'dev' | 'staging' | 'prod';

export interface EnvironmentConfig {
  /** Environment identifier */
  name: Environment;
  
  /** Prefix for all AWS resource names (e.g., radiant-dev-chat-handler) */
  prefix: string;
  
  /** Infrastructure tier (1-5) controlling resource sizing */
  tier: 1 | 2 | 3 | 4 | 5;
  
  /** 
   * Allow cdk watch hotswap deployments (DEV ONLY)
   * ⚠️ HARD RULE: This MUST be false for staging and prod
   */
  enableCdkWatch: boolean;
  
  /** Require manual approval before deploying */
  requireApproval: boolean;
  
  /** Tags applied to all resources */
  tags: Record<string, string>;
  
  /** Log level for Lambda functions */
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  
  /** Enable detailed tracing (X-Ray) */
  enableTracing: boolean;
}

/**
 * Environment Configurations
 * ─────────────────────────────────────────────────────────────────────────
 * DEV:     Direct Dev Mode enabled — Windsurf deploys via cdk watch
 * STAGING: Swift Deployer only — cdk watch disabled
 * PROD:    Swift Deployer only — cdk watch disabled, approval required
 */
export const ENVIRONMENTS: Record<Environment, EnvironmentConfig> = {
  
  dev: {
    name: 'dev',
    prefix: 'radiant-dev',
    tier: 1,                    // Minimal resources for cost savings
    enableCdkWatch: true,       // ✅ ENABLED — Direct Dev Mode
    requireApproval: false,
    logLevel: 'DEBUG',
    enableTracing: true,
    tags: {
      Environment: 'dev',
      Project: 'radiant',
      ManagedBy: 'cdk-watch',
      CostCenter: 'development',
    },
  },

  staging: {
    name: 'staging',
    prefix: 'radiant-staging',
    tier: 2,                    // Moderate resources for testing
    enableCdkWatch: false,      // ❌ DISABLED — Use Swift Deployer
    requireApproval: true,
    logLevel: 'INFO',
    enableTracing: true,
    tags: {
      Environment: 'staging',
      Project: 'radiant',
      ManagedBy: 'swift-deployer',
      CostCenter: 'testing',
    },
  },

  prod: {
    name: 'prod',
    prefix: 'radiant-prod',
    tier: 3,                    // Production-grade resources
    enableCdkWatch: false,      // ❌ DISABLED — Use Swift Deployer
    requireApproval: true,
    logLevel: 'INFO',
    enableTracing: true,
    tags: {
      Environment: 'prod',
      Project: 'radiant',
      ManagedBy: 'swift-deployer',
      CostCenter: 'production',
    },
  },
};

/**
 * Get configuration for an environment
 */
export function getEnvironmentConfig(env: string): EnvironmentConfig {
  const config = ENVIRONMENTS[env as Environment];
  if (!config) {
    throw new Error(
      `Unknown environment: "${env}". Valid options: dev, staging, prod` 
    );
  }
  return config;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HARD SAFETY RULE: Block cdk watch on non-dev environments
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This function THROWS an error (not just warns) for staging/prod.
 * This is intentional — cdk watch --hotswap can corrupt infrastructure.
 * 
 * @throws Error if environment is not 'dev'
 */
export function assertCdkWatchAllowed(env: string): void {
  const config = getEnvironmentConfig(env);
  
  if (!config.enableCdkWatch) {
    const errorMessage = `
╔═══════════════════════════════════════════════════════════════════════════╗
║ 🛑 BLOCKED: cdk watch is FORBIDDEN for ${env.toUpperCase().padEnd(8)} environment           ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  cdk watch --hotswap bypasses CloudFormation safety checks and can:       ║
║    • Leave infrastructure in inconsistent states                          ║
║    • Skip rollback capabilities                                           ║
║    • Cause production outages                                             ║
║                                                                           ║
║  FOR STAGING/PROD, use one of these SAFE methods:                         ║
║                                                                           ║
║    1. Swift Deployer (recommended)                                        ║
║       Open the Swift Deployer app and use the deployment wizard           ║
║                                                                           ║
║    2. Manual CLI with approval gates:                                     ║
║       AWS_PROFILE=radiant-${env} npx cdk deploy --all \\                   ║
║         --require-approval broadening                                     ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
`;
    console.error(errorMessage);
    throw new Error(`BLOCKED: cdk watch is not allowed for ${env} environment`);
  }
}

/**
 * Check if cdk watch is allowed (non-throwing version for conditional checks)
 */
export function isCdkWatchAllowed(env: string): boolean {
  const config = getEnvironmentConfig(env);
  return config.enableCdkWatch === true;
}

/**
 * Get resource prefix for the current environment
 */
export function getResourcePrefix(env: string): string {
  return getEnvironmentConfig(env).prefix;
}

/**
 * Get all tags for an environment (merges with custom tags)
 */
export function getEnvironmentTags(env: string, customTags?: Record<string, string>): Record<string, string> {
  const config = getEnvironmentConfig(env);
  return {
    ...config.tags,
    ...customTags,
  };
}
