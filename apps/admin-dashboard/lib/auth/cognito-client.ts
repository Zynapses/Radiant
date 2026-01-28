// ============================================================================
// COGNITO AUTH CLIENT - PRODUCTION-READY SSR-COMPATIBLE IMPLEMENTATION
// ============================================================================
// This implementation uses direct fetch calls to Cognito's API instead of
// amazon-cognito-identity-js to avoid SSR compatibility issues with Next.js 14.
//
// Features:
// - Typed error classes with error codes
// - Configurable options (region, pool, timeouts)
// - Retry logic with exponential backoff
// - Auth state change callbacks
// - Token validation and auto-refresh
// - Debug logging option
// - Multiple storage backend support

// ============================================================================
// ERROR TYPES
// ============================================================================

export enum AuthErrorCode {
  // Configuration errors
  MISSING_CONFIG = 'MISSING_CONFIG',
  INVALID_CONFIG = 'INVALID_CONFIG',
  
  // Authentication errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_NOT_CONFIRMED = 'USER_NOT_CONFIRMED',
  PASSWORD_RESET_REQUIRED = 'PASSWORD_RESET_REQUIRED',
  NEW_PASSWORD_REQUIRED = 'NEW_PASSWORD_REQUIRED',
  
  // MFA errors
  MFA_REQUIRED = 'MFA_REQUIRED',
  MFA_INVALID_CODE = 'MFA_INVALID_CODE',
  MFA_NO_PENDING_SESSION = 'MFA_NO_PENDING_SESSION',
  
