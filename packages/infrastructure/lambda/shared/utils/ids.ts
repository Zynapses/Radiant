/**
 * Secure ID generation utilities
 * Uses crypto.randomUUID for cryptographically secure random IDs
 */

export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function generateTenantId(): string {
  return generateId('tn');
}

export function generateUserId(): string {
  return generateId('usr');
}

export function generateApiKeyId(): string {
  return generateId('key');
}

export function generateSessionId(): string {
  return generateId('ses');
}

export function generateRequestId(): string {
  return generateId('req');
}

export function generateNotificationId(): string {
  return generateId('notif');
}

export function generateAuditId(): string {
  return generateId('aud');
}

export function generateWebhookId(): string {
  return generateId('wh');
}

export function generateInvitationId(): string {
  return generateId('inv');
}

export function generateModelId(): string {
  return generateId('mdl');
}

export function generateConversationId(): string {
  return generateId('conv');
}

export function generateMessageId(): string {
  return generateId('msg');
}

export function generateScheduleId(): string {
  return generateId('sched');
}

export function generateAlertId(): string {
  return generateId('alert');
}

/**
 * Generate a short ID (12 characters) for cases where space is limited
 */
export function generateShortId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
}

/**
 * Validate ID format
 */
export function isValidId(id: string, prefix: string): boolean {
  const pattern = new RegExp(`^${prefix}_[a-f0-9]{12,32}$`, 'i');
  return pattern.test(id);
}
