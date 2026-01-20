/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@radiant/shared'],

  // Environment variables for API-only auth
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    NEXT_PUBLIC_APP_NAME: 'Think Tank',
  },

  // CRITICAL: Block any direct AWS SDK imports - Think Tank uses API-only auth
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@aws-amplify/auth': false,
      '@aws-amplify/core': false,
      'amazon-cognito-identity-js': false,
      'aws-sdk': false,
      '@aws-sdk/client-cognito-identity-provider': false,
      '@aws-sdk/client-s3': false,
      '@aws-sdk/client-dynamodb': false,
    };
    
    return config;
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
