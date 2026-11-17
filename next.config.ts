import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Include the bundled MCP servers and the sample fixtures in the API
  // route bundles, so Vercel's file tracing does not drop them.
  // RISK: must be verified on the deployed URL in task 25 — file tracing
  // is the known failure point for spawned processes on Vercel.
  // tiktoken loads a WASM binary at import time; the bundler traces the JS
  // but drops the .wasm file, so every route importing it 500s on Vercel
  // (verified live 2026-11-18: /api/generate + /api/trim 500, /api/probe
  // and /api/samples — no tiktoken import — answer fine). Keeping the
  // package external runs it from node_modules, WASM file included.
  serverExternalPackages: ["tiktoken"],
  outputFileTracingIncludes: {
    "/api/*": ["./servers/**/*", "./src/data/samples/**/*"],
  },
};

export default nextConfig;
