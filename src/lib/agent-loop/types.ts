/**
 * Type definitions for the agent-loop module.
 */
import type { MCPToolSchema } from "../tokens/types";
import type { SafetyFlag } from "../safety";

/**
 * A single step in the agent's execution log.
 */
export interface LogStep {
  /** Step type: parse, generate, validate, fix, or verify */
  step: "parse" | "generate" | "validate" | "fix" | "verify";
  /** Status: ok (step succeeded), fixed (step succeeded after applying fixes), or failed (step failed) */
  status: "ok" | "fixed" | "failed";
  /** Detailed message describing what happened in this step */
  detail: string;
  /** ISO 8601 timestamp when this step ran */
  at: string;
}

/**
 * Summary statistics from a run.
 */
export interface RunSummary {
  /** Number of flags parsed */
  flagsParsed: number;
  /** Number of tools generated */
  toolsGenerated: number;
  /** Number of issues fixed during the fix step */
  issuesFixed: number;
  /** Whether the run was verified successfully */
  verified: boolean;
}

/**
 * Result of running the adapter loop.
 */
export interface AgentRunResult {
  /** Generated files: server.js, package.json, README.md */
  files: {
    "server.js": string;
    "package.json": string;
    "README.md": string;
  };
  /** Generated MCP tool schemas */
  tools: MCPToolSchema[];
  /** Log of all steps executed */
  log: LogStep[];
  /** Summary statistics */
  summary: RunSummary;
  /** Safety review flags */
  safety: SafetyFlag[];
  /** Lines from the help text that could not be parsed */
  unparsedLines: string[];
}
