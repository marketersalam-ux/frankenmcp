"use client";

import { useState } from "react";
import { connectServer, probeTool } from "@/lib/api";
import type { MCPToolSchema } from "@/lib/tokens";
import type { MCPTarget } from "@/lib/mcp-client/types";
import { buildProbeArgs } from "@/lib/probe-args";
import CostTable from "./CostTable";

interface ConnectPanelProps {
  onTools?: (tools: MCPToolSchema[], sourceLabel: string) => void;
}

export default function ConnectPanel({ onTools }: ConnectPanelProps) {
  const [serverType, setServerType] = useState<"textkit" | "calculator" | "remote">("textkit");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tools, setTools] = useState<MCPToolSchema[]>([]);
  const [costs, setCosts] = useState<{
    perTool: { name: string; tokens: number }[];
    total: number;
  } | null>(null);
  const [selectedTool, setSelectedTool] = useState<MCPToolSchema | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [probeResult, setProbeResult] = useState<unknown>(null);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    setTools([]);
    setCosts(null);
    setSelectedTool(null);
    setFormValues({});
    setProbeResult(null);

    try {
      const target: MCPTarget =
        serverType === "remote" ? { url: remoteUrl } : (serverType as "textkit" | "calculator");

      const response = await connectServer(target);
      setTools(response.tools);
      setCosts(response.costs);

      const sourceLabel =
        serverType === "remote" ? `Connected: ${remoteUrl}` : `Connected: ${serverType}`;

      onTools?.(response.tools, sourceLabel);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTool = (tool: MCPToolSchema) => {
    setSelectedTool(tool);
    setFormValues({});
    setProbeResult(null);
    setProbeError(null);
  };

  const handleProbe = async () => {
    if (!selectedTool) return;

    setProbeLoading(true);
    setProbeError(null);

    try {
      const target: MCPTarget =
        serverType === "remote" ? { url: remoteUrl } : (serverType as "textkit" | "calculator");

      const args = buildProbeArgs(formValues, selectedTool);
      const response = await probeTool(target, selectedTool.name, args);
      setProbeResult(response.result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Probe failed";
      setProbeError(msg);
    } finally {
      setProbeLoading(false);
    }
  };

  const handleServerChange = (type: "textkit" | "calculator" | "remote") => {
    setServerType(type);
    setTools([]);
    setCosts(null);
    setSelectedTool(null);
    setFormValues({});
    setProbeResult(null);
    setError(null);
    setProbeError(null);
  };

  const canConnect = !loading && (serverType !== "remote" || remoteUrl.trim().length > 0);
  const canProbe = selectedTool !== null && !probeLoading;

  // Get input schema properties safely
  const toolSchema = selectedTool?.inputSchema as {
    properties?: Record<string, { type?: string; description?: string }>;
    required?: string[];
  };
  const properties = toolSchema?.properties ?? {};
  const required = toolSchema?.required ?? [];
  const hasProperties = Object.keys(properties).length > 0;

  return (
    <div className="space-y-6">
      {/* Server picker */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-bone">Server</label>
        <div className="space-y-2">
          {[
            {
              value: "textkit",
              label: "textkit — bundled demo: wc, reverse, slugify, upper",
            },
            {
              value: "calculator",
              label: "calculator — bundled demo: add, subtract, multiply, divide",
            },
            { value: "remote", label: "Remote MCP server URL" },
          ].map((option) => (
            <div key={option.value} className="flex items-center gap-2">
              <input
                type="radio"
                id={`server-${option.value}`}
                name="server"
                value={option.value}
                checked={serverType === option.value}
                onChange={() =>
                  handleServerChange(option.value as "textkit" | "calculator" | "remote")
                }
                className="w-4 h-4 cursor-pointer"
              />
              <label
                htmlFor={`server-${option.value}`}
                className="text-sm text-bone cursor-pointer flex-1"
              >
                {option.label}
              </label>
            </div>
          ))}
        </div>

        {/* Remote URL input */}
        {serverType === "remote" && (
          <input
            type="url"
            value={remoteUrl}
            onChange={(e) => setRemoteUrl(e.target.value)}
            placeholder="https://... (SSE or streamable HTTP)"
            className="w-full px-4 py-2 bg-lab-panel border border-lab-line rounded text-sm text-bone placeholder-ash focus:outline-none focus:border-slime transition-colors"
          />
        )}

        <p className="text-xs text-ash">
          Bundled servers run on this server, per request, and are stopped when the request ends.
          Remote servers are contacted server-side with a 5 second timeout. No credentials are
          accepted or forwarded.
        </p>
      </div>

      {/* Connect button */}
      {error && (
        <div className="p-3 bg-blood/10 border border-blood rounded text-sm text-blood">
          {error}
        </div>
      )}
      <button
        onClick={handleConnect}
        disabled={!canConnect}
        className="w-full px-4 py-3 text-sm font-semibold rounded bg-slime text-lab-bg hover:bg-slime-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Connecting..." : "Connect"}
      </button>

      {/* Connected tools display */}
      {tools.length > 0 && (
        <div className="space-y-4 p-4 bg-lab-panel border border-lab-line rounded">
          {/* Cost table — real tiktoken counts from the connect response, never estimated client-side */}
          {costs && (
            <div>
              <h3 className="text-sm font-semibold text-bone mb-3">Token Costs</h3>
              <CostTable costs={costs} />
            </div>
          )}

          {/* Tool selector */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-bone">Pick a tool to probe</label>
            <select
              value={selectedTool?.name ?? ""}
              onChange={(e) => {
                const tool = tools.find((t) => t.name === e.target.value);
                if (tool) handleSelectTool(tool);
              }}
              className="w-full px-4 py-2 bg-lab-panel border border-lab-line rounded text-sm text-bone focus:outline-none focus:border-slime transition-colors"
            >
              <option value="">Select a tool</option>
              {tools.map((tool) => (
                <option key={tool.name} value={tool.name}>
                  {tool.name} — {tool.description}
                </option>
              ))}
            </select>
          </div>

          {/* Probe form */}
          {selectedTool && (
            <div className="space-y-4 p-4 border border-lab-line rounded">
              {!hasProperties && <p className="text-sm text-ash">This tool takes no arguments.</p>}

              {hasProperties && (
                <div className="space-y-3">
                  {Object.entries(properties).map(([key, schema]) => {
                    const isRequired = required.includes(key);
                    const value = formValues[key] ?? "";

                    return (
                      <div key={key} className="space-y-1">
                        <label
                          htmlFor={`arg-${key}`}
                          className="block text-sm font-medium text-bone"
                        >
                          {key}
                          {isRequired && <span className="text-slime ml-1">*</span>}
                        </label>
                        {schema.type === "boolean" ? (
                          <div className="flex items-center gap-2">
                            <input
                              id={`arg-${key}`}
                              type="checkbox"
                              checked={value === "true"}
                              onChange={(e) =>
                                setFormValues({
                                  ...formValues,
                                  [key]: e.target.checked ? "true" : "false",
                                })
                              }
                              className="w-4 h-4 cursor-pointer"
                            />
                            <label
                              htmlFor={`arg-${key}`}
                              className="text-sm text-ash cursor-pointer"
                            >
                              {schema.description || ""}
                            </label>
                          </div>
                        ) : schema.type === "object" || schema.type === "array" ? (
                          <textarea
                            id={`arg-${key}`}
                            value={value}
                            onChange={(e) =>
                              setFormValues({ ...formValues, [key]: e.target.value })
                            }
                            placeholder="Valid JSON"
                            className="w-full px-3 py-2 bg-lab-bg border border-lab-line rounded font-mono text-sm text-bone placeholder-ash focus:outline-none focus:border-slime transition-colors"
                            rows={3}
                          />
                        ) : (
                          <input
                            id={`arg-${key}`}
                            type={
                              schema.type === "number" || schema.type === "integer"
                                ? "number"
                                : "text"
                            }
                            value={value}
                            onChange={(e) =>
                              setFormValues({ ...formValues, [key]: e.target.value })
                            }
                            placeholder={schema.description || ""}
                            className="w-full px-3 py-2 bg-lab-bg border border-lab-line rounded text-sm text-bone placeholder-ash focus:outline-none focus:border-slime transition-colors"
                          />
                        )}
                        {schema.description && (
                          <p className="text-xs text-ash">{schema.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Probe button */}
              <button
                onClick={handleProbe}
                disabled={!canProbe}
                className="w-full px-3 py-2 text-sm font-semibold rounded bg-slime text-lab-bg hover:bg-slime-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {probeLoading ? "Probing..." : "Probe"}
              </button>

              {/* Probe error */}
              {probeError && (
                <div className="p-3 bg-blood/10 border border-blood rounded text-sm text-blood">
                  {probeError}
                </div>
              )}

              {/* Probe result */}
              {probeResult !== null && (
                <div className="space-y-1">
                  <p className="text-xs text-ash">Result:</p>
                  <pre className="p-3 bg-lab-bg border border-lab-line rounded font-mono text-xs text-bone whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                    {JSON.stringify(probeResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
