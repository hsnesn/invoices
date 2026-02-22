/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  webpack: (config) => {
    config.watchOptions = {
      ignored: /node_modules/,
      poll: 1000,
      aggregateTimeout: 300,
    };
    return config;
  },
};

module.exports = nextConfig;
