import { describe, it, expect } from "vitest";
import { countTokens, measureTools } from "../../src/lib/tokens/counter";
import type { MCPToolSchema } from "../../src/lib/tokens";

describe("countTokens", () => {
  it("should count tokens deterministically", () => {
    const text = "Hello, world!";
    const count1 = countTokens(text);
    const count2 = countTokens(text);
    expect(count1).toBe(count2);
  });

  it("should return a known token count for a fixed string", () => {
    // This test verifies the exact token count for a known string.
    // We use a short string to make verification practical.
    const text = "test";
    const count = countTokens(text);
    // The cl100k tokenizer encodes "test" as 1 token
    expect(count).toBe(1);
  });

  it("should handle empty string", () => {
    const count = countTokens("");
    expect(count).toBe(0);
  });

  it("should increase token count with longer text", () => {
    const short = countTokens("hello");
    const medium = countTokens("hello world");
    const long = countTokens("hello world this is a longer string");
    expect(short).toBeLessThan(medium);
    expect(medium).toBeLessThan(long);
  });
});

describe("measureTools", () => {
  it("should measure an empty tool set", () => {
    const result = measureTools([]);
    expect(result.perTool).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("should measure a single tool", () => {
    const tools: MCPToolSchema[] = [
      {
        name: "test_tool",
        description: "A test tool",
        inputSchema: { type: "object" },
      },
    ];
    const result = measureTools(tools);
    expect(result.perTool).toHaveLength(1);
    expect(result.perTool[0].name).toBe("test_tool");
    expect(result.perTool[0].tokens).toBeGreaterThan(0);
    expect(result.total).toBe(result.perTool[0].tokens);
  });

  it("should measure multiple tools", () => {
    const tools: MCPToolSchema[] = [
      {
        name: "tool1",
        description: "First tool",
        inputSchema: { type: "object" },
      },
      {
        name: "tool2",
        description: "Second tool with a longer description",
        inputSchema: { type: "object", properties: { x: { type: "string" } } },
      },
    ];
    const result = measureTools(tools);
    expect(result.perTool).toHaveLength(2);
    expect(result.perTool[0].name).toBe("tool1");
    expect(result.perTool[1].name).toBe("tool2");
    expect(result.total).toBe(result.perTool[0].tokens + result.perTool[1].tokens);
  });

  it("should be deterministic", () => {
    const tools: MCPToolSchema[] = [
      {
        name: "deterministic_tool",
        description: "Test determinism",
        inputSchema: { type: "object", properties: { param: { type: "string" } } },
      },
    ];
    const result1 = measureTools(tools);
    const result2 = measureTools(tools);
    expect(result1.total).toBe(result2.total);
    expect(result1.perTool).toEqual(result2.perTool);
  });
});
