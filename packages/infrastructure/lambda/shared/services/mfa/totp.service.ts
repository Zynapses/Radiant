/**
 * RADIANT v5.52.28 - TOTP Service (PROMPT-41B)
 * 
 * RFC 6238 compliant Time-based One-Time Password implementation.
 */

import * as crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface TOTPConfig {
  issuer: string;
  algorithm: 'SHA1' | 'SHA256' | 'SHA512';
  digits: number;
  period: number;
  window: number;
}

export interface TOTPSecret {
  secret: string;
  uri: string;
}

export interface VerifyResult {
  valid: boolean;
  drift?: number;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: TOTPConfig = {
  issuer: 'RADIANT',
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  window: 1,
};

// Base32 alphabet
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// ============================================================================
// TOTP SERVICE
// ============================================================================

export class TOTPService {
  private config: TOTPConfig;
  private encryptionKey: Buffer;

  constructor(config: Partial<TOTPConfig> = {}, encryptionKey: string) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.encryptionKey = crypto.scryptSync(encryptionKey, 'radiant-mfa-salt', 32);
  }

  /**
   * Generate a new TOTP secret for enrollment
   */
  generateSecret(accountName: string): TOTPSecret {
    const secretBytes = crypto.randomBytes(20);
    const secret = this.base32Encode(secretBytes);
    const uri = this.buildOtpauthUri(secret, accountName);
    
    return { secret, uri };
  }

  /**
   * Generate current TOTP code from secret
   */
  generateCode(secret: string, timestamp?: number): string {
    const time = timestamp || Date.now();
    const counter = Math.floor(time / 1000 / this.config.period);
    return this.generateHOTP(secret, counter);
  }

  /**
   * Verify a TOTP code against a secret
   */
  verifyCode(secret: string, code: string, timestamp?: number): VerifyResult {
    const time = timestamp || Date.now();
    const counter = Math.floor(time / 1000 / this.config.period);
    const normalizedCode = code.replace(/\s/g, '').padStart(this.config.digits, '0');
    
    for (let i = -this.config.window; i <= this.config.window; i++) {
      const expectedCode = this.generateHOTP(secret, counter + i);
      if (this.timingSafeEqual(normalizedCode, expectedCode)) {
        return { valid: true, drift: i };
      }
    }
    
    return { valid: false };
  }

  /**
   * Encrypt TOTP secret for database storage
   */
  encryptSecret(secret: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt TOTP secret from database
   */
  decryptSecret(encryptedData: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // --------------------------------------------------------------------------
  // PRIVATE METHODS
  // --------------------------------------------------------------------------

  private generateHOTP(secret: string, counter: number): string {
    const secretBytes = this.base32Decode(secret);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter));
    
    const hmac = crypto.createHmac(this.config.algorithm.toLowerCase(), secretBytes);
    hmac.update(counterBuffer);
    const digest = hmac.digest();
    
    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);
    
