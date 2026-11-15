import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { buildTrimmedConfig } from "../../src/lib/tokens/trim";
import type { MCPToolSchema } from "../../src/lib/tokens";

describe("buildTrimmedConfig", () => {
  const sampleTools: MCPToolSchema[] = [
    {
      name: "tool_a",
      description: "First tool\nMulti-line description",
      inputSchema: { type: "object", properties: { x: { type: "string" } } },
    },
    {
      name: "tool_b",
      description: "Second tool",
      inputSchema: { type: "object", properties: { y: { type: "number" } } },
    },
    {
      name: "tool_c",
      description: "Third tool\nWith details",
      inputSchema: { type: "object" },
    },
  ];

  it("should build a full config", () => {
    const result = buildTrimmedConfig(sampleTools, "full");
    expect(result.config).toEqual({ tools: sampleTools });
    expect(result.saved).toBe(0);
    expect(result.tokens).toBeGreaterThan(0);
  });

  it("should build a names-only config", () => {
    const result = buildTrimmedConfig(sampleTools, "names-only");
    const config = result.config as { tools: MCPToolSchema[] };
    expect(config.tools).toHaveLength(3);
    expect(config.tools[0].name).toBe("tool_a");
    // Should only include first line of description
    expect(config.tools[0].description).toBe("First tool");
    // Input schema should be empty
    expect(config.tools[0].inputSchema).toEqual({});
    expect(result.saved).toBeGreaterThan(0);
  });

  it("should build a trimmed config with picked names", () => {
    const picked = ["tool_a", "tool_c"];
    const result = buildTrimmedConfig(sampleTools, "trimmed", picked);
    const config = result.config as { tools: MCPToolSchema[] };
    expect(config.tools).toHaveLength(2);
    expect(config.tools[0].name).toBe("tool_a");
    expect(config.tools[1].name).toBe("tool_c");
    expect(result.saved).toBeGreaterThan(0);
  });

  it("should throw if trimmed mode lacks pickedNames", () => {
    expect(() => buildTrimmedConfig(sampleTools, "trimmed")).toThrow(
      'pickedNames is required when mode is "trimmed"',
    );
  });

  it("should show token savings for names-only", () => {
    const fullResult = buildTrimmedConfig(sampleTools, "full");
    const namesOnlyResult = buildTrimmedConfig(sampleTools, "names-only");
    expect(namesOnlyResult.tokens).toBeLessThan(fullResult.tokens);
    expect(namesOnlyResult.saved).toBe(fullResult.tokens - namesOnlyResult.tokens);
  });

  it("should show token savings for trimmed", () => {
    const fullResult = buildTrimmedConfig(sampleTools, "full");
    const trimmedResult = buildTrimmedConfig(sampleTools, "trimmed", ["tool_a"]);
    expect(trimmedResult.tokens).toBeLessThan(fullResult.tokens);
    expect(trimmedResult.saved).toBe(fullResult.tokens - trimmedResult.tokens);
  });

  it("property: adding a tool never reduces total token count", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.stringMatching(/^[a-z_]{1,10}$/),
            description: fc.stringMatching(/^[a-z\s]{1,30}$/),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (toolDefs) => {
          // Filter out duplicates by name
          const uniqueDefs = Array.from(new Map(toolDefs.map((t) => [t.name, t])).values());
          const tools: MCPToolSchema[] = uniqueDefs.map((def) => ({
            name: def.name,
            description: def.description,
            inputSchema: { type: "object" },
          }));

          // Measure with increasing subsets
          for (let i = 1; i <= tools.length; i++) {
            const subset = tools.slice(0, i);
            const result = buildTrimmedConfig(subset, "full");
            expect(result.tokens).toBeGreaterThanOrEqual(0);

            if (i > 1) {
              const prevSubset = tools.slice(0, i - 1);
              const prevResult = buildTrimmedConfig(prevSubset, "full");
              // Adding a tool never reduces the total
              expect(result.tokens).toBeGreaterThanOrEqual(prevResult.tokens);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
