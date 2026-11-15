import { describe, it, expect } from "vitest";
import { coerceArgValue, buildProbeArgs } from "@/lib/probe-args";

describe("coerceArgValue", () => {
  it("should return raw string for string type or missing type", () => {
    expect(coerceArgValue("hello", { type: "string" })).toBe("hello");
    expect(coerceArgValue("hello", {})).toBe("hello");
  });

  it("should coerce valid numbers", () => {
    expect(coerceArgValue("42", { type: "number" })).toBe(42);
    expect(coerceArgValue("3.14", { type: "number" })).toBe(3.14);
    expect(coerceArgValue("-10", { type: "number" })).toBe(-10);
  });

  it("should coerce valid integers", () => {
    expect(coerceArgValue("100", { type: "integer" })).toBe(100);
  });

  it("should throw for invalid numbers", () => {
    expect(() => coerceArgValue("not-a-number", { type: "number" })).toThrow(
      "Argument must be a number",
    );
    expect(() => coerceArgValue("NaN", { type: "number" })).toThrow("Argument must be a number");
  });

  it("should coerce booleans", () => {
    expect(coerceArgValue("true", { type: "boolean" })).toBe(true);
    expect(coerceArgValue("false", { type: "boolean" })).toBe(false);
    expect(coerceArgValue("True", { type: "boolean" })).toBe(false);
    expect(coerceArgValue("", { type: "boolean" })).toBe(false);
  });

  it("should parse valid JSON for object type", () => {
    const obj = coerceArgValue('{"key":"value"}', { type: "object" });
    expect(obj).toEqual({ key: "value" });
  });

  it("should parse valid JSON for array type", () => {
    const arr = coerceArgValue("[1,2,3]", { type: "array" });
    expect(arr).toEqual([1, 2, 3]);
  });

  it("should throw for invalid JSON", () => {
    expect(() => coerceArgValue("{invalid}", { type: "object" })).toThrow(
      "Argument must be valid JSON",
    );
    expect(() => coerceArgValue("not-json", { type: "array" })).toThrow(
      "Argument must be valid JSON",
    );
  });
});

describe("buildProbeArgs", () => {
  it("should return empty object for missing inputSchema", () => {
    const result = buildProbeArgs(
      { param: "value" },
      { inputSchema: {} as Record<string, unknown> },
    );
    expect(result).toEqual({});
  });

  it("should return empty object for missing properties", () => {
    const result = buildProbeArgs(
      { param: "value" },
      {
        inputSchema: {
          type: "object",
          required: [],
        } as Record<string, unknown>,
      },
    );
    expect(result).toEqual({});
  });

  it("should skip empty optional properties", () => {
    const result = buildProbeArgs(
      { optional: "", other: "value" },
      {
        inputSchema: {
          properties: {
            optional: { type: "string" },
            other: { type: "string" },
          },
          required: [],
        } as Record<string, unknown>,
      },
    );
    expect(result).toEqual({ other: "value" });
  });

  it("should include empty required properties (coerced)", () => {
    const result = buildProbeArgs(
      { required: "" },
      {
        inputSchema: {
          properties: {
            required: { type: "string" },
          },
          required: ["required"],
        } as Record<string, unknown>,
      },
    );
    expect(result).toEqual({ required: "" });
  });

  it("should coerce values by type", () => {
    const result = buildProbeArgs(
      {
        count: "42",
        active: "true",
        config: '{"key":"value"}',
      },
      {
        inputSchema: {
          properties: {
            count: { type: "integer" },
            active: { type: "boolean" },
            config: { type: "object" },
          },
          required: ["count", "active", "config"],
        } as Record<string, unknown>,
      },
    );
    expect(result).toEqual({
      count: 42,
      active: true,
      config: { key: "value" },
    });
  });

  it("should throw if coercion fails on a required property", () => {
    expect(() =>
      buildProbeArgs(
        { count: "not-a-number" },
        {
          inputSchema: {
            properties: {
              count: { type: "integer" },
            },
            required: ["count"],
          } as Record<string, unknown>,
        },
      ),
    ).toThrow("Argument must be a number");
  });

  it("should handle missing form value for optional property", () => {
    const result = buildProbeArgs(
      {},
      {
        inputSchema: {
          properties: {
            optional: { type: "string" },
          },
          required: [],
        } as Record<string, unknown>,
      },
    );
    expect(result).toEqual({});
  });
});
