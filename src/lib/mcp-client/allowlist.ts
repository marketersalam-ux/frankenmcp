/**
 * Allowlist of bundled MCP servers that can be spawned.
 * Each entry maps a server name to its relative path from the workspace root.
 */
export const BUNDLED_SERVERS: Record<string, string> = {
  textkit: "servers/textkit/mcp-server.js",
  calculator: "servers/calculator/mcp-server.js",
};
