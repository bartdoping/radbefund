/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Port-Konfiguration für Development
  devServer: {
    port: 3002,
  },
  // Domain-Konfiguration für Production
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ]
  },
  // Redirect-Konfiguration
  async redirects() {
    return [
      {
        source: '/',
        destination: '/',
        permanent: false,
      },
    ]
  },
}

module.exports = nextConfig
