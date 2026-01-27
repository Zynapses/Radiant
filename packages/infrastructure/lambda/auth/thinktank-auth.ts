/**
 * Think Tank Authentication API
 * 
 * Provides API-based authentication for Think Tank apps.
 * Think Tank apps MUST NOT use Cognito SDK directly.
 * All auth flows go through this Lambda.
 * 
 * CRITICAL: This Lambda validates user roles:
 * - Think Tank Consumer (/api/auth/login) - allows any authenticated user
 * - Think Tank Admin (/api/auth/admin/login) - ONLY allows TenantAdmin or SuperAdmin roles
 * 
 * No exceptions. Admin access requires explicit admin role validation.
 */

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  ChangePasswordCommand,
  GetUserCommand,
  GlobalSignOutCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHmac } from 'crypto';
import { Logger } from '../shared/logger';

const logger = new Logger({ handler: 'thinktank-auth' });

const cognitoClient = new CognitoIdentityProviderClient({});

const USER_POOL_ID = process.env.THINKTANK_USER_POOL_ID!;
const CLIENT_ID = process.env.THINKTANK_CLIENT_ID!;
const CLIENT_SECRET = process.env.THINKTANK_CLIENT_SECRET;

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: {
    id: string;
    email: string;
    name: string;
    tenantId: string;
    role: string;
    permissions: string[];
  };
}

function calculateSecretHash(username: string): string | undefined {
  if (!CLIENT_SECRET) return undefined;
  
  return createHmac('sha256', CLIENT_SECRET)
    .update(username + CLIENT_ID)
    .digest('base64');
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
    body: JSON.stringify(body),
  };
}

async function handleLogin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email, password, tenantId } = body;

    if (!email || !password || !tenantId) {
      return jsonResponse(400, {
        code: 'MISSING_FIELDS',
        message: 'Email, password, and tenantId are required',
      });
    }

    const authParams: Record<string, string> = {
      USERNAME: email,
      PASSWORD: password,
    };

    const secretHash = calculateSecretHash(email);
    if (secretHash) {
      authParams.SECRET_HASH = secretHash;
    }

    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: CLIENT_ID,
      AuthParameters: authParams,
    });

    const response = await cognitoClient.send(command);
    const authResult = response.AuthenticationResult;

    if (!authResult?.AccessToken) {
      return jsonResponse(401, {
        code: 'AUTH_FAILED',
        message: 'Authentication failed',
      });
    }

    // Get user details
    const userCommand = new GetUserCommand({
      AccessToken: authResult.AccessToken,
    });
    const userResponse = await cognitoClient.send(userCommand);

    // Extract user attributes
    const attrs = userResponse.UserAttributes || [];
    const getAttribute = (name: string) => attrs.find(a => a.Name === name)?.Value || '';

    // Verify tenant membership
    const userTenantId = getAttribute('custom:tenant_id');
    if (userTenantId !== tenantId) {
      return jsonResponse(403, {
        code: 'TENANT_MISMATCH',
        message: 'User does not belong to this tenant',
      });
    }

    const authResponse: AuthResponse = {
      accessToken: authResult.AccessToken,
      refreshToken: authResult.RefreshToken || '',
      expiresAt: Date.now() + (authResult.ExpiresIn || 3600) * 1000,
      user: {
        id: getAttribute('sub'),
        email: getAttribute('email'),
        name: getAttribute('name') || getAttribute('email'),
        tenantId: userTenantId,
        role: getAttribute('custom:role') || 'user',
        permissions: (getAttribute('custom:permissions') || '').split(',').filter(Boolean),
      },
    };

    return jsonResponse(200, authResponse);
  } catch (error: any) {
    logger.error('Login error', error as Error);

    if (error.name === 'NotAuthorizedException') {
      return jsonResponse(401, {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    if (error.name === 'UserNotConfirmedException') {
      return jsonResponse(401, {
        code: 'USER_NOT_CONFIRMED',
        message: 'Please verify your email before logging in',
      });
    }

    return jsonResponse(500, {
      code: 'LOGIN_ERROR',
      message: 'An error occurred during login',
    });
  }
}

async function handleRefresh(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { refreshToken } = body;

    if (!refreshToken) {
      return jsonResponse(400, {
        code: 'MISSING_TOKEN',
        message: 'Refresh token is required',
      });
    }

    const authParams: Record<string, string> = {
      REFRESH_TOKEN: refreshToken,
    };

    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
      ClientId: CLIENT_ID,
      AuthParameters: authParams,
    });

    const response = await cognitoClient.send(command);
    const authResult = response.AuthenticationResult;

    if (!authResult?.AccessToken) {
      return jsonResponse(401, {
        code: 'REFRESH_FAILED',
        message: 'Token refresh failed',
      });
    }

    // Get user details
    const userCommand = new GetUserCommand({
      AccessToken: authResult.AccessToken,
    });
    const userResponse = await cognitoClient.send(userCommand);

    const attrs = userResponse.UserAttributes || [];
    const getAttribute = (name: string) => attrs.find(a => a.Name === name)?.Value || '';

    const authResponse: AuthResponse = {
      accessToken: authResult.AccessToken,
      refreshToken: refreshToken, // Keep original refresh token
      expiresAt: Date.now() + (authResult.ExpiresIn || 3600) * 1000,
      user: {
        id: getAttribute('sub'),
        email: getAttribute('email'),
        name: getAttribute('name') || getAttribute('email'),
        tenantId: getAttribute('custom:tenant_id'),
        role: getAttribute('custom:role') || 'user',
        permissions: (getAttribute('custom:permissions') || '').split(',').filter(Boolean),
      },
    };

    return jsonResponse(200, authResponse);
  } catch (error: any) {
    logger.error('Refresh error', error as Error);

    return jsonResponse(401, {
      code: 'REFRESH_FAILED',
      message: 'Token refresh failed',
    });
  }
}

