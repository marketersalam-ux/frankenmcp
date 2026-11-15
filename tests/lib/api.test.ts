import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  generateAdapter,
  getSample,
  connectServer,
  probeTool,
  buildTrimConfig,
  type GenerateResponse,
  type ConnectResponse,
  type ProbeResponse,
  type SampleResponse,
  type TrimResponse,
} from "@/lib/api";

// Mock global fetch
const originalFetch = global.fetch;
let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  global.fetch = mockFetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("Client API library", () => {
  describe("getSample", () => {
    it("gets ffmpeg sample", async () => {
      const mockResponse: SampleResponse = {
        name: "ffmpeg",
        text: "ffmpeg version 8.1.2",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getSample("ffmpeg");

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith("/api/samples?name=ffmpeg");
    });

    it("gets git sample", async () => {
      const mockResponse: SampleResponse = {
        name: "git",
        text: "usage: git",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getSample("git");

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith("/api/samples?name=git");
    });

    it("throws on non-OK response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Invalid sample", detail: "Unknown sample: invalid" }),
      });

      await expect(getSample("ffmpeg" as never)).rejects.toThrow("Unknown sample: invalid");
    });
  });

  describe("generateAdapter", () => {
    it("generates from helpText", async () => {
      const mockResponse: GenerateResponse = {
        files: {
          "server.js": "// server",
          "package.json": "{}",
          "README.md": "# README",
        },
        tools: [{ name: "test", description: "Test tool", inputSchema: {} }],
        costs: { perTool: [], total: 0 },
        safety: [],
        log: [],
        summary: { flagsParsed: 1, toolsGenerated: 1, issuesFixed: 0, verified: true },
        unparsedLines: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await generateAdapter({ helpText: "test help text" });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/generate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ helpText: "test help text" }),
        }),
      );
    });

    it("generates from sample", async () => {
      const mockResponse: GenerateResponse = {
        files: { "server.js": "", "package.json": "", "README.md": "" },
        tools: [],
        costs: { perTool: [], total: 0 },
        safety: [],
        log: [],
        summary: { flagsParsed: 0, toolsGenerated: 0, issuesFixed: 0, verified: false },
        unparsedLines: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await generateAdapter({ sample: "git" });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/generate",
        expect.objectContaining({
          body: JSON.stringify({ sample: "git" }),
        }),
      );
    });

    it("throws on non-OK response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "parse failed", detail: "Invalid syntax" }),
      });

      await expect(generateAdapter({ helpText: "bad help" })).rejects.toThrow("Invalid syntax");
    });

    it("throws with error field if detail is missing", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "some error", detail: "" }),
      });

      await expect(generateAdapter({ helpText: "bad help" })).rejects.toThrow("some error");
    });
  });

  describe("connectServer", () => {
    it("connects to textkit", async () => {
      const mockResponse: ConnectResponse = {
        tools: [{ name: "wc", description: "Count words", inputSchema: {} }],
        costs: { perTool: [], total: 0 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await connectServer("textkit");

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/connect",
        expect.objectContaining({
          body: JSON.stringify({ target: "textkit" }),
        }),
      );
    });

    it("connects to remote URL", async () => {
      const mockResponse: ConnectResponse = {
        tools: [],
        costs: { perTool: [], total: 0 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await connectServer({ url: "http://localhost:3000/sse" });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/connect",
        expect.objectContaining({
          body: JSON.stringify({ target: { url: "http://localhost:3000/sse" } }),
        }),
      );
    });

    it("throws with detail message on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: "connection failed",
          detail: "Connection refused",
        }),
      });

      await expect(connectServer("textkit")).rejects.toThrow("Connection refused");
    });
  });

  describe("probeTool", () => {
    it("probes a tool", async () => {
      const mockResponse: ProbeResponse = {
        result: { content: [{ text: "5" }] },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await probeTool("calculator", "add", { a: 2, b: 3 });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/probe",
        expect.objectContaining({
          body: JSON.stringify({ target: "calculator", tool: "add", args: { a: 2, b: 3 } }),
        }),
      );
    });

    it("throws with detail message on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: "tool error",
          detail: "Tool not found",
        }),
      });

      await expect(probeTool("calculator", "unknown", {})).rejects.toThrow("Tool not found");
    });
  });

  describe("buildTrimConfig", () => {
    const tools = [
      { name: "tool_a", description: "Tool A", inputSchema: {} },
      { name: "tool_b", description: "Tool B", inputSchema: {} },
    ];

    it("builds full config", async () => {
      const mockResponse: TrimResponse = {
        config: { tools },
        tokens: 100,
        saved: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await buildTrimConfig(tools, "full");

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/trim",
        expect.objectContaining({
          body: JSON.stringify({ tools, mode: "full" }),
        }),
      );
    });

    it("builds trimmed config with pickedNames", async () => {
      const mockResponse: TrimResponse = {
        config: { tools: [tools[0]] },
        tokens: 50,
        saved: 50,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await buildTrimConfig(tools, "trimmed", ["tool_a"]);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/trim",
        expect.objectContaining({
          body: JSON.stringify({ tools, mode: "trimmed", pickedNames: ["tool_a"] }),
        }),
      );
    });

    it("throws with detail message on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: "invalid mode",
          detail: "Unknown mode: bad",
        }),
      });

      await expect(buildTrimConfig(tools, "full" as never)).rejects.toThrow("Unknown mode: bad");
    });
  });
});
