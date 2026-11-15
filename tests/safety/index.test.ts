import { describe, it, expect } from "vitest";
import { reviewSafety, hasSafetyIssues, NO_ISSUES_MESSAGE } from "../../src/lib/safety";
import type { FlagModel } from "../../src/lib/help-parser";

describe("reviewSafety", () => {
  it("should return empty list for a clean model", () => {
    const model: FlagModel = {
      toolName: "safe_tool",
      description: "A safe tool",
      flags: [
        {
          names: ["--input"],
          takesValue: true,
          valueName: "TEXT",
          description: "Input text",
        },
      ],
      subcommands: [],
      unparsedLines: [],
    };
    const flags = reviewSafety(model);
    expect(flags).toEqual([]);
  });

  it("should flag destructive patterns in flag names", () => {
    const model: FlagModel = {
      toolName: "risky_tool",
      description: "A risky tool",
      flags: [
        {
          names: ["--delete"],
          takesValue: true,
          valueName: "FILE",
          description: "Delete a file",
        },
      ],
      subcommands: [],
      unparsedLines: [],
    };
    const flags = reviewSafety(model);
    expect(flags.length).toBeGreaterThan(0);
    const destructiveFlag = flags.find((f) => f.severity === "warn");
    expect(destructiveFlag).toBeDefined();
    expect(destructiveFlag?.option).toContain("delete");
  });

  it("should flag destructive patterns in descriptions", () => {
    const model: FlagModel = {
      toolName: "tool",
      description: "Tool description",
      flags: [
        {
          names: ["--execute"],
          takesValue: true,
          valueName: "COMMAND",
          description: "Force execution without confirmation",
        },
      ],
      subcommands: [],
      unparsedLines: [],
    };
    const flags = reviewSafety(model);
    const destructiveFlag = flags.find((f) => f.severity === "warn" && f.option === "--execute");
    expect(destructiveFlag).toBeDefined();
  });

  it("should flag path flags", () => {
    const model: FlagModel = {
      toolName: "file_tool",
      description: "File tool",
      flags: [
        {
          names: ["--output"],
          takesValue: true,
          valueName: "FILE",
          description: "Output file",
        },
      ],
      subcommands: [],
      unparsedLines: [],
    };
    const flags = reviewSafety(model);
    const pathFlag = flags.find((f) => f.severity === "info" && f.option === "--output");
    expect(pathFlag).toBeDefined();
    expect(pathFlag?.message).toContain("Path flag");
  });

  it("should flag network/credential flags in names", () => {
    const model: FlagModel = {
      toolName: "net_tool",
      description: "Network tool",
      flags: [
        {
          names: ["--password"],
          takesValue: true,
          valueName: "STRING",
          description: "Password for authentication",
        },
      ],
      subcommands: [],
      unparsedLines: [],
    };
    const flags = reviewSafety(model);
    const credFlag = flags.find((f) => f.severity === "info" && f.option === "--password");
    expect(credFlag).toBeDefined();
    expect(credFlag?.message).toContain("Network or credential");
  });

  it("should flag network/credential flags in value names", () => {
    const model: FlagModel = {
      toolName: "net_tool",
      description: "Network tool",
      flags: [
        {
          names: ["--connect"],
          takesValue: true,
          valueName: "URL",
          description: "Connection endpoint",
        },
      ],
      subcommands: [],
      unparsedLines: [],
    };
    const flags = reviewSafety(model);
    const credFlag = flags.find((f) => f.severity === "info" && f.option === "--connect");
    expect(credFlag).toBeDefined();
    expect(credFlag?.message).toContain("Network or credential");
  });

  it("should allow one flag to produce multiple safety flags", () => {
    const model: FlagModel = {
      toolName: "complex_tool",
      description: "Complex tool",
      flags: [
        {
          names: ["--force-delete"],
          takesValue: true,
          valueName: "FILE",
          description: "Force delete without confirmation",
        },
      ],
      subcommands: [],
      unparsedLines: [],
    };
    const flags = reviewSafety(model);
    // Should have at least 3 flags: destructive (from name and description) and path
    expect(flags.length).toBeGreaterThanOrEqual(2);
    const forceDeleteFlags = flags.filter((f) => f.option.includes("force-delete"));
    expect(forceDeleteFlags.length).toBeGreaterThan(1);
  });

  it("should check flags in subcommands", () => {
    const model: FlagModel = {
      toolName: "git",
      description: "Version control",
      flags: [],
      subcommands: [
        {
          name: "reset",
          description: "Reset HEAD",
          flags: [
            {
              names: ["--hard"],
              takesValue: false,
              description: "Discard all changes and reset working directory",
            },
          ],
        },
      ],
      unparsedLines: [],
    };
    const flags = reviewSafety(model);
    expect(flags.length).toBeGreaterThan(0);
    // Subcommand flags are reviewed with the subcommand name included, so
    // "reset --hard" is caught as a destructive phrase.
    const resetFlag = flags.find((f) => f.option === "reset --hard");
    expect(resetFlag).toBeDefined();
    expect(resetFlag?.severity).toBe("warn");
    expect(resetFlag?.message).toContain("reset --hard");
  });

  it("should not flag substrings: --form is not rm, --hardware is not hard", () => {
    const model: FlagModel = {
      toolName: "tool",
      description: "Tool description",
      flags: [
        { names: ["--form"], takesValue: true, valueName: "DATA", description: "Form data" },
        { names: ["--hardware"], takesValue: false, description: "Hardware info" },
        { names: ["--support"], takesValue: false, description: "Support info" },
      ],
      subcommands: [],
      unparsedLines: [],
    };
    expect(reviewSafety(model)).toEqual([]);
  });

  it("should not flag --clean or --reset alone (only the phrases count)", () => {
    const model: FlagModel = {
      toolName: "tool",
      description: "Tool description",
      flags: [
        { names: ["--clean"], takesValue: false, description: "Clean the cache" },
        { names: ["--reset"], takesValue: false, description: "Reset the view" },
      ],
      subcommands: [],
      unparsedLines: [],
    };
    expect(reviewSafety(model)).toEqual([]);
  });

  it("should flag the clean --all phrase", () => {
    const model: FlagModel = {
      toolName: "tool",
      description: "Tool description",
      flags: [{ names: ["--clean"], takesValue: false, description: "Run clean --all" }],
      subcommands: [],
      unparsedLines: [],
    };
    const flags = reviewSafety(model);
    expect(flags.some((f) => f.severity === "warn" && f.message.includes("clean --all"))).toBe(
      true,
    );
  });
});

describe("hasSafetyIssues", () => {
  it("should return false for empty array", () => {
    expect(hasSafetyIssues([])).toBe(false);
  });

  it("should return true for non-empty array", () => {
    const issues = [
      {
        option: "--delete",
        severity: "warn" as const,
        message: "Destructive",
      },
    ];
    expect(hasSafetyIssues(issues)).toBe(true);
  });
});

describe("NO_ISSUES_MESSAGE", () => {
  it("should provide a constant message", () => {
    expect(NO_ISSUES_MESSAGE).toBe("No safety issues found");
  });
});
