import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 blocks dev resources for any origin but localhost, which leaves a page opened at 127.0.0.1 unhydrated.
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  // The read-only deployment serves the API from this file (see app/api/[...path]/route.ts).
  outputFileTracingIncludes: { "/api/[...path]": ["./data/snapshot.json"] },
  turbopack: {
    root: path.resolve(__dirname),
    rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } },
  },
};

export default nextConfig;
