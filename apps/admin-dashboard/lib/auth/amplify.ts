/**
 * AWS Amplify Configuration for RADIANT Admin Dashboard
 * Connects to the admin-specific Cognito user pool
 */

import { Amplify } from 'aws-amplify';

export function configureAmplify() {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
        userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
        signUpVerificationMethod: 'code',
        loginWith: {
          email: true,
          username: false,
          phone: false,
        },
        userAttributes: {
          email: { required: true },
        },
        mfa: {
          status: 'optional',
          totpEnabled: true,
          smsEnabled: false,
        },
        passwordFormat: {
          minLength: 12,
          requireLowercase: true,
          requireUppercase: true,
          requireNumbers: true,
          requireSpecialCharacters: true,
        },
      },
    },
  }, {
    ssr: true,
  });
}