async function handleLogout(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    const accessToken = authHeader?.replace('Bearer ', '');

    if (accessToken) {
      const command = new GlobalSignOutCommand({
        AccessToken: accessToken,
      });
      await cognitoClient.send(command);
    }

    return jsonResponse(200, { success: true });
  } catch (error) {
    logger.error('Logout error', error as Error);
    // Return success anyway - client should clear local state
    return jsonResponse(200, { success: true });
  }
}

async function handleRegister(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email, password, name, tenantId } = body;

    if (!email || !password || !tenantId) {
      return jsonResponse(400, {
        code: 'MISSING_FIELDS',
        message: 'Email, password, and tenantId are required',
      });
    }

    const userAttributes = [
      { Name: 'email', Value: email },
      { Name: 'custom:tenant_id', Value: tenantId },
      { Name: 'custom:role', Value: 'user' },
    ];

    if (name) {
      userAttributes.push({ Name: 'name', Value: name });
    }

    const command = new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: userAttributes,
      SecretHash: calculateSecretHash(email),
    });

    await cognitoClient.send(command);

    return jsonResponse(200, {
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
    });
  } catch (error: any) {
    logger.error('Register error', error as Error);

    if (error.name === 'UsernameExistsException') {
      return jsonResponse(400, {
        code: 'USER_EXISTS',
        message: 'An account with this email already exists',
      });
    }

    if (error.name === 'InvalidPasswordException') {
      return jsonResponse(400, {
        code: 'INVALID_PASSWORD',
        message: error.message || 'Password does not meet requirements',
      });
    }

    return jsonResponse(500, {
      code: 'REGISTER_ERROR',
      message: 'An error occurred during registration',
    });
  }
}

async function handleVerifyEmail(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email, code } = body;

    if (!email || !code) {
      return jsonResponse(400, {
        code: 'MISSING_FIELDS',
        message: 'Email and verification code are required',
      });
    }

    const command = new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
      SecretHash: calculateSecretHash(email),
    });

    await cognitoClient.send(command);

    return jsonResponse(200, {
      success: true,
      message: 'Email verified successfully. You can now log in.',
    });
  } catch (error: any) {
    logger.error('Verify email error', error as Error);

    if (error.name === 'CodeMismatchException') {
      return jsonResponse(400, {
        code: 'INVALID_CODE',
        message: 'Invalid verification code',
      });
    }

    if (error.name === 'ExpiredCodeException') {
      return jsonResponse(400, {
        code: 'EXPIRED_CODE',
        message: 'Verification code has expired',
      });
    }

    return jsonResponse(500, {
      code: 'VERIFY_ERROR',
      message: 'An error occurred during verification',
    });
  }
}

