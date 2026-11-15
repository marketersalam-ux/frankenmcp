/**
 * MCP client module: connect to bundled and remote MCP servers.
 */
export { listTools, callTool, isMCPTarget } from "./client";
export type { MCPTarget, MCPClientOptions } from "./types";
export { BUNDLED_SERVERS } from "./allowlist";
