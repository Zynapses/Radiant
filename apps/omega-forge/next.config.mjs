/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@radiant/shared'],

  env: {
    AURORA_PROXY_ENDPOINT: process.env.AURORA_PROXY_ENDPOINT,
    AURORA_PORT: process.env.AURORA_PORT,
    AURORA_DATABASE: process.env.AURORA_DATABASE,
    CARTRIDGE_BUCKET: process.env.CARTRIDGE_BUCKET,
    OMEGA_STATE_BUCKET: process.env.OMEGA_STATE_BUCKET,
    CORTEX_MODEL_BUCKET: process.env.CORTEX_MODEL_BUCKET,
    GLOBAL_BRAIN_BUCKET: process.env.GLOBAL_BRAIN_BUCKET,
    CARTRIDGE_SIGNING_KEY_ID: process.env.CARTRIDGE_SIGNING_KEY_ID,
  },

  reactStrictMode: true,
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self'",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
