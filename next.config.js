/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Packages resolved at runtime, not bundled by webpack.
    // Prevents "Module not found" for optional/dynamic server-side imports.
    serverComponentsExternalPackages: [
      '@aws-sdk/client-s3',
      'ioredis',
      'bullmq',
      'mongoose',
      '@anthropic-ai/sdk',
      'pdf-parse',
      'mammoth',
    ],
    // Tree-shake barrel exports for these packages
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-tooltip',
    ],
  },
}

module.exports = nextConfig
