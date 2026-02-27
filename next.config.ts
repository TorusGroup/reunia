import type { NextConfig } from 'next'

// =============================================================
// Next.js Configuration (E8-S07 — Sprint 7 Performance)
// Image optimization, compression, security hardening
// =============================================================

const nextConfig: NextConfig = {
  // --- Standalone output for Railway deploy ---
  output: 'standalone',

  // --- Image optimization ---
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.fbi.gov' },
      { protocol: 'https', hostname: '**.interpol.int' },
      { protocol: 'https', hostname: '**.missingkids.org' },
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/reunia/**' },
      // Brazil government domains
      { protocol: 'https', hostname: '**.gov.br' },
      { protocol: 'https', hostname: '**.org.br' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600, // 1 hour
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
  },

  // --- Compression ---
  compress: true,

  // --- Remove X-Powered-By header ---
  poweredByHeader: false,

  // --- React Strict Mode ---
  reactStrictMode: true,

  // --- Package import optimization ---
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  // --- Server external packages (Node.js only, not bundled by webpack) ---
  serverExternalPackages: ['pino', 'pino-pretty', '@prisma/client'],

  // --- Webpack: exclude browser-only packages from server bundle ---
  webpack: (config, { isServer }) => {
    if (isServer) {
      // face-api.js uses browser APIs (Canvas, HTMLImageElement) — never bundle server-side
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        '@vladmandic/face-api',
      ]
    }
    return config
  },

  // --- Logging ---
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },
}

export default nextConfig
