/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.klassmarket.ru',
      },
    ],
  },
};

module.exports = nextConfig;
