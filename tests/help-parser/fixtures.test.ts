import { describe, it, expect } from "vitest";
import { parseHelp } from "../../src/lib/help-parser";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadFixture(name: string): string {
  return readFileSync(join(__dirname, "../../src/data/samples", name), "utf-8");
}

describe("help-parser fixtures", () => {
  describe("ffmpeg.txt", () => {
    const result = parseHelp(loadFixture("ffmpeg.txt"));

    it("parses tool name correctly", () => {
      expect(result.toolName).toBe("ffmpeg");
    });

    it("parses description", () => {
      expect(result.description).toBe("Universal media converter");
    });

    it("parses expected number of flags", () => {
      // Hand-counted from the fixture: 43 flag lines.
      expect(result.flags.length).toBe(43);
    });

    it("parses no subcommands", () => {
      expect(result.subcommands.length).toBe(0);
    });

    it("records version/config lines in unparsedLines", () => {
      // 10 version/metadata lines + 9 section headers + 3 -h variants +
      // "See man ffmpeg" + the per-stream prose line + "Exiting..." = 25.
      expect(result.unparsedLines.length).toBe(25);
      expect(result.unparsedLines[0]).toContain("ffmpeg version");
      expect(result.unparsedLines[1]).toContain("built with gcc");
      expect(result.unparsedLines[2]).toContain("configuration:");
    });

    it("does not double-count the description line as unparsed", () => {
      expect(result.unparsedLines).not.toContain("Universal media converter");
    });

    it("parses common flags correctly", () => {
      const helpFlag = result.flags.find((f) => f.names.includes("-h"));
      expect(helpFlag).toBeDefined();
      expect(helpFlag?.takesValue).toBe(false);
      // ffmpeg's own text literally reads "-h  -- print basic options".
      expect(helpFlag?.description).toBe("-- print basic options");

      const licenseFlag = result.flags.find((f) => f.names.includes("-L"));
      expect(licenseFlag).toBeDefined();
      expect(licenseFlag?.takesValue).toBe(false);
      expect(licenseFlag?.description).toBe("show license");
    });

    it("parses flags with values correctly", () => {
      const flag = result.flags.find((f) => f.names.includes("-t"));
      expect(flag).toBeDefined();
      expect(flag?.takesValue).toBe(true);
      expect(flag?.valueName).toBe("duration");
    });

    it("parses bracket-modified flags", () => {
      const flag = result.flags.find((f) => f.names.includes("-metadata"));
      expect(flag).toBeDefined();
      expect(flag?.takesValue).toBe(true);
      expect(flag?.valueName).toBe("key=value");
    });
  });

  describe("git.txt", () => {
    const result = parseHelp(loadFixture("git.txt"));

    it("parses tool name correctly", () => {
      expect(result.toolName).toBe("git");
    });

    it("has no description", () => {
      expect(result.description).toBe("");
    });

    it("parses no top-level flags", () => {
      // git's flags only appear inside the usage block, not as flag lines.
      expect(result.flags.length).toBe(0);
    });

    it("parses expected number of subcommands", () => {
      // Hand-counted from the group lists in the fixture.
      expect(result.subcommands.length).toBe(22);
    });

    it("records usage continuations and footer lines as unparsed", () => {
      // 4 usage-continuation lines + "These are common..." header + 4 footer lines.
      expect(result.unparsedLines.length).toBe(9);
    });

    it("parses subcommands correctly", () => {
      const subcommandNames = result.subcommands.map((s) => s.name);
      expect(subcommandNames).toContain("clone");
      expect(subcommandNames).toContain("add");
      expect(subcommandNames).toContain("commit");
      expect(subcommandNames).toContain("push");
    });

    it("subcommands have descriptions", () => {
      const clone = result.subcommands.find((s) => s.name === "clone");
      expect(clone?.description).toContain("Clone a repository");
    });
  });

  describe("curl.txt", () => {
    const result = parseHelp(loadFixture("curl.txt"));

    it("parses tool name correctly", () => {
      expect(result.toolName).toBe("curl");
    });

    it("has no description", () => {
      expect(result.description).toBe("");
    });

    it("parses expected number of flags", () => {
      // 258 flag lines in the fixture; all but the two single-character
      // non-alphanumeric flags (-: and -#) parse.
      expect(result.flags.length).toBe(256);
    });

    it("parses no subcommands", () => {
      expect(result.subcommands.length).toBe(0);
    });

    it("records only the two unusual flags as unparsed", () => {
      expect(result.unparsedLines.length).toBe(2);
      expect(result.unparsedLines[0]).toContain("--next");
      expect(result.unparsedLines[1]).toContain("--progress-bar");
    });

    it("parses common flags correctly", () => {
      const helpFlag = result.flags.find((f) => f.names.includes("-h"));
      expect(helpFlag).toBeDefined();
      // curl's -h takes an optional <category> value.
      expect(helpFlag?.takesValue).toBe(true);
      expect(helpFlag?.valueName).toBe("category");
      expect(helpFlag?.description).toContain("Get help");

      const verboseFlag = result.flags.find((f) => f.names.includes("-v"));
      expect(verboseFlag).toBeDefined();
      expect(verboseFlag?.takesValue).toBe(false);
      expect(verboseFlag?.description).toContain("more talkative");
    });

    it("parses flags with values correctly", () => {
      const flag = result.flags.find((f) => f.names.includes("-o"));
      expect(flag).toBeDefined();
      expect(flag?.takesValue).toBe(true);
      expect(flag?.valueName).toBe("file");
    });

    it("parses multi-word value placeholders", () => {
      const flag = result.flags.find((f) => f.names.includes("--alt-svc"));
      expect(flag).toBeDefined();
      expect(flag?.takesValue).toBe(true);
      expect(flag?.valueName).toBe("file name");
    });
  });
});
