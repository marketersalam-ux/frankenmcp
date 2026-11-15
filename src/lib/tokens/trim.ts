/**
 * Trimmed config builder for MCP tool schemas.
 * Supports three modes: full (all schemas), names-only (minimal), trimmed (user-picked subset).
 */
import { countTokens } from "./counter";
import type { MCPToolSchema } from "./types";

/**
 * Result of building a trimmed config.
 */
export interface TrimmedConfigResult {
  /** The trimmed config object (tools array or similar structure) */
  config: unknown;
  /** Token count of the returned config JSON */
  tokens: number;
  /** Token saving compared to the full config (0 for full mode) */
  saved: number;
}

/**
 * Build a trimmed MCP client config with the given mode.
 *
 * Modes:
 * - "full": Returns complete tool schemas with all fields
 * - "names-only": Returns minimal schema with only name + one-line description
 * - "trimmed": Returns schemas for tools named in pickedNames (subset)
 *
 * @param tools - Array of MCP tool schemas
 * @param mode - Trimming mode: "full", "trimmed", or "names-only"
 * @param pickedNames - (Required for "trimmed" mode) Names of tools to include
 * @returns Object with config, token count, and savings
 * @throws Error if mode is "trimmed" and pickedNames is not provided
 */
export function buildTrimmedConfig(
  tools: MCPToolSchema[],
  mode: "full" | "trimmed" | "names-only",
  pickedNames?: string[],
): TrimmedConfigResult {
  let configTools: MCPToolSchema[];

  // Select which tools to include based on mode
  if (mode === "full") {
    configTools = tools;
  } else if (mode === "names-only") {
    configTools = tools.map((tool) => ({
      name: tool.name,
      description: tool.description.split("\n")[0], // First line only
      inputSchema: {}, // Empty schema to save space
    }));
  } else if (mode === "trimmed") {
    if (!pickedNames) {
      throw new Error('pickedNames is required when mode is "trimmed"');
    }
    configTools = tools.filter((tool) => pickedNames.includes(tool.name));
  } else {
    throw new Error(`Unknown mode: ${mode}`);
  }

  // Build the config structure (tools array wrapper)
  const config = { tools: configTools };

  // Count tokens
  const configJson = JSON.stringify(config);
  const tokens = countTokens(configJson);

  // Calculate savings
  let saved = 0;
  if (mode !== "full") {
    const fullConfig = { tools };
    const fullJson = JSON.stringify(fullConfig);
    const fullTokens = countTokens(fullJson);
    saved = fullTokens - tokens;
  }

  return { config, tokens, saved };
}
