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
  // piscine-platform.vercel.app is the only live deployment of this codebase
  // right now, and its known/bookmarked URL is the bare domain — visitors
  // expect that to land directly on the Piscine app, same as it did before
  // the merge, not on the portfolio homepage.
  async redirects() {
    return [{ source: '/', destination: '/piscine', permanent: false }]
  },
}

export default nextConfig
