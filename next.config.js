/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  webpack: (config) => {
    config.watchOptions = {
      ignored: ["**/node_modules/**", "**/.git/**"],
    };
    return config;
  },
};

module.exports = nextConfig;
