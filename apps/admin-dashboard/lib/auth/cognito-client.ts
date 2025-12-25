// ============================================================================
// COGNITO AUTH CLIENT - USING FETCH API FOR SSR COMPATIBILITY
// ============================================================================
// This implementation uses direct fetch calls to Cognito's API instead of
// amazon-cognito-identity-js to avoid SSR compatibility issues with Next.js 14.

const COGNITO_REGION = process.env.NEXT_PUBLIC_COGNITO_REGION || 'us-east-1';
const USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';

const COGNITO_URL = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`;

// Storage keys
const TOKEN_KEY = 'radiant_auth_tokens';
const USER_KEY = 'radiant_auth_user';

// ============================================================================
// TYPES
// ============================================================================

export interface SignInResult {
  isSignedIn: boolean;
  needsMfa: boolean;
}

export interface ConfirmMfaResult {
  isSignedIn: boolean;
}

export interface TokenResult {
  accessToken: string;
  idToken: string;
  refreshToken: string;
}

interface CognitoTokens {
  AccessToken: string;
  IdToken: string;
  RefreshToken: string;
  ExpiresIn: number;
}

interface AuthSession {
  Session: string;
  ChallengeName?: string;
}

// Module-level state for MFA flow
let pendingMfaSession: string | null = null;
let pendingMfaUsername: string | null = null;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function saveTokens(tokens: TokenResult): void {
  const storage = getStorage();
  if (storage) {
    storage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  }
}

function loadTokens(): TokenResult | null {
  const storage = getStorage();
  if (!storage) return null;
  
  const stored = storage.getItem(TOKEN_KEY);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function clearTokens(): void {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(USER_KEY);
  }
}

async function cognitoRequest(action: string, payload: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(COGNITO_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${action}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  
  if (!response.ok) {
    const errorMessage = data.message || data.__type || 'Authentication failed';
    throw new Error(errorMessage);
  }
  
  return data;
}

// ============================================================================
// SIGN IN (Username/Password with USER_PASSWORD_AUTH flow)
// ============================================================================

export async function signIn(email: string, password: string): Promise<SignInResult> {
  if (!CLIENT_ID) {
    throw new Error('Cognito configuration missing. Set NEXT_PUBLIC_COGNITO_CLIENT_ID');
  }

  const result = await cognitoRequest('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: CLIENT_ID,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  }) as { AuthenticationResult?: CognitoTokens; ChallengeName?: string; Session?: string };

  // Check if MFA is required
  if (result.ChallengeName === 'SOFTWARE_TOKEN_MFA' || result.ChallengeName === 'SMS_MFA') {
    pendingMfaSession = result.Session || null;
    pendingMfaUsername = email;
    return { isSignedIn: false, needsMfa: true };
  }

  // Check for new password required
  if (result.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
    throw new Error('Password change required. Please contact your administrator.');
  }

  // Successful sign in
  if (result.AuthenticationResult) {
    const tokens: TokenResult = {
      accessToken: result.AuthenticationResult.AccessToken,
      idToken: result.AuthenticationResult.IdToken,
      refreshToken: result.AuthenticationResult.RefreshToken,
    };
    saveTokens(tokens);
    return { isSignedIn: true, needsMfa: false };
  }

  throw new Error('Unexpected authentication response');
}

// ============================================================================
// CONFIRM MFA
// ============================================================================

export async function confirmMfa(code: string): Promise<ConfirmMfaResult> {
  if (!pendingMfaSession || !pendingMfaUsername) {
    throw new Error('No pending MFA verification');
  }

  const result = await cognitoRequest('RespondToAuthChallenge', {
    ClientId: CLIENT_ID,
    ChallengeName: 'SOFTWARE_TOKEN_MFA',
    Session: pendingMfaSession,
    ChallengeResponses: {
      USERNAME: pendingMfaUsername,
      SOFTWARE_TOKEN_MFA_CODE: code,
    },
  }) as { AuthenticationResult?: CognitoTokens };

  if (result.AuthenticationResult) {
    const tokens: TokenResult = {
      accessToken: result.AuthenticationResult.AccessToken,
      idToken: result.AuthenticationResult.IdToken,
      refreshToken: result.AuthenticationResult.RefreshToken,
    };
    saveTokens(tokens);
    pendingMfaSession = null;
    pendingMfaUsername = null;
    return { isSignedIn: true };
  }

  throw new Error('MFA verification failed');
}

// ============================================================================
// SIGN OUT
// ============================================================================

export async function signOut(): Promise<void> {
  const tokens = loadTokens();
  
  if (tokens?.accessToken) {
    try {
      await cognitoRequest('GlobalSignOut', {
        AccessToken: tokens.accessToken,
      });
    } catch {
      // Ignore errors during sign out - just clear local tokens
    }
  }
  
  clearTokens();
  pendingMfaSession = null;
  pendingMfaUsername = null;
}

// ============================================================================
// GET TOKENS
// ============================================================================

export async function getTokens(): Promise<TokenResult | null> {
  const tokens = loadTokens();
  
  if (!tokens) {
    return null;
  }

  // Try to validate the token by decoding the JWT exp claim
  try {
    const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    
    // If token expires in less than 5 minutes, try to refresh
    if (Date.now() > exp - 5 * 60 * 1000) {
      const refreshed = await refreshSession();
      return refreshed;
    }
    
    return tokens;
  } catch {
    // If token parsing fails, try to refresh
    return refreshSession();
  }
}

// ============================================================================
// REFRESH SESSION
// ============================================================================

export async function refreshSession(): Promise<TokenResult | null> {
  const tokens = loadTokens();
  
  if (!tokens?.refreshToken) {
    return null;
  }

  try {
    const result = await cognitoRequest('InitiateAuth', {
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: tokens.refreshToken,
      },
    }) as { AuthenticationResult?: CognitoTokens };

    if (result.AuthenticationResult) {
      const newTokens: TokenResult = {
        accessToken: result.AuthenticationResult.AccessToken,
        idToken: result.AuthenticationResult.IdToken,
        // Refresh token is not returned on refresh, keep the old one
        refreshToken: tokens.refreshToken,
      };
      saveTokens(newTokens);
      return newTokens;
    }
  } catch {
    // Refresh failed, clear tokens
    clearTokens();
  }
  
  return null;
}

// ============================================================================
// GET CURRENT USER (returns null - use getTokens instead)
// ============================================================================

export async function getCurrentUser(): Promise<null> {
  // This function is kept for API compatibility but returns null
  // Use getTokens() to check if a user is authenticated
  return null;
}
