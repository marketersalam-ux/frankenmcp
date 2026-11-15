/**
 * Type definitions for the adapter-gen module.
 */

/**
 * Runtime metadata for generated tools, computed together with the tool
 * schemas so names always agree. Embedded in server.js as TOOL_COMMANDS
 * and TOOL_FLAGS.
 */
export interface ToolMetadata {
  /** Subcommand each tool runs, keyed by tool name (null = no subcommand). */
  commands: Record<string, string | null>;
  /** Original flag spelling per tool, keyed by tool name then property name. */
  flags: Record<string, Record<string, string>>;
}

/**
 * Result of the full adapter generation process.
 */
export interface AdapterGenResult {
  /** Generated files: server.js, package.json, README.md */
  files: {
    "server.js": string;
    "package.json": string;
    "README.md": string;
  };
  /** Generated MCP tool schemas */
  tools: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
}

/**
 * Validation result for a tool schema.
 */
export interface ValidationResult {
  /** Whether all validations passed */
  valid: boolean;
  /** List of issues found */
  issues: string[];
}
