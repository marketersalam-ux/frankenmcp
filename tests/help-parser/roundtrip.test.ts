import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { parseHelp } from "../../src/lib/help-parser";
import type { FlagModel, Flag, Subcommand } from "../../src/lib/help-parser";

/**
 * Property-based round-trip test (task 8): generate a FlagModel, render it
 * as help text in the canonical format the parser accepts, parse it back,
 * and assert the model is unchanged (modulo whitespace trimming).
 *
 * This test caught real parser bugs during development: the first version
 * of the parser hardcoded tool names (ffmpeg/git/curl) in its skip rules
 * and duplicated its description-extraction block; the round-trip
 * discipline forced a clean, general rewrite.
 */

// --- Arbitraries (constrained to what the canonical format can express) ---

const wordArb = fc.stringMatching(/^[a-z][a-z0-9]{1,8}$/);
const descriptionArb = fc.array(wordArb, { minLength: 2, maxLength: 6 }).map((words) => {
  const joined = words.join(" ");
  return joined.charAt(0).toUpperCase() + joined.slice(1);
});
const valueNameArb = fc.oneof(
  fc.stringMatching(/^[A-Z][A-Z0-9_-]{1,10}$/),
  fc.stringMatching(/^[a-z][a-z0-9]{1,8}$/),
);
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

const modelArb: fc.Arbitrary<FlagModel> = fc.record({
  toolName: wordArb,
  description: fc.oneof(fc.constant(""), descriptionArb),
  flags: fc.array(flagArb, { maxLength: 8 }),
  subcommands: fc.array(subcommandArb, { maxLength: 4 }),
  unparsedLines: fc.constant([] as string[]),
});

// --- Renderer: FlagModel -> canonical help text ---

function renderFlag(flag: Flag): string {
  const names = flag.names.join(", ");
  const value = flag.takesValue && flag.valueName ? ` <${flag.valueName}>` : "";
  return `  ${names}${value}  ${flag.description}`;
}

function renderHelp(model: FlagModel): string {
  const lines: string[] = [];
  if (model.description !== "") lines.push(model.description);
  lines.push(`Usage: ${model.toolName} [options]`);
  lines.push("");
  for (const flag of model.flags) lines.push(renderFlag(flag));
  if (model.subcommands.length > 0) {
    lines.push("");
    lines.push("Commands:");
    for (const sub of model.subcommands) {
      lines.push(`  ${sub.name}  ${sub.description}`);
      for (const flag of sub.flags) lines.push(renderFlag(flag));
    }
  }
  return lines.join("\n");
}

// --- Properties ---

describe("help-parser round-trip", () => {
  it("parses rendered help back to the same model", () => {
    fc.assert(
      fc.property(modelArb, (model) => {
        const text = renderHelp(model);
        const parsed = parseHelp(text);
        expect(parsed).toEqual(model);
      }),
      { numRuns: 200 },
    );
  });

  it("never produces unparsed lines from canonical help text", () => {
    fc.assert(
      fc.property(modelArb, (model) => {
        const parsed = parseHelp(renderHelp(model));
        expect(parsed.unparsedLines).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  it("is deterministic: same input, same output", () => {
    fc.assert(
      fc.property(modelArb, (model) => {
        const text = renderHelp(model);
        expect(parseHelp(text)).toEqual(parseHelp(text));
      }),
      { numRuns: 100 },
    );
  });
});
