/**
 * Environment configuration with validation
 */

import { z } from 'zod';

const envSchema = z.object({
  APP_ID: z.string().min(1),
  ENVIRONMENT: z.enum(['dev', 'staging', 'prod']),
  TIER: z.string().transform(Number).pipe(z.number().min(1).max(5)),
  LITELLM_URL: z.string().url(),
  AURORA_SECRET_ARN: z.string().startsWith('arn:aws:secretsmanager:'),
  AURORA_CLUSTER_ARN: z.string().startsWith('arn:aws:rds:'),
  USAGE_TABLE: z.string().min(1),
  SESSIONS_TABLE: z.string().min(1),
  CACHE_TABLE: z.string().min(1),
  MEDIA_BUCKET: z.string().min(1),
  USER_POOL_ID: z.string().min(1),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  AWS_REGION: z.string().default('us-east-1'),
});

export type Config = z.infer<typeof envSchema>;

let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (cachedConfig) return cachedConfig;

  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('Configuration validation failed:', result.error.flatten());
    throw new Error(`Invalid configuration: ${JSON.stringify(result.error.flatten())}`);
  }

  cachedConfig = result.data;
  return cachedConfig;
}

export interface FeatureFlags {
  multiRegion: boolean;
  waf: boolean;
  guardDuty: boolean;
  sagemaker: boolean;
  elasticache: boolean;
  xray: boolean;
  phiSanitization: boolean;
  advancedMetrics: boolean;
}

export function getFeatureFlags(tier: number): FeatureFlags {
  return {
    multiRegion: tier >= 4,
    waf: tier >= 2,
    guardDuty: tier >= 2,
    sagemaker: tier >= 3,
    elasticache: tier >= 2,
    xray: tier >= 2,
    phiSanitization: true,
    advancedMetrics: tier >= 3,
  };
}
