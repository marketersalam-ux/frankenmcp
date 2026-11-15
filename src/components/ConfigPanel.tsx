"use client";

import { useState, useEffect } from "react";
import { buildTrimConfig } from "@/lib/api";
import type { MCPToolSchema } from "@/lib/tokens";
import CopyButton from "./CopyButton";
import { downloadTextFile } from "@/lib/download";

interface ConfigPanelProps {
  tools: MCPToolSchema[];
  sourceLabel: string;
}

export default function ConfigPanel({ tools, sourceLabel }: ConfigPanelProps) {
  const [mode, setMode] = useState<"full" | "trimmed" | "names-only">("full");
  const [pickedNames, setPickedNames] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    config: unknown;
    tokens: number;
    saved: number;
  } | null>(null);

  // Tools arrive after the panel first renders (generate/connect happen
  // above), so re-sync the picker + clear any stale result when they change.
  useEffect(() => {
    setPickedNames(new Set(tools.map((t) => t.name)));
    setResult(null);
    setError(null);
  }, [tools]);

  const handleModeChange = (newMode: "full" | "trimmed" | "names-only") => {
    setMode(newMode);
    if (newMode !== "trimmed") {
      setPickedNames(new Set(tools.map((t) => t.name)));
    }
  };

  const handleToggleTool = (toolName: string) => {
    const updated = new Set(pickedNames);
    if (updated.has(toolName)) {
      updated.delete(toolName);
    } else {
      updated.add(toolName);
    }
    setPickedNames(updated);
  };

  const handleBuildConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      const toolsForConfig =
        mode === "trimmed" ? tools.filter((t) => pickedNames.has(t.name)) : tools;

      const response = await buildTrimConfig(
        toolsForConfig,
        mode,
        mode === "trimmed" ? Array.from(pickedNames) : undefined,
      );

      setResult(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Build failed";
      setError(msg);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    downloadTextFile("frankenmcp-config.json", JSON.stringify(result.config, null, 2));
  };

  if (tools.length === 0) {
    return (
      <div className="p-4 bg-lab-panel border border-lab-line rounded text-sm text-ash">
        Generate a server or connect to one first — the tools will appear here as a trimmed config.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-ash">
        Tools from: <span className="text-bone">{sourceLabel}</span> ({tools.length} tool
        {tools.length === 1 ? "" : "s"})
      </p>

      {/* Mode selector */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-bone">Mode</label>
        <div className="space-y-2">
          {[
            { value: "full" as const, label: "Full — every tool, full schemas" },
            { value: "trimmed" as const, label: "Trimmed — only the tools you pick" },
            { value: "names-only" as const, label: "Names-only — names + one-line descriptions" },
          ].map((option) => (
            <div key={option.value} className="flex items-center gap-2">
              <input
                type="radio"
                id={`mode-${option.value}`}
                name="mode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => handleModeChange(option.value)}
                className="w-4 h-4 cursor-pointer"
              />
              <label
                htmlFor={`mode-${option.value}`}
                className="text-sm text-bone cursor-pointer flex-1"
              >
                {option.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Tool picker (trimmed mode only) */}
      {mode === "trimmed" && (
        <div className="space-y-2 p-3 bg-lab-panel border border-lab-line rounded">
          <p className="text-xs text-ash">Pick which tools to include:</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {tools.map((tool) => (
              <div key={tool.name} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`tool-${tool.name}`}
                  checked={pickedNames.has(tool.name)}
                  onChange={() => handleToggleTool(tool.name)}
                  className="w-4 h-4 cursor-pointer"
                />
                <label
                  htmlFor={`tool-${tool.name}`}
                  className="text-sm text-bone cursor-pointer flex-1"
                >
                  <span className="font-mono text-xs">{tool.name}</span> — {tool.description}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Build config button */}
      {error && (
        <div className="p-3 bg-blood/10 border border-blood rounded text-sm text-blood">
          {error}
        </div>
      )}
      <button
        onClick={handleBuildConfig}
        disabled={loading || (mode === "trimmed" && pickedNames.size === 0)}
        className="w-full px-4 py-3 text-sm font-semibold rounded bg-slime text-lab-bg hover:bg-slime-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Building..." : "Build config"}
      </button>
      {mode === "trimmed" && pickedNames.size === 0 && (
        <p className="text-xs text-ash text-center">Pick at least one tool to build a config.</p>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3 p-4 bg-lab-panel border border-lab-line rounded">
          <div className="space-y-1">
            <p className="text-xs text-ash">Config ({result.tokens} tokens)</p>
            {result.saved > 0 && (
              <p className="text-xs text-slime">saving {result.saved} tokens vs full config</p>
            )}
          </div>

          <pre className="p-3 bg-lab-bg border border-lab-line rounded font-mono text-xs text-bone whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
            {JSON.stringify(result.config, null, 2)}
          </pre>

          <div className="flex gap-2">
            <CopyButton text={JSON.stringify(result.config, null, 2)} label="Copy JSON" />
            <button
              onClick={handleDownload}
              className="px-3 py-1 text-sm font-medium rounded bg-slime text-lab-bg hover:bg-slime-dim transition-colors"
            >
              Download
            </button>
          </div>

          <p className="text-xs text-ash">
            Token counts are estimates counted with the cl100k_base tokenizer (tiktoken).
          </p>
        </div>
      )}
    </div>
  );
}
