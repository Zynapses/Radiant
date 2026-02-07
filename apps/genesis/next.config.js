/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three'],
  env: {
    OMEGA_API_URL: process.env.OMEGA_API_URL || 'http://localhost:3001/api/admin/omega',
  },
};

module.exports = nextConfig;
