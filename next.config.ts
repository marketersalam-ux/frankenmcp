import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Include the bundled MCP servers and the sample fixtures in the API
  // route bundles, so Vercel's file tracing does not drop them.
  // RISK: must be verified on the deployed URL in task 25 — file tracing
  // is the known failure point for spawned processes on Vercel.
  outputFileTracingIncludes: {
    "/api/*": ["./servers/**/*", "./src/data/samples/**/*"],
  },
};

export default nextConfig;
