import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Private media is delivered by authorized, no-store routes; never by the shared image optimizer.
  images: { localPatterns: [], remotePatterns: [] },
  serverExternalPackages: ['playwright-core', 'mermaid'],
  outputFileTracingIncludes: {'/api/**': [
    './node_modules/mermaid/dist/mermaid.min.js',
    // Playwright resolves runtime resources dynamically; tracing alone misses browsers.json.
    './node_modules/playwright-core/**/*',
  ]},
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ] }];
  },
};
export default nextConfig;