    const otp = binary % Math.pow(10, this.config.digits);
    return otp.toString().padStart(this.config.digits, '0');
  }

  private buildOtpauthUri(secret: string, accountName: string): string {
    const params = new URLSearchParams({
      secret,
      issuer: this.config.issuer,
      algorithm: this.config.algorithm,
      digits: this.config.digits.toString(),
      period: this.config.period.toString(),
    });
    
    const encodedIssuer = encodeURIComponent(this.config.issuer);
    const encodedAccount = encodeURIComponent(accountName);
    
    return `otpauth://totp/${encodedIssuer}:${encodedAccount}?${params.toString()}`;
  }

  private base32Encode(buffer: Buffer): string {
    let result = '';
    let bits = 0;
    let value = 0;
    
    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;
      
      while (bits >= 5) {
        result += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    
    if (bits > 0) {
      result += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    
    return result;
  }

  private base32Decode(encoded: string): Buffer {
    const cleanEncoded = encoded.toUpperCase().replace(/=+$/, '');
    const bytes: number[] = [];
    let bits = 0;
    let value = 0;
    
    for (const char of cleanEncoded) {
      const index = BASE32_ALPHABET.indexOf(char);
      if (index === -1) continue;
      
      value = (value << 5) | index;
      bits += 5;
      
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    
    return Buffer.from(bytes);
  }

  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}

// ============================================================================
// BACKUP CODES SERVICE
// ============================================================================

export class BackupCodesService {
  private codeLength: number;
  private codeCount: number;

  constructor(codeLength = 8, codeCount = 10) {
    this.codeLength = codeLength;
    this.codeCount = codeCount;
  }

  /**
   * Generate new backup codes
   */
  generateCodes(): { codes: string[]; hashes: string[] } {
    const codes: string[] = [];
    const hashes: string[] = [];
    
    for (let i = 0; i < this.codeCount; i++) {
      const code = this.generateCode();
      codes.push(code);
      hashes.push(this.hashCode(code));
    }
    
    return { codes, hashes };
  }

  /**
   * Verify a backup code against a hash
   */
  verifyCode(code: string, hash: string): boolean {
    const normalizedCode = code.replace(/[-\s]/g, '').toUpperCase();
    const codeHash = this.hashCode(normalizedCode);
    return crypto.timingSafeEqual(Buffer.from(codeHash), Buffer.from(hash));
  }

  /**
   * Hash a backup code for storage
   */
  hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * Format code for display (xxxx-xxxx)
   */
  formatCode(code: string): string {
    const mid = Math.floor(code.length / 2);
    return `${code.slice(0, mid)}-${code.slice(mid)}`;
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    const randomBytes = crypto.randomBytes(this.codeLength);
    
    for (let i = 0; i < this.codeLength; i++) {
      code += chars[randomBytes[i] % chars.length];
    }
    
    return code;
  }
}

// ============================================================================
// DEVICE TRUST SERVICE
// ============================================================================

export class DeviceTrustService {
  private trustDays: number;
  private maxDevices: number;

  constructor(trustDays = 30, maxDevices = 5) {
    this.trustDays = trustDays;
    this.maxDevices = maxDevices;
  }

  /**
   * Generate a device token
   */
  generateDeviceToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash a device token for storage
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Calculate expiration date
   */
  calculateExpiration(): Date {
    return new Date(Date.now() + this.trustDays * 24 * 60 * 60 * 1000);
  }

  /**
   * Verify a device token
   */
  verifyToken(token: string, storedHash: string): boolean {
    const tokenHash = this.hashToken(token);
    return crypto.timingSafeEqual(Buffer.from(tokenHash), Buffer.from(storedHash));
  }

  /**
   * Parse user agent to device name
   */
  parseUserAgent(ua: string): string {
    if (ua.includes('Chrome') && !ua.includes('Edg')) {
      if (ua.includes('Windows')) return 'Chrome on Windows';
      if (ua.includes('Mac')) return 'Chrome on macOS';
      if (ua.includes('Linux')) return 'Chrome on Linux';
      if (ua.includes('Android')) return 'Chrome on Android';
      return 'Chrome Browser';
    }
    if (ua.includes('Firefox')) {
      if (ua.includes('Windows')) return 'Firefox on Windows';
      if (ua.includes('Mac')) return 'Firefox on macOS';
      if (ua.includes('Linux')) return 'Firefox on Linux';
      return 'Firefox Browser';
    }
    if (ua.includes('Safari') && !ua.includes('Chrome')) {
      if (ua.includes('iPhone')) return 'Safari on iPhone';
      if (ua.includes('iPad')) return 'Safari on iPad';
      if (ua.includes('Mac')) return 'Safari on macOS';
      return 'Safari Browser';
    }
    if (ua.includes('Edg')) {
      if (ua.includes('Windows')) return 'Edge on Windows';
      if (ua.includes('Mac')) return 'Edge on macOS';
      return 'Edge Browser';
    }
    return 'Unknown Browser';
  }

  get maxDevicesPerUser(): number {
    return this.maxDevices;
  }
}
