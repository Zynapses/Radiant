/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    DOJO_API_URL: process.env.DOJO_API_URL || 'http://localhost:3001/api/admin/dojo',
  },
};

module.exports = nextConfig;
