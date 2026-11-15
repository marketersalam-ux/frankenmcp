/**
 * Client-safe API library for FrankenMCP.
 * This module provides typed wrappers around the HTTP routes.
 * Client-safe: no tiktoken import, no node-only imports.
 */
import type { MCPToolSchema } from "./tokens";
import type { SafetyFlag } from "./safety";
import type { LogStep, RunSummary } from "./agent-loop/types";
import type { MCPTarget } from "./mcp-client/types";

/**
 * Response from GET /api/samples.
 */
export interface SampleResponse {
  name: string;
  text: string;
}

/**
 * Response from POST /api/generate.
 */
export interface GenerateResponse {
  files: {
    "server.js": string;
    "package.json": string;
    "README.md": string;
  };
  tools: MCPToolSchema[];
  costs: {
    perTool: Array<{ name: string; tokens: number }>;
    total: number;
  };
  safety: SafetyFlag[];
  log: LogStep[];
  summary: RunSummary;
  unparsedLines: string[];
}

/**
 * Response from POST /api/connect.
 */
export interface ConnectResponse {
  tools: MCPToolSchema[];
  costs: {
    perTool: Array<{ name: string; tokens: number }>;
    total: number;
  };
}

/**
 * Response from POST /api/probe.
 */
export interface ProbeResponse {
  result: unknown;
}

/**
 * Response from POST /api/trim.
 */
export interface TrimResponse {
  config: unknown;
  tokens: number;
  saved: number;
}

/**
 * Error response structure from the API.
 */
interface ErrorResponse {
  error: string;
  detail: string;
}

/**
 * Get a sample CLI tool's help text.
 * @param name Sample name: 'ffmpeg', 'git', or 'curl'
 * @returns Sample name and help text
 * @throws Error with the server detail message on failure
 */
export async function getSample(name: "ffmpeg" | "git" | "curl"): Promise<SampleResponse> {
  const response = await fetch(`/api/samples?name=${name}`);

  if (!response.ok) {
    const error = (await response.json()) as ErrorResponse;
    throw new Error(error.detail || error.error);
  }

  return (await response.json()) as SampleResponse;
}

/**
 * Generate an MCP server from help text or a built-in sample.
 * @param input Either { helpText: string } or { sample: 'ffmpeg'|'git'|'curl' }
 * @returns Generated server code, tools, costs, and safety review
 * @throws Error with the server detail message on failure
 */
export async function generateAdapter(
  input: { helpText: string } | { sample: "ffmpeg" | "git" | "curl" },
): Promise<GenerateResponse> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = (await response.json()) as ErrorResponse;
    throw new Error(error.detail || error.error);
  }

  return (await response.json()) as GenerateResponse;
}

/**
 * Connect to an MCP server and list its tools.
 * @param target MCPTarget: "textkit", "calculator", or { url: string }
 * @returns Tools and their token costs
 * @throws Error with the server detail message on failure
 */
export async function connectServer(target: MCPTarget): Promise<ConnectResponse> {
  const response = await fetch("/api/connect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ target }),
  });

  if (!response.ok) {
    const error = (await response.json()) as ErrorResponse;
    throw new Error(error.detail || error.error);
  }

  return (await response.json()) as ConnectResponse;
}

/**
 * Probe a tool on a live MCP server.
 * @param target MCPTarget: the server to probe
 * @param tool Tool name
 * @param args Tool arguments as a record
 * @returns Result from the tool call
 * @throws Error with the server detail message on failure
 */
export async function probeTool(
  target: MCPTarget,
  tool: string,
  args: Record<string, unknown>,
): Promise<ProbeResponse> {
  const response = await fetch("/api/probe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ target, tool, args }),
  });

  if (!response.ok) {
    const error = (await response.json()) as ErrorResponse;
    throw new Error(error.detail || error.error);
  }

  return (await response.json()) as ProbeResponse;
}

/**
 * Build a trimmed MCP config with the given mode.
 * @param tools Array of MCPToolSchema
 * @param mode Trimming mode: "full", "trimmed", or "names-only"
 * @param pickedNames Tool names to include (required for "trimmed" mode)
 * @returns Trimmed config, token count, and savings
 * @throws Error with the server detail message on failure
 */
export async function buildTrimConfig(
  tools: MCPToolSchema[],
  mode: "full" | "trimmed" | "names-only",
  pickedNames?: string[],
): Promise<TrimResponse> {
  const response = await fetch("/api/trim", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tools, mode, pickedNames }),
  });

  if (!response.ok) {
    const error = (await response.json()) as ErrorResponse;
    throw new Error(error.detail || error.error);
  }

  return (await response.json()) as TrimResponse;
}
