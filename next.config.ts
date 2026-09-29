import {execFileSync} from 'node:child_process';
import type { NextConfig } from 'next';
const revision=process.env.VERCEL_GIT_COMMIT_SHA??(()=>{try{return execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()+(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()?'-dirty':'');}catch{return 'unknown';}})();
const nextConfig: NextConfig = {
  env:{JUYU_BUILD_REVISION:revision},
  poweredByHeader: false,
  // Avoid restored compiler CSS artifacts disagreeing with the deployed component version.
  experimental: { turbopackFileSystemCacheForBuild: false },
  // Private media is delivered by authorized, no-store routes; never by the shared image optimizer.
  images: { localPatterns: [], remotePatterns: [] },
  serverExternalPackages: ['playwright-core', 'mermaid', '@sparticuz/chromium'],
  outputFileTracingIncludes: {
    // Playwright resolves runtime resources dynamically; tracing alone misses browsers.json.
    // Keep its runtime files and Chromium binary out of unrelated API function bundles.
    '/api/**/pdf': [
      './node_modules/playwright-core/**/*',
      './node_modules/@sparticuz/chromium/bin/**',
      './fonts/**',
    ],
    '/api/**/diagram': [
      './node_modules/mermaid/dist/mermaid.min.js',
      './node_modules/playwright-core/**/*',
      './node_modules/@sparticuz/chromium/bin/**',
      './fonts/**',
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ] }];
  },
};
export default nextConfig;
