/**
 * Generator for MCP server code from a FlagModel.
 * Produces server.js, package.json, and README.md files.
 *
 * Design decision (deliberate spec interpretation):
 * - Tools WITH subcommands get one tool per subcommand.
 * - Tools WITHOUT subcommands get ONE tool named after the tool itself,
 *   with all top-level flags as optional properties.
 * - Every tool gets an `args` property (array of strings) for extra
 *   positional arguments.
 *
 * The generated server.js is REAL working code: one callTool function that
 * looks up the tool, prepends its subcommand (if any), and spawns the real
 * CLI with execFile and an argv array built ONLY from the allowlisted
 * flags — never a shell, never string concatenation into a command line.
 * The subcommand and original flag spellings live in TOOL_COMMANDS and
 * TOOL_FLAGS maps, computed together with the tools so names always agree.
 */
import type { FlagModel, Flag } from "../help-parser";
import type { MCPToolSchema } from "../tokens/types";
import type { SafetyFlag } from "../safety";
import type { ToolMetadata } from "./types";

/**
 * Sanitize a command name to a valid MCP tool name (snake_case).
 * Lowercase, replace non-alphanumeric runs with a single underscore,
 * remove leading/trailing underscores. Names that come out empty or
 * start with a digit get a "t_" prefix so they always match
 * /^[a-z][a-z0-9_]*$/.
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

/**
 * Convert a flag to a property name: prefer the long name, else the short
 * name; strip leading dashes; hyphens become underscores.
 */
function flagToPropertyName(flag: Flag): string {
  if (flag.names.length === 0) return "";
  const name = flag.names.find((n) => n.startsWith("--")) || flag.names[0];
  return name.replace(/^-+/, "").replace(/-/g, "_");
}

/**
 * Original flag spelling as typed on the command line: prefer the long
 * name, else the short name. This is what the generated server passes to
 * the real CLI — a short-only flag must stay "-f", not become "--f".
 */
function flagSpelling(flag: Flag): string {
  if (flag.names.length === 0) return "";
  return flag.names.find((n) => n.startsWith("--")) || flag.names[0];
}

/**
 * Build tools AND their runtime metadata together, so tool names,
 * subcommand mappings, and flag spellings can never disagree.
 * Tool names are deduplicated with numeric suffixes (my_cmd, my_cmd_1).
 * Property names within a tool are deduplicated the same way.
 */
function buildToolsAndMetadata(model: FlagModel): {
  tools: MCPToolSchema[];
  metadata: ToolMetadata;
} {
  const tools: MCPToolSchema[] = [];
  const metadata: ToolMetadata = { commands: {}, flags: {} };
  const usedNames = new Set<string>();

  const buildOne = (commandName: string, description: string, flags: Flag[]) => {
    const baseName = sanitizeToolName(commandName);
    let toolName = baseName;
    for (let suffix = 1; usedNames.has(toolName); suffix++) {
      toolName = `${baseName}_${suffix}`;
    }
    usedNames.add(toolName);

    const properties: Record<string, unknown> = {};
    const flagMap: Record<string, string> = {};
    const usedProps = new Set<string>(["args"]);

    for (const flag of flags) {
      const baseProp = flagToPropertyName(flag);
      if (!baseProp) continue;
      let propName = baseProp;
      for (let suffix = 2; usedProps.has(propName); suffix++) {
        propName = `${baseProp}_${suffix}`;
      }
      usedProps.add(propName);
      flagMap[propName] = flagSpelling(flag);

      if (flag.takesValue) {
        const valuePart = flag.valueName ? ` (${flag.valueName})` : "";
        properties[propName] = {
          type: "string",
          description: `${flag.description}${valuePart}`,
        };
      } else {
        properties[propName] = { type: "boolean", description: flag.description };
      }
    }

    properties["args"] = {
      type: "array",
      items: { type: "string" },
      description: "Extra positional arguments passed through to the command",
    };

    metadata.flags[toolName] = flagMap;
    tools.push({
      name: toolName,
      description: description || `Execute ${commandName}`,
      inputSchema: { type: "object", properties, additionalProperties: false },
    });
    return toolName;
  };

  if (model.subcommands.length > 0) {
    for (const sub of model.subcommands) {
      const toolName = buildOne(sub.name, sub.description, sub.flags);
      metadata.commands[toolName] = sub.name;
    }
  } else {
    const toolName = buildOne(model.toolName, model.description, model.flags);
    metadata.commands[toolName] = null;
  }

  return { tools, metadata };
}

