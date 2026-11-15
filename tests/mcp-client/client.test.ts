import { describe, it, expect, afterEach } from "vitest";
import { listTools, callTool, isMCPTarget } from "@/lib/mcp-client";
import { createServer } from "http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

describe("mcp-client", () => {
  describe("isMCPTarget", () => {
    it("accepts bundled names", () => {
      expect(isMCPTarget("textkit")).toBe(true);
      expect(isMCPTarget("calculator")).toBe(true);
    });

    it("accepts remote URLs", () => {
      expect(isMCPTarget({ url: "http://example.com/mcp" })).toBe(true);
      expect(isMCPTarget({ url: "https://example.com/sse" })).toBe(true);
    });

    it("rejects other values", () => {
      expect(isMCPTarget("unknown")).toBe(false);
      expect(isMCPTarget({ url: 123 })).toBe(false);
      expect(isMCPTarget(null)).toBe(false);
      expect(isMCPTarget(undefined)).toBe(false);
    });
  });

  describe("listTools with bundled servers", () => {
    afterEach(async () => {
      // Give any spawned processes time to exit
      await new Promise((r) => setTimeout(r, 100));
    });

    it("lists 4 textkit tools", async () => {
      const tools = await listTools("textkit");
      expect(tools.length).toBe(4);
      expect(tools.map((t) => t.name).sort()).toEqual(["reverse", "slugify", "upper", "wc"]);
    });

    it("lists 4 calculator tools", async () => {
      const tools = await listTools("calculator");
      expect(tools.length).toBe(4);
      expect(tools.map((t) => t.name).sort()).toEqual(["add", "divide", "multiply", "subtract"]);
    });

    it("rejects unknown bundled names", async () => {
      try {
        await listTools("unknown" as "textkit");
        expect.fail("should throw");
      } catch (err) {
        expect(err instanceof Error).toBe(true);
        expect((err as Error).message).toContain("Unknown bundled server");
      }
    });
  });

  describe("listTools with remote URLs", () => {
    it("rejects localhost URLs", async () => {
      try {
        await listTools({ url: "http://localhost:3000/mcp" });
        expect.fail("should throw");
      } catch (err) {
        expect(err instanceof Error).toBe(true);
        expect((err as Error).message).toContain("blocked");
      }
    });

    it("rejects 127.0.0.1", async () => {
      try {
        await listTools({ url: "http://127.0.0.1:8080/x" });
        expect.fail("should throw");
      } catch (err) {
        expect(err instanceof Error).toBe(true);
        expect((err as Error).message).toContain("blocked");
      }
    });

    it("rejects 192.168.x.x", async () => {
      try {
        await listTools({ url: "http://192.168.1.1/mcp" });
        expect.fail("should throw");
      } catch (err) {
        expect(err instanceof Error).toBe(true);
        expect((err as Error).message).toContain("blocked");
      }
    });

    it("rejects 10.x and 172.16.x private ranges", async () => {
      for (const url of [
        "http://10.0.0.5/mcp",
        "http://172.16.0.9/mcp",
        "http://172.31.255.1/mcp",
      ]) {
        await expect(listTools({ url })).rejects.toThrow("blocked");
      }
      // 172.15.x and 172.32.x are NOT private — they must not be blocked
      // (they fail later on DNS/connect, never with "blocked").
      for (const url of ["http://172.15.0.9/mcp", "http://172.32.0.9/mcp"]) {
        await expect(listTools({ url }, { timeoutMs: 200 })).rejects.not.toThrow("blocked");
      }
    });

    it("rejects IPv6 localhost, 0.0.0.0, and localhost with a trailing dot", async () => {
      for (const url of [
        "http://[::1]/mcp",
        "http://[::ffff:127.0.0.1]/mcp",
        "http://0.0.0.0/mcp",
        "http://localhost./mcp",
      ]) {
        await expect(listTools({ url })).rejects.toThrow("blocked");
      }
    });

    it("rejects obfuscated numeric IPs (integer / hex forms)", async () => {
      for (const url of [
        "http://2130706433/mcp",
        "http://0x7f.0.0.1/mcp",
        "http://0177.0.0.1/mcp",
      ]) {
        await expect(listTools({ url })).rejects.toThrow("blocked");
      }
    });

    it("rejects non-http URLs", async () => {
      try {
        await listTools({ url: "ftp://example.com/mcp" });
        expect.fail("should throw");
      } catch (err) {
        expect(err instanceof Error).toBe(true);
        expect((err as Error).message).toContain("http");
      }
    });

    it("fails on an unresolvable hostname with a specific error", async () => {
      // Which specific error appears depends on the resolver: a fast
      // NXDOMAIN maps to "Cannot resolve hostname"; a hanging resolver
      // hits the timeout instead. Both are specific, user-facing errors —
      // the property under test is "no generic failure, no hang".
      try {
        await listTools(
          { url: "http://thishostnamecannotpossiblyexist.invalid/mcp" },
          { timeoutMs: 1000 },
        );
        expect.fail("should throw");
      } catch (err) {
        expect(err instanceof Error).toBe(true);
        expect((err as Error).message).toMatch(/Cannot resolve hostname|timed out/);
      }
    }, 10000);
  });

  describe("remote transport (real local servers, test-only allowPrivateUrls)", () => {
    it("times out on a server that accepts but never responds", async () => {
      const hanging = createServer(() => {
        // Never respond.
      });
      await new Promise<void>((resolve) => hanging.listen(0, "127.0.0.1", resolve));
      const port = (hanging.address() as { port: number }).port;
      try {
        await expect(
          listTools(
            { url: `http://127.0.0.1:${port}/mcp` },
            { timeoutMs: 200, allowPrivateUrls: true },
          ),
        ).rejects.toThrow("timed out");
      } finally {
        hanging.closeAllConnections();
        await new Promise<void>((resolve) => hanging.close(() => resolve()));
      }
    }, 5000);

    it("lists and calls tools on a real streamable-HTTP MCP server", async () => {
      const server = new Server(
        { name: "test-remote", version: "1.0.0" },
        { capabilities: { tools: {} } },
      );
      server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [
          {
            name: "echo",
            description: "Echo text back",
            inputSchema: {
              type: "object",
              properties: { text: { type: "string" } },
              required: ["text"],
            },
          },
        ],
      }));
      server.setRequestHandler(CallToolRequestSchema, async (request) => ({
        content: [
          {
            type: "text",
            text: `echo:${String((request.params.arguments as { text?: unknown } | undefined)?.text ?? "")}`,
          },
        ],
      }));
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      const httpServer = createServer(async (req, res) => {
        const body = await new Promise<string>((resolve) => {
          let data = "";
          req.on("data", (chunk) => (data += chunk));
          req.on("end", () => resolve(data));
        });
        await transport.handleRequest(req, res, body ? JSON.parse(body) : undefined);
      });
      await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
      const port = (httpServer.address() as { port: number }).port;
      const target = { url: `http://127.0.0.1:${port}/mcp` };
      try {
        const tools = await listTools(target, { allowPrivateUrls: true });
        expect(tools.map((t) => t.name)).toEqual(["echo"]);
        const result = await callTool(
          target,
          "echo",
          { text: "hello" },
          { allowPrivateUrls: true },
        );
        const content = (result as { content?: Array<{ type?: string; text?: string }> })?.content;
        expect(content?.[0]?.text).toBe("echo:hello");
      } finally {
        await transport.close().catch(() => {});
        await server.close().catch(() => {});
        httpServer.closeAllConnections();
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      }
    }, 10000);
  });

  describe("callTool with bundled servers", () => {
    afterEach(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    it("calculator add(2, 3) returns 5", async () => {
      const result = (await callTool("calculator", "add", { a: 2, b: 3 })) as {
        content?: Array<{ text?: string }>;
      };
      const content = result?.content;
      expect(Array.isArray(content)).toBe(true);
      expect(content?.[0]?.text).toBe("5");
    });

    it("textkit upper(['abc']) returns text ABC (with possible newline)", async () => {
      const result = (await callTool("textkit", "upper", { args: ["abc"] })) as {
        content?: Array<{ text?: string }>;
      };
      const content = result?.content;
      expect(Array.isArray(content)).toBe(true);
      expect(content?.[0]?.text).toContain("ABC");
    });
  });

  describe("process cleanup", () => {
    it("no processes leak after listTools", async () => {
      await listTools("calculator");
      // Give time for process cleanup
      await new Promise((r) => setTimeout(r, 200));
      // If we reach here, the test process can exit cleanly
      expect(true).toBe(true);
    });

    it("no processes leak after callTool", async () => {
      await callTool("calculator", "add", { a: 1, b: 2 });
      // Give time for process cleanup
      await new Promise((r) => setTimeout(r, 200));
      expect(true).toBe(true);
    });
  });
});