async function handleForgotPassword(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email } = body;

    if (!email) {
      return jsonResponse(400, {
        code: 'MISSING_EMAIL',
        message: 'Email is required',
      });
    }

    const command = new ForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: email,
      SecretHash: calculateSecretHash(email),
    });

    await cognitoClient.send(command);

    return jsonResponse(200, {
      success: true,
      message: 'If an account exists with this email, you will receive a password reset code.',
    });
  } catch (error) {
    logger.error('Forgot password error', error as Error);
    // Always return success to prevent email enumeration
    return jsonResponse(200, {
      success: true,
      message: 'If an account exists with this email, you will receive a password reset code.',
    });
  }
}

async function handleResetPassword(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email, code, newPassword } = body;

    if (!email || !code || !newPassword) {
      return jsonResponse(400, {
        code: 'MISSING_FIELDS',
        message: 'Email, code, and new password are required',
      });
    }

    const command = new ConfirmForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
      SecretHash: calculateSecretHash(email),
    });

    await cognitoClient.send(command);

    return jsonResponse(200, {
      success: true,
      message: 'Password reset successful. You can now log in with your new password.',
    });
  } catch (error: any) {
    logger.error('Reset password error', error as Error);

    if (error.name === 'CodeMismatchException') {
      return jsonResponse(400, {
        code: 'INVALID_CODE',
        message: 'Invalid reset code',
      });
    }

    if (error.name === 'ExpiredCodeException') {
      return jsonResponse(400, {
        code: 'EXPIRED_CODE',
        message: 'Reset code has expired',
      });
    }

    return jsonResponse(500, {
      code: 'RESET_ERROR',
      message: 'An error occurred during password reset',
    });
  }
}

async function handleChangePassword(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    const accessToken = authHeader?.replace('Bearer ', '');

    if (!accessToken) {
      return jsonResponse(401, {
        code: 'UNAUTHORIZED',
        message: 'Access token required',
      });
    }

    const body = JSON.parse(event.body || '{}');
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return jsonResponse(400, {
        code: 'MISSING_FIELDS',
        message: 'Current password and new password are required',
      });
    }

    const command = new ChangePasswordCommand({
      AccessToken: accessToken,
      PreviousPassword: currentPassword,
      ProposedPassword: newPassword,
    });

    await cognitoClient.send(command);

    return jsonResponse(200, {
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error: any) {
    logger.error('Change password error', error as Error);

    if (error.name === 'NotAuthorizedException') {
      return jsonResponse(400, {
        code: 'INVALID_PASSWORD',
        message: 'Current password is incorrect',
      });
    }

    return jsonResponse(500, {
      code: 'CHANGE_PASSWORD_ERROR',
      message: 'An error occurred while changing password',
    });
  }
}

async function handleGetSession(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    const accessToken = authHeader?.replace('Bearer ', '');

    if (!accessToken) {
      return jsonResponse(401, {
        code: 'UNAUTHORIZED',
        message: 'Access token required',
      });
    }

    const command = new GetUserCommand({
      AccessToken: accessToken,
    });

    const response = await cognitoClient.send(command);
    const attrs = response.UserAttributes || [];
    const getAttribute = (name: string) => attrs.find(a => a.Name === name)?.Value || '';

    return jsonResponse(200, {
      user: {
        id: getAttribute('sub'),
        email: getAttribute('email'),
        name: getAttribute('name') || getAttribute('email'),
        tenantId: getAttribute('custom:tenant_id'),
        role: getAttribute('custom:role') || 'user',
        permissions: (getAttribute('custom:permissions') || '').split(',').filter(Boolean),
      },
    });
  } catch (error) {
    logger.error('Get session error', error as Error);
    return jsonResponse(401, {
      code: 'INVALID_SESSION',
      message: 'Invalid or expired session',
    });
  }
}

// =============================================================================
// ADMIN-ONLY AUTHENTICATION
// =============================================================================
// Think Tank Admin app MUST use /admin/login - validates TenantAdmin or SuperAdmin role
// No exceptions. Regular users CANNOT access Think Tank Admin.
// =============================================================================

