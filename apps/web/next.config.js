const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Monorepo: include files outside apps/web in the standalone trace
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@logit/shared'],
};

module.exports = nextConfig;
