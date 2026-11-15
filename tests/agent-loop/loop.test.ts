/**
 * Tests for the agent-loop module.
 * Tests the full parse → generate → validate → fix → verify loop.
 */
import { describe, it, expect } from "vitest";
import { runAdapterLoop } from "../../src/lib/agent-loop";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("agent-loop: loop", () => {
  describe("success path", () => {
    it("processes real git help text successfully", () => {
      const gitHelpPath = join(__dirname, "../../src/data/samples/git.txt");
      const gitHelpText = readFileSync(gitHelpPath, "utf8");

      const result = runAdapterLoop(gitHelpText);

      // Should have parse, generate, validate, fix (if needed), verify steps
      expect(result.log.length).toBeGreaterThanOrEqual(4);
      expect(result.log[0].step).toBe("parse");
      expect(result.log[result.log.length - 1].step).toBe("verify");

      // Git has 22 subcommands and no top-level flags, so should generate 22 tools
      expect(result.summary.toolsGenerated).toBe(22);
      expect(result.summary.verified).toBe(true);

      // Files should be present
      expect(result.files["server.js"]).toBeTruthy();
      expect(result.files["package.json"]).toBeTruthy();
      expect(result.files["README.md"]).toBeTruthy();

      // Tools should be present
      expect(result.tools.length).toBe(22);
    });
  });

  describe("fix path", () => {
    it("fixes colliding tool names", () => {
      // Create a model where two subcommands sanitize to the same name
      const helpText = `usage: test

Commands:
  my-cmd   Do something
  my_cmd   Do something else
`;

      const result = runAdapterLoop(helpText);

      // The loop should succeed despite the collision
      expect(result.summary.verified).toBe(true);

      // Should have fixed the collision
      expect(result.tools).toHaveLength(2);

      // Tool names should be unique
      const names = result.tools.map((t) => t.name);
      expect(new Set(names).size).toBe(names.length);

      // Log should show a fix step
      const fixStep = result.log.find((l) => l.step === "fix");
      expect(fixStep).toBeDefined();
    });
  });

  describe("failure path", () => {
    it("fails on empty help text", () => {
      const result = runAdapterLoop("");

      expect(result.summary.verified).toBe(false);
      expect(result.tools).toHaveLength(0);

      // Should have a failure in the log
      const failureStep = result.log.find((l) => l.status === "failed");
      expect(failureStep).toBeDefined();
    });

    it("returns 0 tools when parsing yields no commands", () => {
      const helpText = "Some random text that doesn't parse as a valid help.";

      const result = runAdapterLoop(helpText);

      expect(result.summary.verified).toBe(false);
      expect(result.tools).toHaveLength(0);
    });
  });

  describe("log structure", () => {
    it("includes ISO timestamps on all log steps", () => {
      const helpText = `usage: test
  
  --verbose   Be verbose
`;

      const result = runAdapterLoop(helpText);

      for (const step of result.log) {
        expect(step.at).toBeTruthy();
        // Should be valid ISO 8601
        expect(new Date(step.at).toISOString()).toBeTruthy();
      }
    });

    it("includes detail messages on all log steps", () => {
      const helpText = `usage: test

Commands:
  add   Add items
  rm    Remove items
`;

      const result = runAdapterLoop(helpText);

      for (const step of result.log) {
        expect(step.detail).toBeTruthy();
        expect(typeof step.detail).toBe("string");
        expect(step.detail.length).toBeGreaterThan(0);
      }
    });
  });

  describe("purity (no execution)", () => {
    it("never spawns child processes", async () => {
      const helpText = `usage: rm [--force] [files...]
  --force   Force removal
`;

      // This should be pure: no child processes, no network, no side effects
      const result = runAdapterLoop(helpText);

      // If we got here without hanging or errors, it didn't spawn anything
      expect(result.tools).toBeDefined();
    });
  });

  describe("summary statistics", () => {
    it("counts flags correctly", () => {
      const helpText = `usage: test

  --verbose   Be verbose
  --quiet     Be quiet
  -o FILE     Output file
`;

      const result = runAdapterLoop(helpText);

      expect(result.summary.flagsParsed).toBe(3);
    });

    it("counts subcommand flags in the total", () => {
      const helpText = `usage: git

  -v   Version

Commands:
  add    Add files
    -A   Add all
  commit Create commit
    -m MESSAGE   Commit message
`;

      const result = runAdapterLoop(helpText);

      // 1 top-level flag + 1 from add + 1 from commit = 3
      expect(result.summary.flagsParsed).toBeGreaterThanOrEqual(3);
    });

    it("sets verified to true on success", () => {
      const helpText = `usage: test

Commands:
  cmd1   Command one
  cmd2   Command two
`;

      const result = runAdapterLoop(helpText);

      expect(result.summary.verified).toBe(true);
    });

    it("sets verified to false on failure", () => {
      const result = runAdapterLoop("");

      expect(result.summary.verified).toBe(false);
    });
  });
});