const ADMIN_ROLES = ['SuperAdmin', 'TenantAdmin', 'super_admin', 'tenant_admin', 'admin'];

async function handleAdminLogin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email, password, tenantId } = body;

    if (!email || !password || !tenantId) {
      return jsonResponse(400, {
        code: 'MISSING_FIELDS',
        message: 'Email, password, and tenantId are required',
      });
    }

    const authParams: Record<string, string> = {
      USERNAME: email,
      PASSWORD: password,
    };

    const secretHash = calculateSecretHash(email);
    if (secretHash) {
      authParams.SECRET_HASH = secretHash;
    }

    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: CLIENT_ID,
      AuthParameters: authParams,
    });

    const response = await cognitoClient.send(command);
    const authResult = response.AuthenticationResult;

    if (!authResult?.AccessToken) {
      return jsonResponse(401, {
        code: 'AUTH_FAILED',
        message: 'Authentication failed',
      });
    }

    // Get user details
    const userCommand = new GetUserCommand({
      AccessToken: authResult.AccessToken,
    });
    const userResponse = await cognitoClient.send(userCommand);

    // Extract user attributes
    const attrs = userResponse.UserAttributes || [];
    const getAttribute = (name: string) => attrs.find(a => a.Name === name)?.Value || '';

    // Verify tenant membership
    const userTenantId = getAttribute('custom:tenant_id');
    if (userTenantId !== tenantId) {
      return jsonResponse(403, {
        code: 'TENANT_MISMATCH',
        message: 'User does not belong to this tenant',
      });
    }

    // CRITICAL: Validate admin role - NO EXCEPTIONS
    const userRole = getAttribute('custom:role') || 'user';
    const isAdmin = ADMIN_ROLES.some(role => 
      userRole.toLowerCase() === role.toLowerCase()
    );

    if (!isAdmin) {
      logger.warn('Admin login rejected', { email, role: userRole });
      return jsonResponse(403, {
        code: 'ADMIN_ACCESS_DENIED',
        message: 'This endpoint requires administrator privileges. Access denied.',
      });
    }

    logger.info('Admin login successful', { email, role: userRole });

    const authResponse: AuthResponse = {
      accessToken: authResult.AccessToken,
      refreshToken: authResult.RefreshToken || '',
      expiresAt: Date.now() + (authResult.ExpiresIn || 3600) * 1000,
      user: {
        id: getAttribute('sub'),
        email: getAttribute('email'),
        name: getAttribute('name') || getAttribute('email'),
        tenantId: userTenantId,
        role: userRole,
        permissions: (getAttribute('custom:permissions') || '').split(',').filter(Boolean),
      },
    };

    return jsonResponse(200, authResponse);
  } catch (error: any) {
    logger.error('Admin login error', error as Error);

    if (error.name === 'NotAuthorizedException') {
      return jsonResponse(401, {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    if (error.name === 'UserNotConfirmedException') {
      return jsonResponse(401, {
        code: 'USER_NOT_CONFIRMED',
        message: 'Please verify your email before logging in',
      });
    }

    return jsonResponse(500, {
      code: 'LOGIN_ERROR',
      message: 'An error occurred during login',
    });
  }
}

async function handleAdminRefresh(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { refreshToken } = body;

    if (!refreshToken) {
      return jsonResponse(400, {
        code: 'MISSING_TOKEN',
        message: 'Refresh token is required',
      });
    }

    const authParams: Record<string, string> = {
      REFRESH_TOKEN: refreshToken,
    };

    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
      ClientId: CLIENT_ID,
      AuthParameters: authParams,
    });

    const response = await cognitoClient.send(command);
    const authResult = response.AuthenticationResult;

    if (!authResult?.AccessToken) {
      return jsonResponse(401, {
        code: 'REFRESH_FAILED',
        message: 'Token refresh failed',
      });
    }

    // Get user details
    const userCommand = new GetUserCommand({
      AccessToken: authResult.AccessToken,
    });
    const userResponse = await cognitoClient.send(userCommand);

    const attrs = userResponse.UserAttributes || [];
    const getAttribute = (name: string) => attrs.find(a => a.Name === name)?.Value || '';

    // CRITICAL: Re-validate admin role on refresh - NO EXCEPTIONS
    const userRole = getAttribute('custom:role') || 'user';
    const isAdmin = ADMIN_ROLES.some(role => 
      userRole.toLowerCase() === role.toLowerCase()
    );

    if (!isAdmin) {
      logger.warn('Admin refresh rejected', { role: userRole });
      return jsonResponse(403, {
        code: 'ADMIN_ACCESS_DENIED',
        message: 'Administrator privileges required. Access denied.',
      });
    }

    const authResponse: AuthResponse = {
      accessToken: authResult.AccessToken,
      refreshToken: refreshToken, // Keep original refresh token
      expiresAt: Date.now() + (authResult.ExpiresIn || 3600) * 1000,
      user: {
        id: getAttribute('sub'),
        email: getAttribute('email'),
        name: getAttribute('name') || getAttribute('email'),
        tenantId: getAttribute('custom:tenant_id'),
        role: userRole,
        permissions: (getAttribute('custom:permissions') || '').split(',').filter(Boolean),
      },
    };

    return jsonResponse(200, authResponse);
  } catch (error: any) {
    logger.error('Admin refresh error', error as Error);

    return jsonResponse(401, {
      code: 'REFRESH_FAILED',
      message: 'Token refresh failed',
    });
  }
}

