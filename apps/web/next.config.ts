import type { NextConfig } from "next";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../");

const nextConfig: NextConfig = {
  output: "export",
  outputFileTracingRoot: repoRoot,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
    ],
  },
  turbopack: {
    root: repoRoot,
  },
};

export default nextConfig;
