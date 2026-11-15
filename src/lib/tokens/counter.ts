/**
 * Token counting using tiktoken cl100k_base encoding.
 * Server-side only; encoding is loaded once and reused.
 */
import { get_encoding } from "tiktoken";
import type { MCPToolSchema } from "./types";

// Load encoding once at module level for reuse
let tokenEncoder: ReturnType<typeof get_encoding> | null = null;

/**
 * Get or initialize the token encoder (lazy load).
 */
function getEncoder() {
  if (!tokenEncoder) {
    tokenEncoder = get_encoding("cl100k_base");
  }
  return tokenEncoder;
}

/**
 * Count tokens in the given text using cl100k_base encoding.
 * @param text - The text to count tokens for
 * @returns The number of tokens
 */
export function countTokens(text: string): number {
  const encoder = getEncoder();
  const tokens = encoder.encode(text);
  return tokens.length;
}

/**
 * Measurement result for a single tool.
 */
export interface ToolMeasurement {
  name: string;
  tokens: number;
}

/**
 * Result of measuring a set of tools.
 */
export interface ToolsMeasurement {
  perTool: ToolMeasurement[];
  total: number;
}

/**
 * Measure the token costs of an array of MCP tool schemas.
 * Each tool schema is JSON-stringified and its tokens are counted.
 * @param tools - Array of MCP tool schemas to measure
 * @returns Object with per-tool measurements and total
 */
export function measureTools(tools: MCPToolSchema[]): ToolsMeasurement {
  const perTool = tools.map((tool) => {
    const schemaJson = JSON.stringify(tool);
    const tokens = countTokens(schemaJson);
    return { name: tool.name, tokens };
  });

  const total = perTool.reduce((sum, m) => sum + m.tokens, 0);

  return { perTool, total };
}
