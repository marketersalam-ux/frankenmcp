"use client";

import { useState } from "react";
import GeneratePanel from "@/components/GeneratePanel";
import ConnectPanel from "@/components/ConnectPanel";
import ConfigPanel from "@/components/ConfigPanel";
import type { GenerateResponse } from "@/lib/api";
import type { MCPToolSchema } from "@/lib/tokens";

export default function Home() {
  const [configTools, setConfigTools] = useState<MCPToolSchema[]>([]);
  const [configSource, setConfigSource] = useState("");

  const handleGenerateResult = (result: GenerateResponse) => {
    setConfigTools(result.tools);
    setConfigSource("Generated adapter");
  };

  const handleConnectTools = (tools: MCPToolSchema[], sourceLabel: string) => {
    setConfigTools(tools);
    setConfigSource(sourceLabel);
  };

  return (
    <div className="lab-grid min-h-screen bg-lab-bg">
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-12">
        {/* Header */}
        <div className="space-y-2 text-center sm:text-left">
          <h1 className="text-4xl sm:text-5xl font-bold text-slime">FrankenMCP</h1>
          <p className="text-lg text-ash">
            Give any CLI tool a second life as an MCP server — and see exactly what it costs your
            context window.
          </p>
          <div className="flex gap-2 flex-wrap mt-4 justify-center sm:justify-start">
            <span className="px-3 py-1 text-xs font-semibold rounded border border-slime text-slime">
              No sign-in
            </span>
            <span className="px-3 py-1 text-xs font-semibold rounded border border-slime text-slime">
              No API key
            </span>
          </div>
        </div>

        {/* Section 1: Generate */}
        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-bone">
            <span className="text-slime">1.</span> Generate
          </h2>
          <GeneratePanel onResult={handleGenerateResult} />
        </section>

        {/* Section 2: Connect & Measure */}
        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-bone">
            <span className="text-slime">2.</span> Connect &amp; measure
          </h2>
          <ConnectPanel onTools={handleConnectTools} />
        </section>

        {/* Section 3: Trim the config */}
        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-bone">
            <span className="text-slime">3.</span> Trim the config
          </h2>
          <ConfigPanel tools={configTools} sourceLabel={configSource} />
        </section>

        {/* Footer */}
        <footer className="space-y-6 pt-12 border-t border-lab-line">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-bone">Limits, stated plainly</h3>
            <ul className="text-sm text-ash space-y-2">
              <li>Your CLI is never executed — only pasted --help text is read.</li>
              <li>
                The Adapter Agent is a deterministic loop (parse, generate, validate, fix, verify),
                not an LLM.
              </li>
              <li>
                Token counts are estimates from the cl100k_base tokenizer — your model&apos;s exact
                counts will differ.
              </li>
            </ul>
          </div>
          <div className="flex gap-4 text-xs text-ash flex-wrap">
            <a
              href="https://github.com/marketersalam-ux/frankenmcp"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slime transition-colors"
            >
              GitHub
            </a>
            <span>Kiroween 2026 — Frankenstein category entry</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
