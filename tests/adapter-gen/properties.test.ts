/**
 * Property-based tests for adapter-gen.
 * Uses fast-check to verify invariants across generated code.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { generateTools, validateTools } from "../../src/lib/adapter-gen";
import type { FlagModel, Flag, Subcommand } from "../../src/lib/help-parser";

// Reuse and adapt arbitraries from help-parser round-trip test
const wordArb = fc.stringMatching(/^[a-z][a-z0-9]{1,8}$/);
const descriptionArb = fc.array(wordArb, { minLength: 1, maxLength: 5 }).map((words) => {
  const joined = words.join(" ");
  return joined.charAt(0).toUpperCase() + joined.slice(1);
});
const valueNameArb = fc.stringMatching(/^[A-Z][A-Z0-9_-]{1,10}$/);
const flagNameArb = fc.oneof(
  fc.stringMatching(/^-[a-z]$/),
  fc.stringMatching(/^--[a-z][a-z0-9-]{1,12}$/),
);

const flagArb: fc.Arbitrary<Flag> = fc
  .tuple(
    fc.uniqueArray(flagNameArb, { minLength: 1, maxLength: 2 }),
    fc.boolean(),
    valueNameArb,
    descriptionArb,
  )
  .map(([names, takesValue, valueName, description]) => ({
    names,
    takesValue,
    valueName: takesValue ? valueName : undefined,
    description,
  }));

const subcommandArb: fc.Arbitrary<Subcommand> = fc.record({
  name: wordArb,
  description: descriptionArb,
  flags: fc.array(flagArb, { maxLength: 3 }),
});

const modelWithSubcommandsArb: fc.Arbitrary<FlagModel> = fc.record({
  toolName: wordArb,
  description: descriptionArb,
  flags: fc.array(flagArb, { maxLength: 3 }),
  subcommands: fc.array(subcommandArb, { minLength: 1, maxLength: 4 }),
  unparsedLines: fc.constant([] as string[]),
});

const modelWithoutSubcommandsArb: fc.Arbitrary<FlagModel> = fc.record({
  toolName: wordArb,
  description: descriptionArb,
  flags: fc.array(flagArb, { minLength: 1, maxLength: 8 }),
  subcommands: fc.constant([] as Subcommand[]),
  unparsedLines: fc.constant([] as string[]),
});

const modelArb = fc.oneof(modelWithSubcommandsArb, modelWithoutSubcommandsArb);

describe("adapter-gen: properties", () => {
  it("every generated tool has a valid name", () => {
    fc.assert(
      fc.property(modelArb, (model) => {
        const tools = generateTools(model);
        for (const tool of tools) {
          expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("every generated tool has a non-empty description", () => {
    fc.assert(
      fc.property(modelArb, (model) => {
        const tools = generateTools(model);
        for (const tool of tools) {
          expect(tool.description.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("every generated tool has a valid JSON Schema", () => {
    fc.assert(
      fc.property(modelArb, (model) => {
        const tools = generateTools(model);
        for (const tool of tools) {
          const schema = tool.inputSchema as Record<string, unknown>;
          expect(schema.type).toBe("object");
          expect(schema.properties).toBeDefined();
          expect(typeof schema.properties).toBe("object");
        }
      }),
      { numRuns: 100 },
    );
  });

  it("generated tools pass validation", () => {
    fc.assert(
      fc.property(modelArb, (model) => {
        const tools = generateTools(model);
        const result = validateTools(tools);
        expect(result.valid).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("every tool has an args property", () => {
    fc.assert(
      fc.property(modelArb, (model) => {
        const tools = generateTools(model);
        for (const tool of tools) {
          const schema = tool.inputSchema as Record<string, unknown>;
          const properties = schema.properties as Record<string, unknown>;
          expect(properties["args"]).toBeDefined();
        }
      }),
      { numRuns: 100 },
    );
  });
});