async function handleAdminSession(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    const accessToken = authHeader?.replace('Bearer ', '');

    if (!accessToken) {
      return jsonResponse(401, {
        code: 'UNAUTHORIZED',
        message: 'Access token required',
      });
    }

    const command = new GetUserCommand({
      AccessToken: accessToken,
    });

    const response = await cognitoClient.send(command);
    const attrs = response.UserAttributes || [];
    const getAttribute = (name: string) => attrs.find(a => a.Name === name)?.Value || '';

    // CRITICAL: Validate admin role - NO EXCEPTIONS
    const userRole = getAttribute('custom:role') || 'user';
    const isAdmin = ADMIN_ROLES.some(role => 
      userRole.toLowerCase() === role.toLowerCase()
    );

    if (!isAdmin) {
      return jsonResponse(403, {
        code: 'ADMIN_ACCESS_DENIED',
        message: 'Administrator privileges required. Access denied.',
      });
    }

    return jsonResponse(200, {
      user: {
        id: getAttribute('sub'),
        email: getAttribute('email'),
        name: getAttribute('name') || getAttribute('email'),
        tenantId: getAttribute('custom:tenant_id'),
        role: userRole,
        permissions: (getAttribute('custom:permissions') || '').split(',').filter(Boolean),
      },
    });
  } catch (error) {
    logger.error('Admin session error', error as Error);
    return jsonResponse(401, {
      code: 'INVALID_SESSION',
      message: 'Invalid or expired session',
    });
  }
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: '',
    };
  }

  const path = event.path.replace('/api/auth', '');
  const method = event.httpMethod;

  try {
    switch (`${method} ${path}`) {
      // Consumer endpoints (any authenticated user)
      case 'POST /login':
        return handleLogin(event);
      case 'POST /refresh':
        return handleRefresh(event);
      case 'POST /logout':
        return handleLogout(event);
      case 'POST /register':
        return handleRegister(event);
      case 'POST /verify-email':
        return handleVerifyEmail(event);
      case 'POST /forgot-password':
        return handleForgotPassword(event);
      case 'POST /reset-password':
        return handleResetPassword(event);
      case 'POST /change-password':
        return handleChangePassword(event);
      case 'GET /session':
        return handleGetSession(event);
      
      // ADMIN-ONLY endpoints (TenantAdmin or SuperAdmin required)
      case 'POST /admin/login':
        return handleAdminLogin(event);
      case 'POST /admin/refresh':
        return handleAdminRefresh(event);
      case 'GET /admin/session':
        return handleAdminSession(event);
      
      default:
        return jsonResponse(404, {
          code: 'NOT_FOUND',
          message: `Unknown endpoint: ${method} ${path}`,
        });
    }
  } catch (error) {
    logger.error('Unhandled error', error as Error);
    return jsonResponse(500, {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  }
}
