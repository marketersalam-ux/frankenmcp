/**
 * MCP Client wrapper for bundled and remote servers.
 * - Bundled servers: spawn via StdioClientTransport from the allowlist,
 *   killed at request end (Requirement 6.3).
 * - Remote URLs: StreamableHTTPClientTransport (or SSEClientTransport for
 *   /sse URLs), with SSRF protection, a timeout, and a 1 MB response cap.
 * - Errors are thrown as Error objects with specific messages.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import path from "path";
import { BUNDLED_SERVERS } from "./allowlist";
import type { MCPTarget, MCPClientOptions } from "./types";
import type { MCPToolSchema } from "../tokens/types";

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_RESPONSE_SIZE = 1_000_000; // 1 MB

/**
 * Guard to check if a value is a valid MCPTarget.
 */
export function isMCPTarget(value: unknown): value is MCPTarget {
  if (typeof value === "string") {
    return value === "textkit" || value === "calculator";
  }
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    return typeof obj.url === "string";
  }
  return false;
}

/**
 * Is this hostname a localhost/private address (or an obfuscated IP)?
 * IPv6 hosts arrive bracketed ("[::1]") — brackets are stripped first.
 * Numeric-looking hostnames that are not plain dotted-decimal quads
 * (integer form like 2130706433, hex, octal) are rejected outright:
 * the resolver would still interpret them as IPs.
 * NOTE: this blocks direct IP use only. A public hostname that resolves
 * to a private IP (DNS rebinding) is not detected — accepted limitation.
 */
function isBlockedHostname(rawHostname: string): boolean {
  const hostname = rawHostname.replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname === "localhost.") return true;
  if (hostname === "::1" || hostname === "::") return true;
  // Link-local IPv6 (fe80::/10) reaches the local network.
  const firstGroup = hostname.split(":")[0];
  if (/^[0-9a-f]{1,4}$/i.test(firstGroup)) {
    const g = parseInt(firstGroup, 16);
    if ((g & 0xffc0) === 0xfe80) return true;
  }
  if (hostname.toLowerCase().startsWith("::ffff:")) {
    const rest = hostname.slice("::ffff:".length);
    if (rest.includes(".")) return isBlockedHostname(rest);
    // The URL parser serializes the mapped IPv4 as two hex groups
    // (::ffff:127.0.0.1 becomes ::ffff:7f00:1) — convert back.
    const m = rest.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (m) {
      const g1 = parseInt(m[1], 16);
      const g2 = parseInt(m[2], 16);
      return isBlockedHostname(`${g1 >> 8}.${g1 & 0xff}.${g2 >> 8}.${g2 & 0xff}`);
    }
    return true;
  }
  if (hostname === "0.0.0.0") return true;
  if (/^[0-9a-fxX.]+$/.test(hostname) && /\d/.test(hostname)) {
    const parts = hostname.split(".");
    const isPlainQuad =
      parts.length === 4 && parts.every((p) => /^(0|[1-9]\d*)$/.test(p) && Number(p) <= 255);
    if (!isPlainQuad) return true; // obfuscated IP form
    const [a, b] = parts.map(Number);
    if (a === 127 || a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

/**
 * Validate a remote URL: must be http/https and not SSRF-blocked.
 * Throws Error with a specific message if invalid.
 */
function validateRemoteUrl(urlString: string, allowPrivateUrls: boolean): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error(`Invalid URL: ${urlString}`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`URL must use http or https protocol, got: ${url.protocol}`);
  }
  if (!allowPrivateUrls && isBlockedHostname(url.hostname)) {
    throw new Error(`URL is blocked: ${urlString} (private/localhost address)`);
  }
  return url;
}

/**
 * Build the transport for a target. Bundled names come from the allowlist
 * only; anything else is rejected, never spawned (Requirement 6.2).
 */
function createTransport(target: MCPTarget, allowPrivateUrls: boolean): Transport {
  if (typeof target === "string") {
    if (!(target in BUNDLED_SERVERS)) {
      throw new Error(`Unknown bundled server: ${target}`);
    }
    return new StdioClientTransport({
      command: "node",
      args: [path.join(process.cwd(), BUNDLED_SERVERS[target])],
    });
  }
  const url = validateRemoteUrl(target.url, allowPrivateUrls);
  if (target.url.endsWith("/sse")) {
    return new SSEClientTransport(url);
  }
  return new StreamableHTTPClientTransport(url);
}

/**
 * Map a low-level error to a specific, user-facing message.
 */
function mapError(err: unknown, target: MCPTarget, timeoutMs: number, timedOut: boolean): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (timedOut || /timed? ?out/i.test(message)) {
    return new Error(`Request timed out after ${timeoutMs}ms`);
  }
  if (message.includes("ECONNREFUSED")) {
    return new Error(`Connection refused: ${target}`);
  }
  if (message.includes("ENOTFOUND") || message.includes("getaddrinfo")) {
    return new Error(`Cannot resolve hostname: ${target}`);
  }
  // Our own validation errors pass through as-is.
  if (
    message.includes("URL") ||
    message.includes("blocked") ||
    message.includes("Unknown bundled")
  ) {
    return err instanceof Error ? err : new Error(message);
  }
  return new Error(`Failed to connect to MCP server: ${message}`);
}

/**
 * Run one operation against a connected client. The transport is built
 * from the target, the client is closed in all paths (so a spawned
 * server never survives the request), and the result is size-capped.
 * The timeout is enforced two ways: the SDK's per-request timeout, and
 * a timer that closes the client (which aborts a hanging connect).
 */
async function runWithClient<T>(
  target: MCPTarget,
  options: MCPClientOptions | undefined,
  fn: (client: Client, timeoutMs: number) => Promise<T>,
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const allowPrivateUrls = options?.allowPrivateUrls ?? false;
  const transport = createTransport(target, allowPrivateUrls);
  const client = new Client({ name: "frankenmcp-client", version: "1.0.0" });

  let timedOut = false;
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    client.close().catch(() => {});
  }, timeoutMs);

  try {
    await client.connect(transport);
    const result = await fn(client, timeoutMs);
    const resultJson = JSON.stringify(result);
    if (resultJson.length > MAX_RESPONSE_SIZE) {
      throw new Error(`Response too large: ${resultJson.length} bytes (max ${MAX_RESPONSE_SIZE})`);
    }
    return result;
  } catch (err) {
    throw mapError(err, target, timeoutMs, timedOut);
  } finally {
    clearTimeout(timeoutHandle);
    await client.close().catch(() => {});
  }
}

/**
 * List tools from an MCP server (bundled or remote).
 */
export async function listTools(
  target: MCPTarget,
  options?: MCPClientOptions,
): Promise<MCPToolSchema[]> {
  const response = await runWithClient(target, options, (client, timeoutMs) =>
    client.listTools(undefined, { timeout: timeoutMs }),
  );
  return (response.tools ?? []).map((t) => ({
    name: String(t.name ?? ""),
    description: String(t.description ?? ""),
    inputSchema: (t.inputSchema as Record<string, unknown>) ?? {},
  }));
}

/**
 * Call a tool on an MCP server. Returns the raw result (content + isError)
 * so the caller can display it verbatim.
 */
export async function callTool(
  target: MCPTarget,
  toolName: string,
  args: Record<string, unknown>,
  options?: MCPClientOptions,
): Promise<unknown> {
  return runWithClient(target, options, (client, timeoutMs) =>
    client.callTool({ name: toolName, arguments: args }, undefined, { timeout: timeoutMs }),
  );
}
