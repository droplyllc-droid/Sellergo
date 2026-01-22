/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@sellergo/types'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.sellergo.shop',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', '*.sellergo.shop'],
    },
  },
};

module.exports = nextConfig;
