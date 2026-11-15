import { describe, it, expect, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

describe("calculator MCP server", () => {
  let client: Client | undefined;

  afterEach(async () => {
    if (client) {
      await client.close();
    }
  });

  const getTextContent = (content: unknown): string => {
    const arr = Array.isArray(content) ? content : [];
    const first = arr[0] as Record<string, unknown>;
    return (first?.text as string) ?? "";
  };

  it("listTools returns 4 calculator tools", async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["servers/calculator/mcp-server.js"],
    });

    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await client.connect(transport);

    const response = await client.listTools();
    expect(response.tools.length).toBe(4);

    const toolNames = response.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual(["add", "divide", "multiply", "subtract"]);
  });

  it("add(2, 3) returns 5", async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["servers/calculator/mcp-server.js"],
    });

    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await client.connect(transport);

    const response = await client.callTool({
      name: "add",
      arguments: { a: 2, b: 3 },
    });

    const text = getTextContent(response.content);
    expect(text).toBe("5");
  });

  it("subtract(10, 3) returns 7", async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["servers/calculator/mcp-server.js"],
    });

    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await client.connect(transport);

    const response = await client.callTool({
      name: "subtract",
      arguments: { a: 10, b: 3 },
    });

    const text = getTextContent(response.content);
    expect(text).toBe("7");
  });

  it("multiply(4, 5) returns 20", async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["servers/calculator/mcp-server.js"],
    });

    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await client.connect(transport);

    const response = await client.callTool({
      name: "multiply",
      arguments: { a: 4, b: 5 },
    });

    const text = getTextContent(response.content);
    expect(text).toBe("20");
  });

  it("divide(10, 2) returns 5", async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["servers/calculator/mcp-server.js"],
    });

    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await client.connect(transport);

    const response = await client.callTool({
      name: "divide",
      arguments: { a: 10, b: 2 },
    });

    const text = getTextContent(response.content);
    expect(text).toBe("5");
  });

  it("divide(1, 0) returns isError with division by zero message", async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["servers/calculator/mcp-server.js"],
    });

    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await client.connect(transport);

    const response = await client.callTool({
      name: "divide",
      arguments: { a: 1, b: 0 },
    });

    const text = getTextContent(response.content);
    expect(text).toContain("Division by zero");
    expect(response.isError).toBe(true);
  });

  it("non-number inputs return isError", async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["servers/calculator/mcp-server.js"],
    });

    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await client.connect(transport);

    const response = await client.callTool({
      name: "add",
      arguments: { a: "not a number", b: 3 } as unknown as Record<string, number>,
    });

    expect(response.isError).toBe(true);
    const text = getTextContent(response.content);
    expect(text.length).toBeGreaterThan(0);
  });
});
