/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.VERCEL ? undefined : 'standalone',
  transpilePackages: ['mathml2omml', 'pptxgenjs'],
  serverExternalPackages: [],
  outputFileTracingExcludes: {
    '*': [
      // Next server can start without bundling TypeScript in production runtime.
      'node_modules/typescript/**/*',
      'node_modules/.pnpm/typescript@*/node_modules/typescript/**/*',
      // Keep glibc sharp binary, exclude musl variant to avoid duplicate libvips payload.
      'node_modules/.pnpm/@img+sharp-libvips-linuxmusl-x64@*/node_modules/@img/sharp-libvips-linuxmusl-x64/**/*',
      'node_modules/.pnpm/@img+sharp-linuxmusl-x64@*/node_modules/@img/sharp-linuxmusl-x64/**/*',
    ],
  },
  experimental: {
    proxyClientMaxBodySize: '200mb',
  },
};

export default nextConfig;
