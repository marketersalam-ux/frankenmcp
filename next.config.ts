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
  // @modelcontextprotocol/sdk is external for the same tracing reason in
  // reverse: the bundled demo servers are spawned as child processes and
  // import the SDK from node_modules at runtime — when webpack inlines it
  // into the route bundle, the package files never reach the function and
  // the child dies instantly (502 "Connection closed", 2026-11-18).
  serverExternalPackages: ["tiktoken", "@modelcontextprotocol/sdk"],
  outputFileTracingIncludes: {
    "/api/*": [
      "./servers/**/*",
      "./src/data/samples/**/*",
      // The spawned demo servers import the SDK's SERVER modules, which
      // file tracing drops (the routes only import the client side).
      // Verified 2026-11-18: without this the child dies with
      // ERR_MODULE_NOT_FOUND for dist/esm/server/index.js.
      "./node_modules/@modelcontextprotocol/sdk/**/*",
    ],
  },
};

export default nextConfig;
