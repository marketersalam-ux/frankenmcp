/**
 * Type definitions for the tokens module.
 */

/**
 * MCP tool schema definition.
 */
export interface MCPToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
