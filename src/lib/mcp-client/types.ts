/**
 * Type definitions for the mcp-client module.
 */

/**
 * MCP target: either a bundled server name or a remote URL.
 */
export type MCPTarget = "textkit" | "calculator" | { url: string };

/**
 * Options for MCP client operations.
 */
export interface MCPClientOptions {
  /** Timeout in milliseconds (default: 5000) */
  timeoutMs?: number;
  /**
   * TEST ONLY: allow private/localhost URLs (lets tests run a local MCP
   * server). Never set from a route — the SSRF blocklist must stay on
   * for every real request.
   */
  allowPrivateUrls?: boolean;
}
