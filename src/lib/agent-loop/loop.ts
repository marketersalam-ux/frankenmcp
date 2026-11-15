/**
 * Adapter Agent loop: parse -> generate -> validate -> fix -> verify
 * Pure text processing (no execution), deterministic, with visible step log.
 *
 * The fix step is a safety net: the generator already dedupes names and
 * sanitizes them, so validation normally passes first time and the fix
 * step logs "No fixes needed". When validation does fail, fixes are
 * applied to the tools AND the files are rebuilt from the fixed tools —
 * the returned files and tools never diverge.
 */
import { parseHelp } from "../help-parser";
import { reviewSafety } from "../safety";
import {
  generateAdapter,
  buildToolMetadata,
  applyRenames,
  buildFiles,
  validateTools,
} from "../adapter-gen";
import type { MCPToolSchema } from "../tokens/types";
import type { FlagModel } from "../help-parser";
import type { LogStep, AgentRunResult } from "./types";

const SDK_VERSION = "1.20.1";

const EMPTY_FILES = { "server.js": "", "package.json": "", "README.md": "" };

function countFlags(model: FlagModel): number {
  return model.flags.length + model.subcommands.reduce((sum, s) => sum + s.flags.length, 0);
}

/**
 * Run the adapter agent loop on the given help text.
 * The log always carries all five steps in order; steps that could not
 * run are logged as failed with the reason.
 */
