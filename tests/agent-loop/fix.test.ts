/**
 * Unit tests for applyFixStrategies (the agent loop's fix step).
 * The generator already dedupes and sanitizes names, so these paths are
 * a safety net — tested directly with hand-built broken tools.
 */
import { describe, it, expect } from "vitest";
import { applyFixStrategies } from "../../src/lib/agent-loop";
import { validateTools } from "../../src/lib/adapter-gen";
import type { MCPToolSchema } from "../../src/lib/tokens/types";

function tool(name: string, description = "Do a thing"): MCPToolSchema {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      properties: {
        args: { type: "array", items: { type: "string" } },
      },
      additionalProperties: false,
    },
  };
}

describe("agent-loop: applyFixStrategies", () => {
  it("dedupes colliding names with numeric suffixes", () => {
    const { tools, renames } = applyFixStrategies([tool("dup"), tool("dup")]);
    expect(tools.map((t) => t.name)).toEqual(["dup", "dup_1"]);
    expect(renames.get("dup")).toBe("dup_1");
    expect(validateTools(tools).valid).toBe(true);
  });

  it("sanitizes names that break the pattern", () => {
    const { tools } = applyFixStrategies([tool("Bad Name!"), tool("9lives"), tool("---")]);
    expect(tools.map((t) => t.name)).toEqual(["bad_name", "t_9lives", "t_"]);
    expect(validateTools(tools).valid).toBe(true);
  });

  it("truncates descriptions over 500 chars", () => {
    const { tools } = applyFixStrategies([tool("ok", "x".repeat(600))]);
    expect(tools[0].description.length).toBe(500);
    expect(tools[0].description.endsWith("...")).toBe(true);
  });

  it("drops properties with empty names", () => {
    const broken = tool("ok");
    (broken.inputSchema.properties as Record<string, unknown>)[""] = {
      type: "string",
      description: "empty",
    };
    const { tools } = applyFixStrategies([broken]);
    expect(Object.keys(tools[0].inputSchema.properties as object)).not.toContain("");
  });

  it("does not mutate its input", () => {
    const input = [tool("Bad Name!", "x".repeat(600))];
    const snapshot = JSON.stringify(input);
    applyFixStrategies(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
