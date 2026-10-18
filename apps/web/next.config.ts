import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tokentometro/contracts"],
  poweredByHeader: false
};
export default nextConfig;

