"use client";

import { useState } from "react";
import { generateAdapter, getSample } from "@/lib/api";
import type { GenerateResponse } from "@/lib/api";
import AgentLog from "./AgentLog";
import CostTable from "./CostTable";
import CodeViewer from "./CodeViewer";
import SafetyPanel from "./SafetyPanel";
import { buildDownloadFiles, downloadZip } from "@/lib/download";

interface GeneratePanelProps {
  onResult?: (result: GenerateResponse) => void;
}

type SampleName = "ffmpeg" | "git" | "curl";

export default function GeneratePanel({ onResult }: GeneratePanelProps) {
  const [helpText, setHelpText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [sampleLoading, setSampleLoading] = useState<SampleName | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleLoadSample = async (sampleName: SampleName) => {
    setSampleLoading(sampleName);
    setError(null);
    try {
      const sample = await getSample(sampleName);
      setHelpText(sample.text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load sample";
      setError(msg);
    } finally {
      setSampleLoading(null);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setDownloadError(null);
    try {
      const generated = await generateAdapter({ helpText });
      setResult(generated);
      onResult?.(generated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setError(msg);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!result) return;
    setDownloadLoading(true);
    setDownloadError(null);
    try {
      const files = buildDownloadFiles({
        files: result.files,
        costs: result.costs,
        safety: result.safety,
        summary: result.summary,
        unparsedLines: result.unparsedLines,
      });
      await downloadZip(files, "frankenmcp-adapter");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Download failed";
      setDownloadError(msg);
    } finally {
      setDownloadLoading(false);
    }
  };

  const canGenerate = helpText.trim().length > 0 && !loading;
  const canDownload = result?.summary.verified === true && !downloadLoading;

  return (
    <div className="space-y-6">
      {/* Textarea */}
      <div className="space-y-2">
        <label htmlFor="helpText" className="block text-sm font-semibold text-bone">
          CLI Help Text
        </label>
        <div className="relative">
          <textarea
            id="helpText"
            value={helpText}
            onChange={(e) => setHelpText(e.target.value)}
            placeholder="Paste a CLI tool's --help output here..."
            className="w-full px-4 py-3 bg-lab-panel border border-lab-line rounded font-mono text-sm text-bone placeholder-ash resize-none focus:outline-none focus:border-slime transition-colors"
            rows={12}
          />
          <div className="absolute bottom-2 right-2 text-xs text-ash">
            {helpText.length} characters
          </div>
        </div>
        <p className="text-xs text-ash">
          Nothing you paste is executed — it is parsed as text only.
        </p>
      </div>

      {/* Sample buttons */}
      <div className="flex gap-2">
        {(["ffmpeg", "git", "curl"] as const).map((name) => (
          <button
            key={name}
            onClick={() => handleLoadSample(name)}
            disabled={sampleLoading !== null}
            className="px-3 py-2 text-sm font-medium rounded bg-lab-panel border border-lab-line text-slime hover:bg-lab-line hover:text-slime-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sampleLoading === name ? "Loading..." : name}
          </button>
        ))}
      </div>

      {/* Error display */}
      {error && (
        <div className="p-3 bg-blood/10 border border-blood rounded text-sm text-blood">
          {error}
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className="w-full px-4 py-3 text-sm font-semibold rounded bg-slime text-lab-bg hover:bg-slime-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Generating..." : "Generate"}
      </button>

      {/* Results */}
      {result && (
        <div className="space-y-6 p-4 bg-lab-panel border border-lab-line rounded">
          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="space-y-1">
              <p className="text-xs text-ash">Flags Parsed</p>
              <p className="text-lg font-bold text-slime">{result.summary.flagsParsed}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-ash">Tools Generated</p>
              <p className="text-lg font-bold text-slime">{result.summary.toolsGenerated}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-ash">Issues Fixed</p>
              <p className="text-lg font-bold text-amber-glow">{result.summary.issuesFixed}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-ash">Verified</p>
              <p
                className={`text-lg font-bold ${
                  result.summary.verified ? "text-slime" : "text-blood"
                }`}
              >
                {result.summary.verified ? "✓" : "✗"}
              </p>
            </div>
          </div>

          {/* Agent log */}
          <div>
            <h3 className="text-sm font-semibold text-bone mb-3">Agent Log</h3>
            <AgentLog log={result.log} />
          </div>

          {/* Cost table */}
          <div>
            <h3 className="text-sm font-semibold text-bone mb-3">Token Costs</h3>
            <CostTable costs={result.costs} />
          </div>

          {/* Code viewer */}
          <div>
            <h3 className="text-sm font-semibold text-bone mb-3">Generated Code</h3>
            <CodeViewer files={result.files} />
          </div>

          {/* Safety panel */}
          <div>
            <h3 className="text-sm font-semibold text-bone mb-3">Safety Review</h3>
            <SafetyPanel safety={result.safety} />
          </div>

          {/* Unparsed lines */}
          <div>
            <details className="space-y-2">
              <summary className="cursor-pointer font-semibold text-sm text-bone hover:text-slime transition-colors">
                Unparsed lines ({result.unparsedLines.length})
              </summary>
              <div className="p-3 bg-lab-panel border border-lab-line rounded">
                {result.unparsedLines.length === 0 ? (
                  <p className="text-sm text-ash">All lines parsed — nothing unparsed.</p>
                ) : (
                  <>
                    <pre className="font-mono text-xs text-ash whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                      {result.unparsedLines.slice(0, 100).join("\n")}
                    </pre>
                    {result.unparsedLines.length > 100 && (
                      <p className="mt-2 text-xs text-ash">
                        +{result.unparsedLines.length - 100} more lines
                      </p>
                    )}
                  </>
                )}
              </div>
            </details>
          </div>

          {/* Download button */}
          <div className="space-y-2">
            {downloadError && (
              <div className="p-3 bg-blood/10 border border-blood rounded text-sm text-blood">
                {downloadError}
              </div>
            )}
            <button
              onClick={handleDownload}
              disabled={!canDownload}
              className="w-full px-4 py-3 text-sm font-semibold rounded bg-slime text-lab-bg hover:bg-slime-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {downloadLoading ? "Downloading..." : "Download MCP server (.zip)"}
            </button>
            {!canDownload && !result.summary.verified && (
              <p className="text-xs text-ash text-center">
                Download unlocks when the run verifies.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
