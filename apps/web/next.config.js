/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@logit/shared'],
};

module.exports = nextConfig;