export function runAdapterLoop(helpText: string): AgentRunResult {
  const log: LogStep[] = [];
  const stamp = () => new Date().toISOString();
  const push = (step: LogStep["step"], status: LogStep["status"], detail: string) => {
    log.push({ step, status, detail, at: stamp() });
  };
  const failRest = (from: LogStep["step"], detail: string) => {
    const order: LogStep["step"][] = ["parse", "generate", "validate", "fix", "verify"];
    for (const step of order.slice(order.indexOf(from))) {
      push(step, "failed", detail);
    }
  };

  // Step 1: Parse
  let model: FlagModel;
  try {
    model = parseHelp(helpText);
  } catch (error) {
    push(
      "parse",
      "failed",
      `Parse failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    failRest("generate", "Skipped: parse failed");
    return {
      files: EMPTY_FILES,
      tools: [],
      log,
      summary: { flagsParsed: 0, toolsGenerated: 0, issuesFixed: 0, verified: false },
    };
  }

  const flagCount = countFlags(model);
  const hasContent = model.toolName !== "" || model.subcommands.length > 0 || flagCount > 0;
  if (!hasContent) {
    push("parse", "ok", "Parsed (no commands or flags found)");
    push("generate", "failed", "No flags or subcommands to generate tools from");
    push("validate", "failed", "No tools generated");
    push("fix", "failed", "Cannot fix: no tools to work with");
    push("verify", "failed", "Verification failed: no tools generated");
    return {
      files: EMPTY_FILES,
      tools: [],
      log,
      summary: { flagsParsed: 0, toolsGenerated: 0, issuesFixed: 0, verified: false },
    };
  }
  push(
    "parse",
    "ok",
    `Parsed ${model.subcommands.length} subcommand(s), ${flagCount} flag(s)${model.unparsedLines.length > 0 ? `, ${model.unparsedLines.length} unparsed line(s)` : ""}`,
  );

  // Step 2: Generate
  const safety = reviewSafety(model);
  const result = generateAdapter(model, safety, SDK_VERSION);
  let tools = result.tools;
  const metadata = buildToolMetadata(model);
  let files = result.files;

  if (tools.length === 0) {
    push("generate", "ok", "Generated 0 tools");
    push("validate", "failed", "No tools generated (need at least one subcommand or flags)");
    push("fix", "failed", "Cannot fix: no tools to work with");
    push("verify", "failed", "Verification failed: no tools generated");
    return {
      files,
      tools: [],
      log,
      summary: { flagsParsed: flagCount, toolsGenerated: 0, issuesFixed: 0, verified: false },
    };
  }
  push(
    "generate",
    "ok",
    `Generated ${tools.length} tool(s) from ${flagCount} flag(s)${safety.length > 0 ? `, ${safety.length} safety issue(s)` : ""}`,
  );

  // Step 3: Validate
  const validation = validateTools(tools);
  let issuesFixed = 0;

  if (validation.valid) {
    push("validate", "ok", `Validation passed for ${tools.length} tool(s)`);
    push("fix", "ok", "No fixes needed");
  } else {
    // Step 4: Fix
    const issuesBefore = validation.issues.length;
    const { tools: fixedTools, renames } = applyFixStrategies(tools);
    const fixedMetadata = applyRenames(metadata, renames);
    const fixedFiles = buildFiles(fixedTools, fixedMetadata, model, safety, SDK_VERSION);
    const revalidation = validateTools(fixedTools);
    issuesFixed = issuesBefore - revalidation.issues.length;

    push(
      "validate",
      "failed",
      `Validation found ${validation.issues.length} issue(s): ${validation.issues.slice(0, 2).join("; ")}${validation.issues.length > 2 ? "; ..." : ""}`,
    );
    push(
      "fix",
      revalidation.valid ? "fixed" : "failed",
      revalidation.valid
        ? `Fixed ${issuesFixed} issue(s), ${fixedTools.length} tool(s) remain`
        : `After fixes: ${revalidation.issues.length} issue(s) remain: ${revalidation.issues.slice(0, 2).join("; ")}${revalidation.issues.length > 2 ? "; ..." : ""}`,
    );

    tools = fixedTools;
    files = fixedFiles;

    if (!revalidation.valid) {
      push("verify", "failed", `Verification failed: ${revalidation.issues[0]}`);
      return {
        files,
        tools,
        log,
        summary: {
          flagsParsed: flagCount,
          toolsGenerated: tools.length,
          issuesFixed,
          verified: false,
        },
      };
    }
  }

  // Step 5: Verify (final validation on the tools that will ship)
  const finalValidation = validateTools(tools);
  push(
    "verify",
    finalValidation.valid ? "ok" : "failed",
    finalValidation.valid
      ? `All ${tools.length} tool(s) verified`
      : `Verification failed: ${finalValidation.issues[0]}`,
  );

  return {
    files,
    tools,
    log,
    summary: {
      flagsParsed: flagCount,
      toolsGenerated: tools.length,
      issuesFixed,
      verified: finalValidation.valid,
    },
  };
}

/**
 * Apply fix strategies to a set of tools. Returns the fixed tools plus a
 * rename map (old name -> new name, identity entries included) so the
 * caller can rename the runtime metadata to match.
 *
 * Strategies, in order:
 * 1. Rename tools that collide or break the name pattern (sanitize + numeric suffix)
 * 2. Drop properties with empty names (defensive — the generator never makes them)
 * 3. Truncate descriptions over 500 chars
 *
 * The input is deep-copied; the originals are never mutated.
 */
export function applyFixStrategies(tools: MCPToolSchema[]): {
  tools: MCPToolSchema[];
  renames: Map<string, string>;
} {
  const fixed: MCPToolSchema[] = JSON.parse(JSON.stringify(tools));
  const renames = new Map<string, string>();

  // Strategy 1: rename colliding/broken names
  const seen = new Set<string>();
  for (const tool of fixed) {
    const original = tool.name;
    let newName = tool.name;
    if (!/^[a-z][a-z0-9_]*$/.test(newName)) {
      newName = sanitizeToolName(newName);
    }
    if (seen.has(newName)) {
      let suffix = 1;
      let candidate = `${newName}_${suffix}`;
      while (seen.has(candidate)) {
        suffix++;
        candidate = `${newName}_${suffix}`;
      }
      newName = candidate;
    }
    renames.set(original, newName);
    seen.add(newName);
    tool.name = newName;
  }

  // Strategy 2: drop properties with empty names
  for (const tool of fixed) {
    const schema = tool.inputSchema as Record<string, unknown>;
    const properties = schema.properties as Record<string, unknown>;
    if (!properties || typeof properties !== "object") continue;
    for (const key of Object.keys(properties)) {
      if (key.trim() === "") {
        delete properties[key];
      }
    }
  }

  // Strategy 3: truncate descriptions over 500 chars
  for (const tool of fixed) {
    if (tool.description.length > 500) {
      tool.description = `${tool.description.slice(0, 497)}...`;
    }
    const schema = tool.inputSchema as Record<string, unknown>;
    const properties = schema.properties as Record<string, unknown>;
    if (!properties || typeof properties !== "object") continue;
    for (const propSchema of Object.values(properties)) {
      if (typeof propSchema === "object" && propSchema !== null) {
        const ps = propSchema as Record<string, unknown>;
        if (typeof ps.description === "string" && ps.description.length > 500) {
          ps.description = `${ps.description.slice(0, 497)}...`;
        }
      }
    }
  }

  return { tools: fixed, renames };
}

/**
 * Sanitize a tool name to match /^[a-z][a-z0-9_]*$/.
 */
function sanitizeToolName(name: string): string {
  let sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (sanitized === "" || /^[0-9]/.test(sanitized)) {
    sanitized = `t_${sanitized}`;
  }
  return sanitized;
}
