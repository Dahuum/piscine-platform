/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['pg'],
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: process.cwd(),
  },
  devIndicators: false,
}

export default nextConfig
