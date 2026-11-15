/**
 * Download helpers for FrankenMCP.
 * Builds download files and triggers browser downloads via zip.
 * Client-side safe: uses jszip for browser downloads.
 */
import type { SafetyFlag } from "./safety";
import type { RunSummary } from "./agent-loop/types";

/**
 * Input structure for buildDownloadFiles.
 */
interface BuildDownloadFilesInput {
  files: {
    "server.js": string;
    "package.json": string;
    "README.md": string;
  };
  costs: {
    perTool: Array<{ name: string; tokens: number }>;
    total: number;
  };
  safety: SafetyFlag[];
  summary: RunSummary;
  unparsedLines: string[];
}

/**
 * Build download files including the original three plus COSTS.md and SAFETY.md.
 * @param input Build input with files, tools, costs, safety, and summary
 * @returns Record with exactly five files: server.js, package.json, README.md, COSTS.md, SAFETY.md
 */
export function buildDownloadFiles(input: BuildDownloadFilesInput): Record<string, string> {
  const { files, costs, safety, summary } = input;

  // Build COSTS.md: token receipt with per-tool counts and total
  const costsLines: string[] = [];
  costsLines.push("# Token Cost Receipt");
  costsLines.push("");
  costsLines.push("## Per-Tool Breakdown");
  costsLines.push("");
  for (const perTool of costs.perTool) {
    costsLines.push(`- ${perTool.name}: ${perTool.tokens} tokens`);
  }
  costsLines.push("");
  costsLines.push(`## Total: ${costs.total} tokens`);
  costsLines.push("");
  costsLines.push("Token counts are estimates counted with the cl100k_base tokenizer (tiktoken).");
  costsLines.push(
    `Generated from ${summary.toolsGenerated} tool(s), ${summary.flagsParsed} flag(s) parsed, ${summary.issuesFixed} issue(s) fixed.`,
  );

  const costsMd = costsLines.join("\n");

  // Build SAFETY.md: one line per safety flag, or "No safety issues found."
  let safetyMd: string;
  if (safety.length === 0) {
    safetyMd = "No safety issues found.";
  } else {
    const safetyLines: string[] = [];
    for (const flag of safety) {
      safetyLines.push(`[${flag.severity}] ${flag.option}: ${flag.message}`);
    }
    safetyMd = safetyLines.join("\n");
  }

  return {
    "server.js": files["server.js"],
    "package.json": files["package.json"],
    "README.md": files["README.md"],
    "COSTS.md": costsMd,
    "SAFETY.md": safetyMd,
  };
}

/**
 * Download files as a zip archive in the browser.
 * Uses jszip to build the archive and triggers a download via Blob + anchor.
 * @param files Record of filename -> content
 * @param filename Name for the downloaded zip file (without .zip extension)
 */
export async function downloadZip(files: Record<string, string>, filename: string): Promise<void> {
  // Dynamic import of jszip (browser-side only)
  const JSZip = (await import("jszip")).default;

  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);

  // Trigger download via temporary anchor
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Clean up the object URL
  URL.revokeObjectURL(url);
}

/**
 * Download a text file in the browser.
 * Creates a Blob and triggers a download via temporary anchor.
 * @param filename Name for the downloaded file (with extension)
 * @param content Text content to download
 */
export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  // Trigger download via temporary anchor
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Clean up the object URL
  URL.revokeObjectURL(url);
}
