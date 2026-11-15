import { describe, it, expect } from "vitest";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

describe("textkit CLI", () => {
  it("wc counts words, chars, lines for 'hello world'", async () => {
    const { stdout } = await execFileAsync("node", ["servers/textkit/cli.js", "wc", "hello world"]);
    const lines = stdout.trim().split("\n");
    expect(lines).toContain("words: 2");
    expect(lines).toContain("chars: 11");
    expect(lines).toContain("lines: 1");
  });

  it("reverse 'abc' produces 'cba'", async () => {
    const { stdout } = await execFileAsync("node", ["servers/textkit/cli.js", "reverse", "abc"]);
    expect(stdout.trim()).toBe("cba");
  });

  it("reverse with --upper flag uppercases", async () => {
    const { stdout } = await execFileAsync("node", [
      "servers/textkit/cli.js",
      "reverse",
      "--upper",
      "abc",
    ]);
    expect(stdout.trim()).toBe("CBA");
  });

  it("flags work after the positional text too", async () => {
    const { stdout: rev } = await execFileAsync("node", [
      "servers/textkit/cli.js",
      "reverse",
      "abc",
      "--upper",
    ]);
    expect(rev.trim()).toBe("CBA");
    const { stdout: slug } = await execFileAsync("node", [
      "servers/textkit/cli.js",
      "slugify",
      "Hello World!",
      "--separator",
      "_",
    ]);
    expect(slug.trim()).toBe("hello_world");
  });

  it("supports --flag=value form", async () => {
    const { stdout } = await execFileAsync("node", [
      "servers/textkit/cli.js",
      "slugify",
      "Hello World!",
      "--separator=_",
    ]);
    expect(stdout.trim()).toBe("hello_world");
  });

  it("unknown flag after the text exits with error", async () => {
    try {
      await execFileAsync("node", ["servers/textkit/cli.js", "reverse", "abc", "--bogus"]);
      expect.fail("Should have thrown");
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException & { status: number; stderr: string };
      expect(err.status).not.toBe(0);
      expect(err.stderr).toContain("unknown flag");
    }
  });

  it("slugify 'Hello World!' produces 'hello-world'", async () => {
    const { stdout } = await execFileAsync("node", [
      "servers/textkit/cli.js",
      "slugify",
      "Hello World!",
    ]);
    expect(stdout.trim()).toBe("hello-world");
  });

  it("slugify with --separator '_' uses custom separator", async () => {
    const { stdout } = await execFileAsync("node", [
      "servers/textkit/cli.js",
      "slugify",
      "--separator",
      "_",
      "Hello World!",
    ]);
    expect(stdout.trim()).toBe("hello_world");
  });

  it("upper 'abc' produces 'ABC'", async () => {
    const { stdout } = await execFileAsync("node", ["servers/textkit/cli.js", "upper", "abc"]);
    expect(stdout.trim()).toBe("ABC");
  });

  it("wc with --words flag prints only word count", async () => {
    const { stdout } = await execFileAsync("node", [
      "servers/textkit/cli.js",
      "wc",
      "--words",
      "hello world",
    ]);
    expect(stdout.trim()).toBe("words: 2");
  });

  it("wc with --chars flag prints only char count", async () => {
    const { stdout } = await execFileAsync("node", [
      "servers/textkit/cli.js",
      "wc",
      "--chars",
      "hello world",
    ]);
    expect(stdout.trim()).toBe("chars: 11");
  });

  it("wc with --lines flag prints only line count", async () => {
    const { stdout } = await execFileAsync("node", [
      "servers/textkit/cli.js",
      "wc",
      "--lines",
      "hello world",
    ]);
    expect(stdout.trim()).toBe("lines: 1");
  });

  it("unknown command exits with error", async () => {
    try {
      await execFileAsync("node", ["servers/textkit/cli.js", "unknown", "text"]);
      expect.fail("Should have thrown");
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException & { status: number; stderr: string };
      expect(err.status).not.toBe(0);
      expect(err.stderr).toContain("unknown command");
    }
  });

  it("missing text exits with error", async () => {
    try {
      await execFileAsync("node", ["servers/textkit/cli.js", "wc"]);
      expect.fail("Should have thrown");
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException & { status: number; stderr: string };
      expect(err.status).not.toBe(0);
      expect(err.stderr).toContain("text required");
    }
  });
});
