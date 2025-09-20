/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Port-Konfiguration für Development
  devServer: {
    port: 3002,
  },
}

module.exports = nextConfig
