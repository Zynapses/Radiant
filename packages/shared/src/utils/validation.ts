/**
 * RADIANT v4.18.0 - Validation Utilities
 */

import { DOMAIN_PLACEHOLDER } from '../constants/version';

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidDomain(domain: string): boolean {
  if (domain.includes(DOMAIN_PLACEHOLDER)) {
    return false;
  }
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
  return domainRegex.test(domain);
}

export function isValidAppId(appId: string): boolean {
  const appIdRegex = /^[a-z][a-z0-9-]{2,49}$/;
  return appIdRegex.test(appId);
}

export function isValidAWSRegion(region: string): boolean {
  const regionRegex = /^[a-z]{2}-[a-z]+-\d+$/;
  return regionRegex.test(region);
}

export function isValidAWSAccountId(accountId: string): boolean {
  const accountIdRegex = /^\d{12}$/;
  return accountIdRegex.test(accountId);
}

export function validateTenantId(tenantId: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(tenantId);
}

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '')
    .substring(0, 10000);
}
