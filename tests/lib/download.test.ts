import { describe, it, expect } from "vitest";
import { buildDownloadFiles } from "@/lib/download";

describe("Download helpers", () => {
  describe("buildDownloadFiles", () => {
    it("returns all five files", () => {
      const input = {
        files: {
          "server.js": "// server code",
          "package.json": "{}",
          "README.md": "# Readme",
        },
        costs: {
          perTool: [
            { name: "tool_a", tokens: 50 },
            { name: "tool_b", tokens: 60 },
          ],
          total: 110,
        },
        safety: [
          {
            option: "--force",
            severity: "warn" as const,
            message: "Destructive option",
          },
        ],
        summary: {
          flagsParsed: 10,
          toolsGenerated: 2,
          issuesFixed: 0,
          verified: true,
        },
        unparsedLines: [],
      };

      const result = buildDownloadFiles(input);

      expect(Object.keys(result).sort()).toEqual([
        "COSTS.md",
        "README.md",
        "SAFETY.md",
        "package.json",
        "server.js",
      ]);
    });

    it("passes through original files", () => {
      const input = {
        files: {
          "server.js": "// server code",
          "package.json": "{}",
          "README.md": "# Readme",
        },
        costs: { perTool: [], total: 0 },
        safety: [],
        summary: {
          flagsParsed: 0,
          toolsGenerated: 0,
          issuesFixed: 0,
          verified: true,
        },
        unparsedLines: [],
      };

      const result = buildDownloadFiles(input);

      expect(result["server.js"]).toBe("// server code");
      expect(result["package.json"]).toBe("{}");
      expect(result["README.md"]).toBe("# Readme");
    });

    it("includes tokenizer line in COSTS.md", () => {
      const input = {
        files: {
          "server.js": "",
          "package.json": "",
          "README.md": "",
        },
        costs: {
          perTool: [{ name: "tool_a", tokens: 50 }],
          total: 50,
        },
        safety: [],
        summary: {
          flagsParsed: 1,
          toolsGenerated: 1,
          issuesFixed: 0,
          verified: true,
        },
        unparsedLines: [],
      };

      const result = buildDownloadFiles(input);

      expect(result["COSTS.md"]).toContain(
        "Token counts are estimates counted with the cl100k_base tokenizer (tiktoken).",
      );
      expect(result["COSTS.md"]).toContain("Total: 50 tokens");
    });

    it("includes total in COSTS.md", () => {
      const input = {
        files: {
          "server.js": "",
          "package.json": "",
          "README.md": "",
        },
        costs: {
          perTool: [
            { name: "tool_a", tokens: 50 },
            { name: "tool_b", tokens: 75 },
          ],
          total: 125,
        },
        safety: [],
        summary: {
          flagsParsed: 5,
          toolsGenerated: 2,
          issuesFixed: 1,
          verified: true,
        },
        unparsedLines: [],
      };

      const result = buildDownloadFiles(input);

      expect(result["COSTS.md"]).toContain("Total: 125 tokens");
      expect(result["COSTS.md"]).toContain("tool_a: 50 tokens");
      expect(result["COSTS.md"]).toContain("tool_b: 75 tokens");
    });

    it("includes each safety flag in SAFETY.md", () => {
      const input = {
        files: {
          "server.js": "",
          "package.json": "",
          "README.md": "",
        },
        costs: { perTool: [], total: 0 },
        safety: [
          {
            option: "--force",
            severity: "warn" as const,
            message: "Destructive option",
          },
          {
            option: "--path",
            severity: "info" as const,
            message: "Path flag",
          },
        ],
        summary: {
          flagsParsed: 0,
          toolsGenerated: 0,
          issuesFixed: 0,
          verified: true,
        },
        unparsedLines: [],
      };

      const result = buildDownloadFiles(input);

      expect(result["SAFETY.md"]).toContain("[warn] --force: Destructive option");
      expect(result["SAFETY.md"]).toContain("[info] --path: Path flag");
    });

    it("returns no-issues message when safety array is empty", () => {
      const input = {
        files: {
          "server.js": "",
          "package.json": "",
          "README.md": "",
        },
        costs: { perTool: [], total: 0 },
        safety: [],
        summary: {
          flagsParsed: 0,
          toolsGenerated: 0,
          issuesFixed: 0,
          verified: true,
        },
        unparsedLines: [],
      };

      const result = buildDownloadFiles(input);

      expect(result["SAFETY.md"]).toBe("No safety issues found.");
    });

    it("includes summary stats in COSTS.md", () => {
      const input = {
        files: {
          "server.js": "",
          "package.json": "",
          "README.md": "",
        },
        costs: {
          perTool: [
            { name: "tool_a", tokens: 50 },
            { name: "tool_b", tokens: 60 },
          ],
          total: 110,
        },
        safety: [],
        summary: {
          flagsParsed: 15,
          toolsGenerated: 2,
          issuesFixed: 3,
          verified: true,
        },
        unparsedLines: [],
      };

      const result = buildDownloadFiles(input);

      expect(result["COSTS.md"]).toContain(
        "Generated from 2 tool(s), 15 flag(s) parsed, 3 issue(s) fixed.",
      );
    });
  });
});
