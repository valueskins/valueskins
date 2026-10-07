/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  swcMinify: true,
  // Next inlines the whole Google Fonts stylesheet, which includes the legacy
  // .woff faces alongside the .woff2 ones. On production that had the browser
  // pulling both formats — traced at 3.1s, 8.2s and 8.6s for individual font
  // files, which is also what was holding the load event open (domComplete
  // 9.5s). Leaving the <link> alone lets the browser negotiate and take only
  // the woff2 subsets it actually needs. font-display:swap already means text
  // paints immediately either way, so this costs nothing and drops the rest.
  optimizeFonts: false,
  env: {
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  },
  // The store, the skin pages and the levelling views were removed. Old links
  // go to the marketplace rather than to a 404.
  redirects: async () => [
    { source: '/valueskins/:path*', destination: '/deals/browse', permanent: false },
    { source: '/valueskin/:path*', destination: '/deals/browse', permanent: false },
    { source: '/demo/profile', destination: '/profile/me', permanent: false },
    { source: '/preview', destination: '/deals/browse', permanent: false },
  ],
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
