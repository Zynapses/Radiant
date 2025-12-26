/**
 * Secure token generation and validation
 */

import { randomBytes, createHash, timingSafeEqual } from 'crypto';

export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('base64url');
}

export function generateCode(length: number = 6): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function verifyToken(token: string, hash: string): boolean {
  const tokenHash = hashToken(token);
  try {
    return timingSafeEqual(
      Buffer.from(tokenHash, 'hex'),
      Buffer.from(hash, 'hex')
    );
  } catch (error) {
    // Hash comparison failed
    return false;
  }
}

export function generateInvitationToken(): { token: string; tokenHash: string } {
  const token = generateToken(48);
  const tokenHash = hashToken(token);
  return { token, tokenHash };
}

export function calculateExpiry(hoursFromNow: number): string {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hoursFromNow);
  return expiry.toISOString();
}

export function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}