/**
 * Generate MCP tool schemas from a parsed flag model.
 */
export function generateTools(model: FlagModel): MCPToolSchema[] {
  return buildToolsAndMetadata(model).tools;
}

/**
 * Build the runtime metadata (subcommand + flag spellings) for a model.
 * Computed by the same function as generateTools, so names always agree.
 */
export function buildToolMetadata(model: FlagModel): ToolMetadata {
  return buildToolsAndMetadata(model).metadata;
}

/**
 * Rename metadata keys after the agent loop renames tools.
 * `renames` maps old tool name -> new tool name (identity entries included).
 */
export function applyRenames(metadata: ToolMetadata, renames: Map<string, string>): ToolMetadata {
  const commands: Record<string, string | null> = {};
  const flags: Record<string, Record<string, string>> = {};
  for (const [oldName, sub] of Object.entries(metadata.commands)) {
    commands[renames.get(oldName) ?? oldName] = sub;
  }
  for (const [oldName, flagMap] of Object.entries(metadata.flags)) {
    flags[renames.get(oldName) ?? oldName] = flagMap;
  }
  return { commands, flags };
}

/** Strip anything that could break a JS comment or an npm package name. */
function safeCommentText(text: string): string {
  return text.replace(/[^a-zA-Z0-9 _.-]/g, "").trim() || "tool";
}

function safePackageName(toolName: string): string {
  const cleaned = toolName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/^-+/, "");
  return `frankenmcp-${cleaned || "tool"}`;
}

/**
 * Build the complete server.js implementation for the generated tools.
 * ONE callTool function serves every tool; the per-tool subcommand and
 * flag spellings come from the TOOL_COMMANDS / TOOL_FLAGS maps.
 */
function buildServerJs(tools: MCPToolSchema[], metadata: ToolMetadata, toolName: string): string {
  const commentName = safeCommentText(toolName);
  return `/**
 * MCP Server for ${commentName}
 * Generated by FrankenMCP
 * DO NOT EDIT: This is generated code. Review before running.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Tool definitions (JSON Schema for each tool)
const TOOLS = ${JSON.stringify(tools, null, 2)};

// Subcommand each tool runs (null = the tool itself, no subcommand)
const TOOL_COMMANDS = ${JSON.stringify(metadata.commands, null, 2)};

// Original flag spelling per tool, keyed by property name
const TOOL_FLAGS = ${JSON.stringify(metadata.flags, null, 2)};

// The real CLI binary this server wraps
const CLI = ${JSON.stringify(toolName)};

async function callTool(name, args) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error("Unknown tool: " + name);
  const argv = [];
  const sub = TOOL_COMMANDS[name];
  if (sub) argv.push(sub);
  const props = (tool.inputSchema && tool.inputSchema.properties) || {};
  const flags = TOOL_FLAGS[name] || {};
  for (const [key, value] of Object.entries(args || {})) {
    if (key === "args") continue;
    if (!Object.prototype.hasOwnProperty.call(props, key)) {
      throw new Error("Unknown argument: " + key);
    }
    const flag = flags[key];
    if (!flag) throw new Error("Unknown argument: " + key);
    if (typeof value === "string") {
      if (value.includes("\\0")) throw new Error("Argument contains NUL byte");
      argv.push(flag, value);
    } else if (typeof value === "boolean") {
      if (value) argv.push(flag);
    } else {
      throw new Error("Invalid value for " + key + ": expected string or boolean");
    }
  }
  if (Array.isArray(args && args.args)) {
    if (argv.length + args.args.length > 100) {
      throw new Error("Too many arguments (max 100)");
    }
    for (const arg of args.args) {
      if (typeof arg !== "string") throw new Error("Arguments must be strings");
      if (arg.includes("\\0")) throw new Error("Argument contains NUL byte");
      argv.push(arg);
    }
  }
  try {
    const { stdout, stderr } = await execFileAsync(CLI, argv, {
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });
    return stdout || stderr || "(no output)";
  } catch (error) {
    if (error && typeof error === "object" && "stderr" in error && error.stderr) {
      throw new Error(String(error.stderr));
    }
    throw error;
  }
}

const server = new Server(
  { name: ${JSON.stringify(safePackageName(toolName))}, version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await callTool(request.params.name, request.params.arguments || {});
    return { content: [{ type: "text", text: result }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text", text: message }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
`;
}

