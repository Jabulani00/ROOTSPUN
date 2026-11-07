/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship as TS source; let Next transpile them.
  transpilePackages: ["@rootspun/ui", "@rootspun/core", "@rootspun/db", "@rootspun/rules"],
  experimental: {
    typedRoutes: true,
  },
  // Lint runs as its own CI step (pnpm lint); keep `next build` to compile + types.
  eslint: { ignoreDuringBuilds: true },
  // Workspace packages use NodeNext-style ".js" import specifiers that resolve to
  // ".ts"/".tsx" sources; teach webpack to follow them.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