  // Token errors
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  REFRESH_FAILED = 'REFRESH_FAILED',
  
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  
  // Generic errors
  UNKNOWN = 'UNKNOWN',
}

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly originalError?: Error;
  readonly retryable: boolean;

  constructor(
    code: AuthErrorCode,
    message: string,
    options?: { originalError?: Error; retryable?: boolean }
  ) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.originalError = options?.originalError;
    this.retryable = options?.retryable ?? false;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthError);
    }
  }

  static fromCognitoError(type: string, message: string): AuthError {
    const errorMap: Record<string, { code: AuthErrorCode; retryable: boolean }> = {
      'NotAuthorizedException': { code: AuthErrorCode.INVALID_CREDENTIALS, retryable: false },
      'UserNotFoundException': { code: AuthErrorCode.USER_NOT_FOUND, retryable: false },
      'UserNotConfirmedException': { code: AuthErrorCode.USER_NOT_CONFIRMED, retryable: false },
      'PasswordResetRequiredException': { code: AuthErrorCode.PASSWORD_RESET_REQUIRED, retryable: false },
      'TooManyRequestsException': { code: AuthErrorCode.RATE_LIMITED, retryable: true },
      'LimitExceededException': { code: AuthErrorCode.RATE_LIMITED, retryable: true },
      'CodeMismatchException': { code: AuthErrorCode.MFA_INVALID_CODE, retryable: false },
      'ExpiredCodeException': { code: AuthErrorCode.MFA_INVALID_CODE, retryable: false },
    };

    const mapped = errorMap[type] || { code: AuthErrorCode.UNKNOWN, retryable: false };
    return new AuthError(mapped.code, message, { retryable: mapped.retryable });
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface CognitoClientConfig {
  region?: string;
  userPoolId?: string;
  clientId?: string;
  
  // Storage configuration
  storage?: 'localStorage' | 'sessionStorage' | 'memory';
  storageKeyPrefix?: string;
  
  // Network configuration
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  
  // Token configuration
  tokenRefreshThreshold?: number;
  
  // Callbacks
  onAuthStateChange?: (state: AuthState) => void;
  onTokenRefresh?: (tokens: TokenResult) => void;
  onError?: (error: AuthError) => void;
  
  // Debug
  debug?: boolean;
}

export type AuthState = 'authenticated' | 'unauthenticated' | 'loading' | 'mfa_required';

// ============================================================================
// TYPES
// ============================================================================

export interface SignInResult {
  isSignedIn: boolean;
  needsMfa: boolean;
  challengeName?: string;
}

export interface ConfirmMfaResult {
  isSignedIn: boolean;
}

export interface TokenResult {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresAt?: number;
}

export interface DecodedToken {
  sub: string;
  email?: string;
  'cognito:username'?: string;
  'cognito:groups'?: string[];
  exp: number;
  iat: number;
  [key: string]: unknown;
}

interface CognitoTokens {
  AccessToken: string;
  IdToken: string;
  RefreshToken?: string;
  ExpiresIn: number;
}

interface CognitoAuthResult {
  AuthenticationResult?: CognitoTokens;
  ChallengeName?: string;
  Session?: string;
  ChallengeParameters?: Record<string, string>;
}

// ============================================================================
// COGNITO CLIENT CLASS
// ============================================================================

class CognitoAuthClient {
  private region: string;
  private userPoolId: string;
  private clientId: string;
  private cognitoUrl: string;
  
  private storage: 'localStorage' | 'sessionStorage' | 'memory';
  private storageKeyPrefix: string;
  private timeout: number;
  private maxRetries: number;
  private retryDelay: number;
  private tokenRefreshThreshold: number;
  private debug: boolean;
  
  private onAuthStateChange?: (state: AuthState) => void;
  private onTokenRefresh?: (tokens: TokenResult) => void;
  private onError?: (error: AuthError) => void;
  
  private memoryStorage: Map<string, string> = new Map();
  private pendingMfaSession: string | null = null;
  private pendingMfaUsername: string | null = null;
  private pendingMfaChallenge: string | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: CognitoClientConfig = {}) {
    this.region = config.region || process.env.NEXT_PUBLIC_COGNITO_REGION || 'us-east-1';
    this.userPoolId = config.userPoolId || process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
    this.clientId = config.clientId || process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';
    this.cognitoUrl = `https://cognito-idp.${this.region}.amazonaws.com/`;
    
    this.storage = config.storage || 'localStorage';
    this.storageKeyPrefix = config.storageKeyPrefix || 'radiant_auth_';
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
    this.tokenRefreshThreshold = config.tokenRefreshThreshold || 300;
    this.debug = config.debug || false;
    
    this.onAuthStateChange = config.onAuthStateChange;
    this.onTokenRefresh = config.onTokenRefresh;
    this.onError = config.onError;
    
    // Suppress unused warnings for reserved properties
    void this.userPoolId;
    void this.onError;
    
    this.log('CognitoAuthClient initialized', { region: this.region, clientId: this.clientId ? '***' : 'missing' });
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  updateConfig(config: Partial<CognitoClientConfig>): void {
    if (config.region) {
      this.region = config.region;
      this.cognitoUrl = `https://cognito-idp.${this.region}.amazonaws.com/`;
    }
    if (config.userPoolId) this.userPoolId = config.userPoolId;
    if (config.clientId) this.clientId = config.clientId;
    if (config.storage) this.storage = config.storage;
    if (config.storageKeyPrefix) this.storageKeyPrefix = config.storageKeyPrefix;
    if (config.timeout) this.timeout = config.timeout;
    if (config.maxRetries) this.maxRetries = config.maxRetries;
    if (config.retryDelay) this.retryDelay = config.retryDelay;
    if (config.tokenRefreshThreshold) this.tokenRefreshThreshold = config.tokenRefreshThreshold;
    if (config.debug !== undefined) this.debug = config.debug;
    if (config.onAuthStateChange) this.onAuthStateChange = config.onAuthStateChange;
    if (config.onTokenRefresh) this.onTokenRefresh = config.onTokenRefresh;
    if (config.onError) this.onError = config.onError;
    
    this.log('Config updated');
  }

  // ============================================================================
  // LOGGING
  // ============================================================================

  private log(message: string, data?: unknown): void {
    if (this.debug) {
      console.log(`[CognitoAuth] ${message}`, data ?? '');
    }
  }

  private logError(message: string, error?: unknown): void {
    if (this.debug) {
      console.error(`[CognitoAuth] ${message}`, error ?? '');
    }
  }

  // ============================================================================
  // STORAGE
  // ============================================================================

  private getStorage(): { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void; removeItem: (key: string) => void } | null {
    if (typeof window === 'undefined') return null;
    
    switch (this.storage) {
      case 'sessionStorage':
        return window.sessionStorage;
      case 'memory':
        return {
          getItem: (key: string) => this.memoryStorage.get(key) ?? null,
          setItem: (key: string, value: string) => this.memoryStorage.set(key, value),
          removeItem: (key: string) => { this.memoryStorage.delete(key); },
        };
      default:
        return window.localStorage;
    }
  }

  private getStorageKey(key: string): string {
    return `${this.storageKeyPrefix}${key}`;
  }

  private saveTokens(tokens: TokenResult): void {
    const storage = this.getStorage();
    if (storage) {
      storage.setItem(this.getStorageKey('tokens'), JSON.stringify(tokens));
      this.log('Tokens saved');
      this.scheduleTokenRefresh(tokens);
      this.onTokenRefresh?.(tokens);
    }
  }

  private loadTokens(): TokenResult | null {
    const storage = this.getStorage();
    if (!storage) return null;
    
    const stored = storage.getItem(this.getStorageKey('tokens'));
    if (!stored) return null;
    
    try {
      return JSON.parse(stored);
    } catch (error) {
      this.logError('Failed to parse stored tokens', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  private clearTokens(): void {
    const storage = this.getStorage();
    if (storage) {
      storage.removeItem(this.getStorageKey('tokens'));
      storage.removeItem(this.getStorageKey('user'));
      this.log('Tokens cleared');
    }
    this.cancelTokenRefresh();
  }

  // ============================================================================
  // TOKEN REFRESH SCHEDULING
  // ============================================================================

  private scheduleTokenRefresh(tokens: TokenResult): void {
    this.cancelTokenRefresh();
    
    if (!tokens.expiresAt) return;
    
    const now = Date.now();
    const refreshAt = (tokens.expiresAt * 1000) - (this.tokenRefreshThreshold * 1000);
    const delay = Math.max(0, refreshAt - now);
    
    if (delay > 0) {
      this.log(`Scheduling token refresh in ${Math.round(delay / 1000)}s`);
      this.refreshTimer = setTimeout(() => {
        this.refreshSession().catch(err => {
          this.logError('Scheduled token refresh failed', err);
        });
      }, delay);
    }
  }

  private cancelTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // ============================================================================
  // NETWORK
  // ============================================================================

  private async cognitoRequest<T>(action: string, payload: Record<string, unknown>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        this.log(`Request: ${action}`, { attempt: attempt + 1 });
        
        const response = await fetch(this.cognitoUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': `AWSCognitoIdentityProviderService.${action}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        const data = await response.json();
        
        if (!response.ok) {
          const errorType = data.__type?.split('#').pop() || 'Unknown';
          const errorMessage = data.message || 'Authentication failed';
          
          this.logError(`Cognito error: ${errorType}`, errorMessage);
          
          const authError = AuthError.fromCognitoError(errorType, errorMessage);
          
          if (!authError.retryable) {
            throw authError;
          }
          
          lastError = authError;
        } else {
          this.log(`Response: ${action} success`);
          return data as T;
        }
      } catch (error) {
        if (error instanceof AuthError) {
          throw error;
        }
        
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            lastError = new AuthError(AuthErrorCode.TIMEOUT, 'Request timed out', { retryable: true });
          } else {
            lastError = new AuthError(AuthErrorCode.NETWORK_ERROR, error.message, { 
              originalError: error, 
              retryable: true 
            });
          }
        }
        
        this.logError(`Request failed (attempt ${attempt + 1})`, error);
      }
      
      if (attempt < this.maxRetries - 1) {
        const delay = this.retryDelay * Math.pow(2, attempt);
        this.log(`Retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new AuthError(AuthErrorCode.UNKNOWN, 'Request failed after retries');
  }

  // ============================================================================
  // TOKEN UTILITIES
  // ============================================================================

  decodeToken(token: string): DecodedToken | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(atob(parts[1]));
      return payload as DecodedToken;
    } catch (error) {
      console.warn('[Cognito] Failed to decode token:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  isTokenExpired(token: string, thresholdSeconds = 0): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded) return true;
    
    const now = Math.floor(Date.now() / 1000);
    return decoded.exp <= now + thresholdSeconds;
  }

  // ============================================================================
  // AUTH STATE
  // ============================================================================

  private setAuthState(state: AuthState): void {
    this.log(`Auth state: ${state}`);
    this.onAuthStateChange?.(state);
  }

  // ============================================================================
  // SIGN IN
  // ============================================================================

  async signIn(email: string, password: string): Promise<SignInResult> {
    if (!this.clientId) {
      throw new AuthError(AuthErrorCode.MISSING_CONFIG, 'Cognito Client ID not configured');
    }

    this.setAuthState('loading');

    const result = await this.cognitoRequest<CognitoAuthResult>('InitiateAuth', {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: this.clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });

    if (result.ChallengeName === 'SOFTWARE_TOKEN_MFA' || result.ChallengeName === 'SMS_MFA') {
      this.pendingMfaSession = result.Session || null;
      this.pendingMfaUsername = email;
      this.pendingMfaChallenge = result.ChallengeName;
      this.setAuthState('mfa_required');
      return { isSignedIn: false, needsMfa: true, challengeName: result.ChallengeName };
    }

    if (result.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      throw new AuthError(AuthErrorCode.NEW_PASSWORD_REQUIRED, 'Password change required');
    }

    if (result.AuthenticationResult) {
      const decoded = this.decodeToken(result.AuthenticationResult.AccessToken);
      const tokens: TokenResult = {
        accessToken: result.AuthenticationResult.AccessToken,
        idToken: result.AuthenticationResult.IdToken,
        refreshToken: result.AuthenticationResult.RefreshToken || '',
        expiresAt: decoded?.exp,
      };
      this.saveTokens(tokens);
      this.setAuthState('authenticated');
      return { isSignedIn: true, needsMfa: false };
    }

    throw new AuthError(AuthErrorCode.UNKNOWN, 'Unexpected authentication response');
  }

  // ============================================================================
  // CONFIRM MFA
  // ============================================================================

  async confirmMfa(code: string): Promise<ConfirmMfaResult> {
    if (!this.pendingMfaSession || !this.pendingMfaUsername) {
      throw new AuthError(AuthErrorCode.MFA_NO_PENDING_SESSION, 'No pending MFA verification');
    }

    this.setAuthState('loading');

    const challengeName = this.pendingMfaChallenge || 'SOFTWARE_TOKEN_MFA';
    const codeKey = challengeName === 'SMS_MFA' ? 'SMS_MFA_CODE' : 'SOFTWARE_TOKEN_MFA_CODE';

    const result = await this.cognitoRequest<CognitoAuthResult>('RespondToAuthChallenge', {
      ClientId: this.clientId,
      ChallengeName: challengeName,
      Session: this.pendingMfaSession,
      ChallengeResponses: {
        USERNAME: this.pendingMfaUsername,
        [codeKey]: code,
      },
    });

    if (result.AuthenticationResult) {
      const decoded = this.decodeToken(result.AuthenticationResult.AccessToken);
      const tokens: TokenResult = {
        accessToken: result.AuthenticationResult.AccessToken,
        idToken: result.AuthenticationResult.IdToken,
        refreshToken: result.AuthenticationResult.RefreshToken || '',
        expiresAt: decoded?.exp,
      };
      this.saveTokens(tokens);
      this.pendingMfaSession = null;
      this.pendingMfaUsername = null;
      this.pendingMfaChallenge = null;
      this.setAuthState('authenticated');
      return { isSignedIn: true };
    }

    throw new AuthError(AuthErrorCode.MFA_INVALID_CODE, 'MFA verification failed');
  }

  // ============================================================================
  // SIGN OUT
  // ============================================================================

  async signOut(): Promise<void> {
    const tokens = this.loadTokens();
    
    if (tokens?.accessToken) {
      try {
        await this.cognitoRequest('GlobalSignOut', {
          AccessToken: tokens.accessToken,
        });
      } catch (error) {
        this.logError('Sign out request failed', error);
      }
    }
    
    this.clearTokens();
    this.pendingMfaSession = null;
    this.pendingMfaUsername = null;
    this.pendingMfaChallenge = null;
    this.setAuthState('unauthenticated');
  }

  // ============================================================================
  // GET TOKENS
  // ============================================================================

  async getTokens(): Promise<TokenResult | null> {
    const tokens = this.loadTokens();
    
    if (!tokens) {
      return null;
    }

    try {
      if (this.isTokenExpired(tokens.accessToken, this.tokenRefreshThreshold)) {
        this.log('Token expired or expiring soon, refreshing');
        const refreshed = await this.refreshSession();
        return refreshed;
      }
      
      return tokens;
    } catch (error) {
      console.warn('[Cognito] Token validation failed, attempting refresh:', error instanceof Error ? error.message : 'Unknown error');
      return this.refreshSession();
    }
  }

  // ============================================================================
  // REFRESH SESSION
  // ============================================================================

  async refreshSession(): Promise<TokenResult | null> {
    const tokens = this.loadTokens();
    
    if (!tokens?.refreshToken) {
      this.log('No refresh token available');
      return null;
    }

    try {
      const result = await this.cognitoRequest<CognitoAuthResult>('InitiateAuth', {
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          REFRESH_TOKEN: tokens.refreshToken,
        },
      });

      if (result.AuthenticationResult) {
        const decoded = this.decodeToken(result.AuthenticationResult.AccessToken);
        const newTokens: TokenResult = {
          accessToken: result.AuthenticationResult.AccessToken,
          idToken: result.AuthenticationResult.IdToken,
          refreshToken: tokens.refreshToken,
          expiresAt: decoded?.exp,
        };
        this.saveTokens(newTokens);
        this.log('Session refreshed successfully');
        return newTokens;
      }
    } catch (error) {
      this.logError('Refresh failed', error);
      this.clearTokens();
      this.setAuthState('unauthenticated');
    }
    
    return null;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  async getCurrentUser(): Promise<DecodedToken | null> {
    const tokens = await this.getTokens();
    if (!tokens) return null;
    
    return this.decodeToken(tokens.idToken);
  }

  isAuthenticated(): boolean {
    const tokens = this.loadTokens();
    if (!tokens) return false;
    
    return !this.isTokenExpired(tokens.accessToken);
  }

  getStoredTokens(): TokenResult | null {
    return this.loadTokens();
  }
}

// ============================================================================
// SINGLETON INSTANCE & EXPORTS
// ============================================================================

let clientInstance: CognitoAuthClient | null = null;

function getClient(): CognitoAuthClient {
  if (!clientInstance) {
    clientInstance = new CognitoAuthClient();
  }
  return clientInstance;
}

export function configureAuth(config: CognitoClientConfig): void {
  if (clientInstance) {
    clientInstance.updateConfig(config);
  } else {
    clientInstance = new CognitoAuthClient(config);
  }
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  return getClient().signIn(email, password);
}

export async function confirmMfa(code: string): Promise<ConfirmMfaResult> {
  return getClient().confirmMfa(code);
}

export async function signOut(): Promise<void> {
  return getClient().signOut();
}

export async function getTokens(): Promise<TokenResult | null> {
  return getClient().getTokens();
}

export async function refreshSession(): Promise<TokenResult | null> {
  return getClient().refreshSession();
}

export async function getCurrentUser(): Promise<DecodedToken | null> {
  return getClient().getCurrentUser();
}

export function isAuthenticated(): boolean {
  return getClient().isAuthenticated();
}

export function decodeToken(token: string): DecodedToken | null {
  return getClient().decodeToken(token);
}

export { CognitoAuthClient };
