/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    CATO_TRAINER_API_URL: process.env.CATO_TRAINER_API_URL || 'http://localhost:3001/api/admin/cato-trainer',
  },
};

module.exports = nextConfig;
