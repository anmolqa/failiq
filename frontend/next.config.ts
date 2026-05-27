import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Disable Turbopack for production builds (use webpack)
  experimental: {},
};

export default nextConfig;
