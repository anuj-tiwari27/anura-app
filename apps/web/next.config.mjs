/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @anura/shared ships compiled CommonJS + types; consume it as a normal dep.
  // (Do NOT add it to transpilePackages — Next would run React Refresh over the
  // CJS dist and fail on injected import.meta.)
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    // Keep the workspace symlink path under node_modules so Next does NOT apply
    // its React-Refresh transform to @anura/shared's compiled CommonJS output.
    config.resolve.symlinks = false;
    return config;
  },
  async rewrites() {
    // Optional convenience proxy: /api/* on the web origin -> the NestJS API.
    // The api client uses NEXT_PUBLIC_API_URL directly, so this is a fallback.
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    return [{ source: '/proxy-api/:path*', destination: `${apiUrl}/api/v1/:path*` }];
  },
};

export default nextConfig;
