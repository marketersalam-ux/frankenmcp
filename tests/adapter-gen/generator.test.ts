/**
 * Tests for the adapter-gen generator module.
 * Tests tool generation, file building, and adapter generation.
 */
import { describe, it, expect } from "vitest";
import type { FlagModel } from "../../src/lib/help-parser";
import {
  generateTools,
  buildToolMetadata,
  buildFiles,
  generateAdapter,
} from "../../src/lib/adapter-gen";
import type { MCPToolSchema } from "../../src/lib/tokens/types";

describe("adapter-gen: generator", () => {
  describe("generateTools", () => {
    it("generates one tool per subcommand", () => {
      const model: FlagModel = {
        toolName: "git",
        description: "Version control",
        flags: [],
        subcommands: [
          {
            name: "add",
            description: "Add files",
            flags: [
              {
                names: ["-A", "--all"],
                takesValue: false,
                description: "Add all files",
              },
            ],
          },
          {
            name: "commit",
            description: "Create commit",
            flags: [
              {
                names: ["-m", "--message"],
                takesValue: true,
                valueName: "MSG",
                description: "Commit message",
              },
            ],
          },
        ],
        unparsedLines: [],
      };

      const tools = generateTools(model);
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe("add");
      expect(tools[1].name).toBe("commit");
    });

    it("generates one tool for a tool without subcommands", () => {
      const model: FlagModel = {
        toolName: "curl",
        description: "Transfer data",
        flags: [
          {
            names: ["-X", "--request"],
            takesValue: true,
            valueName: "METHOD",
            description: "Request method",
          },
          {
            names: ["-L"],
            takesValue: false,
            description: "Follow redirects",
          },
        ],
        subcommands: [],
        unparsedLines: [],
      };

      const tools = generateTools(model);
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("curl");
    });

    it("includes args property in every tool", () => {
      const model: FlagModel = {
        toolName: "ffmpeg",
        description: "Video converter",
        flags: [],
        subcommands: [
          {
            name: "convert",
            description: "Convert video",
            flags: [],
          },
        ],
        unparsedLines: [],
      };

      const tools = generateTools(model);
      const schema = tools[0].inputSchema as Record<string, unknown>;
      expect((schema.properties as Record<string, unknown>)["args"]).toBeDefined();
    });

    it("converts flag names to snake_case properties", () => {
      const model: FlagModel = {
        toolName: "test",
        description: "Test tool",
        flags: [
          {
            names: ["--output-file"],
            takesValue: true,
            valueName: "FILE",
            description: "Output file",
          },
        ],
        subcommands: [],
        unparsedLines: [],
      };

      const tools = generateTools(model);
      const schema = tools[0].inputSchema as Record<string, unknown>;
      expect((schema.properties as Record<string, unknown>)["output_file"]).toBeDefined();
    });

    it("handles boolean flags correctly", () => {
      const model: FlagModel = {
        toolName: "test",
        description: "Test tool",
        flags: [
          {
            names: ["-v", "--verbose"],
            takesValue: false,
            description: "Verbose output",
          },
        ],
        subcommands: [],
        unparsedLines: [],
      };

      const tools = generateTools(model);
      const schema = tools[0].inputSchema as Record<string, unknown>;
      const props = schema.properties as Record<string, unknown>;
      const verboseProp = props["verbose"] as Record<string, unknown>;
      expect(verboseProp.type).toBe("boolean");
    });

    it("handles value flags correctly", () => {
      const model: FlagModel = {
        toolName: "test",
        description: "Test tool",
        flags: [
          {
            names: ["-o", "--output"],
            takesValue: true,
            valueName: "FILE",
            description: "Output file",
          },
        ],
        subcommands: [],
        unparsedLines: [],
      };

      const tools = generateTools(model);
      const schema = tools[0].inputSchema as Record<string, unknown>;
      const props = schema.properties as Record<string, unknown>;
      const outputProp = props["output"] as Record<string, unknown>;
      expect(outputProp.type).toBe("string");
      expect((outputProp.description as string).includes("FILE")).toBe(true);
    });

    it("sanitizes tool names correctly", () => {
      const model: FlagModel = {
        toolName: "my-cool-tool",
        description: "Test",
        flags: [],
        subcommands: [],
        unparsedLines: [],
      };

      const tools = generateTools(model);
      expect(tools[0].name).toBe("my_cool_tool");
    });

    it("dedupes colliding tool names at generation time", () => {
      const model: FlagModel = {
        toolName: "test",
        description: "Test",
        flags: [],
        subcommands: [
          { name: "my-cmd", description: "One", flags: [] },
          { name: "my_cmd", description: "Two", flags: [] },
        ],
        unparsedLines: [],
      };

      const tools = generateTools(model);
      expect(tools.map((t) => t.name)).toEqual(["my_cmd", "my_cmd_1"]);
    });

    it("prefixes digit-start names so they always validate", () => {
      const model: FlagModel = {
        toolName: "123tool",
        description: "Test",
        flags: [],
        subcommands: [],
        unparsedLines: [],
      };

      const tools = generateTools(model);
      expect(tools[0].name).toBe("t_123tool");
    });

    it("dedupes colliding property names within a tool", () => {
      const model: FlagModel = {
        toolName: "test",
        description: "Test",
        flags: [
          { names: ["--dry-run"], takesValue: false, description: "Dry run" },
          { names: ["--dry_run"], takesValue: false, description: "Dry run 2" },
        ],
        subcommands: [],
        unparsedLines: [],
      };

      const tools = generateTools(model);
      const schema = tools[0].inputSchema as Record<string, unknown>;
      const props = schema.properties as Record<string, unknown>;
      expect(props["dry_run"]).toBeDefined();
      expect(props["dry_run_2"]).toBeDefined();
    });
  });

  describe("buildFiles", () => {
    it("builds server.js with StdioServerTransport and execFile", () => {
      const tools: MCPToolSchema[] = [
        {
          name: "test_tool",
          description: "A test tool",
          inputSchema: {
            type: "object",
            properties: { args: { type: "array", items: { type: "string" } } },
            additionalProperties: false,
          },
        },
      ];
      const model: FlagModel = {
        toolName: "test",
        description: "Test",
        flags: [],
        subcommands: [],
        unparsedLines: [],
      };

      const files = buildFiles(tools, buildToolMetadata(model), model, []);
      expect(files["server.js"]).toContain("StdioServerTransport");
      expect(files["server.js"]).toContain("execFile");
      expect(files["server.js"]).not.toContain("shell: true");
      expect(files["server.js"]).not.toContain("eval");
    });

    it("builds package.json with SDK dependency", () => {
      const tools: MCPToolSchema[] = [];
      const model: FlagModel = {
        toolName: "test",
        description: "Test",
        flags: [],
        subcommands: [],
        unparsedLines: [],
      };

      const files = buildFiles(tools, buildToolMetadata(model), model, [], "1.20.1");
      const pkg = JSON.parse(files["package.json"]);
      expect(pkg.name).toBe("frankenmcp-test");
      expect(pkg.type).toBe("module");
      expect(pkg.dependencies["@modelcontextprotocol/sdk"]).toBe("1.20.1");
    });

    it("builds README with setup instructions", () => {
      const tools: MCPToolSchema[] = [];
      const model: FlagModel = {
        toolName: "test",
        description: "Test",
        flags: [],
        subcommands: [],
        unparsedLines: [],
      };

      const files = buildFiles(tools, buildToolMetadata(model), model, []);
      expect(files["README.md"]).toContain("npm install");
      expect(files["README.md"]).toContain("node server.js");
      expect(files["README.md"]).toContain("claude_desktop_config.json");
    });

    it("includes safety notes in README", () => {
      const tools: MCPToolSchema[] = [];
      const model: FlagModel = {
        toolName: "test",
        description: "Test",
        flags: [],
        subcommands: [],
        unparsedLines: [],
      };
      const safety = [
        {
          option: "--force",
          severity: "warn" as const,
          message: "Destructive option",
        },
      ];

      const files = buildFiles(tools, buildToolMetadata(model), model, safety);
      expect(files["README.md"]).toContain("--force");
      expect(files["README.md"]).toContain("Destructive option");
    });

    it("says no safety issues when list is empty", () => {
      const tools: MCPToolSchema[] = [];
      const model: FlagModel = {
        toolName: "test",
        description: "Test",
        flags: [],
        subcommands: [],
        unparsedLines: [],
      };

      const files = buildFiles(tools, buildToolMetadata(model), model, []);
      expect(files["README.md"]).toContain("No safety issues found");
    });

    it("server.js has exactly one callTool and wires subcommands + flag spellings", () => {
      const model: FlagModel = {
        toolName: "git",
        description: "Version control",
        flags: [],
        subcommands: [
          {
            name: "add",
            description: "Add files",
            flags: [{ names: ["-A"], takesValue: false, description: "Add all files" }],
          },
          {
            name: "commit",
            description: "Create commit",
            flags: [
              {
                names: ["-m", "--message"],
                takesValue: true,
                valueName: "MSG",
                description: "Commit message",
              },
            ],
          },
        ],
        unparsedLines: [],
      };

      const { files } = generateAdapter(model, []);
      const serverJs = files["server.js"];

      // Exactly one callTool definition — multi-tool servers must not
      // redefine it per tool (later definitions would shadow earlier ones).
      expect(serverJs.match(/async function callTool/g)).toHaveLength(1);
      // Subcommand mapping: tool "add" runs the "add" subcommand.
      expect(serverJs).toContain('"add": "add"');
      expect(serverJs).toContain('"commit": "commit"');
      // Flag spellings: short-only "-A" stays "-A" (never becomes "--A");
      // the long name is preferred when present.
      expect(serverJs).toContain('"-A"');
      expect(serverJs).not.toContain('"--A"');
      expect(serverJs).toContain('"--message"');
      // The real CLI is spawned by name via execFile.
      expect(serverJs).toContain("execFileAsync(CLI, argv");
    });

    it("flag-only tools get a null subcommand entry", () => {
      const model: FlagModel = {
        toolName: "curl",
        description: "Transfer data",
        flags: [{ names: ["-L"], takesValue: false, description: "Follow redirects" }],
        subcommands: [],
        unparsedLines: [],
      };

      const { files } = generateAdapter(model, []);
      expect(files["server.js"]).toContain('"curl": null');
    });
  });

  describe("generateAdapter", () => {
    it("combines tools and files", () => {
      const model: FlagModel = {
        toolName: "test",
        description: "Test tool",
        flags: [
          {
            names: ["--verbose"],
            takesValue: false,
            description: "Be verbose",
          },
        ],
        subcommands: [],
        unparsedLines: [],
      };

      const result = generateAdapter(model, []);
      expect(result.tools).toHaveLength(1);
      expect(result.files["server.js"]).toBeDefined();
      expect(result.files["package.json"]).toBeDefined();
      expect(result.files["README.md"]).toBeDefined();
    });
  });
});