/**
 * Build package.json for the generated server.
 */
function buildPackageJson(toolName: string, sdkVersion: string): string {
  return JSON.stringify(
    {
      name: safePackageName(toolName),
      version: "1.0.0",
      description: `MCP server for ${safeCommentText(toolName)} (generated by FrankenMCP)`,
      type: "module",
      main: "server.js",
      scripts: {
        start: "node server.js",
      },
      dependencies: {
        "@modelcontextprotocol/sdk": sdkVersion,
      },
    },
    null,
    2,
  );
}

/**
 * Build README.md with setup instructions and safety notes.
 */
function buildReadme(toolName: string, safety: SafetyFlag[]): string {
  const commentName = safeCommentText(toolName);
  const safetySection =
    safety.length === 0
      ? "## Safety\n\nNo safety issues found.\n"
      : `## Safety\n\n${safety.map((s) => `- **${s.option}** (${s.severity}): ${s.message}`).join("\n")}\n`;

  return `# MCP Server for ${commentName}

Generated by FrankenMCP.

## ⚠️ Important

This is generated source code. Review it carefully before running, especially the argument allowlist and the commands it spawns.

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Run the server:
   \`\`\`bash
   node server.js
   \`\`\`

3. Add to your MCP client config (e.g., \`.config/Claude/claude_desktop_config.json\`):
   \`\`\`json
   {
     "mcpServers": {
       "${safePackageName(toolName)}": {
         "command": "node",
         "args": ["/absolute/path/to/server.js"]
       }
     }
   }
   \`\`\`

${safetySection}
`;
}

/**
 * Build all files (server.js, package.json, README.md) for a set of tools.
 * `metadata` must match `tools` by name — build it with buildToolMetadata
 * from the same model, and applyRenames after any loop renames.
 */
export function buildFiles(
  tools: MCPToolSchema[],
  metadata: ToolMetadata,
  model: FlagModel,
  safety: SafetyFlag[],
  sdkVersion: string = "1.20.1",
): {
  "server.js": string;
  "package.json": string;
  "README.md": string;
} {
  return {
    "server.js": buildServerJs(tools, metadata, model.toolName),
    "package.json": buildPackageJson(model.toolName, sdkVersion),
    "README.md": buildReadme(model.toolName, safety),
  };
}

/**
 * Generate everything: tools, files, and metadata.
 */
export function generateAdapter(
  model: FlagModel,
  safety: SafetyFlag[],
  sdkVersion: string = "1.20.1",
): {
  files: {
    "server.js": string;
    "package.json": string;
    "README.md": string;
  };
  tools: MCPToolSchema[];
} {
  const { tools, metadata } = buildToolsAndMetadata(model);
  const files = buildFiles(tools, metadata, model, safety, sdkVersion);
  return { files, tools };
}
